import { afterEach, describe, expect, it, vi } from "vitest";
import { vmiPortalSnapshotFixture } from "../fixtures";
import { VmiPortalRepository } from "../repository";

describe("VmiPortalRepository", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a snapshot with the requested active location", async () => {
    const result = await VmiPortalRepository.getSnapshot("loc-poznan");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.user.activeLocationId).toBe("loc-poznan");
    expect(result.data.locations.some((location) => location.id === "loc-poznan")).toBe(true);
  });

  it("scopes inventory, proposals, orders, and stock count requests to the active location", async () => {
    const [inventory, proposals, orders, stockCounts] = await Promise.all([
      VmiPortalRepository.listInventory("loc-komorniki"),
      VmiPortalRepository.listProposals("loc-komorniki"),
      VmiPortalRepository.listOrders("loc-komorniki"),
      VmiPortalRepository.listStockCountRequests("loc-komorniki"),
    ]);

    expect(inventory.success && inventory.data.every((item) => item.locationId === "loc-komorniki")).toBe(true);
    expect(proposals.success && proposals.data.every((item) => item.locationId === "loc-komorniki")).toBe(true);
    expect(orders.success && orders.data.every((item) => item.locationId === "loc-komorniki")).toBe(true);
    expect(stockCounts.success && stockCounts.data.every((item) => item.locationId === "loc-komorniki")).toBe(true);
  });

  it("builds dashboard summary from the active location data", async () => {
    const result = await VmiPortalRepository.getDashboardSummary("loc-komorniki");

    expect(result.success).toBe(true);
    if (!result.success) return;

    const expectedLocationInventory = vmiPortalSnapshotFixture.inventory.filter(
      (item) => item.locationId === "loc-komorniki",
    );
    const expectedLowStock = expectedLocationInventory.filter((item) =>
      ["Approaching minimum", "Below minimum", "Out of stock"].includes(item.status),
    );

    expect(result.data.activeLocation.id).toBe("loc-komorniki");
    expect(result.data.metrics.monitoredItems).toBe(expectedLocationInventory.length);
    expect(result.data.metrics.lowStockItems).toBe(expectedLowStock.length);
    expect(result.data.messageThreads.every((thread) => thread.unreadCount > 0)).toBe(true);
  });

  it("submits stock count line totals through the mock facade", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T08:00:00.000Z"));

    const result = await VmiPortalRepository.submitStockCount({
      locationId: "loc-komorniki",
      lines: [
        { inventoryItemId: "inv-brake-pads", countedQuantity: 4 },
        { inventoryItemId: "inv-oil-filter", countedQuantity: 20 },
      ],
    });

    expect(result).toEqual({
      success: true,
      data: {
        id: "mock-count-1784966400000",
        status: "submitted",
        lineCount: 2,
      },
    });
  });

  it("approves a proposal through the mock facade", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T08:15:00.000Z"));

    const result = await VmiPortalRepository.approveProposal("proposal-001");

    expect(result).toEqual({
      success: true,
      data: {
        proposalId: "proposal-001",
        orderId: "mock-order-1784967300000",
        status: "approved",
      },
    });
  });

  it("creates a mocked outbound message for an existing thread", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-25T08:30:00.000Z"));

    const result = await VmiPortalRepository.sendMessage({
      threadId: "thread-001",
      content: " Proszę o potwierdzenie terminu. ",
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.threadId).toBe("thread-001");
    expect(result.data.message).toMatchObject({
      id: "mock-message-1784968200000",
      sender: "client",
      senderName: "Michał Stępień",
      content: "Proszę o potwierdzenie terminu.",
      timestamp: "2026-07-25T08:30:00.000Z",
    });
  });

  it("rejects message sends for missing threads or blank content", async () => {
    await expect(
      VmiPortalRepository.sendMessage({ threadId: "missing", content: "Test" }),
    ).resolves.toEqual({ success: false, error: "Message thread not found" });

    await expect(
      VmiPortalRepository.sendMessage({ threadId: "thread-001", content: "   " }),
    ).resolves.toEqual({ success: false, error: "Message content is required" });
  });
});
