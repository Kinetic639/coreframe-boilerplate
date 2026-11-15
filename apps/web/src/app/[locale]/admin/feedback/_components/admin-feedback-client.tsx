"use client";

import { useState } from "react";
import {
  HydrationBoundary,
  QueryClient,
  QueryClientProvider,
  type DehydratedState,
} from "@tanstack/react-query";
import type { ColumnLayout, ColumnSet, ColumnWidths } from "@/components/data-table/columns";
import { FeedbackListView } from "@/components/platform-feedback/feedback-list-view";

/** The admin shell has no query client of its own (the dashboard's lives in its layout). */
export function AdminFeedbackClient({
  dehydrated,
  ...list
}: {
  dehydrated: DehydratedState;
  path: string;
  set: ColumnSet<string>;
  layout: ColumnLayout;
  widths: ColumnWidths;
  cookie: string;
  labels: Record<string, string>;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydrated}>
        <FeedbackListView scope="all" {...list} />
      </HydrationBoundary>
    </QueryClientProvider>
  );
}
