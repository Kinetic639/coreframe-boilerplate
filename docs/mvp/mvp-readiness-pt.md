# Ambra — gotowość do prezentacji i kontrolowanego pilotażu

Audyt repozytorium: **7 września 2026**. Produkt: **wyłącznie `apps/web`**. Źródło zakresu: [skrypt prezentacji](ambra-skrypt-prezentacji.md). Dowody i ograniczenia: [audyt implementacji](mvp-readiness-audit.md).

**Pełny scenariusz ze skryptu nie jest jeszcze gotowy.** Szczegółowy audyt Stref 1–12 (zakończony) pokazuje, że Ambra ma realne fundamenty i kilka w pełni działających przepływów: logowanie/organizacja/oddział (Strefa 1) i administracja członkostwami/rolami (Strefa 10) są solidne; generyczny system komentarzy/załączników (Strefa 9) jest gotowy do reużycia; wyszukiwanie/zawartość lokalizacji/relokacja pojedynczej części (Strefa 7) oraz tickety (Strefa 11) mają mocny, działający rdzeń z konkretnymi, naprawialnymi lukami (nie fikcją). Największa brakująca praca to jeden centralny łańcuch biznesowy, nie rozproszone niedoróbki: **trwałe zlecenie naprawcze z pozycjami i dokumentami (Strefa 4, dziś NOT IMPLEMENTED) → przyjęcie 101/PZ z importu Matchera rozszerzone o mobilne potwierdzenie lokalizacji, zamknięcie i raport z rzeczywistych lokalizacji (Strefa 6, dziś w połowie placeholder) → rzeczywista operacja zwykłego wydania części z polem odbiorcy (Strefa 8, dziś zaślepka UI)**. Najpierw domknąć dokładnie tę ścieżkę pokazu (skrypt §6–11); nie kończyć całej Ambry.

## Priorytety — od czego zacząć

Stan wymagany to **cel przed prezentacją**, nie ocena obecnej implementacji. Numery wskazują sekcje poniżej, nie dawne identyfikatory checklisty.

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
| P3        | 16. VMI i dalsze procesy magazynowe                                                   | ROADMAP ONLY                          | Kierunek po wynikach pilotażu                                                                                      |
| P4        | 17. Szerokie importy historyczne i integracja DMS                                     | ROADMAP ONLY                          | Skrypt dopuszcza naturalną rotację; DMS pozostaje źródłem                                                          |
| P4        | 18. Awaryjne pobrania i rozbudowane procesy zwrotów/reklamacji                        | ROADMAP ONLY                          | Wykraczają poza zwykłe wydanie i jeden ticket; ticket dziś ma tylko akceptację, nie odrzucenie                     |
| P4        | 19. Lakiery, nieroty, procedury i zbiorczy dashboard operacyjny                       | ROADMAP ONLY                          | Brak wymogu w aktualnym pokazie                                                                                    |

Numeracja i priorytety P0–P4 odpowiadają szczegółowym, zaakceptowanym Strefom 1–12 poniżej oraz niezmienionemu zakresowi 13–19. Kolumna „Wymagany stan" to cel przed pitchem, nie ocena obecnej implementacji — obecny stan każdej strefy 1–12 (🔴/🟠/🟡) jest opisany wyłącznie w jej szczegółowej sekcji, nie tutaj.

### MUST FINISH BEFORE PITCH

- Dostęp/bezpieczeństwo ścieżki demo zweryfikowane na żywo (Strefa 1): właściwa organizacja/oddział, zachowanie sesji Matchera pod RLS, potwierdzone środowisko (dryf dwóch drzew migracji rozstrzygnięty dla ścieżek użytych w demo).
- Trwała sesja Matchera (Strefa 3) zweryfikowana ręcznie na aktualnym build; świadomość, że dopasowania na poziomie linii nie są dziś zapisywane.
- Minimalny, trwały model zlecenia naprawczego z pozycjami i powiązanymi dokumentami magazynowymi (Strefa 4) — dziś NOT IMPLEMENTED; to pojedyncza najgłębsza praca implementacyjna w całym P0, bo od niej zależy ciągłość zlecenie → części → lokalizacje oraz Strefa 9.
- Fizyczna identyfikacja gotowa dla lokalizacji (Strefa 5); świadoma decyzja, czy część/zestaw dostają minimalny cel QR na potrzeby demo, czy scenariusz zostaje jawnie zawężony.
- Przyjęcie 101/PZ z importu Matchera rozszerzone o mobilne potwierdzenie lokalizacji, zamknięcie procesu i raport z rzeczywiście potwierdzonych lokalizacji (Strefa 6) — dziś połowa łańcucha (mobilne rozłożenie, zamknięcie, raport) to placeholdery.
- Szukanie, zawartość lokalizacji i relokacja pojedynczej części sprawdzone na żywo (Strefa 7); naprawione wyszukiwanie po SKU; decyzja o relokacji zestawu jak w Strefie 5.
- Rzeczywista operacja zwykłego wydania części z polem odbiorcy (Strefa 8) — dziś dedykowana funkcja to zaślepka zwracająca błąd; jedyny substytut (korekta magazynowa) nie ma pola odbiorcy.
- Załączniki zlecenia naprawczego (Strefa 9) — tanie do domknięcia zaraz po Strefie 4, niezależnie od stanu Stref 6–8.
- Pełna próba P0 wykonana w kolejności skryptu, bez fikcyjnych sukcesów, na koncie demonstratora z właściwym oddziałem; publiczny Matcher (Strefa 2, `apps/public-web`) sprawdzony jako osobne wejście do historii.

### SHOULD FINISH BEFORE PITCH

- Administracja dostępem (Strefa 10): fundament już mocny, testowany i sprawdzony po stronie serwera — przygotować konta demonstracyjne i zweryfikować ręcznie jeden krótki scenariusz (lista członków lub zaproszenie).
- Wąski przepływ ticketu (Strefa 11): utworzenie → przypisanie → komentarz → akceptacja → ponowne otwarcie z trwałą historią → skan QR ticketu; bez obietnicy odrzucenia (nie istnieje) i bez sugerowania cyfrowej relacji ticket↔zlecenie/część/zestaw (nie istnieje).
- Materiał o stanie początkowym magazynu i kontrolowanym pilotażu (Strefa 12): treść już dojrzała i uczciwa, wymaga przećwiczenia na głos oraz jawnego uwzględnienia w zakresie miesiąca 1 tego, co Strefy 4/6/8 pokazały jako dziś brakujące.

### CAN REMAIN PARTIAL

- Zadania, kalendarz i Kanban (Strefa 13): istniejący, stabilny przykład albo sama wzmianka.
- Zaawansowana funkcjonalność Car Workshop wykraczająca poza minimalny model zlecenia wymagany przez Strefę 4 (pełny edytor zleceń, historia serwisowa, integracja z pojazdami, harmonogramowanie) — sam minimalny model zlecenia (nagłówek/pozycje/dokumenty magazynowe) NIE może pozostać częściowy, jeśli demo zachowuje obecny scenariusz P0.
- Relokacja zestawu/kontenera (Strefy 5 i 7), jeśli finalny scenariusz demo świadomie jej nie obejmuje.
- Rozszerzone typy ticketów, akcja odrzucenia, pełny katalog i wyszukiwanie poza dokładnym scenariuszem P0/P1. Nieukończone warianty nie blokują sprawdzonej ścieżki.

### DO NOT SPEND TIME ON BEFORE PITCH

- Generator zadań cyklicznych, pełny system powiadomień, VMI, rozbudowa materiałów/audytów/zamawiania.
- Pełna migracja AutoStacji, nieroty, lakiery, procedury, awaryjne pobrania, Customer Care VGP i pełny dashboard.
- Akcja odrzucenia ticketu, pełny silnik zwrotów/reklamacji, relacje domenowe ticket↔zlecenie/część poza tym, co Strefy 4 i 9 już dostarczają.
- Pełne pokrycie testami wszystkich modułów, rozbudowana analityka i hardening całej produkcji. Ochrona danych demo pozostaje P0; wymagania pilotażu zachowano na końcu.

## Zasady odhaczania

- **P0 — PITCH BLOCKER:** awaria przerywa główną historię. **P1 — HIGH VALUE FOR PITCH:** bezpośrednio wzmacnia pokaz. **P2 — PARTIAL IMPLEMENTATION IS ENOUGH:** wystarcza wąski, prawdziwy przykład. **P3 — MENTION / ROADMAP ONLY:** bez istotnych prac przed spotkaniem. **P4 — DEFER:** odłożyć poza przygotowania.
- **FULLY READY:** end-to-end, trwałe dane, sprawdzone uprawnienia, happy path i główne błędy, brak mocków, ręczna próba. Tutaj dotyczy dostępu i bezpieczeństwa używanej ścieżki, nie całego IAM.
- **DEMO READY:** dokładny scenariusz działa na rzeczywistym backendzie i trwałych danych; szersze przypadki mogą pozostać otwarte. Nadal wymagane są sprawdzenie dostępu, test happy path/głównych błędów i próba ręczna.
- **PARTIALLY READY:** można uczciwie wspomnieć lub krótko pokazać część funkcji. **ROADMAP ONLY:** nie kończyć na potrzeby pitchu, nawet jeżeli część kodu już istnieje.
- `[x]` oznacza wyłącznie opisany dowód. Dawna próba ręczna nie jest świeżą certyfikacją wdrożenia. Nie odhaczamy obszaru na podstawie strony, migracji, testu z mockami ani wcześniejszego `[x]`.
- Przy zamknięciu P0/P1 zapisać wersję aplikacji, środowisko, datę, konta/role, scenariusz, wynik i dowód. Żaden obszar nie otrzymał w tym audycie nowego statusu „gotowy”.

## Kolejność zależności i pracy

Kolejność _wystąpienia_ w prezentacji zostaje zgodna ze skryptem (1 → 2 → 3 → 6 → 7 → 8 → 9 → 11 → 12). Kolejność _pracy implementacyjnej_ poniżej wynika z rzeczywistych zależności ustalonych w Strefach 1–12, nie z kolejności scenariusza — i różni się od niej w jednym ważnym miejscu (Strefa 9).

**1 (dostęp/RLS) → 3 (trwała sesja Matchera) → 4 (trwałe zlecenie naprawcze).** Strefa 4 to najgłębsza pojedyncza praca w całym P0 — wymagana przez szukanie zlecenia, ciągłość zlecenie→części→lokalizacje oraz Strefę 9. Od Strefy 4 praca rozchodzi się na dwie w dużej mierze niezależne gałęzie:

- **4 → 9.** Strefa 9 zależy WYŁĄCZNIE od istnienia trwałego zlecenia (Strefa 4) — generyczna infrastruktura załączników już istnieje i jest tania do podłączenia (nowy wpis w rejestrze celów + odpowiadająca gałąź SQL, według wzorca trzech już działających typów). Nie zależy architektonicznie od Stref 6–8 ani od tego, czy ruch magazynowy stanie się celem załączników — podpisany dokument dołącza się do zlecenia, nie do ruchu. Można ją domknąć równolegle z resztą łańcucha, od razu po Strefie 4, a nie dopiero na końcu.
- **4 → 5 → 6 → 7 → 8.** Strefa 5 (lokalizacje/QR) jest już solidnym fundamentem dla lokalizacji — jedyna otwarta decyzja to zakres fizycznej identyfikacji części/zestawu. Strefa 6 rozszerza istniejący, częściowo działający import Matchera→101 o stan przyjęcia, mobilne potwierdzenie lokalizacji, zamknięcie i raport z rzeczywistych lokalizacji. Strefa 7 konsumuje stan magazynowy wyprodukowany przez Strefę 6 — jej rdzeń (relokacja pojedynczej części, zawartość lokalizacji, historia) jest już mocny i wymaga tylko naprawy wyszukiwania po SKU oraz decyzji o relokacji zestawu (współdzielonej ze Strefą 5). Strefa 8 konsumuje ten sam stan magazynowy i potrzebuje realnej operacji wydania zamiast dzisiejszego obejścia korektą magazynową.

**2** (publiczny Matcher, `apps/public-web`) przygotować niezależnie jako osobne wejście do historii — nie blokuje ani nie jest blokowana przez powyższy łańcuch.

**10–12** to w większości przygotowanie i weryfikacja, nie nowa implementacja. Fundamenty administracji dostępem (10) i ticketów (11) są już mocne i mogą być przygotowywane równolegle z resztą, bez czekania na 4–9. Materiał pilotażowy (12) najlepiej domknąć na końcu, kiedy wiadomo dokładnie, co z łańcucha 4–9 faktycznie trafiło do pokazu — bo zakres miesiąca 1 pilotażu zależy od tego, co z tego łańcucha zostanie dokończone przed pitchem, a co dopiero w trakcie przygotowania pilotażu.

Nie rozbudowywać administracji, katalogu ani ticketów ponad wąski, sprawdzony scenariusz przed domknięciem łańcucha 4 → (9 równolegle) → 5 → 6 → 7 → 8.

## P0 — główny pokaz

### 1. Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

Logowanie, rozwiązywanie organizacji/oddziału i przełączanie oddziału są realnie zaimplementowane i w większości poprawne po prześledzeniu kodu — nie są to atrapy ani ukryte skróty. Jednocześnie w tej samej analizie potwierdzono konkretne, nieukończone lub niepewne elementy dotyczące dokładnie tych obiektów, które skrypt pokazuje na scenie (sesja Matchera), więc status nie może przekroczyć PARTIAL, nawet gdyby wszystko inne wyglądało idealnie.

**Dowody:**

- Kod: PARTIAL — ścieżka logowania, middleware, redirect QR→login→cel, loadery org/oddziału, `changeBranch`, RLS lokalizacji magazynowych i załączników zostały prześledzone do konkretnych linii. Nie da się jednak zweryfikować z repozytorium: (a) schematu/RLS tabel `qr_codes`/`qr_assignments` — brak jakiejkolwiek migracji je tworzącej mimo że są aktywnie używane przez akcje QR; (b) które z dwóch drzew migracji (`apps/web/supabase/migrations` „legacy" vs `apps/web/supabase-target/supabase/migrations` „target") faktycznie odpowiada bazie, do której łączy się środowisko demo.
- Testy automatyczne: NOT RUN — istnieje bogate pokrycie na papierze (loadery org/oddziału, `changeBranch`, `sidebar-branch-switcher`, `permissions-sync` łącznie z testem odświeżenia po zmianie oddziału, `session-branch`, czysta funkcja `resolveActiveBranch`, `permission-v2.service`, testy cross-branch dla lokalizacji i importu ruchów z Matchera, cross-org dla QR, dwa testy integracyjne RLS na żywej bazie) — żaden nie został uruchomiony w tej sesji. Potwierdzone luki: zero testów jakiegokolwiek rodzaju dla autoryzacji Help Desk; zero testów RLS na żywej bazie dla `warehouse_locations`, `wdd_matcher_*`, `helpdesk_tickets`, `qr_codes`/`qr_assignments` i `app_attachments` — istniejące dwa testy integracyjne na żywej bazie dotyczą wyłącznie członkostwa/przypisań ról organizacji.
- Weryfikacja ręczna: HISTORICAL — jedyna odnotowana próba to skan QR/lokalizacji z 6 sierpnia 2026 (opisana w sekcji 5 tego dokumentu), nieodtworzona w tej analizie. Brak jakiejkolwiek świeżej ręcznej próby logowania, przełączania oddziału czy testu odmowy dostępu.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo pełnej ścieżki logowanie → poprawna organizacja/oddział → zmiana oddziału → zmiana zakresu danych → odmowa dostępu obcego konta.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

