### 11. Home / Operational Dashboard

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL — IMPLEMENTED AND TESTED; GLOBAL BUILD GATE OPEN

Ta strefa jest aktywną strefą produktową wydzieloną z dawnej Strefy 16 („VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu”) oraz potwierdzającej wzmianki w dawnej Strefie 19 („...zbiorczy dashboard”). W przeciwieństwie do VMI i szerszej analityki (które pozostają wyłącznie roadmapą — patrz [Product Roadmap](../planning/product-roadmap.md) oraz zarchiwizowane audyty dawnych Stref 16/19), wspólny pulpit startowy jest teraz minimalnym, realnym centrum operacyjnym: pokazuje kontekst, dozwolone wejścia do pracy, rzeczywistą kolejkę ważnych ticketów i osobistą aktywność. Zaakceptowany audyt pustego placeholdera pozostaje niżej bez zmian jako historia stanu przed implementacją.

**Dlaczego 🟡 PARTIAL, mimo zakończonego zakresu samej strony:** kod Strefy 11 przechodzi 38 testów Vitest, scoped ESLint, pełny `tsc --noEmit` i sześć testów Playwright na żywych danych. Zweryfikowano branch scope, empty/populated state, nawigację, responsive layout oraz 30 kombinacji 15 skins × light/dark. Nie można jednak oznaczyć strefy jako DEMO READY według przyjętej definicji, dopóki pełny `next build` aplikacji kończy się błędem istniejącej trasy auth bez root layoutu. Ten błąd nie pochodzi ze Strefy 11 i nie jest naprawiany w tym izolowanym workstreamie.

**Wymagany stan dla pitchu:** DEMO READY

**Zaakceptowany kierunek dla pitchu (ustalony w tym przebiegu restrukturyzacji, nie w ramach product clarification):** minimalny, realny wspólny pulpit operacyjny zastępujący dzisiejszy placeholder — nie pełna analityka/BI. Ustalono na tym etapie wyłącznie kierunek, nie konkretne widżety:

- aktywny oddział/kontekst jest widoczny,
- pulpit musi korzystać z rzeczywistych danych,
- pulpit nie może pokazywać fikcyjnych/wymyślonych metryk,
- powinien dostarczać niewielką liczbę użytecznych podsumowań operacyjnych i/lub szybkich akcji,
- musi respektować kontekst oddziału i uprawnienia,
- powinien stanowić wiarygodną stronę startową aplikacji na potrzeby pitchu,
- zaawansowana analityka pozostaje roadmapą.

Dokładne widżety/zakres NIE są tu decydowane — to zadanie dla właściwego product clarification tej strefy (patrz pusty szkielet niżej).

## Accepted implementation audit (extracted excerpts from former Zones 16 and 19)

> Poniższe cztery fragmenty są przytoczone dosłownie z zaakceptowanych audytów dawnej Strefy 16 i dawnej Strefy 19 — wyłącznie te zdania/akapity, które dotyczą konkretnie wspólnego pulpitu startowego (`/dashboard/start`) i dają się jednoznacznie wyodrębnić bez ryzyka zmiany znaczenia. VMI i analityka (pozostała treść dawnej Strefy 16) oraz lakiery/nieroty/procedury (pozostała treść dawnej Strefy 19) NIE są tu powielane — pozostają w całości w zarchiwizowanych audytach: [archived Zone 16](../archive/zones/16-vmi-dashboard-analytics-retired.md), [archived Zone 19](../archive/zones/19-secondary-processes-retired.md).

### Excerpt — former Zone 16 audit, opis pulpitu startowego

- **Pulpit startowy (`/dashboard/start`)** — dziś to dosłownie jeden statyczny nagłówek powitalny bez żadnych danych, kart czy widżetów; nie jest centrum operacyjnym w żadnym sensie. Dokumentacja projektu (`CLAUDE.md`) opisuje nieistniejący dziś „moduł news feed z szybkimi akcjami" — to nieaktualny, aspiracyjny opis, nie stan kodu.

### Excerpt — former Zone 16 audit, Notes / evidence

- Pulpit startowy: pełna treść `apps/web/src/app/[locale]/dashboard/start/page.tsx` to komponent kliencki renderujący wyłącznie `PageHeaderV2` ze statycznym tytułem/opisem — brak pobierania danych, brak komponentu serwerowego. Jedyny realny, zasilany bazą element blisko tego miejsca to podgląd aktywności w pasku stanu powłoki dashboardu (`DashboardStatusBar.tsx`, obecny na każdej stronie, nie tylko na starcie), zasilany `getLatestActivityAction()`.

