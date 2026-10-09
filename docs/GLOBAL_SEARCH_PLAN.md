# Globalne wyszukiwanie Ambra (Ctrl+K) — plan wdrożenia

> Jedno okno do szukania stron, akcji i danych w całej aplikacji. Otwierane przyciskiem w nagłówku albo Ctrl+K / ⌘K.
> Design (5 ekranów): https://claude.ai/artifact/KuBvUjKLWscBZQPpWEESW7
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                        | Status                           |
| ---- | --------------------------------------------- | -------------------------------- |
| F0   | Fundament: paleta, rejestr źródeł, klawiatura | ✅ gotowe, przetestowane ręcznie |
| F1   | Strony i zakładki                             | ✅ gotowe, przetestowane ręcznie |
| F2   | Akcje (`>`)                                   | ✅ gotowe, przetestowane ręcznie |
| F3   | Rozpoznanie wklejonego ID                     | ✅ gotowe, przetestowane ręcznie |
| F4   | Dane P1 (RPC + indeksy)                       | ✅ gotowe, przetestowane ręcznie |
| F5   | UX wyników: grupy, chipy, podgląd, ostatnie   | ✅ gotowe, przetestowane ręcznie |
| F6   | Telefon + skaner                              | ✅ gotowe, przetestowane ręcznie |
| F7   | Dane P2                                       | ✅ gotowe, przetestowane ręcznie |
| F8   | Ranking i P3                                  | ✅ gotowe, przetestowane ręcznie |

- [x] **F0** — fundament
  - [x] Typ `SearchEntry` + rejestr (`lib/global-search/`)
  - [x] Nowa paleta na `cmdk` zamiast `header-search.tsx` (montowana raz — stara montowała się 2× i Ctrl+K otwierał dwa okna)
  - [x] Ctrl+K / ⌘K przełącza, Esc zamyka, focus wraca na element
  - [x] Stopka ze skrótami, i18n pl/en
  - [x] Testy komponentu (otwieranie, klawiatura, pusty stan)
  - [x] Test ręczny na deployu (2026-10-09)
- [x] **F1** — strony i zakładki
  - [x] Strony z sidebaru + strony spoza menu (mapa, import kartoteki, role, zaproszenia, konto…), polskie etykiety i synonimy
  - [x] Filtr: moduł aktywny (entitlements) + uprawnienia — ten sam resolver co sidebar, po stronie serwera
  - [x] Zaślepki „wkrótce” wyłączone (`SEARCH_EXCLUDED_HREFS`)
  - [x] Zakładki szczegółów jako akcje na wyniku: podgląd zlecenia ma „Zakładka Zamówienia-Przyjęcia” i „Zakładka Magazyn” (`?tab=receiving|stock#warehouse` na stronie zlecenia)
- [x] **F2** — akcje
  - [x] Tryb `>` z grupami modułów, Backspace wraca do wyszukiwania
  - [x] Akcje tworzenia i magazynowe, przełączanie oddziału (każdy oddział osobno), motyw, język, wyloguj
  - [x] Ukrywanie akcji bez uprawnień
- [x] **F3** — rozpoznanie ID
  - [x] Parsery: pełny ZL, sam numer zlecenia, VIN, `HD-`, `PT-`, `PZ/RW/MM/INW/…`, kody (kontener, lokalizacja, SKU, EAN)
  - [x] Server action `findSearchExactHitsAction` — bramki modułu + uprawnień per źródło, zapytania przez RLS, aktywny oddział
  - [x] Grupa „Dokładne trafienie” na górze, zaznaczona od razu → Enter otwiera obiekt, Ctrl+Enter w nowej karcie
  - [x] Testy parserów i palety
  - [x] Kod QR ze skanera (F6)
