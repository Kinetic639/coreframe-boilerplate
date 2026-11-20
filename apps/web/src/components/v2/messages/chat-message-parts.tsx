"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Download, FileText, SmilePlus } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { attachmentFilePath } from "@/components/primitives/attachments/attachment-download";
import { isImageMimeType } from "@/components/primitives/attachments/attachment-utils";
import { attachmentImageSrc } from "@/lib/attachments/image-variants";
import { fitGif, isAllowedGifUrl } from "@/lib/messages/gif";
import { memberName } from "@/lib/messages/display";
import {
  CHAT_QUICK_REACTIONS,
  type ChatMedia,
  type ChatMemberProfile,
  type ChatReactions,
} from "@/lib/messages/types";
import { cn } from "@/lib/utils";
import type { AppAttachment } from "@/server/services/attachments.service";
import { EmojiPickerPanel } from "./emoji-picker";

type ChatT = ReturnType<typeof useTranslations<"chat">>;

/** Reaction chips under a message: emoji and count, own ones highlighted; a click toggles */
export function MessageReactions({
  reactions,
  members,
  meId,
  mine,
  onToggle,
  onAdd,
}: {
  reactions: ChatReactions | null | undefined;
  members: ChatMemberProfile[];
  meId: string;
  mine: boolean;
  onToggle: (emoji: string, on: boolean) => void;
  onAdd: (emoji: string) => void;
}) {
  const t = useTranslations("chat");
  const entries = Object.entries(reactions ?? {}).filter(([, users]) => users.length > 0);
  if (entries.length === 0) return null;
  const names = (users: string[]) =>
    users
      .map((id) => {
        if (id === meId) return t("window.you");
        const member = members.find((m) => m.user_id === id);
        return member ? memberName(member) : t("system.someone");
      })
      .join(", ");

  return (
    <div
      className={cn("flex max-w-[86%] flex-wrap gap-1", mine ? "justify-end" : "justify-start")}
      data-testid="message-reactions"
    >
      {entries.map(([emoji, users]) => {
        const reacted = users.includes(meId);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji, !reacted)}
            title={t("reactions.who", { names: names(users), emoji })}
            aria-pressed={reacted}
            className={cn(
              "flex h-5 items-center gap-1 rounded-full border px-1.5 text-[11px] leading-none transition-colors",
              reacted
                ? "border-primary/50 bg-primary/15 text-foreground"
                : "bg-background text-muted-foreground hover:border-foreground/30"
            )}
          >
            <span className="text-[13px] leading-none">{emoji}</span>
            <span className="tabular-nums">{users.length}</span>
          </button>
        );
      })}
      <ReactionPickerButton onPick={onAdd} t={t} className="h-5 w-6 rounded-full border" />
    </div>
  );
}

/** Smiley button that opens the full emoji picker; the pick becomes a reaction */
export function ReactionPickerButton({
  onPick,
  t,
  className,
  onOpenChange,
}: {
  onPick: (emoji: string) => void;
  t: ChatT;
  className?: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("reactions.add")}
          title={t("reactions.add")}
          className={cn(
            "flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground",
            className
          )}
        >
          <SmilePlus className="size-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" side="top">
        <EmojiPickerPanel
          onSelect={(emoji) => {
            change(false);
            onPick(emoji);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * Hover bar of a message (like Messenger / Slack): the six quick reactions and
 * the full picker. Stays visible while its picker is open.
 */
export function QuickReactions({
  onPick,
  visible = false,
  className,
}: {
  onPick: (emoji: string) => void;
  /** Shown without hover (a tap on a touch screen) */
  visible?: boolean;
  className?: string;
}) {
  const t = useTranslations("chat");
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <span
      className={cn(
        "flex shrink-0 items-center rounded-full border bg-background px-0.5 shadow-sm",
        pickerOpen || visible
          ? "opacity-100"
          : "opacity-0 focus-within:opacity-100 group-hover/msg:opacity-100",
        className
      )}
      data-testid="quick-reactions"
    >
      {CHAT_QUICK_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          aria-label={t("reactions.react", { emoji })}
          title={t("reactions.react", { emoji })}
          onClick={() => onPick(emoji)}
          className="flex size-5 items-center justify-center rounded-full text-[13px] leading-none transition-transform hover:scale-125"
        >
          {emoji}
        </button>
      ))}
      <ReactionPickerButton
        onPick={onPick}
        t={t}
        onOpenChange={setPickerOpen}
        className="size-5 rounded-full"
      />
    </span>
  );
}

