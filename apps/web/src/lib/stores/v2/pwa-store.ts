"use client";

import { create } from "zustand";
import {
  currentSubscription,
  disablePush,
  enablePush,
  isPushSupported,
  isStandalone,
  needsIosInstall,
  saveSubscription,
  vapidPublicKey,
  type EnableResult,
} from "@/lib/push/client";

/** Push on this device, as the UI shows it */
export type PushState =
  | "loading"
  /** Browser without Web Push (e.g. Firefox on iPhone, old Safari) */
  | "unsupported"
  /** iPhone in Safari: works only after "Add to Home Screen" */
  | "ios-install"
  /** Server without VAPID keys */
  | "unconfigured"
  /** The user blocked notifications for Ambra in the browser */
  | "denied"
  | "off"
  | "on";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface PwaStore {
  pushState: PushState;
  busy: boolean;
  /** The browser offers installing Ambra (Chrome, Edge, Android) */
  canInstall: boolean;
  installed: boolean;
  refresh: () => Promise<void>;
  enable: () => Promise<EnableResult>;
  disable: () => Promise<void>;
  install: () => Promise<boolean>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;

async function readPushState(): Promise<PushState> {
  if (needsIosInstall()) return "ios-install";
  if (!isPushSupported()) return "unsupported";
  if (!vapidPublicKey()) return "unconfigured";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const subscription = await currentSubscription();
  return subscription ? "on" : "off";
}

export const usePwaStore = create<PwaStore>((set, get) => ({
  pushState: "loading",
  busy: false,
  canInstall: false,
  installed: false,

  refresh: async () => {
    set({ pushState: await readPushState(), installed: isStandalone() });
  },

  enable: async () => {
    set({ busy: true });
    try {
      const result = await enablePush();
      await get().refresh();
      return result;
    } finally {
      set({ busy: false });
    }
  },

  disable: async () => {
    set({ busy: true });
    try {
      await disablePush();
      await get().refresh();
    } finally {
      set({ busy: false });
    }
  },

  install: async () => {
    const prompt = deferredPrompt;
    if (!prompt) return false;
    deferredPrompt = null;
    set({ canInstall: false });
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    return outcome === "accepted";
  },
}));

/**
 * The browser fires `beforeinstallprompt` once, possibly before React mounts:
 * catch it as soon as this module loads.
 */
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    usePwaStore.setState({ canInstall: true });
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    usePwaStore.setState({ canInstall: false, installed: true });
  });
}

/** Saves this browser's existing subscription again (new user, moved keys, last seen) */
export async function resyncSubscription(): Promise<void> {
  if (!isPushSupported() || Notification.permission !== "granted") return;
  const subscription = await currentSubscription();
  if (subscription) await saveSubscription(subscription).catch(() => false);
}
