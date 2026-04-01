import { describe, it, expect } from "vitest";

import * as permissions from "../permissions";
import * as domainPermissions from "@repo/domain/permissions";

describe("lib/utils/permissions", () => {
  it("re-exports the domain permissions module", () => {
    expect(permissions).toEqual(domainPermissions);
  });
});
