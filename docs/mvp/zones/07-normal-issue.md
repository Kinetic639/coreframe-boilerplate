### 7. Zwykłe wydanie części

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Dedykowany przycisk „Wydanie" na pulpicie magazynowym jest dosłownym zaślepką — akcja serwerowa, którą wywołuje, zwraca zawsze ten sam, zaszyty na sztywno błąd: „Issue movements not yet available in v1. Use the movements page." Nie ma żadnego zasianego typu ruchu o kategorii „wydanie"/„issue"/„consumption" — jedyne typy zdolne zmniejszyć stan bez lokalizacji docelowej to `401`/`402`, które są jawnie korektami z inwentaryzacji (nadwyżka/niedobór), nie wydaniem części do odbiorcy. Na poziomie bazy istnieje osobny, gotowy mechanizm `movement_kind='issue'` z prawidłowym zabezpieczeniem przed nadmiernym wydaniem — ale żaden kod aplikacji nigdy go nie ustawia; to martwa zdolność. Istnieje też osierocony plik UI z typem operacji „issue", niepodłączony do żadnej trasy. Da się technicznie zmniejszyć stan konkretnej pozycji w konkretnej lokalizacji, ręcznie tworząc ruch typu 402 w ogólnym edytorze — z prawdziwym zabezpieczeniem przed ujemnym stanem po stronie bazy — ale bez jakiegokolwiek pola odbiorcy/kontekstu (polityka pól nie definiuje ich dla typu 402 w ogóle) i pod błędną nazwą dokumentu („korekta z inwentaryzacji", nie „wydanie"). To dokładnie sytuacja opisana jako 🟠: prymityw zdolny technicznie zmniejszyć stan istnieje, ale nie ma spójnego, nazwanego poprawnie workflow wydania części.

**Dowody:**

- Kod: VERIFIED. Prześledzono zaślepkę `issueStockAction` (`apps/web/src/app/actions/warehouse/inventory/index.ts` ok. linii 1821-1826 — zawsze zwraca błąd), definicję typów 401/402 (`inventory_seed_movement_types`, kategoria `adjustment`, nazwy PL „Korekta z inwentaryzacji"), gałąź `movement_kind = 'issue'` w `inventory_post_movement` (realne, ale nieużywane przez aplikację zabezpieczenie przed ujemnym stanem), politykę pól nadawca/odbiorca (`inventory_movement_type_field_policies` — zdefiniowana dla typów 101/801/311, **nigdy dla 401/402**, więc pola odbiorcy nie są w ogóle oferowane dla jedynego typu technicznie zdolnego pełnić rolę wydania) oraz osierocony plik `inventory-movement-new-client.tsx` (definiuje typ operacji „issue", niezaimportowany nigdzie w repozytorium). Rejestr celów komentarzy/załączników (`target-registry.ts` w `apps/web/src/server/comments/`) nie ma wpisu dla ruchu magazynowego — zgodnie z ustaleniem Strefy 3 (dawna Strefa 9) nie jest to blokerem, bo podpisany dokument dołącza się do zlecenia naprawczego (RepairOrder), nie do ruchu.
- Testy automatyczne: NONE dla realnego zachowania. Istniejące testy (`inventory-phase1-migrations.test.ts`, `inventory-movement-field-policies-migration.test.ts`) sprawdzają wyłącznie obecność fragmentów tekstu SQL w plikach migracji (`toContain("v_header.movement_kind = 'issue'")` itp.), nie wykonują żadnego realnego ruchu i nie testują ścieżki 401/402. Zero testów `issueStockAction` (to trwała zaślepka, więc nie ma czego testować), zero testów odrzucenia nadmiernego wydania na realnej ścieżce, zero testów ponownego odnalezienia wydania.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej próby.
- Przebieg end-to-end: NOT APPLICABLE dla zamierzonego „wydania" (nie istnieje ścieżka do przetestowania — przycisk to zaślepka); NOT VERIFIED dla obejścia przez ręczne utworzenie ruchu 402.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono świadomie, jak demo pokaże „wydanie części", skoro dedykowany przycisk jest dziś zaślepką: (a) podłączyć istniejącą gałąź `movement_kind='issue'` do prawdziwego, choćby minimalnego wejścia UI, (b) tymczasowo nadać typowi 402 pola odbiorcy przez politykę pól i używać go jako obejścia z jasną etykietą w scenariuszu, albo (c) świadomie zawęzić scenariusz demo, żeby nie obiecywał dedykowanego wydania, którego dziś nie ma.

