import { beforeEach, describe, expect, it, vi } from "vitest";
import { isChatSoundOn, playChatSound, resetChatSoundThrottle, setChatSoundOn } from "../sound";

const oscillators: { start: ReturnType<typeof vi.fn> }[] = [];

class FakeAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(async () => undefined);
  createOscillator() {
    const oscillator = {
      type: "",
      frequency: { value: 0 },
      connect: vi.fn((node: unknown) => node),
      start: vi.fn(),
      stop: vi.fn(),
    };
    oscillators.push(oscillator);
    return oscillator;
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn((node: unknown) => node),
    };
  }
}

describe("chat sound", () => {
  beforeEach(() => {
    window.localStorage.clear();
    oscillators.length = 0;
    resetChatSoundThrottle();
    vi.stubGlobal("AudioContext", FakeAudioContext);
  });

  it("is on by default and remembers the choice", () => {
    expect(isChatSoundOn()).toBe(true);
    setChatSoundOn(false);
    expect(isChatSoundOn()).toBe(false);
    setChatSoundOn(true);
    expect(isChatSoundOn()).toBe(true);
  });

  it("plays a two-tone chime, once for a burst of messages", () => {
    playChatSound();
    playChatSound();
    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].start).toHaveBeenCalled();
  });

  it("stays silent when switched off", () => {
    setChatSoundOn(false);
    playChatSound();
    expect(oscillators).toHaveLength(0);
  });
});
