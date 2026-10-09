# Globalne wyszukiwanie Ambra (Ctrl+K) — plan wdrożenia

> Jedno okno do szukania stron, akcji i danych w całej aplikacji. Otwierane przyciskiem w nagłówku albo Ctrl+K / ⌘K.
> Design (5 ekranów): https://claude.ai/artifact/UEn159tzoFc16ximVo3oSS
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                        | Status                               |
| ---- | --------------------------------------------- | ------------------------------------ |
| F0   | Fundament: paleta, rejestr źródeł, klawiatura | ✅ kod + testy, czeka na test ręczny |
| F1   | Strony i zakładki                             | ✅ kod + testy, czeka na test ręczny |
| F2   | Akcje (`>`)                                   | ✅ kod + testy, czeka na test ręczny |
| F3   | Rozpoznanie wklejonego ID                     | ✅ kod + testy, czeka na test ręczny |
| F4   | Dane P1 (RPC + indeksy)                       | ✅ kod + testy, czeka na test ręczny |
| F5   | UX wyników: grupy, chipy, podgląd, ostatnie   | ⬜                                   |
| F6   | Telefon + skaner                              | ⬜                                   |
| F7   | Dane P2                                       | ⬜                                   |
| F8   | Ranking i P3                                  | ⬜                                   |

- [x] **F0** — fundament
  - [x] Typ `SearchEntry` + rejestr (`lib/global-search/`)
  - [x] Nowa paleta na `cmdk` zamiast `header-search.tsx` (montowana raz — stara montowała się 2× i Ctrl+K otwierał dwa okna)
  - [x] Ctrl+K / ⌘K przełącza, Esc zamyka, focus wraca na element
  - [x] Stopka ze skrótami, i18n pl/en
  - [x] Testy komponentu (otwieranie, klawiatura, pusty stan)
  - [ ] Test ręczny na deployu
- [x] **F1** — strony i zakładki
  - [x] Strony z sidebaru + strony spoza menu (mapa, import kartoteki, role, zaproszenia, konto…), polskie etykiety i synonimy
  - [x] Filtr: moduł aktywny (entitlements) + uprawnienia — ten sam resolver co sidebar, po stronie serwera
  - [x] Zaślepki „wkrótce” wyłączone (`SEARCH_EXCLUDED_HREFS`)
  - [ ] Zakładki szczegółów (np. zlecenie → Magazyn) jako akcje na wyniku → przeniesione do F5
- [x] **F2** — akcje
  - [x] Tryb `>` z grupami modułów, Backspace wraca do wyszukiwania
  - [x] Akcje tworzenia i magazynowe, przełączanie oddziału (każdy oddział osobno), motyw, język, wyloguj
  - [x] Ukrywanie akcji bez uprawnień
- [x] **F3** — rozpoznanie ID
  - [x] Parsery: pełny ZL, sam numer zlecenia, VIN, `HD-`, `PT-`, `PZ/RW/MM/INW/…`, kody (kontener, lokalizacja, SKU, EAN)
  - [x] Server action `findSearchExactHitsAction` — bramki modułu + uprawnień per źródło, zapytania przez RLS, aktywny oddział
  - [x] Grupa „Dokładne trafienie” na górze, zaznaczona od razu → Enter otwiera obiekt, Ctrl+Enter w nowej karcie
  - [x] Testy parserów i palety
  - [ ] Kod QR ze skanera → F6
- [x] **F4** — dane P1
  - [x] Migracja `20261009060958_global_search` (nałożona przez MCP): indeksy trigramowe GIN (`pg_trgm` już był)
  - [x] RPC `search_global` (SECURITY INVOKER, limit na źródło, `%`/`_` w zapytaniu dosłownie)
  - [x] Źródła: zlecenia (też po numerze części na pozycji), części (numer porównywany przez `inventory_sku_fingerprint`, stan w oddziale), kontenery, lokalizacje, dokumenty, zapytania, osoby
  - [x] `globalSearchAction`: jedno wywołanie = dokładne trafienia + wyniki tekstowe, bramki modułu + uprawnień per źródło
  - [x] pgTAP 120: 9/9 na żywej bazie (anon bez EXECUTE, oddział, cudza organizacja, część ze spacjami, `_` dosłownie)
  - [x] Debounce 200 ms, poprzednie wyniki zostają na ekranie do czasu nowych (bez migotania)
  - [x] Wydajność (migracje `20261009062628`, `20261009063706`) — patrz „Wydajność” niżej
