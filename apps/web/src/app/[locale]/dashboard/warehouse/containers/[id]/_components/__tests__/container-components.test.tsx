/**
 * @vitest-environment jsdom
 *
 * Phase 10D — container screen client components: the QR card (generate /
 * print) and the cross-branch confirm-then-switch prompt.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const h = vi.hoisted(() => ({
  createAndAssign: vi.fn(),
  changeBranch: vi.fn(),
  setActiveBranch: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("react-toastify", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/app/actions/qr/assign-container", () => ({
  createAndAssignQrToContainerAction: (...args: unknown[]) => h.createAndAssign(...args),
}));
vi.mock("@/app/actions/shared/changeBranch", () => ({
  changeBranch: (...args: unknown[]) => h.changeBranch(...args),
}));
vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: { getState: () => ({ setActiveBranch: h.setActiveBranch }) },
}));
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh: h.refresh }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

import { ContainerQrCard } from "../container-qr-card";
import { ContainerCrossBranchPrompt } from "../container-cross-branch-prompt";

const CONTAINER_ID = "c-1";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ContainerQrCard", () => {
  it("offers to generate a QR code when none is assigned", async () => {
    h.createAndAssign.mockResolvedValue({ success: true, data: {} });
    render(
      <ContainerQrCard
        containerId={CONTAINER_ID}
        containerCode="K-184213-01"
        qrCodeId={null}
        canAssign
        canPrint
      />
    );
    expect(screen.getByTestId("container-qr-none")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("container-qr-generate"));
    await waitFor(() =>
      expect(h.createAndAssign).toHaveBeenCalledWith({
        containerId: CONTAINER_ID,
        label: "K-184213-01",
      })
    );
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.toastSuccess).toHaveBeenCalledWith("generated");
  });

  it("shows an error and does not refresh when generation fails", async () => {
    h.createAndAssign.mockResolvedValue({ success: false, error: "Unauthorized" });
    render(
      <ContainerQrCard
        containerId={CONTAINER_ID}
        containerCode="K-184213-01"
        qrCodeId={null}
        canAssign
        canPrint
      />
    );
    fireEvent.click(screen.getByTestId("container-qr-generate"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("error"));
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("without assign permission shows a notice instead of the button", () => {
    render(
      <ContainerQrCard
        containerId={CONTAINER_ID}
        containerCode="K-184213-01"
        qrCodeId={null}
        canAssign={false}
        canPrint
      />
    );
    expect(screen.queryByTestId("container-qr-generate")).not.toBeInTheDocument();
    expect(screen.getByText("noPermission")).toBeInTheDocument();
  });

  it("with an assigned QR, prints its label through the QR label route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["%PDF"])),
    });
    vi.stubGlobal("fetch", fetchMock);
    const openMock = vi.fn();
    vi.stubGlobal("open", openMock);
    URL.createObjectURL = vi.fn(() => "blob:label");
    URL.revokeObjectURL = vi.fn();

    render(
      <ContainerQrCard
        containerId={CONTAINER_ID}
        containerCode="K-184213-01"
        qrCodeId="qr-1"
        canAssign
        canPrint
      />
    );
    expect(screen.getByTestId("container-qr-assigned")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("container-qr-print"));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/qr/labels",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ qrCodeIds: ["qr-1"], labelSize: "70x40" }),
        })
      )
    );
    await waitFor(() => expect(openMock).toHaveBeenCalledWith("blob:label", "_blank", "noopener"));
    vi.unstubAllGlobals();
  });
});

describe("ContainerCrossBranchPrompt", () => {
  it("names the container and its branch without showing its contents", () => {
    render(
      <ContainerCrossBranchPrompt
        containerCode="K-191078-01"
        targetBranchId="b-poz"
        targetBranchName="CNP Poznań"
      />
    );
    expect(screen.getByText("K-191078-01")).toBeInTheDocument();
    expect(screen.getByText('description:{"branch":"CNP Poznań"}')).toBeInTheDocument();
  });

  it("switches through changeBranch, updates the tab branch, then reloads", async () => {
    h.changeBranch.mockResolvedValue({ success: true });
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { reload }, writable: true });

    render(
      <ContainerCrossBranchPrompt
        containerCode="K-191078-01"
        targetBranchId="b-poz"
        targetBranchName="CNP Poznań"
      />
    );
    fireEvent.click(screen.getByTestId("container-cross-branch-confirm"));

    await waitFor(() => expect(reload).toHaveBeenCalled());
    expect(h.changeBranch).toHaveBeenCalledWith("b-poz");
    expect(h.setActiveBranch).toHaveBeenCalledWith("b-poz");
  });

  it("a rejected switch keeps the current branch and does not reload", async () => {
    h.changeBranch.mockResolvedValue({ success: false, error: "no access" });
    const reload = vi.fn();
    Object.defineProperty(window, "location", { value: { reload }, writable: true });

    render(
      <ContainerCrossBranchPrompt
        containerCode="K-191078-01"
        targetBranchId="b-poz"
        targetBranchName="CNP Poznań"
      />
    );
    fireEvent.click(screen.getByTestId("container-cross-branch-confirm"));

    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("error"));
    expect(h.setActiveBranch).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });
});
