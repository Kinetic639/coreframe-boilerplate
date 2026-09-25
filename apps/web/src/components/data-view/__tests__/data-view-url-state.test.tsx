/** @vitest-environment jsdom */

import React from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { describe, expect, it, vi } from "vitest";
import { useDataViewUrlState } from "../data-view-url-state";

describe("DataView real nuqs adapter contract", () => {
  it("normalizes initial values with the shared parser definitions", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NuqsTestingAdapter
        searchParams={{
          page: "-2",
          pageSize: "13",
          filters: JSON.stringify({ label: "50%", literal: "%20" }),
        }}
      >
        {children}
      </NuqsTestingAdapter>
    );
    const { result } = renderHook(() => useDataViewUrlState("test"), { wrapper });

    expect(result.current.page).toBe(1);
    expect(result.current.pageSize).toBe(50);
    expect(result.current.filters).toEqual({ label: "50%", literal: "%20" });
  });

  it("pushes list-to-detail and replaces switches and close", async () => {
    const updates: UrlUpdateEvent[] = [];
    const onUrlUpdate = vi.fn((event: UrlUpdateEvent) => updates.push(event));
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <NuqsTestingAdapter hasMemory searchParams="" onUrlUpdate={onUrlUpdate}>
        {children}
      </NuqsTestingAdapter>
    );
    const { result } = renderHook(() => useDataViewUrlState("test"), { wrapper });

    await act(async () => result.current.setSelected("A"));
    await waitFor(() => expect(result.current.selected).toBe("A"));
    expect(updates.at(-1)?.options.history).toBe("push");

    await act(async () => result.current.setSelected("B"));
    await waitFor(() => expect(result.current.selected).toBe("B"));
    expect(updates.at(-1)?.options.history).toBe("replace");

    await act(async () => result.current.closeDetail());
    await waitFor(() => expect(result.current.selected).toBeNull());
    expect(updates.at(-1)?.options.history).toBe("replace");
  });
});
