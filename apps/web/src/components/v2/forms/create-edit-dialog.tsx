"use client";

import { z } from "zod";
import { FormWrapper } from "./form-wrapper";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus, Pencil } from "lucide-react";
import { useState } from "react";

interface CreateEditDialogProps<T extends z.ZodType> {
  mode: "create" | "edit";
  title?: string;
  description?: string;
  schema: T;
  defaultValues?: Partial<z.infer<T>>;
  onSubmit: (data: z.infer<T>) => Promise<void>;
  trigger?: React.ReactNode;
  children: React.ReactNode;
}

export function CreateEditDialog<T extends z.ZodType>({
  mode,
  title,
  description,
  schema,
  defaultValues,
  onSubmit,
  trigger,
  children,
}: CreateEditDialogProps<T>) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const defaultTitle = mode === "create" ? "Create New Item" : "Edit Item";
  const defaultDescription =
    mode === "create"
      ? "Fill in the information below to create a new item."
      : "Update the information below to edit the item.";

  const handleSubmit = async (data: z.infer<T>) => {
    setLoading(true);
    try {
      await onSubmit(data);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            {mode === "create" ? (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Create
              </>
            ) : (
              <>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || defaultTitle}</DialogTitle>
          <DialogDescription>{description || defaultDescription}</DialogDescription>
        </DialogHeader>

        <FormWrapper
          schema={schema}
          onSubmit={handleSubmit}
          defaultValues={defaultValues}
          loading={loading}
          submitLabel={mode === "create" ? "Create" : "Save Changes"}
          onSuccess={() => setOpen(false)}
        >
          {children}
        </FormWrapper>
      </DialogContent>
    </Dialog>
  );
}
