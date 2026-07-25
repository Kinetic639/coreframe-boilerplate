import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanningCalendarSource } from "@/lib/types/planning-calendar";
import { NATIVE_CALENDAR_DEFAULT_COLOR } from "@/lib/constants/planning-calendar";
import { nativeCalendarSourceId } from "@/server/planning/calendar-source-registry";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface AppCalendarRow {
  id: string;
  organization_id: string;
  name: string;
  default_color: string;
  visibility: "private" | "organization";
  created_by: string;
}

export interface AppCalendarUserSettingRow {
  calendar_key: string;
  color: string | null;
  visible: boolean | null;
  position: number | null;
}

export interface AppCalendarEventRow {
  id: string;
  calendar_id: string;
  title: string;
  description: string | null;
  all_day: boolean;
  start_date: string | null;
  end_date: string | null;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
}

export interface CreateNativeCalendarInput {
  name: string;
  defaultColor?: string | null;
  visibility?: "private" | "organization";
}

export interface CalendarSourceSettingsInput {
  color?: string | null;
  visible?: boolean | null;
  position?: number | null;
}

export type NativeEventSchedule =
  | { allDay: true; startDate: string; endDate: string; timezone: string }
  | { allDay: false; startAt: string; endAt: string; timezone: string };

export interface NativeCalendarEventInput {
  calendarId: string;
  title: string;
  description?: string | null;
  schedule: NativeEventSchedule;
}

function nativeEventPayload(orgId: string, userId: string, input: NativeCalendarEventInput) {
  return {
    ...nativeEventSchedulePayload(userId, input.schedule),
    organization_id: orgId,
    calendar_id: input.calendarId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
  };
}

function nativeEventSchedulePayload(userId: string, schedule: NativeEventSchedule) {
  if (schedule.allDay === true) {
    return {
      all_day: true,
      start_date: schedule.startDate,
      end_date: schedule.endDate,
      start_at: null,
      end_at: null,
      timezone: schedule.timezone,
      updated_by: userId,
    };
  }

  return {
    all_day: false,
    start_date: null,
    end_date: null,
    start_at: schedule.startAt,
    end_at: schedule.endAt,
    timezone: schedule.timezone,
    updated_by: userId,
  };
}

