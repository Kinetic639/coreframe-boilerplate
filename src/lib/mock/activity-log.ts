import { ActivityLog } from "@/lib/types/home";

export const mockActivityLog: ActivityLog[] = [
  {
    id: "log-1",
    timestamp: new Date().toISOString(),
    user: "Jan Kowalski",
    action: "Utworzono lokalizację",
    details: "Magazyn Główny > Regał A > Półka 1",
    type: "system",
  },
  {
    id: "log-2",
    timestamp: new Date().toISOString(),
    user: "Anna Nowak",
    action: "Dodano produkt",
    details: "Produkt A (SKU: 12345)",
    type: "system",
  },
  {
    id: "log-3",
    timestamp: new Date().toISOString(),
    user: "System",
    action: "Zalogowano użytkownika",
    details: "Jan Kowalski",
    type: "user",
  },
];
