"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2, Search } from "lucide-react";
import { toast } from "react-toastify";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { normalizeSearchText } from "@/lib/global-search/match";
import {
  createGroupConversationAction,
  openDirectConversationAction,
} from "@/app/actions/messages";
import { messagesKeys, useChatPeople } from "@/hooks/queries/messages";
import { memberInitials, memberName } from "@/lib/messages/display";
import { CHAT_GROUP_NAME_MAX_LENGTH, type ChatErrorCode } from "@/lib/messages/types";
import { ChatAvatar } from "./chat-avatar";
import { useChat } from "./chat-provider";

/**
 * "New conversation": pick colleagues — one person opens (or reuses) a 1:1,
 * several ask for a group name. The conversation opens in a chat window.
 */
export function NewConversationPopover({
  children,
  onCreated,
  side = "left",
  align = "end",
}: {
  children: ReactNode;
  onCreated: (conversationId: string) => void;
  side?: "left" | "bottom" | "top" | "right";
  align?: "start" | "center" | "end";
}) {
  const t = useTranslations("chat");
  const { orgId, onlineIds } = useChat();
  const queryClient = useQueryClient();
  const people = useChatPeople(orgId);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const q = normalizeSearchText(query.trim());
    return (people.data ?? [])
      .map((person) => {
        const profile = {
          first_name: person.firstName,
          last_name: person.lastName,
          email: person.email,
        };
        return { ...person, name: memberName(profile), initials: memberInitials(profile) };
      })
      .filter(
        (person) => !q || normalizeSearchText(`${person.name} ${person.email ?? ""}`).includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [people.data, query]);

  const reset = () => {
    setQuery("");
    setSelected([]);
    setGroupName("");
  };

  const toggle = (userId: string) =>
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );

  const isGroup = selected.length > 1;
  const canSubmit = selected.length > 0 && (!isGroup || groupName.trim().length > 0) && !busy;

  const submit = async () => {
    if (!canSubmit) return;
    setBusy(true);
    const result = isGroup
      ? await createGroupConversationAction({ name: groupName.trim(), userIds: selected })
      : await openDirectConversationAction({ userId: selected[0] });
    setBusy(false);
    if (!result.success) {
      toast.error(t(`errors.${(result as { error: ChatErrorCode }).error}`));
      return;
    }
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
    onCreated(result.data);
    setOpen(false);
    reset();
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent side={side} align={align} className="w-72 p-0" sideOffset={6}>
        <div className="border-b px-3 py-2">
          <div className="text-[13px] font-semibold">{t("newConversation.title")}</div>
          <div className="text-[11px] text-muted-foreground">{t("newConversation.hint")}</div>
        </div>
        <div className="p-2">
          <label className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input
              autoFocus
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("newConversation.search")}
              aria-label={t("newConversation.search")}
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        <div className="max-h-64 overflow-y-auto px-1 pb-1" role="listbox" aria-multiselectable>
          {people.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("newConversation.empty")}
            </div>
          ) : (
            list.map((person) => {
              const isSelected = selected.includes(person.userId);
              return (
                <button
                  key={person.userId}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => toggle(person.userId)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted",
                    isSelected && "bg-primary/10"
                  )}
                >
                  <ChatAvatar
                    initials={person.initials}
                    src={person.avatarUrl}
                    online={onlineIds.has(person.userId)}
                    size={26}
                    ringClassName="ring-popover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">{person.name}</span>
                    {person.email ? (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {person.email}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={cn(
                      "flex size-4 items-center justify-center rounded border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background"
                    )}
                  >
                    {isSelected ? <Check className="size-3" /> : null}
                  </span>
                </button>
              );
            })
          )}
        </div>
        {isGroup ? (
          <div className="border-t px-2 pt-2">
            <input
              value={groupName}
              maxLength={CHAT_GROUP_NAME_MAX_LENGTH}
              onChange={(event) => setGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submit();
              }}
              placeholder={t("newConversation.groupNamePlaceholder")}
              aria-label={t("newConversation.groupName")}
              className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        ) : null}
        <div className="flex items-center gap-2 border-t px-2 py-2">
          <span className="flex-1 text-[11px] text-muted-foreground">
            {selected.length > 0 ? t("newConversation.selected", { count: selected.length }) : null}
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="h-7 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted"
          >
            {t("newConversation.cancel")}
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={() => void submit()}
            className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-3 animate-spin" /> : null}
            {isGroup ? t("newConversation.createGroup") : t("newConversation.start")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
