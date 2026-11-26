"use client";

import { useCallback, useMemo, useRef, useState, useTransition } from "react";
import { Activity, FileText, Paperclip, Pencil, RotateCw, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  CommentEditor,
  helpdeskTicketTypingTopic,
  TypingIndicator,
  useTypingIndicator,
} from "@repo/rich-text/comments";
import { RichTextRenderer } from "@repo/rich-text/rich-text-renderer";
import {
  createEmptyRichText,
  extractPlainText,
  isRichTextEmpty,
  normalizeRichText,
  type RichTextValue,
} from "@repo/rich-text";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { replyFinished, replyStarted, requestKeys, useRequestsScope } from "@/lib/requests-query";
import { threadApi } from "./thread-api";
import { formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/validation/requests";
import type { PersonRef, RequestAttachment, RequestComment } from "@/server/requests/types";
import { AttachmentList } from "./attachments";
import { Avatar } from "./avatar";
import { Composer } from "./composer";

export type ThreadEvent = { id: string; at: string; text: string; actor: PersonRef | null };

/** A reply shown before the server has it: sending, or failed with retry. */
type PendingReply = {
  key: string;
  rich: RichTextValue | null;
  files: File[];
  previews: { name: string; size: number; url: string | null; type: string }[];
  status: "sending" | "failed";
  error?: string;
};

function toFormData(p: PendingReply): FormData {
  const fd = new FormData();
  fd.set("body", p.rich ? extractPlainText(p.rich) : "");
  if (p.rich) fd.set("bodyRich", JSON.stringify(p.rich));
  p.files.forEach((f) => fd.append("files", f));
  return fd;
}

function revokePreviews(p: PendingReply) {
  for (const f of p.previews) if (f.url) URL.revokeObjectURL(f.url);
}

type Entry =
  | { kind: "comment"; at: string; comment: RequestComment }
  | { kind: "event"; at: string; event: ThreadEvent };

/**
 * Comments of one request with its status changes in between. Comments and files come
 * from the request's cache entry; a reply shows at once as "sending" and is replaced by
 * the saved one. Files sent with a reply are shown under it and can be removed or added
 * while editing. The reply box stays at the bottom of the screen (hidden while a comment
 * is being edited).
 */
export function Thread({
  ticketId,
  isOpen,
  viewer,
  comments,
  attachments,
  events,
  composerClassName,
}: {
  ticketId: string;
  isOpen: boolean;
  viewer: PersonRef;
  comments: RequestComment[];
  attachments: RequestAttachment[];
  events: ThreadEvent[];
  /** Background of the bar holding the reply box (the panel is a card). */
  composerClassName?: string;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const when = (iso: string) =>
    formatWhen(iso, locale, { today: t("today"), yesterday: t("yesterday") });

  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReply[]>([]);
  const qc = useQueryClient();
  const scope = useRequestsScope();

  const [supabase] = useState(createClient);
  const typingMe = useMemo(() => ({ id: viewer.id, name: viewer.name }), [viewer.id, viewer.name]);
  const { typing, notifyTyping, notifyStopped } = useTypingIndicator({
    client: supabase,
    topic: isOpen ? helpdeskTicketTypingTopic(ticketId) : null,
    me: typingMe,
  });

  // Comments and files come from the request's cache entry; a refetch updates them.
  const reload = useCallback(
    () => qc.refetchQueries({ queryKey: requestKeys.detail(scope, ticketId), exact: true }),
    [qc, scope, ticketId]
  );

  const deliver = useCallback(
    async (p: PendingReply) => {
      replyStarted(ticketId);
      const res = await threadApi.post(ticketId, toFormData(p));
      // The text may be saved even when a file failed, so reload in both cases.
      const textSaved = res.ok || res.error.startsWith("attachment");
      if (textSaved) await reload();
      replyFinished(ticketId);
      if (textSaved) void qc.invalidateQueries({ queryKey: requestKeys.lists(scope) });
      if (res.ok) {
        setPending((list) => list.filter((x) => x.key !== p.key));
        revokePreviews(p);
      } else {
        setPending((list) =>
          list.map((x) =>
            x.key === p.key
              ? { ...x, status: "failed", error: res.error, rich: textSaved ? null : x.rich }
              : x
          )
        );
      }
    },
    [ticketId, reload, qc, scope]
  );

  const send = (rich: RichTextValue | null, files: File[]) => {
    notifyStopped();
    const p: PendingReply = {
      key: crypto.randomUUID(),
      rich,
      files,
      previews: files.map((f) => ({
        name: f.name,
        size: f.size,
        type: f.type,
        url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
      })),
      status: "sending",
    };
    setPending((list) => [...list, p]);
    void deliver(p);
  };

  const retry = (p: PendingReply) => {
    const next = { ...p, status: "sending" as const, error: undefined };
    setPending((list) => list.map((x) => (x.key === p.key ? next : x)));
    void deliver(next);
  };

  const discard = (p: PendingReply) => {
    setPending((list) => list.filter((x) => x.key !== p.key));
    revokePreviews(p);
  };

  const entries = useMemo<Entry[]>(() => {
    const list: Entry[] = [];
    for (const c of comments) list.push({ kind: "comment", at: c.createdAt, comment: c });
    for (const e of events) list.push({ kind: "event", at: e.at, event: e });
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [comments, events]);

  const filesOf = (commentId: string) => attachments.filter((a) => a.commentId === commentId);

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-5 px-4 pb-4 pt-4 lg:px-6">
        {comments.length === 0 && pending.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("detail.noMessages")}</p>
        )}

        {entries.map((entry) => {
          if (entry.kind === "event") {
            return (
              <p
                key={`e-${entry.event.id}`}
                className="flex items-center gap-2.5 text-[13px] text-muted-foreground"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Activity className="h-3.5 w-3.5" />
                </span>
                <span>
                  {entry.event.text} · {when(entry.at)}
                </span>
              </p>
            );
          }
          const c = entry.comment;
          const edited = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000;
          const own = filesOf(c.id);
          const editing = editingId === c.id;
          return (
            <Message
              key={c.id}
              author={c.author}
              mine={c.isMine}
              youLabel={t("you")}
              meta={
                <>
                  {when(c.createdAt)}
                  {edited && <span title={when(c.updatedAt)}> · {t("thread.edited")}</span>}
                </>
              }
              action={
                c.isMine && isOpen && !editingId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingId(c.id)}
                    className="h-7 gap-1 px-2 text-xs text-muted-foreground"
                  >
                    <Pencil className="h-3 w-3" />
                    {t("thread.edit")}
                  </Button>
                ) : null
              }
              files={editing ? null : <AttachmentList items={own} />}
            >
              {editing ? (
                <EditComment
                  ticketId={ticketId}
                  comment={c}
                  files={own}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    setEditingId(null);
                    reload();
                  }}
                />
              ) : (
                <RichTextRenderer value={normalizeRichText(c.bodyRich)} emptyText={c.bodyPlain} />
              )}
            </Message>
          );
        })}

        {pending.map((p) => (
          <PendingMessage
            key={p.key}
            reply={p}
            viewer={viewer}
            onRetry={() => retry(p)}
            onDiscard={() => discard(p)}
          />
        ))}

        <TypingIndicator people={typing} className="pl-[42px] text-muted-foreground" />
      </div>

      {!editingId && (
        <div
          className={cn(
            "sticky bottom-0 z-10 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-6",
            composerClassName
          )}
        >
          {isOpen ? (
            <Composer
              onSend={send}
              onDraftChange={(v) => (isRichTextEmpty(v) ? notifyStopped() : notifyTyping())}
            />
          ) : (
            <p className="rounded-md border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              {t("detail.closedNote")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Own reply before the server confirmed it: same look as a sent one, slightly faded. */
function PendingMessage({
  reply,
  viewer,
  onRetry,
  onDiscard,
}: {
  reply: PendingReply;
  viewer: PersonRef;
  onRetry: () => void;
  onDiscard: () => void;
}) {
  const t = useTranslations("requests");
  const failed = reply.status === "failed";
  const errorKey = reply.error?.split(":")[0];
  const images = reply.previews.filter((f) => f.url);
  const others = reply.previews.filter((f) => !f.url);
  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
      <Message
        author={viewer}
        mine
        youLabel={t("you")}
        tone={failed ? "failed" : "sending"}
        bare={!reply.rich}
        meta={
          failed ? (
            <span className="text-destructive">{t("thread.notSent")}</span>
          ) : (
            <span className="animate-pulse">{t("thread.sending")}</span>
          )
        }
        files={
          reply.previews.length > 0 && (
            <div className={cn("mt-1 flex flex-wrap gap-2", !failed && "opacity-60")}>
              {images.map((f, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={i}
                  src={f.url!}
                  alt={f.name}
                  className="h-24 w-24 rounded-md border object-cover"
                />
              ))}
              {others.map((f, i) => (
                <span
                  key={i}
                  className="flex w-fit items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 text-[13px]"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="max-w-[14rem] truncate font-medium">{f.name}</span>
                </span>
              ))}
            </div>
          )
        }
        footer={
          failed && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-destructive">
                {errorKey && t.has(`composer.errors.${errorKey}`)
                  ? t(`composer.errors.${errorKey}`)
                  : t("composer.errors.generic")}
              </span>
              {reply.rich && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                >
                  <RotateCw className="h-3 w-3" />
                  {t("thread.retry")}
                </button>
              )}
              <button
                type="button"
                onClick={onDiscard}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("thread.discard")}
              </button>
            </div>
          )
        }
      >
        {reply.rich && <RichTextRenderer value={reply.rich} />}
      </Message>
    </div>
  );
}

