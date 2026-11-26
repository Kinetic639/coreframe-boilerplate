# CLAUDE.md

Monorepo Ambra (Turborepo + pnpm). Each app has its own guide, e.g. `apps/web/CLAUDE.md`.

## Versioning (every PR)

Every PR into `development` adds one changeset in `.changeset/` describing the change for
users, in Polish, and its effect on the Ambra version (`@repo/app-version`): `major`, `minor`
(new user-visible feature), `patch` (fix, small UI change), or an empty changeset
(`pnpm changeset --empty`) for changes users do not see. CI fails without one.
Never edit the version, `CHANGELOG.md` or `changelog.json` by hand: the release workflow does.
See `docs/versioning.md`.
