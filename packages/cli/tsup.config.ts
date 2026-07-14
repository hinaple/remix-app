import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: {
      cli: "src/cli.ts",
    },
    format: ["esm"],
    target: "node20",
    platform: "node",
    dts: true,
    sourcemap: true,
    clean: true,
    splitting: false,
    noExternal: ["@remixapp/runtime"],
    external: ["@remixapp/sdk", "archiver", "vite"],
  },
  {
    entry: {
      "dev-runtime/index": "src/dev-runtime/index.ts",
    },
    format: ["esm"],
    target: "es2022",
    platform: "browser",
    dts: true,
    sourcemap: true,
    clean: false,
    splitting: false,
    noExternal: ["@remixapp/runtime"],
    external: ["@remixapp/sdk"],
  },
]);
