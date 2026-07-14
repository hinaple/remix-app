export function createDevHost(): HTMLElement {
  document.documentElement.dataset.remixDev = "true";
  document.body.innerHTML = `
    <div class="remix-dev-shell">
      <main class="remix-dev-device" aria-label="remixApp project preview">
        <div id="remix-project-root"></div>
      </main>
      <aside class="remix-dev-panel" aria-label="remixApp dev controls">
        <strong>remixApp dev</strong>
        <p data-remix-dev-status>starting</p>
        <div class="remix-dev-actions">
          <button type="button" data-remix-key="BACK">BACK</button>
          <button type="button" data-remix-key="VOLUME_UP">VOL+</button>
          <button type="button" data-remix-key="VOLUME_DOWN">VOL-</button>
          <button type="button" data-remix-lifecycle="paused">pause</button>
          <button type="button" data-remix-lifecycle="resumed">resume</button>
          <button type="button" data-remix-reset>reset</button>
        </div>
        <div class="remix-dev-project-panel">
          <strong>Project status</strong>
          <dl data-remix-project-panel-status></dl>
          <strong>Project buttons</strong>
          <div class="remix-dev-actions" data-remix-project-panel-buttons></div>
        </div>
      </aside>
    </div>
  `;

  const style = document.createElement("style");
  style.textContent = `
    html,
    body {
      width: 100%;
      min-width: 320px;
      height: 100%;
      margin: 0;
      background: #000;
      color: #fff;
      overflow: hidden;
    }

    body {
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .remix-dev-shell {
      width: 100%;
      height: 100dvh;
      display: grid;
      grid-template-columns: minmax(320px, 430px) 240px;
      justify-content: center;
      align-items: center;
      gap: 16px;
      background: #111;
    }

    .remix-dev-device {
      width: min(100vw, 430px);
      height: min(100dvh, 932px);
      background: #000;
      overflow: hidden;
      filter: brightness(var(--remix-dev-brightness, 1));
    }

    #remix-project-root {
      width: 100%;
      height: 100%;
      overflow: auto;
      background: #000;
    }

    .remix-dev-panel {
      align-self: stretch;
      max-height: min(100dvh, 932px);
      box-sizing: border-box;
      padding: 12px;
      background: #000;
      color: #fff;
      border-left: 1px solid #333;
      font-size: 13px;
      overflow: auto;
    }

    .remix-dev-panel p {
      margin: 8px 0 12px;
      color: #ccc;
      overflow-wrap: anywhere;
    }

    .remix-dev-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .remix-dev-actions button {
      min-height: 34px;
      border: 1px solid #555;
      border-radius: 0;
      background: #111;
      color: #fff;
      font: inherit;
    }

    .remix-dev-project-panel {
      display: grid;
      gap: 8px;
      margin-top: 16px;
    }

    .remix-dev-project-panel dl {
      display: grid;
      gap: 4px;
      margin: 0;
    }

    .remix-dev-project-panel dt,
    .remix-dev-project-panel dd {
      margin: 0;
      overflow-wrap: anywhere;
    }

    .remix-dev-project-panel dt {
      color: #aaa;
    }

    @media (max-width: 720px) {
      .remix-dev-shell {
        display: block;
        background: #000;
      }

      .remix-dev-device {
        width: 100vw;
        height: 100dvh;
      }

      .remix-dev-panel {
        position: fixed;
        right: 8px;
        bottom: 8px;
        width: min(240px, calc(100vw - 16px));
        max-height: 40dvh;
        border: 1px solid #333;
      }
    }
  `;
  document.head.append(style);

  const projectRoot = document.querySelector<HTMLElement>(
    "#remix-project-root",
  );

  if (!projectRoot) {
    throw new Error("Failed to create remixApp dev root");
  }

  return projectRoot;
}

export function clearDevHostPanel(): void {
  document
    .querySelector<HTMLElement>("[data-remix-project-panel-status]")
    ?.replaceChildren();
  document
    .querySelector<HTMLElement>("[data-remix-project-panel-buttons]")
    ?.replaceChildren();
}
