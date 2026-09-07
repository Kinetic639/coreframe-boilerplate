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
