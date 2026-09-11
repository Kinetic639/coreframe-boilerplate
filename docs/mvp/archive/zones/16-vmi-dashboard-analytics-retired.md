> Historical/retired zone.
> Former Zone 16 ("VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu") was removed from the active product-zone model. Its VMI and advanced-analytics content is future/roadmap material, summarized in [Product Roadmap](../../planning/product-roadmap.md). Its home/common-dashboard content is NOT roadmap-only — the accepted findings specific to `/dashboard/start` were extracted into a new active pitch-relevant zone: [Zone 21 — Home / Operational Dashboard](../../zones/21-home-operational-dashboard.md).
> This file is historical evidence only and is not an active source of current pitch/pilot readiness requirements.

### 16. VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu

**Priorytet:** P3 (wartość aktualna z tabeli globalnej — sprawdzone tu wyłącznie pod kątem sensowności opisu, tabela globalna nie jest jeszcze aktualizowana)

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Ta strefa łączy trzy odrębne, drugorzędne powierzchnie o bardzo różnej dojrzałości — pojedynczy status musi to uśredniać, więc kluczowe są rozróżnienia poniżej, nie sama etykieta.

- **VMI (`apps/vmi-client`)** — to nie jest niedokończony produkt na realnym backendzie, tylko **w pełni oparty na atrapie (fixture) prototyp UI bez jakiegokolwiek żywego backendu na ścieżce, którą użytkownik faktycznie osiąga**. Jedyną bramką dostępu jest ciasteczko `client-demo` ustawiane bezwarunkowo, bez sprawdzenia poświadczeń. Istnieje osobna, realnie wyglądająca warstwa serwerowa (akcje, serwisy, prawdziwe zapytania Supabase) — ale jest całkowicie osierocona: żadna strona jej nie wywołuje, a tabele, do których się odwołuje (`vmi_client_accounts` itd.), nie istnieją w żadnej zastosowanej migracji — istnieją wyłącznie jako szkic SQL świadomie trzymany poza katalogiem migracji do czasu „zamrożenia schematu". Żadna operacja zapisu (zamówienie, wiadomość, liczenie stanu) nie jest trwała — odświeżenie strony usuwa zmiany.
- **Pulpit startowy (`/dashboard/start`)** — dziś to dosłownie jeden statyczny nagłówek powitalny bez żadnych danych, kart czy widżetów; nie jest centrum operacyjnym w żadnym sensie. Dokumentacja projektu (`CLAUDE.md`) opisuje nieistniejący dziś „moduł news feed z szybkimi akcjami" — to nieaktualny, aspiracyjny opis, nie stan kodu.
- **Analityka** — tu sytuacja jest odwrotna: strona przeglądu (`/dashboard/analytics`) to pusty placeholder (sam tytuł/podtytuł), ale **dwa realne, zasilane bazą danych ekrany istnieją i działają**: kanał aktywności organizacji i kanał audytu, oba oparte o rzeczywiste zapytania do `platform_events` z prawdziwym sprawdzeniem uprawnień i aktywnej organizacji/oddziału.

Żadna z tych trzech powierzchni nie jest wymagana przez główną narrację skryptu (Matcher → przyjęcie → magazyn → wydanie → historia → pilotaż) — to jest zgodne z zamierzeniem tej strefy jako drugorzędnej, nie odkrytym problemem.

**Dowody:**

- Kod: VERIFIED dla wszystkich trzech powierzchni. VMI: potwierdzono brak importu klienta Supabase w repozytorium obsługującym wszystkie realnie osiągalne strony (`VmiPortalRepository`), potwierdzono osieroconą warstwę serwerową bez wywołań, potwierdzono brak katalogu migracji w `apps/vmi-client` i brak jakiejkolwiek migracji `*vmi*` w `apps/web/supabase/migrations`. Pulpit startowy: pełna treść pliku strony to jeden statyczny komponent kliencki bez pobierania danych. Analityka: dwie akcje serwerowe (`getOrgActivityAction`, `getAuditFeedAction`) potwierdzone jako realne zapytania z kontrolą uprawnień i aktywnej organizacji.
- Testy automatyczne: NOT VERIFIED dla VMI (nie sprawdzano w tej sesji, nieistotne przy braku backendu). Pulpit startowy ma jeden test potwierdzający, że renderuje wyłącznie statyczny nagłówek — spójne z ustaleniem. Analityka nie była przedmiotem szczegółowego przeglądu testów w tej sesji.
- Weryfikacja ręczna: NOT VERIFIED dla żadnej z trzech powierzchni w tej sesji.
- Przebieg end-to-end: NOT APPLICABLE dla VMI i pulpitu startowego (nie ma spójnego przepływu do zweryfikowania — jeden to atrapa bez trwałości, drugi to pusta strona); NOT VERIFIED dla kanałów analityki (kod realny, brak świeżej próby na żywo).

