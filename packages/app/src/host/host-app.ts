import { Capacitor } from "@capacitor/core";
import { RemixCore } from "@remixapp/core";
import type {
  RemixDevicePolicyState,
  RemixProjectConfiguration,
  RemixProjectConfigurationReady,
} from "@remixapp/core";
import type { RemixProjectManifest } from "@remixapp/sdk";

import { createAdminKeyHandler } from "./admin-keys.js";
import { createHostUi, type HostUi } from "./host-ui.js";
import { RemixProjectRuntime } from "../project/runtime.js";
import { ProjectConfigurationRequiredError } from "../project/manifest.js";
import type { RemixProjectStartResult } from "../project/types.js";
import {
  nativeFileUrlToWebViewUrl,
  resolveProjectSource,
  type ProjectSource,
} from "../project/source.js";
import { createHostPanelContext } from "@remixapp/runtime";

declare global {
  interface Window {
    reset: () => void;
  }
}

export function createHostApp(root: HTMLElement): void {
  const ui = createHostUi(root);
  if (import.meta.env.DEV) installDevHostGlobal(ui);
  const hostProjectPanel = createHostPanelContext({
    statusRoot: ui.projectPanelStatus,
    buttonRoot: ui.projectPanelButtons,
    setError: (message) => {
      ui.hostErrorInfo.textContent = message;
    },
    setStatus: (message) => {
      ui.hostStatus.textContent = message;
    },
    statusTags: ["div", "div"],
  });
  const handleHostKey = createAdminKeyHandler(ui);
  const runtime = new RemixProjectRuntime(ui.projectContainer, {
    onKey: handleHostKey,
    hostPanel: hostProjectPanel,
  });
  window.reset = () => runtime.reset();

  let activeInstallPath: string | undefined;

  const installRequestedProject = async (
    path: string,
    label: string,
  ): Promise<void> => {
    if (activeInstallPath === path) {
      return;
    }

    activeInstallPath = path;
    try {
      await installProjectFromPath(ui, runtime, path, { label });
    } finally {
      activeInstallPath = undefined;
    }
  };

  if (Capacitor.isNativePlatform()) {
    void RemixCore.addListener("projectInstallRequested", (event) => {
      void installRequestedProject(event.path, "deploy package");
    });
    void RemixCore.addListener("project:lifecycle", () => {
      void consumeLaunchInstall(ui, installRequestedProject);
    });
  }

  //   ui.closeAdminButton.addEventListener("click", () => {
  //     void ui.showProjectPage();
  //   });

  ui.projectImportButton.addEventListener("click", () => {
    void importProject(ui, runtime);
  });

  ui.hostExitButton.addEventListener("click", () => {
    void exitApp(ui, runtime);
  });

  ui.resetButton.addEventListener("click", async () => {
    await runtime.reset();
    ui.showProjectPage();
  });

  void startInitialProject(ui, runtime);
}

