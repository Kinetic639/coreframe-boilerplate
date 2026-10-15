"use client";

import { Copy } from "lucide-react";

type ImportCopyButtonProps = {
  label: string;
  /** Full, translated tooltip; overrides the English one built from label. */
  title?: string;
  onClick: () => void;
};

export function ImportCopyButton({ label, title, onClick }: ImportCopyButtonProps) {
  const text = title ?? `Copy first ${label} value to all rows`;
  return (
    <button
      type="button"
      className="grid h-6 w-6 place-items-center rounded hover:bg-background"
      aria-label={text}
      title={text}
      onClick={onClick}
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}
