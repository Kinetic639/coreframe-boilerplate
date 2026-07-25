import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "../search-form";

describe("SearchForm", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("debounces search input", () => {
    const onSearch = vi.fn();
    render(<SearchForm onSearch={onSearch} debounce={200} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "warehouse" } });
    vi.advanceTimersByTime(199);
    expect(onSearch).not.toHaveBeenCalledWith("warehouse");

    vi.advanceTimersByTime(1);
    expect(onSearch).toHaveBeenLastCalledWith("warehouse");
  });

  it("clears value and calls onClear", () => {
    const onSearch = vi.fn();
    const onClear = vi.fn();
    render(<SearchForm onSearch={onSearch} onClear={onClear} value="abc" />);

    fireEvent.click(screen.getByRole("button"));

    expect(onSearch).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalled();
  });
});
