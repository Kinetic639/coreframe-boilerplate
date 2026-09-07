# Ambra — gotowość do prezentacji i kontrolowanego pilotażu

Audyt repozytorium: **7 września 2026**. Produkt: **wyłącznie `apps/web`** (Strefy 2 i 16 sprawdzają dodatkowo `apps/public-web`/`apps/vmi-client` tam, gdzie to bezpośrednio dotyczy pokazu). Źródło zakresu: [skrypt prezentacji](ambra-skrypt-prezentacji.md). Dowody i ograniczenia: [audyt implementacji](mvp-readiness-audit.md). **Wszystkie 19 stref zostało zaudytowanych i zaakceptowanych szczegółowo — patrz indeks stref niżej i pliki w `zones/`.** Ta sekcja to końcowe podsumowanie i plan pracy wynikający z tych 19 audytów, wykonany jako osobny przebieg spójności po ich zamknięciu — nie nowa ocena.

**Pełny scenariusz ze skryptu nie jest jeszcze gotowy.** Ambra ma realne fundamenty implementacyjne i kilka istotnych, działających w kodzie przepływów — logowanie/organizacja/oddział (Strefa 1), administracja członkostwami/rolami (Strefa 10), generyczny system komentarzy/załączników (Strefa 9, jako infrastruktura), wyszukiwanie/lokalizacje/relokacja pojedynczej części (Strefa 7) i tickety (Strefa 11) — ale żaden z nich nie ma dziś świeżej ręcznej weryfikacji na aktualnym build, więc żadna strefa nie otrzymała w tym audycie statusu wyższego niż PARTIAL/EARLY. Największa brakująca praca to jeden centralny łańcuch biznesowy, nie rozproszone niedoróbki: **trwałe zlecenie naprawcze z pozycjami i dokumentami (Strefa 4, dziś NOT IMPLEMENTED) → przyjęcie 101/PZ z importu Matchera rozszerzone o mobilne potwierdzenie lokalizacji, zamknięcie i raport z rzeczywistych lokalizacji (Strefa 6, dziś w połowie placeholder) → rzeczywista operacja zwykłego wydania części z polem odbiorcy (Strefa 8, dziś zaślepka UI)**. Strefy 13–19 (zadania/kalendarz/Kanban, cykliczność/powiadomienia, materiały/dostawcy/audyty, VMI/dashboard/analityka, integracja DMS, awaryjne wydania/zwroty/Customer Care, lakiery/nieroty/procedury) są świadomie drugorzędne lub czystą roadmapą — nie wymagają pracy przed pitchem i nie są częścią wybranego pilotażu, chyba że Strefa 12 jawnie to zmieni. Pitch ma udowodnić dokładnie tę jedną ścieżkę pokazu (skrypt §6–11), nie kompletność całej Ambry; pilotaż ma zweryfikować, czy ta ścieżka daje realną wartość w codziennej pracy — nie potwierdzić, że produkt da się zbudować.

## Documentation ownership

### Master tracker

`docs/mvp/mvp-readiness.md` (this file) is authoritative for: cross-zone priority, summarized zone status, cross-zone dependencies, implementation sequencing, parallel workstreams, global pitch readiness, global pilot readiness, global scope decisions, presentation-level coordination.

### Zone trackers

`docs/mvp/zones/*.md` are authoritative for: detailed implementation findings, detailed evidence, per-zone pitch checklist, per-zone pilot checklist, detailed gaps, zone-specific decisions, final intended behavior after clarification, zone-specific architecture implications.

### Archive

`docs/mvp/archive/mvp-readiness-pt-monolith.md` is historical evidence only — the accepted pre-split baseline. It must not be updated after this restructuring.

Detailed readiness checklists are never duplicated here — when a zone changes, its evidence/checklist changes only in its Zone file; only its summarized state/action changes in this master.

## Migawka gotowości

| Kategoria                                                    | Strefy                 | Wniosek                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rdzeniowe blokery P0 — wymagają realnej implementacji        | 4, 6, 8                | Jedyna praca kodowa, która musi się wydarzyć przed pitchem, żeby uczciwie pokazać scenariusz §6–11 skryptu.                                                                         |
| P0 — tylko weryfikacja/naprawa/decyzja/tania integracja      | 1, 2, 3, 5, 7, 9       | Fundament w większości realny; potrzeba świeżej ręcznej próby, konkretnych napraw (np. wyszukiwanie po SKU) i/lub jednej decyzji zakresu (część/zestaw QR), nie nowej architektury. |
| Silne obszary wspierające (P1) — przygotowanie + jedna próba | 10, 11, 12             | Fundament często mocniejszy niż w niejednej strefie P0; głównie przygotowanie kont i jedna świeża próba, nie budowa.                                                                |
| Opcjonalny obszar częściowy (P2) — jedna wzmianka/przykład   | 13                     | Realne, ale nie rozbudowywać przed pitchem.                                                                                                                                         |
| Czysta roadmapa (P3–P4) — zero pracy przed pitchem           | 14, 15, 16, 17, 18, 19 | Świadomie poza zakresem pokazu i poza zakresem wybranego pilotażu.                                                                                                                  |

## Priorytety — od czego zacząć

