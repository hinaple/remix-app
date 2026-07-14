import fs from "node:fs/promises";
import path from "node:path";

import type { RemixConfig } from "@remixapp/sdk";
import {
  createServer,
  mergeConfig,
  normalizePath,
  type ConfigEnv,
  type InlineConfig,
  type UserConfigExport,
  type ViteDevServer,
} from "vite";

import { createProjectManifest } from "./build.js";
import { loadRemixConfig, resolveViteConfig } from "./config.js";
import { relativeImport } from "./paths.js";

export interface DevOptions {
  cwd: string;
  host?: string | boolean;
  port?: number;
  open?: boolean;
}

interface DevPaths {
  cwd: string;
  devDir: string;
  devEntry: string;
}

export async function devProject(options: DevOptions): Promise<ViteDevServer> {
  const cwd = path.resolve(options.cwd);
  const { config } = await loadRemixConfig(cwd, {
    command: "serve",
    mode: "development",
  });

  const entryFile = path.resolve(cwd, config.entry);
  const styleFiles = (config.styles ?? []).map((style) =>
    path.resolve(cwd, style),
  );

  await assertFile(
    entryFile,
    `Configured entry does not exist: ${config.entry}`,
  );

  for (const [index, styleFile] of styleFiles.entries()) {
    await assertFile(
      styleFile,
      `Configured style does not exist at styles[${index}]: ${config.styles?.[index]}`,
    );
  }

  const paths = getDevPaths(cwd);
  await fs.mkdir(paths.devDir, { recursive: true });
  await fs.writeFile(
    paths.devEntry,
    createDevEntry(paths, config, entryFile, styleFiles),
    "utf8",
  );

  const server = await createDevServer(paths, config.vite, options);
  installIndexMiddleware(server, paths);

  await server.listen();
  server.printUrls();
  printDevHints(server);
  bindShutdown(server);
  return server;
}

function getDevPaths(cwd: string): DevPaths {
  const devDir = path.join(cwd, ".remix", "dev");

  return {
    cwd,
    devDir,
    devEntry: path.join(devDir, "main.ts"),
  };
}

async function createDevServer(
  paths: DevPaths,
  userViteConfig: UserConfigExport | undefined,
  options: DevOptions,
): Promise<ViteDevServer> {
  const env: ConfigEnv = {
    command: "serve",
    mode: "development",
  };
  const resolvedUserConfig = await resolveViteConfig(userViteConfig, env);
  const serverOptions: InlineConfig["server"] = {};

  if (options.host !== undefined) {
    serverOptions.host = options.host;
  }

  if (options.port !== undefined) {
    serverOptions.port = options.port;
  }

  if (options.open !== undefined) {
    serverOptions.open = options.open;
  }

  const requiredConfig: InlineConfig = {
    configFile: false,
    root: paths.cwd,
    base: "./",
    publicDir: false,
    appType: "custom",
    server: serverOptions,
  };

  return await createServer(mergeConfig(resolvedUserConfig, requiredConfig));
}

function installIndexMiddleware(server: ViteDevServer, paths: DevPaths): void {
  server.middlewares.use(async (request, response, next) => {
    if (!request.url || !isIndexRequest(request.url)) {
      next();
      return;
    }

    try {
      const html = await server.transformIndexHtml(
        request.url,
        createDevHtml(paths),
      );
      response.statusCode = 200;
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(html);
    } catch (error) {
      next(error);
    }
  });
}

function isIndexRequest(url: string): boolean {
  const pathname = new URL(url, "http://remix.local").pathname;
  return pathname === "/" || pathname === "/index.html";
}

function createDevHtml(paths: DevPaths): string {
  const entryUrl = `/@fs/${normalizePath(paths.devEntry)}`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>remixApp Dev Host</title>
  </head>
  <body>
    <script type="module" src="${entryUrl}"></script>
  </body>
</html>
`;
}

function createDevEntry(
  paths: DevPaths,
  config: RemixConfig,
  entryFile: string,
  styleFiles: string[],
): string {
  const styleImports = styleFiles.map(
    (styleFile) =>
      `import ${JSON.stringify(relativeImport(paths.devEntry, styleFile))};`,
  );
  const entryImport = relativeImport(paths.devEntry, entryFile);
  const manifest = createProjectManifest(config);

  return `${styleImports.join("\n")}
import * as initialProjectModule from ${JSON.stringify(entryImport)};
import { startRemixDevHost } from "@remixapp/cli/dev-runtime";
import type { RemixProjectManifest } from "@remixapp/sdk";

const manifest = ${JSON.stringify(manifest, null, 2)} satisfies RemixProjectManifest;
const devHost = startRemixDevHost({
  manifest,
  projectModule: initialProjectModule,
});

if (import.meta.hot) {
  import.meta.hot.accept(${JSON.stringify(entryImport)}, async (nextProjectModule) => {
    if (nextProjectModule) {
      await devHost.updateProjectModule(nextProjectModule);
    }
  });

  import.meta.hot.dispose(() => {
    void devHost.dispose();
  });
}
`;
}

async function assertFile(filePath: string, message: string): Promise<void> {
  try {
    const stat = await fs.stat(filePath);

    if (!stat.isFile()) {
      throw new Error(message);
    }
  } catch {
    throw new Error(message);
  }
}

function printDevHints(server: ViteDevServer): void {
  const urls = server.resolvedUrls?.local ?? [];

  if (urls.length > 0) {
    console.log(`remixApp dev host ready: ${urls[0]}`);
  } else {
    console.log("remixApp dev host ready");
  }

  console.log("Keyboard: Esc/Backspace=BACK, +/-=VOLUME_UP/DOWN");
}

function bindShutdown(server: ViteDevServer): void {
  let closing = false;
  const close = async (): Promise<void> => {
    if (closing) {
      return;
    }

    closing = true;
    await server.close();
  };

  process.once("SIGINT", () => {
    void close().finally(() => {
      process.exit(0);
    });
  });

  process.once("SIGTERM", () => {
    void close().finally(() => {
      process.exit(0);
    });
  });
}
