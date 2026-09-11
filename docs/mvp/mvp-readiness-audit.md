# Ambra — audyt gotowości prezentacyjnej `apps/web`

Data: **7 września 2026**. Wynik planistyczny: [tracker](mvp-readiness-pt.md). Źródło wymagań: [skrypt](ambra-skrypt-prezentacji.md), włącznie z propozycją pilotażu w §16–23.

## Zakres i metoda

Przejrzano trasy web, klientów ekranów, akcje, usługi, walidacje, rejestry QR/załączników, kontekst dostępu, używane migracje legacy/target i istniejące testy. Poza web sprawdzano tylko używane granice pakietów: `@repo/auth`, `@repo/domain` i typy Supabase. Nie audytowano innych aplikacji. Nie zmieniono kodu, migracji, konfiguracji ani danych.

To **audyt statyczny i plan gotowości**, nie certyfikat działania wdrożenia. Nie uruchomiono aplikacji ani fizycznej próby na telefonie, nie wykonano zapytań/mutacji zdalnej bazy. „Backend rzeczywisty” oznacza, że podłączony kod czyta/zapisuje tabele, Storage lub RPC; nie oznacza potwierdzenia wdrożenia tych migracji lub pełnego działania produkcji.

Ważne rozróżnienia: **rzeczywista implementacja**, **częściowy backend/workflow**, **shell**, **dane demonstracyjne/stan lokalny**, **kod niepodłączony**, **brak wystarczających testów** oraz **brak próby prezentacyjnej** mogą występować jednocześnie w jednym module. Nie nadano procentów gotowości na podstawie liczby stron/checków.

## Najważniejszy wniosek

Web ma znaczący, rzeczywisty fundament biznesowy i magazynowy. Nie jest jednak jeszcze implementacją całej historii ze skryptu. Największa luka leży pomiędzy **utrwalonym wynikiem Matchera a fizycznym, wznawialnym rozłożeniem dostawy**. Kolejne luki to minimalne zlecenie jako punkt odnajdywania części, QR części/zestawu, dostępny ruch zestawu oraz podpisany dokument przy wydaniu.

Nie należy naprawiać tej sytuacji przez kończenie materiałów, zadań cyklicznych lub dashboardu. Należy doprowadzić do końca jeden mały cykl części i zweryfikować go na dwóch urządzeniach. Przyszłe prace mogą wykorzystywać istniejący silnik ruchów; audyt nie narzuca nowej architektury.

## Dowody implementacji

Ścieżki rozpoczynające się od `src/` są względem `apps/web`. Trasy zapisano w formie źródłowej; polskie adresy są lokalizowane przez routing aplikacji.

### A1 — uwierzytelnienie, organizacje, oddziały, użytkownicy i ochrona danych

- [Klient serwerowy](../../apps/web/src/utils/supabase/server.ts) używa sesji cookies i klucza publicznego; loadery `src/server/loaders/v2/load-{app,user,dashboard}-context.v2.ts` ustalają organizację, oddział i snapshot. `load-user-context.v2.ts` wywołuje `auth.getUser()` przed użyciem sesji. `src/server/services/auth.service.ts` eksportuje używany `@repo/auth`.
- [Usługa organizacji](../../apps/web/src/server/services/organization.service.ts) obsługuje profile, członków, zaproszenia, role i oddziały na prawdziwych tabelach/RPC. Zaproszenie ma eligibility check i `accept_invitation_and_join_org`; członkostwa i role nie są tylko elementami UI. Akcje `src/app/actions/organization/` walidują wejście i uprawnienia; role korzystają z `@repo/domain/organization`.
- [Zmiana oddziału](../../apps/web/src/app/actions/shared/changeBranch.ts) sprawdza użytkownika, przynależność oddziału do organizacji i dostępność dla użytkownika, następnie zapisuje preferencję. [PermissionServiceV2](../../apps/web/src/server/services/permission-v2.service.ts) czyta kompilowane uprawnienia. [Guard magazynu](../../apps/web/src/app/actions/warehouse/inventory/action-context.ts) sprawdza moduł, uprawnienie Warehouse i aktywny oddział.
- Są migracje RLS organizacji/uprawnień w `apps/web/supabase/migrations`, a silnik inventory i część nowszych zmian w `apps/web/supabase-target/supabase/migrations`. Klient runtime wskazuje URL ze środowiska. Sam fakt istnienia obu drzew i typów `target.types.ts` nie dowodzi, które zmiany są wdrożone.
- Polityki Matchera w [migracji tabel](../../apps/web/supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql) używają `has_permission(organization_id, ...)`; filtrowanie sesji w UI/serwisie po oddziale nie dowodzi bazowej izolacji oddziałowej. Natomiast polityki kontenerów w A6 używają `has_branch_permission`. Zakres trzeba określić i sprawdzić per obiekt, nie twierdzić, że wszystkie dane są branch-only.
- Testy: `src/server/services/__tests__/organization-*.test.ts`, `permission-v2.service.test.ts`, akcje organizacji/zmiany oddziału, loadery i SQL w `apps/web/supabase/tests`. `organization-rls.test.ts` korzysta z mocków. `organization-rls-integration.test.ts` ma prawdziwe klienty JWT, ale pomija testy bez zmiennych środowiskowych i używa service role do setup/teardown; w audycie go nie uruchamiano.

