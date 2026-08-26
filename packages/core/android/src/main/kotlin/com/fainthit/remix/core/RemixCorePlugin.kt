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
import android.util.Base64
import android.util.Log
import android.view.KeyEvent
import androidx.activity.result.ActivityResult
import com.fainthit.remix.core.mqtt.RemixMqttMessage
import com.fainthit.remix.core.mqtt.RemixMqttRuntime
import com.fainthit.remix.core.mqtt.RemixMqttStatus
import com.fainthit.remix.core.actions.RemixNativeActionRegistry
import com.fainthit.remix.core.nativeevents.RemixNativeEventConfigLoader
import com.fainthit.remix.core.nativeevents.RemixNativeEventEngine
import com.fainthit.remix.core.project.RemixProjectConfigRepository
import com.fainthit.remix.core.project.RemixProjectConfiguration
import com.fainthit.remix.core.vibration.RemixVibrationController
import com.getcapacitor.JSArray
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
    private lateinit var vibration: RemixVibrationController
    private var batteryReceiver: BroadcastReceiver? = null
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var screenReceiver: BroadcastReceiver? = null
    private var keyboardStatusUpdateCount = 0
    private var batteryStatusRequestedByJs = false
    private var networkStatusRequestedByJs = false
    private var screenStatusRequestedByJs = false
    private var batteryStatusRequiredByNativeEvents = false
    private var networkStatusRequiredByNativeEvents = false
    private var screenStatusRequiredByNativeEvents = false
    private var keyboardStatusRequiredByNativeEvents = false
    private lateinit var nativeActions: RemixNativeActionRegistry
    private lateinit var nativeEventEngine: RemixNativeEventEngine
    private var projectRuntimeMounted = false
    private val mqttListener = object : RemixMqttRuntime.Listener {
        override fun onStatus(status: RemixMqttStatus) {
            val payload = mqttStatusObject(status)
            nativeEventEngine.onEvent(RemixEventNames.MQTT_STATUS, payload)
            notifyListeners(RemixEventNames.MQTT_STATUS, payload)
        }

        override fun onMessage(message: RemixMqttMessage) {
            val payload = mqttMessageObject(message)
            nativeEventEngine.onEvent(RemixEventNames.MQTT_MESSAGE, payload)
            notifyListeners(RemixEventNames.MQTT_MESSAGE, payload)
        }
    }

    override fun load() {
        implementation = RemixCore(activity)
        vibration = RemixVibrationController(context)
        nativeActions = RemixNativeActionRegistry(
            core = implementation,
            vibration = vibration,
            setCaptureBack = { captureBack = it },
            setCapturedKeys = { capturedKeys = it },
            onScreenChanged = {
                activity.runOnUiThread { notifyScreenStatus() }
            },
        )
        nativeEventEngine = RemixNativeEventEngine(
            actions = nativeActions,
            listener = object : RemixNativeEventEngine.Listener {
                override fun onWebActionRequested(request: RemixNativeEventEngine.WebActionRequest) {
                    activity.runOnUiThread { emitNativeActionRequest(request) }
                }

                override fun onActionFailed(type: String, error: Throwable) {
                    Log.e(TAG, "Native event action failed: $type", error)
                }
            },
        )
        reloadNativeEventConfig()
        activePlugin = this
        exitAppScheduled = false
        RemixMqttRuntime.addListener(mqttListener)
        RemixForegroundService.syncActiveProject(context)
    }

    @PluginMethod
    fun executeAction(call: PluginCall) {
        val type = call.getString("type")
        if (type.isNullOrBlank()) {
            call.reject("Action type is required")
            return
        }

        nativeActions.execute(type, call.getObject("args") ?: JSObject()) { error ->
            if (error == null) {
                call.resolve()
            } else {
                call.reject(
                    "Failed to execute action $type",
                    error as? Exception ?: Exception(error),
                )
            }
        }
    }

    @PluginMethod
    fun setProjectRuntimeState(call: PluginCall) {
        val mounted = call.getBoolean("mounted", false) == true
        projectRuntimeMounted = mounted
        if (mounted) reloadNativeEventConfig()
        nativeEventEngine.setProjectMounted(mounted)
        syncNativeEventSources(mounted)
        call.resolve()
    }

    @PluginMethod
    fun completeWebAction(call: PluginCall) {
        val requestId = call.getString("requestId")
        if (requestId.isNullOrBlank()) {
            call.reject("Web action requestId is required")
            return
        }
        val error = if (call.getString("status") == "failed") {
            call.getString("error") ?: "WebView action failed"
        } else {
            null
        }
        nativeEventEngine.completeWebAction(requestId, error)
        call.resolve()
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
    fun setSoftInputMode(call: PluginCall) {
        implementation.setSoftInputMode(
            adjust = call.getString("adjust", "nothing") ?: "nothing",
            state = call.getString("state", "unspecified") ?: "unspecified",
        )
        emitKeyboardStatusIfActive()
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
        batteryStatusRequestedByJs = true
        ensureBatteryStatusUpdates()
        emitBatteryStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopBatteryStatusUpdates(call: PluginCall) {
        batteryStatusRequestedByJs = false
        if (!batteryStatusRequiredByNativeEvents) stopBatteryStatusUpdatesSilently()
        call.resolve()
    }

    @PluginMethod
    fun startNetworkStatusUpdates(call: PluginCall) {
        networkStatusRequestedByJs = true
        ensureNetworkStatusUpdates()
        emitNetworkStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopNetworkStatusUpdates(call: PluginCall) {
        networkStatusRequestedByJs = false
        if (!networkStatusRequiredByNativeEvents) stopNetworkStatusUpdatesSilently()
        call.resolve()
    }

    @PluginMethod
    fun startScreenStatusUpdates(call: PluginCall) {
        screenStatusRequestedByJs = true
        ensureScreenStatusUpdates()
        emitScreenStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopScreenStatusUpdates(call: PluginCall) {
        screenStatusRequestedByJs = false
        if (!screenStatusRequiredByNativeEvents) stopScreenStatusUpdatesSilently()
        call.resolve()
    }

    @PluginMethod
    fun startKeyboardStatusUpdates(call: PluginCall) {
        keyboardStatusUpdateCount += 1
        ensureKeyboardStatusUpdates()
        emitKeyboardStatus()
        call.resolve()
    }

    @PluginMethod
    fun stopKeyboardStatusUpdates(call: PluginCall) {
        keyboardStatusUpdateCount = (keyboardStatusUpdateCount - 1).coerceAtLeast(0)

        if (keyboardStatusUpdateCount == 0 && !keyboardStatusRequiredByNativeEvents) {
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
    fun getMqttStatus(call: PluginCall) {
        val connection = call.getString("connection")

        if (connection.isNullOrBlank()) {
            call.reject("MQTT connection name is required")
            return
        }

        RemixMqttRuntime.reload(context)
        val status = RemixMqttRuntime.getStatus(connection)

        if (status == null) {
            call.reject("Unknown MQTT connection: $connection")
            return
        }

        call.resolve(mqttStatusObject(status))
    }

    @PluginMethod
    fun getMqttStatuses(call: PluginCall) {
        RemixMqttRuntime.reload(context)
        call.resolve(JSObject().apply {
            put("statuses", JSArray(RemixMqttRuntime.getStatuses().map(::mqttStatusObject)))
        })
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
    fun getActiveProjectConfiguration(call: PluginCall) {
        try {
            call.resolve(projectConfigurationObject(
                RemixProjectConfigRepository.loadActiveConfiguration(context),
            ))
        } catch (error: Exception) {
            call.reject("Failed to load active project configuration", error)
        }
    }

    @PluginMethod
    fun setActiveProjectConstants(call: PluginCall) {
        val projectId = call.getString("projectId")
        val revision = call.getInt("revision")
        val overrideValues = call.getObject("overrides")
        if (projectId.isNullOrEmpty() || revision == null || overrideValues == null) {
            call.reject("Project ID, revision, and overrides are required")
            return
        }

        try {
            val overrides = linkedMapOf<String, String>()
            val ids = overrideValues.keys()
            while (ids.hasNext()) {
                val id = ids.next()
                val value = overrideValues.opt(id)
                require(value is String) { "Project constant $id must be a string" }
                overrides[id] = value
            }
            val configuration = RemixProjectConfigRepository.saveActiveConstants(
                context,
                projectId,
                revision,
                overrides,
            )
            RemixMqttRuntime.reload(context)
            reloadNativeEventConfig()
            syncNativeEventSources(projectRuntimeMounted)
            call.resolve(projectConfigurationObject(configuration))
        } catch (error: Exception) {
            call.reject("Failed to save active project constants", error)
        }
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
        nativeEventEngine.setActivityResumed(true)
        implementation.applySystemUiMode()
        emitScreenStatusIfActive()
        emitKeyboardStatusIfActive()
        emitNetworkStatusIfActive()
        emitLifecycle("resumed")
        super.handleOnResume()
    }

    override fun handleOnPause() {
        nativeEventEngine.setActivityResumed(false)
        emitLifecycle("paused")
        super.handleOnPause()
    }

    override fun handleOnDestroy() {
        vibration.close()
        nativeEventEngine.close()
        stopBatteryStatusUpdatesSilently()
        stopNetworkStatusUpdatesSilently()
        stopScreenStatusUpdatesSilently()
        stopKeyboardStatusUpdatesSilently()
        RemixMqttRuntime.removeListener(mqttListener)
        implementation.destroy()
        if (activePlugin === this) {
            activePlugin = null
        }
        super.handleOnDestroy()
    }

    private fun emitKey(key: String, event: KeyEvent) {
        val payload = JSObject().apply {
            put("key", key)
            put("action", if (event.action == KeyEvent.ACTION_DOWN) "down" else "up")
        }
        nativeEventEngine.onEvent(RemixEventNames.DEVICE_KEY, payload)
        notifyListeners(RemixEventNames.DEVICE_KEY, payload)
    }

    private fun emitBatteryStatus() {
        val payload = batteryStatusObject(implementation.getBatteryStatus())
        nativeEventEngine.onEvent(RemixEventNames.DEVICE_STATUS_BATTERY, payload)
        notifyListeners(RemixEventNames.DEVICE_STATUS_BATTERY, payload)
    }

    private fun emitNetworkStatus() {
        val payload = networkStatusObject(implementation.getNetworkStatus())
        nativeEventEngine.onEvent(RemixEventNames.DEVICE_STATUS_NETWORK, payload)
        notifyListeners(RemixEventNames.DEVICE_STATUS_NETWORK, payload)
    }

    private fun emitScreenStatus() {
        val payload = screenStatusObject(implementation.getScreenStatus())
        nativeEventEngine.onEvent(RemixEventNames.DEVICE_STATUS_SCREEN, payload)
        notifyListeners(RemixEventNames.DEVICE_STATUS_SCREEN, payload)
    }

    private fun notifyScreenStatus() {
        notifyListeners(
            RemixEventNames.DEVICE_STATUS_SCREEN,
            screenStatusObject(implementation.getScreenStatus()),
        )
    }

    private fun emitKeyboardStatus() {
        val payload = keyboardStatusObject(implementation.getKeyboardStatus())
        nativeEventEngine.onEvent(RemixEventNames.DEVICE_STATUS_KEYBOARD, payload)
        notifyListeners(RemixEventNames.DEVICE_STATUS_KEYBOARD, payload)
    }

    private fun emitLifecycle(state: String) {
        val payload = JSObject().apply {
            put("state", state)
        }
        nativeEventEngine.onEvent(RemixEventNames.PROJECT_LIFECYCLE, payload)
        notifyListeners(RemixEventNames.PROJECT_LIFECYCLE, payload)
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

    private fun mqttStatusObject(status: RemixMqttStatus): JSObject {
        return JSObject().apply {
            put("connection", status.connection)
            put("state", status.state)
            put("revision", status.revision)
            status.reason?.let { put("reason", it) }
        }
    }

    private fun mqttMessageObject(message: RemixMqttMessage): JSObject {
        return JSObject().apply {
            put("connection", message.connection)
            put("topic", message.topic)
            put("payloadBase64", Base64.encodeToString(message.payload, Base64.NO_WRAP))
            put("qos", message.qos)
            put("retained", message.retained)
            put("duplicate", message.duplicate)
            put("receivedAt", message.receivedAt)
        }
    }

    private fun projectObject(project: InstalledProject): JSObject {
        return JSObject().apply {
            put("installed", project.installed)
            project.directory?.let { put("directory", it) }
            project.url?.let { put("url", it) }
        }
    }

    private fun projectConfigurationObject(configuration: RemixProjectConfiguration): JSObject {
        return JSObject().apply {
            put("status", configuration.status)
            put("project", configuration.project)
            put("projectId", configuration.projectId)
            put("revision", configuration.revision)
            put("missing", JSArray(configuration.missing))
            put("constants", JSArray(configuration.constants.map { constant ->
                JSObject().apply {
                    put("id", constant.id)
                    put("required", constant.required)
                    put("hasDefault", constant.hasDefault)
                    constant.defaultValue?.let { put("default", it) }
                    put("hasOverride", constant.hasOverride)
                    constant.value?.let { put("value", it) }
                }
            }))
            configuration.manifest?.let { put("manifest", it) }
        }
    }

    private fun reloadNativeEventConfig() {
        try {
            nativeEventEngine.applyConfig(RemixNativeEventConfigLoader.load(context))
        } catch (error: Exception) {
            Log.e(TAG, "Failed to load active project nativeEvents configuration", error)
            nativeEventEngine.applyConfig(
                com.fainthit.remix.core.nativeevents.RemixNativeEventConfig(emptyList()),
            )
        }
    }

    private fun syncNativeEventSources(mounted: Boolean) {
        val eventTypes = if (mounted) nativeEventEngine.eventTypes() else emptySet()
        batteryStatusRequiredByNativeEvents = RemixEventNames.DEVICE_STATUS_BATTERY in eventTypes
        networkStatusRequiredByNativeEvents = RemixEventNames.DEVICE_STATUS_NETWORK in eventTypes
        screenStatusRequiredByNativeEvents = RemixEventNames.DEVICE_STATUS_SCREEN in eventTypes
        keyboardStatusRequiredByNativeEvents = RemixEventNames.DEVICE_STATUS_KEYBOARD in eventTypes

        if (batteryStatusRequiredByNativeEvents) ensureBatteryStatusUpdates()
        else if (!batteryStatusRequestedByJs) stopBatteryStatusUpdatesSilently()

        if (networkStatusRequiredByNativeEvents) ensureNetworkStatusUpdates()
        else if (!networkStatusRequestedByJs) stopNetworkStatusUpdatesSilently()

        if (screenStatusRequiredByNativeEvents) ensureScreenStatusUpdates()
        else if (!screenStatusRequestedByJs) stopScreenStatusUpdatesSilently()

        if (keyboardStatusRequiredByNativeEvents) ensureKeyboardStatusUpdates()
        else if (keyboardStatusUpdateCount == 0) stopKeyboardStatusUpdatesSilently()
    }

    private fun emitNativeActionRequest(request: RemixNativeEventEngine.WebActionRequest) {
        notifyListeners("nativeActionRequested", JSObject().apply {
            put("requestId", request.requestId)
            put("type", request.type)
            put("args", request.args)
        })
    }

    private fun ensureBatteryStatusUpdates() {
        if (batteryReceiver != null) return
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

    private fun ensureNetworkStatusUpdates() {
        if (networkCallback != null) return
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) = emitNetworkStatus()
            override fun onLost(network: Network) = emitNetworkStatus()
            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities,
            ) = emitNetworkStatus()
        }
        connectivityManager.registerDefaultNetworkCallback(networkCallback!!)
    }

    private fun ensureScreenStatusUpdates() {
        if (screenReceiver != null) return
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

    private fun ensureKeyboardStatusUpdates() {
        activity.runOnUiThread {
            val decorView = activity.window.decorView
            ViewCompat.setOnApplyWindowInsetsListener(decorView) { _, insets ->
                emitKeyboardStatus()
                insets
            }
            ViewCompat.requestApplyInsets(decorView)
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
        private const val TAG = "RemixCorePlugin"

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
