import type {
  VmiMessageCreateInput,
  VmiOrderCreateInput,
  VmiProposalCreateInput,
  VmiStockCountSubmitInput,
} from "@/lib/validations/vmi";
import type { VmiServiceResult, VmiSupabaseClient } from "./supabase-service.types";

export class VmiWorkflowsService {
  static async submitStockCount(
    supabase: VmiSupabaseClient,
    input: VmiStockCountSubmitInput,
    actorUserId: string,
  ): Promise<VmiServiceResult> {
    const { data: session, error } = await supabase
      .from("vmi_stock_count_sessions")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        client_location_id: input.clientLocationId ?? null,
        status: "submitted",
        notes: input.notes ?? null,
        submitted_by: actorUserId,
        submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !session) return { data: session, error };

    const lines = input.lines.map((line) => ({
      stock_count_session_id: session.id,
      vendor_organization_id: input.vendorOrganizationId,
      client_account_id: input.clientAccountId,
      inventory_item_id: line.inventoryItemId,
      expected_quantity: line.expectedQuantity ?? null,
      counted_quantity: line.countedQuantity,
      notes: line.notes ?? null,
    }));

    const linesResult = await supabase.from("vmi_stock_count_lines").insert(lines).select("*");
    if (linesResult.error) return { data: null, error: linesResult.error };
    return { data: { session, lines: linesResult.data }, error: null };
  }

  static async createProposal(
    supabase: VmiSupabaseClient,
    input: VmiProposalCreateInput,
    actorUserId: string,
  ): Promise<VmiServiceResult> {
    const { data: proposal, error } = await supabase
      .from("vmi_proposals")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        client_location_id: input.clientLocationId ?? null,
        status: "sent",
        currency_code: input.currencyCode,
        notes: input.notes ?? null,
        created_by: actorUserId,
        submitted_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !proposal) return { data: proposal, error };

    const lines = input.lines.map((line) => ({
      proposal_id: proposal.id,
      vendor_organization_id: input.vendorOrganizationId,
      client_account_id: input.clientAccountId,
      inventory_item_id: line.inventoryItemId ?? null,
      item_id: line.itemId ?? null,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice ?? null,
      currency_code: line.currencyCode,
    }));

    const linesResult = await supabase.from("vmi_proposal_lines").insert(lines).select("*");
    if (linesResult.error) return { data: null, error: linesResult.error };
    return { data: { proposal, lines: linesResult.data }, error: null };
  }

  static async createOrder(
    supabase: VmiSupabaseClient,
    input: VmiOrderCreateInput,
    actorUserId: string,
  ): Promise<VmiServiceResult> {
    const { data: order, error } = await supabase
      .from("vmi_orders")
      .insert({
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        client_location_id: input.clientLocationId ?? null,
        proposal_id: input.proposalId ?? null,
        status: "submitted",
        currency_code: input.currencyCode,
        notes: input.notes ?? null,
        created_by_client_user_id: actorUserId,
      })
      .select("*")
      .single();

    if (error || !order) return { data: order, error };

    const lines = input.lines.map((line) => ({
      order_id: order.id,
      vendor_organization_id: input.vendorOrganizationId,
      client_account_id: input.clientAccountId,
      item_id: line.itemId ?? null,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice ?? null,
      currency_code: line.currencyCode,
    }));

    const linesResult = await supabase.from("vmi_order_lines").insert(lines).select("*");
    if (linesResult.error) return { data: null, error: linesResult.error };
    return { data: { order, lines: linesResult.data }, error: null };
  }

  static async createMessage(
    supabase: VmiSupabaseClient,
    input: VmiMessageCreateInput,
    actorUserId: string,
  ): Promise<VmiServiceResult> {
    let threadId = input.threadId;

    if (!threadId) {
      const { data: thread, error } = await supabase
        .from("vmi_message_threads")
        .insert({
          vendor_organization_id: input.vendorOrganizationId,
          client_account_id: input.clientAccountId,
          subject: input.subject ?? "Nowa wiadomość",
          created_by_vendor_user_id: input.senderKind === "vendor" ? actorUserId : null,
          created_by_client_user_id: input.senderKind === "client" ? actorUserId : null,
        })
        .select("*")
        .single();

      if (error || !thread) return { data: thread, error };
      threadId = thread.id;
    }

    return supabase
      .from("vmi_messages")
      .insert({
        thread_id: threadId,
        vendor_organization_id: input.vendorOrganizationId,
        client_account_id: input.clientAccountId,
        sender_kind: input.senderKind,
        sender_vendor_user_id: input.senderKind === "vendor" ? actorUserId : null,
        sender_client_user_id: input.senderKind === "client" ? actorUserId : null,
        body: input.body,
      })
      .select("*")
      .single();
  }
}
