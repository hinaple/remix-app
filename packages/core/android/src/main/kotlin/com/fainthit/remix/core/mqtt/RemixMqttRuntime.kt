package com.fainthit.remix.core.mqtt

import android.content.Context
import android.util.Log
import java.util.concurrent.CopyOnWriteArraySet
import java.util.concurrent.atomic.AtomicLong

object RemixMqttRuntime : RemixMqttManager.Listener {
    private const val TAG = "RemixMqttRuntime"
    private val listeners = CopyOnWriteArraySet<Listener>()
    private val revision = AtomicLong()
    private var manager: RemixMqttManager? = null

    @Synchronized
    fun reload(context: Context) {
        val current = manager ?: RemixMqttManager(this, revision::incrementAndGet).also {
            manager = it
        }

        try {
            current.applyConfig(RemixMqttConfigLoader.load(context.applicationContext))
        } catch (error: Exception) {
            Log.e(TAG, "Failed to load active project MQTT configuration", error)
            current.applyConfig(RemixMqttConfig(emptyMap()))
        }
    }

    @Synchronized
    fun stop() {
        manager?.close()
        manager = null
    }

    fun getStatus(connection: String): RemixMqttStatus? = manager?.getStatus(connection)

    fun getStatuses(): List<RemixMqttStatus> = manager?.getStatuses() ?: emptyList()

    fun publish(
        connection: String,
        topic: String,
        payload: ByteArray,
        qos: Int,
        retain: Boolean,
        callback: (Throwable?) -> Unit,
    ) {
        val current = manager

        if (current == null) {
            callback(IllegalStateException("MQTT runtime is not active"))
            return
        }

        try {
            current.publish(connection, topic, payload, qos, retain, callback)
        } catch (error: Throwable) {
            callback(error)
        }
    }

    fun addListener(listener: Listener) {
        listeners += listener
    }

    fun removeListener(listener: Listener) {
        listeners -= listener
    }

    override fun onStatus(status: RemixMqttStatus) {
        listeners.forEach { it.onStatus(status) }
    }

    override fun onMessage(message: RemixMqttMessage) {
        listeners.forEach { it.onMessage(message) }
    }

    interface Listener {
        fun onStatus(status: RemixMqttStatus)
        fun onMessage(message: RemixMqttMessage)
    }
}
