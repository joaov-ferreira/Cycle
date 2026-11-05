// Expo config plugin: release signing from Gradle properties (Stage 16).
//
// `npx expo prebuild` generates android/app/build.gradle with the release build type signed
// by the debug keystore. This plugin patches the generated file (never committed) so the
// release build is signed with a real keystore when these Gradle properties are present:
//   CYCLE_KEYSTORE_FILE, CYCLE_KEYSTORE_PASSWORD, CYCLE_KEY_ALIAS, CYCLE_KEY_PASSWORD
// Without CYCLE_KEYSTORE_FILE the debug keystore is used, exactly as before.
// scripts/build-apk.sh passes them as ORG_GRADLE_PROJECT_* environment variables.
const { withAppBuildGradle } = require('expo/config-plugins');

const MARKER = '// cycle-release-signing';

const RELEASE_SIGNING_CONFIG = `
        release {
            ${MARKER}
            if (findProperty('CYCLE_KEYSTORE_FILE')) {
                storeFile file(findProperty('CYCLE_KEYSTORE_FILE'))
                storePassword findProperty('CYCLE_KEYSTORE_PASSWORD')
                keyAlias findProperty('CYCLE_KEY_ALIAS')
                keyPassword findProperty('CYCLE_KEY_PASSWORD')
            }
        }`;

const RELEASE_SIGNING_REF =
  "signingConfig findProperty('CYCLE_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug";

/** Patches the contents of a generated android/app/build.gradle. Pure and idempotent. */
function patchBuildGradle(contents) {
  if (contents.includes(MARKER)) return contents;

  const signingStart = contents.match(/signingConfigs\s*\{/);
  if (!signingStart) {
    throw new Error('with-release-signing: no signingConfigs block found in app/build.gradle');
  }
  const withConfig =
    contents.slice(0, signingStart.index + signingStart[0].length) +
    RELEASE_SIGNING_CONFIG +
    contents.slice(signingStart.index + signingStart[0].length);

  const releaseStart = withConfig.match(/buildTypes\s*\{[\s\S]*?\brelease\s*\{/);
  if (!releaseStart) {
    throw new Error('with-release-signing: no release build type found in app/build.gradle');
  }
  const from = releaseStart.index + releaseStart[0].length;
  const rest = withConfig.slice(from);
  const ref = rest.match(/signingConfig\s+signingConfigs\.debug/);
  if (!ref) {
    throw new Error('with-release-signing: release build type has no debug signingConfig to replace');
  }
  return (
    withConfig.slice(0, from) +
    rest.slice(0, ref.index) +
    RELEASE_SIGNING_REF +
    rest.slice(ref.index + ref[0].length)
  );
}

const withReleaseSigning = (config) =>
  withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = patchBuildGradle(cfg.modResults.contents);
    return cfg;
  });

module.exports = withReleaseSigning;
module.exports.patchBuildGradle = patchBuildGradle;
