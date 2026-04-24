/**
 * @vitest-environment node
 *
 * Unit tests for QrCodesService and QrAssignmentsService.
 *
 * All Supabase interactions are mocked — no real DB connections.
 *
 * Tests cover:
 *  - QrCodesService.create (success, DB error)
 *  - QrCodesService.getById (found, null, DB error)
 *  - QrCodesService.listByOrg (success, DB error)
 *  - QrCodesService.revoke (success, already revoked, not found)
 *
 *  - QrAssignmentsService.assignToTarget
 *      success path
 *      QR not found
 *      revoked QR blocked
 *      unsupported target type
 *      missing qr.assign
 *      missing target-specific assign permission
 *      target NOT_FOUND
 *      cross-org mismatch (WRONG_ORG)
 *      unique violation → QR_ALREADY_ASSIGNED
 *      unique violation → TARGET_ALREADY_HAS_QR
 *
 *  - QrAssignmentsService.getActiveForQr (found, null, DB error)
 *  - QrAssignmentsService.getActiveForTarget (found, null)
 *
 *  - QrAssignmentsService.listByBranch
 *      missing qr.read → Unauthorized
 *      missing warehouse.locations.read → Unauthorized
 *      success path
 *
 *  - QrAssignmentsService.revokeAssignment (success, not found)
 *  - QrAssignmentsService.revokeActiveForQr (success when row exists, success when none)
 */

import { describe, it, expect, vi } from "vitest";
import { QrCodesService, QrAssignmentsService, QR_ASSIGN_ERRORS } from "../qr.service";
import type { QrCode, QrAssignment } from "../qr.service";
import type { PermissionSnapshot } from "@/lib/types/permissions";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_ID = "org-aaa-111";
const ORG_ID_B = "org-bbb-222";
const BRANCH_ID = "branch-ccc-333";
const USER_ID = "user-ddd-444";
const QR_ID = "qr-eee-555";
const QR_TOKEN = "AbCdEfGhIjKlMnOpQrSt12";
const LOC_ID = "loc-fff-666";
const ASSIGN_ID = "assign-ggg-777";

// ---------------------------------------------------------------------------
// Test data builders
// ---------------------------------------------------------------------------

function makeQrCode(overrides: Partial<QrCode> = {}): QrCode {
  return {
    id: QR_ID,
    organization_id: ORG_ID,
    token: QR_TOKEN,
    label: "Test QR",
    notes: null,
    status: "active",
    created_by: USER_ID,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    deleted_at: null,
    ...overrides,
  };
}

function makeAssignment(overrides: Partial<QrAssignment> = {}): QrAssignment {
  return {
    id: ASSIGN_ID,
    qr_code_id: QR_ID,
    organization_id: ORG_ID,
    branch_id: BRANCH_ID,
    target_type: "warehouse.location",
    target_id: LOC_ID,
    assigned_by: USER_ID,
    assigned_at: "2026-01-01T00:00:00Z",
    revoked_by: null,
    revoked_at: null,
    revocation_reason: null,
    ...overrides,
  };
}

/** Full permission snapshot for an org_owner-equivalent user. */
function makeFullSnapshot(): PermissionSnapshot {
  return {
    allow: [
      "qr.*",
      "warehouse.*",
      "qr.read",
      "qr.create",
      "qr.assign",
      "qr.revoke",
      "qr.export",
      "warehouse.locations.read",
      "warehouse.locations.manage",
    ],
    deny: [],
  };
}

/** Snapshot with only qr.read + qr.export (org_member default). */
function makeReadOnlySnapshot(): PermissionSnapshot {
  return { allow: ["qr.read", "qr.export"], deny: [] };
}

/** Snapshot with qr.assign but missing warehouse.locations.manage. */
function makeQrAssignOnlySnapshot(): PermissionSnapshot {
  return { allow: ["qr.assign", "qr.read", "warehouse.locations.read"], deny: [] };
}

// ---------------------------------------------------------------------------
// Supabase mock builders
// ---------------------------------------------------------------------------

/**
 * Each entry in `fromResults` is consumed sequentially by `.from()` calls.
 * Chain methods return the same chain object; .single() and .maybeSingle()
 * resolve the result. Awaiting the chain directly uses the `.then` property.
 */
