"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditorField } from "@/components/primitives/rich-text/rich-text-editor-field";
import type { RichTextValue } from "@/components/primitives/rich-text/rich-text-types";
import { createEmptyRichText, extractPlainText } from "@repo/rich-text/rich-text-utils";
import { useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { createFeedbackAction, registerFeedbackFilesAction } from "@/app/actions/platform-feedback";
import { FEEDBACK_KINDS, type FeedbackKind } from "@/lib/platform-feedback/types";
import { uploadFeedbackFiles } from "@/lib/platform-feedback/upload";
import { useReportFeedbackStore } from "@/lib/platform-feedback/report-store";
import { FEEDBACK_KIND_ICON } from "./feedback-badges";
import { FeedbackFilePicker } from "./feedback-file-picker";

function browserContext() {
  return {
    url: window.location.href.slice(0, 2000),
    path: window.location.pathname.slice(0, 1000),
    userAgent: navigator.userAgent.slice(0, 500),
    language: navigator.language,
    viewport: `${window.innerWidth}x${window.innerHeight}`,
  };
}

/**
 * "Zgłoś błąd / propozycję" from any screen: kind, title, description,
 * screenshots (button or Ctrl+V). The page, organization, branch, browser
 * and app version are attached by themselves.
 */
export function ReportFeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("platformFeedback.report");
  const tKind = useTranslations("platformFeedback.kind");
  const router = useRouter();
  const [kind, setKind] = useState<FeedbackKind>("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState<RichTextValue>(createEmptyRichText);
  const [files, setFiles] = useState<File[]>([]);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setKind("bug");
    setTitle("");
    setBody(createEmptyRichText());
    setFiles([]);
  };

  const submit = () =>
    startTransition(async () => {
      const created = await createFeedbackAction({
        kind,
        title,
        bodyPlain: extractPlainText(body),
        bodyRich: body,
        context: browserContext(),
      });
      if (!created.success) {
        toast.error(t("failed"));
        return;
      }
      const { id, number } = (created as { data: { id: string; number: number } }).data;
      let rejected: string[] = [];
      if (files.length > 0) {
        const uploaded = await uploadFeedbackFiles(id, files);
        rejected = uploaded.rejected;
        if (uploaded.uploaded.length > 0) {
          const registered = await registerFeedbackFilesAction({
            feedbackId: id,
            messageId: null,
            files: uploaded.uploaded,
          });
          if (registered.success) {
            rejected = [
              ...rejected,
              ...(registered as { data: { rejected: string[] } }).data.rejected,
            ];
          } else {
            rejected = [...rejected, ...uploaded.uploaded.map((f) => f.name)];
          }
        }
      }
      const code = `ZG-${String(number).padStart(4, "0")}`;
      toast.success(t("sent", { code }), {
        onClick: () =>
          router.push({
            pathname: "/dashboard/account/feedback",
            query: { selected: id },
          }),
      });
      if (rejected.length > 0) toast.warning(t("filesFailed", { files: rejected.join(", ") }));
      reset();
      onOpenChange(false);
    });

  return (
    <Dialog open={open} onOpenChange={(next) => !isPending && onOpenChange(next)}>
      <DialogContent className="max-w-xl" data-testid="report-feedback-dialog">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("kind")}>
            {FEEDBACK_KINDS.map((value) => {
              const Icon = FEEDBACK_KIND_ICON[value];
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={kind === value}
                  disabled={isPending}
                  onClick={() => setKind(value)}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
                    kind === value
                      ? "border-primary bg-primary/5 text-primary font-medium"
                      : "hover:bg-muted"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tKind(value)}
                </button>
              );
            })}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-title">{t("titleLabel")}</Label>
            <Input
              id="feedback-title"
              value={title}
              maxLength={200}
              disabled={isPending}
              placeholder={t("titlePlaceholder")}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t("bodyLabel")}</Label>
            <RichTextEditorField
              value={body}
              onChange={setBody}
              disabled={isPending}
              placeholder={t("bodyPlaceholder")}
              contentClassName="min-h-[120px]"
            />
          </div>

          <FeedbackFilePicker
            files={files}
            onChange={setFiles}
            disabled={isPending}
            pasteTarget={open}
          />

          <p className="text-muted-foreground text-xs">{t("contextHint")}</p>
        </div>

        <DialogFooter>
          <Button variant="outline" disabled={isPending} onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button
            disabled={isPending || title.trim().length === 0}
            onClick={submit}
            data-testid="report-feedback-submit"
          >
            {isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * The report dialog, mounted once (dashboard header); opened from the user
 * menu or the global search through the shared store.
 */
export function ReportFeedbackHost() {
  const open = useReportFeedbackStore((state) => state.open);
  const setOpen = useReportFeedbackStore((state) => state.setOpen);
  return <ReportFeedbackDialog open={open} onOpenChange={setOpen} />;
}
