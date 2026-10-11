"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronRight, Loader2, Search, Users } from "lucide-react";
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
 * "New conversation". By default a private message: type to find a person,
 * ↑↓ to move, Enter (or a click) opens the 1:1 with them. "Create a group"
 * switches to picking several people with checkboxes and a group name — they
 * receive an invitation and decide themselves whether to join.
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
  const [mode, setMode] = useState<"direct" | "group">("direct");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [groupName, setGroupName] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

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

  // The highlighted row follows the keyboard and resets with the search text
  const [activeState, setActiveState] = useState({ query: "", index: 0 });
  const active =
    activeState.query === query ? Math.min(activeState.index, Math.max(list.length - 1, 0)) : 0;
  const setActive = (index: number) => setActiveState({ query, index });

  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView?.({ block: "nearest" });
  }, [active]);

  const reset = () => {
    setMode("direct");
    setQuery("");
    setSelected([]);
    setGroupName("");
  };

  const finish = (conversationId: string) => {
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
    onCreated(conversationId);
    setOpen(false);
    reset();
  };

  const fail = (result: { success: false; error: ChatErrorCode }) =>
    toast.error(t(`errors.${result.error}`));

  const openDirect = async (userId: string | undefined) => {
    if (!userId || busy) return;
    setBusy(true);
    const result = await openDirectConversationAction({ userId });
    setBusy(false);
    if (!result.success) return fail(result as { success: false; error: ChatErrorCode });
    finish(result.data);
  };

  const toggle = (userId: string) =>
    setSelected((current) =>
      current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]
    );

  const canCreateGroup = selected.length > 0 && groupName.trim().length > 0 && !busy;
  const createGroup = async () => {
    if (!canCreateGroup) return;
    setBusy(true);
    const result = await createGroupConversationAction({
      name: groupName.trim(),
      userIds: selected,
    });
    setBusy(false);
    if (!result.success) return fail(result as { success: false; error: ChatErrorCode });
    toast.success(t("newConversation.invitesSent", { count: selected.length }));
    finish(result.data);
  };

  const isGroup = mode === "group";

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
        <div className="flex items-center gap-1.5 border-b px-2 py-2">
          {isGroup ? (
            <button
              type="button"
              aria-label={t("newConversation.back")}
              title={t("newConversation.back")}
              onClick={() => {
                setMode("direct");
                setSelected([]);
                setGroupName("");
              }}
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
            </button>
          ) : null}
          <div className={cn("min-w-0", !isGroup && "pl-1")}>
            <div className="text-[13px] font-semibold">
              {isGroup ? t("newConversation.groupTitle") : t("newConversation.title")}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {isGroup ? t("newConversation.groupHint") : t("newConversation.hint")}
            </div>
          </div>
        </div>

        {isGroup ? (
          <div className="px-2 pt-2">
            <input
              autoFocus
              value={groupName}
              maxLength={CHAT_GROUP_NAME_MAX_LENGTH}
              onChange={(event) => setGroupName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void createGroup();
              }}
              placeholder={t("newConversation.groupNamePlaceholder")}
              aria-label={t("newConversation.groupName")}
              className="h-7 w-full rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
        ) : null}

        <div className="p-2">
          <label className="flex h-7 items-center gap-1.5 rounded-md border bg-background px-2 text-muted-foreground">
            <Search className="size-3.5 shrink-0" aria-hidden />
            <input
              // Private message: start typing a name right away
              autoFocus={!isGroup}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  if (list.length === 0) return;
                  const step = event.key === "ArrowDown" ? 1 : -1;
                  setActive((active + step + list.length) % list.length);
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  const person = list[active];
                  if (!person) return;
                  if (isGroup) toggle(person.userId);
                  else void openDirect(person.userId);
                }
              }}
              placeholder={t("newConversation.search")}
              aria-label={t("newConversation.search")}
              role="combobox"
              aria-expanded
              aria-controls="new-conversation-people"
              aria-activedescendant={
                list[active] ? `new-conversation-${list[active].userId}` : undefined
              }
              className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        {!isGroup ? (
          <div className="px-1 pb-1">
            <button
              type="button"
              onClick={() => setMode("group")}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
            >
              <span className="flex size-[26px] shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary">
                <Users className="size-3.5" />
              </span>
              <span className="flex-1 text-xs font-medium">{t("newConversation.createGroup")}</span>
              <ChevronRight className="size-3.5 text-muted-foreground" />
            </button>
          </div>
        ) : null}

        <div
          ref={listRef}
          id="new-conversation-people"
          role="listbox"
          aria-multiselectable={isGroup}
          className="max-h-64 overflow-y-auto border-t px-1 py-1"
        >
          {people.isLoading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
            </div>
          ) : list.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t("newConversation.empty")}
            </div>
          ) : (
            list.map((person, index) => {
              const isSelected = selected.includes(person.userId);
              const isActive = index === active;
              return (
                <button
                  key={person.userId}
                  id={`new-conversation-${person.userId}`}
                  type="button"
                  role="option"
                  aria-selected={isGroup ? isSelected : isActive}
                  data-active={isActive ? "true" : "false"}
                  disabled={busy}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => (isGroup ? toggle(person.userId) : void openDirect(person.userId))}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left",
                    isActive && "bg-muted",
                    isGroup && isSelected && "bg-primary/10"
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
                  {isGroup ? (
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
                  ) : null}
                </button>
              );
            })
          )}
        </div>

        {isGroup ? (
          <div className="flex items-center gap-2 border-t px-2 py-2">
            <span className="flex-1 text-[11px] text-muted-foreground">
              {selected.length > 0
                ? t("newConversation.selected", { count: selected.length })
                : null}
            </span>
            <button
              type="button"
              disabled={!canCreateGroup}
              onClick={() => void createGroup()}
              className="flex h-7 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {busy ? <Loader2 className="size-3 animate-spin" /> : null}
              {t("newConversation.sendInvites")}
            </button>
          </div>
        ) : (
          <div className="border-t px-3 py-1.5 text-[10px] text-muted-foreground">
            {t("newConversation.keys")}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
