/**
 * @vitest-environment node
 *
 * Unit tests for POST /api/qr/labels.
 *
 * All external dependencies are mocked. Tests cover:
 *  - 400 for missing/invalid body
 *  - 400 for empty qrCodeIds
 *  - 400 for too many IDs (> 200)
 *  - 400 for invalid labelSize
 *  - 401 when unauthenticated
 *  - 403 when qr.export missing from snapshot
 *  - 403 when target read permission missing
 *  - 404 when QR code not found / wrong org
 *  - 400 when QR code is revoked
 *  - 400 when QR code has no active assignment
 *  - 400 when target type is unsupported
 *  - 200 success → returns application/pdf
 *  - audit event failure does not break successful response
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const {
  mockLoadDashboardContextV2,
  mockCreateClient,
  mockQrCodesGetById,
  mockQrAssignmentsGetActiveForQr,
  mockGetTargetDescriptor,
  mockGenerateStyledQrSvgDataUrl,
  mockGenerateQrLabelsPdf,
  mockEventServiceEmit,
} = vi.hoisted(() => ({
  mockLoadDashboardContextV2: vi.fn(),
  mockCreateClient: vi.fn(),
  mockQrCodesGetById: vi.fn(),
  mockQrAssignmentsGetActiveForQr: vi.fn(),
  mockGetTargetDescriptor: vi.fn(),
  mockGenerateStyledQrSvgDataUrl: vi.fn(),
  mockGenerateQrLabelsPdf: vi.fn(),
  mockEventServiceEmit: vi.fn(),
}));

vi.mock("@/server/loaders/v2/load-dashboard-context.v2", () => ({
  loadDashboardContextV2: mockLoadDashboardContextV2,
}));

vi.mock("@/utils/supabase/server", () => ({
  createClient: mockCreateClient,
}));

vi.mock("@/server/services/qr.service", () => ({
  QrCodesService: { getById: mockQrCodesGetById },
  QrAssignmentsService: { getActiveForQr: mockQrAssignmentsGetActiveForQr },
}));

vi.mock("@/server/qr/target-registry", () => ({
  getTargetDescriptor: mockGetTargetDescriptor,
}));

vi.mock("@/lib/qr/generate", () => ({
  generateStyledQrSvgDataUrl: mockGenerateStyledQrSvgDataUrl,
}));

vi.mock("@/server/qr/label-pdf", () => ({
  generateQrLabelsPdf: mockGenerateQrLabelsPdf,
}));

vi.mock("@/server/services/event.service", () => ({
  eventService: { emit: mockEventServiceEmit },
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { POST } from "../route";

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

const ORG_ID = "org-aaa-111";
const USER_ID = "user-bbb-222";
const QR_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const LOC_ID = "b1c2d3e4-f5a6-7890-bcde-fa2345678901";
const ASSIGN_ID = "c1d2e3f4-a5b6-7890-cdef-ab3456789012";
const STUB_PDF = Buffer.from("%PDF-stub");
const STUB_DATA_URL = "data:image/png;base64,abc123";

function makeContext(permAllow: string[] = ["qr.export", "warehouse.locations.read"]) {
  return {
    app: { activeOrgId: ORG_ID, activeBranchId: "branch-111" },
    user: {
      user: { id: USER_ID },
      permissionSnapshot: { allow: permAllow, deny: [] },
    },
  };
}

function makeQrCode(overrides = {}) {
  return {
    id: QR_ID,
    organization_id: ORG_ID,
    token: "AbCdEfGhIjKlMnOpQrSt12",
    status: "active",
    label: "Test",
    ...overrides,
  };
}

function makeAssignment(overrides = {}) {
  return {
    id: ASSIGN_ID,
    qr_code_id: QR_ID,
    organization_id: ORG_ID,
    branch_id: "branch-111",
    target_type: "warehouse.location",
    target_id: LOC_ID,
    revoked_at: null,
    ...overrides,
  };
}

function makeDescriptor(readPermission = "warehouse.locations.read") {
  return {
    type: "warehouse.location",
    requiredReadPermission: readPermission,
    requiredAssignPermission: "warehouse.locations.manage",
    getLabelContext: vi.fn().mockResolvedValue({
      primaryText: "Rack A1",
      secondaryText: "LOC-001",
      tertiaryText: "Warehouse Location",
    }),
    validate: vi.fn(),
    resolverPath: vi.fn(),
  };
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/qr/labels", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setupHappyPath() {
  mockLoadDashboardContextV2.mockResolvedValue(makeContext());
  mockCreateClient.mockResolvedValue({});
  mockQrCodesGetById.mockResolvedValue({ success: true, data: makeQrCode() });
  mockQrAssignmentsGetActiveForQr.mockResolvedValue({ success: true, data: makeAssignment() });
  mockGetTargetDescriptor.mockReturnValue(makeDescriptor());
  mockGenerateStyledQrSvgDataUrl.mockResolvedValue(STUB_DATA_URL);
  mockGenerateQrLabelsPdf.mockResolvedValue(STUB_PDF);
  mockEventServiceEmit.mockResolvedValue({ success: true });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Input validation — 400
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — input validation", () => {
  beforeEach(() => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext());
    mockCreateClient.mockResolvedValue({});
  });

  it("returns 400 for non-JSON body", async () => {
    const req = new NextRequest("http://localhost/api/qr/labels", {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for empty qrCodeIds", async () => {
    const res = await POST(makeRequest({ qrCodeIds: [], labelSize: "50x30" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
  });

  it("returns 400 when qrCodeIds exceeds 200", async () => {
    const ids = Array.from({ length: 201 }, () => QR_ID);
    const res = await POST(makeRequest({ qrCodeIds: ids, labelSize: "50x30" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for non-UUID in qrCodeIds", async () => {
    const res = await POST(makeRequest({ qrCodeIds: ["not-a-uuid"], labelSize: "50x30" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid labelSize", async () => {
    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "letter" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing labelSize", async () => {
    const res = await POST(makeRequest({ qrCodeIds: [QR_ID] }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Auth — 401
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — auth", () => {
  it("returns 401 when context is null (unauthenticated)", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(null);

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(401);
  });

  it("returns 401 when activeOrgId is missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue({
      app: { activeOrgId: null, activeBranchId: null },
      user: { user: { id: USER_ID }, permissionSnapshot: { allow: [], deny: [] } },
    });

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Permission — 403
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — permissions", () => {
  it("returns 403 when qr.export is missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext(["warehouse.locations.read"]));

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/permission/i);
  });

  it("returns 403 when target read permission is missing", async () => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext(["qr.export"]));
    mockCreateClient.mockResolvedValue({});
    mockQrCodesGetById.mockResolvedValue({ success: true, data: makeQrCode() });
    mockQrAssignmentsGetActiveForQr.mockResolvedValue({ success: true, data: makeAssignment() });
    mockGetTargetDescriptor.mockReturnValue(makeDescriptor("warehouse.locations.read"));

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// QR code data issues — 4xx
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — QR data validation", () => {
  beforeEach(() => {
    mockLoadDashboardContextV2.mockResolvedValue(makeContext());
    mockCreateClient.mockResolvedValue({});
  });

  it("returns 404 when QR code is not found or wrong org", async () => {
    mockQrCodesGetById.mockResolvedValue({ success: true, data: null });

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(404);
  });

  it("returns 400 when QR code is revoked", async () => {
    mockQrCodesGetById.mockResolvedValue({
      success: true,
      data: makeQrCode({ status: "revoked" }),
    });

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/revoked/i);
  });

  it("returns 400 when QR code has no active assignment", async () => {
    mockQrCodesGetById.mockResolvedValue({ success: true, data: makeQrCode() });
    mockQrAssignmentsGetActiveForQr.mockResolvedValue({ success: true, data: null });

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/active assignment/i);
  });

  it("returns 400 for unsupported target type", async () => {
    mockQrCodesGetById.mockResolvedValue({ success: true, data: makeQrCode() });
    mockQrAssignmentsGetActiveForQr.mockResolvedValue({
      success: true,
      data: makeAssignment({ target_type: "unknown.type" }),
    });
    mockGetTargetDescriptor.mockReturnValue(null);

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// Success — 200 + application/pdf
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — success", () => {
  it("returns 200 with application/pdf content-type", async () => {
    setupHappyPath();

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("qr-labels.pdf");
  });

  it("returns the PDF buffer as the response body", async () => {
    setupHappyPath();

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "a4-grid" }));
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.toString()).toContain("%PDF");
  });

  it("deduplicates repeated qrCodeIds before processing", async () => {
    setupHappyPath();

    // Send same ID three times
    await POST(makeRequest({ qrCodeIds: [QR_ID, QR_ID, QR_ID], labelSize: "50x30" }));

    // Service should be called exactly once due to deduplication
    expect(mockQrCodesGetById).toHaveBeenCalledTimes(1);
  });

  it("emits the qr.labels.exported audit event on success", async () => {
    setupHappyPath();

    await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "70x40" }));

    // Event is emitted asynchronously — allow the promise to settle
    await vi.waitFor(() => {
      expect(mockEventServiceEmit).toHaveBeenCalledOnce();
    });

    const emitCall = mockEventServiceEmit.mock.calls[0][0];
    expect(emitCall.actionKey).toBe("qr.labels.exported");
    expect(emitCall.metadata.label_count).toBe(1);
    expect(emitCall.metadata.label_size).toBe("70x40");
  });
});

// ---------------------------------------------------------------------------
// Resilience — audit event failure must not break the response
// ---------------------------------------------------------------------------

describe("POST /api/qr/labels — resilience", () => {
  it("returns 200 even when audit event emission throws", async () => {
    setupHappyPath();
    mockEventServiceEmit.mockRejectedValue(new Error("event bus down"));

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
  });

  it("returns 500 when PDF generation throws", async () => {
    setupHappyPath();
    mockGenerateQrLabelsPdf.mockRejectedValue(new Error("renderer crashed"));

    const res = await POST(makeRequest({ qrCodeIds: [QR_ID], labelSize: "50x30" }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toMatch(/PDF generation/i);
  });
});
