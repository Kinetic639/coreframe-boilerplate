import { parseRepairOrderNumber } from "@/lib/workshop/repair-order-number";

/**
 * Recognizes identifiers pasted or scanned into the global search, so the
 * palette can jump straight to the object (exact hit) instead of a text search.
 *
 * Pure: no database. Several kinds can match one input (a 6-digit number is a
 * repair order number but may also be a part number or a location code); the
 * server looks each of them up and returns only what exists.
 */

export type SearchIdKind =
  | "repairOrderFull"
  | "repairOrderNumber"
  | "vin"
  | "ticket"
  | "task"
  | "document"
  | "code";

export type DetectedSearchId =
  | { kind: "repairOrderFull"; value: string; orderNo: string; year: number; warehouseCode: string }
  | { kind: "repairOrderNumber"; value: string }
  | { kind: "vin"; value: string }
  | { kind: "ticket"; value: string }
  | { kind: "task"; value: string }
  | { kind: "document"; value: string }
  | { kind: "code"; value: string };

// VIN: 17 characters, letters I, O and Q are never used
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const TICKET_RE = /^HD-?(\d{1,9})$/;
const TASK_RE = /^PT-?(\d{1,9})$/;
// PZ/2026/000024, MM/2026/9, INW/2026/000018 ...
const DOCUMENT_RE = /^([A-Z]{2,4})\/(\d{4})\/(\d{1,9})$/;
const ORDER_NUMBER_RE = /^\d{5,7}$/;
// Generic code: container, location, SKU / part number or barcode
const CODE_RE = /^[A-Z0-9][A-Z0-9._/-]{2,63}$/;

function padded(digits: string): string {
  return digits.padStart(6, "0");
}

export function detectSearchIds(raw: string): DetectedSearchId[] {
  const value = raw.trim().toUpperCase();
  if (!value || /\s/.test(value)) return [];

  const full = parseRepairOrderNumber(value);
  if (full) {
    return [
      {
        kind: "repairOrderFull",
        value,
        orderNo: full.orderNo,
        year: full.year,
        warehouseCode: full.warehouseCode,
      },
    ];
  }

  const ticket = value.match(TICKET_RE);
  if (ticket) return [{ kind: "ticket", value: `HD-${padded(ticket[1]!)}` }];

  const task = value.match(TASK_RE);
  if (task) return [{ kind: "task", value: `PT-${padded(task[1]!)}` }];

  const document = value.match(DOCUMENT_RE);
  if (document) {
    return [{ kind: "document", value: `${document[1]}/${document[2]}/${padded(document[3]!)}` }];
  }

  const found: DetectedSearchId[] = [];
  if (VIN_RE.test(value) && /\d/.test(value) && /[A-Z]/.test(value)) {
    found.push({ kind: "vin", value });
  }
  if (ORDER_NUMBER_RE.test(value)) found.push({ kind: "repairOrderNumber", value });
  // Codes need a digit: plain words ("stany", "motyw") never hit the database
  if (CODE_RE.test(value) && /\d/.test(value)) found.push({ kind: "code", value });
  return found;
}
