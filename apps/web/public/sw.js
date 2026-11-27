/* Ambra service worker: system notifications (Web Push) and the app icon badge.
 * Deliberately no page caching: every deploy is visible at once.
 * Payload: see src/lib/push/types.ts (PushPayload). */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

async function setBadge(count) {
  try {
    if (!("setAppBadge" in self.navigator)) return;
    if (count > 0) await self.navigator.setAppBadge(count);
    else await self.navigator.clearAppBadge();
  } catch {
    // Badges are a nicety: some platforms refuse them
  }
}

self.addEventListener("push", (event) => {
  let data = null;
  try {
    data = event.data ? event.data.json() : null;
  } catch {
    data = null;
  }
  if (!data || !data.title) return;

  const actions = [];
  if (data.ref && (data.ref.notificationId || data.ref.conversationId)) {
    actions.push({ action: "read", title: data.actions?.markRead || "Mark as read" });
  }

  event.waitUntil(
    Promise.all([
      setBadge(Number(data.badge) || 0),
      self.registration.showNotification(data.title, {
        body: data.body || "",
        tag: data.tag,
        renotify: Boolean(data.tag),
        icon: "/pwa/icon-192.png",
        badge: "/pwa/badge-96.png",
        timestamp: Date.now(),
        actions,
        data: { url: data.url || "/dashboard/start", ref: data.ref || null, kind: data.kind },
      }),
    ])
  );
});

async function openUrl(url) {
  const target = new URL(url, self.location.origin);
  const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  // Prefer an Ambra window that is already open: navigate it and bring it up
  const existing = windows.find((client) => new URL(client.url).origin === target.origin);
  if (existing) {
    try {
      await existing.focus();
      if ("navigate" in existing) await existing.navigate(target.href);
      return;
    } catch {
      // Not allowed (e.g. other scope): open a new window below
    }
  }
  await self.clients.openWindow(target.href);
}

async function markRead(ref) {
  try {
    await fetch("/api/push/action", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        ref.notificationId
          ? { notificationId: ref.notificationId }
          : { conversationId: ref.conversationId, until: ref.until }
      ),
    });
  } catch {
    // Offline: the item stays unread, nothing else to do
  }
}

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  notification.close();

  if (event.action === "read" && data.ref) {
    // The icon number is recounted the next time Ambra is opened
    event.waitUntil(markRead(data.ref));
    return;
  }
  event.waitUntil(openUrl(data.url || "/dashboard/start"));
});

// The browser replaced the subscription (keys rotated, expired): save the new
// one now; the app also re-saves it every time it starts.
self.addEventListener("pushsubscriptionchange", (event) => {
  const options = event.oldSubscription ? event.oldSubscription.options : null;
  if (!options) return;
  event.waitUntil(
    self.registration.pushManager.subscribe(options).then((subscription) =>
      fetch("/api/push/subscription", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscription: subscription.toJSON(),
          oldEndpoint: event.oldSubscription ? event.oldSubscription.endpoint : null,
        }),
      })
    )
  );
});