**Ocena:** rzeczywisty fundament, brak świeżej walidacji izolacji/deploymentu. P0 obejmuje dostęp ścieżki demo; pełne zarządzanie organizacją/użytkownikami jest P1, nie obowiązkiem wielominutowej demonstracji administracyjnej.

### A2 — publiczny Matcher i granica produktu

[next.config.ts](../../apps/web/next.config.ts) przekierowuje `/tools/svwms-wdd-matcher`, wariant EN i PL do `publicSiteUrl` z konfiguracji witryny marketingowej. Nie znaleziono implementacji anonimowego Matchera jako strony produktu web; zalogowany komponent ma osobną rejestrację w `src/lib/tools/registry.tsx`.

**Ocena:** zależność zewnętrzna prezentacji, nie zaudytowana inna aplikacja. Nie zweryfikowano anonimowego przetwarzania, braku zapisu ani informacji o używaniu od kwietnia. Pozostają konkretne kroki próby przed spotkaniem. Nie należy budować publicznego Matchera ponownie w web tylko dla pitchu.

### A3 — Matcher zalogowany i import do ruchów

- [Usługa Matchera](../../apps/web/src/server/services/wdd-matcher.service.ts): sesje z organizacją/oddziałem i numerem, pliki, bloki, linie, dopasowania, Storage i eksport. [Akcje](../../apps/web/src/app/actions/tools/wdd-matcher.ts): autoryzacja, przygotowanie ekstrakcji, zapis oraz ponowne pobranie; parser i matching w `src/lib/tools/svwms-wdd-matcher/{parser_v4,matcher}.ts`.
- `src/components/tools/svwms-wdd-matcher/index.tsx` pokazuje przygotowany wynik i wykonuje `runBackgroundPersistence`. Dane w cache mogą wyprzedzać zakończenie zapisu. Próba musi czekać na zapis i odtworzyć sesję na drugim urządzeniu; podgląd nie jest dowodem trwałości.
- [Adapter](../../apps/web/src/server/services/movement-import-adapters/svwms-wdd-matcher.adapter.ts) obsługuje przyjęcie `101`, wybiera sesje `ready_for_review`/`approved` danego oddziału z autorem. `getMovementImportCandidates` odrzuca sesje bez autora, z innego oddziału i niewłaściwego statusu. Import zachowuje identyfikatory źródła i numery zleceń w danych kanonicznych.
- `src/server/services/inventory-movement-imports.service.ts` rozwiązuje produkty/jednostki/lokalizacje; edytor `warehouse/inventory/movements/new/_components/movement-editor/` ma wybór źródła, sesji i naprawę niedopasowań. Zapis końcowy `use-movement-submission.ts` przekazuje standardowe linie ruchu i notatki; nie tworzy osobnej encji zlecenia ani stanu rozkładania dostawy.
- [Test granicy](../../apps/web/src/components/tools/svwms-wdd-matcher/__tests__/movement-import-boundary.test.ts) wymaga braku przycisku importu w wynikach Matchera. To zamierzony podział odpowiedzialności; nawigacja do edytora ruchu nie musi oznaczać błędu. Nie wolno jednak obiecać istniejącego bezpośredniego procesu skanowania.
- `persistPreparedSessionAction` zapisuje pliki/bloki/linie kolejnymi operacjami. Ponowienie/pośredni błąd wymaga sprawdzenia; brak podstaw, by uznać cały import za atomowy tylko dlatego, że końcowe księgowanie ma RPC.

