import type { RemixAppMount, RemixScreenOrientation } from "@remixapp/sdk";
import type { RemixProjectManifest } from "@remixapp/sdk/config";

export type RemixDevProjectModule = {
  mount?: RemixAppMount;
};

export interface RemixDevHostOptions {
  manifest: RemixProjectManifest;
  projectModule: RemixDevProjectModule;
}

export interface RemixDevHostController {
  updateProjectModule(projectModule: RemixDevProjectModule): Promise<void>;
  dispose(): Promise<void>;
}

export type DeviceState = {
  foreground: boolean;
  keepScreenOn: boolean;
  autoBrightness: boolean;
  brightness: number;
  screenTimeout: number | undefined;
  keepCpuAwake: boolean;
  orientation: RemixScreenOrientation;
  capturedKeys: Set<string>;
  captureBack: boolean;
};

export type RemixDevOrientationLock =
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";
