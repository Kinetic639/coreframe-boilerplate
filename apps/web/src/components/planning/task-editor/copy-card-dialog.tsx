"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  copyKanbanCardAction,
  getKanbanBoardAction,
  listKanbanBoardsAction,
} from "@/app/actions/kanban";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { KanbanBoardCard } from "@/lib/types/kanban";
import { KANBAN_COPY_PARTS, type KanbanCopyPart } from "@/lib/validations/kanban";
import { unwrapTaskResult as unwrap } from "./task-editor-queries";

/** Where copies may go: the boards the user can add cards to, and a board's lists. */
export const copyTargetKeys = {
  boards: (orgId: string) => ["planning-copy-targets", orgId, "boards"] as const,
  columns: (orgId: string, boardId: string) =>
    ["planning-copy-targets", orgId, "columns", boardId] as const,
};

export function useCopyTargetBoards(orgId: string, enabled: boolean) {
  return useQuery({
    queryKey: copyTargetKeys.boards(orgId),
    queryFn: async () =>
      (await unwrap(listKanbanBoardsAction())).filter(
        (board) => !board.archived_at && board.my_access !== "viewer"
      ),
    enabled,
    staleTime: 30 * 1000,
  });
}

export function useCopyTargetColumns(orgId: string, boardId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: copyTargetKeys.columns(orgId, boardId ?? ""),
    queryFn: async () => (await unwrap(getKanbanBoardAction(boardId as string))).columns,
    enabled: enabled && Boolean(boardId),
    staleTime: 30 * 1000,
  });
}

interface CopyCardDialogProps {
  orgId: string;
  /** The card to copy; null keeps the dialog closed. */
  card: KanbanBoardCard | null;
  onOpenChange: (open: boolean) => void;
  /** The copy, as the board shows it. */
  onCopied: (card: KanbanBoardCard) => void;
}

/**
 * Copy a card, Trello style: a name, what to keep, and where it goes (this
 * board or another, which list, top or bottom). Comments, attachments and
 * history stay with the original.
 */
export function CopyCardDialog({ orgId, card, onOpenChange, onCopied }: CopyCardDialogProps) {
  const t = useTranslations("modules.planning.boardExtras");
  const open = Boolean(card);
  const [title, setTitle] = useState("");
  const [boardId, setBoardId] = useState<string | null>(null);
  const [columnId, setColumnId] = useState<string | null>(null);
  const [atTop, setAtTop] = useState(false);
  const [keep, setKeep] = useState<KanbanCopyPart[]>([...KANBAN_COPY_PARTS]);
  const [asTemplate, setAsTemplate] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const boards = useCopyTargetBoards(orgId, open);
  const columns = useCopyTargetColumns(orgId, boardId, open);

  // Each time it opens (not when the card refreshes while open): the card's
  // own board and list, everything kept.
  const cardRef = useRef(card);
  cardRef.current = card;
  const openedFor = card?.id ?? null;
  useEffect(() => {
    const source = cardRef.current;
    if (!openedFor || !source) return;
    setTitle(source.title);
    setBoardId(source.is_inbox ? null : source.board_id);
    setColumnId(source.is_inbox ? null : source.column_id);
    setAtTop(false);
    setKeep([...KANBAN_COPY_PARTS]);
    setAsTemplate(false);
  }, [openedFor]);

  // A board without the chosen list (another board): its first list.
  useEffect(() => {
    const list = columns.data;
    if (!list) return;
    if (!columnId || !list.some((column) => column.id === columnId)) {
      setColumnId(list[0]?.id ?? null);
    }
  }, [columnId, columns.data]);

  const boardOptions = boards.data ?? [];

  const toggle = (part: KanbanCopyPart, on: boolean) =>
    setKeep((current) =>
      on ? [...new Set([...current, part])] : current.filter((item) => item !== part)
    );

  const submit = async () => {
    if (!card || !columnId) return;
    setIsPending(true);
    try {
      const copy = await unwrap(
        copyKanbanCardAction({
          card_id: card.id,
          column_id: columnId,
          ...(atTop ? { position: 0 } : {}),
          title: title.trim() || undefined,
          keep,
          as_template: asTemplate,
        })
      );
      toast.success(t("card.copied"));
      onCopied(copy);
      onOpenChange(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Operation failed");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("card.title")}</DialogTitle>
          <DialogDescription>{t("card.help")}</DialogDescription>
        </DialogHeader>
        <form
          id="copy-card-form"
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="copy-card-title">{t("name")}</Label>
            <Input
              id="copy-card-title"
              value={title}
              maxLength={300}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("card.keep")}</legend>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2">
              {KANBAN_COPY_PARTS.map((part) => (
                <label key={part} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={keep.includes(part)}
                    onCheckedChange={(checked) => toggle(part, checked === true)}
                  />
                  {t(`card.parts.${part}`)}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("card.board")}</Label>
              <Select
                value={boardId ?? undefined}
                onValueChange={(value) => setBoardId(value)}
                disabled={boards.isPending}
              >
                <SelectTrigger aria-label={t("card.board")}>
                  <SelectValue placeholder={t("card.pickBoard")} />
                </SelectTrigger>
                <SelectContent>
                  {boardOptions.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("card.column")}</Label>
              <Select
                value={columnId ?? undefined}
                onValueChange={(value) => setColumnId(value)}
                disabled={!boardId || columns.isPending}
              >
                <SelectTrigger aria-label={t("card.column")}>
                  <SelectValue
                    placeholder={
                      boardId && columns.data?.length === 0 ? t("card.noColumns") : undefined
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(columns.data ?? []).map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <RadioGroup
            value={atTop ? "top" : "bottom"}
            onValueChange={(value) => setAtTop(value === "top")}
            className="flex gap-4"
            aria-label={t("card.position")}
          >
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="top" />
              {t("card.top")}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <RadioGroupItem value="bottom" />
              {t("card.bottom")}
            </label>
          </RadioGroup>

          <label className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm">
            <span>
              <span className="block font-medium">{t("card.asTemplate")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("card.asTemplateHelp")}
              </span>
            </span>
            <Switch checked={asTemplate} onCheckedChange={setAsTemplate} />
          </label>
        </form>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="submit" form="copy-card-form" disabled={!columnId || isPending}>
            {isPending ? t("copying") : t("card.submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
