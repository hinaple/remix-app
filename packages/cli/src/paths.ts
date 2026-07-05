import path from "node:path";
import { pathToFileURL } from "node:url";

export function toPosixPath(value: string): string {
  return value.split(path.sep).join(path.posix.sep);
}

export function relativeImport(fromFile: string, targetFile: string): string {
  const fromDir = path.dirname(fromFile);
  let specifier = toPosixPath(path.relative(fromDir, targetFile));

  if (!specifier.startsWith(".")) {
    specifier = `./${specifier}`;
  }

  return specifier;
}

export function fileUrl(filePath: string): string {
  return pathToFileURL(filePath).href;
}

export function packageFileName(name: string, version: string): string {
  return `${sanitizePackagePart(name)}-${sanitizePackagePart(version)}.remixprj`;
}

export function unpackedPackageDirName(name: string, version: string): string {
  return `${sanitizePackagePart(name)}-${sanitizePackagePart(version)}`;
}

function sanitizePackagePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}
