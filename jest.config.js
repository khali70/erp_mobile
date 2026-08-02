/**
 * Jest config — TWO projects, because the two kinds of test need two worlds.
 *
 *  • `node`  — ts-jest, node environment. Pure logic + repositories, the latter
 *              against a REAL better-sqlite3 database (src/db/testing/). No RN,
 *              no JSX, no React. This is the suite that already existed.
 *
 *  • `hooks` — jest-expo (the React Native preset). React hooks rendered with
 *              @testing-library/react-native's `renderHook`. It still talks to
 *              the SAME better-sqlite3 harness: the repository singletons are
 *              swapped at their `.client.ts` boundary for repos bound to an
 *              in-memory db (src/testing/hook-repos.ts), so a hook test runs the
 *              real SQL and the real CHECK constraints — `amount > 0` is a
 *              constraint, not an opinion, and a mocked repo cannot enforce it.
 *
 * They cannot share one config: ts-jest/node cannot render React Native, and the
 * RN preset's babel transform is not what the node suites are written against.
 * `projects` keeps both honest instead of compromising either.
 */
module.exports = {
  projects: [
    {
      displayName: 'node',
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
    },
    {
      displayName: 'hooks',
      preset: 'jest-expo',
      setupFilesAfterEnv: ['<rootDir>/jest.setup.hooks.js'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        // jest-expo's own setup requires `expo-modules-core` by bare name from
        // inside node_modules/jest-expo; map it explicitly to where the installer
        // hoisted it (root node_modules) so resolution never depends on nesting.
        '^expo-modules-core(.*)$': '<rootDir>/node_modules/expo-modules-core$1',
      },
      testMatch: ['<rootDir>/src/**/*.test.tsx'],
      clearMocks: true,
    },
  ],
};
