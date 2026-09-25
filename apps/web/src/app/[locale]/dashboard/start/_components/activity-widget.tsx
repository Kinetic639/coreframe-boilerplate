import { getTranslations } from "next-intl/server";
import { EventCategoryIcon } from "@/components/audit/event-icons";
import { loadHomeActivity } from "../_lib/data";
import { activityForBranch, formatActivityDate } from "../_lib/model";
import type { HomeCopy } from "../_lib/copy";
import { WidgetFrame, WidgetEmpty, WidgetUnavailable } from "./home-sections";

export async function ActivityWidget({
  branchId,
  locale,
  copy,
}: {
  branchId: string | null;
  locale: string;
  copy: HomeCopy;
}) {
  const [result, t] = await Promise.all([loadHomeActivity(), getTranslations()]);
  const events = result.state === "ready" ? activityForBranch(result.data.events, branchId) : [];
  return (
    <WidgetFrame id="home-activity" title={copy.activity} description={copy.activityDescription}>
      {result.state === "unavailable" ? (
        <WidgetUnavailable copy={copy} />
      ) : events.length === 0 ? (
        <WidgetEmpty
          title={copy.activityEmpty}
          description={copy.activityEmptyDescription}
          activity
        />
      ) : (
        <ol className="relative before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-px before:bg-border">
          {events.map((event) => {
            const key = `${event.summaryKey}.${event.summaryPerspective}`;
            const summary = t.has(key)
              ? t(key, event.summaryParams as Parameters<typeof t>[1])
              : event.summary;
            const date = formatActivityDate(event.created_at, locale);
            return (
              <li key={event.id} className="relative flex gap-2.5 py-1.5 first:pt-0 last:pb-0">
                <span className="relative z-10 mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border bg-card text-muted-foreground">
                  <EventCategoryIcon category={event.category} className="size-3" />
                </span>
                <div className="min-w-0">
                  <p className="break-words text-xs font-medium leading-4">{summary}</p>
                  {date ? (
                    <time
                      dateTime={event.created_at}
                      className="mt-0.5 block text-[11px] leading-4 text-muted-foreground"
                    >
                      {date}
                    </time>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="mt-3 border-t pt-2 text-[11px] text-muted-foreground">{copy.timeZone}</p>
    </WidgetFrame>
  );
}
