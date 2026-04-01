import { describe, expect, it } from "vitest";

import * as actorEnrichment from "../actor-enrichment";

describe("server/audit/actor-enrichment", () => {
  it("exports an empty legacy module", () => {
    expect(Object.keys(actorEnrichment)).toHaveLength(0);
  });
});
