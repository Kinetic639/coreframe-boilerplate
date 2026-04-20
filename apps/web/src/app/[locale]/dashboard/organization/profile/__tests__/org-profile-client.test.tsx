import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRouterRefresh = vi.fn();
const mockUpdateMutate = vi.fn();
const mockUploadMutate = vi.fn();
const mockRemoveMutate = vi.fn();

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: mockRouterRefresh, push: vi.fn() }),
}));

vi.mock("@/hooks/queries/organization", () => ({
  useOrgProfileQuery: vi.fn(),
  useUpdateOrgProfileMutation: vi.fn(),
  useUploadOrgLogoMutation: vi.fn(),
  useRemoveOrgLogoMutation: vi.fn(),
}));

import { OrgProfileClient } from "../_components/org-profile-client";
import {
  useOrgProfileQuery,
  useRemoveOrgLogoMutation,
  useUpdateOrgProfileMutation,
  useUploadOrgLogoMutation,
} from "@/hooks/queries/organization";

const initialProfile = {
  name: "Acme Inc",
  name_2: "Acme Holdings",
  slug: "acme-inc",
  bio: "Warehouse software",
  website: "https://acme.test",
  logo_url: "https://cdn.example.com/logo.png",
} as const;

describe("OrgProfileClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(useOrgProfileQuery).mockReturnValue({
      data: initialProfile,
    } as never);

    vi.mocked(useUpdateOrgProfileMutation).mockReturnValue({
      mutate: mockUpdateMutate,
      isPending: false,
    } as never);

    vi.mocked(useUploadOrgLogoMutation).mockReturnValue({
      mutate: mockUploadMutate,
      isPending: false,
    } as never);

    vi.mocked(useRemoveOrgLogoMutation).mockReturnValue({
      mutate: mockRemoveMutate,
      isPending: false,
    } as never);
  });

  it("renders editable org profile fields and existing logo actions", () => {
    render(<OrgProfileClient canEdit initialProfile={initialProfile as never} />);

    expect(screen.getByDisplayValue("Acme Inc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Acme Holdings")).toBeInTheDocument();
    expect(screen.getByDisplayValue("acme-inc")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Warehouse software")).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://acme.test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /change logo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /remove/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save changes/i })).toBeInTheDocument();
  });

  it("submits updated fields and refreshes on successful save", () => {
    render(<OrgProfileClient canEdit initialProfile={initialProfile as never} />);

    fireEvent.change(screen.getByLabelText("Organization Name"), {
      target: { value: "Acme Warehouse" },
    });
    fireEvent.change(screen.getByLabelText("URL Slug"), {
      target: { value: "ACME Warehouse!!" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Updated bio" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    expect(mockUpdateMutate).toHaveBeenCalledWith(
      {
        name: "Acme Warehouse",
        name_2: "Acme Holdings",
        slug: "acmewarehouse",
        bio: "Updated bio",
        website: "https://acme.test",
      },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );

    const onSuccess = mockUpdateMutate.mock.calls[0][1].onSuccess as () => void;
    onSuccess();
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("uploads a logo from the hidden file input and refreshes on success", () => {
    render(<OrgProfileClient canEdit initialProfile={initialProfile as never} />);

    const file = new File(["logo"], "logo.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    expect(mockUploadMutate).toHaveBeenCalledOnce();
    const formData = mockUploadMutate.mock.calls[0][0] as FormData;
    expect(formData.get("file")).toBe(file);

    const onSuccess = mockUploadMutate.mock.calls[0][1].onSuccess as () => void;
    onSuccess();
    expect(mockRouterRefresh).toHaveBeenCalled();
  });

  it("renders read-only fields and hides edit actions when editing is disabled", () => {
    render(<OrgProfileClient canEdit={false} initialProfile={initialProfile as never} />);

    expect(screen.getByLabelText("Organization Name")).toBeDisabled();
    expect(screen.getByLabelText("Secondary Name")).toBeDisabled();
    expect(screen.getByLabelText("URL Slug")).toBeDisabled();
    expect(screen.getByLabelText("Description")).toBeDisabled();
    expect(screen.getByLabelText("Website")).toBeDisabled();
    expect(screen.queryByRole("button", { name: /save changes/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /change logo/i })).not.toBeInTheDocument();
  });

  it("removes the logo and refreshes on success", () => {
    render(<OrgProfileClient canEdit initialProfile={initialProfile as never} />);

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(mockRemoveMutate).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );

    const onSuccess = mockRemoveMutate.mock.calls[0][1].onSuccess as () => void;
    onSuccess();
    expect(mockRouterRefresh).toHaveBeenCalled();
  });
});
