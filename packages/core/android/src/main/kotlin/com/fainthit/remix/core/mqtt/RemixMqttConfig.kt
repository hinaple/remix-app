package com.fainthit.remix.core.mqtt

data class RemixMqttConfig(
    val connections: Map<String, RemixMqttConnectionConfig>,
)

data class RemixMqttConnectionConfig(
    val serverUri: String,
    val clientId: String,
    val username: String?,
    val password: String?,
    val keepAliveSeconds: Int,
    val cleanSession: Boolean,
    val reconnect: Boolean,
    val subscriptions: List<RemixMqttSubscriptionConfig>,
)

data class RemixMqttSubscriptionConfig(
    val filter: String,
    val qos: Int,
)

data class RemixMqttStatus(
    val connection: String,
    val state: String,
    val revision: Long,
    val reason: String? = null,
)

data class RemixMqttMessage(
    val connection: String,
    val topic: String,
    val payload: ByteArray,
    val qos: Int,
    val retained: Boolean,
    val duplicate: Boolean,
    val receivedAt: Long,
)
