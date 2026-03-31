import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
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
      'next/navigation': 'next/dist/client/components/navigation.js',
      'server-only': path.resolve(__dirname, 'src/__mocks__/server-only.ts'),
      '@supabase/service': path.resolve(__dirname, 'src/utils/supabase/service.ts'),
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
        '**/.next/**',
        // rolldown (coverage-v8 parser) cannot parse these TSX files with TypeScript interfaces
        '**/components/v2/feedback/loading-skeleton.tsx',
        '**/components/v2/forms/form-wrapper.tsx',
        '**/components/v2/forms/text-input.tsx',
        '**/components/v2/forms/search-form.tsx',
        // shadcn/ui wrappers — pure Radix UI re-exports, no business logic to unit test
        '**/components/ui/sidebar.tsx',
        '**/components/ui/dropdown-menu.tsx',
        // test utilities are not production code
        '**/test/server-action-mocks.ts',
        '**/test/setup-supabase-mocks.ts',
        // Next.js routing/SSR glue — not unit-testable without a full Next.js runtime.
        '**/app/**/page.tsx',
        '**/app/**/layout.tsx',
        '**/app/**/error.tsx',
        '**/app/**/loading.tsx',
        '**/app/**/not-found.tsx',
        '**/app/**/template.tsx',
        '**/app/proxy.ts',
        // Middleware — Next.js edge runtime
        '**/middleware.ts',
        // i18n routing config — pure config
        '**/i18n/routing.ts',
        '**/i18n/navigation.ts',
        '**/i18n/request.ts',
        // Pure type files — no runtime statements
        '**/lib/types/**',
        '**/lib/types/v2/**',
        '**/server/audit/types.ts',
        // Pure constant/config exports — no logic
        '**/lib/constants/**',
        '**/modules/**/config.ts',
        '**/lib/sidebar/v2/icon-map.ts',
        '**/lib/tools/registry.tsx',
        // Supabase SDK wrappers — framework glue
        '**/utils/supabase/client.ts',
        '**/utils/supabase/server.ts',
        '**/utils/supabase/service.ts',
        '**/utils/supabase/proxy.ts',
        // Misc low-value
        '**/lib/cookies/**',
        '**/__mocks__/**',
        '**/lib/metadata.ts',
      ]
    }
  }
})
