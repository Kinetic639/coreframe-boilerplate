import { ChevronLeft, ChevronRight, Inbox, Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { PAGE_SIZE, type ListRequestsInput } from "@/server/requests/requests.service";
import { toQuery } from "@/server/requests/list-params";
import { REQUEST_FILTERS, type RequestListItem, type TicketTypeRef } from "@/server/requests/types";
import { AutoSubmitSelect } from "./auto-submit-select";
import { RequestCard } from "./request-card";

export async function RequestList({
  input,
  items,
  total,
  types,
  selectedId,
}: {
  input: ListRequestsInput;
  items: RequestListItem[];
  total: number;
  types: TicketTypeRef[];
  selectedId?: string;
}) {
  const t = await getTranslations("requests");
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const linkQuery = toQuery(input);

  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex flex-col gap-2.5 border-b border-stone-200 bg-white px-4 pb-3 pt-1">
        <form method="get" className="flex flex-col gap-2.5" role="search">
          {input.scope === "branch" && <input type="hidden" name="scope" value="branch" />}
          {input.filter !== "open" && <input type="hidden" name="f" value={input.filter} />}
          {input.sort === "newest" && <input type="hidden" name="sort" value="newest" />}
          <label className="flex h-10 items-center gap-2 rounded-[10px] bg-stone-100 px-3 text-stone-500">
            <Search className="h-4 w-4 shrink-0" />
            <span className="sr-only">{t("search")}</span>
            <input
              type="search"
              name="q"
              defaultValue={input.search ?? ""}
              placeholder={t("searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-sm text-stone-900 outline-none placeholder:text-stone-500"
            />
          </label>
          <div className="flex items-center gap-2">
            <div
              role="tablist"
              className="grid flex-1 grid-cols-2 gap-0.5 rounded-[10px] bg-stone-100 p-[3px]"
            >
              {(["mine", "branch"] as const).map((scope) => (
                <Link
                  key={scope}
                  role="tab"
                  aria-selected={input.scope === scope}
                  href={{ pathname: "/", query: toQuery(input, { scope, page: 1 }) }}
                  className={cn(
                    "flex h-8 items-center justify-center rounded-lg text-[13px]",
                    input.scope === scope
                      ? "bg-white font-semibold text-stone-900 shadow-[0_1px_2px_rgba(28,25,23,.08),0_0_0_1px_rgba(28,25,23,.04)]"
                      : "font-medium text-stone-600"
                  )}
                >
                  {t(`scope.${scope}`)}
                </Link>
              ))}
            </div>
            {types.length > 0 && (
              <AutoSubmitSelect
                name="type"
                defaultValue={input.typeId ?? ""}
                aria-label={t("type")}
                className="h-[38px] max-w-[42%] rounded-[10px] border border-stone-200 bg-white px-2 text-[13px] text-stone-700"
              >
                <option value="">{t("allTypes")}</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </AutoSubmitSelect>
            )}
          </div>
        </form>
        <div className="-mr-4 flex gap-1.5 overflow-x-auto pr-4 [scrollbar-width:none]">
          {REQUEST_FILTERS.map((f) => {
            const active = input.filter === f;
            return (
              <Link
                key={f}
                href={{ pathname: "/", query: toQuery(input, { filter: f, page: 1 }) }}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "flex h-[30px] shrink-0 items-center rounded-full border px-[11px] text-[12.5px] font-medium",
                  active
                    ? "border-stone-900 bg-stone-900 text-white"
                    : f === "yourTurn"
                      ? "border-[#F3C9B5] bg-[#FDF1EB] font-semibold text-[#A63A12]"
                      : "border-stone-200 bg-white text-stone-700"
                )}
              >
                {t(`filter.${f}`)}
              </Link>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-16 text-center text-stone-500">
          <Inbox className="h-8 w-8 text-stone-400" />
          <p className="text-sm font-medium text-stone-700">{t("empty.title")}</p>
          <p className="max-w-xs text-[13px]">
            {input.search ? t("empty.search") : t("empty.body")}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2 px-3 py-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <RequestCard item={item} selected={item.id === selectedId} query={linkQuery} />
            </li>
          ))}
        </ul>
      )}

      {pages > 1 && (
        <nav className="flex items-center justify-between px-4 pb-24 pt-1 text-xs text-stone-500 lg:pb-4">
          <span>{t("pageOf", { page: input.page, pages, total })}</span>
          <span className="flex gap-1">
            {input.page > 1 ? (
              <Link
                aria-label={t("prev")}
                href={{ pathname: "/", query: toQuery(input, { page: input.page - 1 }) }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700"
              >
                <ChevronLeft className="h-4 w-4" />
              </Link>
            ) : null}
            {input.page < pages ? (
              <Link
                aria-label={t("next")}
                href={{ pathname: "/", query: toQuery(input, { page: input.page + 1 }) }}
                className="flex h-8 w-8 items-center justify-center rounded-md border border-stone-200 bg-white text-stone-700"
              >
                <ChevronRight className="h-4 w-4" />
              </Link>
            ) : null}
          </span>
        </nav>
      )}
    </section>
  );
}