### Excerpt — former Zone 19 audit, zbiorczy dashboard operacyjny (potwierdzenie ustalenia Strefy 16)

- **Zbiorczy dashboard operacyjny** — potwierdzone ponownie (zgodnie z ustaleniem Strefy 16): `/dashboard/start` to jeden statyczny nagłówek bez danych; jedyne realne, zasilane bazą ekrany w tej okolicy to kanały aktywności/audytu ze Strefy 16, które są zupełnie inną rzeczą niż zagregowany operacyjny pulpit (tickety/terminy/braki/audyty/nieroty w jednym miejscu) opisany w starym backlogu tej strefy — taki pulpit nie istnieje w żadnej formie, nawet częściowej.

### Excerpt — former Zone 19 audit, Notes / evidence

- Dashboard: potwierdzone bez zmian względem Strefy 16 — `/dashboard/start` to statyczny nagłówek; brak jakiejkolwiek trasy zbiorczego/podsumowującego pulpitu operacyjnego pod `/dashboard/warehouse/` (tylko strony poszczególnych encji) ani gdziekolwiek indziej w aplikacji.

---

## Product clarification and final design

### Open questions

- Czy po ustabilizowaniu kontraktów Stref 3/5/7 dodać osobny widżet zleceń naprawczych lub przyjęć. Pierwsza wersja świadomie nie korzysta z tych niegotowych kontraktów.
- Czy w pilotażu pulpit ma pokazywać aktywność osobistą, czy nowy, szerszy feed operacyjny oddziału. Obecna etykieta precyzyjnie opisuje istniejący feed osobisty.
- Czy kierownik potrzebuje osobnej, bardziej agregowanej wersji. Nie jest to wymagane do pitchu i wymaga osobnego product clarification.

### Problems / ambiguities

- Pojęcie „wymaga uwagi” musiało mieć dokładną, audytowalną definicję. Przyjęto: niezakończone tickety o priorytecie `high` lub `urgent` w aktywnym oddziale.
- Istniejący feed aktywności jest feedem osobistym, a nie kompletną historią operacyjną oddziału. UI mówi o tym wprost.
- Przełącznik oddziału utrzymuje kontekst zakładki po stronie klienta, podczas gdy pulpit pobiera dane jako Server Component. Lokalna granica synchronizuje RSC przez parametr `branch`, ale parametr jest akceptowany wyłącznie po sprawdzeniu w serwerowej liście `accessibleBranches` i ponownym wczytaniu snapshotu uprawnień dla wybranego oddziału.
- Dla konta testowego i oddziału Blacharnia Komorniki istniejące trasy Lokalizacje i Zadania wracają do `/dashboard/start`, gdy brakuje wymaganego kontekstu modułu. Playwright potwierdza ich dokładne, zlokalizowane adresy w launcherze, lecz pełną nawigację wykonuje tylko dla dostępnych tras Narzędzi i Ticketów. Usunięcie tych redirectów wymaga pracy poza Strefą 11.
- Pełny build `apps/web` blokuje istniejąca, niezwiązana ze Strefą 11 trasa `src/app/auth/auth-code-error/page.tsx`, która nie ma root layoutu. Strona Strefy 11 kompiluje się w aktualnym serwerze Next; osobny `tsc --noEmit` obejmuje aplikację.

### Product decisions

