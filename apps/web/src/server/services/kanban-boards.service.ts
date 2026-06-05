import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreateKanbanBoardInput,
  CreateKanbanCardInput,
  CreateKanbanColumnInput,
  DeleteKanbanBoardInput,
  DeleteKanbanColumnInput,
  KanbanVisibility,
  MoveKanbanCardInput,
  ReorderKanbanColumnsInput,
  UpdateKanbanBoardInput,
  UpdateKanbanCardInput,
  UpdateKanbanColumnInput,
} from "@/lib/validations/kanban";
import { normalizeCommentRichText } from "@/lib/validations/comments";
import {
  MAX_KANBAN_BOARDS_PER_USER,
  type KanbanCardActivity,
  type KanbanBoardCard,
  type KanbanBoardColumn,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
} from "@/lib/types/kanban";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

function displayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || null;
}

function mapBoard(row: any): KanbanBoardSummary {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    visibility: row.visibility as KanbanVisibility,
    created_by: row.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapColumn(row: any): KanbanBoardColumn {
  return {
    id: row.id,
    board_id: row.board_id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    color: row.color ?? null,
    position: row.position ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapCard(row: any): KanbanBoardCard {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    board_id: row.board_id,
    column_id: row.column_id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    description_rich: row.description_rich ?? null,
    due_at: row.due_at ?? null,
    label: row.label ?? null,
    label_color: row.label_color ?? null,
    position: row.position ?? 0,
    created_by: row.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapActivity(row: any): KanbanCardActivity {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return {
    id: row.id,
    organization_id: row.organization_id,
    board_id: row.board_id,
    card_id: row.card_id,
    actor_id: row.actor_id ?? null,
    actor_name: actor ? displayName(actor.first_name, actor.last_name, actor.email) : null,
    actor_email: actor?.email ?? null,
    activity_type: row.activity_type,
    message: row.message ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

async function nextPosition(
  supabase: SupabaseClient,
  table: "planning_kanban_columns" | "planning_kanban_cards",
  filterColumn: "board_id" | "column_id",
  filterValue: string
): Promise<number> {
  const { data } = await supabase
    .from(table)
    .select("position")
    .eq(filterColumn, filterValue)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as any)?.position ?? -1) + 1;
}

export const KanbanBoardsService = {
  async recordCardActivity(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    cardId: string,
    actorId: string | null,
    activityType: string,
    metadata: Record<string, unknown> = {},
    message?: string
  ): Promise<void> {
    await supabase.from("planning_kanban_card_activity").insert({
      organization_id: orgId,
      board_id: boardId,
      card_id: cardId,
      actor_id: actorId,
      activity_type: activityType,
      message: message ?? null,
      metadata,
    });
  },

  async listCardActivity(
    supabase: SupabaseClient,
    orgId: string,
    cardId: string
  ): Promise<ServiceResult<KanbanCardActivity[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_kanban_card_activity")
        .select(
          `id, organization_id, board_id, card_id, actor_id, activity_type, message, metadata, created_at,
           actor:users!actor_id(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .eq("card_id", cardId)
        .order("created_at", { ascending: true });

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapActivity) };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async listBoards(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<KanbanBoardSummary[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_kanban_boards")
        .select(
          `id, organization_id, title, description, visibility, created_by, created_at, updated_at,
           creator:users!created_by(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapBoard) };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async getBoard(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: boardRaw, error: boardError } = await supabase
        .from("planning_kanban_boards")
        .select(
          `id, organization_id, title, description, visibility, created_by, created_at, updated_at,
           creator:users!created_by(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .eq("id", boardId)
        .is("deleted_at", null)
        .single();

      if (boardError) return { success: false, error: boardError.message };
      const board = mapBoard(boardRaw as any);

      const [columnsResult, cardsResult] = await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .select(
            "id, board_id, organization_id, title, description, color, position, created_at, updated_at"
          )
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .is("deleted_at", null)
          .order("position", { ascending: true }),
        supabase
          .from("planning_kanban_cards")
          .select(
            `id, board_id, column_id, organization_id, title, description, due_at, label, label_color, position, created_by, created_at, updated_at,
             description_rich,
             creator:users!created_by(first_name, last_name, email)`
          )
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .is("deleted_at", null)
          .order("position", { ascending: true }),
      ]);

      if (columnsResult.error) return { success: false, error: columnsResult.error.message };
      if (cardsResult.error) return { success: false, error: cardsResult.error.message };

      return {
        success: true,
        data: {
          ...board,
          columns: (columnsResult.data ?? []).map(mapColumn),
          cards: (cardsResult.data ?? []).map(mapCard),
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { count, error: countError } = await supabase
        .from("planning_kanban_boards")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("created_by", userId)
        .is("deleted_at", null);

      if (countError) return { success: false, error: countError.message };
      if ((count ?? 0) >= MAX_KANBAN_BOARDS_PER_USER) {
        return {
          success: false,
          error: `You can create up to ${MAX_KANBAN_BOARDS_PER_USER} boards.`,
        };
      }

      const { data, error } = await supabase
        .from("planning_kanban_boards")
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description || null,
          visibility: input.visibility,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };

      const boardId = (data as any).id as string;
      return KanbanBoardsService.getBoard(supabase, orgId, boardId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: DeleteKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardSummary[]>> {
    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("planning_kanban_boards")
        .update({ deleted_at: deletedAt, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .update({ deleted_at: deletedAt })
          .eq("organization_id", orgId)
          .eq("board_id", input.id)
          .is("deleted_at", null),
        supabase
          .from("planning_kanban_cards")
          .update({ deleted_at: deletedAt, updated_by: userId })
          .eq("organization_id", orgId)
          .eq("board_id", input.id)
          .is("deleted_at", null),
      ]);

      return KanbanBoardsService.listBoards(supabase, orgId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_boards")
        .update({
          title: input.title,
          description: input.description || null,
          visibility: input.visibility,
          updated_by: userId,
        })
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createColumn(
    supabase: SupabaseClient,
    orgId: string,
    input: CreateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const position = await nextPosition(
        supabase,
        "planning_kanban_columns",
        "board_id",
        input.board_id
      );
      const { error } = await supabase.from("planning_kanban_columns").insert({
        board_id: input.board_id,
        organization_id: orgId,
        title: input.title,
        description: input.description || null,
        color: input.color || null,
        position,
      });
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateColumn(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_columns")
        .update({
          title: input.title,
          description: input.description || null,
          color: input.color || null,
        })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteColumn(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: DeleteKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("planning_kanban_columns")
        .update({ deleted_at: deletedAt })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await supabase
        .from("planning_kanban_cards")
        .update({ deleted_at: deletedAt, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("column_id", input.id)
        .is("deleted_at", null);

      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const position = await nextPosition(
        supabase,
        "planning_kanban_cards",
        "column_id",
        input.column_id
      );
      const { data, error } = await supabase
        .from("planning_kanban_cards")
        .insert({
          board_id: input.board_id,
          column_id: input.column_id,
          organization_id: orgId,
          title: input.title,
          description: input.description || null,
          description_rich: normalizeCommentRichText(input.description_rich) ?? null,
          due_at: input.due_at || null,
          label: input.label || null,
          label_color: input.label_color || null,
          position,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        (data as any).id,
        userId,
        "card_created"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_cards")
        .update({
          column_id: input.column_id,
          title: input.title,
          description: input.description || null,
          description_rich: normalizeCommentRichText(input.description_rich) ?? null,
          due_at: input.due_at || null,
          label: input.label || null,
          label_color: input.label_color || null,
          updated_by: userId,
        })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        input.id,
        userId,
        "card_updated"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async moveCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: MoveKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: cardsRaw, error: cardsError } = await supabase
        .from("planning_kanban_cards")
        .select("id, column_id, position")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .is("deleted_at", null)
        .order("position", { ascending: true });

      if (cardsError) return { success: false, error: cardsError.message };

      const cards = (cardsRaw ?? []) as any[];
      const moved = cards.find((card) => card.id === input.card_id);
      if (!moved) return { success: false, error: "Card not found" };
      const fromColumnId = moved.column_id;

      const affectedColumnIds = new Set([moved.column_id, input.to_column_id]);
      const updates: Array<PromiseLike<{ error: unknown }>> = [];

      for (const columnId of affectedColumnIds) {
        const nextCards = cards
          .filter((card) => card.column_id === columnId && card.id !== input.card_id)
          .sort((a, b) => a.position - b.position);

        if (columnId === input.to_column_id) {
          nextCards.splice(input.to_position, 0, { ...moved, column_id: input.to_column_id });
        }

        nextCards.forEach((card, index) => {
          updates.push(
            supabase
              .from("planning_kanban_cards")
              .update({
                column_id: columnId,
                position: index,
                updated_by: userId,
              })
              .eq("organization_id", orgId)
              .eq("board_id", input.board_id)
              .eq("id", card.id)
          );
        });
      }

      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        return {
          success: false,
          error: failed.error instanceof Error ? failed.error.message : "Failed to move card",
        };
      }

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        input.card_id,
        userId,
        "card_moved",
        { from_column_id: fromColumnId, to_column_id: input.to_column_id }
      );

      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async reorderColumns(
    supabase: SupabaseClient,
    orgId: string,
    input: ReorderKanbanColumnsInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const results = await Promise.all(
        input.column_ids.map((id, position) =>
          supabase
            .from("planning_kanban_columns")
            .update({ position })
            .eq("organization_id", orgId)
            .eq("board_id", input.board_id)
            .eq("id", id)
            .is("deleted_at", null)
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) return { success: false, error: failed.error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string,
    cardId: string
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_cards")
        .update({ deleted_at: new Date().toISOString(), updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("id", cardId)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        boardId,
        cardId,
        userId,
        "card_archived"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, boardId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },
};
