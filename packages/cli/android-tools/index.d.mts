export interface AndroidDevice {
  serial: string;
  model?: string;
  product?: string;
  device?: string;
}

export class AndroidToolsError extends Error {}

export interface RunOptions {
  allowFailure?: boolean;
  cwd?: string;
  stdio?: "inherit" | "pipe";
}

export interface RunResult {
  status: number;
  stdout: string;
  stderr: string;
}

export function resolveAdb(): string;
export function listAndroidDevices(adb: string): AndroidDevice[];
export function selectAndroidDevice(
  devices: AndroidDevice[],
  requestedSerial?: string,
): Promise<AndroidDevice>;
export function run(
  command: string,
  args: string[],
  options?: RunOptions,
): RunResult;
