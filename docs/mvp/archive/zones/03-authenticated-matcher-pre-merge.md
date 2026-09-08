### 3. Matcher zalogowany → trwała sesja → przygotowanie danych do dalszego przetwarzania

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

Zalogowany Matcher jest funkcjonalnie tożsamy z publicznym (dosłownie te same pliki akcji/serwisu i ten sam silnik parsera/matchera — różni się wyłącznie tym, że dodatkowo zapisuje wynik do bazy) i realnie zapisuje sesję, pliki, bloki i linie w sposób odtwarzalny wyłącznie z backendu. To nie jest fasada z pustą bazą pod spodem. Jednocześnie prześledzenie całej ścieżki zapisu ujawniło konkretne, potwierdzone w kodzie braki kompletności i niezawodności — nie tylko brak świeżej weryfikacji ręcznej — więc status nie może przekroczyć PARTIAL.

**Dowody:**

- Kod: VERIFIED — prześledzono cały pipeline od uploadu, przez `insertBlocks`/`insertLines`/`insertBlockMatches`, po odczyt zapisanej sesji (`getSessionExtractedDataAction`/`getSessionResultsAction`) oraz granicę importu do ruchu `101` (`getMovementImportCandidates`, adapter). Potwierdzono parytet z publicznym Matcherem (identyczne pliki `wdd-matcher.ts`/`wdd-matcher.service.ts` między `apps/web` a `apps/public-web` — `diff` bez różnic) oraz to, co dokładnie trafia do każdej z sześciu tabel.
- Testy automatyczne: PARTIAL — granica importu do ruchu 101 ma sensowne pokrycie na zamockowanych danych (`wdd-matcher-movement-import-candidates.test.ts`, `inventory-movement-import-preview.service.test.ts`, `movement-import-boundary.test.ts` — dokładnie przypinają mapowanie pól i kontrakt metadanych). Zero testów właściwej ścieżki zapisu (`createSession`, `persistPreparedSessionAction`, `insertBlocks`/`insertLines`), zero testów odtworzenia sesji wyłącznie z bazy po odświeżeniu/ponownym otwarciu, zero testów zachowania przy częściowej awarii lub podwójnym zapisie.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby tej ścieżki na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: upload tych samych dokumentów demo → wynik zgodny z publicznym Matcherem → zapis sesji → odświeżenie/ponowne otwarcie → dane gotowe jako źródło dla późniejszego importu 101.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

