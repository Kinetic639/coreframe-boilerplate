import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_BOARDS_CREATE,
  PLANNING_BOARDS_DELETE,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_ASSIGN,
  PLANNING_TASKS_READ,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { PlanningBoardsClient } from "./_components/planning-boards-client";
import { boardKeys } from "./_components/boards-query";
import { BOARD_UI_COOKIE, parseBoardUiPrefs } from "./_components/board-ui-prefs";
import { taskEditorKeys } from "@/components/planning/task-editor/task-editor-queries";

interface PlanningBoardsPageProps {
  searchParams?: Promise<{ board?: string; karta?: string }>;
}

export default async function PlanningBoardsPage({ searchParams }: PlanningBoardsPageProps) {
  const locale = await getLocale();
  const resolvedSearchParams = await searchParams;
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
    // The planning menu entry opens boards; someone who only reads tasks gets
    // the list instead of a dead end.
    if (checkPermission(context.user.permissionSnapshot, PLANNING_TASKS_READ)) {
      return redirect({ href: "/dashboard/planning/tasks", locale });
    }
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_boards_read_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? "";
  const prefs = parseBoardUiPrefs((await cookies()).get(BOARD_UI_COOKIE)?.value);
  // The board this page will most likely open (the one in the address, else
  // the one this browser had open last) is read together with the list
  // instead of after it. RLS answers for it like for any other read.
  const likelyBoardId = resolvedSearchParams?.board ?? prefs.lastBoardId ?? null;
  const [boardsResult, inboxResult, membersResult, likelyBoard] = await Promise.all([
    KanbanBoardsService.listBoards(supabase, orgId, userId),
    KanbanBoardsService.listInboxCards(supabase, orgId, userId),
    OrgMembersService.listMembers(supabase, orgId),
    likelyBoardId ? KanbanBoardsService.getBoard(supabase, orgId, likelyBoardId, userId) : null,
  ]);
  const people = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];
  const boards = boardsResult.success ? boardsResult.data : [];
  // The board the page opens on: the one in the address (it may be archived),
  // else the one this browser had open last, else the first.
  const initialBoardId =
    resolvedSearchParams?.board ??
    boards.find((board) => board.id === prefs.lastBoardId)?.id ??
    boards[0]?.id;
  const initialBoard = !initialBoardId
    ? null
    : initialBoardId === likelyBoardId && likelyBoard
      ? likelyBoard
      : await KanbanBoardsService.getBoard(supabase, orgId, initialBoardId, userId);

  // Everything the first view needs goes into the client cache, so the board
  // shows at once and the client does not fetch it again.
  const queryClient = new QueryClient();
  if (boardsResult.success) queryClient.setQueryData(boardKeys.list(orgId), boards);
  if (inboxResult.success) queryClient.setQueryData(boardKeys.inbox(orgId), inboxResult.data);
  if (initialBoard?.success) {
    queryClient.setQueryData(boardKeys.board(orgId, initialBoard.data.id), initialBoard.data);
  }
  // A link to a card (?karta=TSK-12) renders with the card open and complete:
  // what its editor needs besides the card comes with the page. A card that is
  // not on this board or in the inbox is read on its own.
  const openCardRef = resolvedSearchParams?.karta?.toUpperCase();
  if (openCardRef) {
    const openCard =
      (initialBoard?.success
        ? initialBoard.data.cards.find((card) => card.task_number === openCardRef)
        : undefined) ??
      (inboxResult.success
        ? inboxResult.data.find((card) => card.task_number === openCardRef)
        : undefined);
    if (openCard) {
      const [activity, relations] = await Promise.all([
        KanbanBoardsService.listCardActivity(supabase, orgId, openCard.id),
        KanbanBoardsService.getTaskRelations(supabase, orgId, openCard.id),
      ]);
      if (activity.success) {
        queryClient.setQueryData(taskEditorKeys.activity(orgId, openCard.id), activity.data);
      }
      if (relations.success) {
        queryClient.setQueryData(taskEditorKeys.relations(orgId, openCard.id), relations.data);
      }
    } else {
      const editor = await KanbanBoardsService.getTaskEditor(supabase, orgId, userId, openCardRef);
      if (editor.success) {
        queryClient.setQueryData(taskEditorKeys.task(orgId, openCardRef), editor.data);
      }
    }
  }
  const snap = context.user.permissionSnapshot;

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PlanningBoardsClient
        orgId={orgId}
        initialPrefs={{
          ...prefs,
          lastBoardId: initialBoard?.success ? initialBoard.data.id : prefs.lastBoardId,
        }}
        canCreate={checkPermission(snap, PLANNING_BOARDS_CREATE)}
        canUpdate={checkPermission(snap, PLANNING_BOARDS_UPDATE)}
        canDelete={checkPermission(snap, PLANNING_BOARDS_DELETE)}
        canAssign={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
        branches={context.app.accessibleBranches.map((branch) => ({
          id: branch.id,
          name: branch.name,
        }))}
        people={people}
        currentUserId={userId}
      />
    </HydrationBoundary>
  );
}
