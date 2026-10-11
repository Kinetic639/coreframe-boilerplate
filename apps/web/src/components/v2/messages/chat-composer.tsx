"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Paperclip, Pencil, X } from "lucide-react";
import { toast } from "react-toastify";
import { CompactEditor, type CompactEditorHandle } from "@repo/rich-text/compact-editor";
import { extractPlainText, normalizeRichText } from "@repo/rich-text/rich-text-utils";
import { cn } from "@/lib/utils";
import { useUploadAttachmentsMutation } from "@/hooks/queries/attachments";
import { useConversation, useMessageChanges, useSendMessage } from "@/hooks/queries/messages";
import { isPlainDocument } from "@/lib/mentions";
import { ENTITY_MENTIONS } from "@/components/v2/mentions/mention-suggestion-list";
import { MentionScopeProvider } from "@/components/v2/mentions/mention-scope";
import type { PendingChatMessage } from "@/lib/messages/cache";
import { CHAT_MESSAGE_MAX_LENGTH, type ChatErrorCode } from "@/lib/messages/types";
import { useChat } from "./chat-provider";

const CHAT_TARGET = "chat.conversation";

export interface ChatComposerHandle {
  focus: () => void;
  /** Sends a failed message again (same client id: stored once) */
  retry: (message: PendingChatMessage) => void;
  /** Loads an own message into the box; sending then saves the change */
  edit: (message: PendingChatMessage) => void;
}

/**
 * Compact message box (one line growing to five): Enter sends, Shift+Enter
 * adds a line, "@" mentions people and objects (the Ctrl+K search), the clip
 * attaches files (uploaded to the conversation first, then sent with the
 * message). Typing pings go to the conversation's channel.
 */
export const ChatComposer = forwardRef<
  ChatComposerHandle,
  {
    conversationId: string;
    onTyping: () => void;
    onStopped: () => void;
    autoFocus?: boolean;
    size?: "compact" | "comfortable";
  }
