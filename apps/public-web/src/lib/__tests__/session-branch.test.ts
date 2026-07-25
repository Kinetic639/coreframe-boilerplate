import { describe, it, expect, beforeEach } from "vitest";
import { getSessionBranchId, setSessionBranchId, clearSessionBranchId } from "@/lib/session-branch";

describe("session-branch", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  // ── T1: no entry ────────────────────────────────────────────────────────────
  it("getSessionBranchId returns null when no entry exists", () => {
    expect(getSessionBranchId("org-1")).toBeNull();
  });

  // ── T2: set then get ────────────────────────────────────────────────────────
  it("setSessionBranchId persists and getSessionBranchId retrieves it", () => {
    setSessionBranchId("org-1", "branch-aaa");
    expect(getSessionBranchId("org-1")).toBe("branch-aaa");
  });

  // ── T3: clear then get ──────────────────────────────────────────────────────
  it("clearSessionBranchId removes the entry and getSessionBranchId returns null", () => {
    setSessionBranchId("org-1", "branch-aaa");
    clearSessionBranchId("org-1");
    expect(getSessionBranchId("org-1")).toBeNull();
  });

  // ── T4: org-scoped keys are independent ────────────────────────────────────
  it("different orgIds have independent storage entries", () => {
    setSessionBranchId("org-1", "branch-aaa");
    setSessionBranchId("org-2", "branch-bbb");

    expect(getSessionBranchId("org-1")).toBe("branch-aaa");
    expect(getSessionBranchId("org-2")).toBe("branch-bbb");

    clearSessionBranchId("org-1");
    expect(getSessionBranchId("org-1")).toBeNull();
    expect(getSessionBranchId("org-2")).toBe("branch-bbb");
  });

  // ── T5: graceful when sessionStorage throws ─────────────────────────────────
  it("all functions degrade gracefully when sessionStorage is unavailable", () => {
    const original = globalThis.sessionStorage;

    Object.defineProperty(globalThis, "sessionStorage", {
      value: {
        getItem: () => {
          throw new Error("SecurityError");
        },
        setItem: () => {
          throw new Error("SecurityError");
        },
        removeItem: () => {
          throw new Error("SecurityError");
        },
      },
      writable: true,
      configurable: true,
    });

    expect(() => getSessionBranchId("org-1")).not.toThrow();
    expect(getSessionBranchId("org-1")).toBeNull();
    expect(() => setSessionBranchId("org-1", "branch-aaa")).not.toThrow();
    expect(() => clearSessionBranchId("org-1")).not.toThrow();

    Object.defineProperty(globalThis, "sessionStorage", {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});
