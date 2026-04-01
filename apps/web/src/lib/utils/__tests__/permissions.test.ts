import { describe, expect, it } from "vitest";

import * as webPermissions from "../permissions";
import * as domainPermissions from "@repo/domain/permissions";

describe("lib/utils/permissions", () => {
  it("re-exports the domain permissions helpers", () => {
    expect(webPermissions).toEqual(domainPermissions);
  });
});
