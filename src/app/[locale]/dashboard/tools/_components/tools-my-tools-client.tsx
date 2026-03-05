"use client";

import { useTranslations } from "next-intl";
import { Wrench, Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/v2/utility/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  useMyEnabledToolsQuery,
  useToolsCatalogQuery,
  useSetToolEnabledMutation,
  useSetToolPinnedMutation,
} from "@/hooks/queries/tools";
import type { ToolCatalogItem, UserEnabledTool } from "@/server/services/tools.service";

interface ToolsMyToolsClientProps {
  initialMyTools: UserEnabledTool[];
  initialCatalog: ToolCatalogItem[];
}

export function ToolsMyToolsClient({ initialMyTools, initialCatalog }: ToolsMyToolsClientProps) {
  const t = useTranslations("modules.tools");

  const { data: myTools = initialMyTools } = useMyEnabledToolsQuery(initialMyTools);
  const { data: catalog = initialCatalog } = useToolsCatalogQuery(initialCatalog);

  const toggleEnabled = useSetToolEnabledMutation();
  const togglePinned = useSetToolPinnedMutation();

  // Index catalog for O(1) lookup
  const catalogMap = new Map(catalog.map((c) => [c.slug, c]));

  // Sort: pinned first, then by name
  const sorted = [...myTools].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    const nameA = catalogMap.get(a.tool_slug)?.name ?? a.tool_slug;
    const nameB = catalogMap.get(b.tool_slug)?.name ?? b.tool_slug;
    return nameA.localeCompare(nameB);
  });

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
        <Wrench className="mb-3 h-8 w-8 text-muted-foreground" />
        <p className="mb-1 font-medium text-foreground">{t("pages.myTools.empty")}</p>
        <p className="text-sm text-muted-foreground">
          <Link href="/dashboard/tools" className="underline underline-offset-2">
            {t("pages.myTools.emptyAction")}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sorted.map((userTool) => {
        const catalogItem = catalogMap.get(userTool.tool_slug);
        const name = catalogItem?.name ?? userTool.tool_slug;
        const description = catalogItem?.description ?? null;

        return (
          <Card
            key={userTool.id}
            aria-label={t("aria.toolCard", { name })}
            className="flex flex-col"
          >
            <CardHeader className="flex-row items-start gap-3 space-y-0 pb-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                <Wrench className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle className="line-clamp-1 text-base">{name}</CardTitle>
                <div className="mt-1 flex flex-wrap gap-1">
                  <Badge variant="success" size="sm">
                    {t("pages.detail.enabledBadge")}
                  </Badge>
                  {userTool.pinned && (
                    <Badge variant="info" size="sm">
                      {t("pages.detail.pinnedBadge")}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            {description && (
              <CardContent className="flex-1">
                <CardDescription className="line-clamp-2 text-sm">{description}</CardDescription>
              </CardContent>
            )}
            <CardFooter className="flex gap-2 pt-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={toggleEnabled.isPending}
                aria-label={t("aria.disableTool", { name })}
                onClick={() =>
                  toggleEnabled.mutate({
                    toolSlug: userTool.tool_slug,
                    enabled: false,
                  })
                }
              >
                {t("actions.disable")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                disabled={togglePinned.isPending}
                aria-label={
                  userTool.pinned ? t("aria.unpinTool", { name }) : t("aria.pinTool", { name })
                }
                onClick={() =>
                  togglePinned.mutate({
                    toolSlug: userTool.tool_slug,
                    pinned: !userTool.pinned,
                  })
                }
              >
                {userTool.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              </Button>
              <Button size="sm" variant="ghost" asChild aria-label={t("aria.viewDetail", { name })}>
                <Link
                  href={{
                    pathname: "/dashboard/tools/[slug]",
                    params: { slug: userTool.tool_slug },
                  }}
                >
                  →
                </Link>
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
