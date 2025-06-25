"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import LocationImageUploader from "./LocationImageUploader";

const schema = z.object({
  name: z.string().min(1, "Nazwa jest wymagana"),
  parentId: z.string().nullable().optional(),
});

export interface LocationOption {
  id: string;
  name: string;
}

interface Props {
  children: React.ReactNode;
  defaultValues?: {
    name?: string;
    parentId?: string | null;
    imageUrl?: string | null;
    locationId?: string;
  };
  parentOptions: LocationOption[];
  onSubmit: (values: z.infer<typeof schema>) => void;
}

export default function LocationForm({
  children,
  defaultValues,
  parentOptions,
  onSubmit,
}: Props) {
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: defaultValues?.name || "",
      parentId: defaultValues?.parentId || null,
    },
  });

  const handleSubmit = form.handleSubmit((values) => {
    onSubmit(values as z.infer<typeof schema>);
  });

  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="w-full max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{defaultValues ? "Edytuj lokalizację" : "Nowa lokalizacja"}</DialogTitle>
          </DialogHeader>
          <Input {...form.register("name") } placeholder="Nazwa" />
          <select
            {...form.register("parentId")}
            className="w-full rounded border bg-background p-2 text-sm"
          >
            <option value="">Brak nadrzędnej</option>
            {parentOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.name}
              </option>
            ))}
          </select>
          {defaultValues?.locationId && (
            <LocationImageUploader imageUrl={defaultValues.imageUrl} locationId={defaultValues.locationId} />
          )}
          <DialogFooter>
            <Button type="submit" variant="themed">Zapisz</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
