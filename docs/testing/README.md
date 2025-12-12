# Testing Setup Guide

## ✅ Status: COMPLETE AND WORKING

The testing environment has been fully set up and verified with passing tests!

## Quick Start

### 1. Install All Required Packages (Single Command)

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event @vitejs/plugin-react msw vitest-mock-extended happy-dom eslint-plugin-vitest
```

**✅ DONE** - All packages have been installed.

### 2. Run Tests

```bash
# Run all tests once
pnpm test:run

# Run tests in watch mode
pnpm test

# Run with interactive UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

**✅ VERIFIED** - All 18 tests passing!

## Overview

This project uses Vitest, MSW (Mock Service Worker), and React Testing Library for comprehensive testing of the Next.js 15 SaaS boilerplate. This setup enables unit testing, integration testing, and API mocking without modifying existing code.

### Current Test Status

```
✓ src/test/utils.test.ts (10 tests) - Basic utility functions
✓ src/test/msw.test.ts (8 tests) - MSW integration

Test Files  2 passed (2)
Tests  18 passed (18)
Duration  ~2.6s
```

## Package Breakdown

### Core Testing (Required)

- **vitest** - Fast, Vite-native test framework
- **@vitest/ui** - Interactive UI for test results
- **@vitest/coverage-v8** - Code coverage reporting with V8

### React Testing (Required)

- **@testing-library/react** - Testing utilities for React components
- **@testing-library/jest-dom** - Custom matchers for DOM elements
- **@testing-library/user-event** - Simulates user interactions
- **@vitejs/plugin-react** - Vite plugin for React JSX/TSX support

### API Mocking (Required)

- **msw** - Mock Service Worker for intercepting HTTP requests

### Additional Utilities

- **vitest-mock-extended** - Advanced mocking utilities for Vitest
- **happy-dom** - Lightweight DOM implementation (faster than jsdom)
- **eslint-plugin-vitest** - ESLint rules for Vitest best practices

## Files to Create

### 1. Root Configuration: `vitest.config.ts`

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/*.test.{ts,tsx}",
        "**/*.spec.{ts,tsx}",
        "**/node_modules/**",
        "**/dist/**",
        "**/.next/**",
        "**/types/**",
        "**/supabase/types/**",
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 60,
        statements: 60,
      },
    },
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["**/node_modules/**", "**/dist/**", "**/.next/**"],
    reporters: ["default", "html"],
    outputFile: {
      html: "./test-results/index.html",
    },
    pool: "forks",
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@app": path.resolve(__dirname, "./src/app"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@utils": path.resolve(__dirname, "./src/utils"),
      "@supabase": path.resolve(__dirname, "./src/utils/supabase"),
      "@actions": path.resolve(__dirname, "./src/app/actions"),
      "@modules": path.resolve(__dirname, "./src/modules"),
    },
  },
});
```

### 2. Global Setup: `vitest.setup.ts`

```typescript
import "@testing-library/jest-dom/vitest";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { server } from "./src/mocks/server";

// MSW setup
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// Mock Next.js navigation
vi.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      pathname: "/",
      query: {},
      asPath: "/",
    };
  },
  usePathname() {
    return "/";
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  useParams() {
    return {};
  },
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => "en",
}));
```

### 3. MSW Handlers: `src/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from "msw";

export const handlers = [
  // Supabase Auth
  http.post("*/auth/v1/token*", () => {
    return HttpResponse.json({
      access_token: "mock-access-token",
      token_type: "bearer",
      expires_in: 3600,
      refresh_token: "mock-refresh-token",
      user: {
        id: "mock-user-id",
        email: "test@example.com",
        role: "authenticated",
      },
    });
  }),

  // Supabase REST API
  http.get("*/rest/v1/*", () => HttpResponse.json([])),
  http.post("*/rest/v1/*", () => HttpResponse.json({ id: "mock-id" })),
  http.patch("*/rest/v1/*", () => HttpResponse.json({ id: "mock-id" })),
  http.delete("*/rest/v1/*", () => HttpResponse.json({})),
];
```

### 4. MSW Server: `src/mocks/server.ts`

```typescript
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
```

### 5. Supabase Mock Utilities: `src/test/setup-supabase-mocks.ts`

```typescript
import { vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

export function createMockSupabaseClient(): SupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      like: vi.fn().mockReturnThis(),
      ilike: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      contains: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: null, error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: null, error: null }),
        download: vi.fn().mockResolvedValue({ data: null, error: null }),
        remove: vi.fn().mockResolvedValue({ data: null, error: null }),
        list: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
  } as any;
}

export function mockSupabaseClient() {
  vi.mock("@/utils/supabase/client", () => ({
    createClient: vi.fn(() => createMockSupabaseClient()),
  }));

  vi.mock("@/utils/supabase/server", () => ({
    createClient: vi.fn(() => createMockSupabaseClient()),
  }));
}
```

## Example Tests

### Service Test: `src/server/services/__tests__/products.service.test.ts`

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { ProductsService } from "../products.service";
import { createMockSupabaseClient } from "@/test/setup-supabase-mocks";

describe("ProductsService", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  describe("getProducts", () => {
    it("should return products list", async () => {
      const mockProducts = [
        { id: "1", name: "Product 1", sku: "SKU1" },
        { id: "2", name: "Product 2", sku: "SKU2" },
      ];

      mockSupabase.from().select().mockResolvedValue({
        data: mockProducts,
        error: null,
      });

      const result = await ProductsService.getProducts(mockSupabase, "org-id", {});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.products).toHaveLength(2);
      }
    });
  });
});
```

