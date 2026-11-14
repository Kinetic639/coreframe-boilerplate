import "server-only";
import { cookies } from "next/headers";
import { parseLayout, parseWidths, type ColumnSet } from "./columns";

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

/** A list's columns as the person last left them (their order, shown ones, widths). */
export async function savedColumns(set: ColumnSet<string>, cookie: string) {
  const jar = await cookies();
  return {
    layout: parseLayout(set, cookieValue(jar.get(cookie)?.value)),
    widths: parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set),
  };
}
