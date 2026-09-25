# Zone 1 / Phase 7 — Static Check Results

## Type-check

```
pnpm type-check
```

Result: **clean, 0 errors.**

## Lint

```
pnpm lint
```

Result: **0 errors, 319 warnings.**

All 319 warnings are pre-existing and located exclusively in `apps/web/temp/` — a scaffolding/prototype directory (`temp/cycle-count/`, `temp/warehouse-movement-editor/`) unrelated to Zone 1 or any production code path. Categories:

- `@typescript-eslint/no-unused-vars` (majority — unused imports/variables in prototype files)
- `@next/next/no-img-element` (raw `<img>` tags in prototype files)
- `react-hooks/exhaustive-deps` (1 instance)
- `turbo/no-undeclared-env-vars` (2 instances, `DISABLE_HMR`)
- `prefer-const` (a few instances)

None of these warnings existed in, or were introduced by, any file this phase touched.

## Lint on the 2 files this phase modified, individually

```
pnpm exec eslint \
  src/server/services/__tests__/organization-rls.test.ts \
  src/server/loaders/v2/__tests__/load-app-context.v2.test.ts
```

Result:

```
src/server/loaders/v2/__tests__/load-app-context.v2.test.ts
  94:10  warning  'setupFrom' is defined but never used
  96:3   warning  'arrayCounts' is assigned a value but never used

2 problems (0 errors, 2 warnings)
```

**Both warnings are pre-existing**, in an unrelated part of the file (a `setupFrom`/`arrayCounts` helper near the top of the file, lines 94-96) that this phase's edit did not touch — confirmed by `git diff` showing the only change is the addition of 2 fields to the expected-object literal at the "maps branch data fields correctly" test (originally around line 460). Not introduced by, and not related to, this phase's fix.

`organization-rls.test.ts`: 0 errors, 0 warnings.

## Warning classification summary

| Source                                                     | Count | Pre-existing? | Zone-1-relevant?                                                                   |
| ---------------------------------------------------------- | ----- | ------------- | ---------------------------------------------------------------------------------- |
| `apps/web/temp/**`                                         | 317   | Yes           | No                                                                                 |
| `load-app-context.v2.test.ts` (`setupFrom`, `arrayCounts`) | 2     | Yes           | Technically yes (file is Zone-1-relevant) but unrelated to this phase's own change |

No unrelated warnings were cleaned up, per the task's own explicit "Do not clean unrelated warnings" instruction.
