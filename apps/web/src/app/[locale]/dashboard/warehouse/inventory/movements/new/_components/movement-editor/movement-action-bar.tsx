"use client";

import React from "react";
import { ArrowLeft, CheckCircle, Layers, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "@/i18n/navigation";
import type { InventoryMovementType } from "@/lib/warehouse/inventory-types";

type Props = {
  isEdit: boolean;
  draftNumber?: string;
  branchName: string;
  selType: InventoryMovementType | null;
  lineCount: number;
  totalQty: number;
  isPending: boolean;
  isValid: boolean;
  onSaveDraft: () => void;
  onSaveAndPost: () => void;
};

export const MovementActionBar = React.memo(function MovementActionBar({
  isEdit,
  draftNumber,
  branchName,
  selType,
  lineCount,
  totalQty,
  isPending,
  isValid,
  onSaveDraft,
  onSaveAndPost,
}: Props) {
  const router = useRouter();
  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3 min-w-0">
        <Button variant="outline" size="sm" className="h-8 gap-1.5" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">Back</span>
        </Button>
        <div className="h-5 w-px bg-border hidden sm:block" />
        <div className="flex items-center gap-2 min-w-0">
          <Layers className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-semibold text-sm truncate">
            {isEdit ? (draftNumber ?? "Edit Draft") : "New Movement"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {selType && (
            <Badge className="bg-primary text-primary-foreground text-[10px] font-bold rounded-sm">
              {selType.document_type_code}
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px] font-bold rounded-sm bg-yellow-500/10 text-yellow-600 border-yellow-500/30 dark:text-yellow-400"
          >
            {isEdit ? "Draft" : "New"}
          </Badge>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden md:flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-right bg-card">
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">
            Summary
          </span>
          <span className="text-xs font-mono font-bold">
            {lineCount} pos. · {totalQty} qty
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={onSaveDraft}
          disabled={isPending}
        >
          {isPending ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <Save className="mr-1.5 h-3 w-3" />
          )}
          Save Draft
        </Button>
        <Button
          size="sm"
          className="h-8 text-xs"
          onClick={onSaveAndPost}
          disabled={isPending || !isValid}
        >
          {isPending ? (
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
          ) : (
            <CheckCircle className="mr-1.5 h-3 w-3" />
          )}
          Save & Post
        </Button>
      </div>
    </header>
  );
});
