# Rezerwacje i blokady części — plan implementacji

Status: **zatwierdzony** (decyzje w sekcji 8) · 2026-10-16 · gałąź `requests-portal`

Plan wdraża uzgodniony model stanów części **D / R / B**. Opisuje każde miejsce w bazie i aplikacji, którego zmiana dotyczy. Wszystko, co w sekcji 2 opisano jako stan obecny, zostało sprawdzone w bazie produkcyjnej (projekt `rjeraydumwechpjjzrus`) i w kodzie 16.10.2026.

---

## 1. Model docelowy (uzgodniony)

Każda sztuka na stanie danej lokalizacji jest zawsze w dokładnie jednym stanie:

| Stan                  | Znaczenie                                  | Kto może wziąć część            | Jak z niego wyjść                                                           |
| --------------------- | ------------------------------------------ | ------------------------------- | --------------------------------------------------------------------------- |
| **D** — dostępne      | dobra część, niczyja                       | każdy ruch, rezerwacja, blokada | rezerwacja, blokada, wydanie, przesunięcie                                  |
| **R** — zarezerwowane | dobra część dla konkretnego zlecenia       | tylko wydanie RW na to zlecenie | wydanie na to zlecenie, zwolnienie, przeniesienie na inne zlecenie, blokada |
| **B** — zablokowane   | część nienadająca się do użycia, z powodem | nikt                            | odblokowanie (→ D), zwrot do dostawcy, likwidacja                           |

**Na stanie = D + R + B.** Baza nie dopuszcza do D < 0.

Zasady:

1. **Zaksięgowanie PZ od razu rezerwuje części pod zlecenia**, w tej samej transakcji co PZ (albo całość, albo nic). Pozycja PZ z numerem ZL, zgodna z częścią na tym zleceniu, zostaje zarezerwowana na tyle, ile zlecenie jeszcze potrzebuje. Nadwyżka i części bez zlecenia trafiają do D.
2. **Rezerwacja to dokument** (jeden na zlecenie na jedno zdarzenie), z liniami na części. Każda linia wskazuje pozycję zlecenia i dokument źródłowy (np. linię PZ).
3. **Rozlokowanie to zwykłe MM.** Rezerwacja przechodzi razem z częścią na nową lokalizację lub do kontenera.
4. **Każde RW 261 wymaga numeru ZL.** Wydanie najpierw zużywa rezerwacje tego zlecenia, a dopiero brakującą resztę bierze z D. Rezerwacji jednego zlecenia nie da się wydać na inne.
5. **Zwolnienie (R → D) i przeniesienie na inne zlecenie** to jawne operacje z obowiązkowym powodem. Wykonuje je każdy z uprawnieniem `warehouse.inventory.operate`.
6. **Storno lub korekta PZ i zamknięcie zlecenia** zwalniają rezerwację automatycznie. Każde takie zwolnienie ma wpis w historii.
7. **„Zarezerwuj z magazynu”** rezerwuje dla zlecenia części z D: wiele części naraz, jednym dokumentem.
8. **Blokada to dokument z powodem** (kontrola jakości / reklamacja / uszkodzenie / inny + opis, opcjonalne odwołanie, np. numer zgłoszenia). Część może zostać w miejscu, bo blokada zmienia stan, nie lokalizację. Blokada sztuki zarezerwowanej najpierw zdejmuje ją z R (wpis w historii), a na zleceniu pojawia się „brakuje”. Po odblokowaniu część wraca do D, nie do zlecenia.
9. **Wolny towar w strefie przyjęć (PRZ) jest od razu w D.** Strefa przyjęć działa jak zwykła lokalizacja. Lista „Do rozłożenia” nadal pokazuje wszystko, co leży w PRZ.
10. **Nic się nie kasuje ani nie edytuje.** Pomyłkę poprawia się nowym dokumentem. Historia rezerwacji i blokad jest tylko dopisywana.
11. Oznaczenia w interfejsie: **D**, **R**, **B**.

---

## 2. Stan obecny (sprawdzony)

### Co już jest i zostaje

