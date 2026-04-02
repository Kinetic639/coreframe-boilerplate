/**
 * @vitest-environment node
 *
 * Event Visual Model — Unit Tests
 *
 * Verifies that the centralized taxonomy-to-visual mapping is complete,
 * deterministic, and consistent with the taxonomy types defined in types.ts.
 *
 * Suites:
 *   T-VISUAL-COVERAGE:  every category and intent has a mapping entry
 *   T-VISUAL-VALUES:    mapped values are non-empty strings
 *   T-VISUAL-SPOT:      spot-checks canonical mappings are correct
 *   T-VISUAL-COLORS:    intent colors are valid Tailwind classes
 */

import { describe, it, expect } from "vitest";
import {
  CATEGORY_ICON_MAP,
  INTENT_ICON_MAP,
  INTENT_COLOR_MAP,
  CATEGORY_LABEL_MAP,
  INTENT_LABEL_MAP,
} from "@/lib/audit/event-visual-model";
import type { EventCategory, EventIntent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Canonical value arrays — must match types.ts exactly
// ---------------------------------------------------------------------------

const ALL_CATEGORIES: EventCategory[] = [
  "AUTH",
  "SECURITY",
  "MEMBERSHIP",
  "INVITATION",
  "ORGANIZATION",
  "USER",
  "SYSTEM",
  "DATA",
  "STATE",
  "AUTOMATION",
  "WAREHOUSE",
];

const ALL_INTENTS: EventIntent[] = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ASSIGN",
  "REMOVE",
  "ACCEPT",
  "DECLINE",
  "SUCCESS",
  "FAIL",
  "REQUEST",
];

// ---------------------------------------------------------------------------
// T-VISUAL-COVERAGE: every value has a mapping
// ---------------------------------------------------------------------------

describe("T-VISUAL-COVERAGE: all taxonomy values are mapped", () => {
  it("CATEGORY_ICON_MAP covers all EventCategory values", () => {
    for (const category of ALL_CATEGORIES) {
      expect(
        CATEGORY_ICON_MAP[category],
        `CATEGORY_ICON_MAP is missing entry for category: ${category}`
      ).toBeDefined();
    }
  });

  it("INTENT_ICON_MAP covers all EventIntent values", () => {
    for (const intent of ALL_INTENTS) {
      expect(
        INTENT_ICON_MAP[intent],
        `INTENT_ICON_MAP is missing entry for intent: ${intent}`
      ).toBeDefined();
    }
  });

  it("INTENT_COLOR_MAP covers all EventIntent values", () => {
    for (const intent of ALL_INTENTS) {
      expect(
        INTENT_COLOR_MAP[intent],
        `INTENT_COLOR_MAP is missing entry for intent: ${intent}`
      ).toBeDefined();
    }
  });

  it("CATEGORY_LABEL_MAP covers all EventCategory values", () => {
    for (const category of ALL_CATEGORIES) {
      expect(
        CATEGORY_LABEL_MAP[category],
        `CATEGORY_LABEL_MAP is missing entry for category: ${category}`
      ).toBeDefined();
    }
  });

  it("INTENT_LABEL_MAP covers all EventIntent values", () => {
    for (const intent of ALL_INTENTS) {
      expect(
        INTENT_LABEL_MAP[intent],
        `INTENT_LABEL_MAP is missing entry for intent: ${intent}`
      ).toBeDefined();
    }
  });

  it("CATEGORY_ICON_MAP has no extra entries beyond known categories", () => {
    const mappedKeys = Object.keys(CATEGORY_ICON_MAP) as EventCategory[];
    expect(mappedKeys.sort()).toEqual([...ALL_CATEGORIES].sort());
  });

  it("INTENT_ICON_MAP has no extra entries beyond known intents", () => {
    const mappedKeys = Object.keys(INTENT_ICON_MAP) as EventIntent[];
    expect(mappedKeys.sort()).toEqual([...ALL_INTENTS].sort());
  });

  it("INTENT_COLOR_MAP has no extra entries beyond known intents", () => {
    const mappedKeys = Object.keys(INTENT_COLOR_MAP) as EventIntent[];
    expect(mappedKeys.sort()).toEqual([...ALL_INTENTS].sort());
  });
});

// ---------------------------------------------------------------------------
// T-VISUAL-VALUES: mapped values are non-empty strings
// ---------------------------------------------------------------------------

