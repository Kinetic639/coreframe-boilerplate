"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlignLeft, Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { RichTextInlineField } from "@/components/primitives/rich-text/rich-text-inline-field";
import { RichTextRenderer } from "@/components/primitives/rich-text/rich-text-renderer";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { normalizeRichText } from "@/components/primitives/rich-text/rich-text-utils";
import {
  TicketStatusBadge,
  type StatusBadgeConfig,
} from "@/components/help-desk/ticket-status-badge";
import {
  TicketPriorityBadge,
  type PriorityBadgeConfig,
} from "@/components/help-desk/ticket-priority-badge";
import { useHelpdeskTicketTypesQuery } from "@/hooks/queries/help-desk";
import {
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/validations/helpdesk";

/** Wide enough for the ticket on the left and its tabs on the right (the panel's width, not the window's). */
const WIDE_LAYOUT_MIN_WIDTH = 760;

export function useWideLayout(ref: React.RefObject<HTMLElement | null>) {
  const [wide, setWide] = useState(true);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setWide(node.clientWidth >= WIDE_LAYOUT_MIN_WIDTH);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return wide;
}

export function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="shrink-0 space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

export function SideHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h3>
  );
}

export function SideRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm last:border-b-0">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right">{children}</span>
    </div>
  );
}

export function SaveIndicator({ saving, saved }: { saving: boolean; saved: boolean }) {
  const t = useTranslations("modules.helpDesk.tickets.card");
  if (!saving && !saved) return null;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground" role="status">
      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
      {saving ? t("saving") : t("saved")}
    </span>
  );
}

const chipTrigger =
  "h-auto gap-1 rounded-md px-0.5 py-0.5 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-100";

