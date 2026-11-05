#!/usr/bin/env bash
# Builds the Android release APK. Runs inside the docker/android image (workspace mounted at
# /app) but also works on any machine with the same toolchain.
#
#   docker build -t cycle-android docker/android
#   docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app cycle-android
#
# Output: dist/cycle-<version>-<short-sha>.apk (signed with the release keystore) or
#         dist/cycle-<version>-<short-sha>-unsigned-debugkey.apk (debug keystore).
#
# Release signing (all four must be set, otherwise the debug keystore is used):
#   ANDROID_KEYSTORE_BASE64, ANDROID_KEYSTORE_PASSWORD, ANDROID_KEY_ALIAS, ANDROID_KEY_PASSWORD
# Optional: GIT_SHA (commit to name the file after), CYCLE_ABIS (default arm64-v8a,armeabi-v7a).
set -euo pipefail

cd "${APP_DIR:-/app}"

version="$(node -p "require('./app.json').expo.version")"
sha="${GIT_SHA:-$(git rev-parse HEAD 2>/dev/null || echo local)}"
sha="${sha:0:7}"
abis="${CYCLE_ABIS:-arm64-v8a,armeabi-v7a}"

signed=false
keystore=""
if [[ -n "${ANDROID_KEYSTORE_BASE64:-}" && -n "${ANDROID_KEYSTORE_PASSWORD:-}" &&
  -n "${ANDROID_KEY_ALIAS:-}" && -n "${ANDROID_KEY_PASSWORD:-}" ]]; then
  signed=true
  # Keep the decoded keystore outside the workspace and remove it on exit.
  keystore="$(mktemp -t cycle-keystore.XXXXXX)"
  printf '%s' "$ANDROID_KEYSTORE_BASE64" | base64 -d >"$keystore"
  # Gradle exposes ORG_GRADLE_PROJECT_<name> variables as project properties, so the
  # passwords never appear on a command line (see plugins/with-release-signing.js).
  export ORG_GRADLE_PROJECT_CYCLE_KEYSTORE_FILE="$keystore"
  export ORG_GRADLE_PROJECT_CYCLE_KEYSTORE_PASSWORD="$ANDROID_KEYSTORE_PASSWORD"
  export ORG_GRADLE_PROJECT_CYCLE_KEY_ALIAS="$ANDROID_KEY_ALIAS"
  export ORG_GRADLE_PROJECT_CYCLE_KEY_PASSWORD="$ANDROID_KEY_PASSWORD"
  echo "Release signing: keystore secrets present."
else
  echo "Release signing: secrets not set, signing with the debug keystore."
fi

# `expo prebuild` rewrites the android/ios scripts in package.json; put the file back afterwards.
package_json_backup="$(mktemp -t cycle-package-json.XXXXXX)"
cp package.json "$package_json_backup"
trap 'cp "$package_json_backup" package.json; rm -f "$package_json_backup" "$keystore"' EXIT

npm ci
npx expo prebuild --platform android --clean --no-install

(cd android && ./gradlew assembleRelease --no-daemon --stacktrace "-PreactNativeArchitectures=${abis}")

mkdir -p dist
if [[ "$signed" == true ]]; then
  out="dist/cycle-${version}-${sha}.apk"
else
  out="dist/cycle-${version}-${sha}-unsigned-debugkey.apk"
fi
cp android/app/build/outputs/apk/release/app-release.apk "$out"
echo "Built $out ($(du -h "$out" | cut -f1))"