describe("T-VISUAL-VALUES: all mapped values are non-empty strings", () => {
  it("all CATEGORY_ICON_MAP values are non-empty strings", () => {
    for (const [category, icon] of Object.entries(CATEGORY_ICON_MAP)) {
      expect(typeof icon, `CATEGORY_ICON_MAP[${category}] should be a string`).toBe("string");
      expect(
        icon.trim().length,
        `CATEGORY_ICON_MAP[${category}] should not be empty`
      ).toBeGreaterThan(0);
    }
  });

  it("all INTENT_ICON_MAP values are non-empty strings", () => {
    for (const [intent, icon] of Object.entries(INTENT_ICON_MAP)) {
      expect(typeof icon, `INTENT_ICON_MAP[${intent}] should be a string`).toBe("string");
      expect(icon.trim().length, `INTENT_ICON_MAP[${intent}] should not be empty`).toBeGreaterThan(
        0
      );
    }
  });

  it("all INTENT_COLOR_MAP values are non-empty strings", () => {
    for (const [intent, color] of Object.entries(INTENT_COLOR_MAP)) {
      expect(typeof color, `INTENT_COLOR_MAP[${intent}] should be a string`).toBe("string");
      expect(
        color.trim().length,
        `INTENT_COLOR_MAP[${intent}] should not be empty`
      ).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// T-VISUAL-SPOT: canonical spot-checks
// ---------------------------------------------------------------------------

describe("T-VISUAL-SPOT: canonical mapping values are correct", () => {
  // Category icons
  it("AUTH maps to log-in icon", () => {
    expect(CATEGORY_ICON_MAP.AUTH).toBe("log-in");
  });

  it("SECURITY maps to shield-alert icon", () => {
    expect(CATEGORY_ICON_MAP.SECURITY).toBe("shield-alert");
  });

  it("MEMBERSHIP maps to users icon", () => {
    expect(CATEGORY_ICON_MAP.MEMBERSHIP).toBe("users");
  });

  it("INVITATION maps to mail icon", () => {
    expect(CATEGORY_ICON_MAP.INVITATION).toBe("mail");
  });

  it("ORGANIZATION maps to building-2 icon", () => {
    expect(CATEGORY_ICON_MAP.ORGANIZATION).toBe("building-2");
  });

  // Intent icons
  it("CREATE maps to plus-circle icon", () => {
    expect(INTENT_ICON_MAP.CREATE).toBe("plus-circle");
  });

  it("UPDATE maps to pencil icon", () => {
    expect(INTENT_ICON_MAP.UPDATE).toBe("pencil");
  });

  it("DELETE maps to trash-2 icon", () => {
    expect(INTENT_ICON_MAP.DELETE).toBe("trash-2");
  });

  it("REMOVE maps to minus icon", () => {
    expect(INTENT_ICON_MAP.REMOVE).toBe("minus");
  });

  it("ASSIGN maps to link icon", () => {
    expect(INTENT_ICON_MAP.ASSIGN).toBe("link");
  });

  it("SUCCESS maps to check-circle icon", () => {
    expect(INTENT_ICON_MAP.SUCCESS).toBe("check-circle");
  });

  it("FAIL maps to x-circle icon", () => {
    expect(INTENT_ICON_MAP.FAIL).toBe("x-circle");
  });

  it("REQUEST maps to clock icon", () => {
    expect(INTENT_ICON_MAP.REQUEST).toBe("clock");
  });

  // Intent colors
  it("CREATE is green", () => {
    expect(INTENT_COLOR_MAP.CREATE).toBe("text-green-600");
  });

  it("UPDATE is blue", () => {
    expect(INTENT_COLOR_MAP.UPDATE).toBe("text-blue-600");
  });

  it("DELETE is red", () => {
    expect(INTENT_COLOR_MAP.DELETE).toBe("text-red-600");
  });

  it("REMOVE is orange", () => {
    expect(INTENT_COLOR_MAP.REMOVE).toBe("text-orange-600");
  });

  it("ASSIGN is purple", () => {
    expect(INTENT_COLOR_MAP.ASSIGN).toBe("text-purple-600");
  });

  it("ACCEPT is purple (binding affirmation)", () => {
    expect(INTENT_COLOR_MAP.ACCEPT).toBe("text-purple-600");
  });

  it("FAIL is red", () => {
    expect(INTENT_COLOR_MAP.FAIL).toBe("text-red-600");
  });

  it("SUCCESS is green", () => {
    expect(INTENT_COLOR_MAP.SUCCESS).toBe("text-green-600");
  });
});

// ---------------------------------------------------------------------------
// T-VISUAL-COLORS: intent color format is valid Tailwind
// ---------------------------------------------------------------------------

describe("T-VISUAL-COLORS: intent colors follow Tailwind text-color format", () => {
  it("all intent colors start with 'text-'", () => {
    for (const [intent, color] of Object.entries(INTENT_COLOR_MAP)) {
      expect(color, `INTENT_COLOR_MAP[${intent}] must start with 'text-'`).toMatch(/^text-/);
    }
  });

  it("DELETE and DECLINE share the same color (both red — destructive/negative)", () => {
    expect(INTENT_COLOR_MAP.DELETE).toBe(INTENT_COLOR_MAP.DECLINE);
  });

  it("CREATE and SUCCESS share the same color (both green — positive outcome)", () => {
    expect(INTENT_COLOR_MAP.CREATE).toBe(INTENT_COLOR_MAP.SUCCESS);
  });

  it("ASSIGN and ACCEPT share the same color (both purple — binding relationship)", () => {
    expect(INTENT_COLOR_MAP.ASSIGN).toBe(INTENT_COLOR_MAP.ACCEPT);
  });
});
