import { createTranslator } from "next-intl";
import { render } from "@react-email/render";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  NotificationsDigestEmail,
  type NotificationEmailItem,
} from "@/components/emails/notifications-digest";
import { describeNotification } from "@/components/v2/notifications/notification-text";
import { notificationHref, type AppNotification } from "@/lib/notifications/types";
import type { EmailServiceResult, SendEmailOptions } from "@/server/services/email.service";

/**
 * E-mail for notifications that are still unread ten minutes after they were
 * created. The database decides what is due (`notifications_email_claim`:
 * unread, the user's e-mail settings, quiet hours); this module groups the
 * claimed rows per person and organization, sends one message each and
 * reports the result back (`notifications_email_done`).
 */

export interface ClaimedNotification extends AppNotification {
  organization_name: string | null;
  recipient: {
    user_id: string;
    email: string;
    first_name: string | null;
    locale: string | null;
  } | null;
}

type Locale = "pl" | "en";
type Sender = (options: SendEmailOptions) => Promise<EmailServiceResult>;
type Translator = Parameters<typeof describeNotification>[1];

export interface NotificationEmailRunResult {
  claimed: number;
  messages: number;
  sent: number;
  failed: number;
}

const MAX_ITEMS_PER_MESSAGE = 10;

async function loadMessages(locale: Locale) {
  return (await import(`../../../messages/${locale}.json`)).default as Record<string, unknown>;
}

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://ambra-system.com").replace(/\/+$/, "");
}

/** Absolute link to a dashboard path; Polish is the unprefixed default locale */
function absoluteUrl(path: string, locale: Locale): string {
  return `${siteUrl()}${locale === "pl" ? "" : `/${locale}`}${path}`;
}

type EmailText = (key: string, values?: Record<string, string | number>) => string;

async function translators(locale: Locale): Promise<{ t: Translator; te: EmailText }> {
  const messages = await loadMessages(locale);
  const t = createTranslator({
    locale,
    messages,
    namespace: "notificationCenter",
  } as never) as unknown as Translator;
  const te: EmailText = (key, values) => (t as unknown as EmailText)(`email.${key}`, values);
  return { t, te };
}

/** HTML and text of one digest message from its ready rows */
async function renderDigest(options: {
  te: EmailText;
  locale: Locale;
  items: NotificationEmailItem[];
  firstName: string | null;
  organization: string;
  heading: string;
  intro: string;
  allLabel: string;
  allHref: string;
}): Promise<{ html: string; text: string }> {
  const { te, locale, items, heading, intro, allLabel, allHref, organization } = options;
  const settingsHref = absoluteUrl("/dashboard/account/notifications", locale);
  const greeting = te("greeting", { name: options.firstName || "" }).replace(" ,", ",");
  const html = await render(
    NotificationsDigestEmail({
      preview: te("preview", { organization }),
      heading,
      greeting,
      intro,
      items,
      openLabel: te("open"),
      openAllLabel: allLabel,
      allHref,
      settingsText: te("settings"),
      settingsHref,
      footer: te("footer"),
      siteUrl: siteUrl(),
    })
  );
  const text = [
    `${greeting} ${intro}`,
    "",
    ...items.flatMap((item) => [
      `• ${item.sentence}`,
      ...([item.code, item.title].some(Boolean)
        ? [`  ${[item.code, item.title].filter(Boolean).join(" ")}`]
        : []),
      ...(item.snippet ? [`  „${item.snippet}”`] : []),
      ...(item.href ? [`  ${item.href}`] : []),
      "",
    ]),
    `${allLabel}: ${allHref}`,
    "",
    `${te("settings")} ${settingsHref}`,
  ].join("\n");
  return { html, text };
}

/** Subject, HTML and text of one message (one person, one organization) */
export async function buildNotificationEmail(
  notifications: ClaimedNotification[],
  locale: Locale
): Promise<{ subject: string; html: string; text: string }> {
  const { t, te } = await translators(locale);

  const first = notifications[0];
  const organization = first.organization_name ?? "Ambra";
  const shown = notifications.slice(0, MAX_ITEMS_PER_MESSAGE);
  const items: NotificationEmailItem[] = shown.map((notification) => {
    const { actor, text, module } = describeNotification(notification, t);
    const path = notificationHref(notification);
    return {
      sentence: `${actor} ${text}`,
      code: notification.target_code,
      title:
        notification.title ||
        (notification.target_type === "chat.conversation" ? t("directConversation") : ""),
      snippet: notification.snippet,
      module,
      href: path ? absoluteUrl(path, locale) : null,
    };
  });

  const subject =
    notifications.length === 1
      ? items[0].sentence
      : te("subjectMany", { count: notifications.length });
  const body = await renderDigest({
    te,
    locale,
    items,
    firstName: first.recipient?.first_name ?? null,
    organization,
    heading: te("heading"),
    intro: te("intro", { organization }),
    allLabel: te("openAll"),
    allHref: absoluteUrl("/dashboard/notifications", locale),
  });
  return { subject, ...body };
}

/** A conversation with unread messages, claimed by `chat_email_claim` */
export interface ClaimedChat {
  conversation_id: string;
  organization_id: string;
  organization_name: string | null;
  kind: "direct" | "group";
  name: string | null;
  unread_count: number;
  last_message: {
    body_plain: string;
    attachment_count: number;
    created_at: string;
    author: {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
    } | null;
  } | null;
  recipient: ClaimedNotification["recipient"];
}

