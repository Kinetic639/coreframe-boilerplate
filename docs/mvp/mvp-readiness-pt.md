# Ambra — gotowość do prezentacji i kontrolowanego pilotażu

Audyt repozytorium: **7 września 2026**. Produkt: **wyłącznie `apps/web`**. Źródło zakresu: [skrypt prezentacji](ambra-skrypt-prezentacji.md). Dowody i ograniczenia: [audyt implementacji](mvp-readiness-audit.md).

**Pełny scenariusz ze skryptu nie jest jeszcze gotowy.** Istnieją rzeczywiste fundamenty, zapis sesji Matchera i operacje magazynowe, ale nie ma potwierdzonego ciągłego procesu sesja → mobilne rozłożenie → zlecenie/lokalizacja → wydanie → podpisany dokument. Najpierw domknąć tę ścieżkę; nie kończyć całej Ambry.

## Priorytety — od czego zacząć

Stan wymagany to **cel przed prezentacją**, nie ocena obecnej implementacji. Numery wskazują sekcje poniżej, nie dawne identyfikatory checklisty.

| Priorytet | Obszar                                                                     | Wymagany stan                     | Dlaczego ma znaczenie                                                     |
| --------- | -------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| P0        | 1. Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo | FULLY READY w zakresie demo       | Każdy następny krok zależy od właściwego dostępu i danych                 |
| P0        | 2. Publiczny Matcher                                                       | DEMO READY                        | Pierwszy pokaz na tych samych dokumentach; zależność zewnętrzna wobec web |
| P0        | 3. Matcher zalogowany, trwałość sesji i przekazanie do przyjęcia           | DEMO READY                        | Przejście od narzędzia do procesu                                         |
| P0        | 4. Minimalny katalog części i widok zlecenia                               | DEMO READY                        | Tożsamość części i zleceń spina przyjęcie, szukanie i wydanie             |
| P0        | 5. Lokalizacje, QR i etykiety części/zestawów                              | DEMO READY                        | Warunek fizycznego pokazu na telefonie                                    |
| P0        | 6. Przyjęcie, mobilne rozłożenie, zamknięcie i raport                      | DEMO READY                        | Centralna demonstracja w §7 skryptu                                       |
| P0        | 7. Szukanie, zawartość lokalizacji, ruch części/zestawu, historia          | DEMO READY                        | Obiecana codzienna praca w §9                                             |
| P0        | 8. Zwykłe wydanie części                                                   | DEMO READY                        | Domknięcie cyklu części, §10–11                                           |
| P0        | 9. Zdjęcie podpisanego wydania i ponowne otwarcie                          | DEMO READY                        | Konkretna wartość dodatkowego potwierdzenia                               |
| P1        | 10. Użytkownicy, zaproszenia, członkostwa, administracja rolami            | DEMO READY                        | Wiarygodne, krótkie wyjaśnienie fundamentów w §5                          |
| P1        | 11. Tickety: komunikacja, prosta akceptacja, problemowa część z QR         | DEMO READY                        | Drugi, krótki pokaz w §12–13                                              |
| P1        | 12. Początkowy magazyn i propozycja pilotażu                               | DEMO READY (materiał i procedura) | Ograniczenia i decyzja biznesowa w §8, §16–23                             |
| P2        | 13. Zadania jednorazowe, kalendarz i Kanban                                | PARTIALLY READY                   | §14 zapowiada kierunek, bez kolejnego dużego demo                         |
| P3        | 14. Cykliczność i powiadomienia operacyjne                                 | ROADMAP ONLY                      | Zapowiedź, nie obietnica działającej automatyzacji                        |
| P3        | 15. Materiały, dostawcy, audyty i wsparcie zamawiania                      | ROADMAP ONLY                      | Są elementy backendu; §15 nie wymaga ich ukończenia                       |
| P3        | 16. VMI i dalsze procesy magazynowe                                        | ROADMAP ONLY                      | Kierunek po wynikach pilotażu                                             |
| P4        | 17. Szerokie importy historyczne i integracja DMS                          | ROADMAP ONLY                      | Skrypt dopuszcza naturalną rotację; DMS pozostaje źródłem                 |
| P4        | 18. Awaryjne pobrania i rozbudowane procesy zwrotów/reklamacji             | ROADMAP ONLY                      | Wykraczają poza zwykłe wydanie i jeden ticket                             |
| P4        | 19. Lakiery, nieroty, procedury i zbiorczy dashboard operacyjny            | ROADMAP ONLY                      | Brak wymogu w aktualnym pokazie                                           |

