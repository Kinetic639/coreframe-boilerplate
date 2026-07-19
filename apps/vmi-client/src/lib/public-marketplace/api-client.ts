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
  QuotationRequestDto,
  QuotationRequestInputDto,
  SupplierSearchQueryDto,
  SupplierSearchResultDto
} from "./types";

const PUBLIC_API_BASE = "/api/public";

function appendQuery(url: URL, query: object) {
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
}

async function readResult<T>(response: Response): Promise<ApiResult<T>> {
  const payload = (await response.json()) as ApiResult<T>;
  return payload;
}

export class PublicMarketplaceApiClient {
  constructor(private readonly baseUrl = PUBLIC_API_BASE) {}

  async getMarketplaceSnapshot(): Promise<ApiResult<MarketplaceSnapshotDto>> {
    const response = await fetch(`${this.baseUrl}/marketplace`);
    return readResult<MarketplaceSnapshotDto>(response);
  }

  async searchSuppliers(query: SupplierSearchQueryDto = {}): Promise<ApiResult<SupplierSearchResultDto>> {
    const url = new URL(`${this.baseUrl}/suppliers`, "http://vmi.local");
    appendQuery(url, query);
    const response = await fetch(`${this.baseUrl}/suppliers${url.search}`);
    return readResult<SupplierSearchResultDto>(response);
  }

  async getSupplier(slug: string): Promise<ApiResult<PublicSupplierDetailsDto>> {
    const response = await fetch(`${this.baseUrl}/suppliers/${encodeURIComponent(slug)}`);
    return readResult<PublicSupplierDetailsDto>(response);
  }

  async listCategories(): Promise<ApiResult<PublicSupplierCategoryDto[]>> {
    const response = await fetch(`${this.baseUrl}/categories`);
    return readResult<PublicSupplierCategoryDto[]>(response);
  }

  async searchProducts(query: ProductSearchQueryDto = {}): Promise<ApiResult<ProductSearchResultDto>> {
    const url = new URL(`${this.baseUrl}/products`, "http://vmi.local");
    appendQuery(url, query);
    const response = await fetch(`${this.baseUrl}/products${url.search}`);
    return readResult<ProductSearchResultDto>(response);
  }

  async getProduct(slug: string): Promise<ApiResult<PublicProductDto>> {
    const response = await fetch(`${this.baseUrl}/products/${encodeURIComponent(slug)}`);
    return readResult<PublicProductDto>(response);
  }

  async listCatalogs(query: MarketplaceListQueryDto = {}): Promise<ApiResult<PublicCatalogDto[]>> {
    const url = new URL(`${this.baseUrl}/catalogs`, "http://vmi.local");
    appendQuery(url, query);
    const response = await fetch(`${this.baseUrl}/catalogs${url.search}`);
    return readResult<PublicCatalogDto[]>(response);
  }

  async getCatalog(id: string): Promise<ApiResult<PublicCatalogDto>> {
    const response = await fetch(`${this.baseUrl}/catalogs/${encodeURIComponent(id)}`);
    return readResult<PublicCatalogDto>(response);
  }

  async listPromotions(
    query: MarketplaceListQueryDto = {}
  ): Promise<ApiResult<PublicPromotionDto[]>> {
    const url = new URL(`${this.baseUrl}/promotions`, "http://vmi.local");
    appendQuery(url, query);
    const response = await fetch(`${this.baseUrl}/promotions${url.search}`);
    return readResult<PublicPromotionDto[]>(response);
  }

  async listFlyers(query: MarketplaceListQueryDto = {}): Promise<ApiResult<PublicFlyerDto[]>> {
    const url = new URL(`${this.baseUrl}/flyers`, "http://vmi.local");
    appendQuery(url, query);
    const response = await fetch(`${this.baseUrl}/flyers${url.search}`);
    return readResult<PublicFlyerDto[]>(response);
  }

  async getFlyer(slug: string): Promise<ApiResult<PublicFlyerDto>> {
    const response = await fetch(`${this.baseUrl}/flyers/${encodeURIComponent(slug)}`);
    return readResult<PublicFlyerDto>(response);
  }

  async submitPartnershipRequest(
    input: PartnershipRequestInputDto
  ): Promise<ApiResult<PartnershipRequestDto>> {
    const response = await fetch(`${this.baseUrl}/partnership-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return readResult<PartnershipRequestDto>(response);
  }

  async submitQuotationRequest(
    input: QuotationRequestInputDto
  ): Promise<ApiResult<QuotationRequestDto>> {
    const response = await fetch(`${this.baseUrl}/quotation-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input)
    });
    return readResult<QuotationRequestDto>(response);
  }
}
