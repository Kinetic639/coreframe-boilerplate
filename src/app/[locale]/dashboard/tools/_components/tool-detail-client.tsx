"use client";

import { useTranslations } from "next-intl";
import { Pin, PinOff, ArrowLeft, Wrench } from "lucide-react";
import { Badge } from "@/components/v2/utility/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Link } from "@/i18n/navigation";
import {
  useMyToolRecordQuery,
  useSetToolEnabledMutation,
  useSetToolPinnedMutation,
} from "@/hooks/queries/tools";
import { getToolComponent } from "@/lib/tools/registry";
import type { ToolCatalogItem, UserEnabledTool } from "@/server/services/tools.service";

interface ToolDetailClientProps {
  tool: ToolCatalogItem;
  initialRecord: UserEnabledTool | null;
}

export function ToolDetailClient({ tool, initialRecord }: ToolDetailClientProps) {
  const t = useTranslations("modules.tools");

  const { data: record = initialRecord } = useMyToolRecordQuery(tool.slug, initialRecord);
  const toggleEnabled = useSetToolEnabledMutation();
  const togglePinned = useSetToolPinnedMutation();

  const isEnabled = record?.enabled ?? false;
  const isPinned = record?.pinned ?? false;

  // --- Tool is enabled: show the tool UI ---
  if (isEnabled) {
    const ToolComponent = getToolComponent(tool.slug);

    return (
      <div className="space-y-4">
        {/* Compact settings strip */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-4 py-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">{tool.name}</span>
            <Badge variant="success" size="sm">
              {t("pages.detail.enabledBadge")}
            </Badge>
            {isPinned && (
              <Badge variant="info" size="sm">
                {t("pages.detail.pinnedBadge")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="sm"
              variant="ghost"
              disabled={togglePinned.isPending}
              aria-label={
                isPinned
                  ? t("aria.unpinTool", { name: tool.name })
                  : t("aria.pinTool", { name: tool.name })
              }
              onClick={() => togglePinned.mutate({ toolSlug: tool.slug, pinned: !isPinned })}
            >
              {isPinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
              <span className="ml-1 hidden sm:inline">
                {isPinned ? t("actions.unpin") : t("actions.pin")}
              </span>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={toggleEnabled.isPending}
              aria-label={t("aria.disableTool", { name: tool.name })}
              onClick={() => toggleEnabled.mutate({ toolSlug: tool.slug, enabled: false })}
            >
              {t("actions.disable")}
            </Button>
          </div>
        </div>

        {/* Tool UI from registry, or developer placeholder */}
        {ToolComponent ? <ToolComponent /> : <ToolPlaceholder slug={tool.slug} t={t} />}
      </div>
    );
  }

  // --- Tool is not enabled: preview / onboarding ---
  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/dashboard/tools">
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("pages.detail.backToAll")}
          </Link>
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">{tool.name}</h1>
          {tool.description && <p className="text-muted-foreground">{tool.description}</p>}
          <div className="flex flex-wrap gap-2 pt-1">
            <Badge variant="secondary">{t("pages.detail.disabledBadge")}</Badge>
            {tool.category && <Badge variant="outline">{tool.category}</Badge>}
          </div>
        </div>

        <Button
          disabled={toggleEnabled.isPending}
          aria-label={t("aria.enableTool", { name: tool.name })}
          onClick={() => toggleEnabled.mutate({ toolSlug: tool.slug, enabled: true })}
        >
          {toggleEnabled.isPending ? t("actions.enabling") : t("actions.enable")}
        </Button>
      </div>

      <Separator />

      <p className="text-sm text-muted-foreground">{t("pages.detail.enableToUse")}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Placeholder shown when tool is enabled but has no registered UI component
// ---------------------------------------------------------------------------

function ToolPlaceholder({
  slug,
  t,
}: {
  slug: string;
  t: ReturnType<typeof useTranslations<"modules.tools">>;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-16 text-center">
      <Wrench className="mb-4 h-10 w-10 text-muted-foreground" />
      <p className="mb-1 font-medium">{t("pages.detail.uiNotRegistered")}</p>
      <p className="mb-3 max-w-sm text-sm text-muted-foreground">
        {t("pages.detail.uiNotRegisteredDesc")}
      </p>
      <code className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
        {t("pages.detail.uiNotRegisteredHint")} → &quot;{slug}&quot;
      </code>
    </div>
  );
}
