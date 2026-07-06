/**
 * Jest config — ts-jest, node environment.
 * Scope: pure-logic + service-layer units (utils, numbering, ledger math,
 * services with an injected db). No RN/JSX rendering here — that needs a
 * native harness (deferred). Repository tests that need real SQL use a node
 * better-sqlite3 harness (src/db/testing/), not the native expo-sqlite module.
 */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  clearMocks: true,
};