- Pulpit pozostaje krótką stroną operacyjną, bez wykresów, trendów i marketingowego hero.
- Widoczny, ogólny nagłówek „Pulpit” i opis powitalny usunięto po przeglądzie produktu; strona zaczyna się bezpośrednio od kontekstu pracy. Semantyczny `h1` pozostaje dostępny dla czytników ekranu.
- Widoczny nagłówek nad rzędem szybkich akcji usunięto; semantyczna nazwa sekcji pozostaje dostępna dla czytników ekranu.
- Pulpit wykorzystuje pełną szerokość obszaru roboczego; usunięto centralny limit `max-w-7xl`. Przycisk odświeżania jest wyrównany pionowo z pierwszym wierszem kontekstu organizacji.
- Kontekst organizacji i aktywnego oddziału jest widoczny na początku strony. Oddział ma silniejszą hierarchię, jawny znacznik aktywnego kontekstu, a nagłówek pokazuje czas ostatniego renderu/odświeżenia.
- Szybkie akcje prowadzą wyłącznie do istniejących tras: Narzędzia, Lokalizacje, Tickety i Zadania. Każda akcja wymaga tego samego modułu i uprawnienia liścia co jej docelowa powierzchnia; Narzędzia zachowują istniejący model bez płatnego gate modułu.
- Pasek operacyjny pokazuje wyłącznie dwa wiarygodne, dokładne liczniki dla aktywnego oddziału: tickety wymagające uwagi oraz zadania w stanach `open`/`in_progress`. Liczniki są powtórzone jako krótkie sygnały na odpowiednich kartach modułów. Niedostępny odczyt jest pomijany, a nie zastępowany fikcyjnym zerem.
- Widżet ticketów dziedziczy konfigurację kolorów i etykiet priorytetów organizacji oraz istniejący styl typu ticketu (kolorowana kropka i obrys). Ustawienia wizualne są opcjonalne: ich awaria nie ukrywa właściwej kolejki.
- Ostatnia aktywność używa istniejącej, autoryzowanej projekcji `getPersonalActivityAction`, jest ograniczona do pięciu elementów po odfiltrowaniu innych oddziałów i zachowuje zdarzenia konta/organizacji z `branch_id = null`. Renderuje kompaktową oś czasu z istniejącą kategorią zdarzenia i rzeczywistym timestampem.
- Sekcja organizacji pracy konsumuje istniejące kontrakty Planning: dzisiejszy agregat kalendarza użytkownika, branch-scoped zadania `open`/`in_progress` oraz pierwszą widoczną tablicę Kanban z jej rzeczywistymi kolumnami. Nie definiuje nowych statusów, zdarzeń ani modelu cykliczności.
- Mikrointerakcje korzystają z CSS i istniejących tokenów; nie dodano klientowej granicy ani biblioteki animacji do kart. Ruch jest krótki, a transformacje i spinner respektują `prefers-reduced-motion`.
- RepairOrders, dostawy, rezerwacje, alokacje, kontenery, wydania, materiały, dostawcy, audyty i powiadomienia nie są źródłami widżetów tej wersji.

### Final intended workflow

1. Po zalogowaniu użytkownik trafia na `/dashboard/start` i od razu widzi organizację oraz aktywny oddział.
2. Wybiera dozwoloną szybką akcję albo ocenia kolejkę ważnych ticketów.
3. Kliknięcie ticketu otwiera jego realny szczegół, a „Otwórz kolejkę” przenosi ten sam zakres filtrów do listy ticketów.
4. Podgląd aktywności daje krótki kontekst ostatnich działań użytkownika bez sugerowania, że jest historią całego oddziału.
5. Zmiana oddziału ukrywa stary zakres, pobiera ponownie autoryzowany kontekst i pokazuje dane nowego oddziału. Trzy sprawdzone oddziały zwróciły odpowiednio 4, 1 i 0 ticketów w kolejce.

### Architecture implications

- `page.tsx` jest asynchronicznym Server Componentem. Pobiera kontekst, moduły i aktualny snapshot uprawnień po stronie serwera.
- Widżety ticketów i aktywności są niezależnymi asynchronicznymi Server Components pod osobnymi granicami `Suspense`.
- Jedyną nową granicą klienta jest `HomeScopeBoundary`: synchronizacja kontekstu oddziału i ręczne odświeżenie. Brak pollingu, chart library i klientowego pobierania danych domenowych.
- Adapter ticketów korzysta z istniejącego `HelpdeskTicketsService.listForDataView` z zakresem `orgId`, `branchId`, limitem pięciu rekordów i dokładnym `count`.
- Licznik zadań korzysta z istniejącego `PlanningTasksService.listForDataView`, `pageSize: 1`, dokładnego `count`, aktywnego `branch_id` i stanów `open`/`in_progress`; pulpit nie przejmuje logiki planowania.
- Podgląd Planning używa `PlanningTasksService`, `getPlanningCalendarDataAction`, `KanbanBoardsService` i `UserPreferencesService`. „Dzisiaj” jest wyliczane w zapisanej strefie czasowej użytkownika; kalendarz zachowuje własny org/user scope, zadania są dodatkowo ograniczone do aktywnego oddziału, a Kanban zachowuje swój istniejący model widoczności prywatnej/publicznej.
- Adapter aktywności korzysta z istniejącej projekcji widoczności zdarzeń, a nie z surowej tabeli audytowej.
- Błąd opcjonalnego widżetu jest zamieniany na neutralny stan `unavailable`; treść błędu Supabase/SQL nie trafia do UI.
- Komponenty używają istniejących prymitywów `Card`, `Badge`, `Button`, `Skeleton`, `Link` i tokenów semantycznych. Nie dodano biblioteki ani systemu stylistycznego.

