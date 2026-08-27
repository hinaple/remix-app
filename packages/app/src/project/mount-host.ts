export interface ProjectMountHost {
  mountContainer: HTMLElement;
  shadowRoot: ShadowRoot;
}

export function createProjectMountHost(
  hostElement: HTMLElement,
): ProjectMountHost {
  const shadowRoot =
    hostElement.shadowRoot ?? hostElement.attachShadow({ mode: "open" });
  const baseStyle = document.createElement("style");
  const mountContainer = document.createElement("div");

  baseStyle.textContent = `
    :host {
      all: initial;
      display: block;
      width: 100%;
      height: 100%;
      min-height: 100%;
    }

    [data-remix-project-mount] {
    }
  `;
  mountContainer.setAttribute("data-remix-project-mount", "");

  shadowRoot.replaceChildren(baseStyle, mountContainer);

  return {
    mountContainer,
    shadowRoot,
  };
}

export function clearProjectMountHost(hostElement: HTMLElement): void {
  if (hostElement.shadowRoot) {
    hostElement.shadowRoot.replaceChildren();
    return;
  }

  hostElement.replaceChildren();
}
