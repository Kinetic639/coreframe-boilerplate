### 7. Szukanie, zawartość lokalizacji, relokacja części/zestawu i historia

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

W przeciwieństwie do Strefy 6, tutaj istnieje realny, działający rdzeń codziennej pracy: zawartość lokalizacji jest prawdziwą tabelą stanu magazynowego (nie tylko kontenerami), relokacja pojedynczej części (typ ruchu 801, „Bin-to-Bin Move") jest rzeczywistą, osiągalną z UI operacją z obsługą ilości częściowej i zabezpieczeniem przed ujemnym stanem po stronie bazy, a historia ruchów lokalizacji to prawdziwe zapytanie do bazy, nie fasada. To realna, działająca zdolność, nie tylko rozłączone prymitywy — stąd 🟡 PARTIAL, nie 🟠. Jednocześnie prześledzenie ujawniło konkretne, potwierdzone w kodzie usterki i braki wymagane przez skrypt: wyszukiwanie produktów filtruje wyłącznie po nazwie, nie po SKU/numerze katalogowym (mimo że pole nazywa się „szukanie", numer części go nie znajdzie); relokacja zestawu/kontenera jest kodem martwym bez żadnego wywołania z interfejsu; historia ruchów nie pokazuje użytkownika mimo że pole `posted_by` istnieje w zapytaniu; etykieta „przeniesienie wewnętrzne" w historii nigdy się nie wyświetla z powodu błędu porównania (`movementKind === "transfer"` nigdy nie jest prawdą dla realnych kodów `"801"`/`"311"`). Wyszukiwanie zlecenia nie istnieje w ogóle — zgodnie z oczekiwaniem, bo Strefa 4 nie istnieje.

**Dowody:**

- Kod: VERIFIED. Prześledzono wyszukiwanie produktów (`InventoryProductsService.listProducts`, filtr `.ilike("name", ...)`/`.ilike("product_name", ...)` — nigdy po `sku`), panel zawartości lokalizacji (`AmbraLocationInventoryService.getSnapshot` — realne zapytanie na `inventory_balances` dla stanu, `inventory_movement_lines`/`inventory_movement_headers` dla historii, `inventory_containers` dla kontenerów), edytor relokacji (`movement-positions-tab.tsx`, typ ruchu `801`, walidacja ilości klient+serwer) i funkcję księgującą `inventory_post_movement` (realna blokada ujemnego stanu: `IF NOT allow_negative_stock AND available_quantity < quantity THEN RAISE EXCEPTION`). Potwierdzono ponownie, niezależnie od wcześniejszych stref, że `relocateContainerAction` i pokrewne akcje kontenera nie mają żadnego wywołania w żadnym pliku `.tsx` w całym `apps/web/src`, łącznie ze stronami lokalizacji — to nie jest powtórzenie starego ustalenia, tylko osobna, świeża weryfikacja tej strefy.
- Testy automatyczne: PARTIAL/NONE w kluczowych miejscach. Brak testu wyszukiwania po SKU/lokalizacji, brak testu `ambra-location-inventory.service.ts` (panel lokalizacji, historia, stan), brak testu przepływu relokacji (`movement-positions-tab.tsx`, typ 801), brak testu relokacji kontenera (bo nie istnieje). Jedyny test dotykający transferów międzyoddziałowych (`inventory-cross-branch-transfers.test.ts`) **nie wykonuje żadnej realnej operacji** — sprawdza wyłącznie obecność fragmentów tekstu SQL w plikach migracji, z których część może już nie odpowiadać aktualnie działającemu silnikowi księgowania (ten sam dryf schematu co w poprzednich strefach).
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby tej ścieżki na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: szukanie części → otwarcie lokalizacji → relokacja → sprawdzenie obu lokalizacji i historii.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Wyszukiwanie**

- [ ] Wyszukiwanie po numerze zlecenia jest świadomie wyłączone ze scenariusza demo (zależność od Strefy 4 — nie istnieje i nie jest w zakresie tej strefy) albo zastąpione jawnie opisanym obejściem.
- [ ] Wyszukiwanie po SKU/numerze katalogowym faktycznie znajduje część — **dziś nie znajduje**, bo filtr sprawdza wyłącznie nazwę produktu; wymaga naprawy lub świadomego użycia w demo wyłącznie wyszukiwania po nazwie, z jawnym zastrzeżeniem tej różnicy w scenariuszu.
- [ ] Wynik wyszukiwania pokazuje rzeczywisty, aktualny stan (potwierdzone: tak, `inventory_balances` na żywo) — ale główna lista wyników nie pokazuje dziś lokalizacji; ustalono, jak prezenter dojdzie od wyniku wyszukiwania do konkretnej lokalizacji (np. przez szczegóły produktu/wariantu, jeśli tam lokalizacja jest widoczna).