- **Rezerwacje są dokumentami**: `inventory_reservations` (numer `RES-000066`, status, autor, data, `reference_type` / `reference_id`) i `inventory_reservation_lines` (część, lokalizacja, `reserved` / `released` / `fulfilled`).
- **Alokacje** (`inventory_allocations`, `ALLOC-…`) przenoszą ilość z „zarezerwowane” do „zaalokowane” (`reserved_quantity` → `allocated_quantity` na stanie). To jest wkładanie do kontenera zlecenia.
- **Stan** `inventory_balances`: `on_hand`, `reserved`, `allocated` oraz kolumna generowana `available = on_hand − reserved − allocated`. Wszystkie trzy mają ograniczenie ≥ 0.
- **Księgowanie już chroni towar zarezerwowany.** `inventory_finalize_posting_internal` odrzuca każdy ruch, który obniżyłby `on_hand` poniżej `reserved + allocated` na lokalizacji (błąd `P0003` „Movement would strand committed stock”). _Uwaga: wcześniej w rozmowie błędnie twierdziłem, że tej ochrony nie ma._
- **Stan zmienia tylko silnik.** Pilnuje tego trigger `inventory_guard_balance_write`, a jedna aktualizacja nie może łączyć zmiany fizycznej ze zmianą rezerwacji.
- **Księga magazynowa** `inventory_stock_ledger_entries` jest tylko dopisywana, ze „stanem po” przy każdym wpisie. `inventory_movement_audit_log` zapisuje zdarzenia nagłówków ruchów.
- **Wydanie na zlecenie** `repair_order_issue_parts` (RW 261) wydaje tylko z rezerwacji albo alokacji danej pozycji zlecenia.

### Czego brakuje lub co jest źle

| #   | Problem                                                                                                                                                                                               | Gdzie                                                                                                                                                     |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1  | PZ nie rezerwuje. Tworzy tylko powiązanie `repair_order_line_movement_links` typu `receipt` (notatkę), osobnym wywołaniem po zaksięgowaniu, więc to nie jest jedna transakcja.                        | `inventory_attribute_receipt_to_repair_orders`, `inventory_attribute_receipt_lines`, akcja `app/actions/warehouse/inventory/index.ts:1823`                |
| P2  | Rezerwacja w strefie przyjęć jest zabroniona.                                                                                                                                                         | trigger `inventory_reservation_lines_not_at_receiving` / `inventory_allocation_lines_not_at_receiving` → `inventory_block_commitment_at_receiving`        |
| P3  | Rezerwacja powstaje dopiero przy rozłożeniu, od zera.                                                                                                                                                 | `inventory_putaway_from_receiving`, `inventory_putaway_batch`, `putaway_repair_order_stock`                                                               |
| P4  | Stan „zarezerwowane dla zlecenia” w PRZ liczony jest z notatek (proporcje z księgi).                                                                                                                  | `inventory_receiving_pending`, `get_repair_order_line_physical_state`, `repair_order_line_outstanding_receipt`, `InventoryReceivingService.attachSources` |
| P5  | Jedna rezerwacja odpowiada jednej pozycji zlecenia (`reference_type = 'repair_order_line'`); linia rezerwacji nie wskazuje pozycji zlecenia ani dokumentu źródłowego.                                 | `inventory_reservation_lines`                                                                                                                             |
| P6  | Brak historii zmian rezerwacji: jest tylko stan bieżący linii.                                                                                                                                        | —                                                                                                                                                         |
| P7  | Brak stanu B. Kolumna `inventory_balances.blocked` (liczbowa, domyślnie 0) istnieje, ale nic jej nie używa: 0 wierszy ≠ 0, nie wchodzi do `available`, a guard traktuje jej zmianę jako niedozwoloną. | `inventory_balances`                                                                                                                                      |
| P8  | Storno (`inventory_reverse_movement`) i korekta (`inventory_post_receipt_correction`) PZ z zarezerwowanym towarem: po zmianie P1 księgowanie odrzuci je błędem P0003, bo nie zwalniają rezerwacji.    | jw.                                                                                                                                                       |
| P9  | Zamknięcie zlecenia nie zwalnia jego rezerwacji.                                                                                                                                                      | `RepairOrdersService.changeStatus` (statusy `open` / `closed` / `archived`)                                                                               |
| P10 | Brak ruchów wyjścia z B: nie ma typu „zwrot do dostawcy” ani „likwidacja”. Aktywne typy: 101, 102, 261, 311, 312, 401, 402, 801, 900.                                                                 | `inventory_movement_types`                                                                                                                                |
| P11 | Ten sam dokument WDD wgrany w kilku sesjach mnoży ilość na pozycji zlecenia (np. ZL/178494/26/3122/BL, D00920002: 4 wkłady po 1 szt.).                                                                | `repair_order_line_source_links`, `repair_orders_import`                                                                                                  |

