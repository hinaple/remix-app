package com.fainthit.remix.core.actions

import com.fainthit.remix.core.vibration.RemixVibrationEffect
import com.fainthit.remix.core.vibration.RemixVibrationPreset
import com.fainthit.remix.core.vibration.RemixVibrationSegment
import org.json.JSONObject

internal fun JSONObject.toRemixVibrationEffect(): RemixVibrationEffect {
    return when (val kind = requiredVibrationString("kind")) {
        "oneShot" -> RemixVibrationEffect.OneShot(
            duration = requiredVibrationDuration("duration"),
            intensity = optionalVibrationIntensity("intensity", allowZero = false),
        )
        "pattern" -> {
            val values = optJSONArray("segments")
                ?: throw IllegalArgumentException("Action argument segments must be an array")
            require(values.length() > 0) { "Action argument segments must not be empty" }
            val segments = buildList {
                for (index in 0 until values.length()) {
                    val segment = values.optJSONObject(index)
                        ?: throw IllegalArgumentException(
                            "Action argument segments[$index] must be an object",
                        )
                    add(
                        RemixVibrationSegment(
                            duration = segment.requiredVibrationDuration("duration"),
                            intensity = segment.optionalVibrationIntensity(
                                "intensity",
                                allowZero = true,
                            ),
                        ),
                    )
                }
            }
            require(segments.any { it.intensity > 0f }) {
                "Action argument segments must contain a vibration segment"
            }
            RemixVibrationEffect.Pattern(
                segments = segments,
                repeat = optionalVibrationBoolean("repeat", false),
            )
        }
        "preset" -> RemixVibrationEffect.Preset(
            preset = when (requiredVibrationString("preset")) {
                "tick" -> RemixVibrationPreset.TICK
                "click" -> RemixVibrationPreset.CLICK
                "heavyClick" -> RemixVibrationPreset.HEAVY_CLICK
                "doubleClick" -> RemixVibrationPreset.DOUBLE_CLICK
                else -> throw IllegalArgumentException("Action argument preset is invalid")
            },
        )
        else -> throw IllegalArgumentException("Action argument kind is invalid: $kind")
    }
}

private fun JSONObject.requiredVibrationString(name: String): String {
    val value = opt(name)
    require(value is String && value.isNotEmpty()) {
        "Action argument $name must be a string"
    }
    return value
}

private fun JSONObject.requiredVibrationDuration(name: String): Long {
    val value = opt(name)
    require(value is Number) { "Action argument $name must be an integer" }
    val result = value.toLong()
    require(value.toDouble() == result.toDouble() && result > 0) {
        "Action argument $name must be a positive integer"
    }
    return result
}

private fun JSONObject.optionalVibrationIntensity(name: String, allowZero: Boolean): Float {
    if (!has(name) || isNull(name)) return 1f
    val value = opt(name)
    require(value is Number) { "Action argument $name must be a number" }
    val result = value.toFloat()
    require(
        result.isFinite() &&
            result <= 1f &&
            result >= 0f &&
            (allowZero || result > 0f),
    ) {
        if (allowZero) {
            "Action argument $name must be from 0 to 1"
        } else {
            "Action argument $name must be greater than 0 and at most 1"
        }
    }
    return result
}

private fun JSONObject.optionalVibrationBoolean(name: String, default: Boolean): Boolean {
    if (!has(name) || isNull(name)) return default
    val value = opt(name)
    require(value is Boolean) { "Action argument $name must be a boolean" }
    return value
}
