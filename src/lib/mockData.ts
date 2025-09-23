export interface Location {
  id: string;
  name: string;
  parentId: string | null;
  level: number;
  children?: Location[];
  customColor?: string;
  customIcon?: string;
  imageUrl?: string;
}

export interface QRCode {
  id: string;
  assignedLocationId: string | null;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  unit: string;
  locationId: string;
}

export const locations: Location[] = [
  {
    id: "w1",
    name: "Magazyn 1",
    parentId: null,
    level: 1,
    customColor: "#3b82f6",
    customIcon: "Building",
    imageUrl:
      "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=800",
    children: [
      {
        id: "w1-c1",
        name: "Szafa A",
        parentId: "w1",
        level: 2,
        customColor: "#10b981",
        customIcon: "Archive",
        imageUrl:
          "https://images.pexels.com/photos/4246120/pexels-photo-4246120.jpeg?auto=compress&cs=tinysrgb&w=800",
        children: [
          {
            id: "w1-c1-s1",
            name: "Półka 1",
            parentId: "w1-c1",
            level: 3,
            customColor: "#f59e0b",
            customIcon: "Package",
          },
          {
            id: "w1-c1-s2",
            name: "Półka 2",
            parentId: "w1-c1",
            level: 3,
            customColor: "#ef4444",
            customIcon: "Package",
          },
          {
            id: "w1-c1-s3",
            name: "Półka 3",
            parentId: "w1-c1",
            level: 3,
            customColor: "#8b5cf6",
            customIcon: "Package",
          },
        ],
      },
      {
        id: "w1-c2",
        name: "Szafa B",
        parentId: "w1",
        level: 2,
        customColor: "#06b6d4",
        customIcon: "Archive",
        children: [
          {
            id: "w1-c2-s1",
            name: "Półka 1",
            parentId: "w1-c2",
            level: 3,
            customColor: "#84cc16",
            customIcon: "Package",
          },
          {
            id: "w1-c2-s2",
            name: "Półka 2",
            parentId: "w1-c2",
            level: 3,
            customColor: "#f97316",
            customIcon: "Package",
          },
        ],
      },
    ],
  },
  {
    id: "w2",
    name: "Magazyn 2",
    parentId: null,
    level: 1,
    customColor: "#ec4899",
    customIcon: "Building",
    imageUrl:
      "https://images.pexels.com/photos/1267338/pexels-photo-1267338.jpeg?auto=compress&cs=tinysrgb&w=800",
    children: [
      {
        id: "w2-c1",
        name: "Szafa C",
        parentId: "w2",
        level: 2,
        customColor: "#14b8a6",
        customIcon: "Archive",
        children: [
          {
            id: "w2-c1-s1",
            name: "Półka 1",
            parentId: "w2-c1",
            level: 3,
            customColor: "#a855f7",
            customIcon: "Package",
          },
        ],
      },
    ],
  },
];

export const qrCodes: QRCode[] = [
  { id: "QR-001", assignedLocationId: "w1-c1-s1" },
  { id: "QR-002", assignedLocationId: "w1-c1-s2" },
  { id: "QR-003", assignedLocationId: null },
  { id: "QR-004", assignedLocationId: null },
  { id: "QR-005", assignedLocationId: "w2-c1-s1" },
];

export const products: Product[] = [
  {
    id: "p1",
    name: "Laptop Dell XPS 13",
    sku: "DELL-XPS-13",
    quantity: 5,
    unit: "szt",
    locationId: "w1-c1-s1",
  },
  {
    id: "p2",
    name: "Mysz bezprzewodowa",
    sku: "MOUSE-WIRELESS",
    quantity: 20,
    unit: "szt",
    locationId: "w1-c1-s1",
  },
  {
    id: "p3",
    name: "Klawiatura mechaniczna",
    sku: "KB-MECH-001",
    quantity: 12,
    unit: "szt",
    locationId: "w1-c1-s2",
  },
  {
    id: "p4",
    name: 'Monitor 24"',
    sku: "MON-24-001",
    quantity: 8,
    unit: "szt",
    locationId: "w1-c2-s1",
  },
  {
    id: "p5",
    name: "Słuchawki USB",
    sku: "HEADSET-USB",
    quantity: 15,
    unit: "szt",
    locationId: "w2-c1-s1",
  },
  {
    id: "p6",
    name: "Kabel HDMI",
    sku: "HDMI-CABLE",
    quantity: 30,
    unit: "szt",
    locationId: "w1-c1-s3",
  },
  {
    id: "p7",
    name: "Adapter USB-C",
    sku: "USB-C-ADAPTER",
    quantity: 25,
    unit: "szt",
    locationId: "w1-c2-s2",
  },
];

// Helper functions
export function getAllLocationsFlat(): Location[] {
  const flatten = (locs: Location[]): Location[] => {
    return locs.reduce((acc: Location[], loc) => {
      acc.push(loc);
      if (loc.children) {
        acc.push(...flatten(loc.children));
      }
      return acc;
    }, []);
  };
  return flatten(locations);
}

export function findLocationById(id: string): Location | null {
  const allLocations = getAllLocationsFlat();
  return allLocations.find((loc) => loc.id === id) || null;
}

export function getLocationPath(locationId: string): string {
  const location = findLocationById(locationId);
  if (!location) return "";

  const path = [location.name];
  let currentLocation = location;

  while (currentLocation.parentId) {
    const parent = findLocationById(currentLocation.parentId);
    if (parent) {
      path.unshift(parent.name);
      currentLocation = parent;
    } else {
      break;
    }
  }

  return path.join(" > ");
}

export function getProductsByLocationId(locationId: string): Product[] {
  return products.filter((product) => product.locationId === locationId);
}

export function getTotalProductCountForLocation(locationId: string): number {
  const location = findLocationById(locationId);
  if (!location) return 0;

  // Get direct products in this location
  let count = getProductsByLocationId(locationId).length;

  // Add products from all child locations recursively
  if (location.children) {
    for (const child of location.children) {
      count += getTotalProductCountForLocation(child.id);
    }
  }

  return count;
}

export function findQRCodeById(id: string): QRCode | null {
  return qrCodes.find((qr) => qr.id === id) || null;
}
