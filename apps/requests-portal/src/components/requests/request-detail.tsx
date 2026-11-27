"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "next/navigation";
import {
  AlignLeft,
  ArrowLeft,
  CircleAlert,
  ExternalLink,
  Paperclip,
  ShieldCheck,
  Wrench,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { RichTextRenderer } from "@repo/rich-text/rich-text-renderer";
import { normalizeRichText } from "@repo/rich-text";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link } from "@/i18n/navigation";
import { formatDateTime, formatWhen } from "@/lib/format";
import { detailQuery, useRequestsScope } from "@/lib/requests-query";
import { cn } from "@/lib/utils";
import { requestState } from "@/server/requests/types";
import type { PersonRef, RequestDetail, RequestEvent } from "@/server/requests/types";
import type { RequestView } from "@/server/requests/view.service";
import { Avatar, AvatarStack } from "./avatar";
import { CloseActions } from "./close-actions";
import { StatusBadge } from "./status";
import { AttachmentList } from "./attachments";
import { Thread, type ThreadEvent } from "./thread";
import { TypeLabel } from "./type-label";

type Tab = "request" | "comments" | "details" | "activity";

/**
 * A request. Desktop: a panel beside the list, or (?view=page) a page with the description
 * on the left and comments, details and activity on the right. Phone: a page with tabs.
 * The first render uses the view loaded on the server; after that it reads the cache, so
 * saves, realtime changes and reopening it show without a reload.
 */