async function consumeLaunchInstall(
  ui: HostUi,
  install: (path: string, label: string) => Promise<void>,
): Promise<void> {
  try {
    const launchInstall = await RemixCore.consumeLaunchProjectInstall();

    if (launchInstall.path) {
      await install(launchInstall.path, "launch install");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.hostStatus.textContent = `Launch install failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    console.error(error);
  }
}

interface RemixAppHostDevGlobal {
  toggleAdmin(): void;
}

function installDevHostGlobal(ui: HostUi): void {
  if (import.meta.env.DEV) {
    const target = globalThis as typeof globalThis & {
      remixAppHost?: RemixAppHostDevGlobal;
    };

    target.remixAppHost = {
      toggleAdmin: ui.toggleAdminPage,
    };
  }
}

function shouldShowAdminOnStart(): boolean {
  const value = new URLSearchParams(window.location.search).get("admin");
  return value === "1" || value === "true";
}

async function startInitialProject(
  ui: HostUi,
  runtime: RemixProjectRuntime,
): Promise<void> {
  let source: ProjectSource | undefined;
  try {
    source = await resolveProjectSource();

    if (!source) {
      ui.hostStatus.textContent = "No project installed";
      await importProject(ui, runtime, {
        showAdminAfterMount: shouldShowAdminOnStart(),
        showAdminOnCancel: true,
        showAdminOnFailure: true,
      });
      return;
    }

    const result = await runtime.start(source.url);
    ui.hostStatus.textContent = "Project mounted";
    await renderHostInfo(ui, runtime, result, source);

    if (shouldShowAdminOnStart()) {
      ui.showAdminPage();
    }
  } catch (error) {
    if (error instanceof ProjectConfigurationRequiredError && source) {
      await showConfigurationRequired(ui, runtime, source, error.configuration);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    ui.hostStatus.textContent = `Project failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    ui.showAdminPage();
    console.error(error);
  }
}

interface ImportProjectOptions {
  showAdminAfterMount?: boolean;
  showAdminOnCancel?: boolean;
  showAdminOnFailure?: boolean;
}

async function importProject(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  options: ImportProjectOptions = {},
): Promise<void> {
  ui.projectImportButton.disabled = true;
  ui.hostStatus.textContent = "Selecting project...";
  let pickedPath: string | undefined;

  try {
    const picked = await RemixCore.pickProjectPackage();

    if (picked.canceled || !picked.path) {
      ui.hostStatus.textContent = "Project import canceled";
      if (options.showAdminOnCancel) {
        ui.showAdminPage();
      }
      return;
    }

    pickedPath = picked.path;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.hostStatus.textContent = `Project import failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    if (options.showAdminOnFailure) {
      ui.showAdminPage();
    }
    console.error(error);
  } finally {
    ui.projectImportButton.disabled = false;
  }

  if (pickedPath) {
    await installProjectFromPath(ui, runtime, pickedPath, {
      ...options,
      label: "imported package",
    });
  }
}

interface InstallProjectFromPathOptions extends ImportProjectOptions {
  label: string;
}

async function installProjectFromPath(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  path: string,
  options: InstallProjectFromPathOptions,
): Promise<void> {
  ui.projectImportButton.disabled = true;
  ui.hostStatus.textContent = "Installing project...";

  let source: ProjectSource | undefined;
  try {
    const installed = await RemixCore.installProjectPackage({ path });

    ui.hostStatus.textContent = "Loading project...";
    const projectUrl = nativeFileUrlToWebViewUrl(installed.url);
    source = { label: options.label, url: projectUrl };
    const result = await runtime.start(projectUrl);
    ui.hostStatus.textContent = "Project mounted";
    await renderHostInfo(ui, runtime, result, source);
    if (options.showAdminAfterMount) {
      ui.showAdminPage();
    } else {
      ui.showProjectPage();
    }
  } catch (error) {
    if (error instanceof ProjectConfigurationRequiredError && source) {
      await showConfigurationRequired(ui, runtime, source, error.configuration);
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    ui.hostStatus.textContent = `Project install failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    if (options.showAdminOnFailure) {
      ui.showAdminPage();
    }
    console.error(error);
  } finally {
    ui.projectImportButton.disabled = false;
  }
}

async function exitApp(
  ui: HostUi,
  runtime: RemixProjectRuntime,
): Promise<void> {
  ui.hostExitButton.disabled = true;
  ui.hostStatus.textContent = "Exiting app...";

  try {
    await runtime.stop();

    if (Capacitor.isNativePlatform()) {
      await RemixCore.exitApp();
      return;
    }

    window.close();
    ui.hostStatus.textContent = "Exit requested";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ui.hostStatus.textContent = `Exit failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    ui.hostExitButton.disabled = false;
    console.error(error);
  }
}

async function renderHostInfo(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  result: RemixProjectStartResult,
  source: ProjectSource,
): Promise<void> {
  const devicePolicyState = await getDevicePolicyState();

  ui.projectTitle.textContent = result.manifest.name;
  ui.hostProjectInfo.textContent = formatProjectInfo(result.manifest);
  ui.hostSourceInfo.textContent = `${source.label}: ${result.baseUrl}`;
  ui.hostDeviceInfo.textContent = formatDeviceInfo(devicePolicyState);
  ui.hostPolicyInfo.textContent = formatPolicyInfo(result.manifest);
  ui.hostErrorInfo.textContent = "None";
  ui.resetButton.disabled = false;
  renderConstantsEditor(ui, runtime, source, result.configuration);
}

async function showConfigurationRequired(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  source: ProjectSource,
  configuration: RemixProjectConfiguration,
): Promise<void> {
  const missing = configuration.status === "needsConfiguration"
    ? configuration.missing.join(", ")
    : "";
  ui.projectTitle.textContent = configuration.project;
  ui.hostStatus.textContent = "Project constants required";
  ui.hostProjectInfo.textContent = configuration.project;
  ui.hostSourceInfo.textContent = `${source.label}: ${source.url}`;
  ui.hostDeviceInfo.textContent = formatDeviceInfo(await getDevicePolicyState());
  ui.hostPolicyInfo.textContent = "Waiting for required constants";
  ui.hostErrorInfo.textContent = `Missing constants: ${missing}`;
  ui.resetButton.disabled = true;
  renderConstantsEditor(ui, runtime, source, configuration);
  ui.showAdminPage();
}

function renderConstantsEditor(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  source: ProjectSource,
  configuration: RemixProjectConfiguration,
): void {
  ui.projectConstantsSection.hidden = configuration.constants.length === 0;
  ui.projectConstantsFields.replaceChildren();
  ui.projectConstantsError.textContent = "";

  for (const constant of configuration.constants) {
    const label = document.createElement("label");
    const title = document.createElement("span");
    title.textContent = constant.id;
    const detail = document.createElement("small");
    detail.textContent = constant.hasDefault
      ? `Default: ${constant.default ?? ""}`
      : constant.required
        ? "Required"
        : "Optional";
    title.append(detail);

    const input = document.createElement("input");
    input.type = "text";
    input.name = constant.id;
    input.value = constant.value ?? "";
    input.dataset.constantId = constant.id;
    input.addEventListener("input", () => delete input.dataset.useDefault);
    label.append(title, input);
    ui.projectConstantsFields.append(label);
  }

  ui.projectConstantsResetButton.onclick = () => {
    for (const constant of configuration.constants) {
      const input = findConstantInput(ui, constant.id);
      input.value = constant.default ?? "";
      input.dataset.useDefault = "true";
    }
    ui.projectConstantsError.textContent = "";
  };

  ui.projectConstantsForm.onsubmit = (event) => {
    event.preventDefault();
    void saveConstantsAndRestart(ui, runtime, source, configuration);
  };
}

async function saveConstantsAndRestart(
  ui: HostUi,
  runtime: RemixProjectRuntime,
  source: ProjectSource,
  configuration: RemixProjectConfiguration,
): Promise<void> {
  ui.projectConstantsSaveButton.disabled = true;
  ui.projectConstantsResetButton.disabled = true;
  ui.projectImportButton.disabled = true;
  ui.projectConstantsError.textContent = "";
  ui.hostStatus.textContent = "Saving constants...";

  let saved: RemixProjectConfigurationReady | undefined;
  try {
    const overrides: Record<string, string> = {};
    for (const constant of configuration.constants) {
      const input = findConstantInput(ui, constant.id);
      if (input.dataset.useDefault === "true") continue;
      if (constant.hasDefault && input.value === constant.default) continue;
      if (!constant.hasDefault && !constant.required && !constant.hasOverride && input.value === "") {
        continue;
      }
      overrides[constant.id] = input.value;
    }

    saved = await RemixCore.setActiveProjectConstants({
      projectId: configuration.projectId,
      revision: configuration.revision,
      overrides,
    });
    const result = await runtime.start(source.url);
    await renderHostInfo(ui, runtime, result, source);
    ui.hostStatus.textContent = "Project mounted";
    ui.showProjectPage();
  } catch (error) {
    if (saved) {
      renderConstantsEditor(ui, runtime, source, saved);
    }
    const message = error instanceof Error ? error.message : String(error);
    ui.projectConstantsError.textContent = message;
    ui.hostStatus.textContent = `Constants save failed: ${message}`;
    ui.hostErrorInfo.textContent = message;
    console.error(error);
  } finally {
    ui.projectConstantsSaveButton.disabled = false;
    ui.projectConstantsResetButton.disabled = false;
    ui.projectImportButton.disabled = false;
  }
}

function findConstantInput(ui: HostUi, id: string): HTMLInputElement {
  const input = Array.from(
    ui.projectConstantsFields.querySelectorAll<HTMLInputElement>("input[data-constant-id]"),
  ).find((candidate) => candidate.dataset.constantId === id);
  if (!input) throw new Error(`Missing constant input: ${id}`);
  return input;
}

async function getDevicePolicyState(): Promise<
  RemixDevicePolicyState | undefined
> {
  if (!Capacitor.isNativePlatform()) {
    return undefined;
  }

  return RemixCore.getDevicePolicyState();
}

function formatProjectInfo(manifest: RemixProjectManifest): string {
  return `${manifest.name} ${manifest.version}`;
}

function formatDeviceInfo(state: RemixDevicePolicyState | undefined): string {
  if (!state) {
    return "Native device state unavailable";
  }

  return [
    `Device owner: ${yesNo(state.deviceOwner)}`,
    `Admin active: ${yesNo(state.adminActive)}`,
    `Kiosk permitted: ${yesNo(state.lockTaskPermitted)}`,
    `Kiosk active: ${yesNo(state.lockTaskActive)}`,
  ].join(" | ");
}

function formatPolicyInfo(manifest: RemixProjectManifest): string {
  return [
    `Kiosk requested: ${yesNo(manifest.kiosk ?? false)}`,
    "Foreground runtime: always enabled",
    "CPU keep-awake: always enabled",
    `Keep screen on: ${yesNo(manifest.screen?.keepOn ?? false)}`,
    `Auto brightness: ${yesNo(manifest.screen?.autoBrightness ?? false)}`,
    `Immersive: ${yesNo(manifest.screen?.immersive ?? false)}`,
    `Hide system bars: ${yesNo(manifest.screen?.hideSystemBars ?? false)}`,
    `Keyboard adjust: ${manifest.screen?.keyboard?.adjust ?? "resize"}`,
    `Keyboard native adjust: ${yesNo(manifest.screen?.keyboard?.nativeAdjust ?? false)}`,
    `Keyboard state: ${manifest.screen?.keyboard?.state ?? "unspecified"}`,
    `Screen timeout: ${manifest.screen?.timeout ?? "none"}`,
    `Capture back: ${yesNo(manifest.input?.captureBack ?? false)}`,
    `Captured keys: ${manifest.input?.capturedKeys?.join(", ") || "none"}`,
  ].join("\n");
}

function yesNo(value: boolean): string {
  return value ? "Yes" : "No";
}
