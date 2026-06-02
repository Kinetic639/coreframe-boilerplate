"use client";

import { useState, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { toast } from "react-toastify";
import { Plus, GitBranch, Building2, CheckCircle, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { DataView } from "@/components/data-view/data-view";
import type {
  DataViewColumnDef,
  DataViewListParams,
  PaginatedResult,
} from "@/components/data-view/data-view.types";
import {
  deleteTicketTypeAction,
  listTicketTypesForDataViewAction,
  getTicketTypeDetailAction,
} from "@/app/actions/help-desk";
import type { HelpdeskTicketTypeWithDetails } from "@/server/services/helpdesk-ticket-types.service";
import type { MemberOption } from "@/components/help-desk/member-selector";
import type { PriorityBadgeConfig } from "@/components/help-desk/ticket-priority-badge";
import { TicketTypeFormDialog } from "./ticket-type-form-dialog";
import { TicketTypeDetailPanel } from "./ticket-type-detail-panel";

const TICKET_TYPES_QUERY_KEY = ["helpdesk-ticket-types-dataview"];

interface TicketTypesClientProps {
  initialData: PaginatedResult<HelpdeskTicketTypeWithDetails>;
  members: MemberOption[];
  availableBranches: Array<{ id: string; name: string }>;
  priorityConfigs: Record<string, PriorityBadgeConfig> | null;
  orgId: string;
}

export function TicketTypesClient({
  initialData,
  members,
  availableBranches,
  priorityConfigs,
  orgId,
}: TicketTypesClientProps) {
  const t = useTranslations("modules.helpDesk");
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingType, setEditingType] = useState<HelpdeskTicketTypeWithDetails | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const branchMap = useMemo(
    () => new Map(availableBranches.map((b) => [b.id, b.name])),
    [availableBranches]
  );

  const listFetcher = useCallback(
    async (params: DataViewListParams): Promise<PaginatedResult<HelpdeskTicketTypeWithDetails>> => {
      const result = await listTicketTypesForDataViewAction(orgId, params.page, params.pageSize);
      if (result.success) return result.data;
      throw new Error((result as { success: false; error: string }).error);
    },
    [orgId]
  );

  const detailFetcher = useCallback(
    async (id: string): Promise<HelpdeskTicketTypeWithDetails | null> => {
      const result = await getTicketTypeDetailAction(id, orgId);
      if (!result.success) return null;
      return result.data;
    },
    [orgId]
  );

  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const result = await deleteTicketTypeAction(deletingId);
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      toast.success(t("ticketTypes.deleteSuccess"));
      setDeletingId(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const columns = useMemo<DataViewColumnDef<HelpdeskTicketTypeWithDetails>[]>(
    () => [
      {
        key: "name",
        header: t("ticketTypes.name"),
        accessor: (row) => (
          <div className="flex items-center gap-2">
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: row.color }}
            />
            <button
              onClick={() =>
                router.push({
                  pathname: "/dashboard/help-desk/ticket-types/[typeId]",
                  params: { typeId: row.id },
                })
              }
              className="hover:text-primary truncate font-medium transition-colors"
            >
              {row.name}
            </button>
            {!row.is_active && (
              <Badge variant="secondary" className="text-xs">
                {t("ticketTypes.inactive")}
              </Badge>
            )}
          </div>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "scope",
        header: t("ticketTypes.scope"),
        accessor: (row) =>
          row.scope === "branch" ? (
            <Badge variant="outline" className="gap-1 text-xs">
              <GitBranch className="h-3 w-3" />
              {branchMap.get(row.branch_id ?? "") ?? t("ticketTypes.scopeBranch")}
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs">
              <Building2 className="h-3 w-3" />
              {t("ticketTypes.scopeOrg")}
            </Badge>
          ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "default_priority",
        header: t("tickets.fields.priority"),
        accessor: (row) => (
          <span className="text-sm">
            {priorityConfigs?.[row.default_priority]?.label ?? row.default_priority}
          </span>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "responders",
        header: t("ticketTypes.defaultAssignees"),
        accessor: (row) => (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            {row.default_responders.length}
          </div>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "acceptance",
        header: t("tickets.fields.requiresAcceptance"),
        accessor: (row) =>
          row.requires_acceptance ? (
            <div className="flex items-center gap-1 text-sm">
              <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
              <span className="text-green-700">{row.default_acceptors.length}</span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortable: false,
        defaultVisible: true,
      },
    ],
    [t, router, branchMap, priorityConfigs]
  );

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-4 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pages.ticketTypes.title")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pages.ticketTypes.subtitle")}</p>
        </div>
        <Button
          size="sm"
          onClick={() => {
            setEditingType(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("ticketTypes.createType")}
        </Button>
      </div>

      <div className="min-h-0 flex-1">
        <DataView<HelpdeskTicketTypeWithDetails, HelpdeskTicketTypeWithDetails>
          entity="helpdesk-ticket-types"
          columns={columns}
          filters={[]}
          initialData={initialData}
          queryKey={TICKET_TYPES_QUERY_KEY}
          listFetcher={listFetcher}
          detailFetcher={detailFetcher}
          getRowId={(row) => row.id}
          renderCompactItem={(row) => (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: row.color }}
                />
                <span className="truncate text-sm font-medium">{row.name}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {row.scope === "branch" ? (
                  <span className="flex items-center gap-1">
                    <GitBranch className="h-3 w-3" />
                    {branchMap.get(row.branch_id ?? "") ?? t("ticketTypes.scopeBranch")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {t("ticketTypes.scopeOrg")}
                  </span>
                )}
              </div>
            </div>
          )}
          renderDetail={(detail) => (
            <TicketTypeDetailPanel
              key={detail.id}
              type={detail}
              priorityConfigs={priorityConfigs}
              onEdit={(type) => {
                setEditingType(type);
                setFormOpen(true);
              }}
              onDeleteRequest={(id) => setDeletingId(id)}
            />
          )}
          renderToolbarControls={() => (
            <Button
              size="sm"
              onClick={() => {
                setEditingType(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              {t("ticketTypes.createType")}
            </Button>
          )}
          className="min-h-0 flex-1"
        />
      </div>

      <TicketTypeFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        editingType={editingType}
        members={members}
        availableBranches={availableBranches}
        priorityConfigs={priorityConfigs}
        onSaved={() => setFormOpen(false)}
      />

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("ticketTypes.deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("ticketTypes.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{t("tickets.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
