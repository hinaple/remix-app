package com.fainthit.remix.core.project

import android.content.Context
import com.fainthit.remix.core.mqtt.RemixMqttConfigLoader
import com.fainthit.remix.core.nativeevents.RemixNativeEventConfigLoader
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

data class RemixProjectConstantState(
    val id: String,
    val required: Boolean,
    val hasDefault: Boolean,
    val defaultValue: String?,
    val hasOverride: Boolean,
    val value: String?,
)

data class RemixProjectConfiguration(
    val status: String,
    val project: String,
    val projectId: String,
    val revision: Int,
    val constants: List<RemixProjectConstantState>,
    val missing: List<String>,
    val manifest: JSONObject?,
)

object RemixProjectConfigRepository {
    @Synchronized
    fun loadActiveConfiguration(context: Context): RemixProjectConfiguration {
        val rawManifest = loadRawActiveManifest(context)
        val project = rawManifest.optString("name").takeIf { it.isNotEmpty() }
            ?: throw IllegalArgumentException("Active project manifest requires a name")
        val projectId = readProjectId(rawManifest, project)
        val definitions = parseDefinitions(rawManifest)
        val stored = readStored(context, projectId)
        val overrides = stored.overrides.filterKeys(definitions::containsKey)
        return resolveConfiguration(
            context,
            rawManifest,
            project,
            projectId,
            stored.revision,
            definitions,
            overrides,
        )
    }

    @Synchronized
    fun saveActiveConstants(
        context: Context,
        projectId: String,
        revision: Int,
        overrides: Map<String, String>,
    ): RemixProjectConfiguration {
        val rawManifest = loadRawActiveManifest(context)
        val activeProject = rawManifest.optString("name").takeIf { it.isNotEmpty() }
            ?: throw IllegalArgumentException("Active project manifest requires a name")
        val activeProjectId = readProjectId(rawManifest, activeProject)
        require(projectId == activeProjectId) {
            "Active project changed while constants were being edited"
        }

        val definitions = parseDefinitions(rawManifest)
        val stored = readStored(context, projectId)
        require(revision == stored.revision) {
            "Project constants changed on this device; reload the settings and try again"
        }
        val unknown = overrides.keys.firstOrNull { it !in definitions }
        require(unknown == null) { "Unknown project constant: $unknown" }

        val nextRevision = stored.revision + 1
        val configuration = resolveConfiguration(
            context,
            rawManifest,
            activeProject,
            projectId,
            nextRevision,
            definitions,
            overrides,
        )
        require(configuration.status == STATUS_READY) {
            "Required project constants are missing: ${configuration.missing.joinToString(", ")}"
        }

        writeStored(context, projectId, nextRevision, overrides)
        return configuration
    }

    fun loadReadyManifest(context: Context): JSONObject? =
        loadActiveConfiguration(context).manifest

    private fun loadRawActiveManifest(context: Context): JSONObject {
        val manifestFile = File(context.filesDir, ACTIVE_PROJECT_MANIFEST_PATH)
        require(manifestFile.isFile) {
            "Active project manifest does not exist: $ACTIVE_PROJECT_MANIFEST_PATH"
        }
        return JSONObject(manifestFile.readText(Charsets.UTF_8))
    }

    private fun resolveConfiguration(
        context: Context,
        rawManifest: JSONObject,
        project: String,
        projectId: String,
        revision: Int,
        definitions: LinkedHashMap<String, ConstantDefinition>,
        overrides: Map<String, String>,
    ): RemixProjectConfiguration {
        val states = definitions.map { (id, definition) ->
            val hasOverride = overrides.containsKey(id)
            val value = when {
                hasOverride -> overrides[id]
                definition.hasDefault -> definition.defaultValue
                else -> null
            }
            RemixProjectConstantState(
                id,
                definition.required,
                definition.hasDefault,
                definition.defaultValue,
                hasOverride,
                value,
            )
        }
        val missing = states.filter {
            it.required && !it.hasDefault && !it.hasOverride
        }.map { it.id }

        if (missing.isNotEmpty()) {
            return RemixProjectConfiguration(
                status = STATUS_NEEDS_CONFIGURATION,
                project = project,
                projectId = projectId,
                revision = revision,
                constants = states,
                missing = missing,
                manifest = null,
            )
        }

        val values = states.mapNotNull { state -> state.value?.let { state.id to it } }.toMap()
        val resolvedManifest = resolveManifest(rawManifest, definitions.keys, values)
        resolvedManifest.put("projectId", projectId)
        validateResolvedManifest(context, resolvedManifest)
        return RemixProjectConfiguration(
            status = STATUS_READY,
            project = project,
            projectId = projectId,
            revision = revision,
            constants = states,
            missing = emptyList(),
            manifest = resolvedManifest,
        )
    }

    private fun readProjectId(manifest: JSONObject, fallbackName: String): String {
        if (!manifest.has("projectId")) {
            return fallbackName
        }
        val authored = manifest.opt("projectId")
        require(authored is String && authored.isNotEmpty()) {
            "Active project manifest projectId must be a non-empty string"
        }
        return authored
    }

    private fun parseDefinitions(manifest: JSONObject): LinkedHashMap<String, ConstantDefinition> {
        val constantsValue = manifest.opt("constants") ?: return linkedMapOf()
        require(constantsValue is JSONObject) { "Project constants must be an object" }
        val result = linkedMapOf<String, ConstantDefinition>()
        val ids = constantsValue.keys()

        while (ids.hasNext()) {
            val id = ids.next()
            require(CONSTANT_ID_PATTERN.matches(id)) { "Invalid project constant id: $id" }
            val value = constantsValue.opt(id)
            require(value is JSONObject) { "Project constant $id must be an object" }
            val fields = value.keys()
            while (fields.hasNext()) {
                require(fields.next() in DEFINITION_FIELDS) {
                    "Project constant $id contains an unsupported option"
                }
            }
            val hasDefault = value.has("default")
            val defaultValue = if (hasDefault) {
                val authored = value.opt("default")
                require(authored is String) { "Project constant $id default must be a string" }
                authored
            } else null
            val required = if (value.has("required")) {
                val authored = value.opt("required")
                require(authored is Boolean) { "Project constant $id required must be a boolean" }
                authored
            } else false
            result[id] = ConstantDefinition(hasDefault, defaultValue, required)
        }

        return result
    }

