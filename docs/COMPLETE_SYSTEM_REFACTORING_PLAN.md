# Complete System Refactoring Plan: Templates, Contexts, Variants & Products

## Executive Summary

**Goal**: Transform the current broken/incomplete product system into a fully functional, enterprise-ready platform with template-optional creation, multi-context support, robust variants, and API exposure capabilities.

**Current State**:

- Products fail to create (empty template_id)
- Context system exists but hidden
- Variants partially implemented
- Two competing template schemas

**Target State**:

- Template-optional product creation
- Progressive context management
- Full variant support with EAV flexibility
- Context-based API exposure ready

## Progress Tracking

Use this checklist to track implementation progress:

---

## PHASE 1: Database Foundation & Schema Cleanup (Week 1)

### Step 1.1: Schema Consolidation & Migration

**Priority: Critical** | **Risk: Medium** | **Duration: 2 days**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Audit Current Database State**
  - [x] Document all existing product/template related tables
  - [x] Identify conflicts between `templates` vs `product_templates`
  - [x] Map data dependencies and foreign key relationships

- [x] **Create Consolidation Migration**

  ```sql
  -- Migration applied: 20250922120000_phase1_schema_consolidation.sql
  -- Fixed template_id nullable constraint
  -- Created context management infrastructure
  ```

- [x] **Fix Product Table Schema**
  ```sql
  -- ✅ COMPLETED: template_id is now nullable
  -- ✅ COMPLETED: context_scope already exists in product_attributes
  ```

### Step 1.2: Context Management Tables

