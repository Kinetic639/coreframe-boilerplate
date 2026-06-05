import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_BOARDS_CREATE,
  PLANNING_BOARDS_DELETE,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { PlanningBoardsClient } from "./_components/planning-boards-client";

export default async function PlanningBoardsPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_boards_read_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const boardsResult = await KanbanBoardsService.listBoards(supabase, context.app.activeOrgId);
  const boards = boardsResult.success ? boardsResult.data : [];
  const firstBoardResult = boards[0]
    ? await KanbanBoardsService.getBoard(supabase, context.app.activeOrgId, boards[0].id)
    : null;
  const firstBoard = firstBoardResult?.success ? firstBoardResult.data : null;
  const snap = context.user.permissionSnapshot;

  return (
    <PlanningBoardsClient
      initialBoards={boards}
      initialBoard={firstBoard}
      canCreate={checkPermission(snap, PLANNING_BOARDS_CREATE)}
      canUpdate={checkPermission(snap, PLANNING_BOARDS_UPDATE)}
      canDelete={checkPermission(snap, PLANNING_BOARDS_DELETE)}
    />
  );
}
