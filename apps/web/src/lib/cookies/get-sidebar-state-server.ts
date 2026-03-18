// lib/cookies/get-sidebar-state-server.ts
import { cookies } from "next/headers";

export async function getSidebarStateServer(): Promise<"expanded" | "collapsed"> {
  const cookie = (await cookies()).get("sidebar_state")?.value;
  return cookie === "false" ? "collapsed" : "expanded"; // domyślnie otwarty
}