### MUST FINISH BEFORE PITCH

- Jedna trwała dostawa z dokumentów Matchera, z identyfikacją zleceń/części, możliwa do wznowienia po odświeżeniu i na telefonie.
- Etykiety i skany części/zestawu oraz lokalizacji; rozłożenie kilku pozycji, kontrola braków, zamknięcie i raport faktycznych lokalizacji.
- Odnalezienie tych samych części, przeniesienie części i zestawu, wydanie oraz ponowne otwarcie zdjęcia podpisanego dokumentu.
- Dostęp demonstratora, właściwy oddział, odmowy niedozwolonych operacji, brak fikcyjnych sukcesów; publiczny Matcher i pełna próba P0.

### SHOULD FINISH BEFORE PITCH

- Wąski pokaz ticketu: zgłoszenie → odpowiedź → akceptacja → historia; QR otwierający opisany problem.
- Krótka prezentacja użytkowników, zaproszeń i ról; przygotowane konta zamiast długiego onboardingu na żywo.
- Materiał o stanie początkowym, trzech miesiącach pilotażu, odpowiedzialności, budżecie i kryteriach powodzenia.

### CAN REMAIN PARTIAL

- Zadania, kalendarz i Kanban: istniejący, stabilny przykład albo sama wzmianka.
- Zaawansowany katalog, zlecenia, kontenery, wyszukiwanie i tickety poza dokładnym scenariuszem P0/P1. Nieukończone warianty nie blokują sprawdzonej ścieżki.

### DO NOT SPEND TIME ON BEFORE PITCH

- Generator zadań cyklicznych, pełny system powiadomień, VMI, rozbudowa materiałów/audytów/zamawiania.
- Pełna migracja AutoStacji, nieroty, lakiery, procedury, awaryjne pobrania, Customer Care VGP i pełny dashboard.
- Pełne pokrycie testami wszystkich modułów, rozbudowana analityka i hardening całej produkcji. Ochrona danych demo pozostaje P0; wymagania pilotażu zachowano na końcu.

## Zasady odhaczania

- **P0 — PITCH BLOCKER:** awaria przerywa główną historię. **P1 — HIGH VALUE FOR PITCH:** bezpośrednio wzmacnia pokaz. **P2 — PARTIAL IMPLEMENTATION IS ENOUGH:** wystarcza wąski, prawdziwy przykład. **P3 — MENTION / ROADMAP ONLY:** bez istotnych prac przed spotkaniem. **P4 — DEFER:** odłożyć poza przygotowania.
- **FULLY READY:** end-to-end, trwałe dane, sprawdzone uprawnienia, happy path i główne błędy, brak mocków, ręczna próba. Tutaj dotyczy dostępu i bezpieczeństwa używanej ścieżki, nie całego IAM.
- **DEMO READY:** dokładny scenariusz działa na rzeczywistym backendzie i trwałych danych; szersze przypadki mogą pozostać otwarte. Nadal wymagane są sprawdzenie dostępu, test happy path/głównych błędów i próba ręczna.
- **PARTIALLY READY:** można uczciwie wspomnieć lub krótko pokazać część funkcji. **ROADMAP ONLY:** nie kończyć na potrzeby pitchu, nawet jeżeli część kodu już istnieje.
- `[x]` oznacza wyłącznie opisany dowód. Dawna próba ręczna nie jest świeżą certyfikacją wdrożenia. Nie odhaczamy obszaru na podstawie strony, migracji, testu z mockami ani wcześniejszego `[x]`.
- Przy zamknięciu P0/P1 zapisać wersję aplikacji, środowisko, datę, konta/role, scenariusz, wynik i dowód. Żaden obszar nie otrzymał w tym audycie nowego statusu „gotowy”.