### Dane na produkcji (16.10)

- `reserved_quantity > 0`: 0 wierszy; `allocated_quantity > 0`: 28 wierszy (29 alokacji, 12 kontenerów).
- Aktywne rezerwacje `repair_order_line`: 29 (otwarta ilość 0, wszystko przeszło w alokacje); `branch_transfer`: 1 aktywna (12 szt.), tej nie ruszamy.
- Powiązania `receipt`: 87.
- Żaden stan nie ma `available < 0`.
- Numeracja: `RES-…` i `ALLOC-…` z `inventory_settings`.

---

## 3. Zmiany w bazie

Migracje trafiają do `apps/web/supabase-target/supabase/migrations` (według CLAUDE.md to drzewo jest wiążące). Każda jest addytywna: `CREATE OR REPLACE`, `ADD COLUMN`, `ALTER COLUMN … SET EXPRESSION` (PostgreSQL 17.6), bez `DROP`.

### M1. Stan B na stanie magazynowym

- Kolumna `inventory_balances.blocked` staje się ilością zablokowaną (`blocked_quantity`; zostawiamy obecną nazwę albo dodajemy nową, do ustalenia w implementacji). Dochodzi ograniczenie `CHECK (blocked >= 0)`.
- `available_quantity` = `on_hand − reserved − allocated − blocked`, przez `ALTER COLUMN … SET EXPRESSION`.
- `inventory_guard_balance_write`: `blocked` liczy się jako zmiana zobowiązania, jak `reserved` i `allocated`, a nie jako „inna kolumna”.
- `inventory_finalize_posting_internal`: kontrola P0003 obejmuje `reserved + allocated + blocked`.
- Nowe ograniczenie `CHECK (on_hand − reserved − allocated − blocked >= 0)`, czyli D ≥ 0. Dane spełniają je już dziś.

### M2. Rezerwacja na całe zlecenie i pochodzenie linii

- `inventory_reservation_lines`: nowe kolumny
  - `repair_order_line_id` (FK, opcjonalne),
  - `source_movement_line_id` (FK do `inventory_movement_lines`, opcjonalne): dokument, który dał tę ilość (linia PZ albo linia MM przy przeniesieniu),
  - `moved_from_line_id` (FK do linii rezerwacji): poprzednie miejsce tej samej rezerwacji.
- Nowy `reference_type = 'repair_order'` (nagłówek wskazuje zlecenie). Dotychczasowe `repair_order_line` zostają czytelne, uzupełniamy im `repair_order_line_id` z `reference_id`.
- Przeniesienie zapisujemy jako `released` na starej linii z wpisem „moved” w historii plus nową linię na miejscu docelowym. Dzięki temu obecne ograniczenie `released + fulfilled ≤ reserved` zostaje bez zmian.

### M3. Historia rezerwacji

Nowa tabela `inventory_reservation_events`, tylko dopisywana (trigger jak `inventory_ledger_append_only`):

`id, organization_id, branch_id, reservation_id, reservation_line_id, event_type, quantity, location_id, to_location_id, repair_order_line_id, to_repair_order_line_id, movement_id, movement_line_id, block_id, reason, actor_user_id, created_at`

`event_type`: `created` (z PZ / z magazynu / migracja), `moved` (MM), `allocated` (do kontenera), `issued` (RW), `released` (ręcznie / storno PZ / korekta PZ / zamknięcie zlecenia / blokada), `transferred` (na inne zlecenie).

RLS: odczyt jak dla rezerwacji, zapis wyłącznie przez funkcje silnika.

### M4. Dokumenty blokad

- `inventory_stock_blocks` (nagłówek: numer `BLK/rrrr/nnnnnn`, powód: `quality_check | supplier_complaint | damaged | delivery_mismatch | other` (dla `other` opis obowiązkowy), opis, `reference_type` / `reference_id` / `reference_number` np. zgłoszenie, status `active | partial | closed`, autor, data).
- `inventory_stock_block_lines` (część, lokalizacja, `blocked`, `unblocked`, `consumed`).
- `inventory_stock_block_events`, tylko dopisywana: `blocked`, `unblocked`, `moved`, `returned_to_supplier`, `scrapped`.
- RLS jak dla rezerwacji.

### M5. Typy ruchów wyjścia z B