**Priority: High** | **Risk: Low** | **Duration: 1 day**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Create Context Configuration Table**

  ```sql
  CREATE TABLE context_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id),
    context_name VARCHAR(50) NOT NULL,
    context_type VARCHAR(20) DEFAULT 'custom', -- 'system' or 'custom'
    display_label JSONB NOT NULL, -- {"en": "Warehouse", "pl": "Magazyn"}
    icon VARCHAR(50),
    color VARCHAR(7),
    is_active BOOLEAN DEFAULT true,
    api_enabled BOOLEAN DEFAULT false,
    access_level VARCHAR(20) DEFAULT 'private', -- 'public', 'token_required', 'private'
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] **Seed System Contexts** ✅ (warehouse, ecommerce, b2b, pos)
  ```sql
  INSERT INTO context_configurations (context_name, context_type, display_label, icon, color, api_enabled, access_level, organization_id)
  VALUES
  ('warehouse', 'system', '{"en": "Warehouse", "pl": "Magazyn"}', 'Package', '#10b981', false, 'private', NULL),
  ('ecommerce', 'system', '{"en": "E-commerce", "pl": "E-commerce"}', 'ShoppingCart', '#3b82f6', true, 'public', NULL),
  ('b2b', 'system', '{"en": "B2B Sales", "pl": "Sprzedaż B2B"}', 'Building', '#f59e0b', true, 'token_required', NULL),
  ('pos', 'system', '{"en": "Point of Sale", "pl": "Punkt sprzedaży"}', 'CreditCard', '#ef4444', false, 'private', NULL);
  ```

### Step 1.3: Enhanced Attribute Definitions

**Priority: High** | **Risk: Low** | **Duration: 1 day**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Add Field Behavior Configuration**
  ```sql
  ALTER TABLE template_attribute_definitions
  ADD COLUMN context_behavior VARCHAR(20) DEFAULT 'context_specific',
  ADD COLUMN inheritance_rules JSONB DEFAULT '{}',
  ADD COLUMN api_visibility JSONB DEFAULT '{"public": false, "token_required": false, "private": true}';
  ```

---

## PHASE 2: Backend API Refactoring (Week 2)

### Step 2.1: Template Service Enhancement

**Priority: Critical** | **Risk: Medium** | **Duration: 2 days**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Fix Template-Optional Product Creation**
  - [x] Modify `createProduct()` to accept null template_id
  - [x] Add validation for templateless products
  - [x] Implement fallback attribute creation for freeform products

- [x] **Add Template Generation from Products**
  ```typescript
  // ✅ IMPLEMENTED: saveProductAsTemplate method
  async saveProductAsTemplate(productId: string, templateData: {
    name: string;
    description?: string;
    organization_id: string;
  }): Promise<ProductTemplate>
  ```

### Step 2.2: Context Service Implementation

**Priority: High** | **Risk: Low** | **Duration: 3 days**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Create Context Management Service**

  ```typescript
  class ContextService {
    async getAvailableContexts(organizationId: string): Promise<Context[]>;
    async createCustomContext(data: CreateContextRequest): Promise<Context>;
    async updateContextConfiguration(contextId: string, config: ContextConfig): Promise<void>;
    async getContextFieldVisibility(contextId: string): Promise<FieldVisibility[]>;
  }
  ```

- [x] **Enhance Product Service with Context Support** ✅
  ```typescript
  class ProductService {
    async getProductByContext(productId: string, context: string): Promise<Product>;
    async updateProductInContext(productId: string, context: string, data: any): Promise<void>;
    async getProductsForContext(context: string, filters: ProductFilters): Promise<Product[]>;
  }
  ```

### Step 2.3: Variant System Completion

**Priority: High** | **Risk: Medium** | **Duration: 2 days**

**Status: [x] Complete** ✅

**Tasks:**

- [x] **Implement Variant Management Functions**

  ```typescript
  class VariantService {
    async createVariant(productId: string, variantData: CreateVariantRequest): Promise<Variant>;
    async updateVariant(variantId: string, data: UpdateVariantRequest): Promise<Variant>;
    async deleteVariant(variantId: string): Promise<void>;
    async bulkCreateVariants(
      productId: string,
      variants: CreateVariantRequest[]
    ): Promise<Variant[]>;
  }
  ```

- [x] **Add Variant Context Support** ✅
  - [x] Ensure variants inherit product context configuration
  - [x] Implement variant-specific context overrides
  - [x] Add variant stock tracking per context

---

## PHASE 3: Frontend Integration (Week 3-4)

### Step 3.1: Template-Optional Product Creation UI

**Priority: Critical** | **Risk: Low** | **Duration: 3 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **Refactor Product Creation Form**

  ```tsx
  <ProductCreationDialog>
    <CreationModeSelector>
      <Option value="fresh">Start Fresh</Option>
      <Option value="template">Use Template</Option>
    </CreationModeSelector>

    {mode === "template" && <TemplateSelector />}
    {mode === "fresh" && <FreeformProductForm />}

    <SaveAsTemplateOption />
  </ProductCreationDialog>
  ```

- [ ] **Implement Template Selection UI**
  - [ ] Template gallery with previews
  - [ ] System vs organization template sections
  - [ ] Template search and filtering

### Step 3.2: Context Management Interface

**Priority: High** | **Risk: Low** | **Duration: 4 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **Context Switcher Component**

  ```tsx
  <ContextSwitcher>
    <SystemContexts />
    <CustomContexts />
    <AddContextButton />
  </ContextSwitcher>
  ```

- [ ] **Product Context Views**

  ```tsx
  <ProductForm>
    <ContextTabs>
      {contexts.map((ctx) => (
        <TabContent key={ctx} context={ctx}>
          <ContextSpecificFields context={ctx} />
        </TabContent>
      ))}
    </ContextTabs>
  </ProductForm>
  ```

- [ ] **Field Context Configuration UI**
  ```tsx
  <FieldContextConfig>
    <ContextBehaviorSelector>
      <Option value="shared">Shared across contexts</Option>
      <Option value="context_specific">Different per context</Option>
      <Option value="inherited">Inherit with overrides</Option>
    </ContextBehaviorSelector>
  </FieldContextConfig>
  ```

### Step 3.3: Variant Management UI

**Priority: High** | **Risk: Low** | **Duration: 3 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **Variant Creation Interface**
  - [ ] Bulk variant creation from attribute combinations
  - [ ] Individual variant editing
  - [ ] Variant matrix view

- [ ] **Variant Context Support**
  - [ ] Context-specific variant data
  - [ ] Variant stock per context
  - [ ] Context inheritance for variants

---

## PHASE 4: Advanced Features & API Platform (Week 5-6)

### Step 4.1: Context-Based API Endpoints

**Priority: Medium** | **Risk: Medium** | **Duration: 4 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **API Route Generation**

  ```typescript
  // Auto-generated routes based on context configuration
  GET / api / public / contexts / ecommerce / products;
  GET / api / v1 / contexts / b2b / products;
  GET / api / private / contexts / warehouse / products;
  ```

- [ ] **Field Visibility Implementation**
  - [ ] Filter fields based on context API configuration
  - [ ] Implement access level controls (public/token/private)
  - [ ] Add rate limiting and security measures

### Step 4.2: Developer Experience Features

**Priority: Low** | **Risk: Low** | **Duration: 3 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **API Documentation Generation**
  - [ ] Auto-generate OpenAPI specs per context
  - [ ] Interactive API explorer
  - [ ] Code examples and SDKs

- [ ] **Webhook System**
  - [ ] Context-aware webhook events
  - [ ] Configurable webhook endpoints per context
  - [ ] Event filtering and retry logic

---

## PHASE 5: Testing & Optimization (Week 7)

### Step 5.1: Comprehensive Testing

**Priority: Critical** | **Risk: Low** | **Duration: 4 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **End-to-End Testing**
  - [ ] Product creation (template vs templateless)
  - [ ] Context switching and field behavior
  - [ ] Variant management
  - [ ] API endpoint functionality

- [ ] **Performance Testing**
  - [ ] EAV query optimization
  - [ ] Context-based data retrieval
  - [ ] API response times and caching

### Step 5.2: Documentation & Training

**Priority: Medium** | **Risk: Low** | **Duration: 2 days**

**Status: [ ] Not Started | [ ] In Progress | [ ] Complete**

**Tasks:**

- [ ] **User Documentation**
  - [ ] Context management guide
  - [ ] Template creation tutorial
  - [ ] API integration examples

- [ ] **Developer Documentation**
  - [ ] Architecture overview
  - [ ] API reference
  - [ ] Integration patterns

---

## Success Metrics

### Immediate Success (Phase 1-3)

- [ ] Products can be created without templates
- [ ] Template selection works properly
- [ ] Context switching functions correctly
- [ ] Variants can be managed effectively

### Advanced Success (Phase 4-5)

- [ ] Context-based APIs are functional
- [ ] Field visibility controls work
- [ ] System performance meets requirements
- [ ] Developer documentation is complete

## Risk Mitigation

**High Risk**: Database migration, API security
**Medium Risk**: EAV query performance, complex UI interactions
**Low Risk**: Frontend component development, documentation

## Dependencies

1. **Database access for migrations**
2. **Staging environment for testing**
3. **API testing tools (Postman/Insomnia)**
4. **Performance monitoring setup**

## Implementation Notes

- Each phase builds on the previous one
- Critical path: Phase 1 → Phase 2 → Phase 3.1
- API features (Phase 4) can be developed in parallel with UI work
- Testing should be ongoing throughout all phases

This plan transforms the current fragmented system into a cohesive, enterprise-ready platform while maintaining backward compatibility and ensuring smooth user adoption.

---

## Weekly Progress Review

**Week 1 Goals:** ✅ COMPLETED

- [x] Database schema consolidated
- [x] Context management tables created
- [x] Enhanced attribute definitions implemented

**Week 2 Goals:** ✅ COMPLETED

- [x] Template-optional product creation working
- [x] Context service implemented
- [x] Variant system completed

**Week 3 Goals:**

- [ ] Product creation UI refactored
- [ ] Template selection working
- [ ] Context management interface started

**Week 4 Goals:**

- [ ] Context management interface completed
- [ ] Variant management UI implemented
- [ ] All core functionality working

**Week 5-6 Goals:**

- [ ] API platform features
- [ ] Developer experience improvements
- [ ] Advanced context features

**Week 7 Goals:**

- [ ] Comprehensive testing
- [ ] Performance optimization
- [ ] Documentation completion

---

## Phase 2 Completion Summary ✅

**Completed: September 22, 2025**

### What Was Accomplished:

- ✅ **Template-Optional Product Creation**: Products can now be created without selecting templates
- ✅ **Template Generation**: "Save as Template" functionality implemented
- ✅ **Context Management Service**: Complete service for managing system and custom contexts
- ✅ **Product Context Support**: Products can have different data per context (warehouse, ecommerce, b2b, pos)
- ✅ **Variant Management**: Full CRUD operations for product variants
- ✅ **Variant Context Support**: Variants can have context-specific attributes and images
- ✅ **Bulk Operations**: Matrix-based variant generation and bulk creation

### New Services Created:

```typescript
// Context Management
src/modules/warehouse/api/context-service.ts

