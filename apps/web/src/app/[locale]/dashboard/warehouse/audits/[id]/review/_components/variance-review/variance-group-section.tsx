"use client";

import type { ReactNode } from "react";
import { VarianceLineRow } from "./variance-line-row";
import type { EnrichedCountLine } from "./types";

type VarianceKind = "shortage" | "surplus" | "match" | "needsRecount" | "skipped";

interface VarianceGroupSectionProps {
  title: string;
  icon: ReactNode;
  titleClassName: string;
  lines: EnrichedCountLine[];
  kind: VarianceKind;
  requireReasonForVariance: boolean;
  onApprove: (lineId: string) => void;
  onUnapprove: (lineId: string) => void;
  onUpdateReasonAndNote: (lineId: string, reasonCode: string | null, note: string | null) => void;
  onEnterQuantity: (lineId: string, quantity: number) => void;
}

export function VarianceGroupSection({
  title,
  icon,
  titleClassName,
  lines,
  kind,
  requireReasonForVariance,
  onApprove,
  onUnapprove,
  onUpdateReasonAndNote,
  onEnterQuantity,
}: VarianceGroupSectionProps) {
  if (lines.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3
        className={`flex items-center gap-1.5 font-mono text-[11px] font-black uppercase tracking-widest ${titleClassName}`}
      >
        {icon}
        <span>{title}</span>
      </h3>
      <div className="space-y-2">
        {lines.map((line) => (
          <VarianceLineRow
            key={line.id}
            line={line}
            kind={kind}
            requireReasonForVariance={requireReasonForVariance}
            onApprove={onApprove}
            onUnapprove={onUnapprove}
            onUpdateReasonAndNote={onUpdateReasonAndNote}
            onEnterQuantity={onEnterQuantity}
          />
        ))}
      </div>
    </div>
  );
}
