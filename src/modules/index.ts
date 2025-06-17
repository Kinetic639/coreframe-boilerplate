import { warehouseModule } from "./warehouse/config";
import { teamsModule } from "./teams/config";
import { orgManagmentModule } from "./organization-managment/config";
import { homeModule } from "./home/config";

export const modules = [homeModule, warehouseModule, teamsModule, orgManagmentModule];

export { homeModule, warehouseModule, teamsModule, orgManagmentModule };