Dwa nowe typy systemowe w numeracji wzorowanej na SAP, której już używamy (101/102/261/311/801/900):

- **122 „Zwrot do dostawcy”**, dokument `ZWD/rrrr/nnnnnn`: rozchód z towaru zablokowanego,
- **551 „Likwidacja”**, dokument `LIK/rrrr/nnnnnn`: rozchód z towaru zablokowanego.

Oba zdejmują ilość z B i z `on_hand` w jednej operacji silnika.

### M6. Nowe i zmienione funkcje silnika

Wszystkie z `SECURITY DEFINER`, sprawdzeniem `auth.uid()` i `has_branch_permission(…, 'warehouse.inventory.operate')`, jak obecne.

| Funkcja                                                                                                  | Co robi                                                                                                                                                                                                                                                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `inventory_post_receipt_with_reservations` **(nowa)**                                                    | Jedna transakcja: tworzy i księguje PZ, dla każdej linii z ZL dopasowuje pozycję zlecenia (ZL + znormalizowany kod części, zlecenie `open`, ten sam oddział), tworzy po jednym dokumencie rezerwacji na zlecenie na PRZ, najwyżej do ilości brakującej, i zapisuje zdarzenia `created`. Zwraca raport: zarezerwowane / wolne / pominięte z powodem. |
| `repair_order_line_open_need` **(nowa)**                                                                 | Ile pozycja jeszcze potrzebuje: `ordered − (aktywne R + zaalokowane + wydane)`. Zastępuje `repair_order_line_outstanding_receipt`.                                                                                                                                                                                                                  |
| `inventory_reserve_for_repair_order` **(nowa)**                                                          | „Zarezerwuj z magazynu”: wiele linii (pozycja zlecenia, lokalizacja, ilość), jeden dokument, tylko z D.                                                                                                                                                                                                                                             |
| `inventory_release_reservation_lines` **(nowa)**                                                         | Zwolnienie wybranych linii lub ilości z powodem (wymagany). Zdarzenia `released`. Obecna `inventory_release_reservation` zostaje dla transferów między oddziałami.                                                                                                                                                                                  |
| `inventory_transfer_reservation` **(nowa)**                                                              | Przeniesienie na inne zlecenie: zamyka na starym zleceniu, tworzy na nowym, z powodem. Bez momentu, w którym część jest w D.                                                                                                                                                                                                                        |
| `inventory_move_reserved_stock` **(nowa, wewnętrzna)**                                                   | Przy MM: zwalnia rezerwację na źródle (ze zdarzeniem `moved`), księguje MM, tworzy linię rezerwacji na celu. Kolejność dobrana tak, żeby nie zadziałała kontrola P0003.                                                                                                                                                                             |
| `inventory_putaway_from_receiving`, `inventory_putaway_batch`, `putaway_repair_order_stock` **(zmiana)** | Rozłożenie części zlecenia przenosi istniejącą rezerwację (`inventory_move_reserved_stock`) i zakłada alokację do kontenera z tej rezerwacji. Nie tworzy już nowej rezerwacji od zera. Wolny towar: zwykłe MM z D.                                                                                                                                  |
| `inventory_create_allocation`, `repair_order_add_allocation_to_container` **(zmiana)**                   | Zapis zdarzenia `allocated`.                                                                                                                                                                                                                                                                                                                        |
| `repair_order_issue_parts` **(zmiana)**                                                                  | Jedyna droga RW 261: ZL obowiązkowy, najpierw rezerwacje tego zlecenia, potem brakująca reszta z D. Zapis zdarzenia `issued` (z numerem RW). Edytor ruchów dla typu 261 wywołuje tę samą funkcję.                                                                                                                                                   |
| `inventory_reverse_movement`, `inventory_post_receipt_correction` **(zmiana)**                           | Przed zaksięgowaniem storna lub korekty PZ zwalniają rezerwacje z linii tego PZ, które leżą jeszcze w PRZ (zdarzenie `released`, powód „storno PZ …” / „korekta PZ …”). Jeśli towaru nie ma już w PRZ (np. rozłożony), błąd z czytelnym komunikatem, jak dziś.                                                                                      |
| `inventory_block_stock` / `inventory_unblock_stock` **(nowe)**                                           | Blokada: z D, a jeśli wskazana sztuka jest w R, najpierw zwolnienie z powodem „blokada BL-…”. Odblokowanie z powodem → D.                                                                                                                                                                                                                           |
| `inventory_issue_blocked_stock` **(nowa)**                                                               | Zwrot do dostawcy (122) / likwidacja (551) z ilości zablokowanej.                                                                                                                                                                                                                                                                                   |
| `inventory_relocate_container` **(zmiana)**                                                              | Przy przenoszeniu kontenera przenosi też linie rezerwacji i blokad (zdarzenie `moved`).                                                                                                                                                                                                                                                             |
| `inventory_block_commitment_at_receiving` **(zmiana)**                                                   | Funkcja przestaje blokować (`RETURN NEW`). Rezerwacje i blokady w PRZ stają się dozwolone. Triggera nie usuwamy (bez `DROP`).                                                                                                                                                                                                                       |
| `inventory_receiving_pending` **(zmiana)**                                                               | Pozycje na zlecenie czyta z aktywnych linii rezerwacji w PRZ (dokładnie, z dokumentem źródłowym). Wolny towar = D w PRZ.                                                                                                                                                                                                                            |
| `get_repair_order_line_physical_state` **(zmiana)**                                                      | Stan pozycji zlecenia z rezerwacji, alokacji i wydań zamiast proporcji z powiązań.                                                                                                                                                                                                                                                                  |
| zamknięcie / archiwizacja zlecenia **(nowa)**                                                            | Funkcja `repair_order_close` (albo trigger na zmianę statusu): zwalnia niewydane rezerwacje zlecenia ze zdarzeniem `released`, powód „zamknięcie zlecenia”.                                                                                                                                                                                         |
| `inventory_approve_count_session` **(sprawdzenie)**                                                      | Niedobór z inwentaryzacji nie może zejść poniżej R + B. Czytelny komunikat zamiast surowego P0003.                                                                                                                                                                                                                                                  |
| `admin_reset_demo_org_data` **(zmiana)**                                                                 | Czyści też nowe tabele (historia rezerwacji, blokady).                                                                                                                                                                                                                                                                                              |

