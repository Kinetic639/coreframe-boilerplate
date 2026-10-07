"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { ACTIVE_BRANCH_COOKIE, requirePortalContext } from "@/server/portal-context";

/** Header branch switcher. `null` = all branches the user can see. */
export async function setActiveBranchAction(branchId: string | null) {
  const ctx = await requirePortalContext();
  const store = await cookies();
  if (branchId && ctx.branches.some((b) => b.id === branchId)) {
    store.set(ACTIVE_BRANCH_COOKIE, branchId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    });
  } else {
    store.delete(ACTIVE_BRANCH_COOKIE);
  }
  revalidatePath("/", "layout");
}
