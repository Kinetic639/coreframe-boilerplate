# Movement Types - Implementation Status

**Last Updated:** 2025-11-28
**Total Movement Types:** 28 (existing in database) + 35 (planned from AmbraWMS spec) + 2 (reservation types) = 65 total
**Database Status:** ✅ 30 types defined in `movement_types` table (28 + 2 reservation types)
**Frontend Status:** 🟡 Partially implemented (7/65 working)

---

## Legend

### Implementation Status

- **BE (Backend):** ✅ = In database | ❌ = Not in database
- **FE (Frontend):** ✅ = Fully implemented | 🟡 = Partially implemented | ❌ = Not implemented

### Process Columns

- **Reservation:** Whether movement creates stock reservation before execution
  - **Yes** = Always creates reservation
  - **Optional** = Depends on organization configuration
  - **No** = Never creates reservation

- **Requires Approval:** Whether movement requires approval from receiving side/manager
  - **Yes** = Always requires approval
  - **Optional** = Depends on configuration
  - **No** = Auto-approved

- **Movement Request:** Whether movement starts as a request workflow
  - **Yes** = Always starts as request
  - **Optional** = Can be direct or request-based
  - **No** = Direct execution

---

# **AmbraWMS – Full Movement Types Specification**

## **3.1 Przyjęcia Zewnętrzne (PZ) - External Receipts**

| Code    | Document | Name                     | Description                                       | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------------ | ------------------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **101** | PZ       | Goods Receipt (Purchase) | Przyjęcie dostawy od dostawcy                     | No          | No                | No               | ✅  | ✅  |
| **102** | PZ-      | Receipt Reversal         | Storno 101                                        | No          | No                | No               | ✅  | ❌  |
| **103** | PZ-ZK    | Customer Return Receipt  | Zwrot od klienta                                  | No          | Optional (QC)     | No               | ✅  | ❌  |
| **104** | PZ-P     | Production Output        | Produkcja wyroby gotowe                           | No          | Optional (QC)     | No               | ✅  | ❌  |
| **105** | PZ-I     | Initial Stock            | Stan początkowy                                   | No          | Yes               | No               | ✅  | ❌  |
| **111** | PZ-KOR+  | Receipt Adjustment (+)   | Korekta przyjęcia zwiększająca ilość lub wartość  | No          | No                | No               | ❌  | ❌  |
| **112** | PZ-KOR-  | Receipt Adjustment (-)   | Korekta przyjęcia zmniejszająca ilość lub wartość | No          | No                | No               | ❌  | ❌  |
| **121** | PZ-ZW    | Customer Return Receipt  | Przyjęcie zwrotu od klienta. Może trafiać do QC   | No          | Optional (QC)     | No               | ❌  | ❌  |
| **122** | PZ-OPK   | Packaging Return Receipt | Przyjęcie opakowań zwrotnych / palet              | No          | No                | No               | ❌  | ❌  |

---

## **3.2 Wydania Zewnętrzne (WZ) - External Issues**

| Code    | Document  | Name                   | Description                                        | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | --------- | ---------------------- | -------------------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **201** | WZ        | Goods Issue (Sales)    | Wydanie towaru do klienta. Zmniejsza stan magazynu | **Yes**     | Optional          | Yes              | ✅  | ✅  |
| **202** | WZ-       | Issue Reversal         | Storno 201                                         | No          | No                | No               | ✅  | ❌  |
| **203** | WZ-ZD     | Return to Supplier     | Zwrot do dostawcy                                  | No          | Optional          | No               | ✅  | ❌  |
| **204** | RW-P      | Production Consumption | Zużycie materiałów                                 | **Yes**     | Optional          | Yes              | ✅  | ❌  |
| **205** | RW        | Issue to Cost Center   | Wydanie MPK                                        | Optional    | Optional          | Optional         | ✅  | ❌  |
| **206** | RW-S      | Waste/Damage           | Szkody i straty                                    | No          | Yes               | Yes              | ✅  | ❌  |
| **211** | WZ-SAMP   | Sample Issue           | Wydanie próbek, materiałów marketingowych          | Optional    | No                | Yes              | ❌  | ❌  |
| **221** | WZ-EXPORT | Export Issue           | Wydanie eksportowe (WDT/WNT)                       | Yes         | Optional          | Yes              | ❌  | ❌  |