**Zawartość lokalizacji**

- [ ] Otwarcie/skan lokalizacji demo pokazuje rzeczywisty stan (SKU + ilość), nie tylko kontenery czy reguły odkładania — potwierdzone w kodzie, do zweryfikowania na żywo.
- [ ] Dla przygotowanej lokalizacji demo liczba pozycji jest na tyle mała, że filtrowanie po stronie klienta (zapytanie pobiera stan całego oddziału i filtruje w przeglądarce, nie po stronie serwera) nie powoduje zauważalnego opóźnienia na urządzeniu prezentacji.

**Relokacja części**

- [ ] Wybór części/pozycji ze znanym źródłem, wybór/skan lokalizacji docelowej i potwierdzenie faktycznie przenosi zapisany stan — sprawdzone na żywo dla przygotowanych danych demo (mechanizm typu 801 istnieje i jest realny, wymaga świeżej próby).
- [ ] Przeniesienie częściowej ilości działa poprawnie: źródło maleje, cel rośnie, reszta pozostaje na źródłowej lokalizacji.
- [ ] Próba przeniesienia więcej niż dostępna ilość jest odrzucana, nie tworzy ujemnego stanu — potwierdzone w kodzie księgowania, do zweryfikowania na żywo.

**Relokacja zestawu/kontenera — decyzja wymagana przed pitchem**

- [ ] Ustalono, czy scenariusz demo obejmuje przeniesienie zestawu/kontenera jako osobnego obiektu — dziś **nie istnieje żadna dostępna z UI operacja relokacji kontenera** (funkcja jest w pełni zaimplementowana po stronie serwera, ale nie ma żadnego wywołania z interfejsu w całym repozytorium).
- [ ] Jeśli demo ma pokazać przeniesienie zestawu: zbudowano tymczasowe wejście UI wywołujące istniejącą funkcję serwerową i sprawdzono na żywo, że `current_location_id` kontenera faktycznie się zmienia i pozostaje spójne z zawartością.
- [ ] Jeśli nie zbudowano: scenariusz prezentacji jawnie nie obiecuje przenoszenia zestawu jako osobnej, trwałej operacji — zastąpione np. przeniesieniem pojedynczej części.

**Historia**

- [ ] Historia ruchów dla lokalizacji demo pokazuje źródło, cel i ilość po odświeżeniu/ponownym wejściu — potwierdzone jako realne zapytanie do bazy w kodzie.
- [ ] Prezenter wie, że **historia dziś nie pokazuje użytkownika, który wykonał ruch**, mimo że dane czasu (`posted_at`) są pobierane — jeśli scenariusz ma to pokazywać, wymaga naprawy przed pitchem albo świadomego pominięcia tego elementu w wypowiedzi.
- [ ] Naprawiono lub świadomie obeszło się błąd etykietowania rodzaju ruchu (`movementKind === "transfer"` nigdy nie jest prawdą dla realnych kodów `"801"`/`"311"`) — inaczej historia pokaże surowy kod ruchu zamiast czytelnej etykiety „przeniesienie" na oczach uczestników.

**Spójność po ruchu**

- [ ] Po relokacji: ponowne wyszukanie/otwarcie starej lokalizacji nie pokazuje już przeniesionej ilości, a nowa lokalizacja ją pokazuje — sprawdzone na żywo.
- [ ] Jeśli w demo używany jest kontener: sprawdzono, że jego wyświetlana „aktualna lokalizacja" nie rozjeżdża się cicho ze stanem magazynowym jego zawartości — dziś nic w interfejsie nie krzyżuje tych dwóch źródeł prawdy (pole na kontenerze jest praktycznie zamrożone, bo nic go realnie nie aktualizuje).

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 7 zweryfikowany ręcznie na aktualnym build, na danych utworzonych w Strefie 6:** wyszukanie znanego zlecenia/SKU → otwarcie bieżącej lokalizacji → sprawdzenie zawartości → relokacja jednej części/ilości do innej lokalizacji → relokacja jednego zestawu/kontenera, jeśli objęta finalnym scenariuszem pitchu → odświeżenie/ponowne wejście → wyszukiwanie i oba widoki lokalizacji pokazują nowy stan → historia ruchów pokazuje źródło, cel, ilość, użytkownika i czas.

**Pitch gap:**

