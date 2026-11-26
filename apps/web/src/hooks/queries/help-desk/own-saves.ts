/**
 * Tickets this browser saved a moment ago. Realtime then delivers the same
 * change back (the ticket row and its activity entry); the cache already
 * shows it, so those echoes do not refetch anything.
 */
const ECHO_WINDOW_MS = 5_000;
const saves = new Map<string, number>();

export function markOwnTicketSave(ticketId: string, now = Date.now()) {
  saves.set(ticketId, now);
  for (const [id, at] of saves) if (now - at > ECHO_WINDOW_MS) saves.delete(id);
}

export function isOwnTicketSave(ticketId: string | null | undefined, now = Date.now()) {
  if (!ticketId) return false;
  const at = saves.get(ticketId);
  return at !== undefined && now - at <= ECHO_WINDOW_MS;
}

/** For tests. */
export function clearOwnTicketSaves() {
  saves.clear();
}
