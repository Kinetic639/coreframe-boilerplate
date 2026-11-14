import "server-only";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { dehydrate, QueryClient } from "@tanstack/react-query";
import { createClient } from "@/utils/supabase/server";
import { PlatformFeedbackService } from "@/server/services/platform-feedback.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import {
  feedbackColumnSet,
  feedbackHref,
  feedbackLabels,
  feedbackListInput,
  feedbackListKey,
  loadFeedbackState,
  migrateFeedbackSearchParams,
  type FeedbackScope,
} from "./feedback-state";

/**
 * Everything a feedback page hands its list: the address read (old DataView
 * links redirected), the first page in the query cache, the words and the
 * person's columns. `path` is the page's own address, without a query.
 */
export async function loadFeedbackPage(
  scope: FeedbackScope,
  path: string,
  raw: Record<string, string | string[] | undefined>,
  cookieOwner: string
) {
  const migration = migrateFeedbackSearchParams(raw);
  const state = loadFeedbackState(migration.params);
  if (migration.changed || state.strona < 1) {
    redirectUrl(feedbackHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const [locale, t, supabase] = await Promise.all([
    getLocale(),
    getTranslations("platformFeedback"),
    createClient(),
  ]);
  const result = await PlatformFeedbackService.list(supabase, feedbackListInput(scope, state));

  // The first page goes straight into the list's cache; a failed read is
  // left to the client, which retries.
  const queryClient = new QueryClient();
  if (result.success) queryClient.setQueryData(feedbackListKey(scope, state), result.data);

  const labels = feedbackLabels(scope, t as (key: string) => string, locale);
  const set = feedbackColumnSet(scope, labels);
  const cookie = `ambra_feedback_${scope}_${cookieOwner}`;
  const { layout, widths } = await savedColumns(set, cookie);
  return { dehydrated: dehydrate(queryClient), set, layout, widths, cookie, labels };
}
