import { describe, expect, it } from "vitest";
import type { QrCodeWithStatus } from "@/server/services/qr.service";
import { getQrStatus, loadQrState, migrateQrSearchParams, qrPage } from "../qr-state";

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
});
