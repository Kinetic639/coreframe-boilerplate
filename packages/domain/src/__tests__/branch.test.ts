/**
 * @repo/domain — Branch resolution tests
 *
 * Suite T-BRANCH: resolveActiveBranch()
 */

import { describe, it, expect } from "vitest";
import { resolveActiveBranch } from "../branch.js";

describe("T-BRANCH: resolveActiveBranch()", () => {
  it("T-BRANCH-1: returns savedBranchId when it is present in the accessible set", () => {
    expect(resolveActiveBranch("branch-b", ["branch-a", "branch-b", "branch-c"])).toBe("branch-b");
  });

  it("T-BRANCH-2: returns first accessible ID when savedBranchId is not in the set", () => {
    expect(resolveActiveBranch("branch-stale", ["branch-a", "branch-b"])).toBe("branch-a");
  });

  it("T-BRANCH-3: returns first accessible ID when savedBranchId is null", () => {
    expect(resolveActiveBranch(null, ["branch-a", "branch-b"])).toBe("branch-a");
  });

  it("T-BRANCH-4: returns null when accessible set is empty and savedBranchId is null", () => {
    expect(resolveActiveBranch(null, [])).toBeNull();
  });

  it("T-BRANCH-5: returns null when accessible set is empty even if savedBranchId is set", () => {
    expect(resolveActiveBranch("branch-a", [])).toBeNull();
  });

  it("T-BRANCH-6: returns savedBranchId when it is the only item in the accessible set", () => {
    expect(resolveActiveBranch("branch-only", ["branch-only"])).toBe("branch-only");
  });

  it("T-BRANCH-7: returns first accessible ID when savedBranchId is an empty string", () => {
    expect(resolveActiveBranch("", ["branch-a"])).toBe("branch-a");
  });
});
