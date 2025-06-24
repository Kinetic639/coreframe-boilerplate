import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";
import { ModuleConfig } from "@/lib/types/module";
import { getWarehouseModule } from "./warehouse/config";
import { catalogModule } from "./catalog/config";

/**
 * Ładuje wszystkie dostępne moduły, biorąc pod uwagę dynamiczne dane jak typy produktów itp.
 */
export async function getAllModules(activeOrgId: string): Promise<ModuleConfig[]> {
  const warehouseModule = await getWarehouseModule(activeOrgId);

  return [
    homeModule,
    warehouseModule, // dynamicznie załadowany
    catalogModule,
    teamsModule,
    orgManagmentModule,
    supportModule,
  ];
}
