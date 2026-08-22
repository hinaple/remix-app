package com.fainthit.remix.core.nativeevents

import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import com.fainthit.remix.core.actions.RemixNativeActionRegistry
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID

class RemixNativeEventEngine(
    private val actions: RemixNativeActionRegistry,
    private val listener: Listener,
) {
    private val mainHandler = Handler(Looper.getMainLooper())
    private val sequences = ArrayDeque<ActionSequence>()
    private var config = RemixNativeEventConfig(emptyList())
    private var projectMounted = false
    private var activityResumed = true
    private var sessionId = 0L
    private var running = false
    private var pendingWebRequest: PendingWebRequest? = null

    @Synchronized
    fun applyConfig(config: RemixNativeEventConfig) {
        this.config = config
    }

    @Synchronized
    fun eventTypes(): Set<String> = config.rules.mapTo(linkedSetOf()) { it.event }

    fun setProjectMounted(mounted: Boolean) {
        synchronized(this) {
            if (projectMounted == mounted) return
            projectMounted = mounted
            sessionId += 1
            sequences.clear()
            pendingWebRequest = null
            running = false
        }
        if (mounted) drain()
    }

    fun setActivityResumed(resumed: Boolean) {
        synchronized(this) {
            activityResumed = resumed
        }
        if (resumed) drain()
    }

    fun onEvent(event: String, payload: JSONObject) {
        synchronized(this) {
            if (!projectMounted || activityResumed) return
            val now = SystemClock.elapsedRealtime()
            sequences.removeAll {
                it.sessionId != sessionId || it.expiresAt <= now
            }
            config.rules.asSequence()
                .filter { it.event == event && matches(payload, it.conditions) }
                .forEach { rule ->
                    sequences += ActionSequence(
                        sessionId = sessionId,
                        actions = rule.actions,
                        expiresAt = now + rule.expiresIn,
                    )
                }
        }
        drain()
    }

    fun completeWebAction(requestId: String, error: String?) {
        synchronized(this) {
            val pending = pendingWebRequest
            if (pending?.requestId != requestId) return
            pendingWebRequest = null
            running = false
            finishCurrentAction(error?.let(::IllegalStateException))
        }
        drain()
    }

    fun close() {
        synchronized(this) {
            projectMounted = false
            sequences.clear()
            pendingWebRequest = null
            running = false
            sessionId += 1
        }
    }

    private fun drain() {
        val next: Pair<ActionSequence, RemixConfiguredAction> = synchronized(this) {
            if (running || !projectMounted) return

            while (sequences.isNotEmpty()) {
                val sequence = sequences.first()
                if (
                    sequence.sessionId != sessionId ||
                    sequence.expiresAt <= SystemClock.elapsedRealtime() ||
                    sequence.index >= sequence.actions.size
                ) {
                    sequences.removeFirst()
                    continue
                }

                val action = sequence.actions[sequence.index]
                if (action.executor == "webview" && !activityResumed) return
                running = true
                return@synchronized sequence to action
            }
            return
        }

        val (sequence, action) = next
        if (action.executor == "native") {
            if (!actions.contains(action.type)) {
                finishNativeAction(IllegalArgumentException("Unknown native action: ${action.type}"))
                return
            }
            actions.execute(action.type, action.args) { error -> finishNativeAction(error) }
            return
        }

        val request = PendingWebRequest(
            requestId = UUID.randomUUID().toString(),
        )
        synchronized(this) {
            pendingWebRequest = request
        }
        try {
            listener.onWebActionRequested(
                WebActionRequest(request.requestId, action.type, action.args),
            )
        } catch (error: Throwable) {
            synchronized(this) {
                pendingWebRequest = null
                running = false
                finishCurrentAction(error)
            }
            drain()
            return
        }
        val delay = (sequence.expiresAt - SystemClock.elapsedRealtime()).coerceAtLeast(1L)
        mainHandler.postDelayed({ expireWebAction(request.requestId) }, delay)
    }

    private fun finishNativeAction(error: Throwable?) {
        synchronized(this) {
            running = false
            finishCurrentAction(error)
        }
        drain()
    }

    private fun finishCurrentAction(error: Throwable?) {
        val sequence = sequences.firstOrNull() ?: return
        if (error != null) {
            sequences.removeFirst()
            listener.onActionFailed(sequence.actions[sequence.index].type, error)
            return
        }
        sequence.index += 1
        if (sequence.index >= sequence.actions.size) sequences.removeFirst()
    }

    private fun expireWebAction(requestId: String) {
        synchronized(this) {
            if (pendingWebRequest?.requestId != requestId) return
            pendingWebRequest = null
            running = false
            finishCurrentAction(IllegalStateException("WebView action timed out"))
        }
        drain()
    }

    private fun matches(payload: JSONObject, conditions: JSONObject): Boolean {
        val paths = conditions.keys()
        while (paths.hasNext()) {
            val path = paths.next()
            val actual = resolve(payload, path)
            if (!matchesValue(actual, conditions.opt(path))) return false
        }
        return true
    }

    private fun resolve(payload: Any?, path: String): Any? {
        var current: Any? = payload
        for (part in path.split('.')) {
            current = when (current) {
                is JSONObject -> if (current.has(part)) current.opt(part) else MISSING
                is JSONArray -> part.toIntOrNull()?.let { current.opt(it) } ?: MISSING
                else -> MISSING
            }
            if (current === MISSING) return MISSING
        }
        return if (current == JSONObject.NULL) null else current
    }

    private fun matchesValue(actual: Any?, authored: Any?): Boolean {
        if (authored !is JSONObject) return jsonEquals(actual, authored)
        val operators = authored.keys()
        while (operators.hasNext()) {
            val operator = operators.next()
            val expected = authored.opt(operator).let { if (it == JSONObject.NULL) null else it }
            val matches = when (operator) {
                "eq" -> jsonEquals(actual, expected)
                "ne" -> !jsonEquals(actual, expected)
                "gt" -> compareNumbers(actual, expected) { left, right -> left > right }
                "gte" -> compareNumbers(actual, expected) { left, right -> left >= right }
                "lt" -> compareNumbers(actual, expected) { left, right -> left < right }
                "lte" -> compareNumbers(actual, expected) { left, right -> left <= right }
                "in" -> expected is JSONArray && (0 until expected.length()).any {
                    jsonEquals(actual, expected.opt(it))
                }
                "contains" -> actual is String && expected is String && actual.contains(expected)
                "exists" -> expected is Boolean && ((actual !== MISSING) == expected)
                else -> false
            }
            if (!matches) return false
        }
        return true
    }

    private fun jsonEquals(left: Any?, right: Any?): Boolean {
        if (left === MISSING) return false
        if (left is Number && right is Number) return left.toDouble() == right.toDouble()
        return left == right || (left == null && right == JSONObject.NULL)
    }

    private fun compareNumbers(
        left: Any?,
        right: Any?,
        predicate: (Double, Double) -> Boolean,
    ): Boolean = left is Number && right is Number && predicate(left.toDouble(), right.toDouble())

    interface Listener {
        fun onWebActionRequested(request: WebActionRequest)
        fun onActionFailed(type: String, error: Throwable)
    }

    data class WebActionRequest(
        val requestId: String,
        val type: String,
        val args: JSONObject,
    )

    private data class ActionSequence(
        val sessionId: Long,
        val actions: List<RemixConfiguredAction>,
        val expiresAt: Long,
        var index: Int = 0,
    )

    private data class PendingWebRequest(
        val requestId: String,
    )

    private companion object {
        val MISSING = Any()
    }
}