Stan wymagany to **cel przed prezentacją**, nie ocena obecnej implementacji — obecny stan (🔴/🟠/🟡) każdej strefy jest opisany wyłącznie w jej pliku w `zones/` (patrz indeks stref niżej). Numery wskazują strefy, nie dawne identyfikatory checklisty.

**Akcja przed pitchem, strefa po strefie** (rodzaj wymaganej pracy: **IMPLEMENT** = brakuje realnej funkcji, **FIX** = istniejąca usterka, **VERIFY** = kod gotowy, wymaga świeżej ręcznej próby, **DECIDE** = decyzja zakresu, **PREPARE** = konta/dane/materiał, **NARROW CLAIM** = zawęzić wypowiedź zamiast dopisywać kod, **ROADMAP ONLY**, **DO NOT DEMO**):

1 VERIFY + FIX (izolacja `wdd_matcher_*`, środowisko) · 2 VERIFY · 3 VERIFY · 4 IMPLEMENT · 5 VERIFY (lokalizacja) + DECIDE (część/zestaw) · 6 IMPLEMENT · 7 FIX (SKU) + VERIFY + DECIDE (zestaw) · 8 IMPLEMENT · 9 IMPLEMENT (tanio, po Strefie 4) + VERIFY · 10 PREPARE + VERIFY · 11 PREPARE + VERIFY + NARROW CLAIM (brak odrzucenia) · 12 PREPARE + VERIFY (próba na głos) · 13 PREPARE (jeden przykład) lub NARROW CLAIM · 14–15 ROADMAP ONLY · 16 DO NOT DEMO (VMI, pulpit startowy) · 17–18 ROADMAP ONLY · 19 DO NOT DEMO.

Priorytety P0–P4 poniżej nie zmieniły się względem poprzedniego przebiegu spójności (po Strefie 12) — końcowy audyt Stref 13–19 potwierdził, że żadna z nich nie wymaga podniesienia priorytetu.

| Priorytet | Obszar                                                                                | Wymagany stan                         | Dlaczego ma znaczenie                                                                                              |
| --------- | ------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| P0        | 1. Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo            | FULLY READY w zakresie demo           | Każdy następny krok zależy od właściwego dostępu i danych                                                          |
| P0        | 2. Publiczny SVWMS Matcher                                                            | DEMO READY                            | Pierwszy pokaz na tych samych dokumentach; żyje w `apps/public-web`, nie w `apps/web`                              |
| P0        | 3. Matcher zalogowany → trwała sesja → przygotowanie danych do dalszego przetwarzania | DEMO READY                            | Przejście od prostego Matchera do trwałych danych wykorzystywanych później przez proces magazynowy                 |
| P0        | 4. Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe                  | DEMO READY                            | Trwała tożsamość zlecenia spina szukanie, przyjęcie, wydanie i załączniki (Strefy 6–9); dziś NOT IMPLEMENTED       |
| P0        | 5. Lokalizacje, QR, etykiety i fizyczna identyfikacja części/zestawów                 | DEMO READY                            | Warunek fizycznego pokazu na telefonie; lokalizacja gotowa, część/zestaw wymaga decyzji zakresu przed pitchem      |
| P0        | 6. Przyjęcie 101/PZ → import z Matchera → mobilne rozłożenie → zamknięcie → raport    | DEMO READY                            | Centralna demonstracja w §7 skryptu; dziś działa tylko import na komputerze, reszta łańcucha to placeholdery       |
| P0        | 7. Szukanie, zawartość lokalizacji, relokacja części/zestawu i historia               | DEMO READY                            | Obiecana codzienna praca w §9; rdzeń działa, wymaga naprawy wyszukiwania i decyzji o relokacji zestawu             |
| P0        | 8. Zwykłe wydanie części                                                              | DEMO READY                            | Domknięcie cyklu części, §10–11; wymaga rzeczywistej operacji wydania, nie obejścia korektą magazynową             |
| P0        | 9. Załączniki zlecenia naprawczego i archiwum dokumentów                              | DEMO READY                            | Podpisany dokument AutoStacji jako przykładowy załącznik zlecenia; infrastruktura gotowa, zależy tylko od Strefy 4 |
| P1        | 10. Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem              | DEMO READY dla krótkiego omówienia    | Wiarygodne, krótkie wyjaśnienie fundamentów w §5; fundament już mocny i przetestowany                              |
| P1        | 11. Tickety: komunikacja, akceptacja i problemowa część z QR                          | DEMO READY dla krótkiego pokazu       | Drugi, krótki pokaz w §12–13; QR to etykieta ticketu na części, nie cyfrowa identyfikacja samej części             |
| P1        | 12. Stan początkowy magazynu i propozycja kontrolowanego pilotażu                     | DEMO READY dla materiału i propozycji | Ograniczenia i decyzja biznesowa w §8, §16–23; materiał mocny, wymaga próby na głos                                |
| P2        | 13. Zadania jednorazowe, kalendarz i Kanban                                           | PARTIALLY READY                       | §14 zapowiada kierunek, bez kolejnego dużego demo                                                                  |
| P3        | 14. Cykliczność i powiadomienia operacyjne                                            | ROADMAP ONLY                          | Zapowiedź, nie obietnica działającej automatyzacji                                                                 |
| P3        | 15. Materiały, dostawcy, audyty i wsparcie zamawiania                                 | ROADMAP ONLY                          | Są elementy backendu; §15 nie wymaga ich ukończenia                                                                |
| P3        | 16. VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu                | ROADMAP ONLY / brak wymogu demo       | VMI to prototyp bez backendu; pulpit startowy to pusty ekran — pokaz niesie ryzyko, nie wartość                    |
| P4        | 17. Pełne importy AutoStacji i integracja DMS                                         | ROADMAP ONLY                          | Skrypt dopuszcza naturalną rotację; DMS pozostaje źródłem                                                          |
| P4        | 18. Awaryjne wydania, pełne zwroty i Customer Care VGP                                | ROADMAP ONLY                          | Wykraczają poza zwykłe wydanie i jeden ticket; ticket dziś ma tylko akceptację, nie odrzucenie                     |
| P4        | 19. Lakiery, nieroty, procedury, zbiorczy dashboard                                   | ROADMAP ONLY                          | Brak wymogu w aktualnym pokazie; żaden podobszar nie istnieje w kodzie                                             |

