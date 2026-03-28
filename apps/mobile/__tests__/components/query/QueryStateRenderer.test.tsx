import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

import { QueryStateRenderer } from "@/components/query/QueryStateRenderer";
import type { HookResult } from "@/lib/queries/types";

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("QueryStateRenderer", () => {
  // ── 1. Renders the loading slot when kind=loading ─────────────────────────
  it("renders the loading slot when result is loading", () => {
    const result: HookResult<string> = { kind: "loading" };

    render(
      <QueryStateRenderer result={result} loading={<span>Loading…</span>}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    expect(screen.getByText("Loading…")).toBeTruthy();
    expect(screen.queryByText("Should not render")).toBeNull();
  });

  // ── 2. Renders null when kind=loading and no loading slot provided ────────
  it("renders nothing when kind=loading and loading prop is omitted", () => {
    const result: HookResult<string> = { kind: "loading" };
    render(
      <QueryStateRenderer result={result}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    // No slot content and no children rendered
    expect(screen.queryByText("Should not render")).toBeNull();
  });

  // ── 3. Renders the forbidden slot when kind=forbidden ─────────────────────
  it("renders the forbidden slot when result is forbidden", () => {
    const result: HookResult<string> = { kind: "forbidden" };

    render(
      <QueryStateRenderer result={result} forbidden={<span>Access denied</span>}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    expect(screen.getByText("Access denied")).toBeTruthy();
    expect(screen.queryByText("Should not render")).toBeNull();
  });

  // ── 4. Renders the empty slot when kind=empty ─────────────────────────────
  it("renders the empty slot when result is empty", () => {
    const result: HookResult<string> = { kind: "empty" };

    render(
      <QueryStateRenderer result={result} empty={<span>No items found</span>}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    expect(screen.getByText("No items found")).toBeTruthy();
    expect(screen.queryByText("Should not render")).toBeNull();
  });

  // ── 5. Calls error fn with message and renders its output ─────────────────
  it("calls the error prop with the error message when result is error", () => {
    const result: HookResult<string> = { kind: "error", message: "DB down" };

    render(
      <QueryStateRenderer result={result} error={(msg) => <span>Error: {msg}</span>}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    expect(screen.getByText("Error: DB down")).toBeTruthy();
    expect(screen.queryByText("Should not render")).toBeNull();
  });

  // ── 6. Renders nothing when kind=error and error prop is omitted ──────────
  it("renders nothing when kind=error and error prop is omitted", () => {
    const result: HookResult<string> = { kind: "error", message: "DB down" };
    render(
      <QueryStateRenderer result={result}>
        {() => <span>Should not render</span>}
      </QueryStateRenderer>
    );

    expect(screen.queryByText("Should not render")).toBeNull();
    expect(screen.queryByText("DB down")).toBeNull();
  });

  // ── 7. Calls children with data when kind=data ────────────────────────────
  it("calls children with the resolved data when result is data", () => {
    const result: HookResult<{ name: string }> = {
      kind: "data",
      data: { name: "Alice" },
    };

    render(
      <QueryStateRenderer result={result} loading={<span>Loading…</span>}>
        {(data) => <span>Hello, {data.name}</span>}
      </QueryStateRenderer>
    );

    expect(screen.getByText("Hello, Alice")).toBeTruthy();
    expect(screen.queryByText("Loading…")).toBeNull();
  });
});
