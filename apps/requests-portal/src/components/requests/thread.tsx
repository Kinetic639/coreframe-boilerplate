"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { FileText, Paperclip, Pencil, RotateCw, Undo2, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { CommentEditor } from "@repo/rich-text/comments";
import { RichTextRenderer } from "@repo/rich-text/rich-text-renderer";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
  type RichTextValue,
} from "@repo/rich-text";
import { threadApi } from "./thread-api";
import { formatBytes, formatWhen } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/validation/requests";
import type { PersonRef, RequestAttachment, RequestComment } from "@/server/requests/types";
import { Avatar } from "./avatar";
import { Composer } from "./composer";

/** Fired by RealtimeRefresh when a comment/attachment of `ticketId` changes. */
export const THREAD_CHANGED_EVENT = "portal:thread-changed";

export type ThreadEvent = { id: string; at: string; text: string };

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
  | { kind: "description"; at: string }
  | { kind: "comment"; at: string; comment: RequestComment }
  | { kind: "event"; at: string; event: ThreadEvent };

/**
 * Conversation of one request, kept in client state: a reply or an edit updates only the
 * thread instead of re-rendering the page. Files sent with a reply are shown under it and
 * can be removed or added while editing. The reply box sits at the end and is hidden
 * while a comment is being edited.
 */
