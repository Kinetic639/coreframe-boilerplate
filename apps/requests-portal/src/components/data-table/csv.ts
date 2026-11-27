import { isValidElement, type ReactNode } from "react";

const BOM = String.fromCharCode(0xfeff);

/** A CSV cell: quoted when it has to be, quotes doubled. */
export function csvCell(value: unknown) {
  const text = value == null ? "" : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Rows as a CSV of the given columns (semicolons, a BOM: Excel in Polish
 * opens it as it is). Built from the rows on screen: no request.
 */
export function rowsToCsv<Row>(
  rows: readonly Row[],
  columns: readonly { id: string; label: string }[],
  value: (row: Row, id: string) => unknown
) {
  const head = columns.map((column) => csvCell(column.label)).join(";");
  const body = rows.map((row) => columns.map((column) => csvCell(value(row, column.id))).join(";"));
  return BOM + [head, ...body].join("\r\n");
}

/**
 * The text of what a cell draws: its strings and numbers, through elements'
 * children (a badge's label, a link's text), or a pill's `label`. Icons,
 * images and what is hidden from screen readers add nothing.
 */
export function nodeText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number" || typeof node === "bigint")
    return String(node);
  if (Array.isArray(node))
    return node.map(nodeText).filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  if (isValidElement<Record<string, unknown>>(node)) {
    const props = node.props;
    if (props["aria-hidden"] === true || props["aria-hidden"] === "true") return "";
    const text = nodeText(props.children as ReactNode);
    if (text) return text;
    // A pill drawn from its props (`<StatusPill label="Nowe" />`).
    for (const key of ["label", "title", "aria-label"]) {
      if (typeof props[key] === "string" && props[key]) return props[key] as string;
    }
  }
  return "";
}

/** Saves a CSV as a file (named `<name>-<date>.csv`). */
export function downloadCsv(csv: string, name: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
