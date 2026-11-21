/**
 * Reads ZPL label files back into bitmaps for an on-screen preview. Covers
 * what the app's own files contain: labels made of ^GFA graphic fields (hex,
 * optionally with ZPL ASCII compression), positioned with ^FO and sized with
 * ^PW / ^LL. Text, barcodes and Z64 data are not drawn; they are counted in
 * `skipped` so the preview can say it is incomplete. No framework imports.
 */

export interface ZplGraphic {
  x: number;
  y: number;
  /** Width in dots (bytesPerRow * 8). */
  width: number;
  height: number;
  bytesPerRow: number;
  /** 1 bit per dot, rows of bytesPerRow bytes, most significant bit first; 1 = black. */
  data: Uint8Array;
}

export interface ZplPreviewLabel {
  /** Label size in dots. */
  width: number;
  height: number;
  graphics: ZplGraphic[];
  /** Number of commands that print something the preview does not draw. */
  skipped: number;
}

/** Commands that print text, barcodes or shapes, which the preview does not draw. */
const DRAWING_COMMANDS = new Set(["FD", "GB", "GC", "GD", "GE"]);

function repeatCount(char: string): number {
  const code = char.charCodeAt(0);
  if (code >= 71 && code <= 89) return code - 70; // G..Y = 1..19
  if (code >= 103 && code <= 122) return (code - 102) * 20; // g..z = 20..400
  return 0;
}

/** Decodes ^GFA data (plain hex or ZPL ASCII compression) into bytes. */
export function decodeGfaData(source: string, totalBytes: number, bytesPerRow: number): Uint8Array {
  const out = new Uint8Array(totalBytes);
  const rowNibbles = bytesPerRow * 2;
  const nibbles: number[] = [];
  let row: number[] = [];
  let previous: number[] = new Array(rowNibbles).fill(0);
  let count = 0;

  const flushRow = () => {
    while (row.length < rowNibbles) row.push(0);
    nibbles.push(...row);
    previous = row;
    row = [];
  };
  const push = (value: number, times: number) => {
    for (let i = 0; i < times; i++) {
      row.push(value);
      if (row.length === rowNibbles) flushRow();
    }
  };

  for (const char of source.replace(/\s+/g, "")) {
    const repeat = repeatCount(char);
    if (repeat) {
      count += repeat;
      continue;
    }
    if (char === ",") {
      if (row.length > 0) flushRow();
      else push(0, rowNibbles);
    } else if (char === "!") {
      push(15, rowNibbles - row.length);
    } else if (char === ":") {
      if (row.length > 0) flushRow();
      nibbles.push(...previous);
    } else {
      const value = parseInt(char, 16);
      if (Number.isNaN(value)) continue;
      push(value, count || 1);
    }
    count = 0;
  }
  if (row.length > 0) flushRow();

  for (let i = 0; i < totalBytes && i * 2 + 1 < nibbles.length; i++) {
    out[i] = (nibbles[i * 2] << 4) | nibbles[i * 2 + 1];
  }
  return out;
}

/** Splits a ZPL file into labels and decodes their graphic fields. */
export function parseZplLabels(zpl: string): ZplPreviewLabel[] {
  const labels: ZplPreviewLabel[] = [];
  const formats = zpl.split(/\^XA/i).slice(1);

  for (const format of formats) {
    const body = format.split(/\^XZ/i)[0];
    let width = 0;
    let height = 0;
    let x = 0;
    let y = 0;
    let skipped = 0;
    const graphics: ZplGraphic[] = [];

    // Each command starts with ^ or ~ and a two-letter code.
    for (const command of body.split(/(?=[\^~][A-Za-z0-9@])/)) {
      const code = command.slice(1, 3).toUpperCase();
      const params = command.slice(3);
      if (code === "PW") width = parseInt(params, 10) || width;
      else if (code === "LL") height = parseInt(params, 10) || height;
      else if (code === "FO" || code === "FT") {
        const [fx, fy] = params.split(",");
        x = parseInt(fx, 10) || 0;
        y = parseInt(fy, 10) || 0;
      } else if (code === "GF") {
        const [type, , total, perRow, ...rest] = params.split(",");
        const totalBytes = parseInt(total, 10);
        const bytesPerRow = parseInt(perRow, 10);
        const data = rest.join(",");
        if (type?.toUpperCase() !== "A" || !totalBytes || !bytesPerRow || data.startsWith(":Z64")) {
          skipped++;
          continue;
        }
        graphics.push({
          x,
          y,
          width: bytesPerRow * 8,
          height: Math.floor(totalBytes / bytesPerRow),
          bytesPerRow,
          data: decodeGfaData(data, totalBytes, bytesPerRow),
        });
      } else if (DRAWING_COMMANDS.has(code)) {
        skipped++;
      }
    }

    if (!width) width = Math.max(0, ...graphics.map((g) => g.x + g.width));
    if (!height) height = Math.max(0, ...graphics.map((g) => g.y + g.height));
    if (width > 0 && height > 0) labels.push({ width, height, graphics, skipped });
  }
  return labels;
}

/** Whether the dot at (x, y) of a graphic is black. */
export function isDotBlack(graphic: ZplGraphic, x: number, y: number): boolean {
  const byte = graphic.data[y * graphic.bytesPerRow + (x >> 3)];
  return ((byte >> (7 - (x & 7))) & 1) === 1;
}
