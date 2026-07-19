export type PublicPriceMode = 'exact' | 'from' | 'range' | 'on_request' | 'after_login';
export type PublicAvailability = 'Dostępny' | 'Ograniczona dostępność' | 'Na zamówienie' | 'Zapytaj o dostępność';

export interface PublicVendor {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  coverUrl: string;
  category: string;
  city: string;
  address: string;
  distanceKm: number;
  isVerified: boolean;
  deliveryAvailable: boolean;
  collectionAvailable: boolean;
  shortDescription: string;
  longDescription: string;
  contactEmail: string;
  contactPhone: string;
  openingHours: string;
  serviceArea: string;
  deliveryTerms: string;
  responseTimeText: string;
  profileCompleteness: number;
  featuredBrands: string[];
  productCategories: string[];
}

export interface PublicProduct {
  id: string;
  name: string;
  slug: string;
  vendorId: string;
  brand: string;
  category: string;
  sku: string;
  imageUrl: string;
  priceMode: PublicPriceMode;
  priceValue?: number; // if exact or from
  priceMax?: number; // if range
  availability: PublicAvailability;
  unit: string;
  packSize: number;
  minEnquiryQty: number;
  description: string;
  specifications: Record<string, string>;
  isNew?: boolean;
  sellMode?: 'package' | 'piece' | 'both';
}

export interface PublicCatalog {
  id: string;
  vendorId: string;
  title: string;
  coverUrl: string;
  description: string;
  category: string;
  productCount: number;
  lastUpdated: string;
  productIds: string[];
}

export interface PublicPromotion {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
  badgeText: string;
  productIds: string[];
}

export interface PublicFlyerPage {
  pageNumber: number;
  layoutType: 'hero' | 'grid' | 'duo' | 'comparison' | 'cta';
  title: string;
  productIds: string[];
  headline?: string;
  description?: string;
}

export interface PublicFlyer {
  id: string;
  slug: string;
  vendorId: string;
  title: string;
  coverUrl: string;
  validFrom: string;
  validTo: string;
  pages: PublicFlyerPage[];
}

export interface SavedMarketplaceItem {
  type: 'vendor' | 'product' | 'catalog' | 'promotion' | 'flyer';
  id: string;
  savedAt: string;
}

export interface EnquiryLine {
  productId: string;
  quantity: number;
  unit: 'szt' | 'paczka';
  note: string;
  allowSubstitutes: boolean;
}

export interface EnquiryBasketGroup {
  vendorId: string;
  items: EnquiryLine[];
}

export interface PublicQuotationRequest {
  id: string;
  enquiryNumber: string;
  vendorId: string;
  date: string;
  status: 'Wysłane' | 'Odpowiedziane' | 'Zrealizowane';
  clientName: string;
  companyName: string;
  email: string;
  phone?: string;
  nip?: string;
  city: string;
  postalCode: string;
  deliveryAddress?: string;
  businessType: string;
  contactPreference: string;
  expectedDeliveryDate: string;
  message: string;
  items: EnquiryLine[];
}