**Testy:** `wdd-matcher-movement-import-candidates.test.ts`, `inventory-movement-import-preview.service.test.ts`, `warehouse-import-resolver.service.test.ts` oraz test granicy. To mocki i/lub asercje tekstu źródeł, nie E2E PDF → odłożona część. Nie znaleziono dedykowanej regresji parsera `parser_v4` i matchera na reprezentatywnych dokumentach w testach web.

**Ocena:** rzeczywisty, częściowo spięty backend; P0 dla trwałości, powtórzeń i przejścia do przyjęcia. `approved` opisuje matching, nie fizyczne zakończenie dostawy.

### A4 — katalog i zlecenia

[InventoryProductsService](../../apps/web/src/server/services/inventory-products.service.ts), akcje inventory i strony `warehouse/items` używają tabel/RPC produktów, wariantów, jednostek i stanów. Picker części ma backendowe wyszukiwanie; zakres wyszukiwania listy produktów nie jest tym samym co wyszukiwanie zlecenia.

`src/app/[locale]/dashboard/workshop/page.tsx` renderuje karty „coming soon”. [Migracja Workshop](../../apps/web/supabase/migrations/20260525110000_workshop_module.sql) dodaje uprawnienia i moduł do planów, nie tabelę warsztatowych zleceń. Dane zlecenia w Matcherze/importowanych notatkach są rzeczywiste, ale nie zastępują widoku zlecenie → wszystkie części → lokalizacje → wydania. Nie należy mylić purchase/sales orders z minimalnym zleceniem warsztatowym ze skryptu.

**Testy:** usługi produktów/rozszerzeń/importów oraz testy akcji inventory; `e2e/warehouse/products.spec.ts` sprawdza listę z danymi i link tworzenia, nie cykl zlecenia. **Ocena:** katalog z backendem; zlecenia jako workflow — luka P0. Nie ma potrzeby kończyć pełnego Workshop.

### A5 — lokalizacje i QR

- [WarehouseLocationsService](../../apps/web/src/server/services/warehouse-locations.service.ts), akcje lokalizacji/grup i strona `warehouse/locations` ładują trwałe dane. Istnieją mapa/drzewo, szczegóły, etykiety i odczyt stanów lokalizacji.
- [Rejestr QR](../../apps/web/src/server/qr/target-registry.ts) zawiera dokładnie `warehouse.location`, `helpdesk.ticket`, `planning.task`. Nie ma produktu/wariantu/kontenera. [API PDF](../../apps/web/src/app/api/qr/labels/route.ts) sprawdza uprawnienia i pobiera kontekst etykiety, [generator](../../apps/web/src/server/qr/label-pdf.tsx) renderuje tekst i obraz QR. Jest batch API z limitem 200 etykiet.
- `src/server/qr/public-token-resolver.ts` korzysta z serwerowego klienta uprzywilejowanego do rozstrzygnięcia tokena. Dostęp do docelowego widoku trzeba testować osobno; nie opisywać każdego kroku QR jako odczytu przez RLS klienta użytkownika.
- Komponent `src/components/qr/qr-camera-scanner.tsx` i jego test istnieją. Test kamery nie dowodzi pracy na docelowym telefonie, HTTPS, ostrości/skali wydruku ani zasięgu sieci.

**Testy:** `qr.service.test.ts`, `server/qr/__tests__/label-pdf.test.ts`, `app/api/qr/labels/__tests__/route.test.ts`, testy tokena/generowania/ZPL/kamery i usług lokalizacji. API mockuje m.in. generator PDF i serwisy. Cztery historyczne `[x]` i notatkę z 2026-08-06 zachowano z ograniczonym znaczeniem; nie uznano ich za bieżące zamknięcie P0.

### A6 — przyjęcie, put-away, sesja i kontenery

