/**
 * Access to files copied into the built project's `resources/` directory.
 */
export interface RemixResourceContext {
  /**
   * Returns a WebView-usable URL for a resource path.
   *
   * The path is relative to the project `resources/` root. For example,
   * `context.resources.url('video/intro.mp4')` should return a URL that can be
   * assigned directly to browser/WebView APIs such as `HTMLVideoElement.src`.
   */
  url(path: string): string
}