### MUST FINISH BEFORE PITCH

- [VERIFY] + [FIX] Dostęp/bezpieczeństwo ścieżki demo (Strefa 1): właściwa organizacja/oddział, zachowanie sesji Matchera pod RLS, potwierdzone środowisko (dryf dwóch drzew migracji rozstrzygnięty dla ścieżek użytych w demo).
- [VERIFY] Trwała sesja Matchera (Strefa 3) na aktualnym build; świadomość, że dopasowania na poziomie linii nie są dziś zapisywane.
- [IMPLEMENT] Minimalny, trwały model zlecenia naprawczego z pozycjami i powiązanymi dokumentami magazynowymi (Strefa 4) — dziś NOT IMPLEMENTED; to pojedyncza najgłębsza praca implementacyjna w całym P0, bo od niej zależy ciągłość zlecenie → części → lokalizacje oraz Strefa 9.
- [VERIFY] + [DECIDE] Fizyczna identyfikacja gotowa dla lokalizacji (Strefa 5); świadoma decyzja, czy część/zestaw dostają minimalny cel QR na potrzeby demo, czy scenariusz zostaje jawnie zawężony.
- [IMPLEMENT] Przyjęcie 101/PZ z importu Matchera rozszerzone o mobilne potwierdzenie lokalizacji, zamknięcie procesu i raport z rzeczywiście potwierdzonych lokalizacji (Strefa 6) — dziś połowa łańcucha (mobilne rozłożenie, zamknięcie, raport) to placeholdery.
- [FIX] + [VERIFY] Szukanie, zawartość lokalizacji i relokacja pojedynczej części (Strefa 7); naprawione wyszukiwanie po SKU; decyzja o relokacji zestawu jak w Strefie 5.
- [IMPLEMENT] Rzeczywista operacja zwykłego wydania części z polem odbiorcy (Strefa 8) — dziś dedykowana funkcja to zaślepka zwracająca błąd; jedyny substytut (korekta magazynowa) nie ma pola odbiorcy.
- [IMPLEMENT] Załączniki zlecenia naprawczego (Strefa 9) — tanie do domknięcia zaraz po Strefie 4, niezależnie od stanu Stref 6–8.
- [VERIFY] Pełna próba P0 wykonana w kolejności skryptu, bez fikcyjnych sukcesów, na koncie demonstratora z właściwym oddziałem; publiczny Matcher (Strefa 2, `apps/public-web`) sprawdzony jako osobne wejście do historii.

### SHOULD FINISH BEFORE PITCH

- [PREPARE] + [VERIFY] Administracja dostępem (Strefa 10): fundament już mocny, testowany i sprawdzony po stronie serwera — przygotować konta demonstracyjne i zweryfikować ręcznie jeden krótki scenariusz (lista członków lub zaproszenie).
- [PREPARE] + [NARROW CLAIM] Wąski przepływ ticketu (Strefa 11): utworzenie → przypisanie → komentarz → akceptacja → ponowne otwarcie z trwałą historią → skan QR ticketu; bez obietnicy odrzucenia (nie istnieje) i bez sugerowania cyfrowej relacji ticket↔zlecenie/część/zestaw (nie istnieje).
- [VERIFY] Materiał o stanie początkowym magazynu i kontrolowanym pilotażu (Strefa 12): treść już dojrzała i uczciwa, wymaga przećwiczenia na głos oraz jawnego uwzględnienia w zakresie miesiąca 1 tego, co Strefy 4/6/8 pokazały jako dziś brakujące.

### CAN REMAIN PARTIAL

- Zadania, kalendarz i Kanban (Strefa 13): istniejący, stabilny przykład albo sama wzmianka.
- Zaawansowana funkcjonalność Car Workshop wykraczająca poza minimalny model zlecenia wymagany przez Strefę 4 (pełny edytor zleceń, historia serwisowa, integracja z pojazdami, harmonogramowanie) — sam minimalny model zlecenia (nagłówek/pozycje/dokumenty magazynowe) NIE może pozostać częściowy, jeśli demo zachowuje obecny scenariusz P0.
- Relokacja zestawu/kontenera (Strefy 5 i 7), jeśli finalny scenariusz demo świadomie jej nie obejmuje.
- Rozszerzone typy ticketów, akcja odrzucenia, pełny katalog i wyszukiwanie poza dokładnym scenariuszem P0/P1. Nieukończone warianty nie blokują sprawdzonej ścieżki.