- [x] **F4** — dane P1
  - [x] Migracja `20261009060958_global_search` (nałożona przez MCP): indeksy trigramowe GIN (`pg_trgm` już był)
  - [x] RPC `search_global` (SECURITY INVOKER, limit na źródło, `%`/`_` w zapytaniu dosłownie)
  - [x] Źródła: zlecenia (też po numerze części na pozycji), części (numer porównywany przez `inventory_sku_fingerprint`, stan w oddziale), kontenery, lokalizacje, dokumenty, zapytania, osoby
  - [x] `globalSearchAction`: jedno wywołanie = dokładne trafienia + wyniki tekstowe, bramki modułu + uprawnień per źródło
  - [x] pgTAP 120: 9/9 na żywej bazie (anon bez EXECUTE, oddział, cudza organizacja, część ze spacjami, `_` dosłownie)
  - [x] Debounce 200 ms, poprzednie wyniki zostają na ekranie do czasu nowych (bez migotania)
  - [x] Wydajność (migracje `20261009062628`, `20261009063706`) — patrz „Wydajność” niżej
- [x] **F5** — UX wyników
  - [x] Limit 5 na grupę + „Pokaż wszystkie: …” → lista modułu z frazą (`?q=` warsztat, `?search=` listy data-view); kontenery bez listy
  - [x] Chipy zakresu i prefiksy (`zl:` `cz:` `k:` `lok:` `dok:` `hd:` `pt:` `@` `>`) — chipy tylko dla źródeł, do których użytkownik ma dostęp; zakres zawęża też zapytanie na serwerze; Backspace na samym prefiksie wraca do wyszukiwania
  - [x] Podświetlanie dopasowania (bez polskich znaków w zapytaniu też: „przyjecie” → „Przyjęcie”)
  - [x] Panel podglądu (desktop ≥ lg): część — stan / zarezerw. / dostępne, lokalizacje w oddziale, otwarte zlecenia z tą częścią; zlecenie — klient, marka, VIN, magazyn, status, liczba pozycji, pierwsze pozycje (`search_preview_item`, `search_preview_repair_order`, SECURITY INVOKER + RLS). Akcje: Otwórz ↵, Nowa karta Ctrl ↵, Kopiuj numer Ctrl ⇧ C, Historia ruchów; → z pola wejścia do akcji, ← z powrotem
  - [x] Ostatnio otwierane w pustym stanie (6 pozycji, localStorage per użytkownik + organizacja, tylko linki `/dashboard/…`)
  - [x] Ctrl+Enter — nowa karta
  - [x] Trafienia w innych oddziałach (zlecenia, lokalizacje, kontenery, dokumenty; tylko oddziały dostępne użytkownikowi) — przycisk przełącza oddział
- [x] **F6** — telefon
  - [x] Pełny ekran, duże cele dotyku (wiersze ≥ 48 px, chipy 36 px), chipy przewijane w poziomie, „Anuluj”
  - [x] Skaner w palecie (ikona przy polu + duży przycisk na dole na telefonie): QR, DataMatrix, Code 128/39, EAN-13/8, UPC-A (zxing-wasm, ładowany przy otwarciu). Etykieta QR Ambry (`…/qr/<token>`) → strona `/qr/[token]` (rozpoznaje cel i oddział); każdy inny kod → pole wyszukiwania → dokładne trafienie
- [x] **F7** — dane P2 (migracja `20261009094004_global_search_more_sources`, te same warstwy: prefiks B-tree „C” → contains z limitem)
  - [x] Kontrahenci CRM (`kh:`) — nazwa, nazwa prawna, NIP/VAT (prefiks po odcisku), e-mail, telefon; rola widoczna w wyniku
  - [x] Dostawcy — to kontrahenci z rolą `supplier` (`crm_party_roles`), w tym samym źródle z oznaczeniem „dostawca”
  - [x] Kontakty CRM (`kon:`) — imię, nazwisko, e-mail, telefon, stanowisko
  - [x] Zadania (`pt:`) — także po treści tytułu, nie tylko po numerze PT-
  - [x] Inwentaryzacje (`inw:`) — numer CNT-…, notatki; link do liczenia
  - [x] Sesje Matchera (`wdd:`) — po nazwie; link do narzędzia (narzędzie nie ma jeszcze adresu pojedynczej sesji)
  - [x] Kody QR (`qr:`) — token, etykieta, typ przypisania; link na `/qr/[token]`
  - [x] Bramki: CRM = moduł + `crm.parties.read` / `crm.contacts.read`; inwentaryzacje = `warehouse.audits.read`; Matcher = `tools.read` (bez modułu, jak w menu); QR = magazyn + `warehouse.locations.read`