- [ ] **F5** — UX wyników
  - [ ] Grupy z licznikami, limit + „Pokaż wszystkie”
  - [ ] Chipy zakresu i prefiksy (`zl:` `cz:` `k:` `lok:` `dok:` `hd:` `@` `>`)
  - [ ] Podświetlanie dopasowania
  - [ ] Panel podglądu (część, zlecenie) + akcje na wyniku (→)
  - [ ] Ostatnio otwierane w pustym stanie
  - [ ] Ctrl+Enter — nowa karta
  - [ ] Informacja o trafieniach w innych oddziałach
- [ ] **F6** — telefon
  - [ ] Pełny ekran, duże cele dotyku, chipy przewijane w poziomie
  - [ ] Przycisk skanowania QR / kodu kreskowego → rozpoznanie ID
- [ ] **F7** — dane P2
  - [ ] Kontrahenci i kontakty (CRM)
  - [ ] Dostawcy
  - [ ] Zadania (Planowanie)
  - [ ] Inwentaryzacje
  - [ ] Sesje Matchera
  - [ ] Kody QR
- [ ] **F8** — ranking i P3
  - [ ] Ranking według częstości / ostatniego użycia
  - [ ] Tablice kanban, mapy magazynu, typy zgłoszeń, zaproszenia
  - [ ] Treść komentarzy i nazwy załączników (pełnotekstowo)

---

## 1. Cel i zasady

- **Jedno okno** do wszystkiego: strony, akcje, rekordy, osoby.
- **Klawiatura najpierw**: ↑↓ wybór, Enter otwiera, Ctrl+Enter nowa karta, → akcje wyniku, Tab następna grupa, Esc zamyka.
- **Wklejony numer = od razu obiekt** (ZL, VIN, PZ, K-, HD-, kod QR).
- **Bezpieczeństwo w dwóch warstwach**: źródło bez uprawnienia nie jest w ogóle odpytywane; zapytania idą jako użytkownik, więc RLS w bazie odcina resztę.
- **Kontekst oddziału**: dane operacyjne domyślnie z aktywnego oddziału; osoby, CRM i dostawcy — cała organizacja.
- **Bez zaślepek**: strony „wkrótce” nie trafiają do wyników, dopóki nie działają.

Wzorce z innych aplikacji (research): GitHub i GitLab (paleta i prefiksy), Linear i Stripe (skok do ID), Shopify (limit wyników na grupę), Odoo i NetSuite (prefiksy w ERP), Superhuman (akcje ze skrótami, ranking według użycia).

## 2. Źródła wyszukiwania

### Dane P1 (demo / pilot)

| Źródło        | Szukane po                                                                | Wiersz pokazuje                   | Prefiks | Zakres         | Uprawnienie                   |
| ------------- | ------------------------------------------------------------------------- | --------------------------------- | ------- | -------------- | ----------------------------- |
| Zlecenia (ZL) | numer, pełny `ZL/…/BL`, VIN, rejestracja, klient, numer części na pozycji | klient, auto, magazyn DMS, status | `zl:`   | oddział        | `workshop.repair_orders.read` |
| Części        | numer (bez spacji/myślników), nazwa, EAN, numer dostawcy                  | stan, dostępne, lokalizacja       | `cz:`   | oddział (stan) | `warehouse.products.read`     |
| Kontenery     | `K-…`, kod QR                                                             | lokalizacja, pozycje, zlecenie    | `k:`    | oddział        | `warehouse.*` (do ustalenia)  |
| Lokalizacje   | kod, nazwa, grupa, QR                                                     | ilość towaru, strefa              | `lok:`  | oddział        | `warehouse.locations.read`    |
| Dokumenty     | PZ/RW/MM/WZ/korekty, nr WDD                                               | typ, data, pozycje, zlecenie      | `dok:`  | oddział        | `warehouse.movements.read`    |
| Zapytania     | `HD-…`, tytuł, zlecenie, zgłaszający                                      | status, prowadzący                | `hd:`   | oddział        | `helpdesk.tickets.read`       |
| Osoby         | imię, nazwisko, e-mail, stanowisko                                        | rola, oddział                     | `@`     | organizacja    | członkostwo w org             |

