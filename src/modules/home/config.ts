import { ModuleConfig } from "@/lib/types/module";

export const homeModule: ModuleConfig = {
  id: "home",
  title: "Start",
  description: "Powitalny panel użytkownika z ogłoszeniami i aktualnościami",
  color: "#3b82f6", // niebieski
  items: [
    {
      id: "news",
      label: "Aktualności",
      path: "/dashboard/start",
      icon: "Newspaper",
    },
  ],
};
