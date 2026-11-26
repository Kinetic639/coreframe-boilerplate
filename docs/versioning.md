# Wersjonowanie systemu Ambra

Cały system (ERP `apps/web`, strona `apps/public-web`, portal zapytań `apps/requests-portal`,
VMI `apps/vmi-client`) ma **jedną wersję** w formacie SemVer `MAJOR.MINOR.PATCH`. Wszystkie
aplikacje wdrażają się razem z gałęzi `main`, więc dzielą jeden numer. Aplikacja mobilna
(`apps/mobile`) ma własną wersję w `app.json` i nie jest tu objęta.

| Gdzie                                     | Co                                                      |
| ----------------------------------------- | ------------------------------------------------------- |
| `packages/app-version/package.json`       | numer wersji (jedyne źródło)                            |
| `packages/app-version/CHANGELOG.md`       | historia zmian, po polsku, dla użytkowników             |
| `packages/app-version/src/changelog.json` | to samo dla okna „Co nowego” (generowane, nie edytować) |
| `.changeset/*.md`                         | opisy zmian czekające na następne wydanie               |
| tagi `vX.Y.Z` i GitHub Releases           | tworzone automatycznie po wydaniu na `main`             |

## Kiedy który numer

| Typ       | Kiedy                                                                                                                                     | Przykład                                           |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **major** | Rzadko. Duża przebudowa, zmiana sposobu pracy, zmiana API dla integracji (VMI, portal zapytań), coś, co wymaga działań po stronie klienta | nowy model magazynu, nowe logowanie dla wszystkich |
| **minor** | Nowa funkcja lub moduł, który użytkownik zobaczy                                                                                          | Help Desk, etykiety QR ZPL, strefy czasowe         |
| **patch** | Poprawka błędu, drobna zmiana wyglądu, wydajność                                                                                          | linki w powiadomieniach, daty w Europe/Warsaw      |
| pusty     | Zmiana niewidoczna dla użytkownika: testy, CI, dokumentacja, refaktor                                                                     | `ci(e2e): …`, `test(...): …`                       |

Wydanie dostaje najwyższy typ spośród swoich zmian (5 poprawek + 1 nowa funkcja = minor).

## Każdy PR do `development`

PR dodaje jeden plik changesetu. CI (job „Changeset”) nie przepuści PR-a bez niego.

```bash
pnpm changeset          # wybierz @repo/app-version, typ i wpisz zdanie dla użytkowników
pnpm changeset --empty  # zmiana niewidoczna dla użytkowników
```

albo ręcznie, np. `.changeset/help-desk-dialog.md`:

```md
---
"@repo/app-version": minor
---

Help Desk: nowe zgłoszenie otwiera się w okienku z listy, jak przy zadaniach.
```

Opis piszemy po polsku, językiem użytkownika (co się zmieniło dla niego, nie jak to zrobiono w
kodzie), jednym lub dwoma zdaniami. Trafia dosłownie do CHANGELOG, GitHub Release i okna
„Co nowego”.

## Wydanie

1. GitHub → Actions → **Przygotuj wydanie** → Run workflow. Workflow na `development`
   zużywa changesety, podbija wersję, dopisuje `CHANGELOG.md` z datą, commituje
   `chore(release): vX.Y.Z` i otwiera (lub aktualizuje) PR `development → main` „Wydanie vX.Y.Z”.
   Bez zmian typu patch/minor/major nic nie wydaje.
2. Scalenie tego PR-a wdraża `main` na Vercel jak dotąd.
3. Workflow **Oznacz wydanie** tworzy tag `vX.Y.Z` i GitHub Release z sekcją changelogu.

To samo lokalnie: `pnpm release:prepare`, commit, PR do `main`.
`pnpm release:notes [wersja]` wypisuje opis wydania.

Jednorazowe ustawienia repozytorium:

- Settings → Actions → General → Workflow permissions → „Allow GitHub Actions to create and
  approve pull requests” (inaczej krok otwierania PR-a się nie uda).
- Opcjonalnie sekret `RELEASE_TOKEN` (fine-grained token: contents + pull requests write):
  wtedy CI uruchamia się także na samym PR-ze wydania. Z wbudowanym tokenem CI rusza dopiero
  po scaleniu, na `main`.
- Zalecane: Vercel → projekt → Settings → Advanced → **Skew Protection**, żeby otwarte karty
  ze starą wersją nie trafiały na nowy serwer przed odświeżeniem.

## Wersja w aplikacjach

- `next.config.ts` każdej aplikacji ustawia przy budowaniu `NEXT_PUBLIC_APP_VERSION`
  (z `packages/app-version`) i `NEXT_PUBLIC_COMMIT_SHA` (z `VERCEL_GIT_COMMIT_SHA`).
- ERP (`apps/web/src/lib/app-version.ts`): `BUILD_VERSION`, `BUILD_COMMIT`,
  `BUILD_VERSION_LABEL` („1.4.0 (a1b2c3d)”).
  - Pod menu użytkownika w pasku bocznym: „Wersja 1.4.0 (a1b2c3d)”, kliknięcie otwiera „Co nowego”.
    To samo okno jest w menu użytkownika.
  - Po aktualizacji użytkownik raz widzi powiadomienie z linkiem do zmian (ostatnio widziana
    wersja w `localStorage`).
  - Otwarta karta co 5 minut i po powrocie do niej pyta `/api/version`; gdy odpowiada inne
    wdrożenie, prosi o odświeżenie.
  - Zgłoszenia feedbacku platformy zapisują pełną wersję (`context.appVersion`).
