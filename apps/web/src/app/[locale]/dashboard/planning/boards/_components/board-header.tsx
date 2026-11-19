"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Activity,
  Archive,
  ArchiveRestore,
  Check,
  Copy,
  KanbanSquare,
  Keyboard,
  LayoutGrid,
  LayoutTemplate,
  MoreHorizontal,
  Palette,
  RotateCcw,
  Settings2,
  SlidersHorizontal,
  Star,
  Tag,
  UserPlus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { KanbanBoardDetail } from "@/lib/types/kanban";
import { cn } from "@/utils";
import { MemberAvatar } from "@/components/planning/member-avatar";
import { BOARD_COLORS, boardBackground } from "./board-colors";
import { ArchiveBoardConfirm, BoardSettingsDialog } from "./board-settings-dialog";
import { BoardScopeIcon } from "./board-sharing";
import { SaveIndicator } from "./save-indicator";
import { CopyBoardDialog } from "./board-copy-dialog";
import { BoardPickerDialog, type BoardSwitcherProps } from "./board-picker-dialog";
import type { BoardsAdmin } from "./use-boards-admin";

const MAX_AVATARS = 4;

interface BoardHeaderProps {
  board: KanbanBoardDetail;
  /** The board has a colour: the header is a translucent band over it. */
  onColor?: boolean;
  canUpdate: boolean;
  /** Can archive or restore the board (its owner, or planning.boards.delete). */
  canManageBoard: boolean;
  admin: BoardsAdmin;
  onOpenArchive: () => void;
  onOpenAllBoards: () => void;
  onBoardArchived: (boardId: string) => void;
  /** Search and filters, under the title row. */
  toolbar?: React.ReactNode;
  /** Who else has the board open. */
  viewers?: React.ReactNode;
  onOpenLabels?: () => void;
  onOpenActivity?: () => void;
  onOpenShortcuts?: () => void;
  onOpenFields?: () => void;
  /** Can make boards (a copy of this one). */
  canCreate: boolean;
  onOpenBoard: (boardId: string) => void;
  /** The other boards, behind the board's name. */
  switcher: BoardSwitcherProps;
}

/**
 * The board's header, Trello style: the name (a click edits it), the star,
 * who sees it, the people on it with Share, and a menu with the background,
 * the archive and the settings.
 */
