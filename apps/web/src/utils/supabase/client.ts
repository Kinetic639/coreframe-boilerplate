import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    // Heartbeats from a Web Worker: browsers throttle timers in background tabs, the socket
    // then misses heartbeats, gets closed and live updates stop until it reconnects.
    { realtime: { worker: true } }
  );
