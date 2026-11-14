import { describe, expect, it } from "vitest";
import {
  feedbackListInput,
  loadFeedbackState,
  migrateFeedbackSearchParams,
} from "../feedback-state";

describe("feedback list address", () => {
  it("asks the database for the page, the statuses and one kind", () => {
    const state = loadFeedbackState({
      q: " login ",
      strona: "2",
      wierszy: "20",
      status: "new,in_progress",
      rodzaj: "bug",
      priorytet: "high",
    });
    expect(feedbackListInput("all", state)).toEqual({
      scope: "all",
      search: "login",
      statuses: ["new", "in_progress"],
      kind: "bug",
      priority: "high",
      page: 2,
      pageSize: 20,
    });
  });

  it("never filters the user's own reports by priority", () => {
    expect(feedbackListInput("mine", loadFeedbackState({ priorytet: "high" })).priority).toBe(
      undefined
    );
  });

  it("translates old DataView links", () => {
    const { params, changed } = migrateFeedbackSearchParams({
      search: "x",
      filters: JSON.stringify({ status: ["new"], kind: "idea", priority: "low" }),
    });
    expect(changed).toBe(true);
    expect(params).toMatchObject({ q: "x", status: "new", rodzaj: "idea", priorytet: "low" });
  });
});