---

## **3.3 Transfery Międzymagazynowe (MM) - Inter-Warehouse Transfers**

| Code    | Document | Name                               | Description                    | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ---------------------------------- | ------------------------------ | ----------- | ----------------- | ---------------- | --- | --- |
| **301** | MM-      | Inter-Warehouse Issue              | Wydanie towaru z magazynu A    | **Yes**     | Yes (magazyn B)   | **Yes**          | ✅  | ❌  |
| **302** | MM+      | Inter-Warehouse Receipt            | Przyjęcie towaru do magazynu B | No          | Yes (auto/manuel) | Yes              | ✅  | ❌  |
| **303** | MM-L     | Intra-Location Move                | Przesunięcie wewnętrzne        | No          | No                | No               | ✅  | ❌  |
| **311** | MM-O     | Inter-Branch Transfer Out          | Transfer między oddziały WY    | **Yes**     | **Yes**           | **Yes**          | ✅  | 🟡  |
| **312** | MM-I     | Inter-Branch Transfer In           | Transfer między oddziały PR    | No          | Yes               | Yes              | ✅  | 🟡  |
| **321** | MM-KOR-  | Inter-Warehouse Issue Correction   | Korekta/storno ruchu 301       | No          | No                | No               | ❌  | ❌  |
| **322** | MM-KOR+  | Inter-Warehouse Receipt Correction | Korekta/storno ruchu 302       | No          | No                | No               | ❌  | ❌  |

**Process Logic for 301→302:**

1. Movement 301 creates reservation and movement request
2. Request visible in destination warehouse (magazyn B)
3. Magazyn B must approve request
4. Approval generates movement 302 (receipt)

---

## **3.4 Rozchód Wewnętrzny (RW) - Internal Consumption**

| Code    | Document    | Name                            | Description                                                         | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | ----------- | ------------------------------- | ------------------------------------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **401** | RW          | Internal Consumption            | Rozchód na potrzeby firmy (serwis, biuro, materiały eksploatacyjne) | Optional    | Optional          | Optional         | ✅  | ✅  |
| **402** | RW-KOR      | Internal Consumption Correction | Korekta RW                                                          | No          | No                | No               | ✅  | ✅  |
| **411** | RW-PROD     | Production Issue                | Wydanie materiałów na zlecenie produkcyjne                          | **Yes**     | Optional          | Yes              | ✅  | ❌  |
| **412** | RW-PROD-KOR | Production Issue Correction     | Korekta RW-PROD                                                     | No          | No                | No               | ❌  | ❌  |

---

## **3.5 Produkcja / Przyjęcie Wewnętrzne (PW) - Production**

| Code    | Document | Name                          | Description                                | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ----------------------------- | ------------------------------------------ | ----------- | ----------------- | ---------------- | --- | --- |
| **421** | PW       | Production Receipt            | Przyjęcie wyrobów gotowych lub kompletacji | No          | Optional (QC)     | No               | ❌  | ❌  |
| **422** | PW-KOR   | Production Receipt Correction | Korekta PW                                 | No          | No                | No               | ❌  | ❌  |
| **431** | PW-DEM   | De-Assembly / Break Down      | Rozkompletowanie zestawów                  | No          | No                | No               | ❌  | ❌  |

---

## **3.6 Inwentaryzacja i Korekty - Inventory & Corrections**

| Code    | Document | Name                        | Description                                     | Reservation | Requires Approval          | Movement Request | BE  | FE  |
| ------- | -------- | --------------------------- | ----------------------------------------------- | ----------- | -------------------------- | ---------------- | --- | --- |
| **501** | INW+     | Inventory Surplus           | Nadwyżka podczas inwentaryzacji. Zwiększa stan  | No          | **Yes** (audyt zatwierdza) | No               | ✅  | ✅  |
| **502** | INW-     | Inventory Shortage          | Niedobór podczas inwentaryzacji. Zmniejsza stan | No          | **Yes** (obowiązkowe)      | No               | ✅  | ✅  |
| **511** | KOR+     | Manual Stock Correction (+) | Zwiększenie stanu poza inwentaryzacją           | No          | Optional                   | No               | ❌  | ❌  |
| **512** | KOR-     | Manual Stock Correction (-) | Zmniejszenie stanu poza inwentaryzacją          | No          | Optional                   | No               | ❌  | ❌  |