`src/app/[locale]/dashboard/warehouse/deliveries/page.tsx` oraz `warehouse/scanning/delivery/page.tsx` jawnie używają `WarehousePlaceholderPage`. Dawne `apps/web/docs/old_docs/DELIVERY_*` nie są dowodem działania obecnych tras.

[InventoryMovementsService](../../apps/web/src/server/services/inventory-movements.service.ts) wywołuje `inventory_create_draft`, `inventory_finalize_posting`, `inventory_create_and_finalize` i inne RPC. [Migracje bazowych RPC](../../apps/web/supabase-target/supabase/migrations/20260505092000_inventory_phase1_rpcs.sql) zawierają sprawdzenia uprawnień, blokady, idempotency key i sprawdzenie dostępnej ilości. To rzeczywisty mechanizm magazynowy, nie kompletny mobilny proces dostawy.

[Migracja placement](../../apps/web/supabase-target/supabase/migrations/20260617120000_inventory_location_placement.sql) tworzy reguły put-away, kontenery/linie, klucze zakresu organizacja/oddział, RLS/FORCE RLS i polityki branch permission. [Snapshot lokalizacji](../../apps/web/src/server/services/ambra-location-inventory.service.ts) odczytuje te dane, lecz przy brakującej relacji kontenerów/reguł zwraca pustą listę. Pusty ekran nie dowodzi poprawnego wdrożenia schematu.

**Ocena:** częściowy backend + shelle operacyjne. Nie znaleziono pełnej ścieżki skan części/zestawu → skan lokalizacji → potwierdzenie → postęp → zamknięcie → raport rzeczywistych lokalizacji. PDF/CSV Matchera nie jest takim raportem. To główny blocker P0.

### A7 — szukanie, przenoszenie i historia

- `searchPickerItems` w usłudze ruchów i `src/components/warehouse/inventory-item-picker-dialog.tsx` mają prawdziwe wyszukiwanie. [HeaderSearch](../../apps/web/src/components/v2/layout/header-search.tsx) filtruje moduły nawigacji; nie wyszukuje stanów/zleceń.
- Snapshot lokalizacji odczytuje `inventory_balances`, linie/nagłówki ruchów i katalog. Szczegóły lokalizacji wyświetlają stan, kontenery i historię; snapshot ma limity 2000 stanów i 500 linii ruchów. Nie traktować go jako kompletnej historii dowolnie dużego magazynu.
- [Akcje kontenerów](../../apps/web/src/app/actions/warehouse/ambra-location-inventory.ts) tworzą kontener, dodają/usuwają części i przenoszą (`801`). Wyszukanie `createLocationContainerAction`, `addItemsToContainerAction`, `removeItemFromContainerAction`, `relocateContainerAction` w `apps/web/src` nie znalazło wywołań poza definicjami. Widok listy jest podłączony; akcje mutacji nie są potwierdzoną ścieżką UI.
- `addItemsToContainerAction` aktualizuje alokacje przed insertem linii. `relocateContainerAction` księguje ruch, potem osobno zmienia alokacje i kontener. Część wyników aktualizacji nie jest sprawdzana. Te sekwencje nie są jedną transakcją; trzeba zweryfikować błędy/ponowienia i spójność. Nie raportujemy tu odtworzonego incydentu, tylko konkretną lukę w dowodzie niezawodności.

**Ocena:** części i historia mają podłączone odczyty; zlecenie, QR i ruch zestawu pozostają niekompletne. Brak dedykowanych testów kontenerowego przebiegu w badanych testach. P0, lecz tylko minimalna reorganizacja z §9, nie pełne zarządzanie logistyką kontenerów.

### A8 — wydanie

Istnieją widoki dokumentu/edytora/listy ruchów i backend księgowania z ilościami, źródłem/celem, odbiorcą i historią. To baza zwykłego wydania, nie dowód działającego wydania z poziomu zlecenia. Szczególnie `removeItemFromContainerAction` zwalnia alokację i soft-delete linii; nie zmniejsza stanu ruchem wydania. Nie należy go prezentować jako wydania części z regału.

Testy `src/app/actions/warehouse/inventory/__tests__/inventory-actions.test.ts` i testy migracji sprawdzają fragmenty operacji. Nie znaleziono E2E wyszukanie zlecenia → wydanie → nowy stan. **Ocena:** realny silnik, niedomknięta/niesprawdzona ścieżka pitchu P0. Awaryjne pobranie przeniesiono do P4.

