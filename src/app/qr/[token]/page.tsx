import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/lib/types/database";
import { routing } from "@/i18n/routing";

interface QRRedirectPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function QRRedirectPage({ params }: QRRedirectPageProps) {
  const { token } = await params;

  // Create a public Supabase client (no auth required for QR lookups)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

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
      .single();

    if (error || !qrLabel) {
      // Log the scan attempt (even if failed)
      await supabase.from("qr_scan_logs").insert({
        qr_token: token,
        scan_type: "redirect",
        scanner_type: "manual",
        scan_result: "not_found",
        error_message: "QR token not found",
        redirect_path: null,
      });

      // Redirect to a "QR not found" page
      redirect("/qr/not-found");
    }

    // Determine the redirect path based on entity type
    let redirectPath: string;
    const defaultLocale = routing.defaultLocale;

    if (qrLabel.entity_type === "location" && qrLabel.entity_id) {
      // Use localized path for locations
      const localizedPath = routing.pathnames["/dashboard/warehouse/locations/[id]"];
      const pathTemplate =
        typeof localizedPath === "string"
          ? localizedPath
          : localizedPath[defaultLocale as keyof typeof localizedPath];
      redirectPath = pathTemplate.replace("[id]", qrLabel.entity_id);
    } else if (qrLabel.entity_type === "product" && qrLabel.entity_id) {
      // Use localized path for products
      const localizedPath = routing.pathnames["/dashboard/warehouse/products/[id]"];
      const pathTemplate =
        typeof localizedPath === "string"
          ? localizedPath
          : localizedPath[defaultLocale as keyof typeof localizedPath];
      redirectPath = pathTemplate.replace("[id]", qrLabel.entity_id);
    } else {
      // Unassigned QR code - redirect to assignment interface
      const localizedPath = routing.pathnames["/dashboard/warehouse/labels/assign"];
      const pathTemplate =
        typeof localizedPath === "string"
          ? localizedPath
          : localizedPath[defaultLocale as keyof typeof localizedPath];
      redirectPath = `${pathTemplate}?token=${token}`;
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
    });

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
    });

    // Redirect to error page
    redirect("/qr/error");
  }
}