export function BoardHeader({
  board,
  onColor = false,
  canUpdate,
  canManageBoard,
  admin,
  onOpenArchive,
  onOpenAllBoards,
  onBoardArchived,
  toolbar,
  viewers,
  onOpenLabels,
  onOpenActivity,
  onOpenShortcuts,
  onOpenFields,
  canCreate,
  onOpenBoard,
  switcher,
}: BoardHeaderProps) {
  const t = useTranslations("modules.planning");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const isArchived = Boolean(board.archived_at);
  const people = [
    { key: board.created_by, name: board.creator_name, email: board.creator_email },
    ...board.members.map((member) => ({
      key: member.user_id,
      name: member.name,
      email: member.email,
    })),
  ];

  return (
    <div className={cn("border-b", onColor ? "board-on-color bg-black/25" : "bg-background/85")}>
      {isArchived ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/10 px-5 py-2 text-sm">
          <span className="flex items-center gap-2">
            <Archive className="h-4 w-4" />
            {t("boards.archive.bannerText")}
          </span>
          {canManageBoard ? (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => void admin.restoreBoard(board.id)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              {t("boards.archive.restore")}
            </Button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 pl-3 pr-5">
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={t("boards.switchBoards")}
                onClick={() => setPickerOpen(true)}
              >
                <KanbanSquare className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t("boards.switchBoards")}</TooltipContent>
          </Tooltip>
          <BoardTitle board={board} canEdit={canUpdate} admin={admin} />
          <BoardScopeIcon
            visibility={board.visibility}
            branchId={board.branch_id}
            sharedWith={board.members.length}
            onClick={isArchived ? undefined : () => setSettingsOpen(true)}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                aria-pressed={board.starred}
                aria-label={board.starred ? t("boards.star.remove") : t("boards.star.add")}
                onClick={() => void admin.toggleStar(board.id, !board.starred)}
              >
                <Star className={cn("h-4 w-4", board.starred && "fill-amber-400 text-amber-400")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {board.starred ? t("boards.star.remove") : t("boards.star.add")}
            </TooltipContent>
          </Tooltip>
          {board.is_template ? (
            <Badge variant="secondary" className="shrink-0 gap-1.5">
              <LayoutTemplate className="h-3.5 w-3.5" />
              {t("boardExtras.templates.badge")}
            </Badge>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <SaveIndicator />
          {viewers}
          <div className="flex -space-x-1.5" aria-label={t("boards.header.people")}>
            {people.slice(0, MAX_AVATARS).map((person) => (
              <MemberAvatar
                key={person.key}
                userId={person.key}
                name={person.name}
                email={person.email}
                popoverSide="bottom"
                className="h-7 w-7 border-2 border-background"
              />
            ))}
            {people.length > MAX_AVATARS ? (
              <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-[10px] font-semibold">
                +{people.length - MAX_AVATARS}
              </span>
            ) : null}
            {!isArchived ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="relative flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-muted text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={t("boards.header.share")}
                    onClick={() => setSettingsOpen(true)}
                  >
                    <UserPlus className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>{t("boards.header.share")}</TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                aria-label={t("boards.boardMenu")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              {!isArchived ? (
                <DropdownMenuItem onSelect={() => setSettingsOpen(true)}>
                  <Settings2 className="mr-2 h-4 w-4" />
                  {t("boards.boardSettings")}
                </DropdownMenuItem>
              ) : null}
              {canUpdate ? (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Palette className="mr-2 h-4 w-4" />
                    {t("boards.background.label")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-2">
                    <div className="grid grid-cols-4 gap-1.5">
                      <button
                        type="button"
                        className="flex h-8 w-12 items-center justify-center rounded-md border bg-muted text-muted-foreground"
                        aria-label={t("boards.background.none")}
                        title={t("boards.background.none")}
                        onClick={() => void admin.updateBoard(board, { color: null })}
                      >
                        {!board.color ? <Check className="h-3.5 w-3.5" /> : null}
                      </button>
                      {BOARD_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="flex h-8 w-12 items-center justify-center rounded-md text-white"
                          style={{ background: boardBackground(color) }}
                          aria-label={color}
                          onClick={() => void admin.updateBoard(board, { color })}
                        >
                          {board.color === color ? <Check className="h-3.5 w-3.5" /> : null}
                        </button>
                      ))}
                    </div>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : null}
              {onOpenLabels ? (
                <DropdownMenuItem onSelect={onOpenLabels}>
                  <Tag className="mr-2 h-4 w-4" />
                  {t("boardTools.labelsTitle")}
                </DropdownMenuItem>
              ) : null}
              {onOpenFields ? (
                <DropdownMenuItem onSelect={onOpenFields}>
                  <SlidersHorizontal className="mr-2 h-4 w-4" />
                  {t("boardExtras.fields.title")}
                </DropdownMenuItem>
              ) : null}
              {onOpenActivity ? (
                <DropdownMenuItem onSelect={onOpenActivity}>
                  <Activity className="mr-2 h-4 w-4" />
                  {t("boardTools.activityTitle")}
                </DropdownMenuItem>
              ) : null}
              {onOpenShortcuts ? (
                <DropdownMenuItem onSelect={onOpenShortcuts}>
                  <Keyboard className="mr-2 h-4 w-4" />
                  {t("boardTools.shortcutsTitle")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuSeparator />
              {canCreate ? (
                <DropdownMenuItem onSelect={() => setCopyOpen(true)}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("boardExtras.board.menu")}
                </DropdownMenuItem>
              ) : null}
              {canManageBoard && !isArchived ? (
                <DropdownMenuItem
                  onSelect={() =>
                    void admin.updateBoard(board, { is_template: !board.is_template })
                  }
                >
                  <LayoutTemplate className="mr-2 h-4 w-4" />
                  {board.is_template
                    ? t("boardExtras.templates.unmarkBoard")
                    : t("boardExtras.templates.markBoard")}
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem onSelect={onOpenArchive}>
                <ArchiveRestore className="mr-2 h-4 w-4" />
                {t("boards.archive.title")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={onOpenAllBoards}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                {t("boards.all.title")}
              </DropdownMenuItem>
              {canManageBoard && !isArchived ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onSelect={() => setConfirmArchive(true)}
                  >
                    <Archive className="mr-2 h-4 w-4" />
                    {t("boards.archiveBoard")}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {board.description ? (
          <p className="line-clamp-2 basis-full text-sm text-muted-foreground">
            {board.description}
          </p>
        ) : null}
      </div>
      {toolbar}

      <BoardPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        activeBoardId={board.id}
        {...switcher}
      />
      <BoardSettingsDialog
        board={board}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        canUpdate={canUpdate}
        canArchive={canManageBoard}
        admin={admin}
        onRequestArchive={() => setConfirmArchive(true)}
      />
      {copyOpen ? (
        <CopyBoardDialog
          board={board}
          admin={admin}
          onClose={() => setCopyOpen(false)}
          onCopied={onOpenBoard}
        />
      ) : null}
      <ArchiveBoardConfirm
        board={board}
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        admin={admin}
        onArchived={onBoardArchived}
      />
    </div>
  );
}

/** The board's name: a click turns it into a field; Enter or leaving saves, Esc cancels. */
function BoardTitle({
  board,
  canEdit,
  admin,
}: {
  board: KanbanBoardDetail;
  canEdit: boolean;
  admin: BoardsAdmin;
}) {
  const t = useTranslations("modules.planning");
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(board.title);
  const doneRef = useRef(false);

  if (!canEdit) return <h2 className="truncate px-1.5 text-xl font-semibold">{board.title}</h2>;

  const finish = (save: boolean) => {
    if (doneRef.current) return;
    doneRef.current = true;
    setEditing(false);
    const title = value.trim();
    if (save && title && title !== board.title) void admin.updateBoard(board, { title });
  };

  if (editing) {
    return (
      <Input
        autoFocus
        value={value}
        maxLength={160}
        aria-label={t("boards.title")}
        className="h-9 max-w-md text-xl font-semibold"
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            finish(true);
          }
          if (event.key === "Escape") {
            event.preventDefault();
            finish(false);
          }
        }}
      />
    );
  }

  return (
    <button
      type="button"
      className="min-w-0 truncate rounded px-1.5 py-0.5 text-left text-xl font-semibold hover:bg-muted/70"
      title={t("boards.header.renameHint")}
      onClick={() => {
        doneRef.current = false;
        setValue(board.title);
        setEditing(true);
      }}
    >
      {board.title}
    </button>
  );
}
