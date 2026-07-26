import "server-only";

import {
  mockBrands,
  mockCatalogs,
  mockCategories,
  mockCities,
  mockFlyers,
  mockProducts,
  mockPromotions,
  mockVendors
} from "./prototype/mock-data";
import type { PublicProduct, PublicVendor } from "./prototype/types";
import type {
  ApiResult,
  MarketplaceListQueryDto,
  MarketplaceSnapshotDto,
  PartnershipRequestDto,
  PartnershipRequestInputDto,
  ProductSearchQueryDto,
  ProductSearchResultDto,
  PublicCatalogDto,
  PublicFlyerDto,
  PublicProductDto,
  PublicPromotionDto,
  PublicSupplierCategoryDto,
  PublicSupplierDetailsDto,
  PublicSupplierDto,
  QuotationRequestDto,
  QuotationRequestInputDto,
  SupplierSearchQueryDto,
  SupplierSearchResultDto
} from "./types";

const DEFAULT_LIMIT = 20;
const PRODUCT_DEFAULT_LIMIT = 24;

const CITY_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  Poznań: { latitude: 52.4064, longitude: 16.9252 },
  Komorniki: { latitude: 52.3387, longitude: 16.8101 },
  Luboń: { latitude: 52.3474, longitude: 16.877 },
  Swadzim: { latitude: 52.4387, longitude: 16.7558 },
  Gniezno: { latitude: 52.5349, longitude: 17.5827 },
  Kalisz: { latitude: 51.7611, longitude: 18.091 },
  Wrocław: { latitude: 51.1079, longitude: 17.0385 },
  Sady: { latitude: 52.4841, longitude: 16.7568 },
  Konin: { latitude: 52.223, longitude: 18.2511 },
  Swarzędz: { latitude: 52.4129, longitude: 17.085 }
};

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function toSlug(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function distanceKm(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number {
  const earthRadiusKm = 6371;
  const latDelta = ((to.latitude - from.latitude) * Math.PI) / 180;
  const lonDelta = ((to.longitude - from.longitude) * Math.PI) / 180;
  const fromLat = (from.latitude * Math.PI) / 180;
  const toLat = (to.latitude * Math.PI) / 180;

  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toSupplierDetails(vendor: PublicVendor): PublicSupplierDetailsDto {
  const geo = CITY_COORDINATES[vendor.city] ?? CITY_COORDINATES.Poznań!;
  const vmiReady = vendor.isVerified && vendor.deliveryAvailable && vendor.profileCompleteness >= 85;

  return {
    id: vendor.id,
    slug: vendor.slug,
    name: vendor.name,
    legalName: vendor.name,
    logoUrl: vendor.logoUrl,
    coverUrl: vendor.coverUrl,
    industry: vendor.category,
    categories: vendor.productCategories,
    city: vendor.city,
    address: vendor.address,
    geo,
    rating: Number((4 + vendor.profileCompleteness / 100).toFixed(1)),
    reviewCount: Math.max(12, Math.round(vendor.profileCompleteness * 1.7)),
    verificationStatus: vendor.isVerified ? "verified" : "unverified",
    responseTimeText: vendor.responseTimeText,
    deliveryAvailable: vendor.deliveryAvailable,
    collectionAvailable: vendor.collectionAvailable,
    vmiReady,
    serviceRadiusKm: Math.max(15, Math.ceil(vendor.distanceKm * 6)),
    shortDescription: vendor.shortDescription,
    longDescription: vendor.longDescription,
    contactEmail: vendor.contactEmail,
    contactPhone: vendor.contactPhone,
    openingHours: vendor.openingHours,
    serviceArea: vendor.serviceArea,
    deliveryTerms: vendor.deliveryTerms,
    featuredBrands: vendor.featuredBrands,
    partnershipOptions: [
      "B2B ordering",
      "Recurring deliveries",
      ...(vmiReady ? ["VMI replenishment"] : []),
      ...(vendor.collectionAvailable ? ["Branch pickup"] : [])
    ]
  };
}

function toPublicSupplier(supplier: PublicSupplierDetailsDto): PublicSupplierDto {
  return {
    id: supplier.id,
    slug: supplier.slug,
    name: supplier.name,
    legalName: supplier.legalName,
    logoUrl: supplier.logoUrl,
    coverUrl: supplier.coverUrl,
    industry: supplier.industry,
    categories: supplier.categories,
    city: supplier.city,
    address: supplier.address,
    geo: supplier.geo,
    rating: supplier.rating,
    reviewCount: supplier.reviewCount,
    verificationStatus: supplier.verificationStatus,
    responseTimeText: supplier.responseTimeText,
    deliveryAvailable: supplier.deliveryAvailable,
    collectionAvailable: supplier.collectionAvailable,
    vmiReady: supplier.vmiReady,
    serviceRadiusKm: supplier.serviceRadiusKm,
    shortDescription: supplier.shortDescription
  };
}

function toProduct(product: PublicProduct): PublicProductDto {
  return { ...product };
}

function filterByVendorAndCategory<T extends { vendorId: string; category?: string }>(
  items: T[],
  query: MarketplaceListQueryDto = {}
): T[] {
  const vendorId = query.vendorId ? normalize(query.vendorId) : null;
  const category = query.category ? normalize(query.category) : null;

  return items
    .filter((item) => {
      if (vendorId && normalize(item.vendorId) !== vendorId) return false;
      if (category && item.category && normalize(item.category) !== category) return false;
      return true;
    })
    .slice(0, query.limit ?? DEFAULT_LIMIT);
}

function stableRequestSuffix(seed: string): string {
  return Array.from(seed)
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
    .toString()
    .padStart(6, "0")
    .slice(-6);
}

const suppliers = mockVendors.map(toSupplierDetails);

export class PublicMarketplaceRepository {
  static async getMarketplaceSnapshot(): Promise<ApiResult<MarketplaceSnapshotDto>> {
    return {
      success: true,
      data: {
        suppliers,
        products: mockProducts.map(toProduct),
        catalogs: mockCatalogs,
        promotions: mockPromotions,
        flyers: mockFlyers,
        cities: mockCities,
        categories: mockCategories,
        brands: mockBrands
      }
    };
  }

  static async listCategories(): Promise<ApiResult<PublicSupplierCategoryDto[]>> {
    const counts = new Map<string, number>();

    for (const supplier of suppliers) {
      for (const category of supplier.categories) {
        counts.set(category, (counts.get(category) ?? 0) + 1);
      }
    }

    return {
      success: true,
      data: mockCategories
        .map((name) => ({
          slug: toSlug(name),
          name,
          supplierCount: counts.get(name) ?? 0
        }))
        .sort((a, b) => a.name.localeCompare(b.name))
    };
  }

  static async searchSuppliers(
    query: SupplierSearchQueryDto = {}
  ): Promise<ApiResult<SupplierSearchResultDto>> {
    const categoriesResult = await this.listCategories();
    if (!categoriesResult.success) return { success: false, error: categoriesResult.error };

    const term = query.query ? normalize(query.query) : null;
    const category = query.category ? normalize(query.category) : null;
    const industry = query.industry ? normalize(query.industry) : null;
    const city = query.city ? normalize(query.city) : null;
    const hasGeo = query.latitude !== undefined && query.longitude !== undefined;
    const origin = hasGeo ? { latitude: query.latitude!, longitude: query.longitude! } : null;
    const radiusKm = query.radiusKm;
    const limit = query.limit ?? DEFAULT_LIMIT;

    const results = suppliers
      .map((supplier) => {
        const computedDistance = origin ? distanceKm(origin, supplier.geo) : null;
        return { supplier, distanceKm: computedDistance };
      })
      .filter(({ supplier, distanceKm: computedDistance }) => {
        if (term) {
          const searchable = [
            supplier.name,
            supplier.legalName,
            supplier.city,
            supplier.industry,
            supplier.shortDescription,
            ...supplier.categories,
            ...supplier.featuredBrands
          ]
            .map(normalize)
            .join(" ");
          if (!searchable.includes(term)) return false;
        }

        if (category && !supplier.categories.some((item) => normalize(item) === category)) {
          return false;
        }

        if (industry && normalize(supplier.industry) !== industry) return false;
        if (city && normalize(supplier.city) !== city) return false;
        if (query.vmiReadyOnly && !supplier.vmiReady) return false;
        if (query.verifiedOnly && supplier.verificationStatus !== "verified") return false;
        if (radiusKm !== undefined && computedDistance !== null && computedDistance > radiusKm) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
        return b.supplier.rating - a.supplier.rating;
      });

    return {
      success: true,
      data: {
        suppliers: results.slice(0, limit).map(({ supplier, distanceKm: computedDistance }) => ({
          ...toPublicSupplier(supplier),
          distanceKm:
            computedDistance === null ? null : Number.parseFloat(computedDistance.toFixed(1))
        })),
        total: results.length,
        categories: categoriesResult.data
      }
    };
  }

  static async getSupplierBySlug(slug: string): Promise<ApiResult<PublicSupplierDetailsDto>> {
    const supplier = suppliers.find((item) => item.slug === slug);
    if (!supplier) return { success: false, error: "Supplier not found" };
    return { success: true, data: supplier };
  }

  static async searchProducts(
    query: ProductSearchQueryDto = {}
  ): Promise<ApiResult<ProductSearchResultDto>> {
    const term = query.query ? normalize(query.query) : null;
    const vendorId = query.vendorId ? normalize(query.vendorId) : null;
    const category = query.category ? normalize(query.category) : null;
    const brand = query.brand ? normalize(query.brand) : null;
    const limit = query.limit ?? PRODUCT_DEFAULT_LIMIT;

    const products = mockProducts
      .filter((product) => {
        if (term) {
          const searchable = [
            product.name,
            product.brand,
            product.category,
            product.sku,
            product.description,
            ...Object.values(product.specifications)
          ]
            .map(normalize)
            .join(" ");
          if (!searchable.includes(term)) return false;
        }

        if (vendorId && normalize(product.vendorId) !== vendorId) return false;
        if (category && normalize(product.category) !== category) return false;
        if (brand && normalize(product.brand) !== brand) return false;
        if (query.availability && product.availability !== query.availability) return false;
        if (query.priceMode && product.priceMode !== query.priceMode) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      success: true,
      data: {
        products: products.slice(0, limit).map(toProduct),
        total: products.length,
        categories: mockCategories,
        brands: mockBrands
      }
    };
  }

  static async getProductBySlug(slug: string): Promise<ApiResult<PublicProductDto>> {
    const product = mockProducts.find((item) => item.slug === slug);
    if (!product) return { success: false, error: "Product not found" };
    return { success: true, data: toProduct(product) };
  }

  static async listCatalogs(
    query: MarketplaceListQueryDto = {}
  ): Promise<ApiResult<PublicCatalogDto[]>> {
    return { success: true, data: filterByVendorAndCategory(mockCatalogs, query) };
  }

  static async getCatalogById(id: string): Promise<ApiResult<PublicCatalogDto>> {
    const catalog = mockCatalogs.find((item) => item.id === id);
    if (!catalog) return { success: false, error: "Catalog not found" };
    return { success: true, data: catalog };
  }

  static async listPromotions(
    query: MarketplaceListQueryDto = {}
  ): Promise<ApiResult<PublicPromotionDto[]>> {
    const vendorId = query.vendorId ? normalize(query.vendorId) : null;
    const promotions = mockPromotions
      .filter((promotion) => !vendorId || normalize(promotion.vendorId) === vendorId)
      .slice(0, query.limit ?? DEFAULT_LIMIT);

    return { success: true, data: promotions };
  }

  static async listFlyers(query: MarketplaceListQueryDto = {}): Promise<ApiResult<PublicFlyerDto[]>> {
    const vendorId = query.vendorId ? normalize(query.vendorId) : null;
    const flyers = mockFlyers
      .filter((flyer) => !vendorId || normalize(flyer.vendorId) === vendorId)
      .slice(0, query.limit ?? DEFAULT_LIMIT);

    return { success: true, data: flyers };
  }

  static async getFlyerBySlug(slug: string): Promise<ApiResult<PublicFlyerDto>> {
    const flyer = mockFlyers.find((item) => item.slug === slug);
    if (!flyer) return { success: false, error: "Flyer not found" };
    return { success: true, data: flyer };
  }

  static async submitPartnershipRequest(
    input: PartnershipRequestInputDto
  ): Promise<ApiResult<PartnershipRequestDto>> {
    const supplier = suppliers.find((item) => item.id === input.supplierId);
    if (!supplier) return { success: false, error: "Supplier not found" };

    const submittedAt = new Date().toISOString();
    const suffix = stableRequestSuffix(`${input.supplierId}:${input.email}:${submittedAt}`);

    return {
      success: true,
      data: {
        id: `mock-pr-${suffix}`,
        requestNumber: `VMI-REQ-${suffix}`,
        supplierId: input.supplierId,
        status: "received",
        submittedAt
      }
    };
  }

  static async submitQuotationRequest(
    input: QuotationRequestInputDto
  ): Promise<ApiResult<QuotationRequestDto>> {
    const supplier = suppliers.find((item) => item.id === input.vendorId);
    if (!supplier) return { success: false, error: "Supplier not found" };

    const unknownProduct = input.items.find(
      (item) =>
        !mockProducts.some((product) => product.id === item.productId && product.vendorId === input.vendorId)
    );
    if (unknownProduct) return { success: false, error: "Product not found for supplier" };

    const date = new Date().toISOString();
    const suffix = stableRequestSuffix(`${input.vendorId}:${input.email}:${date}`);

    return {
      success: true,
      data: {
        ...input,
        id: `mock-quote-${suffix}`,
        enquiryNumber: `VMI-RFQ-${suffix}`,
        date,
        status: "Wysłane"
      }
    };
  }
}