### Component Test: `src/components/ui/__tests__/button.test.tsx`

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from '../button'

describe('Button', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button', { name: /click me/i })).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<Button onClick={handleClick}>Click me</Button>)
    await user.click(screen.getByRole('button'))

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('is disabled when disabled prop is true', () => {
    render(<Button disabled>Click me</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })
})
```

## NPM Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test": "vitest",
    "test:ui": "vitest --ui",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:watch": "vitest watch"
  }
}
```

## TypeScript Configuration

Update `tsconfig.json`:

```json
{
  "compilerOptions": {
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  }
}
```

## Git Ignore

Add to `.gitignore`:

```
# Testing
coverage/
test-results/
```

## Running Tests

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run with UI
pnpm test:ui

# Generate coverage report
pnpm test:coverage
```

## MSW + Supabase Integration

### Mocking Strategies

1. **HTTP Interception (MSW)**: Intercepts actual HTTP requests to Supabase
   - Best for integration tests
   - Tests actual network behavior
   - Pattern: `*/auth/v1/*`, `*/rest/v1/*`, etc.

2. **Client Mocking**: Mock the Supabase client directly
   - Best for unit tests
   - Faster execution
   - Use `createMockSupabaseClient()`

3. **Server Action Mocking**: Mock server actions in component tests
   ```typescript
   vi.mock("@/app/actions/warehouse/get-products", () => ({
     getProductsAction: vi.fn().mockResolvedValue({
       success: true,
       data: { products: [], total: 0 },
     }),
   }));
   ```

## Testing Best Practices

### Test Structure

- **Unit Tests**: `src/**/__tests__/*.test.ts` - Individual functions/services
- **Component Tests**: `src/**/__tests__/*.test.tsx` - React components
- **Integration Tests**: `src/**/__tests__/integration/*.test.ts` - Complete flows

### Service Testing

- Always pass a mocked Supabase client
- Test both success and error cases
- Test validation logic
- Test business rules

### Component Testing

- Test user interactions (clicks, typing, form submissions)
- Test conditional rendering
- Test accessibility (roles, labels)
- Avoid testing implementation details

### MSW Usage

- Define common handlers in `src/mocks/handlers.ts`
- Use `server.use()` in tests to add runtime handlers
- Always reset handlers in `afterEach` to avoid test pollution

## Implementation Checklist

- [x] Install all packages with single pnpm command
- [x] Create `vitest.config.ts`
- [x] Create `vitest.setup.ts`
- [x] Create `src/mocks/handlers.ts`
- [x] Create `src/mocks/server.ts`
- [x] Create `src/test/setup-supabase-mocks.ts`
- [x] Update `package.json` scripts
- [x] Update `tsconfig.json`
- [x] Update `.gitignore`
- [x] Write verification tests (18 tests passing!)
- [x] Verify MSW integration works
- [x] Verify tests run successfully

**🎉 ALL DONE! Testing environment is ready to use.**

## Next Steps

1. Write tests for existing services (start with simple ones)
2. Write tests for UI components (buttons, forms, dialogs)
3. Set up integration tests for complete user flows
4. Add code coverage requirements to CI/CD
5. Document testing patterns for the team

## What Was Created

All files have been created and verified:

### Configuration Files

- ✅ `/vitest.config.ts` - Vitest configuration with aliases and coverage
- ✅ `/vitest.setup.ts` - Global setup with MSW and Next.js mocks
- ✅ Updated `/tsconfig.json` - Added Vitest types
- ✅ Updated `/.gitignore` - Added `/coverage` and `/test-results`
- ✅ Updated `/package.json` - Added test scripts

### MSW Setup

- ✅ `/src/mocks/handlers.ts` - HTTP handlers for Supabase API
- ✅ `/src/mocks/server.ts` - MSW server for Node.js

### Test Utilities

- ✅ `/src/test/setup-supabase-mocks.ts` - Supabase client mocking utilities

### Example Tests (All Passing!)

- ✅ `/src/test/utils.test.ts` - 10 utility function tests
- ✅ `/src/test/msw.test.ts` - 8 MSW integration tests

## Verified Features

- ✅ **Vitest Running**: Tests execute successfully
- ✅ **Global APIs**: `describe`, `it`, `expect`, `vi` all work
- ✅ **MSW Working**: HTTP request interception verified
- ✅ **Supabase Mocking**: Auth and REST API endpoints mocked
- ✅ **Runtime Handlers**: Can add/modify handlers during tests
- ✅ **Handler Reset**: Handlers properly reset between tests
- ✅ **Path Aliases**: All `@/*` imports work correctly
- ✅ **TypeScript**: No type errors in test files

## Notes

- **No code deletion required**: All existing code remains untouched
- **Independent setup**: Testing infrastructure is added alongside existing code
- **Gradual adoption**: Start writing tests without refactoring existing code
- **Compatible**: Works with Next.js 15, Supabase, and Server Actions
- **Production Ready**: 18 tests passing, ready for real test development