## Kolejność zależności i pracy

**1 → 3 → 4 → 5 → 6 → 7 → 8 → 9** to ścieżka wewnątrz web. **2** przygotować jako osobne wejście do historii. Kolejność wystąpienia pozostaje zgodna ze skryptem; kolejność pracy wynika z zależności i braków.

Pierwszy zakres wykonawczy po audycie: zweryfikować środowisko/oddział, następnie domknąć **3 + minimalne 4 + 6**, korzystając z istniejących ruchów. Uwzględnić brakujące cele QR z **5**. Potem **7 → 8 → 9**, na końcu **10–12**. Nie rozbudowywać administracji ani katalogu przed sprawdzeniem tego przejścia.

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

### 6. Przyjęcie i mobilne rozłożenie → zamknięcie → raport

**Cel: DEMO READY. Skrypt: §7. Dowód: A6.** Ogólny silnik ruchów przyjmuje i księguje dane. `/warehouse/deliveries` i `/warehouse/scanning/delivery` są placeholderami. Reguły odkładania/tabele kontenerów nie są kompletnym workflow dostawy.

- [ ] Sesja z 3 pokazuje zlecenia, części, grupowanie oraz pozycje oczekujące i rozłożone.
- [ ] Zestaw i oznaczenia mają trwałe dane; oczekiwane części są odróżnione od fizycznie potwierdzonego stanu.
- [ ] Telefon: **skan części/zestawu → skan lokalizacji → potwierdzenie** zapisuje ilość, lokalizację, użytkownika i czas.
- [ ] Wykonano kilka pozycji; komputer i telefon pokazują ten sam postęp po odświeżeniu/wznowieniu.
- [ ] Błędny skan, zły oddział, ponowny tap i przerwany zapis nie powodują podwójnego ruchu ani fałszywego sukcesu.
- [ ] Można poprawić błędne odłożenie z historią; nie można ogłosić pełnego zakończenia, jeśli wymagane pozycje nie mają lokalizacji. Wyjątek/brak pozostaje jawny.
- [ ] Zamknięcie i raport korzystają z zapisanych lokalizacji, nie tylko odczytanych z PDF.
- [ ] Raport daje dane do ręcznej aktualizacji AutoStacji; nie udaje automatycznej integracji DMS.
- [ ] **GATE 6:** mała dostawa z 3 rozłożona na telefonie, zamknięta i wyeksportowana; test happy path i głównych błędów.

### 7. Szukanie, lokalizacje, ruch części/zestawów i historia

**Cel: DEMO READY. Skrypt: §9. Dowód: A7.** Są zapytania katalogu/pickera, stany i historia ruchów lokalizacji. Wyszukiwanie nagłówka przeszukuje nawigację, nie zlecenia. Akcje kontenerów istnieją, ale nie znaleziono wywołań poza plikiem definicji; ich odczyt nie oznacza dostępnej operacji.

- [ ] Szukanie po zleceniu oraz SKU/numerze części prowadzi do części i lokalizacji; także część wolna.
- [ ] Skan lokalizacji pokazuje rzeczywistą zawartość; skan części/zestawu identyfikuje właściwy obiekt.
- [ ] „Zmień lokalizację” pozwala wskazać/skanować cel i trwale przenieść część.
- [ ] Przeniesienie zestawu aktualizuje jego części, alokacje i lokalizację spójnie; błąd/ponowienie nie rozjeżdża danych.
- [ ] Historia pokazuje źródło/cel, ilość, użytkownika i czas oraz pozostaje dostępna po ponownym wejściu.
- [ ] Po ruchu zlecenie i wyniki pokazują nowy stan, nie tylko ostatni ruch produktu bez kontekstu zlecenia.
- [ ] **GATE 7:** na danych z 6 znaleziono zlecenie/część wolną, przeniesiono część i zestaw, sprawdzono obie lokalizacje/historię.

