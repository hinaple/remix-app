import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig, loadEnv, normalizePath } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, appDir, "");

  return {
    define: {
      "import.meta.env.REMIXAPP_DEV_DEFAULT_PROJECT_URL": JSON.stringify(
        command === "serve"
          ? createDevProjectUrl(env.DEV_DEFAULT_PROJECT_PATH)
          : undefined,
      ),
    },
    build: {
      target: "es2022",
    },
  };
});

function createDevProjectUrl(
  projectPath: string | undefined,
): string | undefined {
  if (!projectPath) {
    return undefined;
  }

  if (URL.canParse(projectPath)) {
    return projectPath;
  }

  const absolutePath = path.isAbsolute(projectPath)
    ? projectPath
    : path.resolve(appDir, projectPath);

  return `/@fs/${normalizePath(absolutePath)}/`;
}
