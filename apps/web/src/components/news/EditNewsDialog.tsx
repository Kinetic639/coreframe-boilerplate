"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NewsForm, NewsFormData } from "./NewsForm";
import { NewsPost } from "./NewsCard";
import { updateNewsPost } from "@/app/actions/news-actions";

interface EditNewsDialogProps {
  news: NewsPost;
  onClose: () => void;
  onComplete?: () => void;
}

export function EditNewsDialog({ news, onClose, onComplete }: EditNewsDialogProps) {
  const t = useTranslations("news");
  const [isLoading, setIsLoading] = useState(false);

  // Convert news post to form data
  const initialData: NewsFormData = {
    title: news.title,
    content: typeof news.content === "string" ? news.content : JSON.stringify(news.content),
    excerpt: news.excerpt || "",
    priority: news.priority,
    badges: news.badges,
  };

  const handleSubmit = async (data: NewsFormData) => {
    setIsLoading(true);
    try {
      const { error } = await updateNewsPost(news.id, data);

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
          <NewsForm
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
