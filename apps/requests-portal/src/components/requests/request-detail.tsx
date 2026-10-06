import { ChevronLeft, FileText, ShieldCheck } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { formatBytes, formatWhen, inkFor } from "@/lib/format";
import { cn } from "@/lib/utils";
import type {
  PersonRef,
  RequestAttachment,
  RequestComment,
  RequestDetail,
  RequestEvent,
} from "@/server/requests/types";
import { Avatar } from "./avatar";
import { CloseActions } from "./close-actions";
import { Composer } from "./composer";
import { STATE_STYLE, StateDot } from "./status";

type ThreadEntry =
  | {
      kind: "message";
      at: string;
      author: PersonRef | null;
      body: string;
      mine: boolean;
      staff: boolean;
    }
  | { kind: "event"; at: string; text: string };

export async function RequestDetailView({
  request: r,
  comments,
  attachments,
  events,
  branchName,
}: {
  request: RequestDetail;
  comments: RequestComment[];
  attachments: RequestAttachment[];
  events: RequestEvent[];
  branchName: string | null;
}) {
  const t = await getTranslations("requests");
  const locale = await getLocale();
  const when = (iso: string) =>
    formatWhen(iso, locale, { today: t("today"), yesterday: t("yesterday") });
  const state = STATE_STYLE[r.state];
  const isOpen = r.state !== "closed" && r.state !== "cancelled";
  const requesterId = r.requester?.id;

  const thread: ThreadEntry[] = [];
  if (r.descriptionPlain?.trim()) {
    thread.push({
      kind: "message",
      at: r.createdAt,
      author: r.requester,
      body: r.descriptionPlain,
      mine: r.isMine,
      staff: false,
    });
  }
  for (const c of comments) {
    thread.push({
      kind: "message",
      at: c.createdAt,
      author: c.author,
      body: c.bodyPlain,
      mine: c.isMine,
      staff: !!c.author && c.author.id !== requesterId,
    });
  }
  for (const e of events) {
    const who = e.actor?.name ?? t("someone");
    if (e.type === "ticket_accepted")
      thread.push({ kind: "event", at: e.createdAt, text: t("events.accepted", { who }) });
    if (e.type === "ticket_closed") {
      const status = e.payload.status === "cancelled" ? "cancelled" : "closed";
      thread.push({ kind: "event", at: e.createdAt, text: t(`events.${status}`, { who }) });
    }
  }
  thread.sort((a, b) => a.at.localeCompare(b.at));

  const images = attachments.filter((a) => a.contentType.startsWith("image/") && a.url);
  const files = attachments.filter((a) => !a.contentType.startsWith("image/") || !a.url);

  return (
    <article className="flex min-h-full flex-col">
      <header className="flex flex-col gap-2.5 border-b border-stone-200 bg-white px-4 pb-3.5 pt-2 lg:px-7 lg:pt-5">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="-ml-2 flex h-9 items-center gap-0.5 rounded-lg px-2 text-sm font-medium text-stone-900 lg:hidden"
          >
            <ChevronLeft className="h-5 w-5" />
            {t("back")}
          </Link>
          <span
            className="inline-flex h-6 items-center gap-1.5 rounded-full pl-2 pr-2.5 text-xs font-semibold"
            style={{ background: state.pill, color: state.text }}
          >
            <StateDot state={r.state} size={6} />
            {t(`state.${r.state}`)}
          </span>
          <span className="flex-1" />
          <span className="font-mono text-xs text-stone-500">{r.number}</span>
        </div>
        <h1 className="text-lg font-semibold leading-snug tracking-[-0.01em] lg:text-xl">
          {r.title}
        </h1>
        <dl className="grid grid-cols-[88px_minmax(0,1fr)] items-center gap-x-2 gap-y-2 text-[13px] lg:grid-cols-[110px_minmax(0,1fr)]">
          <dt className="text-stone-500">{t("detail.type")}</dt>
          <dd>
            <span
              className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[.06em]"
              style={{ color: r.type ? inkFor(r.type.color) : "#57534E" }}
            >
              {r.type?.name ?? t("noType")}
            </span>
          </dd>
          <dt className="text-stone-500">{t("detail.requester")}</dt>
          <dd className="flex items-center gap-1.5">
            <Avatar person={r.requester} size={22} />
            <span className="truncate">{r.requester?.name}</span>
            <span className="shrink-0 text-stone-500">· {when(r.createdAt)}</span>
          </dd>
          <dt className="text-stone-500">{t("detail.order")}</dt>
          <dd className="flex flex-col gap-0.5">
            {r.order ? (
              <>
                {r.order.zlNumber && (
                  <span className="font-mono text-[12.5px]">{r.order.zlNumber}</span>
                )}
                <span className="text-xs text-stone-500">
                  {t("detail.orderParts", { nr: r.order.orderNumber, mag: r.order.warehouse })}
                  {branchName ? ` · ${branchName}` : ""}
                </span>
              </>
            ) : (
              <span className="text-stone-500">{t("noOrder")}</span>
            )}
          </dd>
          <dt className="text-stone-500">{t("detail.responders")}</dt>
          <dd className="flex min-w-0 items-center gap-2">
            {r.responders.length ? (
              <>
                <span className="flex">
                  {r.responders.slice(0, 4).map((p, i) => (
                    <Avatar
                      key={p.id}
                      person={p}
                      size={22}
                      className={cn("ring-2 ring-white", i > 0 && "-ml-1.5")}
                    />
                  ))}
                </span>
                <span className="truncate">{r.responders.map((p) => p.name).join(", ")}</span>
              </>
            ) : (
              <span className="text-stone-500">{t("detail.queue")}</span>
            )}
          </dd>
          {r.acceptors.length > 0 && (
            <>
              <dt className="text-stone-500">{t("detail.acceptance")}</dt>
              <dd className="flex items-center gap-1.5 text-[#5B21B6]">
                <ShieldCheck className="h-3.5 w-3.5" />
                {r.acceptedAt
                  ? t("detail.accepted", { date: when(r.acceptedAt) })
                  : t("detail.awaiting", { names: r.acceptors.map((p) => p.name).join(", ") })}
              </dd>
            </>
          )}
        </dl>
        {r.canClose && (
          <div className="pt-1">
            <CloseActions ticketId={r.id} />
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-3 px-4 py-4 lg:px-7">
        {thread.length === 0 && (
          <p className="py-6 text-center text-sm text-stone-500">{t("detail.noMessages")}</p>
        )}
        {thread.map((entry, i) =>
          entry.kind === "event" ? (
            <p key={`e${i}`} className="flex items-center gap-2 pl-2 text-xs text-stone-500">
              <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
              {entry.text} · {when(entry.at)}
            </p>
          ) : (
            <div key={`m${i}`} className="flex gap-2.5">
              <Avatar person={entry.author} size={28} className="mt-0.5" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="text-[12.5px]">
                  <b className="font-semibold">{entry.mine ? t("you") : entry.author?.name}</b>{" "}
                  <span className="text-stone-500">
                    · {entry.staff ? `${t("partsDept")} · ` : ""}
                    {when(entry.at)}
                  </span>
                </div>
                <div
                  className={cn(
                    "whitespace-pre-line rounded-[4px_14px_14px_14px] border px-3 py-2.5 text-sm leading-relaxed",
                    entry.staff ? "border-[#F6E3B4] bg-[#FFF8E6]" : "border-stone-200 bg-white"
                  )}
                >
                  {entry.body}
                </div>
              </div>
            </div>
          )
        )}

        {attachments.length > 0 && (
          <section aria-label={t("detail.attachments")} className="flex flex-col gap-2 pl-[38px]">
            {images.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {images.map((a) => (
                  <a
                    key={a.id}
                    href={a.url!}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-lg ring-1 ring-stone-200"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url!} alt={a.fileName} className="h-24 w-24 object-cover" />
                  </a>
                ))}
              </div>
            )}
            {files.map((a) => (
              <a
                key={a.id}
                href={a.url ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="flex w-fit items-center gap-2 rounded-lg bg-white px-2.5 py-1.5 text-[12.5px] ring-1 ring-stone-200"
              >
                <FileText className="h-4 w-4 text-stone-500" />
                <span className="max-w-[14rem] truncate font-medium">{a.fileName}</span>
                <span className="text-stone-500">{formatBytes(a.sizeBytes, locale)}</span>
              </a>
            ))}
          </section>
        )}
      </div>

      <div className="sticky bottom-0 mx-auto w-full max-w-3xl lg:px-7 lg:pb-5">
        {isOpen ? (
          <Composer ticketId={r.id} />
        ) : (
          <p className="border-t border-stone-200 bg-white px-4 py-4 text-center text-sm text-stone-500 lg:rounded-xl lg:border">
            {t("detail.closedNote")}
          </p>
        )}
      </div>
    </article>
  );
}
