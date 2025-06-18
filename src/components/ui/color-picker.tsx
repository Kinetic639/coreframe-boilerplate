"use client";

import * as React from "react";
import { useController, Control } from "react-hook-form";

interface ColorPickerProps {
  name: string;
  control: Control<any>;
  label?: string;
  className?: string;
}

export function ColorPicker({ name, control, label, className }: ColorPickerProps) {
  const { field } = useController({ name, control });

  return (
    <div className={`flex items-center gap-3 ${className ?? ""}`}>
      {label && <label className="text-sm font-medium">{label}</label>}
      <input
        type="color"
        value={field.value || "#000000"}
        onChange={field.onChange}
        className="h-10 w-10 cursor-pointer rounded-md border"
      />
      <input
        type="text"
        value={field.value || ""}
        onChange={field.onChange}
        className="w-28 rounded-md border px-2 py-1 text-sm"
        placeholder="#000000"
      />
    </div>
  );
}
