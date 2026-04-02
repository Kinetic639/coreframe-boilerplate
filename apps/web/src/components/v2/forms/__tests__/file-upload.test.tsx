import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileUpload } from "../file-upload";

const { mockOnChange, mockUseFormContext, mockFieldValue } = vi.hoisted(() => ({
  mockOnChange: vi.fn(),
  mockUseFormContext: vi.fn(),
  mockFieldValue: vi.fn(),
}));

vi.mock("react-hook-form", () => ({
  useFormContext: () => mockUseFormContext(),
  Controller: ({ render }: any) =>
    render({ field: { value: mockFieldValue(), onChange: mockOnChange } }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe("FileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFieldValue.mockReturnValue(null);
    mockUseFormContext.mockReturnValue({
      control: {},
      formState: { errors: {} },
    });
  });

  it("renders label, description, accepted types, and max size", () => {
    render(
      <FileUpload
        name="attachment"
        label="Attachment"
        description="Upload a file"
        accept=".pdf"
        maxSize={2048}
        required
      />
    );

    expect(screen.getByText("Attachment")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
    expect(screen.getByText("Upload a file")).toBeInTheDocument();
    expect(screen.getByText("Accepted: .pdf")).toBeInTheDocument();
    expect(screen.getByText("Max size: 2.0 KB")).toBeInTheDocument();
  });

  it("passes selected files to the field", () => {
    render(<FileUpload name="attachment" label="Attachment" />);

    const input = screen.getByLabelText(/attachment/i);
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(mockOnChange).toHaveBeenCalledWith(file);
  });

  it("combines multiple uploaded files and removes entries", () => {
    const existing = new File(["old"], "old.txt", { type: "text/plain" });
    const next = new File(["new"], "new.txt", { type: "text/plain" });
    mockFieldValue.mockReturnValue([existing]);

    render(<FileUpload name="attachment" label="Attachment" multiple />);

    const input = screen.getByLabelText(/attachment/i);
    fireEvent.change(input, { target: { files: [next] } });

    expect(mockOnChange).toHaveBeenCalledWith([existing, next]);
    expect(screen.getByText("old.txt")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button"));
    expect(mockOnChange).toHaveBeenLastCalledWith(null);
  });

  it("ignores oversized files and supports drag interactions", () => {
    render(<FileUpload name="attachment" label="Attachment" maxSize={4} />);

    const input = screen.getByLabelText(/attachment/i);
    const oversized = new File(["12345"], "big.txt", { type: "text/plain" });
    fireEvent.change(input, { target: { files: [oversized] } });

    expect(mockOnChange).not.toHaveBeenCalled();

    const dropzone = input.parentElement as HTMLElement;
    const small = new File(["ok"], "ok.txt", { type: "text/plain" });

    fireEvent.dragEnter(dropzone, { dataTransfer: { files: [small] } });
    expect(dropzone.className).toContain("border-primary");

    fireEvent.drop(dropzone, { dataTransfer: { files: [small] } });
    expect(mockOnChange).toHaveBeenCalledWith(small);
  });

  it("renders validation errors and respects disabled state", () => {
    mockUseFormContext.mockReturnValue({
      control: {},
      formState: { errors: { attachment: { message: "Upload failed" } } },
    });

    render(<FileUpload name="attachment" label="Attachment" disabled />);

    expect(screen.getByText("Upload failed")).toBeInTheDocument();
    expect(screen.getByLabelText(/attachment/i)).toBeDisabled();
  });
});
