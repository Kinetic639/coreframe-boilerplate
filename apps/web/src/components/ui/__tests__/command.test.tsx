import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeAll } from "vitest";
import { Search } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandShortcut,
  CommandSeparator,
} from "../command";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: ResizeObserverMock,
  });

  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => {},
  });
});

describe("Command", () => {
  it("renders command input, groups, items, shortcuts, and separator", () => {
    const { container } = render(
      <Command className="command-root">
        <CommandInput placeholder="Search tools" />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Tools">
            <CommandItem>
              <Search />
              Search
              <CommandShortcut>⌘K</CommandShortcut>
            </CommandItem>
          </CommandGroup>
          <CommandSeparator />
        </CommandList>
      </Command>
    );

    expect(screen.getByPlaceholderText("Search tools")).toBeInTheDocument();
    expect(screen.getByText("Tools")).toBeInTheDocument();
    expect(screen.getByText("Search")).toBeInTheDocument();
    expect(screen.getByText("⌘K")).toBeInTheDocument();
    expect(container.querySelector(".command-root")).toBeInTheDocument();
    expect(container.querySelector("[cmdk-separator]")).toBeInTheDocument();
  });

  it("renders inside a dialog when open", async () => {
    const user = userEvent.setup();
    render(
      <CommandDialog open onOpenChange={() => {}}>
        <CommandInput placeholder="Search commands" />
        <CommandList>
          <CommandGroup heading="Pages">
            <CommandItem>Dashboard</CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search commands")).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText("Search commands"), "dash");
    expect(screen.getByDisplayValue("dash")).toBeInTheDocument();
  });
});
