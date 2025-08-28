import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";
import { developmentModule } from "./development/config";
import { ModuleConfig } from "@/lib/types/module";
import { getWarehouseModule } from "./warehouse/config";
import { getAnalyticsModule } from "./analytics/config";
import { Widget } from "@/lib/types/widgets";

/**
 * Ładuje wszystkie dostępne moduły, biorąc pod uwagę dynamiczne dane jak typy produktów itp.
 */
export async function getAllModules(activeOrgId: string): Promise<ModuleConfig[]> {
  const warehouseModule = await getWarehouseModule(activeOrgId);
  const analyticsModule = await getAnalyticsModule();

  return [
    homeModule,
    warehouseModule, // dynamicznie załadowany
    teamsModule,
    orgManagmentModule,
    analyticsModule, // analytics module for activity tracking
    developmentModule, // development tools and debugging
    supportModule,
  ];
}
export async function getAllWidgets(activeOrgId: string): Promise<Widget[]> {
  const modules = await getAllModules(activeOrgId);
  return modules.flatMap((module) => module.widgets || []);
}
