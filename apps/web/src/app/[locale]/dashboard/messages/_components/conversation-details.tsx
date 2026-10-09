"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, FileText, LogOut, Pencil, UserMinus, UserPlus } from "lucide-react";
import { toast } from "react-toastify";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  addConversationMembersAction,
  leaveConversationAction,
  muteConversationAction,
  removeConversationMemberAction,
  renameConversationAction,
} from "@/app/actions/messages";
import { useAttachmentsQuery } from "@/hooks/queries/attachments";
import { messagesKeys, useChatPeople } from "@/hooks/queries/messages";
import { memberInitials, memberName } from "@/lib/messages/display";
import {
  CHAT_GROUP_NAME_MAX_LENGTH,
  type ChatConversationDetail,
  type ChatErrorCode,
} from "@/lib/messages/types";
import { ChatAvatar } from "@/components/v2/messages/chat-avatar";
import { useChat } from "@/components/v2/messages/chat-provider";

/** Muting has no end date in the UI; far enough to mean "until unmuted" */
const MUTED_UNTIL = "2100-01-01T00:00:00.000Z";

/** Right panel of the Messages page: members, files and the group's settings */
export function ConversationDetails({
  conversation,
  muted,
  onLeft,
}: {
  conversation: ChatConversationDetail;
  muted: boolean;
  onLeft: () => void;
}) {
  const t = useTranslations("chat");
  const { orgId, meId, onlineIds } = useChat();
  const queryClient = useQueryClient();
  const files = useAttachmentsQuery({ targetType: "chat.conversation", targetId: conversation.id });
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(conversation.name ?? "");
  const [confirmLeave, setConfirmLeave] = useState(false);
  const isGroup = conversation.kind === "group";
  const active = conversation.members.filter((m) => !m.left_at);
  const isOwner = active.some((m) => m.user_id === meId && m.role === "owner");

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversation(conversation.id) });
    void queryClient.invalidateQueries({ queryKey: messagesKeys.conversations(orgId) });
  };
  const run = async (action: () => Promise<{ success: boolean }>) => {
    const result = await action();
    if (!result.success) {
      toast.error(t(`errors.${(result as unknown as { error: ChatErrorCode }).error}`));
      return false;
    }
    refresh();
    return true;
  };

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 overflow-y-auto border-l p-3 xl:flex">
      {isGroup ? (
        <section>
          <SectionTitle>{t("page.details")}</SectionTitle>
          {renaming ? (
            <form
              className="mt-1.5 flex gap-1"
              onSubmit={async (event) => {
                event.preventDefault();
                if (
                  await run(() =>
                    renameConversationAction({ conversationId: conversation.id, name: name.trim() })
                  )
                )
                  setRenaming(false);
              }}
            >
              <input
                autoFocus
                value={name}
                maxLength={CHAT_GROUP_NAME_MAX_LENGTH}
                onChange={(event) => setName(event.target.value)}
                aria-label={t("page.rename")}
                className="h-7 min-w-0 flex-1 rounded-md border px-2 text-xs outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              <button
                type="submit"
                disabled={!name.trim()}
                className="h-7 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
              >
                {t("page.save")}
              </button>
            </form>
          ) : (
            <div className="mt-1.5 flex flex-col gap-0.5">
              <DetailButton icon={Pencil} onClick={() => setRenaming(true)}>
                {t("page.rename")}
              </DetailButton>
              <DetailButton
                icon={BellOff}
                onClick={() =>
                  void run(() =>
                    muteConversationAction({
                      conversationId: conversation.id,
                      until: muted ? null : MUTED_UNTIL,
                    })
                  )
                }
              >
                {muted ? t("page.unmute") : t("page.mute")}
              </DetailButton>
              <DetailButton icon={LogOut} destructive onClick={() => setConfirmLeave(true)}>
                {t("page.leave")}
              </DetailButton>
            </div>
          )}
        </section>
      ) : (
        <section>
          <DetailButton
            icon={BellOff}
            onClick={() =>
              void run(() =>
                muteConversationAction({
                  conversationId: conversation.id,
                  until: muted ? null : MUTED_UNTIL,
                })
              )
            }
          >
            {muted ? t("page.unmute") : t("page.mute")}
          </DetailButton>
        </section>
      )}

      <section>
        <div className="flex items-center">
          <SectionTitle>{t("page.members")}</SectionTitle>
          <span className="flex-1" />
          {isGroup ? (
            <AddMembersPopover
              existing={active.map((m) => m.user_id)}
              onAdd={(userIds) =>
                run(() =>
                  addConversationMembersAction({ conversationId: conversation.id, userIds })
                )
              }
            />
          ) : null}
        </div>
        <ul className="mt-1.5 flex flex-col gap-1.5">
          {active.map((member) => (
            <li key={member.user_id} className="group flex items-center gap-2">
              <ChatAvatar
                initials={memberInitials(member)}
                src={member.avatar_url}
                online={onlineIds.has(member.user_id)}
                size={26}
                ringClassName="ring-background"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {member.user_id === meId
                    ? `${memberName(member)} (${t("window.you")})`
                    : memberName(member)}
                </span>
                {member.role === "owner" && isGroup ? (
                  <span className="block text-[11px] text-muted-foreground">{t("page.owner")}</span>
                ) : null}
              </span>
              {isGroup && isOwner && member.user_id !== meId ? (
                <button
                  type="button"
                  aria-label={t("page.remove")}
                  title={t("page.remove")}
                  onClick={() =>
                    void run(() =>
                      removeConversationMemberAction({
                        conversationId: conversation.id,
                        userId: member.user_id,
                      })
                    )
                  }
                  className="hidden size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive group-hover:flex"
                >
                  <UserMinus className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <SectionTitle>{t("page.files")}</SectionTitle>
        {(files.data ?? []).length === 0 ? (
          <p className="mt-1.5 text-xs text-muted-foreground">{t("page.noFiles")}</p>
        ) : (
          <ul className="mt-1.5 flex flex-col gap-1">
            {(files.data ?? []).map((file) => (
              <li key={file.id}>
                <a
                  href={file.download_url ?? undefined}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded px-1 py-0.5 text-xs hover:bg-muted"
                >
                  <FileText className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{file.file_name}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={confirmLeave} onOpenChange={setConfirmLeave}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("page.leave")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("page.confirmLeave", { name: conversation.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("page.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (await run(() => leaveConversationAction({ conversationId: conversation.id })))
                  onLeft();
              }}
            >
              {t("page.leave")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function DetailButton({
  icon: Icon,
  destructive = false,
  onClick,
  children,
}: {
  icon: typeof Pencil;
  destructive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-2 rounded-md px-1.5 text-left text-xs hover:bg-muted",
        destructive && "text-destructive"
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  );
}

function AddMembersPopover({
  existing,
  onAdd,
}: {
  existing: string[];
  onAdd: (userIds: string[]) => Promise<boolean>;
}) {
  const t = useTranslations("chat");
  const { orgId } = useChat();
  const people = useChatPeople(orgId);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const candidates = useMemo(
    () =>
      (people.data ?? [])
        .filter((person) => !existing.includes(person.userId))
        .map((person) => {
          const profile = {
            first_name: person.firstName,
            last_name: person.lastName,
            email: person.email,
          };
          return { ...person, name: memberName(profile), initials: memberInitials(profile) };
        })
        .sort((a, b) => a.name.localeCompare(b.name)),
    [existing, people.data]
  );

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSelected([]);
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("page.addMembers")}
          title={t("page.addMembers")}
          className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <UserPlus className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <div className="max-h-56 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-muted-foreground">
              {t("newConversation.empty")}
            </p>
          ) : (
            candidates.map((person) => {
              const isSelected = selected.includes(person.userId);
              return (
                <button
                  key={person.userId}
                  type="button"
                  onClick={() =>
                    setSelected((all) =>
                      isSelected
                        ? all.filter((id) => id !== person.userId)
                        : [...all, person.userId]
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-muted",
                    isSelected && "bg-primary/10"
                  )}
                >
                  <ChatAvatar initials={person.initials} src={person.avatarUrl} size={22} />
                  <span className="truncate">{person.name}</span>
                </button>
              );
            })
          )}
        </div>
        <div className="flex justify-end border-t p-1">
          <button
            type="button"
            disabled={selected.length === 0}
            onClick={async () => {
              if (await onAdd(selected)) {
                setOpen(false);
                setSelected([]);
              }
            }}
            className="h-7 rounded-md bg-primary px-2.5 text-[11px] font-semibold text-primary-foreground disabled:opacity-50"
          >
            {t("page.add")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
