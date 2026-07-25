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
  clientSku: string;
  unit: string;
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
    | "Count outdated";
  lastUpdated: string;
}

export interface VmiPortalProposalDto {
  id: string;
  vendorId: string;
  locationId: string;
  proposalNumber: string;
  status: "Oczekuje na zatwierdzenie" | "Zatwierdzona" | "Odrzucona";
  expiryDate: string;
  urgentLinesCount: number;
  totalValue: number;
}

export interface VmiPortalOrderDto {
  id: string;
  vendorId: string;
  locationId: string;
  orderNumber: string;
  status: "Wysłane" | "Potwierdzone" | "W przygotowaniu" | "Dostarczone";
  requestedDeliveryDate: string;
  totalValue: number;
}

export interface VmiPortalMessageThreadDto {
  id: string;
  vendorId: string;
  subject: string;
  unreadCount: number;
  lastUpdated: string;
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
}