Odłożyć pełne przepakowywanie, wszystkie filtry i duże wolumeny. Podstawowy ruch zestawu pozostaje P0, ponieważ skrypt każe go pokazać.

### 8. Zwykłe odnalezienie i wydanie

**Cel: DEMO READY. Skrypt: §10–11. Dowód: A8.** Istnieje backend dokumentów/ruchów i księgowania zmieniającego stany. Nie dowodzi to kompletnego wydania do zlecenia. Usunięcie pozycji kontenera tylko zwalnia alokację — nie jest wydaniem.

- [ ] Z odnalezionej części/zlecenia można zapisać wydanie z ilością, odbiorcą, datą i identyfikowalnym dokumentem.
- [ ] Zatwierdzenie zmniejsza właściwy stan, zachowuje historię i nie pozwala wydać więcej niż dostępne.
- [ ] Ponowne zatwierdzenie/błąd sieci nie dubluje wydania; błędny zapis nie udaje sukcesu.
- [ ] Po odświeżeniu widać dokument i zmniejszony stan; pozostałość części nadal można odnaleźć.
- [ ] Wypowiedź zachowuje wydanie w AutoStacji jako obowiązującą operację źródłową.
- [ ] **GATE 8:** wydano część z 7 i sprawdzono saldo/historię z odpowiednią rolą.

Pełne warianty wydań częściowych i tryb awaryjny nie blokują podstawowego pokazu. Usunięcie zwykłego wydania z demo wymagałoby zmiany obietnicy skryptu.

### 9. Podpisany dokument i cyfrowe archiwum wydania

**Cel: DEMO READY. Skrypt: §10–11. Dowód: A9.** Jest prywatny mechanizm załączników dla ticketów, zadań i kart Kanban. Rejestr celów nie zawiera wydania/ruchu; brak podłączenia załączników w badanych szczegółach ruchu.

- [ ] Zdjęcie podpisanego dokumentu DMS można dodać do wydania z 8, z kontrolą formatu/rozmiaru.
- [ ] Plik i powiązanie są trwałe; błąd uploadu nie tworzy pozornego dokumentu.
- [ ] Po zamknięciu widoku i ponownym zalogowaniu można znaleźć wydanie i otworzyć zdjęcie.
- [ ] Pobranie wymaga dostępu do wydania; obca organizacja/nieuprawniony użytkownik nie otrzymuje pliku.
- [ ] **GATE 9:** wyszukane wydanie → podpisany dokument, przy innym wejściu niż bezpośrednio po uploadzie.

Nie potrzeba podpisu elektronicznego, OCR ani pełnego DMS. Retencja, usuwanie i odtwarzanie dokumentów firmowych pozostają wymaganiem pilotażu.

## P1 — mocne uzupełnienie prezentacji

### 10. Użytkownicy, zaproszenia, członkostwa i administracja rolami

**Cel: DEMO READY dla krótkiego omówienia. Skrypt: §5. Dowód: A1.** Realne usługi, akcje i testy istnieją. Działający dostęp jest P0; pełne administrowanie na żywo nie.

- [ ] Przygotowano konta demonstratora, pracownika i akceptanta z członkostwami/rolami.
- [ ] Można pokazać członków, zaproszenie i zakres roli bez obietnicy ukończenia całej administracji.
- [ ] Jedno zaproszenie/przyjęcie sprawdzono przed spotkaniem, w tym błędny/wygasły token i zmianę dostępu.
- [ ] Uprawnienia serwera potwierdza scenariusz odmowy z 1, nie tylko ukryty przycisk.
- [ ] **GATE 10:** prawdziwy opis fundamentów mieszczący się w około dwóch minutach.

Nie kończyć wszystkich edytorów ról, pozycji, profili, billingów i pełnej macierzy administracyjnych edge cases przed pitchem.

### 11. Tickety: doradca ↔ części, akceptacja i problem z QR

**Cel: DEMO READY. Skrypt: §12–13. Dowód: A10.** Są typy/statusy, wykonawcy, komentarze, aktywność, akceptanci i RPC akceptacji; działa rejestr QR ticketu. Nie potwierdzono relacji do encji części/zlecenia/kontenera ani kompletnego procesu decyzji o zwrocie.

