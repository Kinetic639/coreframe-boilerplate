### 5. Przyjęcie 101/PZ → import z Matchera → mobilne rozłożenie → zamknięcie → raport

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Realne prymitywy istnieją — typ ruchu 101 („Przyjęcie z zamówienia"/PZ) jest prawdziwie zdefiniowany, import z Matchera do edytora ruchu na komputerze naprawdę działa i rozwiązuje produkty (nie jest atrapą), kontenery jako model danych istnieją, a lokalizacje/QR ze Strefy 4 działają dla lokalizacji. Ale te elementy **nie składają się w zamierzony workflow przyjęcia**. Mobilne rozłożenie nie istnieje w ogóle (potwierdzone placeholdery), kontenery są całkowicie niepodłączone do przyjęcia (akcje-sieroty bez żadnego wywołania z UI), nie ma rozróżnienia „oczekiwane" vs „fizycznie potwierdzone", nie ma dedykowanego zamknięcia przyjęcia, a jedyny realny raport dostawy w aplikacji odtwarza wyłącznie dane odczytane z dokumentu źródłowego, nigdy rzeczywiście potwierdzonych lokalizacji magazynowych. To dokładnie sytuacja opisana jako 🟠: prymitywy istnieją, spójny workflow — nie.

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny łańcuch: definicję typu ruchu 101 (`inventory_movement_types`, na żywo z bazy: `code: "101", name_pl: "Przyjęcie z zamówienia", category: "receipt", cost_impact: "increase", requires_destination_location: true`), dialog importu z Matchera (`movement-import-dialog.tsx`), rozwiązywanie produktów (`InventoryMovementImportsService.resolveLine`/`WarehouseImportResolverService.resolveVariant`), zapis stanu edytora (`use-movement-form-state.ts` → `applyImportedDocument`) i faktyczny zapis do bazy (`use-movement-submission.ts` → `buildLines`). Osobno prześledzono trasy `/warehouse/deliveries` i `/warehouse/scanning/delivery` (potwierdzone placeholdery), wywołania funkcji kontenerów (zero wywołań spoza własnego pliku definicji), schemat `inventory_movement_lines`/`inventory_movement_headers` (brak kolumny „oczekiwana vs potwierdzona ilość", brak statusu „zamknięte przyjęcie") oraz generator raportu dostawy (`getEnhancedPdfData` — czyta wyłącznie tabele Matchera, nigdy `inventory_movement_lines`/`warehouse_locations`).
- Testy automatyczne: PARTIAL. Podgląd importu (`InventoryMovementImportsService.previewFromSource`) i kandydaci importu z Matchera (`getMovementImportCandidates`) mają sensowne testy na zamockowanych danych. **Zero testów** obejmujących pełny łańcuch od wyboru sesji Matchera przez zapis linii do faktycznie zapisanego ruchu (`movement-import-dialog.tsx`, `use-movement-form-state.ts`, `use-movement-submission.ts` — żaden nie ma testu). Zero testów mobilnego przyjęcia, kontenerów w przyjęciu, logiki zamknięcia i raportu — bo żadna z tych funkcji nie istnieje.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej próby tej ścieżki na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED dla części, która technicznie istnieje (import na komputerze → zapisany ruch); NOT APPLICABLE dla mobilnego rozłożenia, zamknięcia i raportu z potwierdzonych lokalizacji, bo nie ma czego uruchomić.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Dokument 101/PZ**

- [ ] Utworzenie ruchu typu 101 działa na aktualnym build z poprawnymi polami nagłówka (oddział, data, opcjonalne odniesienie).
- [ ] Ruch jest trwałym dokumentem z właściwym oddziałem/organizacją i statusem draft/posted odzwierciedlającym rzeczywisty stan.
- [ ] Dokładna logika księgowania stanu przy zatwierdzeniu (`inventory_finalize_posting` i pokrewne RPC) jest potwierdzona na żywo — dziś ciała tych funkcji nie mają odpowiadającej migracji w repozytorium (dryf schematu), więc dokładna arytmetyka księgowania nie jest znana z kodu źródłowego.

**Import z Matchera**

- [ ] Zapisana sesja Matchera (Strefa 2) jest wybieralna jako źródło importu przy tworzeniu ruchu 101 na aktualnym build.
- [ ] Import automatycznie wypełnia linie ruchu (produkt, ilość, jednostka, lokalizacja docelowa) bez ręcznego przepisywania — sprawdzone na żywo dla przygotowanych danych demo.
- [ ] Nieznany/niejednoznaczny SKU jest jawnie sygnalizowany użytkownikowi (przypisanie/utworzenie/pominięcie) — nie znika po cichu i nie blokuje reszty importu.
- [ ] Numer zlecenia z Matchera pojawia się przy zaimportowanej linii — **ze świadomością, że dziś przetrwa wyłącznie jako tekst w polu notatki, nie jako trwałe powiązanie w zapisanym ruchu** (zależność od Strefy 3 dla prawdziwej relacji zlecenia).
- [ ] Prezenter wie i uwzględnia w scenariuszu, że **po zapisaniu ruchu nie istnieje żadne trwałe powiązanie z sesją/linią Matchera** — `inventory_movement_lines` nie ma kolumny wskazującej źródłową sesję; jedynym śladem pochodzenia są wolnotekstowe notatki nagłówka/linii.
- [ ] Ta sama sesja Matchera zaimportowana dwukrotnie do dwóch różnych ruchów jest albo świadomie niedopuszczona w scenariuszu demo, albo jawnie wyjaśniona jako znane ograniczenie — dziś nic w systemie tego nie blokuje ani nie ostrzega.
- [ ] Zaimportowany, niezapisany szkic ruchu nie jest tracony przypadkowo w trakcie demo przez odświeżenie strony — sprawdzone i uwzględnione w choreografii pokazu (stan importu żyje wyłącznie w pamięci przeglądarki do momentu zapisu).

**Mobilne rozłożenie — decyzja wymagana przed pitchem**

- [ ] Ustalono, że dziś **nie istnieje żadna funkcjonalna mobilna ścieżka rozłożenia** (`/warehouse/deliveries` i `/warehouse/scanning/delivery` to potwierdzone atrapy „coming soon"; jedyny realny skan telefonem w module magazynowym dotyczy audytów stanu, nie przyjęcia) — scenariusz pokazu musi to uwzględnić świadomie, nie zakładać istniejącej funkcji.
- [ ] Podjęto decyzję o minimalnym zakresie potrzebnym do pitchu: albo zbudować prosty mobilny ekran „wybierz linię → zeskanuj/wskaż lokalizację → potwierdź", albo świadomie zawęzić obietnicę pokazu tak, żeby nie sugerowała istniejącego rozłożenia mobilnego.
- [ ] Jeśli zbudowano minimalny ekran: potwierdzenie lokalizacji na telefonie rzeczywiście zapisuje ilość, lokalizację, użytkownika i czas w trwałym rekordzie — nie tylko wizualnie „wygląda na zapisane".

**Oczekiwane vs potwierdzone**

- [ ] Ustalono minimalny, wystarczający do demo sposób odróżnienia „to, co dokument mówi, że powinno przyjść" od „to, co pracownik faktycznie potwierdził" — dziś taki koncept nie istnieje w ogóle w schemacie (`inventory_movement_lines` ma tylko jedno pole `quantity`, bez stanu potwierdzenia).
- [ ] Brakująca/niepotwierdzona pozycja jest widoczna jawnie, nie milczy jako „zakończone".

**Kontenery/grupowanie — jeśli używane w demo**

- [ ] Jeśli scenariusz demo ma pokazywać grupowanie części w zestaw podczas przyjęcia: potwierdzono na żywo, że którakolwiek z akcji kontenera (`createLocationContainerAction`, `addItemsToContainerAction` itd.) faktycznie działa wywołana z nowego, tymczasowego wejścia UI zbudowanego na potrzeby demo — dziś te akcje nie mają żadnego wywołania z interfejsu użytkownika.
- [ ] Jeśli kontenery nie zostaną podłączone przed pitchem: scenariusz demo nie obiecuje grupowania/zestawu jako trwałej funkcji przyjęcia.

**Zamknięcie**

- [ ] Ustalono minimalny sposób zakończenia procesu przyjęcia na potrzeby demo — dziś nie ma dedykowanej operacji „zamknij przyjęcie" odrębnej od ogólnego przejścia ruchu draft→posted, więc scenariusz nie może obiecywać walidacji „nie da się zamknąć z brakującymi pozycjami", chyba że zostanie to celowo zbudowane.
- [ ] Jeśli zbudowano minimalną walidację zamknięcia: sprawdzono na żywo, że nie da się „zamknąć" przyjęcia z jawnie nieobsłużonymi wymaganymi pozycjami.

**Raport**

- [ ] Raport pokazywany w demo pochodzi z faktycznie zapisanych danych ruchu/lokalizacji, nie wyłącznie z odczytu dokumentu źródłowego Matchera — dziś jedyny istniejący raport dostawy (wzbogacony PDF Matchera) czyta **wyłącznie** tabele Matchera i nigdy nie sięga do `inventory_movement_lines`/lokalizacji magazynowych, więc nie spełnia tego wymogu bez zmiany.
- [ ] Jeśli raport ma pokazywać rzeczywiście potwierdzone lokalizacje: zbudowano minimalny eksport/wydruk z rzeczywistych danych ruchu (istnieje już widok szczegółów ruchu z realnymi `destination_location_name` do wykorzystania jako punkt wyjścia).
- [ ] Wypowiedź prezentera jasno rozróżnia „dane do ręcznej aktualizacji AutoStacji" od automatycznej integracji DMS — nie obiecuje synchronizacji, której nie ma.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 5 zweryfikowany ręcznie na aktualnym build i urządzeniach prezentacji:** utworzenie ruchu 101/PZ → wybór Importu → wybór zapisanej sesji Matchera → zaimportowane linie pojawiają się bez ręcznego przepisywania → przetworzenie reprezentatywnych pozycji (na telefonie, jeśli zbudowano minimalny ekran, albo w uzgodnionej alternatywnej ścieżce) → potwierdzenie rzeczywistych lokalizacji → komputer pokazuje ten sam postęp → obsłużono jeden kontrolowany wyjątek/korektę → zamknięcie przyjęcia → wygenerowanie/eksport raportu zawierającego rzeczywiście potwierdzone lokalizacje do ręcznej aktualizacji AutoStacji.

**Pitch gap:**

To jest najgłębsza luka funkcjonalna spośród dotychczas ocenionych stref P0. Realnie działa tylko połowa łańcucha, i to z zastrzeżeniami: import z Matchera do ruchu 101 na komputerze naprawdę rozwiązuje produkty i wypełnia linie (nie jest fasadą), ale połączenie z sesją źródłową ginie w momencie zapisu (brak kolumny FK, tylko wolny tekst w notatce), nic nie chroni przed podwójnym importem tej samej sesji, a niezapisany import żyje wyłącznie w pamięci przeglądarki. Druga połowa łańcucha — mobilne rozłożenie, rozróżnienie oczekiwane/potwierdzone, kontenery jako realna część przyjęcia, dedykowane zamknięcie, raport z rzeczywiście potwierdzonych lokalizacji — **nie istnieje wcale**, nie tylko „nie została zweryfikowana ręcznie". `/warehouse/deliveries` i `/warehouse/scanning/delivery` to potwierdzone atrapy; akcje kontenera nie mają żadnego wywołania z UI; jedyny realny raport dostawy czyta wyłącznie dane źródłowe Matchera, nigdy dane ruchu magazynowego. Zbudowanie tej strefy do stanu obiecywanego przez skrypt wymaga w praktyce: (1) minimalnego mobilnego ekranu potwierdzenia lokalizacji, (2) trwałego powiązania zapisanego ruchu z sesją Matchera, (3) minimalnego rozróżnienia oczekiwane/potwierdzone, (4) minimalnej operacji zamknięcia, (5) raportu opartego o rzeczywiste dane ruchu. To realna praca implementacyjna wielu dni, nie odhaczenie istniejącego kodu.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Transakcyjność importu/księgowania — częściowa awaria (np. część linii zapisana, reszta nie) nie zostawia ruchu w niespójnym stanie.
- [ ] Idempotentny import z Matchera — powtórne kliknięcie/ponowienie po błędzie sieci nie tworzy zduplikowanych linii ani duplikatu ruchu.
- [ ] Ochrona przed podwójnym importem tej samej sesji Matchera do dwóch różnych ruchów, na poziomie bazy lub aplikacji — dziś nieobecna.
- [ ] Trwałe powiązanie ruchu/linii z sesją/linią źródłową Matchera (kolumna, nie wolny tekst) — potrzebne dla realnej identyfikowalności przy wielu dostawach dziennie.
- [ ] Bezpieczeństwo współbieżnego przyjęcia — kilku pracowników rozkładających tę samą dostawę jednocześnie nie prowadzi do wyścigu przy aktualizacji ilości/lokalizacji.
- [ ] Ochrona przed wyścigiem przy ilościach (dwa jednoczesne potwierdzenia tej samej pozycji).
- [ ] Jawne zasady przyjęcia częściowego (dostawa niekompletna, część pozycji brakuje) i sposobu ich raportowania.
- [ ] Ścieżka korekty/reversal błędnie potwierdzonej lokalizacji z zachowaniem historii.
- [ ] Trwały ślad audytowy całego procesu przyjęcia (kto/kiedy zaimportował, potwierdził, zamknął).
- [ ] Odporne zachowanie przy przerwaniu sieci na magazynie (albo jawna polityka „brak trybu offline", nie cichy fałszywy sukces).
- [ ] Odzyskiwanie/rozliczanie utkniętych, niedokończonych przyjęć.
- [ ] Sprawdzone na realistycznie większych dostawach (więcej pozycji niż zestaw demo).
- [ ] Spójność stanu magazynowego i (jeśli kontenery zostaną podłączone) spójność zawartości kontenerów po wielu operacjach.
- [ ] Testy integracyjne automatyczne pokrywające pełny łańcuch: import z Matchera → zapisany ruch → potwierdzenie lokalizacji → zamknięcie → raport.
- [ ] Realistyczne testy na telefonie (nie tylko symulator/desktop) dla mobilnej części przyjęcia.
- [ ] Izolacja oddziałowa/organizacyjna przyjęcia — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowych elementów tej strefy (np. ewentualnego mobilnego potwierdzenia).
- [ ] Spójność raportowania przy wielu jednoczesnych przyjęciach na tym samym oddziale.
- [ ] **Dokładny scenariusz pilotażu Strefy 5 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym rzeczywista, większa dostawa i co najmniej jedna kontrolowana awaria/korekta.

**Pilot gap:**

Ponieważ bramka pitchu dla tej strefy już wymaga zbudowania większości brakującego łańcucha (mobilne potwierdzenie, zamknięcie, raport z rzeczywistych danych), lista pilotażowa nie dokłada nowego zakresu funkcjonalnego — dokłada twardość: transakcyjność, idempotencję, współbieżność, audyt i realistyczne testy na urządzeniach, których jednorazowy, kontrolowany pokaz nie musi jeszcze wytrzymać, ale codzienna praca wielu pracowników na wielu dostawach — musi.

### Notes / evidence

- Typ ruchu 101 potwierdzony na żywo z bazy (`inventory_movement_types`): `code: "101", name_pl: "Przyjęcie z zamówienia", category: "receipt", cost_impact: "increase", requires_destination_location: true`. Dokładne ciało funkcji księgujących (`inventory_create_draft`, `inventory_save_draft`, `inventory_finalize_posting`, `inventory_create_and_finalize`) istnieje na żywo w bazie, ale **nie ma odpowiadającej definicji `CREATE FUNCTION` w żadnym śledzonym pliku migracji** — kolejny przypadek dryfu schematu, tej samej kategorii co `qr_codes`/`qr_assignments`/`inventory_containers` odnotowane w Strefach 1 i 5.
- Import z Matchera do edytora ruchu: `apps/web/src/app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-import-dialog.tsx` (dialog, podgląd, rozwiązywanie produktów przez `InventoryMovementImportsService.resolveLine`/`WarehouseImportResolverService.resolveVariant` w `warehouse-import-resolver.service.ts:138-151`) → `use-movement-form-state.ts:380-472` (`applyImportedDocument`, realnie wypełnia stan linii) → `use-movement-submission.ts:36-47` (`buildLines`, **pomija** `source_type`/`source_line_id`/`source_order_number` przy budowaniu payloadu zapisu).
- Zapisane kolumny `inventory_movement_lines` (na żywo z bazy): `id, movement_id, organization_id, branch_id, variant_id, unit_id, quantity, source_location_id, destination_location_id, unit_cost, total_cost, currency, exchange_rate, lot_id, serial_id, container_id, note, snapshot_*, line_number` — brak jakiejkolwiek kolumny odwołującej się do sesji/linii Matchera.
- Brak ochrony przed podwójnym importem: `wdd_matcher_sessions`/`wdd_matcher_lines` nie mają kolumny „zaimportowano"/`movement_id`; `getMovementImportCandidates` to bramka gotowości (status/oddział), nie bramka jednorazowości.
- Stan importu żyje wyłącznie w pamięci przeglądarki (`useState` w `use-movement-form-state.ts`, brak `localStorage`/`sessionStorage`) do momentu jawnego zapisu — odświeżenie przed zapisem usuwa cały zaimportowany szkic.
- Mobilne trasy potwierdzone jako atrapy: `apps/web/src/app/[locale]/dashboard/warehouse/deliveries/page.tsx` i `.../scanning/delivery/page.tsx` renderują generyczny komponent `WarehousePlaceholderPage`, potwierdzone testem `placeholder-pages.test.tsx`. Jedyny realny skan telefonem w module magazynowym dotyczy audytów stanu (`audits/[id]/count/_components/guided-count/count-scan-trigger.tsx`), architektonicznie niezwiązanego z przyjęciem.
- Kontenery całkowicie niepodłączone do przyjęcia: kolumna `inventory_movement_lines.container_id` istnieje w schemacie, ale nigdy nie jest ustawiana przez serwis ruchów; akcje mutujące kontener (`createLocationContainerAction`, `addItemsToContainerAction`, `removeItemFromContainerAction`, `relocateContainerAction` w `ambra-location-inventory.ts`) nie mają żadnego wywołania spoza własnego pliku definicji — zależność od Strefy 4, gdzie ten sam model już opisano jako realny, ale niepodłączony do QR/etykiet.
- Brak rozróżnienia oczekiwane/potwierdzone: `inventory_movement_lines` ma jedno pole `quantity`, bez statusu potwierdzenia; jedyny „putaway" w kodzie to statyczna tabela reguł preferencji (`inventory_putaway_rules`), wyświetlana tylko do odczytu, bez żadnego kodu, który by ją faktycznie stosował.
- Brak dedykowanego zamknięcia: serwis ruchów ma wyłącznie `createDraft`/`saveDraft`/`finalizePosting`/`cancelMovement` — te same przejścia statusu dla każdego typu ruchu, bez walidacji specyficznej dla przyjęcia.
- Raport dostawy (`WddMatcherService.getEnhancedPdfData`) czyta wyłącznie `wdd_matcher_block_matches`/`wdd_matcher_blocks`/`wdd_matcher_lines` — pole `location` to surowy tekst z dokumentu źródłowego, nie FK do `warehouse_locations` i nie dane z `inventory_movement_lines.destination_location_id`. Widok szczegółów ruchu używa realnych danych ruchu, ale to zwykły wydruk przeglądarki formularza draft/posted, nie raport z procesu potwierdzania przyjęcia.
- Zależności: Strefa 2 (poprawność danych źródłowych Matchera), Strefa 3 (prawdziwa relacja zlecenia zamiast tekstu w notatce), Strefa 4 (fizyczna tożsamość QR części/zestawu, jeśli mobilne rozłożenie ma z niej korzystać), Strefa 1 (izolacja oddziałowa/RLS nowych elementów tej strefy) — odnotowane, nie duplikowane.

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