---

## **3.7 Rezerwacje - Reservations (AutoStacja Logic)**

| Code    | Document | Name                | Description                                                                         | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------- | ----------------------------------------------------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **572** | RZ+      | Reservation Create  | Creates a soft reservation. Decreases available stock, increases reserved quantity. | **Yes**     | No                | No               | ✅  | ❌  |
| **573** | RZ-      | Reservation Release | Releases or cancels reservation. Frees available stock.                             | **Yes**     | No                | No               | ✅  | ❌  |

**Note:** These reservation movements (572/573) manage soft reservations separately from physical stock movements. They affect only the reserved quantity, not physical inventory.

---

## **3.8 Likwidacja / Utylizacja - Disposal**

| Code    | Document | Name                | Description                        | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------- | ---------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **601** | LZ       | Disposal / Scrap    | Likwidacja, złomowanie, utylizacja | No          | **Yes**           | Yes              | ✅  | ❌  |
| **602** | LZ-KOR   | Disposal Correction | Korekta ruchu LZ                   | No          | Yes               | No               | ✅  | ❌  |

**Note:** Codes 601/602 currently used for E-commerce (Shopify/WooCommerce) in DB. Conflict with AmbraWMS spec.

---

## **3.9 Zwroty / Reklamacje - Returns**

| Code    | Document    | Name                          | Description           | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | ----------- | ----------------------------- | --------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **621** | ZW-DOST     | Return to Supplier            | Zwrot towaru dostawcy | **Yes**     | Optional          | Yes              | ❌  | ❌  |
| **622** | ZW-DOST-KOR | Return to Supplier Correction | Korekta ruchu ZW-DOST | No          | No                | No               | ❌  | ❌  |

---

## **3.10 Quality Control (QC)**

| Code    | Document | Name            | Description                                         | Reservation    | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | --------------- | --------------------------------------------------- | -------------- | ----------------- | ---------------- | --- | --- |
| **701** | QC-BLOCK | Quality Hold    | Przeniesienie towaru do bin QC (blokada jakościowa) | Yes (QC stock) | Yes               | Yes              | ❌  | ❌  |
| **702** | QC-REL   | Quality Release | Zwolnienie z QC do normalnego obrotu                | No             | Yes               | Yes              | ❌  | ❌  |
| **703** | QC-SAMP  | Sampling Issue  | Pobranie próbki do testów                           | Yes            | No                | No               | ❌  | ❌  |

---

## **3.11 Ruchy wewnątrz magazynu (BIN→BIN) - Internal Bin Movements**

| Code    | Document | Name                     | Description                                         | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------------ | --------------------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **801** | MMZ      | Bin-to-Bin Move          | Przesunięcie miejscowe w ramach jednego magazynu    | No          | No                | No               | ❌  | ❌  |
| **802** | MMJ      | Move to Damaged Zone     | Przesunięcie do strefy uszkodzeń                    | No          | Optional          | Optional         | ❌  | ❌  |
| **803** | MMO      | Move to Staging / Buffer | Przesunięcie do strefy staging/picking buffer       | No          | No                | No               | ❌  | ❌  |
| **804** | MML      | Loading Dock Move        | Przesunięcie logistyczne (dock → receiving → stock) | No          | No                | No               | ❌  | ❌  |
| **805** | MMP      | Replenishment            | Uzupełnienie pickingu z rezerwy                     | Optional    | Optional          | Yes              | ❌  | ❌  |
| **806** | MMK      | Bin Consolidation        | Scalanie lokalizacji                                | No          | No                | No               | ❌  | ❌  |
| **807** | MMR      | Bin Splitting            | Rozdzielanie lokalizacji                            | No          | No                | No               | ❌  | ❌  |
| **808** | MMB      | Bin Balancing            | Balansowanie stanów między BIN-ami                  | No          | No                | No               | ❌  | ❌  |

---

## **3.12 Konsygnacja / Zmiana Właściciela - Consignment**

