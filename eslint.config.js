import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.ts', '**/*.tsx'],
    ignores: [
      'page/app/postcss.config.cjs',
      'page/app/tailwind.config.cjs',
      'node_modules/**',
      'dist/**',
      'coverage/**',
    ],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    rules: {
      'no-unused-expressions': 'off',
    },
  },
];
