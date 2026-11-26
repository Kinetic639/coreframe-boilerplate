"use client";

import { useTranslations } from "next-intl";
import { Camera, FileText, Loader2, Paperclip, RotateCw, TriangleAlert, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { formatFileSize } from "@/components/primitives/attachments";
import type { useStagedAttachmentUploads } from "@/hooks/queries/attachments/use-staged-attachment-uploads";
import { ATTACHMENT_INPUT_ACCEPT } from "@/lib/validations/attachments";
import { cn } from "@/utils";

const OUTLINE_BUTTON =
  "h-10 gap-1.5 border-input bg-transparent font-normal text-foreground shadow-none hover:bg-accent hover:text-accent-foreground";

/**
 * Files of a record being created: each one starts uploading the moment it is
 * picked (see useStagedAttachmentUploads), with a photo button that opens the
 * camera on phones. The form records them once the record exists.
 */
export function StagedUploadsField({
  staged,
  disabled,
  error,
  onError,
}: {
  staged: ReturnType<typeof useStagedAttachmentUploads>;
  disabled?: boolean;
  error: string | null;
  onError: (message: string | null) => void;
}) {
  const t = useTranslations("components.attachments");

  async function addFiles(input: HTMLInputElement) {
    const picked = Array.from(input.files ?? []);
    if (!picked.length) return;
    // Reading starts before the input is cleared (iPhones can make a picked
    // file unreadable once its input is reset).
    const adding = staged.add(picked);
    input.value = "";
    const problem = await adding;
    onError(problem ? t(`problem.${problem}`) : null);
  }

  const picker = (kind: "photo" | "files") => (
    // Labels wrapping the inputs: Android browsers often ignore click() on a
    // hidden file input, while tapping a label opens the camera or picker.
    <label
      className={cn(
        buttonVariants({ variant: "outline" }),
        OUTLINE_BUTTON,
        "relative cursor-pointer",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {kind === "photo" ? <Camera className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
      {kind === "photo" ? t("staged.addPhoto") : t("staged.addFiles")}
      <input
        type="file"
        className="sr-only"
        disabled={disabled}
        {...(kind === "photo"
          ? { accept: "image/*", capture: "environment" as const }
          : { multiple: true, accept: ATTACHMENT_INPUT_ACCEPT })}
        onChange={(event) => void addFiles(event.currentTarget)}
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-2">
      {staged.items.length > 0 ? (
        <ul className="divide-y rounded-md border">
          {staged.items.map((item) => (
            <li key={item.id} className="flex items-center gap-2.5 px-3 py-2">
              {item.previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img
                  src={item.previewUrl}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-muted">
                  {item.isImage ? (
                    <Camera className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                </span>
              )}
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{item.name}</span>
                {item.status === "uploading" ? (
                  <span className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                    {t("staged.uploading")}
                    <span className="h-1 max-w-24 flex-1 overflow-hidden rounded-full bg-muted">
                      <span
                        className="block h-full bg-primary transition-[width]"
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </span>
                  </span>
                ) : item.status === "failed" ? (
                  <span className="flex items-center gap-1 text-xs text-destructive">
                    <TriangleAlert className="h-3 w-3 shrink-0" />
                    {t("staged.failed")}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {formatFileSize(item.payload?.size ?? item.size)}
                  </span>
                )}
              </span>
              {item.status === "failed" ? (
                <button
                  type="button"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t("staged.retry", { name: item.name })}
                  onClick={() => {
                    onError(null);
                    staged.retry(item.id);
                  }}
                  disabled={disabled}
                >
                  <RotateCw className="h-4 w-4" />
                </button>
              ) : null}
              <button
                type="button"
                className="-mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                aria-label={t("staged.remove", { name: item.name })}
                onClick={() => staged.remove(item.id)}
                disabled={disabled}
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        {picker("photo")}
        {picker("files")}
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