| Code    | Document | Name                | Description                              | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------- | ---------------------------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **901** | KONS-OWN | Ownership Change    | Zmiana właściciela towaru bez zmiany BIN | No          | Yes               | No               | ❌  | ❌  |
| **902** | KONS-IN  | Consignment Receipt | Przyjęcie towaru konsygnacyjnego         | No          | No                | No               | ❌  | ❌  |
| **903** | KONS-OUT | Consignment Issue   | Pobranie z konsygnacji (powstaje koszt)  | Yes         | Optional          | Yes              | ❌  | ❌  |

---

## **3.13 E-Commerce Integration (Current DB Implementation)**

| Code    | Document | Name               | Description            | Reservation | Requires Approval | Movement Request | BE  | FE  |
| ------- | -------- | ------------------ | ---------------------- | ----------- | ----------------- | ---------------- | --- | --- |
| **601** | WZ-S     | Shopify Order      | Zamówienie Shopify     | Yes         | No                | No               | ✅  | ❌  |
| **602** | WZ-W     | WooCommerce Order  | Zamówienie WooCommerce | Yes         | No                | No               | ✅  | ❌  |
| **603** | WZ-A     | Allegro Order      | Zamówienie Allegro     | Yes         | No                | No               | ✅  | ❌  |
| **611** | PZ-S     | Shopify Return     | Zwrot Shopify          | No          | Optional (QC)     | No               | ✅  | ❌  |
| **612** | PZ-W     | WooCommerce Return | Zwrot WooCommerce      | No          | Optional (QC)     | No               | ✅  | ❌  |
| **613** | PZ-A     | Allegro Return     | Zwrot Allegro          | No          | Optional (QC)     | No               | ✅  | ❌  |

**Note:** E-commerce codes 601-613 conflict with AmbraWMS disposal codes. Need to reassign disposal to 623-624 range.

---

# 4. Process Logic Summary

## 4.1 Movements That ALWAYS Create Reservations

These movements reserve stock before execution to ensure availability:

- **201** - Goods Issue (Sales)
- **301** - Inter-Warehouse Issue
- **311** - Inter-Branch Transfer Out
- **411** - Production Issue
- **572** - Reservation Create (soft reservation)
- **573** - Reservation Release (soft reservation)
- **621** - Return to Supplier
- **701** - Quality Hold
- **703** - Quality Sampling
- **903** - Consignment Issue
- **601-603** - E-commerce Orders

## 4.2 Movements That ALWAYS Require Approval

- **105** - Initial Stock (manager approval)
- **206** - Waste/Damage (documentation)
- **301/302** - Inter-Warehouse Transfers (receiving warehouse)
- **311/312** - Inter-Branch Transfers (branch manager)
- **501/502** - Inventory Surplus/Shortage (audit commission)
- **601/602** - Disposal (manager approval)
- **701/702** - Quality Control transitions (QC manager)
- **901** - Ownership Change (legal/manager)

## 4.3 Movements That ALWAYS Start as Movement Request

These require request→approval→execution workflow:

- **201** - Sales Issue (picking → confirm)
- **301/302** - Inter-Warehouse Transfers
- **311/312** - Inter-Branch Transfers
- **411** - Production Issue
- **601** - Disposal
- **621** - Return to Supplier
- **701/702** - QC Block/Release
- **805** - Replenishment (optional)

## 4.4 Direct Execution Movements (No Request)

- **101** - Purchase Receipt
- **401/402** - Internal Consumption
- **801-808** - Bin-to-Bin moves
- **902** - Consignment Receipt

---

# 5. Code Conflicts & Resolution

## Current Database vs AmbraWMS Spec Conflicts:

1. **401/402** - DB: Adjustments | AmbraWMS: Internal Consumption (RESOLVED - same meaning)
2. **411** - DB: Quality Reclassification | AmbraWMS: Production Issue (CONFLICT)
3. **501/502** - DB: Reservations | AmbraWMS: Inventory Surplus/Shortage (CONFLICT)
4. **601/602** - DB: E-commerce | AmbraWMS: Disposal (CONFLICT)

## Recommended Resolution:

- Keep existing DB codes for implemented features (101, 201, 401-403, 501-502, 601-613)
- Reassign conflicting AmbraWMS codes to available ranges:
  - Disposal: 623-624 (instead of 601-602)
  - Production Issue corrections: Keep 411 for Quality, use 415-416 for Production Issue
  - Inventory adjustments: Use 511-514 for manual corrections, keep 501-502 for reservations

---

# 6. Implementation Statistics

## Overall Progress

