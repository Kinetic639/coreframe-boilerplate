import { vmiPortalSnapshotFixture } from "./fixtures";
import type {
  VmiPortalDashboardDto,
  VmiPortalInventoryItemDto,
  VmiPortalMessageThreadDto,
  VmiPortalOrderDto,
  VmiPortalProposalDto,
  VmiPortalResult,
  VmiPortalSnapshotDto,
  VmiPortalStockCountRequestDto,
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

  static async listStockCountRequests(
    locationId?: string,
  ): Promise<VmiPortalResult<VmiPortalStockCountRequestDto[]>> {
    const snapshot = activeLocationSnapshot(locationId);
    return ok(
      snapshot.stockCountRequests.filter(
        (request) => request.locationId === snapshot.user.activeLocationId,
      ),
    );
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

  static async createOrder(input: {
    locationId: string;
    lines: Array<{ inventoryItemId: string; requestedQty: number }>;
    notes?: string;
  }): Promise<VmiPortalResult<VmiPortalOrderDto>> {
    if (input.lines.length === 0) return { success: false, error: "Order must contain at least one line" };

    const normalizedLines = input.lines.map((line) => ({
      ...line,
      requestedQty: Math.trunc(line.requestedQty),
    }));
    if (normalizedLines.some((line) => line.requestedQty <= 0)) {
      return { success: false, error: "Order quantities must be positive" };
    }

    const inventoryItems = normalizedLines.map((line) =>
      vmiPortalSnapshotFixture.inventory.find((item) => item.id === line.inventoryItemId),
    );
    if (inventoryItems.some((item) => !item)) return { success: false, error: "Order contains unknown item" };

    const concreteItems = inventoryItems as VmiPortalInventoryItemDto[];
    if (concreteItems.some((item) => item.locationId !== input.locationId)) {
      return { success: false, error: "Order contains item outside selected location" };
    }

    const vendorIds = new Set(concreteItems.map((item) => item.vendorId));
    if (vendorIds.size !== 1) return { success: false, error: "Order can contain items from one vendor only" };
    const firstItem = concreteItems[0];
    if (!firstItem) return { success: false, error: "Order must contain at least one line" };

    const createdAt = new Date();
    const requestedDeliveryDate = new Date(createdAt);
    requestedDeliveryDate.setDate(requestedDeliveryDate.getDate() + 3);

    const orderLines = normalizedLines.map((line) => {
      const item = concreteItems.find((inventoryItem) => inventoryItem.id === line.inventoryItemId);
      const price = item?.promoPrice ?? item?.price ?? 0;
      return {
        inventoryItemId: line.inventoryItemId,
        requestedQty: line.requestedQty,
        confirmedQty: 0,
        shippedQty: 0,
        deliveredQty: 0,
        price,
      };
    });

    const totalValue = orderLines.reduce((sum, line) => sum + line.price * line.requestedQty, 0);

    return ok({
      id: `mock-order-${Date.now()}`,
      vendorId: firstItem.vendorId,
      locationId: input.locationId,
      orderNumber: `ZAM-DEMO-${Date.now()}`,
      date: createdAt.toISOString().slice(0, 10),
      status: "Wysłane",
      requestedDeliveryDate: requestedDeliveryDate.toISOString().slice(0, 10),
      origin: "Zamówienie ręczne",
      notes: input.notes,
      hasAttachment: false,
      totalValue,
      lines: orderLines,
      timeline: [
        {
          status: "Wysłane",
          date: createdAt.toISOString().slice(0, 16).replace("T", " "),
          description: "Utworzono ręczne zamówienie z katalogu VMI klienta.",
        },
      ],
    });
  }

  static async sendMessage(input: {
    threadId: string;
    content: string;
  }): Promise<
    VmiPortalResult<{
      threadId: string;
      message: VmiPortalMessageThreadDto["messages"][number];
    }>
  > {
    const thread = vmiPortalSnapshotFixture.messageThreads.find((item) => item.id === input.threadId);
    if (!thread) return { success: false, error: "Message thread not found" };
    const content = input.content.trim();
    if (!content) return { success: false, error: "Message content is required" };

    return ok({
      threadId: thread.id,
      message: {
        id: `mock-message-${Date.now()}`,
        sender: "client",
        senderName: vmiPortalSnapshotFixture.user.name,
        content,
        timestamp: new Date().toISOString(),
      },
    });
  }
}
