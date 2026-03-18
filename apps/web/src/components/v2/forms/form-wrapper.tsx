"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, FormProvider } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FormWrapperProps<T extends z.ZodType> {
  schema: T;
  onSubmit: (data: z.infer<T>) => Promise<void> | void;
  defaultValues?: Partial<z.infer<T>>;
  loading?: boolean;
  children: React.ReactNode;
  submitLabel?: string;
  resetLabel?: string;
  onSuccess?: (data: z.infer<T>) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export function FormWrapper<T extends z.ZodType>({
  schema,
  onSubmit,
  defaultValues,
  loading = false,
  children,
  submitLabel = "Submit",
  resetLabel = "Reset",
  onSuccess,
  onError,
  className,
}: FormWrapperProps<T>) {
  const methods = useForm<z.infer<T>>({
    resolver: zodResolver(schema as any),
    defaultValues: defaultValues as any,
  });

  const {
    handleSubmit,
    formState: { isSubmitting },
    reset,
  } = methods;

  const onSubmitHandler = async (data: z.infer<T>) => {
    try {
      await onSubmit(data);
      if (onSuccess) {
        onSuccess(data);
      }
      toast.success("Form submitted successfully");
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unknown error");
      if (onError) {
        onError(err);
      }
      toast.error(err.message || "Failed to submit form");
    }
  };

  const isLoading = loading || isSubmitting;

  return (
    <FormProvider {...methods}>
      <form onSubmit={handleSubmit(onSubmitHandler)} className={cn("space-y-4", className)}>
        {children}

        <div className="flex gap-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Submitting..." : submitLabel}
          </Button>
          <Button type="button" variant="outline" onClick={() => reset()} disabled={isLoading}>
            {resetLabel}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}
