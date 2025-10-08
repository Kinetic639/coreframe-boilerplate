"use client";

import type { VariantWithAttributes } from "@/modules/warehouse/types/variants";

// TODO: Implement variant creation interface
// This component should allow creating product variants through:
// - Single variant creation
// - Bulk variant creation
// - Attribute matrix generation

interface VariantCreationInterfaceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  existingVariants?: VariantWithAttributes[];
  onVariantsCreated?: (variants: VariantWithAttributes[]) => void;
  defaultMode?: "single" | "bulk" | "matrix";
}

export function VariantCreationInterface({
  open,
  onOpenChange,
  productId: _productId,
  existingVariants: _existingVariants = [],
  onVariantsCreated: _onVariantsCreated,
  defaultMode: _defaultMode = "single",
}: VariantCreationInterfaceProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-8">
        <h2 className="mb-4 text-lg font-semibold">Variant Creation</h2>
        <p className="mb-6 text-muted-foreground">
          Variant creation interface is not yet implemented.
        </p>
        <button
          onClick={() => onOpenChange(false)}
          className="w-full rounded bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
        >
          Close
        </button>
      </div>
    </div>
  );
}
