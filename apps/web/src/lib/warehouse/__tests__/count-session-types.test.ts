import { describe, expect, it } from "vitest";
import { isValidCountLineTransition } from "../count-session-types";

describe("isValidCountLineTransition", () => {
  it("allows pending -> counted", () => {
    expect(isValidCountLineTransition("pending", "counted")).toBe(true);
  });
  it("allows pending -> skipped", () => {
    expect(isValidCountLineTransition("pending", "skipped")).toBe(true);
  });
  it("allows counted -> needs_recount", () => {
    expect(isValidCountLineTransition("counted", "needs_recount")).toBe(true);
  });
  it("allows counted -> approved", () => {
    expect(isValidCountLineTransition("counted", "approved")).toBe(true);
  });
  it("allows counted -> counted (re-count before review)", () => {
    expect(isValidCountLineTransition("counted", "counted")).toBe(true);
  });
  it("allows needs_recount -> counted", () => {
    expect(isValidCountLineTransition("needs_recount", "counted")).toBe(true);
  });
  it("allows needs_recount -> skipped", () => {
    expect(isValidCountLineTransition("needs_recount", "skipped")).toBe(true);
  });
  it("rejects approved -> pending", () => {
    expect(isValidCountLineTransition("approved", "pending")).toBe(false);
  });
  it("rejects skipped -> approved", () => {
    expect(isValidCountLineTransition("skipped", "approved")).toBe(false);
  });
  it("rejects pending -> approved (must be counted first)", () => {
    expect(isValidCountLineTransition("pending", "approved")).toBe(false);
  });
  it("rejects approved -> counted", () => {
    expect(isValidCountLineTransition("approved", "counted")).toBe(false);
  });
});
