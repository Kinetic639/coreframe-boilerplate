# Ambra — Future Product Roadmap

## Purpose

Ten dokument NIE jest trackerem gotowości pitchu/pilotażu i nie zawiera bramek DEMO READY, blokerów pitchu, statusów gotowości P0–P4 ani rozbudowanych list checkboxów. Nie jest też planem sekwencjonowania implementacji dla obecnego pitchu — to zadanie [master trackera](../mvp-readiness.md) i aktywnych stref produktowych w `docs/mvp/zones/`.

Ten dokument zbiera i porządkuje przyszłe kierunki produktowe wykraczające poza obecny, skoncentrowany na pitchu zakres implementacji — materiał przydatny do planowania po pilotażu, nie wymóg przed pitchem ani przed pierwszym kontrolowanym pilotażem. Szczegółowe, zaakceptowane audyty stojące za każdym z poniższych obszarów pozostają w całości zarchiwizowane w `docs/mvp/archive/zones/` — ten dokument jest celowo zwięzły i nie powiela ich treści; tam, gdzie to przydatne, linkuje do konkretnego zarchiwizowanego audytu. Priorytety tej roadmapy zostaną ponownie przejrzane po uzyskaniu dowodów z kontrolowanego pilotażu, nie są ustalone teraz.

## Inventory expansion

- Materiały / artykuły eksploatacyjne (dziś: zwykły produkt katalogowy z flagą `consumable`, nie osobna domena).
- Zarządzanie dostawcami (dziś: trzy rozłączone, niedomknięte warstwy — placeholder stron, powiązanie CRM osadzone w produkcie, w pełni zbudowany na poziomie bazy/serwisu system `inventory_purchase_orders`/`inventory_suppliers` bez żadnego wywołania z UI).
- Wsparcie uzupełniania zapasu / zamówienia zakupu (procurement) — sugestie uzupełnienia są dziś realne i liczone na żywo, ale akceptacja to wyłącznie zapis decyzji, nie tworzenie dokumentu zamówienia.
- Bogatsze audyty magazynowe — sam mechanizm liczenia/księgowania różnic jest dziś realny i domknięty (patrz zarchiwizowany audyt), przyszły kierunek to rozszerzenie zakresu (cykliczne audyty, szerszy raport).
- Kierunek zarządzania lakierami — dziś zero reprezentacji w kodzie.
- Wiek zapasu / nieroty (stock aging / non-moving stock) — dane źródłowe (`last_movement_at`/`last_movement_id`) istnieją i są dziś pokazywane jako zwykła kolumna „Ostatni ruch", ale zero logiki wieku zapasu, progu czy raportu rotacji.

Źródło szczegółów: [archived Zone 15](../archive/zones/15-materials-suppliers-audits-retired.md), [archived Zone 19](../archive/zones/19-secondary-processes-retired.md).

## External integrations

- Integracja AutoStacja / DMS — dziś zero bezpośredniej integracji API gdziekolwiek w repozytorium; Matcher to wczytywanie wydrukowanych/wyeksportowanych dokumentów PDF, nie integracja systemowa.
- Przyszły import/synchronizacja i uzgadnianie (reconciliation) — dziś zero infrastruktury (brak `external_id`/`source_system`/`sync_status` w schemacie).
- Import historyczny (migracja starych zleceń/ruchów/klientów/pojazdów) — świadomie poza zakresem zgodnie z ustaloną strategią stanu początkowego ([Controlled Pilot Planning](../planning/controlled-pilot.md)).
- Monitorowanie VGP / zewnętrzny konektor ticketów jako **przyszły pomysł / kandydat do dalszego rozpoznania** — **nie jest to zaakceptowany wymóg implementacyjny**; wzmiankowany wyłącznie jako możliwy przyszły kierunek związany z retired zawartością dawnej Strefy 18. Patrz [archived Zone 18](../archive/zones/18-exceptional-workflows-retired.md) dla pełnego, historycznego kontekstu Customer Care VGP.

Źródło szczegółów: [archived Zone 17](../archive/zones/17-autostacja-dms-retired.md).

## External product surfaces

- VMI (`apps/vmi-client`) — dziś w pełni oparty na atrapie (fixture) prototyp UI bez żywego backendu na osiągalnej ścieżce; osobna, osierocona warstwa serwerowa istnieje, ale nie jest wywoływana z żadnej strony, a docelowe tabele istnieją wyłącznie jako szkic SQL poza katalogiem migracji.

Źródło szczegółów: [archived Zone 16](../archive/zones/16-vmi-dashboard-analytics-retired.md).

## Analytics & reporting

- Zaawansowana analityka / BI wykraczająca poza dwa dziś realne, zasilane bazą kanały (aktywność organizacji, audyt).
- Skonsolidowane raportowanie międzyoddziałowe.
- Raportowanie wieku zapasu / nierotów.

**Uwaga:** wspólny pulpit startowy (`/dashboard/start`) NIE jest już wyłącznie roadmapą — jego minimalna, realna wersja stała się aktywną strefą pitchową: [Zone 11 — Home / Operational Dashboard](../zones/11-home-operational-dashboard.md). Tutaj, w roadmapie, pozostaje wyłącznie zaawansowana analityka/BI wykraczająca poza ten minimalny pulpit.

Źródło szczegółów: [archived Zone 16](../archive/zones/16-vmi-dashboard-analytics-retired.md), [archived Zone 19](../archive/zones/19-secondary-processes-retired.md).

## Future operational domains

- Zwroty (returns) jako proces biznesowy — dziś jedyny zbliżony mechanizm to generyczne odwracanie ruchu magazynowego (korekta księgowa, nie zwrot biznesowy).
- Reklamacje / gwarancja (complaints/warranty) — brak dedykowanej domeny.
- Wydanie awaryjne (emergency issue) — dziś nie istnieje w kodzie w żadnej formie.
- Rozszerzenia Customer Care (w tym potencjalny przyszły konektor VGP, patrz „External integrations" wyżej).
- Procedury / baza wiedzy — dziś zero reprezentacji; istniejący link nawigacyjny „Baza wiedzy" prowadzi donikąd.

Źródło szczegółów: [archived Zone 18](../archive/zones/18-exceptional-workflows-retired.md), [archived Zone 19](../archive/zones/19-secondary-processes-retired.md).
