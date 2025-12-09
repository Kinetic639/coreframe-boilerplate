"use server";

import { createClient } from "@/utils/supabase/server";
import { OptionGroupsService } from "@/server/services/option-groups.service";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import type {
  CreateOptionGroupInput,
  UpdateOptionGroupInput,
} from "@/server/schemas/option-groups.schema";

type ActionResponse<T = unknown> = { success: true; data: T } | { success: false; error: string };

export async function getOptionGroups(): Promise<
  ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.getOptionGroups>>>
> {
  try {
    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const supabase = await createClient();
    const groups = await OptionGroupsService.getOptionGroups(supabase, appContext.activeOrgId);

    return { success: true, data: groups };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch option groups",
    };
  }
}

export async function getOptionGroup(
  groupId: string
): Promise<ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.getOptionGroup>>>> {
  try {
    const supabase = await createClient();
    const group = await OptionGroupsService.getOptionGroup(supabase, groupId);

    return { success: true, data: group };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch option group",
    };
  }
}

export async function createOptionGroup(
  input: CreateOptionGroupInput
): Promise<ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.createOptionGroup>>>> {
  try {
    const appContext = await loadAppContextServer();
    if (!appContext?.activeOrgId) {
      return { success: false, error: "No active organization" };
    }

    const supabase = await createClient();
    const newGroup = await OptionGroupsService.createOptionGroup(supabase, {
      ...input,
      organization_id: appContext.activeOrgId,
    });

    return { success: true, data: newGroup };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create option group",
    };
  }
}

export async function updateOptionGroup(
  input: UpdateOptionGroupInput
): Promise<ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.updateOptionGroup>>>> {
  try {
    const supabase = await createClient();
    const updatedGroup = await OptionGroupsService.updateOptionGroup(supabase, input);

    return { success: true, data: updatedGroup };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update option group",
    };
  }
}

export async function deleteOptionGroup(groupId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient();
    await OptionGroupsService.deleteOptionGroup(supabase, groupId);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete option group",
    };
  }
}

export async function createOptionValue(input: {
  option_group_id: string;
  value: string;
  display_order: number;
}): Promise<ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.createOptionValue>>>> {
  try {
    const supabase = await createClient();
    const newValue = await OptionGroupsService.createOptionValue(supabase, input);

    return { success: true, data: newValue };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create option value",
    };
  }
}

export async function updateOptionValue(input: {
  id: string;
  value: string;
}): Promise<ActionResponse<Awaited<ReturnType<typeof OptionGroupsService.updateOptionValue>>>> {
  try {
    const supabase = await createClient();
    const updatedValue = await OptionGroupsService.updateOptionValue(supabase, input);

    return { success: true, data: updatedValue };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to update option value",
    };
  }
}

export async function deleteOptionValue(valueId: string): Promise<ActionResponse<void>> {
  try {
    const supabase = await createClient();
    await OptionGroupsService.deleteOptionValue(supabase, valueId);

    return { success: true, data: undefined };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to delete option value",
    };
  }
}
