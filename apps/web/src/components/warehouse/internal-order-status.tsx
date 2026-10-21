"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/**
 * Status squares of an internal-order (ZW) line, as in AutoStacja's
 * "Zamówienia": Z ordered, R reserved, W issued, A cancelled. A square is
 * full when the whole quantity is in that state, half (split on the
 * diagonal) when part of it is, empty when none is.
 */

export type SquareFill = "full" | "half" | "none";

export type ZwLineState = {
  quantity: number;
  ordered: boolean;
  reservedQuantity: number;
  issuedQuantity: number;
  cancelledAt: string | null;
};

const EPS = 1e-9;

function fillOf(part: number, whole: number): SquareFill {
  if (part <= EPS) return "none";
  return part + EPS >= whole ? "full" : "half";
}

export function zwLineSquares(line: ZwLineState): Record<"z" | "r" | "w" | "a", SquareFill> {
  const cancelled = !!line.cancelledAt;
  return {
    // Only a line ordered in Ambra is "ordered"; a delivery line never was.
    z: line.ordered && !cancelled ? "full" : "none",
    r: fillOf(line.reservedQuantity, line.quantity),
    w: fillOf(line.issuedQuantity, line.quantity),
    a: cancelled ? "full" : "none",
  };
}

export const ZW_SQUARE_KEYS = ["z", "r", "w", "a"] as const;

export function StatusSquare({ fill, label }: { fill: SquareFill; label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-fill={fill}
      data-testid="zw-square"
      className={cn(
        "inline-block h-3.5 w-3.5 shrink-0 rounded-[2px] border border-primary",
        fill === "full" && "bg-primary",
        fill === "half" && "bg-[linear-gradient(135deg,var(--primary)_50%,transparent_50%)]"
      )}
    />
  );
}

/** The four squares of a line, with the state of each in its label. */
export function ZwLineSquares({ line }: { line: ZwLineState }) {
  const t = useTranslations("modules.warehouse.internalOrders.squares");
  const squares = zwLineSquares(line);
  return (
    <span className="inline-flex items-center gap-1" data-testid="zw-squares">
      {ZW_SQUARE_KEYS.map((key) => (
        <StatusSquare
          key={key}
          fill={squares[key]}
          label={`${t(`${key}.name`)}: ${t(`fill.${squares[key]}`)}`}
        />
      ))}
    </span>
  );
}

/** Column header letters matching ZwLineSquares. */
export function ZwSquaresHeader() {
  const t = useTranslations("modules.warehouse.internalOrders.squares");
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px]">
      {ZW_SQUARE_KEYS.map((key) => (
        <span key={key} className="w-3.5 text-center" title={t(`${key}.name`)}>
          {t(`${key}.letter`)}
        </span>
      ))}
    </span>
  );
}
