import { run } from "../packages/cli/android-tools/index.mjs";

const ANDROID_HOST_APP_ID = "com.fainthit.remix";
const ANDROID_HOST_ACTIVITY = `${ANDROID_HOST_APP_ID}/.MainActivity`;

export function installAndLaunchAndroidHost(adb, deviceSerial, apkPath) {
  run(adb, ["-s", deviceSerial, "install", "-r", apkPath], {
    stdio: "inherit",
  });
  run(adb, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "force-stop",
    ANDROID_HOST_APP_ID,
  ]);
  run(adb, [
    "-s",
    deviceSerial,
    "shell",
    "am",
    "start",
    "-n",
    ANDROID_HOST_ACTIVITY,
  ]);
}