`inventory_attribute_receipt_to_repair_orders` i `inventory_attribute_receipt_lines` przestają być wywoływane. Zostają w bazie bez użycia (bez `DROP`).

### M7. Migracja danych

1. Zaalokowane dziś części (28 stanów, 29 alokacji) to już R. Ich liniom rezerwacji uzupełniamy `repair_order_line_id` i zapisujemy zdarzenia `created` (powód „migracja: stan sprzed 2026-10-xx”) oraz `allocated`.
2. Części leżące w PRZ z powiązaniem `receipt` (dziś „przypisane”) dostają prawdziwe rezerwacje w ilości wyliczonej obecnym algorytmem `inventory_receiving_pending`, z `source_movement_line_id` = linia PZ i zdarzeniem `created` („migracja z PZ …”).
3. Kontrola po migracji: dla każdego stanu `on_hand = D + R + B`, D ≥ 0, a suma R w PRZ = suma pozycji „na zlecenie” sprzed migracji.
4. Powiązania `repair_order_line_movement_links` zostają jako historyczne powiązania dokumentów. Nowe stany nie są z nich liczone. Powiązania `issue` nadal powstają przy wydaniu, bo łączą RW z pozycją zlecenia.

### M8. Podwójne wgranie tego samego WDD (P11)

`repair_orders_import`: wkład linii dokumentu WDD do pozycji zlecenia jest odrzucany, jeśli dokument o tym samym `external_document_number` i tym samym kodzie magazynu był już zaimportowany w innej sesji. Raport importu pokazuje „dokument już zaimportowany w sesji …”. Istniejących danych demo nie zmieniamy automatycznie; lista do ręcznej decyzji.

---

## 4. Zmiany w aplikacji (serwer)

