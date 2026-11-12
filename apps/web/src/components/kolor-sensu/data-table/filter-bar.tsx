"use client";

import { Check, ChevronLeft, Filter, LoaderCircle, Search, X } from "lucide-react";
import { debounce, useQueryStates } from "nuqs";
import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { cn } from "../lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../tooltip";

// A portal table's filter bar (bookings, clients): the
// search, folded to a magnifier until used; a chip per filter (a click
// changes its values, "×" removes it); and, at the right edge, the filter
// button with the fields to filter by. Every change goes to the address,
// and the server renders the table again.

export interface FilterChoice {
  id: string;
  name: string;
}

/** A filter of several values at once (checkboxes), in one list param. */
export interface ListFilterField {
  kind: "list";
  /** Its key in the address (`status=a,b`), a list parser's. */
  id: string;
  label: string;
  options: { value: string; label: string }[];
}

/**
 * A filter of dates: one ready range (radios) or days of its own, in three
 * params (the range and the two days).
 */
export interface DateFilterField {
  kind: "dates";
  id: string;
  label: string;
  options: { value: string; label: string }[];
  keys: { scope: string; from: string; to: string };
  /** The range when the filter is removed (null: no param). */
  removed?: string | null;
  /** The range kept under days of one's own (null: none). */
  underOwn?: string | null;
  /** A range that means no filter (e.g. "wszystkie"). */
  none?: string;
}

/** A filter of text a column's value contains (SKU, a custom field), one param. */
export interface TextFilterField {
  kind: "text";
  id: string;
  label: string;
  placeholder?: string;
  /**
   * The text lives in an object param under `id` (e.g. `filters`, for
   * fields known only at run time, such as custom fields); none: its own param.
   */
  within?: string;
}

/** A filter of numbers between two bounds (either may be left open), two params. */
export interface RangeFilterField {
  kind: "range";
  id: string;
  label: string;
  keys: { min: string; max: string };
}

export type FilterField = ListFilterField | DateFilterField | TextFilterField | RangeFilterField;

export interface FilterBarProps {
  /**
   * The table's parsers for the search (`q`), the fields' keys, the page
   * (`strona`) and any panel key to close on a change.
   */
  parsers: Record<string, Parser>;
  fields: FilterField[];
  /** Keys set to null on every change (the page, the open panel). */
  resetOnChange: string[];
  /** The table's columns in their order: the filters follow it. */
  order?: readonly string[];
  /** The search box's name and hint. */
  search: { label: string; placeholder: string };
  /**
   * The list fetches its own rows (a client cache keyed by the address):
   * the address changes without a server render. Default: the server
   * renders the page again for every change.
   */
  shallow?: boolean;
  /** The list's own wait (with shallow), for the search box's spinner. */
  pending?: boolean;
}

// The parsers are nuqs's, of any value.
type Parser = any;

interface Field {
  id: string;
  label: string;
  /** A range of dates (one ready range, or days of its own), or a list. */
  dates: boolean;
  options: { value: string; label: string }[];
  /** The values chosen (none: not filtered). */
  chosen: string[];
  /** A date field's own days. */
  own?: { from: string | null; to: string | null };
  /** A text field's text. */
  text?: string | null;
  /** A range field's bounds. */
  range?: { min: number | null; max: number | null };
  config: FilterField;
}

/** `1 250,5` */
const shortNumber = (value: number) => value.toLocaleString("pl-PL");

/** `01.10.2026` */
const shortDate = (date: string) => date.split("-").reverse().join(".");

const CHIP =
  "inline-flex h-6 items-stretch overflow-hidden rounded-[5px] border border-[var(--border)] bg-[var(--surface)] text-[0.78rem]";
const CHIP_PART =
  "inline-flex items-center gap-1 px-2 hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none";
const MENU = "w-64 p-1 text-[0.8125rem]";
const OPTION =
  "flex h-7 w-full items-center gap-2 rounded-[5px] px-2 text-left hover:bg-[var(--surface-subtle)] focus-visible:bg-[var(--surface-subtle)] focus-visible:outline-none";

function Box({ checked, round }: { checked: boolean; round?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid size-3.5 shrink-0 place-items-center border",
        round ? "rounded-full" : "rounded-[3px]",
        checked
          ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-foreground)]"
          : "border-[var(--border-strong)]"
      )}
    >
      {checked ? <Check className="size-2.5" strokeWidth={3} /> : null}
    </span>
  );
}

