"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { CommentEditor } from "@repo/rich-text/comments";
import { createEmptyRichText, extractPlainText, type RichTextValue } from "@repo/rich-text";
import { LIMITS } from "@/lib/validation/requests";

/**
 * Reply box: the same rich-text editor as Ambra's Help Desk, plus photos/files. It never
 * waits for the server: the reply goes to the thread (shown there right away) and the box
 * is cleared for the next message.
 */
export function Composer({
  onSend,
  onDraftChange,
}: {
  onSend: (rich: RichTextValue | null, files: File[]) => void;
  /** Every edit of the text (drives "is typing" for the other side). */
  onDraftChange?: (value: RichTextValue) => void;
}) {
  const t = useTranslations("requests.composer");
  const [value, setValue] = useState<RichTextValue>(createEmptyRichText);
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const submit = (rich: RichTextValue) => {
    const plain = extractPlainText(rich);
    if (!plain && files.length === 0) return;
    onSend(plain ? rich : null, files);
    setValue(createEmptyRichText());
    setFiles([]);
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-stone-200 bg-white px-3 pb-3 pt-2.5">
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex h-7 items-center gap-1 rounded-md bg-stone-100 pl-2 pr-1 text-xs"
            >
              <span className="max-w-[10rem] truncate">{f.name}</span>
              <button
                type="button"
                aria-label={t("removeFile", { name: f.name })}
                onClick={() => setFiles((all) => all.filter((_, j) => j !== i))}
                className="flex h-5 w-5 items-center justify-center rounded text-stone-500 hover:bg-stone-200"
              >
                <X className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <CommentEditor
        value={value}
        onChange={(next) => {
          setValue(next);
          onDraftChange?.(next);
        }}
        onSubmit={submit}
        placeholder={t("placeholder")}
        submitLabel={t("send")}
        maxLength={LIMITS.bodyMax}
        density="compact"
        autoDisableSubmitWhenEmpty={files.length === 0}
        actions={
          <button
            type="button"
            aria-label={t("attach")}
            onClick={() => fileRef.current?.click()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700"
          >
            <Camera className="h-4 w-4" />
            {t("attachShort")}
          </button>
        }
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = Array.from(e.target.files ?? []);
          setFiles((all) => [...all, ...picked].slice(0, LIMITS.maxFiles));
          e.target.value = "";
        }}
      />
    </div>
  );
}
