"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

type AmbraLocationsErrorProps = {
  error: Error;
  reset: () => void;
};

export default function AmbraLocationsError({ error, reset }: AmbraLocationsErrorProps) {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background p-6 text-foreground">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-black uppercase tracking-tight text-foreground">
          Ambra locations failed to load
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-xs font-semibold uppercase tracking-wide text-primary-foreground transition hover:bg-primary/90"
        >
          <RotateCcw className="h-4 w-4" />
          Retry
        </button>
      </div>
    </div>
  );
}
