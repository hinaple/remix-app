package com.fainthit.remix.core

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.view.KeyEvent
import androidx.activity.result.ActivityResult
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.ActivityCallback
import com.getcapacitor.annotation.CapacitorPlugin
import androidx.core.view.ViewCompat

@CapacitorPlugin(name = "RemixCore")
class RemixCorePlugin : Plugin() {
    private lateinit var implementation: RemixCore
    private var batteryReceiver: BroadcastReceiver? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var screenReceiver: BroadcastReceiver? = null
    private var keyboardStatusUpdateCount = 0

    override fun load() {
        implementation = RemixCore(activity)
        activePlugin = this
        exitAppScheduled = false
    }

    @PluginMethod
    fun wakeScreen(call: PluginCall) {
        implementation.wakeScreen()
        call.resolve()
    }

    @PluginMethod
    fun setKeepScreenOn(call: PluginCall) {
        implementation.setKeepScreenOn(call.getBoolean("enabled", false) == true)
        emitScreenStatusIfActive()
        call.resolve()
    }

    @PluginMethod
    fun setAutoBrightness(call: PluginCall) {
        try {
            implementation.setAutoBrightness(call.getBoolean("enabled", false) == true)
            emitScreenStatusIfActive()
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to change automatic brightness state", error)
        }
    }

    @PluginMethod
    fun setScreenBrightness(call: PluginCall) {
        val brightness = call.getDouble("brightness")

        if (brightness == null) {
            call.reject("Screen brightness is required")
            return
        }

        try {
            implementation.setScreenBrightness(brightness.toFloat())
            emitScreenStatusIfActive()
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to change screen brightness", error)
        }
    }

    @PluginMethod
    fun setScreenTimeout(call: PluginCall) {
        try {
            implementation.setScreenTimeout(call.getInt("timeout"))
            emitScreenStatusIfActive()
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to change screen timeout", error)
        }
    }

    @PluginMethod
    fun setSystemUiMode(call: PluginCall) {
        implementation.setSystemUiMode(
            immersive = call.getBoolean("immersive", false) == true,
            hideSystemBars = call.getBoolean("hideSystemBars", false) == true,
        )
        call.resolve()
    }

    @PluginMethod
    fun setScreenOrientation(call: PluginCall) {
        implementation.setScreenOrientation(call.getString("orientation", "portrait") ?: "portrait")
        emitScreenStatusIfActive()
        call.resolve()
    }

    @PluginMethod
    fun setSoftInputMode(call: PluginCall) {
        implementation.setSoftInputMode(
            adjust = call.getString("adjust", "nothing") ?: "nothing",
            state = call.getString("state", "unspecified") ?: "unspecified",
        )
        emitKeyboardStatusIfActive()
        call.resolve()
    }

    @PluginMethod
    fun setForegroundService(call: PluginCall) {
        try {
            implementation.setForegroundService(call.getBoolean("enabled", false) == true)
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to change foreground service state", error)
        }
    }

    @PluginMethod
    fun setKeepCpuAwake(call: PluginCall) {
        implementation.setKeepCpuAwake(call.getBoolean("enabled", false) == true)
        call.resolve()
    }

    @PluginMethod
    fun setKioskMode(call: PluginCall) {
        try {
            val state = implementation.setKioskMode(call.getBoolean("enabled", false) == true)
            call.resolve(JSObject().apply {
                put("active", state.active)
                put("permitted", state.permitted)
            })
        } catch (error: Exception) {
            call.reject("Failed to change kiosk mode", error)
        }
    }

    @PluginMethod
    fun captureBack(call: PluginCall) {
        captureBack = call.getBoolean("enabled", false) == true
        call.resolve()
    }

    @PluginMethod
    fun captureKeys(call: PluginCall) {
        val values = mutableSetOf<String>()
        val keys = call.getArray("keys")

        if (keys != null) {
            for (index in 0 until keys.length()) {
                keys.optString(index)?.takeIf { it.isNotEmpty() }?.let(values::add)
            }
        }

        capturedKeys = values
        call.resolve()
    }

    @PluginMethod
    fun getDevicePolicyState(call: PluginCall) {
        val state = implementation.getDevicePolicyState()
        call.resolve(JSObject().apply {
            put("deviceOwner", state.deviceOwner)
            put("adminActive", state.adminActive)
            put("lockTaskPermitted", state.lockTaskPermitted)
            put("lockTaskActive", state.lockTaskActive)
        })
    }

    @PluginMethod
    fun getBatteryStatus(call: PluginCall) {
        call.resolve(batteryStatusObject(implementation.getBatteryStatus()))
    }

    @PluginMethod
    fun getNetworkStatus(call: PluginCall) {
        call.resolve(networkStatusObject(implementation.getNetworkStatus()))
    }

