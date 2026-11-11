import { describe, expect, it } from "vitest";
import { systemEventText } from "../chat-text";

const t = ((key: string, values?: Record<string, string>) =>
  values ? `${key}|${Object.values(values).join("|")}` : key) as never;
const members = [
  { user_id: "me", first_name: "Michał", last_name: "K", email: null },
  { user_id: "u1", first_name: "Marta", last_name: "Nowak", email: null },
] as never;

describe("systemEventText: invitations", () => {
  it("names invited people from the event (they are not members yet)", () => {
    expect(
      systemEventText(
        { action: "invited", user_ids: ["u9"], names: ["Jan Kowalski"] },
        "u1",
        members,
        "me",
        t
      )
    ).toBe("system.invited|Marta Nowak|Jan Kowalski");
  });

  it("a withdrawn invitation names the person it was for", () => {
    expect(
      systemEventText(
        { action: "withdrawn", user_ids: ["u9"], names: ["Jan Kowalski"] },
        "me",
        members,
        "me",
        t
      )
    ).toBe("system.withdrawn|window.you|Jan Kowalski");
  });

  it("joined and declined use the name carried by the event", () => {
    expect(
      systemEventText({ action: "joined", name: "Jan Kowalski" }, "u9", members, "me", t)
    ).toBe("system.joined|Jan Kowalski");
    expect(
      systemEventText({ action: "declined", name: "Jan Kowalski" }, "u9", members, "me", t)
    ).toBe("system.declined|Jan Kowalski");
    expect(systemEventText({ action: "joined", name: "Michał K" }, "me", members, "me", t)).toBe(
      "system.joined|window.you"
    );
  });
});