### Readiness progression plan

- [x] Placeholder zastąpiony rzeczywistym pulpitem operacyjnym.
- [x] Organizacja, oddział i szybkie akcje zależne od dostępu są renderowane z kontekstu serwerowego.
- [x] Kolejka ticketów używa trwałych danych i rzeczywistego licznika.
- [x] Feed osobisty używa istniejącej projekcji uprawnień i ma prawdziwy empty/error state.
- [x] Zmiana oddziału ponownie zakresuje dane bez pozostawienia starego widżetu na ekranie.
- [x] Zweryfikowano populated i empty/low-data state na żywo.
- [x] Zweryfikowano układ 320×800, 360×800, 390×844, 430×932, 768×1024, 1024×768, 1280×800, 1440×900 i 1920×1080 bez poziomego overflow.
- [x] Zweryfikowano wszystkie 15 selectable skins w light i dark (30 kombinacji tokenów); wizualnie przejrzano Default light, Graphite dark i widoki mobilne.
- [x] Testy jednostkowe/komponentowe obejmują dostęp, scope, mapowanie, empty/error i formatowanie.
- [x] Playwright potwierdza dokładne adresy czterech wejść, otwieranie dostępnych tras Narzędzi i Ticketów, kolejkę, nawigację klawiaturą, ręczny refresh, globalne menu szybkiego dodawania oraz zmianę i przywrócenie oddziału bez fatalnych błędów konsoli na stronie. Istniejące redirecty Lokalizacji i Zadań opisano wyżej.
- [x] Podgląd Planning pokazuje realny empty/populated state i prowadzi do kanonicznych powierzchni Kalendarza, Zadań i Tablicy.
- [x] Scoped ESLint oraz pełny `tsc --noEmit` kończą się kodem 0.
- [ ] Pełny build całej aplikacji przechodzi — obecnie blokuje go istniejący route-level problem poza Strefą 11 opisany wyżej.

### Final pitch scope

Pokazać krótko: aktywny oddział → cztery dozwolone wejścia do pracy → realny plan dnia, zadania i snapshot Kanban → kolejka ważnych ticketów → osobista ostatnia aktywność. Podkreślić, że każdy element prowadzi do działania. Nie nazywać tego analityką całego warsztatu, nie pokazywać trendów i nie obiecywać jeszcze podsumowań RepairOrders/dostaw ani zadań cyklicznych.

### Final controlled-pilot scope

- Ustalić role, które mają otrzymać wariant kierowniczy, i zweryfikować ich rzeczywiste fixture/accounty.
- Po ustabilizowaniu Stref 3/5/7 ocenić widżety zleceń, przyjęć i wydań na podstawie nowych publicznych kontraktów odczytu.
- Zdecydować, czy potrzebny jest oddziałowy feed operacyjny oraz kontrakt agregacyjny zoptymalizowany pod pulpit.
- Dodać monitoring czasu odpowiedzi i błędów opcjonalnych widżetów przed rozpoczęciem pilotażu.

### Implementation and verification work plan

- Kod i testy są odizolowane w worktree `D:\dev\ambra-zone11-dashboard` na branchu `codex/zone11-home-dashboard`, utworzonym z `c5d9e47f`.
- Weryfikacja końcowa obejmuje scoped Vitest i ESLint, pełny `tsc --noEmit`, próbę pełnego Next build, Playwright Chromium oraz manualny przegląd screenshotów.
- Wyniki z 2026-09-12: Vitest 5/5 plików i 38/38 testów; Playwright Chromium 6/6 testów; ESLint exit 0; `tsc --noEmit` exit 0; `git diff --check` exit 0.
- Próba pełnego `next build --webpack`: FAIL przed sprawdzeniem wszystkich tras — `auth/auth-code-error/page.tsx doesn't have a root layout`. Jest to istniejący plik poza zakresem i bez zmian w tej gałęzi.
- Nie zmieniono migracji, RLS, schematu, RPC, RepairOrders, Matchera, ruchów magazynowych, rezerwacji, alokacji ani kontenerów.