export function RequestDetailView({
  initial,
  branchName,
  viewer,
}: {
  initial: RequestView;
  branchName: string | null;
  viewer: PersonRef;
}) {
  const scope = useRequestsScope();
  const { data } = useQuery({
    ...detailQuery(scope, initial.request.id),
    initialData: initial,
  });
  const { request: r, events, comments, attachments } = data ?? initial;
  const t = useTranslations("requests");
  const locale = useLocale();
  const when = (iso: string) =>
    formatWhen(iso, locale, { today: t("today"), yesterday: t("yesterday") });
  const isOpen = r.state !== "closed" && r.state !== "cancelled";

  const searchParams = useSearchParams();
  const fullPage = searchParams.get("view") === "page";
  const listQuery = Object.fromEntries([...searchParams.entries()].filter(([k]) => k !== "view"));

  const [tab, setTab] = useState<Tab>(
    comments.length > 0 || r.state === "yourTurn" ? "comments" : "request"
  );
  // On the full page the description has its own column, so its tab is not shown there.
  useEffect(() => {
    if (fullPage && window.matchMedia("(min-width: 1024px)").matches) {
      setTab((x) => (x === "request" ? "comments" : x));
    }
  }, [fullPage]);

  const eventText = (e: RequestEvent): string | null => {
    const who = e.actor?.name ?? t("someone");
    if (e.type === "ticket_created") return t("events.created", { who });
    if (e.type === "ticket_accepted") return t("events.accepted", { who });
    if (e.type === "ticket_taken") return t("events.taken", { who });
    if (e.type === "status_changed" && typeof e.payload.to === "string") {
      const s = requestState({
        status: e.payload.to,
        requires_acceptance: false,
        accepted_at: null,
      });
      return t("events.status", { who, status: t(`state.${s}`) });
    }
    if (e.type === "ticket_closed") {
      return t(`events.${e.payload.status === "cancelled" ? "cancelled" : "closed"}`, { who });
    }
    if (e.type === "comment_added") return null;
    return null;
  };
  const threadEvents: ThreadEvent[] = [];
  for (const e of events) {
    const text = e.type === "ticket_created" ? null : eventText(e);
    if (text) threadEvents.push({ id: e.id, at: e.createdAt, text, actor: e.actor });
  }

  const requestFiles = attachments.filter((a) => a.commentId === null);
  const hasDescription = !!r.descriptionPlain?.trim();

  const description = (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <AlignLeft className="h-4 w-4 text-muted-foreground" />
          {t("detail.description")}
        </h3>
        {hasDescription ? (
          <div className="text-[15px] leading-relaxed">
            <RichTextRenderer
              value={normalizeRichText(r.descriptionRich)}
              emptyText={r.descriptionPlain ?? ""}
            />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("detail.noDescription")}</p>
        )}
      </section>
      {requestFiles.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Paperclip className="h-4 w-4 text-muted-foreground" />
            {t("detail.attachments")}
            <span className="font-normal text-muted-foreground">{requestFiles.length}</span>
          </h3>
          <AttachmentList items={requestFiles} variant="cards" />
        </section>
      )}
    </div>
  );

  const tabs = (
    <Tabs
      value={tab}
      onValueChange={(v) => setTab(v as Tab)}
      className={cn("flex flex-1 flex-col", fullPage && "lg:min-h-0")}
    >
      <div
        className={cn(
          "sticky top-0 z-10 border-b bg-background/95 px-4 py-2 backdrop-blur sm:px-6"
        )}
      >
        <TabsList className="grid h-10 w-full auto-cols-fr grid-flow-col">
          <TabsTrigger value="request" className={cn(fullPage && "lg:hidden")}>
            {t("tabs.request")}
          </TabsTrigger>
          <TabsTrigger value="comments" className="gap-1.5">
            {t("tabs.comments")}
            {comments.length > 0 && (
              <span className="rounded-full bg-muted-foreground/15 px-1.5 text-[11px] font-semibold tabular-nums">
                {comments.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="details" className="max-lg:hidden">
            {t("tabs.details")}
          </TabsTrigger>
          <TabsTrigger value="activity">{t("tabs.activity")}</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="request" className={cn("mt-0 flex-1", fullPage && "lg:hidden")}>
        <div className="flex flex-col gap-8 px-4 pb-6 pt-3 lg:px-6">
          {description}
          <div className="lg:hidden">
            <Details r={r} branchName={branchName} when={when} viewer={viewer} />
          </div>
        </div>
        {r.canClose && (
          <div className="sticky bottom-0 z-10 border-t bg-background px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:hidden">
            <CloseActions ticketId={r.id} stretch />
          </div>
        )}
      </TabsContent>

      <TabsContent value="comments" className="mt-0 flex flex-1 flex-col">
        {r.state === "yourTurn" && (
          <div className="mx-4 mt-3 flex gap-3 rounded-md border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-200 lg:mx-6">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              <b className="font-semibold">{t("detail.yourTurnTitle")}</b>{" "}
              {t("detail.yourTurnBody")}
            </p>
          </div>
        )}
        <Thread
          ticketId={r.id}
          isOpen={isOpen}
          viewer={viewer}
          comments={comments}
          attachments={attachments}
          events={threadEvents}
          composerClassName="bg-background"
        />
      </TabsContent>

      <TabsContent value="details" className="mt-0 flex-1 px-4 pb-6 pt-3 lg:px-6">
        <Details r={r} branchName={branchName} when={when} viewer={viewer} />
      </TabsContent>

      <TabsContent value="activity" className="mt-0 flex-1 px-4 pb-6 pt-3 lg:px-6">
        <ol className="relative flex flex-col gap-5 border-l pl-5">
          {events
            .map((e) => ({ e, text: eventText(e) }))
            .filter((x): x is { e: RequestEvent; text: string } => !!x.text)
            .map(({ e, text }) => (
              <li key={e.id} className="relative text-sm">
                <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50 ring-4 ring-background" />
                <p>{text}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDateTime(e.createdAt, locale)}
                </p>
              </li>
            ))}
          {events.every((e) => e.type !== "ticket_created") && (
            <li className="relative text-sm">
              <span className="absolute -left-[25px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground/50 ring-4 ring-background" />
              <p>{t("events.created", { who: r.requester?.name ?? t("someone") })}</p>
              <p className="text-xs text-muted-foreground">{formatDateTime(r.createdAt, locale)}</p>
            </li>
          )}
        </ol>
      </TabsContent>
    </Tabs>
  );

  const backHref = { pathname: "/" as const, query: listQuery };
  return (
    <TooltipProvider delayDuration={300}>
      <article
        className={cn(
          "flex min-h-0 flex-1 flex-col bg-background",
          fullPage && "md:overflow-hidden md:rounded-lg md:border"
        )}
      >
        {/* The ERP ticket card's bar: close (or back to the list), number, the full page. */}
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3 sm:px-4">
          {fullPage ? (
            <Button asChild variant="ghost" size="sm" className="h-8 shrink-0 gap-1 px-2">
              <Link href={backHref}>
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">{t("backToList")}</span>
              </Link>
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                  <Link href={backHref} aria-label={t("closePanel")} scroll={false}>
                    <X className="h-4 w-4" />
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("closePanel")}</TooltipContent>
            </Tooltip>
          )}
          {!fullPage && (
            <>
              <span className="hidden text-sm text-muted-foreground sm:inline">
                {t("list.title")}
              </span>
              <span aria-hidden className="hidden text-muted-foreground/50 sm:inline">
                /
              </span>
            </>
          )}
          <span className="shrink-0 rounded px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
            {r.number}
          </span>
          {!fullPage && (
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <Button
                asChild
                variant="outline"
                size="sm"
                className="h-8 shrink-0 gap-1.5 px-2.5 text-xs"
              >
                <Link
                  href={{
                    pathname: "/[ticketId]",
                    params: { ticketId: r.id },
                    query: { ...listQuery, view: "page" },
                  }}
                  aria-label={t("list.viewFull")}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{t("list.viewFull")}</span>
                </Link>
              </Button>
            </div>
          )}
        </div>

        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col",
            fullPage
              ? "max-lg:overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(420px,40%)]"
              : "overflow-y-auto overscroll-contain"
          )}
        >
          <div className={cn(fullPage && "lg:min-h-0 lg:overflow-y-auto lg:border-r")}>
            <Header r={r} branchName={branchName} when={when} fullPage={fullPage} />
            {fullPage && <div className="hidden px-8 pb-10 lg:block">{description}</div>}
          </div>
          <div
            className={cn(
              "flex flex-1 flex-col",
              fullPage && "lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain"
            )}
          >
            {tabs}
          </div>
        </div>
      </article>
    </TooltipProvider>
  );
}