- **Total Movement Types:** 63 (28 existing + 35 from AmbraWMS spec)
- **In Database (BE):** 28 types (44%)
- **Fully Implemented (FE):** 7 types (11%)
- **Partially Implemented:** 2 types (3%) - 311, 312 have service layer
- **Not Implemented:** 54 types (86%)

## By Category

- **Receipts (100-199):** 9 types - 1 FE ✅, 4 BE ✅, 4 planned ❌
- **Issues (200-299):** 8 types - 1 FE ✅, 5 BE ✅, 2 planned ❌
- **Transfers (300-399):** 7 types - 0 FE ✅, 5 BE ✅, 2 FE 🟡, 2 planned ❌
- **Adjustments (400-499):** 7 types - 3 FE ✅, 4 BE ✅, 3 planned ❌
- **Reservations/Inventory (500-599):** 6 types - 2 FE ✅, 2 BE ✅, 4 planned ❌
- **E-commerce (600-699):** 8 types - 0 FE ✅, 6 BE ✅, 2 planned ❌
- **Quality Control (700-799):** 3 types - all planned ❌
- **Bin-to-Bin (800-899):** 8 types - all planned ❌
- **Consignment (900-999):** 3 types - all planned ❌

## Movements with Reservation Logic: 15 types

## Movements Requiring Approval: 16 types

## Movements with Request Workflow: 14 types

---

# 7. Priority Implementation Order

## Phase 1 - Critical (Business Essential)

1. **311-312** - Inter-Branch Transfers (service exists, need UI)
2. **301-302** - Inter-Warehouse Transfers
3. **701-703** - Quality Control workflow

## Phase 2 - High Priority (Common Operations)

1. **102, 202** - Reversals/Corrections
2. **103, 121** - Customer Returns
3. **203, 621-622** - Supplier Returns
4. **411-412** - Production Issue

## Phase 3 - Medium Priority (Production & Optimization)

1. **104, 421-422, 431** - Production workflows
2. **511-514** - Manual stock corrections
3. **801-808** - Bin optimization
4. **805** - Replenishment

## Phase 4 - Low Priority (Advanced Features)

1. **111-112** - Receipt adjustments
2. **211, 221** - Special issues
3. **901-903** - Consignment
4. **122** - Packaging returns

---

# 8. Compliance Notes

AmbraWMS movement types specification is compliant with:

- ✅ Polish warehouse documentation (PZ/WZ/RW/PW/MM/LZ/INW)
- ✅ Ustawa o rachunkowości (Polish Accounting Act)
- ✅ Immutable warehouse records requirement
- ✅ SAP MM standard movement types
- ✅ Polish audit requirements
- ✅ Multi-warehouse and multi-branch operations
- ✅ Quality control (QC) processes
- ✅ FIFO/FEFO support via bin movements
- ✅ Consignment and VMI scenarios

---

# 9. Current Implementation Status (311-312)

## What Exists:

- ✅ Database tables: `transfer_requests`, `transfer_request_items`
- ✅ Movement types 311-312 in database
- ✅ Service layer: `InterWarehouseTransferService` with full workflow
- ✅ Server actions: create, approve, ship, receive, cancel
- ✅ Type definitions: Complete TypeScript types
- ✅ Stock movements integration: Creates 311/312 movements when shipping/receiving
- ✅ Approval workflow implemented
- ✅ Reservation logic implemented

## What's Missing:

- ❌ Frontend pages (using dialogs instead - INCORRECT per user requirements)
- ❌ Proper routing for movement creation/details
- ❌ Movement request UI workflow
- ❌ Approval queue UI for receiving warehouse
- ❌ Branches and locations loading actions

## Required Implementation:

1. Remove transfer dialog components
2. Create page: `/dashboard/warehouse/inventory/movements/new` - unified movement creation
3. Create page: `/dashboard/warehouse/inventory/movements/[id]` - movement details with actions
4. Implement movement request workflow UI
5. Add approval actions to movement details page
6. Create branches/locations loading server actions

---

### Legend:

- **BE** = Backend (in database)
- **FE** = Frontend (full UI implementation)
- ✅ = Implemented
- 🟡 = Partial (service layer exists, no full UI)
- ❌ = Not implemented
- **Yes** = Always/Required
- **Optional** = Configurable
- **No** = Never