function Message({
  author,
  mine,
  meta,
  youLabel,
  action,
  files,
  footer,
  tone,
  bare,
  children,
}: {
  author: PersonRef | null;
  mine: boolean;
  meta: React.ReactNode;
  youLabel: string;
  action?: React.ReactNode;
  files?: React.ReactNode;
  footer?: React.ReactNode;
  tone?: "sending" | "failed";
  /** No text bubble (a files-only reply). */
  bare?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <Avatar person={author} size={30} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex min-h-7 items-center gap-2 text-[13px]">
          <span className="min-w-0 truncate">
            <b className="font-semibold">{mine ? youLabel : author?.name}</b>{" "}
            <span className="text-muted-foreground">{meta}</span>
          </span>
          {action && <span className="ml-auto shrink-0">{action}</span>}
        </div>
        {!bare && (
          <div
            className={cn(
              "rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed transition-opacity",
              mine ? "border-primary/25 bg-primary/10" : "bg-card",
              tone === "sending" && "opacity-60",
              tone === "failed" && "border-destructive/40"
            )}
          >
            {children}
          </div>
        )}
        {files}
        {footer}
      </div>
    </div>
  );
}

function EditComment({
  ticketId,
  comment,
  files,
  onCancel,
  onSaved,
}: {
  ticketId: string;
  comment: RequestComment;
  files: RequestAttachment[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("requests.thread");
  const [value, setValue] = useState<RichTextValue>(
    () => normalizeRichText(comment.bodyRich) ?? createEmptyRichText()
  );
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [added, setAdded] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const save = (v: RichTextValue) =>
    startSaving(async () => {
      setError(null);
      const fd = new FormData();
      fd.set("bodyRich", JSON.stringify(v));
      if (removed.size) fd.set("removeIds", JSON.stringify([...removed]));
      added.forEach((f) => fd.append("files", f));
      const res = await threadApi.edit(ticketId, comment.id, fd);
      if (res.ok) onSaved();
      else setError(t("saveFailed"));
    });

  return (
    <div className="flex flex-col gap-2">
      <CommentEditor
        value={value}
        onChange={setValue}
        onSubmit={save}
        onCancel={onCancel}
        submitLabel={t("save")}
        submittingLabel={t("saving")}
        submitting={saving}
        maxLength={LIMITS.bodyMax}
        density="compact"
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Paperclip className="h-4 w-4" />
            {t("addFile")}
          </Button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          setAdded((all) => [...all, ...picked].slice(0, LIMITS.maxFiles));
          e.target.value = "";
        }}
      />
      <AttachmentList
        items={files}
        removed={removed}
        onToggle={(id) =>
          setRemoved((s) => {
            const next = new Set(s);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          })
        }
      />
      {added.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {added.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex h-7 items-center gap-1 rounded-md border border-primary/30 bg-primary/10 pl-2 pr-1 text-xs"
            >
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: f.name })}
                onClick={() => setAdded((all) => all.filter((_, j) => j !== i))}
                className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-primary/15"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
