"use client";

import { useTranslations } from "next-intl";
import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils";
import { BOARD_COLORS, boardBackground } from "./board-colors";

/** The board's background: a colour (drawn as a gradient) or none. */
export function BoardColorPicker({
  value,
  onChange,
  disabled,
  showLabel = true,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  showLabel?: boolean;
}) {
  const t = useTranslations("modules.planning");
  return (
    <div className="space-y-2">
      {showLabel ? <Label>{t("boards.background.label")}</Label> : null}
      <div className="grid grid-cols-6 gap-1.5" role="radiogroup">
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          disabled={disabled}
          className={cn(
            "flex h-9 items-center justify-center rounded-md border bg-muted text-muted-foreground",
            !value && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
          aria-label={t("boards.background.none")}
          title={t("boards.background.none")}
          onClick={() => onChange(null)}
        >
          {!value ? <Check className="h-4 w-4" /> : null}
        </button>
        {BOARD_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={value === color}
            disabled={disabled}
            className={cn(
              "flex h-9 items-center justify-center rounded-md text-white",
              value === color && "ring-2 ring-ring ring-offset-2 ring-offset-background"
            )}
            style={{ background: boardBackground(color) }}
            aria-label={color}
            onClick={() => onChange(color)}
          >
            {value === color ? <Check className="h-4 w-4" /> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

/** The inbox panel's own colour, from its header (kept in this browser). */
export function InboxColorPicker({
  color,
  onChange,
}: {
  color: string | null;
  onChange: (color: string | null) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label={t("boards.inbox.color")}
            >
              <Palette className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("boards.inbox.color")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-72">
        <p className="mb-2 text-sm font-medium">{t("boards.inbox.color")}</p>
        <BoardColorPicker value={color} onChange={onChange} showLabel={false} />
      </PopoverContent>
    </Popover>
  );
}
