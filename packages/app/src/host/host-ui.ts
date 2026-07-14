import "./host-ui.css";
import hostUiHtml from "./host-ui.html?raw";

const HostUiDataMap = {
  projectTitle: "project-title",
  hostStatus: "host-status",
  projectContainer: "project-container",
  projectImportButton: "import-project",
  hostExitButton: "exit-app",
  projectPanelStatus: "project-panel-status",
  projectPanelButtons: "project-panel-buttons",
  hostProjectInfo: "project-info",
  hostSourceInfo: "source-info",
  hostDeviceInfo: "device-info",
  hostPolicyInfo: "policy-info",
  hostErrorInfo: "error-info",
} as const;

type HostUiNodes = {
  [k in keyof typeof HostUiDataMap]: k extends `${string}Button`
    ? HTMLButtonElement
    : HTMLElement;
};

export type HostUi = HostUiNodes & {
  isAdminVisible(): boolean;
  showAdminPage(): void;
  showProjectPage(): void;
  toggleAdminPage(): void;
};

export function createHostUi(root: HTMLElement): HostUi {
  root.innerHTML = hostUiHtml;

  const hostAdmin = root.querySelector<HTMLElement>("[data-host-admin]");

  if (!hostAdmin) throw new Error("Missing Host admin elements");

  const nodes = Object.fromEntries(
    Object.entries(HostUiDataMap).map(([k, d]) => {
      const n = root.querySelector<HTMLElement>(`[data-${d}]`);
      if (!n) throw new Error("Missing Host project elements");
      return [k, n];
    }),
  ) as HostUiNodes;

  const ui = {
    ...nodes,
    isAdminVisible: () => !hostAdmin.hidden,
    showAdminPage() {
      hostAdmin.hidden = false;
      ui.projectContainer.hidden = true;
    },
    showProjectPage() {
      hostAdmin.hidden = true;
      ui.projectContainer.hidden = false;
    },
    toggleAdminPage() {
      if (ui.isAdminVisible()) {
        ui.showProjectPage();
        return;
      }

      ui.showAdminPage();
    },
  };
  return ui;
}
