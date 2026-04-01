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
import { AnnouncementForm, AnnouncementFormData } from "./AnnouncementForm";
import { createAnnouncementPost } from "@/app/actions/announcements-actions";

interface AddNewsDialogProps {
  children: React.ReactNode;
  onSuccess?: () => void;
}

export function AddAnnouncementDialog({ children, onSuccess }: AddNewsDialogProps) {
  const t = useTranslations("announcements");
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (data: AnnouncementFormData) => {
    setIsLoading(true);
    try {
      const { error } = await createAnnouncementPost(data);

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
          <DialogTitle>{t("addAnnouncement")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <AnnouncementForm
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
