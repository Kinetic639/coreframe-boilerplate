"use client";

import { Input } from "@/components/ui/input";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { useFormContext } from "react-hook-form";

type Props = {
  name: "theme_color" | "font_color";
  label: string;
};

export default function ColorPickerField({ name, label }: Props) {
  const { control } = useFormContext();

  return (
    <FormField
      name={name}
      control={control}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={field.value || "#000000"}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-10 w-14 rounded border p-1"
              />
              <Input
                type="text"
                value={field.value || ""}
                onChange={(e) => field.onChange(e.target.value)}
                className="flex-1"
                placeholder="#000000"
              />
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