- [ ] Konto demo loguje się przez prawdziwy Supabase Auth (e-mail/hasło) na komputerze i telefonie, na docelowym urządzeniu prezentacji.
- [ ] Sesja przeżywa nawigację i pełne odświeżenie strony na komputerze i telefonie — sprawdzone na żywo, nie tylko wywnioskowane z kodu middleware.
- [ ] Skan QR bez aktywnej sesji przechodzi przez `/sign-in?returnUrl=...` i po zalogowaniu trafia dokładnie do zeskanowanego obiektu — odtworzone na żywo na telefonie prezentacyjnym.
- [ ] `activeOrgId` konta demo po zalogowaniu wskazuje właściwą organizację (potwierdzone `user_preferences.organization_id`, nie działanie awaryjnego fallbacku „najstarsza organizacja").
- [ ] Aktywny oddział jest widoczny w interfejsie od razu po zalogowaniu i zgadza się z zamierzonym oddziałem demo.
- [ ] Przełączenie oddziału w bocznym przełączniku faktycznie zmienia dane lokalizacji magazynowych bez ręcznego odświeżania strony — potwierdzone na żywo (kod poprawnie odczytuje oddział po stronie serwera, ale przełącznik nie wywołuje `router.refresh()`/rewalidacji, więc realne zachowanie ekranu trzeba zobaczyć).
- [ ] Przełączenie oddziału przy otwartej liście sesji Matchera albo odświeża listę do nowego oddziału, albo przebieg prezentacji jest tak ułożony, że znana luka (`wddMatcherKeys.sessions()` nie ma segmentu oddziału w kluczu cache — do 2 minut nieaktualnych danych) nie ma szans się ujawnić.
- [ ] Potwierdzono na żywo, do którego projektu Supabase („legacy" czy „target", `.env.local` wskazuje `rjeraydumwechpjjzrus`) faktycznie łączy się środowisko demo, oraz że migracje definiujące `warehouse_locations`, `wdd_matcher_*` i odpowiednie polityki RLS są tam rzeczywiście zastosowane (`supabase migration list` na obu powiązanych projektach) — nie tylko obecne jako pliki w jednym z dwóch drzew.
- [ ] Na potwierdzonym środowisku sprawdzono na żywo, że tabele `wdd_matcher_*` mają włączone RLS z zamierzoną regułą dostępu; jeśli brak podziału na oddział się utrzymuje, potwierdzono że konto demo nie ma dostępu do żadnego innego oddziału, który mógłby przypadkiem „przeciec" podczas pokazu.
- [ ] Drugie konto testowe bez dostępu do docelowego oddziału/organizacji nie może otworzyć lokalizacji magazynowych, sesji Matchera ani załączników przez bezpośredni URL lub powtórzone wywołanie akcji serwerowej — sprawdzone próbą, nie tylko wywnioskowane z kodu.
- [ ] JWT tego samego drugiego konta, odpytany bezpośrednio do bazy (poza aplikacją), nie zwraca wierszy `warehouse_locations`, `wdd_matcher_*` ani `app_attachments` należących do innej organizacji/oddziału.
- [ ] Potwierdzono, że klucz service role nie trafia do zbudowanego bundle'a przeglądarki faktycznie użytego w środowisku demo — nie tylko że jest nieobecny w źródle.
- [ ] Publiczny resolver QR (bez logowania, oparty o klient service-role) przetestowany na żywo z kodem QR wskazującym obiekt innej organizacji/oddziału oraz z kodem usuniętym/odwołanym — odmowa potwierdzona, nie tylko odczytana z kodu walidatora.
- [ ] Użytkownik demo bez wymaganego modułu/uprawnienia/oddziału widzi stronę `/dashboard/access-denied` z właściwym powodem, a nie zepsuty ekran lub ciche niepowodzenie, przy próbie konkretnej zablokowanej operacji z pokazu.
- [ ] **Dokładny scenariusz pitchu Strefy 1 zweryfikowany ręcznie na aktualnym build:** logowanie → właściwa organizacja/oddział → zmiana oddziału → zmiana zakresu danych → odmowa dostępu konta spoza organizacji/oddziału.

**Pitch gap:**

Logowanie, rozwiązywanie organizacji/oddziału i trwałość aktywnego oddziału są zaimplementowane poprawnie i zweryfikowane w kodzie od middleware po loadery i akcję `changeBranch` — łącznie z poprawnym scenariuszem QR→login→cel i poprawnym zabezpieczeniem lokalizacji magazynowych w RLS (włączone i wymuszone, podział na oddział). Mimo to trzy konkretne, potwierdzone w kodzie problemy blokują status DEMO READY:

1. **Sesje Matchera — centralny obiekt demo z §6–7 skryptu — nie mają podziału na oddział w RLS.** Tabele `wdd_matcher_*` mają RLS włączone, ale niewymuszone (`FORCE ROW LEVEL SECURITY` nieustawione) i sprawdzają wyłącznie uprawnienie na poziomie organizacji, mimo że każda z nich ma kolumnę `branch_id`. Większość akcji serwerowych (upload, wyniki, eksport, ponowne dopasowanie) też nie sprawdza przynależności sesji do aktywnego oddziału — jedynym wyjątkiem jest wąska funkcja importu ruchów magazynowych. W praktyce każdy członek organizacji z uprawnieniem do Matchera może odczytać/działać na sesji dostawy innego oddziału.
2. **Nie ustalono, która z dwóch równoległych gałęzi migracji Supabase rządzi środowiskiem demo.** Tabele kluczowe dla pokazu fizycznie leżą w folderze „legacy", mimo że ich własne komentarze nagłówkowe deklarują projekt „target" (ten sam, na który wskazuje `.env.local`); folder „target" nie zawiera ich definicji `CREATE TABLE` wcale. Nie da się dziś stwierdzić z samego repozytorium, czy RLS prześledzone w kodzie faktycznie obowiązuje na bazie, z którą łączy się demo.
3. **Klucz cache React Query listy sesji Matchera nie zawiera identyfikatora oddziału**, w przeciwieństwie do lokalizacji magazynowych — żywa zmiana oddziału podczas prezentacji może pokazać nieaktualne (z poprzedniego oddziału) dane sesji przez do 2 minut.

Dodatkowo nic z powyższego nie zostało odtworzone ręcznie na aktualnym build: ostatnia zapisana próba ręczna (skan QR/lokalizacji) pochodzi z 6 sierpnia 2026 i jest HISTORICAL, a żaden z licznych testów automatycznych opisanych powyżej nie został w tej sesji uruchomiony.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Dodano podział na oddział w RLS (albo świadomie zaakceptowano kontrolę zastępczą) dla `wdd_matcher_*` i `helpdesk_tickets`/powiązanych tabel i Storage, na wzór już istniejącego wzorca `warehouse_locations`, zanim pilot zacznie przechowywać realne, rozróżnione na oddziały dane.
- [ ] Zlokalizowano lub odtworzono schemat i polityki RLS `qr_codes`/`qr_assignments` (obecnie całkowicie nieobecne w migracjach) i zapisano je w repozytorium, żeby dane QR pilotażu nie działały na nieudokumentowanym, niepodlegającym review schemacie.
- [ ] Ostatecznie rozstrzygnięto niejednoznaczność drzew migracji: jedno źródło prawdy co do tego, który projekt Supabase jest „produkcją" pilotażu, drugie drzewo zarchiwizowane lub jawnie oznaczone jako historyczne.
- [ ] Testy integracyjne RLS na żywej bazie (na wzór istniejących testów `organization-rls`) rozszerzono o `warehouse_locations`, `wdd_matcher_*`, `helpdesk_tickets`, `qr_codes`/`qr_assignments` i `app_attachments` — nie tylko testy na zamockowanym kliencie sprawdzające logikę aplikacji.
- [ ] Autoryzacja zgłoszeń Help Desk ma choćby minimalne pokrycie testami automatycznymi (obecnie zero testów jakiegokolwiek rodzaju).
- [ ] Zachowanie wygasania sesji / ponownego logowania zweryfikowane w realnych warunkach pilotażu (telefon leżący bezczynnie na magazynie itp.).
- [ ] Odebranie członkostwa/roli działa natychmiast — usunięty użytkownik albo zmieniona rola tracą dostęp bez oczekiwania na nieaktualność snapshotu uprawnień, sprawdzone na żywo prawdziwym odebraniem dostępu.
- [ ] Zmiana roli/uprawnień w trakcie sesji użytkownika jest widoczna bez konieczności pełnego wylogowania (albo jasno zakomunikowana polityka „zmiany obowiązują od następnego logowania").
- [ ] Autoryzacja Storage zweryfikowana na realnych plikach pilotażu (zdjęcia podpisanych dokumentów, pliki PDF Matchera) na co najmniej dwóch oddziałach/użytkownikach — nie tylko przez odczyt `can_access_comment_target`.
- [ ] Log audytowy obejmuje wrażliwe akcje administracyjne istotne dla pilotażu (zmiana roli, przepisanie oddziału, utworzenie zaproszenia) i potwierdzono, że rzeczywiście zapisuje wiersze podczas próby na żywo.
- [ ] Współbieżność: dwóch użytkowników zmieniających przypisanie roli/oddziału tej samej osoby niemal jednocześnie nie zostawia niespójnego snapshotu uprawnień.
- [ ] Zweryfikowano realistyczną obsługę błędów produkcyjnych: nieudana zmiana oddziału/sprawdzenie uprawnień pokazuje pilotażowemu użytkownikowi czytelny komunikat, nie stack trace ani ciche niepowodzenie.
- [ ] Przetestowano end-to-end przynajmniej realny zestaw ról pilotażu (odpowiednik właściciela/kierownika/pracownika magazynu/doradcy) pod kątem granic dostępu, którymi mają dysponować, na reprezentatywnych kontach pilotażowych, nie tylko na kontach syntetycznych.
- [ ] **Dokładny scenariusz pilotażu Strefy 1 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu.**

**Pilot gap:**

Powyższe wymagania wykraczają poza to, czego potrzebuje pitch. W szczególności luka w podziale na oddział w RLS Matchera/Help Desk jest tolerowalna przy pojedynczym oddziale i jednym koncie demo (gdzie ekspozycja między oddziałami może nigdy nie zostać uruchomiona), ale nie do zaakceptowania, gdy pilotaż wprowadzi wielu realnych użytkowników na realnych oddziałach z danymi firmowymi — wtedy „dowolny członek organizacji widzi sesje/zgłoszenia dowolnego oddziału" przestaje być teoretyczną obserwacją, a staje się realną wadą izolacji danych. Podobnie nieudokumentowany schemat `qr_codes`/`qr_assignments` i nierozstrzygnięta kwestia drzewa migracji są akceptowalną niewiadomą dla jednego przećwiczonego pokazu, ale nie dla trzymiesięcznego pilotażu przechowującego dane realnej firmy.

### Notes / evidence

- Logowanie w `apps/web` jest realnym Supabase Auth (`signInWithPassword`) — `apps/web/src/app/[locale]/actions.ts:142-249`, `apps/web/src/components/auth/forms/sign-in-form.tsx`. Ostrzeżenie o „zaszytym na sztywno ciasteczku sesji demo" z `docs/mvp/mvp-readiness-test-org-setup.md`, wywiedzione z `docs/investor-feature-inventory.md` (linia 102), dotyczy wyłącznie `apps/vmi-client` (`apps/vmi-client/src/lib/demo-session.ts`) — nie `apps/web`. To ryzyko można wykreślić z listy dla tej strefy.
- Middleware/odświeżanie sesji: `apps/web/src/proxy.ts:23-56`, `apps/web/src/utils/supabase/proxy.ts:40-111` — wymusza logowanie na `/dashboard/*`, przekierowuje niezalogowanych do `/sign-in?returnUrl=...`.
- Ścieżka QR → login → cel: `apps/web/src/app/qr/[token]/page.tsx`, `apps/web/src/server/qr/public-token-resolver.ts:47-130`, spięta z obsługą `returnUrl` w `signInAction` (`actions.ts:145,186-227`).
- Rozwiązywanie organizacji/oddziału opiera się na bazie (`user_preferences.organization_id`/`default_branch_id`), nie na ciasteczku — `apps/web/src/server/loaders/v2/load-app-context.v2.ts:39-224`.
- `changeBranch` waliduje po stronie serwera członkostwo w organizacji i dostępność oddziału przed zapisem — `apps/web/src/app/actions/shared/changeBranch.ts:22-82`; `_computeAccessibleBranches` zamyka się bezpiecznie (`[]`) przy błędzie bazy — `load-dashboard-context.v2.ts:31-64`.
- RLS lokalizacji magazynowych ma podział na oddział i jest wymuszone (`FORCE`) — `apps/web/supabase/migrations/20260401130000_warehouse_locations_rls_hardening.sql`.
- Tabele Matchera (`wdd_matcher_sessions` i 5 powiązanych): RLS włączone, ale niewymuszone, wyłącznie na poziomie organizacji mimo kolumny `branch_id` — `apps/web/supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql`; większość akcji serwerowych nie sprawdza przynależności sesji do oddziału poza `getMovementImportCandidates` — `apps/web/src/server/services/wdd-matcher.service.ts:462-483` vs niezabezpieczone akcje w `apps/web/src/app/actions/tools/wdd-matcher.ts`.
- Zgłoszenia Help Desk: ten sam wzorzec RLS wyłącznie na poziomie organizacji mimo kolumny `branch_id` — `apps/web/supabase/migrations/20260526100000_helpdesk_module.sql`; kilka akcji odczytu/listowania polega wyłącznie na RLS bez żadnego sprawdzenia uprawnień w kodzie aplikacji — `apps/web/src/app/actions/help-desk/index.ts:154-169,467-500`.
- Tabele `qr_codes`/`qr_assignments`, używane realnie przez akcje QR, nie mają żadnej odpowiadającej migracji w repozytorium — schemat/RLS niemożliwe do zweryfikowania z kodu źródłowego.
- Dwa równoległe drzewa migracji Supabase (`apps/web/supabase/migrations` „legacy" vs `apps/web/supabase-target/supabase/migrations` „target"); `.env.local` wskazuje działającą aplikację na projekt target (`rjeraydumwechpjjzrus`), ale migracje tabel kluczowych dla pitchu leżą w folderze legacy mimo deklaracji tego samego projektu target we własnych komentarzach nagłówkowych — nierozstrzygnięte z samego repozytorium; wymaga uruchomienia `supabase migration list` na obu powiązanych projektach.
- Nie znaleziono użycia klucza service role osiągalnego z przeglądarki — `apps/web/src/utils/supabase/service.ts` to jedyna fabryka, zabezpieczona `import "server-only"` w jedynym prześledzonym konsumencie (`public-token-resolver.ts`).
- Klucz cache React Query listy sesji Matchera nie ma segmentu oddziału (`wddMatcherKeys.sessions()`), w przeciwieństwie do lokalizacji magazynowych (`locationsByBranch(branchId)`) — `apps/web/src/hooks/queries/tools/wdd-matcher.ts:28` vs `apps/web/src/hooks/queries/warehouse/index.ts:174` — żywa zmiana oddziału może pokazać nieaktualne dane sesji przez do 2 minut.
- Testy integracyjne RLS na żywej bazie istnieją wyłącznie dla członkostwa/przypisań ról organizacji (`organization-rls.test.ts`, `organization-rls-integration.test.ts`); zero testów RLS na żywej bazie dla `warehouse_locations`, `wdd_matcher_*`, `helpdesk_tickets`, `qr_codes`/`qr_assignments` i `app_attachments`; zero testów jakiegokolwiek rodzaju dla autoryzacji Help Desk.
- Jedyna zapisana ręczna weryfikacja to skan QR/lokalizacji z 6 sierpnia 2026, opisany w sekcji 5 tego dokumentu — nieodtworzony w tej analizie, oznaczony HISTORICAL.

### 2. Publiczny SVWMS Matcher

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

Wbrew wcześniejszej notatce w tym dokumencie („implementacji poza web nie audytowano"), publiczny Matcher **istnieje w tym repozytorium** — nie w `apps/web`, tylko w `apps/public-web` (witryna marketingowa, na którą `apps/web` przekierowuje `/tools/svwms-wdd-matcher`). To realna, w pełni zaimplementowana ścieżka: bez logowania, bez zapisu do bazy, z prawdziwym parserem PDF i algorytmem dopasowania — nie atrapa i nie zewnętrzna czarna skrzynka poza zasięgiem repo. Mimo to status nie może przekroczyć PARTIAL: zero testów automatycznych faktycznie wykonuje ten pipeline, a żadna świeża próba ręczna na aktualnym build nie została odnotowana.

**Dowody:**

- Kod: VERIFIED — prześledzono cały pipeline: upload (`upload-zone.tsx`) → akcja serwerowa `runPublicWddMatcherAction` (`apps/public-web/src/app/actions/tools/wdd-matcher-public.ts:274-334`) → parser (`parser_v4.ts`, realna ekstrakcja PDF przez `pdfjs-dist`, nie stub) → dopasowanie (`matcher.ts`, `runWddEnrichment`) → wynik (`public-wdd-matcher.tsx`) → eksport JSON/PDF. Potwierdzono brak logowania (żaden gate autoryzacji na trasie `(public)/tools/svwms-wdd-matcher/page.tsx`) i brak zapisu sesji (żadne wywołanie Supabase/localStorage/cookie w całej ścieżce publicznej; syntetyczne rekordy sesji istnieją wyłącznie w pamięci na czas jednego wywołania akcji serwerowej). Silnik parsera i matchera (`parser_v4.ts`, `matcher.ts`) jest bajt-w-bajt identyczny z wersją używaną przez zalogowany Matcher w `apps/web` — to ten sam kod, zduplikowany, aktualnie zsynchronizowany, ale bez żadnego mechanizmu wymuszającego tę synchronizację w przyszłości.
- Testy automatyczne: NONE — jedyny test dotykający tego obszaru (`apps/public-web/src/components/tools/svwms-wdd-matcher/__tests__/movement-import-boundary.test.ts`) sprawdza tylko, że komponenty wyników nie zawierają stringów związanych z importem do ruchów magazynowych, oraz kształt osobnego adaptera importu — nie wykonuje żadnego realnego uploadu/parsowania/dopasowania. Zero testów jednostkowych `parser_v4.ts`/`matcher.ts` w `apps/public-web`, zero testów komponentów `upload-zone.tsx`/`public-wdd-matcher.tsx`.
- Weryfikacja ręczna: NOT VERIFIED — informacja skryptu „korzystamy z tego narzędzia od kwietnia" to deklaracja biznesowa właściciela projektu, nietestowalna przez repozytorium; przyjęta jako kontekst, ale nie zastępuje świeżej próby na aktualnym build. Nie odnaleziono żadnej odnotowanej próby ręcznej tej konkretnej trasy w dokumentacji repo.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo otwarcia właściwego publicznego adresu, uploadu przygotowanych dokumentów demo i porównania wyniku z dokumentami fizycznymi.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

- [ ] Potwierdzono na żywo, że właściwy publiczny adres (`https://www.ambra-system.com/tools/svwms-wdd-matcher`, warianty PL `/narzedzia/svwms-wdd-matcher` i EN) ładuje się i nie wymaga logowania — na docelowym urządzeniu i sieci prezentacji, nie tylko wywnioskowane z konfiguracji przekierowań.
- [ ] Przygotowano dokładny zestaw dokumentów demonstracyjnych (dostawa BC + dokumenty magazynów marek) w wersji fizycznej i cyfrowej, zanonimizowany jeśli pochodzi z realnej dostawy.
- [ ] Wgrano te same przygotowane dokumenty do docelowego publicznego narzędzia i potwierdzono udany upload oraz parsowanie bez błędów na aktualnym build.
- [ ] Dopasowanie zwraca oczekiwany, znany wcześniej wynik — liczba dopasowań dokładnych/częściowych/niejednoznacznych/niedopasowanych zgadza się z fizycznymi dokumentami.
- [ ] Jeśli przygotowany zestaw zawiera pozycje niedopasowane lub niejednoznaczne, prezenter wie to z wyprzedzeniem i potwierdzono, że interfejs wyraźnie je pokazuje, a nie ukrywa (`unmatched_bc`/`unmatched_brand`/`ambiguous` w `matcher.ts` są rozróżniane w UI).
- [ ] Potwierdzono wizualnie na żywo (np. w świeżej/incognito karcie), że narzędzie nie pokazuje żadnych śladów wcześniejszej zalogowanej sesji Ambry — zgodnie z architekturą (brak zapisu do bazy), ale niepotwierdzone dotąd na żywo.
- [ ] Potwierdzono, że żadne wrażliwe dane firmowe (nazwiska klientów, VINy, ceny) nie pojawiają się w przygotowanych dokumentach, jeśli pochodzą z realnej kwietniowej dostawy.
- [ ] Sprawdzono czas przetwarzania (parsowanie PDF odbywa się po stronie serwera przy każdym wywołaniu, bez cache) na docelowym urządzeniu/sieci — nie powoduje nieoczekiwanie długiej przerwy w trakcie prezentacji.
- [ ] Przygotowano zapasowy wynik/nagranie z jasno opisanym pochodzeniem na wypadek awarii sieci lub usługi w trakcie prezentacji.
- [ ] Ustalono, co powiedzieć w razie nieoczekiwanego błędu na dokładnie tych przygotowanych dokumentach na żywo — biorąc pod uwagę brak jakiegokolwiek automatycznego testu tego pipeline'u, pierwsza próba „na scenie" niesie realne, nie tylko teoretyczne ryzyko.
- [ ] **Dokładny scenariusz pitchu Strefy 2 zweryfikowany ręcznie na aktualnym build/wdrożeniu:** otwarcie publicznego adresu bez logowania → upload przygotowanych dokumentów → udane dopasowanie → wynik zgodny z dokumentami fizycznymi.

**Pitch gap:**

Implementacja jest realna i sprawdzona w kodzie — kompletny pipeline (upload → parsowanie PDF → dopasowanie → wynik → eksport), potwierdzony brak logowania i brak zapisu sesji, zgodnie z obietnicą skryptu. Główne braki to nie luki implementacyjne, tylko brak dowodu na aktualnym build: zero testów automatycznych faktycznie wykonujących ten pipeline (jedyny test sprawdza tylko granicę tekstową między komponentami), brak jakiejkolwiek odnotowanej świeżej próby ręcznej tej trasy, oraz niemożliwe do zweryfikowania z repozytorium, czy trasa jest dziś faktycznie wdrożona i odpowiada pod publicznym adresem (brak dostępu do sieci w tej analizie). Dodatkowo brak jakiegokolwiek rate-limitingu/ograniczenia liczby lub rozmiaru plików w kodzie tej trasy (tylko globalny limit body 10 MB) — niekrytyczne dla jednorazowego pokazu, ale warte odnotowania.

**Wymagany stan dla pilotażu:** minimalny ponad pitch — patrz uzasadnienie niżej

### Pilot readiness checklist

Publiczny Matcher **nie jest** planowaną ścieżką danych pilotażu — pilotaż przechodzi przez zalogowany Matcher z trwałą sesją (Strefa 3), objęty modelem organizacji/oddziału/RLS. Publiczne narzędzie z założenia architektonicznego pozostaje poza tym obwodem (bez logowania, bez zapisu, bez `org_id`/`branch_id` — placeholder `"public"` w rekordach). Dlatego lista wymagań pilotażowych dla tej strefy jest celowo krótka:

- [ ] Potwierdzono z właścicielem projektu, czy publiczne narzędzie ma nadal działać jako niezależny, używany od kwietnia tool równolegle do pilotażu, czy ma pełnić rolę wejścia do przepływu pilotażowego — to rozstrzyga, czy poniższy punkt w ogóle dotyczy tej strefy.
- [ ] Jeśli pozostaje niezależnym narzędziem: brak dodatkowego hardeningu ponad pitch — nie wymaga izolacji organizacyjnej/oddziałowej ani testów RLS, ponieważ z definicji nie przechowuje ani nie ujawnia danych żadnej organizacji.
- [ ] Jeśli w praktyce staje się nieformalnym punktem wejścia do pilotażu (pracownicy używają go zamiast zalogowanej wersji z przyzwyczajenia), ustalono jasną instrukcję, kiedy i jak wynik trzeba świadomie przenieść do zalogowanej Ambry — żeby dane z publicznego narzędzia nie „gubiły się" zamiast trafiać do procesu pilotażu.
- [ ] **Dokładny scenariusz pilotażu Strefy 2 zweryfikowany z reprezentatywnymi użytkownikami** — dotyczy wyłącznie, jeśli powyższy punkt ustali, że narzędzie pozostaje częścią przepływu pilotażu; w przeciwnym razie ten punkt jest nie dotyczy (N/A), nie otwartym blokerem.

**Pilot gap:**

Brak istotnej luki ponad pitch, o ile narzędzie pozostaje tym, czym jest dziś — niezależnym, przedpilotażowym tooli poza obwodem organizacji/oddziału/RLS. Jedyne realne ryzyko to niejednoznaczność roli: jeśli podczas pilotażu pracownicy nieformalnie dalej używają publicznej wersji zamiast zalogowanej (bo jest prostsza), dane z realnych dostaw pilotażu mogą nie trafiać do trwałego procesu, którego dotyczy Strefa 3. To wymaga ustalenia komunikacyjnego/proceduralnego, nie zmiany kodu.

### Notes / evidence

- Trasa istnieje w `apps/public-web` (nie `apps/web`): `apps/public-web/src/app/[locale]/(public)/tools/svwms-wdd-matcher/page.tsx`, komponent wejściowy `apps/public-web/src/components/tools/svwms-wdd-matcher/public-wdd-matcher.tsx`. `apps/web/next.config.ts:80-87` przekierowuje `/tools/svwms-wdd-matcher` (i warianty PL/EN) do `publicSiteUrl`, co potwierdza zamierzone umiejscowienie na witrynie marketingowej.
- Brak logowania potwierdzony: brak gate'u auth w `(public)/layout.tsx` (tylko odczyt ustawień strony przez klienta service-role, nieorganizacyjny), brak `middleware.ts` w `apps/public-web/src`, brak wywołań auth w `wdd-matcher-public.ts`.
- Brak zapisu sesji potwierdzony: zero wywołań Supabase/localStorage/sessionStorage/cookie w całej ścieżce publicznej; syntetyczny identyfikator sesji `public-${Date.now()}` istnieje tylko w pamięci na czas jednego żądania (`wdd-matcher-public.ts:274-334`). Potwierdza to też własna kopia PL aplikacji: „Nie wymaga logowania i nie zapisuje danych w bazie" (`apps/public-web/messages/pl.json:3844-3848`).
- Parser i matcher (`parser_v4.ts`, `matcher.ts`) są bajt-w-bajt identyczne (te same sumy MD5) z wersją używaną przez zalogowany Matcher w `apps/web/src/lib/tools/svwms-wdd-matcher/` — to zduplikowany, nie współdzielony przez pakiet kod; obecnie zsynchronizowany, ale bez wymuszenia tej synchronizacji.
- Niedopasowania są pierwszorzędnym stanem, nie efektem ubocznym: `unmatched_bc`, `unmatched_brand`, `ambiguous` w `matcher.ts` (np. linie 194-228, 303-365, 386-400), pokazywane w UI jako osobne liczniki (`public-wdd-matcher.tsx:49-56,170-180`).
- Plik `apps/public-web/src/server/services/movement-import-adapters/svwms-wdd-matcher.adapter.ts` **nie** należy do publicznej ścieżki — to część osobnego, w pełni zalogowanego mini-modułu magazynowego wewnątrz `apps/public-web` (`requireWarehouseContext()` w `.../warehouse/inventory/action-context.ts:11-24`), niepowiązanego z publicznym narzędziem; test graniczny (`movement-import-boundary.test.ts`) istnieje właśnie po to, żeby ten rozdział wymusić.
- Brak ochrony przed nadużyciem w kodzie tej trasy: brak rate-limitingu, brak limitu liczby/rozmiaru pojedynczego pliku poza globalnym `experimental.serverActions.bodySizeLimit: "10mb"` (`apps/public-web/next.config.ts:88`) — potencjalnie akceptowalne dla jednorazowego, kontrolowanego pokazu, ale warte świadomej decyzji, nie przeoczenia.
- Deklaracja skryptu „korzystamy z tego narzędzia już od kwietnia" jest twierdzeniem biznesowym właściciela projektu — repozytorium nie może i nie musi tego dowodzić; zapisane jako kontekst, nie jako dowód gotowości aktualnego build.

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

### 4. Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe

**Priorytet:** P0

**Stan obecny:** 🔴 NOT IMPLEMENTED

Moduł Workshop to dziś wyłącznie siatka kart „coming soon" bez jakiejkolwiek warstwy trwałości. Nie istnieje żadna trwała encja zlecenia naprawczego, żadna migracja bazy danych z tabelą zlecenia, żadna usługa/akcja/typ `RepairOrder`/`WorkshopOrder`. Numery zleceń z Matchera (Strefa 3) trafiają wyłącznie do nieindeksowanego pola JSONB — nie stanowią to podstawy dla modelu domenowego opisanego w tym zadaniu. Co więcej, kod parsera **nie wyodrębnia dziś w ogóle** identyfikatora warsztatu/magazynu w stylu D3332/D3112 jako niezależnej wartości — jedyne miejsce, gdzie taki kod się pojawia, to funkcja generująca odtworzony PDF, która **wylicza** go z ostatnich cyfr numeru zlecenia/ZW/WDD, a nie odczytuje go z dokumentu źródłowego. Innymi słowy: założenie z tego zadania („ten sam numer zlecenia może wystąpić w różnych kontekstach warsztatowych") jest dziś strukturalnie niemożliwe do odróżnienia w systemie, ponieważ nie istnieje żaden niezależny sygnał kontekstu warsztatu poza samym numerem zlecenia. To nie jest „wczesna, rozłączona" implementacja — to brak modelu domenowego w całości, stąd 🔴 NOT IMPLEMENTED, nie 🟠 czy 🟡.

**Dowody:**

- Kod: VERIFIED (brak). `apps/web/src/app/[locale]/dashboard/workshop/page.tsx` renderuje statyczną siatkę kart (`repairs, vehicles, claims, parts, tasks, handover`) z odznaką „coming soon" i `opacity-60`, bez pobierania danych i bez formularzy. `layout.tsx` tego modułu tylko sprawdza uprawnienia/entitlement, nic więcej. Własna dokumentacja modułu (`apps/web/src/modules/workshop/MODULE.md`) wprost opisuje zakres „Now" jako wyłącznie fundament (shell + karty coming-soon + gate'y) i zakres „Future" jako niezaimplementowany (zlecenia naprawcze, przyjęcie pojazdu, reklamacje, zamawianie części, zadania, przekazanie klientowi). Przeszukano obie gałęzie migracji (`apps/web/supabase/migrations/`, `apps/web/supabase-target/supabase/migrations/`) pod kątem `repair_order`/`workshop_order`/`service_order`/`zlecenie` — zero trafień. Przeszukano `apps/web/src` pod kątem `RepairOrder`/`WorkshopOrder`/`ServiceOrder` — zero trafień.
- Identyfikator warsztatu/magazynu (Dxxxx): kod `D\d+` w `parser_v4.ts` występuje wyłącznie jako granica tekstu do wykrycia/odcięcia nagłówka bloku (`isBlockTitleLine`, linia ok. 477; czyszczenie nazwy grupy, linia ok. 1213) — nigdy nie trafia do żadnego pola/metadanej jako samodzielna wartość. Jedyne miejsce, gdzie etykieta „D####" trafia do wyniku, to `enhanced-delivery-pdf.tsx` (`bodyShopCode`, ok. linii 343-346) — funkcja czysto wyliczeniowa, budująca `"D" + ostatnie cyfry numeru zlecenia/ZW/WDD`, nie odczyt z dokumentu. Potwierdza to, że dzisiejszy system nie ma żadnego niezależnego sygnału kontekstu warsztatowego.
- Testy automatyczne: NONE — nie istnieje żaden test dotyczący zlecenia naprawczego, bo nie istnieje funkcjonalność, którą można by przetestować.
- Weryfikacja ręczna: NOT APPLICABLE — nie ma czego weryfikować ręcznie; strona pokazuje wyłącznie statyczne karty „wkrótce".
- Przebieg end-to-end: NOT VERIFIED / NIEMOŻLIWY DO WYKONANIA na dzisiejszym build — nie istnieje ścieżka wyszukania zlecenia → nagłówek → pozycje → dokumenty magazynowe, bo żaden z tych ekranów nie ma zaplecza.

**Wymagany stan dla pitchu:** DEMO READY

Skrypt (§5, §7, §9–11) zapowiada, że Ambra „łączy informacje z lokalizacjami i historią operacji" oraz pokazuje zlecenie → części → lokalizacje jako spójną ścieżkę. Ta strefa jest warunkiem tej obietnicy w zakresie, w jakim demo ma pokazywać rzeczywiste zlecenie z wieloma częściami i wieloma dokumentami dostawy — nie w zakresie pełnego modułu Workshop.

### Pitch readiness checklist

**Tożsamość zlecenia**

- [ ] Istnieje trwała encja zlecenia naprawczego z własnym wewnętrznym identyfikatorem (nie identyfikatorem sesji Matchera i nie surowym numerem zlecenia jako kluczem głównym).
- [ ] Tożsamość biznesowa zlecenia jest bezpieczna: sam `order_number`/`zl_number` NIE jest traktowany jako unikalny w skali organizacji/oddziału — ustalono i zaimplementowano złożony klucz (co najmniej: organizacja/oddział + kontekst warsztatu/magazynu, gdy jest dostępny + numer zlecenia).
- [ ] Ustalono, w jaki sposób system rzeczywiście pozyska kontekst warsztatu/magazynu (Dxxxx lub odpowiednik) — dziś nie jest on parsowany jako niezależna wartość, tylko wyliczany z numeru zlecenia w jednym, niepowiązanym miejscu (generator PDF). Bez realnego, niezależnego źródła tego sygnału złożony klucz z punktu wyżej jest fikcyjny.
- [ ] Ten sam numer zlecenia w innym kontekście warsztatowym nie koliduje z istniejącym zleceniem — sprawdzone na przygotowanych danych, nie tylko założone.

**Nagłówek**

- [ ] Minimalne dane źródłowe (numer zlecenia/ZL, BLWK, ZW, VIN jeśli dostępny, kontrahent/klient jeśli dostępny, marka/dealer, oddział) są trwale zapisane przy zleceniu, nie tylko odczytywane doraźnie z metadanych sesji Matchera.
- [ ] Widok nagłówka pokazuje te dane w jednym miejscu, czytelnie powiązane z konkretnym zleceniem.

**Pozycje**

- [ ] Zlecenie ma trwałą, kompletną, NIEGRUPOWANĄ według dokumentu WDD listę pozycji — użytkownik widzi wszystkie części zlecenia niezależnie od tego, którą dostawą dotarły.
- [ ] Każda pozycja ma SKU/numer katalogowy, nazwę, zamówioną ilość i jednostkę, powiązanie z konkretnym zleceniem (nie tylko z produktem katalogowym — rozróżnienie „produkt katalogowy" vs „pozycja zlecenia" jest zachowane).
- [ ] Widoczny jest aktualny stan magazynowy/status każdej pozycji (co najmniej: oczekiwana / przyjęta / gdzie się znajduje), pochodzący z realnych operacji magazynowych, nie z domysłu.
- [ ] Dostawa tej samej pozycji w kilku różnych dokumentach WDD nie tworzy duplikatu pozycji zlecenia — ilości/lokalizacje się sumują/aktualizują na tej samej logicznej pozycji.

**Magazyn i Zam. (dokumenty)**

- [ ] Jedno zlecenie może mieć wiele powiązanych dokumentów magazynowych (różne dokumenty WDD, ewentualne późniejsze wydanie) — każdy zachowany jako osobny rekord.
- [ ] Dwa różne dokumenty WDD odnoszące się do tego samego zlecenia (np. WDD 2647 i WDD 2663 dla tego samego ZL/ZLEC) są poprawnie powiązane z jednym zleceniem, nie tworzą dwóch osobnych zleceń — sprawdzone na przygotowanym przykładzie z rzeczywistych danych Matchera.
- [ ] Ponowny import tego samego dokumentu WDD nie duplikuje dokumentu ani jego pozycji.

**Integracja z Matcherem (Strefa 3 → Strefa 4)**

- [ ] Zapisana sesja Matchera (Strefa 3) potrafi rozpoznać/utworzyć zlecenie naprawcze na podstawie wyekstrahowanych identyfikatorów.
- [ ] Powtórne przetworzenie danych dla tego samego zlecenia rozwiązuje się do tego samego zlecenia, nie tworzy duplikatu.
- [ ] Różne dokumenty WDD dla tego samego zlecenia pozostają osobnymi dokumentami magazynowymi przypisanymi do jednego zlecenia, zgodnie z modelem wyżej.
- [ ] Pozycje z Matchera są poprawnie skojarzone z pozycjami zlecenia, nie tylko wyświetlone obok siebie.

**Interfejs**

- [ ] Istnieje wyszukiwanie zlecenia po numerze.
- [ ] Niejednoznaczny numer zlecenia (ten sam numer w różnych kontekstach warsztatowych) jest jawnie rozstrzygany w UI — użytkownik nie trafia po cichu do przypadkowego zlecenia.
- [ ] Istnieje widok szczegółów zlecenia z trzema sekcjami: Nagłówek, Pozycje, Magazyn i Zam.
- [ ] Odświeżenie strony i ponowne zalogowanie nie gubi żadnych z powyższych danych — wszystko odtwarzane z backendu.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 4 zweryfikowany ręcznie na aktualnym build, na reprezentatywnych danych obejmujących:** jedno zlecenie naprawcze z wieloma częściami, co najmniej dwa osobne dokumenty WDD dla tego samego zlecenia, obecny identyfikator kontekstu warsztatu/magazynu, wyszukanie zlecenia, oraz wszystkie trzy widoki (Nagłówek/Pozycje/Magazyn i Zam.) pokazujące spójne, trwałe dane po odświeżeniu.

**Pitch gap:**

Cała funkcjonalność wymagana przez tę strefę jest dziś nieobecna, nie częściowa. Nie ma trwałej encji zlecenia, nie ma pozycji zlecenia jako osobnej relacji od katalogu produktów, nie ma powiązania wiele-dokumentów-WDD-do-jednego-zlecenia, nie ma widoku Nagłówek/Pozycje/Magazyn i Zam., nie ma wyszukiwania zlecenia. Dodatkowo brakuje samego surowca potrzebnego do bezpiecznej tożsamości biznesowej: kod dziś nie wyodrębnia niezależnego identyfikatora kontekstu warsztatu/magazynu (Dxxxx) z dokumentu źródłowego — jedyna istniejąca „wersja" tego identyfikatora jest matematycznie wyliczona z samego numeru zlecenia w module generowania PDF, więc nie może pełnić roli niezależnego sygnału odróżniającego dwa zlecenia o tym samym numerze w różnych kontekstach. Zbudowanie tej strefy wymaga w praktyce: (1) nowego modelu danych zlecenia i pozycji zlecenia, (2) potwierdzenia lub wprowadzenia realnego parsowania identyfikatora warsztatu/magazynu z dokumentów źródłowych (nie z generowanego PDF), (3) logiki rozpoznawania/tworzenia zlecenia z danych Matchera, (4) nowego interfejsu z trzema widokami i wyszukiwaniem. To realna praca implementacyjna, nie tylko odhaczenie istniejącego kodu.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Ograniczenia bazy danych (unique constraints) wymuszające złożoną tożsamość biznesową zlecenia (organizacja/oddział + kontekst warsztatu + numer), nie tylko konwencję po stronie aplikacji.
- [ ] Import Matcher → zlecenie jest idempotentny — powtórne przetworzenie tych samych danych (błąd sieci, ponowny upload) nie tworzy duplikatu zlecenia ani duplikatu dokumentu WDD.
- [ ] Bezpieczeństwo współbieżnego importu — dwóch pracowników przetwarzających dostawy w tym samym czasie nie tworzy wyścigu prowadzącego do dwóch zleceń dla jednej sprawy.
- [ ] Ochrona przed zdublowanym dokumentem WDD (ten sam dokument wgrany dwukrotnie) na poziomie bazy, nie tylko UI.
- [ ] Granice transakcyjne przy tworzeniu/aktualizacji zlecenia i jego pozycji — częściowa awaria nie zostawia zlecenia w niespójnym stanie (np. dokument dodany, pozycje nie).
- [ ] Ścieżka korekty/pojednania błędnego rozpoznania identyfikatora źródłowego (np. źle zinterpretowany kontekst warsztatu) bez utraty historii i bez ręcznej ingerencji w bazę.
- [ ] Obsługa scalania/konfliktu, gdy dwa niezależnie utworzone rekordy okazują się dotyczyć tego samego zlecenia.
- [ ] Trwały ślad audytowy zmian zlecenia (kto/kiedy utworzył, powiązał dokument, zmienił status).
- [ ] Izolacja między organizacjami/oddziałami dla nowych tabel zlecenia i pozycji — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowych tabel, nie duplikowana.
- [ ] Wydajność wyszukiwania zlecenia przy realistycznej liczbie zleceń/pozycji dla pilotażowego oddziału, nie tylko przy garstce danych demo.
- [ ] Zachowanie archiwizacji/zamknięcia zlecenia ustalone (co się dzieje ze zleceniem po zakończeniu obsługi).
- [ ] Bezpieczna obsługa niekompletnych/zniekształconych metadanych z Matchera (brak numeru zlecenia, brak kontekstu warsztatu) — zlecenie nie powstaje po cichu z błędnymi/pustymi danymi tożsamości.
- [ ] Bezpieczna ewolucja schematu przy przejściu z dzisiejszego stanu (brak modelu) do nowych tabel — plan migracji danych historycznych z Matchera, jeśli mają zostać powiązane retroaktywnie.
- [ ] Testy integracyjne automatyczne pokrywające: Matcher → rozpoznanie/utworzenie zlecenia → wiele dokumentów WDD → spójny widok pozycji.
- [ ] Realistyczny test wieloużytkownikowy: różni pracownicy przeglądający/aktualizujący to samo zlecenie jednocześnie.
- [ ] **Dokładny scenariusz pilotażu Strefy 4 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami**, w tym powtórny import i przypadek dwóch dokumentów WDD dla jednego zlecenia na realnych danych.

**Pilot gap:**

Ponieważ pitch-gate dla tej strefy wymaga zbudowania całego modelu domenowego od zera, lista pilotażowa nie dokłada nowego zakresu funkcjonalnego (nie żąda pełnego DMS, mechaników, harmonogramowania, faktur, CRM — zgodnie z jawnym wykluczeniem tego zadania) — dokłada wyłącznie twardość i bezpieczeństwo tego samego modelu: ograniczenia bazy, idempotencję, współbieżność, audyt i izolację, które są nieodzowne, zanim rzeczywiste zlecenia wielu pracowników i wiele dostaw dziennie zaczną tworzyć dane w tym module.

### Notes / evidence

- Placeholder potwierdzony: `apps/web/src/app/[locale]/dashboard/workshop/page.tsx` (siatka kart „coming soon"), `apps/web/src/app/[locale]/dashboard/workshop/layout.tsx` (tylko gate'y uprawnień), `apps/web/src/modules/workshop/MODULE.md` (jawny podział „Now"/„Future"), `apps/web/src/modules/workshop/config.ts` (`items: []`).
- Zero migracji, zero usług/typów `RepairOrder`/`WorkshopOrder`/`ServiceOrder` w całym repozytorium (obie gałęzie migracji przeszukane).
- Kod `D\d+` w parserze służy wyłącznie do wykrywania granicy bloku tekstu i jest odcinany, nie przechwytywany: `apps/web/src/lib/tools/svwms-wdd-matcher/parser_v4.ts` (`isBlockTitleLine` ok. linii 477; czyszczenie nazwy grupy ok. linii 1213; `isInterBlockClientRow` ok. linii 512) — plik bajt-w-bajt identyczny z kopią w `apps/public-web`.
- Jedyne miejsce, gdzie etykieta „D####" trafia do wyniku, to funkcja wyliczeniowa `bodyShopCode` w `apps/web/src/lib/tools/svwms-wdd-matcher/enhanced-delivery-pdf.tsx` (ok. linii 343-346), budująca ją z końcowych cyfr numeru zlecenia/ZW/WDD — nie z niezależnego odczytu dokumentu źródłowego.
- Silnik dopasowania (`matcher.ts`) i serwis (`wdd-matcher.service.ts`) używają `order_number`/`zl_number` wyłącznie do wyświetlania i sortowania (np. `wdd-matcher.service.ts` ok. linii 544-588) — nigdy jako klucza deduplikacji ani powiązania między sesjami.
- Żadna tabela ani ograniczenie w schemacie Matchera (`wdd_matcher_blocks`, `wdd_matcher_sessions` — `apps/web/supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql`) nie linkuje bloków/zleceń między różnymi sesjami — dopasowania są ograniczone wyłącznie do bloków w obrębie jednej sesji (`session_id` FK). Dwa osobne importy WDD dla tego samego zlecenia są dziś całkowicie niepowiązane w systemie.
- Ta strefa zależy od Strefy 3 jako źródła danych wejściowych (numer zlecenia, SKU, ilości, metadane) — nie duplikuje jej ustaleń, tylko z nich korzysta jako punktu startowego dla modelu domenowego, którego dziś brakuje.
- Przykład z rzeczywistych danych referencyjnych do wykorzystania przy przyszłej weryfikacji: zlecenie ZL/ZLEC 174646 (BLWK 81, ZW 1303, kontekst D3332) występujące w WDD 2647 i WDD 2663 — dziś nic w systemie nie wie, że to jedno zlecenie.

### 5. Lokalizacje, QR, etykiety i fizyczna identyfikacja części/zestawów

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Ta strefa obejmuje trzy fizyczne obiekty, które skrypt wymaga skanować: lokalizację, część i zestaw. Dziś istnieje **jedna** kompletna, rzeczywista ścieżka (lokalizacja: trwały rekord → przypisanie QR → drukowana etykieta → publiczny resolver → logowanie → powrót do lokalizacji) oraz **dwie brakujące** identyfikacje fizyczne wymagane przez ten sam skrypt w tym samym akapicie (§7: „skanuję część albo zestaw"). Rejestr celów QR (`target-registry.ts`) obsługuje dziś dokładnie trzy typy: `warehouse.location`, `helpdesk.ticket`, `planning.task` — żadnego typu dla części ani zestawu. Kontener (`inventory_containers`) jest realnym, zapisanym w bazie modelem z własnym ID i wieloma pozycjami, rzeczywiście wyświetlanym w panelu szczegółów lokalizacji — ale nie ma żadnej kolumny QR, żadnego typu w rejestrze i nie da się go dziś wydrukować ani zeskanować. To dokładnie sytuacja opisana jako 🟠: prymitywy (kontener, generator QR) istnieją, ale nie składają się w spójny przepływ „zeskanuj część albo zestaw", którego wymaga scenariusz. Nie jest to 🟡 PARTIAL, bo brak nie jest drobny ani ograniczony do „niezweryfikowane" — dwa z trzech wymaganych typów fizycznej identyfikacji po prostu nie istnieją w rejestrze celów.

**Dowody:**

- Kod: VERIFIED. Prześledzono cały rejestr celów QR (`apps/web/src/server/qr/target-registry.ts`), akcje przypisania/tworzenia QR dla lokalizacji (`apps/web/src/app/actions/qr/assign-location.ts`), łańcuch generowania etykiety lokalizacji (`print-location-label-dialog.tsx` → `label-designer.tsx` → `apps/web/src/app/api/warehouse/locations/export-labels/route.ts`, który automatycznie tworzy QR przy pierwszym druku etykiety), oraz model kontenera (`inventory_containers`/`inventory_container_lines`, serwis `ambra-location-inventory.service.ts`, realne wywołania w `location-detail-panel.tsx`). Potwierdzono brak jakiejkolwiek kolumny/typu QR dla kontenera i brak jakiegokolwiek trwałego obiektu „fizyczna instancja części" odrębnego od definicji katalogowej produktu/wariantu. Potwierdzono też, że stary schemat (`qr_labels`, `scanning_operations` i pokrewne z migracji `20250806120000`) jest dziś martwy — żaden bieżący kod go nie używa; obecny system opiera się wyłącznie na `qr_codes`/`qr_assignments`, dla których **nie istnieje żadna migracja w repozytorium** (ten sam dryf schematu odnotowany już w Strefie 1) — kolumny/RLS tych tabel oraz `inventory_containers`/`inventory_container_lines` są znane wyłącznie z wygenerowanych typów TS, nie z migracji, więc ograniczenia bazy i polityki RLS pozostają niemożliwe do zweryfikowania z kodu źródłowego.
- Testy automatyczne: PARTIAL — `qr.service.test.ts` sprawdza `warehouse.location` jako typ docelowy oraz ogólny przypadek nieobsługiwanego typu, ale nie testuje jawnie gałęzi `helpdesk.ticket`/`planning.task`; `label-pdf.test.ts` sprawdza generowanie PDF etykiet w kilku rozmiarach, ale ogólnie (nie per typ celu) i wyłącznie na poziomie poprawności bufora PDF, nie fizycznego druku. Zero testów dla `inventory_containers`.
- Weryfikacja ręczna: HISTORICAL — jedyna odnotowana próba to test lokalizacji z 6 sierpnia 2026 (utworzenie lokalizacji w pustym oddziale, wygenerowanie/przypisanie QR, wygenerowanie etykiety, skan telefonem, powrót po logowaniu, wynik API etykiet 20/20). Dotyczyła wyłącznie lokalizacji, nie części ani zestawu, i nie została odtworzona w tej analizie.
- Przebieg end-to-end: NOT VERIFIED dla lokalizacji na aktualnym build; NOT APPLICABLE dla części i zestawu, ponieważ nie istnieje żadna ścieżka do przetestowania (brak typu celu w rejestrze).

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Lokalizacje**

- [ ] Mały, przygotowany zestaw lokalizacji oddziału demo ma unikalne kody i spójne, czytelne nazwy.
- [ ] QR można przypisać/utworzyć dla każdej z tych lokalizacji (sprawdzone na żywo, nie tylko odczytane z kodu akcji).
- [ ] Wydrukowano rzeczywiste etykiety lokalizacji w docelowym rozmiarze na docelowej drukarce/materiale.
- [ ] Każda wydrukowana etykieta lokalizacji skanuje się poprawnie telefonem prezentacyjnym i otwiera dokładnie właściwą lokalizację.
- [ ] Skan bez aktywnej sesji przechodzi przez logowanie i wraca do dokładnie zeskanowanej lokalizacji — odtworzone na aktualnym build, nie tylko przyjęte z próby historycznej.

**Część — decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono, jaki obiekt fizyczny faktycznie ma być skanowany jako „część" w demo — dziś nie ma trwałego celu QR dla części; potrzebna jest świadoma decyzja: (a) dodać minimalny typ celu QR dla części/pozycji na potrzeby tego konkretnego pokazu, albo (b) świadomie przeprojektować scenariusz demo tak, aby nie obiecywał skanowania samej części, tylko np. skanowanie lokalizacji z widoczną zawartością.
- [ ] Jeśli wybrano (a): istnieje trwały cel QR dla części/pozycji, zarejestrowany w `target-registry.ts`, z resolverem prowadzącym do sensownego widoku (nie do generycznego tekstu).
- [ ] Jeśli wybrano (a): etykieta części pokazuje wystarczające dane do identyfikacji (co najmniej SKU/numer katalogowy i krótką nazwę, plus QR) i jest wydrukowana/przetestowana na docelowym sprzęcie.
- [ ] Jeśli wybrano (b): scenariusz prezentacji i wypowiadane zdania nie obiecują funkcji, której nie ma — zweryfikowano treść pokazu pod tym kątem.

**Zestaw/kontener — decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono, czy `inventory_containers` (istniejący, realny model z wieloma pozycjami/SKU, już wyświetlany w panelu lokalizacji) ma otrzymać minimalny typ celu QR na potrzeby demo, czy scenariusz demo celowo nie obejmuje skanowania zestawu jako osobnego obiektu.
- [ ] Jeśli tak: kontener ma trwały, przypisywalny cel QR zarejestrowany w rejestrze celów, z resolverem pokazującym tożsamość i zawartość zestawu (liczbę/rodzaj pozycji), nie tylko generyczny tekst.
- [ ] Jeśli tak: etykieta zestawu pokazuje wystarczające dane do identyfikacji (trwałe ID/kod zestawu, liczba pozycji, QR) i jest wydrukowana/przetestowana na docelowym sprzęcie.
- [ ] Jeśli nie: scenariusz prezentacji jawnie nie obiecuje skanowania zestawu jako osobnego, trwałego obiektu.

**Rejestr QR / autoryzacja skanowania**

- [ ] QR z innego oddziału/organizacji, nieprzypisany, odwołany lub usunięty nie prowadzi do niewłaściwej operacji ani nie ujawnia cudzych danych — sprawdzone na żywo dla każdego z faktycznie używanych w demo typów celu.
- [ ] Nieznany/zniekształcony token daje czytelny, bezpieczny błąd zamiast niejasnego zachowania.

**Przygotowanie fizyczne demo**

- [ ] Wybrano ostateczny rozmiar etykiety i przetestowano rzeczywisty druk (nie tylko podgląd PDF) na drukarce, która będzie użyta na prezentacji.
- [ ] Sprawdzono uprawnienia aparatu telefonu prezentacyjnego i warunki skanowania (odległość, oświetlenie) w miejscu, gdzie odbędzie się pokaz.
- [ ] Przygotowano dokładnie tyle etykiet (lokalizacji + ewentualnie części/zestawu, zależnie od powyższych decyzji), ile potrzeba do scenariusza — nie więcej, nie mniej.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 5 zweryfikowany ręcznie na aktualnym build i fizycznym sprzęcie prezentacji:** druk etykiety lokalizacji + etykiety części/zestawu (zgodnie z podjętą decyzją architektoniczną) → skan każdej na telefonie prezentacyjnym → przekierowanie przez logowanie tam, gdzie wymagane → każda prowadzi do właściwego, trwałego obiektu możliwego do dalszego wykorzystania w Strefie 6.

**Pitch gap:**

Lokalizacje mają kompletną, realną ścieżkę: trwały rekord, przypisanie/utworzenie QR (w tym automatyczne przy pierwszym druku etykiety), generowanie etykiety PDF/ZPL, publiczny resolver z poprawną autoryzacją i przekierowaniem przez logowanie. To solidny fundament, ale bez świeżej ręcznej weryfikacji nadal nie może przekroczyć PARTIAL zgodnie z regułami tego audytu.

Część i zestaw to inna sytuacja — to nie kwestia braku świeżej weryfikacji, tylko **brak samej funkcjonalności**: rejestr celów QR nie zna typu „część" ani „zestaw/kontener". Kontener jako model danych istnieje i jest realnie używany w interfejsie (panel lokalizacji pokazuje zawartość kontenerów), ale nie ma żadnego mostu do infrastruktury QR/etykiet — to dokładnie przypadek „prymityw bez frontowego workflow", nie ukończona funkcja. Scenariusz skryptu („skanuję część albo zestaw") wymaga świadomej decyzji przed pitchem: albo zbudować minimalny cel QR dla jednego lub obu tych typów, albo zawęzić obietnicę pokazu tak, żeby nie sugerowała funkcji, której dziś nie ma. Dodatkowo `qr_codes`/`qr_assignments` i `inventory_containers`/`inventory_container_lines` nie mają żadnej migracji w repozytorium — ograniczenia bazy i RLS dla tych tabel są nieznane z kodu źródłowego, co jest tą samą luką dryfu schematu odnotowaną już w Strefie 1.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Migracje dla `qr_codes`, `qr_assignments`, `inventory_containers`, `inventory_container_lines` odtworzone i zapisane w repozytorium, żeby ograniczenia/RLS tych tabel podlegały review, tak jak reszta schematu.
- [ ] Unikalność/integralność tokenów QR wymuszona na poziomie bazy (nie tylko konwencją aplikacji), łącznie z nowymi typami celu, jeśli część/zestaw zostaną dodane.
- [ ] Cykl życia odwołania QR (rewokacja, ponowne przypisanie, wygaśnięcie) jawnie ustalony i przetestowany dla każdego używanego w pilotażu typu celu.
- [ ] Ochrona przed ponownym użyciem/kolizją identyfikatorów fizycznych (np. dwa wydrukowane egzemplarze tej samej etykiety, zgubiona i odtworzona etykieta).
- [ ] Izolacja między organizacjami/oddziałami potwierdzona dla wszystkich używanych w pilotażu typów celu QR (lokalizacja, ewentualnie część/zestaw) — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla tych konkretnych tabel.
- [ ] Trwały ślad audytowy przypisań/rewokacji QR (kto i kiedy przypisał/cofnął QR do obiektu).
- [ ] Bezpieczna procedura wymiany zgubionej/uszkodzonej etykiety bez utraty powiązania z obiektem.
- [ ] Niezawodny druk masowy (wiele lokalizacji/części/zestawów naraz) przetestowany na realistycznej liczbie etykiet, nie tylko garstce demo.
- [ ] Trwałość i czytelność etykiet w rzeczywistych warunkach magazynowych (kurz, wilgoć, ścieranie) potwierdzona, nie tylko wydruk testowy w biurze.
- [ ] Zachowanie „osieroconego" QR po usunięciu/archiwizacji obiektu docelowego (lokalizacji, kontenera) jawnie ustalone — dziś nieznane z kodu.
- [ ] Uprawnienia do generowania/ponownego przypisywania QR zweryfikowane dla realnych ról pilotażowych, nie tylko konta demonstratora.
- [ ] Testy automatyczne resolvera QR rozszerzone o wszystkie faktycznie używane w pilotażu typy celu (dziś pełne pokrycie ma tylko `warehouse.location`).
- [ ] Realistyczny test wieloużytkownikowego skanowania (kilku pracowników skanujących różne obiekty jednocześnie) na tym samym oddziale.
- [ ] Jeśli część/zestaw otrzymają cel QR: decyzja, czy dotyczy to instancji fizycznej (jedna etykieta = jedna dostawa/partia) czy definicji katalogowej — i konsekwentne wymuszenie tego wyboru w modelu danych, żeby uniknąć nieporozumienia „jeden SKU = jeden QR dla wszystkich egzemplarzy".
- [ ] **Dokładny scenariusz pilotażu Strefy 5 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w warunkach zbliżonych do rzeczywistego magazynu.

**Pilot gap:**

Poza ogólnym pogłębieniem twardości QR (integralność, audyt, cykl życia rewokacji, trwałość fizyczna etykiet) najważniejsza dodatkowa praca pilotażowa to domknięcie luki schematu (brakujące migracje dla `qr_codes`/`qr_assignments`/`inventory_containers`) oraz, jeśli demo wprowadzi tymczasowy typ celu QR dla części/zestawu, przemyślenie go od nowa jako właściwego elementu modelu danych (instancja vs. katalog), a nie tylko wystarczającego do jednorazowego pokazu.

### Notes / evidence

- Rejestr celów QR ma dokładnie trzy zarejestrowane typy — `warehouse.location`, `helpdesk.ticket`, `planning.task` — `apps/web/src/server/qr/target-registry.ts:87-256`; komentarz w pliku („Phase 1 supports warehouse.location only") jest już nieaktualny, ale liczba typów pozostaje trzy, nigdy nie obejmuje części/kontenera.
- Ścieżka etykiety lokalizacji: przypisanie/utworzenie QR — `apps/web/src/app/actions/qr/assign-location.ts:20-149`; dialog druku — `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/print-location-label-dialog.tsx`; generowanie PDF/ZPL z automatycznym provisioningiem QR przy pierwszym druku — `apps/web/src/app/api/warehouse/locations/export-labels/route.ts:48-100`.
- `inventory_containers`/`inventory_container_lines`: realny model z `id, organization_id, branch_id, code, type, status, current_location_id, reference_type, reference_id` i wieloma pozycjami (`variant_id, unit_id, quantity`) — potwierdzony w wygenerowanych typach (`apps/web/supabase/types/target.types.ts`, brak migracji źródłowej) i realnie renderowany w `location-detail-panel.tsx:153-179,1000-1039` oraz `LocationsPage.tsx:241-267,602-605`. Brak jakiejkolwiek kolumny/powiązania QR.
- Brak jakiegokolwiek trwałego obiektu „fizyczna instancja części" odrębnego od katalogowego produktu/wariantu — potwierdzone szerokim wyszukiwaniem w usługach magazynowych; jedyne wystąpienia „item"/„product" blisko „qr" dotyczą tabeli zdjęć produktu (`inventory_item_images`), niepowiązanej z fizyczną identyfikacją.
- Stary schemat skanowania (`qr_labels`, `label_templates`, `qr_scan_logs`, `label_batches`, `scanning_operations`, `scanning_operation_items` z migracji `20250806120000`) jest dziś martwy — zero odwołań w bieżącym kodzie; obecny system używa wyłącznie `qr_codes`/`qr_assignments`.
- Ani `qr_codes`/`qr_assignments`, ani `inventory_containers`/`inventory_container_lines` nie mają odpowiadającej migracji w repozytorium — ten sam dryf schematu odnotowany w Strefie 1 dla tabel Matchera i Help Desku; ograniczenia/RLS tych tabel są nieznane z kodu źródłowego.
- Jedyna zapisana ręczna weryfikacja to test lokalizacji z 6 sierpnia 2026 (utworzenie lokalizacji w pustym oddziale, QR, etykieta, skan telefonem, powrót po logowaniu, wynik API etykiet 20/20) — dotyczy wyłącznie lokalizacji, oznaczony HISTORICAL, nieodtworzony w tej analizie.
- Zależność od Strefy 4: jeśli etykieta części/zestawu ma docelowo pokazywać odniesienie do zlecenia naprawczego, zależy to od trwałej tożsamości zlecenia/pozycji zlecenia ze Strefy 4, której dziś nie ma — tożsamość QR części/zestawu opisana w tej strefie może istnieć niezależnie od zlecenia (jako identyfikacja fizyczna), ale odniesienie do zlecenia na etykiecie wymaga najpierw Strefy 4.

### 6. Przyjęcie 101/PZ → import z Matchera → mobilne rozłożenie → zamknięcie → raport

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Realne prymitywy istnieją — typ ruchu 101 („Przyjęcie z zamówienia"/PZ) jest prawdziwie zdefiniowany, import z Matchera do edytora ruchu na komputerze naprawdę działa i rozwiązuje produkty (nie jest atrapą), kontenery jako model danych istnieją, a lokalizacje/QR ze Strefy 5 działają dla lokalizacji. Ale te elementy **nie składają się w zamierzony workflow przyjęcia**. Mobilne rozłożenie nie istnieje w ogóle (potwierdzone placeholdery), kontenery są całkowicie niepodłączone do przyjęcia (akcje-sieroty bez żadnego wywołania z UI), nie ma rozróżnienia „oczekiwane" vs „fizycznie potwierdzone", nie ma dedykowanego zamknięcia przyjęcia, a jedyny realny raport dostawy w aplikacji odtwarza wyłącznie dane odczytane z dokumentu źródłowego, nigdy rzeczywiście potwierdzonych lokalizacji magazynowych. To dokładnie sytuacja opisana jako 🟠: prymitywy istnieją, spójny workflow — nie.

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny łańcuch: definicję typu ruchu 101 (`inventory_movement_types`, na żywo z bazy: `code: "101", name_pl: "Przyjęcie z zamówienia", category: "receipt", cost_impact: "increase", requires_destination_location: true`), dialog importu z Matchera (`movement-import-dialog.tsx`), rozwiązywanie produktów (`InventoryMovementImportsService.resolveLine`/`WarehouseImportResolverService.resolveVariant`), zapis stanu edytora (`use-movement-form-state.ts` → `applyImportedDocument`) i faktyczny zapis do bazy (`use-movement-submission.ts` → `buildLines`). Osobno prześledzono trasy `/warehouse/deliveries` i `/warehouse/scanning/delivery` (potwierdzone placeholdery), wywołania funkcji kontenerów (zero wywołań spoza własnego pliku definicji), schemat `inventory_movement_lines`/`inventory_movement_headers` (brak kolumny „oczekiwana vs potwierdzona ilość", brak statusu „zamknięte przyjęcie") oraz generator raportu dostawy (`getEnhancedPdfData` — czyta wyłącznie tabele Matchera, nigdy `inventory_movement_lines`/`warehouse_locations`).
- Testy automatyczne: PARTIAL. Podgląd importu (`InventoryMovementImportsService.previewFromSource`) i kandydaci importu z Matchera (`getMovementImportCandidates`) mają sensowne testy na zamockowanych danych. **Zero testów** obejmujących pełny łańcuch od wyboru sesji Matchera przez zapis linii do faktycznie zapisanego ruchu (`movement-import-dialog.tsx`, `use-movement-form-state.ts`, `use-movement-submission.ts` — żaden nie ma testu). Zero testów mobilnego przyjęcia, kontenerów w przyjęciu, logiki zamknięcia i raportu — bo żadna z tych funkcji nie istnieje.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej próby tej ścieżki na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED dla części, która technicznie istnieje (import na komputerze → zapisany ruch); NOT APPLICABLE dla mobilnego rozłożenia, zamknięcia i raportu z potwierdzonych lokalizacji, bo nie ma czego uruchomić.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Dokument 101/PZ**

- [ ] Utworzenie ruchu typu 101 działa na aktualnym build z poprawnymi polami nagłówka (oddział, data, opcjonalne odniesienie).
- [ ] Ruch jest trwałym dokumentem z właściwym oddziałem/organizacją i statusem draft/posted odzwierciedlającym rzeczywisty stan.
- [ ] Dokładna logika księgowania stanu przy zatwierdzeniu (`inventory_finalize_posting` i pokrewne RPC) jest potwierdzona na żywo — dziś ciała tych funkcji nie mają odpowiadającej migracji w repozytorium (dryf schematu), więc dokładna arytmetyka księgowania nie jest znana z kodu źródłowego.

**Import z Matchera**

- [ ] Zapisana sesja Matchera (Strefa 3) jest wybieralna jako źródło importu przy tworzeniu ruchu 101 na aktualnym build.
- [ ] Import automatycznie wypełnia linie ruchu (produkt, ilość, jednostka, lokalizacja docelowa) bez ręcznego przepisywania — sprawdzone na żywo dla przygotowanych danych demo.
- [ ] Nieznany/niejednoznaczny SKU jest jawnie sygnalizowany użytkownikowi (przypisanie/utworzenie/pominięcie) — nie znika po cichu i nie blokuje reszty importu.
- [ ] Numer zlecenia z Matchera pojawia się przy zaimportowanej linii — **ze świadomością, że dziś przetrwa wyłącznie jako tekst w polu notatki, nie jako trwałe powiązanie w zapisanym ruchu** (zależność od Strefy 4 dla prawdziwej relacji zlecenia).
- [ ] Prezenter wie i uwzględnia w scenariuszu, że **po zapisaniu ruchu nie istnieje żadne trwałe powiązanie z sesją/linią Matchera** — `inventory_movement_lines` nie ma kolumny wskazującej źródłową sesję; jedynym śladem pochodzenia są wolnotekstowe notatki nagłówka/linii.
- [ ] Ta sama sesja Matchera zaimportowana dwukrotnie do dwóch różnych ruchów jest albo świadomie niedopuszczona w scenariuszu demo, albo jawnie wyjaśniona jako znane ograniczenie — dziś nic w systemie tego nie blokuje ani nie ostrzega.
- [ ] Zaimportowany, niezapisany szkic ruchu nie jest tracony przypadkowo w trakcie demo przez odświeżenie strony — sprawdzone i uwzględnione w choreografii pokazu (stan importu żyje wyłącznie w pamięci przeglądarki do momentu zapisu).

**Mobilne rozłożenie — decyzja wymagana przed pitchem**

- [ ] Ustalono, że dziś **nie istnieje żadna funkcjonalna mobilna ścieżka rozłożenia** (`/warehouse/deliveries` i `/warehouse/scanning/delivery` to potwierdzone atrapy „coming soon"; jedyny realny skan telefonem w module magazynowym dotyczy audytów stanu, nie przyjęcia) — scenariusz pokazu musi to uwzględnić świadomie, nie zakładać istniejącej funkcji.
- [ ] Podjęto decyzję o minimalnym zakresie potrzebnym do pitchu: albo zbudować prosty mobilny ekran „wybierz linię → zeskanuj/wskaż lokalizację → potwierdź", albo świadomie zawęzić obietnicę pokazu tak, żeby nie sugerowała istniejącego rozłożenia mobilnego.
- [ ] Jeśli zbudowano minimalny ekran: potwierdzenie lokalizacji na telefonie rzeczywiście zapisuje ilość, lokalizację, użytkownika i czas w trwałym rekordzie — nie tylko wizualnie „wygląda na zapisane".

**Oczekiwane vs potwierdzone**

- [ ] Ustalono minimalny, wystarczający do demo sposób odróżnienia „to, co dokument mówi, że powinno przyjść" od „to, co pracownik faktycznie potwierdził" — dziś taki koncept nie istnieje w ogóle w schemacie (`inventory_movement_lines` ma tylko jedno pole `quantity`, bez stanu potwierdzenia).
- [ ] Brakująca/niepotwierdzona pozycja jest widoczna jawnie, nie milczy jako „zakończone".

**Kontenery/grupowanie — jeśli używane w demo**

- [ ] Jeśli scenariusz demo ma pokazywać grupowanie części w zestaw podczas przyjęcia: potwierdzono na żywo, że którakolwiek z akcji kontenera (`createLocationContainerAction`, `addItemsToContainerAction` itd.) faktycznie działa wywołana z nowego, tymczasowego wejścia UI zbudowanego na potrzeby demo — dziś te akcje nie mają żadnego wywołania z interfejsu użytkownika.
- [ ] Jeśli kontenery nie zostaną podłączone przed pitchem: scenariusz demo nie obiecuje grupowania/zestawu jako trwałej funkcji przyjęcia.

**Zamknięcie**

- [ ] Ustalono minimalny sposób zakończenia procesu przyjęcia na potrzeby demo — dziś nie ma dedykowanej operacji „zamknij przyjęcie" odrębnej od ogólnego przejścia ruchu draft→posted, więc scenariusz nie może obiecywać walidacji „nie da się zamknąć z brakującymi pozycjami", chyba że zostanie to celowo zbudowane.
- [ ] Jeśli zbudowano minimalną walidację zamknięcia: sprawdzono na żywo, że nie da się „zamknąć" przyjęcia z jawnie nieobsłużonymi wymaganymi pozycjami.

**Raport**

- [ ] Raport pokazywany w demo pochodzi z faktycznie zapisanych danych ruchu/lokalizacji, nie wyłącznie z odczytu dokumentu źródłowego Matchera — dziś jedyny istniejący raport dostawy (wzbogacony PDF Matchera) czyta **wyłącznie** tabele Matchera i nigdy nie sięga do `inventory_movement_lines`/lokalizacji magazynowych, więc nie spełnia tego wymogu bez zmiany.
- [ ] Jeśli raport ma pokazywać rzeczywiście potwierdzone lokalizacje: zbudowano minimalny eksport/wydruk z rzeczywistych danych ruchu (istnieje już widok szczegółów ruchu z realnymi `destination_location_name` do wykorzystania jako punkt wyjścia).
- [ ] Wypowiedź prezentera jasno rozróżnia „dane do ręcznej aktualizacji AutoStacji" od automatycznej integracji DMS — nie obiecuje synchronizacji, której nie ma.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 6 zweryfikowany ręcznie na aktualnym build i urządzeniach prezentacji:** utworzenie ruchu 101/PZ → wybór Importu → wybór zapisanej sesji Matchera → zaimportowane linie pojawiają się bez ręcznego przepisywania → przetworzenie reprezentatywnych pozycji (na telefonie, jeśli zbudowano minimalny ekran, albo w uzgodnionej alternatywnej ścieżce) → potwierdzenie rzeczywistych lokalizacji → komputer pokazuje ten sam postęp → obsłużono jeden kontrolowany wyjątek/korektę → zamknięcie przyjęcia → wygenerowanie/eksport raportu zawierającego rzeczywiście potwierdzone lokalizacje do ręcznej aktualizacji AutoStacji.

**Pitch gap:**

To jest najgłębsza luka funkcjonalna spośród dotychczas ocenionych stref P0. Realnie działa tylko połowa łańcucha, i to z zastrzeżeniami: import z Matchera do ruchu 101 na komputerze naprawdę rozwiązuje produkty i wypełnia linie (nie jest fasadą), ale połączenie z sesją źródłową ginie w momencie zapisu (brak kolumny FK, tylko wolny tekst w notatce), nic nie chroni przed podwójnym importem tej samej sesji, a niezapisany import żyje wyłącznie w pamięci przeglądarki. Druga połowa łańcucha — mobilne rozłożenie, rozróżnienie oczekiwane/potwierdzone, kontenery jako realna część przyjęcia, dedykowane zamknięcie, raport z rzeczywiście potwierdzonych lokalizacji — **nie istnieje wcale**, nie tylko „nie została zweryfikowana ręcznie". `/warehouse/deliveries` i `/warehouse/scanning/delivery` to potwierdzone atrapy; akcje kontenera nie mają żadnego wywołania z UI; jedyny realny raport dostawy czyta wyłącznie dane źródłowe Matchera, nigdy dane ruchu magazynowego. Zbudowanie tej strefy do stanu obiecywanego przez skrypt wymaga w praktyce: (1) minimalnego mobilnego ekranu potwierdzenia lokalizacji, (2) trwałego powiązania zapisanego ruchu z sesją Matchera, (3) minimalnego rozróżnienia oczekiwane/potwierdzone, (4) minimalnej operacji zamknięcia, (5) raportu opartego o rzeczywiste dane ruchu. To realna praca implementacyjna wielu dni, nie odhaczenie istniejącego kodu.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Transakcyjność importu/księgowania — częściowa awaria (np. część linii zapisana, reszta nie) nie zostawia ruchu w niespójnym stanie.
- [ ] Idempotentny import z Matchera — powtórne kliknięcie/ponowienie po błędzie sieci nie tworzy zduplikowanych linii ani duplikatu ruchu.
- [ ] Ochrona przed podwójnym importem tej samej sesji Matchera do dwóch różnych ruchów, na poziomie bazy lub aplikacji — dziś nieobecna.
- [ ] Trwałe powiązanie ruchu/linii z sesją/linią źródłową Matchera (kolumna, nie wolny tekst) — potrzebne dla realnej identyfikowalności przy wielu dostawach dziennie.
- [ ] Bezpieczeństwo współbieżnego przyjęcia — kilku pracowników rozkładających tę samą dostawę jednocześnie nie prowadzi do wyścigu przy aktualizacji ilości/lokalizacji.
- [ ] Ochrona przed wyścigiem przy ilościach (dwa jednoczesne potwierdzenia tej samej pozycji).
- [ ] Jawne zasady przyjęcia częściowego (dostawa niekompletna, część pozycji brakuje) i sposobu ich raportowania.
- [ ] Ścieżka korekty/reversal błędnie potwierdzonej lokalizacji z zachowaniem historii.
- [ ] Trwały ślad audytowy całego procesu przyjęcia (kto/kiedy zaimportował, potwierdził, zamknął).
- [ ] Odporne zachowanie przy przerwaniu sieci na magazynie (albo jawna polityka „brak trybu offline", nie cichy fałszywy sukces).
- [ ] Odzyskiwanie/rozliczanie utkniętych, niedokończonych przyjęć.
- [ ] Sprawdzone na realistycznie większych dostawach (więcej pozycji niż zestaw demo).
- [ ] Spójność stanu magazynowego i (jeśli kontenery zostaną podłączone) spójność zawartości kontenerów po wielu operacjach.
- [ ] Testy integracyjne automatyczne pokrywające pełny łańcuch: import z Matchera → zapisany ruch → potwierdzenie lokalizacji → zamknięcie → raport.
- [ ] Realistyczne testy na telefonie (nie tylko symulator/desktop) dla mobilnej części przyjęcia.
- [ ] Izolacja oddziałowa/organizacyjna przyjęcia — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowych elementów tej strefy (np. ewentualnego mobilnego potwierdzenia).
- [ ] Spójność raportowania przy wielu jednoczesnych przyjęciach na tym samym oddziale.
- [ ] **Dokładny scenariusz pilotażu Strefy 6 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym rzeczywista, większa dostawa i co najmniej jedna kontrolowana awaria/korekta.

**Pilot gap:**

Ponieważ bramka pitchu dla tej strefy już wymaga zbudowania większości brakującego łańcucha (mobilne potwierdzenie, zamknięcie, raport z rzeczywistych danych), lista pilotażowa nie dokłada nowego zakresu funkcjonalnego — dokłada twardość: transakcyjność, idempotencję, współbieżność, audyt i realistyczne testy na urządzeniach, których jednorazowy, kontrolowany pokaz nie musi jeszcze wytrzymać, ale codzienna praca wielu pracowników na wielu dostawach — musi.

### Notes / evidence

- Typ ruchu 101 potwierdzony na żywo z bazy (`inventory_movement_types`): `code: "101", name_pl: "Przyjęcie z zamówienia", category: "receipt", cost_impact: "increase", requires_destination_location: true`. Dokładne ciało funkcji księgujących (`inventory_create_draft`, `inventory_save_draft`, `inventory_finalize_posting`, `inventory_create_and_finalize`) istnieje na żywo w bazie, ale **nie ma odpowiadającej definicji `CREATE FUNCTION` w żadnym śledzonym pliku migracji** — kolejny przypadek dryfu schematu, tej samej kategorii co `qr_codes`/`qr_assignments`/`inventory_containers` odnotowane w Strefach 1 i 5.
- Import z Matchera do edytora ruchu: `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-import-dialog.tsx` (dialog, podgląd, rozwiązywanie produktów przez `InventoryMovementImportsService.resolveLine`/`WarehouseImportResolverService.resolveVariant` w `warehouse-import-resolver.service.ts:138-151`) → `use-movement-form-state.ts:380-472` (`applyImportedDocument`, realnie wypełnia stan linii) → `use-movement-submission.ts:36-47` (`buildLines`, **pomija** `source_type`/`source_line_id`/`source_order_number` przy budowaniu payloadu zapisu).
- Zapisane kolumny `inventory_movement_lines` (na żywo z bazy): `id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, unit_cost, total_cost, currency, exchange_rate, lot_id, serial_id, container_id, note, snapshot_*, line_number` — brak jakiejkolwiek kolumny odwołującej się do sesji/linii Matchera.
- Brak ochrony przed podwójnym importem: `wdd_matcher_sessions`/`wdd_matcher_lines` nie mają kolumny „zaimportowano"/`movement_id`; `getMovementImportCandidates` to bramka gotowości (status/oddział), nie bramka jednorazowości.
- Stan importu żyje wyłącznie w pamięci przeglądarki (`useState` w `use-movement-form-state.ts`, brak `localStorage`/`sessionStorage`) do momentu jawnego zapisu — odświeżenie przed zapisem usuwa cały zaimportowany szkic.
- Mobilne trasy potwierdzone jako atrapy: `apps/web/src/app/[locale]/dashboard/warehouse/deliveries/page.tsx` i `.../scanning/delivery/page.tsx` renderują generyczny komponent `WarehousePlaceholderPage`, potwierdzone testem `placeholder-pages.test.tsx`. Jedyny realny skan telefonem w module magazynowym dotyczy audytów stanu (`audits/[id]/count/_components/guided-count/count-scan-trigger.tsx`), architektonicznie niezwiązanego z przyjęciem.
- Kontenery całkowicie niepodłączone do przyjęcia: kolumna `inventory_movement_lines.container_id` istnieje w schemacie, ale nigdy nie jest ustawiana przez serwis ruchów; akcje mutujące kontener (`createLocationContainerAction`, `addItemsToContainerAction`, `removeItemFromContainerAction`, `relocateContainerAction` w `ambra-location-inventory.ts`) nie mają żadnego wywołania spoza własnego pliku definicji — zależność od Strefy 5, gdzie ten sam model już opisano jako realny, ale niepodłączony do QR/etykiet.
- Brak rozróżnienia oczekiwane/potwierdzone: `inventory_movement_lines` ma jedno pole `quantity`, bez statusu potwierdzenia; jedyny „putaway" w kodzie to statyczna tabela reguł preferencji (`inventory_putaway_rules`), wyświetlana tylko do odczytu, bez żadnego kodu, który by ją faktycznie stosował.
- Brak dedykowanego zamknięcia: serwis ruchów ma wyłącznie `createDraft`/`saveDraft`/`finalizePosting`/`cancelMovement` — te same przejścia statusu dla każdego typu ruchu, bez walidacji specyficznej dla przyjęcia.
- Raport dostawy (`WddMatcherService.getEnhancedPdfData`) czyta wyłącznie `wdd_matcher_block_matches`/`wdd_matcher_blocks`/`wdd_matcher_lines` — pole `location` to surowy tekst z dokumentu źródłowego, nie FK do `warehouse_locations` i nie dane z `inventory_movement_lines.destination_location_id`. Widok szczegółów ruchu używa realnych danych ruchu, ale to zwykły wydruk przeglądarki formularza draft/posted, nie raport z procesu potwierdzania przyjęcia.
- Zależności: Strefa 3 (poprawność danych źródłowych Matchera), Strefa 4 (prawdziwa relacja zlecenia zamiast tekstu w notatce), Strefa 5 (fizyczna tożsamość QR części/zestawu, jeśli mobilne rozłożenie ma z niej korzystać), Strefa 1 (izolacja oddziałowa/RLS nowych elementów tej strefy) — odnotowane, nie duplikowane.

### 7. Szukanie, zawartość lokalizacji, relokacja części/zestawu i historia

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

W przeciwieństwie do Strefy 6, tutaj istnieje realny, działający rdzeń codziennej pracy: zawartość lokalizacji jest prawdziwą tabelą stanu magazynowego (nie tylko kontenerami), relokacja pojedynczej części (typ ruchu 801, „Bin-to-Bin Move") jest rzeczywistą, osiągalną z UI operacją z obsługą ilości częściowej i zabezpieczeniem przed ujemnym stanem po stronie bazy, a historia ruchów lokalizacji to prawdziwe zapytanie do bazy, nie fasada. To realna, działająca zdolność, nie tylko rozłączone prymitywy — stąd 🟡 PARTIAL, nie 🟠. Jednocześnie prześledzenie ujawniło konkretne, potwierdzone w kodzie usterki i braki wymagane przez skrypt: wyszukiwanie produktów filtruje wyłącznie po nazwie, nie po SKU/numerze katalogowym (mimo że pole nazywa się „szukanie", numer części go nie znajdzie); relokacja zestawu/kontenera jest kodem martwym bez żadnego wywołania z interfejsu; historia ruchów nie pokazuje użytkownika mimo że pole `posted_by` istnieje w zapytaniu; etykieta „przeniesienie wewnętrzne" w historii nigdy się nie wyświetla z powodu błędu porównania (`movementKind === "transfer"` nigdy nie jest prawdą dla realnych kodów `"801"`/`"311"`). Wyszukiwanie zlecenia nie istnieje w ogóle — zgodnie z oczekiwaniem, bo Strefa 4 nie istnieje.

**Dowody:**

- Kod: VERIFIED. Prześledzono wyszukiwanie produktów (`InventoryProductsService.listProducts`, filtr `.ilike("name", ...)`/`.ilike("product_name", ...)` — nigdy po `sku`), panel zawartości lokalizacji (`AmbraLocationInventoryService.getSnapshot` — realne zapytanie na `inventory_balances` dla stanu, `inventory_movement_lines`/`inventory_movement_headers` dla historii, `inventory_containers` dla kontenerów), edytor relokacji (`movement-positions-tab.tsx`, typ ruchu `801`, walidacja ilości klient+serwer) i funkcję księgującą `inventory_post_movement` (realna blokada ujemnego stanu: `IF NOT allow_negative_stock AND available_quantity < quantity THEN RAISE EXCEPTION`). Potwierdzono ponownie, niezależnie od wcześniejszych stref, że `relocateContainerAction` i pokrewne akcje kontenera nie mają żadnego wywołania w żadnym pliku `.tsx` w całym `apps/web/src`, łącznie ze stronami lokalizacji — to nie jest powtórzenie starego ustalenia, tylko osobna, świeża weryfikacja tej strefy.
- Testy automatyczne: PARTIAL/NONE w kluczowych miejscach. Brak testu wyszukiwania po SKU/lokalizacji, brak testu `ambra-location-inventory.service.ts` (panel lokalizacji, historia, stan), brak testu przepływu relokacji (`movement-positions-tab.tsx`, typ 801), brak testu relokacji kontenera (bo nie istnieje). Jedyny test dotykający transferów międzyoddziałowych (`inventory-cross-branch-transfers.test.ts`) **nie wykonuje żadnej realnej operacji** — sprawdza wyłącznie obecność fragmentów tekstu SQL w plikach migracji, z których część może już nie odpowiadać aktualnie działającemu silnikowi księgowania (ten sam dryf schematu co w poprzednich strefach).
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby tej ścieżki na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: szukanie części → otwarcie lokalizacji → relokacja → sprawdzenie obu lokalizacji i historii.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Wyszukiwanie**

- [ ] Wyszukiwanie po numerze zlecenia jest świadomie wyłączone ze scenariusza demo (zależność od Strefy 4 — nie istnieje i nie jest w zakresie tej strefy) albo zastąpione jawnie opisanym obejściem.
- [ ] Wyszukiwanie po SKU/numerze katalogowym faktycznie znajduje część — **dziś nie znajduje**, bo filtr sprawdza wyłącznie nazwę produktu; wymaga naprawy lub świadomego użycia w demo wyłącznie wyszukiwania po nazwie, z jawnym zastrzeżeniem tej różnicy w scenariuszu.
- [ ] Wynik wyszukiwania pokazuje rzeczywisty, aktualny stan (potwierdzone: tak, `inventory_balances` na żywo) — ale główna lista wyników nie pokazuje dziś lokalizacji; ustalono, jak prezenter dojdzie od wyniku wyszukiwania do konkretnej lokalizacji (np. przez szczegóły produktu/wariantu, jeśli tam lokalizacja jest widoczna).

**Zawartość lokalizacji**

- [ ] Otwarcie/skan lokalizacji demo pokazuje rzeczywisty stan (SKU + ilość), nie tylko kontenery czy reguły odkładania — potwierdzone w kodzie, do zweryfikowania na żywo.
- [ ] Dla przygotowanej lokalizacji demo liczba pozycji jest na tyle mała, że filtrowanie po stronie klienta (zapytanie pobiera stan całego oddziału i filtruje w przeglądarce, nie po stronie serwera) nie powoduje zauważalnego opóźnienia na urządzeniu prezentacji.

**Relokacja części**

- [ ] Wybór części/pozycji ze znanym źródłem, wybór/skan lokalizacji docelowej i potwierdzenie faktycznie przenosi zapisany stan — sprawdzone na żywo dla przygotowanych danych demo (mechanizm typu 801 istnieje i jest realny, wymaga świeżej próby).
- [ ] Przeniesienie częściowej ilości działa poprawnie: źródło maleje, cel rośnie, reszta pozostaje na źródłowej lokalizacji.
- [ ] Próba przeniesienia więcej niż dostępna ilość jest odrzucana, nie tworzy ujemnego stanu — potwierdzone w kodzie księgowania, do zweryfikowania na żywo.

**Relokacja zestawu/kontenera — decyzja wymagana przed pitchem**

- [ ] Ustalono, czy scenariusz demo obejmuje przeniesienie zestawu/kontenera jako osobnego obiektu — dziś **nie istnieje żadna dostępna z UI operacja relokacji kontenera** (funkcja jest w pełni zaimplementowana po stronie serwera, ale nie ma żadnego wywołania z interfejsu w całym repozytorium).
- [ ] Jeśli demo ma pokazać przeniesienie zestawu: zbudowano tymczasowe wejście UI wywołujące istniejącą funkcję serwerową i sprawdzono na żywo, że `current_location_id` kontenera faktycznie się zmienia i pozostaje spójne z zawartością.
- [ ] Jeśli nie zbudowano: scenariusz prezentacji jawnie nie obiecuje przenoszenia zestawu jako osobnej, trwałej operacji — zastąpione np. przeniesieniem pojedynczej części.

**Historia**

- [ ] Historia ruchów dla lokalizacji demo pokazuje źródło, cel i ilość po odświeżeniu/ponownym wejściu — potwierdzone jako realne zapytanie do bazy w kodzie.
- [ ] Prezenter wie, że **historia dziś nie pokazuje użytkownika, który wykonał ruch**, mimo że dane czasu (`posted_at`) są pobierane — jeśli scenariusz ma to pokazywać, wymaga naprawy przed pitchem albo świadomego pominięcia tego elementu w wypowiedzi.
- [ ] Naprawiono lub świadomie obeszło się błąd etykietowania rodzaju ruchu (`movementKind === "transfer"` nigdy nie jest prawdą dla realnych kodów `"801"`/`"311"`) — inaczej historia pokaże surowy kod ruchu zamiast czytelnej etykiety „przeniesienie" na oczach uczestników.

**Spójność po ruchu**

- [ ] Po relokacji: ponowne wyszukanie/otwarcie starej lokalizacji nie pokazuje już przeniesionej ilości, a nowa lokalizacja ją pokazuje — sprawdzone na żywo.
- [ ] Jeśli w demo używany jest kontener: sprawdzono, że jego wyświetlana „aktualna lokalizacja" nie rozjeżdża się cicho ze stanem magazynowym jego zawartości — dziś nic w interfejsie nie krzyżuje tych dwóch źródeł prawdy (pole na kontenerze jest praktycznie zamrożone, bo nic go realnie nie aktualizuje).

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 7 zweryfikowany ręcznie na aktualnym build, na danych utworzonych w Strefie 6:** wyszukanie znanego zlecenia/SKU → otwarcie bieżącej lokalizacji → sprawdzenie zawartości → relokacja jednej części/ilości do innej lokalizacji → relokacja jednego zestawu/kontenera, jeśli objęta finalnym scenariuszem pitchu → odświeżenie/ponowne wejście → wyszukiwanie i oba widoki lokalizacji pokazują nowy stan → historia ruchów pokazuje źródło, cel, ilość, użytkownika i czas.

**Pitch gap:**

Rdzeń tej strefy realnie działa i jest solidniejszy niż w większości pozostałych stref: zawartość lokalizacji to prawdziwy stan magazynowy, relokacja pojedynczej części to prawdziwa, osiągalna z UI operacja z sensowną walidacją ilości i zabezpieczeniem przed ujemnym stanem, a historia to prawdziwe zapytanie do bazy przetrwające odświeżenie. Braki są konkretne i naprawialne, nie fundamentalne: (1) wyszukiwanie produktów nie znajduje po SKU, tylko po nazwie — sprzeczne z dosłowną obietnicą skryptu „mogę wyszukać część"; (2) relokacja zestawu/kontenera nie ma żadnego wejścia UI, mimo że logika serwerowa istnieje — druga połowa obietnicy skryptu „przenoszę część i zestaw" jest dziś nieosiągalna; (3) historia nie pokazuje użytkownika i błędnie etykietuje rodzaj ruchu — szczegół, ale widoczny na żywo podczas pokazu. Wyszukiwanie zlecenia świadomie nie jest tu wymagane, bo zależy od nieistniejącej jeszcze Strefy 4.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Transakcyjność/idempotencja relokacji przy błędzie sieci/podwójnym kliknięciu — dziś nie sprawdzono, czy `inventory_post_movement` chroni przed podwójnym zaksięgowaniem tego samego żądania.
- [ ] Ochrona przed wyścigiem przy współbieżnej relokacji tej samej pozycji przez dwóch pracowników jednocześnie.
- [ ] Zapytania stanu/historii lokalizacji filtrowane po stronie serwera, nie tylko pobierane w całości i filtrowane w przeglądarce — dziś `listBalances`/`listMovements` pobierają do 2000 wierszy całego oddziału i filtrują po stronie klienta, co nie skaluje się do realnego wolumenu pilotażu.
- [ ] Jeśli relokacja kontenera zostanie zbudowana dla pitchu: dodano spójność między `inventory_containers.current_location_id` a rzeczywistym stanem `inventory_balances`/`inventory_serials` jego zawartości — dziś te źródła prawdy mogą się rozjechać bez żadnej kontroli.
- [ ] Naprawiono wyszukiwanie po SKU na stałe (nie tylko obejście na potrzeby pitchu).
- [ ] Naprawiono wyświetlanie użytkownika i etykiety rodzaju ruchu w historii na stałe.
- [ ] Ścieżka korekty/reversal błędnej relokacji z zachowaniem historii.
- [ ] Trwały ślad audytowy relokacji (dziś `posted_by` jest pobierane z bazy, ale nigdy nie wyświetlane — do rozszerzenia na realny log audytowy dla ról administracyjnych).
- [ ] Izolacja oddziałowa/organizacyjna wyszukiwania, zawartości lokalizacji i relokacji — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla tabel `inventory_balances`/`inventory_movement_lines`/`inventory_containers` używanych w tej strefie.
- [ ] Testy automatyczne pokrywające realny przepływ relokacji (typ 801), wyszukiwanie po SKU+lokalizacji i historię — dziś praktycznie nieobecne (jedyny test „transferów" sprawdza tylko tekst SQL w migracjach, nie działanie).
- [ ] Wydajność wyszukiwania/zawartości lokalizacji przy realistycznym wolumenie pilotażowego oddziału (setki–tysiące pozycji), nie tylko garstce danych demo.
- [ ] **Dokładny scenariusz pilotażu Strefy 7 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym współbieżna relokacja przez dwóch pracowników.

**Pilot gap:**

Poza ogólnym pogłębieniem twardości (transakcyjność, współbieżność, wydajność zapytań) najważniejsza dodatkowa praca pilotażowa to trwałe (nie tymczasowe na potrzeby jednego pokazu) naprawienie wyszukiwania po SKU i wyświetlania użytkownika/etykiety w historii, oraz — jeśli relokacja kontenera zostanie w ogóle zbudowana — zapewnienie, że nie tworzy cichej rozbieżności między zapisaną „aktualną lokalizacją" kontenera a rzeczywistym stanem jego zawartości. Żadna z tych pozycji nie wymaga nowego zakresu funkcjonalnego wykraczającego poza to, co skrypt już obiecuje na pitchu — to kwestia solidności, nie nowej funkcji.

### Notes / evidence

- Wyszukiwanie produktów filtruje wyłącznie po `name`/`product_name` (`InventoryProductsService.listProducts`, `apps/web/src/server/services/inventory-products.service.ts` ok. linii 192-193, 281-282) — nigdy po `sku`. Realny, aktualny stan (`on_hand_quantity`/`available_quantity`) pochodzi z bezpośredniego zapytania na `inventory_balances` (ok. linii 2500-2623), nie z pól katalogowych, ale lokalizacja nie jest kolumną głównej listy wyników.
- Osobna funkcja z realnym podziałem na lokalizacje (`listVariantOptions`, ok. linii 1253-1397) istnieje, ale jest używana wyłącznie w pickerze panelu lokalizacji i dialogu importu ruchu — nie na stronie wyszukiwania produktów.
- Panel zawartości lokalizacji (`location-detail-panel.tsx`) renderuje trzy niezależnie zasilane sekcje z `AmbraLocationInventoryService.getSnapshot` (`apps/web/src/server/services/ambra-location-inventory.service.ts:57-83`): realny stan magazynowy z `inventory_balances` (ok. linii 85-198), realną historię ruchów z `inventory_movement_lines`/`inventory_movement_headers` (ok. linii 200-330), oraz kontenery (ok. linii 333+). `listBalances`/`listMovements` nie filtrują po `location_id` po stronie serwera — pobierają do 2000 wierszy oddziału i filtrują w przeglądarce (`location-detail-panel.tsx` ok. linii 474-494).
- Relokacja pojedynczej części: `movement-positions-tab.tsx` (ok. linii 161-207) dla typu ruchu `801` („Bin-to-Bin Move (MMZ)") renderuje wybór lokalizacji źródłowej/docelowej (cel wyklucza źródło, ok. linii 200) i ilość ze sterownikami +/- z walidacją `max={line.on_hand_at_source}` (ok. linii 77-115). Księgowanie: `public.inventory_post_movement` (`apps/web/supabase-target/supabase/migrations/20260506090000_inventory_phase2_enterprise_core.sql:1738-1773`) blokuje ujemny dostępny stan po stronie bazy, nie tylko UI.
- Realnie zasiane dziś typy ruchów to wyłącznie `101`, `801`, `401`, `402`, `311` (`public.inventory_seed_movement_types`, `apps/web/supabase-target/supabase/migrations/20260712120000_add_inter_branch_movement_contract.sql:71-171`) — udokumentowana gdzie indziej lista „31 typów ruchów (101-613)" nie odpowiada temu, co faktycznie działa w runtime; `801` ma kategorię `bin_operation`, nie `transfer`.
- Relokacja kontenera ponownie potwierdzona jako martwa: `grep` dla `relocateContainerAction` w całym `apps/web/src` (włącznie ze stronami lokalizacji) zwraca wyłącznie plik definicji akcji — zero wywołań z jakiegokolwiek komponentu `.tsx`.
- Błąd etykietowania historii: `LocationMovementLine.movementKind` niesie surowy kod typu ruchu (np. `"801"`), ale UI porównuje go z literałem `"transfer"` (`location-detail-panel.tsx` ok. linii 311-312, 322) — warunek nigdy nie jest prawdziwy, więc etykieta „przeniesienie wewnętrzne" nigdy się nie wyświetla. Pole `posted_by`/wykonawca nie jest w ogóle pobierane ani wyświetlane w tym widoku, mimo że `posted_at` jest.
- Trzy niezależne mechanizmy „aktualnej lokalizacji": `inventory_balances` (autorytatywne, aktualizowane transakcyjnie przy każdym zaksięgowanym ruchu), `inventory_containers.current_location_id` (pole cache, ustawiane wyłącznie przez martwy kod relokacji kontenera — w praktyce zamrożone od utworzenia), `inventory_serials.current_location_id` (aktualizowane wewnątrz `inventory_post_movement` dla pozycji seryjnych). Interfejs nigdy nie krzyżuje tych źródeł, więc mogą się cicho rozjechać dla kontenerów.
- Jedyny test dotykający transferów międzyoddziałowych (`inventory-cross-branch-transfers.test.ts`) sprawdza wyłącznie obecność fragmentów tekstu w plikach migracji (`fs.readFileSync` + `toContain`), nie wykonuje żadnej realnej operacji — może odnosić się do nazw funkcji sprzed przepisania silnika księgowania.
- Zależności: Strefa 4 (wyszukiwanie zlecenia będzie możliwe dopiero po istnieniu trwałej tożsamości zlecenia — dziś świadomie poza zakresem tej strefy), Strefa 5 (fizyczna tożsamość QR części/zestawu, jeśli relokacja ma korzystać ze skanu zamiast wyboru z listy), Strefa 6 (dane wejściowe tej strefy pochodzą z przyjęcia — jeśli Strefa 6 nie dostarczy trwałego stanu magazynowego przed pitchem, Strefa 7 nie ma na czym pracować), Strefa 1 (izolacja oddziałowa/RLS tabel użytych tutaj) — odnotowane, nie duplikowane.

### 8. Zwykłe wydanie części

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Dedykowany przycisk „Wydanie" na pulpicie magazynowym jest dosłownym zaślepką — akcja serwerowa, którą wywołuje, zwraca zawsze ten sam, zaszyty na sztywno błąd: „Issue movements not yet available in v1. Use the movements page." Nie ma żadnego zasianego typu ruchu o kategorii „wydanie"/„issue"/„consumption" — jedyne typy zdolne zmniejszyć stan bez lokalizacji docelowej to `401`/`402`, które są jawnie korektami z inwentaryzacji (nadwyżka/niedobór), nie wydaniem części do odbiorcy. Na poziomie bazy istnieje osobny, gotowy mechanizm `movement_kind='issue'` z prawidłowym zabezpieczeniem przed nadmiernym wydaniem — ale żaden kod aplikacji nigdy go nie ustawia; to martwa zdolność. Istnieje też osierocony plik UI z typem operacji „issue", niepodłączony do żadnej trasy. Da się technicznie zmniejszyć stan konkretnej pozycji w konkretnej lokalizacji, ręcznie tworząc ruch typu 402 w ogólnym edytorze — z prawdziwym zabezpieczeniem przed ujemnym stanem po stronie bazy — ale bez jakiegokolwiek pola odbiorcy/kontekstu (polityka pól nie definiuje ich dla typu 402 w ogóle) i pod błędną nazwą dokumentu („korekta z inwentaryzacji", nie „wydanie"). To dokładnie sytuacja opisana jako 🟠: prymityw zdolny technicznie zmniejszyć stan istnieje, ale nie ma spójnego, nazwanego poprawnie workflow wydania części.

**Dowody:**

- Kod: VERIFIED. Prześledzono zaślepkę `issueStockAction` (`apps/web/src/app/actions/warehouse/inventory/index.ts` ok. linii 1821-1826 — zawsze zwraca błąd), definicję typów 401/402 (`inventory_seed_movement_types`, kategoria `adjustment`, nazwy PL „Korekta z inwentaryzacji"), gałąź `movement_kind = 'issue'` w `inventory_post_movement` (realne, ale nieużywane przez aplikację zabezpieczenie przed ujemnym stanem), politykę pól nadawca/odbiorca (`inventory_movement_type_field_policies` — zdefiniowana dla typów 101/801/311, **nigdy dla 401/402**, więc pola odbiorcy nie są w ogóle oferowane dla jedynego typu technicznie zdolnego pełnić rolę wydania) oraz osierocony plik `inventory-movement-new-client.tsx` (definiuje typ operacji „issue", niezaimportowany nigdzie w repozytorium). Rejestr celów komentarzy/załączników (`target-registry.ts` w `apps/web/src/server/comments/`) nie ma wpisu dla ruchu magazynowego — zgodnie z ustaleniem Strefy 9 nie jest to blokerem, bo podpisany dokument dołącza się do zlecenia naprawczego (RepairOrder), nie do ruchu.
- Testy automatyczne: NONE dla realnego zachowania. Istniejące testy (`inventory-phase1-migrations.test.ts`, `inventory-movement-field-policies-migration.test.ts`) sprawdzają wyłącznie obecność fragmentów tekstu SQL w plikach migracji (`toContain("v_header.movement_kind = 'issue'")` itp.), nie wykonują żadnego realnego ruchu i nie testują ścieżki 401/402. Zero testów `issueStockAction` (to trwała zaślepka, więc nie ma czego testować), zero testów odrzucenia nadmiernego wydania na realnej ścieżce, zero testów ponownego odnalezienia wydania.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej próby.
- Przebieg end-to-end: NOT APPLICABLE dla zamierzonego „wydania" (nie istnieje ścieżka do przetestowania — przycisk to zaślepka); NOT VERIFIED dla obejścia przez ręczne utworzenie ruchu 402.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono świadomie, jak demo pokaże „wydanie części", skoro dedykowany przycisk jest dziś zaślepką: (a) podłączyć istniejącą gałąź `movement_kind='issue'` do prawdziwego, choćby minimalnego wejścia UI, (b) tymczasowo nadać typowi 402 pola odbiorcy przez politykę pól i używać go jako obejścia z jasną etykietą w scenariuszu, albo (c) świadomie zawęzić scenariusz demo, żeby nie obiecywał dedykowanego wydania, którego dziś nie ma.

**Typ dokumentu wydania**

- [ ] Wybrany na potrzeby demo mechanizm (zależnie od decyzji wyżej) ma trwały numer dokumentu, status i właściwe oddział/organizację — potwierdzone w kodzie dla ogólnego silnika ruchów, do zweryfikowania na żywo dla wybranej ścieżki.
- [ ] Wymaga lokalizacji źródłowej, nie wymaga docelowej — zgodne z semantyką wydania.

**Wejście do procesu**

- [ ] Użytkownik demo ma praktyczną, przećwiczoną ścieżkę rozpoczęcia wydania (nie improwizowaną nawigację po ogólnym edytorze ruchów podczas samego pokazu).
- [ ] Wybrana część/lokalizacja źródłowa jest jednoznacznie widoczna przed zatwierdzeniem.

**Ilość**

- [ ] Wydanie konkretnej, znanej ilości działa na aktualnym build.
- [ ] Wydanie ilości częściowej (mniej niż cały dostępny stan) działa poprawnie — mechanizm księgowania jest wspólny z relokacją ze Strefy 7 i tam już zweryfikowany w kodzie.
- [ ] Próba wydania więcej niż dostępny stan jest odrzucana po stronie serwera, nie tylko UI — potwierdzone w kodzie dla ogólnego mechanizmu, do zweryfikowania na żywo dla wybranej ścieżki demo.

**Odbiorca/kontekst**

- [ ] Wybrana ścieżka demo faktycznie pozwala zapisać, komu/na jaki kontekst część została wydana — dziś typ 402 nie oferuje żadnego pola odbiorcy (brak wpisu w polityce pól), więc bez zmiany jedynym dostępnym polem jest ogólna notatka tekstowa.
- [ ] Powiązanie ze zleceniem naprawczym, jeśli pokazywane, jest jawnie opisane jako tekst, nie jako trwała relacja — zgodnie z ustaleniem Strefy 4 (Workshop nie istnieje).

**Zatwierdzenie i stan**

- [ ] Zatwierdzenie trwale zmniejsza stan na właściwej lokalizacji — sprawdzone na żywo dla wybranej ścieżki demo.
- [ ] Ponowne kliknięcie/błąd sieci przy zatwierdzaniu nie tworzy dwóch dokumentów wydania — dziś ochrona to wyłącznie blokada przycisku po stronie klienta (`disabled` podczas wysyłki); klucz idempotencji jest generowany na nowo przy każdym wywołaniu, więc nie chroni przed prawdziwym podwójnym zatwierdzeniem.
- [ ] Błąd zapisu nie wygląda na sukces.

**Odnalezienie później**

- [ ] Wydany dokument można ponownie odnaleźć z listy ruchów magazynowych i otworzyć jego szczegóły (ilość, lokalizacja źródłowa, data, numer dokumentu) — potwierdzone jako realna, działająca funkcja ogólnego silnika ruchów.
- [ ] Historia lokalizacji źródłowej pokazuje to wydanie po odświeżeniu/ponownym wejściu.

**Granica ze Strefą 9**

- [ ] Potwierdzono, że podpisany dokument wydania dołącza się do zlecenia naprawczego (Strefa 9: RepairOrder jako cel załączników), nie do samego ruchu magazynowego wydania — ruch magazynowy nie musi stawać się celem załączników na potrzeby pitchu; jedyna zależność to istnienie zlecenia ze Strefy 4, do którego można nawigować z odnalezionego wydania.

**Narracja o AutoStacji**

- [ ] Wypowiedź prezentera jasno mówi, że oficjalne wydanie nadal odbywa się w AutoStacji podczas pilotażu, a potwierdzenie w Ambrze to dodatkowa warstwa (kontrola magazynowa, historia, ślad fizyczny) — nie zastąpienie AutoStacji ani automatyczna synchronizacja.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 8 zweryfikowany ręcznie na aktualnym build, na stanie utworzonym w Strefach 6–7:** odnalezienie znanej części → rozpoczęcie wydania wybraną ścieżką → wybór właściwej lokalizacji źródłowej → wydanie reprezentatywnej ilości → zapisanie odbiorcy/kontekstu → zatwierdzenie → poprawne zmniejszenie stanu → widoczność stanu/lokalizacji po odświeżeniu → ponowne odnalezienie dokumentu z nowej nawigacji → potwierdzenie ilości, lokalizacji źródłowej, użytkownika/czasu i stabilnej tożsamości dokumentu gotowej pod dołączenie podpisanego dokumentu w Strefie 9.

**Pitch gap:**

To druga po Strefie 6 najgłębsza luka funkcjonalna wśród ocenionych dotąd stref P0 — z ważnym zastrzeżeniem, że luka jest węższa niż w Strefie 6, bo mechanizm księgowania (zmniejszanie stanu, blokada nadmiernego wydania, częściowa ilość) jest już sprawdzony i działający dla analogicznej operacji (relokacja, Strefa 7). Brakuje jednak samej **warstwy biznesowej wydania**: dedykowany przycisk jest trwałą zaślepką z zaszytym błędem; jedyny technicznie zdolny typ ruchu (402) nazywa się i jest oznaczony jako korekta z inwentaryzacji, nie wydanie; nie oferuje żadnego pola odbiorcy/kontekstu; ochrona przed podwójnym zatwierdzeniem to wyłącznie blokada przycisku po stronie klienta. Zbudowanie tej strefy do stanu obiecywanego przez skrypt wymaga: (1) świadomej decyzji, którym mechanizmem pokazać wydanie, (2) minimalnego pola odbiorcy/kontekstu dla wybranego typu, (3) prawdziwej ochrony przed podwójnym zatwierdzeniem. Podpisany dokument wydania (Strefa 9) dołącza się do zlecenia naprawczego, nie do samego ruchu — rejestr celów załączników nie musi więc obejmować ruchu magazynowego na potrzeby pitchu, o ile Strefa 4 dostarczy zlecenie, do którego wydanie się odnosi. To realna, ale węższa niż w Strefie 6, praca implementacyjna.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Dedykowany typ ruchu „wydanie" (nie nadużyty 402) zasiany i podłączony do prawdziwej ścieżki `movement_kind='issue'` — na potrzeby pilotażu nazwa/semantyka dokumentu musi być poprawna, nie tymczasowym obejściem z pitchu.
- [ ] Prawdziwa idempotencja zatwierdzenia (stabilny klucz trzymany w stanie komponentu przez cały cykl żądania, nie generowany na nowo przy każdym wywołaniu) plus ochrona po stronie bazy.
- [ ] Bezpieczeństwo współbieżnego wydania tej samej pozycji przez dwóch pracowników jednocześnie (blokada/kolejkowanie na poziomie salda).
- [ ] Jawne zasady korekty/reversal błędnie wydanej pozycji z zachowaniem historii.
- [ ] Walidacja odbiorcy/kontekstu (np. wymagany, jeśli typ tego wymaga) dopracowana dla realnych ról pilotażowych.
- [ ] Trwały ślad audytowy wydań dla ról administracyjnych.
- [ ] Izolacja oddziałowa/organizacyjna wydań — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowego/podłączonego typu ruchu.
- [ ] Integralność numeracji dokumentów wydania przy realistycznym wolumenie i wielu jednoczesnych użytkownikach.
- [ ] Testy integracyjne automatyczne pokrywające realny przepływ wydania (utworzenie → zatwierdzenie → odrzucenie nadmiernej ilości → odnalezienie) — dziś praktycznie nieobecne.
- [ ] Procedura uzgadniania z AutoStacją (co się dzieje, gdy wydanie w Ambrze i w AutoStacji się rozjadą) ustalona proceduralnie, nie tylko wypowiedziana podczas pitchu.
- [ ] Monitorowanie nieudanych prób wydania (np. odrzuconych z powodu braku stanu) widoczne dla administratora.
- [ ] **Dokładny scenariusz pilotażu Strefy 8 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym współbieżne wydanie i jedna kontrolowana korekta.

**Pilot gap:**

Zakres pilotażowy tej strefy jest w dużej mierze naturalną kontynuacją tego, co pitch-gate już wymusza — nazwany poprawnie, podłączony mechanizm wydania z polem odbiorcy. Ponad to dochodzi twardość specyficzna dla realnego wolumenu: prawdziwa idempotencja (nie tylko blokada przycisku), współbieżność, integralność numeracji dokumentów i procedura uzgadniania z AutoStacją — istotna, bo skrypt explicite mówi, że AutoStacja pozostaje źródłem prawdy podczas pilotażu, więc rozbieżności między systemami muszą mieć ustaloną procedurę, nie tylko dobre intencje.

### Notes / evidence

- Zaślepka dedykowanego wydania: `apps/web/src/app/actions/warehouse/inventory/index.ts` ok. linii 1821-1826 (`issueStockAction` zawsze zwraca `{success: false, error: "Issue movements not yet available in v1. Use the movements page."}`), wywoływana z realnego, osiągalnego formularza na pulpicie magazynowym (`inventory-client.tsx` ok. linii 245-263) — w przeciwieństwie do sąsiednich, realnych akcji przyjęcia/transferu na tej samej stronie.
- Typy 401/402: zasiane jako `category='adjustment'`, `name_pl: "Korekta z inwentaryzacji (nadwyżka/niedobór)"` (`apps/web/supabase-target/supabase/migrations/20260710131915_fix_audit_movement_and_zero_stock.sql` ok. linii 227-250) — zbudowane, żeby dać typ do księgowania sesji inwentaryzacyjnych, nie do wydawania części odbiorcy. Żaden zasiany typ nie ma kategorii issue/consumption/sales/shipment.
- Martwa zdolność na poziomie bazy: gałąź `movement_kind = 'issue'` w `inventory_post_movement` (`apps/web/supabase-target/supabase/migrations/20260506090000_inventory_phase2_enterprise_core.sql` ok. linii 1703-1735) ma prawidłowe zabezpieczenie przed ujemnym stanem, ale żaden kod aplikacji nigdy nie ustawia `movement_kind: "issue"` (jedyne użycie parametru w kodzie to `"opening_balance"`, `inventory-products.service.ts:2310`).
- Osierocony plik UI: `inventory-movement-new-client.tsx` definiuje typ operacji „issue" (linie ok. 28-30, 120-123, 307), ale nie jest importowany nigdzie w repozytorium — realna strona `movements/new/page.tsx` renderuje inny komponent (`MovementDocumentForm`).
- Polityka pól nadawca/odbiorca zdefiniowana wyłącznie dla typów 101 (opcjonalne), 801 (zabronione), 311 (wymagane) — `apps/web/supabase-target/supabase/migrations/20260626150000_inventory_movement_field_policies.sql` i `20260712120000_add_inter_branch_movement_contract.sql`; brak jakiegokolwiek wiersza polityki dla 401/402, więc te pola nie są dziś oferowane w UI dla jedynego typu technicznie zdolnego reprezentować wydanie.
- Ochrona przed podwójnym zatwierdzeniem: kolumna `idempotency_key` i unikalny indeks istnieją (`inventory_movement_headers_org_idempotency_uidx`), ale klucz jest generowany (`crypto.randomUUID()`) wewnątrz callbacku wysyłki przy każdym wywołaniu (`use-movement-submission.ts` ok. linii 105), nie trzymany stabilnie w stanie — realna ochrona przed podwójnym kliknięciem to wyłącznie `disabled={isPending}` na przycisku.
- Odnalezienie ruchu: lista (`InventoryMovementsService.listMovements`, wyszukiwanie po numerze dokumentu/nadawcy/odbiorcy) i szczegóły (`inventory-movement-detail-panel.tsx`) są realne i działające dla ogólnego silnika ruchów; historia lokalizacji (Strefa 7) także pokazuje ruchy. Brak jednak widoku historii ruchów z poziomu szczegółów produktu.
- Rejestr celów załączników/komentarzy (`apps/web/src/server/comments/target-registry.ts`) ma dokładnie trzy wpisy: `helpdesk.ticket`, `planning.task`, `planning.kanban_card` — brak wpisu dla ruchu magazynowego. Zgodnie z ustaleniem Strefy 9 nie jest to zależność blokująca tę strefę: podpisany dokument dołącza się do zlecenia naprawczego (RepairOrder), nie do ruchu magazynowego, więc ruch nie musi stać się celem załączników na potrzeby pitchu.
- Zależności: Strefa 1 (izolacja oddziałowa/RLS), Strefa 4 (prawdziwa relacja zlecenia zamiast tekstu, jeśli wydanie ma pokazywać kontekst zlecenia; również cel, do którego Strefa 9 dołączy podpisany dokument), Strefa 6/7 (stan magazynowy, z którego wydawana jest część, musi istnieć przed demo tej strefy), Strefa 9 (podpisany dokument wydania dołącza się do zlecenia naprawczego, nie do tego ruchu — brak zależności architektonicznej w drugą stronę) — odnotowane, nie duplikowane.

### 9. Załączniki zlecenia naprawczego i archiwum dokumentów

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Generyczny system załączników jest realny, prywatny i genuinely reużywalny — to nie jest fasada ani coś specyficznego dla ticketów. Architektura oparta o `(targetType, targetId)` i rejestr deskryptorów celu jest w warstwie TypeScript prawdziwie generyczna: serwis, akcje serwerowe, trasa pobierania i komponent UI (`AttachmentsPanel`) nie mają ani jednej gałęzi specyficznej dla ticketu/zadania/karty Kanban — działają wyłącznie na podstawie rejestru. Ale **zlecenie naprawcze, które miałoby stać się czwartym celem, nie istnieje** (Strefa 4: NOT IMPLEMENTED), więc nie ma dziś niczego, do czego mógłby dołączyć się nowy typ. To dokładnie sytuacja opisana jako 🟠: realna, generyczna infrastruktura istnieje, ale brakujący cel (RepairOrder) uniemożliwia jej użycie w tej strefie. Dodatkowo warstwa autoryzacji SQL (`can_access_comment_target`) nie jest tak czysto wtykowa jak warstwa TypeScript — to zaszyty łańcuch `IF p_target_type = '...'`, więc dodanie nowego typu wymaga migracji kopiującej całe ciało funkcji, nie prostego wiersza w tabeli.

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny łańcuch: interfejs `CommentTargetDescriptor` i rejestr trzech typów (`apps/web/src/server/comments/target-registry.ts`), generyczne akcje serwerowe (`apps/web/src/app/actions/attachments/index.ts` — zero gałęzi specyficznych dla typu celu), generyczny serwis (`attachments.service.ts` — cztery metody, wszystkie rozwiązujące deskryptor przez rejestr), generyczną trasę pobierania z 60-minutowym podpisanym URL (`file-response.ts`), generyczny komponent UI (`AttachmentsPanel`, realnie użyty w szczegółach ticketu) oraz funkcję SQL `can_access_comment_target` (trzy migracje kolejno dopisujące gałęzie dla ticket/task/kanban_card — potwierdzony wzorzec kopiowania całego ciała funkcji). Potwierdzono: brak sprzężenia z komentarzami na poziomie tabeli (`app_attachments` nie ma FK do wątku komentarza), prywatny bucket Storage bez publicznych/zgadywalnych URL-i, walidację typu/rozmiaru pliku w trzech niezależnych miejscach (klient, serwis, konfiguracja bucketu Storage), oraz standardowy input pliku HTML bez żadnej dodatkowej integracji — działający natywnie z wyborem zdjęcia/aparatu na telefonie.
- Testy automatyczne: NONE. Wyczerpujące przeszukanie nie znalazło ani jednego testu (jednostkowego, integracyjnego ani e2e) dla całego systemu załączników — upload, listowanie, autoryzacja pobrania, odmowa między organizacjami/celami. Każde rozszerzenie systemu, w tym dodanie RepairOrder, byłoby dziś pozbawione jakiejkolwiek automatycznej ochrony przed regresją.
- Weryfikacja ręczna: NOT VERIFIED dla scenariusza RepairOrder (bo cel nie istnieje); NOT VERIFIED również dla samego mechanizmu na ticketach/zadaniach w tej analizie (brak odnotowanej świeżej próby).
- Przebieg end-to-end: NOT APPLICABLE dla zamierzonego scenariusza tej strefy — nie ma dziś RepairOrder, do którego można by cokolwiek dołączyć.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Zależność od Strefy 4**

- [ ] Potwierdzono, że trwałe zlecenie naprawcze ze Strefy 4 istnieje i ma stabilny identyfikator wewnętrzny, zanim rozpocznie się jakakolwiek praca nad tą strefą — bez tego cała reszta tej listy jest niewykonalna.

**Rejestracja RepairOrder jako celu**

- [ ] Dodano wpis `workshop.repair_order` (lub równoważny) do `COMMENT_TARGET_REGISTRY` w `target-registry.ts`, z `validate()` sprawdzającym istnienie zlecenia w danej organizacji/oddziale — wzorowane bezpośrednio na trzech istniejących wpisach, bez tworzenia równoległej, zduplikowanej infrastruktury.
- [ ] Dodano odpowiadającą gałąź dla tego typu w funkcji SQL `can_access_comment_target` (pełna migracja kopiująca istniejące ciało funkcji plus nowy blok `IF`) — świadomie zaplanowane jako osobny krok, nie „przy okazji".
- [ ] Zdefiniowano minimalne uprawnienia odczytu/załącznika dla zlecenia naprawczego, spójne z resztą systemu uprawnień (Strefa 1).

**UI na szczegółach zlecenia**

- [ ] Widok szczegółów zlecenia (Strefa 4: Nagłówek/Pozycje/Magazyn i Zam.) zyskuje czwartą sekcję „Załączniki", renderującą istniejący, niezmieniony komponent `AttachmentsPanel` z `targetType="workshop.repair_order"` i `targetId` zlecenia — bez tworzenia nowego, dedykowanego komponentu.
- [ ] Dodawanie załącznika działa z tego widoku na aktualnym build.
- [ ] Lista załączników jest widoczna i pozwala otworzyć/pobrać plik.

**Wsparcie plików**

- [ ] Zdjęcie JPEG podpisanego dokumentu można wgrać — sprawdzone na żywo dla przygotowanego pliku demo.
- [ ] PDF, jeśli używany w demo, również działa.
- [ ] Limit rozmiaru (25 MB) i dozwolone typy są znane prezenterowi; przygotowany plik demo mieści się w limicie.

**Telefon**

- [ ] Upload z telefonu prezentacyjnego działa — standardowy wybór pliku/aparatu z poziomu przeglądarki, bez dodatkowej aplikacji.
- [ ] Stany ładowania/sukcesu/błędu są czytelne na ekranie telefonu.

**Trwałość**

- [ ] Załącznik pozostaje widoczny po odświeżeniu strony.
- [ ] Załącznik pozostaje widoczny po wylogowaniu i ponownym zalogowaniu.
- [ ] Powiązanie z zleceniem jest zapisane jako rekord w bazie (`target_type`/`target_id`), nie jako konwencja nazwy pliku czy stan lokalny.

**Prywatność**

- [ ] Konto bez dostępu do danego zlecenia/oddziału/organizacji nie może otworzyć załącznika — sprawdzone na żywo dwoma kontami, nie tylko wywnioskowane z kodu.
- [ ] Bezpośredni dostęp do pliku (bez przejścia przez autoryzowaną trasę aplikacji) nie jest możliwy — zgodne z architekturą prywatnego bucketu i podpisanych URL-i, do potwierdzenia na żywo.

**Scenariusz prezentacyjny podpisanego wydania**

- [ ] Przygotowany przykładowy „podpisany dokument wydania" wgrywa się jako zwykły, generyczny załącznik — bez żadnego dedykowanego mechanizmu „wgraj podpisane wydanie".
- [ ] Wypowiedź prezentera jasno opisuje to jako kopię dokumentu z AutoStacji/DMS dołączoną do zlecenia, nie jako oficjalny, podpisany elektronicznie dokument generowany przez Ambrę.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 9 zweryfikowany ręcznie na aktualnym build i urządzeniach prezentacji:** wyszukanie/otwarcie zlecenia naprawczego używanego w demo → otwarcie sekcji Załączniki → wgranie jednego przygotowanego, podpisanego dokumentu wydania AutoStacji/DMS jako zwykłego załącznika JPEG/PDF → potwierdzenie uploadu → wylogowanie → powrót przez normalne wyszukiwanie zlecenia → ponowne otwarcie tego samego zlecenia → załącznik nadal widoczny na liście → otwarcie go z sukcesem → potwierdzenie, że nieuprawnione konto nie ma dostępu do załącznika zlecenia.

**Pitch gap:**

To jedyna strefa P0, w której główna przeszkoda nie leży w samej ocenianej funkcjonalności, tylko w zewnętrznej zależności: generyczny system załączników jest gotowy, przemyślany i nie wymaga przebudowy — potrzebuje wyłącznie nowego wpisu w rejestrze i odpowiadającej gałęzi SQL, dokładnie według istniejącego wzorca, bez duplikowania logiki. Bez Strefy 4 (trwałe zlecenie naprawcze) nie ma jednak niczego, do czego można by ten wpis dodać — to twardy blokier sekwencyjny, nie równoległa praca. Dodatkowe realne ryzyko: warstwa autoryzacji SQL nie jest czystym punktem wtyku (wymaga pełnej migracji kopiującej ciało funkcji), a cały system załączników — łącznie z trzema już działającymi celami — nie ma dziś żadnego pokrycia testami automatycznymi, więc rozszerzenie go o czwarty typ jest pracą bez siatki bezpieczeństwa.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Testy automatyczne dla całego generycznego systemu załączników (upload, listowanie, autoryzacja pobrania, odmowa między organizacjami/celami) — dziś nieobecne dla wszystkich czterech celów, nie tylko dla nowego.
- [ ] Polityka retencji załączników zlecenia (jak długo przechowywać, czy i kto może usunąć) ustalona i wdrożona — dziś usuwanie na poziomie bazy jest całkowicie zablokowane (`DELETE ... USING (false)`), więc jakiekolwiek świadome usuwanie wymaga miękkiego usuwania przez serwis, do zweryfikowania dla nowego celu.
- [ ] Uprawnienia do usuwania/zastępowania błędnie wgranego załącznika ustalone dla realnych ról pilotażowych.
- [ ] Ślad audytowy dodania/usunięcia załącznika zlecenia dla ról administracyjnych.
- [ ] Sprzątanie osieroconych plików w Storage w przypadku nieudanego zapisu wiersza bazy (lub odwrotnie) — do zweryfikowania na realnych awariach, nie tylko szczęśliwej ścieżce.
- [ ] Realistyczne rozmiary zdjęć z telefonu (pełna rozdzielczość aparatu) sprawdzone pod kątem limitu 25 MB i czasu uploadu na realnej sieci magazynowej.
- [ ] Polityka wobec formatu HEIC (domyślny format zdjęć na iPhone) — dziś nieobsługiwany w liście dozwolonych typów; ustalić, czy wymaga dodania czy jawnego komunikatu dla użytkownika.
- [ ] Monitorowanie wykorzystania limitu Storage/bucketu przy realnym wolumenie pilotażowym.
- [ ] Izolacja oddziałowa/organizacyjna załączników zlecenia potwierdzona rzeczywistym testem na żywej bazie — zależność od ogólnych ustaleń RLS ze Strefy 1, tu odnotowana jako wymaganie dla nowej gałęzi `can_access_comment_target`.
- [ ] Współbieżne dodawanie wielu załączników przez różnych użytkowników do tego samego zlecenia sprawdzone pod kątem spójności listy.
- [ ] **Dokładny scenariusz pilotażu Strefy 9 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym realne zdjęcia z telefonu i co najmniej jedna próba nieuprawnionego dostępu.

**Pilot gap:**

Ponieważ generyczna infrastruktura jest już solidna, luka pilotażowa dla tej strefy jest węższa niż w większości pozostałych — głównie brakujące testy automatyczne (dotyczące całego systemu, nie tylko nowego celu), polityka retencji/usuwania (dziś zablokowana na poziomie bazy, wymaga świadomej decyzji operacyjnej) oraz realistyczne testy na prawdziwych zdjęciach z telefonu i realnym wolumenie. Nie wymaga to nowego zakresu architektonicznego — rozszerza istniejący, dobrze zaprojektowany system.

### Notes / evidence

- Interfejs `CommentTargetDescriptor` i rejestr trzech typów (`helpdesk.ticket`, `planning.task`, `planning.kanban_card`) — `apps/web/src/server/comments/target-registry.ts` (deskryptor: `type`, `requiredReadPermission`, `requiredCommentPermission`, `requiredModeratePermission?`, `requiredAttachmentPermission?`, `validate()`, opcjonalne `afterCommentCreated`/`afterAttachmentCreated`).
- Generyczne akcje/serwis bez żadnej gałęzi specyficznej dla typu celu: `apps/web/src/app/actions/attachments/index.ts` (`listAttachmentsForTargetAction`, `uploadAttachmentsAction`, `deleteAttachmentAction`), `apps/web/src/server/services/attachments.service.ts` (`listForTarget`, `uploadForTarget`, `softDelete`, `getById` — wszystkie rozwiązują deskryptor przez `getCommentTargetDescriptor`).
- Generyczna trasa pobierania z podpisanym URL ważnym 60 minut, bez ekspozycji publicznego/zgadywalnego adresu obiektu — `apps/web/src/server/attachments/file-response.ts`.
- Generyczny komponent `AttachmentsPanel` (props `targetType`/`targetId`) realnie użyty w szczegółach ticketu (`ticket-detail-client.tsx`) — ten sam komponent, nie duplikat per typ encji; ta sama zasada dotyczy wątku komentarzy (`CommentsThread`) na zadaniach i kartach Kanban.
- Funkcja SQL `can_access_comment_target` to zaszyty łańcuch `IF p_target_type = '...' THEN ... END IF`, dopisywany kolejnymi migracjami pełną podmianą ciała funkcji (`20260604170000_generic_app_comments.sql` — tylko ticket; `20260604173000_comments_planning_task_target.sql` — dodaje task; `20260605170000_planning_kanban_card_details.sql` — dodaje kanban_card) — dodanie RepairOrder wymaga tego samego wzorca, nie prostego wiersza konfiguracyjnego.
- Brak sprzężenia z komentarzami na poziomie tabeli: `app_attachments` nie ma kolumny/FK do wątku komentarza, jest kluczowane niezależnie przez `(org_id, target_type, target_id)` — `apps/web/supabase/migrations/20260607100000_generic_app_attachments.sql`.
- Prywatność: bucket `app-attachments` ma `public: false`; pobranie zawsze przechodzi przez `file-response.ts`, generujący 60-minutowy podpisany URL i strumieniujący plik przez trasę aplikacji, nie eksponujący go bezpośrednio klientowi; RLS Storage niezależnie re-weryfikuje `can_access_comment_target` przy SELECT/DELETE, INSERT wymaga zgodności segmentu folderu z `auth.uid()`, UPDATE zablokowane w całości.
- Walidacja pliku w trzech niezależnych miejscach: filtr klienta (`attachment-dropzone.tsx`), `validateFile()` w serwisie, oraz konfiguracja bucketu Storage (`allowed_mime_types`, `file_size_limit: 26214400`) — limit 25 MB, maksymalnie 10 plików na partię, brak wsparcia dla HEIC.
- Standardowy input pliku HTML (`&lt;input type="file" accept="..."&gt;`) bez atrybutu `capture` — działa natywnie z wyborem zdjęcia/aparatu telefonu bez dodatkowej integracji.
- Zero testów jakiegokolwiek rodzaju dla całego systemu załączników — potwierdzone wyczerpującym przeszukaniem (`*attachment*.test.*`, testy pgTAP, e2e) w całym `apps/web`.
- Zależności: Strefa 4 (twardy blokier sekwencyjny — bez trwałego RepairOrder ta strefa nie ma celu do rejestracji), Strefa 1 (izolacja oddziałowa/organizacyjna nowej gałęzi autoryzacji, ogólne bezpieczeństwo Storage), Strefa 8 (odnotowane wyłącznie jako źródło scenariusza biznesowego — podpisany dokument wydania — nie jako zależność architektoniczna; załącznik dołącza się do zlecenia, nie do ruchu magazynowego, zgodnie z zamierzonym modelem tej strefy).

## P1 — mocne uzupełnienie prezentacji

### 10. Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

To najbardziej solidna strefa spośród dotychczas ocenionych — realna, w pełni podłączona administracja: lista członków, zaproszenia (tworzenie, akceptacja, odmowa, obsługa błędnych/wygasłych tokenów), role wbudowane i niestandardowe z edytorem uprawnień, przypisania ról w zakresie organizacji i oddziału (model „branch managera"), oraz rzeczywiste, testowane sprawdzenia uprawnień po stronie serwera — nie tylko ukrywanie przycisków. Zmiana roli działa bez wymuszania ponownego logowania (snapshot uprawnień jest czytany na świeżo przy każdym żądaniu SSR; JWT ma tylko kosmetyczne opóźnienie widoczne w wyświetlanej liście ról, nie w faktycznej autoryzacji). Jest jednak konkretna, potwierdzona w kodzie luka bezpieczeństwa administracyjnego: **nie istnieje żadne zabezpieczenie przed usunięciem/zdegradowaniem ostatniego właściciela organizacji ani przed samodzielnym odebraniem sobie dostępu** — ani w akcji, ani w serwisie, ani w RLS. To realny, potwierdzony brak, nie tylko niezweryfikowany szczegół, więc mimo mocnego fundamentu status nie przekracza PARTIAL.

**Dowody:**

- Kod: VERIFIED, na aktualnie działającym backendzie (`apps/web/.env.local` wskazuje projekt „target" — użyto migracji z `apps/web/supabase-target/supabase/migrations`, nie starszego drzewa `apps/web/supabase/migrations`). Prześledzono: listę członków (`members-client.tsx`, `OrgMembersService.listMembers`), pełny cykl zaproszenia (`createInvitationAction` → `OrgInvitationsService.createInvitation` → e-mail → `acceptInvitationAction`/`declineInvitationAction` → RPC `accept_invitation_and_join_org`/`decline_invitation`), rejestrację bez zaproszenia (`createOrganizationAction` → RPC `create_organization_for_current_user`, przypisanie roli `org_owner`), model ról (role wbudowane `org_owner`/`org_member` plus role niestandardowe per organizacja z edytorem uprawnień w `roles-client.tsx`), zmianę roli (`assignRoleToUserAction`/`removeRoleFromUserAction` → `user_role_assignments`, podwójna bramka `MEMBERS_MANAGE`/`BRANCH_ROLES_MANAGE`), administrację dostępem oddziałowym (ten sam mechanizm z `scope: "branch"`, filtrowany widok dla branch managerów) oraz świeżość uprawnień po zmianie (`compile_user_permissions` wywoływane jawnie po akceptacji zaproszenia; `PermissionServiceV2.getPermissionSnapshotForUser()` czytane na nowo przy każdym żądaniu SSR, nie z JWT). Potwierdzono realny brak: żadna z funkcji usuwania członka/roli (`OrgMembersService.removeMember`, akcje `roles.ts`) nie sprawdza liczby właścicieli ani tożsamości działającego użytkownika względem celu operacji; przeszukanie migracji `target` pod kątem „last_owner"/„owner_count" nie dało wyników.
- Testy automatyczne: PARTIAL/VERIFIED na papierze, nie uruchomione w tej sesji. Istnieje szeroki, konkretny zestaw testów (`invite-lifecycle.test.ts` — kody błędów `INVITE_NOT_FOUND`/`INVITE_EXPIRED`/`EMAIL_MISMATCH`/`INVITE_NOT_PENDING`; `actions-org-gaps.test.ts`, `roles.test.ts`, `branches.test.ts`, `member-detail-client.test.tsx`, `roles-client.test.tsx`, `branches-client.test.tsx` — w tym jawne przypadki „returns unauthorized when missing ..."), asercje odpowiadają dokładnie kształtowi realnego kodu. Zero testów dla scenariusza „ostatni właściciel"/samodzielnego odebrania dostępu — bo taka ochrona nie istnieje.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: otwarcie widoku członków → pokazanie realnych kont z różnymi rolami → jedna bezpieczna operacja (zmiana roli lub zaproszenie/akceptacja) → potwierdzenie efektu.

**Wymagany stan dla pitchu:** DEMO READY dla krótkiego omówienia

### Pitch readiness checklist

**Konta przygotowane przed spotkaniem**

- [ ] Konto administratora/właściciela przygotowane z pełnym dostępem.
- [ ] Konto pracownika magazynu przygotowane z rolą niestandardową odpowiednią do reszty pokazu (Strefy 6–9).
- [ ] Jeśli scenariusz tego wymaga: drugie konto (np. akceptant/doradca) przygotowane z inną, kontrastującą rolą.
- [ ] Członkostwa/role tych kont odpowiadają temu, co prezenter faktycznie pokaże — sprawdzone na żywo, nie tylko założone.

**Wybrany krótki scenariusz**

- [ ] Wybrano jeden, stabilny ekran administracyjny do pokazania (lista członków ze zróżnicowanymi rolami LUB zaproszenie z przypisaną rolą/zakresem) — nie oba naraz.
- [ ] Jeśli scenariusz obejmuje zmianę roli na żywo: sprawdzono na aktualnym build, że zmiana się zapisuje i jest widoczna bez konieczności wylogowania.
- [ ] Jeśli scenariusz obejmuje zaproszenie: jedno zaproszenie/przyjęcie przetestowano przed spotkaniem od początku do końca, łącznie z błędnym/wygasłym tokenem.
- [ ] Prezenter potrafi krótko i poprawnie terminologicznie opisać hierarchię organizacja → oddział → członek → rola → uprawnienie, zgodnie z rzeczywistym modelem w kodzie (role wbudowane + role niestandardowe per organizacja, nie sztywna lista „org_owner/manager/worker/viewer" nieodpowiadająca kodowi).
- [ ] Wypowiedź nie obiecuje funkcji, których nie ma (SSO, katalog HR, masowy import, pełny edytor macierzy uprawnień na poziomie enterprise) — pokaz ogranicza się do tego, co faktycznie działa.

**Bezpieczeństwo widoczne podczas pokazu**

- [ ] Konto bez uprawnień administracyjnych nie może wykonać tej samej operacji (zmiana roli/zaproszenie) — sprawdzone na żywo, nie tylko wywnioskowane z ukrytego przycisku.
- [ ] Podczas przygotowania demo nie wykonano przypadkowo operacji na ostatnim właścicielu organizacji — świadome ominięcie znanej luki (brak ochrony ostatniego właściciela), nie poleganie na tym, że nikt tego nie zrobi.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 10 zweryfikowany ręcznie na aktualnym build:** administrator otwiera realny widok administracji członkami/dostępem → pokazuje przygotowane konta z odrębnymi, rzeczywistymi członkostwami/rolami → wykonuje jedną wybraną, bezpieczną operację (zmiana roli LUB zaproszenie/akceptacja) → odświeżenie/ponowne zalogowanie w razie potrzeby → wynikowy dostęp jest widoczny i spójny ze Strefą 1 → konto nieuprawnione nie może wykonać tej samej operacji administracyjnej.

**Pitch gap:**

Fundament jest realny i solidniejszy niż w większości pozostałych stref — to nie jest kwestia budowania brakującej funkcjonalności, tylko krótkiej, świeżej weryfikacji ręcznej wybranego scenariusza na aktualnym build oraz świadomego, wąskiego doboru tego, co pokazać w ograniczonym czasie. Jedyna realna luka funkcjonalna — brak ochrony ostatniego właściciela/samodzielnej degradacji — nie blokuje pitchu wprost (nie jest to element scenariusza), ale wymaga ostrożności przy przygotowywaniu kont demo, żeby nie ujawnić jej przypadkowo na żywo.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Ochrona ostatniego właściciela organizacji przed usunięciem/degradacją — dziś potwierdzona jako całkowicie nieobecna na wszystkich warstwach (akcja, serwis, RLS).
- [ ] Ochrona przed samodzielnym odebraniem sobie dostępu/degradacją własnej roli administracyjnej bez potwierdzenia.
- [ ] Ochrona przed eskalacją uprawnień (użytkownik przypisujący sobie lub innym rolę szerszą niż jego własne uprawnienia pozwalają) — do potwierdzenia dokładnego zakresu istniejących sprawdzeń.
- [ ] Trwały ślad audytowy zmian członkostwa/roli (kto/kiedy zmienił czyją rolę) dla ról administracyjnych.
- [ ] Natychmiastowe odwołanie dostępu po usunięciu członkostwa sprawdzone na żywo (nie tylko w kodzie) — czy trwająca sesja usuniętego użytkownika traci dostęp przy najbliższym żądaniu.
- [ ] Zachowanie przy współbieżnej zmianie roli tej samej osoby przez dwóch administratorów jednocześnie.
- [ ] Obsługa zduplikowanego zaproszenia (ten sam e-mail, dwa aktywne zaproszenia) sprawdzona na realnych danych.
- [ ] Odzyskiwanie po błędnym przypisaniu roli (jasna ścieżka korekty, nie tylko ręczna ingerencja w bazę).
- [ ] Testy integracyjne/RLS na żywej bazie dla scenariuszy administracji dostępem — dziś istniejące testy są w większości na zamockowanym kliencie; zależność od ogólnych ustaleń o realnych testach RLS ze Strefy 1, tu odnotowana jako wymaganie specyficzne dla tabel `user_role_assignments`/`organization_members`/`invitations`.
- [ ] Realistyczny test wielu pilotażowych ról jednocześnie (właściciel, pracownik magazynu, doradca/akceptant, ewentualny branch manager) na rzeczywistych kontach, nie tylko syntetycznych.
- [ ] **Dokładny scenariusz pilotażu Strefy 10 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym próba usunięcia/degradacji ostatniego właściciela jako świadomy test negatywny.

**Pilot gap:**

Główna dodatkowa praca pilotażowa to domknięcie jednej konkretnej, potwierdzonej luki bezpieczeństwa administracyjnego (ochrona ostatniego właściciela i samodzielnej degradacji) oraz rozszerzenie pokrycia testami z zamockowanego klienta na realną bazę dla tabel administracji dostępem. Reszta to pogłębienie audytu/współbieżności odpowiednie do skali pilotażu, nie nowy zakres funkcjonalny — fundament administracyjny jest już dziś zbudowany solidnie.

### Notes / evidence

- Backend runtime potwierdzony jako projekt „target" (`apps/web/.env.local` → `rjeraydumwechpjjzrus`); wszystkie cytowania DB pochodzą z `apps/web/supabase-target/supabase/migrations`, nie ze starszego, częściowo nieaktualnego drzewa `apps/web/supabase/migrations` — istotne rozróżnienie już wcześniej odnotowane w innych strefach (dryf/dwa drzewa migracji).
- Lista członków: `apps/web/src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx` + `apps/web/src/app/actions/organization/members.ts` (`listMembersAction` → `OrgMembersService.listMembers`) — realne dane, role/zakresy/oddziały widoczne per wiersz.
- Zaproszenia: `createInvitationAction`/`acceptInvitationAction`/`declineInvitationAction` (`apps/web/src/app/actions/organization/invitations.ts`) → RPC `accept_invitation_and_join_org`/`decline_invitation` (`apps/web/supabase-target/supabase/migrations/20260323000015_target_harden_p6_legacy_cleanup.sql:27-170`) — kopiuje przypisania ról z zaproszenia do `user_role_assignments` z rozróżnieniem zakresu org/oddział i jawnie wywołuje `compile_user_permissions` na końcu.
- Rejestracja bez zaproszenia: `createOrganizationAction` (`apps/web/src/app/actions/onboarding/index.ts:61-170`) → RPC `create_organization_for_current_user`, przypisanie wbudowanej roli `org_owner` (seed w `20260320000011_target_p3_b3_seed.sql:53-60`).
- Role: wbudowane `org_owner`/`org_member` (`is_basic=true`) plus role niestandardowe per organizacja (`is_basic=false`, `scope_type` org/oddział) z triggerem chroniącym niezmienność tych pól po utworzeniu — UI: `apps/web/src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx`, akcje: `apps/web/src/app/actions/organization/roles.ts` (`createRoleAction`/`updateRoleAction`, walidacja `validateBranchRolePermissions` blokująca uprawnienia tylko-organizacyjne na rolach oddziałowych).
- Zmiana roli bez wymuszonego ponownego logowania: `apps/web/src/server/loaders/v2/load-user-context.v2.ts:110-146` — JWT ma tylko kosmetyczne opóźnienie w wyświetlanej liście ról; faktyczna autoryzacja (RLS, `has_permission`/`has_branch_permission`, `PermissionServiceV2.getPermissionSnapshotForUser()`) czyta `user_effective_permissions` na świeżo przy każdym żądaniu SSR.
- Potwierdzony brak ochrony ostatniego właściciela/samodzielnej degradacji: `OrgMembersService.removeMember` (`organization.service.ts:293-338`) i akcje w `roles.ts` wykonują bezwarunkowe usunięcie/zmianę bez sprawdzenia liczby właścicieli ani tożsamości działającego użytkownika; brak odpowiadającej polityki RLS (`20260320000022_target_p1_b1_org_members_policies.sql:63-70` — polityka DELETE sprawdza tylko `members.manage`, nie liczbę właścicieli); pomocnicza funkcja `is_org_owner()` istnieje, ale jest używana wyłącznie do bramkowania panelu admina platformy, nie do ochrony przy usuwaniu/zmianie roli.
- Administracja dostępem oddziałowym („branch manager"): ten sam mechanizm `assignRoleToUserAction`/`removeRoleFromUserAction` z `scope: "branch"`, plus filtrowany widok dla branch managerów bez `MEMBERS_READ` (`roles.ts:58-62`, `:482-492`) — zgodne z modelem opisanym już w code memory tego projektu.
- Sprawdzenia uprawnień po stronie serwera są realne i testowane bezpośrednio na akcjach (z pominięciem UI): `actions-org-gaps.test.ts`, `roles.test.ts`, `branches.test.ts` — konkretne przypadki „returns unauthorized when missing ...".
- Zależność: Strefa 1 (ostateczne wymuszenie dostępu, RLS, izolacja oddziałowa/organizacyjna — nie duplikowana tutaj); przygotowane w tej strefie konta są używane jako dane wejściowe do demo P0 w Strefach 6-9.

### 11. Tickety: komunikacja, akceptacja i problemowa część z QR

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

Rdzeń działa i jest spójny, nie tylko rozłączonymi prymitywami: prawdziwy wielo-użytkownikowy ticket z rzeczywistymi komentarzami (generyczny system załączników/komentarzy z Strefy 9), trwałą, niemutowalną historią aktywności, realnym procesem akceptacji wymuszanym po stronie RPC (nie tylko RLS), oraz w pełni działającym przypisaniem/skanowaniem QR ticketu prowadzącym do właściwego widoku szczegółów. To realna, sprawdzona (kodowo) funkcjonalność. Jednocześnie ujawniono konkretne, potwierdzone braki wymagające jawnego zawężenia wypowiedzi: **nie istnieje akcja odrzucenia** — jest wyłącznie akceptacja, żadnej symetrycznej decyzji negatywnej; **żadna kolumna nie łączy ticketu strukturalnie ze zleceniem, produktem, częścią ani kontenerem** — istnieje wprawdzie generyczna tabela `helpdesk_ticket_references` do takich powiązań, ale nie ma jej ani jednego wywołania w całym kodzie (martwa infrastruktura); wyszukiwanie ticketów dopasowuje wyłącznie tytuł, nie numer ticketu; przejścia statusu nie są wymuszane po stronie serwera poza zamknięciem (bezwarunkowym, z dowolnego statusu). Żaden typ „Zwrot" nie jest dziś zasiany domyślnie — trzeba by go utworzyć ręcznie przed pokazem jako typ niestandardowy.

**Dowody:**

- Kod: VERIFIED, na autorytatywnym drzewie migracji dla tego modułu (tabele `helpdesk_*` istnieją wyłącznie w `apps/web/supabase/migrations` — w przeciwieństwie do innych stref, nie ma tu problemu dwóch drzew/dryfu schematu). Prześledzono pełny schemat `helpdesk_tickets` i tabel powiązanych, tworzenie ticketu przez atomowy RPC `helpdesk_create_ticket`, model przypisania wielu użytkowników (`helpdesk_ticket_assignees`, domyślni odpowiedzialni/akceptanci per typ), generyczne komentarze (`CommentsService`/`CommentsThread` z `targetType="helpdesk.ticket"`), niemutowalną tabelę aktywności (`helpdesk_ticket_activity` — INSERT-only, bez polityki UPDATE/DELETE) z realnie logowanymi zdarzeniami (`ticket_created`, `ticket_accepted`, `ticket_closed`, `comment_added`, `attachment_added` — **brak** logowania zmiany statusu poza zamknięciem i brak logowania zmiany przypisania), proces akceptacji (`helpdesk_accept_ticket` RPC z autoryzacją wymuszoną wewnątrz funkcji, nie tylko przez RLS — potwierdzony brak jakiejkolwiek funkcji/akcji odrzucenia), oraz realny UI QR ticketu (`AssignQrDialog` — generowanie/przypisanie/skan/odłączenie) ze zweryfikowanym resolverem publicznym prowadzącym do poprawnej trasy szczegółów po `ticket_number`. Potwierdzono też dwie konkretne usterki: wyszukiwanie na liście ticketów filtruje wyłącznie `title` (`.ilike("title", ...)`), nie `ticket_number`; oraz że generyczna metoda `update()` serwisu (pozwalająca na dowolną zmianę statusu) istnieje, ale nie jest wywoływana z żadnej akcji — jedyna realna zmiana statusu po utworzeniu to bezwarunkowe zamknięcie.
- Testy automatyczne: NONE dla realnego zachowania ticketów. Wyczerpujące przeszukanie nie znalazło żadnego dedykowanego testu tworzenia ticketu, komentowania, akceptacji, zamknięcia ani przypisania QR — istniejące testy z „helpdesk" w nazwie dotyczą wyłącznie widoczności menu bocznego (gate uprawnień) albo integracji z kalendarzem planowania, z `HelpdeskTicketsService` całkowicie zamockowanym.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: utworzenie ticketu przez konto A → komentarz konta B → akceptacja przez uprawnione konto → ponowne otwarcie → skan QR na telefonie prowadzący do tego samego ticketu.

**Wymagany stan dla pitchu:** DEMO READY dla krótkiego pokazu

### Pitch readiness checklist

**Rdzeń ticketu**

- [ ] Utworzono jeden reprezentatywny ticket na aktualnym build, z typem, statusem, terminem i co najmniej jedną przypisaną osobą (konto B ze Strefy 10).
- [ ] Ticket i jego pola przetrwały odświeżenie strony.

**Komunikacja dwóch użytkowników**

- [ ] Konto B (inne niż twórca) otwiera ticket i dodaje komentarz — sprawdzone na żywo, że komentarz jest widoczny z autorem i czasem.
- [ ] Konto A ponownie otwiera ticket i widzi komentarz konta B po nawigacji/odświeżeniu.

**Historia**

- [ ] Historia aktywności ticketu pokazuje rzeczywiste zdarzenia (utworzenie, komentarz, ewentualną akceptację/zamknięcie) — prezenter wie, że zmiana przypisania i zmiana statusu (poza zamknięciem) **nie są dziś logowane** w historii, więc nie obiecuje tego na żywo.

**Akceptacja — bez fałszywej symetrii**

- [ ] Jeśli demo pokazuje przykład „Zwrot": utworzono ręcznie typ ticketu z wymaganą akceptacją przed spotkaniem — nie istnieje on domyślnie.
- [ ] Wyznaczony akceptant (konto z uprawnieniem zarządzania lub wpisany na listę akceptantów tego ticketu) akceptuje ticket — decyzja jest trwała, z autorem i czasem, widoczna po ponownym wejściu.
- [ ] Konto nieuprawnione nie może wykonać akceptacji — sprawdzone na żywo, nie tylko wywnioskowane z ukrycia przycisku (RPC wymusza to niezależnie od RLS).
- [ ] Wypowiedź prezentera **nie wspomina o odrzuceniu ticketu** jako istniejącej funkcji — dziś istnieje wyłącznie akceptacja, nie ma żadnej symetrycznej akcji odrzucenia w kodzie.
- [ ] Akceptacja jest opisana dokładnie jako to, czym jest: potwierdzenie z autorem/czasem dla konkretnego ticketu, nie jako silnik decyzji biznesowych z eskalacją, blokadami czy automatycznym skutkiem magazynowym.

**QR ticketu**

- [ ] Dla ticketu demo wygenerowano/przypisano QR z realnego UI na stronie szczegółów.
- [ ] Skan QR na telefonie prezentacyjnym otwiera dokładnie ten ticket (weryfikacja rozwiązywania po `ticket_number`, nie tylko odczyt kodu z rejestru).
- [ ] Wypowiedź prezentera opisuje to jako „etykieta ticketu przyklejona do części", nie jako „QR identyfikuje część" — dziś QR nie ma żadnej strukturalnej relacji do fizycznej części (zależność od Strefy 5, gdzie nie ma celu QR dla części).

**Powiązania domenowe — jawne zawężenie wymagane**

- [ ] Jeśli scenariusz demo wspomina o powiązaniu ticketu ze zleceniem/częścią/zestawem: potwierdzono, że dziś nie istnieje żadna trwała, nawigowalna relacja (tabela `helpdesk_ticket_references` istnieje w schemacie, ale nie ma żadnego wywołania w kodzie — martwa infrastruktura) — wypowiedź ogranicza się do „QR na fizycznej części otwiera ticket z opisem problemu", nie do „ticket zna tę część".

**Wyszukiwanie i ponowne odnalezienie**

- [ ] Ticket demo można odnaleźć z listy po tytule — prezenter wie, że wyszukiwanie po numerze ticketu dziś nie działa (filtr sprawdza wyłącznie tytuł).
- [ ] Ponowne otwarcie po nawigacji pokazuje pełny, trwały stan (komentarze, historia, akceptacja).

**Uczciwość wobec powiadomień**

- [ ] Wypowiedź nie sugeruje, że utworzenie/przypisanie/skomentowanie ticketu wysyła realne powiadomienie (e-mail/push/in-app) — dziś żadne z tych zdarzeń nie wyzwala niczego poza zapisem w bazie.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 11 zweryfikowany ręcznie na aktualnym build, na dwóch przygotowanych kontach ze Strefy 10:** konto A tworzy reprezentatywny ticket → przypisuje go zgodnie z rzeczywistym modelem do konta B → konto B otwiera i komentuje → wybrana akcja statusu/akceptacji wykonana przez uprawnione konto → konto A ponownie otwiera ticket i widzi trwałe komentarze/historię/decyzję → QR tego ticketu zeskanowany na telefonie prezentacyjnym otwiera ten sam ticket → każde pokazane powiązanie ze zleceniem/częścią/zestawem jest potwierdzone jako strukturalne i nawigowalne, w przeciwnym razie prezenter jawnie opisuje QR jako etykietę ticketu fizycznie przyklejoną do części, nie jako cyfrową relację do części.

**Pitch gap:**

Rdzeń działa realnie i spójnie — to nie jest strefa wymagająca nowej implementacji, tylko precyzyjnego, zawężonego opisu tego, co faktycznie istnieje. Trzy konkretne rzeczy wymagają jawnego ograniczenia wypowiedzi, nie kodu: (1) brak akcji odrzucenia — tylko akceptacja; (2) brak jakiejkolwiek strukturalnej relacji do zlecenia/części/zestawu — istniejąca tabela do tego celu jest martwym kodem; (3) wyszukiwanie po numerze ticketu nie działa. Dodatkowo typ „Zwrot" wymaga ręcznego przygotowania przed spotkaniem, bo nie jest zasiany domyślnie. Nic z powyższego nie zostało odtworzone ręcznie na aktualnym build.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Izolacja oddziałowa ticketów — zależność od Strefy 1 (RLS `helpdesk_tickets` jest dziś tylko organizacyjne, nie wymuszone na poziomie oddziału mimo kolumny `branch_id`), tu odnotowana jako wymaganie specyficzne dla tego modułu, nie duplikowana.
- [ ] Testy automatyczne dla całego przepływu ticketu (utworzenie, przypisanie, komentarz, akceptacja, zamknięcie, QR) — dziś całkowicie nieobecne.
- [ ] Wymuszenie przejść statusu po stronie serwera (dziś dowolna zmiana byłaby możliwa przez nieużywaną, ale istniejącą generyczną metodę `update()`, gdyby ktoś ją podłączył bez ograniczeń) — ustalić właściwy model przed realnym użyciem operacyjnym.
- [ ] Decyzja: czy dodać akcję odrzucenia jako realną funkcję, czy świadomie pozostać przy modelu wyłącznie akceptacji dla pilotażu.
- [ ] Jeśli pilotaż ma operacyjnie korzystać z powiązania ticket ↔ zlecenie/część: podłączenie istniejącej, dziś martwej tabeli `helpdesk_ticket_references` (lub równoważnego mechanizmu) do rzeczywistego UI, zależne też od istnienia Strefy 4.
- [ ] Naprawa wyszukiwania po numerze ticketu na stałe.
- [ ] Ślad audytowy zmiany przypisania i zmiany statusu w historii aktywności (dziś logowane są tylko utworzenie/komentarz/załącznik/akceptacja/zamknięcie).
- [ ] Zachowanie przy usunięciu/dezaktywacji przypisanego użytkownika (czy ticket pozostaje przypisany do „widmowego" konta).
- [ ] Polityka powiadomień, jeśli pilotaż uzna je za potrzebne — dziś brak jakiejkolwiek implementacji, zależność od przyszłej Strefy 14.
- [ ] Testy integracyjne/RLS na żywej bazie dla ticketów i akceptacji — dziś brak jakichkolwiek testów.
- [ ] **Dokładny scenariusz pilotażu Strefy 11 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu.**

**Pilot gap:**

Główna dodatkowa praca pilotażowa to domknięcie luk już zidentyfikowanych dla pitchu (odrzucenie, relacje domenowe, wyszukiwanie, wymuszanie statusu) w sposób trwały, nie tymczasowy, plus pierwsze pokrycie testami całego modułu (dziś zerowe) i podjęcie świadomej decyzji o powiadomieniach. Nie wymaga to pełnego silnika zwrotów, Customer Care ani SLA — zgodnie z ograniczeniem zakresu tej strefy.

### Notes / evidence

- Autorytatywne drzewo migracji dla Help Desk to wyłącznie `apps/web/supabase/migrations` — brak plików `helpdesk_*` w `apps/web/supabase-target/supabase/migrations`, więc (w przeciwieństwie do innych stref) nie ma tu niejednoznaczności dwóch drzew.
- Schemat `helpdesk_tickets`: `id, org_id, ticket_number, title, description(+rich/plain), status, priority, ticket_type_id, assigned_to(vestigialne, nieużywane), created_by, branch_id, requested_by, closed_by, resolved_at, closed_at, due_at, requires_acceptance, accepted_by, accepted_at, created_at, updated_at, deleted_at`. Jedyna generyczna tabela relacji domenowych, `helpdesk_ticket_references` (`source_module, source_type, source_id, context_snapshot`), istnieje w schemacie z pełnym RLS, ale nie ma żadnego wywołania w `apps/web/src` — martwa infrastruktura.
- Typy ticketów: zasiane systemowo `general_request`, `question`, `task_request` — **brak domyślnego typu „Zwrot"**; typ wpływa na domyślny priorytet, domyślnych odpowiedzialnych/akceptantów i flagę `requires_acceptance`, ale to zachowanie jest realizowane po stronie klienta (`new-ticket-form.tsx`), nie wymuszane przez RPC tworzenia ticketu.
- Tworzenie: `createTicketAction` → `HelpdeskTicketsService.createWithAssignees` → RPC `helpdesk_create_ticket` (atomowy, generuje numer `HD-000001`, wstawia przypisania i akceptantów, loguje `ticket_created`); wymaga tytułu i co najmniej jednego przypisanego użytkownika.
- Przypisanie: model wielo-użytkownikowy przez `helpdesk_ticket_assignees` (rola responder/watcher, status), nie pojedynczy `assigned_to` (kolumna istnieje, ale nieużywana) i nie zespół/dział — nie ma koncepcji zespołu w schemacie.
- Komentarze: generyczny system z Strefy 9 (`CommentsService`/`CommentsThread`, `targetType="helpdesk.ticket"`) — trwałe, z autorem/czasem, RLS ograniczające widoczność do twórcy/przypisanego/managera z uprawnieniem odczytu.
- Historia: `helpdesk_ticket_activity`, tabela tylko-do-wstawiania (bez polityk UPDATE/DELETE), realnie loguje `ticket_created`/`ticket_accepted`/`ticket_closed`/`comment_added`/`attachment_added` — nie loguje zmiany przypisania ani zmiany statusu poza zamknięciem.
- Akceptacja: RPC `helpdesk_accept_ticket` z autoryzacją wymuszoną wewnątrz funkcji (manager LUB wpisany akceptant tego ticketu) — realny, RPC-poziomowy mechanizm obronny, nie tylko RLS. **Brak jakiejkolwiek funkcji/akcji odrzucenia** — potwierdzone brakiem wystąpień „reject"/„rejection" w migracjach i kodzie akcji/serwisu.
- QR: realny UI `AssignQrDialog` na stronie szczegółów ticketu (generowanie, skan istniejącej etykiety, odłączenie); resolver publiczny (`target-registry.ts`, wpis `helpdesk.ticket`) poprawnie rozwiązuje `ticket_number` do trasy `/dashboard/help-desk/tickets/{ticket_number}`, zgodnej z tym, czego faktycznie oczekuje strona szczegółów.
- Statusy: CHECK `('open','in_progress','waiting','waiting_response','resolved','closed','cancelled')` — brak wymuszania przejść; jedyna realna zmiana po utworzeniu to bezwarunkowe zamknięcie (`closeTicketAction`, dostępne dla twórcy lub managera); generyczna metoda `update()` pozwalająca na dowolną zmianę statusu istnieje w serwisie, ale nie jest wywoływana z żadnej akcji — martwa.
- Wyszukiwanie: lista ticketów filtruje `title` przez `.ilike`, nie `ticket_number` — ten sam wzorzec usterki co wyszukiwanie SKU w Strefie 7.
- Powiadomienia: zero implementacji dla ticketów (utworzenie/przypisanie/komentarz/akceptacja nie wyzwalają niczego poza zapisem w bazie) — spójne z ogólnym stanem powiadomień w projekcie (dzwonek z jawnym `TODO: Connect to real notifications system`), zależność od przyszłej Strefy 14.
- Zero testów jakiegokolwiek rodzaju dla realnego zachowania ticketów (tworzenie, komentarze, akceptacja, zamknięcie, QR) — istniejące testy z „helpdesk" w nazwie dotyczą wyłącznie widoczności menu i integracji z kalendarzem, z serwisem ticketów całkowicie zamockowanym.
- Zależności: Strefa 1 (izolacja oddziałowa RLS `helpdesk_tickets`), Strefa 4 (przyszła relacja do zlecenia, jeśli `helpdesk_ticket_references` zostanie podłączone), Strefa 5 (QR ticketu działa, ale nie ma celu QR dla samej części), Strefa 9 (współdzielony system komentarzy/załączników), Strefa 10 (przygotowane konta demo).

### 12. Stan początkowy magazynu i propozycja kontrolowanego pilotażu

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

To strefa biznesowa/operacyjna, nie funkcjonalna — nie ma tu strony, tabeli ani akcji do zaudytowania jako takiej. Materiał skryptu (§8, §16–23) jest dojrzały i wewnętrznie uczciwy: już dziś wprost mówi, że Ambra pierwszego dnia nie zna całego starego magazynu, już dziś jasno rozdziela budżet pilotażu od ceny produktu, już dziś unika wymyślonych procentów sukcesu, już dziś traktuje negatywny wynik pilotażu jako wartościowy, a nie porażkę, i już dziś wprost mówi, że AutoStacja pozostaje źródłem prawdy podczas pilotażu. To nie jest fragmentaryczny szkic. Mimo to status nie może przekroczyć PARTIAL z dwóch niezależnych powodów: (1) sam materiał, choćby najlepszy, nie został tu odnotowany jako świeżo przećwiczony/porównany na głos z ustaleniami Stref 1–11; (2) skonfrontowanie tego materiału z realną implementacją ujawnia konkretną, nieoczywistą lukę — scenariusz „miesiąca 2: realna praca" w §18 milcząco zakłada, że dostawy realnie przechodzą przez Ambrę (przyjęcie, mobilne rozłożenie) i że wydanie działa — a Strefy 6 i 8 ustaliły, że mobilne rozłożenie, zamknięcie przyjęcia i dedykowane wydanie **dziś nie istnieją jako działające funkcje**, tylko jako placeholdery/obejścia. „Naturalna rotacja" ze §8 nie jest więc dziś operacyjnie wykonalna w takiej formie, w jakiej opisuje ją skrypt, dopóki te strefy nie osiągną co najmniej stanu DEMO READY.

**Dowody:**

- Materiał/skrypt: VERIFIED. §8 wprost mówi: „Ambra oczywiście pierwszego dnia nie będzie wiedziała o wszystkich starych zleceniach i częściach" oraz przedstawia dwie alternatywy (naturalna rotacja / wprowadzenie przy porządkowaniu i inwentaryzacji) — obie jawnie odrzucają wielką migrację historyczną pierwszego dnia. §16–17 jasno formułują prośbę o zgodę na 3-miesięczny, ograniczony do jednego oddziału pilotaż, z celem „jaką wartość Ambra daje w rzeczywistej pracy", nie „czy potrafię ją zbudować". §18 opisuje strukturę miesiąc 1 (przygotowanie) → miesiąc 2 (realna praca) → miesiąc 3 (iteracje i ocena). §19 unika wymyślonych liczb, definiuje sukces jakościowo (mniej czynności ręcznych, łatwiejsze/szybsze wybrane procesy, mniej pomyłek, mniejsza zależność od pamięci pracownika, prostota dla innych użytkowników, i kluczowo: pracownicy _wolą_ używać Ambry niż wracać do starego sposobu). §20 jawnie odróżnia budżet pilotażu (~25 tys. zł: sprzęt, infrastruktura/narzędzia, praca poza obecnymi obowiązkami) od ceny gotowego produktu — ale sama treść skryptu wskazuje na osobny „przygotowany podział budżetu" pokazywany na slajdzie, którego dokładnej zawartości nie ma w tym pliku źródłowym. §21–22 jasno mówią, że negatywny/częściowy wynik pilotażu jest wartościowym wynikiem, nie porażką, i że decyzja o dalszym rozwoju zapada dopiero po pilotażu, nie teraz. §10–11 jawnie i wprost stwierdzają, że AutoStacja pozostaje systemem źródłowym dla stanów/dokumentacji podczas pilotażu.
- Implementacja wspierająca: PARTIAL. Realny mechanizm wprowadzenia istniejącego stanu do konkretnej lokalizacji istnieje: typy ruchu `401`/`402` („Korekta z inwentaryzacji — nadwyżka/niedobór", Strefa 8) księgują przez ten sam silnik co przyjęcie/wydanie, z realnym zabezpieczeniem przed błędami po stronie bazy — to technicznie wspiera opcję B skryptu (wprowadzenie przy porządkowaniu/inwentaryzacji). Istnieje też osobny, nieużywany dziś przez UI tryb `movement_kind: 'opening_balance'` w silniku księgowania (Strefa 6/8) — dodatkowy, potencjalny, ale dziś niepodłączony do żadnego ekranu mechanizm otwarcia salda. Opcja A (naturalna rotacja) zależy strukturalnie od tego, żeby nowe dostawy realnie przechodziły przez Ambrę od przyjęcia po rozłożenie — a Strefa 6 ustaliła, że mobilne rozłożenie i zamknięcie przyjęcia dziś nie istnieją (placeholdery), więc „naturalna rotacja" w praktyce dziś zatrzymuje się na etapie zaimportowanej, ale nieprzełożonej na fizyczne miejsce, dostawy. Żaden mechanizm programowy nie chroni dziś przed podwójnym wprowadzeniem tej samej pozycji legacy — to musi być regułą proceduralną, nie funkcją.
- Weryfikacja ręczna: NOT VERIFIED — materiał nie został odczytany na głos ani porównany punkt po punkcie z ustaleniami Stref 1–11 w tej sesji ani w żadnej odnotowanej wcześniejszej.
- Gotowość operacyjna: NOT VERIFIED — brak potwierdzenia, że oddział/użytkownicy/urządzenia/zgoda na dane są już uzgodnione; brak spisanej reguły antyduplikacyjnej; brak nazwanej osoby odpowiedzialnej za pilotaż w samym materiale (domyślnie prezenter, ale nie zapisane wprost); brak warunków zatrzymania pilotażu.

**Wymagany stan dla pitchu:** DEMO READY dla materiału i propozycji

### Pitch readiness checklist

**Stan początkowy**

- [ ] Prezenter wprost mówi na głos (nie tylko w slajdzie), że Ambra pierwszego dnia nie zna całego starego magazynu.
- [ ] Wybrano do rozmowy jedną lub obie strategie ze skryptu (naturalna rotacja / wprowadzenie przy porządkowaniu i inwentaryzacji) i przygotowano krótkie, konkretne sformułowanie każdej.
- [ ] Spisano prostą regułę proceduralną unikania podwójnego wprowadzenia tej samej pozycji legacy (kto może wprowadzać, jak oznaczyć „już wprowadzone") — dziś nic w oprogramowaniu tego nie pilnuje, więc musi to być jawna zasada organizacyjna, nie założenie.
- [ ] Prezenter jest świadomy (nawet jeśli nie mówi tego wprost na pitchu), że scenariusz „naturalnej rotacji" z §8 zakłada działające mobilne przyjęcie/rozłożenie ze Strefy 6, które dziś nie istnieje jako funkcja — przygotowano spójne, uczciwe sformułowanie tego w kontekście miesiąca 1 pilotażu („dokończenie wybranych procesów do realnego użycia" z §18 musi realnie obejmować dokończenie tych elementów, nie tylko konfigurację środowiska).

**Zakres pilotażu**

- [ ] Materiał jasno określa: jeden oddział, ograniczona liczba użytkowników, konkretne, wybrane procesy — nie cała firma, nie wszystkie procesy.
- [ ] Materiał nie sugeruje zastąpienia AutoStacji ani automatycznej synchronizacji.

**Trzy miesiące**

- [ ] Struktura miesiąc 1 (przygotowanie) → miesiąc 2 (realna praca) → miesiąc 3 (iteracje i ocena) jest gotowa do krótkiego przedstawienia zgodnie z §18.
- [ ] Zakres miesiąca 1 uwzględnia realistycznie to, co Strefy 1–11 pokazały jako brakujące w wybranych do pilotażu procesach (nie tylko „środowisko produkcyjne i backupy") — inaczej harmonogram miesiąca 1 jest niedoszacowany.
- [ ] Nazwano (choćby nieformalnie) osobę odpowiedzialną operacyjnie za pilotaż i punkt kontaktowy dla użytkowników przy problemach.

**Budżet**

- [ ] Kwota ~25 tys. zł jest przedstawiona wprost jako budżet pilotażu, nie cena Ambry — zgodnie z jawnym rozróżnieniem już obecnym w §20 skryptu.
- [ ] Przygotowano rzeczywisty, prosty podział budżetu (sprzęt / infrastruktura i narzędzia / praca poza obecnymi obowiązkami) na slajdzie — skrypt odsyła do „przygotowanej wersji" podziału, której samej treści nie ma w pliku źródłowym skryptu, więc trzeba potwierdzić, że faktycznie istnieje i jest gotowa.
- [ ] Brak sztucznej precyzji (np. rozbicia co do złotówki) tam, gdzie skrypt jej nie zakłada.

**Sukces i porażka**

- [ ] Kryteria sukcesu ze §19 (mniej czynności ręcznych, szybsze/łatwiejsze wybrane procesy, mniej pomyłek, mniejsza zależność od pamięci pracownika, prostota, preferencja pracowników wobec starego sposobu) są gotowe do przedstawienia bez wymyślonych liczb.
- [ ] Wypowiedź jasno mówi, że niepotwierdzenie założeń to nadal wartościowy wynik (§21), nie porażka całego projektu.
- [ ] Wypowiedź jasno mówi, że decyzja o dalszym rozwoju zapada dopiero po pilotażu, na podstawie dowodów (§22), nie jest przesądzona dziś.

**Brama końcowa**

- [ ] **Dokładna sekcja pitchu Strefy 12 przećwiczona/przejrzana na głos na aktualnym materiale, w konfrontacji ze Strefami 1–11:** wyjaśnienie stanu początkowego → ograniczony do jednego oddziału/liczby użytkowników pilotaż → struktura trzech miesięcy → prośba o wsparcie ~25 tys. zł → kryteria sukcesu/porażki → AutoStacja jako źródło prawdy → jasna prośba o zgodę/wsparcie → żadne zdanie nie sugeruje, że Ambra jest już gotowym produktem produkcyjnym ani że cały stary magazyn/procesy zostaną zmigrowane przed pilotażem.

**Pitch gap:**

Materiał źródłowy jest mocny i uczciwy — to nie jest strefa wymagająca przepisania skryptu. Realny gap to: (1) brak świeżej próby wygłoszenia/skonfrontowania tej sekcji z resztą audytu; (2) ciche założenie w §18 (miesiąc 2: „realna praca"), że przyjęcie/rozłożenie i wydanie już działają — podczas gdy Strefy 6 i 8 ustaliły, że kluczowe elementy tych procesów są dziś placeholderami; to nie unieważnia propozycji pilotażu (przygotowanie w miesiącu 1 może i powinno obejmować ich dokończenie), ale wymaga uczciwego, jawnego uwzględnienia tego w zakresie miesiąca 1, żeby nie obiecać zarządowi gotowości, której nie ma; (3) brak spisanej reguły antyduplikacyjnej dla wprowadzania zaległego stanu — dziś to czysto proceduralne, nieoprogramowane; (4) brak potwierdzenia, że osobny „przygotowany podział budżetu" (do którego odsyła skrypt) faktycznie istnieje jako gotowy materiał.

**Wymagany stan dla pilotażu:** PILOT READY operacyjnie

### Pilot readiness checklist

- [ ] Oddział pilotażowy wybrany i formalnie zatwierdzony przez firmę.
- [ ] Użytkownicy/role pilotażu wybrani i poinformowani, z minimalnym wprowadzeniem: co jest autorytatywne w Ambrze, co nadal trzeba robić w AutoStacji, jak zgłaszać problemy.
- [ ] Formalna zgoda firmy na wykorzystanie rzeczywistych danych/procesów w pilotażu — odesłanie do globalnej bramki „CONTROLLED PILOT" w tym dokumencie, nie duplikowanie jej tutaj.
- [ ] Nazwana osoba odpowiedzialna operacyjnie za pilotaż oraz punkt kontaktowy przy awarii/problemie.
- [ ] Spisana procedura uzgadniania z AutoStacją (co robić, gdy stany się rozjadą) — zależność już odnotowana w Strefie 8, tu potwierdzona jako wymóg organizacyjny przed startem pilotażu.
- [ ] Spisana, uzgodniona procedura wprowadzania stanu początkowego (kto, kiedy, jak oznaczyć „już wprowadzone", jak uniknąć duplikatu) — nie tylko koncepcja ze slajdu.
- [ ] Sprzęt/urządzenia gotowe: telefon(y) do skanowania, drukarka etykiet, etykiety, stanowisko komputerowe — zakres wynika z faktycznie testowanych procesów, nie z góry ustalonej listy zakupów.
- [ ] Środowisko (produkcja/staging, backupy, monitoring) gotowe — odesłanie do globalnej bramki „CONTROLLED PILOT", nie duplikowanie.
- [ ] Prosty plan pomiaru uzgodniony (znaczniki czasu tam, gdzie system je ma, ręczna obserwacja/próbkowanie czasu, log problemów/błędów, cykliczne zbieranie opinii) — bez rozbudowanej analityki.
- [ ] Ustalona częstotliwość przeglądu postępu pilotażu (np. cotygodniowa).
- [ ] Log incydentów/problemów pilotażu prowadzony w jednym uzgodnionym miejscu.
- [ ] Warunki zatrzymania pilotażu jawnie spisane (np. problem izolacji danych, niespójności stanu magazynowego, powtarzające się fałszywe sukcesy operacji, nieakceptowalna podwójna praca, niestabilność krytycznego procesu, utrata/uszkodzenie danych) — dziś nieobecne w materiale.
- [ ] Format i termin spotkania podsumowującego pilotaż oraz osoba decydująca o dalszych krokach ustalone z wyprzedzeniem.
- [ ] Wszystkie procesy faktycznie objęte pilotażem osiągnęły co najmniej DEMO READY (a najlepiej PILOT READY) w odpowiednich strefach tego dokumentu przed realnym uruchomieniem z danymi firmowymi — nie tylko przed samym pitchem.
- [ ] **Dokładny scenariusz pilotażu Strefy 12 zweryfikowany operacyjnie**: wszystkie powyższe punkty potwierdzone jako uzgodnione i gotowe, nie tylko zaplanowane.

**Pilot gap:**

Główna praca przed realnym pilotażem to nie technologia tej konkretnej strefy, tylko organizacja: spisanie reguł, które dziś istnieją wyłącznie jako dobre intencje (antyduplikacja, warunki zatrzymania, uzgadnianie z AutoStacją, odpowiedzialność), oraz — co ważniejsze — upewnienie się, że procesy faktycznie objęte pilotażem (przyjęcie/rozłożenie ze Strefy 6, wydanie ze Strefy 8, ewentualnie zlecenia ze Strefy 4) same osiągnęły wymagany poziom gotowości, zanim miesiąc 2 pilotażu („realna praca") będzie mógł się wydarzyć zgodnie z opisem w skrypcie.

### Notes / evidence

- Skrypt §8: „Ambra oczywiście pierwszego dnia nie będzie wiedziała o wszystkich starych zleceniach i częściach" + dwie strategie (naturalna rotacja / porządkowanie i inwentaryzacja) — jawnie odrzuca migrację historyczną.
- Skrypt §16–17: prośba o 3-miesięczny, ograniczony do jednego oddziału pilotaż; cel to sprawdzenie wartości w realnej pracy, nie dowód wykonalności technicznej.
- Skrypt §18: struktura miesiąc 1 (przygotowanie: środowisko produkcyjne, infrastruktura, backupy, monitoring, dopracowanie bezpieczeństwa i uprawnień, przygotowanie użytkowników/lokalizacji/etykiet/danych, dokończenie wybranych procesów) → miesiąc 2 (realna praca: prawdziwe dostawy/części/lokalizacje, inni użytkownicy, stopniowe uruchamianie, feedback) → miesiąc 3 (iteracje i ocena).
- Skrypt §19: kryteria sukcesu jakościowe, bez wymyślonych procentów — kluczowe: „przy konkretnych procesach pracownicy wolą używać Ambry niż wrócić do starego sposobu".
- Skrypt §20: budżet ~25 tys. zł jawnie odróżniony od ceny produktu; podział (sprzęt, infrastruktura/narzędzia, praca) ma być pokazany „zgodnie z przygotowaną wersją" — sama zawartość tego podziału nie jest częścią pliku źródłowego skryptu, wymaga potwierdzenia jako osobny, gotowy materiał.
- Skrypt §21–22: negatywny/częściowy wynik pilotażu to wartościowy wynik, nie porażka; decyzja o dalszym rozwoju zapada po pilotażu na podstawie dowodów, nie jest przesądzona.
- Skrypt §10–11: AutoStacja jawnie pozostaje systemem źródłowym dla stanów/dokumentacji podczas pilotażu — ta granica jest już dziś jasno wypowiedziana w materiale, nie wymaga dodania.
- Zależność krzyżowa ze Strefą 6: mobilne rozłożenie i zamknięcie przyjęcia to dziś potwierdzone placeholdery (`/warehouse/deliveries`, `/warehouse/scanning/delivery`) — „naturalna rotacja" ze §8 zakłada działający proces przyjęcia, którego dziś brakuje w części mobilnej.
- Zależność krzyżowa ze Strefą 8: dedykowane „wydanie" to dziś zaślepka zwracająca zaszyty błąd; jedyny działający substytut (ruch typu 402) nie ma pola odbiorcy — istotne dla „potwierdzenia wydania" wspomnianego w §10–11 skryptu jako elementu wartości testowanego w pilotażu.
- Zależność krzyżowa ze Strefą 4: jeśli pilotaż ma testować wartość lokalizacji/wyszukiwania w kontekście zlecenia naprawczego (część wartości opisanej w §17), zależy to od nieistniejącego dziś modelu zlecenia — do uwzględnienia przy ustalaniu dokładnego zakresu procesów testowanych w pilotażu, nie jako blokada samego pitchu.
- Mechanizm wprowadzenia stanu początkowego: realnie istnieje przez typy ruchu 401/402 (Strefa 8) oraz nieużywany dziś przez UI tryb `movement_kind: 'opening_balance'` w silniku księgowania (Strefa 6/8) — technicznie wspiera opcję B skryptu, ale bez żadnej wbudowanej ochrony przed podwójnym wprowadzeniem tej samej pozycji.
- Globalna bramka „CONTROLLED PILOT" w tym dokumencie (sekcja „Globalne bramki") pokrywa techniczne/bezpieczeństwowe wymagania pilotażu (RLS, backupy, monitoring, testy E2E) — nie duplikowana tutaj, tylko odnotowana jako punkt odniesienia dla wymagań operacyjnych tej strefy.

## P2 — wystarczy część działającego obszaru

### 13. Zadania jednorazowe, kalendarz i Kanban

**Priorytet:** P2

**Stan obecny:** 🟡 PARTIAL

To realna, nietrywialna funkcjonalność — nie makieta. Zadania jednorazowe mają pełne CRUD z dziennikiem aktywności, kalendarz to prawdziwy, zapytaniowy agregator (zadania, karty Kanban i tickety pojawiają się na nim automatycznie, nie przez ręczny krok „dodaj do kalendarza"), a przeciąganie kart Kanban trwale zapisuje nową kolejność/kolumnę w bazie, nie tylko w stanie klienta. Uprawnienia są wymuszane po stronie serwera i przez RLS z `FORCE`. Status pozostaje PARTIAL (zgodnie z zastanym oczekiwaniem P2 — nie wymaga to podniesienia priorytetu), bo: (a) brak świeżej ręcznej próby na aktualnym build; (b) karta Kanban jest odrębnym bytem od zadania (potwierdzone brakiem jakiejkolwiek relacji FK) — prezenter musi to wiedzieć, żeby nie sugerować integracji, której nie ma; (c) panel załączników (`AttachmentsPanel`) nie jest dziś w ogóle renderowany w UI Planowania — `planning.task`/`planning.kanban_card` są zarejestrowane jako cele załączników na poziomie danych, ale bez żadnego konsumenta UI (w przeciwieństwie do komentarzy, które są w pełni podłączone).

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny CRUD zadania (`createTaskAction`/`updateTaskAction`/`changeTaskStatusAction`/`assignTaskAction` → `PlanningTasksService` → realne zapisy do `planning_tasks` + `planning_task_activity`), agregator kalendarza (`PlanningCalendarService.getCalendarData` — odkrywa źródła wg uprawnień/entitlementów: zadania, tickety, każda widoczna tablica Kanban, natywne kalendarze — i mapuje je do wspólnego DTO), oraz Kanban (`planning_kanban_boards/columns/cards`, `KanbanBoardsService.moveCard` — realne przeliczenie i zapis `position`/`column_id` dla każdej dotkniętej karty). Potwierdzono: pojedynczy przypisany użytkownik (nie wiele osób), karta Kanban nie ma żadnej kolumny odwołującej się do zadania — to w pełni odrębny prymityw, nie to samo co zadanie i nie zsynchronizowane z nim. Komentarze (`CommentsThread`) są realnie renderowane zarówno w szczegółach zadania, jak i karty Kanban. Załączniki — mimo że `planning.task`/`planning.kanban_card` są zarejestrowane jako obsługiwane cele na poziomie serwisu — nie mają dziś żadnego wywołania `AttachmentsPanel` w UI Planowania (tylko w Help Desk).
- Testy automatyczne: PARTIAL. Solidne testy jednostkowe na zamockowanym kliencie dla serwisu zadań (tworzenie, zmiana statusu, przypisanie, usunięcie) i agregatora kalendarza (odkrywanie źródeł wg uprawnień, mapowanie DTO). Zero testów dla serwisu Kanban (`kanban-boards.service.ts` nie ma pliku testowego) — przeciąganie/zapis kolejności kart jest dziś całkowicie nieprzetestowane na żadnym poziomie. Zero testów renderujących kalendarz/tablicę na realnych danych.
- Weryfikacja ręczna: NOT VERIFIED — brak odnotowanej świeżej próby.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: utworzenie zadania → widoczność na liście/kalendarzu → (opcjonalnie) karta na tablicy Kanban → trwałość po odświeżeniu.

**Wymagany stan dla pitchu:** PARTIALLY READY

### Pitch readiness checklist

- [ ] Wybrano najwyżej jeden mały, zapisany przykład (jedno zadanie, ewentualnie widoczne też na kalendarzu lub tablicy) — pokaz nie rozszerza głównego demo P0/P1.
- [ ] Jeśli przykład jest pokazywany na żywo: utworzenie/edycja/zakończenie jednego zadania jednorazowego sprawdzone na aktualnym build, z trwałością po odświeżeniu.
- [ ] Jeśli pokazywany jest kalendarz lub Kanban: wybrany widok jest stabilny; sprawdzone, że pokazane dane są rzeczywiście zapisane, nie przypadkowe/testowe śmieci.
- [ ] Wypowiedź jasno rozróżnia zadania i karty Kanban jako **osobne narzędzia organizacji pracy**, nie sugeruje, że karta Kanban to to samo zadanie lub że są zsynchronizowane.
- [ ] Wypowiedź nie wspomina o cykliczności zadań ani o dostarczaniu powiadomień — to nie istnieje i należy do przyszłej Strefy 14.
- [ ] Jeśli ekran okazuje się niestabilny podczas przygotowań: zamiana na samą wzmiankę słowną, bez pokazu na żywo — brak demo tej strefy nie blokuje głównego pitchu.

**Pitch gap:**

Brak istotnej luki funkcjonalnej blokującej krótką wzmiankę lub mały pokaz — to działający kod, nie fasada. Jedyne realne ryzyko to nadinterpretacja podczas prezentacji: sugerowanie integracji zadanie↔karta Kanban, której nie ma, albo cykliczności/powiadomień, których nie ma. Poza tym brakuje wyłącznie świeżej ręcznej próby wybranego przykładu.

**Wymagany stan dla pilotażu:** dotyczy wyłącznie, jeśli Planowanie zostanie świadomie włączone do zakresu pilotażu — patrz Strefa 12

### Pilot readiness checklist

Poniższe wymagania są istotne tylko wtedy, gdy pilotaż faktycznie obejmie operacyjne użycie zadań/kalendarza/Kanban (co dziś nie jest ustalone — Strefa 12 nie wymienia Planowania w zakresie pilotażu). Jeśli Planowanie nie wejdzie do zakresu pilotażu, poniższe punkty są N/A, nie blokerami.

- [ ] Testy dla serwisu Kanban (dziś całkowicie nieobecne) — w szczególności poprawność przeliczania kolejności kart przy współbieżnej edycji.
- [ ] Jawna decyzja o zakresie oddziałowym: `planning_tasks.branch_id` to dziś tylko opcjonalny tag filtrowania, nie wymuszona granica RLS; tablice Kanban nie mają w ogóle koncepcji oddziału (są całkowicie organizacyjne) — do zaakceptowania świadomie albo do utwardzenia przed realnym użyciem wieloddziałowym.
- [ ] Podłączenie `AttachmentsPanel` do UI zadań/kart Kanban, jeśli pilotaż ma z załączników korzystać — dziś zarejestrowane na poziomie danych, ale bez konsumenta UI.
- [ ] Zachowanie przypisania zadania po usunięciu/dezaktywacji przypisanego użytkownika.
- [ ] Ślad audytowy zmian statusu/przypisania dla ról administracyjnych (częściowo już istnieje przez `planning_task_activity`/`planning_kanban_card_activity` — do potwierdzenia jako wystarczający operacyjnie).
- [ ] Realistyczny test wieloużytkownikowej pracy na tej samej tablicy Kanban.
- [ ] **Dokładny scenariusz pilotażu Strefy 13 zweryfikowany ręcznie**, wyłącznie jeśli Planowanie wejdzie do zakresu pilotażu.

**Pilot gap:**

Nie dotyczy, dopóki Strefa 12 nie potwierdzi, że Planowanie jest częścią zakresu pilotażu. Jeśli zostanie włączone, głównym brakiem jest testowanie Kanban (dziś zerowe) i decyzja o twardości granicy oddziałowej.

### Notes / evidence

- Schemat `planning_tasks`: `id, organization_id, branch_id(opcjonalny), title, description(+rich), status(open/in_progress/completed/cancelled), priority, assigned_to(pojedynczy), created_by/updated_by, completed_at/started_at/cancelled_at/due_at, task_number, pola kalendarzowe (due_date, calendar_all_day/start/end/timezone)` — brak kolumn cykliczności, brak kolumny labels/tags (etykiety statusu/priorytetu to konfiguracja per-organizacja w `planning_settings`, nie pole zadania).
- CRUD zadania: `createTaskAction`/`updateTaskAction`/`changeTaskStatusAction`/`assignTaskAction` (`apps/web/src/app/actions/planning/index.ts`) → `PlanningTasksService` (`planning-tasks.service.ts`) — realne zapisy, potwierdzone testami sprawdzającymi dokładny kształt wywołań Supabase.
- Kalendarz: `PlanningCalendarService.getCalendarData` (`planning-calendar.service.ts:121-437`) — realny agregator odkrywający źródła (zadania/tickety/każda widoczna tablica Kanban/natywne kalendarze) wg uprawnień i entitlementów, mapujący je do wspólnego DTO; zadanie trafia na kalendarz automatycznie przez obecność pól `due_date`/`calendar_*`, nie przez ręczny krok.
- Kanban: `planning_kanban_boards/columns/cards` (`20260605130000_planning_kanban_boards.sql`) — realne tabele, `FORCE ROW LEVEL SECURITY`; przeciąganie karty (`moveCard` w `planning-boards-client.tsx` → `moveKanbanCardAction` → `KanbanBoardsService.moveCard`) realnie przelicza i zapisuje `position`/`column_id` dla każdej dotkniętej karty, z wycofaniem stanu klienta przy błędzie.
- Karta Kanban nie ma żadnej kolumny/FK odwołującej się do zadania — potwierdzone przeszukaniem wszystkich migracji Kanban; to w pełni odrębny prymityw, nie to samo zadanie ani nie zsynchronizowane.
- Komentarze są realnie podłączone w UI (zadanie i karta Kanban); załączniki są zarejestrowane jako obsługiwany cel na poziomie serwisu, ale `AttachmentsPanel` nie jest dziś wywoływany nigdzie w UI Planowania (tylko w Help Desk) — korekta wcześniejszego ustalenia „komentarze/załączniki podłączone", trafna tylko dla komentarzy.
- Uprawnienia wymuszane po stronie serwera (`checkPermission` w akcjach) i przez RLS z `FORCE` na `planning_tasks`/`planning_kanban_*`, z bezpośrednimi wywołaniami `has_permission(...)` w politykach.
- Cykliczność: brak jakichkolwiek kolumn/pól/generatora w tym module — potwierdzone, poza zakresem tej strefy (Strefa 14).
- Zero testów dla serwisu Kanban; solidne testy jednostkowe (zamockowane) dla serwisu zadań i agregatora kalendarza; zero testów renderujących realny widok kalendarza/tablicy.

## P3 — wzmianka / roadmapa, bez prac przed pitchem

### 14. Zadania cykliczne i powiadomienia operacyjne

**Cel: ROADMAP ONLY. Skrypt: §14. Dowód: A11.** Nie znaleziono generatora cyklicznych wystąpień w badanej ścieżce. Ustawienia powiadomień zapisują preferencje; dzwonek ma TODO podłączenia systemu. To nie dowód dostarczania alertów.

Zachowany backlog: reguły dzienne/tygodniowe/miesięczne, zakres dat, domyślny wykonawca, generowanie/statusy wystąpień, historia serii, edycja serii/jednego terminu, pomijanie, powiązanie z audytem/ticketem, przypomnienia i testy cykliczności. Osobno trwały inbox, odbiorcy, dostarczenie i odczyt powiadomień.

### 15. Materiały, dostawcy, audyty, propozycje zamówień

**Cel: ROADMAP ONLY na potrzeby pitchu. Skrypt: §15. Dowód: A12.** Katalog, CRM/dostawcy pozycji, liczenia, różnice i sugestie uzupełnienia mają rzeczywiste elementy implementacji. Strona Warehouse „Dostawcy” jest placeholderem. Nie domykać całości przed spotkaniem.

Zachowany backlog: katalog/import materiałów, dostawcy/lokalizacje/kody, minimum/cel/punkt zamówienia, masowa konfiguracja, liczenie po lokalizacji/dostawcy, telefon/skan, różnice/notatki/akceptacja, historia, listy zamówień per dostawca, akceptacja/odrzucenie sugestii i E2E. Sugestia nie jest złożonym zamówieniem. Cykliczne audyty zależą od 14.

### 16. VMI i dalsze możliwości

**Cel: ROADMAP ONLY. Skrypt: §15, §22. Dowód: A13.** Nie potwierdzono dostępnego end-to-end VMI w web; tabele/stare deklaracje nie wystarczają.

Zachowany backlog: wiarygodne katalogi, dostawcy, lokalizacje, progi i audyty; potem zakres MVP VMI, prawdziwy backend, konta klientów/dostawców, trwała komunikacja/zamówienia/historia, połączenie z Warehouse, izolacja i E2E bez fixtures. Nie odhaczać przed pitchem.

## P4 — odłożyć

### 17. Pełne importy AutoStacji i integracja DMS

**Cel: ROADMAP ONLY.** Wąski import Matchera pozostaje w 3, raport w 6, wydanie w 8. Odłożyć import wszystkich starych zleceń/zamówień, materiałów, nierotów/inwentaryzacji oraz automatyczną synchronizację DMS.

Zachowane wymagania na wybrany później zakres: podgląd/walidacja, duplikaty, brak częściowych zapisów, historia, poprawienie/cofnięcie, testy i minimalizacja podwójnej pracy. „Proces nie wymaga podwójnej pracy” nie jest warunkiem pitchu: skrypt zakłada dodatkowe potwierdzenie wydania.

### 18. Awaryjne wydania, pełne zwroty i Customer Care VGP

**Cel: ROADMAP ONLY.** Awaryjne pobranie bez działu części nie występuje w głównej narracji. Zwrot/reklamacja to przykłady ticketu, nie obowiązek wdrożenia specjalistycznych procesów.

Zachowany backlog: uprawnienia awaryjne, odbiorca/czas/potwierdzenie, częściowe/wielokrotne wydania i pełny raport archiwum; wartość/rotacja/miejsce oczekiwania zwrotu, akceptacja/odrzucenie/komentarz i raport; numer/link Customer Care, terminy kontroli/odesłania, alarmy, prowadzący, statusy i dowody reklamacji. Uruchomiony proces wymaga trwałej historii i E2E przed realnym użyciem.

### 19. Lakiery, nieroty, procedury, zbiorczy dashboard

**Cel: ROADMAP ONLY. Brak wymogu pokazu. Dowód: A13.** Dashboard startowy to ekran powitalny, nie centrum operacyjne.

Zachowany backlog:

- Lakiery: import, lokalizacje/progi, cotygodniowa kontrola, miesięczna inwentaryzacja, raport/różnice/sugestie, historia i kalendarz z wykonawcą.
- Nieroty: walidowany import, dni/wartość/lokalizacja, status/prowadzący, rotacja innych oddziałów, kontakty/follow-up, raport efektów i wiele oddziałów.
- Procedury: instrukcje, role/checklisty/załączniki, wersje, potwierdzenie zapoznania, linki z ticketów/zadań, wyszukiwanie, kopiowanie, szkolenie i ograniczenie edycji.
- Dashboard: osobisty/zespołowy zakres oddziału, tickety/akceptacje/terminy/zadania, dostawy/braki lokalizacji/niekompletne zlecenia, materiały/audyty/nieroty, działające odnośniki i odświeżanie. Nie tworzyć go dla katalogu funkcji.

Przed wdrożeniem któregokolwiek: realne dane, uprawnienia, historia i odpowiednie testy. Nie są bramką pitchu.

## Globalne bramki — trzy różne decyzje

### A. PITCH SAFETY — przed pokazem (P0)

- [ ] Build, osobny type-check i lint web oraz używanych zależności przechodzą; nie wymagać innych aplikacji. Build ma `ignoreBuildErrors`, więc nie zastępuje type-checku.
- [ ] Wybrane testy kodu/integracji głównej ścieżki przechodzą, wynik zapisany. W audycie próba Vitest zakończyła się brakiem narzędzia, nie wynikiem testów.
- [ ] Demo ma trwałe, zanonimizowane dane na rzeczywistym backendzie, jawny oddział i role. Symulacja, fixture/nagranie nie udają operacji na żywo.
- [ ] Sprawdzono dostęp, izolację, uploady i ponawianie krytycznych zapisów z 1–9; pokaz nie wymaga ingerencji w bazę.
- [ ] Trasa demo nie ma martwych przycisków, nieobsłużonych błędów, placeholderów/niespójnych stanów; mobilny układ, HTTPS/kamera, wydruki i sieć sprawdzone na docelowych urządzeniach.
- [ ] Jest bezpieczna kopia danych demo/procedura ponownego przygotowania, plan awarii internetu i zapasowe nagranie/zrzuty rzeczywiście wykonanego procesu.
- [ ] Pełną próbę wykonano w kolejności skryptu bez dygresji; poprawiono blokery i porównano wypowiadane obietnice z pokazem.

### B. CONTROLLED PILOT — przed danymi firmowymi (nie warunek spotkania)

- [ ] Zgoda firmy, jeden oddział, odpowiedzialność, użytkownicy i procedura wsparcia ustalone.
- [ ] Produkcja/staging, chronione preview, inwentaryzacja migracji i odtworzenie wybranego schematu na czystej bazie sprawdzone.
- [ ] Macierz dostępu i rzeczywiste testy RLS uruchamianych procesów obejmują organizacje, oddziały, Storage/RPC; zweryfikowano FORCE RLS i uprawnienia uprzywilejowanych funkcji.
- [ ] Krytyczne operacje są transakcyjne/idempotentne, przetestowane przy kilku użytkownikach; historia nie znika przy błędzie pośrednim.
- [ ] Backup bazy i plików działa, odtworzenie przetestowane; procedura rollbacku/odtworzenia gotowa.
- [ ] Monitoring błędów (np. Sentry), uptime i alerty mają odbiorcę; brak sekretów w repo/kliencie zweryfikowany.
- [ ] Retencja/dostęp do podpisanych dokumentów, walidacja plików, usuwanie/eksport danych i audit log ustalone.
- [ ] E2E uruchamianych procesów, realistyczne dane i próby mobilne sprawdzone; stary magazyn nie dubluje nowych dostaw.
- [ ] AutoStacja pozostaje źródłem stanów/dokumentacji; mierzymy dodatkową pracę i korzyści, znamy warunki przerwania pilota.

### C. DALSZA PRODUKCJA — po wyborze zakresu na podstawie pilotażu

- [ ] Obserwowalność, wydajność, obciążenie, alerty i odtwarzanie odpowiadają docelowej skali.
- [ ] Analityka produktu (np. PostHog) służy miernikom; jej kompletność nie blokuje pokazu.
- [ ] Testy/hardening rozszerzono na nowe moduły, organizacje i oddziały; wykonano okresowe próby backupu/rollbacku.
- [ ] Roadmapę 14–19 uporządkowano na podstawie wyników, nie automatycznie jako obowiązkowy MVP.

## Decyzja o gotowości

- [ ] **Gotowy do pitchu:** finalne bramki ręcznej weryfikacji (checkbox „Dokładny scenariusz pitchu Strefy N zweryfikowany...") stref 1–9 + Pitch Safety; P1 (10–12) pokazane w sprawdzonym zakresie lub jawnie zawężone, P2–P4 opisane uczciwie. Obecnie **niepotwierdzone / blokery otwarte** — patrz Strefy 4, 6, 8 jako najgłębsze braki implementacyjne.
- [ ] **Gotowy do kontrolowanego pilotażu:** osobno spełniona bramka B. Gotowy pokaz nie oznacza tej zgody.
- [ ] **Gotowy do rozszerzania produkcji:** wyniki pilotażu i bramka C dla uzgodnionego zakresu. Nie wymaga się ukończenia wszystkich 19 obecnych obszarów przed prezentacją.
