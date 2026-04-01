"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Wrench } from "lucide-react";
import { Badge } from "@/components/v2/utility/badge";
import { SearchForm } from "@/components/v2/forms/search-form";
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
  useToolsCatalogQuery,
  useMyEnabledToolsQuery,
  useSetToolEnabledMutation,
} from "@/hooks/queries/tools";
import type { ToolCatalogItem, UserEnabledTool } from "@/server/services/tools.service";

interface ToolsCatalogClientProps {
  initialCatalog: ToolCatalogItem[];
  initialMyTools: UserEnabledTool[];
}

export function ToolsCatalogClient({ initialCatalog, initialMyTools }: ToolsCatalogClientProps) {
  const t = useTranslations("modules.tools");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");

  const { data: catalog = initialCatalog } = useToolsCatalogQuery(initialCatalog);
  const { data: myTools = initialMyTools } = useMyEnabledToolsQuery(initialMyTools);
  const toggleEnabled = useSetToolEnabledMutation();

  // Build enabled set for O(1) lookup
  const enabledSlugs = new Set(myTools.filter((t) => t.enabled).map((t) => t.tool_slug));

  // Derive unique categories from catalog
  const categories = Array.from(
    new Set(catalog.map((tool) => tool.category).filter(Boolean))
  ) as string[];

  const handleSearch = useCallback((q: string) => setSearch(q), []);

  const filtered = catalog.filter((tool) => {
    const matchesSearch =
      !search ||
      tool.name.toLowerCase().includes(search.toLowerCase()) ||
      (tool.description ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesCategory = activeCategory === "all" || tool.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categoryLabel = (cat: string) => {
    const key = `pages.catalog.categories.${cat}` as const;
    try {
      return t(key as Parameters<typeof t>[0]);
    } catch {
      return cat;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search + category filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <SearchForm
            placeholder={t("pages.catalog.searchPlaceholder")}
            onSearch={handleSearch}
            debounce={250}
            aria-label={t("aria.searchTools")}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant={activeCategory === "all" ? "default" : "outline"}
            onClick={() => setActiveCategory("all")}
          >
            {t("pages.catalog.filterAll")}
          </Button>
          {categories.map((cat) => (
            <Button
              key={cat}
              size="sm"
              variant={activeCategory === cat ? "default" : "outline"}
              onClick={() => setActiveCategory(cat)}
            >
              {categoryLabel(cat)}
            </Button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Wrench className="mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t("pages.catalog.empty")}</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tool) => {
            const isEnabled = enabledSlugs.has(tool.slug);
            return (
              <Card
                key={tool.slug}
                aria-label={t("aria.toolCard", { name: tool.name })}
                className="flex flex-col"
              >
                <CardHeader className="flex-row items-start gap-3 space-y-0 pb-2">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary/10">
                    <Wrench className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="line-clamp-1 text-base">{tool.name}</CardTitle>
                    {tool.category && (
                      <Badge variant="secondary" size="sm" className="mt-1">
                        {categoryLabel(tool.category)}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <CardDescription className="line-clamp-2 text-sm">
                    {tool.description}
                  </CardDescription>
                </CardContent>
                <CardFooter className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={isEnabled ? "outline" : "default"}
                    className="flex-1"
                    disabled={toggleEnabled.isPending}
                    aria-label={
                      isEnabled
                        ? t("aria.disableTool", { name: tool.name })
                        : t("aria.enableTool", { name: tool.name })
                    }
                    onClick={() =>
                      toggleEnabled.mutate({
                        toolSlug: tool.slug,
                        enabled: !isEnabled,
                      })
                    }
                  >
                    {isEnabled ? t("actions.disable") : t("actions.enable")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    asChild
                    aria-label={t("aria.viewDetail", { name: tool.name })}
                  >
                    <Link
                      href={{
                        pathname: "/dashboard/tools/[slug]",
                        params: { slug: tool.slug },
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
      )}
    </div>
  );
}