export const AppCalendarService = {
  async listNativeCalendars(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<AppCalendarRow[]>> {
    const { data, error } = await supabase
      .from("app_calendars")
      .select("id, organization_id, name, default_color, visibility, created_by")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[AppCalendarService] Failed to list native calendars:", error);
      return { success: false, error: "Failed to load calendars" };
    }

    return { success: true, data: (data ?? []) as AppCalendarRow[] };
  },

  async listUserSettings(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    calendarKeys: string[]
  ): Promise<ServiceResult<Map<string, AppCalendarUserSettingRow>>> {
    if (calendarKeys.length === 0) return { success: true, data: new Map() };

    const { data, error } = await supabase
      .from("app_calendar_user_settings")
      .select("calendar_key, color, visible, position")
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .in("calendar_key", calendarKeys);

    if (error) {
      console.error("[AppCalendarService] Failed to list user calendar settings:", error);
      return { success: false, error: "Failed to load calendar settings" };
    }

    const settings = new Map<string, AppCalendarUserSettingRow>();
    for (const row of (data ?? []) as AppCalendarUserSettingRow[]) {
      settings.set(row.calendar_key, row);
    }

    return { success: true, data: settings };
  },

  mergeUserSettings(
    sources: PlanningCalendarSource[],
    settings: Map<string, AppCalendarUserSettingRow>
  ): PlanningCalendarSource[] {
    return sources
      .map((source) => {
        const setting = settings.get(source.key);
        return {
          ...source,
          color: setting?.color ?? source.defaultColor,
          visible: setting?.visible ?? true,
          position: setting?.position ?? source.position ?? null,
        };
      })
      .sort((a, b) => {
        const aPosition = a.position ?? Number.MAX_SAFE_INTEGER;
        const bPosition = b.position ?? Number.MAX_SAFE_INTEGER;
        if (aPosition !== bPosition) return aPosition - bPosition;
        return a.label.localeCompare(b.label);
      });
  },

  nativeCalendarToSource(calendar: AppCalendarRow, category: PlanningCalendarSource["category"]) {
    const key = nativeCalendarSourceId(calendar.id);
    return {
      id: key,
      key,
      label: calendar.name,
      category,
      module: "calendar" as const,
      kind: "native" as const,
      color: calendar.default_color ?? NATIVE_CALENDAR_DEFAULT_COLOR,
      defaultColor: calendar.default_color ?? NATIVE_CALENDAR_DEFAULT_COLOR,
      visible: true,
      position: null,
      sourceType: "native_calendar" as const,
      sourceId: calendar.id,
    } satisfies PlanningCalendarSource;
  },

  async listEventsForCalendar(
    supabase: SupabaseClient,
    orgId: string,
    calendarIds: string[],
    input: { rangeStart: string; rangeEnd: string; rangeStartIso: string; rangeEndIso: string }
  ): Promise<ServiceResult<AppCalendarEventRow[]>> {
    if (calendarIds.length === 0) return { success: true, data: [] };

    const { data, error } = await supabase
      .from("app_calendar_events")
      .select(
        "id, calendar_id, title, description, all_day, start_date, end_date, start_at, end_at, timezone"
      )
      .eq("organization_id", orgId)
      .in("calendar_id", calendarIds)
      .is("deleted_at", null)
      .or(
        [
          `and(all_day.eq.true,start_date.lte.${input.rangeEnd},end_date.gte.${input.rangeStart})`,
          `and(all_day.eq.false,start_at.lte.${input.rangeEndIso},end_at.gte.${input.rangeStartIso})`,
        ].join(",")
      )
      .order("start_date", { ascending: true, nullsFirst: false })
      .order("start_at", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("[AppCalendarService] Failed to list native events:", error);
      return { success: false, error: "Failed to load native events" };
    }

    return { success: true, data: (data ?? []) as AppCalendarEventRow[] };
  },

  async createNativeCalendar(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateNativeCalendarInput
  ): Promise<ServiceResult<AppCalendarRow>> {
    const { data, error } = await supabase
      .from("app_calendars")
      .insert({
        organization_id: orgId,
        name: input.name.trim(),
        default_color: input.defaultColor ?? NATIVE_CALENDAR_DEFAULT_COLOR,
        visibility: input.visibility ?? "private",
        created_by: userId,
        updated_by: userId,
      })
      .select("id, organization_id, name, default_color, visibility, created_by")
      .single();

    if (error) {
      console.error("[AppCalendarService] Failed to create native calendar:", error);
      return { success: false, error: "Failed to create calendar" };
    }

    return { success: true, data: data as AppCalendarRow };
  },

  async softDeleteNativeCalendar(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    calendarId: string
  ): Promise<ServiceResult<void>> {
    const deletedAt = new Date().toISOString();
    const { error } = await supabase
      .from("app_calendars")
      .update({ deleted_at: deletedAt, updated_by: userId })
      .eq("organization_id", orgId)
      .eq("id", calendarId)
      .is("deleted_at", null);

    if (error) {
      console.error("[AppCalendarService] Failed to delete native calendar:", error);
      return { success: false, error: "Failed to delete calendar" };
    }

    await supabase
      .from("app_calendar_events")
      .update({ deleted_at: deletedAt, updated_by: userId })
      .eq("organization_id", orgId)
      .eq("calendar_id", calendarId)
      .is("deleted_at", null);

    return { success: true, data: undefined };
  },

  async createNativeEvent(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: NativeCalendarEventInput
  ): Promise<ServiceResult<AppCalendarEventRow>> {
    const payload = {
      ...nativeEventPayload(orgId, userId, input),
      created_by: userId,
    };

    const { data, error } = await supabase
      .from("app_calendar_events")
      .insert(payload)
      .select(
        "id, calendar_id, title, description, all_day, start_date, end_date, start_at, end_at, timezone"
      )
      .single();

    if (error) {
      console.error("[AppCalendarService] Failed to create native event:", error);
      return { success: false, error: "Failed to create calendar event" };
    }

    return { success: true, data: data as AppCalendarEventRow };
  },

  async updateNativeEvent(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    eventId: string,
    input: NativeCalendarEventInput
  ): Promise<ServiceResult<AppCalendarEventRow>> {
    const { data, error } = await supabase
      .from("app_calendar_events")
      .update(nativeEventPayload(orgId, userId, input))
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .eq("calendar_id", input.calendarId)
      .is("deleted_at", null)
      .select(
        "id, calendar_id, title, description, all_day, start_date, end_date, start_at, end_at, timezone"
      )
      .single();

    if (error) {
      console.error("[AppCalendarService] Failed to update native event:", error);
      return { success: false, error: "Failed to update calendar event" };
    }

    return { success: true, data: data as AppCalendarEventRow };
  },

  async updateNativeEventSchedule(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    eventId: string,
    calendarId: string,
    schedule: NativeEventSchedule
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("app_calendar_events")
      .update(nativeEventSchedulePayload(userId, schedule))
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .eq("calendar_id", calendarId)
      .is("deleted_at", null);

    if (error) {
      console.error("[AppCalendarService] Failed to update native event schedule:", error);
      return { success: false, error: "Failed to update calendar event" };
    }

    return { success: true, data: undefined };
  },

  async softDeleteNativeEvent(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    eventId: string,
    calendarId: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("app_calendar_events")
      .update({ deleted_at: new Date().toISOString(), updated_by: userId })
      .eq("id", eventId)
      .eq("organization_id", orgId)
      .eq("calendar_id", calendarId)
      .is("deleted_at", null);

    if (error) {
      console.error("[AppCalendarService] Failed to delete native event:", error);
      return { success: false, error: "Failed to delete calendar event" };
    }

    return { success: true, data: undefined };
  },

  async upsertUserSettings(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    calendarKey: string,
    input: CalendarSourceSettingsInput
  ): Promise<ServiceResult<void>> {
    const payload = {
      organization_id: orgId,
      user_id: userId,
      calendar_key: calendarKey,
      ...(input.color !== undefined ? { color: input.color } : {}),
      ...(input.visible !== undefined ? { visible: input.visible } : {}),
      ...(input.position !== undefined ? { position: input.position } : {}),
    };

    const { error } = await supabase
      .from("app_calendar_user_settings")
      .upsert(payload, { onConflict: "organization_id,user_id,calendar_key" });

    if (error) {
      console.error("[AppCalendarService] Failed to upsert calendar setting:", error);
      return { success: false, error: "Failed to update calendar settings" };
    }

    return { success: true, data: undefined };
  },

  async resetUserColor(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    calendarKey: string
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("app_calendar_user_settings")
      .update({ color: null })
      .eq("organization_id", orgId)
      .eq("user_id", userId)
      .eq("calendar_key", calendarKey);

    if (error) {
      console.error("[AppCalendarService] Failed to reset calendar color:", error);
      return { success: false, error: "Failed to reset calendar color" };
    }

    return { success: true, data: undefined };
  },
};
