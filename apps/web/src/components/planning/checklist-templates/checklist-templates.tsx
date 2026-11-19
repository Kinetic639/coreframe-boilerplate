"use client";

import { planningRead } from "@/lib/planning/read";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowDown,
  ArrowUp,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteChecklistTemplateAction, saveChecklistTemplateAction } from "@/app/actions/kanban";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { PLANNING_SETTINGS_MANAGE } from "@/lib/constants/permissions";
import type { ChecklistTemplate, ChecklistTemplateItem } from "@/lib/types/kanban";
import { cn } from "@/utils";

export interface ChecklistTemplatePerson {
  user_id: string;
  name: string | null;
  email: string | null;
}

export const checklistTemplatesKey = (orgId: string) =>
  ["planning-checklist-templates", orgId] as const;

async function unwrap<T>(
  promise: Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<T> {
  const result = await promise;
  if ("error" in result) throw new Error(result.error);
  return result.data;
}

export function useChecklistTemplates(orgId: string, enabled = true) {
  return useQuery({
    queryKey: checklistTemplatesKey(orgId),
    queryFn: () => unwrap(planningRead("checklistTemplates")),
    staleTime: 60 * 1000,
    enabled,
  });
}

/** Its author, or whoever manages planning settings, may change a template. */
export function useCanEditTemplate(currentUserId: string) {
  const { can } = usePermissions();
  const manager = can(PLANNING_SETTINGS_MANAGE);
  return (template: ChecklistTemplate) => manager || template.created_by === currentUserId;
}

function useTemplateErrors() {
  const t = useTranslations("modules.planning.checklistTemplates");
  return (error: unknown) => {
    const message = error instanceof Error ? error.message : "";
    toast.error(message === "TEMPLATE_NOT_EDITABLE" ? t("notEditable") : t("saveFailed"));
  };
}

/* ------------------------------------------------------------------ */
/* Adding a template to a task                                         */
/* ------------------------------------------------------------------ */

/** "From template": pick one, it becomes a checklist of the task. */
export function ApplyChecklistTemplateButton({
  orgId,
  people,
  currentUserId,
  className,
  pending,
  onApply,
}: {
  orgId: string;
  people: ChecklistTemplatePerson[];
  currentUserId: string;
  className?: string;
  pending?: boolean;
  onApply: (template: ChecklistTemplate) => void;
}) {
  const t = useTranslations("modules.planning.checklistTemplates");
  const [open, setOpen] = useState(false);
  const [managing, setManaging] = useState(false);
  const query = useChecklistTemplates(orgId, open);
  const templates = query.data ?? [];

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className={className} disabled={pending}>
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <ClipboardList className="h-3.5 w-3.5" />
            )}
            {t("fromTemplate")}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(20rem,calc(100vw-2rem))] p-0">
          <Command>
            <CommandInput placeholder={t("search")} />
            <CommandList>
              {query.isPending ? (
                <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t("loading")}
                </div>
              ) : (
                <>
                  <CommandEmpty>{templates.length ? t("noMatches") : t("emptyShort")}</CommandEmpty>
                  <CommandGroup>
                    {templates.map((template) => (
                      <CommandItem
                        key={template.id}
                        value={`${template.title} ${template.id}`}
                        onSelect={() => {
                          setOpen(false);
                          onApply(template);
                        }}
                        className="flex flex-col items-start gap-0.5"
                      >
                        <span className="w-full truncate font-medium">{template.title}</span>
                        <span className="w-full truncate text-xs text-muted-foreground">
                          {t("itemCount", { count: template.items.length })}
                          {template.items.length
                            ? ` · ${template.items
                                .slice(0, 3)
                                .map((item) => item.title)
                                .join(", ")}${template.items.length > 3 ? "…" : ""}`
                            : ""}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
          <div className="border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-full justify-start gap-2 text-sm font-normal"
              onClick={() => {
                setOpen(false);
                setManaging(true);
              }}
            >
              <Settings2 className="h-3.5 w-3.5" />
              {t("manage")}
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      <ChecklistTemplatesDialog
        open={managing}
        onOpenChange={setManaging}
        orgId={orgId}
        people={people}
        currentUserId={currentUserId}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* The library                                                         */
/* ------------------------------------------------------------------ */

export function ChecklistTemplatesDialog({
  open,
  onOpenChange,
  orgId,
  people,
  currentUserId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  people: ChecklistTemplatePerson[];
  currentUserId: string;
}) {
  const t = useTranslations("modules.planning.checklistTemplates");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-1rem)] max-w-[640px] flex-col gap-0 p-0">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-6">
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          {open ? (
            <ChecklistTemplatesManager
              orgId={orgId}
              people={people}
              currentUserId={currentUserId}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** The organization's templates: make, change and remove them. */
export function ChecklistTemplatesManager({
  orgId,
  people,
  currentUserId,
}: {
  orgId: string;
  people: ChecklistTemplatePerson[];
  currentUserId: string;
}) {
  const t = useTranslations("modules.planning.checklistTemplates");
  const queryClient = useQueryClient();
  const query = useChecklistTemplates(orgId);
  const canEdit = useCanEditTemplate(currentUserId);
  const onError = useTemplateErrors();
  const [editing, setEditing] = useState<ChecklistTemplate | "new" | null>(null);
  const [removing, setRemoving] = useState<ChecklistTemplate | null>(null);
  const templates = query.data ?? [];

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(deleteChecklistTemplateAction({ id })),
    onSuccess: (_, id) => {
      queryClient.setQueryData<ChecklistTemplate[]>(checklistTemplatesKey(orgId), (list = []) =>
        list.filter((item) => item.id !== id)
      );
      toast.success(t("deleted"));
    },
    onError,
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {query.isPending ? t("loading") : t("count", { count: templates.length })}
        </p>
        <Button size="sm" className="gap-1.5" onClick={() => setEditing("new")}>
          <Plus className="h-3.5 w-3.5" />
          {t("new")}
        </Button>
      </div>

      {query.isError ? (
        <p className="text-sm text-destructive">{t("loadFailed")}</p>
      ) : !query.isPending && !templates.length ? (
        <div className="rounded-md border border-dashed px-4 py-8 text-center">
          <ClipboardList className="mx-auto h-6 w-6 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("emptyHelp")}</p>
        </div>
      ) : (
        <ul className="divide-y rounded-md border">
          {templates.map((template) => {
            const editable = canEdit(template);
            return (
              <li key={template.id} className="flex items-center gap-2 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{template.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t("itemCount", { count: template.items.length })}
                    {template.creator_name ? ` · ${template.creator_name}` : ""}
                  </p>
                </div>
                {editable ? (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0"
                      aria-label={t("edit")}
                      title={t("edit")}
                      onClick={() => setEditing(template)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={t("delete")}
                      title={t("delete")}
                      disabled={remove.isPending && remove.variables === template.id}
                      onClick={() => setRemoving(template)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <ChecklistTemplateEditorDialog
        orgId={orgId}
        template={editing === "new" ? null : editing}
        open={editing !== null}
        onOpenChange={(next) => {
          if (!next) setEditing(null);
        }}
        people={people}
      />

      <AlertDialog
        open={removing !== null}
        onOpenChange={(next) => {
          if (!next) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("deleteTitle", { title: removing?.title ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteHelp")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (removing) remove.mutate(removing.id);
                setRemoving(null);
              }}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One template                                                        */
/* ------------------------------------------------------------------ */

type DraftItem = ChecklistTemplateItem & { key: string };

let draftKey = 0;
const nextKey = () => `item-${++draftKey}`;
const NOBODY = "__nobody__";

function toDraft(items: ChecklistTemplateItem[]): DraftItem[] {
  return items.map((item) => ({ ...item, key: nextKey() }));
}

export function ChecklistTemplateEditorDialog({
  orgId,
  template,
  open,
  onOpenChange,
  people,
}: {
  orgId: string;
  /** null: a new template. */
  template: ChecklistTemplate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  people: ChecklistTemplatePerson[];
}) {
  const t = useTranslations("modules.planning.checklistTemplates");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-[640px] sm:rounded-lg sm:border">
        <DialogHeader className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-6">
          <DialogTitle>{template ? t("editTitle") : t("newTitle")}</DialogTitle>
          <DialogDescription>{t("editorHelp")}</DialogDescription>
        </DialogHeader>
        {open ? (
          <TemplateForm
            key={template?.id ?? "new"}
            orgId={orgId}
            template={template}
            people={people}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TemplateForm({
  orgId,
  template,
  people,
  onDone,
}: {
  orgId: string;
  template: ChecklistTemplate | null;
  people: ChecklistTemplatePerson[];
  onDone: () => void;
}) {
  const t = useTranslations("modules.planning.checklistTemplates");
  const queryClient = useQueryClient();
  const onError = useTemplateErrors();
  const [title, setTitle] = useState(template?.title ?? "");
  const [items, setItems] = useState<DraftItem[]>(() =>
    template?.items.length
      ? toDraft(template.items)
      : [{ key: nextKey(), title: "", assigned_to: null, due_offset_days: null }]
  );
  const [titleError, setTitleError] = useState(false);
  // People who left keep their place in the list, named by what we know.
  const peopleById = new Map(people.map((person) => [person.user_id, person]));

  const save = useMutation({
    mutationFn: () =>
      unwrap(
        saveChecklistTemplateAction({
          id: template?.id,
          title: title.trim(),
          items: items
            .filter((item) => item.title.trim())
            .map((item) => ({
              title: item.title.trim(),
              assigned_to: item.assigned_to,
              due_offset_days: item.due_offset_days,
            })),
        })
      ),
    onSuccess: (saved) => {
      queryClient.setQueryData<ChecklistTemplate[]>(checklistTemplatesKey(orgId), (list = []) =>
        [...list.filter((item) => item.id !== saved.id), saved].sort((a, b) =>
          a.title.localeCompare(b.title)
        )
      );
      toast.success(template ? t("saved") : t("created"));
      onDone();
    },
    onError,
  });

  const update = (key: string, patch: Partial<ChecklistTemplateItem>) =>
    setItems((list) => list.map((item) => (item.key === key ? { ...item, ...patch } : item)));
  const move = (index: number, by: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + by, 0, item);
      return next;
    });
  const add = () =>
    setItems((list) => [
      ...list,
      { key: nextKey(), title: "", assigned_to: null, due_offset_days: null },
    ]);

  const filled = items.filter((item) => item.title.trim()).length;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) {
          setTitleError(true);
          return;
        }
        save.mutate();
      }}
    >
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-4 sm:px-6">
        <div className="space-y-1.5">
          <Label htmlFor="checklist-template-title">{t("name")}</Label>
          <Input
            id="checklist-template-title"
            value={title}
            maxLength={200}
            autoFocus={!template}
            aria-invalid={titleError || undefined}
            onChange={(event) => {
              setTitle(event.target.value);
              if (titleError && event.target.value.trim()) setTitleError(false);
            }}
            onBlur={() => setTitleError(!title.trim())}
            placeholder={t("namePlaceholder")}
          />
          {titleError ? <p className="text-xs text-destructive">{t("nameRequired")}</p> : null}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between gap-2">
            <Label>{t("items")}</Label>
            <span className="text-xs text-muted-foreground">
              {t("itemCount", { count: filled })}
            </span>
          </div>
          <ol className="space-y-2">
            {items.map((item, index) => (
              <li key={item.key} className="rounded-md border p-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                    {index + 1}.
                  </span>
                  <Input
                    value={item.title}
                    maxLength={500}
                    aria-label={t("itemTitle", { number: index + 1 })}
                    placeholder={t("itemPlaceholder")}
                    className="h-8"
                    onChange={(event) => update(item.key, { title: event.target.value })}
                    onKeyDown={(event) => {
                      // Enter on the last line adds the next one.
                      if (event.key === "Enter" && index === items.length - 1) {
                        event.preventDefault();
                        if (item.title.trim()) add();
                      }
                    }}
                    autoFocus={!item.title && index > 0 && index === items.length - 1}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    aria-label={t("removeItem")}
                    title={t("removeItem")}
                    onClick={() =>
                      setItems((list) =>
                        list.length > 1
                          ? list.filter((other) => other.key !== item.key)
                          : [{ ...list[0], title: "", assigned_to: null, due_offset_days: null }]
                      )
                    }
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 pl-7">
                  <Select
                    value={item.assigned_to ?? NOBODY}
                    onValueChange={(value) =>
                      update(item.key, { assigned_to: value === NOBODY ? null : value })
                    }
                  >
                    <SelectTrigger
                      className="h-8 w-auto min-w-[9rem] max-w-[14rem] text-xs"
                      aria-label={t("assignee")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NOBODY}>{t("nobody")}</SelectItem>
                      {item.assigned_to && !peopleById.has(item.assigned_to) ? (
                        <SelectItem value={item.assigned_to}>{t("formerMember")}</SelectItem>
                      ) : null}
                      {people.map((person) => (
                        <SelectItem key={person.user_id} value={person.user_id}>
                          {person.name ?? person.email ?? person.user_id}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span>{t("dueIn")}</span>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={365}
                      value={item.due_offset_days ?? ""}
                      placeholder="—"
                      className="h-8 w-16 text-xs"
                      onChange={(event) => {
                        const raw = event.target.value;
                        const value = raw === "" ? null : Math.round(Number(raw));
                        update(item.key, {
                          due_offset_days:
                            value === null || Number.isNaN(value)
                              ? null
                              : Math.min(365, Math.max(0, value)),
                        });
                      }}
                    />
                    <span>{t("days")}</span>
                  </label>
                  <div className="ml-auto flex items-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === 0}
                      aria-label={t("moveUp")}
                      title={t("moveUp")}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={index === items.length - 1}
                      aria-label={t("moveDown")}
                      title={t("moveDown")}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={add}
            disabled={items.length >= 200}
          >
            <Plus className="h-3.5 w-3.5" />
            {t("addItem")}
          </Button>
        </div>
      </div>
      <DialogFooter
        className={cn(
          "shrink-0 gap-2 border-t px-4 py-3 sm:px-6",
          "pb-[max(0.75rem,env(safe-area-inset-bottom))]"
        )}
      >
        <Button type="button" variant="outline" onClick={onDone} disabled={save.isPending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={save.isPending} className="gap-1.5">
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {template ? t("save") : t("create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
