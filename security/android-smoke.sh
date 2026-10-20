#!/usr/bin/env bash
set -euo pipefail
apk="${1:?Provide the bundled CI release APK}"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
collect_evidence() {
  adb logcat -d -s AndroidRuntime:E ActivityManager:I ReactNativeJS:E '*:S' > android-smoke-diagnostics.txt 2>/dev/null || true
  adb shell dumpsys activity lastanr > android-smoke-anr.txt 2>/dev/null || true
  adb shell dumpsys activity activities > android-smoke-activities.txt 2>/dev/null || true
  adb exec-out screencap -p > android-smoke-screen.png 2>/dev/null || true
}
trap collect_evidence EXIT
adb wait-for-device
adb shell input keyevent KEYCODE_WAKEUP
adb shell wm dismiss-keyguard
adb install -r "$apk"
adb logcat -c
adb shell am start -W -n com.votic.app/.MainActivity
ready=false
launcher_recovered=false
for attempt in $(seq 1 20); do
  # Do not mistake a stale hierarchy for the current foreground screen.
  adb shell rm -f /sdcard/votic-window.xml
  adb shell uiautomator dump /sdcard/votic-window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/votic-window.xml > android-smoke-screen.txt 2>/dev/null || true
  read -r state x y < <(python3 "$script_dir/android-smoke-screen.py" android-smoke-screen.txt)
  case "$state" in
    ready) ready=true; break ;;
    launcher-anr)
      if test "$launcher_recovered" = true; then
        echo "Emulator launcher ANR recurred after recovery." >&2
        exit 1
      fi
      cp android-smoke-screen.txt android-smoke-launcher-anr.txt
      echo "Recovering the emulator's Quickstep launcher ANR once." | tee android-smoke-recovery.txt
      adb shell input tap "$x" "$y"
      adb shell am start -W -n com.votic.app/.MainActivity
      launcher_recovered=true
      ;;
    blocked) echo "An application or system error dialog blocks the smoke check." >&2; exit 1 ;;
  esac
  sleep 2
done
adb logcat -d -s AndroidRuntime:E > android-smoke-runtime.txt
if test "$ready" != true; then
  echo "Votic's welcome screen did not appear within the smoke-test deadline." >&2
  exit 1
fi
adb shell pidof com.votic.app
adb shell dumpsys package com.votic.app > android-smoke-package.txt
rg 'com.votic.widgets.ContinueWidgetProvider' android-smoke-package.txt
rg 'com.votic.widgets.WeekWidgetProvider' android-smoke-package.txt
if rg 'FATAL EXCEPTION' android-smoke-runtime.txt; then exit 1; fi
