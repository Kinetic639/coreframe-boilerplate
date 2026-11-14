"use client";

import { type KeyboardEvent, type PointerEvent, useRef, useState } from "react";
import { clampColumnWidth, parseWidths, serializeWidths } from "./columns";

// The edge of a column's header: drag it to make the column wider or
// narrower (arrows do it from the keyboard, double-click brings back the
// usual width). The table follows at once, in the browser; the width goes
// to the table's widths cookie, which the server reads next time, so
// nothing reloads.

const STEP = 16;

function savedWidths(cookie: string) {
  const name = `${cookie}=`;
  const raw = document.cookie
    .split("; ")
    .find((one) => one.startsWith(name))
    ?.slice(name.length);
  return parseWidths(raw ? decodeURIComponent(raw) : null);
}

function saveWidth(cookie: string, column: string, width: number | null) {
  const widths = savedWidths(cookie);
  if (width === null) delete widths[column];
  else widths[column] = width;
  document.cookie = `${cookie}=${encodeURIComponent(
    serializeWidths(widths)
  )}; path=/; max-age=31536000; samesite=lax`;
}

/** Sets the column's width in the table now (its <col>, and the table's). */
function showWidth(handle: HTMLElement, column: string, width: number) {
  const table = handle.closest("table");
  const col = table?.querySelector<HTMLElement>(`col[data-column="${column}"]`);
  if (!table || !col) return;
  col.style.width = `${width}px`;
  const total = [...table.querySelectorAll<HTMLElement>("col[data-width]")]
    .map((one) => parseFloat(one.style.width) || 0)
    .reduce((sum, one) => sum + one, 0);
  table.style.minWidth = `${total}px`;
}

export function ColumnResizer({
  column,
  label,
  cookie,
  width: initial,
  usualWidth,
}: {
  column: string;
  label: string;
  /** The table's widths cookie. */
  cookie: string;
  width: number;
  usualWidth: number;
}) {
  const [width, setWidth] = useState(initial);
  const drag = useRef<{ x: number; width: number } | null>(null);
  // The latest width, for the events between renders (the drag's end).
  const latest = useRef(initial);

  const change = (handle: HTMLElement, next: number, save: boolean) => {
    const clamped = clampColumnWidth(next);
    latest.current = clamped;
    setWidth(clamped);
    showWidth(handle, column, clamped);
    if (save) saveWidth(cookie, column, clamped);
  };

  return (
    <span
      aria-label={`Szerokość kolumny ${label}`}
      aria-orientation="vertical"
      aria-valuemax={640}
      aria-valuemin={60}
      aria-valuenow={width}
      className="group/resize absolute inset-y-0 -right-[3px] z-10 flex w-[7px] cursor-col-resize touch-none justify-center outline-none"
      onDoubleClick={(event) => {
        change(event.currentTarget, usualWidth, false);
        saveWidth(cookie, column, null);
      }}
      onKeyDown={(event: KeyboardEvent<HTMLSpanElement>) => {
        const by = event.key === "ArrowRight" ? STEP : event.key === "ArrowLeft" ? -STEP : 0;
        if (!by) return;
        event.preventDefault();
        change(event.currentTarget, latest.current + by, true);
      }}
      onPointerDown={(event: PointerEvent<HTMLSpanElement>) => {
        if (event.button !== 0) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, width: latest.current };
      }}
      onPointerMove={(event: PointerEvent<HTMLSpanElement>) => {
        if (!drag.current) return;
        change(event.currentTarget, drag.current.width + event.clientX - drag.current.x, false);
      }}
      onPointerUp={(event: PointerEvent<HTMLSpanElement>) => {
        if (!drag.current) return;
        drag.current = null;
        saveWidth(cookie, column, latest.current);
        event.currentTarget.releasePointerCapture(event.pointerId);
      }}
      onPointerCancel={() => {
        drag.current = null;
      }}
      role="separator"
      tabIndex={0}
      title="Przeciągnij, aby zmienić szerokość (dwuklik: domyślna)"
    >
      <span
        aria-hidden="true"
        className="h-full w-px bg-transparent group-hover/resize:bg-[var(--primary)] group-focus-visible/resize:bg-[var(--primary)] group-active/resize:bg-[var(--primary)]"
      />
    </span>
  );
}
