"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { formatTokenString, parseTokenString } from "./import-utils";

export function ImportMultiSelectCell({
  value,
  options,
  onChange,
  className,
  allowCreate = false,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  className?: string;
  allowCreate?: boolean;
}) {
  const t = useTranslations("warehouseInventory.import");
  const [draft, setDraft] = useState("");
  const selected = parseTokenString(value);
  const selectedSet = new Set(selected.map((item) => item.toLowerCase()));
  const sortedOptions = Array.from(new Set([...options, ...selected])).sort((a, b) =>
    a.localeCompare(b)
  );

  const applyTokens = (tokens: string[]) => {
    const uniqueTokens = new Map<string, string>();
    tokens
      .map((token) => token.trim())
      .filter(Boolean)
      .forEach((token) => uniqueTokens.set(token.toLowerCase(), token));
    onChange(formatTokenString(Array.from(uniqueTokens.values())));
  };

  const toggleOption = (option: string, checked: boolean) => {
    const next = checked
      ? [...selected, option]
      : selected.filter((item) => item.toLowerCase() !== option.toLowerCase());
    applyTokens(next);
  };

  const addDraftToken = () => {
    const nextToken = draft.trim();
    if (!nextToken) return;
    applyTokens([...selected, nextToken]);
    setDraft("");
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex min-h-9 w-full items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-left text-sm",
            className
          )}
        >
          {selected.length > 0 ? (
            <span className="flex min-w-0 flex-wrap gap-1">
              {selected.slice(0, 3).map((token) => (
                <span
                  key={token}
                  className="inline-flex h-6 max-w-32 items-center truncate rounded bg-muted px-2 text-xs"
                >
                  {token}
                </span>
              ))}
              {selected.length > 3 ? (
                <span className="inline-flex h-6 items-center rounded bg-muted px-2 text-xs">
                  +{selected.length - 3}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="text-muted-foreground">{t("select")}</span>
          )}
          <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-2">
        {allowCreate ? (
          <div className="mb-2">
            <input
              value={draft}
              placeholder={t("typeAndPressEnter")}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addDraftToken();
              }}
              onBlur={addDraftToken}
            />
          </div>
        ) : null}
        {sortedOptions.length > 0 ? (
          <div className="max-h-64 overflow-auto pr-1">
            {sortedOptions.map((option) => {
              const checked = selectedSet.has(option.toLowerCase());
              return (
                <label
                  key={option}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted"
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={(nextChecked) => toggleOption(option, nextChecked === true)}
                  />
                  <span className="min-w-0 truncate">{option}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="px-2 py-3 text-sm text-muted-foreground">{t("noPresets")}</p>
        )}
        {selected.length > 0 ? (
          <div className="mt-2 border-t pt-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start"
              onClick={() => onChange("")}
            >
              {t("clearSelection")}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