- [x] **F8** — ranking i P3 (migracja `20261009094736_global_search_p3_sources`)
  - [x] Ranking według użycia („frecency”): licznik otwarć z wygasaniem (dzień / tydzień / miesiąc), localStorage per użytkownik + organizacja, same identyfikatory. Podnosi strony i akcje w wynikach i w pustym stanie oraz rekordy w obrębie grupy; nigdy nie dodaje wyniku, który nie pasuje
  - [x] Tablice kanban (`tab:`, link `?board=`), mapy magazynu (`mapa:`), typy zgłoszeń (`typ:`, uprawnienie zarządzania), zaproszenia (`zapr:`)
  - [x] Treść komentarzy (`kom:`) i nazwy załączników (`zal:`) — prowadzą do zgłoszenia / zadania / zlecenia; widoczność przez istniejące RLS celu (komentarze wewnętrzne zostają wewnętrzne)
  - [x] Pomiar: 19 źródeł naraz, RLS, prawdziwe tabele — 13–36 ms

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
- Pomiar v1 (RLS, 7 źródeł, 30 tys. części, 20 tys. zleceń): typowo 40–140 ms, szerokie frazy 200–300 ms.

#### Skala produkcyjna (v2, migracja `20261009080116_global_search_prefix_tiers`)

Cel: ~150 tys. zleceń na markę × 5 marek ≈ **750 tys. zleceń w organizacji**, miliony pozycji zleceń, setki tysięcy części, klienci, pracownicy.

Research (najważniejsze wnioski):

