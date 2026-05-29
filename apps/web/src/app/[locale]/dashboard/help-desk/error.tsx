"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function HelpDeskError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[HelpDesk] page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-muted-foreground text-sm">Failed to load Help Desk. Please try again.</p>
      <Button variant="outline" size="sm" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
