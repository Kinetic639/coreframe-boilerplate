import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect } from "vitest";
import { useForm, FormProvider } from "react-hook-form";

import { MultiSelect } from "../multi-select";

function Wrapper({
  children,
  defaultValues,
}: {
  children: React.ReactNode;
  defaultValues?: { tags?: string[] };
}) {
  const methods = useForm({
    defaultValues: defaultValues ?? { tags: [] },
  });

  return <FormProvider {...methods}>{children}</FormProvider>;
}

describe("MultiSelect", () => {
  it("renders label, description, and required marker", () => {
    render(
      <Wrapper>
        <MultiSelect
          name="tags"
          label="Tags"
          description="Pick one or more"
          required
          options={[{ value: "a", label: "Alpha" }]}
        />
      </Wrapper>
    );

    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("Pick one or more")).toBeInTheDocument();
    expect(screen.getByText("*")).toBeInTheDocument();
  });

  it("toggles checkbox selections", async () => {
    const user = userEvent.setup();
    render(
      <Wrapper>
        <MultiSelect
          name="tags"
          label="Tags"
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        />
      </Wrapper>
    );

    const alpha = screen.getByRole("checkbox", { name: "Alpha" });
    await user.click(alpha);
    expect(alpha).toBeChecked();

    await user.click(alpha);
    expect(alpha).not.toBeChecked();
  });

  it("respects disabled states from props and options", () => {
    render(
      <Wrapper defaultValues={{ tags: ["a"] }}>
        <MultiSelect
          name="tags"
          label="Tags"
          disabled
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta", disabled: true },
          ]}
        />
      </Wrapper>
    );

    expect(screen.getByRole("checkbox", { name: "Alpha" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "Beta" })).toBeDisabled();
  });
});
