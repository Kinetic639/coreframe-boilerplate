"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowRight, Camera, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { addCommentAction, type ActionState } from "@/app/actions/requests";

/** Reply box: text and/or photos/files, sent as one public comment. */
export function Composer({ ticketId }: { ticketId: string }) {
  const t = useTranslations("requests.composer");
  const [state, action, pending] = useActionState<ActionState, FormData>(addCommentAction, null);
  const [files, setFiles] = useState<File[]>([]);
  // Shown instantly while the action runs; the server-rendered thread replaces it on success.
  const [preview, setPreview] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current && !pending && !state?.error) {
      formRef.current?.reset();
      setFiles([]);
    }
    if (!pending) setPreview(null);
    sentRef.current = pending;
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={(fd) => {
        fd.delete("files");
        files.forEach((f) => fd.append("files", f));
        const body = String(fd.get("body") ?? "").trim();
        setPreview(body || (files.length ? t("filesOnly", { count: files.length }) : null));
        action(fd);
      }}
      className="flex flex-col gap-2 border-t border-stone-200 bg-white px-3 pb-5 pt-2.5 lg:rounded-xl lg:border lg:pb-3"
    >
      <input type="hidden" name="ticketId" value={ticketId} />
      {pending && preview && (
        <div className="flex justify-end">
          <div className="max-w-[85%] whitespace-pre-line rounded-[14px_4px_14px_14px] border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700 opacity-80">
            {preview}
            <span className="mt-0.5 block text-right text-[11px] text-stone-500">
              {t("sending")}
            </span>
          </div>
        </div>
      )}
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
      <div className="flex items-end gap-2">
        <button
          type="button"
          aria-label={t("attach")}
          onClick={() => fileRef.current?.click()}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-700"
        >
          <Camera className="h-[19px] w-[19px]" />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            setFiles((all) => [...all, ...picked].slice(0, 10));
            e.target.value = "";
          }}
        />
        <label className="flex min-w-0 flex-1">
          <span className="sr-only">{t("label")}</span>
          <textarea
            name="body"
            rows={1}
            placeholder={t("placeholder")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey))
                e.currentTarget.form?.requestSubmit();
            }}
            className="min-h-11 flex-1 resize-none rounded-xl border border-stone-200 bg-stone-50 px-3 py-[11px] text-sm text-stone-900 outline-none focus:border-stone-400 [field-sizing:content] max-h-40"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          aria-label={t("send")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-stone-900 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" />
          ) : (
            <ArrowRight className="h-[19px] w-[19px]" strokeWidth={2.2} />
          )}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="text-xs text-destructive">
          {t.has(`errors.${state.error.split(":")[0]}`)
            ? t(`errors.${state.error.split(":")[0]}`)
            : t("errors.generic")}
        </p>
      )}
    </form>
  );
}
