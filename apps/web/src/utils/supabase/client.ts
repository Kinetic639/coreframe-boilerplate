import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    // trim(): a key pasted with a trailing newline breaks only Realtime (the newline ends up
    // in the websocket URL and the socket is rejected), REST keeps working.
    process.env.NEXT_PUBLIC_SUPABASE_URL!.trim(),
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!.trim(),
    // Heartbeats from a Web Worker: browsers throttle timers in background tabs, the socket
    // then misses heartbeats, gets closed and live updates stop until it reconnects.
    { realtime: { worker: true } }
  );
