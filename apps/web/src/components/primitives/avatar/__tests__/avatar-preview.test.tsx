import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { AvatarPreview } from "../avatar-preview";

describe("AvatarPreview", () => {
  it("renders the avatar as is when there is no photo", () => {
    render(
      <AvatarPreview src={null} name="Anna Nowak" label="Pokaż zdjęcie">
        <span>AN</span>
      </AvatarPreview>
    );
    expect(screen.getByText("AN")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pokaż zdjęcie" })).not.toBeInTheDocument();
  });

  it("opens the enlarged photo with the person's name on click", () => {
    render(
      <AvatarPreview src="https://example.com/a.webp" name="Anna Nowak" label="Pokaż zdjęcie">
        <span>AN</span>
      </AvatarPreview>
    );
    fireEvent.click(screen.getByRole("button", { name: "Pokaż zdjęcie" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("Anna Nowak");
    expect(screen.getByRole("img", { name: "Anna Nowak" })).toHaveAttribute(
      "src",
      "https://example.com/a.webp"
    );
  });
});