Rdzeń tej strefy realnie działa i jest solidniejszy niż w większości pozostałych stref: zawartość lokalizacji to prawdziwy stan magazynowy, relokacja pojedynczej części to prawdziwa, osiągalna z UI operacja z sensowną walidacją ilości i zabezpieczeniem przed ujemnym stanem, a historia to prawdziwe zapytanie do bazy przetrwające odświeżenie. Braki są konkretne i naprawialne, nie fundamentalne: (1) wyszukiwanie produktów nie znajduje po SKU, tylko po nazwie — sprzeczne z dosłowną obietnicą skryptu „mogę wyszukać część"; (2) relokacja zestawu/kontenera nie ma żadnego wejścia UI, mimo że logika serwerowa istnieje — druga połowa obietnicy skryptu „przenoszę część i zestaw" jest dziś nieosiągalna; (3) historia nie pokazuje użytkownika i błędnie etykietuje rodzaj ruchu — szczegół, ale widoczny na żywo podczas pokazu. Wyszukiwanie zlecenia świadomie nie jest tu wymagane, bo zależy od nieistniejącej jeszcze Strefy 4.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Transakcyjność/idempotencja relokacji przy błędzie sieci/podwójnym kliknięciu — dziś nie sprawdzono, czy `inventory_post_movement` chroni przed podwójnym zaksięgowaniem tego samego żądania.
- [ ] Ochrona przed wyścigiem przy współbieżnej relokacji tej samej pozycji przez dwóch pracowników jednocześnie.
- [ ] Zapytania stanu/historii lokalizacji filtrowane po stronie serwera, nie tylko pobierane w całości i filtrowane w przeglądarce — dziś `listBalances`/`listMovements` pobierają do 2000 wierszy całego oddziału i filtrują po stronie klienta, co nie skaluje się do realnego wolumenu pilotażu.
- [ ] Jeśli relokacja kontenera zostanie zbudowana dla pitchu: dodano spójność między `inventory_containers.current_location_id` a rzeczywistym stanem `inventory_balances`/`inventory_serials` jego zawartości — dziś te źródła prawdy mogą się rozjechać bez żadnej kontroli.
- [ ] Naprawiono wyszukiwanie po SKU na stałe (nie tylko obejście na potrzeby pitchu).
- [ ] Naprawiono wyświetlanie użytkownika i etykiety rodzaju ruchu w historii na stałe.
- [ ] Ścieżka korekty/reversal błędnej relokacji z zachowaniem historii.
- [ ] Trwały ślad audytowy relokacji (dziś `posted_by` jest pobierane z bazy, ale nigdy nie wyświetlane — do rozszerzenia na realny log audytowy dla ról administracyjnych).
- [ ] Izolacja oddziałowa/organizacyjna wyszukiwania, zawartości lokalizacji i relokacji — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla tabel `inventory_balances`/`inventory_movement_lines`/`inventory_containers` używanych w tej strefie.
- [ ] Testy automatyczne pokrywające realny przepływ relokacji (typ 801), wyszukiwanie po SKU+lokalizacji i historię — dziś praktycznie nieobecne (jedyny test „transferów" sprawdza tylko tekst SQL w migracjach, nie działanie).
- [ ] Wydajność wyszukiwania/zawartości lokalizacji przy realistycznym wolumenie pilotażowego oddziału (setki–tysiące pozycji), nie tylko garstce danych demo.
- [ ] **Dokładny scenariusz pilotażu Strefy 7 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym współbieżna relokacja przez dwóch pracowników.

**Pilot gap:**

Poza ogólnym pogłębieniem twardości (transakcyjność, współbieżność, wydajność zapytań) najważniejsza dodatkowa praca pilotażowa to trwałe (nie tymczasowe na potrzeby jednego pokazu) naprawienie wyszukiwania po SKU i wyświetlania użytkownika/etykiety w historii, oraz — jeśli relokacja kontenera zostanie w ogóle zbudowana — zapewnienie, że nie tworzy cichej rozbieżności między zapisaną „aktualną lokalizacją" kontenera a rzeczywistym stanem jego zawartości. Żadna z tych pozycji nie wymaga nowego zakresu funkcjonalnego wykraczającego poza to, co skrypt już obiecuje na pitchu — to kwestia solidności, nie nowej funkcji.

### Notes / evidence

- Wyszukiwanie produktów filtruje wyłącznie po `name`/`product_name` (`InventoryProductsService.listProducts`, `apps/web/src/server/services/inventory-products.service.ts` ok. linii 192-193, 281-282) — nigdy po `sku`. Realny, aktualny stan (`on_hand_quantity`/`available_quantity`) pochodzi z bezpośredniego zapytania na `inventory_balances` (ok. linii 2500-2623), nie z pól katalogowych, ale lokalizacja nie jest kolumną głównej listy wyników.
- Osobna funkcja z realnym podziałem na lokalizacje (`listVariantOptions`, ok. linii 1253-1397) istnieje, ale jest używana wyłącznie w pickerze panelu lokalizacji i dialogu importu ruchu — nie na stronie wyszukiwania produktów.
- Panel zawartości lokalizacji (`location-detail-panel.tsx`) renderuje trzy niezależnie zasilane sekcje z `AmbraLocationInventoryService.getSnapshot` (`apps/web/src/server/services/ambra-location-inventory.service.ts:57-83`): realny stan magazynowy z `inventory_balances` (ok. linii 85-198), realną historię ruchów z `inventory_movement_lines`/`inventory_movement_headers` (ok. linii 200-330), oraz kontenery (ok. linii 333+). `listBalances`/`listMovements` nie filtrują po `location_id` po stronie serwera — pobierają do 2000 wierszy oddziału i filtrują w przeglądarce (`location-detail-panel.tsx` ok. linii 474-494).
- Relokacja pojedynczej części: `movement-positions-tab.tsx` (ok. linii 161-207) dla typu ruchu `801` („Bin-to-Bin Move (MMZ)") renderuje wybór lokalizacji źródłowej/docelowej (cel wyklucza źródło, ok. linii 200) i ilość ze sterownikami +/- z walidacją `max={line.on_hand_at_source}` (ok. linii 77-115). Księgowanie: `public.inventory_post_movement` (`apps/web/supabase-target/supabase/migrations/20260506090000_inventory_phase2_enterprise_core.sql:1738-1773`) blokuje ujemny dostępny stan po stronie bazy, nie tylko UI.
- Realnie zasiane dziś typy ruchów to wyłącznie `101`, `801`, `401`, `402`, `311` (`public.inventory_seed_movement_types`, `apps/web/supabase-target/supabase/migrations/20260712120000_add_inter_branch_movement_contract.sql:71-171`) — udokumentowana gdzie indziej lista „31 typów ruchów (101-613)" nie odpowiada temu, co faktycznie działa w runtime; `801` ma kategorię `bin_operation`, nie `transfer`.
- Relokacja kontenera ponownie potwierdzona jako martwa: `grep` dla `relocateContainerAction` w całym `apps/web/src` (włącznie ze stronami lokalizacji) zwraca wyłącznie plik definicji akcji — zero wywołań z jakiegokolwiek komponentu `.tsx`.
- Błąd etykietowania historii: `LocationMovementLine.movementKind` niesie surowy kod typu ruchu (np. `"801"`), ale UI porównuje go z literałem `"transfer"` (`location-detail-panel.tsx` ok. linii 311-312, 322) — warunek nigdy nie jest prawdziwy, więc etykieta „przeniesienie wewnętrzne" nigdy się nie wyświetla. Pole `posted_by`/wykonawca nie jest w ogóle pobierane ani wyświetlane w tym widoku, mimo że `posted_at` jest.
- Trzy niezależne mechanizmy „aktualnej lokalizacji": `inventory_balances` (autorytatywne, aktualizowane transakcyjnie przy każdym zaksięgowanym ruchu), `inventory_containers.current_location_id` (pole cache, ustawiane wyłącznie przez martwy kod relokacji kontenera — w praktyce zamrożone od utworzenia), `inventory_serials.current_location_id` (aktualizowane wewnątrz `inventory_post_movement` dla pozycji seryjnych). Interfejs nigdy nie krzyżuje tych źródeł, więc mogą się cicho rozjechać dla kontenerów.
- Jedyny test dotykający transferów międzyoddziałowych (`inventory-cross-branch-transfers.test.ts`) sprawdza wyłącznie obecność fragmentów tekstu w plikach migracji (`fs.readFileSync` + `toContain`), nie wykonuje żadnej realnej operacji — może odnosić się do nazw funkcji sprzed przepisania silnika księgowania.
- Zależności: Strefa 4 (wyszukiwanie zlecenia będzie możliwe dopiero po istnieniu trwałej tożsamości zlecenia — dziś świadomie poza zakresem tej strefy), Strefa 5 (fizyczna tożsamość QR części/zestawu, jeśli relokacja ma korzystać ze skanu zamiast wyboru z listy), Strefa 6 (dane wejściowe tej strefy pochodzą z przyjęcia — jeśli Strefa 6 nie dostarczy trwałego stanu magazynowego przed pitchem, Strefa 7 nie ma na czym pracować), Strefa 1 (izolacja oddziałowa/RLS tabel użytych tutaj) — odnotowane, nie duplikowane.

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
