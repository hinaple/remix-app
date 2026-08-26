/** Version of the lockstep remixApp SDK/CLI/Host toolchain release. */
export const REMIX_TOOLCHAIN_VERSION = "0.2.0";

/** Version of the `.remixprj` archive and `project.json` layout. */
export const REMIX_PROJECT_FORMAT_VERSION = 1;

/** Version of the context, event, and action contract required by a project. */
export const REMIX_RUNTIME_API_VERSION = 4;

/** Oldest runtime API contract implemented by this Host release. */
export const REMIX_MIN_RUNTIME_API_VERSION = 2;

export interface RemixProjectBuildInfo {
  cli: string;
  sdk: string;
}