- `LIKE/ILIKE` nie są leakproof → pod RLS indeksy GIN/GiST nie są używane ([pgsql-general, Tom Lane](https://www.postgresql.org/message-id/14241.1565725716%40sss.pgh.pa.us), [Postgres RLS gotchas](https://dev.to/olyop/postgres-rls-gotchas-4olm)). Obejście przez `ALTER FUNCTION textlike LEAKPROOF` wymaga superusera → na Supabase niedostępne. Stąd etap kandydatów jako SECURITY DEFINER zwracający tylko id ([Supabase: RLS performance](https://supabase.com/docs/guides/troubleshooting/rls-performance-and-best-practices-Z5Jjwv)).
- Częsty trigram = ogromna lista w GIN; bitmapa budowana w całości zanim zadziała `LIMIT` (zgłoszony przypadek: 45 s indeksem vs 29 ms seq scan + LIMIT — [pgsql-general](https://postgresql.org/message-id/5587F6DD.6000307%40networkz.ch)). Planner wybierze dobrze tylko widząc konkretny wzorzec → dynamiczny SQL z literałami (plan per zapytanie).
- Prefiks identyfikatorów (kody, numery) to zadanie dla B-tree, nie trigramów ([EDB: wybór metody wyszukiwania](https://www.enterprisedb.com/blog/choosing-postgresql-text-search-method)); ERP-y (Odoo) szukają kodu prefiksowo, nazwy przez `ilike` + trigram ([Odoo contributors](https://odoo-community.org/groups/contributors-15/contributors-194297)).
- Gdy baza nie wystarcza: GitLab przechodzi na Elasticsearch („Advanced Search”) dopiero dla przeszukiwania całej instancji i kodu ([GitLab docs](https://archives.docs.gitlab.com/15.7/ee/user/search/advanced_search.html)); Linear trzyma dane lokalnie u klienta (sync engine). Dla naszej skali (≤ kilka mln wierszy na tabelę, filtr organizacja + oddział) Postgres z poniższym podziałem jest wystarczający.

Benchmark etapu kandydatów (tabele tymczasowe, 100 tys. zleceń / 400 tys. pozycji, ciepły cache):

| Zapytanie                           | v1: contains + sortowanie               | prefiks `text_pattern_ops`             | prefiks B-tree `COLLATE "C"` | contains z limitem 300 |
| ----------------------------------- | --------------------------------------- | -------------------------------------- | ---------------------------- | ---------------------- |
| szerokie („kowal”, „WVW”, „TMBZZZ”) | ~51 ms, liniowo (≈400 ms przy 750 tys.) | 35–41 ms (sortuje wszystkie trafienia) | **0,13 ms**                  | **3 ms**, stałe        |
| wąskie („1742”, „17423”)            | 0,1–0,4 ms                              | 0,2–0,3 ms                             | 0,04–0,1 ms                  | 0,4–0,6 ms             |

v2 — warstwy na źródło (najlepsze pierwsze, bez duplikatów):

1. prefiks identyfikatora przez B-tree `COLLATE "C"` z organizacją (+ oddziałem) na początku: nr zlecenia, ZL, VIN, nr zamówienia, odcisk numeru części, kod lokalizacji / kontenera, nr dokumentu, HD- — koszt logarytmiczny, ten sam przy 750 tys.;
2. część na pozycji zlecenia: prefiks odcisku (B-tree „C”), „zawiera” dopiero od 5 znaków, z limitem;
3. „zawiera” (trigramy) z limitem 300 przed rankingiem.

Pomiar całości v2 (RLS, wszystkie 7 źródeł, prawdziwe tabele, 15 tys. zleceń / 60 tys. pozycji / 20 tys. części): **17–52 ms** (te same frazy w v1: do 200–300 ms).

Wdrożenie i infrastruktura:

- **Indeksy na produkcji z dużymi tabelami budować `CREATE INDEX CONCURRENTLY IF NOT EXISTS …` w SQL Editorze przed migracją** (migracja przez MCP działa w transakcji i zablokowałaby zapisy na czas budowy). Migracja znajdzie je jako istniejące.
- **Rozmiar instancji**: obecna baza ma `shared_buffers` 224 MB (instancja Micro). Benchmark przy 750 tys. zleceń / 3 mln pozycji na tej instancji chwilowo ją przeciążył (brak połączeń przez ~1–2 min). Przy danych produkcyjnej skali potrzebna jest większa instancja (min. Small/Medium), żeby indeksy mieściły się w pamięci — dotyczy całej aplikacji, nie tylko wyszukiwania.
- Pełny test na 750 tys. zleceń: na osobnym środowisku (Supabase branch / kopia), nie na produkcji.
- Do zrobienia przy skali wielu dużych organizacji: kolumna `organization_id` w `repair_order_lines` (dziś prefiks numeru części szuka po wszystkich organizacjach i filtruje złączeniem).
- Pozostałość benchmarku do usunięcia w SQL Editorze: `DROP SCHEMA search_bench CASCADE;` (pusta tabela wyników, schemat niewystawiony w API).

## 4. Weryfikacja

- Vitest: parsery ID, rejestr i filtr uprawnień, klawiatura palety.
- pgTAP: `search_global` nie zwraca danych z innej organizacji ani z oddziału bez dostępu.
- Ręcznie na demo: wklejenie ZL, numer części, kontener, HD; użytkownik bez uprawnień do magazynu nie widzi źródeł magazynowych.
- `pnpm type-check` i `pnpm lint` przed commitem.

## 5. Otwarte pytania

- Dokładne nazwy uprawnień dla kontenerów i dokumentów (sprawdzić w `permissions` w F4).
- Czy wyniki z innych oddziałów pokazywać od razu, czy tylko licznik w stopce (design: licznik).
- Rejestracja auta — czy jest zapisywana na zleceniu (jeśli nie, poza zakresem P1).
