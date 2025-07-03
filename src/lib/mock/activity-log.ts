import { ActivityLog } from "@/lib/types/home";
import { mockUsers } from "./organization";

export const mockActivityLog: ActivityLog[] = [
  {
    id: "log-1",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440000", // Jan Kowalski
    action: "Utworzono lokalizację",
    details: "Magazyn Główny > Regał A > Półka 1",
    type: "system",
  },
  {
    id: "log-2",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440010", // Anna Nowak
    action: "Dodano produkt",
    details: "Produkt A (SKU: 12345)",
    type: "system",
  },
  {
    id: "log-3",
    timestamp: new Date().toISOString(),
    user_id: "550e8400-e29b-41d4-a716-446655440000", // Jan Kowalski
    action: "Zalogowano użytkownika",
    details: "Jan Kowalski",
    type: "user",
  },
];

export function getActivityLogWithUserDetails() {
  return mockActivityLog.map((log) => {
    const user = mockUsers.find((u) => u.id === log.user_id);
    return {
      ...log,
      user: user ? `${user.first_name} ${user.last_name}` : "Unknown User",
      user_avatar_url: user ? user.avatar_url : undefined,
    };
  });
}
