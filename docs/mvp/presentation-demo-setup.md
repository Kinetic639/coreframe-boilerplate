# Ambra — środowisko prezentacji (dzień prezentacji)

> **Stan na 15.10.2026**, sprawdzony w bazie produkcyjnej. Scenariusz: [`ambra-skrypt-prezentacji.md`](ambra-skrypt-prezentacji.md). Status i znane problemy: [`mvp-readiness.md`](mvp-readiness.md). Poprzednia wersja tego pliku (dane z 29–30.09, potem zresetowane) jest w historii gita.

## Lista kontrolna — dzień prezentacji

**Przed wyjściem**

- [ ] Na produkcji jest najnowszy `main` (m.in. poprawka strony zlecenia `58ac8ede`) — otworzyć dowolne zlecenie i przełączyć zakładki.
- [ ] Hasła kont demo zmienione (padały w rozmowie roboczej) i znane prowadzącemu.
- [ ] Vercel: region funkcji **`dub1`** (Dublin), Supabase `eu-west-1` — inaczej przełączanie oddziałów trwa 15–25 s.
- [ ] Na kontach demo aktywny oddział **CNP Poznań** — tylko tam są dane (patrz niżej).
- [ ] Dane zleceń przejrzane pod kątem prawdziwych danych klientów (patrz „Uwaga” niżej).

**Na miejscu**

- [ ] Telefon: HTTPS, uprawnienie do aparatu, światło przy skanowaniu QR.
- [ ] Etykiety QR lokalizacji wydrukowane (testowane telefonem 30.09) i pod ręką.
- [ ] Zalogowane konta: prezenter na laptopie, druga osoba na drugim urządzeniu (jeśli pokazujesz tickety lub czat).

**Na scenie**

- Oddział przełączaj **tylko z Pulpitu** (`/dashboard/start`) — z innych stron przełączanie się zawiesza.
- Jeśli po zalogowaniu zostaje formularz, a adres to `/dashboard/start` — odśwież (F5).
- Przed każdym krokiem rzuć okiem na oddział w nagłówku: w CNP Piaseczno listy są puste.

## Organizacja i oddziały

| Element     | Wartość                                                                                     |
| ----------- | ------------------------------------------------------------------------------------------- |
| Aplikacja   | `https://app.ambra-system.com`                                                              |
| Baza        | Supabase `rjeraydumwechpjjzrus` (produkcja)                                                 |
| Organizacja | **Grupa Cichy-Zasada – CNP** (`2c5aa49a-cc3d-4166-8c5f-f6c94307103f`), plan Professional    |
| Oddział     | **CNP Poznań** (`cc67f108-33f1-4e80-98a4-15fc799d1a41`) — **wszystkie dane demo**           |
| Oddział     | **CNP Piaseczno** (`5f1d2311-99c0-44b9-9f24-3af573a3af36`) — pusty (lokalizacje bez stanów) |

## Konta

| Konto                                  | Osoba (w aplikacji) | Role                                                                |
| -------------------------------------- | ------------------- | ------------------------------------------------------------------- |
| `michal.stepien36+presenter@gmail.com` | Prezenter Demo      | `org_owner`, Obsługa zapytań (CNP Poznań)                           |
| `michal.stepien36+warehouse@gmail.com` | Janica Kowalska     | `org_member`, Magazynier (CNP Poznań), Obsługa zapytań (CNP Poznań) |
| `michal.stepien36+advisor@gmail.com`   | Marcin Kowalski     | `org_member`, Doradca                                               |
| `michal.stepien36+helpdesk@gmail.com`  | Kacper Kowalski     | `org_member`, Zgłaszający (Help Desk)                               |

Hasła nie są zapisywane w repozytorium.

Do pokazania kontroli dostępu przy wzmiankach: magazynier **nie ma dostępu do zleceń naprawy** (brak uprawnień warsztatowych), więc wzmianka zlecenia wysłana przez prezentera wyświetla się u niego jako „brak dostępu” — sprawdzone na żywo 14.10.

## Dane (CNP Poznań, stan 15.10)

