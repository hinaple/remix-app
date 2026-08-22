import type { RemixAppMount } from "@remixapp/sdk";

export const mount: RemixAppMount = (container, context) => {
  const root = document.createElement("main");
  root.className = "remix-template";
  root.textContent = `${context.project.name} ${context.project.version}`;

  container.append(root);

  return () => {
    root.remove();
  };
};
