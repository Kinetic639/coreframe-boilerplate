import { warehouseModule } from "@/modules/warehouse";
import { ModuleMenu } from "../types/moduleMenu";

const allAvailableModules: Record<string, { sidebar: ModuleMenu }> = {
  warehouse: warehouseModule,
  // tu dodasz kolejne moduły np. catalog: catalogModule
};

export async function loadSidebarModules(slugs: string[]): Promise<ModuleMenu[]> {
  return slugs
    .map((slug) => allAvailableModules[slug])
    .filter((mod) => !!mod)
    .map((mod) => mod.sidebar);
}
