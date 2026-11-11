"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PaginatedResult } from "@/components/data-view/data-view.types";
import type { FeedbackListRow } from "@/lib/platform-feedback/types";
import { FeedbackListView } from "@/components/platform-feedback/feedback-list-view";

/** The admin shell has no query client of its own (the dashboard's lives in its layout). */
export function AdminFeedbackClient({
  initialData,
}: {
  initialData: PaginatedResult<FeedbackListRow>;
}) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <FeedbackListView scope="all" initialData={initialData} />
    </QueryClientProvider>
  );
}
