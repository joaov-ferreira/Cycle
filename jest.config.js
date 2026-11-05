// Jest configuration (jest-expo preset). See README.md#tests and docs/DECISIONS.md.
const fs = require('fs');
const path = require('path');

const SOURCE_FILE = /\.(ts|tsx)$/;
const TEST_FILE = /\.test\.(ts|tsx)$/;

/** True when `dir` contains at least one non-test TypeScript source file. */
function hasSourceFiles(dir) {
  if (!fs.existsSync(dir)) return false;
  return fs.readdirSync(dir, { withFileTypes: true }).some((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return hasSourceFiles(full);
    return SOURCE_FILE.test(entry.name) && !TEST_FILE.test(entry.name);
  });
}

// SPEC §12.3: pure layers (domain, programs) >= 95% lines; global >= 80% lines.
// A layer's threshold is enforced as soon as it contains source code (Jest fails a
// threshold whose path matches no file, so empty layers are skipped).
const STRICT_LAYERS = ['src/domain', 'src/programs'];
const coverageThreshold = { global: { lines: 80 } };
for (const layer of STRICT_LAYERS) {
  if (hasSourceFiles(path.join(__dirname, layer))) {
    coverageThreshold[`./${layer}/`] = { lines: 95 };
  }
}

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__tests__/**',
    '!src/test-utils/**',
    '!src/**/*.contract.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold,
};
