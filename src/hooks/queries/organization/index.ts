"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

import {
  getOrgProfileAction,
  updateOrgProfileAction,
  uploadOrgLogoAction,
} from "@/app/actions/organization/profile";
import {
  listMembersAction,
  updateMemberStatusAction,
  removeMemberAction,
} from "@/app/actions/organization/members";
import {
  listInvitationsAction,
  createInvitationAction,
  cancelInvitationAction,
  resendInvitationAction,
} from "@/app/actions/organization/invitations";
import {
  listRolesAction,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
  assignRoleToUserAction,
  removeRoleFromUserAction,
  getMemberAccessAction,
} from "@/app/actions/organization/roles";
import {
  listPositionsAction,
  listPositionAssignmentsAction,
  createPositionAction,
  updatePositionAction,
  deletePositionAction,
  assignPositionAction,
  removePositionAssignmentAction,
} from "@/app/actions/organization/positions";
import {
  listBranchesAction,
  createBranchAction,
  updateBranchAction,
  deleteBranchAction,
} from "@/app/actions/organization/branches";
import type {
  OrgProfileData,
  OrgMember,
  OrgInvitation,
  OrgRole,
  OrgPosition,
  OrgPositionAssignment,
  OrgBranch,
  OrgMemberAccess,
  UpdateOrgProfileInput,
} from "@/server/services/organization.service";

// ─── Discriminated result helper ──────────────────────────────────────────────
// Narrowing happens inside the helper where `result` is typed as a parameter,
// which TypeScript handles reliably regardless of async context or as-casts.

type SR<T> = { success: true; data: T } | { success: false; error: string };

function unwrapSR<T>(result: SR<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new Error((result as { error: string }).error);
}

// ─── Query Key Factory ─────────────────────────────────────────────────────────

export const organizationKeys = {
  all: ["organization"] as const,
  profile: () => [...organizationKeys.all, "profile"] as const,
  members: () => [...organizationKeys.all, "members"] as const,
  memberAccess: (userId: string) => [...organizationKeys.all, "member-access", userId] as const,
  invitations: () => [...organizationKeys.all, "invitations"] as const,
  roles: () => [...organizationKeys.all, "roles"] as const,
  positions: () => [...organizationKeys.all, "positions"] as const,
  assignments: () => [...organizationKeys.all, "assignments"] as const,
  branches: () => [...organizationKeys.all, "branches"] as const,
};

// ─── Profile ──────────────────────────────────────────────────────────────────

export function useOrgProfileQuery(initialProfile: OrgProfileData | null) {
  return useQuery({
    queryKey: organizationKeys.profile(),
    queryFn: async () => unwrapSR((await getOrgProfileAction()) as SR<OrgProfileData>),
    initialData: initialProfile ?? undefined,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateOrgProfileMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateOrgProfileInput) =>
      unwrapSR((await updateOrgProfileAction(input)) as SR<OrgProfileData>),
    onSuccess: (data) => {
      queryClient.setQueryData(organizationKeys.profile(), data);
      toast.success("Profile updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update profile");
    },
  });
}

export function useUploadOrgLogoMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (formData: FormData) =>
      unwrapSR((await uploadOrgLogoAction(formData)) as SR<string>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.profile() });
      toast.success("Logo updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload logo");
    },
  });
}

// ─── Members ──────────────────────────────────────────────────────────────────

export function useMembersQuery(initialMembers: OrgMember[]) {
  return useQuery({
    queryKey: organizationKeys.members(),
    queryFn: async () => unwrapSR((await listMembersAction()) as SR<OrgMember[]>),
    initialData: initialMembers,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUpdateMemberStatusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; status: "active" | "inactive" }) => {
      unwrapSR((await updateMemberStatusAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members() });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update member status");
    },
  });
}

export function useRemoveMemberMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string }) => {
      unwrapSR((await removeMemberAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members() });
      toast.success("Member removed");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove member");
    },
  });
}

// ─── Invitations ──────────────────────────────────────────────────────────────

export function useInvitationsQuery(initialInvitations: OrgInvitation[]) {
  return useQuery({
    queryKey: organizationKeys.invitations(),
    queryFn: async () => unwrapSR((await listInvitationsAction()) as SR<OrgInvitation[]>),
    initialData: initialInvitations,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { email: string; role_id?: string; branch_id?: string }) =>
      unwrapSR((await createInvitationAction(input)) as SR<OrgInvitation>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() });
      toast.success("Invitation sent");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to send invitation");
    },
  });
}

export function useCancelInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      unwrapSR((await cancelInvitationAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() });
      toast.success("Invitation cancelled");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to cancel invitation");
    },
  });
}

