"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@repo/ui/utils";

/**
 * "Someone is typing" over a private Supabase Realtime Broadcast channel. Nothing is stored:
 * the sender pings at most every SEND_EVERY_MS while typing, receivers show the person for
 * SHOW_FOR_MS after the last ping (or until "stopped"). Join/send is authorized by RLS on
 * realtime.messages (see migration helpdesk_typing_channels).
 */

export type TypingPerson = { id: string; name: string };

const SEND_EVERY_MS = 2500;
const SHOW_FOR_MS = 5000;

/** Channel of one Help Desk ticket (topic format checked by can_use_helpdesk_ticket_topic). */
export function helpdeskTicketTypingTopic(ticketId: string): string {
  return `helpdesk-ticket:${ticketId}:typing`;
}

// The slice of supabase-js this hook uses; the client is passed in by the app.
type BroadcastMessage = { payload?: unknown };
type Channel = {
  topic: string;
  on(type: "broadcast", filter: { event: string }, cb: (msg: BroadcastMessage) => void): Channel;
  subscribe(cb?: (status: string) => void): unknown;
  send(msg: { type: "broadcast"; event: string; payload: unknown }): Promise<unknown>;
};
type RealtimeClient = {
  channel(
    topic: string,
    opts: { config: { private: boolean; broadcast: { self: boolean } } }
  ): Channel;
  removeChannel(channel: Channel): Promise<unknown>;
  getChannels(): Channel[];
  realtime: { setAuth(token?: string | null): Promise<void> };
};

export function useTypingIndicator({
  client,
  topic,
  me,
}: {
  /** Browser Supabase client of the app. */
  client: unknown;
  /** Channel topic, or null to stay off (closed ticket, no access). */
  topic: string | null;
  me: TypingPerson | null;
}) {
  const [typing, setTyping] = useState<Record<string, { person: TypingPerson; until: number }>>({});
  const channelRef = useRef<Channel | null>(null);
  const joinedRef = useRef(false);
  const lastSentRef = useRef(0);
  const meRef = useRef(me);
  useEffect(() => {
    meRef.current = me;
  }, [me]);

  useEffect(() => {
    if (!topic) return;
    const c = client as RealtimeClient;
    let cancelled = false;
    let channel: Channel | null = null;
    const forget = (id: string) =>
      setTyping((all) => {
        if (!(id in all)) return all;
        const next = { ...all };
        delete next[id];
        return next;
      });

    void (async () => {
      // Session to Realtime first, or the private join is rejected.
      await c.realtime.setAuth().catch(() => undefined);
      // supabase-js hands back an existing channel with the same topic; a remount must not
      // reuse the one still being removed.
      const stale = c.getChannels().find((ch) => ch.topic === `realtime:${topic}`);
      if (stale) await c.removeChannel(stale);
      if (cancelled) return;

      channel = c
        .channel(topic, { config: { private: true, broadcast: { self: false } } })
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          const p = payload as Partial<TypingPerson> | undefined;
          if (!p?.id || p.id === meRef.current?.id) return;
          const person = { id: p.id, name: String(p.name ?? "") };
          setTyping((all) => ({
            ...all,
            [person.id]: { person, until: Date.now() + SHOW_FOR_MS },
          }));
        })
        .on("broadcast", { event: "stopped" }, ({ payload }) => {
          const id = (payload as { id?: string } | undefined)?.id;
          if (id) forget(id);
        });
      channelRef.current = channel;
      channel.subscribe((status) => {
        joinedRef.current = status === "SUBSCRIBED";
      });
    })();

    return () => {
      cancelled = true;
      joinedRef.current = false;
      channelRef.current = null;
      lastSentRef.current = 0;
      setTyping({});
      if (channel) void c.removeChannel(channel);
    };
  }, [client, topic]);

  // Drop people whose last ping is too old (closed the tab mid-sentence etc.).
  const hasTyping = Object.keys(typing).length > 0;
  useEffect(() => {
    if (!hasTyping) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTyping((all) => {
        const alive = Object.entries(all).filter(([, v]) => v.until > now);
        return alive.length === Object.keys(all).length ? all : Object.fromEntries(alive);
      });
    }, 1000);
    return () => clearInterval(id);
  }, [hasTyping]);

  const send = useCallback((event: "typing" | "stopped") => {
    const channel = channelRef.current;
    const person = meRef.current;
    if (!channel || !joinedRef.current || !person) return;
    void channel.send({ type: "broadcast", event, payload: person }).catch(() => undefined);
  }, []);

  /** Call on every edit; pings at most every SEND_EVERY_MS. */
  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastSentRef.current < SEND_EVERY_MS) return;
    lastSentRef.current = now;
    send("typing");
  }, [send]);

  /** Call when the draft is sent or cleared. */
  const notifyStopped = useCallback(() => {
    if (!lastSentRef.current) return;
    lastSentRef.current = 0;
    send("stopped");
  }, [send]);

  return {
    typing: Object.values(typing).map((v) => v.person),
    notifyTyping,
    notifyStopped,
  };
}

/** "Jan pisze…" with three bouncing dots; renders nothing when nobody types. */
export function TypingIndicator({
  people,
  className,
}: {
  people: TypingPerson[];
  className?: string;
}) {
  const t = useTranslations("components.comments");
  if (people.length === 0) return null;
  return (
    <div
      aria-live="polite"
      className={cn("flex items-center gap-2 text-xs text-muted-foreground", className)}
    >
      <span className="flex items-center gap-[3px]" aria-hidden>
        {[0, 160, 320].map((delay) => (
          <span
            key={delay}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-current opacity-70"
            style={{ animationDelay: `${delay}ms`, animationDuration: "1s" }}
          />
        ))}
      </span>
      <span>
        {people.length === 1
          ? t("typing", { name: people[0]!.name })
          : t("typingMany", { count: people.length })}
      </span>
    </div>
  );
}