| Plik                                                                                                                    | Zmiana                                                                                                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `server/services/inventory-receiving.service.ts`                                                                        | `listPending` na nowym kształcie danych; `attachSources` upraszcza się: pozycje na zlecenie biorą dokument z linii rezerwacji, a wolny towar dalej z księgi; `attributeReceipt` usunięte; nowe `postReceiptWithReservations`.                                                                                           |
| `app/actions/warehouse/inventory/index.ts` (ok. l. 1823)                                                                | Księgowanie PZ z importu i szybkiego importu przez jedną nową funkcję zamiast „zaksięguj, potem przypisz”.                                                                                                                                                                                                              |
| `server/services/inventory-movements.service.ts`                                                                        | Storno i korekta: nowe komunikaty błędów (rezerwacje zwolnione / towar już rozłożony).                                                                                                                                                                                                                                  |
| `server/services/repair-orders.service.ts`                                                                              | `reserveForLine`, `releaseReservationForLine`, `listReservationsForLine`, `allocateForLine`, `getPhysicalStateForLine`, `getWarehouseView` przechodzą na model zlecenia; nowe `reserveFromStock`, `releaseReservation`, `transferReservation`, `getReservationHistory`; `changeStatus` → zamknięcie zwalnia rezerwacje. |
| `server/services/repair-order-issue.service.ts`                                                                         | Bez zmian w zasadzie; odczyt dostępnych rezerwacji z nowych kolumn.                                                                                                                                                                                                                                                     |
| `server/services/putaway-scan.service.ts`, `inventory-containers.service.ts`                                            | Rozłożenie i przeniesienie kontenera na nowych funkcjach.                                                                                                                                                                                                                                                               |
| `server/services/inventory-balances.service.ts`, `inventory-products.service.ts`, `ambra-location-inventory.service.ts` | Zwracają D, R, B (R = reserved + allocated) zamiast samego `available`.                                                                                                                                                                                                                                                 |
| `server/services/inventory-enterprise.service.ts`                                                                       | Rezerwacje transferów między oddziałami bez zmian; kontrola, czy D z blokadami nie psuje wysyłki transferu.                                                                                                                                                                                                             |
| nowe `server/services/inventory-blocks.service.ts` + akcje `app/actions/warehouse/blocks.ts`                            | Blokada, odblokowanie, zwrot do dostawcy, likwidacja, lista blokad.                                                                                                                                                                                                                                                     |
| nowe akcje rezerwacji `app/actions/warehouse/reservations.ts`                                                           | Zarezerwuj z magazynu, zwolnij, przenieś, historia.                                                                                                                                                                                                                                                                     |
| `lib/warehouse/inventory-types.ts`, `lib/types/repair-orders.ts`                                                        | Typy D / R / B, linia rezerwacji ze zleceniem i źródłem, zdarzenia.                                                                                                                                                                                                                                                     |
| `search_global` / `search_preview_item` (SQL)                                                                           | Podgląd części w wyszukiwarce pokazuje D / R / B.                                                                                                                                                                                                                                                                       |
| `messages/pl.json`, `messages/en.json`                                                                                  | Nowe teksty: stany, powody, operacje, błędy.                                                                                                                                                                                                                                                                            |

---

## 5. Zmiany w interfejsie

### 5.1 Magazyn

- **Karta części** (`warehouse/items/[productId]`): tabela lokalizacji z kolumnami _Na stanie · D · R · B_; pod nią listy „Zarezerwowane” (numer RES, ZL, ilość, lokalizacja, od kiedy) i „Zablokowane” (numer BL, powód, odwołanie, ilość). Zakładka **Historia**: księga plus zdarzenia rezerwacji i blokad w jednej osi czasu, ze stanem po każdej operacji. Akcje: _Zarezerwuj pod zlecenie_, _Zablokuj_.
- **Lista części** (`warehouse/items`): kolumny D / R / B zamiast samego „dostępne”.
- **Lokalizacje i kontenery** (`warehouse/locations`, panel szczegółów): D / R / B oraz oznaczenie „R · ZL/…” lub „B · powód” przy pozycji.
- **Nowa strona „Rezerwacje”**: wszystkie aktywne rezerwacje z filtrami (zlecenie, część, lokalizacja) i kolumną „od ilu dni”; akcje zwolnij / przenieś.
- **Nowa strona „Blokady”**: aktywne blokady z powodem i wiekiem; akcje odblokuj / zwrot do dostawcy / likwidacja.
- **Edytor ruchu i wybór części** (`movements/new`, `inventory-item-picker-dialog`): ilość możliwa do wzięcia = D; przy części z R lub B wyjaśnienie, dlaczego nie da się wziąć więcej.
- **Do rozłożenia** (`warehouse/putaway`): bez zmian w układzie (widok według dokumentów zostaje). Pozycje na zlecenie z rezerwacji, przy każdej numer RES.
- **Raport PZ** (po zaksięgowaniu): kolumna „Rezerwacja” z numerem RES i ZL zamiast „Przypisanie”.

### 5.2 Zlecenie (`workshop/[id]`)

