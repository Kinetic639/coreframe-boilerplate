"use client";

import { useTranslations } from "next-intl";
import { Hash, Lock } from "lucide-react";
import type { MentionItem } from "@repo/rich-text/mention-utils";
import { Link } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { cn } from "@/lib/utils";
import { MENTION_PERSON, mentionRoute } from "@/lib/mentions";
import type { MentionAccess } from "@/hooks/queries/mentions";
import { HIT_ICONS } from "@/components/v2/global-search/hit-display";
import type { ExactHitType } from "@/server/services/global-search.service";

const CHIP = "inline-flex max-w-full items-center gap-1 rounded px-1 align-baseline font-medium";

/**
 * A mention in rendered text. A person is a tag ("@Paweł Wiśniewski", stronger
 * when it is the reader). An object is a link with its type icon and number —
 * only when the reader may open it; otherwise a neutral "no access" tag that
 * does not repeat the object's name.
 */
export function MentionChip({
  mention,
  access,
  meId,
}: {
  mention: MentionItem;
  access: MentionAccess;
  meId?: string | null;
}) {
  const t = useTranslations("mentions");

  if (mention.type === MENTION_PERSON) {
    return (
      <span
        data-mention="person"
        className={cn(
          CHIP,
          mention.id === meId
            ? "bg-amber-200/80 text-amber-950 dark:bg-amber-400/30 dark:text-amber-100"
            : "bg-primary/10 text-primary"
        )}
      >
        @{mention.label}
      </span>
    );
  }

  if (access === "denied") {
    return (
      <span data-mention="denied" className={cn(CHIP, "bg-muted text-muted-foreground")}>
        <Lock className="size-3 shrink-0" aria-hidden />
        {t("noAccess")}
      </span>
    );
  }

  const Icon = HIT_ICONS[mention.type as ExactHitType] ?? Hash;
  const content = (
    <>
      <Icon className="size-3 shrink-0" aria-hidden />
      <span className={cn("truncate", mention.code && "font-mono")}>
        {mention.code || mention.label}
      </span>
    </>
  );
  const route = access === "ok" ? mentionRoute(mention.href) : null;
  const title = mention.code && mention.label !== mention.code ? mention.label : undefined;

  if (!route) {
    return (
      <span data-mention="object" title={title} className={cn(CHIP, "bg-primary/10 text-primary")}>
        {content}
      </span>
    );
  }
  return (
    <Link
      data-mention="object"
      href={
        route.query
          ? { pathname: toUnsafeI18nHref(route.pathname), query: route.query }
          : toUnsafeI18nHref(route.pathname)
      }
      title={title}
      className={cn(
        CHIP,
        "bg-primary/10 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      )}
    >
      {content}
    </Link>
  );
}