Uprawnienia w kodzie (`SOURCE_GATES` w `app/actions/global-search`): kontenery i dokumenty — `warehouse.inventory.read`; osoby — `members.read` (link prowadzi na stronę członka).

### Dane P2

Kontrahenci i kontakty (CRM: nazwa, NIP, telefon, e-mail) · Dostawcy (nazwa, NIP, kod) · Zadania (`PT-…`, tytuł, osoba) · Inwentaryzacje (numer, lokalizacja, data) · Sesje Matchera (plik, nr WDD, data) · Kody QR (treść kodu → cel).

### Dane P3

Tablice kanban · mapy magazynu · typy zgłoszeń · zaproszenia · treść komentarzy i nazwy załączników.

### Strony i zakładki (statyczne)

- **Magazyn**: Stany, Ruchy, Kartoteka, Import kartoteki, Pola własne, Lokalizacje, Mapa, Rozlokowanie, Inwentaryzacje, Raport uzupełnień, Ustawienia.
- **Warsztat**: Lista zleceń, Nowe zlecenie, Import z Matchera; zakładki zlecenia: Pozycje, Magazyn, Zamówienia/Przyjęcia, Załączniki.
- **Help Desk**: Zapytania, Nowe zapytanie, Typy zgłoszeń, Ustawienia.
- **CRM**: Kontakty, Kontrahenci, Ustawienia.
- **Planowanie**: Zadania, Tablice, Kalendarz, Ustawienia.
- **Organizacja**: Profil, Profil publiczny, Oddziały (+ Magazyny DMS), Członkowie, Zaproszenia, Role, Stanowiska, Rozliczenia.
- **Analityka**: Aktywność, Audyt. **Konto**: Profil, Preferencje. **Narzędzia**: każde z `tools/[slug]`.
- **Pominięte (zaślepki)**: strona główna Magazynu, Klienci, Dostawy, **Dostawcy**, Zakupy, Zamówienia zakupu, Sprzedaż, Zamówienia sprzedaży, Korekty, Skanowanie dostaw, Alerty, Etykiety.

### Akcje (`>`)

- **Tworzenie**: nowe zlecenie, zapytanie, zadanie, ruch, część, kontakt, inwentaryzacja; zaproś osobę.
- **Magazyn**: Przyjęcie PZ z Matchera, Import zleceń z Matchera, Rozlokuj dostawę, Przenieś kontener, Wydaj części (RW), Skanuj kod.
- **Kontekst**: zmień oddział (każdy oddział osobno), przełącz motyw, zmień język, wyloguj.
- **Na wyniku (→)**: otwórz, otwórz w nowej karcie, kopiuj numer, historia ruchów, zakładka Magazyn.

## 3. Architektura

### Rejestr źródeł

```ts
type SearchSource = {
  id: string; // "workshop.repair_orders"
  group: string; // klucz i18n nagłówka grupy
  prefix?: string; // "zl:"
  permission?: string; // sprawdzane przez can()
  module?: string; // aktywny moduł / entitlement
  kind: "static" | "remote"; // strony/akcje vs dane z bazy
  limit: number; // wyników w trybie „Wszystko”
};
```

- **Statyczne** (strony, akcje): filtrowane po stronie klienta, `cmdk` + fuzzy match z synonimami, bez sieci.
- **Zdalne** (dane): jedna server action `globalSearchAction(query, scopes)` → RPC.

### Baza

