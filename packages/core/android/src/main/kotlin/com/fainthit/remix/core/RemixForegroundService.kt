package com.fainthit.remix.core

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.fainthit.remix.core.mqtt.RemixMqttRuntime

class RemixForegroundService : Service() {
    private var cpuWakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireCpuWakeLock()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startRuntimeForeground()
        RemixMqttRuntime.reload(applicationContext)

        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        RemixMqttRuntime.stop()
        releaseCpuWakeLock()
        stopForeground(STOP_FOREGROUND_REMOVE)
        super.onDestroy()
    }

    private fun acquireCpuWakeLock() {
        if (cpuWakeLock?.isHeld == true) {
            return
        }

        val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
        cpuWakeLock = powerManager.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "remixApp:runtimeCpu",
        ).apply {
            setReferenceCounted(false)
            acquire()
        }
    }

    private fun releaseCpuWakeLock() {
        cpuWakeLock?.takeIf { it.isHeld }?.release()
        cpuWakeLock = null
    }

    private fun startRuntimeForeground() {
        val notification = createNotification()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE,
            )
            return
        }

        startForeground(NOTIFICATION_ID, notification)
    }

    private fun createNotification(): Notification {
        val launchIntent = packageManager.getLaunchIntentForPackage(packageName)
        val pendingIntent = PendingIntent.getActivity(
            this,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.remix_core_ic_notification)
            .setContentTitle("remixApp")
            .setContentText("Host runtime is active")
            .setOngoing(true)
            .setSilent(true)
            .setContentIntent(pendingIntent)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }

        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            CHANNEL_ID,
            "remixApp Runtime",
            NotificationManager.IMPORTANCE_LOW,
        ).apply {
            description = "Keeps the remixApp Host runtime active"
            setShowBadge(false)
        }

        manager.createNotificationChannel(channel)
    }

    companion object {
        private const val ACTION_SYNC = "com.fainthit.remix.core.action.SYNC_FOREGROUND"
        private const val CHANNEL_ID = "remixapp-runtime"
        private const val NOTIFICATION_ID = 9001

        fun start(context: Context) {
            val applicationContext = context.applicationContext
            val intent = Intent(applicationContext, RemixForegroundService::class.java).apply {
                action = ACTION_SYNC
            }
            ContextCompat.startForegroundService(applicationContext, intent)
        }

        fun syncActiveProject(context: Context) {
            start(context)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, RemixForegroundService::class.java))
        }
    }
}
