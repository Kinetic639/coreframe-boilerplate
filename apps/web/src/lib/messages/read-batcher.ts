/**
 * Marks conversations read on the server at most once per `delay` each.
 *
 * An open conversation asks to be marked read on every incoming message; in a
 * busy chat that was one server call, one write and one "read" signal to every
 * other member per message. The first request goes out at once (the sender
 * sees "read" without a lag); requests during the following `delay` collapse
 * into a single one at its end.
 */
export function createReadBatcher(send: (conversationId: string) => void, delay = 2500) {
  const state = new Map<string, { timer: ReturnType<typeof setTimeout>; again: boolean }>();

  const open = (conversationId: string) => {
    send(conversationId);
    const entry = {
      again: false,
      timer: setTimeout(() => {
        state.delete(conversationId);
        if (entry.again) open(conversationId);
      }, delay),
    };
    state.set(conversationId, entry);
  };

  return {
    request(conversationId: string) {
      const pending = state.get(conversationId);
      if (pending) pending.again = true;
      else open(conversationId);
    },
    /** Sends what is still waiting (the page is being hidden or closed) */
    flush() {
      for (const [conversationId, entry] of state) {
        clearTimeout(entry.timer);
        state.delete(conversationId);
        if (entry.again) send(conversationId);
      }
    },
  };
}
