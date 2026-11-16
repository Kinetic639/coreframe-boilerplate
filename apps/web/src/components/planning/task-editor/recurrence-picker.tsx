"use client";

import { useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  KANBAN_RECURRENCE_FREQS,
  type KanbanBoardCard,
  type KanbanRecurrence,
  type KanbanRecurrenceFreq,
} from "@/lib/types/kanban";
import { cn } from "@/utils";
import { ISO_WEEKDAYS, buildRecurrence, describeRecurrence, isoWeekday } from "./recurrence-format";

/** Short weekday and plain-day names in the viewer's language. */
export function useRecurrenceText() {
  const t = useTranslations("modules.planning.boardExtras.recurrence");
  const format = useFormatter();
  // 2024-01-01 was a Monday.
  const weekday = (isoDay: number) =>
    format.dateTime(new Date(Date.UTC(2024, 0, isoDay)), { weekday: "short", timeZone: "UTC" });
  const formatDay = (ymd: string) => {
    const [y, m, d] = ymd.split("-").map(Number);
    return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
      dateStyle: "medium",
      timeZone: "UTC",
    });
  };
  return {
    weekday,
    describe: (rule: KanbanRecurrence) => describeRecurrence(t, rule, weekday, formatDay),
  };
}

/** The day a card is due (YYYY-MM-DD), for the form's defaults. */
function dueDay(card: KanbanBoardCard): string | null {
  return card.due_at ? card.due_at.slice(0, 10) : (card.start_date ?? null);
}

/**
 * "Repeat": every N days, weeks (on chosen days), months or years, until a
 * day if wanted. Completing the task makes the next one.
 */
export function RecurrencePicker({
  card,
  disabled,
  onChange,
}: {
  card: KanbanBoardCard;
  disabled: boolean;
  onChange: (rule: KanbanRecurrence | null) => void;
}) {
  const t = useTranslations("modules.planning.boardExtras.recurrence");
  const { weekday, describe } = useRecurrenceText();
  const [open, setOpen] = useState(false);
  const rule = card.recurrence;
  const due = dueDay(card);

  const [freq, setFreq] = useState<KanbanRecurrenceFreq>("weekly");
  const [interval, setIntervalValue] = useState("1");
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [monthday, setMonthday] = useState("");
  const [until, setUntil] = useState("");

  const reset = () => {
    setFreq(rule?.freq ?? "weekly");
    setIntervalValue(String(rule?.interval ?? 1));
    setWeekdays(rule?.weekdays ?? (due ? [isoWeekday(due)] : []));
    setMonthday(String(rule?.monthday ?? (due ? Number(due.slice(8, 10)) : "")));
    setUntil(rule?.until ?? "");
  };

  const save = () => {
    onChange(
      buildRecurrence({
        freq,
        interval: Number(interval),
        weekdays,
        monthday: monthday ? Number(monthday) : null,
        until: until || null,
      })
    );
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        if (next) reset();
        setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant={rule ? "secondary" : "outline"}
          size="sm"
          className="h-auto min-h-8 w-full justify-start gap-1.5 whitespace-normal py-1.5 text-left"
          disabled={disabled}
        >
          <Repeat className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0">{rule ? describe(rule) : t("button")}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 space-y-3">
        <p className="text-sm font-medium">{t("title")}</p>
        <div className="grid grid-cols-[5rem_minmax(0,1fr)] items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="recurrence-interval" className="text-xs">
              {t("every.label")}
            </Label>
            <Input
              id="recurrence-interval"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              className="h-8"
              value={interval}
              onChange={(event) =>
                setIntervalValue(event.target.value.replace(/\D/g, "").slice(0, 3))
              }
            />
          </div>
          <Select value={freq} onValueChange={(value) => setFreq(value as KanbanRecurrenceFreq)}>
            <SelectTrigger className="h-8" aria-label={t("unit.label")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_RECURRENCE_FREQS.map((item) => (
                <SelectItem key={item} value={item}>
                  {t(`unit.${item}`, { count: Number(interval) || 1 })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {freq === "weekly" ? (
          <div className="space-y-1">
            <p className="text-xs font-medium">{t("weekdays")}</p>
            <div className="flex gap-1">
              {ISO_WEEKDAYS.map((day) => {
                const on = weekdays.includes(day);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    className={cn(
                      "h-8 flex-1 rounded-md border text-xs capitalize transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    )}
                    onClick={() =>
                      setWeekdays((current) =>
                        on ? current.filter((item) => item !== day) : [...current, day]
                      )
                    }
                  >
                    {weekday(day)}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {freq === "monthly" ? (
          <div className="space-y-1">
            <Label htmlFor="recurrence-monthday" className="text-xs">
              {t("monthday")}
            </Label>
            <Input
              id="recurrence-monthday"
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              className="h-8 w-24"
              value={monthday}
              onChange={(event) => setMonthday(event.target.value.replace(/\D/g, "").slice(0, 2))}
            />
          </div>
        ) : null}

        <div className="space-y-1">
          <Label htmlFor="recurrence-until" className="text-xs">
            {t("until")}
          </Label>
          <Input
            id="recurrence-until"
            type="date"
            className="h-8"
            value={until}
            onChange={(event) => setUntil(event.target.value)}
          />
        </div>

        <p className="text-xs text-muted-foreground">{due ? t("help") : t("helpNoDue")}</p>

        <div className="flex items-center justify-between gap-2">
          {rule ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              {t("remove")}
            </Button>
          ) : (
            <span />
          )}
          <Button size="sm" onClick={save}>
            {t("save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
