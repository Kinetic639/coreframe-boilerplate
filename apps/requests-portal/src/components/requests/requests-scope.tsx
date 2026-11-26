"use client";

import { RequestsScopeContext } from "@/lib/requests-query";

/** Cache scope of the requests pages: organization and the branch picked in the header. */
export function RequestsScope({ scope, children }: { scope: string; children: React.ReactNode }) {
  return <RequestsScopeContext.Provider value={scope}>{children}</RequestsScopeContext.Provider>;
}
