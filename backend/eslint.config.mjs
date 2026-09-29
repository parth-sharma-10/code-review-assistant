import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'jest.config.js', 'eslint.config.mjs'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Project standard: short, simple functions.
      'max-lines-per-function': ['error', { max: 100, skipBlankLines: true, skipComments: true }],
      complexity: ['error', 8],
      'max-params': ['error', 5],
    },
  },
  {
    // Test suites are one long describe() callback by design.
    files: ['**/*.spec.ts', 'test/**/*.ts'],
    rules: { 'max-lines-per-function': 'off' },
  },
);
