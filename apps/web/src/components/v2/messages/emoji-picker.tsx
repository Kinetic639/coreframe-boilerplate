"use client";

import {
  EmojiPicker,
  type EmojiPickerListCategoryHeaderProps,
  type EmojiPickerListEmojiProps,
  type EmojiPickerListRowProps,
} from "frimousse";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Searchable emoji grid (frimousse: the emoji data loads from the CDN the first
 * time a picker opens and is cached by the browser). Polish names and search
 * words in Polish, English otherwise.
 */
export function EmojiPickerPanel({
  onSelect,
  className,
  autoFocus = true,
}: {
  onSelect: (emoji: string) => void;
  className?: string;
  autoFocus?: boolean;
}) {
  const t = useTranslations("chat.emoji");
  const locale = useLocale();
  return (
    <EmojiPicker.Root
      locale={locale === "pl" ? "pl" : "en"}
      columns={8}
      onEmojiSelect={({ emoji }) => onSelect(emoji)}
      className={cn("isolate flex h-[320px] w-[296px] flex-col bg-popover", className)}
      data-testid="emoji-picker"
    >
      <EmojiPicker.Search
        autoFocus={autoFocus}
        placeholder={t("search")}
        aria-label={t("search")}
        className="z-10 mx-2 mb-1 mt-2 h-7 appearance-none rounded-md border bg-background px-2 text-xs outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50"
      />
      <EmojiPicker.Viewport className="relative flex-1 outline-none">
        <EmojiPicker.Loading className="absolute inset-0 flex items-center justify-center text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
        </EmojiPicker.Loading>
        <EmojiPicker.Empty className="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground">
          {t("empty")}
        </EmojiPicker.Empty>
        <EmojiPicker.List
          className="select-none pb-1.5"
          components={{ CategoryHeader, Row, Emoji }}
        />
      </EmojiPicker.Viewport>
    </EmojiPicker.Root>
  );
}

function CategoryHeader({ category, ...props }: EmojiPickerListCategoryHeaderProps) {
  return (
    <div
      className="bg-popover px-3 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
      {...props}
    >
      {category.label}
    </div>
  );
}

function Row({ children, ...props }: EmojiPickerListRowProps) {
  return (
    <div className="scroll-my-1.5 px-1.5" {...props}>
      {children}
    </div>
  );
}

function Emoji({ emoji, ...props }: EmojiPickerListEmojiProps) {
  return (
    <button
      type="button"
      className="flex size-[35px] items-center justify-center rounded-md text-xl data-[active]:bg-muted"
      {...props}
    >
      {emoji.emoji}
    </button>
  );
}
