import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";
import { ModuleConfig } from "@/lib/types/module";
import { getWarehouseModule } from "./warehouse/config";
import { Widget } from "@/lib/types/widgets";

/**
 * Ładuje wszystkie dostępne moduły, biorąc pod uwagę dynamiczne dane jak typy produktów itp.
 */
export async function getAllModules(activeOrgId: string): Promise<ModuleConfig[]> {
  const warehouseModule = await getWarehouseModule(activeOrgId);

  return [
    homeModule,
    warehouseModule, // dynamicznie załadowany
    teamsModule,
    orgManagmentModule,
    supportModule,
  ];
}
export async function getAllWidgets(activeOrgId: string): Promise<Widget[]> {
  const modules = await getAllModules(activeOrgId);
  return modules.flatMap((module) => module.widgets || []);
}
