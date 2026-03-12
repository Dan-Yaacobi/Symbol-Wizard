import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';

export default [
  {
    ignores: ['node_modules/**', 'docs/**'],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'module',
      ecmaVersion: 'latest',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URLSearchParams: 'readonly',
        Math: 'readonly',
        setTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        globalThis: 'readonly',
        getComputedStyle: 'readonly',
      },
    },
    plugins: {
      import: importPlugin,
    },
    rules: {
      'import/no-unresolved': 'error',
      'import/named': 'error',
      'import/default': 'error',
      'import/no-cycle': 'error',
      'import/no-unused-modules': [
        'warn',
        {
          unusedExports: true,
          missingExports: true,
          ignoreExports: ['main.js'],
        },
      ],
    },
  },
];
