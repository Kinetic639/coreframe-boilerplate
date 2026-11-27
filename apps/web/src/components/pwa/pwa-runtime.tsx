"use client";

import { useEffect, useMemo } from "react";
import { useUnreadNotificationsCount } from "@/hooks/queries/notifications";
import { useConversations } from "@/hooks/queries/messages";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { MESSAGES_USE } from "@/lib/constants/permissions";
import { unreadConversations } from "@/lib/messages/cache";
import { registerServiceWorker, setAppBadge } from "@/lib/push/client";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { resyncSubscription, usePwaStore } from "@/lib/stores/v2/pwa-store";
import { createClient } from "@/utils/supabase/client";

/** How often an open, visible Ambra tells the server "don't push, I'm here" */
const PRESENCE_INTERVAL_MS = 60_000;

/**
 * The installed-app side of the dashboard, mounted once:
 * - registers the service worker and re-saves this device's push subscription;
 * - tells the server while Ambra is visible, so it does not push what the
 *   user sees anyway (the app plays its own sound);
 * - keeps the number on the app icon: unread notifications + unread chats.
 */
export function PwaRuntime() {
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const { can } = usePermissions();
  const chatAllowed = can(MESSAGES_USE);
  const notifications = useUnreadNotificationsCount(orgId).data ?? 0;
  const conversations = useConversations(chatAllowed ? orgId : null).data;
  const chats = useMemo(() => unreadConversations(conversations), [conversations]);

  useEffect(() => {
    void registerServiceWorker().then(async () => {
      await usePwaStore.getState().refresh();
      await resyncSubscription();
    });
  }, []);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setInterval> | null = null;
    const report = (active: boolean) => {
      void supabase.rpc("push_presence" as never, { p_active: active } as never);
    };
    const sync = () => {
      if (timer) clearInterval(timer);
      timer = null;
      if (document.visibilityState === "visible") {
        report(true);
        timer = setInterval(() => report(true), PRESENCE_INTERVAL_MS);
      } else {
        report(false);
      }
    };
    sync();
    const onHide = () => report(false);
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("pagehide", onHide);
    return () => {
      if (timer) clearInterval(timer);
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("pagehide", onHide);
    };
  }, []);

  useEffect(() => {
    setAppBadge(notifications + chats);
  }, [notifications, chats]);

  return null;
}
