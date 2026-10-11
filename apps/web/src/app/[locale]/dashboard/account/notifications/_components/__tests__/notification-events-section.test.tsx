import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationEventsSection } from "../notification-events-section";

const mutate = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: { event?: string; channel?: string }) =>
    values?.event ? `${values.event}|${values.channel}` : key,
}));
vi.mock("@/hooks/queries/user-preferences", () => ({
  useUpdateNotificationSettingsMutation: () => ({ mutate, isPending: false }),
}));

const preferences = (notificationSettings: unknown) => ({ notificationSettings }) as never;

describe("NotificationEventsSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the stored choice per event and channel, with defaults", () => {
    render(
      <NotificationEventsSection
        preferences={preferences({ inApp: { enabled: true, disabledTypes: ["comment"] } })}
      />
    );
    expect(screen.getByRole("checkbox", { name: "events.comment|inApp" })).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: "events.mention|inApp" })).toBeChecked();
    // E-mail defaults: assignments and mentions
    expect(screen.getByRole("checkbox", { name: "events.mention|email" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "events.task_status|email" })).not.toBeChecked();
  });

  it("a click saves the whole channel object", () => {
    render(
      <NotificationEventsSection
        preferences={preferences({ inApp: { enabled: true, disabledTypes: ["comment"] } })}
      />
    );
    fireEvent.click(screen.getByRole("checkbox", { name: "events.task_status|inApp" }));
    expect(mutate).toHaveBeenCalledWith({
      inApp: { enabled: true, disabledTypes: ["comment", "task.status"] },
    });
  });

  it("a column is disabled while its channel is switched off", () => {
    render(<NotificationEventsSection preferences={preferences({ email: { enabled: false } })} />);
    expect(screen.getByRole("checkbox", { name: "events.mention|email" })).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: "events.mention|inApp" })).toBeEnabled();
  });
});
