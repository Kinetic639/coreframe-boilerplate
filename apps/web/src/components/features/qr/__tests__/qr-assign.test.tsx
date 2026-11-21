import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) =>
    values ? `${key}:${Object.values(values).join(",")}` : key,
}));
vi.mock("../qr-camera-scanner", () => ({
  QrCameraScanner: () => <div data-testid="scanner" />,
}));

import { QrAssignDialog } from "../qr-assign-dialog";
import { NEW_STAGED_QR, QrCodeStagingField } from "../qr-code-staging-field";

describe("QrAssignDialog", () => {
  it("assigns a brand new code in one click and closes", async () => {
    const onCreate = vi.fn().mockResolvedValue(null);
    const onOpenChange = vi.fn();
    render(
      <QrAssignDialog
        open
        onOpenChange={onOpenChange}
        objectName="Regał A"
        onCreate={onCreate}
        onScanned={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onCreate).toHaveBeenCalledTimes(1);
  });

  it("stays open and shows the message when creating fails", async () => {
    const onOpenChange = vi.fn();
    render(
      <QrAssignDialog
        open
        onOpenChange={onOpenChange}
        objectName="Regał A"
        onCreate={vi.fn().mockResolvedValue("Brak uprawnień")}
        onScanned={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "create" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Brak uprawnień");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("offers scanning a stuck-on label", () => {
    render(
      <QrAssignDialog
        open
        onOpenChange={vi.fn()}
        objectName="Regał A"
        onCreate={vi.fn()}
        onScanned={vi.fn()}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "scan" }));
    expect(screen.getByTestId("scanner")).toBeInTheDocument();
  });
});

describe("QrCodeStagingField", () => {
  it("stages a new code without creating anything", () => {
    const onChange = vi.fn();
    render(<QrCodeStagingField value={null} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "addNew" }));
    expect(onChange).toHaveBeenCalledWith(NEW_STAGED_QR);
  });

  it("shows a staged new code as 'created on save'", () => {
    render(<QrCodeStagingField value={NEW_STAGED_QR} onChange={vi.fn()} />);
    expect(screen.getByText("staged")).toBeInTheDocument();
  });
});
