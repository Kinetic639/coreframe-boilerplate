"use client";

import React from "react";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationResult } from "./types";

type Props = {
  validation: ValidationResult;
  documentTypeCode?: string;
};

export const MovementValidationStrip = React.memo(function MovementValidationStrip({
  validation,
  documentTypeCode,
}: Props) {
  const { isValid, documentErrors, positionErrors, allErrors } = validation;
  return (
    <div
      className={cn(
        "shrink-0 px-4 py-2.5 border-b text-sm",
        isValid
          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
          : "bg-amber-500/10 text-amber-800 dark:text-amber-300"
      )}
    >
      <div className="flex items-start gap-2.5">
        {isValid ? (
          <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        )}
        <div className="flex-1">
          <p className="font-semibold text-xs uppercase tracking-wider">
            {isValid
              ? `Document valid and ready to post${documentTypeCode ? ` (${documentTypeCode})` : ""}`
              : `${allErrors.length} issue${allErrors.length > 1 ? "s" : ""} preventing posting`}
          </p>
          {!isValid ? (
            <ul className="mt-1 space-y-0.5 text-xs">
              {allErrors.map((issue, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="font-bold select-none">⚠</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs mt-0.5 opacity-70">
              All fields complete. Save as draft or post to finalize.
            </p>
          )}
        </div>
      </div>
    </div>
  );
});
