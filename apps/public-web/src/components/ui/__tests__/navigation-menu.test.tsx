import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@radix-ui/react-navigation-menu", () => {
  const React = require("react");
  return {
    Root: React.forwardRef(({ children, ...props }: any, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    List: React.forwardRef(({ children, ...props }: any, ref) => (
      <ul ref={ref} {...props}>
        {children}
      </ul>
    )),
    Item: ({ children }: any) => <li>{children}</li>,
    Trigger: React.forwardRef(({ children, ...props }: any, ref) => (
      <button ref={ref} {...props}>
        {children}
      </button>
    )),
    Content: React.forwardRef(({ children, ...props }: any, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
    Link: ({ children }: any) => <a>{children}</a>,
    Viewport: React.forwardRef((props: any, ref) => <div ref={ref} {...props} />),
    Indicator: React.forwardRef(({ children, ...props }: any, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  };
});

import {
  NavigationMenu,
  NavigationMenuList,
  NavigationMenuItem,
  NavigationMenuTrigger,
  NavigationMenuContent,
  NavigationMenuLink,
  NavigationMenuIndicator,
  NavigationMenuViewport,
  navigationMenuTriggerStyle,
} from "../navigation-menu";

describe("navigation-menu", () => {
  it("renders the composed navigation parts", () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuTrigger>Open</NavigationMenuTrigger>
            <NavigationMenuContent>Panel</NavigationMenuContent>
            <NavigationMenuLink>Link body</NavigationMenuLink>
          </NavigationMenuItem>
        </NavigationMenuList>
        <NavigationMenuIndicator />
        <NavigationMenuViewport />
      </NavigationMenu>
    );

    expect(screen.getByRole("button", { name: /open/i })).toBeInTheDocument();
    expect(screen.getByText("Panel")).toBeInTheDocument();
    expect(screen.getByText("Link body")).toBeInTheDocument();
  });

  it("returns trigger classes", () => {
    expect(navigationMenuTriggerStyle()).toContain("inline-flex");
  });
});
