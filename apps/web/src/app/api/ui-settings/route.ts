import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { syncUiSettingsSchema } from "@/lib/validations/user-preferences";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  Pragma: "no-cache",
};

/**
 * Parse request body as JSON, handling both application/json and text/plain.
 * text/plain is used by sendBeacon() for future auto-sync compatibility.
 */
async function readBodyAsJson(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return request.json();
  }
  // Handle text/plain (sendBeacon sends as text/plain with Blob)
  const text = await request.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

/**
 * POST /api/ui-settings
 *
 * Saves UI settings to the database (manual Save to cloud).
 * Returns server-generated timestamp and revision for conflict resolution.
 *
 * @returns { success: true, serverUpdatedAt: string, revision: number }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const raw = await readBodyAsJson(request);
    const parseResult = syncUiSettingsSchema.safeParse(raw);

    if (!parseResult.success) {
      return NextResponse.json(
        { success: false, error: "Invalid payload", details: parseResult.error.flatten() },
        { status: 400, headers: NO_STORE_HEADERS }
      );
    }

    const validated = parseResult.data;

    // Ensure user has preferences record
    await UserPreferencesService.getOrCreatePreferences(supabase, user.id);

    const prefs = await UserPreferencesService.syncUiSettings(supabase, user.id, validated);

    // Return server-generated values for client reconciliation
    const serverUpdatedAt = prefs.dashboardSettings?.updated_at ?? new Date().toISOString();
    // Revision is future-ready - for now we use 0 as placeholder
    // When auto-sync is added, this will be a monotonic counter from the database
    const revision = 0;

    return NextResponse.json(
      { success: true, serverUpdatedAt, revision },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[POST /api/ui-settings] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Sync failed" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}

/**
 * GET /api/ui-settings
 *
 * Fetches UI settings from the database (manual Load from cloud).
 * Returns UI settings with server timestamp for display.
 *
 * @returns { success: true, data: { ui, serverUpdatedAt, revision } }
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401, headers: NO_STORE_HEADERS }
      );
    }

    const settings = await UserPreferencesService.getDashboardSettings(supabase, user.id);

    // If no settings exist, return empty data
    if (!settings) {
      return NextResponse.json(
        {
          success: true,
          data: {
            ui: null,
            serverUpdatedAt: null,
            revision: 0,
          },
        },
        { status: 200, headers: NO_STORE_HEADERS }
      );
    }

    return NextResponse.json(
      {
        success: true,
        data: {
          ui: settings.ui ?? null,
          serverUpdatedAt: settings.updated_at ?? null,
          revision: 0, // Future-ready placeholder
        },
      },
      { status: 200, headers: NO_STORE_HEADERS }
    );
  } catch (error) {
    console.error("[GET /api/ui-settings] Failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch UI settings" },
      { status: 500, headers: NO_STORE_HEADERS }
    );
  }
}
