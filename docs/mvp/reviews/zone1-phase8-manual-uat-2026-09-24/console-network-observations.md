# Zone 1 / Phase 8 — Browser Console / Network Observations

**Status: AWAITING HUMAN UAT for the interactive/authenticated flows** — this agent has no interactive browser (headless terminal environment only), so it cannot observe a live JS console or the DevTools Network tab the way a human tester would during the actual scenarios in Sections 4-17.

## What was observed (dev server terminal log only, not a browser console)

During the desktop route checks in `desktop-browser-results.md`, the Next.js dev server's own terminal output was captured. No uncaught server-side exceptions, no unhandled promise rejections, and no repeated/failing request patterns were observed for the routes actually exercised (home redirect, sign-in render, QR not-found render, dashboard auth-gate redirect). Compile times were normal for a cold dev-server start (26.7s first compile of the sign-in route, 64ms for the already-warm QR route).

This is NOT equivalent to a browser's console/network panel and does not cover:

- Client-side console errors (React warnings, hydration mismatches, uncaught exceptions in browser JS).
- Actual network request/response inspection for authenticated flows (branch switch, QR confirm/cancel, permission-context change).
- Infinite refetch loops or repeated failing requests during real interactive use.

## Action required of the human tester

While executing the scenarios in Sections 4-17 (once the environment exists), keep the browser DevTools Console and Network tabs open and note:

- Any uncaught console errors or React warnings during branch switches, QR flows, or permission-context changes.
- Any repeated failing network requests (e.g., a retry loop).
- Any evidence of an infinite refetch loop (the same query firing repeatedly without a triggering user action).
- Any obvious hydration-mismatch warning.
- The specific request/response for `changeBranch`'s server action call during a branch switch, and for the QR resolver's redirect during a QR scan — confirming no unexpected error responses.

Per the task's own instruction: warnings unrelated to the flow under test do not automatically fail UAT — record them, but only escalate genuine flow-breaking errors as findings in `bugs-found.md`.
