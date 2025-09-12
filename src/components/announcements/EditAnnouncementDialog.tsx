"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AnnouncementForm, AnnouncementFormData } from "./AnnouncementForm";
import { AnnouncementPost } from "./AnnouncementCard";
import { updateAnnouncementPost } from "@/app/actions/announcements-actions";

interface EditNewsDialogProps {
  news: AnnouncementPost;
  onClose: () => void;
  onComplete?: () => void;
}

export function EditAnnouncementDialog({ news, onClose, onComplete }: EditNewsDialogProps) {
  const t = useTranslations("news");
  const [isLoading, setIsLoading] = useState(false);

  // Convert news post to form data
  const initialData: AnnouncementFormData = {
    title: news.title,
    content: typeof news.content === "string" ? news.content : JSON.stringify(news.content),
    excerpt: news.excerpt || "",
    priority: news.priority,
    badges: news.badges,
  };

  const handleSubmit = async (data: AnnouncementFormData) => {
    setIsLoading(true);
    try {
      const { error } = await updateAnnouncementPost(news.id, data);

      if (error) {
        toast.error(t("errors.updateFailed"));
        console.error("Error updating news:", error);
      } else {
        toast.success(t("success.updated"));
        onClose();
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      toast.error(t("errors.updateFailed"));
      console.error("Error updating news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("form.edit")}</DialogTitle>
        </DialogHeader>

        <div className="mt-4">
          <AnnouncementForm
            initialData={initialData}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={isLoading}
            submitLabel={t("form.edit")}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
