import { FlatCompat } from '@eslint/eslintrc';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off', // Allow 'any' type without warnings
      '@typescript-eslint/no-empty-object-type': 'off', // Allow empty interfaces
      '@typescript-eslint/no-require-imports': 'off', // Allow require() imports
      '@typescript-eslint/triple-slash-reference': 'off', // Allow triple-slash references
      '@typescript-eslint/ban-ts-comment': 'off', // Allow @ts-ignore comments
      'react/no-unescaped-entities': 'off', // Allow unescaped quotes and apostrophes in JSX
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      'import/no-anonymous-default-export': 'off', // Allow anonymous default exports
      '@next/next/no-assign-module-variable': 'off', // Allow module variable assignment
    },
  },
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'dist/**',
      'build/**',
      'coverage/**',
      'public/**',
      'backup/**',
      'supabase/functions/**',
    ],
  },
];