Obecne zakładki _Przegląd · Pozycje · Magazyn · Dokumenty · Powiązane_ (podzakładki magazynu i osobne komponenty rezerwacji, alokacji i kontenerów) zastępuje układ:

- **Pozycje**: jeden wiersz na część: _Potrzeba · Zarezerwowano · Wydano · Brakuje · Gdzie leży (lokalizacja / kontener) · Status_ (brak / zarezerwowane w PRZ / zarezerwowane / w kontenerze / wydane / zablokowane). Rozwinięcie wiersza: rezerwacje (numery RES jako linki) i historia tej części. Akcje: _Zarezerwuj z magazynu_ (wiele części naraz), _Zwolnij_, _Przenieś na inne zlecenie_, _Wydaj_.
- **Magazyn**: chronologiczna lista dokumentów zlecenia: zamówienia (WDD z Matchera), PZ, RES, MM, RW, zwolnienia, blokady. Każdy klikalny, z ilościami dla tego zlecenia.
- **Kontenery**: kod, lokalizacja, zawartość.
- **Historia**: pełna oś czasu zdarzeń zlecenia.
- Status kompletacji w nagłówku: „skompletowane”, gdy nic nie brakuje.

Komponenty do zastąpienia lub przebudowy: `repair-order-warehouse.tsx`, `repair-order-line-reservation.tsx`, `repair-order-line-container.tsx`, `repair-order-lines-list.tsx`, `repair-order-issue.tsx`, `repair-order-containers.tsx`, `repair-order-tab-ids.ts`.

---

## 6. Testy

- **pgTAP** (`apps/web/supabase/tests`, nowe pliki od `133_`), dla każdej ścieżki osobno:
  - PZ z ZL → rezerwacja w tej samej transakcji; nadwyżka → D; zlecenie zamknięte lub brak pozycji → D z powodem w raporcie; dostawa częściowa → „brakuje”; drugi PZ dorezerwowuje;
  - **próba obejścia**: RW / MM / inwentaryzacja na towarze R lub B → odmowa; D nigdy < 0;
  - rozłożenie: rezerwacja przechodzi, `on_hand = D + R + B` na obu lokalizacjach, zdarzenie `moved`;
  - wydanie RW zużywa rezerwację; wydanie na inne zlecenie → odmowa;
  - zwolnienie bez powodu → odmowa; z powodem → D, zdarzenie;
  - przeniesienie na inne zlecenie: brak chwili w D;
  - storno i korekta PZ zwalniają rezerwacje; storno po rozłożeniu → czytelny błąd;
  - zamknięcie zlecenia zwalnia;
  - blokada sztuki z R: zdjęta z R, zlecenie „brakuje”; odblokowanie → D; zwrot 122 / likwidacja 551 z B;
  - historia: próba UPDATE / DELETE → odmowa;
  - RLS: inna organizacja i inny oddział nie widzą i nie zmieniają rezerwacji ani blokad;
  - migracja M7: sumy przed i po.
- **Istniejące testy do aktualizacji**: `097`–`102`, `104`, `107`, `114`, `116`, `118` (rezerwacje, alokacje, rozłożenie, strefa przyjęć).
- **Vitest**: serwisy (`inventory-receiving`, `repair-orders`, nowe `inventory-blocks`), akcje, komponenty karty części, zlecenia i „Do rozłożenia”.
- **Sprawdzenie na danych demo** po każdym etapie: przebieg z prezentacji (sesja Matchera → szybki import → PZ → rozłożenie → wydanie).

---

## 7. Kolejność wdrożenia

Każdy etap kończy się zielonymi testami i sprawdzeniem na danych demo, dopiero potem następny.

