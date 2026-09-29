# Region Change Impact

## What changed

- The Vercel project Function Region moved from `iad1` to `dub1`. The change was made in Vercel project settings: the repo still has no `vercel.json` / `regions` / `preferredRegion`.
- Fluid Compute stayed ON.
- No code changes.

## Why it had this effect (consistent with the design review)

`../branch-switch-performance-design-2026-09-28/vercel-runtime-analysis.md` identified the region as the **single biggest multiplier**:

- The switch path is ~44 **serial** function→Supabase calls. The poll/permission server actions that can queue ahead of it are ~13 and ~4 calls.
- With `iad1` ↔ `eu-west-1`, each call crosses the Atlantic (~0.10–0.15 s). With `dub1` ↔ `eu-west-1`, each call is same-metro (~0.01–0.03 s).
- Browser (Poland) ↔ function latency also drops, from ~110 ms RTT to ~40 ms.

The observed drop from ~15–25 s to ~1–2 s (≈10×+) matches that multiplier. It also shrinks every queued action ahead of the switch and each cold instance's first connection by the same factor.

## What this does and does not prove

| Claim                                                                                                                     | Status                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Region mismatch was a **materially dominant** factor in production latency                                                | **Supported** by the before/after result with no code change                                                                                                       |
| The other hypotheses (H1 action-queue contention, H2 cold starts, H4 token-refresh re-render, H5 Auth latency) were false | **Not proven.** They are all _multiplied_ by per-call latency, so co-location shrinks them too. Their mechanisms, verified in code and Next.js source, still exist |
| The architecture is now efficient                                                                                         | **No.** 44 serial calls, 2 serial renders, 11 `getUser` calls per switch are unchanged. They are now cheap enough not to matter for the demo                       |
| The result holds for other deployments (e.g. a future US-hosted Supabase or a different function region)                  | **Not implied.** Any future topology must keep functions co-located with Supabase                                                                                  |

## Operational rule going forward

Vercel functions **must stay co-located with the Supabase region** (`dub1` ↔ `eu-west-1`). Changing either one without the other reintroduces the multiplier. This belongs in the demo/deployment checklist.
