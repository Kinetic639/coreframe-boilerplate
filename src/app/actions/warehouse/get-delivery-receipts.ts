"use server";

// =============================================
// Get Delivery Receipts Server Action
// Fetches all receipts associated with a delivery
// =============================================

import { createClient } from "@/utils/supabase/server";

export interface DeliveryReceipt {
  id: string;
  receipt_number: string;
  receipt_date: string;
  status: string;
  pz_document_number?: string;
  pz_document_url?: string;
  total_movements: number;
  total_value: number;
  created_at: string;
  completed_at?: string;
  received_by_user?: {
    id: string;
    email: string;
    name: string;
  };
}

export async function getDeliveryReceipts(deliveryId: string): Promise<DeliveryReceipt[]> {
  try {
    const supabase = await createClient();

    // Get all movement IDs for this delivery (all movements with same reference_id)
    const { data: primaryMovement } = await supabase
      .from("stock_movements")
      .select("reference_id, organization_id, branch_id")
      .eq("id", deliveryId)
      .eq("movement_type_code", "101")
      .single();

    if (!primaryMovement) {
      return [];
    }

    const referenceId = primaryMovement.reference_id || deliveryId;

    // Get all movement IDs for this delivery
    const { data: movements } = await supabase
      .from("stock_movements")
      .select("id")
      .eq("organization_id", primaryMovement.organization_id)
      .eq("branch_id", primaryMovement.branch_id)
      .eq("movement_type_code", "101")
      .eq("reference_id", referenceId);

    if (!movements || movements.length === 0) {
      return [];
    }

    const movementIds = movements.map((m) => m.id);

    // Get receipt IDs linked to these movements
    const { data: receiptMovements } = await supabase
      .from("receipt_movements")
      .select("receipt_id")
      .in("movement_id", movementIds);

    if (!receiptMovements || receiptMovements.length === 0) {
      return [];
    }

    const receiptIds = [...new Set(receiptMovements.map((rm) => rm.receipt_id))];

    // Get receipt documents with user data
    const { data: receipts } = await supabase
      .from("receipt_documents")
      .select(
        `
        id,
        receipt_number,
        receipt_date,
        status,
        pz_document_number,
        pz_document_url,
        total_movements,
        total_value,
        created_at,
        completed_at,
        received_by
      `
      )
      .in("id", receiptIds)
      .order("receipt_date", { ascending: false });

    if (!receipts || receipts.length === 0) {
      return [];
    }

    // Get user data for received_by
    const userIds = receipts.map((r) => r.received_by).filter((id): id is string => id !== null);

    const usersMap = new Map();
    if (userIds.length > 0) {
      const { data: users } = await supabase
        .from("users")
        .select("id, email, first_name, last_name")
        .in("id", userIds);

      users?.forEach((user) => {
        usersMap.set(user.id, user);
      });
    }

    // Map receipts to response format
    return receipts.map((receipt) => {
      const receivedByUser = receipt.received_by ? usersMap.get(receipt.received_by) : null;

      return {
        id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_date: receipt.receipt_date,
        status: receipt.status,
        pz_document_number: receipt.pz_document_number || undefined,
        pz_document_url: receipt.pz_document_url || undefined,
        total_movements: receipt.total_movements || 0,
        total_value: parseFloat(receipt.total_value?.toString() || "0"),
        created_at: receipt.created_at,
        completed_at: receipt.completed_at || undefined,
        received_by_user: receivedByUser
          ? {
              id: receivedByUser.id,
              email: receivedByUser.email,
              name:
                receivedByUser.first_name && receivedByUser.last_name
                  ? `${receivedByUser.first_name} ${receivedByUser.last_name}`
                  : receivedByUser.email.split("@")[0],
            }
          : undefined,
      };
    });
  } catch (error) {
    console.error("Error fetching delivery receipts:", error);
    return [];
  }
}
