import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_READ,
  PLANNING_TASKS_CREATE,
  PLANNING_TASKS_ASSIGN,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgMembersService } from "@/server/services/organization.service";
import { PlanningSettingsService } from "@/server/services/planning-settings.service";
import { UserPreferencesService } from "@/server/services/user-preferences.service";
import { PlanningCalendarClient } from "./_components/planning-calendar-client";

export default async function PlanningOverviewPage() {
  const locale = await getLocale();
  const context = await loadDashboardContextV2();

  if (!context?.app.activeOrgId) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.user.permissionSnapshot, PLANNING_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "planning_read_required" },
      },
      locale,
    });
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const userId = context.user.user?.id ?? "";
  const snap = context.user.permissionSnapshot;

  const [membersResult, settingsResult, preferences] = await Promise.all([
    OrgMembersService.listMembers(supabase, orgId),
    PlanningSettingsService.getSettings(supabase, orgId),
    UserPreferencesService.getOrCreatePreferences(supabase, userId),
  ]);

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
      }))
    : [];

  const calendarSettings = preferences.moduleSettings.calendar as
    | { visibleSources?: Record<string, boolean> }
    | undefined;

  return (
    <PlanningCalendarClient
      members={members}
      currentUserId={userId}
      canAssign={checkPermission(snap, PLANNING_TASKS_ASSIGN)}
      canCreateTasks={checkPermission(snap, PLANNING_TASKS_CREATE)}
      priorityConfigs={settingsResult.success ? settingsResult.data.priority_configs : null}
      initialVisibleSources={calendarSettings?.visibleSources ?? {}}
    />
  );
}
