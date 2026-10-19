#!/usr/bin/env bash
set -euo pipefail
apk="${1:?Provide the bundled CI release APK}"
adb install -r "$apk"
adb logcat -c
adb shell am start -W -n com.votic.app/.MainActivity
ready=false
for attempt in $(seq 1 20); do
  adb shell uiautomator dump /sdcard/votic-window.xml >/dev/null 2>&1 || true
  adb exec-out cat /sdcard/votic-window.xml > android-smoke-screen.txt 2>/dev/null || true
  if python3 - <<'PY'
from pathlib import Path
import xml.etree.ElementTree as ET
try:
    root = ET.fromstring(Path('android-smoke-screen.txt').read_text())
    labels = ' '.join(n.get('text', '') + ' ' + n.get('content-desc', '') for n in root.iter('node'))
    raise SystemExit(0 if 'Votic' in labels and ('Sign in' in labels or 'Get started' in labels or 'Create account' in labels) else 1)
except ET.ParseError:
    raise SystemExit(1)
PY
  then ready=true; break; fi
  sleep 2
done
adb logcat -d -s AndroidRuntime:E > android-smoke-runtime.txt
test "$ready" = true
adb shell pidof com.votic.app
adb shell dumpsys package com.votic.app > android-smoke-package.txt
rg 'com.votic.widgets.ContinueWidgetProvider' android-smoke-package.txt
rg 'com.votic.widgets.WeekWidgetProvider' android-smoke-package.txt
if rg 'FATAL EXCEPTION' android-smoke-runtime.txt; then exit 1; fi
