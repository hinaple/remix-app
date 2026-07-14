package com.fainthit.remix.core

import android.app.Activity
import android.app.ActivityManager
import android.app.KeyguardManager
import android.app.admin.DevicePolicyManager
import android.media.AudioManager
import android.os.BatteryManager
import android.os.Build
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.ActivityInfo
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.PowerManager
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.InputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.zip.ZipInputStream

class RemixCore(private val activity: Activity) {
    private val context = activity.applicationContext
    private val devicePolicyManager =
        context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
    private val keyguardManager = context.getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    private val powerManager = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val vibrator = context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var cpuWakeLock: PowerManager.WakeLock? = null
    private var systemUiMode = SystemUiMode(immersive = false, hideSystemBars = false)
    private var keepScreenOn = false
    private var autoBrightness = false
    private var screenBrightness = 1f
    private var screenOrientation = "unspecified"
    private var screenTimeout: Int? = null
    private var previousScreenTimeout: Int? = null
    private var softInputAdjust = "nothing"
    private var softInputState = "unspecified"

    @Suppress("DEPRECATION")
    fun wakeScreen() {
        activity.runOnUiThread {
            activity.window.addFlags(
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED,
            )
        }

        val wakeLock = powerManager.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
                PowerManager.ACQUIRE_CAUSES_WAKEUP or
                PowerManager.ON_AFTER_RELEASE,
            "remixApp:screenWake",
        )
        wakeLock.acquire(3_000)
    }

    fun setKeepScreenOn(enabled: Boolean) {
        keepScreenOn = enabled

        activity.runOnUiThread {
            if (enabled) {
                activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }

    fun setAutoBrightness(enabled: Boolean) {
        autoBrightness = enabled

        val mode = if (enabled) {
            Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
        } else {
            Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
        }

        setSystemSetting(Settings.System.SCREEN_BRIGHTNESS_MODE, mode.toString())
    }

    fun setScreenBrightness(brightness: Float) {
        val clamped = brightness.coerceIn(0f, 1f)
        screenBrightness = clamped

        activity.runOnUiThread {
            val attributes = activity.window.attributes
            attributes.screenBrightness = clamped
            activity.window.attributes = attributes
        }

        setSystemSetting(
            Settings.System.SCREEN_BRIGHTNESS,
            (clamped * 255).toInt().coerceIn(0, 255).toString(),
        )
    }

    fun setScreenTimeout(timeout: Int?) {
        if (timeout == null) {
            previousScreenTimeout?.let {
                setSystemSetting(Settings.System.SCREEN_OFF_TIMEOUT, it.toString())
            }
            previousScreenTimeout = null
            screenTimeout = null
            return
        }

        if (previousScreenTimeout == null) {
            previousScreenTimeout = readScreenTimeout()
        }

        val clamped = timeout.coerceAtLeast(0)
        screenTimeout = clamped
        setSystemSetting(Settings.System.SCREEN_OFF_TIMEOUT, clamped.toString())
    }

    fun setSystemUiMode(immersive: Boolean, hideSystemBars: Boolean) {
        systemUiMode = SystemUiMode(immersive, hideSystemBars)
        applySystemUiMode()
    }

    fun setScreenOrientation(orientation: String) {
        screenOrientation = normalizeOrientation(orientation)

        activity.runOnUiThread {
            activity.requestedOrientation = when (screenOrientation) {
                "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                "reversePortrait" -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_PORTRAIT
                "reverseLandscape" -> ActivityInfo.SCREEN_ORIENTATION_REVERSE_LANDSCAPE
                "sensor" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR
                "fullSensor" -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
                "locked" -> ActivityInfo.SCREEN_ORIENTATION_LOCKED
                "unspecified" -> ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                else -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            }
        }
    }

    fun setSoftInputMode(adjust: String, state: String) {
        softInputAdjust = normalizeKeyboardAdjust(adjust)
        softInputState = normalizeKeyboardState(state)

        activity.runOnUiThread {
            activity.window.setSoftInputMode(
                softInputAdjustFlag(softInputAdjust) or softInputStateFlag(softInputState),
            )
        }
    }

    fun setForegroundService(enabled: Boolean) {
        if (enabled) {
            RemixForegroundService.start(context)
        } else {
            RemixForegroundService.stop(context)
        }
    }

    fun applySystemUiMode() {
        activity.runOnUiThread {
            val decorView = activity.window.decorView
            val controller = WindowCompat.getInsetsController(activity.window, decorView)

            if (Build.VERSION.SDK_INT < 35) {
                @Suppress("DEPRECATION")
                activity.window.statusBarColor = Color.TRANSPARENT
                @Suppress("DEPRECATION")
                activity.window.navigationBarColor = Color.TRANSPARENT
            }
            WindowCompat.setDecorFitsSystemWindows(activity.window, false)
            controller.isAppearanceLightStatusBars = false
            controller.isAppearanceLightNavigationBars = false

            if (systemUiMode.hideSystemBars) {
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }

            controller.systemBarsBehavior = if (systemUiMode.immersive) {
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            } else {
                WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
            }

            @Suppress("DEPRECATION")
            decorView.systemUiVisibility = if (systemUiMode.hideSystemBars || systemUiMode.immersive) {
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                    View.SYSTEM_UI_FLAG_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                    View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN or
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
            } else {
                0
            }
        }
    }

    fun setKeepCpuAwake(enabled: Boolean) {
        if (enabled) {
            if (cpuWakeLock?.isHeld == true) {
                return
            }

            cpuWakeLock = powerManager.newWakeLock(
                PowerManager.PARTIAL_WAKE_LOCK,
                "remixApp:cpuWake",
            ).apply {
                setReferenceCounted(false)
                acquire()
            }
            return
        }

        releaseCpuWakeLock()
    }

    fun setKioskMode(enabled: Boolean): KioskState {
        if (enabled) {
            setShowOverLockScreen(true)
            setKeyguardDisabled(true)
            wakeScreen()
            allowOwnLockTaskPackage()
            val permitted = devicePolicyManager.isLockTaskPermitted(context.packageName)

            if (permitted && !isLockTaskActive()) {
                runOnUiThreadBlocking {
                    activity.startLockTask()
                }
            }

            return KioskState(waitForLockTaskState(true), permitted)
        }

        if (isLockTaskActive()) {
            runOnUiThreadBlocking {
                activity.stopLockTask()
            }
        }

        setKeyguardDisabled(false)
        setShowOverLockScreen(false)
        return KioskState(
            waitForLockTaskState(false),
            devicePolicyManager.isLockTaskPermitted(context.packageName),
        )
    }

    fun getDevicePolicyState(): DevicePolicyState {
        return DevicePolicyState(
            deviceOwner = devicePolicyManager.isDeviceOwnerApp(context.packageName),
            adminActive = findOwnAdmin() != null,
            lockTaskPermitted = devicePolicyManager.isLockTaskPermitted(context.packageName),
            lockTaskActive = isLockTaskActive(),
        )
    }

    fun getBatteryStatus(): BatteryStatus {
        val intent = context.registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
        val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
        val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
        val status = intent?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
        val normalizedLevel = if (level >= 0 && scale > 0) {
            (level.toFloat() / scale.toFloat()).coerceIn(0f, 1f)
        } else {
            0f
        }

        return BatteryStatus(
            level = normalizedLevel,
            charging = status == BatteryManager.BATTERY_STATUS_CHARGING ||
                status == BatteryManager.BATTERY_STATUS_FULL,
        )
    }

    fun getNetworkStatus(): NetworkStatus {
        val network = connectivityManager.activeNetwork ?: return NetworkStatus(false, "none")
        val capabilities = connectivityManager.getNetworkCapabilities(network)
            ?: return NetworkStatus(false, "unknown")

        return NetworkStatus(
            connected = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET),
            type = when {
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) -> "wifi"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) -> "cellular"
                capabilities.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) -> "ethernet"
                else -> "unknown"
            },
        )
    }

    fun getScreenStatus(): ScreenStatus {
        return ScreenStatus(
            interactive = powerManager.isInteractive,
            keepOn = keepScreenOn,
            autoBrightness = readAutoBrightness(),
            brightness = readScreenBrightness(),
            timeout = screenTimeout ?: readScreenTimeout(),
            orientation = screenOrientation,
        )
    }

    fun getKeyboardStatus(): KeyboardStatus {
        val status = AtomicReference(KeyboardStatus(false, 0))

        runOnUiThreadBlocking {
            status.set(readKeyboardStatus())
        }

        return status.get()
    }

    private fun readKeyboardStatus(): KeyboardStatus {
        val decorView = activity.window.decorView
        val rootInsets = decorView.rootWindowInsets ?: return KeyboardStatus(false, 0)
        val insets = WindowInsetsCompat.toWindowInsetsCompat(rootInsets, decorView)
        val visible = insets.isVisible(WindowInsetsCompat.Type.ime())
        val imeInsets = insets.getInsets(WindowInsetsCompat.Type.ime())
        val density = context.resources.displayMetrics.density.takeIf { it > 0f } ?: 1f
        val height = if (visible) {
            (imeInsets.bottom / density).toInt().coerceAtLeast(0)
        } else {
            0
        }

        return KeyboardStatus(visible, height)
    }

    fun getMediaVolume(): MediaVolume {
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
        val volume = if (max > 0) {
            (current.toFloat() / max.toFloat()).coerceIn(0f, 1f)
        } else {
            0f
        }

        return MediaVolume(volume)
    }

    fun setMediaVolume(volume: Float) {
        val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
        val target = (volume.coerceIn(0f, 1f) * max).toInt().coerceIn(0, max)
        audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, target, 0)
    }

    @Suppress("DEPRECATION")
    fun vibrate(duration: Long) {
        val clamped = duration.coerceAtLeast(1L)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(
                    clamped,
                    VibrationEffect.DEFAULT_AMPLITUDE,
                ),
            )
            return
        }

        vibrator.vibrate(clamped)
    }

    private fun setSystemSetting(name: String, value: String) {
        val admin = findOwnAdmin()

        if (admin != null && devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
            devicePolicyManager.setSystemSetting(admin, name, value)
            return
        }

        Settings.System.putString(context.contentResolver, name, value)
    }

    private fun readAutoBrightness(): Boolean {
        return try {
            Settings.System.getInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
            ) == Settings.System.SCREEN_BRIGHTNESS_MODE_AUTOMATIC
        } catch (_: Settings.SettingNotFoundException) {
            autoBrightness
        } catch (_: SecurityException) {
            autoBrightness
        }
    }

    private fun readScreenBrightness(): Float {
        return try {
            (Settings.System.getInt(
                context.contentResolver,
                Settings.System.SCREEN_BRIGHTNESS,
            ).toFloat() / 255f).coerceIn(0f, 1f)
        } catch (_: Settings.SettingNotFoundException) {
            screenBrightness
        } catch (_: SecurityException) {
            screenBrightness
        }
    }

    private fun readScreenTimeout(): Int? {
        return try {
            Settings.System.getInt(
                context.contentResolver,
                Settings.System.SCREEN_OFF_TIMEOUT,
            )
        } catch (_: Settings.SettingNotFoundException) {
            screenTimeout
        } catch (_: SecurityException) {
            screenTimeout
        }
    }

    private fun normalizeOrientation(orientation: String): String {
        return when (orientation) {
            "portrait",
            "landscape",
            "reversePortrait",
            "reverseLandscape",
            "sensor",
            "fullSensor",
            "locked",
            "unspecified",
            -> orientation
            else -> "portrait"
        }
    }

    private fun normalizeKeyboardAdjust(adjust: String): String {
        return when (adjust) {
            "resize",
            "pan",
            "nothing",
            -> adjust
            else -> "nothing"
        }
    }

    private fun normalizeKeyboardState(state: String): String {
        return when (state) {
            "unspecified",
            "hidden",
            "alwaysHidden",
            "visible",
            "alwaysVisible",
            -> state
            else -> "unspecified"
        }
    }

    private fun softInputAdjustFlag(adjust: String): Int {
        return when (adjust) {
            "resize" -> WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
            "pan" -> WindowManager.LayoutParams.SOFT_INPUT_ADJUST_PAN
            "nothing" -> WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
            else -> WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING
        }
    }

    private fun softInputStateFlag(state: String): Int {
        return when (state) {
            "hidden" -> WindowManager.LayoutParams.SOFT_INPUT_STATE_HIDDEN
            "alwaysHidden" -> WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_HIDDEN
            "visible" -> WindowManager.LayoutParams.SOFT_INPUT_STATE_VISIBLE
            "alwaysVisible" -> WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
            "unspecified" -> WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED
            else -> WindowManager.LayoutParams.SOFT_INPUT_STATE_UNSPECIFIED
        }
    }

    fun installProjectPackage(path: String): InstalledProject {
        val projectsDirectory = File(context.filesDir, "remix/projects")
        val stagingDirectory = File(projectsDirectory, "staging")
        val activeDirectory = activeProjectDirectory()
        val previousDirectory = File(projectsDirectory, "previous")

        stagingDirectory.deleteRecursively()
        stagingDirectory.mkdirs()

        openProjectPackage(path).use { input ->
            unzipProject(input, stagingDirectory)
        }

        previousDirectory.deleteRecursively()

        if (activeDirectory.exists() && !activeDirectory.renameTo(previousDirectory)) {
            stagingDirectory.deleteRecursively()
            throw IllegalStateException("Failed to move current project out of the active slot")
        }

        if (!stagingDirectory.renameTo(activeDirectory)) {
            activeDirectory.deleteRecursively()
            if (previousDirectory.exists()) {
                previousDirectory.renameTo(activeDirectory)
            }
            throw IllegalStateException("Failed to move staged project into the active slot")
        }

        previousDirectory.deleteRecursively()
        return InstalledProject(true, activeDirectory.absolutePath, directoryUrl(activeDirectory))
    }

    fun getActiveProject(): InstalledProject {
        val activeDirectory = activeProjectDirectory()

        if (!activeDirectory.isDirectory) {
            return InstalledProject(false, null, null)
        }

        return InstalledProject(true, activeDirectory.absolutePath, directoryUrl(activeDirectory))
    }

    fun exitApp() {
        destroy()

        if (isLockTaskActive()) {
            runOnUiThreadBlocking {
                activity.stopLockTask()
            }
        }

        runOnUiThreadBlocking {
            activity.finishAndRemoveTask()
        }
    }

    fun destroy() {
        releaseCpuWakeLock()
        setForegroundService(false)
        setScreenOrientation("unspecified")
        setSoftInputMode(adjust = "nothing", state = "unspecified")
        setKeyguardDisabled(false)
        setShowOverLockScreen(false)
        setKeepScreenOn(false)
        setScreenTimeout(null)
        setSystemUiMode(immersive = false, hideSystemBars = false)
    }

    private fun allowOwnLockTaskPackage() {
        if (!devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
            return
        }

        val admin = findOwnAdmin() ?: return
        devicePolicyManager.setLockTaskPackages(admin, arrayOf(context.packageName))
    }

    private fun setKeyguardDisabled(disabled: Boolean) {
        if (!devicePolicyManager.isDeviceOwnerApp(context.packageName)) {
            return
        }

        val admin = findOwnAdmin() ?: return
        devicePolicyManager.setKeyguardDisabled(admin, disabled)
    }

    @Suppress("DEPRECATION")
    private fun setShowOverLockScreen(enabled: Boolean) {
        activity.runOnUiThread {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                activity.setShowWhenLocked(enabled)
                activity.setTurnScreenOn(enabled)
                if (enabled) {
                    keyguardManager.requestDismissKeyguard(activity, null)
                }
            }

            if (enabled) {
                activity.window.addFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
                )
            } else {
                activity.window.clearFlags(
                    WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                        WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                        WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD,
                )
            }
        }
    }

    private fun findOwnAdmin(): ComponentName? {
        return devicePolicyManager.activeAdmins?.firstOrNull {
            it.packageName == context.packageName
        }
    }

    private fun isLockTaskActive(): Boolean {
        val activityManager = context.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        return activityManager.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE
    }

    private fun releaseCpuWakeLock() {
        cpuWakeLock?.let {
            if (it.isHeld) {
                it.release()
            }
        }
        cpuWakeLock = null
    }

    private fun runOnUiThreadBlocking(action: () -> Unit) {
        if (activity.mainLooper.isCurrentThread) {
            action()
            return
        }

        val latch = CountDownLatch(1)
        val error = AtomicReference<Throwable?>()

        activity.runOnUiThread {
            try {
                action()
            } catch (throwable: Throwable) {
                error.set(throwable)
            } finally {
                latch.countDown()
            }
        }

        if (!latch.await(2, TimeUnit.SECONDS)) {
            throw IllegalStateException("Timed out while running Android UI action")
        }

        error.get()?.let { throw it }
    }

    private fun waitForLockTaskState(active: Boolean): Boolean {
        val deadline = SystemClock.uptimeMillis() + 1_000

        while (SystemClock.uptimeMillis() < deadline) {
            val current = isLockTaskActive()

            if (current == active) {
                return current
            }

            Thread.sleep(50)
        }

        return isLockTaskActive()
    }

    private fun activeProjectDirectory(): File {
        return File(context.filesDir, "remix/projects/active")
    }

    private fun openProjectPackage(path: String): InputStream {
        val uri = Uri.parse(path)

        return when (uri.scheme) {
            "content" -> context.contentResolver.openInputStream(uri)
                ?: throw IllegalArgumentException("Cannot open project package URI: $path")
            "file" -> FileInputStream(
                File(uri.path ?: throw IllegalArgumentException("Invalid file URI: $path")),
            )
            else -> FileInputStream(File(path))
        }
    }

    private fun unzipProject(input: InputStream, targetDirectory: File) {
        val targetRoot = targetDirectory.canonicalFile

        ZipInputStream(input).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break

                if (entry.name.isBlank()) {
                    zip.closeEntry()
                    continue
                }

                val target = File(targetRoot, entry.name).canonicalFile

                if (!isInsideDirectory(targetRoot, target)) {
                    zip.closeEntry()
                    continue
                }

                if (entry.isDirectory) {
                    target.mkdirs()
                } else {
                    target.parentFile?.mkdirs()
                    FileOutputStream(target).use { output ->
                        zip.copyTo(output)
                    }
                }

                zip.closeEntry()
            }
        }
    }

    private fun isInsideDirectory(root: File, target: File): Boolean {
        val rootPath = root.path
        val targetPath = target.path
        return targetPath == rootPath || targetPath.startsWith(rootPath + File.separator)
    }

    private fun directoryUrl(directory: File): String {
        return Uri.fromFile(directory).toString().trimEnd('/') + "/"
    }
}

data class KioskState(val active: Boolean, val permitted: Boolean)

data class DevicePolicyState(
    val deviceOwner: Boolean,
    val adminActive: Boolean,
    val lockTaskPermitted: Boolean,
    val lockTaskActive: Boolean,
)

data class BatteryStatus(
    val level: Float,
    val charging: Boolean,
)

data class NetworkStatus(
    val connected: Boolean,
    val type: String,
)

data class ScreenStatus(
    val interactive: Boolean,
    val keepOn: Boolean,
    val autoBrightness: Boolean,
    val brightness: Float?,
    val timeout: Int?,
    val orientation: String,
)

data class KeyboardStatus(
    val visible: Boolean,
    val height: Int,
)

data class MediaVolume(
    val volume: Float,
)

data class InstalledProject(
    val installed: Boolean,
    val directory: String?,
    val url: String?,
)

private data class SystemUiMode(
    val immersive: Boolean,
    val hideSystemBars: Boolean,
)
