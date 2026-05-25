"use client";

import { useEffect } from "react";

interface AnalyticsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AnalyticsError({ error, reset }: AnalyticsErrorProps) {
  useEffect(() => {
    console.error("Analytics module error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-muted-foreground text-sm">Something went wrong loading Analytics.</p>
      <button onClick={reset} className="text-primary text-sm underline underline-offset-4">
        Try again
      </button>
    </div>
  );
}
