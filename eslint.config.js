import js from '@eslint/js';
import ts from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';

export default ts.config(
  {
    ignores: [
      'dist/**',
      'build/**',
      '.svelte-kit/**',
      'node_modules/**',
      'storybook-static/**',
      'test-results/**',
      'playwright-report/**',
      '.operator/**',
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: { 'svelte/no-at-html-tags': 'error' },
  },
  {
    files: ['**/*.svelte'],
    languageOptions: { parserOptions: { parser: ts.parser } },
    rules: { 'svelte/no-navigation-without-resolve': 'off' },
  },
  {
    files: ['packages/core/src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'localStorage',
        'sessionStorage',
        'fetch',
        'Date',
        'performance',
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^(?!\\.)',
              message: 'Core may only import relative modules.',
            },
            {
              group: [
                'svelte',
                'svelte/*',
                '$app/*',
                '**/components/**',
                '**/infrastructure/**',
                '**/app/**',
                '**/contract/**',
              ],
              message: 'Core may not import UI or outer layers.',
            },
          ],
        },
      ],
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'Core must receive nondeterministic values through its inputs.',
        },
      ],
    },
  },
  {
    files: ['src/lib/contract/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '**/core/**',
            '**/components/**',
            '**/infrastructure/**',
            '**/app/**',
          ],
        },
      ],
    },
  },
  {
    files: ['src/lib/components/**/*.{ts,svelte}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['$app/*', '**/infrastructure/**', '**/app/**', '**/contract/**'] },
      ],
    },
  },
  {
    files: ['src/lib/infrastructure/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['svelte', 'svelte/*', '**/components/**', '**/app/**'] },
      ],
    },
  },
);
