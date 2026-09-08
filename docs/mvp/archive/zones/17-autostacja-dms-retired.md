> Historical/retired zone.
> Former Zone 17 ("Pełne importy AutoStacji i integracja DMS") was removed from the active product-zone model — it is primarily future/roadmap material and is not useful as an active pitch-readiness zone. Its future capability ideas (AutoStacja/DMS integration, future import/synchronization, reconciliation, historical imports) are summarized in [Product Roadmap](../../planning/product-roadmap.md).
> This file is historical evidence only and is not an active source of current pitch/pilot readiness requirements.

### 17. Pełne importy AutoStacji i integracja DMS

**Priorytet:** P4

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Zero bezpośredniej integracji API z AutoStacją/DMS gdziekolwiek w repozytorium — to potwierdzone wynikiem negatywnym na poziomie całego kodu, nie tylko brakiem widocznej funkcji. Zero infrastruktury uzgadniania (reconciliation): żadna tabela w żadnym z drzew migracji nie przechowuje identyfikatora systemu źródłowego, flagi synchronizacji ani statusu rozbieżności. Istnieją natomiast realne, ale niezwiązane z AutoStacją prymitywy: generyczny, osiągalny z UI importer/eksporter CSV/XLSX katalogu produktów (bez żadnego kontraktu „eksport z AutoStacji"), oraz czysty, wielokrotnego użytku wzorzec rejestru adapterów importu do ruchu magazynowego (dziś zarejestrowany wyłącznie dla Matchera, architektonicznie gotowy na kolejny adapter, ale bez żadnej pracy projektowej nad tym, jak wyglądałby adapter AutoStacji). Matcher (Strefy 2/3/6) to ingestion danych z wydrukowanych/wyeksportowanych dokumentów PDF, nie integracja z systemem — i po zapisie do ruchu magazynowego traci nawet tę częściową proweniencję (Strefa 6: tylko wolny tekst przetrwa). Kolumny `reference_type`/`reference_id` na nagłówku ruchu istnieją i są realnie używane — ale wyłącznie do wewnętrznych odwołań (produkt, sesja inwentaryzacji), nigdy do oznaczenia pochodzenia z systemu zewnętrznego, i nigdy nie są wypełniane przez ścieżkę importu z Matchera. To dokładnie sytuacja 🟠: realne prymitywy istnieją osobno, spójny przepływ integracji z AutoStacją/DMS — nie.

**Dowody:**

- Kod: VERIFIED. Wyczerpujące przeszukanie całego repozytorium (kod wykonywalny, nie dokumentacja) pod kątem „autostacja"/„dms" oraz wszystkich wywołań HTTP do systemów zewnętrznych — zero wyników poza narzędziami obserwowalności (APM) i wewnętrznymi endpointami. Potwierdzono realny, generyczny importer/eksporter CSV/XLSX katalogu produktów (`InventoryProductImportsService`, strona `/dashboard/warehouse/items/import`) — osiągalny z UI, ale o kontrakcie ogólnym (nazwa/SKU/typ/jednostka/cena/kod podatku), bez żadnego związku z AutoStacją. Potwierdzono czysty wzorzec rejestru adapterów (`MovementImportSourceRegistry`) z jednym zarejestrowanym adapterem (Matcher). Potwierdzono zerowy wynik przeszukania schematu (oba drzewa migracji) pod kątem `external_id`/`source_system`/`sync_status`/`checksum` powiązanego z systemem zewnętrznym — jedyne trafienie to niezwiązany checksum plików załączników.
- Testy automatyczne: NONE dla czegokolwiek związanego z AutoStacją/DMS/integracją/uzgadnianiem — potwierdzone zerowym wynikiem wyszukiwania w plikach testowych obu aplikacji. Generyczny importer/eksporter CSV ma własne testy jednostkowe, niezwiązane z tym pytaniem.
- Weryfikacja ręczna: NOT APPLICABLE — strefa pozostaje ROADMAP ONLY, nie wymaga próby na żywo.
- Przebieg end-to-end: NOT APPLICABLE — nie ma spójnej ścieżki integracji do przetestowania.

**Wymagany stan dla pitchu:** ROADMAP ONLY

### Pitch readiness checklist

- [ ] Wypowiedź jasno mówi, że AutoStacja pozostaje źródłem prawdy, a Ambra nie łączy się z nią programowo — dziś nie ma żadnej integracji API i nie należy sugerować, że istnieje choćby w zalążkowej formie.
- [ ] Matcher opisywany jest jako wczytywanie tych samych dokumentów, które i tak są drukowane/eksportowane z SVWMS — nie jako „integracja z DMS".
- [ ] Wypowiedź nie obiecuje automatycznej synchronizacji ani pełnej migracji historycznych danych — zgodnie z tym, co już ustalono w Strefie 12 (naturalna rotacja/ukierunkowane wprowadzanie stanu wystarczają).
- [ ] Generyczny import/eksport CSV katalogu produktów (jeśli w ogóle wspomniany) nie jest nazywany „importem z AutoStacji" — to osobne, ogólne narzędzie do masowego zakładania produktów.
- [ ] Żaden ekran integracji/uzgadniania nie jest pokazywany na żywo — nie istnieje.

Brama końcowa nie jest wymagana — brak demonstracji na żywo dla tej strefy.

**Pitch gap:**

Brak luki blokującej pitch — to zgodne z zamierzeniem strefy jako czystej roadmapy. Jedyne ryzyko jest retoryczne: łatwo przez skrót myślowy nazwać Matcher „integracją z AutoStacją", podczas gdy to wczytywanie wydrukowanych dokumentów, nie połączenie systemów.

**Wymagany stan dla pilotażu:** manual dual-system procedure sufficient unless scope changes

### Pilot readiness checklist

Zgodnie ze Strefą 12, pilotaż może działać z AutoStacją jako systemem autorytatywnym bez żadnej integracji technicznej — poniższe to procedura organizacyjna, nie funkcja do zbudowania:

- [ ] Spisano wprost, który system jest autorytatywny dla których danych (AutoStacja dla stanów/dokumentacji oficjalnej, Ambra jako dodatkowa warstwa operacyjna) — zależność ze Strefy 12, tu tylko odnotowana jako wymóg przed realnymi danymi.
- [ ] Spisano, które czynności nadal trzeba wykonać w AutoStacji równolegle z Ambrą (np. wydanie — Strefa 8).
- [ ] Ustalono, kiedy i jak często następuje ręczne uzgodnienie stanów między systemami.
- [ ] Ustalono, kto jest właścicielem rozbieżności i jak są one zgłaszane/rejestrowane (może być tak proste jak wspólny arkusz/kanał, nie wymaga funkcji w aplikacji).
- [ ] Ustalono regułę zatrzymania/eskalacji, jeśli rozbieżności między systemami staną się nie do zaakceptowania.
- [ ] **Jeśli** pilotaż uzna to za operacyjnie konieczne: rozważyć wąską, minimalną funkcję techniczną (np. jedno pole `external_reference` widoczne w UI dla ręcznie wpisywanego numeru dokumentu AutoStacji) — ale tylko jeśli procedura ręczna okaże się w praktyce niewystarczająca, nie z góry.

**Pilot gap:**

Nie ma luki technicznej blokującej pilotaż — Strefa 12 już akceptuje ręczne dwusystemowe działanie. Jedyna praca przed realnymi danymi to spisanie prostej procedury organizacyjnej (własność rozbieżności, częstotliwość uzgadniania, reguła eskalacji), nie budowa integracji.

### Notes / evidence

- Zero bezpośredniej integracji API z AutoStacją/DMS: wyczerpujące przeszukanie „autostacja"/„dms" w kodzie wykonywalnym (nie dokumentacji) obu aplikacji — same trafienia w plikach `.md` i jeden komentarz migracji („Based on AutoStacja specification" — nazewnictwo typów ruchu wzorowane na AutoStacji, nie połączenie z nią). Jedyne realne wywołania HTTP do systemów zewnętrznych to eksporter śledzenia APM (`tracing.ts`) — niezwiązany z AutoStacją.
- Generyczny import/eksport katalogu produktów: `InventoryProductImportsService` (`importProductsFromCsv`/`exportProductsCsv`, `apps/web/src/server/services/inventory-product-imports.service.ts`), kreator UI (`inventory-product-import-wizard.tsx`), strona `/dashboard/warehouse/items/import` — realny, osiągalny, ale ogólny kontrakt pól (nazwa/SKU/typ/jednostka/ceny/kody podatkowe), zero odwołań do AutoStacji w kodzie ani nazewnictwie.
- Brak importu historycznego: brak jakiegokolwiek jednorazowego skryptu migracji starych zleceń/ruchów/klientów/pojazdów — jedyne mechanizmy zakładania stanu to generyczny import produktów (wyżej), ręczne tworzenie pozycji i audyt/inwentaryzacja z księgowaniem 401/402 (Strefa 15) — zgodnie z już zaakceptowaną strategią Strefy 12.
- Brak eksportu/zapisu zwrotnego do AutoStacji: jedyne istniejące eksporty to CSV katalogu produktów (pobranie pliku, bez wysyłki gdziekolwiek) oraz wzbogacony PDF dostawy z Matchera (Strefa 6, odtwarza dane źródłowe, nie stan potwierdzony w Ambrze) — żaden nie zapisuje niczego z powrotem do systemu zewnętrznego.
- Brak infrastruktury uzgadniania: zerowy wynik przeszukania obu drzew migracji pod kątem `external_id`/`source_system`/`sync_status`/`checksum` powiązanego z systemem zewnętrznym (jedyne trafienie to niezwiązany checksum integralności plików załączników).
- Proweniencja źródłowa: `inventory_movement_headers.reference_type`/`reference_id` istnieją i są realnie używane — ale wyłącznie do wewnętrznych odwołań (`"inventory_product"`, `"inventory_count"`), nigdy do oznaczenia pochodzenia zewnętrznego; ścieżka importu z Matchera nigdy ich nie wypełnia (zgodne z ustaleniem Strefy 6 o utracie strukturalnej proweniencji po zapisie ruchu).
- Architektura adapterów: `MovementImportSourceRegistry` (`apps/web/src/server/services/movement-import-adapters/registry.ts`) to czysty, generyczny wzorzec rejestru — interfejs nie zawiera niczego specyficznego dla Matchera, więc technicznie nadaje się pod przyszły adapter AutoStacji — ale dziś zarejestrowany jest wyłącznie jeden adapter (Matcher) i nie wykonano żadnej pracy projektowej nad kontraktem danych, którego wymagałby adapter AutoStacji.
- Klasyfikacja poprzednich ustaleń trackera: „Cel: ROADMAP ONLY... odłożyć import starych zleceń/materiałów/nierotów oraz automatyczną synchronizację DMS" — **CONFIRMED**, potwierdzone i doprecyzowane dowodami z kodu. Zachowana lista wymagań na przyszłość (podgląd/walidacja, duplikaty, brak częściowych zapisów, historia, poprawienie/cofnięcie, testy, minimalizacja podwójnej pracy) — **CONFIRMED** jako wciąż aktualny, kompletny opis przyszłego zakresu, bez korekt.

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
