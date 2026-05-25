"use client";

import { useEffect } from "react";

interface WorkshopErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function WorkshopError({ error, reset }: WorkshopErrorProps) {
  useEffect(() => {
    console.error("Workshop module error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-6">
      <p className="text-muted-foreground text-sm">Something went wrong loading Workshop.</p>
      <button onClick={reset} className="text-primary text-sm underline underline-offset-4">
        Try again
      </button>
    </div>
  );
}
