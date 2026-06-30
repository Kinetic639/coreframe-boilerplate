"use client";

import { Copy } from "lucide-react";

type ImportCopyButtonProps = {
  label: string;
  onClick: () => void;
};

export function ImportCopyButton({ label, onClick }: ImportCopyButtonProps) {
  return (
    <button
      type="button"
      className="grid h-6 w-6 place-items-center rounded hover:bg-background"
      aria-label={`Copy first ${label} value to all rows`}
      title={`Copy first ${label} value to all rows`}
      onClick={onClick}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
