"use client";

import { createContext, useContext, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building2, Globe2, Lock, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addKanbanBoardMemberAction,
  removeKanbanBoardMemberAction,
  updateKanbanBoardMemberAction,
} from "@/app/actions/kanban";
import type { KanbanBoardDetail } from "@/lib/types/kanban";
import {
  KANBAN_MEMBER_ROLES,
  KANBAN_VISIBILITIES,
  type KanbanMemberRole,
  type KanbanVisibility,
} from "@/lib/validations/kanban";

export interface BoardSharingOption {
  id: string;
  name: string;
}

export interface BoardSharingPerson {
  user_id: string;
  name: string | null;
  email: string | null;
}

interface BoardSharingContextValue {
  branches: BoardSharingOption[];
  people: BoardSharingPerson[];
  currentUserId: string;
  /** Can give a task to someone else (anyone who edits can take one). */
  canAssign: boolean;
}

const BoardSharingContext = createContext<BoardSharingContextValue>({
  branches: [],
  people: [],
  currentUserId: "",
  canAssign: false,
});

export const BoardSharingProvider = BoardSharingContext.Provider;

export function useBoardSharing() {
  return useContext(BoardSharingContext);
}

export function BoardVisibilityIcon({ visibility }: { visibility: KanbanVisibility }) {
  if (visibility === "organization") return <Globe2 className="h-3.5 w-3.5" />;
  if (visibility === "branch") return <Building2 className="h-3.5 w-3.5" />;
  return <Lock className="h-3.5 w-3.5" />;
}

/**
 * Who sees a board, as its badge says it: a private board shared with people
 * reads "Shared", so it does not look like it is only its owner's.
 */
export function BoardScopeLabel({
  visibility,
  sharedWith,
}: {
  visibility: KanbanVisibility;
  sharedWith: number;
}) {
  const t = useTranslations("modules.planning");
  if (visibility === "private" && sharedWith > 0) {
    return (
      <>
        <Users className="h-3.5 w-3.5" />
        {t("boards.visibility.shared", { count: sharedWith })}
      </>
    );
  }
  return (
    <>
      <BoardVisibilityIcon visibility={visibility} />
      {t(`boards.visibility.${visibility}`)}
    </>
  );
}

/**
 * Who sees the board, as one muted icon with the full answer in a tooltip
 * (the board header). A click opens the sharing settings when given.
 */
