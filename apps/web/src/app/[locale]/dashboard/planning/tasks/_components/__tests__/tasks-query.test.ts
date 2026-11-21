import { describe, expect, it } from "vitest";
import { taskListQuery } from "../tasks-query";
import { loadTaskState } from "../tasks-state";

describe("taskListQuery", () => {
  it("refetches a stale page when the tab comes back into focus", () => {
    const query = taskListQuery("org-1", loadTaskState({}));
    expect(query.refetchOnWindowFocus).toBe(true);
    // Only when stale: a quick tab switch does not refetch.
    expect(query.staleTime).toBe(30 * 1000);
  });
});
