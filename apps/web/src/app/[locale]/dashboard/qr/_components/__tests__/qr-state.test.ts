import { describe, expect, it } from "vitest";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import {
  filterQrCodes,
  getQrStatus,
  loadQrState,
  migrateQrSearchParams,
  qrLastUsedAt,
  qrPage,
} from "../qr-state";

const code = (n: number, patch: Partial<QrCodeWithStatus> = {}) =>
  ({
    id: `00000000-0000-4000-8000-00000000000${n}`,
    token: `tok${n}abcdef`,
    label: `Półka ${n}`,
    status: "active",
    deleted_at: null,
    created_at: `2026-11-0${n}T10:00:00Z`,
    assignment: null,
    ...patch,
  }) as QrCodeWithStatus;

const rows = [
  code(1, { assignment: { target_type: "location", target_id: "x" } }),
  code(2, { status: "revoked" }),
  code(3),
  code(4, { deleted_at: "2026-11-05T00:00:00Z" }),
];

describe("QR list address", () => {
  it("shows the newest first and never a deleted code", () => {
    expect(qrPage(rows, loadQrState({})).rows.map((qr) => qr.label)).toEqual([
      "Półka 3",
      "Półka 2",
      "Półka 1",
    ]);
  });

  it("filters by the shown status and searches label and token", () => {
    expect(rows.map(getQrStatus)).toEqual(["assigned", "revoked", "unassigned", "unassigned"]);
    expect(qrPage(rows, loadQrState({ status: "assigned,revoked" })).totalCount).toBe(2);
    expect(qrPage(rows, loadQrState({ q: "polka 3" })).totalCount).toBe(1);
    expect(qrPage(rows, loadQrState({ q: "tok2" })).totalCount).toBe(1);
  });

  it("translates old DataView links", () => {
    const { params } = migrateQrSearchParams({
      sort: "displayStatus.asc",
      filters: JSON.stringify({ status: "revoked" }),
    });
    expect(params).toMatchObject({ sort: "status", direction: "asc", status: "revoked" });
  });

  it("shows expired codes as their own status", () => {
    expect(getQrStatus(code(5, { status: "expired" }))).toBe("expired");
    expect(
      qrPage([code(5, { status: "expired" }), code(6)], loadQrState({ status: "expired" }))
        .totalCount
    ).toBe(1);
  });

  it("takes the latest of scan, assignment and creation as the last use", () => {
    const qr = code(1, {
      created_at: "2026-01-01T00:00:00Z",
      last_scanned_at: "2026-03-01T00:00:00Z",
      assignment: { target_type: "x", target_id: "y", assigned_at: "2026-02-01T00:00:00Z" },
    });
    expect(qrLastUsedAt(qr)).toBe("2026-03-01T00:00:00Z");
  });

  it("filters codes not used for X days and by print batch", () => {
    const now = new Date("2026-11-21T00:00:00Z").getTime();
    const batch = { id: "b1", name: "Regał A", created_at: "2026-06-01T00:00:00Z" };
    const list = [
      code(1, { created_at: "2026-01-01T00:00:00Z", batch_id: "b1", batch }),
      code(2, { created_at: "2026-01-01T00:00:00Z", last_scanned_at: "2026-11-20T00:00:00Z" }),
      code(3, { created_at: "2026-11-01T00:00:00Z" }),
    ];
    const unused = filterQrCodes(list, loadQrState({ nieuzywane: "90" }), now);
    expect(unused.map((qr) => qr.label)).toEqual(["Półka 1"]);
    const inBatch = filterQrCodes(list, loadQrState({ partia: "b1" }), now);
    expect(inBatch.map((qr) => qr.label)).toEqual(["Półka 1"]);
    expect(filterQrCodes(list, loadQrState({ q: "regal a" }), now)).toHaveLength(1);
  });
});
