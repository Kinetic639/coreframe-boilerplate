# UX Design Analysis (Problem C)

## What's wrong today

1. **For 0–15 s after the click** the only signal is a disabled switcher button. That reads as "nothing happened", and users click again or navigate away. Navigating away starts a navigate that discards pending state, which makes things worse.
2. **The toast says "success" before anything visible has changed**, then vanishes, then the UI changes 5–10 s later. The user gets a false confirmation, then a silent change.
3. **For a moment the screen is mixed-branch:** after `replace`, the page is B while the sidebar/layout is still A, until `refresh` commits.

## Design

| Moment                            | UI                                                                                                                                                                                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Click (≤100 ms)                   | Switcher trigger shows a spinner and "Switching to **<B>**…". The main content area gets `aria-busy="true"` and a subtle non-blocking dim/progress bar. Switcher items stay disabled (as today). An `aria-live="polite"` announcement: "Switching to <B>" |
| While pending                     | No intermediate success. If still pending after 3 s: secondary text "Still switching…". After 10 s: "This is taking longer than usual" (no cancel; the switch is idempotent server-side and cancelling would be dishonest)                                |
| Commit (branch-B shell on screen) | Pending state clears. `toast.success("Switched to <B>")` fires **now**. Sidebar, header branch name and page all show B together, because it is a single render                                                                                           |
| Failure                           | Pending clears. `toast.error(<safe message>)`. Switcher shows A; nothing else changed                                                                                                                                                                     |
| Cross-branch QR confirm dialog    | Same pending pattern inside the dialog's confirm button ("Switching to <B>…"). The dialog closes on commit, not before                                                                                                                                    |

Rules:

- `react-toastify` only (project policy). Keep the existing `autoClose` (2.5 s). Once the toast fires on commit it no longer needs to be long.
- The pending state is driven by React state owned by the switcher, plus a tiny client "switch in progress" signal. The status bar poll reads that signal to stay quiet during a switch.
- No skeleton replacement of the whole page. The old page stays readable (dimmed) until B commits. Swapping to skeletons would make a 1–3 s switch _feel_ slower and would hide the fact that nothing has changed yet.

## Dashboard as the landing target: product option

Landing on `/dashboard/start` after every switch is a **product choice**, not a technical requirement:

| Option                                                                                          | Pros                                                   | Cons                                                                 |
| ----------------------------------------------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------- |
| **Always `/dashboard/start`** (today; recommended default)                                      | always valid under B; simple; a single redirect target | loses the user's place (e.g. they were in Warehouse → Locations)     |
| Stay on the current route if it is a **list/module root**, go to `/start` for **detail** routes | keeps context for common flows                         | needs a per-route "branch-safe" allowlist; more cases to test        |
| Stay on the current route always                                                                | fastest mental model                                   | detail routes for A-objects break under B (404/denied); **rejected** |

Recommendation: keep `/dashboard/start` for the first implementation. It doesn't affect the performance design, since the redirect target is a parameter. Leave the per-route allowlist as a later product decision.
