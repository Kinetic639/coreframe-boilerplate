import { vmiPortalSnapshotFixture } from "./fixtures";
import type {
  VmiPortalDashboardDto,
  VmiPortalInventoryItemDto,
  VmiPortalMessageThreadDto,
  VmiPortalOrderDto,
  VmiPortalProposalDto,
  VmiPortalResult,
  VmiPortalSnapshotDto,
  VmiPortalVendorDto,
} from "./types";

function ok<T>(data: T): VmiPortalResult<T> {
  return { success: true, data };
}

function activeLocationSnapshot(locationId?: string): VmiPortalSnapshotDto {
  const activeLocationId = locationId ?? vmiPortalSnapshotFixture.user.activeLocationId;
  return {
    ...vmiPortalSnapshotFixture,
    user: {
      ...vmiPortalSnapshotFixture.user,
      activeLocationId,
    },
  };
}

export class VmiPortalRepository {
  static async getSnapshot(locationId?: string): Promise<VmiPortalResult<VmiPortalSnapshotDto>> {
    return ok(activeLocationSnapshot(locationId));
  }

  static async getDashboardSummary(locationId?: string): Promise<VmiPortalResult<VmiPortalDashboardDto>> {
    const snapshot = activeLocationSnapshot(locationId);
    const activeLocation =
      snapshot.locations.find((location) => location.id === snapshot.user.activeLocationId) ??
      snapshot.locations[0];
    if (!activeLocation) return { success: false, error: "No VMI locations configured" };

    const locationInventory = snapshot.inventory.filter((item) => item.locationId === activeLocation.id);
    const lowStockItems = locationInventory.filter((item) =>
      ["Approaching minimum", "Below minimum", "Out of stock"].includes(item.status),
    );
    const pendingProposals = snapshot.proposals.filter(
      (proposal) =>
        proposal.locationId === activeLocation.id &&
        (proposal.status === "Oczekuje na zatwierdzenie" || proposal.status === "Oczekująca"),
    );
    const activeOrders = snapshot.orders.filter(
      (order) => order.locationId === activeLocation.id && order.status !== "Dostarczone",
    );

    return ok({
      user: snapshot.user,
      locations: snapshot.locations,
      activeLocation,
      metrics: {
        vendors: snapshot.vendors.length,
        monitoredItems: locationInventory.length,
        lowStockItems: lowStockItems.length,
        pendingProposals: pendingProposals.length,
        activeOrders: activeOrders.length,
        unreadMessages: snapshot.messageThreads.reduce((sum, thread) => sum + thread.unreadCount, 0),
      },
      lowStockItems,
      pendingProposals,
      activeOrders,
      messageThreads: snapshot.messageThreads.filter((thread) => thread.unreadCount > 0),
    });
  }

  static async listInventory(locationId?: string): Promise<VmiPortalResult<VmiPortalInventoryItemDto[]>> {
    const snapshot = activeLocationSnapshot(locationId);
    return ok(snapshot.inventory.filter((item) => item.locationId === snapshot.user.activeLocationId));
  }

  static async listVendors(): Promise<VmiPortalResult<VmiPortalVendorDto[]>> {
    return ok(vmiPortalSnapshotFixture.vendors);
  }

  static async listProposals(locationId?: string): Promise<VmiPortalResult<VmiPortalProposalDto[]>> {
    const snapshot = activeLocationSnapshot(locationId);
    return ok(snapshot.proposals.filter((proposal) => proposal.locationId === snapshot.user.activeLocationId));
  }

  static async listOrders(locationId?: string): Promise<VmiPortalResult<VmiPortalOrderDto[]>> {
    const snapshot = activeLocationSnapshot(locationId);
    return ok(snapshot.orders.filter((order) => order.locationId === snapshot.user.activeLocationId));
  }

  static async listMessageThreads(): Promise<VmiPortalResult<VmiPortalMessageThreadDto[]>> {
    return ok(vmiPortalSnapshotFixture.messageThreads);
  }

  static async submitStockCount(input: {
    locationId: string;
    lines: Array<{ inventoryItemId: string; countedQuantity: number }>;
  }): Promise<VmiPortalResult<{ id: string; status: "submitted"; lineCount: number }>> {
    return ok({
      id: `mock-count-${Date.now()}`,
      status: "submitted",
      lineCount: input.lines.length,
    });
  }

  static async approveProposal(
    proposalId: string,
  ): Promise<VmiPortalResult<{ proposalId: string; orderId: string; status: "approved" }>> {
    return ok({
      proposalId,
      orderId: `mock-order-${Date.now()}`,
      status: "approved",
    });
  }
}
