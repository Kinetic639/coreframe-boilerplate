"use client";

import { useState, useTransition } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ExternalLink, FileText, Loader2, Lock, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CommentRenderer } from "@/components/primitives/comments";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import {
  createEmptyRichText,
  extractPlainText,
  normalizeRichText,
} from "@repo/rich-text/rich-text-utils";
import { cn } from "@/lib/utils";
import {
  addFeedbackMessageAction,
  getFeedbackAction,
  registerFeedbackFilesAction,
  updateFeedbackAction,
} from "@/app/actions/platform-feedback";
import {
  FEEDBACK_PRIORITIES,
  FEEDBACK_STATUSES,
  type FeedbackAttachment,
  type FeedbackDetail,
  type FeedbackPerson,
  type FeedbackPriority,
  type FeedbackStatus,
} from "@/lib/platform-feedback/types";
import { uploadFeedbackFiles } from "@/lib/platform-feedback/upload";
import { FeedbackKindBadge, FeedbackPriorityBadge, FeedbackStatusBadge } from "./feedback-badges";
import { FeedbackFilePicker, formatFileSize } from "./feedback-file-picker";

export const feedbackDetailKey = (id: string) => ["platform-feedback", "detail", id] as const;

function personName(person: FeedbackPerson | null, fallback: string): string {
  return person?.name || person?.email || fallback;
}

