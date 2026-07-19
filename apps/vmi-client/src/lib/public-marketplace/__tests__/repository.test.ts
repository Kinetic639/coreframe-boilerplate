import { describe, expect, it } from "vitest";
import {
  mockBrands,
  mockCatalogs,
  mockCategories,
  mockCities,
  mockFlyers,
  mockProducts,
  mockPromotions,
  mockVendors
} from "../prototype/mock-data";
import { PublicMarketplaceRepository } from "../repository";

describe("PublicMarketplaceRepository", () => {
  it("returns the complete prototype marketplace snapshot", async () => {
    const result = await PublicMarketplaceRepository.getMarketplaceSnapshot();

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.suppliers).toHaveLength(mockVendors.length);
    expect(result.data.products).toHaveLength(mockProducts.length);
    expect(result.data.catalogs).toHaveLength(mockCatalogs.length);
    expect(result.data.promotions).toHaveLength(mockPromotions.length);
    expect(result.data.flyers).toHaveLength(mockFlyers.length);
    expect(result.data.cities).toHaveLength(mockCities.length);
    expect(result.data.categories).toHaveLength(mockCategories.length);
    expect(result.data.brands).toHaveLength(mockBrands.length);
  });

  it("returns suppliers sorted by geospatial distance when coordinates are provided", async () => {
    const result = await PublicMarketplaceRepository.searchSuppliers({
      latitude: 52.4064,
      longitude: 16.9252,
      radiusKm: 20
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.suppliers.length).toBeGreaterThan(0);
    const firstSupplier = result.data.suppliers[0];
    expect(firstSupplier).toBeDefined();
    expect(firstSupplier?.distanceKm).not.toBeNull();
    expect(result.data.suppliers.every((supplier) => supplier.distanceKm! <= 20)).toBe(true);
  });

  it("filters suppliers by category and VMI readiness", async () => {
    const result = await PublicMarketplaceRepository.searchSuppliers({
      category: "Chemia warsztatowa",
      vmiReadyOnly: true
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.suppliers.length).toBeGreaterThan(0);
    expect(
      result.data.suppliers.every(
        (supplier) => supplier.vmiReady && supplier.categories.includes("Chemia warsztatowa")
      )
    ).toBe(true);
  });

  it("returns details by slug", async () => {
    const result = await PublicMarketplaceRepository.getSupplierBySlug("autoparts-pro");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.contactEmail).toBe("hurtownia@autopartspro.pl");
    expect(result.data.partnershipOptions).toContain("VMI replenishment");
  });

  it("filters prototype products by vendor and query", async () => {
    const result = await PublicMarketplaceRepository.searchProducts({
      vendorId: "mv-1",
      query: "castrol",
      limit: 10
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.products.length).toBeGreaterThan(0);
    expect(
      result.data.products.every(
        (product) =>
          product.vendorId === "mv-1" &&
          `${product.name} ${product.brand} ${product.description}`.toLowerCase().includes("castrol")
      )
    ).toBe(true);
  });

  it("returns catalogs, promotions, and flyers from the prototype dataset", async () => {
    const [catalogs, promotions, flyers] = await Promise.all([
      PublicMarketplaceRepository.listCatalogs({ vendorId: "mv-3" }),
      PublicMarketplaceRepository.listPromotions({ vendorId: "mv-3" }),
      PublicMarketplaceRepository.listFlyers({ vendorId: "mv-3" })
    ]);

    expect(catalogs.success).toBe(true);
    expect(promotions.success).toBe(true);
    expect(flyers.success).toBe(true);
    if (!catalogs.success || !promotions.success || !flyers.success) return;

    expect(catalogs.data.length).toBeGreaterThan(0);
    expect(promotions.data.length).toBeGreaterThan(0);
    expect(flyers.data.length).toBeGreaterThan(0);
  });

  it("accepts quotation requests for products belonging to the selected supplier", async () => {
    const result = await PublicMarketplaceRepository.submitQuotationRequest({
      vendorId: "mv-1",
      clientName: "Anna Buyer",
      companyName: "Buyer Co",
      email: "anna@example.com",
      city: "Poznan",
      postalCode: "60-001",
      businessType: "Workshop",
      contactPreference: "Email",
      expectedDeliveryDate: "2026-08-01",
      message: "Please prepare a quotation for regular replenishment.",
      items: [
        {
          productId: "mp-1",
          quantity: 3,
          unit: "paczka",
          note: "",
          allowSubstitutes: false
        }
      ]
    });

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.enquiryNumber).toMatch(/^VMI-RFQ-/);
    expect(result.data.status).toBe("Wysłane");
  });

  it("rejects partnership requests for unknown suppliers", async () => {
    const result = await PublicMarketplaceRepository.submitPartnershipRequest({
      supplierId: "missing",
      companyName: "Buyer Co",
      contactName: "Anna Buyer",
      email: "anna@example.com",
      city: "Poznan",
      message: "We want to discuss VMI replenishment for multiple locations.",
      requestedCapabilities: ["VMI replenishment"]
    });

    expect(result).toEqual({ success: false, error: "Supplier not found" });
  });
});
