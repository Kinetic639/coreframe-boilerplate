export interface PreviewProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  status: "draft" | "active" | "archived";
  description: string;
  updatedAt: string;
}

export interface PreviewContact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  role: string;
  tags: string[];
  lastInteraction: string;
  notes: string;
}

export const previewProducts: PreviewProduct[] = [
  {
    id: "prd-1001",
    name: "Nordic Steel Water Bottle",
    sku: "NSWB-500",
    category: "Accessories",
    price: 24.9,
    stock: 156,
    status: "active",
    description:
      "Double-walled insulated bottle crafted from recycled stainless steel. Keeps drinks hot for 12h and cold for 24h.",
    updatedAt: "2024-03-01T10:30:00.000Z",
  },
  {
    id: "prd-1002",
    name: "Aurora Performance Hoodie",
    sku: "APH-XS-NEB",
    category: "Apparel",
    price: 68.0,
    stock: 42,
    status: "active",
    description:
      "Lightweight technical hoodie designed for shifting weather conditions. Breathable mesh panels and hidden pocket system.",
    updatedAt: "2024-02-26T09:10:00.000Z",
  },
  {
    id: "prd-1003",
    name: "Summit Trail Backpack 28L",
    sku: "STB-28",
    category: "Outdoor",
    price: 119.0,
    stock: 18,
    status: "draft",
    description:
      "Compact hiking backpack with modular strap system, integrated rain cover and laptop sleeve for hybrid commuters.",
    updatedAt: "2024-02-20T14:22:00.000Z",
  },
  {
    id: "prd-1004",
    name: "Flux Wireless Earbuds",
    sku: "FLX-EARB-01",
    category: "Electronics",
    price: 149.99,
    stock: 75,
    status: "active",
    description:
      "Adaptive noise-cancelling earbuds with multi-device pairing and 42-hour battery life including the charging case.",
    updatedAt: "2024-02-12T08:45:00.000Z",
  },
  {
    id: "prd-1005",
    name: "Lumen Smart Desk Lamp",
    sku: "LUM-LAMP-02",
    category: "Home",
    price: 89.5,
    stock: 0,
    status: "archived",
    description:
      "Minimalist aluminium desk lamp with wireless charging pad, ambient light sensor and automation-ready firmware.",
    updatedAt: "2024-01-30T16:05:00.000Z",
  },
];

export const previewContacts: PreviewContact[] = [
  {
    id: "cnt-901",
    name: "Amelia Richards",
    company: "Northwind Trading",
    email: "amelia.richards@example.com",
    phone: "+44 20 7946 0737",
    role: "Head of Procurement",
    tags: ["VIP", "Strategic"],
    lastInteraction: "2024-02-26T11:15:00.000Z",
    notes:
      "Planning a Q2 assortment refresh. Interested in exclusive colorways and sustainable packaging options.",
  },
  {
    id: "cnt-902",
    name: "Mateusz Kowalski",
    company: "Baltic Outfitters",
    email: "mateusz.kowalski@example.com",
    phone: "+48 22 123 45 67",
    role: "Operations Manager",
    tags: ["Logistics", "Beta"],
    lastInteraction: "2024-03-02T09:00:00.000Z",
    notes:
      "Testing our fulfillment API. Needs sandbox credentials for two additional team members.",
  },
  {
    id: "cnt-903",
    name: "Priya Desai",
    company: "Orbit Supply Co.",
    email: "priya.desai@example.com",
    phone: "+1 415 555 1299",
    role: "Category Buyer",
    tags: ["Wholesale"],
    lastInteraction: "2024-02-18T17:25:00.000Z",
    notes:
      "Requested lead time analytics for the new transit hub. Considering three-month pilot contract.",
  },
  {
    id: "cnt-904",
    name: "Leonor García",
    company: "Atelier Verde",
    email: "leonor.garcia@example.com",
    phone: "+34 91 123 4567",
    role: "Design Director",
    tags: ["Creative", "Sustainability"],
    lastInteraction: "2024-02-05T12:50:00.000Z",
    notes:
      "Needs fabric swatches for recycled nylon line. Prefers asynchronous communication via shared workspace.",
  },
  {
    id: "cnt-905",
    name: "Jonah Lin",
    company: "Harbor & Co.",
    email: "jonah.lin@example.com",
    phone: "+1 206 555 7842",
    role: "Account Executive",
    tags: ["Partner"],
    lastInteraction: "2024-01-29T15:40:00.000Z",
    notes:
      "Prepping annual co-marketing campaign. Requested early access to the refreshed contacts workspace UI.",
  },
];
