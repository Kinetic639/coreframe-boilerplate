import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import type { PushDevice } from "@/lib/push/types";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith("https://").max(2000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});

const saveSchema = z.object({
  subscription: subscriptionSchema,
  standalone: z.boolean().optional(),
  /** The subscription this one replaces (pushsubscriptionchange) */
  oldEndpoint: z.string().max(2000).nullable().optional(),
});

const deleteSchema = z.union([
  z.object({ id: z.string().uuid() }),
  z.object({ endpoint: z.string().max(2000) }),
]);

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? supabase : null;
}

/** The signed-in user's devices with push switched on */
export async function GET() {
  const supabase = await signedIn();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("push_subscriptions_mine" as never);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ devices: (data ?? []) as PushDevice[] });
}

/** Saves this browser's subscription (the app and the service worker call it) */
export async function POST(request: Request) {
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const supabase = await signedIn();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { subscription, standalone, oldEndpoint } = parsed.data;
  if (oldEndpoint && oldEndpoint !== subscription.endpoint) {
    await supabase.rpc("push_subscription_delete" as never, { p_endpoint: oldEndpoint } as never);
  }
  const { data, error } = await supabase.rpc(
    "push_subscription_save" as never,
    {
      p_endpoint: subscription.endpoint,
      p_p256dh: subscription.keys.p256dh,
      p_auth: subscription.keys.auth,
      p_user_agent: request.headers.get("user-agent")?.slice(0, 500) ?? null,
      p_standalone: standalone ?? false,
    } as never
  );
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ id: data as string });
}

/** Removes one of the user's devices (by id from the list, or this browser's endpoint) */
export async function DELETE(request: Request) {
  const parsed = deleteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const supabase = await signedIn();
  if (!supabase) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const input = parsed.data as { id?: string; endpoint?: string };
  const args = input.id ? { p_id: input.id } : { p_endpoint: input.endpoint };
  const { error } = await supabase.rpc("push_subscription_delete" as never, args as never);
  if (error) return NextResponse.json({ error: "Failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
