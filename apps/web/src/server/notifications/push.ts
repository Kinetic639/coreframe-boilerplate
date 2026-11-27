import { createTranslator } from "next-intl";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAppUrl } from "@repo/app-urls";
import { describeNotification } from "@/components/v2/notifications/notification-text";
import { notificationHref, type AppNotification } from "@/lib/notifications/types";
import type { PushPayload } from "@/lib/push/types";

/**
 * Web Push: the database decides what is due (`push_claim`: still unread,
 * the user's push settings, quiet hours, Ambra not open on a screen) and
 * takes it off the queue; this module writes the text in the recipient's
 * language, sends it to each of their devices and reports dead devices back
 * (`push_report`).
 */

type Locale = "pl" | "en";
type Translator = Parameters<typeof describeNotification>[1];
type Text = (key: string, values?: Record<string, string | number>) => string;

interface Person {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

export interface ClaimedChatMessage {
  id: string;
  conversation_id: string;
  conversation_kind: "direct" | "group";
  conversation_name: string | null;
  body_plain: string;
  attachment_count: number;
  gif: boolean;
  created_at: string;
  author: Person | null;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export type ClaimedPush = {
  queue_id: number;
  organization_id: string;
  organization_name: string | null;
  recipient: { user_id: string; locale: string | null };
  badge: number;
  subscriptions: PushSubscriptionRow[];
} & ({ kind: "notification"; item: AppNotification } | { kind: "chat"; item: ClaimedChatMessage });

/** Outcome of one send to one device */
export type SendOutcome = "ok" | "gone" | "failed";
export type PushSender = (
  subscription: PushSubscriptionRow,
  payload: string
) => Promise<SendOutcome>;

export interface PushRunResult {
  claimed: number;
  sent: number;
  failed: number;
  removed: number;
}

async function loadMessages(locale: Locale) {
  return (await import(`../../../messages/${locale}.json`)).default as Record<string, unknown>;
}

async function translators(locale: Locale): Promise<{ t: Translator; tp: Text }> {
  const messages = await loadMessages(locale);
  const t = createTranslator({
    locale,
    messages,
    namespace: "notificationCenter",
  } as never) as unknown as Translator;
  const tp: Text = (key, values) => (t as unknown as Text)(`push.${key}`, values);
  return { t, tp };
}

function localeOf(value: string | null | undefined): Locale {
  return value === "en" ? "en" : "pl";
}

/** Dashboard path in the recipient's language; Polish is the unprefixed default */
function localized(path: string, locale: Locale): string {
  return `${locale === "pl" ? "" : `/${locale}`}${path}`;
}

function personName(person: Person | null | undefined, fallback: string): string {
  return (
    [person?.first_name, person?.last_name].filter(Boolean).join(" ").trim() ||
    person?.email ||
    fallback
  );
}

function clip(text: string, max = 180): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** The notification shown on the device */
export async function buildPushPayload(claimed: ClaimedPush): Promise<PushPayload> {
  const locale = localeOf(claimed.recipient.locale);
  const { t, tp } = await translators(locale);
  const actions = { open: tp("open"), markRead: tp("markRead") };

  if (claimed.kind === "chat") {
    const message = claimed.item;
    const author = personName(message.author, tp("someone"));
    const text =
      clip(message.body_plain) ||
      (message.gif
        ? tp("gif")
        : message.attachment_count > 0
          ? tp("attachments", { count: message.attachment_count })
          : "");
    const group = message.conversation_kind === "group";
    return {
      kind: "chat",
      title: group ? message.conversation_name || tp("group") : author,
      body: group ? `${author}: ${text}` : text,
      url: `${localized("/dashboard/messages", locale)}?c=${message.conversation_id}`,
      // One notification per conversation: a newer message replaces the older one
      tag: `chat:${message.conversation_id}`,
      badge: claimed.badge,
      organizationId: claimed.organization_id,
      ref: { conversationId: message.conversation_id, until: message.created_at },
      actions,
    };
  }

  const notification = claimed.item;
  const { actor, text, module } = describeNotification(notification, t);
  const path = notificationHref(notification);
  const subject = [notification.target_code, notification.title].filter(Boolean).join(" ");
  return {
    kind: "notification",
    title: `${actor} ${text}`,
    body:
      [subject, notification.snippet ? `„${clip(notification.snippet, 140)}”` : null]
        .filter(Boolean)
        .join("\n") || module,
    url: localized(path ?? "/dashboard/notifications", locale),
    tag: `notification:${notification.id}`,
    badge: claimed.badge,
    organizationId: claimed.organization_id,
    ref: { notificationId: notification.id },
    actions,
  };
}

/** One run of the queue: claim, send to every device of each recipient, report */
export async function runPushDispatch(
  supabase: SupabaseClient,
  send: PushSender,
  options: { limit?: number; rounds?: number } = {}
): Promise<PushRunResult> {
  const result: PushRunResult = { claimed: 0, sent: 0, failed: 0, removed: 0 };
  const limit = options.limit ?? 200;

  for (let round = 0; round < (options.rounds ?? 5); round += 1) {
    const { data, error } = await supabase.rpc("push_claim", { p_limit: limit });
    if (error) throw new Error(`push_claim: ${error.message}`);
    const claimed = (data ?? []) as ClaimedPush[];
    result.claimed += claimed.length;

    const ok = new Set<string>();
    const gone = new Set<string>();
    for (const item of claimed) {
      const payload = JSON.stringify(await buildPushPayload(item));
      const outcomes = await Promise.all(
        item.subscriptions.map(async (subscription) => {
          const outcome = await send(subscription, payload).catch((): SendOutcome => "failed");
          if (outcome === "ok") ok.add(subscription.endpoint);
          if (outcome === "gone") gone.add(subscription.endpoint);
          return outcome;
        })
      );
      result.sent += outcomes.filter((outcome) => outcome === "ok").length;
      result.failed += outcomes.filter((outcome) => outcome === "failed").length;
    }

    if (ok.size > 0 || gone.size > 0) {
      const report = await supabase.rpc("push_report", {
        p_ok: [...ok],
        p_gone: [...gone],
      });
      if (report.error) console.error("[push] push_report", report.error.message);
      result.removed += gone.size;
    }
    // The queue can hold less than one batch: nothing more to take
    if (claimed.length === 0) break;
  }
  return result;
}

/** VAPID keys (public key also in the browser): push works only with both set */
export function vapidConfig(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    publicKey,
    privateKey,
    // The push services want a way to reach the sender: a mailto: or the site
    subject: process.env.VAPID_SUBJECT || getAppUrl("erp"),
  };
}