function makeSupabaseMock(fromResults: Array<{ data: unknown; error: unknown }>) {
  let fromIndex = 0;

  const makeChain = (result: { data: unknown; error: unknown }) => {
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "eq", "is", "order", "insert", "update", "neq", "in", "filter"]) {
      chain[m] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue(result);
    chain.single = vi.fn().mockResolvedValue(result);
    chain.then = (
      onfulfilled: ((v: unknown) => unknown) | null | undefined,
      onrejected: ((r: unknown) => unknown) | null | undefined
    ) => Promise.resolve(result).then(onfulfilled, onrejected);
    return chain;
  };

  return {
    from: vi.fn().mockImplementation(() => {
      const result = fromResults[fromIndex] ?? { data: null, error: null };
      fromIndex++;
      return makeChain(result);
    }),
  };
}

function makeRlsDeniedClient() {
  const rlsError = { code: "42501", message: "permission denied for table qr_codes" };
  const errResult = { data: null, error: rlsError };

  function makeChain(): Record<string, unknown> {
    const q: Record<string, unknown> = {};
    for (const m of ["select", "insert", "update", "eq", "is", "order", "neq", "in"]) {
      q[m] = vi.fn().mockImplementation(() => makeChain());
    }
    q.maybeSingle = vi.fn().mockResolvedValue(errResult);
    q.single = vi.fn().mockResolvedValue(errResult);
    q.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(errResult).then(onFulfilled);
    return q;
  }

  return { from: vi.fn().mockImplementation(() => makeChain()) };
}

// ---------------------------------------------------------------------------
// QrCodesService.create
// ---------------------------------------------------------------------------

describe("QrCodesService.create", () => {
  it("returns the created QR code on success", async () => {
    const qr = makeQrCode();
    const supabase = makeSupabaseMock([{ data: qr, error: null }]);

    const result = await QrCodesService.create(supabase as never, ORG_ID, {
      label: "Test QR",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.organization_id).toBe(ORG_ID);
      expect(result.data.status).toBe("active");
    }
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "insert failed" } }]);

    const result = await QrCodesService.create(supabase as never, ORG_ID, {});

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("insert failed");
  });

  it("normalizes RLS errors to a friendly message", async () => {
    const supabase = makeRlsDeniedClient();

    const result = await QrCodesService.create(supabase as never, ORG_ID, {});

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/permission/i);
  });
});

// ---------------------------------------------------------------------------
// QrCodesService.getById
// ---------------------------------------------------------------------------

describe("QrCodesService.getById", () => {
  it("returns the QR code when found", async () => {
    const qr = makeQrCode();
    const supabase = makeSupabaseMock([{ data: qr, error: null }]);

    const result = await QrCodesService.getById(supabase as never, ORG_ID, QR_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.id).toBe(QR_ID);
  });

  it("returns null data (not an error) when not found", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrCodesService.getById(supabase as never, ORG_ID, "nonexistent");

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "db error" } }]);

    const result = await QrCodesService.getById(supabase as never, ORG_ID, QR_ID);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QrCodesService.listByOrg
// ---------------------------------------------------------------------------

