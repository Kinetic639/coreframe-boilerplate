import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";
import {
  QrLabelEntitySchema,
  QrScanLogSchema,
  QrTokenSchema,
  type QrEntityType,
  type QrLabelEntity,
} from "../schemas/qr";

export type QrLabel = Database["public"]["Tables"]["qr_labels"]["Row"];

export interface QrLookupResult {
  qrLabel?: QrLabel;
  entity?: QrLabelEntity;
  entityType?: QrEntityType;
  error?: "QR_NOT_FOUND" | "QR_UNASSIGNED" | "ENTITY_NOT_FOUND" | "GENERAL_ERROR";
}

export interface QrRedirectResult {
  redirectPath?: string;
  error?: "QR_NOT_FOUND" | "GENERAL_ERROR";
}

export class QrService {
  private static async getClient() {
    return createClient();
  }

  static async fetchLabelWithEntity(rawInput: { token: string }): Promise<QrLookupResult> {
    const { token } = QrTokenSchema.parse(rawInput);
    const supabase = await this.getClient();

    const { data: qrLabel, error: qrError } = await supabase
      .from("qr_labels")
      .select("*")
      .eq("qr_token", token)
      .eq("is_active", true)
      .single();

    if (qrError || !qrLabel) {
      return { error: "QR_NOT_FOUND" };
    }

    await this.logScan({
      token,
      scanType: "redirect",
      scannerType: "manual",
      scanResult: "success",
      organizationId: qrLabel.organization_id,
      branchId: qrLabel.branch_id,
    });

    if (!qrLabel.entity_id || !qrLabel.entity_type) {
      return { qrLabel, error: "QR_UNASSIGNED" };
    }

    const entityResult = await this.fetchEntity(
      qrLabel.entity_type as QrEntityType,
      qrLabel.entity_id
    );

    if (!entityResult) {
      return { qrLabel, error: "ENTITY_NOT_FOUND" };
    }

    const entity = QrLabelEntitySchema.parse(entityResult);

    return {
      qrLabel,
      entity,
      entityType: qrLabel.entity_type as QrEntityType,
    };
  }

  static async resolveRedirect(rawInput: {
    token: string;
    paths: {
      productTemplate: string;
      locationTemplate: string;
      assignPath: string;
    };
  }): Promise<QrRedirectResult> {
    const { token } = QrTokenSchema.parse(rawInput);
    const supabase = await this.getClient();

    try {
      const { data: qrLabel, error } = await supabase
        .from("qr_labels")
        .select(
          `
          *,
          entity_type,
          entity_id,
          organization_id,
          branch_id
        `
        )
        .eq("qr_token", token)
        .eq("is_active", true)
        .single();

      if (error || !qrLabel) {
        await supabase.from("qr_scan_logs").insert({
          qr_token: token,
          scan_type: "redirect",
          scanner_type: "manual",
          scan_result: "not_found",
          error_message: "QR token not found",
          redirect_path: null,
        });

        return { error: "QR_NOT_FOUND" };
      }

      let redirectPath: string;

      if (qrLabel.entity_type === "location" && qrLabel.entity_id) {
        redirectPath = rawInput.paths.locationTemplate.replace("[id]", qrLabel.entity_id);
      } else if (qrLabel.entity_type === "product" && qrLabel.entity_id) {
        redirectPath = rawInput.paths.productTemplate.replace("[id]", qrLabel.entity_id);
      } else {
        redirectPath = `${rawInput.paths.assignPath}?token=${token}`;
      }

      await supabase.from("qr_scan_logs").insert({
        qr_token: token,
        scan_type: "redirect",
        scanner_type: "manual",
        scan_result: "success",
        redirect_path: redirectPath,
        organization_id: qrLabel.organization_id,
        branch_id: qrLabel.branch_id,
        scan_context: {
          entity_type: qrLabel.entity_type,
          entity_id: qrLabel.entity_id,
          label_id: qrLabel.id,
        },
      });

      return { redirectPath };
    } catch (error) {
      await supabase.from("qr_scan_logs").insert({
        qr_token: token,
        scan_type: "redirect",
        scanner_type: "manual",
        scan_result: "error",
        error_message: error instanceof Error ? error.message : "Unknown error",
        redirect_path: null,
      });

      return { error: "GENERAL_ERROR" };
    }
  }

  private static async fetchEntity(type: QrEntityType, entityId: string) {
    const supabase = await this.getClient();

    if (type === "product") {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, description, code, sku")
        .eq("id", entityId)
        .single();

      if (error || !data) return null;

      return { ...data, code: data.code ?? data.sku } satisfies QrLabelEntity;
    }

    if (type === "location") {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name, description, code, level")
        .eq("id", entityId)
        .single();

      if (error || !data) return null;

      return data satisfies QrLabelEntity;
    }

    return null;
  }

  private static async logScan(rawInput: {
    token: string;
    scanType: "redirect" | "lookup";
    scannerType: "manual" | "link" | "app";
    scanResult: "success" | "failure";
    organizationId: string | null;
    branchId: string | null;
  }) {
    const payload = QrScanLogSchema.parse({
      token: rawInput.token,
      scanType: rawInput.scanType,
      scannerType: rawInput.scannerType,
      scanResult: rawInput.scanResult,
      organizationId: rawInput.organizationId,
      branchId: rawInput.branchId,
    });

    const supabase = await this.getClient();
    await supabase.from("qr_scan_logs").insert({
      qr_token: payload.token,
      scan_type: payload.scanType,
      scanner_type: payload.scannerType,
      scan_result: payload.scanResult,
      organization_id: payload.organizationId,
      branch_id: payload.branchId,
    });
  }
}
