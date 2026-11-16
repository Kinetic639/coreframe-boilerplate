"use client";

import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Label } from "@/components/ui/label";
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