### DO NOT SPEND TIME ON BEFORE PITCH

- Cykliczność zadań i dostarczanie powiadomień (e-mail/push/in-app), dzwonek powiadomień — Strefa 14: zero infrastruktury wykonania/dostarczania w całej aplikacji.
- Materiały/dostawcy/procurement poza istniejącymi audytami i sugestiami uzupełnienia — Strefa 15: dostawcy/zamówienia pozostają rozproszone i nieosiągalne z UI.
- VMI (prototyp bez backendu), pulpit startowy, szersza analityka/BI — Strefa 16: nie pokazywać na żywo, nie próbować dokańczać.
- Bezpośrednia integracja z AutoStacją/DMS, import historyczny, synchronizacja/uzgadnianie — Strefa 17: świadomie poza zakresem; pilotaż działa z ręczną procedurą dwusystemową.
- Wydanie awaryjne, pełny silnik zwrotów/reklamacji, Customer Care VGP, akcja odrzucenia ticketu — Strefa 18: praktycznie nieobecne w kodzie.
- Lakiery, nieroty, procedury, zbiorczy dashboard operacyjny — Strefa 19: żaden podobszar nie istnieje w kodzie.
- Relacje domenowe ticket↔zlecenie/część poza tym, co Strefy 4 i 9 już dostarczają.
- Pełne pokrycie testami wszystkich modułów, rozbudowana analityka i hardening całej produkcji. Ochrona danych demo pozostaje P0; wymagania pilotażu zebrano w sekcji „Controlled Pilot Go/No-Go" po Strefie 19.

## Indeks stref — szczegółowe trackery

| Strefa | Obszar                                                                             | Priorytet | Szczegóły                                             |
| ------ | ---------------------------------------------------------------------------------- | --------- | ----------------------------------------------------- |
| 1      | Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo            | P0        | [Strefa 01](./zones/01-auth-org-branch-access.md)     |
| 2      | Publiczny SVWMS Matcher                                                            | P0        | [Strefa 02](./zones/02-public-matcher.md)             |
| 3      | Matcher zalogowany → trwała sesja → przygotowanie danych do dalszego przetwarzania | P0        | [Strefa 03](./zones/03-authenticated-matcher.md)      |
| 4      | Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe                  | P0        | [Strefa 04](./zones/04-repair-orders.md)              |
| 5      | Lokalizacje, QR, etykiety i fizyczna identyfikacja części/zestawów                 | P0        | [Strefa 05](./zones/05-locations-qr-labels.md)        |
| 6      | Przyjęcie 101/PZ → import z Matchera → mobilne rozłożenie → zamknięcie → raport    | P0        | [Strefa 06](./zones/06-receiving-putaway.md)          |
| 7      | Szukanie, zawartość lokalizacji, relokacja części/zestawu i historia               | P0        | [Strefa 07](./zones/07-search-relocation-history.md)  |
| 8      | Zwykłe wydanie części                                                              | P0        | [Strefa 08](./zones/08-normal-issue.md)               |
| 9      | Załączniki zlecenia naprawczego i archiwum dokumentów                              | P0        | [Strefa 09](./zones/09-repair-order-attachments.md)   |
| 10     | Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem               | P1        | [Strefa 10](./zones/10-users-roles-admin.md)          |
| 11     | Tickety: komunikacja, akceptacja i problemowa część z QR                           | P1        | [Strefa 11](./zones/11-tickets.md)                    |
| 12     | Stan początkowy magazynu i propozycja kontrolowanego pilotażu                      | P1        | [Strefa 12](./zones/12-pilot-scope.md)                |
| 13     | Zadania jednorazowe, kalendarz i Kanban                                            | P2        | [Strefa 13](./zones/13-planning.md)                   |
| 14     | Cykliczność i powiadomienia operacyjne                                             | P3        | [Strefa 14](./zones/14-recurrence-notifications.md)   |
| 15     | Materiały, dostawcy, audyty i wsparcie zamawiania                                  | P3        | [Strefa 15](./zones/15-materials-suppliers-audits.md) |
| 16     | VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu                 | P3        | [Strefa 16](./zones/16-vmi-dashboard-analytics.md)    |
| 17     | Pełne importy AutoStacji i integracja DMS                                          | P4        | [Strefa 17](./zones/17-autostacja-dms.md)             |
| 18     | Awaryjne wydania, pełne zwroty i Customer Care VGP                                 | P4        | [Strefa 18](./zones/18-exceptional-workflows.md)      |
| 19     | Lakiery, nieroty, procedury, zbiorczy dashboard                                    | P4        | [Strefa 19](./zones/19-secondary-processes.md)        |

Ta tabela to wyłącznie nawigacja — priorytet/wymagany stan/akcja w pełnej formie znajdują się w tabeli „Priorytety — od czego zacząć" wyżej; szczegółowe dowody, checklisty i luki znajdują się wyłącznie w plikach stref.

## Zasady odhaczania

