import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("../form-wrapper", () => ({
  FormWrapper: ({
    children,
    onSubmit,
    submitLabel,
  }: {
    children: React.ReactNode;
    onSubmit: (data: { name: string }) => Promise<void>;
    submitLabel?: string;
  }) => (
    <div>
      {children}
      <button type="button" onClick={() => void onSubmit({ name: "Widget" })}>
        {submitLabel ?? "Submit"}
      </button>
    </div>
  ),
}));

import { CreateEditDialog } from "../create-edit-dialog";

const schema = z.object({
  name: z.string(),
});

describe("CreateEditDialog", () => {
  it("renders the default create trigger and dialog copy", async () => {
    const user = userEvent.setup();
    render(
      <CreateEditDialog mode="create" schema={schema} onSubmit={vi.fn()}>
        <div>Form body</div>
      </CreateEditDialog>
    );

    await user.click(screen.getByRole("button", { name: /create/i }));

    expect(screen.getByText("Create New Item")).toBeInTheDocument();
    expect(
      screen.getByText("Fill in the information below to create a new item.")
    ).toBeInTheDocument();
    expect(screen.getByText("Form body")).toBeInTheDocument();
  });

  it("renders custom trigger and edit copy", async () => {
    const user = userEvent.setup();
    render(
      <CreateEditDialog
        mode="edit"
        schema={schema}
        onSubmit={vi.fn()}
        trigger={<button type="button">Open dialog</button>}
      >
        <div>Edit body</div>
      </CreateEditDialog>
    );

    await user.click(screen.getByRole("button", { name: /open dialog/i }));

    expect(screen.getByText("Edit Item")).toBeInTheDocument();
    expect(screen.getByText("Update the information below to edit the item.")).toBeInTheDocument();
    expect(screen.getByText("Edit body")).toBeInTheDocument();
  });

  it("submits through FormWrapper and closes on success", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <CreateEditDialog
        mode="edit"
        schema={schema}
        title="Edit widget"
        description="Custom description"
        defaultValues={{ name: "Old Widget" }}
        onSubmit={onSubmit}
      >
        <div>Edit body</div>
      </CreateEditDialog>
    );

    await user.click(screen.getByRole("button", { name: /edit/i }));
    expect(screen.getByText("Edit widget")).toBeInTheDocument();
    expect(screen.getByText("Custom description")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ name: "Widget" }));
    await waitFor(() => expect(screen.queryByText("Edit widget")).not.toBeInTheDocument());
  });
});
