import { Tables } from "../../../supabase/types/types";
import { branchLocationsMap } from "./branches";

// Mock suppliers for automotive products
export const mockSuppliers = [
  { id: "sup-001", name: "PPG Industries" },
  { id: "sup-002", name: "Axalta Coating Systems" },
  { id: "sup-003", name: "BASF Coatings" },
  { id: "sup-004", name: "Sherwin-Williams Automotive" },
  { id: "sup-005", name: "3M Poland" },
  { id: "sup-006", name: "Sikkens" },
  { id: "sup-007", name: "Standox" },
  { id: "sup-008", name: "Cromax" },
  { id: "sup-009", name: "Dupli-Color" },
  { id: "sup-010", name: "Motip Dupli" },
];

// Mock products for automotive paint shop
export const mockProducts: Tables<"products">[] = [
  // Paints and Primers
  {
    id: "prod-001",
    name: "Lakier akrylowy biały",
    description:
      "Wysokiej jakości lakier akrylowy w kolorze białym, odporny na warunki atmosferyczne",
    sku: "LAK-AKR-BIA-001",
    code: "LAK001",
    barcode: "5901234567890",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-002",
    name: "Podkład reaktywny szary",
    description: "Podkład reaktywny o wysokiej przyczepności, kolor szary",
    sku: "POD-REA-SZA-001",
    code: "POD001",
    barcode: "5901234567891",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-003",
    name: "Lakier metaliczny srebrny",
    description: "Lakier metaliczny z efektem srebrnym, dwuwarstwowy",
    sku: "LAK-MET-SRE-001",
    code: "LAK002",
    barcode: "5901234567892",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-004",
    name: "Lakier czarny matowy",
    description: "Lakier akrylowy w kolorze czarnym z wykończeniem matowym",
    sku: "LAK-CZA-MAT-001",
    code: "LAK003",
    barcode: "5901234567893",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-005",
    name: "Bezbarwny lakier ochronny",
    description: "Bezbarwny lakier ochronny UV, wysoki połysk",
    sku: "LAK-BEZ-OCH-001",
    code: "LAK004",
    barcode: "5901234567894",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Body fillers and putties
  {
    id: "prod-006",
    name: "Szpachla natryskowa",
    description: "Szpachla natryskowa do wypełniania większych ubytków",
    sku: "SZP-NAT-001",
    code: "SZP001",
    barcode: "5901234567895",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-007",
    name: "Szpachla uniwersalna",
    description: "Szpachla uniwersalna do drobnych napraw karoserii",
    sku: "SZP-UNI-001",
    code: "SZP002",
    barcode: "5901234567896",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-008",
    name: "Szpachla ze włóknem szklanym",
    description: "Wzmocniona szpachla ze włóknem szklanym do większych napraw",
    sku: "SZP-WLO-001",
    code: "SZP003",
    barcode: "5901234567897",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Masking and protection
  {
    id: "prod-009",
    name: "Folia ochronna 4m x 150m",
    description: "Folia ochronna do oklejania podczas lakierowania",
    sku: "FOL-OCH-4X150",
    code: "FOL001",
    barcode: "5901234567898",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-010",
    name: "Taśma do oklejania 19mm",
    description: "Taśma papierowa do oklejania, szerokość 19mm",
    sku: "TAS-OKL-19MM",
    code: "TAS001",
    barcode: "5901234567899",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-011",
    name: "Taśma do oklejania 38mm",
    description: "Taśma papierowa do oklejania, szerokość 38mm",
    sku: "TAS-OKL-38MM",
    code: "TAS002",
    barcode: "5901234567800",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-012",
    name: "Papier do oklejania",
    description: "Papier ochronny do oklejania podczas lakierowania",
    sku: "PAP-OKL-001",
    code: "PAP001",
    barcode: "5901234567801",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Cleaning and preparation
  {
    id: "prod-013",
    name: "Środek do odtłuszczania",
    description: "Środek do odtłuszczania powierzchni przed lakierowaniem",
    sku: "SRO-ODT-001",
    code: "SRO001",
    barcode: "5901234567802",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-014",
    name: "Rozpuszczalnik do lakierów",
    description: "Rozpuszczalnik uniwersalny do rozcieńczania lakierów",
    sku: "ROZ-LAK-001",
    code: "ROZ001",
    barcode: "5901234567803",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-015",
    name: "Utwardzacz do lakierów",
    description: "Utwardzacz do lakierów dwuskładnikowych",
    sku: "UTW-LAK-001",
    code: "UTW001",
    barcode: "5901234567804",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Safety equipment
  {
    id: "prod-016",
    name: "Maska lakiernicza FFP2",
    description: "Maska ochronna do lakierowania, klasa FFP2",
    sku: "MAS-LAK-FFP2",
    code: "MAS001",
    barcode: "5901234567805",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-017",
    name: "Rękawiczki nitrylowe L",
    description: "Rękawiczki nitrylowe, rozmiar L, opakowanie 100 szt",
    sku: "REK-NIT-L-100",
    code: "REK001",
    barcode: "5901234567806",
    default_unit: "op",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-018",
    name: "Rękawiczki nitrylowe M",
    description: "Rękawiczki nitrylowe, rozmiar M, opakowanie 100 szt",
    sku: "REK-NIT-M-100",
    code: "REK002",
    barcode: "5901234567807",
    default_unit: "op",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-019",
    name: "Kombinezon ochronny XL",
    description: "Kombinezon ochronny do lakierowania, rozmiar XL",
    sku: "KOM-OCH-XL",
    code: "KOM001",
    barcode: "5901234567808",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Spray booth equipment
  {
    id: "prod-020",
    name: "Filtr kabiny lakierniczej",
    description: "Filtr wlotowy do kabiny lakierniczej, wymiary 20x20",
    sku: "FIL-KAB-20X20",
    code: "FIL001",
    barcode: "5901234567809",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-021",
    name: "Filtr wylotowy kabiny",
    description: "Filtr wylotowy do kabiny lakierniczej",
    sku: "FIL-WYL-001",
    code: "FIL002",
    barcode: "5901234567810",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Polishing compounds
  {
    id: "prod-022",
    name: "Pasta polerska gruba",
    description: "Pasta polerska do usuwania głębokich rys",
    sku: "PAS-POL-GRU",
    code: "PAS001",
    barcode: "5901234567811",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-023",
    name: "Pasta polerska średnia",
    description: "Pasta polerska do usuwania średnich rys",
    sku: "PAS-POL-SRE",
    code: "PAS002",
    barcode: "5901234567812",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-024",
    name: "Pasta polerska finishowa",
    description: "Pasta polerska do wykończenia i nadania połysku",
    sku: "PAS-POL-FIN",
    code: "PAS003",
    barcode: "5901234567813",
    default_unit: "kg",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Abrasives
  {
    id: "prod-025",
    name: "Papier ścierny P320",
    description: "Papier ścierny wodoodporny, gradacja P320",
    sku: "PAP-SCI-P320",
    code: "SCI001",
    barcode: "5901234567814",
    default_unit: "ark",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-026",
    name: "Papier ścierny P600",
    description: "Papier ścierny wodoodporny, gradacja P600",
    sku: "PAP-SCI-P600",
    code: "SCI002",
    barcode: "5901234567815",
    default_unit: "ark",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-027",
    name: "Papier ścierny P1000",
    description: "Papier ścierny wodoodporny, gradacja P1000",
    sku: "PAP-SCI-P1000",
    code: "SCI003",
    barcode: "5901234567816",
    default_unit: "ark",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-028",
    name: "Gąbka ścierna średnia",
    description: "Gąbka ścierna do szlifowania na mokro",
    sku: "GAB-SCI-SRE",
    code: "GAB001",
    barcode: "5901234567817",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Tools and equipment
  {
    id: "prod-029",
    name: "Pistolet lakierniczy HVLP",
    description: "Pistolet lakierniczy z technologią HVLP, dysza 1.4mm",
    sku: "PIS-LAK-HVLP-14",
    code: "PIS001",
    barcode: "5901234567818",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:000Z",
    deleted_at: null,
  },
  {
    id: "prod-030",
    name: "Pistolet do szpachlowania",
    description: "Pistolet pneumatyczny do nakładania szpachli",
    sku: "PIS-SZP-001",
    code: "PIS002",
    barcode: "5901234567819",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-031",
    name: "Szlifierka pneumatyczna",
    description: "Szlifierka pneumatyczna oscylacyjna 150mm",
    sku: "SZL-PNE-150",
    code: "SZL001",
    barcode: "5901234567820",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-032",
    name: "Polerka rotacyjna",
    description: "Polerka rotacyjna elektryczna 1200W",
    sku: "POL-ROT-1200W",
    code: "POL001",
    barcode: "5901234567821",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Accessories
  {
    id: "prod-033",
    name: "Ściereczka z mikrofibry",
    description: "Ściereczka z mikrofibry do polerowania, 40x40cm",
    sku: "SCI-MIK-40X40",
    code: "SCI004",
    barcode: "5901234567822",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-034",
    name: "Gąbka polerska żółta",
    description: "Gąbka polerska średnio-twarda, kolor żółty",
    sku: "GAB-POL-ZOL",
    code: "GAB002",
    barcode: "5901234567823",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-035",
    name: "Gąbka polerska czarna",
    description: "Gąbka polerska miękka do wykończenia, kolor czarny",
    sku: "GAB-POL-CZA",
    code: "GAB003",
    barcode: "5901234567824",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },

  // Variant products
  {
    id: "prod-036",
    name: "Lakier akrylowy czerwony",
    description: "Wysokiej jakości lakier akrylowy w kolorze czerwonym",
    sku: "LAK-AKR-CZE-001",
    code: "LAK005",
    barcode: "5901234567825",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-037",
    name: "Lakier akrylowy niebieski",
    description: "Wysokiej jakości lakier akrylowy w kolorze niebieskim",
    sku: "LAK-AKR-NIE-001",
    code: "LAK006",
    barcode: "5901234567826",
    default_unit: "l",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-038",
    name: "Rękawiczki nitrylowe S",
    description: "Rękawiczki nitrylowe, rozmiar S, opakowanie 100 szt",
    sku: "REK-NIT-S-100",
    code: "REK003",
    barcode: "5901234567827",
    default_unit: "op",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-039",
    name: "Kombinezon ochronny L",
    description: "Kombinezon ochronny do lakierowania, rozmiar L",
    sku: "KOM-OCH-L",
    code: "KOM002",
    barcode: "5901234567828",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "prod-040",
    name: "Kombinezon ochronny M",
    description: "Kombinezon ochronny do lakierowania, rozmiar M",
    sku: "KOM-OCH-M",
    code: "KOM003",
    barcode: "5901234567829",
    default_unit: "szt",
    main_image_id: null,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

// Product types for categorization
export const productTypes = {
  simple: "simple",
  variant: "variant",
} as const;

// Mock inventory data for products
export const mockInventoryData: Array<{
  id: string;
  product_id: string;
  purchase_price: number;
  vat_rate: number;
  supplier_ids: string[];
  inventory_notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}> = [
  {
    id: "inv-001",
    product_id: "prod-001",
    purchase_price: 45.5,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-006"],
    inventory_notes: "Popularny kolor, duże zapotrzebowanie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-002",
    product_id: "prod-002",
    purchase_price: 38.9,
    vat_rate: 23,
    supplier_ids: ["sup-002", "sup-007"],
    inventory_notes: "Podstawowy podkład, zawsze w magazynie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-003",
    product_id: "prod-003",
    purchase_price: 52.3,
    vat_rate: 23,
    supplier_ids: ["sup-003"],
    inventory_notes: "Lakier premium, wysoka marża",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-004",
    product_id: "prod-004",
    purchase_price: 48.75,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-004"],
    inventory_notes: "Modny kolor, rosnące zapotrzebowanie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-005",
    product_id: "prod-005",
    purchase_price: 41.2,
    vat_rate: 23,
    supplier_ids: ["sup-005", "sup-006"],
    inventory_notes: "Uniwersalny lakier ochronny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-006",
    product_id: "prod-006",
    purchase_price: 28.5,
    vat_rate: 23,
    supplier_ids: ["sup-002", "sup-008"],
    inventory_notes: "Szpachla do większych napraw",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-007",
    product_id: "prod-007",
    purchase_price: 24.9,
    vat_rate: 23,
    supplier_ids: ["sup-003", "sup-009"],
    inventory_notes: "Podstawowa szpachla, duże zużycie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-008",
    product_id: "prod-008",
    purchase_price: 32.8,
    vat_rate: 23,
    supplier_ids: ["sup-004"],
    inventory_notes: "Wzmocniona szpachla, specjalistyczna",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-009",
    product_id: "prod-009",
    purchase_price: 15.6,
    vat_rate: 23,
    supplier_ids: ["sup-005", "sup-010"],
    inventory_notes: "Folia ochronna, duże rolki",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-010",
    product_id: "prod-010",
    purchase_price: 3.2,
    vat_rate: 23,
    supplier_ids: ["sup-005", "sup-010"],
    inventory_notes: "Podstawowa taśma, duże zużycie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  // Continue for all products...
  {
    id: "inv-011",
    product_id: "prod-011",
    purchase_price: 4.8,
    vat_rate: 23,
    supplier_ids: ["sup-005", "sup-010"],
    inventory_notes: "Szersza taśma, średnie zużycie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-012",
    product_id: "prod-012",
    purchase_price: 8.9,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Papier ochronny, standardowy",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-013",
    product_id: "prod-013",
    purchase_price: 12.4,
    vat_rate: 23,
    supplier_ids: ["sup-006", "sup-007"],
    inventory_notes: "Środek do odtłuszczania, podstawowy",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-014",
    product_id: "prod-014",
    purchase_price: 18.7,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-002"],
    inventory_notes: "Rozpuszczalnik uniwersalny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-015",
    product_id: "prod-015",
    purchase_price: 22.3,
    vat_rate: 23,
    supplier_ids: ["sup-003", "sup-004"],
    inventory_notes: "Utwardzacz do lakierów 2K",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-016",
    product_id: "prod-016",
    purchase_price: 2.8,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Maska ochronna, jednorazowa",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-017",
    product_id: "prod-017",
    purchase_price: 18.5,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Rękawiczki L, popularne",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-018",
    product_id: "prod-018",
    purchase_price: 18.5,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Rękawiczki M, średnie zapotrzebowanie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-019",
    product_id: "prod-019",
    purchase_price: 12.9,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Kombinezon XL, duży rozmiar",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-020",
    product_id: "prod-020",
    purchase_price: 45.8,
    vat_rate: 23,
    supplier_ids: ["sup-006"],
    inventory_notes: "Filtr kabiny, wymiana co 3 miesiące",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-021",
    product_id: "prod-021",
    purchase_price: 38.2,
    vat_rate: 23,
    supplier_ids: ["sup-006"],
    inventory_notes: "Filtr wylotowy, mniej częsta wymiana",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-022",
    product_id: "prod-022",
    purchase_price: 28.9,
    vat_rate: 23,
    supplier_ids: ["sup-007", "sup-008"],
    inventory_notes: "Pasta gruba, do ciężkich przypadków",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-023",
    product_id: "prod-023",
    purchase_price: 26.4,
    vat_rate: 23,
    supplier_ids: ["sup-007", "sup-008"],
    inventory_notes: "Pasta średnia, uniwersalna",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-024",
    product_id: "prod-024",
    purchase_price: 32.6,
    vat_rate: 23,
    supplier_ids: ["sup-007", "sup-008"],
    inventory_notes: "Pasta finishowa, wykończenie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-025",
    product_id: "prod-025",
    purchase_price: 1.2,
    vat_rate: 23,
    supplier_ids: ["sup-009", "sup-010"],
    inventory_notes: "Papier P320, średnia gradacja",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-026",
    product_id: "prod-026",
    purchase_price: 1.4,
    vat_rate: 23,
    supplier_ids: ["sup-009", "sup-010"],
    inventory_notes: "Papier P600, drobna gradacja",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-027",
    product_id: "prod-027",
    purchase_price: 1.6,
    vat_rate: 23,
    supplier_ids: ["sup-009", "sup-010"],
    inventory_notes: "Papier P1000, bardzo drobny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-028",
    product_id: "prod-028",
    purchase_price: 3.8,
    vat_rate: 23,
    supplier_ids: ["sup-009"],
    inventory_notes: "Gąbka ścierna, wielokrotnego użytku",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-029",
    product_id: "prod-029",
    purchase_price: 285.0,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-002"],
    inventory_notes: "Pistolet HVLP, profesjonalny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-030",
    product_id: "prod-030",
    purchase_price: 195.0,
    vat_rate: 23,
    supplier_ids: ["sup-003"],
    inventory_notes: "Pistolet do szpachlowania",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-031",
    product_id: "prod-031",
    purchase_price: 420.0,
    vat_rate: 23,
    supplier_ids: ["sup-004"],
    inventory_notes: "Szlifierka pneumatyczna, profesjonalna",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-032",
    product_id: "prod-032",
    purchase_price: 380.0,
    vat_rate: 23,
    supplier_ids: ["sup-007"],
    inventory_notes: "Polerka rotacyjna, mocna",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-033",
    product_id: "prod-033",
    purchase_price: 8.5,
    vat_rate: 23,
    supplier_ids: ["sup-008"],
    inventory_notes: "Ściereczka z mikrofibry, wysokiej jakości",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-034",
    product_id: "prod-034",
    purchase_price: 12.3,
    vat_rate: 23,
    supplier_ids: ["sup-007", "sup-008"],
    inventory_notes: "Gąbka żółta, średnio-twarda",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-035",
    product_id: "prod-035",
    purchase_price: 14.8,
    vat_rate: 23,
    supplier_ids: ["sup-007", "sup-008"],
    inventory_notes: "Gąbka czarna, miękka do wykończenia",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-036",
    product_id: "prod-036",
    purchase_price: 47.2,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-006"],
    inventory_notes: "Lakier czerwony, wariant kolorystyczny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-037",
    product_id: "prod-037",
    purchase_price: 46.8,
    vat_rate: 23,
    supplier_ids: ["sup-001", "sup-006"],
    inventory_notes: "Lakier niebieski, wariant kolorystyczny",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-038",
    product_id: "prod-038",
    purchase_price: 17.9,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Rękawiczki S, mniejsze zapotrzebowanie",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-039",
    product_id: "prod-039",
    purchase_price: 11.9,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Kombinezon L, średni rozmiar",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
  {
    id: "inv-040",
    product_id: "prod-040",
    purchase_price: 11.5,
    vat_rate: 23,
    supplier_ids: ["sup-005"],
    inventory_notes: "Kombinezon M, popularny rozmiar",
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
    deleted_at: null,
  },
];

// Generate random stock locations for products across all branches
export function generateStockLocations(): Array<{
  id: string;
  product_id: string;
  location_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}> {
  const stockLocations = [];
  let stockId = 1;

  // All location IDs from all branches
  const allLocationIds = [
    "war-1",
    "war-2",
    "war-3",
    "war-4",
    "kra-1",
    "kra-2",
    "kra-3",
    "gda-1",
    "gda-2",
    "gda-3",
    "gda-4",
    "wro-1",
    "wro-2",
    "wro-3",
  ];

  mockProducts.forEach((product) => {
    // Each product appears in 1-4 random locations
    const numLocations = Math.floor(Math.random() * 4) + 1;
    const selectedLocations = allLocationIds.sort(() => 0.5 - Math.random()).slice(0, numLocations);

    selectedLocations.forEach((locationId) => {
      stockLocations.push({
        id: `stock-${stockId.toString().padStart(3, "0")}`,
        product_id: product.id,
        location_id: locationId,
        quantity: Math.floor(Math.random() * 50) + 1,
        created_at: "2024-01-01T00:00:00.000Z",
        updated_at: "2024-01-01T00:00:00.000Z",
        deleted_at: null,
      });
      stockId++;
    });
  });

  return stockLocations;
}

export const mockStockLocations = generateStockLocations();

// Helper functions
export function getProductById(productId: string) {
  return mockProducts.find((p) => p.id === productId);
}

export function getInventoryDataByProductId(productId: string) {
  return mockInventoryData.find((inv) => inv.product_id === productId);
}

export function getStockLocationsByProductId(productId: string) {
  return mockStockLocations.filter((stock) => stock.product_id === productId);
}

export function getStockLocationsByProductIdAndBranch(productId: string, branchId: string) {
  const branchLocationIds = branchLocationsMap[branchId]?.map((loc) => loc.id) || [];
  return mockStockLocations.filter(
    (stock) => stock.product_id === productId && branchLocationIds.includes(stock.location_id)
  );
}

export function getTotalQuantityForProduct(productId: string): number {
  return mockStockLocations
    .filter((stock) => stock.product_id === productId)
    .reduce((total, stock) => total + stock.quantity, 0);
}

export function getTotalQuantityForProductInBranch(productId: string, branchId: string): number {
  const branchLocationIds = branchLocationsMap[branchId]?.map((loc) => loc.id) || [];
  return mockStockLocations
    .filter(
      (stock) => stock.product_id === productId && branchLocationIds.includes(stock.location_id)
    )
    .reduce((total, stock) => total + stock.quantity, 0);
}

export function getProductsWithInventoryData() {
  return mockProducts.map((product) => {
    const inventoryData = getInventoryDataByProductId(product.id);
    const stockLocations = getStockLocationsByProductId(product.id);
    const totalQuantity = getTotalQuantityForProduct(product.id);

    return {
      ...product,
      inventory: inventoryData,
      stockLocations,
      totalQuantity,
      isAvailable: totalQuantity > 0,
      productType: product.sku?.includes("VAR") ? "variant" : "simple",
      isService: false, // All our products are physical items
    };
  });
}

export function getProductsWithInventoryDataByBranch(branchId: string) {
  // Get location IDs for the specific branch
  const branchLocationIds = branchLocationsMap[branchId]?.map((loc) => loc.id) || [];

  // Filter products that have stock in this branch
  const productsInBranch = mockProducts.filter((product) => {
    const productStockLocations = mockStockLocations.filter(
      (stock) => stock.product_id === product.id && branchLocationIds.includes(stock.location_id)
    );
    return productStockLocations.length > 0;
  });

  return productsInBranch.map((product) => {
    const inventoryData = getInventoryDataByProductId(product.id);
    const stockLocations = getStockLocationsByProductIdAndBranch(product.id, branchId);
    const totalQuantity = getTotalQuantityForProductInBranch(product.id, branchId);

    return {
      ...product,
      inventory: inventoryData,
      stockLocations,
      totalQuantity,
      isAvailable: totalQuantity > 0,
      productType: product.sku?.includes("VAR") ? "variant" : "simple",
      isService: false, // All our products are physical items
    };
  });
}

export function getSupplierNames(supplierIds: string[]): string[] {
  return supplierIds.map((id) => {
    const supplier = mockSuppliers.find((s) => s.id === id);
    return supplier ? supplier.name : "Unknown Supplier";
  });
}
