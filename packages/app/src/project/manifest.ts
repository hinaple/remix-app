import {
  RemixCore,
  type RemixProjectConfigurationReady,
  type RemixProjectConfigurationRequired,
} from "@remixapp/core";
import {
  REMIX_MIN_RUNTIME_API_VERSION,
  REMIX_PROJECT_FORMAT_VERSION,
  REMIX_RUNTIME_API_VERSION,
  type RemixProjectManifest,
} from "@remixapp/sdk";

export class ProjectConfigurationRequiredError extends Error {
  constructor(
    readonly configuration: RemixProjectConfigurationRequired,
  ) {
    super(`Required project constants are missing: ${configuration.missing.join(", ")}`);
    this.name = "ProjectConfigurationRequiredError";
  }
}

export interface LoadedProjectManifest {
  manifest: RemixProjectManifest;
  configuration: RemixProjectConfigurationReady;
}

export async function loadManifest(): Promise<LoadedProjectManifest> {
  const configuration = await RemixCore.getActiveProjectConfiguration();
  if (configuration.status === "needsConfiguration") {
    throw new ProjectConfigurationRequiredError(configuration);
  }
  const value = configuration.manifest;

  if (!isRecord(value) || !hasManifestShape(value)) {
    throw new Error(
      "Invalid project.json: expected a normalized project manifest",
    );
  }

  const formatVersion = readCompatibilityVersion(
    value.formatVersion,
    1,
    REMIX_PROJECT_FORMAT_VERSION,
    "project format",
  );
  const runtimeApiVersion = readCompatibilityVersion(
    value.runtimeApiVersion,
    REMIX_MIN_RUNTIME_API_VERSION,
    REMIX_RUNTIME_API_VERSION,
    "runtime API",
  );

  const manifest = {
    ...value,
    formatVersion,
    runtimeApiVersion,
  } as unknown as RemixProjectManifest;
  return { manifest, configuration };
}

function hasManifestShape(value: Record<string, unknown>): boolean {
  return (
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    value.entry === "src/index.js" &&
    Array.isArray(value.styles) &&
    value.styles.length === 1 &&
    value.styles[0] === "src/style.css"
  );
}

function readCompatibilityVersion(
  value: unknown,
  minimum: number,
  supported: number,
  label: string,
): number {
  // Packages created before compatibility fields were introduced use v1.
  const version = value === undefined ? 1 : value;

  if (!Number.isInteger(version) || (version as number) < 1) {
    throw new Error(
      `Invalid project.json: ${label} version must be a positive integer`,
    );
  }
  if ((version as number) < minimum) {
    throw new Error(
      `Unsupported ${label} version ${(version as number).toString()}; this Host requires ${minimum.toString()} or newer`,
    );
  }
  if ((version as number) > supported) {
    throw new Error(
      `Unsupported ${label} version ${(version as number).toString()}; this Host supports up to ${supported.toString()}`,
    );
  }

  return version as number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