export function BoardScopeIcon({
  visibility,
  branchId,
  sharedWith,
  onClick,
}: {
  visibility: KanbanVisibility;
  branchId: string | null;
  sharedWith: number;
  onClick?: () => void;
}) {
  const t = useTranslations("modules.planning");
  const { branches } = useBoardSharing();
  const shared = visibility === "private" && sharedWith > 0;
  const branchName = branches.find((branch) => branch.id === branchId)?.name;

  let label: string;
  if (shared) label = t("boards.scope.shared", { count: sharedWith });
  else if (visibility === "organization") label = t("boards.scope.organization");
  else if (visibility === "branch")
    label = branchName
      ? t("boards.scope.branchNamed", { branch: branchName })
      : t("boards.scope.branch");
  else label = t("boards.scope.private");
  if (!shared && visibility !== "private" && sharedWith > 0) {
    label = `${label} ${t("boards.scope.plusPeople", { count: sharedWith })}`;
  }

  const icon = shared ? (
    <Users className="h-4 w-4" />
  ) : visibility === "organization" ? (
    <Globe2 className="h-4 w-4" />
  ) : visibility === "branch" ? (
    <Building2 className="h-4 w-4" />
  ) : (
    <Lock className="h-4 w-4" />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {onClick ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            aria-label={label}
            onClick={onClick}
          >
            {icon}
          </Button>
        ) : (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground"
            role="img"
            aria-label={label}
            tabIndex={0}
          >
            {icon}
          </span>
        )}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/** Scope select, plus the branch select for the branch scope. */
export function BoardVisibilityFields({
  visibility,
  branchId,
  onVisibilityChange,
  onBranchChange,
  disabled,
}: {
  visibility: KanbanVisibility;
  branchId: string | null;
  onVisibilityChange: (value: KanbanVisibility) => void;
  onBranchChange: (value: string | null) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("modules.planning");
  const { branches } = useBoardSharing();

  return (
    <div className="space-y-2">
      <Label>{t("boards.visibility.label")}</Label>
      <Select
        value={visibility}
        disabled={disabled}
        onValueChange={(value) => {
          const next = value as KanbanVisibility;
          onVisibilityChange(next);
          if (next === "branch" && !branchId && branches[0]) onBranchChange(branches[0].id);
        }}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {KANBAN_VISIBILITIES.map((item) => (
            <SelectItem key={item} value={item} disabled={item === "branch" && !branches.length}>
              <span className="flex items-center gap-2">
                <BoardVisibilityIcon visibility={item} />
                {t(`boards.visibility.${item}`)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">{t(`boards.visibility.${visibility}Help`)}</p>
      {visibility === "branch" ? (
        <Select
          value={branchId ?? undefined}
          disabled={disabled}
          onValueChange={(value) => onBranchChange(value)}
        >
          <SelectTrigger aria-label={t("boards.sharing.branch")}>
            <SelectValue placeholder={t("boards.sharing.branch")} />
          </SelectTrigger>
          <SelectContent>
            {branches.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
    </div>
  );
}

function personLabel(person: { name: string | null; email: string | null }) {
  return person.name || person.email || "—";
}

export interface PendingBoardMember {
  user_id: string;
  role: KanbanMemberRole;
}

/** People to add to a board that is being created. */
export function NewBoardMembersField({
  value,
  onChange,
  disabled,
}: {
  value: PendingBoardMember[];
  onChange: (value: PendingBoardMember[]) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("modules.planning");
  const { people, currentUserId } = useBoardSharing();
  const [newUserId, setNewUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<KanbanMemberRole>("editor");

  const byId = useMemo(() => new Map(people.map((person) => [person.user_id, person])), [people]);
  const candidates = useMemo(() => {
    const taken = new Set([currentUserId, ...value.map((m) => m.user_id)]);
    return people.filter((person) => !taken.has(person.user_id));
  }, [currentUserId, people, value]);

  return (
    <div className="space-y-2">
      <div>
        <Label>{t("boards.sharing.members")}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{t("boards.sharing.membersHelp")}</p>
      </div>
      {value.length ? (
        <ul className="divide-y rounded-md border">
          {value.map((member) => {
            const person = byId.get(member.user_id);
            const name = person ? personLabel(person) : "—";
            return (
              <li
                key={member.user_id}
                className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate">{name}</span>
                <span className="flex shrink-0 items-center gap-1">
                  <Select
                    value={member.role}
                    disabled={disabled}
                    onValueChange={(role) =>
                      onChange(
                        value.map((m) =>
                          m.user_id === member.user_id
                            ? { ...m, role: role as KanbanMemberRole }
                            : m
                        )
                      )
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-[8.5rem]"
                      aria-label={t("boards.sharing.roleFor", { name })}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {KANBAN_MEMBER_ROLES.map((role) => (
                        <SelectItem key={role} value={role}>
                          {t(`boards.sharing.role.${role}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={disabled}
                    aria-label={t("boards.sharing.remove", { name })}
                    onClick={() => onChange(value.filter((m) => m.user_id !== member.user_id))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={newUserId} onValueChange={setNewUserId} disabled={disabled}>
          <SelectTrigger className="sm:flex-1" aria-label={t("boards.sharing.person")}>
            <SelectValue placeholder={t("boards.sharing.person")} />
          </SelectTrigger>
          <SelectContent>
            {candidates.length ? (
              candidates.map((person) => (
                <SelectItem key={person.user_id} value={person.user_id}>
                  {personLabel(person)}
                </SelectItem>
              ))
            ) : (
              <div className="px-2 py-1.5 text-sm text-muted-foreground">
                {t("boards.sharing.noPeople")}
              </div>
            )}
          </SelectContent>
        </Select>
        <Select
          value={newRole}
          onValueChange={(role) => setNewRole(role as KanbanMemberRole)}
          disabled={disabled}
        >
          <SelectTrigger className="sm:w-[8.5rem]" aria-label={t("boards.sharing.newRole")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {KANBAN_MEMBER_ROLES.map((role) => (
              <SelectItem key={role} value={role}>
                {t(`boards.sharing.role.${role}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          disabled={!newUserId || disabled}
          onClick={() => {
            onChange([...value, { user_id: newUserId, role: newRole }]);
            setNewUserId("");
          }}
        >
          <UserPlus className="mr-1.5 h-4 w-4" />
          {t("boards.sharing.add")}
        </Button>
      </div>
    </div>
  );
}

/** People added to the board. Everyone sees the list; only the owner edits it. */
export function BoardMembersSection({
  board,
  onChanged,
}: {
  board: KanbanBoardDetail;
  onChanged: (board: KanbanBoardDetail) => void;
}) {
  const t = useTranslations("modules.planning");
  const { people } = useBoardSharing();
  const [isPending, startTransition] = useTransition();
  const [newUserId, setNewUserId] = useState<string>("");
  const [newRole, setNewRole] = useState<KanbanMemberRole>("editor");
  const isOwner = board.my_access === "owner";

  const candidates = useMemo(() => {
    const taken = new Set([board.created_by, ...board.members.map((m) => m.user_id)]);
    return people.filter((person) => !taken.has(person.user_id));
  }, [board.created_by, board.members, people]);

  const run = (
    action: () => Promise<
      { success: true; data: KanbanBoardDetail } | { success: false; error: string }
    >
  ) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      onChanged(result.data);
    });

  return (
    <div className="space-y-3">
      <div>
        <Label>{t("boards.sharing.members")}</Label>
        <p className="mt-1 text-xs text-muted-foreground">{t("boards.sharing.membersHelp")}</p>
      </div>

      <ul className="divide-y rounded-md border">
        <li className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
          <span className="min-w-0 truncate">
            {board.creator_name || board.creator_email || "—"}
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {t("boards.sharing.role.owner")}
          </span>
        </li>
        {board.members.map((member) => (
          <li
            key={member.user_id}
            className="flex items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{personLabel(member)}</span>
            {isOwner ? (
              <span className="flex shrink-0 items-center gap-1">
                <Select
                  value={member.role}
                  disabled={isPending}
                  onValueChange={(value) =>
                    run(() =>
                      updateKanbanBoardMemberAction({
                        board_id: board.id,
                        user_id: member.user_id,
                        role: value as KanbanMemberRole,
                      })
                    )
                  }
                >
                  <SelectTrigger
                    className="h-8 w-[8.5rem]"
                    aria-label={t("boards.sharing.roleFor", { name: personLabel(member) })}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KANBAN_MEMBER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {t(`boards.sharing.role.${role}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isPending}
                  aria-label={t("boards.sharing.remove", { name: personLabel(member) })}
                  onClick={() =>
                    run(() =>
                      removeKanbanBoardMemberAction({
                        board_id: board.id,
                        user_id: member.user_id,
                      })
                    )
                  }
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </span>
            ) : (
              <span className="shrink-0 text-xs text-muted-foreground">
                {t(`boards.sharing.role.${member.role}`)}
              </span>
            )}
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select value={newUserId} onValueChange={setNewUserId} disabled={isPending}>
            <SelectTrigger className="sm:flex-1" aria-label={t("boards.sharing.person")}>
              <SelectValue placeholder={t("boards.sharing.person")} />
            </SelectTrigger>
            <SelectContent>
              {candidates.length ? (
                candidates.map((person) => (
                  <SelectItem key={person.user_id} value={person.user_id}>
                    {personLabel(person)}
                  </SelectItem>
                ))
              ) : (
                <div className="px-2 py-1.5 text-sm text-muted-foreground">
                  {t("boards.sharing.noPeople")}
                </div>
              )}
            </SelectContent>
          </Select>
          <Select
            value={newRole}
            onValueChange={(value) => setNewRole(value as KanbanMemberRole)}
            disabled={isPending}
          >
            <SelectTrigger className="sm:w-[8.5rem]" aria-label={t("boards.sharing.newRole")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {KANBAN_MEMBER_ROLES.map((role) => (
                <SelectItem key={role} value={role}>
                  {t(`boards.sharing.role.${role}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            disabled={!newUserId || isPending}
            onClick={() =>
              run(async () => {
                const result = await addKanbanBoardMemberAction({
                  board_id: board.id,
                  user_id: newUserId,
                  role: newRole,
                });
                if (result.success) setNewUserId("");
                return result;
              })
            }
          >
            <UserPlus className="mr-1.5 h-4 w-4" />
            {t("boards.sharing.add")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
