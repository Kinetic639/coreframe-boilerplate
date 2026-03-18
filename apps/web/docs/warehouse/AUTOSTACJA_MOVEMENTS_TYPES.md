# Missing Movement Types from AutoStacja for AmbraWMS

Version: 2025-11-29

This document lists all AutoStacja-style warehouse movements missing in AmbraWMS, including corrected reservation logic using paired movements RZ+ / RZ-. Movements follow Polish warehouse documentation standards (PZ/WZ/RW/MM/LZ/INW/RZ).

---

# 1. Reservation Movements (AutoStacja Logic)

| Code | Document | Name                | Description                                                                         | Reservation | Requires Approval | Movement Request |
| ---- | -------- | ------------------- | ----------------------------------------------------------------------------------- | ----------- | ----------------- | ---------------- |
| 572  | RZ+      | Reservation Create  | Creates a soft reservation. Decreases available stock, increases reserved quantity. | Yes         | No                | No               |
| 573  | RZ-      | Reservation Release | Releases or cancels reservation. Frees available stock.                             | Yes         | No                | No               |

---

# 2. Damage Zone Movements (MMJ)

| Code | Document | Name                  | Description                             | Reservation | Requires Approval | Movement Request |
| ---- | -------- | --------------------- | --------------------------------------- | ----------- | ----------------- | ---------------- |
| 831  | MMJ      | Move to Damage Zone   | Move item into damaged/claim zone.      | No          | Optional          | No               |
| 832  | MMJ-     | Move from Damage Zone | Return item from damaged zone to stock. | No          | Optional          | No               |

---

# 3. Bin-to-Bin Movements (AutoStacja Variants)

| Code | Document | Name            | Description                                                       | Reservation | Requires Approval | Movement Request |
| ---- | -------- | --------------- | ----------------------------------------------------------------- | ----------- | ----------------- | ---------------- |
| 821  | MMZ-A    | Auto Bin Move   | System-initiated bin relocation (slotting, buffer, optimization). | No          | No                | No               |
| 822  | MMZ-M    | Manual Bin Move | Manual internal relocation created by operator.                   | No          | No                | No               |

---

# 4. Workshop / Service Order Movements (MMU)

| Code | Document | Name                    | Description                                                  | Reservation | Requires Approval | Movement Request |
| ---- | -------- | ----------------------- | ------------------------------------------------------------ | ----------- | ----------------- | ---------------- |
| 841  | MMU      | Workshop Issue          | Consumption of materials on a workshop/service repair order. | Yes         | Optional          | Optional         |
| 842  | MMU-KOR  | Workshop Issue Reversal | Reversal of workshop consumption.                            | No          | Optional          | No               |

---

# 5. Returnable Packaging Movements (OPK)

| Code | Document | Name                          | Description                                  | Reservation | Requires Approval | Movement Request |
| ---- | -------- | ----------------------------- | -------------------------------------------- | ----------- | ----------------- | ---------------- |
| 861  | OPK-WZ   | Issue of Returnable Packaging | Issues pallets, cages or reusable packaging. | No          | No                | No               |
| 862  | OPK-MM   | Packaging Transfer            | Moves packaging between warehouses/bins.     | No          | Optional          | No               |

---

# 6. Workshop Blocking Movements (BLK)

| Code | Document | Name             | Description                                            | Reservation      | Requires Approval | Movement Request |
| ---- | -------- | ---------------- | ------------------------------------------------------ | ---------------- | ----------------- | ---------------- |
| 871  | BLK+     | Workshop Block   | Soft-blocks item for workshop job (not a reservation). | Yes (soft block) | No                | No               |
| 872  | BLK-     | Workshop Unblock | Releases a workshop block.                             | Yes (soft block) | No                | No               |

---

# 7. Warranty Claim Movements

| Code | Document | Name             | Description                                    | Reservation | Requires Approval | Movement Request |
| ---- | -------- | ---------------- | ---------------------------------------------- | ----------- | ----------------- | ---------------- |
| 881  | WZ-ZN    | Warranty Issue   | Issue of parts for warranty claim.             | Optional    | Optional          | Optional         |
| 882  | PZ-ZN    | Warranty Receipt | Receipt of warranty returns from manufacturer. | No          | Optional          | No               |

---

# 8. Value Correction Movements

| Code | Document  | Name                 | Description                      | Reservation | Requires Approval | Movement Request |
| ---- | --------- | -------------------- | -------------------------------- | ----------- | ----------------- | ---------------- |
| 891  | KOR-WART+ | Value Adjustment (+) | Positive stock value correction. | No          | Yes               | No               |
| 892  | KOR-WART- | Value Adjustment (-) | Negative stock value correction. | No          | Yes               | No               |

---

# Summary of Missing Movements to Add to AmbraWMS

## Reservation:

- 572 RZ+
- 573 RZ-

## Damage Zone:

- 831 MMJ
- 832 MMJ-

## Bin Movements:

- 821 MMZ-A
- 822 MMZ-M

## Workshop:

- 841 MMU
- 842 MMU-KOR

## Returnable Packaging:

- 861 OPK-WZ
- 862 OPK-MM

## Workshop Blocking:

- 871 BLK+
- 872 BLK-

## Warranty:

- 881 WZ-ZN
- 882 PZ-ZN

## Value Adjustments:

- 891 KOR-WART+
- 892 KOR-WART-