export function FilterBar({
  parsers,
  fields: configs,
  resetOnChange,
  order = [],
  search,
  shallow = false,
  pending: listPending,
}: FilterBarProps) {
  const [transitionPending, startTransition] = useTransition();
  const pending = listPending ?? transitionPending;
  const [params, setParams] = useQueryStates(parsers, {
    shallow,
    startTransition,
    clearOnDefault: true,
  });
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const unordered: Field[] = configs.map((config) => {
    if (config.kind === "text") {
      const text = config.within
        ? ((params[config.within] as Record<string, unknown> | null)?.[config.id] as
            | string
            | undefined) || null
        : ((params[config.id] as string | null) ?? null);
      return {
        id: config.id,
        label: config.label,
        dates: false,
        options: [],
        chosen: text ? [text] : [],
        text,
        config,
      };
    }
    if (config.kind === "range") {
      const min = (params[config.keys.min] as number | null) ?? null;
      const max = (params[config.keys.max] as number | null) ?? null;
      return {
        id: config.id,
        label: config.label,
        dates: false,
        options: [],
        chosen: min !== null || max !== null ? ["range"] : [],
        range: { min, max },
        config,
      };
    }
    if (config.kind === "list") {
      return {
        id: config.id,
        label: config.label,
        dates: false,
        options: config.options,
        chosen: (params[config.id] as string[] | null) ?? [],
        config,
      };
    }
    const scope = params[config.keys.scope] as string | null;
    const from = params[config.keys.from] as string | null;
    const to = params[config.keys.to] as string | null;
    return {
      id: config.id,
      label: config.label,
      dates: true,
      options: config.options,
      own: { from, to },
      chosen: from || to ? ["wlasny"] : scope && scope !== config.none ? [scope] : [],
      config,
    };
  });
  // As the columns go: moved in "Kolumny", they move here too.
  const placeOf = (id: string) => {
    const at = order.indexOf(id);
    return at === -1 ? order.length : at;
  };
  const fields = unordered
    .map((field, index) => ({ field, index }))
    .sort((a, b) => placeOf(a.field.id) - placeOf(b.field.id) || a.index - b.index)
    .map(({ field }) => field);
  const active = fields.filter((field) => field.chosen.length);

  // Every change starts at page 1 with the side panel closed.
  const change = (patch: Record<string, unknown>) =>
    void setParams({
      ...patch,
      ...Object.fromEntries(resetOnChange.map((key) => [key, null])),
    });

  /** A date field set to a ready range, days of its own, or nothing. */
  const setDates = (
    config: DateFilterField,
    value: { scope?: string | null; from?: string | null; to?: string | null }
  ) =>
    change({
      [config.keys.scope]: value.scope ?? null,
      [config.keys.from]: value.from ?? null,
      [config.keys.to]: value.to ?? null,
    });

  const setText = (field: Field, text: string | null) => {
    const config = field.config;
    if (config.kind !== "text") return;
    const value = text?.trim() ? text.trim() : null;
    if (!config.within) return change({ [config.id]: value });
    const object = { ...((params[config.within] as Record<string, unknown> | null) ?? {}) };
    if (value) object[config.id] = value;
    else delete object[config.id];
    change({ [config.within]: Object.keys(object).length ? object : null });
  };
  const setRange = (field: Field, min: number | null, max: number | null) => {
    if (field.config.kind !== "range") return;
    const [low, high] = min !== null && max !== null && min > max ? [max, min] : [min, max];
    change({ [field.config.keys.min]: low, [field.config.keys.max]: high });
  };

  const choose = (field: Field, value: string) => {
    const config = field.config;
    if (config.kind === "text" || config.kind === "range") return;
    if (config.kind === "dates") return setDates(config, { scope: value });
    const now = field.chosen;
    const next = now.includes(value) ? now.filter((one) => one !== value) : [...now, value];
    change({ [config.id]: next.length ? next : null });
  };
  const ownDays = (field: Field, from: string | null, to: string | null) => {
    if (field.config.kind !== "dates") return;
    setDates(field.config, {
      scope: field.config.underOwn ?? null,
      from,
      to,
    });
  };
  const remove = (field: Field) =>
    field.config.kind === "text"
      ? setText(field, null)
      : field.config.kind === "dates"
        ? setDates(field.config, { scope: field.config.removed ?? null })
        : field.config.kind === "range"
          ? change({ [field.config.keys.min]: null, [field.config.keys.max]: null })
          : change({ [field.config.id]: null });
  const clearAll = () =>
    change(
      Object.fromEntries(
        configs.flatMap((config) =>
          config.kind === "list" || config.kind === "text"
            ? [[config.kind === "text" && config.within ? config.within : config.id, null]]
            : config.kind === "range"
              ? [
                  [config.keys.min, null],
                  [config.keys.max, null],
                ]
              : [
                  [config.keys.scope, config.removed ?? null],
                  [config.keys.from, null],
                  [config.keys.to, null],
                ]
        )
      )
    );

  const chipValue = (field: Field) => {
    if (field.config.kind === "text") return `„${field.text ?? ""}”`;
    if (field.range) {
      const { min, max } = field.range;
      if (min !== null && max !== null) return `${shortNumber(min)} – ${shortNumber(max)}`;
      return min !== null ? `≥ ${shortNumber(min)}` : `≤ ${shortNumber(max ?? 0)}`;
    }
    if (field.own && (field.own.from || field.own.to)) {
      const { from, to } = field.own;
      return `${from ? shortDate(from) : "…"} – ${to ? shortDate(to) : "…"}`;
    }
    const labels = field.chosen.map(
      (value) => field.options.find((o) => o.value === value)?.label ?? value
    );
    return labels.length > 2 ? `${labels[0]} i ${labels.length - 1} inne` : labels.join(", ");
  };

  const editingField = fields.find((field) => field.id === editing) ?? null;

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 border-b border-[var(--border)] px-2 py-1.5">
      <Popover
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditing(null);
        }}
        open={open}
      >
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger
                aria-label={`Filtry${active.length ? `, ustawione: ${active.length}` : ""}`}
                className="relative inline-grid size-7 place-items-center rounded-[5px] text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none data-[state=open]:bg-[var(--surface-subtle)] data-[state=open]:text-[var(--text)]"
              >
                <Filter aria-hidden="true" className="size-4" />
                {active.length ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 min-w-3.5 rounded-full bg-[var(--primary)] px-1 text-center text-[0.6rem] leading-3.5 font-semibold text-[var(--primary-foreground)] tabular-nums"
                  >
                    {active.length}
                  </span>
                ) : null}
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>Filtry</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <PopoverContent align="start" className={MENU}>
          {editingField ? (
            <>
              <button
                className={cn(OPTION, "text-[var(--text-muted)]")}
                onClick={() => setEditing(null)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" className="size-3.5" />
                {editingField.label}
              </button>
              <div className="my-1 h-px bg-[var(--border)]" />
              <FieldValues
                field={editingField}
                onChoose={(value) => choose(editingField, value)}
                onOwnRange={(from, to) => {
                  ownDays(editingField, from, to);
                  setOpen(false);
                }}
                onText={(text) => {
                  setText(editingField, text);
                  setOpen(false);
                }}
                onRange={(min, max) => {
                  setRange(editingField, min, max);
                  setOpen(false);
                }}
              />
            </>
          ) : (
            <>
              <div className="flex h-7 items-center justify-between pr-1 pl-2 text-[0.7rem] text-[var(--text-muted)]">
                Filtruj według
                {active.length ? (
                  <button
                    className="h-6 rounded-[4px] px-1.5 text-[0.75rem] font-semibold text-[var(--primary)] hover:bg-[var(--surface-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                    onClick={clearAll}
                    type="button"
                  >
                    Wyczyść wszystkie
                  </button>
                ) : null}
              </div>
              <ul className="grid gap-px">
                {fields.map((field) => {
                  const on = field.chosen.length > 0;
                  return (
                    <li
                      className={cn(
                        "flex items-center rounded-[5px]",
                        on && "bg-[var(--primary-soft)]"
                      )}
                      key={field.id}
                    >
                      <button
                        className={cn(
                          OPTION,
                          on && "font-semibold text-[var(--primary)] hover:bg-transparent"
                        )}
                        aria-label={
                          on
                            ? `${field.label}, w pasku, wartości: ${field.chosen.length}`
                            : undefined
                        }
                        onClick={() => setEditing(field.id)}
                        type="button"
                      >
                        <span aria-hidden="true" className="w-3.5">
                          {on ? <Check className="size-3.5" /> : null}
                        </span>
                        {field.label}
                        {on ? (
                          <span
                            aria-hidden="true"
                            className="ml-auto text-[0.7rem] text-[var(--text-muted)] tabular-nums"
                          >
                            {field.chosen.length}
                          </span>
                        ) : null}
                      </button>
                      {on ? (
                        <button
                          aria-label={`Usuń filtr ${field.label}`}
                          className="mr-0.5 grid size-6 shrink-0 place-items-center rounded-[4px] text-[var(--text-muted)] hover:bg-[var(--surface)] hover:text-[var(--danger)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                          onClick={() => remove(field)}
                          type="button"
                        >
                          <X aria-hidden="true" className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </PopoverContent>
      </Popover>
      <TableSearch
        label={search.label}
        parsers={parsers.strona ? { q: parsers.q, strona: parsers.strona } : { q: parsers.q }}
        pending={pending}
        placeholder={search.placeholder}
        shallow={shallow}
      />
      {/* The filters set, on the bar's right, where it is empty. */}
      {active.length ? (
        <div
          aria-label="Ustawione filtry"
          className="ml-auto flex flex-wrap items-center justify-end gap-1.5"
          role="group"
        >
          {active.map((field) => (
            <span className={CHIP} key={field.id}>
              <Popover>
                <PopoverTrigger className={CHIP_PART}>
                  <span className="text-[var(--text-muted)]">
                    {field.label}
                    {field.config.kind === "text"
                      ? " zawiera"
                      : field.dates || field.config.kind === "range"
                        ? ":"
                        : " jest"}
                  </span>
                  <span className="font-semibold text-[var(--text)]">{chipValue(field)}</span>
                </PopoverTrigger>
                <PopoverContent align="start" className={MENU}>
                  <FieldValues
                    field={field}
                    onChoose={(value) => choose(field, value)}
                    onOwnRange={(from, to) => ownDays(field, from, to)}
                    onText={(text) => setText(field, text)}
                    onRange={(min, max) => setRange(field, min, max)}
                  />
                </PopoverContent>
              </Popover>
              <button
                aria-label={`Usuń filtr ${field.label}`}
                className={cn(
                  CHIP_PART,
                  "border-l border-[var(--border)] px-1 text-[var(--text-muted)] hover:text-[var(--danger)]"
                )}
                onClick={() => remove(field)}
                type="button"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A field's values: tick several, or (dates) a range or days of its own. */
const INPUT =
  "h-7 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[0.78rem] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none";
const SUBMIT =
  "h-7 rounded-[5px] bg-[var(--primary)] px-2 text-[0.78rem] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none";

function FieldValues({
  field,
  onChoose,
  onOwnRange,
  onText,
  onRange,
}: {
  field: Field;
  onChoose: (value: string) => void;
  onOwnRange: (from: string | null, to: string | null) => void;
  onText: (text: string | null) => void;
  onRange: (min: number | null, max: number | null) => void;
}) {
  if (field.config.kind === "text") {
    return (
      <form
        className="grid gap-1.5 px-2 py-1"
        onSubmit={(event) => {
          event.preventDefault();
          onText(String(new FormData(event.currentTarget).get("text") ?? "") || null);
        }}
      >
        <label className="grid gap-0.5 text-[0.7rem] text-[var(--text-muted)]">
          {field.label} zawiera
          <input
            autoFocus
            className={INPUT}
            defaultValue={field.text ?? ""}
            maxLength={100}
            name="text"
            placeholder={field.config.placeholder}
          />
        </label>
        <button className={SUBMIT} type="submit">
          Pokaż
        </button>
      </form>
    );
  }
  if (field.config.kind === "range") {
    const number = (value: FormDataEntryValue | null) => {
      const text = String(value ?? "")
        .trim()
        .replace(",", ".");
      if (!text) return null;
      const parsed = Number(text);
      return Number.isFinite(parsed) ? parsed : null;
    };
    return (
      <form
        className="grid gap-1.5 px-2 py-1"
        onSubmit={(event) => {
          event.preventDefault();
          const form = new FormData(event.currentTarget);
          onRange(number(form.get("min")), number(form.get("max")));
        }}
      >
        <p className="text-[0.7rem] text-[var(--text-muted)]">{field.label}</p>
        <div className="grid grid-cols-2 gap-1.5">
          <label className="grid gap-0.5 text-[0.7rem] text-[var(--text-muted)]">
            Od
            <input
              autoFocus
              className={INPUT}
              defaultValue={field.range?.min ?? ""}
              inputMode="decimal"
              name="min"
            />
          </label>
          <label className="grid gap-0.5 text-[0.7rem] text-[var(--text-muted)]">
            Do
            <input
              className={INPUT}
              defaultValue={field.range?.max ?? ""}
              inputMode="decimal"
              name="max"
            />
          </label>
        </div>
        <button className={SUBMIT} type="submit">
          Pokaż
        </button>
      </form>
    );
  }
  const ownRange = field.own;
  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const from = String(form.get("od") ?? "") || null;
    const to = String(form.get("do") ?? "") || null;
    const [first, last] = from && to && from > to ? [to, from] : [from, to];
    onOwnRange(first, last);
  };
  return (
    <div>
      <ul aria-label={`Wartości: ${field.label}`} className="grid gap-px" role="group">
        {field.options.map((option) => {
          const checked = field.chosen.includes(option.value);
          return (
            <li key={option.value}>
              <button
                aria-checked={checked}
                className={OPTION}
                onClick={() => onChoose(option.value)}
                role={field.dates ? "menuitemradio" : "menuitemcheckbox"}
                type="button"
              >
                <Box checked={checked} round={field.dates} />
                <span className="truncate">{option.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {ownRange ? (
        <form
          className="mt-1 grid gap-1.5 border-t border-[var(--border)] px-2 pt-2 pb-1"
          onSubmit={apply}
        >
          <p className="text-[0.7rem] text-[var(--text-muted)]">Własny zakres dat</p>
          <div className="grid grid-cols-2 gap-1.5">
            <label className="grid gap-0.5 text-[0.7rem] text-[var(--text-muted)]">
              Od
              <input
                className="h-7 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[0.78rem] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                defaultValue={ownRange.from ?? ""}
                name="od"
                type="date"
              />
            </label>
            <label className="grid gap-0.5 text-[0.7rem] text-[var(--text-muted)]">
              Do
              <input
                className="h-7 rounded-[5px] border border-[var(--border)] bg-[var(--surface)] px-1.5 text-[0.78rem] text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
                defaultValue={ownRange.to ?? ""}
                name="do"
                type="date"
              />
            </label>
          </div>
          <button
            className="h-7 rounded-[5px] bg-[var(--primary)] px-2 text-[0.78rem] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--primary-hover)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
            type="submit"
          >
            Pokaż
          </button>
        </form>
      ) : null}
    </div>
  );
}

/**
 * The search box, folded to a magnifier until used: it opens on a click or
 * "/", and folds again when empty and left.
 */
export function TableSearch({
  pending: outer,
  parsers,
  label,
  placeholder,
  shallow = false,
}: {
  /** The bar's wait for the server (none: no spinner). */
  pending?: boolean;
  /** The address changes without a server render (see FilterBarProps). */
  shallow?: boolean;
  /** The search, and the page when the list has pages. */
  parsers: { q: Parser; strona?: Parser };
  label: string;
  placeholder: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  // The box answers at once; the bar shows the server's wait, if any.
  const pending = outer ?? false;
  const [{ q }, setParams] = useQueryStates(parsers, {
    shallow,
    clearOnDefault: true,
  });
  const [focused, setFocused] = useState(false);
  const open = focused || Boolean(q);
  // A new search starts from the first page.
  const page = parsers.strona ? { strona: null } : {};

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        event.key !== "/" ||
        target?.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      event.preventDefault();
      input.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={cn(
        "inline-flex h-7 items-center rounded-[5px] border text-[var(--text-muted)] transition-colors",
        open
          ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--text)]"
          : "border-transparent hover:bg-[var(--surface-subtle)]"
      )}
    >
      <label
        className={cn(
          "inline-flex h-full items-center px-1.5",
          open ? "cursor-text" : "cursor-pointer",
          q ? "pr-0" : undefined
        )}
        title={open ? undefined : "Szukaj (/)"}
      >
        {pending ? (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        ) : (
          <Search aria-hidden="true" className="size-4" />
        )}
        <span className="sr-only">{label}</span>
        <input
          className={cn(
            "h-full border-0 bg-transparent text-[0.8125rem] text-[var(--text)] outline-none placeholder:text-[var(--text-subtle)] motion-safe:transition-[width,padding] motion-safe:duration-200 [&::-webkit-search-cancel-button]:hidden",
            open ? "w-48 cursor-text pl-1.5" : "w-0 cursor-pointer p-0"
          )}
          maxLength={100}
          onBlur={() => setFocused(false)}
          onChange={(event) =>
            setParams(
              { q: event.target.value || null, ...page },
              {
                limitUrlUpdates: event.target.value ? debounce(300) : undefined,
              }
            )
          }
          onFocus={() => setFocused(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && q) {
              event.stopPropagation();
              void setParams({ q: null, ...page });
            }
          }}
          placeholder={placeholder}
          ref={input}
          type="search"
          value={q ?? ""}
        />
      </label>
      {q ? (
        <button
          aria-label="Wyczyść wyszukiwanie"
          className="mx-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)] focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:outline-none"
          onClick={() => {
            // The whole search at once, at once (no wait), back in the box.
            void setParams({ q: null, ...page });
            input.current?.focus();
          }}
          // Keeps the box open: the click does not take the focus from it.
          onMouseDown={(event) => event.preventDefault()}
          title="Wyczyść wyszukiwanie"
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}