**Typ dokumentu wydania**

- [ ] Wybrany na potrzeby demo mechanizm (zależnie od decyzji wyżej) ma trwały numer dokumentu, status i właściwe oddział/organizację — potwierdzone w kodzie dla ogólnego silnika ruchów, do zweryfikowania na żywo dla wybranej ścieżki.
- [ ] Wymaga lokalizacji źródłowej, nie wymaga docelowej — zgodne z semantyką wydania.

**Wejście do procesu**

- [ ] Użytkownik demo ma praktyczną, przećwiczoną ścieżkę rozpoczęcia wydania (nie improwizowaną nawigację po ogólnym edytorze ruchów podczas samego pokazu).
- [ ] Wybrana część/lokalizacja źródłowa jest jednoznacznie widoczna przed zatwierdzeniem.

**Ilość**

- [ ] Wydanie konkretnej, znanej ilości działa na aktualnym build.
- [ ] Wydanie ilości częściowej (mniej niż cały dostępny stan) działa poprawnie — mechanizm księgowania jest wspólny z relokacją ze Strefy 6 i tam już zweryfikowany w kodzie.
- [ ] Próba wydania więcej niż dostępny stan jest odrzucana po stronie serwera, nie tylko UI — potwierdzone w kodzie dla ogólnego mechanizmu, do zweryfikowania na żywo dla wybranej ścieżki demo.

**Odbiorca/kontekst**

- [ ] Wybrana ścieżka demo faktycznie pozwala zapisać, komu/na jaki kontekst część została wydana — dziś typ 402 nie oferuje żadnego pola odbiorcy (brak wpisu w polityce pól), więc bez zmiany jedynym dostępnym polem jest ogólna notatka tekstowa.
- [ ] Powiązanie ze zleceniem naprawczym, jeśli pokazywane, jest jawnie opisane jako tekst, nie jako trwała relacja — zgodnie z ustaleniem Strefy 3 (Workshop nie istnieje).

**Zatwierdzenie i stan**

- [ ] Zatwierdzenie trwale zmniejsza stan na właściwej lokalizacji — sprawdzone na żywo dla wybranej ścieżki demo.
- [ ] Ponowne kliknięcie/błąd sieci przy zatwierdzaniu nie tworzy dwóch dokumentów wydania — dziś ochrona to wyłącznie blokada przycisku po stronie klienta (`disabled` podczas wysyłki); klucz idempotencji jest generowany na nowo przy każdym wywołaniu, więc nie chroni przed prawdziwym podwójnym zatwierdzeniem.
- [ ] Błąd zapisu nie wygląda na sukces.

**Odnalezienie później**

- [ ] Wydany dokument można ponownie odnaleźć z listy ruchów magazynowych i otworzyć jego szczegóły (ilość, lokalizacja źródłowa, data, numer dokumentu) — potwierdzone jako realna, działająca funkcja ogólnego silnika ruchów.
- [ ] Historia lokalizacji źródłowej pokazuje to wydanie po odświeżeniu/ponownym wejściu.

**Granica ze Strefą 3 (dawna Strefa 9)**

- [ ] Potwierdzono, że podpisany dokument wydania dołącza się do zlecenia naprawczego (Strefa 3, dawna Strefa 9: RepairOrder jako cel załączników), nie do samego ruchu magazynowego wydania — ruch magazynowy nie musi stawać się celem załączników na potrzeby pitchu; jedyna zależność to istnienie zlecenia ze Strefy 3, do którego można nawigować z odnalezionego wydania.

**Narracja o AutoStacji**

- [ ] Wypowiedź prezentera jasno mówi, że oficjalne wydanie nadal odbywa się w AutoStacji podczas pilotażu, a potwierdzenie w Ambrze to dodatkowa warstwa (kontrola magazynowa, historia, ślad fizyczny) — nie zastąpienie AutoStacji ani automatyczna synchronizacja.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 7 zweryfikowany ręcznie na aktualnym build, na stanie utworzonym w Strefach 5–6:** odnalezienie znanej części → rozpoczęcie wydania wybraną ścieżką → wybór właściwej lokalizacji źródłowej → wydanie reprezentatywnej ilości → zapisanie odbiorcy/kontekstu → zatwierdzenie → poprawne zmniejszenie stanu → widoczność stanu/lokalizacji po odświeżeniu → ponowne odnalezienie dokumentu z nowej nawigacji → potwierdzenie ilości, lokalizacji źródłowej, użytkownika/czasu i stabilnej tożsamości dokumentu gotowej pod dołączenie podpisanego dokumentu w Strefie 3 (dawna Strefa 9).