describe("QrCodesService.listByOrg", () => {
  it("returns QR codes for the org", async () => {
    const codes = [makeQrCode(), makeQrCode({ id: "qr-2" })];
    const supabase = makeSupabaseMock([{ data: codes, error: null }]);

    const result = await QrCodesService.listByOrg(supabase as never, ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(2);
  });

  it("returns empty array when org has no QR codes", async () => {
    const supabase = makeSupabaseMock([{ data: [], error: null }]);

    const result = await QrCodesService.listByOrg(supabase as never, ORG_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "query failed" } }]);

    const result = await QrCodesService.listByOrg(supabase as never, ORG_ID);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QrCodesService.revoke
// ---------------------------------------------------------------------------

describe("QrCodesService.revoke", () => {
  it("revokes the QR code and returns success", async () => {
    const supabase = makeSupabaseMock([
      // revokeActiveForQr → update qr_assignments
      { data: null, error: null },
      // revoke qr_codes → select id
      { data: { id: QR_ID }, error: null },
    ]);

    const result = await QrCodesService.revoke(supabase as never, ORG_ID, QR_ID, {
      revokedBy: USER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("returns failure when QR not found or already revoked (0 rows updated)", async () => {
    const supabase = makeSupabaseMock([
      // revokeActiveForQr → no rows matched, but not an error
      { data: null, error: null },
      // revoke qr_codes → .single() returns null (no active row matched)
      { data: null, error: null },
    ]);

    const result = await QrCodesService.revoke(supabase as never, ORG_ID, QR_ID, {
      revokedBy: USER_ID,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /not found|already revoked/i
    );
  });

  it("propagates DB errors from the qr_codes update", async () => {
    const supabase = makeSupabaseMock([
      { data: null, error: null },
      { data: null, error: { message: "update error" } },
    ]);

    const result = await QrCodesService.revoke(supabase as never, ORG_ID, QR_ID, {
      revokedBy: USER_ID,
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("update error");
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.assignToTarget
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.assignToTarget", () => {
  const baseInput = {
    qrCodeId: QR_ID,
    targetType: "warehouse.location",
    targetId: LOC_ID,
    assignedBy: USER_ID,
    permissionSnapshot: makeFullSnapshot(),
  };

  it("inserts an assignment and returns it on success", async () => {
    const assignment = makeAssignment();
    const supabase = makeSupabaseMock([
      // load QR row
      { data: makeQrCode(), error: null },
      // registry validate: warehouse_locations
      {
        data: {
          id: LOC_ID,
          organization_id: ORG_ID,
          branch_id: BRANCH_ID,
          deleted_at: null,
        },
        error: null,
      },
      // insert qr_assignments
      { data: assignment, error: null },
    ]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.qr_code_id).toBe(QR_ID);
      expect(result.data.target_type).toBe("warehouse.location");
    }
  });

  it("returns error when QR code is not found", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/not found/i);
  });

  it("returns error when QR code is revoked", async () => {
    const supabase = makeSupabaseMock([{ data: makeQrCode({ status: "revoked" }), error: null }]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/revoked/i);
  });

  it("returns UNSUPPORTED_TARGET_TYPE for an unregistered target type", async () => {
    const supabase = makeSupabaseMock([{ data: makeQrCode(), error: null }]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, {
      ...baseInput,
      targetType: "unknown.type",
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      QR_ASSIGN_ERRORS.UNSUPPORTED_TARGET_TYPE
    );
  });

  it("returns Unauthorized when qr.assign is missing from snapshot", async () => {
    const supabase = makeSupabaseMock([{ data: makeQrCode(), error: null }]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, {
      ...baseInput,
      permissionSnapshot: makeReadOnlySnapshot(),
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns Unauthorized when target-specific assign permission is missing", async () => {
    const supabase = makeSupabaseMock([{ data: makeQrCode(), error: null }]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, {
      ...baseInput,
      permissionSnapshot: makeQrAssignOnlySnapshot(),
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns error when target is not found in the DB", async () => {
    const supabase = makeSupabaseMock([
      { data: makeQrCode(), error: null },
      { data: null, error: null }, // registry validate → NOT_FOUND
    ]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(/NOT_FOUND/);
  });

  it("returns CROSS_ORG_MISMATCH when target belongs to a different org", async () => {
    const supabase = makeSupabaseMock([
      { data: makeQrCode(), error: null },
      {
        data: {
          id: LOC_ID,
          organization_id: ORG_ID_B, // different org
          branch_id: BRANCH_ID,
          deleted_at: null,
        },
        error: null,
      },
    ]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      QR_ASSIGN_ERRORS.CROSS_ORG_MISMATCH
    );
  });

  it("maps 23505 on qra_one_active_per_qr_idx to QR_ALREADY_ASSIGNED", async () => {
    const supabase = makeSupabaseMock([
      { data: makeQrCode(), error: null },
      {
        data: {
          id: LOC_ID,
          organization_id: ORG_ID,
          branch_id: BRANCH_ID,
          deleted_at: null,
        },
        error: null,
      },
      {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "qra_one_active_per_qr_idx"',
        },
      },
    ]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      QR_ASSIGN_ERRORS.QR_ALREADY_ASSIGNED
    );
  });

  it("maps 23505 on qra_one_active_per_target_idx to TARGET_ALREADY_HAS_QR", async () => {
    const supabase = makeSupabaseMock([
      { data: makeQrCode(), error: null },
      {
        data: {
          id: LOC_ID,
          organization_id: ORG_ID,
          branch_id: BRANCH_ID,
          deleted_at: null,
        },
        error: null,
      },
      {
        data: null,
        error: {
          code: "23505",
          message: 'duplicate key value violates unique constraint "qra_one_active_per_target_idx"',
        },
      },
    ]);

    const result = await QrAssignmentsService.assignToTarget(supabase as never, baseInput);

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe(
      QR_ASSIGN_ERRORS.TARGET_ALREADY_HAS_QR
    );
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.getActiveForQr
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.getActiveForQr", () => {
  it("returns the active assignment when found", async () => {
    const assignment = makeAssignment();
    const supabase = makeSupabaseMock([{ data: assignment, error: null }]);

    const result = await QrAssignmentsService.getActiveForQr(supabase as never, QR_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.id).toBe(ASSIGN_ID);
  });

  it("returns null when no active assignment exists", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.getActiveForQr(supabase as never, QR_ID);

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "query failed" } }]);

    const result = await QrAssignmentsService.getActiveForQr(supabase as never, QR_ID);

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.getActiveForTarget
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.getActiveForTarget", () => {
  it("returns the active assignment for a target", async () => {
    const assignment = makeAssignment();
    const supabase = makeSupabaseMock([{ data: assignment, error: null }]);

    const result = await QrAssignmentsService.getActiveForTarget(
      supabase as never,
      "warehouse.location",
      LOC_ID
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.data?.target_id).toBe(LOC_ID);
  });

  it("returns null when target has no active QR", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.getActiveForTarget(
      supabase as never,
      "warehouse.location",
      LOC_ID
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.listByBranch
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.listByBranch", () => {
  it("returns Unauthorized when qr.read is missing", async () => {
    const supabase = makeSupabaseMock([]);

    const result = await QrAssignmentsService.listByBranch(supabase as never, ORG_ID, BRANCH_ID, {
      allow: [],
      deny: [],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns Unauthorized when warehouse.locations.read is missing", async () => {
    const supabase = makeSupabaseMock([]);

    const result = await QrAssignmentsService.listByBranch(supabase as never, ORG_ID, BRANCH_ID, {
      allow: ["qr.read"],
      deny: [],
    });

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toBe("Unauthorized");
  });

  it("returns combined QR + assignment data on success", async () => {
    const qr = makeQrCode();
    const assignment = makeAssignment();
    const row = { ...assignment, qr_codes: qr };
    const supabase = makeSupabaseMock([{ data: [row], error: null }]);

    const result = await QrAssignmentsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      makeFullSnapshot()
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].qr.id).toBe(QR_ID);
      expect(result.data[0].assignment?.target_id).toBe(LOC_ID);
    }
  });

  it("returns empty array when branch has no QR assignments", async () => {
    const supabase = makeSupabaseMock([{ data: [], error: null }]);

    const result = await QrAssignmentsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      makeFullSnapshot()
    );

    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toHaveLength(0);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "join failed" } }]);

    const result = await QrAssignmentsService.listByBranch(
      supabase as never,
      ORG_ID,
      BRANCH_ID,
      makeFullSnapshot()
    );

    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.revokeAssignment
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.revokeAssignment", () => {
  it("returns success when assignment is revoked", async () => {
    const supabase = makeSupabaseMock([{ data: { id: ASSIGN_ID }, error: null }]);

    const result = await QrAssignmentsService.revokeAssignment(
      supabase as never,
      ORG_ID,
      ASSIGN_ID,
      { revokedBy: USER_ID }
    );

    expect(result.success).toBe(true);
  });

  it("returns failure when assignment is not found or already revoked", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.revokeAssignment(
      supabase as never,
      ORG_ID,
      ASSIGN_ID,
      { revokedBy: USER_ID }
    );

    expect(result.success).toBe(false);
    expect((result as { success: false; error: string }).error).toMatch(
      /not found|already revoked/i
    );
  });
});

// ---------------------------------------------------------------------------
// QrAssignmentsService.revokeActiveForQr
// ---------------------------------------------------------------------------

describe("QrAssignmentsService.revokeActiveForQr", () => {
  it("returns success when an active assignment is revoked", async () => {
    // update resolves via .then — no error means success
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.revokeActiveForQr(supabase as never, QR_ID, {
      revokedBy: USER_ID,
    });

    expect(result.success).toBe(true);
  });

  it("returns success even when no active assignment exists (no-op)", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: null }]);

    const result = await QrAssignmentsService.revokeActiveForQr(
      supabase as never,
      "nonexistent-qr",
      { revokedBy: USER_ID }
    );

    expect(result.success).toBe(true);
  });

  it("returns failure on DB error", async () => {
    const supabase = makeSupabaseMock([{ data: null, error: { message: "update error" } }]);

    const result = await QrAssignmentsService.revokeActiveForQr(supabase as never, QR_ID, {
      revokedBy: USER_ID,
    });

    expect(result.success).toBe(false);
  });
});
