import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FileUpload } from "../file-upload";

const { mockOnChange, mockUseFormContext } = vi.hoisted(() => ({
  mockOnChange: vi.fn(),
  mockUseFormContext: vi.fn(),
}));

vi.mock("react-hook-form", () => ({
  useFormContext: () => mockUseFormContext(),
  Controller: ({ render }: any) => render({ field: { value: null, onChange: mockOnChange } }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe("FileUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