### A9 — załączniki i archiwum wydań

[AttachmentsService](../../apps/web/src/server/services/attachments.service.ts) używa prywatnego `app-attachments`, metadanych, walidacji MIME/rozmiaru oraz czasowych URL. [Migracja](../../apps/web/supabase/migrations/20260607100000_generic_app_attachments.sql) wiąże dostęp z `can_access_comment_target`. Są akcje i trasy pobierania plików.

[Rejestr celów](../../apps/web/src/server/comments/target-registry.ts) obsługuje `helpdesk.ticket`, `planning.task`, `planning.kanban_card`, a nie wydanie/ruch. Zbadane szczegóły ruchu nie zawierają podłączenia uploadu tego typu. Zdjęcie przy tickecie nie realizuje obietnicy otwarcia konkretnego podpisanego wydania po kilku miesiącach.

**Ocena:** działający wzorzec backendu, brak integracji wymaganej w pitchu; P0 dla jednego zdjęcia przy wydaniu. Brak dedykowanego E2E archiwum w web. Podpis zbierany na papierze; podpis elektroniczny/OCR poza zakresem.

### A10 — helpdesk, akceptacja i QR problemu

[HelpdeskTicketsService](../../apps/web/src/server/services/helpdesk-tickets.service.ts), akcje `src/app/actions/help-desk/index.ts`, strony listy/nowego/szczegółów i [walidacja](../../apps/web/src/lib/validations/helpdesk.ts) obsługują prawdziwe tickety, przypisania, typy, status, terminy, komentarze/aktywność i akceptantów. [Migracja akceptacji](../../apps/web/supabase/migrations/20260529100000_helpdesk_acceptance_workflow.sql) ma RPC `helpdesk_accept_ticket`, kontrolę użytkownika/akceptanta i zapis decyzji. To nie shell.

Schema tworzenia nie zawiera identyfikatorów produktu/zlecenia/kontenera. QR ticketu działa jako oddzielny cel. Można uczciwie opisać etykietę sprawy na fizycznej części, ale nie zakładać relacji do katalogowej części. Akceptacja nie równa się pełnemu procesowi zwrotu: `closeTicket` ustawia status zamknięty bez sprawdzania `accepted_by` w tej metodzie; nie dowodzi to obowiązkowej blokady przed akceptacją ani ścieżki odrzucenia.

**Testy:** nie znaleziono dedykowanych testów usług/akcji helpdesk ani E2E ticketu w badanym web; testy wspólnych komponentów/QR nie zastępują przebiegu dwóch ról. **Ocena:** realny, częściowy workflow z niewystarczającym dowodem gotowości. P1: jeden ticket, komentarz, prosta akceptacja i QR. Rozbudowany zwrot/Customer Care P4.

### A11 — organizacja pracy

- [PlanningTasksService](../../apps/web/src/server/services/planning-tasks.service.ts) zapisuje zadania, przypisanie, terminy/statusy i aktywność; powiązane strony/akcje są rzeczywiste.
- [PlanningCalendarService](../../apps/web/src/server/services/planning-calendar.service.ts) agreguje zadania, tickety, karty i kalendarze z kontrolą uprawnień; `app-calendar.service.ts` obsługuje kalendarze aplikacji. Nie mylić daty/terminu z cyklicznym generowaniem zadań.
- [KanbanBoardsService](../../apps/web/src/server/services/kanban-boards.service.ts), akcje `src/app/actions/kanban/index.ts` i strona `planning/boards` czytają/zapisują tablice, kolumny, karty i historię; nie są wyłącznie komponentem drag-and-drop z fixtures.
- Nie znaleziono silnika reguł/generowania cyklicznych wystąpień w serwerze i badanych schematach planowania. [HeaderNotifications](../../apps/web/src/components/v2/layout/header-notifications.tsx) ma stan lokalny i TODO połączenia rzeczywistych powiadomień. Ekran `account/notifications` renderuje zapisane preferencje, nie operacyjny inbox.