- **29 części** ze stanem, **17 zleceń naprawy** (wszystkie otwarte, z 12–14.10), **11 kontenerów**, **31 ruchów magazynowych** (ostatni 14.10), **2 zgłoszenia**, **3 zadania**, **3 rozmowy**.
- **Brak kontrahentów** — dwaj dostawcy z września (VW Group Polska, hurtownia lakiernicza) zniknęli przy resecie. Jeśli scenariusz pokazuje dostawcę przy części, trzeba ich dodać.
- Dane powstały podczas prób 12–14.10 (import z Matchera, przyjęcia, rozkładanie). Zostają jak są — decyzja właściciela produktu z 14.10.

> **Uwaga — dane osobowe.** Część zleceń ma nazwiska i numery klientów wyglądające na prawdziwe (np. osoby prywatne z numerem kontrahenta w nawiasie) — prawdopodobnie z prawdziwych dokumentów użytych w Matcherze. Przed pokazaniem obcej publiczności przejrzyj listę zleceń i w razie potrzeby pokazuj tylko zlecenia firm albo użyj zleceń testowych.

**Lokalizacje** (ten sam układ w obu oddziałach, kody unikalne w oddziale):

| Kod                     | Nazwa                                                                                                   |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| `PRZ`                   | Strefa przyjęć dostaw (**lokalizacja przyjęć**)                                                         |
| `MC`                    | Magazyn części blacharskich                                                                             |
| `MC/R01` (`R01-A..C`)   | Regał R01: drobnica i elementy mocujące                                                                 |
| `MC/R02` (`R02-A..C`)   | Regał R02: oświetlenie i lusterka                                                                       |
| `MC/R03` (`R03-A..B`)   | Regał R03: atrapy, listwy, osłony                                                                       |
| `MC/GAB`                | Strefa gabarytów: `GAB-01` zderzaki, `GAB-02` błotniki, `GAB-03` maski i drzwi                          |
| `MC/ZLC` (`ZLC-01..03`) | Regał zleceń: części skompletowane                                                                      |
| `LAK`                   | Magazyn lakierni: `LAK-A` lakiery i utwardzacze, `LAK-B` podkłady i szpachle, `LAK-C` ścierniwa i taśmy |
| `ZWR`                   | Zwroty i reklamacje                                                                                     |

## Znane błędy rejestracji i wdrażania (z 29.09, nadal nie naprawione)

1. **Onboarding can't create an organization:** `create_organization_for_current_user` inserts `branches` without the NOT NULL `branch_number`.
2. **Auth email links 404:** confirmation and recovery links point to `https://www.ambra-system.com/auth/confirm…`, which returns 404. The same path on `app.ambra-system.com` works. Likely fix: set `NEXT_PUBLIC_SITE_URL=https://app.ambra-system.com` in Vercel.
3. **Roles page can't assign module permissions.** The permission picker lists only Organization Management permissions.
4. **Permission compile fails on overlapping wildcards.** `compile_user_permissions` hits "ON CONFLICT DO UPDATE command cannot affect row a second time" when a role's wildcard (e.g. `helpdesk.*`) expands to a slug that `org_member` grants explicitly. `accept_invitation_and_join_org` hides this as `INTERNAL_ERROR`.
5. **Invitation sign-up shows a false error.** After a successful invitation sign-up, the redirect back to `/rejestracja` drops the `invitation` param, so the page shows "Registration disabled".
6. Org-scoped roles give no branch access without `branches.view.any`, so users see "No accessible branch". This is expected by design but easy to miss when creating roles.
7. `org_member` alone makes Warehouse, Planning and CRM appear in the sidebar for the Help Desk user. Review before the demo if that user is shown.

## Urządzenia

- **Laptop** — główne urządzenie: Matcher, zlecenia, wyszukiwanie, przeniesienia, wydanie, tickety.
- **Telefon** — skanowanie QR lokalizacji i kontenerów, mobilne rozkładanie („Do rozlokowania”), ewentualnie QR ticketu. Sprawdzić na miejscu prezentacji: aparat, HTTPS, światło.
- **Drukarka** — tylko jeśli drukowanie etykiet ma być pokazane na żywo; w przeciwnym razie etykiety są wydrukowane wcześniej.

## Topologia wdrożenia (wymagana dla szybkości)

- **Region funkcji Vercel: `dub1` (Dublin). Supabase: `eu-west-1`. Fluid Compute: włączone** (potwierdzone 29.09).
- Funkcje muszą być blisko bazy: przy dawnym regionie `iad1` przełączenie oddziału trwało 15–25 s, przy `dub1` 1–2 s.
- Przed prezentacją sprawdzić, że żaden region się nie zmienił.
