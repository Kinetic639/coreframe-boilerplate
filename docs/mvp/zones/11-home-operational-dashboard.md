### 11. Home / Operational Dashboard

**Priorytet:** P1

**Stan obecny:** 🔴 NOT IMPLEMENTED

Ta strefa jest nową, aktywną strefą produktową wydzieloną z dawnej Strefy 16 („VMI, pulpit startowy i pozostałe drugorzędne powierzchnie produktu") oraz potwierdzającej wzmianki w dawnej Strefie 19 („...zbiorczy dashboard"). W przeciwieństwie do VMI i szerszej analityki (które pozostają wyłącznie roadmapą — patrz [Product Roadmap](../planning/product-roadmap.md) oraz zarchiwizowane audyty dawnych Stref 16/19), wspólny pulpit startowy przestaje być traktowany jako drugorzędna/roadmapowa powierzchnia: `/dashboard/start` to dziś ekran powitalny każdego zalogowanego użytkownika, a zaakceptowany audyt ustalił, że jest on pustym placeholderem. To materialnie wpływa na pierwsze wrażenie z pitchu, dlatego staje się osobną, aktywną strefą wymagającą minimalnej, realnej implementacji przed pitchem — nie pełnej analityki/BI.

**Dlaczego 🔴 NOT IMPLEMENTED, nie 🟠 EARLY/DISCONNECTED:** zaakceptowany audyt (cytowany dosłownie niżej) ustalił, że `/dashboard/start` to jeden statyczny komponent kliencki renderujący wyłącznie nagłówek, bez pobierania jakichkolwiek danych i bez komponentu serwerowego — nie istnieje żaden dedykowany prymityw tego ekranu (żadna częściowa tabela, akcja czy zapytanie), który byłby dziś "rozłączony". Jedyny realny, zasilany bazą element w pobliżu (`DashboardStatusBar.tsx`, podgląd aktywności) nie jest częścią samego ekranu startowego — jest obecny na każdej stronie dashboardu, nie tylko na starcie, i nie jest przez to budulcem tej konkretnej strefy. Dlatego status to 🔴 NOT IMPLEMENTED, a nie 🟠 — nie ma tu istniejących, rozłączonych prymitywów specyficznych dla tego ekranu, do których nawiązywałby status EARLY/DISCONNECTED.

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

_To be reviewed together before implementation._

### Problems / ambiguities

_To be reviewed together before implementation._

### Product decisions

_No final decisions recorded yet._

### Final intended workflow

_To be defined after product clarification._

### Architecture implications

_To be defined after the intended workflow is agreed._

### Readiness progression plan

_To be rebuilt after clarification._

### Final pitch scope

_To be defined after clarification._

### Final controlled-pilot scope

_To be defined after clarification._

### Implementation and verification work plan

_To be defined after clarification._
