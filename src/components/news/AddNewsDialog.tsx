"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NewsForm, NewsFormData } from "./NewsForm";
import { createNewsPost } from "@/app/actions/news-actions";

interface AddNewsDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function AddNewsDialog({ children, onSuccess }: AddNewsDialogProps) {
  const t = useTranslations("news");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: NewsFormData) => {
    setIsLoading(true);
    try {
      const { error } = await createNewsPost(data);

      if (error) {
        toast.error(t("errors.createFailed"));
        console.error("Error creating news:", error);
      } else {
        toast.success(t("success.created"));
        setOpen(false);
        if (onSuccess) {
          onSuccess();
        }
      }
    } catch (error) {
      toast.error(t("errors.createFailed"));
      console.error("Error creating news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>

      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("addNews")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <NewsForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel={t("form.save")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