**Pitch gap:**

To druga po Strefie 5 najgłębsza luka funkcjonalna wśród ocenionych dotąd stref P0 — z ważnym zastrzeżeniem, że luka jest węższa niż w Strefie 5, bo mechanizm księgowania (zmniejszanie stanu, blokada nadmiernego wydania, częściowa ilość) jest już sprawdzony i działający dla analogicznej operacji (relokacja, Strefa 6). Brakuje jednak samej **warstwy biznesowej wydania**: dedykowany przycisk jest trwałą zaślepką z zaszytym błędem; jedyny technicznie zdolny typ ruchu (402) nazywa się i jest oznaczony jako korekta z inwentaryzacji, nie wydanie; nie oferuje żadnego pola odbiorcy/kontekstu; ochrona przed podwójnym zatwierdzeniem to wyłącznie blokada przycisku po stronie klienta. Zbudowanie tej strefy do stanu obiecywanego przez skrypt wymaga: (1) świadomej decyzji, którym mechanizmem pokazać wydanie, (2) minimalnego pola odbiorcy/kontekstu dla wybranego typu, (3) prawdziwej ochrony przed podwójnym zatwierdzeniem. Podpisany dokument wydania (Strefa 3, dawna Strefa 9) dołącza się do zlecenia naprawczego, nie do samego ruchu — rejestr celów załączników nie musi więc obejmować ruchu magazynowego na potrzeby pitchu, o ile Strefa 3 dostarczy zlecenie, do którego wydanie się odnosi. To realna, ale węższa niż w Strefie 5, praca implementacyjna.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Dedykowany typ ruchu „wydanie" (nie nadużyty 402) zasiany i podłączony do prawdziwej ścieżki `movement_kind='issue'` — na potrzeby pilotażu nazwa/semantyka dokumentu musi być poprawna, nie tymczasowym obejściem z pitchu.
- [ ] Prawdziwa idempotencja zatwierdzenia (stabilny klucz trzymany w stanie komponentu przez cały cykl żądania, nie generowany na nowo przy każdym wywołaniu) plus ochrona po stronie bazy.
- [ ] Bezpieczeństwo współbieżnego wydania tej samej pozycji przez dwóch pracowników jednocześnie (blokada/kolejkowanie na poziomie salda).
- [ ] Jawne zasady korekty/reversal błędnie wydanej pozycji z zachowaniem historii.
- [ ] Walidacja odbiorcy/kontekstu (np. wymagany, jeśli typ tego wymaga) dopracowana dla realnych ról pilotażowych.
- [ ] Trwały ślad audytowy wydań dla ról administracyjnych.
- [ ] Izolacja oddziałowa/organizacyjna wydań — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowego/podłączonego typu ruchu.
- [ ] Integralność numeracji dokumentów wydania przy realistycznym wolumenie i wielu jednoczesnych użytkownikach.
- [ ] Testy integracyjne automatyczne pokrywające realny przepływ wydania (utworzenie → zatwierdzenie → odrzucenie nadmiernej ilości → odnalezienie) — dziś praktycznie nieobecne.
- [ ] Procedura uzgadniania z AutoStacją (co się dzieje, gdy wydanie w Ambrze i w AutoStacji się rozjadą) ustalona proceduralnie, nie tylko wypowiedziana podczas pitchu.
- [ ] Monitorowanie nieudanych prób wydania (np. odrzuconych z powodu braku stanu) widoczne dla administratora.
- [ ] **Dokładny scenariusz pilotażu Strefy 7 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym współbieżne wydanie i jedna kontrolowana korekta.

**Pilot gap:**

Zakres pilotażowy tej strefy jest w dużej mierze naturalną kontynuacją tego, co pitch-gate już wymusza — nazwany poprawnie, podłączony mechanizm wydania z polem odbiorcy. Ponad to dochodzi twardość specyficzna dla realnego wolumenu: prawdziwa idempotencja (nie tylko blokada przycisku), współbieżność, integralność numeracji dokumentów i procedura uzgadniania z AutoStacją — istotna, bo skrypt explicite mówi, że AutoStacja pozostaje źródłem prawdy podczas pilotażu, więc rozbieżności między systemami muszą mieć ustaloną procedurę, nie tylko dobre intencje.

### Notes / evidence

