import type { RemixProjectManifest } from "@remixapp/sdk";

import type { ProjectModule } from "./types.js";

export async function loadProjectModule(
  baseUrl: string,
  manifest: RemixProjectManifest,
): Promise<Required<ProjectModule>> {
  const moduleUrl = addCacheBuster(new URL(manifest.entry, baseUrl).href);
  const module = (await import(/* @vite-ignore */ moduleUrl)) as ProjectModule;

  if (typeof module.mount !== "function") {
    throw new Error(
      `Project entry must export a mount function: ${manifest.entry}`,
    );
  }

  return {
    mount: module.mount,
  };
}

function addCacheBuster(value: string): string {
  const url = new URL(value);
  url.searchParams.set("remixReload", String(Date.now()));
  return url.href;
}