- **P0 — PITCH BLOCKER:** awaria przerywa główną historię. **P1 — HIGH VALUE FOR PITCH:** bezpośrednio wzmacnia pokaz. **P2 — PARTIAL IMPLEMENTATION IS ENOUGH:** wystarcza wąski, prawdziwy przykład. **P3 — MENTION / ROADMAP ONLY:** bez istotnych prac przed spotkaniem. **P4 — DEFER:** odłożyć poza przygotowania.
- **FULLY READY:** end-to-end, trwałe dane, sprawdzone uprawnienia, happy path i główne błędy, brak mocków, ręczna próba. Tutaj dotyczy dostępu i bezpieczeństwa używanej ścieżki, nie całego IAM.
- **DEMO READY:** dokładny scenariusz działa na rzeczywistym backendzie i trwałych danych; szersze przypadki mogą pozostać otwarte. Nadal wymagane są sprawdzenie dostępu, test happy path/głównych błędów i próba ręczna.
- **PARTIALLY READY:** można uczciwie wspomnieć lub krótko pokazać część funkcji. **ROADMAP ONLY:** nie kończyć na potrzeby pitchu, nawet jeżeli część kodu już istnieje.
- `[x]` oznacza wyłącznie opisany dowód. Dawna próba ręczna nie jest świeżą certyfikacją wdrożenia. Nie odhaczamy obszaru na podstawie strony, migracji, testu z mockami ani wcześniejszego `[x]`.
- Przy zamknięciu P0/P1 zapisać wersję aplikacji, środowisko, datę, konta/role, scenariusz, wynik i dowód. Żaden obszar nie otrzymał w tym audycie nowego statusu „gotowy”.

## Otwarte decyzje zakresu przed kodowaniem

Audyt Stref 1–19 zostawił decyzje biznesowe, które muszą zapaść **przed** implementacją, nie w jej trakcie — bo zmieniają zależności i zakres pracy.

1. **QR części.** Decyzja wymagana: TAK. Zbudować minimalny cel QR dla części, ALBO usunąć z demo obietnicę „skanuję część". Rekomendacja: usunąć/zawęzić — koszt nowego typu celu QR przewyższa wartość tego jednego kroku demo; scenariusz może polegać na wyborze pozycji z listy przed skanem lokalizacji docelowej. Jeśli zbudowane: Strefa 5 przechodzi z VERIFY do IMPLEMENT i wydłuża ścieżkę krytyczną.
2. **QR zestawu/kontenera.** Decyzja wymagana: TAK, razem z punktem 1. Zbudować minimalny cel QR dla kontenera, ALBO usunąć „przenoszę zestaw" z demo. Rekomendacja: usunąć, z tych samych powodów.
3. **Relokacja kontenera.** Decyzja wymagana: TAK. Funkcja serwerowa istnieje (Strefa 7), ale bez wejścia UI. Zbudować proste UI wywołujące istniejącą funkcję, ALBO usunąć „przenoszę zestaw" z demo. Rekomendacja: usunąć, chyba że punkty 1–2 zostaną zbudowane — bez fizycznej identyfikacji zestawu samo UI relokacji nie ma czego spójnie demonstrować.
4. **Zwykłe wydanie.** Decyzja wymagana: TAK. Podłączyć uśpioną gałąź `movement_kind='issue'` do prawdziwego wejścia UI z polem odbiorcy, ALBO tymczasowo nadać typowi 402 pole odbiorcy z jasną etykietą w scenariuszu. Rekomendacja: podłączyć `movement_kind='issue'` — poprawna semantyka biznesowa, nie nadużycie typu korekty inwentaryzacyjnej. Nie używać 402 jako trwałego rozwiązania w żadnym wypadku.
5. **Tożsamość źródłowa zlecenia (Dxxxx).** Decyzja wymagana: TAK, jako część projektowania Strefy 4. Dziś parser nie wyodrębnia kontekstu warsztatu/magazynu jako niezależnej wartości (tylko wyliczana etykieta w generatorze PDF). Rekomendacja: przy budowie Strefy 4 potwierdzić na rzeczywistych danych Matchera, czy kontekst da się realnie wyekstrahować z dokumentów źródłowych, zanim złożony klucz tożsamości zlecenia (organizacja/oddział + kontekst + numer) zostanie na nim oparty — jeśli nie, złożony klucz może wymagać innego składnika lub jawnego ograniczenia demo (np. jeden kontekst warsztatowy na oddział).
6. **Minimalny model oczekiwane-vs-potwierdzone przy przyjęciu.** Decyzja wymagana: TAK, jako część Strefy 6. Dziś brak jakiegokolwiek rozróżnienia. Rekomendacja: nie budować pełnego silnika rozbieżności — wystarczy prosty stan na pozycji przyjęcia (oczekiwana/potwierdzona ilość + jawny brak/wyjątek), spójny z tym, co i tak trzeba zapisać przy mobilnym potwierdzeniu lokalizacji.
7. **Zamknięcie przyjęcia.** Decyzja wymagana: TAK, jako część Strefy 6. Dziś brak dedykowanej operacji odrębnej od ogólnego przejścia draft→posted. Rekomendacja: minimalna walidacja — nie pozwolić zamknąć, jeśli wymagane pozycje nie mają potwierdzonej lokalizacji (punkt 6); nie budować pełnego cyklu życia dokumentu ponad to.
8. **Raport przyjęcia.** Decyzja wymagana: TAK, jako część Strefy 6. Dziś jedyny raport dostawy czyta wyłącznie dane źródłowe Matchera, nigdy rzeczywiście potwierdzonych lokalizacji. Rekomendacja: zbudować minimalny eksport/wydruk z rzeczywistych danych ruchu (widok szczegółów ruchu magazynowego już ma realne dane lokalizacji jako punkt wyjścia) — nie rozszerzać PDF Matchera, bo z definicji nie ma dostępu do danych potwierdzenia.

