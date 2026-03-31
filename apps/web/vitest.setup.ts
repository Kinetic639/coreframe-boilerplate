import * as matchers from "@testing-library/jest-dom/matchers";
import { expect } from "vitest";
// Extend using the local vitest expect — avoids pnpm multiple-instance mismatch
// where @testing-library/jest-dom/vitest resolves to the root vitest instance
// instead of the apps/web instance used by the test runner.
expect.extend(matchers);
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { server } from "./src/mocks/server";
import { clearPermissionRegexCache } from "./src/lib/utils/permissions";

// Establish API mocking before all tests
beforeAll(() => {
  const isCI = process.env.CI === "true";
  server.listen({ onUnhandledRequest: isCI ? "error" : "warn" });
});

// Silence console.error in tests — production code logs expected error paths
// (failed DB calls, failed event emission, etc.) which pollute test output.
// Actual test failures surface as assertion errors, not console.error calls.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

// Reset any request handlers that we may add during the tests,
// so they don't affect other tests
afterEach(() => {
  server.resetHandlers();
  // Clear all mocks to prevent leakage between tests
  vi.clearAllMocks();
  // Clear permission regex cache to prevent memory leaks and test pollution
  clearPermissionRegexCache();
});

// Clean up after the tests are finished
afterAll(() => {
  server.close();
});

// Mock Next.js router (App Router API)
vi.mock("next/navigation", () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
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