    private fun resolveManifest(
        rawManifest: JSONObject,
        definitionIds: Set<String>,
        values: Map<String, String>,
    ): JSONObject {
        val result = JSONObject(rawManifest.toString())
        for (field in RUNTIME_FIELDS) {
            if (result.has(field)) {
                result.put(field, resolveValue(result.get(field), definitionIds, values, field))
            }
        }
        return result
    }

    private fun resolveValue(
        value: Any?,
        definitionIds: Set<String>,
        values: Map<String, String>,
        field: String,
    ): Any? = when (value) {
        is String -> resolveString(value, definitionIds, values, field)
        is JSONObject -> JSONObject().apply {
            val names = value.keys()
            while (names.hasNext()) {
                val name = names.next()
                put(name, resolveValue(value.get(name), definitionIds, values, "$field.$name"))
            }
        }
        is JSONArray -> JSONArray().apply {
            for (index in 0 until value.length()) {
                put(resolveValue(value.get(index), definitionIds, values, "$field[$index]"))
            }
        }
        else -> value
    }

    private fun resolveString(
        value: String,
        definitionIds: Set<String>,
        values: Map<String, String>,
        field: String,
    ): String {
        val withoutValidTemplates = CONSTANT_TEMPLATE_PATTERN.replace(value, "")
        require(!withoutValidTemplates.contains("{{Constants.")) {
            "Malformed Constants template in $field"
        }
        return CONSTANT_TEMPLATE_PATTERN.replace(value) { match ->
            val id = match.groupValues[1]
            require(id in definitionIds) { "Unknown project constant in $field: $id" }
            values[id] ?: throw IllegalArgumentException(
                "Project constant $id has no value for template in $field",
            )
        }
    }

    private fun validateResolvedManifest(context: Context, manifest: JSONObject) {
        manifest.optJSONObject("screen")?.let { screen ->
            if (screen.has("orientation")) {
                require(screen.opt("orientation") in SCREEN_ORIENTATIONS) {
                    "Invalid resolved screen orientation"
                }
            }
            screen.optJSONObject("keyboard")?.let { keyboard ->
                if (keyboard.has("adjust")) {
                    require(keyboard.opt("adjust") in KEYBOARD_ADJUSTMENTS) {
                        "Invalid resolved keyboard adjustment"
                    }
                }
                if (keyboard.has("state")) {
                    require(keyboard.opt("state") in KEYBOARD_STATES) {
                        "Invalid resolved keyboard state"
                    }
                }
            }
        }
        RemixMqttConfigLoader.parse(context, manifest)
        RemixNativeEventConfigLoader.parse(manifest)
    }

    private fun readStored(context: Context, project: String): StoredConstants {
        val authored = preferences(context).getString(project, null)
            ?: return StoredConstants(0, emptyMap())
        val value = JSONObject(authored)
        val revision = value.optInt("revision", 0).coerceAtLeast(0)
        val overrideValues = value.optJSONObject("overrides") ?: JSONObject()
        val overrides = linkedMapOf<String, String>()
        val ids = overrideValues.keys()
        while (ids.hasNext()) {
            val id = ids.next()
            val overrideValue = overrideValues.opt(id)
            require(overrideValue is String) { "Stored project constant $id must be a string" }
            overrides[id] = overrideValue
        }
        return StoredConstants(revision, overrides)
    }

    private fun writeStored(
        context: Context,
        project: String,
        revision: Int,
        overrides: Map<String, String>,
    ) {
        val value = JSONObject().apply {
            put("revision", revision)
            put("overrides", JSONObject(overrides))
        }
        check(preferences(context).edit().putString(project, value.toString()).commit()) {
            "Failed to persist project constants"
        }
    }

    private fun preferences(context: Context) =
        context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    private data class ConstantDefinition(
        val hasDefault: Boolean,
        val defaultValue: String?,
        val required: Boolean,
    )

    private data class StoredConstants(val revision: Int, val overrides: Map<String, String>)

    private const val ACTIVE_PROJECT_MANIFEST_PATH = "remix/projects/active/project.json"
    private const val PREFERENCES_NAME = "remix-project-constants"
    private const val STATUS_READY = "ready"
    private const val STATUS_NEEDS_CONFIGURATION = "needsConfiguration"
    private val CONSTANT_ID_PATTERN = Regex("^[A-Za-z][A-Za-z0-9_]*$")
    private val CONSTANT_TEMPLATE_PATTERN = Regex(
        "\\{\\{Constants\\.([A-Za-z][A-Za-z0-9_]*)\\}\\}",
    )
    private val DEFINITION_FIELDS = setOf("default", "required")
    private val RUNTIME_FIELDS = listOf("screen", "input", "mqtt", "nativeEvents")
    private val SCREEN_ORIENTATIONS = setOf(
        "portrait", "landscape", "reversePortrait", "reverseLandscape", "sensor",
        "fullSensor", "locked", "unspecified",
    )
    private val KEYBOARD_ADJUSTMENTS = setOf("resize", "pan", "nothing")
    private val KEYBOARD_STATES = setOf(
        "unspecified", "hidden", "alwaysHidden", "visible", "alwaysVisible",
    )
}
