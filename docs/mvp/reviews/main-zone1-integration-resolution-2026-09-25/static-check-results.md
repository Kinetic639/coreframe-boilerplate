# Static Check Results

## Type-check

```
pnpm type-check
→ tsc --noEmit
→ exit code 0, zero output (clean)
```

One error was found and fixed during this pass, before this final clean run: `ambra-locations-client.cross-branch.test.tsx`'s `defaultProps` fixture was missing the newly-required `organizationId` prop (4 call sites). Fixed — see `resolved-conflicts.md`/`test-results.md`. No other type errors were found anywhere in the fully-integrated tree.

## Lint

```
pnpm lint
→ 0 errors, 312 warnings
```

All 312 warnings are pre-existing, located exclusively in `apps/web/temp/` (scaffolding/prototype directories: `temp/cycle-count/`, `temp/warehouse-movement-editor/`), unrelated to Zone 1, to main's own independent work, or to this integration — the same category of warning already documented as pre-existing noise in every prior Zone 1 phase's own static-check results (see `docs/mvp/reviews/zone1-phase7-automated-closeout-2026-09-24/static-check-results.md` for the original 319-warning baseline; the count differs slightly here, 312 vs. 319, purely due to which exact `temp/` files happen to be present/touched by the merge — none of the difference is in any Zone 1 or main-side production file).

**Zero new lint errors.**

## Conclusion

Both required static checks pass cleanly on the fully-integrated tree. No new error of any kind was introduced by the conflict resolution.
