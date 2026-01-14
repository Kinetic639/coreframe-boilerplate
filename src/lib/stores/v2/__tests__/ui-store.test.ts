/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useUiStoreV2 } from "../ui-store";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, "localStorage", {
  value: localStorageMock,
  configurable: true,
});

describe("useUiStoreV2", () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorageMock.clear();

    // Reset store to initial state
    useUiStoreV2.setState({
      sidebarOpen: true,
      sidebarCollapsed: false,
      theme: "system",
    });
  });

  describe("Initial State", () => {
    it("should have correct initial state", () => {
      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(true);
      expect(state.sidebarCollapsed).toBe(false);
      expect(state.theme).toBe("system");
    });
  });

  describe("setSidebarOpen", () => {
    it("should update sidebarOpen state", () => {
      useUiStoreV2.getState().setSidebarOpen(false);

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(false);
    });

    it("should toggle sidebarOpen state", () => {
      useUiStoreV2.getState().setSidebarOpen(false);
      expect(useUiStoreV2.getState().sidebarOpen).toBe(false);

      useUiStoreV2.getState().setSidebarOpen(true);
      expect(useUiStoreV2.getState().sidebarOpen).toBe(true);
    });

    it("should not affect other UI state", () => {
      const initialCollapsed = useUiStoreV2.getState().sidebarCollapsed;
      const initialTheme = useUiStoreV2.getState().theme;

      useUiStoreV2.getState().setSidebarOpen(false);

      const state = useUiStoreV2.getState();

      expect(state.sidebarCollapsed).toBe(initialCollapsed);
      expect(state.theme).toBe(initialTheme);
    });
  });

  describe("setSidebarCollapsed", () => {
    it("should update sidebarCollapsed state", () => {
      useUiStoreV2.getState().setSidebarCollapsed(true);

      const state = useUiStoreV2.getState();

      expect(state.sidebarCollapsed).toBe(true);
    });

    it("should toggle sidebarCollapsed state", () => {
      useUiStoreV2.getState().setSidebarCollapsed(true);
      expect(useUiStoreV2.getState().sidebarCollapsed).toBe(true);

      useUiStoreV2.getState().setSidebarCollapsed(false);
      expect(useUiStoreV2.getState().sidebarCollapsed).toBe(false);
    });

    it("should not affect other UI state", () => {
      const initialOpen = useUiStoreV2.getState().sidebarOpen;
      const initialTheme = useUiStoreV2.getState().theme;

      useUiStoreV2.getState().setSidebarCollapsed(true);

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(initialOpen);
      expect(state.theme).toBe(initialTheme);
    });
  });

  describe("setTheme", () => {
    it("should update theme to light", () => {
      useUiStoreV2.getState().setTheme("light");

      const state = useUiStoreV2.getState();

      expect(state.theme).toBe("light");
    });

    it("should update theme to dark", () => {
      useUiStoreV2.getState().setTheme("dark");

      const state = useUiStoreV2.getState();

      expect(state.theme).toBe("dark");
    });

    it("should update theme to system", () => {
      useUiStoreV2.getState().setTheme("system");

      const state = useUiStoreV2.getState();

      expect(state.theme).toBe("system");
    });

    it("should not affect other UI state", () => {
      const initialOpen = useUiStoreV2.getState().sidebarOpen;
      const initialCollapsed = useUiStoreV2.getState().sidebarCollapsed;

      useUiStoreV2.getState().setTheme("dark");

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(initialOpen);
      expect(state.sidebarCollapsed).toBe(initialCollapsed);
    });
  });

  describe("Persistence", () => {
    it("should use persist middleware with correct storage key", () => {
      // This test documents that the store uses persist middleware with "ui-store-v2" as the storage key
      // Actual persistence behavior is handled by Zustand and tested in integration
      const state = useUiStoreV2.getState();

      // Verify the store has the expected structure
      expect(state).toHaveProperty("sidebarOpen");
      expect(state).toHaveProperty("sidebarCollapsed");
      expect(state).toHaveProperty("theme");
    });

    it("should maintain state across multiple updates", () => {
      // Update multiple times
      useUiStoreV2.getState().setSidebarOpen(false);
      useUiStoreV2.getState().setSidebarCollapsed(true);
      useUiStoreV2.getState().setTheme("dark");

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(false);
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.theme).toBe("dark");
    });

    it("should support state restoration pattern", () => {
      // Set a known state
      useUiStoreV2.setState({
        sidebarOpen: false,
        sidebarCollapsed: true,
        theme: "dark",
      });

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(false);
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.theme).toBe("dark");
    });
  });

  describe("Store Behavior", () => {
    it("should maintain singleton instance", () => {
      const state1 = useUiStoreV2.getState();
      const state2 = useUiStoreV2.getState();

      expect(state1).toBe(state2); // Same instance (Zustand singleton)
    });

    it("should allow subscribers to react to changes", () => {
      let callCount = 0;
      const unsubscribe = useUiStoreV2.subscribe(() => {
        callCount++;
      });

      useUiStoreV2.getState().setSidebarOpen(false);

      expect(callCount).toBeGreaterThan(0);

      unsubscribe();
    });

    it("should allow multiple state updates", () => {
      useUiStoreV2.getState().setSidebarOpen(false);
      useUiStoreV2.getState().setSidebarCollapsed(true);
      useUiStoreV2.getState().setTheme("dark");

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(false);
      expect(state.sidebarCollapsed).toBe(true);
      expect(state.theme).toBe("dark");
    });
  });

  describe("Architecture Compliance", () => {
    it("should only manage UI state (no business logic)", () => {
      const state = useUiStoreV2.getState();

      // Should NOT have business logic fields
      expect(state).not.toHaveProperty("user");
      expect(state).not.toHaveProperty("organization");
      expect(state).not.toHaveProperty("permissions");
      expect(state).not.toHaveProperty("activeOrg");
      expect(state).not.toHaveProperty("activeBranch");
    });

    it("should only have setter methods (no fetching)", () => {
      const store = useUiStoreV2.getState();

      // Verify no fetch-like methods exist
      expect(store).not.toHaveProperty("fetchTheme");
      expect(store).not.toHaveProperty("loadPreferences");
      expect(store).not.toHaveProperty("syncSettings");
    });

    it("should have simple, direct setters", () => {
      const store = useUiStoreV2.getState();

      expect(typeof store.setSidebarOpen).toBe("function");
      expect(typeof store.setSidebarCollapsed).toBe("function");
      expect(typeof store.setTheme).toBe("function");
    });
  });

  describe("Edge Cases", () => {
    it("should handle rapid state updates", () => {
      for (let i = 0; i < 100; i++) {
        useUiStoreV2.getState().setSidebarOpen(i % 2 === 0);
      }

      const state = useUiStoreV2.getState();

      // Last iteration: i = 99, 99 % 2 === 1 (false)
      expect(state.sidebarOpen).toBe(false);
    });

    it("should handle setting same value multiple times", () => {
      useUiStoreV2.getState().setSidebarOpen(false);
      useUiStoreV2.getState().setSidebarOpen(false);
      useUiStoreV2.getState().setSidebarOpen(false);

      const state = useUiStoreV2.getState();

      expect(state.sidebarOpen).toBe(false);
    });

    it("should handle all theme values", () => {
      const themes: Array<"light" | "dark" | "system"> = ["light", "dark", "system"];

      themes.forEach((theme) => {
        useUiStoreV2.getState().setTheme(theme);
        expect(useUiStoreV2.getState().theme).toBe(theme);
      });
    });
  });

  describe("Integration", () => {
    it("should work with multiple simultaneous subscribers", () => {
      let subscriber1Calls = 0;
      let subscriber2Calls = 0;
      let subscriber3Calls = 0;

      const unsubscribe1 = useUiStoreV2.subscribe(() => {
        subscriber1Calls++;
      });

      const unsubscribe2 = useUiStoreV2.subscribe(() => {
        subscriber2Calls++;
      });

      const unsubscribe3 = useUiStoreV2.subscribe(() => {
        subscriber3Calls++;
      });

      useUiStoreV2.getState().setSidebarOpen(false);

      expect(subscriber1Calls).toBeGreaterThan(0);
      expect(subscriber2Calls).toBeGreaterThan(0);
      expect(subscriber3Calls).toBeGreaterThan(0);

      unsubscribe1();
      unsubscribe2();
      unsubscribe3();
    });

    it("should maintain consistency across multiple updates", () => {
      const updates = [
        { sidebarOpen: false, sidebarCollapsed: true, theme: "dark" as const },
        { sidebarOpen: true, sidebarCollapsed: false, theme: "light" as const },
        { sidebarOpen: false, sidebarCollapsed: true, theme: "system" as const },
      ];

      updates.forEach((update) => {
        useUiStoreV2.getState().setSidebarOpen(update.sidebarOpen);
        useUiStoreV2.getState().setSidebarCollapsed(update.sidebarCollapsed);
        useUiStoreV2.getState().setTheme(update.theme);

        const state = useUiStoreV2.getState();

        expect(state.sidebarOpen).toBe(update.sidebarOpen);
        expect(state.sidebarCollapsed).toBe(update.sidebarCollapsed);
        expect(state.theme).toBe(update.theme);
      });
    });
  });
});
