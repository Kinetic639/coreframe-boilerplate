# Stock Movements & Transfers - Implementation Plan

**Version:** 1.0
**Last Updated:** 2025-10-24
**Estimated Timeline:** 6-8 weeks
**Complexity:** High

---

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Phase 1: Enhanced Movement Types](#phase-1-enhanced-movement-types)
4. [Phase 2: Polish Document System](#phase-2-polish-document-system)
5. [Phase 3: Transfer Workflows & UI](#phase-3-transfer-workflows--ui)
6. [Phase 4: Delivery Receiving System](#phase-4-delivery-receiving-system)
7. [Phase 5: E-commerce Integrations](#phase-5-e-commerce-integrations)
8. [Phase 6: JPK_MAG Compliance](#phase-6-jpk_mag-compliance)
9. [Phase 7: Testing & Validation](#phase-7-testing--validation)
10. [Deployment Strategy](#deployment-strategy)

---

## Overview

### Implementation Strategy

This plan follows an **incremental, test-driven approach** to implement a comprehensive stock movement and transfer system. Each phase builds upon the previous one and can be deployed independently.

### Key Principles

1. **Backward Compatibility:** Don't break existing functionality
2. **Data Integrity:** Ensure all movements are traceable and reversible
3. **User Experience:** Prioritize warehouse operator workflows
4. **Compliance First:** Polish legal requirements are non-negotiable
5. **Test Coverage:** 80%+ test coverage for critical paths

### Timeline

| Phase                   | Duration    | Dependencies |
| ----------------------- | ----------- | ------------ |
| Phase 1: Movement Types | 1 week      | None         |
| Phase 2: Documents      | 1.5 weeks   | Phase 1      |
| Phase 3: Transfers UI   | 1.5 weeks   | Phase 1, 2   |
| Phase 4: Deliveries     | 1 week      | Phase 1, 2   |
| Phase 5: E-commerce     | 2 weeks     | Phase 1, 2   |
| Phase 6: JPK_MAG        | 1 week      | Phase 1, 2   |
| Phase 7: Testing        | 1 week      | All phases   |
| **Total**               | **9 weeks** |              |

---

## Prerequisites

### Development Environment

- [x] Supabase project configured
- [x] Next.js 15 development environment
- [x] TypeScript strict mode enabled
- [x] Existing warehouse module structure

### Required Tools

- [ ] PDF generation library (puppeteer or react-pdf)
- [ ] XML generation library for JPK_MAG
- [ ] Queue system for async tasks (optional: BullMQ)

### External Accounts

- [ ] Shopify Partner Account (for testing)
- [ ] WooCommerce test store
- [ ] Allegro Sandbox Account

---

## Phase 1: Enhanced Movement Types

**Duration:** 1 week
**Complexity:** Medium

### Objectives

- Enhance existing movement_types table
- Add Polish document mappings
- Implement SAP-style movement codes
- Create movement type service

### Tasks

#### 1.1 Database Migration

**File:** `supabase/migrations/[timestamp]_enhance_movement_types.sql`

```sql
-- Add new columns to movement_types
ALTER TABLE movement_types
  ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('receipt', 'issue', 'transfer', 'adjustment', 'reservation', 'ecommerce')),
  ADD COLUMN IF NOT EXISTS name_pl TEXT,
  ADD COLUMN IF NOT EXISTS name_en TEXT,
  ADD COLUMN IF NOT EXISTS polish_document_type TEXT,
  ADD COLUMN IF NOT EXISTS requires_source_location BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_destination_location BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS requires_reference BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS allows_manual_entry BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS generates_document BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS cost_impact TEXT CHECK (cost_impact IN ('increase', 'decrease', 'neutral')),
  ADD COLUMN IF NOT EXISTS accounting_entry JSONB,
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Update existing movement types
UPDATE movement_types SET category = 'receipt' WHERE code IN ('initial', 'purchase', 'return_customer', 'production_output');
UPDATE movement_types SET category = 'issue' WHERE code IN ('sale', 'return_supplier', 'damaged', 'production_consume');
UPDATE movement_types SET category = 'transfer' WHERE code IN ('transfer_out', 'transfer_in');
UPDATE movement_types SET category = 'adjustment' WHERE code IN ('adjustment_positive', 'adjustment_negative', 'audit_adjustment');
UPDATE movement_types SET category = 'reservation' WHERE code IN ('reservation', 'reservation_release');

-- Add Polish names
UPDATE movement_types SET
  name_pl = 'Przyjęcie zewnętrzne',
  name_en = 'Goods Receipt',
  polish_document_type = 'PZ'
WHERE code = 'purchase';

-- (Continue for all existing types...)

-- Insert new movement types
INSERT INTO movement_types (code, category, name, name_pl, name_en, polish_document_type, affects_stock, requires_approval, generates_document, is_system) VALUES
  -- Receipts
  ('101', 'receipt', 'GR from PO', 'Przyjęcie z ZP', 'Goods Receipt from PO', 'PZ', 1, false, true, true),
  ('102', 'receipt', 'GR Reversal', 'Korekta PZ', 'GR Reversal', 'PZ-K', -1, true, true, true),
  ('103', 'receipt', 'Customer Return', 'Zwrot od klienta', 'Customer Return Receipt', 'PZ-ZK', 1, false, true, true),
  ('104', 'receipt', 'Production Output', 'Produkcja', 'Production Output', 'PZ-P', 1, false, true, true),
  ('105', 'receipt', 'Initial Stock', 'Stan początkowy', 'Initial Stock', 'PZ-I', 1, true, true, true),

  -- Issues
  ('201', 'issue', 'GI for Sale', 'Wydanie na sprzedaż', 'Goods Issue for Sale', 'WZ', -1, false, true, true),
  ('202', 'issue', 'GI Reversal', 'Korekta WZ', 'GI Reversal', 'WZ-K', 1, true, true, true),
  ('203', 'issue', 'Return to Supplier', 'Zwrot do dostawcy', 'Return to Supplier', 'WZ-ZD', -1, false, true, true),
  ('204', 'issue', 'Production Consumption', 'Zużycie produkcyjne', 'Production Consumption', 'RW-P', -1, false, true, true),
  ('205', 'issue', 'Cost Center Issue', 'Wydanie MPK', 'Issue to Cost Center', 'RW', -1, true, true, true),
  ('206', 'issue', 'Waste/Damage', 'Szkody/Straty', 'Waste/Damage', 'RW-S', -1, true, true, true),

  -- Transfers
  ('301', 'transfer', 'Transfer Out', 'Przesunięcie WY', 'Transfer Out', 'MM-W', -1, false, true, true),
  ('302', 'transfer', 'Transfer In', 'Przesunięcie PR', 'Transfer In', 'MM-P', 1, false, true, true),
  ('303', 'transfer', 'Intra-Location', 'Przesunięcie wew.', 'Intra-Location Move', 'MM-L', 0, false, false, true),
  ('311', 'transfer', 'Inter-Branch Out', 'Transfer między oddziały WY', 'Inter-Branch Out', 'MM-O', -1, true, true, true),
  ('312', 'transfer', 'Inter-Branch In', 'Transfer między oddziały PR', 'Inter-Branch In', 'MM-O', 1, false, true, true),

  -- Adjustments
  ('401', 'adjustment', 'Positive Adjustment', 'Korekta dodatnia', 'Positive Adjustment', 'KP', 1, true, true, true),
  ('402', 'adjustment', 'Negative Adjustment', 'Korekta ujemna', 'Negative Adjustment', 'KN', -1, true, true, true),
  ('403', 'adjustment', 'Audit Adjustment', 'Korekta inwentaryzacyjna', 'Audit Adjustment', 'INW', 0, true, true, true),
  ('411', 'adjustment', 'Quality Reclassification', 'Zmiana statusu', 'Quality Reclassification', 'MM-Q', 0, false, false, true),

  -- E-commerce
  ('601', 'ecommerce', 'Shopify Order', 'Zamówienie Shopify', 'Shopify Order', 'WZ-S', -1, false, true, true),
  ('602', 'ecommerce', 'WooCommerce Order', 'Zamówienie WooCommerce', 'WooCommerce Order', 'WZ-W', -1, false, true, true),
  ('603', 'ecommerce', 'Allegro Order', 'Zamówienie Allegro', 'Allegro Order', 'WZ-A', -1, false, true, true),
  ('611', 'ecommerce', 'Shopify Return', 'Zwrot Shopify', 'Shopify Return', 'PZ-S', 1, false, true, true),
  ('612', 'ecommerce', 'WooCommerce Return', 'Zwrot WooCommerce', 'WooCommerce Return', 'PZ-W', 1, false, true, true),
  ('613', 'ecommerce', 'Allegro Return', 'Zwrot Allegro', 'Allegro Return', 'PZ-A', 1, false, true, true);

-- Update location requirements
UPDATE movement_types SET requires_source_location = true WHERE category IN ('issue', 'transfer');
UPDATE movement_types SET requires_destination_location = true WHERE category IN ('receipt', 'transfer');
UPDATE movement_types SET requires_reference = true WHERE code IN ('101', '201', '601', '602', '603');
```

**Checklist:**

- [ ] Create migration file
- [ ] Test migration on dev database
- [ ] Verify all existing data migrates correctly
- [ ] Run migration on staging
- [ ] Document new movement types

#### 1.2 TypeScript Types

**File:** `src/modules/warehouse/types/movement-types.ts`

```typescript
export type MovementCategory =
  | "receipt"
  | "issue"
  | "transfer"
  | "adjustment"
  | "reservation"
  | "ecommerce";

export type PolishDocumentType =
  | "PZ" // Przyjęcie Zewnętrzne
  | "WZ" // Wydanie Zewnętrzne
  | "MM" // Międzymagazynowe
  | "RW" // Rozchód Wewnętrzny
  | "INW" // Inwentaryzacja
  | "KP" // Korekta Dodatnia
  | "KN"; // Korekta Ujemna

export interface MovementType {
  id: string;
  code: string;
  category: MovementCategory;
  name: string;
  name_pl: string;
  name_en: string;
  polish_document_type: PolishDocumentType | null;
  affects_stock: -1 | 0 | 1;
  requires_approval: boolean;
  requires_source_location: boolean;
  requires_destination_location: boolean;
  requires_reference: boolean;
  allows_manual_entry: boolean;
  generates_document: boolean;
  is_system: boolean;
  cost_impact: "increase" | "decrease" | "neutral";
  accounting_entry?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateMovementData {
  movement_type_code: string;
  product_id: string;
  variant_id?: string;
  quantity: number;
  unit_cost?: number;
  location_id?: string;
  source_location_id?: string;
  destination_location_id?: string;
  reference_type?: string;
  reference_id?: string;
  notes?: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: string;
}
```

**Checklist:**

- [ ] Create types file
- [ ] Export from module index
- [ ] Update database types from Supabase
- [ ] Verify type safety

#### 1.3 Movement Type Service

**File:** `src/modules/warehouse/api/movement-types-service.ts`

```typescript
import { createClient } from "@/utils/supabase/client";
import type { MovementType, MovementCategory } from "../types/movement-types";

class MovementTypesService {
  private supabase = createClient();

  async getMovementTypes(category?: MovementCategory): Promise<MovementType[]> {
    let query = this.supabase.from("movement_types").select("*").order("code");

    if (category) {
      query = query.eq("category", category);
    }

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  }

  async getMovementTypeByCode(code: string): Promise<MovementType | null> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .eq("code", code)
      .single();

    if (error) throw error;
    return data;
  }

  async getManualEntryTypes(): Promise<MovementType[]> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .eq("allows_manual_entry", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getDocumentTypes(documentType: string): Promise<MovementType[]> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .eq("polish_document_type", documentType);

    if (error) throw error;
    return data || [];
  }
}

export const movementTypesService = new MovementTypesService();
```

**Checklist:**

- [ ] Create service file
- [ ] Add error handling
- [ ] Add JSDoc comments
- [ ] Write unit tests
- [ ] Export from module

#### 1.4 Testing

**File:** `__tests__/warehouse/movement-types-service.test.ts`

```typescript
import { describe, it, expect, beforeAll } from "@jest/globals";
import { movementTypesService } from "@/modules/warehouse/api/movement-types-service";

describe("MovementTypesService", () => {
  it("should get all movement types", async () => {
    const types = await movementTypesService.getMovementTypes();
    expect(types.length).toBeGreaterThan(0);
  });

  it("should filter by category", async () => {
    const receipts = await movementTypesService.getMovementTypes("receipt");
    expect(receipts.every((t) => t.category === "receipt")).toBe(true);
  });

  it("should get movement type by code", async () => {
    const type = await movementTypesService.getMovementTypeByCode("101");
    expect(type).toBeDefined();
    expect(type?.code).toBe("101");
    expect(type?.polish_document_type).toBe("PZ");
  });

  it("should only return manual entry types", async () => {
    const types = await movementTypesService.getManualEntryTypes();
    expect(types.every((t) => t.allows_manual_entry)).toBe(true);
  });
});
```

**Checklist:**

- [ ] Write unit tests
- [ ] Test all service methods
- [ ] Test error cases
- [ ] Achieve 80%+ coverage

---

## Phase 2: Polish Document System

**Duration:** 1.5 weeks
**Complexity:** High

### Objectives

- Create warehouse_documents table
- Implement document generation service
- Create PDF templates
- Add document numbering system

### Tasks

#### 2.1 Database Migration

**File:** `supabase/migrations/[timestamp]_create_warehouse_documents.sql`

```sql
-- Warehouse Documents table
CREATE TABLE warehouse_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,

  -- Document identification
  document_type TEXT NOT NULL CHECK (document_type IN ('PZ', 'WZ', 'MM', 'RW', 'INW', 'KP', 'KN')),
  document_number TEXT NOT NULL,
  document_date DATE NOT NULL DEFAULT CURRENT_DATE,

  -- Related movements
  movement_ids UUID[] NOT NULL,

  -- Document details
  from_location_id UUID REFERENCES locations(id),
  to_location_id UUID REFERENCES locations(id),
  supplier_id UUID REFERENCES suppliers(id),
  customer_id UUID,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed', 'printed', 'archived', 'cancelled')),

  -- Users
  created_by UUID NOT NULL REFERENCES users(id),
  confirmed_by UUID REFERENCES users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,

  -- Document content
  document_data JSONB NOT NULL,
  notes TEXT,

  -- PDF storage
  pdf_url TEXT,
  pdf_generated_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  UNIQUE(organization_id, branch_id, document_type, document_number)
);

-- Indexes
CREATE INDEX idx_warehouse_documents_org_branch ON warehouse_documents(organization_id, branch_id);
CREATE INDEX idx_warehouse_documents_type_number ON warehouse_documents(document_type, document_number);
CREATE INDEX idx_warehouse_documents_date ON warehouse_documents(document_date);
CREATE INDEX idx_warehouse_documents_status ON warehouse_documents(status);
CREATE INDEX idx_warehouse_documents_movements ON warehouse_documents USING GIN(movement_ids);

-- Document number sequences (created dynamically per org/branch/type/year/month)
CREATE OR REPLACE FUNCTION get_next_document_number(
  p_org_id UUID,
  p_branch_id UUID,
  p_doc_type TEXT,
  p_date DATE DEFAULT CURRENT_DATE
) RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_seq_name TEXT;
  v_next_num INTEGER;
  v_doc_number TEXT;
BEGIN
  v_year := TO_CHAR(p_date, 'YYYY');
  v_month := TO_CHAR(p_date, 'MM');
  v_seq_name := format('seq_%s_%s_%s_%s', p_doc_type, v_year, v_month, REPLACE(p_branch_id::TEXT, '-', '_'));

  -- Create sequence if doesn't exist
  EXECUTE format('CREATE SEQUENCE IF NOT EXISTS %I', v_seq_name);

  -- Get next value
  EXECUTE format('SELECT nextval(%L)', v_seq_name) INTO v_next_num;

  -- Format document number: TYPE/YYYY/MM/NNNN
  v_doc_number := format('%s/%s/%s/%s', p_doc_type, v_year, v_month, LPAD(v_next_num::TEXT, 4, '0'));

  RETURN v_doc_number;
END;
$$;

-- Trigger to auto-generate document number
CREATE OR REPLACE FUNCTION trigger_generate_document_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.document_number IS NULL OR NEW.document_number = '' THEN
    NEW.document_number := get_next_document_number(
      NEW.organization_id,
      NEW.branch_id,
      NEW.document_type,
      NEW.document_date
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_warehouse_document
  BEFORE INSERT ON warehouse_documents
  FOR EACH ROW
  EXECUTE FUNCTION trigger_generate_document_number();
```

**Checklist:**

- [ ] Create migration
- [ ] Test document numbering
- [ ] Verify sequences work correctly
- [ ] Test on staging

#### 2.2 Document Service

**File:** `src/modules/warehouse/api/warehouse-documents-service.ts`

```typescript
import { createClient } from "@/utils/supabase/client";
import type { PolishDocumentType } from "../types/movement-types";

interface CreateDocumentData {
  documentType: PolishDocumentType;
  movementIds: string[];
  fromLocationId?: string;
  toLocationId?: string;
  supplierId?: string;
  customerId?: string;
  notes?: string;
  documentDate?: string;
}

interface DocumentData {
  items: Array<{
    name: string;
    sku: string;
    quantity: number;
    unit: string;
    unitCost?: number;
    totalCost?: number;
  }>;
  totalValue?: number;
  fromLocation?: string;
  toLocation?: string;
  supplier?: string;
  customer?: string;
}

class WarehouseDocumentsService {
  private supabase = createClient();

  async createDocument(
    data: CreateDocumentData,
    organizationId: string,
    branchId: string,
    userId: string
  ) {
    // 1. Fetch movement details
    const { data: movements, error: movError } = await this.supabase
      .from("stock_movements")
      .select("*, product:products(*), variant:product_variants(*)")
      .in("id", data.movementIds);

    if (movError) throw movError;

    // 2. Build document data
    const documentData: DocumentData = {
      items: movements.map((m) => ({
        name: m.variant?.name || m.product.name,
        sku: m.variant?.sku || m.product.sku,
        quantity: m.quantity,
        unit: m.product.unit,
        unitCost: m.unit_cost,
        totalCost: m.total_cost,
      })),
      totalValue: movements.reduce((sum, m) => sum + (m.total_cost || 0), 0),
    };

    // 3. Fetch location names
    if (data.fromLocationId) {
      const { data: loc } = await this.supabase
        .from("locations")
        .select("name")
        .eq("id", data.fromLocationId)
        .single();
      documentData.fromLocation = loc?.name;
    }

    if (data.toLocationId) {
      const { data: loc } = await this.supabase
        .from("locations")
        .select("name")
        .eq("id", data.toLocationId)
        .single();
      documentData.toLocation = loc?.name;
    }

    // 4. Create document
    const { data: document, error } = await this.supabase
      .from("warehouse_documents")
      .insert({
        organization_id: organizationId,
        branch_id: branchId,
        document_type: data.documentType,
        document_date: data.documentDate || new Date().toISOString().split("T")[0],
        movement_ids: data.movementIds,
        from_location_id: data.fromLocationId,
        to_location_id: data.toLocationId,
        supplier_id: data.supplierId,
        customer_id: data.customerId,
        document_data: documentData,
        notes: data.notes,
        status: "draft",
        created_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return document;
  }

  async confirmDocument(documentId: string, userId: string) {
    const { data, error } = await this.supabase
      .from("warehouse_documents")
      .update({
        status: "confirmed",
        confirmed_by: userId,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async generatePDF(documentId: string): Promise<string> {
    // TODO: Implement PDF generation
    // This will be done in subtask 2.3
    throw new Error("Not implemented yet");
  }
}

export const warehouseDocumentsService = new WarehouseDocumentsService();
```

**Checklist:**

- [ ] Create service
- [ ] Implement all CRUD methods
- [ ] Add validation
- [ ] Write tests

#### 2.3 PDF Generation

**Install dependencies:**

```bash
npm install puppeteer handlebars
npm install -D @types/puppeteer
```

**File:** `src/modules/warehouse/api/pdf-generator-service.ts`

```typescript
import puppeteer from "puppeteer";
import Handlebars from "handlebars";
import { readFile } from "fs/promises";
import path from "path";

class PDFGeneratorService {
  private templateCache = new Map<string, HandlebarsTemplateDelegate>();

  async loadTemplate(templateName: string): Promise<HandlebarsTemplateDelegate> {
    if (this.templateCache.has(templateName)) {
      return this.templateCache.get(templateName)!;
    }

    const templatePath = path.join(
      process.cwd(),
      "src/modules/warehouse/templates",
      `${templateName}.hbs`
    );

    const templateSource = await readFile(templatePath, "utf-8");
    const template = Handlebars.compile(templateSource);

    this.templateCache.set(templateName, template);
    return template;
  }

  async generateDocumentPDF(documentType: string, data: Record<string, unknown>): Promise<Buffer> {
    // 1. Load template
    const template = await this.loadTemplate(documentType);

    // 2. Generate HTML
    const html = template(data);

    // 3. Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdf = await page.pdf({
        format: "A4",
        margin: {
          top: "2cm",
          right: "2cm",
          bottom: "2cm",
          left: "2cm",
        },
        printBackground: true,
      });

      return pdf;
    } finally {
      await browser.close();
    }
  }

  async uploadPDF(pdf: Buffer, fileName: string, organizationId: string): Promise<string> {
    const { createClient } = await import("@/utils/supabase/server");
    const supabase = await createClient();

    const filePath = `${organizationId}/documents/${fileName}`;

    const { error } = await supabase.storage.from("warehouse-documents").upload(filePath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (error) throw error;

    const { data } = supabase.storage.from("warehouse-documents").getPublicUrl(filePath);

    return data.publicUrl;
  }
}

export const pdfGeneratorService = new PDFGeneratorService();
```

**File:** `src/modules/warehouse/templates/PZ.hbs`

```handlebars
<html lang="pl">
  <head>
    <meta charset="UTF-8" />
    <title>Przyjęcie Zewnętrzne {{documentNumber}}</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      body {
        font-family: "DejaVu Sans", Arial, sans-serif;
        font-size: 11pt;
        padding: 2cm;
      }
      .header {
        text-align: center;
        margin-bottom: 30px;
        border-bottom: 2px solid #000;
        padding-bottom: 10px;
      }
      .header h1 {
        font-size: 20pt;
        margin-bottom: 5px;
      }
      .header .doc-info {
        font-size: 10pt;
        color: #666;
      }
      .parties {
        margin-bottom: 20px;
      }
      .parties .party {
        margin-bottom: 10px;
      }
      .parties strong {
        display: inline-block;
        width: 150px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th,
      td {
        border: 1px solid #000;
        padding: 8px;
        text-align: left;
      }
      th {
        background-color: #f0f0f0;
        font-weight: bold;
      }
      td.number {
        text-align: center;
      }
      td.quantity,
      td.price {
        text-align: right;
      }
      tfoot td {
        font-weight: bold;
      }
      .signatures {
        margin-top: 40px;
        display: flex;
        justify-content: space-between;
      }
      .signature {
        width: 45%;
      }
      .signature-line {
        border-top: 1px solid #000;
        margin-top: 40px;
        padding-top: 5px;
        text-align: center;
      }
      .notes {
        margin-top: 20px;
        padding: 10px;
        background-color: #f9f9f9;
        border: 1px solid #ddd;
      }
      .notes strong {
        display: block;
        margin-bottom: 5px;
      }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>PRZYJĘCIE ZEWNĘTRZNE (PZ)</h1>
      <div class="doc-info">
        Nr dokumentu:
        <strong>{{documentNumber}}</strong>
        | Data:
        <strong>{{documentDate}}</strong>
      </div>
    </div>

    <div class="parties">
      {{#if supplier}}
        <div class="party">
          <strong>Dostawca:</strong>
          {{supplier}}
        </div>
      {{/if}}
      <div class="party">
        <strong>Magazyn:</strong>
        {{toLocation}}
      </div>
      <div class="party">
        <strong>Oddział:</strong>
        {{branchName}}
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th class="number">Lp.</th>
          <th>Nazwa towaru</th>
          <th>SKU</th>
          <th class="quantity">Ilość</th>
          <th>Jednostka</th>
          <th class="price">Cena jedn. (PLN)</th>
          <th class="price">Wartość (PLN)</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
          <tr>
            <td class="number">{{add @index 1}}</td>
            <td>{{name}}</td>
            <td>{{sku}}</td>
            <td class="quantity">{{quantity}}</td>
            <td>{{unit}}</td>
            <td class="price">{{formatCurrency unitCost}}</td>
            <td class="price">{{formatCurrency totalCost}}</td>
          </tr>
        {{/each}}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="6" style="text-align: right;">Razem:</td>
          <td class="price">{{formatCurrency totalValue}}</td>
        </tr>
      </tfoot>
    </table>

    {{#if notes}}
      <div class="notes">
        <strong>Uwagi:</strong>
        <div>{{notes}}</div>
      </div>
    {{/if}}

    <div class="signatures">
      <div class="signature">
        <div class="signature-line">
          Osoba wydająca towar
        </div>
      </div>
      <div class="signature">
        <div class="signature-line">
          Osoba przyjmująca towar
        </div>
      </div>
    </div>

    <div style="margin-top: 30px; font-size: 9pt; color: #666; text-align: center;">
      Wygenerowano:
      {{generatedAt}}
      | System: CoreFrame Warehouse
    </div>
  </body>
</html>
```

**Helper functions for Handlebars:**

```typescript
// In pdf-generator-service.ts
Handlebars.registerHelper("formatCurrency", function (value: number) {
  if (value == null) return "0.00";
  return value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
});

Handlebars.registerHelper("add", function (a: number, b: number) {
  return a + b;
});
```

**Checklist:**

- [ ] Install dependencies
- [ ] Create PDF service
- [ ] Create templates (PZ, WZ, MM, RW)
- [ ] Test PDF generation
- [ ] Set up Supabase storage bucket
- [ ] Test PDF upload

#### 2.4 Integration

Update warehouse-documents-service.ts:

```typescript
async generatePDF(documentId: string): Promise<string> {
  // 1. Fetch document
  const { data: doc, error } = await this.supabase
    .from('warehouse_documents')
    .select('*')
    .eq('id', documentId)
    .single();

  if (error) throw error;

  // 2. Generate PDF
  const pdf = await pdfGeneratorService.generateDocumentPDF(
    doc.document_type,
    {
      documentNumber: doc.document_number,
      documentDate: doc.document_date,
      ...doc.document_data,
      generatedAt: new Date().toISOString(),
    }
  );

  // 3. Upload to Supabase Storage
  const fileName = `${doc.document_type}_${doc.document_number.replace(/\//g, '_')}.pdf`;
  const pdfUrl = await pdfGeneratorService.uploadPDF(
    pdf,
    fileName,
    doc.organization_id
  );

  // 4. Update document record
  await this.supabase
    .from('warehouse_documents')
    .update({
      pdf_url: pdfUrl,
      pdf_generated_at: new Date().toISOString(),
    })
    .eq('id', documentId);

  return pdfUrl;
}
```

**Checklist:**

- [ ] Integrate PDF generation with document service
- [ ] Test end-to-end document creation → PDF generation
- [ ] Add error handling
- [ ] Create API endpoint

---

## Phase 3: Transfer Workflows & UI

**Duration:** 1.5 weeks
**Complexity:** High

### Objectives

- Enhance transfer_requests with workflow states
- Build transfer creation UI
- Build transfer receiving UI
- Implement approval workflow

### Tasks

#### 3.1 Transfer Service Enhancement

**File:** `src/modules/warehouse/api/transfer-service.ts`

```typescript
import { createClient } from "@/utils/supabase/client";
import { toast } from "react-toastify";

interface CreateTransferData {
  fromLocationId: string;
  toLocationId: string;
  items: Array<{
    productId: string;
    variantId?: string;
    quantity: number;
  }>;
  priority?: "low" | "normal" | "high" | "urgent";
  expectedDate?: string;
  notes?: string;
}

class TransferService {
  private supabase = createClient();

  async createTransfer(
    data: CreateTransferData,
    organizationId: string,
    branchId: string,
    userId: string
  ) {
    // 1. Validate stock availability
    for (const item of data.items) {
      const { data: snapshot } = await this.supabase
        .from("stock_snapshots")
        .select("quantity_available")
        .eq("organization_id", organizationId)
        .eq("location_id", data.fromLocationId)
        .eq("product_id", item.productId)
        .maybeSingle();

      if (!snapshot || snapshot.quantity_available < item.quantity) {
        throw new Error(`Insufficient stock for product ${item.productId}`);
      }
    }

    // 2. Create transfer request
    const { data: transfer, error: transferError } = await this.supabase
      .from("transfer_requests")
      .insert({
        organization_id: organizationId,
        from_branch_id: branchId,
        to_branch_id: branchId, // Same branch for now
        from_location_id: data.fromLocationId,
        to_location_id: data.toLocationId,
        status: "pending",
        priority: data.priority || "normal",
        expected_at: data.expectedDate,
        notes: data.notes,
        requested_by: userId,
        requested_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (transferError) throw transferError;

    // 3. Create transfer items
    const itemsData = data.items.map((item) => ({
      transfer_request_id: transfer.id,
      product_id: item.productId,
      variant_id: item.variantId,
      requested_quantity: item.quantity,
      status: "pending",
    }));

    const { error: itemsError } = await this.supabase
      .from("transfer_request_items")
      .insert(itemsData);

    if (itemsError) throw itemsError;

    return transfer;
  }

  async approveTransfer(transferId: string, userId: string) {
    const { data, error } = await this.supabase
      .from("transfer_requests")
      .update({
        status: "approved",
        approved_by: userId,
        approved_at: new Date().toISOString(),
      })
      .eq("id", transferId)
      .select()
      .single();

    if (error) throw error;

    // Create reservations
    await this.createReservations(transferId);

    return data;
  }

  async shipTransfer(transferId: string, userId: string) {
    // 1. Update transfer status
    const { data: transfer, error } = await this.supabase
      .from("transfer_requests")
      .update({
        status: "in_transit",
        shipped_by: userId,
        shipped_at: new Date().toISOString(),
      })
      .eq("id", transferId)
      .select("*, items:transfer_request_items(*)")
      .single();

    if (error) throw error;

    // 2. Create OUT movements (301)
    const movements = transfer.items.map((item) => ({
      organization_id: transfer.organization_id,
      branch_id: transfer.from_branch_id,
      location_id: transfer.from_location_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      movement_type_code: "301", // Transfer Out
      quantity: item.requested_quantity,
      reference_type: "transfer",
      reference_id: transferId,
      created_by: userId,
      occurred_at: new Date().toISOString(),
    }));

    const { error: movError } = await this.supabase.from("stock_movements").insert(movements);

    if (movError) throw movError;

    // 3. Generate MM document
    // TODO: Implement document generation

    return transfer;
  }

  async receiveTransfer(
    transferId: string,
    items: Array<{ itemId: string; receivedQuantity: number }>,
    userId: string
  ) {
    // 1. Update transfer status
    const { data: transfer, error } = await this.supabase
      .from("transfer_requests")
      .update({
        status: "completed",
        received_by: userId,
        received_at: new Date().toISOString(),
      })
      .eq("id", transferId)
      .select("*")
      .single();

    if (error) throw error;

    // 2. Update items
    for (const item of items) {
      await this.supabase
        .from("transfer_request_items")
        .update({
          received_quantity: item.receivedQuantity,
          status: "received",
        })
        .eq("id", item.itemId);
    }

    // 3. Create IN movements (302)
    const { data: transferItems } = await this.supabase
      .from("transfer_request_items")
      .select("*")
      .eq("transfer_request_id", transferId);

    const movements = transferItems!.map((item) => ({
      organization_id: transfer.organization_id,
      branch_id: transfer.to_branch_id,
      location_id: transfer.to_location_id,
      product_id: item.product_id,
      variant_id: item.variant_id,
      movement_type_code: "302", // Transfer In
      quantity: item.received_quantity || item.requested_quantity,
      reference_type: "transfer",
      reference_id: transferId,
      created_by: userId,
      occurred_at: new Date().toISOString(),
    }));

    const { error: movError } = await this.supabase.from("stock_movements").insert(movements);

    if (movError) throw movError;

    // 4. Release reservations
    await this.releaseReservations(transferId);

    return transfer;
  }

  private async createReservations(transferId: string) {
    // TODO: Create stock reservations
  }

  private async releaseReservations(transferId: string) {
    // TODO: Release stock reservations
  }
}

export const transferService = new TransferService();
```

**Checklist:**

- [ ] Create transfer service
- [ ] Implement all workflow methods
- [ ] Add validation
- [ ] Write tests

#### 3.2 Transfer Creation UI

**File:** `src/modules/warehouse/transfers/components/create-transfer-dialog.tsx`

```typescript
"use client";

import * as React from "react";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import { Plus, X, ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import { transferService } from "@/modules/warehouse/api/transfer-service";
import { useAppStore } from "@/lib/stores/app-store";
import { useUserStore } from "@/lib/stores/user-store";

interface TransferItem {
  productId: string;
  productName: string;
  variantId?: string;
  variantName?: string;
  quantity: number;
  availableQuantity: number;
}

interface CreateTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultFromLocationId?: string;
}

export function CreateTransferDialog({
  open,
  onOpenChange,
  defaultFromLocationId,
}: CreateTransferDialogProps) {
  const router = useRouter();
  const { activeOrg, activeBranch } = useAppStore();
  const { user } = useUserStore();

  const [fromLocationId, setFromLocationId] = React.useState(defaultFromLocationId || "");
  const [toLocationId, setToLocationId] = React.useState("");
  const [priority, setPriority] = React.useState<"normal" | "high" | "urgent">("normal");
  const [expectedDate, setExpectedDate] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [items, setItems] = React.useState<TransferItem[]>([]);
  const [isSaving, setIsSaving] = React.useState(false);

  const handleAddItem = () => {
    // TODO: Show product selection dialog
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!activeOrg || !activeBranch || !user) {
      toast.error("Missing organization or user context");
      return;
    }

    if (!fromLocationId || !toLocationId) {
      toast.error("Please select source and destination locations");
      return;
    }

    if (items.length === 0) {
      toast.error("Please add at least one item");
      return;
    }

    setIsSaving(true);

    try {
      const transfer = await transferService.createTransfer(
        {
          fromLocationId,
          toLocationId,
          items: items.map(item => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
          })),
          priority,
          expectedDate,
          notes,
        },
        activeOrg.organization_id,
        activeBranch.id,
        user.id
      );

      toast.success(`Transfer ${transfer.request_number} created successfully`);
      onOpenChange(false);
      router.push(`/dashboard/warehouse/transfers/${transfer.id}`);
    } catch (error) {
      console.error("Failed to create transfer:", error);
      toast.error("Failed to create transfer");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Create Stock Transfer</DialogTitle>
          <DialogDescription>
            Transfer stock between warehouse locations
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Locations */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Location *</Label>
              <Select value={fromLocationId} onValueChange={setFromLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select source location" />
                </SelectTrigger>
                <SelectContent>
                  {/* TODO: Load locations */}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>To Location *</Label>
              <Select value={toLocationId} onValueChange={setToLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select destination location" />
                </SelectTrigger>
                <SelectContent>
                  {/* TODO: Load locations */}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Priority & Expected Date */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Expected Date</Label>
              <Input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
              />
            </div>
          </div>

          {/* Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button size="sm" variant="outline" onClick={handleAddItem}>
                <Plus className="h-4 w-4 mr-2" />
                Add Item
              </Button>
            </div>

            {items.length > 0 && (
              <div className="border rounded-lg divide-y">
                {items.map((item, index) => (
                  <div key={index} className="p-4 flex items-center gap-4">
                    <div className="flex-1">
                      <div className="font-medium">{item.productName}</div>
                      {item.variantName && (
                        <div className="text-sm text-muted-foreground">
                          {item.variantName}
                        </div>
                      )}
                      <div className="text-sm text-muted-foreground">
                        Available: {item.availableQuantity}
                      </div>
                    </div>

                    <div className="w-32">
                      <Input
                        type="number"
                        min="1"
                        max={item.availableQuantity}
                        value={item.quantity}
                        onChange={(e) => {
                          const newItems = [...items];
                          newItems[index].quantity = parseFloat(e.target.value);
                          setItems(newItems);
                        }}
                      />
                    </div>

                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleRemoveItem(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transfer..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Creating..." : "Create Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Checklist:**

- [ ] Create transfer dialog component
- [ ] Add product/variant selection
- [ ] Add location selection
- [ ] Test transfer creation
- [ ] Add validation

#### 3.3 Transfer List & Detail Pages

**File:** `src/app/[locale]/dashboard/warehouse/transfers/page.tsx`

(Similar structure to products page with AdvancedDataTable)

**File:** `src/app/[locale]/dashboard/warehouse/transfers/[id]/page.tsx`

(Transfer detail page with status, items, actions)

**Checklist:**

- [ ] Create transfers list page
- [ ] Create transfer detail page
- [ ] Add approve/ship/receive actions
- [ ] Test workflows

---

## Phase 4: Delivery Receiving System

**Duration:** 1 week
**Complexity:** Medium

### Objectives

- Create delivery_receipts table
- Build receive delivery UI
- Integrate with PZ document generation
- Handle partial receipts

### Tasks

#### 4.1 Database Migration

(See specification for delivery_receipts schema)

**Checklist:**

- [ ] Create migration
- [ ] Test on dev
- [ ] Deploy to staging

#### 4.2 Delivery Service

**File:** `src/modules/warehouse/api/delivery-service.ts`

(Implementation similar to transfer service)

**Checklist:**

- [ ] Create service
- [ ] Add CRUD methods
- [ ] Test

#### 4.3 Receive Delivery UI

**File:** `src/modules/warehouse/deliveries/components/receive-delivery-dialog.tsx`

**Checklist:**

- [ ] Create dialog
- [ ] Handle partial receipts
- [ ] Handle damaged goods
- [ ] Test

---

## Phase 5: E-commerce Integrations

**Duration:** 2 weeks
**Complexity:** Very High

### Objectives

- Create channel_inventory_sync table
- Implement Shopify integration
- Implement WooCommerce integration
- Implement Allegro integration
- Set up webhook handlers
- Create sync service

### Tasks

#### 5.1 Channel Sync Database

(See specification)

**Checklist:**

- [ ] Create migration
- [ ] Test

#### 5.2 Shopify Integration

**Install SDK:**

```bash
npm install @shopify/shopify-api
```

**File:** `src/modules/warehouse/integrations/shopify-service.ts`

**Checklist:**

- [ ] Create service
- [ ] Implement inventory sync
- [ ] Create webhook handlers
- [ ] Test with sandbox

#### 5.3 WooCommerce Integration

**Install SDK:**

```bash
npm install @woocommerce/woocommerce-rest-api
```

**File:** `src/modules/warehouse/integrations/woocommerce-service.ts`

**Checklist:**

- [ ] Create service
- [ ] Implement inventory sync
- [ ] Create webhook handlers
- [ ] Test

#### 5.4 Allegro Integration

**File:** `src/modules/warehouse/integrations/allegro-service.ts`

**Checklist:**

- [ ] Create service
- [ ] OAuth implementation
- [ ] Inventory sync
- [ ] Order processing
- [ ] Test

---

## Phase 6: JPK_MAG Compliance

**Duration:** 1 week
**Complexity:** Medium

### Objectives

- Create JPK_MAG export service
- Generate XML according to specification
- Test with Ministry of Finance validator

### Tasks

#### 6.1 JPK Export Service

**Install XML library:**

```bash
npm install xmlbuilder2
```

**File:** `src/modules/warehouse/api/jpk-mag-service.ts`

**Checklist:**

- [ ] Create service
- [ ] Generate XML
- [ ] Validate schema
- [ ] Test

---

## Phase 7: Testing & Validation

**Duration:** 1 week
**Complexity:** Medium

### Test Coverage Goals

- Unit tests: 80%+
- Integration tests: Key workflows
- E2E tests: Critical paths

### Testing Checklist

**Unit Tests:**

- [ ] Movement types service
- [ ] Document service
- [ ] Transfer service
- [ ] Delivery service
- [ ] Channel sync services

**Integration Tests:**

- [ ] Create and approve transfer
- [ ] Receive delivery and generate PZ
- [ ] Sync inventory to Shopify
- [ ] Generate JPK_MAG export

**E2E Tests:**

- [ ] Complete transfer workflow
- [ ] Complete delivery workflow
- [ ] E-commerce order processing

**Manual Testing:**

- [ ] Test all UI components
- [ ] Test PDF generation
- [ ] Test document printing
- [ ] Test permissions

---

## Deployment Strategy

### Pre-Deployment

1. [ ] All tests passing
2. [ ] Code review completed
3. [ ] Documentation updated
4. [ ] Migration scripts tested on staging

### Deployment Steps

1. **Database Migration**

   ```bash
   # Backup production database
   # Run migrations
   npx supabase db push
   ```

2. **Deploy Application**

   ```bash
   npm run build
   # Deploy to production
   ```

3. **Post-Deployment**
   - [ ] Verify migrations applied
   - [ ] Test critical paths
   - [ ] Monitor error logs
   - [ ] Notify users of new features

### Rollback Plan

If issues arise:

1. Revert application deployment
2. Rollback database migrations (if possible)
3. Investigate and fix
4. Redeploy

---

## Success Criteria

### Phase Completion

Each phase is complete when:

- All tasks checked off
- Tests passing
- Code reviewed
- Documentation updated
- Deployed to staging

### Overall Success

Project is successful when:

- All 7 phases complete
- 80%+ test coverage
- Polish legal compliance verified
- E-commerce integrations working
- User acceptance testing passed
- Production deployment successful

---

## Resources

### Team

- **Backend Developer:** Database, services, APIs
- **Frontend Developer:** UI components, integrations
- **QA Engineer:** Testing, validation
- **DevOps:** Deployment, monitoring

### Documentation

- Technical specification (this document's companion)
- API documentation
- User guide (warehouse operators)
- Administrator guide

### Support

- Slack channel: #warehouse-implementation
- Weekly standup: Progress review
- Issue tracker: GitHub Issues

---

**Document Control:**

| Version | Date       | Author | Changes                     |
| ------- | ---------- | ------ | --------------------------- |
| 1.0     | 2025-10-24 | Claude | Initial implementation plan |

---

_End of Implementation Plan_
