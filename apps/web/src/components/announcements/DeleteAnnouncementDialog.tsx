"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { deleteAnnouncementPost } from "@/app/actions/announcements-actions";

interface DeleteNewsDialogProps {
  newsId: string;
  onClose: () => void;
  onComplete?: () => void;
}

export function DeleteAnnouncementDialog({ newsId, onClose, onComplete }: DeleteNewsDialogProps) {
  const t = useTranslations("announcements");
  const [isLoading, setIsLoading] = useState(false);

  const handleDelete = async () => {
    setIsLoading(true);
    try {
      const { error } = await deleteAnnouncementPost(newsId);

      if (error) {
        toast.error(t("errors.deleteFailed"));
        console.error("Error deleting news:", error);
      } else {
        toast.success(t("success.deleted"));
        onClose();
        if (onComplete) {
          onComplete();
        }
      }
    } catch (error) {
      toast.error(t("errors.deleteFailed"));
      console.error("Error deleting news:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t("form.delete")}
          </DialogTitle>
          <DialogDescription>{t("form.confirmDelete")}</DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={handleCancel} disabled={isLoading}>
            {t("form.cancel")}
          </Button>
          <Button type="button" variant="destructive" onClick={handleDelete} disabled={isLoading}>
            {isLoading ? t("form.deleting") : t("form.delete")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
