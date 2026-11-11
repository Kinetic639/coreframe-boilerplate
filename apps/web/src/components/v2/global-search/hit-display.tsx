"use client";

import type { useTranslations } from "next-intl";
import {
  Boxes,
  Building2,
  Car,
  CheckSquare,
  ClipboardList,
  Contact,
  FileSearch,
  FileText,
  KanbanSquare,
  MailPlus,
  Map as MapIcon,
  MapPin,
  MessageSquare,
  Package,
  Paperclip,
  QrCode,
  Tags,
  Ticket,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { highlightRanges } from "@/lib/global-search/match";
import type { ExactHitType, SearchExactHit } from "@/server/services/global-search.service";

/**
 * How a search hit looks: its icon, its second line and the highlighted match.
 * Shared by the Ctrl+K palette and the @-mention suggestions, so a result
 * reads the same wherever it is searched.
 */

export const HIT_ICONS: Record<ExactHitType, LucideIcon> = {
  repairOrder: Car,
  ticket: Ticket,
  task: CheckSquare,
  document: FileText,
  container: Boxes,
  location: MapPin,
  item: Package,
  person: UserRound,
  party: Building2,
  contact: Contact,
  audit: ClipboardList,
  matcherSession: FileSearch,
  qrCode: QrCode,
  board: KanbanSquare,
  map: MapIcon,
  ticketType: Tags,
  invitation: MailPlus,
  comment: MessageSquare,
  attachment: Paperclip,
};

/** Text with the query words highlighted */
export function Highlighted({ text, query }: { text: string; query: string }) {
  const ranges = highlightRanges(text, query);
  if (ranges.length === 0) return <>{text}</>;
  const parts: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start > cursor) parts.push(text.slice(cursor, start));
    parts.push(
      <mark
        key={index}
        className="rounded-sm bg-amber-200/70 px-0 text-inherit dark:bg-amber-400/30"
      >
        {text.slice(start, end)}
      </mark>
    );
    cursor = end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

export type GlobalSearchTranslator = ReturnType<typeof useTranslations<"globalSearch">>;

/** Second line of a data row: stock, warehouse, matched part, location, date, e-mail */
export function hitDetails(
  hit: SearchExactHit,
  t: GlobalSearchTranslator,
  withType: boolean
): string {
  const meta = hit.meta ?? {};
  const parts: (string | null | undefined)[] = [withType ? t(`hitTypes.${hit.type}`) : null];
  switch (hit.type) {
    case "repairOrder":
      if (meta.warehouseCode) parts.push(t("details.warehouse", { code: meta.warehouseCode }));
      if (meta.vin) parts.push(String(meta.vin));
      if (meta.matchedPart) parts.push(t("details.containsPart", { code: meta.matchedPart }));
      break;
    case "item":
      if (meta.onHand !== undefined) {
        parts.push(
          t("details.stock", { onHand: meta.onHand, available: meta.available ?? meta.onHand })
        );
      } else {
        parts.push(t("details.noStock"));
      }
      break;
    case "container":
      if (meta.locationCode) parts.push(t("details.location", { code: meta.locationCode }));
      break;
    case "document":
      parts.push(meta.documentType ? String(meta.documentType) : null);
      parts.push(meta.date ? String(meta.date) : null);
      break;
    case "person":
      parts.push(meta.email ? String(meta.email) : null);
      break;
    case "party":
      for (const role of String(meta.roles ?? "")
        .split(",")
        .filter(Boolean)) {
        parts.push(t.has(`details.roles.${role}`) ? t(`details.roles.${role}`) : role);
      }
      parts.push(meta.email ? String(meta.email) : null);
      parts.push(meta.phone ? String(meta.phone) : null);
      break;
    case "contact":
      parts.push(meta.jobTitle ? String(meta.jobTitle) : null);
      parts.push(meta.phone ? String(meta.phone) : null);
      parts.push(meta.email ? String(meta.email) : null);
      break;
    case "task":
      if (meta.date) parts.push(t("details.due", { date: String(meta.date) }));
      break;
    case "audit":
    case "matcherSession":
      parts.push(meta.date ? String(meta.date) : null);
      break;
    case "invitation":
      parts.push(meta.name ? String(meta.name) : null);
      if (meta.date) parts.push(t("details.expires", { date: String(meta.date) }));
      break;
    case "comment":
    case "attachment": {
      const target = meta.targetType ? String(meta.targetType).replace(/\./g, "_") : null;
      parts.push(
        target && t.has(`details.qrTargets.${target}`) ? t(`details.qrTargets.${target}`) : null
      );
      parts.push(meta.date ? String(meta.date) : null);
      if (typeof meta.size === "number")
        parts.push(`${Math.max(1, Math.round(meta.size / 1024))} KB`);
      break;
    }
    case "qrCode": {
      const target = meta.targetType ? String(meta.targetType) : null;
      parts.push(
        target
          ? t.has(`details.qrTargets.${target.replace(/\./g, "_")}`)
            ? t(`details.qrTargets.${target.replace(/\./g, "_")}`)
            : target
          : t("details.qrUnassigned")
      );
      break;
    }
  }
  parts.push(hit.subtitle);
  return parts.filter(Boolean).join(" · ");
}
