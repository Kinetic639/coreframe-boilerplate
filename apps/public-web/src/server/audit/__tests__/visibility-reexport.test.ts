import { describe, expect, it } from "vitest";

import { canViewerSeeEvent } from "../visibility";
import { canViewerSeeEvent as domainCanViewerSeeEvent } from "@repo/domain/events/visibility";

describe("server/audit/visibility re-export", () => {
  it("re-exports canViewerSeeEvent from the domain package", () => {
    expect(canViewerSeeEvent).toBe(domainCanViewerSeeEvent);
  });
});
