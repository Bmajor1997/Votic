#!/usr/bin/env bash
set -euo pipefail

: "${ANDROID_HOME:?ANDROID_HOME must point to the Android SDK}"
ndk_version="27.1.12297006"
ndk_dir="$ANDROID_HOME/ndk/$ndk_version"

valid_ndk() {
  test -f "$ndk_dir/build/cmake/android.toolchain.cmake" &&
    test -f "$ndk_dir/source.properties" &&
    grep -Eq "^Pkg.Revision[[:space:]]*=[[:space:]]*27\\.1\\.12297006[[:space:]]*$" "$ndk_dir/source.properties"
}

if valid_ndk; then
  exit 0
fi

sdkmanager_bin="$(command -v sdkmanager || true)"
if test -z "$sdkmanager_bin"; then
  sdkmanager_bin="$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager"
fi
if ! test -x "$sdkmanager_bin"; then
  echo "Android sdkmanager is missing from PATH and the SDK command-line tools." >&2
  exit 1
fi

for attempt in 1 2 3; do
  # Remove only this pinned version's incomplete installation before retrying.
  rm -rf -- "$ndk_dir"
  if "$sdkmanager_bin" --sdk_root="$ANDROID_HOME" --install "ndk;$ndk_version" && valid_ndk; then
    exit 0
  fi
  echo "NDK installation attempt $attempt failed validation." >&2
  if test "$attempt" -lt 3; then sleep 5; fi
done

echo "Could not install and validate Android NDK $ndk_version." >&2
exit 1