- [ ] Zalogowany użytkownik demo otwiera wewnętrzny Matcher w Ambrze (zależność od Strefy 1: właściwa organizacja/oddział muszą być już aktywne).
- [ ] Te same przygotowane dokumenty demo, wgrane do wewnętrznego Matchera, dają wynik parsowania i dopasowania równoważny publicznemu Matcherowi (te same liczby dokładnych/częściowych/niejednoznacznych/niedopasowanych pozycji ze Strefy 2).
- [ ] Powstaje dokładnie jedna trwała sesja we właściwej organizacji i oddziale, przypisana do właściwego użytkownika (`created_by`) — bez duplikatów po jednym przebiegu.
- [ ] Metadane plików źródłowych (nazwa, rola BC/marka, rozmiar) oraz same pliki PDF są zapisane i dostępne w Storage (bucket `wdd-matcher-files`) po zakończeniu przetwarzania.
- [ ] Zapisane linie mają poprawny numer katalogowy/SKU, nazwę, jednostkę i ilość zgodne z dokumentami fizycznymi (`wdd_matcher_lines.product_code`/`product_name`/`unit`/`quantity` — kolumny strukturalne, nie tekst).
- [ ] Lokalizacja z dokumentu (jeśli obecna) jest zapisana w dedykowanej kolumnie (`wdd_matcher_lines.location`), nie tylko w tekście.
- [ ] Numer zlecenia/WDD/ZL/ZW z dokumentów jest zachowany i możliwy do odczytania z zapisanej sesji — **ze świadomością, że jest to dziś klucz w polu JSONB `metadata`, nie osobna, wymuszona przez bazę kolumna** (właściwy trwały model zlecenia to zakres Strefy 4, nie tej strefy).
- [ ] Wynik dopasowania na poziomie bloku jest zapisany (`wdd_matcher_block_matches` — typ dopasowania, pewność, powód) i widoczny po ponownym otwarciu sesji.
- [ ] Prezenter wie i uwzględnia w scenariuszu, że **dopasowania na poziomie pojedynczej linii nie są dziś w ogóle zapisywane** (`wdd_matcher_line_matches` nie ma żadnej ścieżki zapisu) — jeśli pokaz sugeruje szczegółowość na poziomie linii, nie może polegać na trwałości tego szczegółu.
- [ ] Niedopasowane pozycje BC i niedopasowane zlecenia marki (`unmatched_bc`/`unmatched_brand`) są widoczne w zapisanym podsumowaniu dopasowania (`match_summary`), nie tylko w wyniku „na żywo" z pierwszego przebiegu.
- [ ] Odświeżenie strony po zapisie nie gubi wyniku — dane pochodzą z zapytań do bazy, nie z pamięci przeglądarki.
- [ ] Sesję można ponownie otworzyć z listy sesji w interfejsie, na tym samym lub innym urządzeniu/przeglądarce.
- [ ] Ponownie otwarta sesja odtwarza pełny wynik (pliki, bloki, linie, dopasowania) wyłącznie z danych backendu — bez ukrytej zależności od stanu oryginalnej karty przeglądarki, w której wykonano upload.
- [ ] Zapisane dane odpowiadają temu, czego oczekuje istniejąca granica importu do ruchu 101 (`getMovementImportCandidates`/adapter) — dla przygotowanej sesji demo sprawdzono, że sesja pojawia się jako kandydat do importu (status `ready_for_review`/`approved`, właściwy oddział, `created_by` ustawiony), niezależnie od tego, czy sam import 101 zostanie pokazany w tej prezentacji (to ocenia Strefa 6).
- [ ] Nieudany zapis nie wygląda na sukces: sprawdzono na żywo, że przerwane przetwarzanie (np. błąd sieci w trakcie zapisu) skutkuje czytelnym statusem błędu, a nie sesją, która wygląda na ukończoną, ale ma pustą zakładkę wyników.
- [ ] Podwójne kliknięcie/ponowienie zapisu tej samej sesji demo nie tworzy sprzecznych lub zduplikowanych rekordów — sprawdzone celowo na żywo, ponieważ w kodzie nie znaleziono żadnego zabezpieczenia idempotencji (brak unikalnych ograniczeń, zwykłe insert-y).
- [ ] **Dokładny scenariusz pitchu Strefy 3 zweryfikowany ręcznie na aktualnym build:** zalogowany Matcher → przetworzenie przygotowanych dokumentów demo → wynik zgodny z publicznym Matcherem → zapisana trwała sesja → odświeżenie/ponowne otwarcie → wszystkie wymagane dane dostawy/części/zlecenia/dopasowania pozostają dostępne do późniejszego importu w ruchu 101.

**Pitch gap:**

Rdzeń działa i jest realny: ten sam silnik co w Strefie 2, plus zapis do bazy, plus w pełni odtwarzalne ponowne otwarcie sesji z backendu — to nie jest fasada. Trzy konkretne, potwierdzone w kodzie problemy ograniczają jednak, ile można obiecać w trakcie pokazu:

1. **Dopasowania na poziomie linii nigdy nie są zapisywane.** Tabela `wdd_matcher_line_matches` ma pełny schemat i serwis (`insertLineMatches`, `listLineMatches`, `updateLineMatchReview`), ale żadna ścieżka zapisu jej nie wywołuje — silnik dopasowania (`runWddEnrichment`) produkuje wyłącznie dopasowania na poziomie bloku. Jeśli scenariusz demo miałby sugerować szczegółowość dopasowania linia-po-linii jako trwałą, to obietnica przekracza to, co faktycznie jest zapisywane.
2. **Brak transakcyjności i idempotencji w wieloetapowym zapisie sesji** (`persistPreparedSessionAction`): każdy krok to osobne zapytanie do Supabase bez transakcji; awaria w środku pozostawia osierocone wiersze plików/bloków/linii, a awaria poza obsłużonym `try/catch` (np. przerwane połączenie) może zostawić sesję trwale w statusie `processing` bez żadnego mechanizmu naprawczego. Brak też zabezpieczenia przed podwójnym zapisem tej samej sesji.
3. **Numery zleceń/WDD/ZL/ZW są zachowywane, ale wyłącznie jako nieindeksowane, niewalidowane klucze JSON** w `wdd_matcher_blocks.metadata`, nie jako właściwe kolumny relacyjne — zgodnie z oczekiwaniem tej strefy (prawdziwy model zlecenia to Strefa 4), ale bez żadnej gwarancji bazy danych, że te klucze w ogóle istnieją; parser jedynie oznacza braki ostrzeżeniami (`missing_order_number` itd.), które nie blokują osiągnięcia statusu `ready_for_review`/`approved`.