**Testy:** usługi zadań/kalendarza, akcje kalendarza, walidacje i daty; brak dedykowanego E2E organizacji pracy i testów cykliczności/dostarczenia notyfikacji. **Ocena:** zadania/kalendarz/Kanban P2; cykliczność/powiadomienia P3. Sformułowanie skryptu „pracuję nad… część istnieje albo jest rozpoczęta” jest odpowiednie.

### A12 — materiały, dostawcy, audyty i zamawianie

Katalog inventory umożliwia reprezentację materiałów; [WarehouseItemSuppliersService](../../apps/web/src/server/services/warehouse-item-suppliers.service.ts) łączy pozycje z `crm_parties` i informacją dostawcy. CRM ma własne strony/akcje/usługi kontrahentów i kontaktów. Jednak `warehouse/suppliers/page.tsx` jest placeholderem — nie przedstawiać go jako gotowego katalogu dostawców.

[InventoryCountSessionsService](../../apps/web/src/server/services/inventory-count-sessions.service.ts) i strony `warehouse/audits` obsługują zakres liczenia, nieoczekiwane pozycje, różnice, akceptację i raport. `getReorderReport` czyta reguły i stany; akcje sugestii są trwałe, lecz nie oznaczają złożonego zamówienia. Strona `warehouse/reports/reorder` rzeczywiście wywołuje ten serwis. Purchase/sales/deliveries shelle nie dowodzą kompletnego procurementu.

**Testy:** `inventory-count-sessions.service.test.ts` jawnie mockuje Supabase, w tym symulacje odmów RLS; testy akcji, migracji/immutability i komponentów audytu, usługi dostawców/CRM. **Ocena:** znaczący częściowy backend z testami fragmentów; całość nie ma potwierdzonego E2E. P3 mimo liczby istniejących funkcji — §15 wymaga tylko wzmianki.

### A13 — pozostała roadmapa i martwe wejścia

Nie znaleziono obecnej dostępnej ścieżki end-to-end VMI, nierotów, wyspecjalizowanych lakierów ani procedur operacyjnych w fizycznych trasach web. Nie rozszerzano poszukiwań na inne aplikacje. `src/app/[locale]/dashboard/[...slug]/page.tsx` przekierowuje nieistniejące trasy do Tools; działający redirect/stary link nie jest działającym modułem. `dashboard/start/page.tsx` ma tylko nagłówek powitalny. Activity/audit log nie jest zbiorczym dashboardem ticketów, dostaw i brakujących części.

Wniosek: VMI P3 jako zapowiedź, reszta P4. Istniejące materiały/mapy/CRM/raporty nie uzasadniają dodawania kolejnych scen prezentacji. Analityka, billing, ustawienia profili i demonstratory UI poza potrzebnym fundamentem również nie wymagają prac przed pitchem.

## Testy — co faktycznie potwierdzono

Przejrzano definicje testów i ich zależności. **Żaden test aplikacji nie otrzymał w tym audycie wyniku PASS.** Próba uruchomienia 12 wybranych plików przez `pnpm exec vitest run` w `apps/web` zakończyła się exit code 1: **`'vitest' is not recognized as an internal or external command`**. Nie ma launchera `apps/web/node_modules/.bin/vitest.cmd` ani rootowego `node_modules/.bin/vitest.cmd`. Nie instalowano zależności dla dokumentacyjnego audytu ani nie uruchamiano testów zapisujących dane zdalne.

Wybrany zestaw próby (względem `apps/web/src`):

```text
app/api/qr/labels/__tests__/route.test.ts
server/services/__tests__/qr.service.test.ts
server/qr/__tests__/label-pdf.test.ts
components/qr/__tests__/qr-camera-scanner.test.tsx
components/tools/svwms-wdd-matcher/__tests__/movement-import-boundary.test.ts
server/services/__tests__/wdd-matcher-movement-import-candidates.test.ts
server/services/__tests__/inventory-movement-import-preview.service.test.ts
app/actions/shared/__tests__/changeBranch.test.ts
server/services/__tests__/inventory-products.service.test.ts
server/services/__tests__/planning-tasks.service.test.ts
server/services/__tests__/planning-calendar.service.test.ts
server/services/__tests__/warehouse-item-suppliers.service.test.ts
```

