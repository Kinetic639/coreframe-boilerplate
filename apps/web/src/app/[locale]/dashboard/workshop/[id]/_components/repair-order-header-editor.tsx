"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Pencil, X, Check, Archive, RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { canTransitionRepairOrderStatus, type RepairOrderStatus } from "@/lib/types/repair-orders";
import type {
  RepairOrderHeader,
  RepairOrderAdvisorCandidate,
} from "@/server/services/repair-orders.service";
import {
  useUpdateRepairOrderHeaderMutation,
  useAssignRepairOrderAdvisorMutation,
  useChangeRepairOrderStatusMutation,
} from "@/hooks/queries/workshop";

interface RepairOrderHeaderEditorProps {
  order: RepairOrderHeader;
  advisorCandidates: RepairOrderAdvisorCandidate[];
  canManageOwn: boolean;
  canManageAll: boolean;
  ownAdvisorContactId: string | null;
  createdAtLabel: string;
  updatedAtLabel: string;
}

const UNASSIGNED = "__unassigned__";

export function RepairOrderHeaderEditor({
  order,
  advisorCandidates,
  canManageOwn,
  canManageAll,
  ownAdvisorContactId,
  createdAtLabel,
  updatedAtLabel,
}: RepairOrderHeaderEditorProps) {
  const t = useTranslations("modules.workshop.repairOrders");
  const router = useRouter();

  const isOwner = order.advisorContactId !== null && order.advisorContactId === ownAdvisorContactId;
  // Correction pass Finding B: repair_orders_update's RLS now makes an
  // already-archived row unreachable for UPDATE by ANYONE (its USING
  // clause requires status <> 'archived', evaluated against the CURRENT
  // row) -- archived is DB-terminal for manage_all too, not just
  // manage_own. The UI mirrors this exactly so a manage_all caller never
  // sees an Edit control that would silently no-op against the DB.
  const isArchived = order.status === "archived";
  const canEditHeader = !isArchived && (canManageAll || (canManageOwn && isOwner));
  const canReassignAdvisor = canManageAll;
  const canChangeStatus = canManageAll || (canManageOwn && isOwner);

  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState({
    zl_number: order.zlNumber ?? "",
    order_number: order.orderNumber ?? "",
    vin: order.vin ?? "",
    vehicle_brand: order.vehicleBrand ?? "",
    client_name: order.clientName ?? "",
    dealer_name: order.dealerName ?? "",
  });
  const [advisorValue, setAdvisorValue] = useState(order.advisorContactId ?? UNASSIGNED);

  const updateHeaderMutation = useUpdateRepairOrderHeaderMutation();
  const assignAdvisorMutation = useAssignRepairOrderAdvisorMutation();
  const changeStatusMutation = useChangeRepairOrderStatusMutation();

  function handleSaveHeader() {
    updateHeaderMutation.mutate(
      { id: order.id, ...fields },
      { onSuccess: () => (setEditing(false), router.refresh()) }
    );
  }

  function handleCancelHeader() {
    setFields({
      zl_number: order.zlNumber ?? "",
      order_number: order.orderNumber ?? "",
      vin: order.vin ?? "",
      vehicle_brand: order.vehicleBrand ?? "",
      client_name: order.clientName ?? "",
      dealer_name: order.dealerName ?? "",
    });
    setEditing(false);
  }

  function handleSaveAdvisor() {
    assignAdvisorMutation.mutate(
      { id: order.id, advisorContactId: advisorValue === UNASSIGNED ? null : advisorValue },
      { onSuccess: () => router.refresh() }
    );
  }

  function handleStatusChange(toStatus: RepairOrderStatus) {
    changeStatusMutation.mutate(
      { id: order.id, fromStatus: order.status, toStatus },
      { onSuccess: () => router.refresh() }
    );
  }

  const status = order.status as RepairOrderStatus;
  const canClose = canTransitionRepairOrderStatus(status, "closed", canManageAll);
  const canReopen = canTransitionRepairOrderStatus(status, "open", canManageAll);
  const canArchive =
    canManageAll && canTransitionRepairOrderStatus(status, "archived", canManageAll);
  const hasAnyLifecycleAction = canClose || canReopen || canArchive;

  return (
    <div className="flex flex-col gap-4">
      <div
        className="bg-card text-card-foreground border-border grid max-w-2xl grid-cols-1 gap-x-8 gap-y-4 rounded-lg border p-5 sm:grid-cols-2"
        data-testid="repair-order-detail-card"
      >
        {editing ? (
          <>
            <EditableField
              label={t("columns.zlNumber")}
              value={fields.zl_number}
              onChange={(v) => setFields((f) => ({ ...f, zl_number: v }))}
              mono
            />
            <EditableField
              label={t("columns.orderNumber")}
              value={fields.order_number}
              onChange={(v) => setFields((f) => ({ ...f, order_number: v }))}
              mono
            />
            <EditableField
              label={t("columns.vin")}
              value={fields.vin}
              onChange={(v) => setFields((f) => ({ ...f, vin: v }))}
              mono
            />
            <EditableField
              label={t("detail.vehicleBrand")}
              value={fields.vehicle_brand}
              onChange={(v) => setFields((f) => ({ ...f, vehicle_brand: v }))}
            />
            <EditableField
              label={t("detail.clientName")}
              value={fields.client_name}
              onChange={(v) => setFields((f) => ({ ...f, client_name: v }))}
            />
            <EditableField
              label={t("detail.dealerName")}
              value={fields.dealer_name}
              onChange={(v) => setFields((f) => ({ ...f, dealer_name: v }))}
            />
          </>
        ) : (
          <>
            <Field label={t("columns.zlNumber")} value={order.zlNumber} mono />
            <Field label={t("columns.orderNumber")} value={order.orderNumber} mono />
            <Field label={t("columns.vin")} value={order.vin} mono />
            <Field label={t("detail.vehicleBrand")} value={order.vehicleBrand} />
            <Field label={t("detail.clientName")} value={order.clientName} />
            <Field label={t("detail.dealerName")} value={order.dealerName} />
          </>
        )}
        <Field
          label={t("detail.identityStatus")}
          value={t(`identityStatus.${order.identityStatus}`)}
        />
        <Field label={t("columns.created")} value={createdAtLabel} />
        <Field label={t("detail.updated")} value={updatedAtLabel} />
      </div>

      {canEditHeader && (
        <div className="flex max-w-2xl items-center gap-2">
          {editing ? (
            <>
              <Button
                size="sm"
                onClick={handleSaveHeader}
                disabled={updateHeaderMutation.isPending}
                data-testid="save-header-button"
              >
                <Check className="mr-1.5 h-4 w-4" />
                {t("detail.save")}
              </Button>
              <Button size="sm" variant="outline" onClick={handleCancelHeader}>
                <X className="mr-1.5 h-4 w-4" />
                {t("detail.cancel")}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setEditing(true)}
              data-testid="edit-header-button"
            >
              <Pencil className="mr-1.5 h-4 w-4" />
              {t("detail.editHeader")}
            </Button>
          )}
        </div>
      )}

      <div
        className="bg-card text-card-foreground border-border flex max-w-2xl flex-col gap-3 rounded-lg border p-5"
        data-testid="repair-order-advisor-section"
      >
        <span className="text-muted-foreground text-xs">{t("columns.advisor")}</span>
        {canReassignAdvisor ? (
          <div className="flex flex-wrap items-center gap-2">
            <Select value={advisorValue} onValueChange={setAdvisorValue}>
              <SelectTrigger className="w-64" data-testid="advisor-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t("detail.unassignedAdvisor")}</SelectItem>
                {advisorCandidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSaveAdvisor}
              disabled={
                assignAdvisorMutation.isPending ||
                advisorValue === (order.advisorContactId ?? UNASSIGNED)
              }
              data-testid="assign-advisor-button"
            >
              {t("detail.assignAdvisor")}
            </Button>
          </div>
        ) : (
          <span className="text-sm">{order.advisorDisplayName ?? "—"}</span>
        )}
      </div>

      {canChangeStatus && hasAnyLifecycleAction && (
        <div
          className="flex max-w-2xl flex-wrap items-center gap-2"
          data-testid="lifecycle-actions"
        >
          {canClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange("closed")}
              disabled={changeStatusMutation.isPending}
              data-testid="close-order-button"
            >
              {t("detail.closeOrder")}
            </Button>
          )}
          {canReopen && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleStatusChange("open")}
              disabled={changeStatusMutation.isPending}
              data-testid="reopen-order-button"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              {t("detail.reopenOrder")}
            </Button>
          )}
          {canArchive && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={changeStatusMutation.isPending}
                  data-testid="archive-order-button"
                >
                  <Archive className="mr-1.5 h-4 w-4" />
                  {t("detail.archiveOrder")}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("detail.archiveConfirmTitle")}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("detail.archiveConfirmDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("detail.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => handleStatusChange("archived")}>
                    {t("detail.archiveOrder")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      )}

      {!canEditHeader && !canChangeStatus && (
        <p className="text-muted-foreground flex max-w-2xl items-center gap-1.5 text-xs">
          <Lock className="h-3.5 w-3.5" />
          {t("detail.readOnlyNote")}
        </p>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className={mono ? "font-mono text-sm" : "text-sm"}>{value ?? "—"}</span>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  mono,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-muted-foreground text-xs">{label}</Label>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono text-sm" : "text-sm"}
      />
    </div>
  );
}
