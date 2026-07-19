import { describe, expect, it } from "vitest";
import { GET as getCatalogs } from "../catalogs/route";
import { GET as getFlyers } from "../flyers/route";
import { GET as getMarketplace } from "../marketplace/route";
import { GET as getCategories } from "../categories/route";
import { POST as postPartnershipRequest } from "../partnership-requests/route";
import { GET as getProducts } from "../products/route";
import { POST as postQuotationRequest } from "../quotation-requests/route";
import { GET as getSuppliers } from "../suppliers/route";
import { GET as getSupplierBySlug } from "../suppliers/[slug]/route";

describe("public marketplace API routes", () => {
  it("lists suppliers through the REST facade", async () => {
    const response = await getSuppliers(
      new Request("http://localhost/api/public/suppliers?verifiedOnly=true&limit=2")
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.suppliers).toHaveLength(2);
  });

  it("returns the full marketplace fixture through the REST facade", async () => {
    const response = await getMarketplace();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.suppliers.length).toBeGreaterThan(5);
    expect(payload.data.products).toHaveLength(100);
    expect(payload.data.catalogs.length).toBeGreaterThan(0);
    expect(payload.data.promotions.length).toBeGreaterThan(0);
    expect(payload.data.flyers.length).toBeGreaterThan(0);
    expect(payload.data.cities.length).toBeGreaterThan(0);
    expect(payload.data.brands.length).toBeGreaterThan(0);
  });

  it("returns supplier details by slug", async () => {
    const response = await getSupplierBySlug(
      new Request("http://localhost/api/public/suppliers/autoparts-pro"),
      { params: Promise.resolve({ slug: "autoparts-pro" }) }
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.slug).toBe("autoparts-pro");
  });

  it("lists categories", async () => {
    const response = await getCategories();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.success).toBe(true);
    expect(payload.data.length).toBeGreaterThan(0);
  });

  it("lists products, catalogs, and flyers", async () => {
    const [productsResponse, catalogsResponse, flyersResponse] = await Promise.all([
      getProducts(new Request("http://localhost/api/public/products?vendorId=mv-3&limit=5")),
      getCatalogs(new Request("http://localhost/api/public/catalogs?vendorId=mv-3")),
      getFlyers(new Request("http://localhost/api/public/flyers?vendorId=mv-3"))
    ]);

    const [products, catalogs, flyers] = await Promise.all([
      productsResponse.json(),
      catalogsResponse.json(),
      flyersResponse.json()
    ]);

    expect(productsResponse.status).toBe(200);
    expect(catalogsResponse.status).toBe(200);
    expect(flyersResponse.status).toBe(200);
    expect(products.data.products.length).toBeGreaterThan(0);
    expect(catalogs.data.length).toBeGreaterThan(0);
    expect(flyers.data.length).toBeGreaterThan(0);
  });

  it("accepts valid partnership requests", async () => {
    const response = await postPartnershipRequest(
      new Request("http://localhost/api/public/partnership-requests", {
        method: "POST",
        body: JSON.stringify({
          supplierId: "mv-1",
          companyName: "Buyer Co",
          contactName: "Anna Buyer",
          email: "anna@example.com",
          city: "Poznan",
          message: "We want to discuss VMI replenishment for multiple locations.",
          requestedCapabilities: ["VMI replenishment"]
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.requestNumber).toMatch(/^VMI-REQ-/);
  });

  it("accepts valid quotation requests", async () => {
    const response = await postQuotationRequest(
      new Request("http://localhost/api/public/quotation-requests", {
        method: "POST",
        body: JSON.stringify({
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
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(payload.success).toBe(true);
    expect(payload.data.enquiryNumber).toMatch(/^VMI-RFQ-/);
  });
});
