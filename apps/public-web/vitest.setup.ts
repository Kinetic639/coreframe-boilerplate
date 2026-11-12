import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { clearPermissionRegexCache } from "./src/lib/utils/permissions";

// Same baseline as apps/web/vitest.setup.ts (without the MSW server, which
// this app does not use).

// Silence console.error in tests — production code logs expected error paths
// (failed DB calls, failed event emission, etc.) which pollute test output.
beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  // Clear all mocks to prevent leakage between tests
  vi.clearAllMocks();
  clearPermissionRegexCache();
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
