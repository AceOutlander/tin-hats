import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const HEADLESS_MESSAGE =
  'Simulation, data and meta code must stay headless and deterministic: no Phaser, DOM, view code, wall-clock time or Math.random.';

export default defineConfig(
  globalIgnores([
    'dist/',
    'dev-dist/',
    'node_modules/',
    '.tools/',
    'docs/',
    'test-results/',
    'playwright-report/',
    'public/',
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
      'no-var': 'error',
    },
  },
  {
    files: ['src/sim/**', 'src/data/**', 'src/meta/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['phaser', '**/render/**', '**/ui/**', '**/audio/**', '**/art/**', '**/app/**', '**/fx/**'],
              message: HEADLESS_MESSAGE,
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        ...['window', 'document', 'localStorage', 'navigator', 'performance', 'requestAnimationFrame'].map(
          (name) => ({ name, message: HEADLESS_MESSAGE }),
        ),
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: HEADLESS_MESSAGE },
        { object: 'Date', property: 'now', message: HEADLESS_MESSAGE },
      ],
    },
  },
  {
    files: ['tools/**', 'tests/**', 'dev/**', '*.config.ts', '*.config.js'],
    rules: { 'no-console': 'off' },
  },
);