/** A GIF message: the animation at its own ratio, at most 240 × 200 */
export function ChatGif({ media, pending }: { media: ChatMedia; pending?: boolean }) {
  const size = fitGif(media);
  const className = cn(
    "block rounded-lg bg-muted object-cover [contain:strict] [transform:translateZ(0)]",
    pending && "opacity-60"
  );
  const style = { width: size.width, height: size.height };
  const video = isAllowedGifUrl(media.mp4_url) ? media.mp4_url : null;

  if (video) {
    return (
      <ChatGifVideo
        src={video}
        poster={isAllowedGifUrl(media.preview_url) ? media.preview_url : undefined}
        label={media.title ?? "GIF"}
        className={className}
        style={style}
      />
    );
  }
  return (
    <img
      src={media.url}
      alt={media.title ?? "GIF"}
      width={size.width}
      height={size.height}
      loading="lazy"
      decoding="async"
      className={className}
      style={style}
      data-testid="chat-gif"
    />
  );
}

/**
 * A GIF as a muted looping video: the browser decodes it off the main thread,
 * so it keeps playing smoothly while the chat scrolls (a large animated GIF
 * tears and freezes there). It plays only while on screen.
 */
function ChatGifVideo({
  src,
  poster,
  label,
  className,
  style,
}: {
  src: string;
  poster?: string;
  label: string;
  className: string;
  style: { width: number; height: number };
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !reduced) {
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);

  return (
    <video
      ref={ref}
      src={src}
      poster={poster}
      aria-label={label}
      muted
      loop
      playsInline
      preload="metadata"
      disablePictureInPicture
      className={className}
      style={style}
      data-testid="chat-gif"
    />
  );
}

/**
 * Files of a message. Images show inline from their 640 px WebP version (made
 * when uploaded) and open full size on click; other files are a row with an
 * icon that opens the file.
 */
export function ChatAttachments({
  ids,
  attachmentById,
  mine,
}: {
  ids: string[];
  attachmentById: Map<string, AppAttachment>;
  mine: boolean;
}) {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [preview, setPreview] = useState<AppAttachment | null>(null);
  if (ids.length === 0) return null;

  const files = ids.map((id) => ({ id, file: attachmentById.get(id) }));
  const images = files.filter(({ file }) => file && isImageMimeType(file.content_type));
  const others = files.filter(({ file }) => !file || !isImageMimeType(file.content_type));
  const single = images.length === 1;

  return (
    <>
      {images.length > 0 ? (
        <div
          className={cn(
            "grid max-w-full gap-1",
            single ? "grid-cols-1" : "w-[240px] grid-cols-2",
            mine ? "justify-items-end" : "justify-items-start"
          )}
          data-testid="chat-images"
        >
          {images.map(({ id, file }) => {
            const meta = file!.metadata as { width?: number; height?: number };
            const size =
              single && meta.width && meta.height
                ? fitGif({ width: meta.width, height: meta.height }, 240, 240)
                : null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setPreview(file!)}
                title={file!.file_name}
                className={cn(
                  "overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  !size && (single ? "h-[160px] w-[240px]" : "aspect-square w-full")
                )}
                style={size ? { width: size.width, height: size.height } : undefined}
              >
                <img
                  src={attachmentImageSrc(id, "card")}
                  alt={file!.file_name}
                  loading="lazy"
                  decoding="async"
                  className="size-full object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
      {others.map(({ id, file }) => (
        <a
          key={id}
          href={file ? attachmentFilePath(file, locale) : undefined}
          target="_blank"
          rel="noreferrer"
          className="flex max-w-full items-center gap-2 rounded-md border bg-background px-2 py-1.5 text-xs hover:bg-muted/60"
        >
          <span className="flex size-6 shrink-0 items-center justify-center rounded bg-muted text-muted-foreground">
            <FileText className="size-3.5" />
          </span>
          <span className="min-w-0 truncate">{file?.file_name ?? "…"}</span>
        </a>
      ))}
      <Dialog open={!!preview} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="max-w-[min(92vw,1100px)] gap-2 p-3">
          <DialogTitle className="truncate pr-8 text-sm font-medium">
            {preview?.file_name}
          </DialogTitle>
          {preview ? (
            <>
              <img
                src={attachmentImageSrc(preview.id)}
                alt={preview.file_name}
                decoding="async"
                className="mx-auto max-h-[78vh] w-auto max-w-full rounded object-contain"
              />
              <a
                href={attachmentFilePath(preview, locale, true)}
                className="flex items-center gap-1 self-end text-xs text-muted-foreground hover:text-foreground"
              >
                <Download className="size-3.5" /> {t("window.download")}
              </a>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Message made of up to three emoji and nothing else: shown large, without a bubble */
export function isEmojiOnly(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 24) return false;
  if (!/^(\p{Extended_Pictographic}|\p{Emoji_Component}|‍|️|\s)+$/u.test(trimmed)) {
    return false;
  }
  // Digits, # and * are emoji components too: a plain "12" is text
  if (/^[\d#*\s]+$/.test(trimmed)) return false;
  const segments = Array.from(
    new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(trimmed.replace(/\s/g, ""))
  );
  return segments.length <= 3;
}