// Variant Management
src/modules/warehouse/api/variant-service.ts

// Enhanced Product Service
src/modules/warehouse/api/products.ts (updated with context support)
```

### Key Features:

- **Template-Optional Creation**: Users can create products without templates and save them as templates later
- **Multi-Context Data**: Same product can have different attributes/images for warehouse vs ecommerce
- **Advanced Variants**: Bulk variant creation from attribute matrices
- **Context Inheritance**: Copy product data between contexts with overrides
- **Enterprise Ready**: Full API support for headless commerce capabilities

---

## Phase 1 Completion Summary ✅

**Completed: September 22, 2025**

### What Was Accomplished:

- ✅ **Database Foundation Fixed**: Products can now be created without templates (nullable template_id)
- ✅ **Context System Infrastructure**: Full context management tables created and seeded
- ✅ **4 System Contexts Ready**: warehouse, ecommerce, b2b, pos with proper configuration
- ✅ **Enhanced Attributes**: Added context behavior and API visibility columns
- ✅ **Performance Optimized**: All necessary indexes created
- ✅ **Field Visibility Framework**: Table for controlling API field exposure

### Database Changes Applied:

```sql
-- Applied migration: 20250922120000_phase1_schema_consolidation.sql
-- Applied migration: phase1_complete_no_rls.sql
```

### Ready for Phase 2:

- Template-optional product creation (backend ready)
- Context service implementation
- Template service enhancement
- Variant system completion

---

_Last Updated: September 22, 2025_
_Next Review: Start Phase 2_
