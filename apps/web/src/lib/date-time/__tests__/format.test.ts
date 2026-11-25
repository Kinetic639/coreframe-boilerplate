import { afterEach, describe, expect, it } from "vitest";
import { formatDateTime, formatTime, setDisplayTimeZone } from "../format";

const iso = "2026-11-25T13:25:00Z";

describe("date-time format helpers", () => {
  afterEach(() => setDisplayTimeZone(undefined));

  it("formats in the display zone set from next-intl", () => {
    setDisplayTimeZone("Europe/Warsaw");
    expect(formatTime(iso, "pl-PL", { hour: "2-digit", minute: "2-digit" })).toBe("14:25");
    setDisplayTimeZone("Asia/Tokyo");
    expect(formatTime(iso, "pl-PL", { hour: "2-digit", minute: "2-digit" })).toBe("22:25");
  });

  it("keeps an explicit timeZone from the caller", () => {
    setDisplayTimeZone("Asia/Tokyo");
    expect(formatDateTime(iso, "pl-PL", { timeStyle: "short", timeZone: "UTC" })).toBe("13:25");
  });
});
