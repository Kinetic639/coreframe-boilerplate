export type ApiResult<T> =
  | { success: true; data: T; error?: never }
  | { success: false; error: string; data?: never };

export type SupplierVerificationStatus = "verified" | "unverified";

export interface GeoPointDto {
  latitude: number;
  longitude: number;
}

export interface PublicSupplierDto {
  id: string;
  slug: string;
  name: string;
  legalName: string;
  logoUrl: string;
  coverUrl: string;
  industry: string;
  categories: string[];
  city: string;
  address: string;
  geo: GeoPointDto;
  rating: number;
  reviewCount: number;
  verificationStatus: SupplierVerificationStatus;
  responseTimeText: string;
  deliveryAvailable: boolean;
  collectionAvailable: boolean;
  vmiReady: boolean;
  serviceRadiusKm: number;
  shortDescription: string;
}

export interface PublicSupplierDetailsDto extends PublicSupplierDto {
  longDescription: string;
  contactEmail: string;
  contactPhone: string;
  openingHours: string;
  serviceArea: string;
  deliveryTerms: string;
  featuredBrands: string[];
  partnershipOptions: string[];
}

export interface PublicSupplierCategoryDto {
  slug: string;
  name: string;
  supplierCount: number;
}

export interface SupplierSearchQueryDto {
  query?: string;
  category?: string;
  industry?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  vmiReadyOnly?: boolean;
  verifiedOnly?: boolean;
  limit?: number;
}

export interface SupplierSearchResultDto {
  suppliers: Array<PublicSupplierDto & { distanceKm: number | null }>;
  total: number;
  categories: PublicSupplierCategoryDto[];
}

export interface PartnershipRequestInputDto {
  supplierId: string;
  companyName: string;
  contactName: string;
  email: string;
  phone?: string;
  city: string;
  message: string;
  requestedCapabilities: string[];
}

export interface PartnershipRequestDto {
  id: string;
  requestNumber: string;
  supplierId: string;
  status: "received";
  submittedAt: string;
}

export type PublicPriceMode = "exact" | "from" | "range" | "on_request" | "after_login";

export type PublicAvailability =
  | "Dostępny"
  | "Ograniczona dostępność"
  | "Na zamówienie"
  | "Zapytaj o dostępność";

export interface PublicProductDto {
  id: string;
  name: string;
  slug: string;
  vendorId: string;
  brand: string;
  category: string;
  sku: string;
  imageUrl: string;
  priceMode: PublicPriceMode;
  priceValue?: number;
  priceMax?: number;
  availability: PublicAvailability;
  unit: string;
  packSize: number;
  minEnquiryQty: number;
  description: string;
  specifications: Record<string, string>;
  isNew?: boolean;
  sellMode?: "package" | "piece" | "both";
}

export interface ProductSearchQueryDto {
  query?: string;
  vendorId?: string;
  category?: string;
  brand?: string;
  availability?: PublicAvailability;
  priceMode?: PublicPriceMode;
  limit?: number;
}

export interface ProductSearchResultDto {
  products: PublicProductDto[];
  total: number;
  categories: string[];
  brands: string[];
}

export interface PublicCatalogDto {
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

export interface PublicPromotionDto {
  id: string;
  vendorId: string;
  title: string;
  description: string;
  validFrom: string;
  validTo: string;
  badgeText: string;
  productIds: string[];
}

export interface PublicFlyerPageDto {
  pageNumber: number;
  layoutType: "hero" | "grid" | "duo" | "comparison" | "cta";
  title: string;
  productIds: string[];
  headline?: string;
  description?: string;
}

export interface PublicFlyerDto {
  id: string;
  slug: string;
  vendorId: string;
  title: string;
  coverUrl: string;
  validFrom: string;
  validTo: string;
  pages: PublicFlyerPageDto[];
}

export interface MarketplaceListQueryDto {
  vendorId?: string;
  category?: string;
  limit?: number;
}

export interface MarketplaceSnapshotDto {
  suppliers: PublicSupplierDetailsDto[];
  products: PublicProductDto[];
  catalogs: PublicCatalogDto[];
  promotions: PublicPromotionDto[];
  flyers: PublicFlyerDto[];
  cities: string[];
  categories: string[];
  brands: string[];
}

export interface EnquiryLineDto {
  productId: string;
  quantity: number;
  unit: "szt" | "paczka";
  note: string;
  allowSubstitutes: boolean;
}

export interface QuotationRequestInputDto {
  vendorId: string;
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
  items: EnquiryLineDto[];
}

export interface QuotationRequestDto extends QuotationRequestInputDto {
  id: string;
  enquiryNumber: string;
  date: string;
  status: "Wysłane";
}
