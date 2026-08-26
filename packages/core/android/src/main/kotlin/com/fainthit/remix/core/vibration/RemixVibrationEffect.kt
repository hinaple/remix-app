package com.fainthit.remix.core.vibration

internal sealed interface RemixVibrationEffect {
    data class OneShot(
        val duration: Long,
        val intensity: Float,
    ) : RemixVibrationEffect

    data class Pattern(
        val segments: List<RemixVibrationSegment>,
        val repeat: Boolean,
    ) : RemixVibrationEffect

    data class Preset(
        val preset: RemixVibrationPreset,
    ) : RemixVibrationEffect
}

internal data class RemixVibrationSegment(
    val duration: Long,
    val intensity: Float,
)

internal enum class RemixVibrationPreset {
    TICK,
    CLICK,
    HEAVY_CLICK,
    DOUBLE_CLICK,
}
