import { describe, expect, it } from "vitest";

import { checkPermission } from "../permissions";

describe("lib/utils/permissions", () => {
  it("re-exports domain permission helpers", () => {
    expect(
      checkPermission(
        {
          allow: ["warehouse.*"],
          deny: ["warehouse.delete"],
        },
        "warehouse.read"
      )
    ).toBe(true);
  });
});
