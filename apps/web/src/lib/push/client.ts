"use client";

/**
 * Browser side of Web Push: the service worker, this device's subscription
 * and the facts the UI needs to pick a state (supported, iPhone outside the
 * home screen app, permission).
 */

export const SERVICE_WORKER_URL = "/sw.js";
export const PUSH_PROMPT_DISMISSED_KEY = "ambra.push-prompt-dismissed";

export function vapidPublicKey(): string | null {
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

/** iPhone / iPad (iPadOS reports itself as a Mac with touch) */
export function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/** Running as an installed app (home screen, Dock, taskbar) */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** On iPhone push works only in the app added to the home screen */
export function needsIosInstall(): boolean {
  return isIos() && !isStandalone();
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Registers the service worker once per page load */
export function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  registration ??= navigator.serviceWorker
    .register(SERVICE_WORKER_URL, { scope: "/", updateViaCache: "none" })
    .catch((error) => {
      console.warn("[push] service worker registration failed", error);
      registration = null;
      return null;
    });
  return registration;
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const reg = await registerServiceWorker();
  return (await reg?.pushManager.getSubscription()) ?? null;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = `${value}${"=".repeat((4 - (value.length % 4)) % 4)}`
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
}

/** Saves this browser's subscription for the signed-in user */
export async function saveSubscription(subscription: PushSubscription): Promise<boolean> {
  const response = await fetch("/api/push/subscription", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ subscription: subscription.toJSON(), standalone: isStandalone() }),
  });
  return response.ok;
}

/** The browser's push service can be unreachable (network, blocked host): don't spin forever */
const SUBSCRIBE_TIMEOUT_MS = 20_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("push subscribe timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

export type EnableResult = "on" | "denied" | "unsupported" | "unconfigured" | "failed";

/**
 * Asks for permission (must run from a click: iOS refuses otherwise),
 * subscribes this browser and saves it.
 */
export async function enablePush(): Promise<EnableResult> {
  if (!isPushSupported()) return "unsupported";
  const key = vapidPublicKey();
  if (!key) return "unconfigured";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "failed";
  try {
    const reg = await registerServiceWorker();
    if (!reg) return "failed";
    await navigator.serviceWorker.ready;
    const subscription =
      (await reg.pushManager.getSubscription()) ??
      (await withTimeout(
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: base64UrlToBytes(key),
        }),
        SUBSCRIBE_TIMEOUT_MS
      ));
    return (await saveSubscription(subscription)) ? "on" : "failed";
  } catch (error) {
    console.warn("[push] subscribe failed", error);
    return "failed";
  }
}

/** Switches push off on this device only */
export async function disablePush(): Promise<void> {
  const subscription = await currentSubscription();
  if (!subscription) return;
  await fetch("/api/push/subscription", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint }),
  }).catch(() => undefined);
  await subscription.unsubscribe().catch(() => undefined);
}

/** Number on the app icon (installed app); ignored where unsupported */
export function setAppBadge(count: number): void {
  if (typeof navigator === "undefined") return;
  const nav = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  if (!nav.setAppBadge || !nav.clearAppBadge) return;
  (count > 0 ? nav.setAppBadge(count) : nav.clearAppBadge()).catch(() => undefined);
}

/** A short device name from the user agent, e.g. "Chrome · Windows" */
export function describeUserAgent(userAgent: string | null | undefined): {
  browser: string | null;
  os: string | null;
  mobile: boolean;
} {
  const ua = userAgent ?? "";
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(ua)
            ? "macOS"
            : /Linux/.test(ua)
              ? "Linux"
              : null;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /SamsungBrowser/.test(ua)
        ? "Samsung Internet"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : null;
  return { browser, os, mobile: /iPhone|iPad|Android|Mobile/.test(ua) };
}
