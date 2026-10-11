import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createReadBatcher } from "../read-batcher";

describe("createReadBatcher", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends the first request at once and one more for a burst that follows", () => {
    const send = vi.fn();
    const batcher = createReadBatcher(send, 2500);
    batcher.request("c1");
    batcher.request("c1");
    batcher.request("c1");
    expect(send).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2500);
    expect(send).toHaveBeenCalledTimes(2);
    // Nothing new arrived during the second window
    vi.advanceTimersByTime(5000);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("a single request is a single call; conversations do not wait for each other", () => {
    const send = vi.fn();
    const batcher = createReadBatcher(send, 2500);
    batcher.request("c1");
    batcher.request("c2");
    vi.advanceTimersByTime(10_000);
    expect(send.mock.calls.map(([id]) => id)).toEqual(["c1", "c2"]);
    batcher.request("c1");
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("flush sends what is waiting and nothing else", () => {
    const send = vi.fn();
    const batcher = createReadBatcher(send, 2500);
    batcher.request("c1");
    batcher.request("c1");
    batcher.request("c2");
    batcher.flush();
    expect(send.mock.calls.map(([id]) => id)).toEqual(["c1", "c2", "c1"]);
    vi.advanceTimersByTime(10_000);
    expect(send).toHaveBeenCalledTimes(3);
  });
});
