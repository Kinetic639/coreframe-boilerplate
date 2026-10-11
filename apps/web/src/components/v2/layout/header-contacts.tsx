"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Loader2, Mail, MessageSquare, Phone, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { cn } from "@/lib/utils";
import { listContactsDirectoryAction } from "@/app/actions/contacts";
import { useDebounce } from "@/hooks/use-debounce";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { CRM_CONTACTS_READ } from "@/lib/constants/permissions";
import type { ContactDirectoryFilter, ContactDirectoryRow } from "@/lib/contacts/types";
import { memberInitials } from "@/lib/messages/display";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { ChatAvatar } from "@/components/v2/messages/chat-avatar";
import { useOptionalChat } from "@/components/v2/messages/chat-provider";
import { useStartDirectChat } from "@/components/v2/messages/use-start-direct-chat";

const SEARCH_DEBOUNCE_MS = 200;
const PAGE_SIZE = 100;

/**
 * Contacts drawer in the header: the organization's directory for everyone.
 * Employees come live from their profiles (read-only, marked "Pracownik"),
 * external contacts from the Contacts module for users who may read them.
 * A row offers: message (chat), e-mail, call.
 */
export function HeaderContacts() {
  const t = useTranslations("contactsDrawer");
  const orgId = useAppStoreV2((s) => s.activeOrgId);
  const { can } = usePermissions();
  const chat = useOptionalChat();
  const startChat = useStartDirectChat();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContactDirectoryFilter>("all");
  const [query, setQuery] = useState("");
  const search = useDebounce(query, SEARCH_DEBOUNCE_MS);
  const canReadExternal = can(CRM_CONTACTS_READ);

  const directory = useQuery({
    queryKey: ["contacts-directory", orgId, kind, search.trim()],
    queryFn: async () => {
      const result = await listContactsDirectoryAction({
        kind,
        search: search.trim() || null,
        pageSize: PAGE_SIZE,
      });
      if (!result.success) throw new Error((result as { error: string }).error);
      return result.data;
    },
    enabled: open && !!orgId,
    staleTime: 60_000,
    placeholderData: (previous) => previous,
  });

  const rows = directory.data?.rows ?? [];
  const tabs: { id: ContactDirectoryFilter; label: string; count?: number }[] = [
    { id: "all", label: t("tabs.all") },
    { id: "member", label: t("tabs.members"), count: directory.data?.memberCount },
    ...(canReadExternal
      ? [
          {
            id: "external" as const,
            label: t("tabs.external"),
            count: directory.data?.externalCount,
          },
        ]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={t("title")}>
          <Users className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
        <SheetHeader className="space-y-0.5 border-b px-4 py-3 text-left">
          <SheetTitle className="text-sm font-semibold">{t("title")}</SheetTitle>
          <SheetDescription className="text-xs">{t("description")}</SheetDescription>
        </SheetHeader>

        <div className="space-y-2 border-b px-3 pt-2">
          <label className="flex h-8 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("search")}
              aria-label={t("search")}
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
            {directory.isFetching ? <Loader2 className="size-3.5 animate-spin" /> : null}
          </label>
          <div role="tablist" aria-label={t("tabsLabel")} className="flex">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={kind === tab.id}
                onClick={() => setKind(tab.id)}
                className={cn(
                  "relative flex h-8 items-center gap-1 px-2 text-xs",
                  "after:absolute after:inset-x-1.5 after:-bottom-px after:h-0.5 after:rounded-full",
                  kind === tab.id
                    ? "font-semibold text-foreground after:bg-primary"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.count !== undefined ? (
                  <span className="text-[10px] font-normal text-muted-foreground">{tab.count}</span>
                ) : null}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto" data-testid="contacts-drawer-list">
          {directory.isLoading ? (
            <div className="flex justify-center py-10 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : directory.isError ? (
            <div className="px-4 py-10 text-center text-xs text-muted-foreground">
              <p>{t("loadFailed")}</p>
              <button
                type="button"
                onClick={() => void directory.refetch()}
                className="mt-1 text-primary underline"
              >
                {t("retry")}
              </button>
            </div>
          ) : rows.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-muted-foreground">
              {search.trim() ? t("noResults") : t("empty")}
            </p>
          ) : (
            <ul className="divide-y">
              {rows.map((row) => (
                <ContactRow
                  key={row.key}
                  row={row}
                  online={!!row.user_id && !!chat?.onlineIds.has(row.user_id)}
                  isMe={!!row.user_id && row.user_id === chat?.meId}
                  onMessage={
                    startChat && row.kind === "member" && row.user_id
                      ? () => {
                          setOpen(false);
                          void startChat(row.user_id as string);
                        }
                      : null
                  }
                />
              ))}
            </ul>
          )}
        </div>

        {canReadExternal ? (
          <div className="border-t px-3 py-2">
            <Link
              href={toUnsafeI18nHref("/dashboard/crm/contacts")}
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
              {t("openModule")}
              <ExternalLink className="size-3" />
            </Link>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function ContactRow({
  row,
  online,
  isMe,
  onMessage,
}: {
  row: ContactDirectoryRow;
  online: boolean;
  isMe: boolean;
  onMessage: (() => void) | null;
}) {
  const t = useTranslations("contactsDrawer");
  const phone = row.phone || row.mobile;
  const secondary = [row.job_title, row.branch_name].filter(Boolean).join(" · ");
  const actionClass =
    "flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <li className="flex items-center gap-2.5 px-3 py-2" data-kind={row.kind}>
      <ChatAvatar
        initials={memberInitials(row)}
        src={row.avatar_url}
        online={online}
        size={28}
        ringClassName="ring-background"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-xs font-medium">{row.display_name}</span>
          {row.kind === "member" ? (
            <span className="shrink-0 rounded bg-primary/10 px-1 py-px text-[10px] font-medium text-primary">
              {isMe ? t("you") : t("member")}
            </span>
          ) : null}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {secondary || row.email || phone || "—"}
        </div>
      </div>
      <div className="flex shrink-0 items-center">
        {onMessage && !isMe ? (
          <button
            type="button"
            onClick={onMessage}
            aria-label={t("message")}
            title={t("message")}
            className={actionClass}
          >
            <MessageSquare className="size-3.5" />
          </button>
        ) : null}
        {row.email ? (
          <a
            href={`mailto:${row.email}`}
            aria-label={t("email")}
            title={row.email}
            className={actionClass}
          >
            <Mail className="size-3.5" />
          </a>
        ) : null}
        {phone ? (
          <a href={`tel:${phone}`} aria-label={t("call")} title={phone} className={actionClass}>
            <Phone className="size-3.5" />
          </a>
        ) : null}
      </div>
    </li>
  );
}