export function Thread({
  ticketId,
  isOpen,
  requesterId,
  viewer,
  description,
  initialComments,
  initialAttachments,
  events,
}: {
  ticketId: string;
  isOpen: boolean;
  requesterId: string | null;
  viewer: PersonRef;
  description: {
    at: string;
    author: PersonRef | null;
    plain: string;
    rich: unknown | null;
    mine: boolean;
  } | null;
  initialComments: RequestComment[];
  initialAttachments: RequestAttachment[];
  events: ThreadEvent[];
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const when = (iso: string) =>
    formatWhen(iso, locale, { today: t("today"), yesterday: t("yesterday") });

  const [comments, setComments] = useState(initialComments);
  const [attachments, setAttachments] = useState(initialAttachments);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingReply[]>([]);
  const [, startTransition] = useTransition();
  // Replies in flight; realtime reloads wait for them so a reply is never shown twice.
  const inFlight = useRef(0);

  // A server re-render (status change etc.) brings fresh data for the same ticket.
  useEffect(() => setComments(initialComments), [initialComments]);
  useEffect(() => setAttachments(initialAttachments), [initialAttachments]);

  const reload = useCallback(() => {
    startTransition(async () => {
      const fresh = await threadApi.load(ticketId);
      if (!fresh) return;
      setComments(fresh.comments);
      setAttachments(fresh.attachments);
    });
  }, [ticketId]);

  useEffect(() => {
    const onChange = (e: Event) => {
      if (inFlight.current > 0) return;
      if ((e as CustomEvent<{ ticketId?: string }>).detail?.ticketId === ticketId) reload();
    };
    window.addEventListener(THREAD_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(THREAD_CHANGED_EVENT, onChange);
  }, [ticketId, reload]);

  const deliver = useCallback(
    async (p: PendingReply) => {
      inFlight.current++;
      const res = await threadApi.post(ticketId, toFormData(p));
      // The text may be saved even when a file failed, so reload in both cases.
      const fresh =
        res.ok || res.error.startsWith("attachment") ? await threadApi.load(ticketId) : null;
      inFlight.current--;
      if (fresh) {
        setComments(fresh.comments);
        setAttachments(fresh.attachments);
      }
      if (res.ok) {
        setPending((list) => list.filter((x) => x.key !== p.key));
        revokePreviews(p);
      } else {
        const textSaved = !!fresh;
        setPending((list) =>
          list.map((x) =>
            x.key === p.key
              ? { ...x, status: "failed", error: res.error, rich: textSaved ? null : x.rich }
              : x
          )
        );
      }
    },
    [ticketId]
  );

  const send = (rich: RichTextValue | null, files: File[]) => {
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
    if (description) list.push({ kind: "description", at: description.at });
    for (const c of comments) list.push({ kind: "comment", at: c.createdAt, comment: c });
    for (const e of events) list.push({ kind: "event", at: e.at, event: e });
    return list.sort((a, b) => a.at.localeCompare(b.at));
  }, [description, comments, events]);

  const filesOf = (commentId: string | null) =>
    attachments.filter((a) => a.commentId === commentId);
  const requestFiles = filesOf(null);

  return (
    <div className="flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-4 lg:px-7">
      {entries.length === 0 && requestFiles.length === 0 && (
        <p className="py-6 text-sm text-stone-500">{t("detail.noMessages")}</p>
      )}

      {entries.map((entry) => {
        if (entry.kind === "event") {
          return (
            <p
              key={`e-${entry.event.id}`}
              className="flex items-center gap-2 pl-2 text-xs text-stone-500"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
              {entry.event.text} · {when(entry.at)}
            </p>
          );
        }
        if (entry.kind === "description" && description) {
          return (
            <Message
              key="description"
              author={description.author}
              mine={description.mine}
              staff={false}
              meta={when(description.at)}
              youLabel={t("you")}
              files={<AttachmentList items={requestFiles} />}
            >
              <RichTextRenderer
                value={normalizeRichText(description.rich)}
                emptyText={description.plain}
              />
            </Message>
          );
        }
        if (entry.kind !== "comment") return null;
        const c = entry.comment;
        const staff = !!c.author && c.author.id !== requesterId;
        const edited = new Date(c.updatedAt).getTime() - new Date(c.createdAt).getTime() > 1000;
        const own = filesOf(c.id);
        const editing = editingId === c.id;
        return (
          <Message
            key={c.id}
            author={c.author}
            mine={c.isMine}
            staff={staff}
            youLabel={t("you")}
            meta={
              <>
                {staff ? `${t("partsDept")} · ` : ""}
                {when(c.createdAt)}
                {edited && <span title={when(c.updatedAt)}> · {t("thread.edited")}</span>}
              </>
            }
            action={
              c.isMine && isOpen && !editingId ? (
                <button
                  type="button"
                  onClick={() => setEditingId(c.id)}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-stone-500 hover:bg-stone-100 hover:text-stone-800"
                >
                  <Pencil className="h-3 w-3" />
                  {t("thread.edit")}
                </button>
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

      {/* Files not tied to a comment and no description to hang them on */}
      {!description && requestFiles.length > 0 && (
        <div className="pl-[38px]">
          <AttachmentList items={requestFiles} />
        </div>
      )}

      {pending.map((p) => (
        <PendingMessage
          key={p.key}
          reply={p}
          viewer={viewer}
          onRetry={() => retry(p)}
          onDiscard={() => discard(p)}
        />
      ))}

      {!editingId && (
        <div className="pt-1">
          {isOpen ? (
            <Composer onSend={send} />
          ) : (
            <p className="rounded-xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">
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
        staff={false}
        youLabel={t("you")}
        tone={failed ? "failed" : "sending"}
        bare={!reply.rich}
        meta={
          failed ? (
            <span className="text-red-600">{t("thread.notSent")}</span>
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
                  className="h-24 w-24 rounded-lg object-cover ring-1 ring-stone-200"
                />
              ))}
              {others.map((f, i) => (
                <span
                  key={i}
                  className="flex w-fit items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] ring-1 ring-stone-200"
                >
                  <FileText className="h-4 w-4 text-stone-500" />
                  <span className="max-w-[14rem] truncate font-medium">{f.name}</span>
                </span>
              ))}
            </div>
          )
        }
        footer={
          failed && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="text-red-600">
                {errorKey && t.has(`composer.errors.${errorKey}`)
                  ? t(`composer.errors.${errorKey}`)
                  : t("composer.errors.generic")}
              </span>
              {reply.rich && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="inline-flex items-center gap-1 font-medium text-stone-800 hover:underline"
                >
                  <RotateCw className="h-3 w-3" />
                  {t("thread.retry")}
                </button>
              )}
              <button
                type="button"
                onClick={onDiscard}
                className="text-stone-500 hover:text-stone-800 hover:underline"
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
  staff,
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
  staff: boolean;
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
    <div className="flex gap-2.5">
      <Avatar person={author} size={28} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[12.5px]">
          <span>
            <b className="font-semibold">{mine ? youLabel : author?.name}</b>{" "}
            <span className="text-stone-500">· {meta}</span>
          </span>
          {action && <span className="ml-auto">{action}</span>}
        </div>
        {!bare && (
          <div
            className={cn(
              "rounded-[4px_14px_14px_14px] border px-3 py-2.5 text-sm leading-relaxed transition-opacity",
              staff ? "border-[#F6E3B4] bg-[#FFF8E6]" : "border-stone-200 bg-white",
              tone === "sending" && "opacity-60",
              tone === "failed" && "border-red-200"
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

/** Thumbnails for images, chips for other files; optional remove/undo while editing. */
function AttachmentList({
  items,
  removed,
  onToggle,
}: {
  items: RequestAttachment[];
  removed?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const t = useTranslations("requests.thread");
  const locale = useLocale();
  if (items.length === 0) return null;
  const images = items.filter((a) => a.contentType.startsWith("image/") && a.url);
  const others = items.filter((a) => !a.contentType.startsWith("image/") || !a.url);
  const toggle = (a: RequestAttachment) =>
    onToggle && (
      <button
        type="button"
        onClick={() => onToggle(a.id)}
        aria-label={
          removed?.has(a.id)
            ? t("restoreFile", { name: a.fileName })
            : t("removeFile", { name: a.fileName })
        }
        className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-stone-700 shadow ring-1 ring-stone-200 hover:text-stone-950"
      >
        {removed?.has(a.id) ? <Undo2 className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
      </button>
    );

  return (
    <div className="mt-1 flex flex-col gap-2">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <div key={a.id} className={cn("relative", removed?.has(a.id) && "opacity-40")}>
              <a
                href={a.url!}
                target="_blank"
                rel="noreferrer"
                className="block overflow-hidden rounded-lg ring-1 ring-stone-200"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url!} alt={a.fileName} className="h-24 w-24 object-cover" />
              </a>
              {toggle(a)}
            </div>
          ))}
        </div>
      )}
      {others.map((a) => (
        <div key={a.id} className={cn("relative w-fit pr-7", removed?.has(a.id) && "opacity-40")}>
          <a
            href={a.url ?? undefined}
            target="_blank"
            rel="noreferrer"
            className="flex w-fit items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] ring-1 ring-stone-200"
          >
            <FileText className="h-4 w-4 text-stone-500" />
            <span className="max-w-[14rem] truncate font-medium">{a.fileName}</span>
            <span className="text-stone-500">{formatBytes(a.sizeBytes, locale)}</span>
          </a>
          {toggle(a)}
        </div>
      ))}
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
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700"
          >
            <Paperclip className="h-4 w-4" />
            {t("addFile")}
          </button>
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
              className="flex h-7 items-center gap-1 rounded-md bg-amber-50 pl-2 pr-1 text-xs ring-1 ring-amber-200"
            >
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: f.name })}
                onClick={() => setAdded((all) => all.filter((_, j) => j !== i))}
                className="flex h-5 w-5 items-center justify-center rounded text-stone-500 hover:bg-amber-100"
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
