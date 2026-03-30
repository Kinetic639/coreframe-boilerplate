import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

interface QrLabelRecord {
  id: string;
  qr_token: string;
  is_active: boolean;
  entity_type: "location" | "product" | string | null;
  entity_id: string | null;
  organization_id: string | null;
  branch_id: string | null;
}

interface QrScanLogInsert {
  qr_token: string;
  scan_type: string;
  scanner_type: string;
  scan_result: string;
  error_message?: string | null;
  redirect_path?: string | null;
  organization_id?: string | null;
  branch_id?: string | null;
  scan_context?: Record<string, unknown>;
}

interface QRRedirectPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function QRRedirectPage({ params }: QRRedirectPageProps) {
  const { token } = await params;

  // Create a public Supabase client (no auth required for QR lookups)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  ) as ReturnType<typeof createClient<any>>;

  try {
    // Look up the QR code token
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
      .single<QrLabelRecord>();

    if (error || !qrLabel) {
      // Log the scan attempt (even if failed)
      await supabase.from("qr_scan_logs").insert({
        qr_token: token,
        scan_type: "redirect",
        scanner_type: "manual",
        scan_result: "not_found",
        error_message: "QR token not found",
        redirect_path: null,
      } satisfies QrScanLogInsert);

      // Redirect to a "QR not found" page
      redirect("/qr/not-found");
    }

    // Determine the redirect path based on entity type
    let redirectPath: string;
    if (qrLabel.entity_type === "location" && qrLabel.entity_id) {
      redirectPath = "/dashboard/warehouse/locations";
    } else if (qrLabel.entity_type === "product" && qrLabel.entity_id) {
      redirectPath = "/dashboard/warehouse/items";
    } else {
      redirectPath = `/dashboard/warehouse/labels?token=${token}`;
    }

    // Log the successful scan attempt
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
    } satisfies QrScanLogInsert);

    // Redirect to the appropriate page
    // The auth middleware will handle checking if user is logged in
    // and redirect to login if needed with returnUrl
    redirect(redirectPath);
  } catch (error) {
    console.error("Error processing QR redirect:", error);

    // Log the error
    await supabase.from("qr_scan_logs").insert({
      qr_token: token,
      scan_type: "redirect",
      scanner_type: "manual",
      scan_result: "error",
      error_message: error instanceof Error ? error.message : "Unknown error",
      redirect_path: null,
    } satisfies QrScanLogInsert);

    // Redirect to error page
    redirect("/qr/error");
  }
}
