import type { RequestAttachment, RequestComment, RequestListItem } from "@/server/requests/types";

type Result = { ok: true } | { ok: false; error: string };

async function send(url: string, body: FormData): Promise<Result> {
  try {
    const res = await fetch(url, { method: "POST", body });
    if (res.ok) return { ok: true };
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: data.error ?? "generic" };
  } catch {
    return { ok: false, error: "generic" };
  }
}

/**
 * Thread endpoints (src/app/api/requests). Plain fetch, not Server Actions, so a reply or an
 * edit never makes Next re-render the route (no scroll jump, no skeletons).
 */
export const threadApi = {
  async load(
    ticketId: string
  ): Promise<{ comments: RequestComment[]; attachments: RequestAttachment[] } | null> {
    try {
      const res = await fetch(`/api/requests/${ticketId}/thread`, { cache: "no-store" });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },
  async list(
    query: Record<string, string>
  ): Promise<{ items: RequestListItem[]; total: number } | null> {
    try {
      const res = await fetch(`/api/requests/list?${new URLSearchParams(query)}`, {
        cache: "no-store",
      });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  },
  post: (ticketId: string, body: FormData) => send(`/api/requests/${ticketId}/comments`, body),
  edit: (ticketId: string, commentId: string, body: FormData) =>
    send(`/api/requests/${ticketId}/comments/${commentId}`, body),
};