Dodatkowo nic z powyższego nie zostało odtworzone ręcznie na aktualnym build, a testy automatyczne pokrywają wyłącznie granicę importu (na zamockowanych danych), nie samą ścieżkę zapisu.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Wieloetapowy zapis sesji owinięty w transakcję (lub równoważny mechanizm kompensacyjny/sagi z jawnym sprzątaniem) tak, aby częściowa awaria nie zostawiała osieroconych wierszy plików/bloków/linii.
- [ ] Zabezpieczenie idempotencji przed podwójnym zapisem tej samej sesji (unikalne ograniczenie, klucz idempotencji albo blokada po stronie serwera) — dziś nieobecne.
- [ ] Mechanizm wykrywania i rozliczania sesji utkniętych w statusie `processing` (awaria bez trafienia w obsłużony błąd) — dziś brak jakiegokolwiek zadania porządkującego.
- [ ] Decyzja i (jeśli potrzebna) implementacja: albo dopasowania na poziomie linii zaczynają być faktycznie zapisywane (`wdd_matcher_line_matches`), albo świadomie i jawnie przyjęto, że poziom bloku wystarcza operacyjnie dla pilotażu — nie zostawiać tego jako przypadkowe niedopatrzenie.
- [ ] Bezpieczne ponowne przetwarzanie tej samej dostawy (wykrywanie duplikatu dostawy/sesji), żeby pracownik przypadkowo nie stworzył dwóch sesji dla tej samej fizycznej dostawy podczas normalnej pracy.
- [ ] Wielu użytkowników z dostępem do tych samych zapisanych sesji (odczyt/przegląd) przetestowane pod kątem spójności, nie tylko dostępności — łącznie z zależnością od izolacji oddziałowej `wdd_matcher_*` z Strefy 1 (RLS dla tych tabel jest dziś tylko organizacyjne, nie oddziałowe — zależność, nie duplikat listy kontrolnej Strefy 1).
- [ ] Jawne zasady cyklu życia statusu sesji (kto może cofnąć `approved`, co się dzieje z sesją odrzuconą, czy `failed` można ponowić bez tworzenia nowej sesji) ustalone i przetestowane.
- [ ] Trwały ślad audytowy: kto utworzył/zatwierdził sesję i kiedy, dostępny do wglądu — nie tylko istnienie kolumn `created_by`/`approved_by`, ale potwierdzenie, że są rzeczywiście wypełniane i widoczne operacyjnie.
- [ ] Retencja i dostęp do plików PDF w Storage (`wdd-matcher-files`) ustalone na potrzeby pilotażu (jak długo trzymamy, kto ma dostęp) — zależność od ogólnej autoryzacji Storage ze Strefy 1.
- [ ] Przetestowano na realistycznie większych zestawach dokumentów (więcej magazynów/marek/pozycji niż zestaw demo) pod kątem czasu przetwarzania i poprawności.
- [ ] Testy automatyczne pokrywające samą ścieżkę zapisu (`createSession`/`persistPreparedSessionAction`/`insertBlocks`/`insertLines`) i odtworzenie sesji wyłącznie z bazy — dziś nieobecne.
- [ ] Jawnie udokumentowany kontrakt zgodności między tym, co Matcher zapisuje, a tym, czego oczekuje importer ruchu 101, jako coś utrzymywanego świadomie (nie tylko zbieżność przez przypadek) — istniejące testy granicy (`inventory-movement-import-preview.service.test.ts`, `movement-import-boundary.test.ts`) to dobry start, ale są na zamockowanych danych.
- [ ] **Dokładny scenariusz pilotażu Strefy 3 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym powtórne przetwarzanie i częściowa awaria na realnych danych.

**Pilot gap:**

Wymagania powyżej wykraczają poza pitch, bo dotyczą sytuacji, których pojedynczy, przećwiczony pokaz z jedną, kontrolowaną dostawą demo prawdopodobnie nigdy nie uruchomi: prawdziwa współbieżność wielu pracowników, powtarzalne codzienne użycie przez tygodnie, przypadkowe podwójne przetworzenie tej samej dostawy, sesje utknięte po realnej awarii sieci na magazynie. Najważniejsza pojedyncza luka to brak transakcyjności/idempotencji zapisu sesji — przy jednorazowym demo ryzyko się nie zmaterializuje, ale przy trzymiesięcznym pilotażu z wieloma dostawami dziennie staje się realnym źródłem osieroconych lub zdublowanych danych.

### Notes / evidence

