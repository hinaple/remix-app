import { Capacitor } from "@capacitor/core";
import { RemixCore } from "@remixapp/core";

export interface ProjectSource {
  label: string;
  url: string;
}

export async function resolveProjectSource(): Promise<
  ProjectSource | undefined
> {
  const searchParams = new URLSearchParams(window.location.search);
  const installPath =
    searchParams.get("install") ?? (await getLaunchProjectInstallPath());

  if (installPath) {
    const installed = await RemixCore.installProjectPackage({
      path: installPath,
    });
    return {
      label: "launch install",
      url: nativeFileUrlToWebViewUrl(installed.url),
    };
  }

  if (Capacitor.isNativePlatform()) {
    const activeProject = await RemixCore.getActiveProject();

    if (activeProject.installed && activeProject.url) {
      return {
        label: "active installed project",
        url: nativeFileUrlToWebViewUrl(activeProject.url),
      };
    }
  }

  if (import.meta.env.DEV && import.meta.env.REMIXAPP_DEV_DEFAULT_PROJECT_URL) {
    return {
      label: "dev default project",
      url: new URL(
        import.meta.env.REMIXAPP_DEV_DEFAULT_PROJECT_URL,
        window.location.href,
      ).href,
    };
  }

  return undefined;
}

export function nativeFileUrlToWebViewUrl(url: string): string {
  const normalizedUrl = url.endsWith("/") ? url : `${url}/`;
  return Capacitor.convertFileSrc(normalizedUrl);
}

async function getLaunchProjectInstallPath(): Promise<string | undefined> {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }

  const launchInstall = await RemixCore.consumeLaunchProjectInstall();
  return launchInstall.path;
}
