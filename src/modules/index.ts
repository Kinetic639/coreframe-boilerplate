import { warehouseModule } from "./warehouse/config";
import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";
import { supportModule } from "./support/config";

export const modules = [
  homeModule,
  warehouseModule,
  teamsModule,
  orgManagmentModule,
  supportModule,
];

export { homeModule, warehouseModule, teamsModule, orgManagmentModule, supportModule };