/** The status; handlers change it here. */
export function StatusChip({
  status,
  config,
  editable,
  onChange,
}: {
  status: TicketStatus;
  config: Record<string, StatusBadgeConfig> | null;
  editable: boolean;
  onChange: (status: TicketStatus) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets");
  const badge = (value: TicketStatus) => (
    <TicketStatusBadge status={value} config={config?.[value]} label={t(`status.${value}`)} />
  );
  if (!editable) return badge(status);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={chipTrigger} aria-label={t("handling.status")}>
          {badge(status)}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel>{t("handling.status")}</DropdownMenuLabel>
        {TICKET_STATUSES.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => item !== status && onChange(item)}>
            {t(`status.${item}`)}
            {item === status ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PriorityChip({
  priority,
  config,
  editable,
  onChange,
}: {
  priority: TicketPriority;
  config: Record<string, PriorityBadgeConfig> | null;
  editable: boolean;
  onChange: (priority: TicketPriority) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets");
  const badge = (value: TicketPriority) => (
    <TicketPriorityBadge priority={value} config={config?.[value]} label={t(`priority.${value}`)} />
  );
  if (!editable) return badge(priority);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={chipTrigger} aria-label={t("fields.priority")}>
          {badge(priority)}
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-48">
        <DropdownMenuLabel>{t("fields.priority")}</DropdownMenuLabel>
        {TICKET_PRIORITIES.map((item) => (
          <DropdownMenuItem key={item} onSelect={() => item !== priority && onChange(item)}>
            {t(`priority.${item}`)}
            {item === priority ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface TicketTypeChoice {
  id: string | null;
  name: string | null;
  color: string | null;
  icon: string | null;
}

function TypeLabel({ name, color }: { name: string | null; color: string | null }) {
  const t = useTranslations("modules.helpDesk.tickets.card");
  return (
    <span className="inline-flex h-[22px] items-center gap-1.5 rounded-md border px-2 text-xs font-medium">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color ?? "var(--muted-foreground)" }}
      />
      <span className="max-w-40 truncate">{name ?? t("noType")}</span>
    </span>
  );
}

/** The ticket's type; the list of types loads when the menu opens. */
export function TypeChip({
  typeId,
  name,
  color,
  editable,
  onChange,
}: {
  typeId: string | null;
  name: string | null;
  color: string | null;
  editable: boolean;
  onChange: (type: TicketTypeChoice) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets");
  const [open, setOpen] = useState(false);
  if (!editable) return <TypeLabel name={name} color={color} />;
  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={chipTrigger}
          aria-label={t("fields.ticketType")}
        >
          <TypeLabel name={name} color={color} />
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-80 w-60 overflow-y-auto">
        <DropdownMenuLabel>{t("fields.ticketType")}</DropdownMenuLabel>
        {open ? <TypeOptions current={typeId} onChange={onChange} /> : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TypeOptions({
  current,
  onChange,
}: {
  current: string | null;
  onChange: (type: TicketTypeChoice) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets.card");
  const types = useHelpdeskTicketTypesQuery();
  if (types.isPending) {
    return (
      <div className="space-y-1.5 p-2" aria-busy="true">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-5 w-3/5" />
      </div>
    );
  }
  const active = (types.data ?? []).filter((type) => type.is_active || type.id === current);
  return (
    <>
      {active.map((type) => (
        <DropdownMenuItem
          key={type.id}
          onSelect={() =>
            type.id !== current &&
            onChange({ id: type.id, name: type.name, color: type.color, icon: type.icon })
          }
        >
          <span
            className="mr-2 h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: type.color }}
          />
          <span className="truncate">{type.name}</span>
          {type.id === current ? <Check className="ml-auto h-3.5 w-3.5" /> : null}
        </DropdownMenuItem>
      ))}
      {current ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={() => onChange({ id: null, name: null, color: null, icon: null })}
          >
            {t("clearType")}
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  );
}

/** The title, edited in place: Enter or leaving the field saves, Esc puts it back. */
export function TitleField({
  value,
  editable,
  onSave,
}: {
  value: string;
  editable: boolean;
  onSave: (title: string) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets");
  const [draft, setDraft] = useState(value);
  const editing = useRef(false);

  useEffect(() => {
    if (!editing.current) setDraft(value);
  }, [value]);

  if (!editable) {
    return <h2 className="break-words text-xl font-semibold leading-snug sm:text-2xl">{value}</h2>;
  }

  const commit = () => {
    editing.current = false;
    const next = draft.trim();
    if (!next) {
      setDraft(value);
      return;
    }
    if (next !== value) onSave(next.slice(0, 255));
  };

  return (
    <Textarea
      value={draft}
      rows={1}
      maxLength={255}
      aria-label={t("fields.title")}
      onFocus={() => {
        editing.current = true;
      }}
      onChange={(event) => setDraft(event.target.value.replace(/\n/g, " "))}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(value);
          editing.current = false;
          event.currentTarget.blur();
        }
      }}
      className="-mx-1.5 min-h-0 resize-none rounded-md border-0 bg-transparent px-1.5 py-0.5 text-xl font-semibold leading-snug shadow-none [field-sizing:content] focus-visible:bg-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0 sm:text-2xl md:text-2xl"
    />
  );
}

/** The description; a click opens the editor with Save and Cancel (drafts kept in this browser). */
export function DescriptionField({
  ticketId,
  rich,
  plain,
  editable,
  saving,
  onSave,
}: {
  ticketId: string;
  rich: unknown;
  plain: string | null;
  editable: boolean;
  saving: boolean;
  onSave: (rich: RichTextValue, plain: string) => void;
}) {
  const t = useTranslations("modules.helpDesk.tickets");
  const heading = (
    <h3 className="flex items-center gap-1.5 text-sm font-semibold">
      <AlignLeft className="h-4 w-4 text-muted-foreground" />
      {t("description")}
    </h3>
  );
  if (!editable) {
    return (
      <section className="space-y-2">
        {heading}
        {rich || plain ? (
          <RichTextRenderer
            value={normalizeRichText(rich)}
            emptyText={plain ?? undefined}
            prose
            className="break-words"
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("card.noDescription")}</p>
        )}
      </section>
    );
  }
  return (
    <RichTextInlineField
      heading={heading}
      value={normalizeRichText(rich)}
      fallbackText={plain}
      emptyText={t("card.noDescription")}
      draftKey={`ticket-description:${ticketId}`}
      saving={saving}
      placeholder={t("fields.descriptionPlaceholder")}
      maxLength={10000}
      contentClassName="min-h-[140px] [&_.ProseMirror]:min-h-[120px]"
      onSave={onSave}
      labels={{
        edit: t("card.edit"),
        save: t("card.save"),
        saving: t("card.saving"),
        cancel: t("cancel"),
        unsaved: t("card.unsaved"),
        emptyCta: t("card.addDescription"),
      }}
    />
  );
}
