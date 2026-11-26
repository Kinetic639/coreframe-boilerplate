const TIME_ZONE = "Europe/Warsaw";

/** "Dobry wieczór" from 18:00 until 5:00 (Polish time), otherwise "Dzień dobry". */
export function isEvening(now: Date): boolean {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: TIME_ZONE,
    }).format(now)
  );
  return hour >= 18 || hour < 5;
}

/** e.g. "Czwartek, 26 listopada" / "Thursday, 26 November". */
export function formatGreetingDate(now: Date, locale: "pl" | "en"): string {
  const label = new Intl.DateTimeFormat(locale === "pl" ? "pl-PL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
  }).format(now);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