function Header({
  r,
  branchName,
  when,
  fullPage,
}: {
  r: RequestDetail;
  branchName: string | null;
  when: (iso: string) => string;
  fullPage: boolean;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const field = "flex min-w-0 flex-col gap-1.5";
  const label = "text-xs text-muted-foreground";
  return (
    <header
      className={cn("flex flex-col gap-4 px-4 pb-4 pt-4 sm:px-6", fullPage && "lg:px-8 lg:pt-6")}
    >
      <div className="flex flex-col gap-1">
        <p className="truncate text-xs text-muted-foreground">
          {[
            r.isMine ? t("detail.yours") : r.requester?.name,
            formatDateTime(r.createdAt, locale),
            branchName,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <h2
          className={cn(
            "text-lg font-semibold leading-snug tracking-tight",
            fullPage && "lg:text-xl"
          )}
        >
          {r.title}
        </h2>
      </div>
      <dl className="grid grid-cols-[auto_auto_1fr] gap-x-6 gap-y-3 sm:flex sm:flex-wrap sm:gap-x-8">
        <div className={field}>
          <dt className={label}>{t("detail.status")}</dt>
          <dd>
            <StatusBadge state={r.state} variant="outline" />
          </dd>
        </div>
        <div className={field}>
          <dt className={label}>{t("detail.type")}</dt>
          <dd>
            <TypeLabel type={r.type} boxed className="h-6 text-[13px]" />
          </dd>
        </div>
        <div className={field}>
          <dt className={label}>{t("detail.order")}</dt>
          <dd className="flex h-6 items-center font-mono text-[13px]">
            {r.order ? (
              (r.order.zlNumber ?? `${r.order.orderNumber}/${r.order.warehouse}`)
            ) : (
              <span className="font-sans text-muted-foreground">{t("noOrder")}</span>
            )}
          </dd>
        </div>
        <div className={cn(field, "col-span-3")}>
          <dt className={label}>{t("detail.responders")}</dt>
          <dd className="flex h-6 min-w-0 items-center gap-2 text-sm">
            {r.responders.length ? (
              <>
                <AvatarStack people={r.responders} size={24} />
                <span className="truncate">{r.responders.map((p) => p.name).join(", ")}</span>
              </>
            ) : (
              <span className="text-muted-foreground">{t("detail.queue")}</span>
            )}
          </dd>
        </div>
        {r.acceptors.length > 0 && (
          <div className={cn(field, "col-span-3")}>
            <dt className={label}>{t("detail.acceptance")}</dt>
            <dd className="flex h-6 items-center gap-1.5 text-sm text-violet-700 dark:text-violet-300">
              <ShieldCheck className="h-4 w-4" />
              {r.acceptedAt
                ? t("detail.accepted", { date: when(r.acceptedAt) })
                : t("detail.awaiting", { names: r.acceptors.map((p) => p.name).join(", ") })}
            </dd>
          </div>
        )}
      </dl>
      {r.canClose && (
        <div className="hidden lg:block">
          <CloseActions ticketId={r.id} />
        </div>
      )}
    </header>
  );
}

function Details({
  r,
  branchName,
  when,
  viewer,
}: {
  r: RequestDetail;
  branchName: string | null;
  when: (iso: string) => string;
  viewer: PersonRef;
}) {
  const t = useTranslations("requests");
  const locale = useLocale();
  const heading = "text-xs font-semibold uppercase tracking-wide text-muted-foreground";
  const person = (p: PersonRef) => (
    <span key={p.id} className="flex items-center gap-2.5 text-sm">
      <Avatar person={p} size={28} />
      <span className="truncate">
        {p.name}
        {p.id === viewer.id && <span className="text-muted-foreground"> ({t("you")})</span>}
      </span>
    </span>
  );
  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-3">
        <h3 className={heading}>{t("detail.people")}</h3>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t("detail.requester")}</p>
          {r.requester && person(r.requester)}
        </div>
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">{t("detail.responders")}</p>
          {r.responders.length ? (
            <div className="flex flex-col gap-2">{r.responders.map(person)}</div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("detail.queue")}</p>
          )}
        </div>
        {r.acceptors.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">{t("detail.acceptance")}</p>
            <div className="flex flex-col gap-2">{r.acceptors.map(person)}</div>
            <p className="text-xs text-violet-700 dark:text-violet-300">
              {r.acceptedAt
                ? t("detail.accepted", { date: when(r.acceptedAt) })
                : t("detail.awaitingShort")}
            </p>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={heading}>{t("detail.order")}</h3>
        {r.order ? (
          <div className="flex items-center gap-3 rounded-md border p-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="truncate font-mono text-sm">
                {r.order.zlNumber ?? `${r.order.orderNumber}/${r.order.warehouse}`}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("detail.orderParts", { nr: r.order.orderNumber, mag: r.order.warehouse })}
                {r.order.zlNumber ? "" : ` · ${t("detail.orderNotFound")}`}
              </span>
            </span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{t("noOrder")}</p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h3 className={heading}>{t("detail.info")}</h3>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
          <dt className="text-muted-foreground">{t("detail.number")}</dt>
          <dd className="font-mono">{r.number}</dd>
          {branchName && (
            <>
              <dt className="text-muted-foreground">{t("detail.branch")}</dt>
              <dd>{branchName}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{t("detail.created")}</dt>
          <dd>{formatDateTime(r.createdAt, locale)}</dd>
          <dt className="text-muted-foreground">{t("detail.updated")}</dt>
          <dd>{formatDateTime(r.updatedAt, locale)}</dd>
          {r.closedAt && (
            <>
              <dt className="text-muted-foreground">{t("detail.closed")}</dt>
              <dd>{formatDateTime(r.closedAt, locale)}</dd>
            </>
          )}
        </dl>
      </section>
    </div>
  );
}
