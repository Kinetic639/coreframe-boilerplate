"use client";

import { useTranslations } from "next-intl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToolsMyToolsClient } from "./tools-my-tools-client";
import { ToolsCatalogClient } from "./tools-catalog-client";
import type { ToolCatalogItem, UserEnabledTool } from "@/server/services/tools.service";

interface ToolsUnifiedClientProps {
  initialMyTools: UserEnabledTool[];
  initialCatalog: ToolCatalogItem[];
}

export function ToolsUnifiedClient({ initialMyTools, initialCatalog }: ToolsUnifiedClientProps) {
  const t = useTranslations("modules.tools");

  return (
    <Tabs defaultValue="my-tools">
      <TabsList>
        <TabsTrigger value="my-tools">{t("items.myTools")}</TabsTrigger>
        <TabsTrigger value="all-tools">{t("items.allTools")}</TabsTrigger>
      </TabsList>
      <TabsContent value="my-tools" className="mt-6">
        <ToolsMyToolsClient initialMyTools={initialMyTools} initialCatalog={initialCatalog} />
      </TabsContent>
      <TabsContent value="all-tools" className="mt-6">
        <ToolsCatalogClient initialCatalog={initialCatalog} initialMyTools={initialMyTools} />
      </TabsContent>
    </Tabs>
  );
}
