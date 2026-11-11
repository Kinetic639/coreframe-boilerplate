"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Label } from "@/components/ui/label";
import { RepairOrderImportReview } from "@/components/workshop/repair-order-import-review";
import type { RepairOrderImportSource } from "@/server/services/repair-order-import.service";

type Props = {
  sources: RepairOrderImportSource[];
  canApply: boolean;
};

/** Pick a source and its input (e.g. a Matcher session), then verify and import. */
export function RepairOrderImportPanel({ sources, canApply }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.import");
  const [sourceType, setSourceType] = useState(sources[0]?.sourceType ?? "");
  const [input, setInput] = useState<Record<string, string>>({});
  const source = sources.find((s) => s.sourceType === sourceType) ?? null;
  const ready =
    !!source && source.fields.every((field) => !field.required || !!input[field.key]?.trim());

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-import-source">{t("source")}</Label>
          <select
            id="ro-import-source"
            value={sourceType}
            onChange={(e) => {
              setSourceType(e.target.value);
              setInput({});
            }}
            className="bg-background h-9 rounded-md border px-2 text-sm"
          >
            {sources.map((s) => (
              <option key={s.sourceType} value={s.sourceType}>
                {s.label}
              </option>
            ))}
          </select>
          {source && <p className="text-muted-foreground text-xs">{source.description}</p>}
        </div>
        {source?.fields.map((field) => (
          <div key={field.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`ro-import-${field.key}`}>{field.label}</Label>
            {field.type === "select" ? (
              <select
                id={`ro-import-${field.key}`}
                value={input[field.key] ?? ""}
                onChange={(e) => setInput((c) => ({ ...c, [field.key]: e.target.value }))}
                className="bg-background h-9 rounded-md border px-2 text-sm"
                data-testid={`ro-import-field-${field.key}`}
              >
                <option value="">{t("choose")}</option>
                {(field.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`ro-import-${field.key}`}
                value={input[field.key] ?? ""}
                onChange={(e) => setInput((c) => ({ ...c, [field.key]: e.target.value }))}
                className="bg-background h-9 rounded-md border px-2 text-sm"
              />
            )}
          </div>
        ))}
      </div>

      {ready && source ? (
        <section className="rounded-md border p-4">
          <RepairOrderImportReview
            key={`${sourceType}:${JSON.stringify(input)}`}
            sourceType={sourceType}
            sourceInput={input}
            canApply={canApply}
          />
        </section>
      ) : (
        <p className="text-muted-foreground text-sm">{t("pickSource")}</p>
      )}
    </div>
  );
}
