# Changesets

Każdy PR do `development` dodaje tu jeden plik `.md` z opisem zmiany dla użytkowników
i typem podbicia wersji systemu Ambra (`@repo/app-version`). Szczegóły: `docs/versioning.md`.

```md
---
"@repo/app-version": minor
---

Help Desk: nowe zgłoszenie otwiera się w okienku z listy, jak przy zadaniach.
```

- `major` – duża zmiana, która wymaga uwagi użytkowników lub integracji,
- `minor` – nowa funkcja widoczna dla użytkownika,
- `patch` – poprawka, drobna zmiana wyglądu, wydajność.

Zmiana niewidoczna dla użytkownika (testy, CI, dokumentacja, refaktor): `pnpm changeset --empty`.