function Attachments({ items }: { items: FeedbackAttachment[] }) {
  if (items.length === 0) return null;
  const images = items.filter((a) => a.content_type.startsWith("image/") && a.url);
  const others = items.filter((a) => !(a.content_type.startsWith("image/") && a.url));
  return (
    <div className="space-y-2" data-testid="feedback-attachments">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {images.map((a) => (
            <a
              key={a.id}
              href={a.url ?? undefined}
              target="_blank"
              rel="noreferrer"
              title={a.file_name}
              className="block overflow-hidden rounded-md border hover:opacity-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- signed storage URL */}
              <img
                src={a.url ?? ""}
                alt={a.file_name}
                className="h-28 w-auto max-w-[220px] object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {others.length > 0 && (
        <ul className="space-y-1">
          {others.map((a) => (
            <li key={a.id}>
              <a
                href={a.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="hover:bg-muted inline-flex max-w-full items-center gap-2 rounded-md border px-2 py-1 text-sm"
              >
                <FileText className="text-muted-foreground h-4 w-4 shrink-0" />
                <span className="truncate">{a.file_name}</span>
                <span className="text-muted-foreground shrink-0 text-xs">
                  {formatFileSize(a.size_bytes)}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One report: what was reported, files, the thread and a reply box. The
 * platform admin also sees where it happened, internal notes, and sets
 * status and priority.
 */
export function FeedbackDetailPanel({
  initial,
  isAdmin,
  onChanged,
}: {
  initial: FeedbackDetail;
  isAdmin: boolean;
  onChanged?: () => void;
}) {
  const t = useTranslations("platformFeedback.detail");
  const tStatus = useTranslations("platformFeedback.status");
  const tPriority = useTranslations("platformFeedback.priority");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<RichTextValue>(createEmptyRichText);
  const [files, setFiles] = useState<File[]>([]);
  const [internal, setInternal] = useState(false);
  const [isSending, startSending] = useTransition();
  const [isUpdating, startUpdating] = useTransition();

  const { data } = useQuery({
    queryKey: feedbackDetailKey(initial.id),
    queryFn: async () => {
      const result = await getFeedbackAction(initial.id);
      if (!result.success) throw new Error((result as { error: string }).error);
      return (result as { data: FeedbackDetail | null }).data ?? initial;
    },
    initialData: initial,
    staleTime: 15_000,
  });
  const detail = data ?? initial;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: feedbackDetailKey(initial.id) });
    onChanged?.();
  };

  const date = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  const send = () =>
    startSending(async () => {
      const bodyPlain = extractPlainText(draft).trim();
      let messageId: string | null = null;
      if (bodyPlain.length > 0) {
        const added = await addFeedbackMessageAction({
          feedbackId: detail.id,
          bodyPlain,
          bodyRich: draft,
          isInternal: isAdmin && internal,
        });
        if (!added.success) {
          toast.error(t("sendFailed"));
          return;
        }
        messageId = (added as { data: { id: string } }).data.id;
      }
      if (files.length > 0) {
        const uploaded = await uploadFeedbackFiles(detail.id, files);
        const registered =
          uploaded.uploaded.length > 0
            ? await registerFeedbackFilesAction({
                feedbackId: detail.id,
                messageId,
                files: uploaded.uploaded,
              })
            : null;
        const rejected = [
          ...uploaded.rejected,
          ...(registered && registered.success
            ? (registered as { data: { rejected: string[] } }).data.rejected
            : registered
              ? uploaded.uploaded.map((f) => f.name)
              : []),
        ];
        if (rejected.length > 0) toast.warning(t("filesFailed", { files: rejected.join(", ") }));
      }
      setDraft(createEmptyRichText());
      setFiles([]);
      setInternal(false);
      await refresh();
    });

  const update = (patch: { status?: FeedbackStatus; priority?: FeedbackPriority }) =>
    startUpdating(async () => {
      const result = await updateFeedbackAction({ feedbackId: detail.id, ...patch });
      if (!result.success) {
        toast.error(t("updateFailed"));
        return;
      }
      await refresh();
    });

  const reportFiles = detail.attachments.filter((a) => !a.message_id);
  const canSend = extractPlainText(draft).trim().length > 0 || files.length > 0;
  const context = detail.context ?? {};

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="feedback-detail">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground font-mono text-xs">{detail.code}</span>
          <FeedbackKindBadge kind={detail.kind} />
          <FeedbackStatusBadge status={detail.status} />
          <FeedbackPriorityBadge priority={detail.priority} />
        </div>
        <h2 className="text-lg font-semibold leading-tight">{detail.title}</h2>
        <p className="text-muted-foreground text-xs">
          {isAdmin
            ? t("reportedBy", {
                name: personName(detail.reporter, t("formerUser")),
                date: date(detail.created_at),
              })
            : t("reportedAt", { date: date(detail.created_at) })}
          {isAdmin && detail.organization_name && (
            <>
              {" · "}
              {detail.organization_name}
              {detail.branch_name ? ` / ${detail.branch_name}` : ""}
            </>
          )}
        </p>
      </div>

      {isAdmin && (
        <div className="grid grid-cols-2 gap-3" data-testid="feedback-admin-controls">
          <div className="space-y-1">
            <Label className="text-xs">{t("statusLabel")}</Label>
            <Select
              value={detail.status}
              disabled={isUpdating}
              onValueChange={(value) => update({ status: value as FeedbackStatus })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {tStatus(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t("priorityLabel")}</Label>
            <Select
              value={detail.priority}
              disabled={isUpdating}
              onValueChange={(value) => update({ priority: value as FeedbackPriority })}
            >
              <SelectTrigger className="h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FEEDBACK_PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {tPriority(p)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <div className="rounded-lg border p-3">
        <RichTextRenderer
          value={normalizeRichText(detail.body_rich)}
          emptyText={t("noDescription")}
        />
        {reportFiles.length > 0 && (
          <div className="mt-3">
            <Attachments items={reportFiles} />
          </div>
        )}
      </div>

      {isAdmin && (context.url || context.userAgent) && (
        <dl
          className="bg-muted/40 grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 rounded-lg p-3 text-xs"
          data-testid="feedback-context"
        >
          {context.url && (
            <>
              <dt className="text-muted-foreground">{t("context.page")}</dt>
              <dd className="min-w-0">
                <a
                  href={context.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex max-w-full items-center gap-1 truncate hover:underline"
                >
                  <span className="truncate">{context.path ?? context.url}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </dd>
            </>
          )}
          {context.userAgent && (
            <>
              <dt className="text-muted-foreground">{t("context.browser")}</dt>
              <dd className="break-words">{context.userAgent}</dd>
            </>
          )}
          {context.viewport && (
            <>
              <dt className="text-muted-foreground">{t("context.screen")}</dt>
              <dd>{context.viewport}</dd>
            </>
          )}
          {(context.appVersion || context.environment) && (
            <>
              <dt className="text-muted-foreground">{t("context.version")}</dt>
              <dd className="font-mono">
                {[context.appVersion, context.environment].filter(Boolean).join(" · ")}
              </dd>
            </>
          )}
        </dl>
      )}

      <Separator />

      <div className="space-y-3" data-testid="feedback-thread">
        <h3 className="text-sm font-semibold">{t("thread", { count: detail.messages.length })}</h3>
        {detail.messages.length === 0 && (
          <p className="text-muted-foreground text-sm">{t("noMessages")}</p>
        )}
        {detail.messages.map((message) => {
          const files = detail.attachments.filter((a) => a.message_id === message.id);
          return (
            <div
              key={message.id}
              className={cn(
                message.is_internal &&
                  "rounded-lg bg-amber-50 p-2 ring-1 ring-amber-200 dark:bg-amber-950/30 dark:ring-amber-900"
              )}
            >
              <CommentRenderer
                value={normalizeRichText(message.body_rich) ?? undefined}
                author={{
                  name: message.author?.is_admin
                    ? `${personName(message.author, t("formerUser"))} · ${t("ambraTeam")}`
                    : personName(message.author, t("formerUser")),
                  email: message.author?.email ?? null,
                }}
                createdAt={
                  <span className="inline-flex items-center gap-2">
                    {date(message.created_at)}
                    {message.is_internal && (
                      <span className="inline-flex items-center gap-1 rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                        <Lock className="h-2.5 w-2.5" />
                        {t("internalBadge")}
                      </span>
                    )}
                  </span>
                }
              />
              {files.length > 0 && (
                <div className="mt-2 pl-10">
                  <Attachments items={files} />
                </div>
              )}
            </div>
          );
        })}
        {/* Files sent without text belong to the report; shown above with it. */}
      </div>

      <div className="space-y-2 rounded-lg border p-3" data-testid="feedback-reply">
        <RichTextEditorField
          value={draft}
          onChange={setDraft}
          disabled={isSending}
          placeholder={isAdmin && internal ? t("internalPlaceholder") : t("replyPlaceholder")}
          contentClassName="min-h-[80px]"
        />
        <FeedbackFilePicker files={files} onChange={setFiles} disabled={isSending} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isAdmin ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={internal} onCheckedChange={setInternal} disabled={isSending} />
              <Lock className="h-3.5 w-3.5 text-amber-600" />
              {t("internalToggle")}
            </label>
          ) : (
            <span />
          )}
          <Button
            size="sm"
            disabled={isSending || !canSend}
            onClick={send}
            data-testid="feedback-send"
          >
            {isSending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-1.5 h-4 w-4" />
            )}
            {isAdmin && internal ? t("sendInternal") : t("send")}
          </Button>
        </div>
      </div>
    </div>
  );
}