Istniejące E2E w `apps/web/e2e` dotyczą logowania, widoków członków/oddziałów i katalogu produktów. Nie pokrywają ciągłego procesu prezentacji. Testy tekstu migracji i źródeł potwierdzają fragmenty kontraktów, ale nie wykonują SQL ani kliknięć. Mockowany denial RLS nie dowodzi rzeczywistego odrzucenia przez bazę. Historyczne 20/20 etykiet zachowano wyłącznie jako historyczny wynik.

Po przygotowaniu środowiska potrzebne są przede wszystkim testy granic procesu: zapis/reload sesji, import bez dubli, skan/zapis/wznowienie, przeniesienie zestawu bez rozjazdu alokacji, wydanie/saldo oraz upload/ponowny odczyt z odmową dostępu. Nie wymagać pełnego pokrycia wszystkich modułów przed pitchem.

## Stwierdzenia skryptu wymagające domknięcia albo uczciwego zawężenia

| Skrypt                                                  | Co można poprzeć                                 | Co obecnie nie jest potwierdzone / co powiedzieć do czasu domknięcia                                                |
| ------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| §3: publiczne narzędzie bez zapisu, używane od kwietnia | Web ma redirect do publicznego narzędzia         | Zachowanie publicznego wdrożenia i historia używania wymagają osobnej próby/potwierdzenia autora                    |
| §5: organizacje, oddziały, role, RLS                    | Są rzeczywiste usługi, guardy i polityki         | Nie twierdzić, że przeprowadzono pełną walidację izolacji produkcji lub że każda tabela ma identyczny zakres        |
| §5: QR lokalizacji, części i innych obiektów            | Lokalizacja, ticket, zadanie                     | Brak celu części/kontenera w rejestrze; gotowy obraz QR nie jest obsługą części                                     |
| §5, §7, §9: proste zlecenia i ich części/lokalizacje    | Numery i kontekst zleceń z dokumentów            | Brak potwierdzonego minimalnego widoku zlecenia; Workshop to shell                                                  |
| §6: utworzenie sesji dostawy                            | Trwała sesja Matchera i import danych do ruchu   | Nazwać ją sesją Matchera do czasu spięcia z postępem fizycznego przyjęcia                                           |
| §7: telefon, postęp, koniec i raport dla DMS            | Silnik ruchów, parser, eksport wyniku            | Dedykowane trasy przyjęcia/skanowania są shellami; brak dowodu kompletnego put-away i raportu końcowych lokalizacji |
| §9: skan części, ruch zestawu, ciągła historia          | Stany i historia ruchów lokalizacji              | QR części/zestawu, podłączone mutacje kontenera i historia zlecenia nie są domknięte                                |
| §10: wydanie usuwa część z regału                       | Silnik księgowania zmienia stany                 | Nie mylić usunięcia linii kontenera z wydaniem; potrzebna próba pełnej ścieżki                                      |
| §10: zdjęcie podpisanego dokumentu konkretnego wydania  | Prywatne załączniki innych obiektów              | Brak celu wydania i podłączenia archiwum — ta obietnica wymaga pracy P0                                             |
| §12–13: ticket powiązany ze zleceniem/częścią/zestawem  | Ticket, komentarze, akceptacja, etykieta ticketu | Brak potwierdzonych relacji domenowych; uczciwy wąski pokaz to QR sprawy na części                                  |
| §12: wymagana akceptacja zwrotu                         | Akceptanci i RPC akceptacji                      | Nie twierdzić, że ukończono odrzucanie/eskalację/blokadę procesu zwrotu                                             |
| §14–15: prace nad organizacją pracy i przyszłe moduły   | Jest kod części wymienionych obszarów            | Zachować formę zapowiedzi; nie pokazywać preferencji/dzwonka jako działających powiadomień                          |
| §11 i §23: podsumowanie całego cyklu                    | Elementy cyklu istnieją                          | Nie mówić o gotowym całym workflow przed zamknięciem P0                                                             |

Skrypt nie został zmieniony. Tracker utrzymuje obowiązkowe sceny P0, zamiast po cichu usuwać najtrudniejsze obietnice. Jeśli zakres ma zostać świadomie zmniejszony, potrzebna będzie spójna późniejsza zmiana wypowiedzi i scenariusza; awaryjne nagranie nie zastępuje brakującej funkcjonalności.

## Co zmieniono względem dawnych 19 obszarów

