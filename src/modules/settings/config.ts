import { ModuleConfig } from "@/lib/types/module";

export const settingsModule: ModuleConfig = {
  id: "organization",
  title: "Ustawienia Organizacji",
  description: "Konfiguracja organizacji",
  color: "#64748b",
  items: [
    {
      id: "organization",
      label: "Organizacja",
      path: "/organizacja/ustawienia",
      icon: "Building",
    },
    {
      id: "users",
      label: "Użytkownicy",
      path: "/organizacja/uzytkownicy",
      icon: "UserCog",
    },
    {
      id: "security",
      label: "Bezpieczeństwo",
      path: "/organizacja/bezpieczenstwo",
      icon: "Shield",
    },
    {
      id: "integrations",
      label: "Integracje",
      path: "/organizacja/integracje",
      icon: "Plug",
    },
  ],
};
