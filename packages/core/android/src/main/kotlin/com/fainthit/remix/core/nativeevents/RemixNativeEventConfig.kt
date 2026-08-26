package com.fainthit.remix.core.nativeevents

import android.content.Context
import com.fainthit.remix.core.project.RemixProjectConfigRepository
import org.json.JSONObject

data class RemixNativeEventConfig(
    val rules: List<RemixNativeEventRule>,
)

data class RemixNativeEventRule(
    val event: String,
    val conditions: JSONObject,
    val actions: List<RemixConfiguredAction>,
    val expiresIn: Long,
)

data class RemixConfiguredAction(
    val type: String,
    val executor: String,
    val args: JSONObject,
)

object RemixNativeEventConfigLoader {
    fun load(context: Context): RemixNativeEventConfig {
        val manifest = try {
            RemixProjectConfigRepository.loadActiveManifest(context)
        } catch (_: IllegalArgumentException) {
            return RemixNativeEventConfig(emptyList())
        }
        val nativeEvents = manifest.optJSONObject("nativeEvents")
            ?: return RemixNativeEventConfig(emptyList())
        val values = nativeEvents.optJSONArray("rules")
            ?: throw IllegalArgumentException("nativeEvents.rules must be an array")
        val rules = mutableListOf<RemixNativeEventRule>()

        for (index in 0 until values.length()) {
            val value = values.optJSONObject(index)
                ?: throw IllegalArgumentException("nativeEvents rule $index must be an object")
            val event = value.optString("on").takeIf { it.isNotEmpty() }
                ?: throw IllegalArgumentException("nativeEvents rule $index requires on")
            require(event in SUPPORTED_EVENTS) { "Unsupported native event: $event" }
            val actionValues = value.optJSONArray("actions")
                ?: throw IllegalArgumentException("nativeEvents rule $index requires actions")
            require(actionValues.length() > 0) { "nativeEvents rule $index requires actions" }
            val actions = mutableListOf<RemixConfiguredAction>()

            for (actionIndex in 0 until actionValues.length()) {
                val action = actionValues.optJSONObject(actionIndex)
                    ?: throw IllegalArgumentException("nativeEvents action must be an object")
                val type = action.optString("type").takeIf { it.isNotEmpty() }
                    ?: throw IllegalArgumentException("nativeEvents action requires type")
                val executor = action.optString("executor")
                require(executor == "native" || executor == "webview") {
                    "nativeEvents action $type has invalid executor"
                }
                actions += RemixConfiguredAction(
                    type = type,
                    executor = executor,
                    args = action.optJSONObject("args") ?: JSONObject(),
                )
            }

            rules += RemixNativeEventRule(
                event = event,
                conditions = value.optJSONObject("when") ?: JSONObject(),
                actions = actions,
                expiresIn = value.optLong("expiresIn", 10_000L).coerceAtLeast(1L),
            )
        }

        return RemixNativeEventConfig(rules)
    }

    private val SUPPORTED_EVENTS = setOf(
        "device:key",
        "device:status:battery",
        "device:status:network",
        "device:status:screen",
        "device:status:keyboard",
        "project:lifecycle",
        "mqtt:status",
        "mqtt:message",
    )
}
