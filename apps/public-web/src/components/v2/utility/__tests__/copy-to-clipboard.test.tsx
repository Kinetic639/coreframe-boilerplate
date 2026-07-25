import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CopyToClipboard } from "../copy-to-clipboard";

const successMock = vi.fn();
const errorMock = vi.fn();
const writeTextMock = vi.fn();

vi.mock("react-toastify", () => ({
  toast: {
    success: (...args: unknown[]) => successMock(...args),
    error: (...args: unknown[]) => errorMock(...args),
  },
}));

describe("CopyToClipboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, {
      clipboard: {
        writeText: writeTextMock,
      },
    });
  });

  it("copies text and shows success state for the default button variant", async () => {
    writeTextMock.mockResolvedValue(undefined);
    render(<CopyToClipboard text="hello" />);

    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await Promise.resolve();
    expect(writeTextMock).toHaveBeenCalledWith("hello");
    expect(successMock).toHaveBeenCalledWith("Copied to clipboard");
  });

  it("supports inline and icon variants", async () => {
    writeTextMock.mockResolvedValue(undefined);

    const { rerender } = render(
      <CopyToClipboard text="alpha" variant="inline">
        Copy Alpha
      </CopyToClipboard>
    );

    fireEvent.click(screen.getByRole("button", { name: /copy alpha/i }));
    await Promise.resolve();
    expect(writeTextMock).toHaveBeenCalledWith("alpha");

    rerender(<CopyToClipboard text="beta" variant="icon" showToast={false} />);
    fireEvent.click(screen.getByRole("button"));
    await Promise.resolve();
    expect(writeTextMock).toHaveBeenCalledWith("beta");
    expect(successMock).toHaveBeenCalledTimes(1);
  });

  it("shows an error toast when copying fails", async () => {
    writeTextMock.mockRejectedValue(new Error("no clipboard"));

    render(<CopyToClipboard text="oops" />);
    fireEvent.click(screen.getByRole("button", { name: /copy/i }));

    await Promise.resolve();
    expect(errorMock).toHaveBeenCalledWith("Failed to copy to clipboard");
  });
});
