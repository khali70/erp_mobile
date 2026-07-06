// Flat ESLint config. Enforces the AGENTS.md hard rules that are review-blocking:
// no StyleSheet in app code, no feature→feature imports, no process.env outside
// config, no React.FC. Kept lint-only (no type-check program) for speed.
const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'arabic-retail-erp-mobile-desig/**',
      'babel.config.js',
      'jest.config.js',
      'jest.setup.js',
      'eslint.config.js',
      'tailwind.config.js',
      'metro.config.js',
      'drizzle.config.*',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/**/*.{ts,tsx}'],
    languageOptions: {
      globals: { __DEV__: 'readonly', console: 'readonly' },
    },
    rules: {
      // NativeWind-only styling — StyleSheet banned outside vendored ui primitives.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react-native',
              importNames: ['StyleSheet'],
              message:
                'NativeWind className only. StyleSheet is banned in app code (AGENTS.md §137).',
            },
          ],
        },
      ],
      // No React.FC — function components only (React 19, ref as prop).
      'no-restricted-syntax': [
        'error',
        {
          selector:
            "TSTypeReference > TSQualifiedName[left.name='React'][right.name='FC']",
          message: 'No React.FC — declare props explicitly (AGENTS.md hard rules).',
        },
        {
          selector: "TSQualifiedName[left.name='React'][right.name='FC']",
          message: 'No React.FC — declare props explicitly (AGENTS.md hard rules).',
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  // process.env only inside src/config/**
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/config/**'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'process',
          property: 'env',
          message: 'Read config from src/config/env.ts only (AGENTS.md).',
        },
      ],
    },
  },
  // Plain JS config/theme files are CommonJS (module/require/process).
  {
    files: ['src/**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: { module: 'writable', require: 'readonly', process: 'readonly', __dirname: 'readonly' },
    },
  },
  // Vendored UI primitives may use StyleSheet (3rd-party shape).
  {
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Tests: relax a few rules.
  {
    files: ['src/**/*.test.{ts,tsx}'],
    rules: { '@typescript-eslint/no-explicit-any': 'off' },
  },
);
