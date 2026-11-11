import { useSyncExternalStore } from "react";

/**
 * Sound of a new chat message: a short two-tone chime made with Web Audio (no
 * audio file). On by default; the choice is kept per browser.
 */

const STORAGE_KEY = "ambra:chat:sound";
const listeners = new Set<() => void>();

export function isChatSoundOn(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setChatSoundOn(on: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, on ? "on" : "off");
  } catch {
    // Storage unavailable: the choice lasts until the page reloads
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

/** [on, set] — shared by every component and every tab of this browser */
export function useChatSound(): [boolean, (on: boolean) => void] {
  const on = useSyncExternalStore(subscribe, isChatSoundOn, () => true);
  return [on, setChatSoundOn];
}

let context: AudioContext | null = null;
let lastPlayedAt = 0;
const MIN_GAP_MS = 1500;

/** Plays the chime unless the sound is off; several messages at once sound once */
export function playChatSound(): void {
  if (typeof window === "undefined" || !isChatSoundOn()) return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_GAP_MS) return;
  lastPlayedAt = now;
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    context ??= new AudioContextClass();
    // Browsers keep audio suspended until the user has interacted with the page
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    const start = context.currentTime;
    [
      { frequency: 880, at: 0 },
      { frequency: 1175, at: 0.12 },
    ].forEach(({ frequency, at }) => {
      const oscillator = context!.createOscillator();
      const gain = context!.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + at);
      gain.gain.exponentialRampToValueAtTime(0.08, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.22);
      oscillator.connect(gain).connect(context!.destination);
      oscillator.start(start + at);
      oscillator.stop(start + at + 0.25);
    });
  } catch {
    // No audio device or blocked autoplay: stay silent
  }
}

/** For tests */
export function resetChatSoundThrottle(): void {
  lastPlayedAt = 0;
}