>(function ChatComposer({ conversationId, onTyping, onStopped, autoFocus, size = "compact" }, ref) {
  const t = useTranslations("chat");
  const { meId, orgId } = useChat();
  const send = useSendMessage(meId);
  const { editMessage } = useMessageChanges(orgId);
  const [editingId, setEditingId] = useState<string | null>(null);
  const upload = useUploadAttachmentsMutation(CHAT_TARGET, conversationId);
  // Plain text of the draft: enables "Send" and drives the typing pings
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const editorRef = useRef<CompactEditorHandle>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // People of this conversation come first in the "@" list
  const members = useConversation(conversationId).data?.members;
  const mentionScope = useMemo(
    () => ({
      priorityUserIds: new Set(
        (members ?? []).filter((member) => !member.left_at).map((member) => member.user_id)
      ),
    }),
    [members]
  );

  const sendNow = async (
    bodyPlain: string,
    bodyRich: unknown | null,
    attachmentIds: string[],
    clientId: string
  ) => {
    try {
      await send.mutateAsync({ conversationId, bodyPlain, bodyRich, attachmentIds, clientId });
    } catch (error) {
      const code = (error instanceof Error ? error.message : "failed") as ChatErrorCode;
      toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.failed"));
    }
  };

  const submit = async () => {
    const value = editorRef.current?.getValue() ?? null;
    const body = extractPlainText(value);
    if ((!body && files.length === 0) || upload.isPending) return;
    // Text only: the plain body is enough; mentions and formatting travel as a document
    const bodyRich = body && value && !isPlainDocument(value) ? value : null;
    if (editingId) {
      if (!body || editMessage.isPending) return;
      try {
        await editMessage.mutateAsync({ messageId: editingId, bodyPlain: body, bodyRich });
        cancelEdit();
      } catch (error) {
        const code = (error instanceof Error ? error.message : "failed") as ChatErrorCode;
        // "invalid" here is the closed edit window (15 minutes)
        toast.error(
          code === "invalid"
            ? t("window.editClosed")
            : t.has(`errors.${code}`)
              ? t(`errors.${code}`)
              : t("errors.failed")
        );
      }
      return;
    }
    let attachmentIds: string[] = [];
    if (files.length > 0) {
      try {
        const uploaded = await upload.mutateAsync(files);
        attachmentIds = uploaded.map((attachment) => attachment.id);
      } catch {
        return; // the upload hook already showed the error; the draft stays
      }
    }
    editorRef.current?.clear();
    setDraft("");
    setFiles([]);
    onStopped();
    await sendNow(body, bodyRich, attachmentIds, crypto.randomUUID());
  };

  const cancelEdit = () => {
    setEditingId(null);
    editorRef.current?.clear();
    setDraft("");
    onStopped();
  };

  useImperativeHandle(ref, () => ({
    focus: () => editorRef.current?.focus(),
    edit: (message) => {
      setEditingId(message.id);
      setFiles([]);
      editorRef.current?.setValue(
        normalizeRichText(message.body_rich) ?? {
          type: "doc",
          content: [
            {
              type: "paragraph",
              // Lines of a plain message become line breaks of one paragraph
              content: message.body_plain
                .split("\n")
                .flatMap((line, index) => [
                  ...(index > 0 ? [{ type: "hardBreak" }] : []),
                  ...(line ? [{ type: "text", text: line }] : []),
                ]),
            },
          ],
        }
      );
    },
    retry: (message) =>
      void sendNow(
        message.body_plain,
        message.body_rich,
        message.attachment_ids,
        message.client_id ?? crypto.randomUUID()
      ),
  }));

  const comfortable = size === "comfortable";
  const busy = upload.isPending;

  return (
    <div className={cn("border-t border-t-primary/20", comfortable ? "p-3" : "p-1.5")}>
      {editingId ? (
        <div className="mb-1 flex items-center gap-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
          <Pencil className="size-3 shrink-0" />
          <span className="flex-1 truncate">{t("window.editing")}</span>
          <button
            type="button"
            aria-label={t("window.cancelEdit")}
            title={t("window.cancelEdit")}
            onClick={cancelEdit}
            className="hover:text-foreground"
          >
            <X className="size-3" />
          </button>
        </div>
      ) : null}
      {files.length > 0 ? (
        <div className="mb-1 flex flex-wrap gap-1">
          {files.map((file, index) => (
            <span
              key={`${file.name}-${index}`}
              className="flex max-w-full items-center gap-1 rounded border bg-muted/50 px-1.5 py-0.5 text-[11px]"
            >
              <span className="truncate">{file.name}</span>
              <button
                type="button"
                aria-label={t("window.close")}
                onClick={() => setFiles((all) => all.filter((_, i) => i !== index))}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex items-end gap-0.5 rounded-md border bg-background px-2 py-[3px] pr-[3px] focus-within:border-primary/50 focus-within:ring-1 focus-within:ring-primary/50">
        <MentionScopeProvider value={mentionScope}>
          <CompactEditor
            ref={editorRef}
            autoFocus={autoFocus}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            ariaLabel={t("window.placeholder")}
            placeholder={t("window.placeholder")}
            mention={ENTITY_MENTIONS}
            onSubmit={() => void submit()}
            onTextChange={(text) => {
              setDraft(text);
              if (text) onTyping();
              else onStopped();
            }}
            className={cn(
              "min-h-6 py-[3px] text-xs leading-[17px]",
              comfortable ? "max-h-[101px] text-[13px] leading-[19px]" : "max-h-[91px]"
            )}
          />
        </MentionScopeProvider>
        <input
          ref={fileRef}
          type="file"
          multiple
          hidden
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            setFiles((all) => [...all, ...picked].slice(0, 10));
            event.target.value = "";
          }}
        />
        <button
          type="button"
          hidden={!!editingId}
          aria-label={t("window.attach")}
          title={t("window.attach")}
          onClick={() => fileRef.current?.click()}
          className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Paperclip className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || (!draft.trim() && files.length === 0)}
          className="flex h-6 shrink-0 items-center gap-1 rounded bg-primary px-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-3 animate-spin" /> : null}
          {busy ? t("window.uploading") : editingId ? t("window.save") : t("window.send")}
        </button>
      </div>
      {comfortable ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{t("window.hint")}</p>
      ) : null}
    </div>
  );
});
