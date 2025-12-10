import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,

    // Correct default for testing React + Next 15 components
    environment: 'jsdom',

    setupFiles: ['./vitest.setup.ts'],

    include: ['src/**/*.{test,spec}.{ts,tsx}'],

    exclude: [
      'node_modules',
      '.next',           // required to avoid infinite loops
      'dist',
      'build',
      'coverage',
      'test-results'
    ],

    // Fix for JSDOM + Next dynamic imports
    alias: {
      'next/router': 'next/router.js',
      'next/navigation': 'next/dist/client/components/navigation.js'
    },

    environmentOptions: {
      jsdom: {
        url: 'http://localhost/'
      }
    },

    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/*.test.{ts,tsx}',
        '**/*.spec.{ts,tsx}',
        '**/mocks/**',
        '**/.next/**'
      ]
    }
  }
})
