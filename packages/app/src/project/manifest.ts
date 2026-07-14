import type { RemixProjectManifest } from "@remixapp/sdk";

export async function loadManifest(
  baseUrl: string,
): Promise<RemixProjectManifest> {
  const response = await fetch(new URL("project.json", baseUrl));

  if (!response.ok) {
    throw new Error(
      `Failed to load project.json: ${response.status} ${response.statusText}`,
    );
  }

  const value: unknown = await response.json();

  if (!isManifest(value)) {
    throw new Error(
      "Invalid project.json: expected a normalized project manifest",
    );
  }

  return value;
}

function isManifest(value: unknown): value is RemixProjectManifest {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    value.entry === "src/index.js" &&
    Array.isArray(value.styles) &&
    value.styles.length === 1 &&
    value.styles[0] === "src/style.css"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
