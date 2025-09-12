"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { Message } from "@/lib/stores/chat-store";
import { useTranslations } from "next-intl";
import { getUserDisplayName } from "@/utils/user-helpers";

interface ChatEditorProps {
  onSend: (content: string, lexicalState?: unknown) => Promise<void>;
  onCancel?: () => void;
  placeholder?: string;
  replyToMessage?: Message;
  editingMessage?: Message;
  disabled?: boolean;
  className?: string;
}

export default function ChatEditor({
  onSend,
  onCancel,
  placeholder,
  replyToMessage,
  editingMessage,
  disabled = false,
  className,
}: ChatEditorProps) {
  const t = useTranslations("teams.communication");
  const tCommon = useTranslations("common");
  const [content, setContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Set initial content for editing
  useEffect(() => {
    if (editingMessage?.content) {
      setContent(editingMessage.content);
    }
  }, [editingMessage]);

  // Auto-focus textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSend = useCallback(async () => {
    if (!content.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSend(content.trim());

      // Clear the editor
      setContent("");
    } catch (error) {
      console.error("Failed to send message:", error);
      // Error handling is done in the parent component
    } finally {
      setIsSubmitting(false);
    }
  }, [content, onSend, isSubmitting]);

  const handleCancel = useCallback(() => {
    setContent("");
    onCancel?.();
  }, [onCancel]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const canSend = content.trim().length > 0 && !disabled && !isSubmitting;

  return (
    <div className={`rounded-lg border border-border bg-background ${className || ""}`}>
      {/* Reply/Edit Header */}
      {(replyToMessage || editingMessage) && (
        <div className="border-b border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              {replyToMessage && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">
                    {t("teams.communication.replyingTo")}{" "}
                    {getUserDisplayName(
                      replyToMessage.sender.first_name,
                      replyToMessage.sender.last_name
                    )}
                  </div>
                  <div className="truncate text-sm">{replyToMessage.content}</div>
                </div>
              )}

              {editingMessage && (
                <div>
                  <div className="mb-1 text-xs text-muted-foreground">{t("editingMessage")}</div>
                  <div className="truncate text-sm">{editingMessage.content}</div>
                </div>
              )}
            </div>

            <Button variant="ghost" size="sm" className="ml-2 h-6 w-6 p-0" onClick={handleCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Editor */}
      <div className="p-3">
        <Textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t("typeMessage")}
          disabled={disabled || isSubmitting}
          className="max-h-[200px] min-h-[60px] resize-none border-0 p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
        />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-border p-3">
        <div className="text-xs text-muted-foreground">{t("pressEnterToSend")}</div>

        <div className="flex items-center gap-2">
          {(replyToMessage || editingMessage) && (
            <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSubmitting}>
              {tCommon("cancel")}
            </Button>
          )}

          <Button size="sm" onClick={handleSend} disabled={!canSend} className="min-w-[70px]">
            {isSubmitting ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
            ) : (
              <>
                <Send className="mr-1 h-3 w-3" />
                {editingMessage ? t("update") : t("send")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