- Zaślepka dedykowanego wydania: `apps/web/src/app/actions/warehouse/inventory/index.ts` ok. linii 1821-1826 (`issueStockAction` zawsze zwraca `{success: false, error: "Issue movements not yet available in v1. Use the movements page."}`), wywoływana z realnego, osiągalnego formularza na pulpicie magazynowym (`inventory-client.tsx` ok. linii 245-263) — w przeciwieństwie do sąsiednich, realnych akcji przyjęcia/transferu na tej samej stronie.
- Typy 401/402: zasiane jako `category='adjustment'`, `name_pl: "Korekta z inwentaryzacji (nadwyżka/niedobór)"` (`apps/web/supabase-target/supabase/migrations/20260710131915_fix_audit_movement_and_zero_stock.sql` ok. linii 227-250) — zbudowane, żeby dać typ do księgowania sesji inwentaryzacyjnych, nie do wydawania części odbiorcy. Żaden zasiany typ nie ma kategorii issue/consumption/sales/shipment.
- Martwa zdolność na poziomie bazy: gałąź `movement_kind = 'issue'` w `inventory_post_movement` (`apps/web/supabase-target/supabase/migrations/20260506090000_inventory_phase2_enterprise_core.sql` ok. linii 1703-1735) ma prawidłowe zabezpieczenie przed ujemnym stanem, ale żaden kod aplikacji nigdy nie ustawia `movement_kind: "issue"` (jedyne użycie parametru w kodzie to `"opening_balance"`, `inventory-products.service.ts:2310`).
- Osierocony plik UI: `inventory-movement-new-client.tsx` definiuje typ operacji „issue" (linie ok. 28-30, 120-123, 307), ale nie jest importowany nigdzie w repozytorium — realna strona `movements/new/page.tsx` renderuje inny komponent (`MovementDocumentForm`).
- Polityka pól nadawca/odbiorca zdefiniowana wyłącznie dla typów 101 (opcjonalne), 801 (zabronione), 311 (wymagane) — `apps/web/supabase-target/supabase/migrations/20260626150000_inventory_movement_field_policies.sql` i `20260712120000_add_inter_branch_movement_contract.sql`; brak jakiegokolwiek wiersza polityki dla 401/402, więc te pola nie są dziś oferowane w UI dla jedynego typu technicznie zdolnego reprezentować wydanie.
- Ochrona przed podwójnym zatwierdzeniem: kolumna `idempotency_key` i unikalny indeks istnieją (`inventory_movement_headers_org_idempotency_uidx`), ale klucz jest generowany (`crypto.randomUUID()`) wewnątrz callbacku wysyłki przy każdym wywołaniu (`use-movement-submission.ts` ok. linii 105), nie trzymany stabilnie w stanie — realna ochrona przed podwójnym kliknięciem to wyłącznie `disabled={isPending}` na przycisku.
- Odnalezienie ruchu: lista (`InventoryMovementsService.listMovements`, wyszukiwanie po numerze dokumentu/nadawcy/odbiorcy) i szczegóły (`inventory-movement-detail-panel.tsx`) są realne i działające dla ogólnego silnika ruchów; historia lokalizacji (Strefa 6) także pokazuje ruchy. Brak jednak widoku historii ruchów z poziomu szczegółów produktu.
- Rejestr celów załączników/komentarzy (`apps/web/src/server/comments/target-registry.ts`) ma dokładnie trzy wpisy: `helpdesk.ticket`, `planning.task`, `planning.kanban_card` — brak wpisu dla ruchu magazynowego. Zgodnie z ustaleniem Strefy 3 (dawna Strefa 9) nie jest to zależność blokująca tę strefę: podpisany dokument dołącza się do zlecenia naprawczego (RepairOrder), nie do ruchu magazynowego, więc ruch nie musi stać się celem załączników na potrzeby pitchu.
- Zależności: Strefa 1 (izolacja oddziałowa/RLS), Strefa 3 (prawdziwa relacja zlecenia zamiast tekstu, jeśli wydanie ma pokazywać kontekst zlecenia; również cel, do którego Strefa 3 (dawna Strefa 9) dołączy podpisany dokument), Strefa 4/6 (stan magazynowy, z którego wydawana jest część, musi istnieć przed demo tej strefy), Strefa 3 (dawna Strefa 9, podpisany dokument wydania dołącza się do zlecenia naprawczego, nie do tego ruchu — brak zależności architektonicznej w drugą stronę) — odnotowane, nie duplikowane.

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
