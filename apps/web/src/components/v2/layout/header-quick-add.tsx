"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { CheckSquare, KanbanSquare, Loader2, PackagePlus, Plus, Ticket } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  createKanbanCardAction,
  getKanbanBoardAction,
  listKanbanBoardsAction,
} from "@/app/actions/kanban";
import { createTaskAction } from "@/app/actions/planning";
import { TASK_PRIORITIES, type TaskPriority } from "@/lib/validations/planning";
import type { KanbanBoardDetail, KanbanBoardSummary } from "@/lib/types/kanban";

type QuickAddDialog = "task" | "kanban-card" | null;

interface QuickAddAction {
  id: string;
  label: string;
  description: string;
  icon: typeof Plus;
  onSelect: () => void;
}

function actionError(result: unknown) {
  return "error" in (result as Record<string, unknown>)
    ? String((result as { error: string }).error)
    : "Operation failed";
}

function toDateTime(value: string): string | null {
  if (!value) return null;
  return new Date(`${value}T12:00:00.000Z`).toISOString();
}

export function HeaderQuickAdd() {
  const t = useTranslations("dashboard.header.quickAdd");
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<QuickAddDialog>(null);

  const openDialog = useCallback((nextDialog: QuickAddDialog) => {
    setMenuOpen(false);
    setDialog(nextDialog);
  }, []);

  const navigate = useCallback(
    (href: string) => {
      setMenuOpen(false);
      router.push(href);
    },
    [router]
  );

  const groups = useMemo(
    () => [
      {
        id: "warehouse",
        title: t("warehouse.title"),
        actions: [
          {
            id: "item",
            label: t("warehouse.item"),
            description: t("warehouse.itemDescription"),
            icon: PackagePlus,
            onSelect: () => navigate("/dashboard/warehouse/items/new"),
          },
        ],
      },
      {
        id: "helpdesk",
        title: t("helpdesk.title"),
        actions: [
          {
            id: "ticket",
            label: t("helpdesk.ticket"),
            description: t("helpdesk.ticketDescription"),
            icon: Ticket,
            onSelect: () => navigate("/dashboard/help-desk/tickets/new"),
          },
        ],
      },
      {
        id: "planning",
        title: t("planning.title"),
        actions: [
          {
            id: "task",
            label: t("planning.task"),
            description: t("planning.taskDescription"),
            icon: CheckSquare,
            onSelect: () => openDialog("task"),
          },
          {
            id: "kanbanCard",
            label: t("planning.kanbanCard"),
            description: t("planning.kanbanCardDescription"),
            icon: KanbanSquare,
            onSelect: () => openDialog("kanban-card"),
          },
        ],
      },
    ],
    [navigate, openDialog, t]
  );

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="h-8 w-8 p-0" aria-label={t("tooltip")} title={t("tooltip")}>
            <Plus className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={8}
          className="w-[min(calc(100vw-2rem),42rem)] rounded-lg border bg-popover p-0 shadow-xl"
        >
          <div className="grid gap-5 p-5 md:grid-cols-3">
            {groups.map((group) => (
              <section key={group.id} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.title}
                </p>
                <div className="space-y-1">
                  {group.actions.map((action) => (
                    <QuickAddActionButton key={action.id} action={action} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      <QuickTaskDialog
        open={dialog === "task"}
        onOpenChange={(open) => setDialog(open ? "task" : null)}
      />
      <QuickKanbanCardDialog
        open={dialog === "kanban-card"}
        onOpenChange={(open) => setDialog(open ? "kanban-card" : null)}
      />
    </>
  );
}

function QuickAddActionButton({ action }: { action: QuickAddAction }) {
  const Icon = action.icon;

  return (
    <button
      type="button"
      onClick={action.onSelect}
      className="group flex w-full items-start gap-3 rounded-md border border-transparent px-2 py-2 text-left transition hover:border-primary/30 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground transition group-hover:bg-primary group-hover:text-primary-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-none">{action.label}</span>
        <span className="mt-1 block text-xs leading-snug text-muted-foreground">
          {action.description}
        </span>
      </span>
    </button>
  );
}

function QuickTaskDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.header.quickAdd.taskDialog");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [dueAt, setDueAt] = useState("");
  const [isPending, startTransition] = useTransition();

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setPriority("normal");
    setDueAt("");
  }, []);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (isPending) return;
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [isPending, onOpenChange, reset]
  );

  const submit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    startTransition(async () => {
      const result = await createTaskAction({
        title: trimmedTitle,
        description_plain: description.trim() || undefined,
        priority,
        due_at: toDateTime(dueAt),
      });

      if (!result.success) {
        toast.error(actionError(result));
        return;
      }

      toast.success(t("created"));
      reset();
      onOpenChange(false);
      router.push(`/dashboard/planning/tasks?selected=${result.data.task_number}`);
    });
  }, [description, dueAt, onOpenChange, priority, reset, router, t, title]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-task-title">{t("fields.title")}</Label>
            <Input
              id="quick-task-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("placeholders.title")}
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-task-description">{t("fields.description")}</Label>
            <Textarea
              id="quick-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("placeholders.description")}
              disabled={isPending}
              rows={3}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fields.priority")}</Label>
              <Select
                value={priority}
                onValueChange={(value) => setPriority(value as TaskPriority)}
                disabled={isPending}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((candidate) => (
                    <SelectItem key={candidate} value={candidate}>
                      {t(`priorities.${candidate}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="quick-task-due">{t("fields.due")}</Label>
              <Input
                id="quick-task-due"
                type="date"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
                disabled={isPending}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={submit} disabled={!title.trim() || isPending}>
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function QuickKanbanCardDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("dashboard.header.quickAdd.kanbanDialog");
  const router = useRouter();
  const [boards, setBoards] = useState<KanbanBoardSummary[]>([]);
  const [selectedBoardId, setSelectedBoardId] = useState("");
  const [selectedBoard, setSelectedBoard] = useState<KanbanBoardDetail | null>(null);
  const [selectedColumnId, setSelectedColumnId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [loadingBoardDetail, setLoadingBoardDetail] = useState(false);
  const [isPending, startTransition] = useTransition();

  const columns = selectedBoard?.columns ?? [];

  const reset = useCallback(() => {
    setTitle("");
    setDescription("");
    setDueAt("");
  }, []);

  const loadBoardDetail = useCallback(async (boardId: string) => {
    setLoadingBoardDetail(true);
    const result = await getKanbanBoardAction(boardId);
    setLoadingBoardDetail(false);

    if (!result.success) {
      toast.error(actionError(result));
      setSelectedBoard(null);
      setSelectedColumnId("");
      return;
    }

    setSelectedBoard(result.data);
    setSelectedColumnId(result.data.columns[0]?.id ?? "");
  }, []);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoadingBoards(true);
    listKanbanBoardsAction().then(async (result) => {
      if (cancelled) return;
      setLoadingBoards(false);

      if (!result.success) {
        toast.error(actionError(result));
        return;
      }

      setBoards(result.data);
      const firstBoardId = result.data[0]?.id ?? "";
      setSelectedBoardId(firstBoardId);
      if (firstBoardId) await loadBoardDetail(firstBoardId);
    });

    return () => {
      cancelled = true;
    };
  }, [loadBoardDetail, open]);

  const handleBoardChange = useCallback(
    (boardId: string) => {
      setSelectedBoardId(boardId);
      void loadBoardDetail(boardId);
    },
    [loadBoardDetail]
  );

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (isPending) return;
      if (!nextOpen) reset();
      onOpenChange(nextOpen);
    },
    [isPending, onOpenChange, reset]
  );

  const submit = useCallback(() => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || !selectedBoardId || !selectedColumnId) return;

    startTransition(async () => {
      const result = await createKanbanCardAction({
        board_id: selectedBoardId,
        column_id: selectedColumnId,
        title: trimmedTitle,
        description: description.trim() || null,
        due_at: toDateTime(dueAt),
      });

      if (!result.success) {
        toast.error(actionError(result));
        return;
      }

      toast.success(t("created"));
      reset();
      onOpenChange(false);
      router.push(`/dashboard/planning/boards?board=${selectedBoardId}`);
    });
  }, [
    description,
    dueAt,
    onOpenChange,
    reset,
    router,
    selectedBoardId,
    selectedColumnId,
    t,
    title,
  ]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("fields.board")}</Label>
              <Select
                value={selectedBoardId}
                onValueChange={handleBoardChange}
                disabled={loadingBoards || isPending}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={loadingBoards ? t("loadingBoards") : t("placeholders.board")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {boards.map((board) => (
                    <SelectItem key={board.id} value={board.id}>
                      {board.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("fields.column")}</Label>
              <Select
                value={selectedColumnId}
                onValueChange={setSelectedColumnId}
                disabled={loadingBoardDetail || isPending || columns.length === 0}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      loadingBoardDetail ? t("loadingColumns") : t("placeholders.column")
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {columns.map((column) => (
                    <SelectItem key={column.id} value={column.id}>
                      {column.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {boards.length === 0 && !loadingBoards ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t("emptyBoards")}
            </div>
          ) : null}

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="quick-kanban-title">{t("fields.title")}</Label>
            <Input
              id="quick-kanban-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("placeholders.title")}
              disabled={isPending}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-kanban-description">{t("fields.description")}</Label>
            <Textarea
              id="quick-kanban-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("placeholders.description")}
              disabled={isPending}
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="quick-kanban-due">{t("fields.due")}</Label>
            <Input
              id="quick-kanban-due"
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
              disabled={isPending}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={isPending}>
            {t("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={!title.trim() || !selectedBoardId || !selectedColumnId || isPending}
          >
            {isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
            {t("submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