    @PluginMethod
    fun getScreenStatus(call: PluginCall) {
        call.resolve(screenStatusObject(implementation.getScreenStatus()))
    }

    @PluginMethod
    fun getKeyboardStatus(call: PluginCall) {
        call.resolve(keyboardStatusObject(implementation.getKeyboardStatus()))
    }

    @PluginMethod
    fun startBatteryStatusUpdates(call: PluginCall) {
        if (batteryReceiver == null) {
            batteryReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    emitBatteryStatus()
                }
            }
            context.registerReceiver(
                batteryReceiver,
                IntentFilter(Intent.ACTION_BATTERY_CHANGED),
            )
        }

        emitBatteryStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopBatteryStatusUpdates(call: PluginCall) {
        batteryReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        batteryReceiver = null
        call.resolve()
    }

    @PluginMethod
    fun startNetworkStatusUpdates(call: PluginCall) {
        if (networkCallback == null) {
            val connectivityManager =
                context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

            networkCallback = object : ConnectivityManager.NetworkCallback() {
                override fun onAvailable(network: Network) {
                    emitNetworkStatus()
                }

                override fun onLost(network: Network) {
                    emitNetworkStatus()
                }

                override fun onCapabilitiesChanged(
                    network: Network,
                    networkCapabilities: NetworkCapabilities,
                ) {
                    emitNetworkStatus()
                }
            }

            connectivityManager.registerDefaultNetworkCallback(networkCallback!!)
        }

        emitNetworkStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopNetworkStatusUpdates(call: PluginCall) {
        networkCallback?.let {
            try {
                val connectivityManager =
                    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        networkCallback = null
        call.resolve()
    }

    @PluginMethod
    fun startScreenStatusUpdates(call: PluginCall) {
        if (screenReceiver == null) {
            screenReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context, intent: Intent) {
                    emitScreenStatus()
                }
            }
            context.registerReceiver(
                screenReceiver,
                IntentFilter().apply {
                    addAction(Intent.ACTION_SCREEN_ON)
                    addAction(Intent.ACTION_SCREEN_OFF)
                    addAction(Intent.ACTION_USER_PRESENT)
                },
            )
        }

        emitScreenStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopScreenStatusUpdates(call: PluginCall) {
        screenReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        screenReceiver = null
        call.resolve()
    }

    @PluginMethod
    fun startKeyboardStatusUpdates(call: PluginCall) {
        keyboardStatusUpdateCount += 1

        if (keyboardStatusUpdateCount == 1) {
            activity.runOnUiThread {
                val decorView = activity.window.decorView
                ViewCompat.setOnApplyWindowInsetsListener(decorView) { _, insets ->
                    emitKeyboardStatus()
                    insets
                }
                ViewCompat.requestApplyInsets(decorView)
            }
        }

        emitKeyboardStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopKeyboardStatusUpdates(call: PluginCall) {
        keyboardStatusUpdateCount = (keyboardStatusUpdateCount - 1).coerceAtLeast(0)

        if (keyboardStatusUpdateCount == 0) {
            activity.runOnUiThread {
                ViewCompat.setOnApplyWindowInsetsListener(activity.window.decorView, null)
            }
        }

        call.resolve()
    }

    @PluginMethod
    fun getMediaVolume(call: PluginCall) {
        val volume = implementation.getMediaVolume()
        call.resolve(JSObject().apply {
            put("volume", volume.volume)
        })
    }

    @PluginMethod
    fun setMediaVolume(call: PluginCall) {
        val volume = call.getDouble("volume")

        if (volume == null) {
            call.reject("Media volume is required")
            return
        }

        try {
            implementation.setMediaVolume(volume.toFloat())
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to change media volume", error)
        }
    }

    @PluginMethod
    fun vibrate(call: PluginCall) {
        try {
            implementation.vibrate((call.getInt("duration", 250) ?: 250).toLong())
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to trigger vibration", error)
        }
    }

    @PluginMethod
    fun installProjectPackage(call: PluginCall) {
        val path = call.getString("path")

        if (path.isNullOrBlank()) {
            call.reject("Project package path is required")
            return
        }

        try {
            val project = implementation.installProjectPackage(path)
            call.resolve(projectObject(project))
        } catch (error: Exception) {
            call.reject("Failed to install project package", error)
        }
    }

    @PluginMethod
    fun getActiveProject(call: PluginCall) {
        val project = implementation.getActiveProject()
        call.resolve(projectObject(project))
    }

    @PluginMethod
    fun consumeLaunchProjectInstall(call: PluginCall) {
        val intent = activity.intent
        val path = launchProjectInstallPath(intent)

        intent.removeExtra("remix.install")
        intent.removeExtra("install")
        intent.data = null

        call.resolve(JSObject().apply {
            if (!path.isNullOrBlank()) {
                put("path", path)
            }
        })
    }

    @PluginMethod
    fun pickProjectPackage(call: PluginCall) {
        val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
            addCategory(Intent.CATEGORY_OPENABLE)
            type = "*/*"
            addFlags(
                Intent.FLAG_GRANT_READ_URI_PERMISSION or
                    Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION,
            )
        }

        try {
            startActivityForResult(call, intent, "handlePickProjectPackage")
        } catch (error: ActivityNotFoundException) {
            call.reject("No document picker is available", error)
        }
    }

    @PluginMethod
    fun exitApp(call: PluginCall) {
        try {
            implementation.exitApp()
            call.resolve()
        } catch (error: Exception) {
            call.reject("Failed to exit app", error)
        }
    }

    @ActivityCallback
    private fun handlePickProjectPackage(call: PluginCall, result: ActivityResult) {
        if (result.resultCode != Activity.RESULT_OK) {
            call.resolve(JSObject().apply {
                put("canceled", true)
            })
            return
        }

        val uri = result.data?.data

        if (uri == null) {
            call.reject("Project package picker returned no URI")
            return
        }

        val flags = result.data?.flags ?: 0
        val readFlag = flags and Intent.FLAG_GRANT_READ_URI_PERMISSION

        if (readFlag != 0) {
            try {
                context.contentResolver.takePersistableUriPermission(uri, readFlag)
            } catch (_: SecurityException) {
                // Some providers grant transient read access only; install immediately still works.
            }
        }

        call.resolve(JSObject().apply {
            put("canceled", false)
            put("path", uri.toString())
        })
    }

    override fun handleOnResume() {
        implementation.applySystemUiMode()
        emitScreenStatusIfActive()
        emitKeyboardStatusIfActive()
        emitNetworkStatusIfActive()
        emitLifecycle("resumed")
        super.handleOnResume()
    }

    override fun handleOnPause() {
        emitLifecycle("paused")
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        stopBatteryStatusUpdatesSilently()
        stopNetworkStatusUpdatesSilently()
        stopScreenStatusUpdatesSilently()
        stopKeyboardStatusUpdatesSilently()
        implementation.destroy()
        if (activePlugin === this) {
            activePlugin = null
        }
        super.handleOnDestroy()
    }

    private fun emitKey(key: String, event: KeyEvent) {
        notifyListeners("key", JSObject().apply {
            put("key", key)
            put("action", if (event.action == KeyEvent.ACTION_DOWN) "down" else "up")
        })
    }

    private fun emitBatteryStatus() {
        notifyListeners("batteryStatus", batteryStatusObject(implementation.getBatteryStatus()))
    }

    private fun emitNetworkStatus() {
        notifyListeners("networkStatus", networkStatusObject(implementation.getNetworkStatus()))
    }

    private fun emitScreenStatus() {
        notifyListeners("screenStatus", screenStatusObject(implementation.getScreenStatus()))
    }

    private fun emitKeyboardStatus() {
        notifyListeners("keyboardStatus", keyboardStatusObject(implementation.getKeyboardStatus()))
    }

    private fun emitLifecycle(state: String) {
        notifyListeners("lifecycle", JSObject().apply {
            put("state", state)
        })
    }

    private fun emitProjectInstallRequested(path: String) {
        notifyListeners("projectInstallRequested", JSObject().apply {
            put("path", path)
        })
    }

    private fun emitNetworkStatusIfActive() {
        if (networkCallback != null) {
            emitNetworkStatus()
        }
    }

    private fun emitScreenStatusIfActive() {
        if (screenReceiver != null) {
            emitScreenStatus()
        }
    }

    private fun emitKeyboardStatusIfActive() {
        if (keyboardStatusUpdateCount > 0) {
            emitKeyboardStatus()
        }
    }

    private fun batteryStatusObject(status: BatteryStatus): JSObject {
        return JSObject().apply {
            put("level", status.level)
            put("charging", status.charging)
        }
    }

    private fun networkStatusObject(status: NetworkStatus): JSObject {
        return JSObject().apply {
            put("connected", status.connected)
            put("type", status.type)
        }
    }

    private fun screenStatusObject(status: ScreenStatus): JSObject {
        return JSObject().apply {
            put("interactive", status.interactive)
            put("keepOn", status.keepOn)
            put("autoBrightness", status.autoBrightness)
            status.brightness?.let { put("brightness", it) }
            status.timeout?.let { put("timeout", it) }
            put("orientation", status.orientation)
        }
    }

    private fun keyboardStatusObject(status: KeyboardStatus): JSObject {
        return JSObject().apply {
            put("visible", status.visible)
            put("height", status.height)
        }
    }

    private fun projectObject(project: InstalledProject): JSObject {
        return JSObject().apply {
            put("installed", project.installed)
            project.directory?.let { put("directory", it) }
            project.url?.let { put("url", it) }
        }
    }

    private fun stopBatteryStatusUpdatesSilently() {
        batteryReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        batteryReceiver = null
    }

    private fun stopNetworkStatusUpdatesSilently() {
        networkCallback?.let {
            try {
                val connectivityManager =
                    context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
                connectivityManager.unregisterNetworkCallback(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        networkCallback = null
    }

    private fun stopScreenStatusUpdatesSilently() {
        screenReceiver?.let {
            try {
                context.unregisterReceiver(it)
            } catch (_: IllegalArgumentException) {
                // Already unregistered.
            }
        }
        screenReceiver = null
    }

    private fun stopKeyboardStatusUpdatesSilently() {
        keyboardStatusUpdateCount = 0
        activity.runOnUiThread {
            ViewCompat.setOnApplyWindowInsetsListener(activity.window.decorView, null)
        }
    }

    companion object {
        @Volatile
        private var activePlugin: RemixCorePlugin? = null

        @Volatile
        private var captureBack = false

        @Volatile
        private var capturedKeys: Set<String> = emptySet()

        @Volatile
        private var exitAppScheduled = false

        private val exitKeySequence = FastAlternatingVolumeKeySequence()

        @JvmStatic
        fun reapplySystemUiMode() {
            activePlugin?.implementation?.applySystemUiMode()
        }

        @JvmStatic
        fun handleNewIntent(intent: Intent) {
            val path = launchProjectInstallPath(intent) ?: return
            val plugin = activePlugin ?: return

            intent.removeExtra("remix.install")
            intent.removeExtra("install")
            intent.data = null
            plugin.emitProjectInstallRequested(path)
        }

        @JvmStatic
        fun handleKeyEvent(event: KeyEvent): Boolean {
            if (event.action != KeyEvent.ACTION_DOWN && event.action != KeyEvent.ACTION_UP) {
                return false
            }

            val key = keyName(event.keyCode) ?: return false
            val shouldExitApp = exitKeySequence.handle(key, event)

            val shouldCapture = if (key == "BACK") {
                captureBack || key in capturedKeys
            } else {
                key in capturedKeys
            }

            if (shouldExitApp) {
                scheduleExitApp()
            }

            if (!shouldCapture) {
                return false
            }

            activePlugin?.emitKey(key, event)
            return true
        }

        private fun scheduleExitApp() {
            if (exitAppScheduled) {
                return
            }

            val plugin = activePlugin ?: return
            exitAppScheduled = true
            plugin.activity.window.decorView.post {
                plugin.implementation.exitApp()
            }
        }

        private fun keyName(keyCode: Int): String? {
            return when (keyCode) {
                KeyEvent.KEYCODE_BACK -> "BACK"
                KeyEvent.KEYCODE_VOLUME_UP -> "VOLUME_UP"
                KeyEvent.KEYCODE_VOLUME_DOWN -> "VOLUME_DOWN"
                KeyEvent.KEYCODE_POWER -> "POWER"
                KeyEvent.KEYCODE_HOME -> "HOME"
                KeyEvent.KEYCODE_MENU -> "MENU"
                else -> null
            }
        }

        private fun launchProjectInstallPath(intent: Intent): String? {
            return intent.getStringExtra("remix.install")
                ?: intent.getStringExtra("install")
                ?: intent.dataString
        }
    }
}

private class FastAlternatingVolumeKeySequence {
    private var lastKey: String? = null
    private var lastEventTime = 0L
    private var count = 0

    fun handle(key: String, event: KeyEvent): Boolean {
        if (key != "VOLUME_UP" && key != "VOLUME_DOWN") {
            reset()
            return false
        }

        if (event.action != KeyEvent.ACTION_DOWN) {
            return false
        }

        if (event.repeatCount > 0) {
            return false
        }

        val eventTime = event.eventTime
        val previousKey = lastKey
        val isAlternating = previousKey != null && previousKey != key
        val isFastEnough = lastEventTime > 0L && eventTime - lastEventTime <= MAX_INTERVAL_MS

        count = if (isAlternating && isFastEnough) {
            count + 1
        } else {
            1
        }

        lastKey = key
        lastEventTime = eventTime

        if (count < REQUIRED_INPUTS) {
            return false
        }

        reset()
        return true
    }

    private fun reset() {
        lastKey = null
        lastEventTime = 0L
        count = 0
    }

    private companion object {
        const val REQUIRED_INPUTS = 10
        const val MAX_INTERVAL_MS = 200L
    }
}