/** Subject, HTML and text of the "unread messages" e-mail of one person in one organization */
export async function buildChatEmail(
  chats: ClaimedChat[],
  locale: Locale
): Promise<{ subject: string; html: string; text: string }> {
  const { te } = await translators(locale);
  const first = chats[0];
  const organization = first.organization_name ?? "Ambra";
  const total = chats.reduce((sum, chat) => sum + chat.unread_count, 0);
  const items: NotificationEmailItem[] = chats.slice(0, MAX_ITEMS_PER_MESSAGE).map((chat) => {
    const author = chat.last_message?.author;
    const authorName =
      [author?.first_name, author?.last_name].filter(Boolean).join(" ").trim() ||
      author?.email ||
      te("chatSomeone");
    return {
      sentence:
        chat.kind === "group"
          ? te("chatGroup", { count: chat.unread_count, name: chat.name ?? "" })
          : te("chatDirect", { count: chat.unread_count, name: authorName }),
      code: null,
      title: "",
      snippet: chat.last_message
        ? `${chat.kind === "group" ? `${authorName}: ` : ""}${
            chat.last_message.body_plain ||
            te("chatAttachments", { count: chat.last_message.attachment_count })
          }`
        : null,
      module: te("chatModule"),
      href: `${absoluteUrl("/dashboard/messages", locale)}?c=${chat.conversation_id}`,
    };
  });
  const body = await renderDigest({
    te,
    locale,
    items,
    firstName: first.recipient?.first_name ?? null,
    organization,
    heading: te("chatHeading"),
    intro: te("chatIntro", { organization }),
    allLabel: te("chatOpenAll"),
    allHref: absoluteUrl("/dashboard/messages", locale),
  });
  return { subject: te("chatSubject", { count: total }), ...body };
}

/** One run of the queue: claim, send one message per person and organization, report */
export async function runNotificationEmails(
  supabase: SupabaseClient,
  send: Sender,
  limit = 200
): Promise<NotificationEmailRunResult> {
  const { data, error } = await supabase.rpc("notifications_email_claim", { p_limit: limit });
  if (error) throw new Error(`notifications_email_claim: ${error.message}`);
  const claimed = ((data ?? []) as ClaimedNotification[]).filter(
    (notification) => notification.recipient?.email
  );

  const groups = new Map<string, ClaimedNotification[]>();
  for (const notification of claimed) {
    const key = `${notification.recipient!.user_id}:${notification.organization_id}`;
    groups.set(key, [...(groups.get(key) ?? []), notification]);
  }

  const result: NotificationEmailRunResult = {
    claimed: claimed.length,
    messages: groups.size,
    sent: 0,
    failed: 0,
  };

  for (const notifications of groups.values()) {
    const recipient = notifications[0].recipient!;
    const ids = notifications.map((notification) => notification.id);
    let sent = false;
    try {
      const locale: Locale = recipient.locale === "en" ? "en" : "pl";
      const message = await buildNotificationEmail(notifications, locale);
      sent = (await send({ to: recipient.email, ...message })).success;
    } catch (cause) {
      console.error("[notification-emails] send failed", cause);
    }
    // A failed message is freed and tried again on the next run
    const done = await supabase.rpc("notifications_email_done", { p_ids: ids, p_sent: sent });
    if (done.error) console.error("[notification-emails] report failed", done.error);
    if (sent) result.sent += 1;
    else result.failed += 1;
  }
  return result;
}

/** One run of the chat queue: one "unread messages" e-mail per person and organization */
export async function runChatEmails(
  supabase: SupabaseClient,
  send: Sender,
  limit = 200
): Promise<NotificationEmailRunResult> {
  const { data, error } = await supabase.rpc("chat_email_claim", { p_limit: limit });
  if (error) throw new Error(`chat_email_claim: ${error.message}`);
  const claimed = ((data ?? []) as ClaimedChat[]).filter((chat) => chat.recipient?.email);

  const groups = new Map<string, ClaimedChat[]>();
  for (const chat of claimed) {
    const key = `${chat.recipient!.user_id}:${chat.organization_id}`;
    groups.set(key, [...(groups.get(key) ?? []), chat]);
  }

  const result: NotificationEmailRunResult = {
    claimed: claimed.length,
    messages: groups.size,
    sent: 0,
    failed: 0,
  };

  for (const chats of groups.values()) {
    const recipient = chats[0].recipient!;
    let sent = false;
    try {
      const locale: Locale = recipient.locale === "en" ? "en" : "pl";
      const message = await buildChatEmail(chats, locale);
      sent = (await send({ to: recipient.email, ...message })).success;
    } catch (cause) {
      console.error("[chat-emails] send failed", cause);
    }
    if (sent) {
      result.sent += 1;
      continue;
    }
    result.failed += 1;
    // Freed for the next run
    const released = await supabase.rpc("chat_email_release", {
      p_user: recipient.user_id,
      p_conversation_ids: chats.map((chat) => chat.conversation_id),
    });
    if (released.error) console.error("[chat-emails] release failed", released.error);
  }
  return result;
}