- Parytet z publicznym Matcherem potwierdzony na poziomie plików: `apps/web/src/app/actions/tools/wdd-matcher.ts` i `apps/web/src/server/services/wdd-matcher.service.ts` są identyczne (`diff` bez różnic) z odpowiednikami w `apps/public-web`; silnik `parser_v4.ts`/`matcher.ts` identyczny bajt-w-bajt (potwierdzone już w Strefie 2). Różnica to wyłącznie dodatkowy zapis do Supabase po stronie zalogowanej.
- Schemat sześciu tabel: `apps/web/supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql`; kolumna `wdd_matcher_lines.location` dodana później w `20260416100000_wdd_matcher_lines_add_location.sql`; kolumna `wdd_matcher_sessions.session_number` dodana w `20260627173000_wdd_matcher_session_numbers.sql` (nullable, alokowana przez RPC `wdd_matcher_allocate_session_number`).
- `wdd_matcher_line_matches` nigdy nie jest zapisywane — `insertLineMatches` istnieje w `wdd-matcher.service.ts:900-929`, ale żadna akcja (`persistPreparedSessionAction`, `runMatchingAction`) jej nie wywołuje; `runWddEnrichment` (`matcher.ts:164-402`) zwraca wyłącznie dopasowania na poziomie bloku.
- `wdd_matcher_blocks.from_section`/`to_section` są zawsze zapisywane jako `null` — kolumny bez realnego użycia (`persistPreparedSessionAction`, `wdd-matcher.ts:608-609`, `uploadAndParseFileAction`, `wdd-matcher.ts:808-809`).
- Numery zlecenia/WDD/ZL/ZW: wyekstrahowane przez `parser_v4.ts` (`extractBlwk`/`extractZl`/`ZW_NUMBER_RE`, ok. linii 344-346, 1121-1129) i zapisywane jako klucze w `wdd_matcher_blocks.metadata` (JSONB) — nie jako osobne kolumny; odczytywane przez `metadataString()` (`wdd-matcher.service.ts:324-327`), który po cichu zwraca `null` przy braku/błędnym formacie, bez żadnego ograniczenia na poziomie bazy.
- Brak transakcji w `persistPreparedSessionAction` (`apps/web/src/app/actions/tools/wdd-matcher.ts:536-702`) — każdy krok (`registerFile`, `uploadPdf`, `insertBlocks`, `insertLines`, `insertBlockMatches`, `updateMatchSummary`) to osobne zapytanie; częściowa awaria zostawia już zapisane wiersze bez sprzątania, a awaria poza obsłużonym `try/catch` może zostawić sesję trwale w statusie `processing`.
- Ponowne otwarcie sesji jest w pełni odtwarzane z backendu: `getSessionExtractedDataAction`/`getSessionResultsAction` → `WddMatcherService.getSessionExtractedData`/`getSessionResults` (`wdd-matcher.service.ts:998-1130`) — czyste odczyty z bazy, bez zależności od stanu oryginalnej karty przeglądarki.
- Granica importu do ruchu 101: `WddMatcherService.getMovementImportCandidates` (`wdd-matcher.service.ts:462-483`) wymaga `created_by` niepustego, zgodnego `branch_id` i statusu `ready_for_review`/`approved`; adapter (`svwms-wdd-matcher.adapter.ts`) mapuje `product_code`/`product_name`/`unit`/`quantity`/`location` z dedykowanych kolumn, a numery zlecenia/WDD z kluczy JSONB metadanych, do pola `rawMetadata` kanonicznego dokumentu importu — potwierdzone testami `wdd-matcher-movement-import-candidates.test.ts` i `inventory-movement-import-preview.service.test.ts` (na zamockowanych danych). To wyłącznie kontrakt/granica danych — sam import i dalsze przyjęcie ocenia Strefa 6, nie ta strefa.
- Zależność od Strefy 1: izolacja oddziałowa zapisanych sesji Matchera zależy od ustaleń Strefy 1 (RLS `wdd_matcher_*` jest dziś tylko organizacyjne, nie wymuszone na poziomie oddziału) — nie duplikowano tu tej listy kontrolnej, tylko odnotowano zależność.
- Zero automatycznych testów samej ścieżki zapisu (`createSession`, `persistPreparedSessionAction`, `insertBlocks`/`insertLines`) i odtworzenia sesji z bazy; jedyny test dotykający zapisu bezpośrednio to test odczytu `getMovementImportCandidates` na zamockowanych danych.

---

## Product clarification and final design

> This section is intentionally separate from the accepted implementation audit above.
>
> The audit describes what currently exists.
> This section will be used to determine how the functionality SHOULD ultimately behave before implementation work begins.
>
> Do not treat unanswered questions in this section as accepted requirements.

### Open questions

_To be reviewed together before implementation._

### Problems / ambiguities

_To be reviewed together before implementation._

### Product decisions

_No final decisions recorded yet._

### Final intended workflow

_To be defined after product clarification._

### Architecture implications

_To be defined after the intended workflow is agreed._

### Final pitch scope

_To be defined after clarification._

### Final controlled-pilot scope

_To be defined after clarification._
