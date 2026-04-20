import { describe, it, expect } from "vitest";

import * as authService from "../auth.service";
import * as repoAuth from "@repo/auth";

describe("auth.service", () => {
  it("re-exports the repo auth module", () => {
    expect(authService).toEqual(repoAuth);
  });
});
