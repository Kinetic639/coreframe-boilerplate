export type VmiPortalResult<T> = { success: true; data: T } | { success: false; error: string };

export interface VmiPortalUserDto {
  name: string;
  role: string;
  organization: string;
  activeLocationId: string;
}

export interface VmiPortalLocationDto {
  id: string;
  name: string;
  address: string;
}

export interface VmiPortalVendorDto {
  id: string;
  name: string;
  industry: string;
  accentColor: "blue" | "orange" | "green" | "rose";
  connectionStatus: "Aktywny" | "Wstrzymany";
  status: "Aktywny" | "Wstrzymany";
  accountManager: {
    name: string;
    phone: string;
    email: string;
  };
  contacts: Array<{
    name: string;
    role: string;
    phone: string;
    email: string;
    status: "online" | "busy" | "offline";
  }>;
  portfolio: {
    since: string;
    about: string;
    specialties: string[];
    certifications: string[];
  };
  announcements: Array<{
    id: string;
    title: string;
    type: "announcement" | "offer" | "info";
    content: string;
    badgeText: string;
  }>;
}

export interface VmiPortalInventoryItemDto {
  id: string;
  vendorId: string;
  locationId: string;
  productName: string;
  vendorSku: string;
  clientSku: string;
  category: string;
  unit: string;
  packSize: number;
  price: number;
  promoPrice?: number;
  imageUrl: string;
  warehouseQty: number;
  currentStock: number;
  minStock: number;
  targetStock: number;
  incomingQty: number;
  status:
    | "Healthy"
    | "Approaching minimum"
    | "Below minimum"
    | "Out of stock"
    | "Overstocked"
    | "Count outdated"
    | "Needs verification";
  lastUpdated: string;
}

export interface VmiPortalProposalDto {
  id: string;
  vendorId: string;
  locationId: string;
  proposalNumber: string;
  date: string;
  status: "Oczekuje na zatwierdzenie" | "Oczekująca" | "Zaakceptowana" | "Zatwierdzona" | "Odrzucona" | "Wymaga zmian";
  expiryDate: string;
  deliveryConditions: string;
  notes?: string;
  urgentLinesCount: number;
  totalValue: number;
  lines: Array<{
    inventoryItemId: string;
    qty: number;
    originalPrice: number;
    offeredPrice: number;
    reason?: string;
  }>;
}

export interface VmiPortalOrderDto {
  id: string;
  vendorId: string;
  locationId: string;
  orderNumber: string;
  date: string;
  status:
    | "Wysłane"
    | "Potwierdzone"
    | "W przygotowaniu"
    | "Częściowo potwierdzone"
    | "W transporcie"
    | "Wysłane (Kurier)"
    | "Dostarczone"
    | "Anulowane";
  requestedDeliveryDate: string;
  confirmedDeliveryDate?: string;
  origin: string;
  poReference?: string;
  notes?: string;
  hasAttachment: boolean;
  totalValue: number;
  lines: Array<{
    inventoryItemId: string;
    requestedQty: number;
    confirmedQty?: number;
    shippedQty?: number;
    deliveredQty?: number;
    price: number;
  }>;
  timeline: Array<{
    status: string;
    date: string;
    description: string;
  }>;
}

export interface VmiPortalMessageThreadDto {
  id: string;
  vendorId: string;
  subject: string;
  status: "active" | "closed";
  relatedObjectType: "order" | "product" | "proposal" | "quotation" | "delivery" | "none";
  relatedObjectId?: string;
  unreadCount: number;
  lastUpdated: string;
  messages: Array<{
    id: string;
    sender: "client" | "vendor" | "system";
    senderName: string;
    content: string;
    timestamp: string;
  }>;
}

export interface VmiPortalStockCountRequestDto {
  id: string;
  vendorId: string;
  locationId: string;
  title: string;
  deadline: string;
  status: "Oczekujące" | "W trakcie" | "Zakończone";
  inventoryItemIds: string[];
}

export interface VmiPortalDashboardDto {
  user: VmiPortalUserDto;
  locations: VmiPortalLocationDto[];
  activeLocation: VmiPortalLocationDto;
  metrics: {
    vendors: number;
    monitoredItems: number;
    lowStockItems: number;
    pendingProposals: number;
    activeOrders: number;
    unreadMessages: number;
  };
  lowStockItems: VmiPortalInventoryItemDto[];
  pendingProposals: VmiPortalProposalDto[];
  activeOrders: VmiPortalOrderDto[];
  messageThreads: VmiPortalMessageThreadDto[];
}

export interface VmiPortalSnapshotDto {
  user: VmiPortalUserDto;
  locations: VmiPortalLocationDto[];
  vendors: VmiPortalVendorDto[];
  inventory: VmiPortalInventoryItemDto[];
  proposals: VmiPortalProposalDto[];
  orders: VmiPortalOrderDto[];
  messageThreads: VmiPortalMessageThreadDto[];
  stockCountRequests: VmiPortalStockCountRequestDto[];
}