- [ ] Jeden ticket trafia do przygotowanych częściowców, ma typ/status, odpowiedzialną osobę i termin; druga osoba odpowiada, historia jest trwała.
- [ ] Przykład „Zwrot” wymaga wskazanej akceptacji i pokazuje autora/czas; niedozwolona decyzja jest odrzucana.
- [ ] Nie przedstawiać akceptacji ticketu jako pełnego silnika zwrotów z odrzuceniem, eskalacją i blokadami — sprawdzić konkretny pokazany warunek.
- [ ] QR na problemowej części otwiera ticket z opisem/statusem/historią. Wyjaśnić, czy to etykieta ticketu na części, czy rzeczywista relacja do części.
- [ ] Jeśli zachowujemy zdanie o bezpośrednim powiązaniu ze zleceniem/częścią/zestawem, musi istnieć trwałe, nawigowalne powiązanie; numer w opisie nie wystarcza.
- [ ] **GATE 11:** przebieg na dwóch rolach, ponowne otwarcie i skan QR, bez udawanych powiadomień.

Połączono komunikację, tickety wewnętrzne i jeden przykład akceptacji. Siedem typów, raporty zwrotów, Customer Care i pełne SLA nie są bramką pitchu. Niedokończone P1 wymaga jawnego zawężenia wypowiedzi przed próbą.

### 12. Stan początkowy i propozycja pilotażu

**Cel: DEMO READY dla materiału i planu. Skrypt: §8, §16–23.** To nie zlecenie implementacji migracji historycznej.

- [ ] Wyjaśniono, że pierwszego dnia system nie zna całego starego magazynu; nowe dostawy nie dowodzą pełnego stanu.
- [ ] Wybrano do rozmowy naturalną rotację albo ograniczone wprowadzenie przy porządkowaniu/inwentaryzacji; określono unikanie podwójnego przyjęcia.
- [ ] Materiał opisuje jeden oddział, trzy miesiące (przygotowanie → realna praca → ocena), odpowiedzialność i zgodę na dane.
- [ ] Około 25 tys. zł ma podział: sprzęt, infrastruktura/narzędzia, praca; nie jest ceną gotowego produktu.
- [ ] Mierniki obejmują czas przyjęcia/szukania, pomyłki lokalizacji, koszt podwójnego potwierdzenia wydania, opinie i warunki zatrzymania pilota.
- [ ] **GATE 12:** konkretny wniosek oddziela pokaz od dopuszczenia danych firmowych.

## P2 — wystarczy część działającego obszaru

### 13. Zadania jednorazowe, kalendarz, Kanban

**Cel: PARTIALLY READY. Skrypt: §14. Dowód: A11.** Są trwałe zadania, kalendarze/źródła kalendarza i tablice/karty Kanban. Nie są wyłącznie makietami; bez świeżej próby nie uznajemy całych modułów za gotowe.

- [ ] Wybrano najwyżej jeden zapisany przykład; ewentualny pokaz nie rozszerza głównego demo.
- [ ] Opis odróżnia istniejące zadania/planowanie od niepotwierdzonej cykliczności i powiadomień.
- [ ] Jeśli ekran nie jest stabilny, pozostać przy uczciwej wzmiance. Brak demo nie blokuje P0.

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

- [ ] **Gotowy do pitchu:** GATE 1–9 + Pitch Safety; P1 pokazane w sprawdzonym zakresie lub jawnie zawężone, P2–P4 opisane uczciwie. Obecnie **niepotwierdzone / blokery otwarte**.
- [ ] **Gotowy do kontrolowanego pilotażu:** osobno spełniona bramka B. Gotowy pokaz nie oznacza tej zgody.
- [ ] **Gotowy do rozszerzania produkcji:** wyniki pilotażu i bramka C dla uzgodnionego zakresu. Nie wymaga się ukończenia wszystkich 19 obecnych obszarów przed prezentacją.
