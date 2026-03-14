"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { getOrgActivityAction } from "@/app/actions/audit/get-org-activity";
import { EventFeedClient } from "@/app/[locale]/dashboard/activity/_components/event-feed-client";
import type { ProjectedEvent } from "@/server/audit/types";

interface OrgActivityWrapperProps {
  initialEvents: ProjectedEvent[];
  initialTotal: number;
  limit: number;
}

export function OrgActivityWrapper({
  initialEvents,
  initialTotal,
  limit,
}: OrgActivityWrapperProps) {
  const t = useTranslations("activityFeed");
  const [events, setEvents] = useState(initialEvents);
  const [total, setTotal] = useState(initialTotal);
  const [offset, setOffset] = useState(0);
  const [isPending, startTransition] = useTransition();

  function handlePageChange(newOffset: number) {
    startTransition(async () => {
      const result = await getOrgActivityAction(limit, newOffset);
      if (result.success) {
        setEvents(result.data.events);
        setTotal(result.data.total);
        setOffset(newOffset);
      }
    });
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">{t("orgTitle")}</h1>
        <p className="text-sm text-muted-foreground">{t("orgDescription")}</p>
      </div>
      {isPending ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
          {t("loading")}
        </div>
      ) : (
        <EventFeedClient
          events={events}
          total={total}
          limit={limit}
          offset={offset}
          scope="org"
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
