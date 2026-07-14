import type { RemixProjectManifest } from "@remixapp/sdk";

export async function loadStyles(
  target: ShadowRoot,
  baseUrl: string,
  manifest: RemixProjectManifest,
): Promise<HTMLLinkElement[]> {
  const links = manifest.styles.map((stylePath) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = new URL(stylePath, baseUrl).href;
    return link;
  });

  try {
    await Promise.all(
      links.map(
        (link) =>
          new Promise<void>((resolve, reject) => {
            link.addEventListener("load", () => resolve(), { once: true });
            link.addEventListener(
              "error",
              () =>
                reject(new Error(`Failed to load project style: ${link.href}`)),
              { once: true },
            );
            target.append(link);
          }),
      ),
    );
  } catch (error) {
    removeStyles(links);
    throw error;
  }

  return links;
}

export function removeStyles(links: HTMLLinkElement[]): void {
  links.forEach((link) => link.remove());
}
