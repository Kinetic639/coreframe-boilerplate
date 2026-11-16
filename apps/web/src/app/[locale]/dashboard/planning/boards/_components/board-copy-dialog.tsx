"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { copyKanbanBoardAction } from "@/app/actions/kanban";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { KanbanBoardDetail } from "@/lib/types/kanban";
import { unwrap } from "./boards-query";
import type { BoardsAdmin } from "./use-boards-admin";

/**
 * "Copy board": a private copy owned by whoever makes it, with the labels,
 * the open lists and (if asked) the cards. It can be saved as a template.
 */
export function CopyBoardDialog({
  board,
  admin,
  onClose,
  onCopied,
}: {
  board: KanbanBoardDetail;
  admin: BoardsAdmin;
  onClose: () => void;
  /** Opens the copy. */
  onCopied: (boardId: string) => void;
}) {
  const t = useTranslations("modules.planning.boardExtras");
  const [title, setTitle] = useState(t("copyName", { title: board.title }).slice(0, 160));
  const [withCards, setWithCards] = useState(true);
  const [asTemplate, setAsTemplate] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const submit = async () => {
    setIsPending(true);
    try {
      const copy = await unwrap(
        copyKanbanBoardAction({
          board_id: board.id,
          title: title.trim(),
          with_cards: withCards,
          as_template: asTemplate,
        })
      );
      admin.boardChanged(copy);
      toast.success(t("board.copied"));
      onClose();
      onCopied(copy.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("board.title")}</DialogTitle>
          <DialogDescription>{t("board.help")}</DialogDescription>
        </DialogHeader>
        <form
          id="copy-board-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="copy-board-title">{t("name")}</Label>
            <Input
              id="copy-board-title"
              autoFocus
              value={title}
              maxLength={160}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span className="font-medium">{t("board.withCards")}</span>
            <Switch checked={withCards} onCheckedChange={setWithCards} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>
              <span className="block font-medium">{t("board.asTemplate")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("board.asTemplateHelp")}
              </span>
            </span>
            <Switch checked={asTemplate} onCheckedChange={setAsTemplate} />
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="copy-board-form" disabled={!title.trim() || isPending}>
            {isPending ? t("copying") : t("board.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
