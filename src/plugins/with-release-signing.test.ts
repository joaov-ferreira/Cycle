// Tests for the release-signing config plugin (Stage 16, DECISIONS "CI and APK pipeline").
// The Gradle snippet below is the release part of the SDK 58 template's android/app/build.gradle.
/* eslint-disable @typescript-eslint/no-require-imports */
const { patchBuildGradle } = require('../../plugins/with-release-signing');

const TEMPLATE = `android {
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            signingConfig signingConfigs.debug
            minifyEnabled false
        }
    }
}
`;

describe('patchBuildGradle', () => {
  it('adds a release signing config read from Gradle properties', () => {
    const out: string = patchBuildGradle(TEMPLATE);
    expect(out).toContain("findProperty('CYCLE_KEYSTORE_FILE')");
    expect(out).toContain("storePassword findProperty('CYCLE_KEYSTORE_PASSWORD')");
    expect(out).toContain("keyAlias findProperty('CYCLE_KEY_ALIAS')");
    expect(out).toContain("keyPassword findProperty('CYCLE_KEY_PASSWORD')");
    // the debug config is kept
    expect(out).toContain("storePassword 'android'");
  });

  it('signs the release build with the release config only when a keystore is given', () => {
    const out: string = patchBuildGradle(TEMPLATE);
    expect(out).toContain(
      "signingConfig findProperty('CYCLE_KEYSTORE_FILE') ? signingConfigs.release : signingConfigs.debug"
    );
  });

  it('leaves the debug build type on the debug keystore', () => {
    const out: string = patchBuildGradle(TEMPLATE);
    const debugBlock = out.slice(out.indexOf('debug {\n            signingConfig'));
    expect(debugBlock.startsWith('debug {\n            signingConfig signingConfigs.debug')).toBe(true);
  });

  it('is idempotent', () => {
    const once: string = patchBuildGradle(TEMPLATE);
    expect(patchBuildGradle(once)).toBe(once);
  });

  it('fails loudly when the template no longer has the expected anchors', () => {
    expect(() => patchBuildGradle('android { }')).toThrow(/signingConfigs/);
    expect(() => patchBuildGradle('android { signingConfigs {\n} buildTypes { release { } } }')).toThrow(
      /release/
    );
  });
});
