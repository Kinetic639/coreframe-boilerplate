import { getLocale } from "next-intl/server";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { homeCopy } from "./_lib/copy";
import { OverviewSkeleton, WidgetSkeleton } from "./_components/home-sections";

export default async function Loading() {
  const copy = homeCopy(await getLocale());
  return (
    <div className="w-full space-y-3 pb-6">
      <Card className="grid gap-3 rounded-md p-3 shadow-none sm:grid-cols-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-full" />
      </Card>
      <OverviewSkeleton label={copy.loading} />
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <WidgetSkeleton label={copy.loading} />
        <WidgetSkeleton label={copy.loading} />
      </div>
    </div>
  );
}
