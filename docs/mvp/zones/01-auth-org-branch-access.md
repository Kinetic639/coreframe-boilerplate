### 1. Tożsamość, dostęp, role, autoryzacja i bezpieczeństwo

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

_(Strefa scalona z byłej Strefy 10 „Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem" — obie strefy opisywały dwie połowy tej samej domeny: tożsamość/dostęp/bezpieczeństwo. Status pozostaje niezmieniony względem obu przyjętych audytów: żaden nowy dowód runtime nie powstał w wyniku samego scalenia dokumentacji.)_

## Accepted implementation audit

> Poniżej zachowane są dwa niezależnie przyjęte audyty dokładnie w formie, w jakiej zostały zaakceptowane — dla zachowania pochodzenia dowodów. Żadna z podsekcji nie została „posprzątana" ani przeredagowana w celu usunięcia nakładania się treści; ewentualne rozbieżności między nimi są odnotowane w sekcji „Product clarification and final design" niżej, nie rozstrzygane tutaj.

### Former Zone 1 audit — Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo

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

### Former Zone 10 audit — Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem

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

---

## Product clarification and final design

> This section is intentionally separate from the two accepted implementation audits above.
>
> The audits describe what currently exists, independently, for two areas that are now understood to be one domain: **Identity, Access & Security**.
> This section defines how that unified domain SHOULD ultimately behave, before implementation work begins.
>
> Do not treat unanswered questions in this section as accepted requirements.

### Open questions

These remain genuinely open. Do not treat them as decided.

1. **Which specific domains should intentionally support cross-branch views?** Default is branch-scoped operational screens. Possible future exceptions: analytics, central administration, consolidated reporting. Resolve per-domain in the relevant later Zone (e.g. Zone 11 for Help Desk, Zone 4 for Repair Orders), not globally guessed here.
2. **Does the CURRENT Supabase/RBAC implementation truly separate branch access, branch role, branch permissions, and organization-wide wildcard/admin access exactly as the target model in "Product decisions" below requires?** No longer a product ambiguity — a technical verification task (Gate to DEMO READY, section B).
3. **What is the exact technical role of the built-in `org_member` role?** Do not redesign or remove it until verified what it currently does technically. Whether organization membership itself should eventually be a sufficient baseline identity state, with `org_owner` as the only special system role and all business roles custom, is a question for later — not answered here.
4. **What is the best global implementation mechanism for detecting unsaved work before branch switching?** The desired _behavior_ (decision 23 below) is decided; the mechanism (a global dirty-form registry, a per-form hook contract, a navigation-blocker API, etc.) is not.
5. **How should historical identity remain readable after member removal?** The desired outcome (decision 37 below) is decided; the technical representation (retained profile identity, display-name snapshot, soft/deactivated membership record, or another auditable representation) is not.
6. **What is the safe transactional/concurrency model for last-owner protection?** Do not implement a naive "read owner count, then delete" sequence — it is race-prone. The invariant must eventually be enforced safely at the authoritative server/database layer; the exact mechanism (DB constraint, transactional check, advisory lock, etc.) is not decided here.
7. **How should concurrent role/branch changes be handled to prevent an inconsistent effective-permissions result?** Not decided — a technical verification/design item for Gate to PILOT READY.
8. **What is the best technical strategy for reconciling the live Supabase schema with repository migrations?** Possible approaches include a fresh baseline snapshot, targeted migration repair, or archiving the legacy tree with an explicit marker. Do not choose without inspecting the actual environment first (Implementation plan, Phase 1).

### Problems / ambiguities

**A. Current branch switching is not reliable from the user's perspective.** The product owner has personally observed that some screens do not update after a branch switch, and some update only after a manual browser refresh. This directly conflicts with decision 20 (active branch as authoritative operational context) and decision 22 (atomic branch switch). Treat this as a confirmed bug against the target model — the former Zone 1 audit already traced the concrete mechanism for one instance of it (Matcher session cache key).

**B. Branch-scoped cache/state is inconsistent, and Matcher is only the known example.** The former Zone 1 audit identified the Matcher React Query cache key as a concrete, traced instance (`wddMatcherKeys.sessions()` has no branch segment). The fix must not stop at Matcher — implementation later needs a systematic inventory of branch-scoped React Query keys, Zustand/client stores, server caches, route-derived state, loaders, prefetching, and mutation-invalidation logic.

**C. Current Matcher RLS is organization-scoped despite branch ownership.** The former Zone 1 audit confirmed `wdd_matcher_*` tables have RLS enabled but not `FORCE`d, and check organization-level permission only, despite a `branch_id` column existing on every table. This directly conflicts with decision 21 ("operational data is branch-scoped by default").

**D. Help Desk currently has the same organization-level-only RLS pattern despite a `branch_id` column.** Whether every Help Desk entity should ultimately be branch-scoped belongs to Zone 11, not this Zone. This Zone only asserts the global default rule (decision 21); Zone 11 must explicitly design any deliberate exception.

**E. Migration source-of-truth ambiguity.** Two parallel migration trees exist (`apps/web/supabase/migrations` "legacy" and `apps/web/supabase-target/supabase/migrations` "target"). The former Zone 1 audit found the running app's `.env.local` points at the target project, but several pitch-critical table migrations physically live in the legacy folder despite their own header comments claiming the target project. Unresolved from the repository alone.

**F. Missing repository representation for some live schema/RLS, at minimum QR.** `qr_codes`/`qr_assignments` are used by real, reachable QR actions but have no corresponding migration anywhere in the repository. Per decision 43 this is one confirmed instance of a broader pattern, not necessarily the only one.

**G. Current cross-branch deep-link behavior is not defined as one coherent product flow.** QR resolution, direct URLs, and other deep links do not currently share one documented authorization/navigation contract. Decisions 25–27 now define that single contract; no code currently implements it end-to-end as specified.

**H. Unsaved-work protection around branch switching is not implemented as a coherent application-wide behavior.** No shared mechanism for detecting protected unsaved work during a branch switch was found in the former Zone 1 audit. Decision 23 defines the required behavior; the mechanism is open question 4.

**I. The organization model should be reconciled with the one-user-one-organization rule.** The former Zone 1 audit traced `user_preferences.organization_id` as a single-value preference and the org-resolution loader as picking one organization per user — consistent on the surface with decision 1. Whether the underlying `organization_members` schema could technically allow a user to hold rows in more than one organization has not been conclusively checked. **Do not modify code/schema in this documentation task** — this is a technical verification item (Gate to DEMO READY, section B; Implementation plan, Phase 2).

**J. No last-owner protection exists at any layer.** The former Zone 10 audit confirmed — directly in code, not inferred — that `OrgMembersService.removeMember` and the role actions in `roles.ts` perform unconditional removal/change with no owner-count check and no identity check against the acting user, and that no RLS policy enforces an owner-count invariant either. This directly conflicts with decisions 5–7 below and must be treated as a confirmed gap against the target model, not a hypothetical risk.

**K. No self-demotion warning/guard exists.** Consistent with problem J — there is no code path today that warns a user about to demote/remove their own administrative access, nor one that validates the last-owner invariant on self-demotion specifically (decision 8).

**L. Privilege-escalation checks are not conclusively verified against the intended anti-escalation model.** The former Zone 10 audit found real, tested permission checks (`MEMBERS_MANAGE`/`BRANCH_ROLES_MANAGE` dual-gate) but did not specifically verify whether an actor could grant a role/permission broader than their own authority. Decision 18 defines the required behavior; current conformance is unverified (open question 2 territory).

**M. Invitation one-organization revalidation at accept-time has not been specifically verified.** The former Zone 10 audit traced `accept_invitation_and_join_org` as a real, working RPC, but did not specifically confirm it re-validates the one-organization invariant (decision 34) at accept time as opposed to only at invitation-creation time. This must be checked, not assumed, given state can change between invite creation and acceptance.

**N. Whether member removal preserves historical authorship has not been specifically verified.** The former Zone 10 audit confirmed `removeMember` revokes membership/role assignments, but did not trace whether removal cascades in any way that could break attribution on movements, receipts, ticket comments, audit events, or other historical records (decision 37).

### Product decisions

The following are **DECIDED** product requirements, accepted by the product owner. They describe target behavior, not current implementation — where they differ from either accepted audit above, the audit's current-state finding is unchanged and the delta is the implementation gap. Numbered items marked _VERIFY_ are explicitly not yet confirmed against the current implementation; treat those narrowly as verification tasks, not as unresolved product questions.

**Identity / organization**

1. **DECIDED** — One user belongs to exactly one organization. Applies to normal users, managers, administrators, and organization owners alike. No multi-organization user mode is part of the intended product. No user-facing active-organization switcher is needed.
2. **DECIDED** — Organization is the top-level tenant/security boundary. Organization A users must never access Organization B data. No cross-organization operational workflow is currently in scope.

**Organization owner** 3. **DECIDED** — `org_owner` is a special built-in system ownership role, not merely another custom role. 4. **DECIDED** — Every organization must always have at least one `org_owner` (`organization.ownerCount >= 1`). 5. **DECIDED** — An organization may have multiple owners. 6. **DECIDED** — An operation that would leave the organization with zero owners must be rejected server-side. This includes removing the last owner, removing the last owner's owner role, and self-demotion of the last owner. 7. **DECIDED** — Only an existing `org_owner` may grant or revoke `org_owner`. A normal admin/member-manager must not be able to create new owners merely because they can manage users.

**Self-demotion** 8. **DECIDED** — Self-demotion is allowed if it does not violate the last-owner invariant, the user sees a strong warning, and server-side validation still applies. Do not forbid self-demotion outright.

**Branch access** 9. **DECIDED** — A user may have access to one or multiple branches inside their organization. 10. **DECIDED** — Branch access and branch permissions are separate concepts: "can access this branch?" and "can perform this operation in this branch?" are two distinct authorization questions and must remain so in the implementation. _(VERIFY against current RBAC — open question 2.)_ 11. **DECIDED** — A user without branch access cannot set that branch as active. 12. **DECIDED** — Organization membership alone does not automatically grant all branches. 13. **DECIDED** — Appropriate organization-wide authority/wildcard may grant access to all branches, as an explicit exception — not "organization member implies all branches." _(VERIFY the current technical implementation of this wildcard/administrative rule.)_

**Roles / permissions** 14. **DECIDED** — Roles/permissions may differ by branch (the same user may be manager in Branch A, warehouse worker in Branch B). 15. **DECIDED** — A user may have multiple applicable roles; effective permissions are the union of all valid role assignments in the current context. 16. **DECIDED** — Organization-scoped and branch-scoped role assignments may coexist. 17. **DECIDED** — Permission context must change when active branch changes — branch switching is a permission-context transition, not just a data-scope transition. 18. **DECIDED** — Privilege escalation must be prevented: a user must not grant themselves or another user permissions broader than the acting user's own authority, unless the acting user holds an explicit higher-level permission authorizing full permission management. Applies to creating/editing custom roles, and assigning roles at branch or organization scope. `org_owner` may have full authority per the product model. _(VERIFY the current implementation — problem L.)_

**Technical `org_member`** 19. **VERIFY / DESIGN LATER** — The exact long-term role of the built-in technical/basic `org_member` role is not decided (open question 3). Do not remove or redesign it in this documentation task.

**Active branch** 20. **DECIDED** — Active branch is the operational context. All branch-scoped queries, loaders, mutations, caches, stores, permissions, and navigation context must follow the active branch. 21. **DECIDED** — Operational data is branch-scoped by default; organization-scoped operational data is an explicit exception. Likely branch-scoped: warehouse locations, inventory balances, inventory movements, receiving sessions/processes, issues, Repair Orders, Matcher sessions, warehouse operational tickets, inventory audits/count sessions. Likely organization-scoped: organization settings, organization membership, role definitions/templates, organization-level administration, shared dictionaries/configuration with no branch business meaning, and selected organization-wide reporting. Each later Zone must explicitly decide its own domain's scope against this default. 22. **DECIDED** — Branch switching must be atomic from the user's perspective. On successful switch: validate branch access, handle unsaved work, set the new active branch, recompute/refresh the applicable permission context, invalidate previous branch-scoped cache/state, redirect to a safe start screen, and reload under the new branch. No manual browser refresh should be required; no stale previous-branch operational data should remain visible.

**Unsaved work** 23. **DECIDED** — Branch switching must protect unsaved work. At minimum: cancel-and-remain, or discard-and-switch. Save-draft-and-switch is offered only where a durable draft capability genuinely exists — this does not obligate every Ambra form to gain persistent drafts. The global dirty-state-detection mechanism is open question 4.

**Cross-branch navigation** 24. **DECIDED** — There is one shared cross-branch navigation rule, applying equally to QR, direct URLs, internal links, ticket links, Repair Order links, and other deep links. 25. **DECIDED** — If the target object belongs to another branch and the user has access: do not silently switch branch. Ask "This object belongs to Branch B. Switch active branch to view it?" On confirmation: verify access server-side, switch branch, invalidate previous context, open the target. On cancel: remain in the current branch, do not reveal/open the object. 26. **DECIDED** — If the user lacks access: do not switch branch, deny access safely, avoid unnecessary protected-metadata disclosure. 27. **DECIDED** — QR follows exactly the same rule as any other deep link — QR is navigation, not a separate authorization model.

**Authorization / RLS** 28. **DECIDED** — Client-side gating is UX only; authorization must be enforced server-side. 29. **DECIDED** — RLS/data-layer isolation is used as a hard additional boundary where applicable. Defense model: UI visibility + server-side authorization + RLS/data-layer isolation. 30. **DECIDED** — Stale client state must never allow an operation that current server/database authorization denies.

**Revocation** 31. **DECIDED** — If organization membership, branch access, role, or permission is revoked while a session is active, already-rendered UI may remain temporarily stale, but the next protected server-side request must be denied under current authorization. Full real-time push revocation is not required for pitch. _(VERIFY the current implementation actually behaves this way.)_

**Invitations** 32. **DECIDED** — Sending an invitation does not create active membership. Lifecycle: create invitation → pending → user accepts → validate → create membership → create role/branch assignments → compile effective permissions → active member. 33. **DECIDED** — An invitation may define organization role(s) and/or branch access with different branch role(s) per branch (e.g. "Warehouse Worker" in Poznań, "Manager" in Swadzim). 34. **DECIDED** — The one-organization invariant must be enforced in invitations, with defense in depth: reject a detectable conflict at invite creation, but **always** revalidate the invariant at invite acceptance, since state may have changed in between. _(VERIFY current implementation does the accept-time revalidation — problem M.)_

**Member removal** 35. **DECIDED** — "Remove member" means removing access/membership from the organization. It does not mean deleting the user's Supabase Auth identity. 36. **DECIDED** — Removal must effectively revoke organization membership, branch access, and applicable role assignments. 37. **DECIDED** — Historical records must remain attributable to the former user. Removing membership must not destroy or erase authorship/history for movements, receipts, ticket comments, audit events, administrative changes, or other historical records. The exact technical representation is open question 5.

**Access administration** 38. **DECIDED** — Access administration must support: inviting users, assigning branch access, assigning org roles, assigning branch roles, editing/removing assignments, and viewing effective access. 39. **DECIDED** — Administrative operations must respect the anti-escalation rules (decision 18). 40. **DECIDED** — Sensitive administrative actions should be auditable for pilot readiness.

**Schema / migrations** 41. **DECIDED** — Full migration-history cleanup is not required for pitch. 42. **DECIDED** — Before controlled pilot, the live Supabase schema/RLS relevant to pilot-critical domains must be understood and reproducible with confidence. 43. **DECIDED** — Missing migration representation such as the QR tables (problem F) is part of a broader schema-drift problem, not an isolated QR-only issue. 44. **DECIDED** — Long-term, there must be one authoritative repository-controlled representation of the active schema/RLS. The exact reconciliation method is open question 8; a fresh baseline/snapshot may be acceptable, but this is not decided without technical investigation.

### Final intended workflows

**Flow 1 — New user creates organization**

1. User registers/authenticates.
2. System verifies the user does not already belong to an organization.
3. User creates the organization.
4. Membership is created.
5. User becomes `org_owner`.
6. Organization has at least one branch, or onboarding guides the owner to create/select one per the existing application flow.
7. Permissions are compiled/resolved.
8. User enters the organization under a valid active branch.

_(General onboarding flow outside this scope is not redesigned here.)_

**Flow 2 — Owner/admin invites a user**

1. Authorized administrator opens user administration.
2. Enters target email/user.
3. Selects permitted organization/branch assignments.
4. Selects roles per scope.
5. System validates: acting admin authority, anti-escalation rules (decision 18), branch validity, one-org conflict if detectable (decision 34).
6. Invitation created as PENDING.
7. Email sent.
8. No active membership exists yet (decision 32).

**Flow 3 — User accepts invitation**

1. User opens a valid invite.
2. System verifies: token, email match, pending state, expiration, and the one-organization invariant again (decision 34).
3. Membership is created.
4. Organization/branch role assignments are copied/created.
5. Effective permissions are compiled.
6. User enters only the branches they are allowed to access.

**Flow 4 — Normal login**

1. Authenticate.
2. Resolve the single organization (decision 1).
3. Resolve accessible branches (decision 9).
4. Resolve a valid active/default branch, falling back safely if the stored branch is no longer accessible.
5. Resolve effective permissions for the org + branch context (decision 15, 17).
6. Load only allowed data.
7. Deny forced unauthorized org/branch access — the server re-derives and re-validates on every protected request (decision 28).

**Flow 5 — Normal branch switch**

1. Select accessible Branch B.
2. Server validates access.
3. Resolve unsaved-work state (Flow-C-equivalent, decision 23).
4. Persist the new active branch.
5. Recompute/refresh the applicable permission context (decision 17).
6. Invalidate branch-scoped state/caches.
7. Redirect to a safe start screen.
8. Reload Branch B data.
9. No stale Branch A permissions/data remain active.

**Flow 6 — Branch switch with unsaved work**

1. User requests Branch B.
2. Ambra detects protected unsaved work in the current workflow.
3. A warning is shown.
4. The user may cancel, discard-and-switch, or (only where a durable draft genuinely exists) save-draft-and-switch (decision 23).
5. Branch context changes only after the decision is resolved.

**Flow 7 — Cross-branch deep link / QR, user has access**

1. User is in Branch A; the requested object belongs to Branch B.
2. The server determines object ownership and verifies Branch B access without leaking protected content.
3. UI asks: "This object belongs to Branch B. Switch active branch to view it?"
4. If confirmed: switch branch securely, reset branch context, open the target (decision 25).
5. If cancelled: remain in Branch A; the object is not exposed.

**Flow 8 — Cross-branch deep link / QR, user lacks access**

1. User requests an object belonging to an inaccessible Branch B.
2. Authorization fails server-side.
3. The active branch remains unchanged.
4. The user sees safe, generic access-denied UI (decision 26).
5. Protected object metadata is not disclosed.

**Flow 9 — Admin assigns/changes a role**

1. Acting admin opens a member.
2. Selects role/scope.
3. Server verifies: admin may manage this member/scope, the target role exists, the branch exists if branch-scoped, the acting user is not granting authority beyond their own allowed maximum (decision 18), and `org_owner` assignment is only performed by an existing `org_owner` (decision 7).
4. Assignment persists.
5. Effective permissions are recompiled/resolved.
6. New authorization applies by the next protected request, without requiring logout (decision 17, decision 31).

**Flow 10 — Self-demotion**

1. Admin/owner attempts to change their own access.
2. UI warns about possible loss of administration (decision 8).
3. Server validates anti-escalation/de-escalation rules as applicable, and the last-owner invariant (decision 6).
4. If the last owner would be removed: reject.
5. Otherwise: allow; permissions update; the next protected request uses the new access.

**Flow 11 — Add / remove organization owner**

_Grant:_

1. An existing `org_owner` chooses an eligible member.
2. Server verifies the acting user is an owner (decision 7).
3. Owner role is granted.
4. Organization remains valid.

_Remove:_

1. An existing `org_owner` requests owner removal.
2. Server verifies acting authority.
3. Server enforces `ownerCount >= 1` atomically/transactionally (open question 6).
4. Reject if this would remove the last owner (decision 6).
5. Otherwise allow.

**Flow 12 — Remove member**

1. Authorized admin requests removal.
2. Server verifies authority.
3. If the target is an owner, the last-owner invariant applies (decision 6).
4. Membership/access assignments are revoked per the model (decisions 35–36).
5. The Auth identity is not deleted (decision 35).
6. Historical authorship remains readable (decision 37).
7. An existing active session for the removed user loses protected access no later than the next protected request (decision 31).

**Flow 13 — Permission revocation during an open session**

1. User has an open UI session.
2. An administrator changes role, branch access, or removes membership.
3. Already-rendered UI may remain temporarily stale.
4. The user attempts the next protected operation/request.
5. The server re-evaluates authorization against current state.
6. The operation is denied.
7. The UI handles the denial cleanly (clear message, safe redirect/refresh) rather than failing unsafely (decision 31).

**Flow 14 — Admin cannot escalate beyond their own authority (negative flow)**

1. Admin attempts to create/assign a role containing authority beyond their allowed management scope.
2. Server evaluates authority.
3. Operation rejected.
4. No partial assignment persists.
5. Audit/error behavior is safe.

### Architecture implications

These describe the required direction, not an implementation to build in this task.

1. **One-user-one-organization invariant.** The application/product assumes exactly one organization per user (decision 1). Current memberships/preferences must be checked against this invariant (problem I) rather than assumed compliant.
2. **Organization as tenant boundary.** No cross-organization data path exists or is assumed (decision 2).
3. **Explicit branch-access model.** Branch-scoped entities need a durable `branch_id` (or equivalent) ownership path; branch ownership must never exist only in client state.
4. **Active branch as operational context.** Every branch-scoped read/write path must derive its scope from the server-resolved active branch, not a client-supplied value.
5. **Context-sensitive effective permissions.** Permission resolution must be a function of (user, organization, active branch), recomputed on branch change — not a value cached independently of branch context (decision 17).
6. **Multiple role assignments / permission union.** The permission model must support summing/union-ing multiple valid role assignments for the same user in the same context (decision 15).
7. **Separate org-scope and branch-scope assignments.** The data model must represent both kinds of role assignment as first-class, coexisting concepts (decision 16).
8. **Special `org_owner`.** The role model must treat `org_owner` as a distinct, protected system role, not an ordinary custom role (decision 3).
9. **Last-owner invariant.** The data/service layer must enforce `ownerCount >= 1` for every organization, ideally at a layer that cannot be bypassed by application-level omissions (decision 4, decision 6; open question 6).
10. **Anti-escalation enforcement.** Role/permission-assignment code paths must compare the requested grant against the acting user's own authority before persisting (decision 18).
11. **Server authorization mandatory.** UI capability gating is never the actual boundary (decision 28).
12. **RLS/data isolation.** Used as a hard additional boundary wherever applicable (decision 29).
13. **Branch-aware caching.** Every branch-scoped query/cache identity must include branch context, or be fully invalidated on branch change (problem B).
14. **Central branch transition.** Branch switching should route through one centralized context-transition mechanism, not ad-hoc per-screen refresh logic (decision 22).
15. **Cross-branch navigation guard.** One shared resolver/guard for QR, direct URLs, and internal deep links implements decisions 24–27, not separate logic per entry point.
16. **Unsaved-work guard contract.** A shared contract lets individual workflows declare protected unsaved work to the branch-switch flow (decision 23; open question 4).
17. **Transactional invitation acceptance.** Invitation acceptance must be transactional enough to avoid partial membership/role assignment on failure (supports Flow 3, decision 32).
18. **Historical identity preservation.** Membership removal must not cascade into destroying authorship/history records (decision 37; open question 5).
19. **No stale-JWT-dependent revocation.** Revocation enforcement must be based on server/DB-resolved current state, not a JWT claim that can lag reality (decision 31).
20. **Administrative auditability.** Sensitive administrative changes should be recorded in a way that supports later investigation (decision 40).
21. **Concurrency-safe ownership/role mutation.** Simultaneous role/branch/ownership changes for the same user must not produce an inconsistent effective-permissions result (open question 7).
22. **One authoritative schema/RLS representation.** Long-term, the live Supabase schema/RLS needs one authoritative, repository-controlled representation; legacy migration history may be archived/retained as reference material but must not continue to look like a second active source of truth (decisions 41–44).

### Readiness progression plan

**CURRENT: 🟡 PARTIAL** _(status unchanged by this merge; recorded here only to explain gate distance — the merge itself provides no new runtime evidence)_

Authentication is real. User administration is real (member list, role CRUD, branch-scoped role assignment). Invitation lifecycle is real (create → email → accept/decline, with tested error paths). Role administration is real, tested server-side. Branch context and permission resolution exist and are read fresh per request rather than from a stale JWT. Despite this strong foundation, status remains PARTIAL because: branch-switch propagation is inconsistent (problem A); Matcher branch isolation is incomplete at the RLS and action layer (problem C); branch-aware cache behavior is confirmed broken in at least one pitch-critical path (the traced Matcher session cache key), while the broader branch-scoped cache/state surface still requires systematic verification, not yet a confirmed multi-instance finding (problem B); **last-owner protection is completely missing at every layer** (problem J); **self-demotion protection/warning is completely missing** (problem K); privilege-escalation scope is not fully verified (problem L); migration/schema trust is incomplete (problem E, F); and no part of the now-merged end-to-end identity/access lifecycle (login → org/branch → role administration → revocation) has been freshly manually verified on the current build.

**GATE TO 🔵 DEMO READY**

The pitch does not need enterprise-complete IAM.

_A. MUST IMPLEMENT/FIX_

- [ ] Branch switching propagates immediately across the pitch path, with no manual refresh (decision 22; problem A).
- [ ] Branch-aware cache/state invalidation for the pitch path, including the Matcher session cache fix (problem B).
- [ ] Inaccessible branch cannot become active, including via direct server-action manipulation (decision 11).
- [ ] Safe cross-branch navigation for the pitch path (decisions 25–27), at minimum the QR flow already used in the demo.
- [ ] Permission context correctly changes after branch switch for the pitch path (decision 17, decision 22).
- [ ] Prepared demo user roles/access behave correctly for the exact accounts used in the demo.
- [ ] The admin UI used in the pitch (member list / one role change / one invitation) has no obvious unsafe flow.

  **Last-owner protection scope for DEMO READY:** since the presentation does not need to demote/delete owners, full last-owner implementation is _not_ required purely for DEMO READY if the prepared pitch path cannot trigger it. However: do not accidentally demonstrate or rely on unsafe owner removal, and demo data must be prepared so that the known gap (problem J) cannot surface by accident.

  **Privilege-escalation scope for DEMO READY:** not necessarily a pitch blocker unless the chosen pitch scenario edits a role in a way that would exercise it.

  **Matcher RLS caveat (unchanged from former Zone 1 clarification):** a complete production-scale RLS overhaul is not required for DEMO READY if the exact prepared demo environment uses controlled accounts/data and the pitch path is demonstrably safe. Any path that could visibly show wrong-branch data _during the actual demo_ must still be fixed.

_B. MUST VERIFY TECHNICALLY_

- [ ] Current one-org-per-user behavior vs. the current membership schema (problem I).
- [ ] Branch access vs. branch permissions are truly separate in the current RBAC implementation (decision 10).
- [ ] Multi-role effective-permission union behaves as intended (decision 15).
- [ ] Branch-context permission refresh behaves as intended (decision 17).
- [ ] Organization-wide wildcard/admin branch-access semantics (decision 13).
- [ ] `org_owner` assignment/revocation semantics — confirm only an existing owner can grant/revoke owner (decision 7).
- [ ] Current privilege-escalation checks, to the extent the pitch scenario exercises them (problem L).
- [ ] Server-side authorization is actually re-checked on the next protected request after a revocation (decision 31).
- [ ] Invitation one-organization behavior, at minimum the creation-time check (decision 34; accept-time revalidation is a PILOT READY item unless the pitch scenario uses invitations).
- [ ] Active branch cannot be server-side forced to an inaccessible branch (decision 11).
- [ ] The real demo Supabase project/schema/RLS relevant to the pitch path (problem E, F).
- [ ] Relevant existing automated tests actually run (both former audits found rich test coverage that was never executed).

_C. MUST VERIFY MANUALLY_

One integrated manual scenario using prepared accounts (numbered so PASS/FAIL can be recorded per step):

1. Login as owner/admin.
2. Confirm correct organization.
3. Confirm visible accessible branches.
4. Show prepared users with distinct roles/scopes.
5. Login/act as a restricted user.
6. Confirm a restricted branch/operation is denied.
7. Switch to an allowed second branch.
8. Confirm both data and permissions change immediately.
9. Confirm no refresh is required.
10. Perform one selected administrative action — role assignment/change **or** invitation acceptance, depending on pitch choreography.
11. Confirm the effect applies without logout where intended.
12. Open/scan a cross-branch target the account has access to.
13. Confirm the branch-switch confirmation prompt.
14. Open/scan a cross-branch target the account lacks access to.
15. Confirm safe denial.
16. Optionally revoke a non-owner permission/branch assignment and confirm the next protected operation is denied.

Do not require live destructive owner tests during pitch rehearsal. Zone 1 may be marked 🔵 DEMO READY only after the presentation-relevant subset of this scenario has been executed on the current build with recorded results (date, build/environment, accounts/roles, PASS/FAIL per step) — see Status change rules below.

_D. NOT REQUIRED FOR DEMO READY_

- Last-owner negative test, if not part of the pitch scenario.
- Full self-demotion lifecycle.
- Full privilege-escalation matrix.
- All role combinations.
- Full DB migration cleanup.
- Comprehensive RLS coverage for every table.
- Concurrency hardening.
- Full admin audit trail.
- Real-time revocation.
- Production-scale security hardening.

**GATE TO 🟢 PILOT READY** _(additional requirements beyond DEMO READY)_

1. Enforce the one-organization-per-user invariant (technically, not just by convention).
2. Fix Matcher branch isolation (problem C).
3. Resolve Help Desk branch behavior per Zone 11's final design (problem D — reference, not designed here).
4. Enforce the last-owner invariant transactionally (open question 6).
5. Add self-demotion warning/guard behavior (decision 8).
6. Verify/enforce anti-privilege-escalation behavior across the full admin surface (decision 18).
7. Verify only an `org_owner` can assign/revoke `org_owner` (decision 7).
8. Verify membership removal correctly revokes access (decisions 35–36).
9. Verify historical identity is preserved after removal (decision 37).
10. Verify invitation conflict detection against an already-member-of-another-org account, including accept-time revalidation (decision 34).
11. Verify multiple roles + effective-permission union (decision 15).
12. Verify branch-specific role changes (decision 14).
13. Verify the active-branch permission-context switch (decision 17).
14. Representative live RLS cross-org/cross-branch tests, not only mocked-client tests.
15. Reconcile the pilot schema/RLS source of truth (decisions 42–44).
16. Verify Storage authorization against real protected files across representative users/branches.
17. Verify the administrative audit trail (decision 40).
18. Verify realistic, safe error handling under pilot conditions.
19. Verify concurrency behavior for last-owner and simultaneous role mutations (open question 7).
20. Run a representative pilot-role E2E across the merged identity/access lifecycle.

### Status change rules

- Static code inspection alone cannot promote Zone 1 to DEMO READY.
- Passing automated tests alone cannot promote Zone 1 to DEMO READY.
- DEMO READY requires current-build manual verification of the exact presentation-relevant workflow (Gate to DEMO READY, section C).
- PILOT READY requires DEMO READY plus pilot-grade isolation, schema/RLS confidence, representative role testing, and operational safety (Gate to PILOT READY).
- Historical verification (e.g. the 2026-08-06 QR/location scan in the former Zone 1 audit) remains HISTORICAL until repeated on the current build.
- Do not mark a requirement complete merely because the implementation "appears correct" — every promotion must cite concrete, current evidence (build/date/environment/accounts/scenario/result).

### Final pitch scope

Zone 1's pitch scope stays intentionally narrow. The presentation needs to prove:

- real Supabase login,
- real organization context,
- real active branch, changing branch-scoped operational context immediately,
- the user can only select branches they are allowed to access,
- prepared users with genuinely different roles/permissions,
- one administrative action (role change or invitation) works and takes effect without logout,
- QR/deep-link navigation respects authentication and branch access,
- server-side access denial is real, for both a data operation and an administrative operation.

_"Ambra knows who the user is, which organization they belong to, which branches they can work in, what role/permissions they have in each branch, and it enforces those boundaries when the context changes."_

Do not turn this into an IAM presentation. Do not show SQL, RLS policies, permission matrices in detail, last-owner edge cases, privilege-escalation attacks, or migration internals — those are readiness evidence (this document), not presentation content.

### Final controlled-pilot scope

For the controlled pilot, require the full merged identity/access foundation for the domains actually used in the pilot:

- one organization per user,
- multi-branch access,
- branch-specific roles,
- multiple roles with correct effective-permission union,
- reliable branch switching (data and permission context),
- access revocation,
- last-owner protection,
- anti-escalation enforcement,
- safe membership removal with preserved historical identity,
- invitation correctness (including accept-time one-org revalidation),
- server-side authorization,
- RLS/data isolation for pilot-critical branch-scoped domains,
- a trusted/reconciled Supabase schema/RLS baseline,
- administrative auditability,
- representative role testing.

Do not require future SSO/HR/enterprise IAM features, or every future organization-wide analytics/cross-branch feature — those remain explicit future features, resolved outside the initial controlled pilot.

### Implementation and verification work plan

**Phase 1 — Establish the real environment/schema**

- [ ] Identify the exact Supabase project/database used by the current demo build.
- [ ] Verify the live membership/role/branch schema.
- [ ] Verify live RLS for pitch-critical tables.
- [ ] Map how the migration trees relate to the live database.
- [ ] Do NOT perform full migration cleanup yet.

**Phase 2 — Verify the current identity/access model**

- [ ] One-organization invariant.
- [ ] Owner semantics (grant/revoke restricted to existing owners).
- [ ] Branch access vs. branch role vs. org role.
- [ ] Multi-role union.
- [ ] Wildcard/admin branch access.
- [ ] Invitation semantics, including accept-time one-org revalidation.
- [ ] Current anti-escalation checks.

**Phase 3 — Fix branch context propagation**

- [ ] Branch-scoped cache inventory.
- [ ] Matcher session cache-key fix.
- [ ] Permission-context refresh on branch switch.
- [ ] Branch-scoped state reset on switch.
- [ ] Safe redirect after switch.

**Phase 4 — Cross-branch navigation**

- [ ] Central object branch-ownership check.
- [ ] Confirm-then-switch flow.
- [ ] Safe denial flow.
- [ ] QR/direct-URL/internal-link parity.

**Phase 5 — Access administration correctness**

- [ ] Owner-assignment guard (decision 7).
- [ ] Last-owner invariant (decision 6; concurrency per open question 6).
- [ ] Self-demotion warning (decision 8).
- [ ] Anti-escalation enforcement (decision 18).
- [ ] Membership-removal correctness (decisions 35–37).

  _Note: for pre-pitch sequencing, implement only the subset of Phase 5 actually required for pitch safety (see Gate to DEMO READY, section A). The remainder is scheduled before pilot (Gate to PILOT READY, items 4–9)._

**Phase 6 — Invitation/onboarding hardening**

- [ ] One-organization conflict check at invite creation, where detectable.
- [ ] Mandatory one-organization revalidation at invite acceptance.
- [ ] Correct branch/role assignment on acceptance.
- [ ] No partial membership persists on failure (architecture implication 17).

**Phase 7 — Historical identity / audit behavior**

- [ ] Verify current history/authorship behavior on member removal.
- [ ] Decide the technical representation if a gap is found (open question 5).
- [ ] Ensure a removed member remains attributable in historical records.

  _Primarily a PILOT READY item unless the pitch scenario exposes it._

**Phase 8 — Automated verification**

- [ ] Run existing organization/branch/RBAC/invitation/role tests (both former Zone 1 and Zone 10 audits found substantial unrun coverage).
- [ ] Add regression tests for behavior fixed in Phases 3–6.
- [ ] Add owner/anti-escalation tests.
- [ ] Add branch-switch tests (data + permission context).
- [ ] Add invitation-conflict tests (including accept-time revalidation).
- [ ] Add live RLS tests for pilot-critical tables (Phase 10).
- [ ] Record exact commands/results as evidence.

**Phase 9 — Manual DEMO READY verification**

- [ ] Execute the integrated manual scenario (Gate to DEMO READY, section C).
- [ ] Test on the current desktop build.
- [ ] Test the relevant QR/login path on the presentation phone.
- [ ] Use at least one multi-branch authorized user and one restricted/admin-controlled-access scenario.
- [ ] Record date/build/environment/accounts-as-roles used and PASS/FAIL per step.
- [ ] Only after all pitch-critical steps pass, update Zone 1 status to 🔵 DEMO READY.

**Phase 10 — PILOT READY hardening**

- [ ] Transactional ownership invariant and concurrency handling.
- [ ] Schema baseline/reconciliation.
- [ ] Representative live RLS cross-org/cross-branch tests.
- [ ] Storage authorization verification.
- [ ] Administrative audit trail.
- [ ] Representative pilot role-matrix E2E.
- [ ] Only then update Zone 1 status to 🟢 PILOT READY.

**Scope discipline.** This plan does not rewrite Ambra's authorization from scratch. It defines the intended organization/branch/role/ownership security model, fixes the inconsistencies that violate it, verifies the exact pitch path, and hardens pilot-critical boundaries before real company use — nothing beyond that. Domain-specific decisions belong to their own Zones, referenced here rather than designed here: Help Desk detail → Zone 11; Repair Order branch ownership → Zone 4; Matcher persistence detail → Zone 3; Receiving → Zone 6; Inventory issue → Zone 8. Zone 1 owns the global identity/access/security rules those domains must follow; the domain Zones own their detailed behavior.

---

> **Product clarification status: COMPLETE.**
> The intended Identity, Access & Security model is now defined. Remaining open items (Open questions 1–8) are technical verification/design questions, not unresolved product behavior. This note does not change Zone 1's runtime/readiness status, which remains 🟡 PARTIAL until the evidence in the Readiness progression plan says otherwise.
