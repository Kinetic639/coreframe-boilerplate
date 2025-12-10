# Developer Testing Guide

**Version:** 1.0
**Last Updated:** 2025-12-10
**Status:** Production Ready

This guide provides comprehensive patterns and best practices for writing tests in the coreframe-boilerplate project. All tests should follow this architecture to ensure consistency, reliability, and maintainability.

---

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Environment Setup](#test-environment-setup)
3. [Testing Patterns](#testing-patterns)
4. [Service Layer Testing](#service-layer-testing)
5. [Component Testing](#component-testing)
6. [Server Action Testing](#server-action-testing)
7. [Integration Testing](#integration-testing)
8. [Error Simulation](#error-simulation)
9. [Best Practices](#best-practices)
10. [Common Pitfalls](#common-pitfalls)
11. [Troubleshooting](#troubleshooting)

---

## Testing Philosophy

### Core Principles

1. **Test Behavior, Not Implementation**
   - Focus on what the code does, not how it does it
   - Test from the user's perspective
   - Avoid testing internal state or private methods

2. **Align Tests with Production**
   - Use strict TypeScript mode in tests (same as production)
   - Simulate real errors (RLS violations, auth failures, constraint errors)
   - Test with realistic data structures

3. **Isolation and Independence**
   - Each test should be completely independent
   - No test should depend on another test's state
   - Clean up all mocks between tests

4. **Speed and Reliability**
   - Tests should be fast (< 1 second each)
   - Tests should be deterministic (no random failures)
   - Use appropriate environment (happy-dom vs node)

---

## Test Environment Setup

### Environment Selection

**Decision Tree:**

```
Are you testing...
├─ React Component? → Use happy-dom (default)
├─ Server Action? → Use @vitest-environment node
├─ API Route? → Use @vitest-environment node
├─ Service Layer? → Use @vitest-environment node
└─ Utility Function?
   ├─ Used in components? → happy-dom
   ├─ Used in server? → @vitest-environment node
   └─ Used in both? → Test in both!
```

### Default Environment (happy-dom)

```typescript
// No annotation needed - happy-dom is default
describe('MyComponent', () => {
  it('should render correctly', () => {
    // DOM APIs available: window, document, navigator
    render(<MyComponent />)
  })
})
```

### Override to Node Environment

```typescript
/**
 * @vitest-environment node
 */
describe("MyServerAction", () => {
  it("should process data on server", async () => {
    // No DOM APIs available
    // Node.js globals available: process, global
  });
});
```

---

## Testing Patterns

### Pattern 1: Service Layer Tests

**File Location:** `src/server/services/__tests__/[service-name].service.test.ts`

**Environment:** `@vitest-environment node`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { ProductsService } from "../products.service";
import {
  createMockSupabaseClient,
  mockRLSError,
  mockNotFoundError,
} from "@/test/setup-supabase-mocks";

describe("ProductsService", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  describe("getProducts", () => {
    it("should return products list successfully", async () => {
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
        expect(result.data.products[0].name).toBe("Product 1");
      }
    });

    it("should handle RLS errors gracefully", async () => {
      mockSupabase.from().select().mockResolvedValue(mockRLSError());

      const result = await ProductsService.getProducts(mockSupabase, "org-id", {});

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("RLS");
      }
    });

    it("should handle not found errors", async () => {
      mockSupabase.from().select().single().mockResolvedValue(mockNotFoundError());

      const result = await ProductsService.getProductById(mockSupabase, "org-id", "nonexistent-id");

      expect(result.success).toBe(false);
    });
  });
});
```

**Key Points:**

- ✅ Always use `@vitest-environment node` for services
- ✅ Pass mocked Supabase client to service methods
- ✅ Test both success and error cases
- ✅ Use error helpers (`mockRLSError`, `mockNotFoundError`)
- ✅ Recreate mock client in `beforeEach` for isolation

---

### Pattern 2: Component Tests

**File Location:** `src/components/[category]/__tests__/[component-name].test.tsx`

**Environment:** `happy-dom` (default)

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ProductCard } from '../product-card'
import { renderWithAppContext } from '@/test/harnesses/app-context-harness'

describe('ProductCard', () => {
  const mockProduct = {
    id: '1',
    name: 'Test Product',
    sku: 'SKU-123',
    price: 99.99,
  }

  it('should render product information', () => {
    render(<ProductCard product={mockProduct} />)

    expect(screen.getByText('Test Product')).toBeInTheDocument()
    expect(screen.getByText('SKU-123')).toBeInTheDocument()
    expect(screen.getByText('$99.99')).toBeInTheDocument()
  })

  it('should call onClick when clicked', async () => {
    const handleClick = vi.fn()
    const user = userEvent.setup()

    render(<ProductCard product={mockProduct} onClick={handleClick} />)

    await user.click(screen.getByRole('button', { name: /view details/i }))

    expect(handleClick).toHaveBeenCalledTimes(1)
    expect(handleClick).toHaveBeenCalledWith(mockProduct.id)
  })

  it('should render with app context', () => {
    renderWithAppContext(<ProductCard product={mockProduct} />, {
      appContext: {
        activeOrgId: 'org-123',
        activeBranchId: 'branch-456',
      },
    })

    expect(screen.getByText('Test Product')).toBeInTheDocument()
  })

  it('should show loading state', () => {
    render(<ProductCard product={mockProduct} isLoading={true} />)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByText('Test Product')).not.toBeInTheDocument()
  })
})
```

**Key Points:**

- ✅ Use `render` from `@testing-library/react`
- ✅ Use `renderWithAppContext` for components that use `useAppContext()`
- ✅ Use `userEvent` for user interactions (clicks, typing)
- ✅ Query by role/label/text (not by class or test IDs)
- ✅ Test user-facing behavior, not internal state

---

### Pattern 3: Components with React Query

**File Location:** `src/components/[category]/__tests__/[component-name].test.tsx`

**Environment:** `happy-dom` (default)

```typescript
import { describe, it, expect, waitFor } from 'vitest'
import { screen } from '@testing-library/react'
import { ProductList } from '../product-list'
import {
  renderWithReactQuery,
  prefillQueryCache,
} from '@/test/harnesses/react-query-harness'

describe('ProductList', () => {
  it('should display products from cache', () => {
    const { queryClient } = renderWithReactQuery(<ProductList />)

    prefillQueryCache(queryClient, ['products'], {
      products: [
        { id: '1', name: 'Product 1' },
        { id: '2', name: 'Product 2' },
      ],
      total: 2,
    })

    expect(screen.getByText('Product 1')).toBeInTheDocument()
    expect(screen.getByText('Product 2')).toBeInTheDocument()
  })

  it('should handle loading state', () => {
    renderWithReactQuery(<ProductList />)

    // Initially shows loading
    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should handle error state', async () => {
    const { queryClient } = renderWithReactQuery(<ProductList />)

    queryClient.setQueryData(['products'], () => {
      throw new Error('Failed to fetch')
    })

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument()
    })
  })
})
```

**Key Points:**

- ✅ Use `renderWithReactQuery` for components with React Query hooks
- ✅ Use `prefillQueryCache` to populate cache before render
- ✅ Test loading, success, and error states
- ✅ Use `waitFor` for async assertions

---

### Pattern 4: Server Action Tests

**File Location:** `src/app/actions/__tests__/[action-name].test.ts`

**Environment:** `@vitest-environment node`

```typescript
/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createProductAction } from "../warehouse/products";
import {
  createMockSupabaseClient,
  mockRLSError,
  mockUniqueConstraintError,
} from "@/test/setup-supabase-mocks";

// Mock Supabase client creation
vi.mock("@/utils/supabase/server", () => ({
  createClient: () => createMockSupabaseClient(),
}));

describe("createProductAction", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
  });

  it("should create product successfully", async () => {
    const productData = {
      name: "New Product",
      sku: "SKU-123",
      organizationId: "org-123",
    };

    mockSupabase
      .from()
      .insert()
      .select()
      .single()
      .mockResolvedValue({
        data: { id: "product-1", ...productData },
        error: null,
      });

    const result = await createProductAction(productData);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe("product-1");
    }
  });

  it("should handle RLS violations", async () => {
    mockSupabase.from().insert().mockResolvedValue(mockRLSError());

    const result = await createProductAction({
      name: "Product",
      sku: "SKU-1",
      organizationId: "org-123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("permission");
    }
  });

  it("should handle unique constraint violations", async () => {
    mockSupabase.from().insert().mockResolvedValue(mockUniqueConstraintError("products_sku_key"));

    const result = await createProductAction({
      name: "Product",
      sku: "EXISTING-SKU",
      organizationId: "org-123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("already exists");
    }
  });

  it("should validate input data", async () => {
    const result = await createProductAction({
      name: "", // Invalid: empty name
      sku: "SKU-1",
      organizationId: "org-123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("required");
    }
  });
});
```

**Key Points:**

- ✅ Use `@vitest-environment node` for server actions
- ✅ Mock `@/utils/supabase/server` module
- ✅ Test validation logic before database calls
- ✅ Test RLS, constraint, and auth errors
- ✅ Verify error messages are user-friendly

---

### Pattern 5: Components with Server Actions

**File Location:** `src/components/[category]/__tests__/[component-name].test.tsx`

**Environment:** `happy-dom` (default)

```typescript
import { describe, it, expect, vi, waitFor } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateProductForm } from '../create-product-form'
import { renderWithAppContext } from '@/test/harnesses/app-context-harness'
import {
  mockServerAction,
  mockServerActionError,
} from '@/test/server-action-mocks'

// Mock the server action
mockServerAction('@/app/actions/warehouse/products', 'createProductAction', {
  id: 'product-1',
  name: 'New Product',
})

describe('CreateProductForm', () => {
  it('should submit form with valid data', async () => {
    const user = userEvent.setup()
    const handleSuccess = vi.fn()

    renderWithAppContext(
      <CreateProductForm onSuccess={handleSuccess} />,
      {
        appContext: { activeOrgId: 'org-123' },
      }
    )

    // Fill form
    await user.type(screen.getByLabelText(/product name/i), 'New Product')
    await user.type(screen.getByLabelText(/sku/i), 'SKU-123')

    // Submit
    await user.click(screen.getByRole('button', { name: /create/i }))

    // Wait for success callback
    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith({ id: 'product-1' })
    })
  })

  it('should display error message on failure', async () => {
    // Override mock to return error
    mockServerActionError(
      '@/app/actions/warehouse/products',
      'createProductAction',
      'SKU already exists'
    )

    const user = userEvent.setup()

    renderWithAppContext(<CreateProductForm />)

    await user.type(screen.getByLabelText(/sku/i), 'EXISTING-SKU')
    await user.click(screen.getByRole('button', { name: /create/i }))

    await waitFor(() => {
      expect(screen.getByText(/sku already exists/i)).toBeInTheDocument()
    })
  })

  it('should disable submit button while loading', async () => {
    const user = userEvent.setup()

    renderWithAppContext(<CreateProductForm />)

    const submitButton = screen.getByRole('button', { name: /create/i })

    await user.click(submitButton)

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled()
  })
})
```

**Key Points:**

- ✅ Use `mockServerAction` to mock server actions
- ✅ Test both success and error flows
- ✅ Verify loading states and disabled buttons
- ✅ Use `waitFor` for async state updates
- ✅ Test form validation and error display

---

## Error Simulation

### Supabase Error Helpers

```typescript
import {
  mockRLSError,
  mockNotFoundError,
  mockUniqueConstraintError,
  mockForeignKeyError,
  mockJWTExpiredError,
  mockAuthError,
  mockStorageError,
} from "@/test/setup-supabase-mocks";

// RLS policy violation
mockSupabase.from().insert().mockResolvedValue(mockRLSError());

// Record not found
mockSupabase.from().select().single().mockResolvedValue(mockNotFoundError());

// Unique constraint violation
mockSupabase.from().insert().mockResolvedValue(mockUniqueConstraintError("products_sku_key"));

// Foreign key constraint violation
mockSupabase.from().insert().mockResolvedValue(mockForeignKeyError("products_category_id_fkey"));

// JWT expired
mockSupabase.auth.getSession().mockResolvedValue(mockJWTExpiredError());

// Auth error
mockSupabase.auth.signInWithPassword().mockResolvedValue(mockAuthError("Invalid credentials"));

// Storage error
mockSupabase.storage
  .from()
  .upload()
  .mockResolvedValue(mockStorageError("File too large", "storage/file-too-large"));
```

### MSW Error Simulation

```typescript
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";

describe("API Error Handling", () => {
  it("should handle 401 unauthorized", async () => {
    server.use(
      http.get("*/rest/v1/products", () => {
        return HttpResponse.json({ message: "JWT expired", code: "401" }, { status: 401 });
      })
    );

    // Test your component/service
  });

  it("should handle 403 forbidden (RLS)", async () => {
    server.use(
      http.post("*/rest/v1/products", () => {
        return HttpResponse.json({ message: "RLS violation", code: "PGRST301" }, { status: 403 });
      })
    );

    // Test your component/service
  });
});
```

---

## Best Practices

### 1. Test Structure

```typescript
describe('Feature/Component Name', () => {
  // Setup and teardown
  beforeEach(() => {
    // Reset state, create mocks
  })

  afterEach(() => {
    // Cleanup is automatic (vi.clearAllMocks, vi.restoreAllMocks)
  })

  // Group related tests
  describe('Method/Feature Name', () => {
    it('should do something specific', () => {
      // Arrange
      const input = { ... }

      // Act
      const result = doSomething(input)

      // Assert
      expect(result).toBe(expected)
    })

    it('should handle error case', () => {
      // Test error handling
    })
  })
})
```

### 2. Naming Conventions

**Test Files:**

- Services: `[service-name].service.test.ts`
- Components: `[component-name].test.tsx`
- Actions: `[action-name].test.ts`
- Utilities: `[utility-name].test.ts`

**Test Names:**

```typescript
// ✅ GOOD: Descriptive, behavior-focused
it("should create product when valid data is provided");
it("should display error message when SKU already exists");
it("should disable submit button while form is submitting");

// ❌ BAD: Implementation-focused, vague
it("tests the create function");
it("checks if state updates");
it("validates input");
```

### 3. Assertions

```typescript
// ✅ GOOD: Specific assertions
expect(result.success).toBe(true);
expect(result.data.products).toHaveLength(2);
expect(result.data.products[0].name).toBe("Product 1");

// ❌ BAD: Too generic
expect(result).toBeTruthy();
expect(result.data).toBeDefined();
```

### 4. Avoid Testing Implementation Details

```typescript
// ❌ BAD: Testing internal state
expect(component.state.isLoading).toBe(true);
expect(component.instance().handleClick).toHaveBeenCalled();

// ✅ GOOD: Testing user-visible behavior
expect(screen.getByRole("status")).toBeInTheDocument();
expect(screen.getByRole("button")).toBeDisabled();
```

### 5. Use Realistic Test Data

```typescript
// ✅ GOOD: Realistic data
const mockProduct = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Wireless Mouse",
  sku: "WM-001-BLK",
  price: 29.99,
  created_at: "2024-01-15T10:30:00Z",
};

// ❌ BAD: Unrealistic data
const mockProduct = {
  id: "1",
  name: "test",
  sku: "a",
  price: 1,
};
```

---

## Common Pitfalls

### ❌ Pitfall 1: Testing Server Actions in happy-dom

```typescript
// ❌ WRONG: Server action tested in happy-dom
describe("createProductAction", () => {
  it("should create product", async () => {
    // This has window/document available, but server actions don't!
  });
});
```

```typescript
// ✅ CORRECT: Server action tested in node
/**
 * @vitest-environment node
 */
describe("createProductAction", () => {
  it("should create product", async () => {
    // Correctly simulates server environment
  });
});
```

### ❌ Pitfall 2: Not Cleaning Up Mocks

```typescript
// ❌ WRONG: Mocks persist between tests
describe("MyTests", () => {
  it("test 1", () => {
    vi.fn().mockReturnValue("value1");
  });

  it("test 2", () => {
    // Still has mock from test 1! ❌
  });
});
```

```typescript
// ✅ CORRECT: Automatic cleanup (already configured in vitest.setup.ts)
// No action needed - vi.clearAllMocks() and vi.restoreAllMocks() run after each test
```

### ❌ Pitfall 3: Testing with Production TypeScript but Loose Test TypeScript

```typescript
// ❌ WRONG: tsconfig.json with strict: false
{
  "compilerOptions": {
    "strict": false
  }
}
```

```typescript
// ✅ CORRECT: Same strictness as production
{
  "compilerOptions": {
    "strict": true
  }
}
```

### ❌ Pitfall 4: Not Testing Error Cases

```typescript
// ❌ WRONG: Only testing happy path
describe("getProducts", () => {
  it("should return products", async () => {
    // Only tests success case
  });
});
```

```typescript
// ✅ CORRECT: Test success AND error cases
describe("getProducts", () => {
  it("should return products successfully", async () => {
    // Success case
  });

  it("should handle RLS errors", async () => {
    // Error case: RLS
  });

  it("should handle network errors", async () => {
    // Error case: Network
  });

  it("should handle validation errors", async () => {
    // Error case: Validation
  });
});
```

### ❌ Pitfall 5: Not Simulating RLS Errors

```typescript
// ❌ WRONG: Always returning success
mockSupabase.from().select().mockResolvedValue({
  data: [...],
  error: null
})
```

```typescript
// ✅ CORRECT: Test RLS scenarios
it("should handle RLS violation", async () => {
  mockSupabase.from().select().mockResolvedValue(mockRLSError());

  const result = await service.getProducts();

  expect(result.success).toBe(false);
});
```

---

## Troubleshooting

### Issue: "vi is not defined"

**Cause:** Missing `globals: true` in vitest.config.ts

**Fix:** Already configured correctly. If you see this error, check that you're importing from vitest:

```typescript
import { describe, it, expect, vi } from "vitest";
```

### Issue: "window is not defined" in server action test

**Cause:** Forgot `@vitest-environment node` annotation

**Fix:**

```typescript
/**
 * @vitest-environment node
 */
describe("MyServerAction", () => {
  // ...
});
```

### Issue: Mocks leaking between tests

**Cause:** Not resetting mocks (but this should be automatic now)

**Fix:** Verify `vitest.setup.ts` has:

```typescript
afterEach(() => {
  server.resetHandlers();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});
```

### Issue: Component test failing with "useAppContext is not loaded"

**Cause:** Component uses `useAppContext()` but not wrapped in harness

**Fix:**

```typescript
import { renderWithAppContext } from '@/test/harnesses/app-context-harness'

renderWithAppContext(<MyComponent />, {
  appContext: { activeOrgId: 'org-123' }
})
```

### Issue: React Query test not updating

**Cause:** Not using `waitFor` for async updates

**Fix:**

```typescript
import { waitFor } from "@testing-library/react";

await waitFor(() => {
  expect(screen.getByText("Loaded")).toBeInTheDocument();
});
```

---

## Quick Reference

### Import Checklist

```typescript
// Testing utilities
import { describe, it, expect, beforeEach, afterEach, vi, waitFor } from "vitest";

// React Testing Library
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Supabase mocks
import {
  createMockSupabaseClient,
  mockRLSError,
  mockNotFoundError,
  mockUniqueConstraintError,
} from "@/test/setup-supabase-mocks";

// Test harnesses
import { renderWithAppContext } from "@/test/harnesses/app-context-harness";
import { renderWithReactQuery } from "@/test/harnesses/react-query-harness";

// Server action mocks
import { mockServerAction, mockServerActionError } from "@/test/server-action-mocks";

// MSW
import { server } from "@/mocks/server";
import { http, HttpResponse } from "msw";
```

### Command Checklist

```bash
# Run all tests
pnpm test:run

# Run tests in watch mode
pnpm test

# Run with UI
pnpm test:ui

# Generate coverage
pnpm test:coverage

# Run specific test file
pnpm test:run path/to/test.test.ts

# Run tests matching pattern
pnpm test:run -- --grep="ProductService"
```

---

## Conclusion

This testing architecture ensures:

- ✅ Tests align with production behavior
- ✅ Realistic error simulation (RLS, auth, constraints)
- ✅ Proper environment selection (happy-dom vs node)
- ✅ No mock leakage between tests
- ✅ Type safety matching production
- ✅ Comprehensive coverage of success and error cases

Follow these patterns consistently to maintain a reliable, maintainable test suite.

**Questions?** Check [docs/testing/README.md](./README.md) for setup details and troubleshooting.
