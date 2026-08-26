package com.fainthit.remix.core.project

import android.content.Context
import org.json.JSONObject
import java.io.File

object RemixProjectConfigRepository {
    fun loadActiveManifest(context: Context): JSONObject {
        val manifestFile = File(context.filesDir, ACTIVE_PROJECT_MANIFEST_PATH)

        require(manifestFile.isFile) {
            "Active project manifest does not exist: $ACTIVE_PROJECT_MANIFEST_PATH"
        }

        return JSONObject(manifestFile.readText(Charsets.UTF_8))
    }

    private const val ACTIVE_PROJECT_MANIFEST_PATH = "remix/projects/active/project.json"
}