- Migracja addytywna (bez DROP — przechodzi przez MCP): `CREATE EXTENSION IF NOT EXISTS pg_trgm` + indeksy GIN `gin_trgm_ops` na polach wyszukiwania (numer zlecenia, VIN, numer części, nazwa części, kod lokalizacji, numer dokumentu, tytuł zgłoszenia).
- Numery części porównywane po normalizacji (bez spacji, myślników, wielkość liter) — kolumna generowana albo wyrażenie w indeksie.
- RPC `search_global(p_org, p_branch, p_query, p_scopes text[], p_limit int)` — **SECURITY INVOKER**, więc RLS działa jak przy zwykłym odczycie. Zwraca `jsonb` pogrupowany per źródło: `{ id, type, title, subtitle, href, badge, matched }`.
- Server action przed wywołaniem odcina źródła bez uprawnienia (`PermissionServiceV2`).

### Rozpoznanie ID (F3)

Wzorce sprawdzane przed wyszukiwaniem tekstowym, w kolejności: kod QR → pełny `ZL/…` (`parseRepairOrderNumber`) → VIN (17 znaków, bez I/O/Q) → `K-…` → `HD-…` / `PT-…` → `PZ|RW|MM|WZ/…` → sam 6-cyfrowy numer zlecenia → numer części. Trafienie = karta „Dokładne trafienie” na górze; reszta wyników nadal pod spodem.

### Klient

- Zastępuje [header-search.tsx](../apps/web/src/components/v2/layout/header-search.tsx) (dziś tylko moduły, etykiety po angielsku); `cmdk` i `components/ui/command.tsx` są już w projekcie.
- Debounce ~150 ms, anulowanie poprzedniego zapytania, cache ostatnich wyników (TanStack Query).
- Ostatnio otwierane: lokalnie per użytkownik + organizacja (do 8 pozycji).

### Wydajność (zmierzone 2026-10-09)

- **Problem**: pod RLS Postgres nie może sprawdzić `ILIKE` indeksem przed politykami (operator nie jest leakproof) — liczył `has_branch_permission()` dla każdego wiersza tabeli. 3 tys. zleceń: ~620 ms na zapytanie, nawet bez trafień.
- **Rozwiązanie — dwa etapy**: `search_global_candidates()` (SECURITY DEFINER, tylko id + ranking, odmawia osobom spoza organizacji) znajduje kandydatów indeksami trigramowymi; `search_global()` (SECURITY INVOKER) czyta ich po kluczu głównym i **RLS decyduje** o każdym wierszu — liczony dla kilkudziesięciu wierszy zamiast całej tabeli.
- Fragmenty krótsze niż 3 znaki nie są szukane (indeks trigramowy ich nie obsłuży); kandydaci zbierani `UNION` per indeks zamiast `OR`; stan części liczony po `LIMIT`.
- Serwer aplikacji przerywa wyszukiwanie tekstowe po 3 s; dokładne trafienia przychodzą niezależnie. Baza ma twardy limit 8 s dla roli `authenticated`.
- **Pomiar** (jako zalogowany użytkownik, RLS, wszystkie 7 źródeł, 30 tys. części, 20 tys. zleceń, 80 tys. pozycji, 10 tys. lokalizacji): typowo **40–140 ms**; frazy pasujące do tysięcy rekordów („WVWZZZ” = każde zlecenie) 200–300 ms; zimny cache po masowym imporcie jednorazowo ~1,3 s.
- Do obserwacji przy większej skali: sortowanie bardzo szerokich trafień (ranking po nazwie części) — jeśli zacznie przeszkadzać, ranking bez pełnego sortowania.

## 4. Weryfikacja

- Vitest: parsery ID, rejestr i filtr uprawnień, klawiatura palety.
- pgTAP: `search_global` nie zwraca danych z innej organizacji ani z oddziału bez dostępu.
- Ręcznie na demo: wklejenie ZL, numer części, kontener, HD; użytkownik bez uprawnień do magazynu nie widzi źródeł magazynowych.
- `pnpm type-check` i `pnpm lint` przed commitem.

## 5. Otwarte pytania

- Dokładne nazwy uprawnień dla kontenerów i dokumentów (sprawdzić w `permissions` w F4).
- Czy wyniki z innych oddziałów pokazywać od razu, czy tylko licznik w stopce (design: licznik).
- Rejestracja auta — czy jest zapisywana na zleceniu (jeśli nie, poza zakresem P1).
