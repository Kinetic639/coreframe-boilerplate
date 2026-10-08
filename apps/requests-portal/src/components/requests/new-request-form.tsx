"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Camera, Check, Loader2, Paperclip, SearchX, ShieldCheck, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { createRequestAction, lookupOrderAction, type ActionState } from "@/app/actions/requests";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/validation/requests";
import type { PortalBranch } from "@/server/portal-context";
import type {
  OrderLookup,
  PortalTicketType,
  PortalWarehouse,
} from "@/server/requests/requests.service";
import { Avatar } from "./avatar";
import { TypeIcon } from "./type-icon";

const RECENT_KEY = "rp_recent_warehouses";

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => /^\d{4}$/.test(x)).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function rememberWarehouse(mag: string) {
  try {
    const next = [mag, ...readRecent().filter((m) => m !== mag)].slice(0, 4);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode) -- shortcuts are a convenience only
  }
}

export function NewRequestForm({
  branches,
  typesByBranch,
  warehousesByBranch = {},
  defaultBranchId,
}: {
  branches: PortalBranch[];
  typesByBranch: Record<string, PortalTicketType[]>;
  /** DMS warehouses per branch (Ambra branch settings), offered as shortcuts. */
  warehousesByBranch?: Record<string, PortalWarehouse[]>;
  defaultBranchId: string;
}) {
  const t = useTranslations("requests.new");
  const [state, action, pending] = useActionState<ActionState, FormData>(createRequestAction, null);
  const [branchId, setBranchId] = useState(defaultBranchId);
  const types = useMemo(() => typesByBranch[branchId] ?? [], [typesByBranch, branchId]);
  const [typeId, setTypeId] = useState<string>("");
  const type = types.find((x) => x.id === typeId);

  const [nr, setNr] = useState("");
  const [mag, setMag] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const branchWarehouses = warehousesByBranch[branchId] ?? [];
  const [lookup, setLookup] = useState<OrderLookup | null>(null);
  const [looking, startLookup] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    if (!types.some((x) => x.id === typeId)) setTypeId("");
  }, [types, typeId]);

  useEffect(() => {
    setLookup(null);
    if (!/^\d{3,8}$/.test(nr) || !/^\d{4}$/.test(mag)) return;
    const id = setTimeout(
      () => startLookup(async () => setLookup(await lookupOrderAction(nr, mag))),
      350
    );
    return () => clearTimeout(id);
  }, [nr, mag]);

  const err = (field: string) =>
    state?.fieldErrors?.[field] ? (
      <p role="alert" className="text-xs text-destructive">
        {t(`errors.${field}`)}
      </p>
    ) : null;
  const addFiles = (list: FileList | null) =>
    setFiles((all) => [...all, ...Array.from(list ?? [])].slice(0, LIMITS.maxFiles));

  return (
    <form
      action={(fd) => {
        fd.delete("files");
        files.forEach((f) => fd.append("files", f));
        if (/^\d{4}$/.test(mag) && nr) rememberWarehouse(mag);
        action(fd);
      }}
      className="flex flex-col gap-5"
    >
      {branches.length > 1 ? (
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">{t("branch")}</span>
          <select
            name="branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className="h-11 rounded-[10px] border border-stone-200 bg-white px-3 text-sm"
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="branchId" value={branchId} />
      )}

      <fieldset className="flex flex-col">
        <legend className="mb-2 flex w-full justify-between text-[13px] font-semibold">
          {t("type")}
          <span className="font-normal text-stone-500">
            {t("typesAvailable", { count: types.length })}
          </span>
        </legend>
        {types.length === 0 ? (
          <p className="rounded-xl border border-dashed border-stone-300 p-4 text-sm text-stone-500">
            {t("noTypes")}
          </p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-stone-200">
            {types.map((x) => {
              const on = x.id === typeId;
              return (
                <label
                  key={x.id}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-2.5 border-b border-stone-100 px-3 py-2.5 last:border-b-0",
                    on ? "bg-amber-50" : "bg-white"
                  )}
                >
                  <input
                    type="radio"
                    name="typeId"
                    value={x.id}
                    checked={on}
                    onChange={() => setTypeId(x.id)}
                    className="peer sr-only"
                  />
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ background: `${x.color}22`, color: x.color }}
                  >
                    <TypeIcon name={x.icon} className="h-[15px] w-[15px]" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="flex items-center gap-1.5 text-[13.5px] font-semibold">
                      {x.name}
                      {x.requiresAcceptance && (
                        <span className="rounded-[5px] bg-violet-100 px-1.5 text-[10.5px] font-semibold leading-[18px] text-violet-700">
                          {t("acceptance")}
                        </span>
                      )}
                    </span>
                    {x.description && (
                      <span className="truncate text-xs text-stone-500">{x.description}</span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "h-[18px] w-[18px] shrink-0 rounded-full",
                      on ? "border-[5px] border-stone-900" : "border-[1.5px] border-stone-300"
                    )}
                  />
                  <span className="pointer-events-none absolute inset-0 rounded-none peer-focus-visible:ring-2 peer-focus-visible:ring-inset peer-focus-visible:ring-primary" />
                </label>
              );
            })}
          </div>
        )}
        {err("typeId")}
        {type && (
          <div className="mt-2 flex items-center gap-2.5 rounded-[10px] border border-stone-100 bg-stone-50 px-3 py-2.5 text-[12.5px] text-stone-600">
            {type.responders.length > 0 ? (
              <>
                <span className="flex shrink-0">
                  {type.responders.slice(0, 3).map((p, i) => (
                    <Avatar
                      key={p.id}
                      person={p}
                      size={24}
                      className={cn("ring-2 ring-stone-50", i > 0 && "-ml-1.5")}
                    />
                  ))}
                </span>
                <span>
                  {t("solvedBy")}{" "}
                  <b className="font-semibold text-stone-900">
                    {type.responders.map((p) => p.name).join(", ")}
                  </b>
                </span>
              </>
            ) : (
              <span>{t("toQueue")}</span>
            )}
            {type.requiresAcceptance && type.acceptors.length > 0 && (
              <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-violet-700">
                <ShieldCheck className="h-3.5 w-3.5" />
                {type.acceptors.map((p) => p.name).join(", ")}
              </span>
            )}
          </div>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">
          {t("order")} <span className="font-normal text-stone-500">· {t("optional")}</span>
        </legend>
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-stone-600">{t("orderNumber")}</span>
            <input
              name="orderNumber"
              inputMode="numeric"
              autoComplete="off"
              value={nr}
              onChange={(e) => setNr(e.target.value.replace(/\D/g, "").slice(0, 8))}
              placeholder="51481"
              className="h-11 rounded-[10px] border border-stone-200 px-3 font-mono text-[15px] outline-none focus:border-stone-900"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-[11.5px] text-stone-600">{t("warehouse")}</span>
            <input
              name="warehouse"
              inputMode="numeric"
              autoComplete="off"
              value={mag}
              onChange={(e) => setMag(e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="3252"
              className="h-11 rounded-[10px] border border-stone-200 px-3 font-mono text-[15px] outline-none focus:border-stone-900"
            />
          </label>
        </div>
        {branchWarehouses.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-stone-500">
            {branchWarehouses.map((w) => (
              <button
                key={w.code}
                type="button"
                onClick={() => setMag(w.code)}
                className={cn(
                  "h-7 rounded-md border px-2 text-[11.5px]",
                  mag === w.code
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-200 bg-white text-stone-700"
                )}
              >
                <span className="font-mono">{w.code}</span>
                {w.name ? <span className="ml-1">{w.name}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          recent.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11.5px] text-stone-500">
              {t("recent")}
              {recent.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMag(m)}
                  className={cn(
                    "h-6 rounded-md border px-2 font-mono text-[11.5px]",
                    mag === m
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-200 bg-white text-stone-700"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          )
        )}
        {err("orderNumber") ?? err("warehouse")}
        {looking && (
          <p className="flex items-center gap-2 text-xs text-stone-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("looking")}
          </p>
        )}
        {!looking && lookup?.found && (
          <div className="flex items-center gap-2.5 rounded-[10px] border border-[#CDEBD6] bg-[#F0FAF3] px-3 py-2">
            <Check className="h-4 w-4 shrink-0 text-[#15803D]" strokeWidth={2.6} />
            <span className="flex min-w-0 flex-col">
              <span className="font-mono text-[13px] font-medium text-[#14532D]">
                {lookup.order.zlNumber}
              </span>
              <span className="text-[11.5px] text-[#3F6B4E]">
                {t("found")}
                {lookup.order.branchName ? ` · ${lookup.order.branchName}` : ""}
              </span>
            </span>
          </div>
        )}
        {!looking && lookup && !lookup.found && (
          <p className="flex items-center gap-2 text-xs text-stone-500">
            <SearchX className="h-3.5 w-3.5" />
            {t("notFound")}
          </p>
        )}
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">{t("title")}</span>
        <input
          name="title"
          required
          minLength={LIMITS.titleMin}
          maxLength={LIMITS.titleMax}
          placeholder={t("titlePlaceholder")}
          className="h-11 rounded-[10px] border border-stone-200 px-3 text-sm outline-none focus:border-stone-900"
        />
        {err("title")}
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">
          {t("description")} <span className="font-normal text-stone-500">· {t("optional")}</span>
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={LIMITS.bodyMax}
          placeholder={t("descriptionPlaceholder")}
          className="resize-y rounded-[10px] border border-stone-200 px-3 py-2.5 text-sm outline-none focus:border-stone-900"
        />
      </label>

      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-stone-300 bg-stone-50 text-[13px] font-medium text-stone-700"
          >
            <Camera className="h-4 w-4" />
            {t("photo")}
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-dashed border-stone-300 bg-stone-50 text-[13px] font-medium text-stone-700"
          >
            <Paperclip className="h-4 w-4" />
            {t("file")}
          </button>
        </div>
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((f, i) => (
              <li
                key={`${f.name}-${i}`}
                className="flex h-7 items-center gap-1 rounded-md bg-stone-100 pl-2 pr-1 text-xs"
              >
                <span className="max-w-[12rem] truncate">{f.name}</span>
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
      </div>

      {state?.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-destructive">
          {t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.generic")}
        </p>
      )}

      <div className="sticky bottom-0 -mx-4 border-t border-stone-100 bg-white px-4 pb-6 pt-3 lg:static lg:mx-0 lg:border-0 lg:p-0">
        <button
          type="submit"
          disabled={pending || types.length === 0}
          className="flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] bg-primary text-[15px] font-semibold text-stone-900 disabled:opacity-60"
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          {pending ? t("sending") : t("submit")}
        </button>
      </div>
    </form>
  );
}
