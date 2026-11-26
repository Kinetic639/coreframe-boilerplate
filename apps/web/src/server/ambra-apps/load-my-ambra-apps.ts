import "server-only";
import { cache } from "react";
import { AMBRA_WORK_APPS, type AmbraWorkApp, isAmbraWorkApp } from "@repo/app-urls";
import { createClient } from "@/utils/supabase/server";

export type MyAmbraApps =
  /** The rule ran: `apps` is exactly what this user may open, in display order. */
  | { ok: true; apps: AmbraWorkApp[] }
  /** The rule could not run (e.g. the database is behind this code): callers fail open. */
  | { ok: false; apps: AmbraWorkApp[] };

/**
 * The Ambra apps the signed-in user may open in their organization (plan module
 * AND permission), from the one rule `get_my_ambra_apps`. A user belongs to one
 * organization, so rows of any other are ignored when `organizationId` is given.
 */
export const loadMyAmbraApps = cache(
  async (organizationId?: string | null): Promise<MyAmbraApps> => {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_ambra_apps");
    if (error || !Array.isArray(data)) {
      if (error) console.error("[loadMyAmbraApps] get_my_ambra_apps failed:", error.message);
      return { ok: false, apps: [] };
    }

    const found = new Set<AmbraWorkApp>();
    for (const row of data as { organization_id: string; app: string }[]) {
      if (organizationId && row.organization_id !== organizationId) continue;
      if (isAmbraWorkApp(row.app)) found.add(row.app);
    }
    return { ok: true, apps: AMBRA_WORK_APPS.filter((app) => found.has(app)) };
  }
);
