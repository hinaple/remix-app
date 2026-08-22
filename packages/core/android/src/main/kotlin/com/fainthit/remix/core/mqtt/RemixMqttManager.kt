package com.fainthit.remix.core.mqtt

import org.eclipse.paho.client.mqttv3.IMqttActionListener
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken
import org.eclipse.paho.client.mqttv3.IMqttToken
import org.eclipse.paho.client.mqttv3.MqttAsyncClient
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended
import org.eclipse.paho.client.mqttv3.MqttConnectOptions
import org.eclipse.paho.client.mqttv3.MqttException
import org.eclipse.paho.client.mqttv3.MqttMessage
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledFuture
import java.util.concurrent.TimeUnit

class RemixMqttManager(
    private val listener: Listener,
    private val nextRevision: () -> Long,
) {
    private val connections = ConcurrentHashMap<String, ManagedConnection>()
    private val retryExecutor = Executors.newSingleThreadScheduledExecutor { runnable ->
        Thread(runnable, "remix-mqtt-retry").apply { isDaemon = true }
    }

    @Synchronized
    fun applyConfig(config: RemixMqttConfig) {
        val removed = connections.keys.filter { it !in config.connections }
        removed.forEach { name ->
            connections.remove(name)?.stop()
            listener.onStatus(
                RemixMqttStatus(
                    connection = name,
                    state = "disconnected",
                    revision = nextRevision(),
                    reason = "configuration removed",
                ),
            )
        }

        config.connections.forEach { (name, nextConfig) ->
            val current = connections[name]

            if (current?.config == nextConfig) {
                return@forEach
            }

            current?.stop()
            ManagedConnection(name, nextConfig).also {
                connections[name] = it
                it.start()
            }
        }
    }

    fun getStatus(connection: String): RemixMqttStatus? = connections[connection]?.status

    fun getStatuses(): List<RemixMqttStatus> = connections.values
        .map { it.status }
        .sortedBy { it.connection }

    fun publish(
        connection: String,
        topic: String,
        payload: ByteArray,
        qos: Int,
        retain: Boolean,
        callback: (Throwable?) -> Unit,
    ) {
        require(topic.isNotEmpty() && '\u0000' !in topic && '#' !in topic && '+' !in topic) {
            "Invalid MQTT publish topic"
        }
        require(qos in 0..2) { "MQTT publish QoS must be 0, 1, or 2" }

        val managed = connections[connection]
            ?: throw IllegalArgumentException("Unknown MQTT connection: $connection")
        managed.publish(topic, payload, qos, retain, callback)
    }

    @Synchronized
    fun close() {
        connections.values.forEach(ManagedConnection::stop)
        connections.clear()
        retryExecutor.shutdownNow()
    }

    interface Listener {
        fun onStatus(status: RemixMqttStatus)
        fun onMessage(message: RemixMqttMessage)
    }

    private inner class ManagedConnection(
        private val name: String,
        val config: RemixMqttConnectionConfig,
    ) : MqttCallbackExtended {
        private val client = MqttAsyncClient(
            config.serverUri,
            config.clientId,
            MemoryPersistence(),
        )
        private var stopped = false
        @Volatile
        private var connecting = false
        private var retry: ScheduledFuture<*>? = null

        @Volatile
        var status = RemixMqttStatus(
            connection = name,
            state = "disconnected",
            revision = nextRevision(),
        )
            private set

        fun start() {
            client.setCallback(this)
            updateStatus("connecting")
            connect(initial = true)
        }

        @Synchronized
        fun stop() {
            if (stopped) {
                return
            }

            stopped = true
            connecting = false
            retry?.cancel(false)
            retry = null

            try {
                client.disconnectForcibly(1_000, 1_000, false)
            } catch (_: Exception) {
                // Closing a partially connected client may fail; close it anyway.
            }

            try {
                client.close()
            } catch (_: Exception) {
                // The client may already be closed.
            }
        }

        fun publish(
            topic: String,
            payload: ByteArray,
            qos: Int,
            retain: Boolean,
            callback: (Throwable?) -> Unit,
        ) {
            if (!client.isConnected) {
                callback(IllegalStateException("MQTT connection $name is not connected"))
                return
            }

            try {
                client.publish(topic, payload, qos, retain, null, object : IMqttActionListener {
                    override fun onSuccess(asyncActionToken: IMqttToken?) {
                        callback(null)
                    }

                    override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                        callback(exception ?: IllegalStateException("MQTT publish failed"))
                    }
                })
            } catch (error: Throwable) {
                callback(error)
            }
        }

        override fun connectComplete(reconnect: Boolean, serverURI: String?) {
            if (stopped) {
                return
            }

            retry?.cancel(false)
            retry = null
            connecting = false
            updateStatus("connected")
            subscribeConfiguredTopics()
        }

        override fun connectionLost(cause: Throwable?) {
            if (stopped) {
                return
            }

            connecting = false
            updateStatus(
                if (config.reconnect) "reconnecting" else "disconnected",
                safeReason(cause),
            )
        }

        override fun messageArrived(topic: String, message: MqttMessage) {
            if (stopped) {
                return
            }

            listener.onMessage(
                RemixMqttMessage(
                    connection = name,
                    topic = topic,
                    payload = message.payload.copyOf(),
                    qos = message.qos,
                    retained = message.isRetained,
                    duplicate = message.isDuplicate,
                    receivedAt = System.currentTimeMillis(),
                ),
            )
        }

        override fun deliveryComplete(token: IMqttDeliveryToken?) = Unit

        private fun connect(initial: Boolean) {
            if (stopped || client.isConnected || connecting) {
                return
            }

            connecting = true
            updateStatus(if (initial) "connecting" else "reconnecting")

            val options = MqttConnectOptions().apply {
                mqttVersion = MqttConnectOptions.MQTT_VERSION_3_1_1
                isCleanSession = config.cleanSession
                keepAliveInterval = config.keepAliveSeconds
                isAutomaticReconnect = config.reconnect
                config.username?.let { userName = it }
                config.password?.let { password = it.toCharArray() }
            }

            try {
                client.connect(options, null, object : IMqttActionListener {
                    override fun onSuccess(asyncActionToken: IMqttToken?) = Unit

                    override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                        if (stopped) {
                            return
                        }

                        connecting = false
                        updateStatus(
                            if (config.reconnect) "reconnecting" else "disconnected",
                            safeReason(exception),
                        )
                        if (config.reconnect) {
                            scheduleInitialRetry()
                        }
                    }
                })
            } catch (error: MqttException) {
                connecting = false
                updateStatus(
                    if (config.reconnect) "reconnecting" else "disconnected",
                    safeReason(error),
                )
                if (config.reconnect) {
                    scheduleInitialRetry()
                }
            }
        }

        @Synchronized
        private fun scheduleInitialRetry() {
            if (stopped || retry?.isDone == false) {
                return
            }

            retry = retryExecutor.schedule(
                { connect(initial = false) },
                RETRY_DELAY_SECONDS,
                TimeUnit.SECONDS,
            )
        }

        private fun subscribeConfiguredTopics() {
            if (config.subscriptions.isEmpty()) {
                return
            }

            val filters = config.subscriptions.map { it.filter }.toTypedArray()
            val qos = config.subscriptions.map { it.qos }.toIntArray()

            try {
                client.subscribe(filters, qos, null, object : IMqttActionListener {
                    override fun onSuccess(asyncActionToken: IMqttToken?) = Unit

                    override fun onFailure(asyncActionToken: IMqttToken?, exception: Throwable?) {
                        updateStatus("connected", "subscription failed: ${safeReason(exception)}")
                    }
                })
            } catch (error: MqttException) {
                updateStatus("connected", "subscription failed: ${safeReason(error)}")
            }
        }

        private fun updateStatus(state: String, reason: String? = null) {
            if (status.state == state && status.reason == reason) {
                return
            }

            val next = RemixMqttStatus(
                connection = name,
                state = state,
                revision = nextRevision(),
                reason = reason,
            )

            status = next
            listener.onStatus(next)
        }
    }

    private fun safeReason(error: Throwable?): String? {
        return error?.message?.takeIf { it.isNotBlank() } ?: error?.javaClass?.simpleName
    }

    private companion object {
        const val RETRY_DELAY_SECONDS = 5L
    }
}
