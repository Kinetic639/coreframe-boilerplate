/**
 * Tests: hooks/queries/organization/index.ts
 *
 * Covers all query and mutation hooks for organization management.
 * Uses renderHook with QueryClientProvider + mocked server actions.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { toast } from "react-toastify";

// ─── Mock server actions ───────────────────────────────────────────────────────

vi.mock("@/app/actions/organization/profile", () => ({
  getOrgProfileAction: vi.fn(),
  updateOrgProfileAction: vi.fn(),
  uploadOrgLogoAction: vi.fn(),
  removeOrgLogoAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/members", () => ({
  listMembersAction: vi.fn(),
  updateMemberStatusAction: vi.fn(),
  removeMemberAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/invitations", () => ({
  listInvitationsAction: vi.fn(),
  createInvitationAction: vi.fn(),
  cancelInvitationAction: vi.fn(),
  resendInvitationAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/roles", () => ({
  listRolesAction: vi.fn(),
  createRoleAction: vi.fn(),
  updateRoleAction: vi.fn(),
  deleteRoleAction: vi.fn(),
  assignRoleToUserAction: vi.fn(),
  removeRoleFromUserAction: vi.fn(),
  getMemberAccessAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/positions", () => ({
  listPositionsAction: vi.fn(),
  listPositionAssignmentsAction: vi.fn(),
  createPositionAction: vi.fn(),
  updatePositionAction: vi.fn(),
  deletePositionAction: vi.fn(),
  assignPositionAction: vi.fn(),
  removePositionAssignmentAction: vi.fn(),
}));

vi.mock("@/app/actions/organization/branches", () => ({
  listBranchesAction: vi.fn(),
  createBranchAction: vi.fn(),
  updateBranchAction: vi.fn(),
  deleteBranchAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  },
}));

// Mock supabase client for realtime hooks
const { mockChannel, mockSupabase } = vi.hoisted(() => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  const mockSupabase = {
    channel: vi.fn().mockReturnValue(mockChannel),
    removeChannel: vi.fn(),
  };
  return { mockChannel, mockSupabase };
});

vi.mock("@/utils/supabase/client", () => ({
  createClient: vi.fn().mockReturnValue(mockSupabase),
}));

import {
  getOrgProfileAction,
  updateOrgProfileAction,
  uploadOrgLogoAction,
  removeOrgLogoAction,
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

import {
  useOrgProfileQuery,
  useUpdateOrgProfileMutation,
  useUploadOrgLogoMutation,
  useRemoveOrgLogoMutation,
  useMembersQuery,
  useUpdateMemberStatusMutation,
  useRemoveMemberMutation,
  useInvitationsQuery,
  useCreateInvitationMutation,
  useCancelInvitationMutation,
  useResendInvitationMutation,
  useInvitationsRealtimeSync,
  useMembersRealtimeSync,
  useRolesQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
  useAssignRoleToUserMutation,
  useRemoveRoleFromUserMutation,
  usePositionsQuery,
  useAssignmentsQuery,
  useCreatePositionMutation,
  useUpdatePositionMutation,
  useDeletePositionMutation,
  useAssignPositionMutation,
  useRemovePositionAssignmentMutation,
  useBranchesQuery,
  useCreateBranchMutation,
  useUpdateBranchMutation,
  useDeleteBranchMutation,
  useMemberAccessQuery,
  organizationKeys,
} from "../index";

// ─── Wrapper ───────────────────────────────────────────────────────────────────

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

// ─── organizationKeys ─────────────────────────────────────────────────────────

describe("organizationKeys", () => {
  it("profile key contains organization", () => {
    expect(organizationKeys.profile()).toContain("organization");
    expect(organizationKeys.profile()).toContain("profile");
  });
  it("memberAccess key contains userId", () => {
    const key = organizationKeys.memberAccess("user-abc");
    expect(key).toContain("user-abc");
  });
  it("all keys start with organization", () => {
    expect(organizationKeys.all[0]).toBe("organization");
  });
});

// ─── Profile Queries ──────────────────────────────────────────────────────────

describe("useOrgProfileQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns initialData immediately", () => {
    const { wrapper } = makeWrapper();
    const initialProfile = { id: "org-1", name: "Test Org" } as never;
    const { result } = renderHook(() => useOrgProfileQuery(initialProfile), { wrapper });
    expect(result.current.data).toEqual(initialProfile);
  });

  it("returns undefined data when initialProfile is null", async () => {
    vi.mocked(getOrgProfileAction).mockResolvedValue({
      success: true,
      data: { id: "org-1", name: "From Server" },
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgProfileQuery(null), { wrapper });
    // initialData is undefined — query will fetch
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "org-1", name: "From Server" });
  });

  it("throws when action returns error", async () => {
    vi.mocked(getOrgProfileAction).mockResolvedValue({
      success: false,
      error: "Unauthorized",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useOrgProfileQuery(null), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });
});

describe("useUpdateOrgProfileMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls action and toasts on success", async () => {
    const updatedProfile = { id: "org-1", name: "Updated" };
    vi.mocked(updateOrgProfileAction).mockResolvedValue({
      success: true,
      data: updatedProfile,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateOrgProfileMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Updated" } as never);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Profile updated");
  });

  it("toasts error on failure", async () => {
    vi.mocked(updateOrgProfileAction).mockResolvedValue({
      success: false,
      error: "Forbidden",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateOrgProfileMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Bad" } as never);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Forbidden");
  });
});

describe("useUploadOrgLogoMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls action and toasts on success", async () => {
    vi.mocked(uploadOrgLogoAction).mockResolvedValue({ success: true, data: "/logo.png" } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUploadOrgLogoMutation(), { wrapper });
    const fd = new FormData();
    await act(async () => {
      result.current.mutate(fd);
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Logo updated");
  });

  it("toasts error on failure", async () => {
    vi.mocked(uploadOrgLogoAction).mockResolvedValue({
      success: false,
      error: "File too large",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUploadOrgLogoMutation(), { wrapper });
    await act(async () => {
      result.current.mutate(new FormData());
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("File too large");
  });
});

describe("useRemoveOrgLogoMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on removal", async () => {
    vi.mocked(removeOrgLogoAction).mockResolvedValue({ success: true, data: {} } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveOrgLogoMutation(), { wrapper });
    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Logo removed");
  });

  it("toasts error on failure", async () => {
    vi.mocked(removeOrgLogoAction).mockResolvedValue({
      success: false,
      error: "Cannot remove logo",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveOrgLogoMutation(), { wrapper });
    await act(async () => {
      result.current.mutate();
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Cannot remove logo");
  });
});

// ─── Members ──────────────────────────────────────────────────────────────────

describe("useMembersQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns initialData immediately", () => {
    const { wrapper } = makeWrapper();
    const members = [{ id: "m-1", name: "Alice" }] as never;
    const { result } = renderHook(() => useMembersQuery(members), { wrapper });
    expect(result.current.data).toEqual(members);
  });
});

describe("useUpdateMemberStatusMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds and invalidates query", async () => {
    vi.mocked(updateMemberStatusAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateMemberStatusMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", status: "active" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("toasts error on failure", async () => {
    vi.mocked(updateMemberStatusAction).mockResolvedValue({
      success: false,
      error: "Not allowed",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateMemberStatusMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", status: "inactive" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not allowed");
  });
});

describe("useRemoveMemberMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on removal", async () => {
    vi.mocked(removeMemberAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveMemberMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Member removed");
  });

  it("toasts error on failure", async () => {
    vi.mocked(removeMemberAction).mockResolvedValue({
      success: false,
      error: "Cannot remove",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveMemberMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Cannot remove");
  });
});

// ─── Invitations ──────────────────────────────────────────────────────────────

describe("useInvitationsQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns initialData", () => {
    const { wrapper } = makeWrapper();
    const invitations = [{ id: "inv-1", email: "a@b.com" }] as never;
    const { result } = renderHook(() => useInvitationsQuery(invitations), { wrapper });
    expect(result.current.data).toEqual(invitations);
  });
});

describe("useCreateInvitationMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success.inviteSentSuccess when emailDelivered=true", async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: true,
      data: { id: "inv-1" },
      emailDelivered: true,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ email: "user@example.com" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    // next-intl mock returns the key itself
    expect(toast.success).toHaveBeenCalledWith("inviteSentSuccess");
  });

  it("toasts warning when emailDelivered=false", async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: true,
      data: { id: "inv-1" },
      emailDelivered: false,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ email: "user@example.com" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.warning).toHaveBeenCalledWith("emailDeliveryWarning");
  });

  it("throws on action error", async () => {
    vi.mocked(createInvitationAction).mockResolvedValue({
      success: false,
      error: "Already a member",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ email: "existing@example.com" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Already a member");
  });
});

describe("useCancelInvitationMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on cancel", async () => {
    vi.mocked(cancelInvitationAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ invitationId: "inv-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Invitation cancelled");
  });

  it("toasts error on failure", async () => {
    vi.mocked(cancelInvitationAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCancelInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ invitationId: "inv-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

describe("useResendInvitationMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts resendSuccess when emailDelivered=true", async () => {
    vi.mocked(resendInvitationAction).mockResolvedValue({
      success: true,
      data: "token-123",
      emailDelivered: true,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ invitationId: "inv-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("resendSuccess");
  });

  it("toasts emailResendWarning when emailDelivered=false", async () => {
    vi.mocked(resendInvitationAction).mockResolvedValue({
      success: true,
      data: "token-123",
      emailDelivered: false,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ invitationId: "inv-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.warning).toHaveBeenCalledWith("emailResendWarning");
  });

  it("toasts error on failure", async () => {
    vi.mocked(resendInvitationAction).mockResolvedValue({
      success: false,
      error: "Expired",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useResendInvitationMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ invitationId: "inv-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Expired");
  });
});

// ─── Realtime hooks ──────────────────────────────────────────────────────────

describe("useInvitationsRealtimeSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribes when orgId is provided", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useInvitationsRealtimeSync("org-1"), { wrapper });
    expect(mockSupabase.channel).toHaveBeenCalledWith("invitations:org:org-1");
    expect(mockChannel.on).toHaveBeenCalled();
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("does not subscribe when orgId is null", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useInvitationsRealtimeSync(null), { wrapper });
    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const { wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useInvitationsRealtimeSync("org-1"), { wrapper });
    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalled();
  });
});

describe("useMembersRealtimeSync", () => {
  beforeEach(() => vi.clearAllMocks());

  it("subscribes when orgId is provided", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useMembersRealtimeSync("org-1"), { wrapper });
    expect(mockSupabase.channel).toHaveBeenCalledWith("org_members:org:org-1");
  });

  it("does not subscribe when orgId is null", () => {
    const { wrapper } = makeWrapper();
    renderHook(() => useMembersRealtimeSync(null), { wrapper });
    expect(mockSupabase.channel).not.toHaveBeenCalled();
  });

  it("unsubscribes on unmount", () => {
    const { wrapper } = makeWrapper();
    const { unmount } = renderHook(() => useMembersRealtimeSync("org-2"), { wrapper });
    unmount();
    expect(mockSupabase.removeChannel).toHaveBeenCalled();
  });
});

// ─── Roles ────────────────────────────────────────────────────────────────────

describe("useRolesQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns initialData", () => {
    const { wrapper } = makeWrapper();
    const roles = [{ id: "r-1", name: "Admin" }] as never;
    const { result } = renderHook(() => useRolesQuery(roles), { wrapper });
    expect(result.current.data).toEqual(roles);
  });
});

describe("useCreateRoleMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on role create", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({ success: true, data: { id: "r-1" } } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Supervisor" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Role created");
  });

  it("toasts error on failure", async () => {
    vi.mocked(createRoleAction).mockResolvedValue({ success: false, error: "Duplicate" } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Supervisor" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Duplicate");
  });
});

describe("useUpdateRoleMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on update", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ roleId: "r-1", name: "Updated" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Role updated");
  });

  it("toasts error on failure", async () => {
    vi.mocked(updateRoleAction).mockResolvedValue({ success: false, error: "Not found" } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

describe("useDeleteRoleMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on delete", async () => {
    vi.mocked(deleteRoleAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Role deleted");
  });

  it("toasts error on failure", async () => {
    vi.mocked(deleteRoleAction).mockResolvedValue({
      success: false,
      error: "Cannot delete",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteRoleMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Cannot delete");
  });
});

describe("useAssignRoleToUserMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates members and memberAccess on success", async () => {
    vi.mocked(assignRoleToUserAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAssignRoleToUserMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("toasts error on failure", async () => {
    vi.mocked(assignRoleToUserAction).mockResolvedValue({
      success: false,
      error: "Forbidden",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAssignRoleToUserMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Forbidden");
  });
});

describe("useRemoveRoleFromUserMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("invalidates members and memberAccess on success", async () => {
    vi.mocked(removeRoleFromUserAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemoveRoleFromUserMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalledTimes(2);
  });

  it("toasts error on failure", async () => {
    vi.mocked(removeRoleFromUserAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemoveRoleFromUserMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", roleId: "r-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

// ─── Positions ────────────────────────────────────────────────────────────────

describe("usePositionsQuery", () => {
  it("returns initialData", () => {
    const { wrapper } = makeWrapper();
    const positions = [{ id: "p-1", name: "Manager" }] as never;
    const { result } = renderHook(() => usePositionsQuery(positions), { wrapper });
    expect(result.current.data).toEqual(positions);
  });
});

describe("useAssignmentsQuery", () => {
  it("returns initialData", () => {
    const { wrapper } = makeWrapper();
    const assignments = [{ id: "a-1" }] as never;
    const { result } = renderHook(() => useAssignmentsQuery(assignments), { wrapper });
    expect(result.current.data).toEqual(assignments);
  });
});

describe("useCreatePositionMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on create", async () => {
    vi.mocked(createPositionAction).mockResolvedValue({
      success: true,
      data: { id: "p-1" },
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Manager" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Position created");
  });

  it("toasts error on failure", async () => {
    vi.mocked(createPositionAction).mockResolvedValue({
      success: false,
      error: "Duplicate",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreatePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "Manager" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Duplicate");
  });
});

describe("useUpdatePositionMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on update", async () => {
    vi.mocked(updatePositionAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ positionId: "p-1", name: "Director" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Position updated");
  });

  it("toasts error on failure", async () => {
    vi.mocked(updatePositionAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdatePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ positionId: "p-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

describe("useDeletePositionMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on delete", async () => {
    vi.mocked(deletePositionAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeletePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ positionId: "p-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Position deleted");
  });

  it("toasts error on failure", async () => {
    vi.mocked(deletePositionAction).mockResolvedValue({
      success: false,
      error: "Has assignments",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeletePositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ positionId: "p-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Has assignments");
  });
});

describe("useAssignPositionMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds and invalidates assignments", async () => {
    vi.mocked(assignPositionAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useAssignPositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", positionId: "p-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("toasts error on failure", async () => {
    vi.mocked(assignPositionAction).mockResolvedValue({
      success: false,
      error: "Already assigned",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useAssignPositionMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ userId: "u-1", positionId: "p-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Already assigned");
  });
});

describe("useRemovePositionAssignmentMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("succeeds and invalidates assignments", async () => {
    vi.mocked(removePositionAssignmentAction).mockResolvedValue({
      success: true,
      data: undefined,
    } as never);
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useRemovePositionAssignmentMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ assignmentId: "a-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it("toasts error on failure", async () => {
    vi.mocked(removePositionAssignmentAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useRemovePositionAssignmentMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ assignmentId: "a-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

// ─── Branches ─────────────────────────────────────────────────────────────────

describe("useBranchesQuery", () => {
  it("returns initialData", () => {
    const { wrapper } = makeWrapper();
    const branches = [{ id: "b-1", name: "HQ" }] as never;
    const { result } = renderHook(() => useBranchesQuery(branches), { wrapper });
    expect(result.current.data).toEqual(branches);
  });
});

describe("useCreateBranchMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on create", async () => {
    vi.mocked(createBranchAction).mockResolvedValue({
      success: true,
      data: { id: "b-1" },
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "HQ", slug: "hq" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Branch created");
  });

  it("toasts error on failure", async () => {
    vi.mocked(createBranchAction).mockResolvedValue({
      success: false,
      error: "Slug taken",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ name: "HQ" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Slug taken");
  });
});

describe("useUpdateBranchMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on update", async () => {
    vi.mocked(updateBranchAction).mockResolvedValue({
      success: true,
      data: { id: "b-1" },
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ branchId: "b-1", name: "HQ Updated" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Branch updated");
  });

  it("toasts error on failure", async () => {
    vi.mocked(updateBranchAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ branchId: "b-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Not found");
  });
});

describe("useDeleteBranchMutation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts success on delete", async () => {
    vi.mocked(deleteBranchAction).mockResolvedValue({ success: true, data: undefined } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ branchId: "b-1" });
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(toast.success).toHaveBeenCalledWith("Branch deleted");
  });

  it("toasts error on failure", async () => {
    vi.mocked(deleteBranchAction).mockResolvedValue({
      success: false,
      error: "Has members",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useDeleteBranchMutation(), { wrapper });
    await act(async () => {
      result.current.mutate({ branchId: "b-1" });
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Has members");
  });
});

// ─── Member Access ─────────────────────────────────────────────────────────────

describe("useMemberAccessQuery", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns initialData when provided", () => {
    const { wrapper } = makeWrapper();
    const access = { roles: [] } as never;
    const { result } = renderHook(() => useMemberAccessQuery("u-1", access), { wrapper });
    expect(result.current.data).toEqual(access);
  });

  it("fetches data when no initialData", async () => {
    const accessData = { roles: [{ id: "r-1", name: "Admin" }] };
    vi.mocked(getMemberAccessAction).mockResolvedValue({
      success: true,
      data: accessData,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMemberAccessQuery("u-1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(accessData);
  });

  it("throws on action error", async () => {
    vi.mocked(getMemberAccessAction).mockResolvedValue({
      success: false,
      error: "Not found",
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useMemberAccessQuery("u-missing"), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Not found");
  });
});