## Kolejność zależności i pracy

Trzy różne porządki — nie mylić ich ze sobą.

### A. Kolejność implementacji technicznej

**1 (dostęp/RLS) → 3 (trwała sesja Matchera) → 4 (trwałe zlecenie naprawcze).** Strefa 4 to najgłębsza pojedyncza praca w całym P0 — wymagana przez szukanie zlecenia, ciągłość zlecenie→części→lokalizacje oraz Strefę 9. Od Strefy 4 praca rozchodzi się na dwie w dużej mierze niezależne gałęzie, które mogą iść **równolegle**:

- **4 → 9** (gałąź A). Strefa 9 zależy WYŁĄCZNIE od istnienia trwałego zlecenia (Strefa 4) — generyczna infrastruktura załączników już istnieje i jest tania do podłączenia (nowy wpis w rejestrze celów + odpowiadająca gałąź SQL, według wzorca trzech już działających typów). Nie zależy architektonicznie od Stref 6–8 ani od tego, czy ruch magazynowy stanie się celem załączników — podpisany dokument dołącza się do zlecenia, nie do ruchu. Można ją domknąć od razu po Strefie 4, równolegle z gałęzią B, a nie dopiero na końcu.
- **4 → 5 → 6 → 7 → 8** (gałąź B). Strefa 5 (lokalizacje/QR) jest już solidnym fundamentem dla lokalizacji — jedyna otwarta decyzja to zakres fizycznej identyfikacji części/zestawu (patrz „Otwarte decyzje zakresu" wyżej). Strefa 6 rozszerza istniejący, częściowo działający import Matchera→101 o stan przyjęcia, mobilne potwierdzenie lokalizacji, zamknięcie i raport z rzeczywistych lokalizacji. Strefa 7 konsumuje stan magazynowy wyprodukowany przez Strefę 6, ale jej naprawy (wyszukiwanie SKU, historia) są **niezależne od Strefy 6** i mogą powstać wcześniej na przygotowanych danych testowych. Strefa 8 konsumuje ten sam stan magazynowy co 6/7, ale sama implementacja (podłączenie `movement_kind='issue'`) nie zależy technicznie od ukończenia 6/7 — może być budowana równolegle, testowana na ich danych dopiero na końcu.

**2** (publiczny Matcher, `apps/public-web`) jest całkowicie niezależna — nie blokuje ani nie jest blokowana przez powyższy łańcuch.

**Wniosek:** rzeczywiste blokery sekwencyjne to tylko 1→3→4, potem 4→(5 identyfikacja fizyczna)→6→(8 może iść równolegle z końcówką 6). Strefa 9 i większość napraw w Strefie 7 mogą iść równolegle z resztą, nie na końcu.

### B. Kolejność ręcznej weryfikacji/przygotowania

Niezależna od kolejności implementacji: środowisko i dostęp (1), publiczny Matcher (2), zalogowany Matcher na istniejących danych (3), konta i role administracji (10), przygotowanie ticketu (11), materiał pilotażowy (12) można sprawdzać/przygotowywać już teraz. Weryfikacja Stref 5–9 ma sens dopiero, gdy odpowiadająca implementacja (gałąź B wyżej) faktycznie powstanie — nie wcześniej.

### C. Kolejność próby generalnej (prezentacja)

Zostaje zgodna ze skryptem, niezależnie od kolejności pracy: 1 → 2 → 3 → 4 → 6 → 7 → 8 → 9 → 11 → 12 (skrypt §5–23). Nie zamieniać kolejności scenariusza na kolejność wdrożenia podczas samej próby generalnej — zobacz „Globalny plan weryfikacji ręcznej" po Strefie 19.

Nie rozbudowywać administracji, katalogu ani ticketów ponad wąski, sprawdzony scenariusz przed domknięciem łańcucha 4 → (9 równolegle) → 5 → 6 → 7 → 8.

## Globalny plan weryfikacji ręcznej

Dokładne scenariusze do wykonania na aktualnym build przed pitchem, w kolejności próby generalnej (§C wyżej). Każdy scenariusz odsyła do brakującej implementacji, jeśli od niej zależy — nie da się zweryfikować czegoś, co jeszcze nie istnieje.

| Scenariusz                 | Warunek wstępny                           | Konto/rola                          | Urządzenie                               | Oczekiwany wynik                                                                                    | Dowód do zapisania                    |
| -------------------------- | ----------------------------------------- | ----------------------------------- | ---------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------- |
| A — Dostęp                 | Strefa 1                                  | demonstrator, właściwy oddział      | komputer + telefon                       | logowanie, aktywny oddział, odmowa dla konta bez dostępu                                            | zrzut ekranu, wersja/środowisko, data |
| B — Publiczny Matcher      | Strefa 2, przygotowane dokumenty demo     | brak (bez logowania)                | komputer/telefon prezentacyjny           | upload → dopasowanie → wynik zgodny z dokumentami                                                   | nagranie zapasowe                     |
| C — Zalogowany Matcher     | Strefa 3, te same dokumenty co B          | demonstrator                        | komputer                                 | sesja zapisana, wynik zgodny z B, przetrwa odświeżenie                                              | identyfikator sesji, zrzut            |
| D — Zlecenie naprawcze     | Strefa 4 (po implementacji)               | demonstrator                        | komputer                                 | wyszukanie zlecenia, nagłówek/pozycje/dokumenty magazynowe widoczne                                 | identyfikator zlecenia                |
| E — Przyjęcie              | Strefa 6 (po implementacji), dane z C     | demonstrator                        | telefon (rozłożenie) + komputer (import) | import → mobilne potwierdzenie → zamknięcie → raport z rzeczywistych lokalizacji                    | zrzuty raportu, log operacji          |
| F — Szukanie/relokacja     | Strefa 7, stan z E                        | demonstrator                        | komputer/telefon                         | wyszukanie po SKU działa, relokacja części zapisana, historia widoczna                              | zrzut historii                        |
| G — Wydanie                | Strefa 8 (po implementacji), stan z E/F   | demonstrator                        | komputer                                 | wydanie z polem odbiorcy, stan zmniejszony, brak nadmiernego wydania                                | numer dokumentu wydania               |
| H — Załączniki             | Strefa 9 (po implementacji), zlecenie z D | demonstrator                        | telefon (zdjęcie)                        | upload podpisanego dokumentu do zlecenia, widoczny po ponownym wejściu                              | zrzut załącznika                      |
| I — Administracja dostępem | Strefa 10                                 | administrator + konto bez uprawnień | komputer                                 | lista członków/ról widoczna, operacja administracyjna odrzucona dla nieuprawnionego konta           | zrzut ekranu                          |
| J — Ticket                 | Strefa 11, dwa konta                      | konto A + konto B                   | komputer + telefon (QR)                  | utworzenie → komentarz → akceptacja → skan QR otwiera ten sam ticket                                | identyfikator ticketu                 |
| K — Pełna próba generalna  | wszystkie powyższe zaliczone              | demonstrator                        | docelowy sprzęt prezentacji              | scenariusze A→B→C→D→E→F→G→H→I→J wykonane bez przerwy, w kolejności skryptu, bez fikcyjnych sukcesów | pełne nagranie/log próby              |

## Mapa ryzyk prezentacji

| Ryzyko                                                                   | Strefa(y)    | Prawdopodobieństwo                         | Wpływ                           | Mitygacja                                                                                                                               |
| ------------------------------------------------------------------------ | ------------ | ------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Awaria sieci podczas publicznego Matchera                                | 2            | średnie                                    | wysoki (pierwszy pokaz)         | zapasowe nagranie/zrzuty wyniku przygotowane wcześniej                                                                                  |
| Nieświeży cache aktywnego oddziału/sesji po przełączeniu                 | 1, 6         | średnie                                    | wysoki (błędne dane na scenie)  | pełne odświeżenie strony po zmianie oddziału w próbie generalnej, nie poleganie na przełączniku bez przeładowania                       |
| Brak łańcucha zlecenia (Strefa 4 nieukończona na czas)                   | 4, 6, 8, 9   | wysokie, jeśli implementacja się opóźni    | krytyczny (blokuje całe P0)     | traktować jako pojedynczy, najważniejszy element harmonogramu; nie rozpoczynać prób innych stref P0 zanim nie powstanie minimalny model |
| Awaria skanowania mobilnego (kamera/HTTPS/oświetlenie)                   | 5, 6         | średnie                                    | wysoki (widoczne na żywo)       | test na docelowym urządzeniu i w docelowym miejscu przed pitchem, zapasowy telefon                                                      |
| Przypadkowe otwarcie strony placeholder (dostawcy, VMI, pulpit startowy) | 15, 16       | niskie, jeśli trasa demo jest przećwiczona | średni (wygląda niedopracowane) | trasa demo przećwiczona bez improwizowanej nawigacji                                                                                    |
| Awaria operacji wydania (nowo zbudowana funkcja)                         | 8            | średnie (świeży kod)                       | wysoki (domyka główny cykl)     | pełny test happy path + błędnej ilości przed pitchem, nie tylko raz                                                                     |
| Rozbieżność danych źródłowych Matchera vs. wynik na scenie               | 2, 3         | niskie                                     | średni                          | te same, przygotowane wcześniej dokumenty dla obu wersji Matchera                                                                       |
| Nieaktualne dane demo (stan z poprzedniej próby)                         | wszystkie P0 | średnie                                    | średni                          | procedura ponownego przygotowania danych demo tuż przed pitchem                                                                         |
| Błędne konto/rola użyte na scenie                                        | 10, 11       | niskie                                     | wysoki (ujawnia lukę uprawnień) | lista przygotowanych kont z rolami spisana i sprawdzona dzień wcześniej                                                                 |
| Brak uploadu podpisanego dokumentu (Strefa 9 nowo zbudowana)             | 9            | średnie (świeży kod)                       | średni                          | test uploadu z telefonu prezentacyjnego, nie tylko z komputera                                                                          |

## Pitch Go/No-Go

- [ ] Build, osobny type-check i lint web oraz używanych zależności przechodzą; nie wymagać innych aplikacji. Build ma `ignoreBuildErrors`, więc nie zastępuje type-checku.
- [ ] Wybrane testy kodu/integracji głównej ścieżki przechodzą, wynik zapisany.
- [ ] Wszystkie scenariusze A–J z globalnego planu weryfikacji ręcznej wykonane na aktualnym build z wynikiem pozytywnym; scenariusz K (pełna próba generalna) wykonany bez przerwy.
- [ ] Demo ma trwałe, zanonimizowane dane na rzeczywistym backendzie, jawny oddział i role. Symulacja, fixture/nagranie nie udają operacji na żywo.
- [ ] Trasa demo nie ma martwych przycisków, nieobsłużonych błędów, placeholderów/niespójnych stanów; mobilny układ, HTTPS/kamera, wydruki i sieć sprawdzone na docelowych urządzeniach.
- [ ] Otwarte decyzje zakresu (sekcja wyżej) rozstrzygnięte — wiadomo dokładnie, co zostaje pokazane, a co jawnie zawężone w wypowiedzi.
- [ ] Jest bezpieczna kopia danych demo/procedura ponownego przygotowania, plan awarii internetu i zapasowe nagranie/zrzuty rzeczywiście wykonanego procesu (mapa ryzyk wyżej).
- [ ] Wypowiadane obietnice porównane z tym, co pokaz faktycznie robi — żadna strefa P2–P4 nie jest przedstawiana jako gotowa funkcja.

## Controlled Pilot Go/No-Go

Dotyczy wyłącznie wybranych workflow z rdzenia (1–9), zgodnie ze Strefą 12 — nie wymaga VMI, integracji DMS, silnika zwrotów, cykliczności, pełnego dashboardu, lakierów ani procedur, chyba że wybrany pilotaż jawnie rozszerzy zakres.

- [ ] Zgoda firmy, jeden oddział, odpowiedzialność, użytkownicy i procedura wsparcia ustalone (Strefa 12).
- [ ] Środowisko/migracje: dryf dwóch drzew migracji rozstrzygnięty dla tabel używanych przez pilotaż; odtworzenie wybranego schematu na czystej bazie sprawdzone (Strefa 1, 17).
- [ ] Macierz dostępu i rzeczywiste testy RLS uruchamianych procesów obejmują organizacje, oddziały, Storage/RPC; zweryfikowano FORCE RLS i uprawnienia uprzywilejowanych funkcji — w tym znaną lukę izolacji `wdd_matcher_*` (Strefa 1).
- [ ] Krytyczne operacje (import Matchera, przyjęcie, wydanie) są transakcyjne/idempotentne, przetestowane przy kilku użytkownikach; historia nie znika przy błędzie pośrednim (Strefy 3, 6, 8).
- [ ] Ochrona ostatniego właściciela organizacji i samodzielnej degradacji dodana (Strefa 10, dziś potwierdzony brak).
- [ ] Backup bazy i plików działa, odtworzenie przetestowane; procedura rollbacku/odtworzenia gotowa.
- [ ] Monitoring błędów, uptime i alerty mają odbiorcę; brak sekretów w repo/kliencie zweryfikowany.
- [ ] Retencja/dostęp do podpisanych dokumentów, walidacja plików, usuwanie/eksport danych i audit log ustalone (Strefa 9).
- [ ] Pisemna procedura dwusystemowa z AutoStacją: który system jest autorytatywny dla czego, kiedy następuje ręczne uzgodnienie, kto jest właścicielem rozbieżności, warunki zatrzymania pilotażu (Strefa 12, 17).
- [ ] E2E wybranych procesów, realistyczne dane i próby mobilne na docelowych urządzeniach sprawdzone; stary magazyn nie dubluje nowych dostaw (Strefa 12).
- [ ] AutoStacja pozostaje źródłem stanów/dokumentacji; mierzymy dodatkową pracę i korzyści.

## Post-pilot / dalsza produkcja — po wyborze zakresu na podstawie pilotażu

- [ ] Obserwowalność, wydajność, obciążenie, alerty i odtwarzanie odpowiadają docelowej skali.
- [ ] Analityka produktu (np. PostHog) służy miernikom; jej kompletność nie blokuje pokazu.
- [ ] Testy/hardening rozszerzono na nowe moduły, organizacje i oddziały; wykonano okresowe próby backupu/rollbacku.
- [ ] Roadmapę Stref 14–19 (cykliczność/powiadomienia, materiały/dostawcy, VMI/dashboard, integracja DMS, awaryjne/zwroty/Customer Care, lakiery/nieroty/procedury) uporządkowano na podstawie wyników pilotażu, nie automatycznie jako obowiązkowy zakres.

## Decyzja o gotowości

- [ ] **Gotowy do pitchu:** bramka „Pitch Go/No-Go" spełniona w całości, w tym wszystkie scenariusze A–K globalnego planu weryfikacji. Obecnie **niepotwierdzone / blokery otwarte** — Strefy 4, 6, 8 to najgłębsze braki implementacyjne; Strefy 1, 3, 5, 7, 9 wymagają świeżej weryfikacji, nie nowego kodu.
- [ ] **Gotowy do kontrolowanego pilotażu:** osobno spełniona bramka „Controlled Pilot Go/No-Go". Gotowy pokaz nie oznacza tej zgody — to dwie różne decyzje.
- [ ] **Gotowy do rozszerzania produkcji:** wyniki pilotażu i bramka „Post-pilot / dalsza produkcja" dla uzgodnionego zakresu. Nie wymaga się ukończenia wszystkich 19 obecnych obszarów przed prezentacją ani przed pilotażem.
