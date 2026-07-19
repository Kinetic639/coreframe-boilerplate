export type UserRole = 'Organization Administrator' | 'Branch Manager' | 'Buyer' | 'Stock Counter' | 'Viewer';

export interface UserProfile {
  name: string;
  role: UserRole;
  organization: string;
  currentLocationId: string;
}

export interface ClientLocation {
  id: string;
  name: string;
  address: string;
}

export interface Vendor {
  id: string;
  name: string;
  industry: string;
  accentColor: string; // e.g., 'blue', 'orange', 'green', 'rose'
  logoUrl?: string;
  connectionStatus: 'Aktywny' | 'Wstrzymany';
  accountManager: {
    name: string;
    phone: string;
    email: string;
  };
  announcements: Announcement[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
}

export interface Product {
  id: string;
  vendorId: string;
  name: string;
  vendorSku: string;
  clientSku: string;
  category: string;
  unitOfMeasure: string; // np. 'szt.', 'kpl.', 'op.'
  packSize: number; // wielokrotność opakowania np. 4, 10
  minOrderQty: number;
  price: number; // w PLN
  promoPrice?: number;
  availability: 'Wysoka' | 'Średnia' | 'Niska' | 'Brak';
  leadTime: string; // np. '24h', '2-3 dni'
  imageUrl: string;
  description: string;
  documents: { name: string; url: string }[];
  notes?: string;
  substitutes?: string[]; // IDs of products
  warehouseQty?: number;
}

export interface InventoryBalance {
  productId: string;
  locationId: string;
  currentStock: number;
  minStock: number;
  targetStock: number;
  incomingQty: number;
  lastUpdated: string; // ISO date
  stockStatus: 'Healthy' | 'Approaching minimum' | 'Below minimum' | 'Out of stock' | 'Overstocked' | 'Count outdated' | 'Needs verification';
}

export interface StockCountRequest {
  id: string;
  vendorId: string;
  locationId: string;
  title: string;
  deadline: string;
  status: 'Oczekujące' | 'Ukończone';
  productIds: string[];
}

export interface StockCountItemSession {
  productId: string;
  countedQty: number | null;
  status: 'not_counted' | 'counted' | 'zero_stock' | 'unable_to_count' | 'recount' | 'note_added';
  note?: string;
}

export interface StockCountSession {
  id: string;
  vendorId: string;
  locationId: string;
  mode: 'requested' | 'low_stock' | 'full_assortment' | 'custom';
  items: StockCountItemSession[];
  lastSaved: string;
  isSynced: boolean;
}

export interface ReplenishmentProposalLine {
  productId: string;
  currentStock: number;
  minStock: number;
  targetStock: number;
  incomingQty: number;
  suggestedQty: number;
  finalProposedQty: number; // adjustable by client
  price: number;
  reason: string;
  status: 'suggested' | 'approved' | 'modified' | 'rejected';
  clientComment?: string;
}

export interface ReplenishmentProposal {
  id: string;
  vendorId: string;
  locationId: string;
  proposalNumber: string;
  date: string;
  expiryDate: string;
  lines: ReplenishmentProposalLine[];
  status: 'Wersja robocza' | 'Oczekuje na zatwierdzenie' | 'Częściowo zatwierdzona' | 'Zatwierdzona' | 'Odrzucona' | 'Przekształcona w zamówienie';
  urgentLinesCount: number;
}

export interface OrderLine {
  productId: string;
  requestedQty: number;
  confirmedQty: number;
  shippedQty: number;
  deliveredQty: number;
  price: number;
  substitutionProductId?: string;
}

export interface Order {
  id: string;
  vendorId: string;
  locationId: string;
  orderNumber: string;
  date: string;
  requestedDeliveryDate: string;
  confirmedDeliveryDate?: string;
  origin: 'Zamówienie ręczne' | 'Propozycja uzupełnienia' | 'Zaakceptowana oferta' | 'Ponowne zamówienie';
  status: 'Szkic' | 'Wysłane' | 'W trakcie weryfikacji' | 'Potwierdzone' | 'Częściowo potwierdzone' | 'W przygotowaniu' | 'Wysłane (Kurier)' | 'Dostarczone' | 'Anulowane';
  lines: OrderLine[];
  poReference?: string;
  notes?: string;
  hasAttachment: boolean;
  timeline: { status: string; date: string; description: string }[];
}

export interface Promotion {
  id: string;
  vendorId: string;
  title: string;
  bannerUrl: string;
  validFrom: string;
  validTo: string;
  description: string;
  productIds: string[];
  badgeText?: string;
}

export interface DigitalFlyer {
  id: string;
  vendorId: string;
  title: string;
  coverUrl: string;
  validFrom: string;
  validTo: string;
  pages: {
    pageNumber: number;
    productIds: string[];
    layoutType: 'grid' | 'hero' | 'duo';
  }[];
}

export interface Showroom {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  sections: {
    title: string;
    description?: string;
    productIds: string[];
  }[];
}

export interface Quotation {
  id: string;
  vendorId: string;
  quotationNumber: string;
  validTo: string;
  lines: {
    productId: string;
    qty: number;
    originalPrice: number;
    offeredPrice: number;
  }[];
  deliveryConditions: string;
  notes?: string;
  totalValue: number;
  status: 'Oczekująca' | 'Zaakceptowana' | 'Odrzucona' | 'Wymaga zmian' | 'Przekształcona w zamówienie';
}

export interface Request {
  id: string;
  vendorId: string;
  locationId: string;
  type: 'Pytanie o produkt' | 'Zapytanie ofertowe' | 'Zapytanie o niedostępny produkt' | 'Prośba o zamiennik' | 'Zgłoszenie problemu z zapasem' | 'Zgłoszenie problemu z dostawą' | 'Ogólne pytanie do dostawcy';
  productId?: string;
  orderId?: string;
  subject: string;
  message: string;
  urgency: 'Niski' | 'Średni' | 'Wysoki' | 'Krytyczny';
  status: 'Otwarte' | 'Dostawca odpowiada' | 'Oczekiwanie na klienta' | 'Rozwiązane' | 'Zamknięte';
  date: string;
}

export interface Message {
  id: string;
  sender: 'client' | 'vendor';
  senderName: string;
  content: string;
  timestamp: string;
}

export interface Conversation {
  id: string;
  vendorId: string;
  subject: string;
  relatedObjectType: 'product' | 'order' | 'proposal' | 'quotation' | 'delivery' | 'none';
  relatedObjectId?: string;
  messages: Message[];
  lastUpdated: string;
  unreadCount: number;
  status: 'active' | 'archived';
}

export interface Notification {
  id: string;
  vendorId?: string;
  type: 'New promotion' | 'New replenishment proposal' | 'Stock-count request' | 'Order status changed' | 'New quotation' | 'Quotation expiring' | 'Delivery update' | 'New vendor message' | 'Low-stock warning';
  title: string;
  content: string;
  date: string;
  isRead: boolean;
  relatedId?: string; // np. ID zamówienia lub oferty
}
