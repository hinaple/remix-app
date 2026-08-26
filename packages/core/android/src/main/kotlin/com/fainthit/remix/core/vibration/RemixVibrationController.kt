package com.fainthit.remix.core.vibration

import android.content.Context
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import kotlin.math.roundToInt

class RemixVibrationController(context: Context) {
    private val vibrator = resolveVibrator(context.applicationContext)

    internal fun play(effect: RemixVibrationEffect) {
        stop()
        when (effect) {
            is RemixVibrationEffect.OneShot -> playOneShot(effect)
            is RemixVibrationEffect.Pattern -> playPattern(effect)
            is RemixVibrationEffect.Preset -> playPreset(effect.preset)
        }
    }

    fun stop() {
        vibrator.cancel()
    }

    fun close() {
        stop()
    }

    @Suppress("DEPRECATION")
    private fun playOneShot(effect: RemixVibrationEffect.OneShot) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            vibrator.vibrate(
                VibrationEffect.createOneShot(
                    effect.duration,
                    amplitude(effect.intensity),
                ),
            )
            return
        }

        vibrator.vibrate(effect.duration)
    }

    @Suppress("DEPRECATION")
    private fun playPattern(effect: RemixVibrationEffect.Pattern) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val timings = effect.segments.map { it.duration }.toLongArray()
            val amplitudes = effect.segments.map { segment ->
                if (segment.intensity == 0f) 0 else amplitude(segment.intensity)
            }.toIntArray()
            vibrator.vibrate(
                VibrationEffect.createWaveform(
                    timings,
                    amplitudes,
                    if (effect.repeat) 0 else -1,
                ),
            )
            return
        }

        vibrator.vibrate(
            legacyPattern(effect.segments),
            if (effect.repeat) 0 else -1,
        )
    }

    private fun playPreset(preset: RemixVibrationPreset) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            val effectId = when (preset) {
                RemixVibrationPreset.TICK -> VibrationEffect.EFFECT_TICK
                RemixVibrationPreset.CLICK -> VibrationEffect.EFFECT_CLICK
                RemixVibrationPreset.HEAVY_CLICK -> VibrationEffect.EFFECT_HEAVY_CLICK
                RemixVibrationPreset.DOUBLE_CLICK -> VibrationEffect.EFFECT_DOUBLE_CLICK
            }
            vibrator.vibrate(VibrationEffect.createPredefined(effectId))
            return
        }

        playPattern(presetFallback(preset))
    }

    private fun amplitude(intensity: Float): Int {
        if (!vibrator.hasAmplitudeControl()) {
            return VibrationEffect.DEFAULT_AMPLITUDE
        }
        return (intensity * MAX_AMPLITUDE).roundToInt().coerceIn(1, MAX_AMPLITUDE)
    }

    private fun legacyPattern(segments: List<RemixVibrationSegment>): LongArray {
        val timings = mutableListOf<Long>()
        segments.forEach { segment ->
            val segmentOn = segment.intensity > 0f
            if (timings.isEmpty()) {
                if (segmentOn) timings += 0L
                timings += segment.duration
                return@forEach
            }

            val lastSegmentOn = timings.lastIndex % 2 == 1
            if (lastSegmentOn == segmentOn) {
                timings[timings.lastIndex] += segment.duration
            } else {
                timings += segment.duration
            }
        }
        return timings.toLongArray()
    }

    private fun presetFallback(preset: RemixVibrationPreset): RemixVibrationEffect.Pattern {
        val segments = when (preset) {
            RemixVibrationPreset.TICK -> listOf(RemixVibrationSegment(20, 0.35f))
            RemixVibrationPreset.CLICK -> listOf(RemixVibrationSegment(35, 0.65f))
            RemixVibrationPreset.HEAVY_CLICK -> listOf(RemixVibrationSegment(60, 1f))
            RemixVibrationPreset.DOUBLE_CLICK -> listOf(
                RemixVibrationSegment(35, 0.75f),
                RemixVibrationSegment(60, 0f),
                RemixVibrationSegment(35, 0.75f),
            )
        }
        return RemixVibrationEffect.Pattern(segments = segments, repeat = false)
    }

    @Suppress("DEPRECATION")
    private fun resolveVibrator(context: Context): Vibrator {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return context.getSystemService(VibratorManager::class.java).defaultVibrator
        }
        return context.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
    }

    private companion object {
        const val MAX_AMPLITUDE = 255
    }
}