| Etap   | Zakres                                                                                                                         | Uwagi                                                                                           |
| ------ | ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| **E1** | M1 (stan B, D ≥ 0), M3 (historia rezerwacji), M2 (kolumny linii)                                                               | Czysto addytywne. Obecne przepływy działają dalej.                                              |
| **E2** | PZ z rezerwacją (`inventory_post_receipt_with_reservations`), odblokowanie rezerwacji w PRZ, zmiana akcji importu, migracja M7 | Od tego momentu PZ rezerwuje.                                                                   |
| **E3** | Rozłożenie przenosi rezerwację, wydanie i alokacja ze zdarzeniami, storno, korekta i zamknięcie zlecenia zwalniają             | Bez E3 storno PZ z rezerwacją kończy się błędem P0003, więc E2 i E3 wchodzą na produkcję razem. |
| **E4** | Zwolnij / przenieś / zarezerwuj z magazynu (funkcje + akcje)                                                                   |                                                                                                 |
| **E5** | Blokady: M4, M5, funkcje, serwis i akcje                                                                                       |                                                                                                 |
| **E6** | UI magazynu: karta i lista części, lokalizacje, strony Rezerwacje i Blokady, edytor ruchu                                      |                                                                                                 |
| **E7** | UI zlecenia: Pozycje / Magazyn / Kontenery / Historia                                                                          |                                                                                                 |
| **E8** | M8: ochrona przed podwójnym WDD                                                                                                | Niezależne, może wejść wcześniej.                                                               |

### Stan wdrożenia (2026-10-16)

| Etap    | Stan                                                            | Migracje / testy                                          |
| ------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| E1      | na produkcji, test 133 zielony (14/14)                          | `20261016130747_reservations_e1_blocked_state_and_events` |
| E2 + E3 | na produkcji; test 134 i poprawiony 118 czekają na uruchomienie | `20261016132736_…e2a` … `20261016133542_…e2e`             |
| E4–E8   | nie zaczęte                                                     | —                                                         |

Odstępstwa od kolejności z planu (zmiany kolejności, nie modelu):

- **Dokument rezerwacji na całe zlecenie** (jeden REZ z liniami na części) wchodzi razem z przebudową ekranów zlecenia (E4/E7). W E2/E3 PZ tworzy jeden REZ na pozycję zlecenia (`reference_type = 'repair_order_line'`). Ten kształt czytają dziś wszystkie ekrany i funkcje (wydanie, kontenery), więc nic nie trzeba było przepisywać naraz. Linie i tak mają już `repair_order_line_id` i źródło.
- **„RW 261 zawsze ze zleceniem” w bazie** wchodzi razem z edytorem ruchów (E6). Do tego czasu zwykłe RW z edytora i tak może wziąć tylko D, więc zarezerwowane części są chronione.
- Do E4: stara funkcja `inventory_release_reservation` (transfery, ręczne zwolnienie na ekranie zlecenia) nie zapisuje jeszcze zdarzeń w historii. `inventory_attribute_receipt_lines` (przypisanie po liniach Matchera) nie jest używana przez aplikację i nie tworzy rezerwacji.

**Wycofanie:** migracje są addytywne. Gdyby E2+E3 trzeba było cofnąć, akcja importu wraca do starego wywołania, funkcja strefy przyjęć do poprzedniej treści, a nowe rezerwacje zostają jako zwykłe dokumenty, które można zwolnić. Danych nie trzeba usuwać.

---

## 8. Decyzje (zatwierdzone 2026-10-16)

1. **Nowe typy ruchów:** 122 „Zwrot do dostawcy” (`ZWD/rrrr/nnnnnn`) i 551 „Likwidacja” (`LIK/rrrr/nnnnnn`). Kody wzięte z numeracji SAP, jak obecne.
2. **Powody blokady:** kontrola jakości · reklamacja do dostawcy · uszkodzenie w magazynie lub warsztacie · niezgodność z dostawą (inna część, zła ilość, brak dokumentów) · inny (opis obowiązkowy). Opcjonalne odwołanie: numer zgłoszenia, numer reklamacji u dostawcy, PZ.
3. **RW 261 zawsze wymaga zlecenia** (tak jak w AutoStacji, według właściciela produktu). Wydanie z edytora ruchów i ze zlecenia to w bazie ta sama operacja: najpierw rezerwacje tego zlecenia, potem brakująca reszta z D. Przy pozycji widać, z czego poszło (np. „z REZ/… 6 szt. + z dostępnych 1 szt.”).
4. **Podwójne WDD w demo:** bez ręcznych poprawek. Najpierw E8 (ochrona przed podwójnym importem), potem reset danych demo (`admin_reset_demo_org_data`, z wcześniejszym pokazaniem, co zostanie usunięte) i jeden czysty import sesji.
5. **Numeracja w formacie dokumentów:** rezerwacje `REZ/rrrr/nnnnnn`, blokady `BLK/rrrr/nnnnnn`, wkład do kontenera `KON/rrrr/nnnnnn`. Wystawione już numery `RES-…` / `ALLOC-…` zostają bez zmian.
