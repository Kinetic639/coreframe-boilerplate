"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { toast } from "react-toastify";
import {
  createKanbanCustomFieldAction,
  deleteKanbanCustomFieldAction,
  updateKanbanCustomFieldAction,
} from "@/app/actions/kanban";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  KANBAN_CUSTOM_FIELD_TYPES,
  type KanbanBoardDetail,
  type KanbanCustomField,
  type KanbanCustomFieldOption,
  type KanbanCustomFieldType,
} from "@/lib/types/kanban";
import { COLUMN_COLORS } from "./board-format";
import { boardKeys, unwrap } from "./boards-query";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Operation failed";
}

function newOptionId() {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * The board's custom fields: add one (its type is fixed once made), rename
 * it, edit a select's choices, show it on cards, reorder or delete it.
 */
export function BoardFieldsDialog({
  orgId,
  board,
  open,
  onOpenChange,
  canEdit,
}: {
  orgId: string;
  board: KanbanBoardDetail;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canEdit: boolean;
}) {
  const t = useTranslations("modules.planning.boardExtras.fields");
  const queryClient = useQueryClient();
  const fields = board.custom_fields ?? [];
  const [name, setName] = useState("");
  const [type, setType] = useState<KanbanCustomFieldType>("text");
  const [pending, setPending] = useState(false);
  const [deleting, setDeleting] = useState<KanbanCustomField | null>(null);

  const writeFields = (update: (fields: KanbanCustomField[]) => KanbanCustomField[]) =>
    queryClient.setQueryData<KanbanBoardDetail>(boardKeys.board(orgId, board.id), (current) =>
      current ? { ...current, custom_fields: update(current.custom_fields ?? []) } : current
    );

  const add = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      const field = await unwrap(
        createKanbanCustomFieldAction({
          board_id: board.id,
          name: trimmed,
          field_type: type,
          options:
            type === "select"
              ? [{ id: newOptionId(), name: t("firstOption"), color: COLUMN_COLORS[0] }]
              : [],
        })
      );
      writeFields((current) => [...current, field]);
      setName("");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  const update = async (
    field: KanbanCustomField,
    patch: Partial<Pick<KanbanCustomField, "name" | "options" | "show_on_card" | "position">>
  ) => {
    writeFields((current) =>
      current.map((item) => (item.id === field.id ? { ...item, ...patch } : item))
    );
    try {
      const saved = await unwrap(
        updateKanbanCustomFieldAction({ id: field.id, board_id: board.id, ...patch })
      );
      writeFields((current) => current.map((item) => (item.id === saved.id ? saved : item)));
      // A removed choice leaves cards empty: show that.
      if (patch.options) {
        void queryClient.invalidateQueries({ queryKey: boardKeys.board(orgId, board.id) });
      }
    } catch (error) {
      writeFields((current) => current.map((item) => (item.id === field.id ? field : item)));
      toast.error(errorMessage(error));
    }
  };

  const move = async (index: number, delta: -1 | 1) => {
    const other = fields[index + delta];
    const field = fields[index];
    if (!other || !field) return;
    const ordered = [...fields];
    ordered[index] = other;
    ordered[index + delta] = field;
    writeFields(() => ordered.map((item, position) => ({ ...item, position })));
    try {
      await Promise.all(
        ordered.map((item, position) =>
          item.position === position
            ? null
            : unwrap(updateKanbanCustomFieldAction({ id: item.id, board_id: board.id, position }))
        )
      );
    } catch (error) {
      toast.error(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: boardKeys.board(orgId, board.id) });
    }
  };

  const remove = async (field: KanbanCustomField) => {
    setDeleting(null);
    writeFields((current) => current.filter((item) => item.id !== field.id));
    try {
      await unwrap(deleteKanbanCustomFieldAction({ id: field.id, board_id: board.id }));
      toast.success(t("deleted"));
    } catch (error) {
      writeFields((current) => [...current, field].sort((a, b) => a.position - b.position));
      toast.error(errorMessage(error));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("description")}</DialogDescription>
        </DialogHeader>

        {fields.length ? (
          <ul className="space-y-2">
            {fields.map((field, index) => (
              <li key={field.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <FieldName
                    field={field}
                    disabled={!canEdit}
                    label={t("name")}
                    onSave={(value) => void update(field, { name: value })}
                  />
                  <Badge variant="outline" className="shrink-0">
                    {t(`types.${field.field_type}`)}
                  </Badge>
                  {canEdit ? (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={t("moveUp")}
                        disabled={index === 0}
                        onClick={() => void move(index, -1)}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        aria-label={t("moveDown")}
                        disabled={index === fields.length - 1}
                        onClick={() => void move(index, 1)}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                        aria-label={t("delete")}
                        onClick={() => setDeleting(field)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : null}
                </div>
                <label className="flex items-center justify-between gap-3 text-sm">
                  <span>{t("showOnCard")}</span>
                  <Switch
                    checked={field.show_on_card}
                    disabled={!canEdit}
                    onCheckedChange={(checked) => void update(field, { show_on_card: checked })}
                  />
                </label>
                {field.field_type === "select" ? (
                  <OptionsEditor
                    options={field.options}
                    disabled={!canEdit}
                    onChange={(options) => void update(field, { options })}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        )}

        {canEdit ? (
          <form
            className="space-y-2 border-t pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              void add();
            }}
          >
            <p className="text-sm font-medium">{t("add")}</p>
            <div className="flex flex-wrap gap-2">
              <div className="min-w-0 flex-1 basis-40">
                <Label htmlFor="new-field-name" className="sr-only">
                  {t("name")}
                </Label>
                <Input
                  id="new-field-name"
                  value={name}
                  maxLength={80}
                  placeholder={t("namePlaceholder")}
                  onChange={(event) => setName(event.target.value)}
                />
              </div>
              <Select
                value={type}
                onValueChange={(value) => setType(value as KanbanCustomFieldType)}
              >
                <SelectTrigger className="w-36" aria-label={t("type")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {KANBAN_CUSTOM_FIELD_TYPES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {t(`types.${item}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button type="submit" disabled={!name.trim() || pending}>
                <Plus className="mr-1.5 h-4 w-4" />
                {t("addSubmit")}
              </Button>
            </div>
          </form>
        ) : null}

        <AlertDialog open={Boolean(deleting)} onOpenChange={(next) => !next && setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {t("deleteTitle", { name: deleting?.name ?? "" })}
              </AlertDialogTitle>
              <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleting && void remove(deleting)}
              >
                {t("deleteConfirm")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DialogContent>
    </Dialog>
  );
}

function FieldName({
  field,
  disabled,
  label,
  onSave,
}: {
  field: KanbanCustomField;
  disabled: boolean;
  label: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(field.name);
  const commit = () => {
    const trimmed = value.trim();
    if (!trimmed) return setValue(field.name);
    if (trimmed !== field.name) onSave(trimmed);
  };
  return (
    <Input
      value={value}
      maxLength={80}
      aria-label={label}
      disabled={disabled}
      className="h-8 min-w-0 flex-1 font-medium"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}

/** A select field's choices: name, colour (click to change), remove, add. */
function OptionsEditor({
  options,
  disabled,
  onChange,
}: {
  options: KanbanCustomFieldOption[];
  disabled: boolean;
  onChange: (options: KanbanCustomFieldOption[]) => void;
}) {
  const t = useTranslations("modules.planning.boardExtras.fields");
  const [draft, setDraft] = useState("");

  const nextColor = (color: string) =>
    COLUMN_COLORS[(COLUMN_COLORS.indexOf(color) + 1) % COLUMN_COLORS.length];

  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium text-muted-foreground">{t("options")}</p>
      <ul className="space-y-1">
        {options.map((option) => (
          <li key={option.id} className="flex items-center gap-2">
            <button
              type="button"
              className="h-5 w-5 shrink-0 rounded-full border"
              style={{ backgroundColor: option.color }}
              aria-label={t("optionColor")}
              title={t("optionColor")}
              disabled={disabled}
              onClick={() =>
                onChange(
                  options.map((item) =>
                    item.id === option.id ? { ...item, color: nextColor(item.color) } : item
                  )
                )
              }
            />
            <OptionName
              option={option}
              disabled={disabled}
              label={t("optionName")}
              onSave={(name) =>
                onChange(options.map((item) => (item.id === option.id ? { ...item, name } : item)))
              }
            />
            {!disabled ? (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={t("removeOption")}
                onClick={() => onChange(options.filter((item) => item.id !== option.id))}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
      {!disabled && options.length < 50 ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const name = draft.trim();
            if (!name) return;
            onChange([
              ...options,
              {
                id: newOptionId(),
                name: name.slice(0, 60),
                color: COLUMN_COLORS[options.length % COLUMN_COLORS.length],
              },
            ]);
            setDraft("");
          }}
        >
          <Input
            value={draft}
            maxLength={60}
            placeholder={t("addOption")}
            aria-label={t("addOption")}
            className="h-8"
            onChange={(event) => setDraft(event.target.value)}
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            className="h-8"
            disabled={!draft.trim()}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function OptionName({
  option,
  disabled,
  label,
  onSave,
}: {
  option: KanbanCustomFieldOption;
  disabled: boolean;
  label: string;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(option.name);
  const commit = () => {
    const trimmed = value.trim().slice(0, 60);
    if (!trimmed) return setValue(option.name);
    if (trimmed !== option.name) onSave(trimmed);
  };
  return (
    <Input
      value={value}
      maxLength={60}
      aria-label={label}
      disabled={disabled}
      className="h-7 min-w-0 flex-1 text-sm"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
      }}
    />
  );
}
