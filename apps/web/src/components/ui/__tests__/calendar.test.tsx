import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { Calendar, CalendarDayButton } from "../calendar";

describe("Calendar", () => {
  it("renders a calendar with navigation and weekday labels", () => {
    render(
      <Calendar month={new Date(2026, 3, 15)} mode="single" selected={new Date(2026, 3, 15)} />
    );

    expect(screen.getByText(/apr/i)).toBeInTheDocument();
    expect(screen.getByText(/su/i)).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getAllByRole("button").length).toBeGreaterThan(2);
  });

  it("focuses the day button when the focused modifier is true", () => {
    const focusSpy = vi.spyOn(HTMLButtonElement.prototype, "focus");
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <CalendarDayButton
                day={{ date: new Date(2026, 3, 15), displayMonth: new Date(2026, 3, 1) } as never}
                modifiers={{
                  focused: true,
                  selected: false,
                  range_start: false,
                  range_end: false,
                  range_middle: false,
                }}
              >
                15
              </CalendarDayButton>
            </td>
          </tr>
        </tbody>
      </table>
    );

    expect(screen.getByRole("button", { name: "15" })).toBeInTheDocument();
    expect(focusSpy).toHaveBeenCalled();
  });
});