**Wymagany stan dla pitchu:** ROADMAP ONLY (dla VMI); brak wymogu demonstracji (dla pulpitu i analityki)

### Pitch readiness checklist

- [ ] VMI nie jest pokazywane na żywo podczas pitchu — dziś to atrapa bez trwałości danych; ryzyko pokazania czegoś, co znika po odświeżeniu, jest realne i niepotrzebne.
- [ ] Jeśli VMI jest wspominane słownie, opisane jest wyłącznie jako kierunek produktowy/wizja, nigdy jako działający portal klienta.
- [ ] Pulpit startowy (`/dashboard/start`) nie jest punktem wejścia demo ani celowym przystankiem — dziś to pusty ekran powitalny, który wygląda na niedokończony; nawigacja po zalogowaniu powinna iść bezpośrednio do właściwego modułu demo (Strefy 2–3), nie zatrzymywać się tu.
- [ ] Jeśli podczas pitchu przypadkowo pojawi się pulpit startowy (np. przez link po zalogowaniu), prezenter wie, że to oczekiwany, nieukończony ekran, nie błąd — i przechodzi dalej bez komentarza.
- [ ] Kanały aktywności/audytu (Strefa Analityka) nie są wymagane w pokazie, ale są bezpieczne do krótkiego pokazania, jeśli prezenter chce zilustrować „historię działań" — są realne, nie atrapą — pod warunkiem świeżej ręcznej próby, jeśli zostaną użyte.
- [ ] Strona przeglądu analityki (`/dashboard/analytics`, pusty placeholder) nie jest odwiedzana podczas pitchu.

Brama końcowa nie jest wymagana dla VMI ani pulpitu (roadmapa/nawigacja, nie demo). Jeśli kanały aktywności/audytu zostaną świadomie włączone do pokazu, wymagana jest ich świeża, ręczna weryfikacja jak w innych strefach — ale to opcjonalne wzbogacenie, nie blokada.

**Pitch gap:**

