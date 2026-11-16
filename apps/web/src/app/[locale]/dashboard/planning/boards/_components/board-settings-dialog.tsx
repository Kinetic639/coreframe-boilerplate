"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Archive, Save } from "lucide-react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { updateKanbanBoardAction } from "@/app/actions/kanban";
import type { KanbanBoardDetail } from "@/lib/types/kanban";
import type { KanbanVisibility } from "@/lib/validations/kanban";
import { BoardColorPicker } from "./board-color-picker";
import { BoardMembersSection, BoardVisibilityFields } from "./board-sharing";
import type { BoardsAdmin } from "./use-boards-admin";

interface BoardSettingsDialogProps {
  board: KanbanBoardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canUpdate: boolean;
  canArchive: boolean;
  admin: BoardsAdmin;
  /** Asks to archive the board (the confirmation lives with the header). */
  onRequestArchive: () => void;
}

/** Name, description, background, who sees the board and its members. */
export function BoardSettingsDialog({
  board,
  open,
  onOpenChange,
  canUpdate,
  canArchive,
  admin,
  onRequestArchive,
}: BoardSettingsDialogProps) {
  const t = useTranslations("modules.planning");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("boards.boardSettings")}</DialogTitle>
        </DialogHeader>
        {open ? (
          // Mounted per opening: the fields start from the board as it is now.
          <BoardSettingsForm
            board={board}
            canUpdate={canUpdate}
            canArchive={canArchive}
            onBoardChanged={admin.boardChanged}
            onSaved={() => onOpenChange(false)}
            onArchive={() => {
              onOpenChange(false);
              onRequestArchive();
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Archiving a board asks first; it can be restored from the boards list. */
export function ArchiveBoardConfirm({
  board,
  open,
  onOpenChange,
  admin,
  onArchived,
}: {
  board: KanbanBoardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  admin: BoardsAdmin;
  onArchived: (boardId: string) => void;
}) {
  const t = useTranslations("modules.planning");
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("boards.archive.confirmBoardTitle", { title: board.title })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("boards.archive.confirmBoardText")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("boards.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              void admin.archiveBoard(board.id).then((archived) => {
                if (archived) onArchived(board.id);
              });
            }}
          >
            <Archive className="mr-1.5 h-4 w-4" />
            {t("boards.archiveBoard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function BoardSettingsForm({
  board,
  canUpdate,
  canArchive,
  onBoardChanged,
  onSaved,
  onArchive,
}: {
  board: KanbanBoardDetail;
  canUpdate: boolean;
  canArchive: boolean;
  onBoardChanged: (board: KanbanBoardDetail) => void;
  onSaved: () => void;
  onArchive: () => void;
}) {
  const t = useTranslations("modules.planning");
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? "");
  const [visibility, setVisibility] = useState<KanbanVisibility>(board.visibility);
  const [branchId, setBranchId] = useState<string | null>(board.branch_id);
  const [color, setColor] = useState<string | null>(board.color);
  const [isPending, setIsPending] = useState(false);
  const isOwner = board.my_access === "owner";

  const save = async () => {
    setIsPending(true);
    const result = await updateKanbanBoardAction({
      id: board.id,
      title,
      description,
      color,
      visibility,
      branch_id: visibility === "branch" ? branchId : null,
    });
    setIsPending(false);
    if (!result.success) {
      toast.error("error" in result ? result.error : "Operation failed");
      return;
    }
    onBoardChanged(result.data);
    toast.success(t("boards.boardUpdated"));
    onSaved();
  };

  return (
    <>
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="kanban-board-settings-title">{t("boards.title")}</Label>
          <Input
            id="kanban-board-settings-title"
            value={title}
            disabled={!canUpdate}
            onChange={(event) => setTitle(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="kanban-board-settings-description">{t("boards.description")}</Label>
          <Textarea
            id="kanban-board-settings-description"
            value={description}
            disabled={!canUpdate}
            onChange={(event) => setDescription(event.target.value)}
          />
        </div>
        <BoardColorPicker value={color} onChange={setColor} disabled={!canUpdate} />
        <BoardVisibilityFields
          visibility={visibility}
          branchId={branchId}
          onVisibilityChange={setVisibility}
          onBranchChange={setBranchId}
          disabled={!isOwner}
        />
        {!isOwner ? (
          <p className="text-xs text-muted-foreground">{t("boards.sharing.ownerOnly")}</p>
        ) : null}
        <Separator />
        <BoardMembersSection board={board} onChanged={onBoardChanged} />
      </div>
      <DialogFooter className="gap-2 sm:justify-between">
        {canArchive ? (
          <Button variant="outline" onClick={onArchive} disabled={isPending}>
            <Archive className="mr-1.5 h-4 w-4" />
            {t("boards.archiveBoard")}
          </Button>
        ) : (
          <span />
        )}
        {canUpdate ? (
          <Button
            disabled={!title.trim() || (visibility === "branch" && !branchId) || isPending}
            onClick={() => void save()}
          >
            <Save className="mr-1.5 h-4 w-4" />
            {t("boards.save")}
          </Button>
        ) : null}
      </DialogFooter>
    </>
  );
}
