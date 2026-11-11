import { getLocale, getTranslations } from "next-intl/server";
import { CheckSquare, MessageSquare, MessagesSquare, Ticket, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { relationRoute, type RelationItem, type RelationSource } from "@/lib/relations/types";

const GROUPS: { source: RelationSource; icon: LucideIcon }[] = [
  { source: "ticket", icon: Ticket },
  { source: "task", icon: CheckSquare },
  { source: "comment", icon: MessageSquare },
  { source: "chat", icon: MessagesSquare },
];

/**
 * "Related": tickets raised for this order and every place it is mentioned
 * with "@" — ticket and task descriptions, comments, chat messages. Only rows
 * the viewer may open are here (the database filters by their own access).
 */
export async function RepairOrderRelations({
  items,
  loadError,
}: {
  items: RelationItem[];
  loadError: boolean;
}) {
  const t = await getTranslations("modules.workshop.repairOrders.relations");
  const locale = await getLocale();
  const when = (iso: string) =>
    new Date(iso).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" });

  if (loadError) {
    return <p className="text-destructive text-sm">{t("loadError")}</p>;
  }
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6" data-testid="repair-order-relations">
        <p className="text-sm font-medium">{t("emptyTitle")}</p>
        <p className="text-muted-foreground mt-1 max-w-xl text-sm">{t("emptyHint")}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6" data-testid="repair-order-relations">
      {GROUPS.map(({ source, icon: Icon }) => {
        const rows = items.filter((item) => item.source === source);
        if (rows.length === 0) return null;
        return (
          <section key={source} className="flex flex-col gap-2">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
              <Icon className="text-muted-foreground h-4 w-4" />
              {t(`groups.${source}`)}
              <span className="text-muted-foreground text-sm font-normal">{rows.length}</span>
            </h2>
            <ul className="divide-y rounded-lg border">
              {rows.map((item) => {
                const route = relationRoute(item);
                const title =
                  item.title || (item.source === "chat" ? t("directConversation") : t("untitled"));
                const body = (
                  <>
                    <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
                      {item.code ? (
                        <span className="font-mono text-xs font-medium">{item.code}</span>
                      ) : null}
                      <span className="truncate text-sm font-medium">{title}</span>
                      <span className="bg-muted text-muted-foreground rounded px-1.5 text-[11px]">
                        {t(`relation.${item.relation}`)}
                      </span>
                    </span>
                    {item.snippet ? (
                      <span className="text-muted-foreground line-clamp-2 text-sm">
                        {item.snippet}
                      </span>
                    ) : null}
                    <span className="text-muted-foreground text-xs">
                      {[item.author, when(item.created_at)].filter(Boolean).join(" · ")}
                    </span>
                  </>
                );
                return (
                  <li key={`${item.source}:${item.id}`}>
                    {route ? (
                      <Link
                        href={
                          route.query
                            ? { pathname: toUnsafeI18nHref(route.pathname), query: route.query }
                            : toUnsafeI18nHref(route.pathname)
                        }
                        className="hover:bg-muted/50 flex flex-col gap-1 px-3 py-2.5 transition-colors"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div className="flex flex-col gap-1 px-3 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
