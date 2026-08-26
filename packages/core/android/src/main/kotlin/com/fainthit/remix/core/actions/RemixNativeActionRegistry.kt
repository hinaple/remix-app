package com.fainthit.remix.core.actions

import android.util.Base64
import android.os.Handler
import android.os.Looper
import com.fainthit.remix.core.RemixCore
import com.fainthit.remix.core.mqtt.RemixMqttRuntime
import com.fainthit.remix.core.vibration.RemixVibrationController
import org.json.JSONObject

private typealias NativeActionHandler = (JSONObject, NativeActionCompletion) -> Unit
typealias NativeActionCompletion = (Throwable?) -> Unit

class RemixNativeActionRegistry(
    private val core: RemixCore,
    private val vibration: RemixVibrationController,
    private val setCaptureBack: (Boolean) -> Unit,
    private val setCapturedKeys: (Set<String>) -> Unit,
    private val onScreenChanged: () -> Unit,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val handlers = linkedMapOf<String, NativeActionHandler>()

    init {
        register("device.screen.wake") { _, done -> sync(done) { core.wakeScreen() } }
        register("device.screen.setKeepOn") { args, done ->
            sync(done) {
                core.setKeepScreenOn(args.requiredBoolean("enabled"))
                onScreenChanged()
            }
        }
        register("device.screen.setAutoBrightness") { args, done ->
            sync(done) {
                core.setAutoBrightness(args.requiredBoolean("enabled"))
                onScreenChanged()
            }
        }
        register("device.screen.setBrightness") { args, done ->
            sync(done) {
                core.setScreenBrightness(args.requiredUnitFloat("brightness"))
                onScreenChanged()
            }
        }
        register("device.screen.setOrientation") { args, done ->
            sync(done) {
                core.setScreenOrientation(args.requiredString("orientation"))
                onScreenChanged()
            }
        }
        register("device.screen.setTimeout") { args, done ->
            sync(done) {
                val timeout = if (!args.has("timeout") || args.isNull("timeout")) {
                    null
                } else {
                    args.requiredNonNegativeInt("timeout")
                }
                core.setScreenTimeout(timeout)
                onScreenChanged()
            }
        }
        register("device.input.captureBack") { args, done ->
            sync(done) { setCaptureBack(args.requiredBoolean("enabled")) }
        }
        register("device.input.captureKeys") { args, done ->
            sync(done) {
                val values = args.optJSONArray("keys")
                    ?: throw IllegalArgumentException("Action argument keys must be an array")
                val keys = buildSet {
                    for (index in 0 until values.length()) {
                        val key = values.optString(index).takeIf { it.isNotEmpty() }
                            ?: throw IllegalArgumentException("Action keys must be strings")
                        require(key in SUPPORTED_KEYS) { "Unsupported device key: $key" }
                        add(key)
                    }
                }
                setCapturedKeys(keys)
            }
        }
        register("device.audio.setVolume") { args, done ->
            sync(done) { core.setMediaVolume(args.requiredUnitFloat("volume")) }
        }
        register("device.vibration.play") { args, done ->
            sync(done) { vibration.play(args.toRemixVibrationEffect()) }
        }
        register("device.vibration.stop") { _, done ->
            sync(done) { vibration.stop() }
        }
        register("mqtt.publish") { args, done ->
            val payload = args.optJSONObject("payload")
                ?: return@register done(IllegalArgumentException("MQTT payload is required"))
            val bytes = try {
                when {
                    payload.opt("text") is String ->
                        payload.getString("text").toByteArray(Charsets.UTF_8)
                    payload.has("base64") -> Base64.decode(
                        payload.string("base64"),
                        Base64.DEFAULT,
                    )
                    else -> throw IllegalArgumentException("MQTT payload requires text or base64")
                }
            } catch (error: Throwable) {
                done(error)
                return@register
            }
            RemixMqttRuntime.publish(
                connection = args.requiredString("connection"),
                topic = args.requiredString("topic"),
                payload = bytes,
                qos = args.optInt("qos", 0),
                retain = args.optBoolean("retain", false),
                callback = done,
            )
        }
    }

    fun execute(type: String, args: JSONObject, done: NativeActionCompletion) {
        val handler = handlers[type]
        if (handler == null) {
            done(IllegalArgumentException("Unknown native action: $type"))
            return
        }
        val run = Runnable {
            try {
                handler(args, done)
            } catch (error: Throwable) {
                done(error)
            }
        }
        if (Looper.myLooper() == Looper.getMainLooper()) run.run()
        else mainHandler.post(run)
    }

    fun contains(type: String): Boolean = type in handlers

    private fun register(type: String, handler: NativeActionHandler) {
        check(handlers.put(type, handler) == null) { "Duplicate native action: $type" }
    }

    private fun sync(done: NativeActionCompletion, action: () -> Unit) {
        try {
            action()
            done(null)
        } catch (error: Throwable) {
            done(error)
        }
    }

    private fun JSONObject.requiredString(name: String): String {
        val value = opt(name)
        require(value is String && value.isNotEmpty()) { "Action argument $name must be a string" }
        return value
    }

    private fun JSONObject.string(name: String): String {
        val value = opt(name)
        require(value is String) { "Action argument $name must be a string" }
        return value
    }

    private fun JSONObject.requiredBoolean(name: String): Boolean {
        val value = opt(name)
        require(value is Boolean) { "Action argument $name must be a boolean" }
        return value
    }

    private fun JSONObject.requiredUnitFloat(name: String): Float {
        val value = opt(name)
        require(value is Number) { "Action argument $name must be a number" }
        val result = value.toFloat()
        require(result.isFinite() && result in 0f..1f) {
            "Action argument $name must be from 0 to 1"
        }
        return result
    }

    private fun JSONObject.requiredNonNegativeInt(name: String): Int {
        val value = opt(name)
        require(value is Number) { "Action argument $name must be an integer" }
        val result = value.toLong()
        require(value.toDouble() == result.toDouble() && result in 0..Int.MAX_VALUE) {
            "Action argument $name must be a non-negative integer"
        }
        return result.toInt()
    }

    private companion object {
        val SUPPORTED_KEYS = setOf(
            "BACK",
            "VOLUME_UP",
            "VOLUME_DOWN",
            "POWER",
            "HOME",
            "MENU",
        )
    }
}