Nowych sekcji także jest 19, ale to wynik nowego podziału, nie zachowanie dawnej struktury. Usunięto arbitralne numery checków 1–278; poniższa mapa zachowuje pochodzenie. Wszystkie dawne cztery `[x]` dotyczyły QR — zachowano je z kwalifikacją dowodu. Żadna inna funkcja nie została automatycznie ukończona.

| Dawny obszar                  | Nowy zakres i priorytet                            | Powód                                                                       |
| ----------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Etykiety/lokalizacje       | 5 P0; zawartość/ruch 7 P0; audyt 15 P3             | Oddzielenie prawdziwego QR lokalizacji od brakującej identyfikacji części   |
| 2. Komunikacja                | 11 P1; powiadomienia 14 P3                         | Jeden krótki ticket zamiast pełnego helpdesku                               |
| 3. Dokumenty dostawy          | 2–3 P0 i 6 P0                                      | Publiczny/zalogowany Matcher, trwałość i fizyczne rozłożenie to różne etapy |
| 4. Import AutoStacji          | 17 P4; wąski import 3 P0; stan początkowy 12 P1    | Skrypt dopuszcza brak pełnej migracji                                       |
| 5. Minimalne zlecenie         | 4 P0                                               | Okrojono do numeru/części/lokalizacji potrzebnych w demo                    |
| 6. Kontenery                  | 5–7 P0 w zakresie zestawu                          | Nie kończyć pełnej logistyki; nie zgubić obiecanej sceny ruchu zestawu      |
| 7. Rozkładanie                | 6 P0                                               | Dodano brakujące wznowienie, zakończenie i raport                           |
| 8. Wyszukiwanie               | 7 P0 + widok zlecenia 4 P0                         | Szukanie nawigacji nie jest wyszukiwaniem części                            |
| 9. Pobranie bez wiedzy części | 18 P4; zwykłe wydanie 8 P0                         | Skrypt pokazuje zwykłe wydanie, nie tryb awaryjny                           |
| 10. Papierowe wydania         | 9 P0; szersze archiwum 18 P4; retencja gate pilota | Zdjęcie przy wydaniu to istotna obietnica, nie cały DMS                     |
| 11. Zwroty                    | 11 P1; pełny proces 18 P4                          | Prosty przykład akceptacji wystarcza                                        |
| 12. Customer Care VGP         | 18 P4                                              | Szczegółowe SLA/integracja nie są wymagane                                  |
| 13. Powtarzalne zadania       | 14 P3; dodano osobno 13 P2                         | Istniejące zadania/kalendarz/Kanban nie oznaczają cykliczności              |
| 14. Materiały                 | 15 P3                                              | Roadmapa mimo rozbudowanego backendu                                        |
| 15. Lakiery                   | 19 P4                                              | Brak osobnego demo                                                          |
| 16. Nieroty                   | 19 P4                                              | Brak wymogu ukończenia                                                      |
| 17. Procedury                 | 19 P4                                              | Nie wspierają głównego przebiegu teraz                                      |
| 18. Dashboard                 | 19 P4                                              | Nie jest potrzebny do liniowego demo                                        |
| 19. VMI                       | 16 P3                                              | Wyłącznie dalszy kierunek                                                   |

**Dodane jawnie:** fundament dostępu/oddziału/RLS (1), katalog części (4), zarządzanie członkami/zaproszeniami/rolami (10), proposal pilota i stan początkowy (12), osobna klasyfikacja istniejącej organizacji pracy (13). Globalne kryteria podzielono na bezpieczeństwo pokazu, dopuszczenie pilota i dalszą produkcję. Backup restore, staging, monitoring, RLS i E2E nie zniknęły — otrzymały właściwe momenty obowiązywania.

## Weryfikacja dokumentacji

Sprawdzono lokalne odnośniki obu dokumentów (39, bez brakujących celów), numerację 19 obszarów, 12 bramek scenariuszy oraz zachowanie dokładnie czterech historycznych `[x]`. Mapa powyżej obejmuje wszystkie 19 dawnych obszarów. Kontrola diffu nie wykazała błędów whitespace. To weryfikacja planu i jego odnośników — nie wynik testów aplikacji ani zgoda na prezentację/pilotaż.
