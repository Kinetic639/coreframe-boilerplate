"use client";

// TODO: Implement field context configuration interface
// This component should allow configuring how fields behave across different business contexts

interface FieldContextConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId?: string;
  onConfigSaved?: () => void;
}

export function FieldContextConfig({
  open,
  onOpenChange,
  templateId: _templateId,
  onConfigSaved: _onConfigSaved,
}: FieldContextConfigProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-8">
        <h2 className="mb-4 text-lg font-semibold">Field Context Configuration</h2>
        <p className="mb-6 text-muted-foreground">
          Field context configuration interface is not yet implemented.
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
