# Vercel Runtime Analysis

## What is known

| Fact                                                                             | Status                                                                                                                             | Evidence                                                                                            |
| -------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Supabase target region: eu-west-1 (Ireland)                                      | VERIFIED                                                                                                                           | project host/config (earlier audit)                                                                 |
| No `vercel.json`, no `regions`, no `preferredRegion` / segment config in the app | VERIFIED                                                                                                                           | repo search: neither `vercel.json` nor `apps/web/vercel.json` exists; no `preferredRegion` in `src` |
| Function region                                                                  | **UNVERIFIED**. With no config, Vercel uses the project's Function Region setting, which **defaults to `iad1` (Washington, D.C.)** | Needs the Vercel dashboard (Settings → Functions → Region) or an `x-vercel-id` response header      |
| Where `proxy.ts` (Next 16 middleware) executes                                   | **UNVERIFIED**                                                                                                                     | Same header/log check                                                                               |
| Fluid compute / instance reuse enabled                                           | **UNVERIFIED**                                                                                                                     | Vercel dashboard                                                                                    |
| Cold-start frequency on the UAT deployment                                       | **UNVERIFIED**                                                                                                                     | Vercel function logs ("cold start" / init duration)                                                 |

This environment has no Vercel credentials and no deployment URL, so none of the unverified items can be closed from here. `measurement-plan.md` lists the exact checks.

## Why topology dominates

Every Supabase call on the critical path is **serial** (see `production-critical-path.md`). Per-call latency therefore multiplies directly:

| Function region → Supabase eu-west-1           | Typical per-call (warm keep-alive, HTTPS + tiny query) | 44-call switch | 32-call switch (after single-render) | ~16-call switch (after single-render + dedupe/parallel) |
| ---------------------------------------------- | ------------------------------------------------------ | -------------- | ------------------------------------ | ------------------------------------------------------- |
| `iad1` (default, transatlantic, ~75–90 ms RTT) | ~0.10–0.15 s                                           | **4.4–6.6 s**  | 3.2–4.8 s                            | 1.6–2.4 s                                               |
| `dub1` (Dublin, same metro as eu-west-1)       | ~0.01–0.03 s                                           | 0.4–1.3 s      | 0.3–1.0 s                            | 0.2–0.5 s                                               |

Two more effects scale with distance:

- **A fresh instance pays DNS + TCP + TLS** (≈3 RTT, ~0.25–0.3 s transatlantic) before its first Supabase call.
- **Users are in Poland.** Browser → `iad1` is ~110 ms RTT each way. Browser → `dub1` is ~40 ms. Every one of the 3–4 browser→function requests of a switch pays that.

**Conclusion.** If the function region is the default `iad1`, it is the single biggest multiplier in both problem A and problem B. It is a project setting, not code: one change in Vercel project settings, or `"regions": ["dub1"]` in `vercel.json`. Moving functions to the Supabase region is the standard Vercel + Supabase guidance.

## Cold starts

- The deployment is a low-traffic UAT/demo. Instances idle out between interactions. A branch switch touches several distinct functions:
  - the action POST runs in the function for the **current page's route**;
  - the RSC GET for `/dashboard/start` runs in its own function;
  - with `redirect()`, an internal fetch goes to the same.
- Each cold instance adds roughly 0.5–3 s of Next server init for a bundle this size. It then opens new TLS connections to Supabase.
- The 30-second status-bar poll keeps one route's instance warm (whichever page is open). It does **not** warm the `/dashboard/start` function or other page functions.
- Fluid compute (instance reuse across concurrent requests) reduces this a lot. Whether it is on is UNVERIFIED.

## Middleware (`proxy.ts`)

The proxy runs `updateSession` → `getUser` on every request, including server-action POSTs and RSC GETs.

- If it runs at the edge near the user, e.g. `fra1`/`lhr1`, its `getUser` to eu-west-1 is cheap (~20–40 ms).
- If it runs in the function region, it pays the same transatlantic cost.

Either way, it is 1 call per request, not the dominant term.

## What this analysis does **not** allow

- **Not** claiming region is the proven cause of the 10–15 s. 13 calls at transatlantic latency model to ~1.3–2 s, not 10–15 s. Region is a multiplier. It explains the post-toast phase well; for the pre-toast phase it must combine with queue wait and cold starts (see `server-action-analysis.md`).
- **Not** treating the region move as sufficient. Even in `dub1`, problem C (dishonest success, no feedback) and the queue-wait term are unchanged.
