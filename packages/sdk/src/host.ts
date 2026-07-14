/**
 * Host UI controls exposed to project code.
 */
export interface RemixHostContext {
  /**
   * Controls for adding project-owned content to the Host admin panel.
   */
  panel: RemixHostPanelContext
}

/**
 * Project-owned Host admin panel controls.
 */
export interface RemixHostPanelContext {
  /**
   * Button controls rendered in the Host admin panel.
   */
  buttons: RemixHostPanelButtonsContext

  /**
   * Status rows rendered in the Host admin panel.
   */
  status: RemixHostPanelStatusContext
}

/**
 * Button group API for the Host admin panel.
 */
export interface RemixHostPanelButtonsContext {
  /**
   * Replaces the project-owned button list.
   */
  set(buttons: RemixHostPanelButton[]): void

  /**
   * Removes every project-owned button.
   */
  clear(): void
}

/**
 * Status group API for the Host admin panel.
 */
export interface RemixHostPanelStatusContext {
  /**
   * Replaces the project-owned status rows.
   */
  set(status: RemixHostPanelStatus[]): void

  /**
   * Updates a status row text by id.
   */
  setText(id: string, text: string): void

  /**
   * Removes a status row by id.
   */
  remove(id: string): void

  /**
   * Removes every project-owned status row.
   */
  clear(): void
}

/**
 * Button rendered in the Host admin panel.
 */
export interface RemixHostPanelButton {
  /**
   * Visible button text.
   */
  label: string

  /**
   * Action run when the Host admin user presses the button.
   */
  action(): void | Promise<void>
}

/**
 * Status row rendered in the Host admin panel.
 */
export interface RemixHostPanelStatus {
  /**
   * Stable id used for later text updates.
   */
  id: string

  /**
   * Visible status label.
   */
  label: string

  /**
   * Visible status text.
   */
  text: string
}