Brak luki blokującej główny pitch — żadna z trzech powierzchni nie jest częścią obiecanej demonstracji. Jedyne realne ryzyko jest nawigacyjne/retoryczne: przypadkowe zatrzymanie się na pustym pulpicie startowym po zalogowaniu wygląda niedopracowane, a pokazanie VMI na żywo (nawet w dobrej wierze, jako „kolejny krok") ujawniłoby, że nic się nie zapisuje i że dostęp nie wymaga żadnych poświadczeń — to należy świadomie unikać, nie naprawiać przed pitchem.

**Wymagany stan dla pilotażu:** Not required for initial controlled pilot — żadna z trzech powierzchni nie jest częścią zakresu pilotażu zdefiniowanego w Strefie 12

### Pilot readiness checklist

Żadna z poniższych pozycji nie jest wymaganiem przed pilotażem opisanym w Strefie 12 — pilotaż dotyczy magazynu jednego oddziału, nie klientów zewnętrznych ani rozbudowanej analityki. Zachowane wyłącznie jako przyszły backlog, jeśli produkt kiedykolwiek rozszerzy zakres:

- [ ] (Przyszłość, nie pilotaż) Jeśli VMI ma kiedyś obsłużyć realnych zewnętrznych użytkowników: prawdziwe uwierzytelnienie zastępujące ciasteczko demo, prawdziwa tożsamość klienta powiązana z organizacją/oddziałem, rzeczywisty schemat bazy zamiast szkicu poza migracjami, trwałość wszystkich operacji zapisu, izolacja dostępu między klientami, oraz połączenie z rzeczywistymi danymi magazynowymi `apps/web` zamiast atrapy.
- [ ] (Przyszłość, nie pilotaż) Jeśli pulpit startowy ma stać się realnym centrum operacyjnym: zdefiniowanie, jakie dane rzeczywiście powinien pokazywać, i zbudowanie ich od zera — dziś nie ma nawet częściowej implementacji do rozszerzenia.
- [ ] (Przyszłość, nie pilotaż) Jeśli szersza analityka/BI ma powstać: określenie zakresu wykraczającego poza dwa istniejące kanały aktywności/audytu.

**Pilot gap:**

Nie dotyczy — żadna z trzech powierzchni nie jest częścią trzymiesięcznego, ograniczonego do jednego oddziału pilotażu zdefiniowanego w Strefie 12. Nie należy sztucznie włączać ich do zakresu pilotażu.

### Notes / evidence

- VMI — bramka dostępu: `apps/vmi-client/src/lib/demo-session.ts` (stała wartość ciasteczka), `signInDemoClientAction` (`sign-in/actions.ts`) ustawia je bez sprawdzenia poświadczeń; `requireDemoSession()` wywoływane na starcie każdej z dziesięciu chronionych stron (portal, inventory, orders, proposals, messages, stock-counts, settings, vendors i podstrony).
- VMI — dane: `VmiPortalRepository` (`src/lib/vmi-portal/repository.ts`) nie importuje żadnego klienta Supabase; wszystkie metody (odczyt i zapis) operują na `vmiPortalSnapshotFixture` (`fixtures.ts`, ręcznie napisane polskie dane demo); zapisy (`createOrder`, `submitStockCount`, `sendMessage`) zwracają syntetyczne identyfikatory (`mock-order-${Date.now()}`) i nie są trwałe.
- VMI — osierocona warstwa realna: `apps/vmi-client/src/app/actions/vmi/index.ts` i powiązane serwisy mają prawdziwe wywołania Supabase (`auth.getUser()`, RPC `vmi_can_manage`, zapytania do `vmi_client_accounts` itd.), ale zero wywołań z jakiejkolwiek strony w aplikacji; docelowe tabele istnieją wyłącznie jako `docs/VMI_DATABASE_SCHEMA_DRAFT.sql`, z jawnym komentarzem, że jest to szkic świadomie trzymany poza katalogiem migracji do czasu zamrożenia schematu.
- VMI — brak migracji: `apps/vmi-client` nie ma katalogu `supabase/`; żadna migracja `*vmi*` nie istnieje w `apps/web/supabase/migrations` (303 pliki, zero trafień).
- VMI — brak połączenia z danymi `apps/web`: zero odwołań do `inventory_products`/`inventory_balances`/`organizations`/`branches` w całym `apps/vmi-client/src`.
- Pulpit startowy: pełna treść `apps/web/src/app/[locale]/dashboard/start/page.tsx` to komponent kliencki renderujący wyłącznie `PageHeaderV2` ze statycznym tytułem/opisem — brak pobierania danych, brak komponentu serwerowego. Jedyny realny, zasilany bazą element blisko tego miejsca to podgląd aktywności w pasku stanu powłoki dashboardu (`DashboardStatusBar.tsx`, obecny na każdej stronie, nie tylko na starcie), zasilany `getLatestActivityAction()`.
- Analityka: `/dashboard/analytics` (przegląd) to placeholder — sam tytuł/podtytuł, zero zapytań. `/dashboard/analytics/activity` i `/dashboard/analytics/audit` są realne — wywołują odpowiednio `getOrgActivityAction`/`getAuditFeedAction`, które sprawdzają aktywną organizację i uprawnienia (`ANALYTICS_ACTIVITY_READ`/`ANALYTICS_AUDIT_READ`) przed zapytaniem do `platform_events`. Zero zahardkodowanych wartości znalezionych na tych stronach.
- Klasyfikacja poprzednich ustaleń trackera: stwierdzenie „nie potwierdzono dostępnego end-to-end VMI w web; tabele/stare deklaracje nie wystarczają" — **CONFIRMED**, i doprecyzowane (dziś wiadomo dokładnie dlaczego: fixture bez backendu, brak migracji, osierocona warstwa realna). Zachowany backlog VMI (wiarygodne katalogi/dostawcy/lokalizacje/progi/audyty jako fundament, potem prawdziwy backend VMI, konta klientów, trwała komunikacja/zamówienia, połączenie z Warehouse, izolacja, E2E bez fixtures) — **CONFIRMED** jako wciąż aktualny i kompletny opis brakującej pracy, nic nie wymaga korekty.
- Żadna z trzech powierzchni nie jest wymagana przez skrypt prezentacji (§2–13 — główna narracja Matcher→przyjęcie→magazyn→wydanie→historia→tickety) ani przez zakres pilotażu ze Strefy 12.

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
