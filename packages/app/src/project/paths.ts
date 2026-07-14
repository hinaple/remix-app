export function normalizeBaseUrl(value: string): string {
  return new URL("./", value).href;
}