export function useResendInvitationMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { invitationId: string }) => {
      unwrapSR((await resendInvitationAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.invitations() });
      toast.success("Invitation resent");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to resend invitation");
    },
  });
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export function useRolesQuery(initialRoles: OrgRole[]) {
  return useQuery({
    queryKey: organizationKeys.roles(),
    queryFn: async () => unwrapSR((await listRolesAction()) as SR<OrgRole[]>),
    initialData: initialRoles,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string | null;
      permission_slugs?: string[];
      scope_type?: "org" | "branch";
    }) => unwrapSR((await createRoleAction(input)) as SR<OrgRole>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles() });
      toast.success("Role created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create role");
    },
  });
}

export function useUpdateRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      roleId: string;
      name?: string;
      description?: string | null;
      permission_slugs?: string[];
    }) => {
      unwrapSR((await updateRoleAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles() });
      toast.success("Role updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update role");
    },
  });
}

export function useDeleteRoleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { roleId: string }) => {
      unwrapSR((await deleteRoleAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.roles() });
      toast.success("Role deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete role");
    },
  });
}

export function useAssignRoleToUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      roleId: string;
      scope?: "org" | "branch";
      scopeId?: string;
    }) => {
      unwrapSR((await assignRoleToUserAction(input)) as SR<void>);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members() });
      // Invalidate the member-detail access cache so the UI reflects the new assignment
      queryClient.invalidateQueries({
        queryKey: organizationKeys.memberAccess(variables.userId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to assign role");
    },
  });
}

export function useRemoveRoleFromUserMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      roleId: string;
      scope?: "org" | "branch";
      scopeId?: string;
    }) => {
      unwrapSR((await removeRoleFromUserAction(input)) as SR<void>);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.members() });
      // Invalidate the member-detail access cache so the UI reflects the removal
      queryClient.invalidateQueries({
        queryKey: organizationKeys.memberAccess(variables.userId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove role");
    },
  });
}

// ─── Positions ────────────────────────────────────────────────────────────────

export function usePositionsQuery(initialPositions: OrgPosition[]) {
  return useQuery({
    queryKey: organizationKeys.positions(),
    queryFn: async () => unwrapSR((await listPositionsAction()) as SR<OrgPosition[]>),
    initialData: initialPositions,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useAssignmentsQuery(initialAssignments: OrgPositionAssignment[]) {
  return useQuery({
    queryKey: organizationKeys.assignments(),
    queryFn: async () =>
      unwrapSR((await listPositionAssignmentsAction()) as SR<OrgPositionAssignment[]>),
    initialData: initialAssignments,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreatePositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; description?: string | null }) =>
      unwrapSR((await createPositionAction(input)) as SR<OrgPosition>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.positions() });
      toast.success("Position created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create position");
    },
  });
}

export function useUpdatePositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      positionId: string;
      name?: string;
      description?: string | null;
    }) => {
      unwrapSR((await updatePositionAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.positions() });
      toast.success("Position updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update position");
    },
  });
}

export function useDeletePositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { positionId: string }) => {
      unwrapSR((await deletePositionAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.positions() });
      toast.success("Position deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete position");
    },
  });
}

export function useAssignPositionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { userId: string; positionId: string; branch_id?: string }) => {
      unwrapSR((await assignPositionAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.assignments() });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to assign position");
    },
  });
}

export function useRemovePositionAssignmentMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { assignmentId: string }) => {
      unwrapSR((await removePositionAssignmentAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.assignments() });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to remove position assignment");
    },
  });
}

// ─── Branches ─────────────────────────────────────────────────────────────────

export function useBranchesQuery(initialBranches: OrgBranch[]) {
  return useQuery({
    queryKey: organizationKeys.branches(),
    queryFn: async () => unwrapSR((await listBranchesAction()) as SR<OrgBranch[]>),
    initialData: initialBranches,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { name: string; slug?: string | null }) =>
      unwrapSR((await createBranchAction(input)) as SR<OrgBranch>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      toast.success("Branch created");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to create branch");
    },
  });
}

export function useUpdateBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { branchId: string; name?: string; slug?: string | null }) =>
      unwrapSR((await updateBranchAction(input)) as SR<OrgBranch>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      toast.success("Branch updated");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update branch");
    },
  });
}

export function useDeleteBranchMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { branchId: string }) => {
      unwrapSR((await deleteBranchAction(input)) as SR<void>);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: organizationKeys.branches() });
      toast.success("Branch deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete branch");
    },
  });
}

// ─── Member Access ─────────────────────────────────────────────────────────────

export function useMemberAccessQuery(userId: string, initialData: OrgMemberAccess | null = null) {
  return useQuery({
    queryKey: organizationKeys.memberAccess(userId),
    queryFn: async () => unwrapSR((await getMemberAccessAction(userId)) as SR<OrgMemberAccess>),
    initialData: initialData ?? undefined,
    staleTime: 2 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
