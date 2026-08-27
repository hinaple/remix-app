package com.fainthit.remix.core.mqtt

import android.content.Context
import android.provider.Settings
import com.fainthit.remix.core.project.RemixProjectConfigRepository
import org.json.JSONArray
import org.json.JSONObject
import java.net.URI
import java.security.MessageDigest

object RemixMqttConfigLoader {
    private val connectionNamePattern = Regex("^[A-Za-z0-9_-]+$")

    fun load(context: Context): RemixMqttConfig {
        val manifest = try {
            RemixProjectConfigRepository.loadReadyManifest(context)
        } catch (_: IllegalArgumentException) {
            return RemixMqttConfig(emptyMap())
        } ?: return RemixMqttConfig(emptyMap())
        return parse(context, manifest)
    }

    fun parse(context: Context, manifest: JSONObject): RemixMqttConfig {
        val mqtt = manifest.optJSONObject("mqtt") ?: return RemixMqttConfig(emptyMap())
        val connections = mqtt.optJSONObject("connections")
            ?: throw IllegalArgumentException("MQTT connections must be an object")
        val projectName = manifest.optString("name", "project")
        val result = linkedMapOf<String, RemixMqttConnectionConfig>()
        val names = connections.keys()

        while (names.hasNext()) {
            val name = names.next()
            require(connectionNamePattern.matches(name)) { "Invalid MQTT connection name: $name" }
            val value = connections.optJSONObject(name)
                ?: throw IllegalArgumentException("MQTT connection $name must be an object")
            result[name] = parseConnection(context, projectName, name, value)
        }

        return RemixMqttConfig(result)
    }

    private fun parseConnection(
        context: Context,
        projectName: String,
        name: String,
        value: JSONObject,
    ): RemixMqttConnectionConfig {
        val authoredUrl = optionalString(value, "url")?.takeIf { it.isNotBlank() }
            ?: throw IllegalArgumentException("MQTT connection $name requires a URL")
        val uri = URI(authoredUrl)
        require(uri.scheme == "mqtt" || uri.scheme == "mqtts") {
            "MQTT connection $name must use mqtt:// or mqtts://"
        }
        require(!uri.host.isNullOrBlank() && uri.userInfo == null) {
            "MQTT connection $name has an invalid broker URL"
        }
        require((uri.path.isNullOrEmpty() || uri.path == "/") && uri.query == null && uri.fragment == null) {
            "MQTT connection $name URL may contain only a host and optional port"
        }

        val keepAliveSeconds = integer(value, "keepAliveSeconds", 30)
        require(keepAliveSeconds in 0..65_535) {
            "MQTT connection $name keepAliveSeconds is out of range"
        }

        val subscriptions = when {
            !value.has("subscriptions") -> emptyList()
            value.opt("subscriptions") is JSONArray ->
                parseSubscriptions(name, value.getJSONArray("subscriptions"))
            else -> throw IllegalArgumentException(
                "MQTT connection $name subscriptions must be an array",
            )
        }
        val clientId = optionalString(value, "clientId")?.also {
            require(it.isNotEmpty()) { "MQTT connection $name clientId must not be empty" }
        } ?: generateClientId(context, projectName, name)
        val username = optionalString(value, "username")
        val password = optionalString(value, "password")
        require(password == null || username != null) {
            "MQTT connection $name password requires a username"
        }

        return RemixMqttConnectionConfig(
            serverUri = when (uri.scheme) {
                "mqtt" -> "tcp://${uri.rawAuthority}"
                else -> "ssl://${uri.rawAuthority}"
            },
            clientId = clientId,
            username = username,
            password = password,
            keepAliveSeconds = keepAliveSeconds,
            cleanSession = boolean(value, "cleanSession", true),
            reconnect = boolean(value, "reconnect", true),
            subscriptions = subscriptions,
        )
    }

    private fun parseSubscriptions(
        connection: String,
        values: JSONArray,
    ): List<RemixMqttSubscriptionConfig> {
        val result = mutableListOf<RemixMqttSubscriptionConfig>()
        val filters = mutableSetOf<String>()

        for (index in 0 until values.length()) {
            val value = values.optJSONObject(index)
                ?: throw IllegalArgumentException("MQTT subscription $connection[$index] must be an object")
            val filter = optionalString(value, "filter") ?: ""
            require(isValidTopicFilter(filter)) { "Invalid MQTT topic filter for $connection" }
            require(filters.add(filter)) { "Duplicate MQTT topic filter for $connection: $filter" }
            val qos = integer(value, "qos", 0)
            require(qos in 0..2) { "Invalid MQTT subscription QoS for $connection" }
            result += RemixMqttSubscriptionConfig(filter, qos)
        }

        return result
    }

    private fun optionalString(value: JSONObject, key: String): String? {
        if (!value.has(key) || value.isNull(key)) {
            return null
        }

        val result = value.get(key)
        require(result is String) { "MQTT field $key must be a string" }
        return result
    }

    private fun integer(value: JSONObject, key: String, defaultValue: Int): Int {
        if (!value.has(key) || value.isNull(key)) {
            return defaultValue
        }

        val result = value.get(key)
        require(result is Number) { "MQTT field $key must be an integer" }
        val asLong = result.toLong()
        require(result.toDouble() == asLong.toDouble() && asLong in Int.MIN_VALUE..Int.MAX_VALUE) {
            "MQTT field $key must be an integer"
        }
        return asLong.toInt()
    }

    private fun boolean(value: JSONObject, key: String, defaultValue: Boolean): Boolean {
        if (!value.has(key) || value.isNull(key)) {
            return defaultValue
        }

        val result = value.get(key)
        require(result is Boolean) { "MQTT field $key must be a boolean" }
        return result
    }

    private fun generateClientId(context: Context, projectName: String, connection: String): String {
        val androidId = Settings.Secure.getString(
            context.contentResolver,
            Settings.Secure.ANDROID_ID,
        ) ?: "unknown-device"
        val source = "$androidId|$projectName|$connection"
        val digest = MessageDigest.getInstance("SHA-256").digest(source.toByteArray(Charsets.UTF_8))
        val suffix = digest.take(9).joinToString("") {
            "%02x".format(it.toInt() and 0xff)
        }
        return "rmx-$suffix"
    }

    private fun isValidTopicFilter(filter: String): Boolean {
        if (filter.isEmpty() || '\u0000' in filter) {
            return false
        }

        val levels = filter.split("/")
        return levels.withIndex().all { (index, level) ->
            when {
                '#' in level -> level == "#" && index == levels.lastIndex
                '+' in level -> level == "+"
                else -> true
            }
        }
    }
}
