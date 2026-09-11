"use client";

import { useLocale } from "next-intl";
import { Button } from "@/components/ui/button";
import { homeCopy } from "./_lib/copy";

export default function HomeError({ reset }: { reset: () => void }) {
  const copy = homeCopy(useLocale());
  return (
    <div role="alert" className="space-y-4 rounded-lg border bg-card p-6 text-card-foreground">
      <h1 className="text-xl font-semibold">{copy.title}</h1>
      <p>{copy.unavailable}</p>
      <Button variant="outline" onClick={reset}>
        {copy.retry}
      </Button>
    </div>
  );
}
