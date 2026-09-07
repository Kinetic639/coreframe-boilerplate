### 5. Lokalizacje, QR, etykiety i fizyczna identyfikacja części/zestawów

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Ta strefa obejmuje trzy fizyczne obiekty, które skrypt wymaga skanować: lokalizację, część i zestaw. Dziś istnieje **jedna** kompletna, rzeczywista ścieżka (lokalizacja: trwały rekord → przypisanie QR → drukowana etykieta → publiczny resolver → logowanie → powrót do lokalizacji) oraz **dwie brakujące** identyfikacje fizyczne wymagane przez ten sam skrypt w tym samym akapicie (§7: „skanuję część albo zestaw"). Rejestr celów QR (`target-registry.ts`) obsługuje dziś dokładnie trzy typy: `warehouse.location`, `helpdesk.ticket`, `planning.task` — żadnego typu dla części ani zestawu. Kontener (`inventory_containers`) jest realnym, zapisanym w bazie modelem z własnym ID i wieloma pozycjami, rzeczywiście wyświetlanym w panelu szczegółów lokalizacji — ale nie ma żadnej kolumny QR, żadnego typu w rejestrze i nie da się go dziś wydrukować ani zeskanować. To dokładnie sytuacja opisana jako 🟠: prymitywy (kontener, generator QR) istnieją, ale nie składają się w spójny przepływ „zeskanuj część albo zestaw", którego wymaga scenariusz. Nie jest to 🟡 PARTIAL, bo brak nie jest drobny ani ograniczony do „niezweryfikowane" — dwa z trzech wymaganych typów fizycznej identyfikacji po prostu nie istnieją w rejestrze celów.

**Dowody:**

- Kod: VERIFIED. Prześledzono cały rejestr celów QR (`apps/web/src/server/qr/target-registry.ts`), akcje przypisania/tworzenia QR dla lokalizacji (`apps/web/src/app/actions/qr/assign-location.ts`), łańcuch generowania etykiety lokalizacji (`print-location-label-dialog.tsx` → `label-designer.tsx` → `apps/web/src/app/api/warehouse/locations/export-labels/route.ts`, który automatycznie tworzy QR przy pierwszym druku etykiety), oraz model kontenera (`inventory_containers`/`inventory_container_lines`, serwis `ambra-location-inventory.service.ts`, realne wywołania w `location-detail-panel.tsx`). Potwierdzono brak jakiejkolwiek kolumny/typu QR dla kontenera i brak jakiegokolwiek trwałego obiektu „fizyczna instancja części" odrębnego od definicji katalogowej produktu/wariantu. Potwierdzono też, że stary schemat (`qr_labels`, `scanning_operations` i pokrewne z migracji `20250806120000`) jest dziś martwy — żaden bieżący kod go nie używa; obecny system opiera się wyłącznie na `qr_codes`/`qr_assignments`, dla których **nie istnieje żadna migracja w repozytorium** (ten sam dryf schematu odnotowany już w Strefie 1) — kolumny/RLS tych tabel oraz `inventory_containers`/`inventory_container_lines` są znane wyłącznie z wygenerowanych typów TS, nie z migracji, więc ograniczenia bazy i polityki RLS pozostają niemożliwe do zweryfikowania z kodu źródłowego.
- Testy automatyczne: PARTIAL — `qr.service.test.ts` sprawdza `warehouse.location` jako typ docelowy oraz ogólny przypadek nieobsługiwanego typu, ale nie testuje jawnie gałęzi `helpdesk.ticket`/`planning.task`; `label-pdf.test.ts` sprawdza generowanie PDF etykiet w kilku rozmiarach, ale ogólnie (nie per typ celu) i wyłącznie na poziomie poprawności bufora PDF, nie fizycznego druku. Zero testów dla `inventory_containers`.
- Weryfikacja ręczna: HISTORICAL — jedyna odnotowana próba to test lokalizacji z 6 sierpnia 2026 (utworzenie lokalizacji w pustym oddziale, wygenerowanie/przypisanie QR, wygenerowanie etykiety, skan telefonem, powrót po logowaniu, wynik API etykiet 20/20). Dotyczyła wyłącznie lokalizacji, nie części ani zestawu, i nie została odtworzona w tej analizie.
- Przebieg end-to-end: NOT VERIFIED dla lokalizacji na aktualnym build; NOT APPLICABLE dla części i zestawu, ponieważ nie istnieje żadna ścieżka do przetestowania (brak typu celu w rejestrze).

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Lokalizacje**

- [ ] Mały, przygotowany zestaw lokalizacji oddziału demo ma unikalne kody i spójne, czytelne nazwy.
- [ ] QR można przypisać/utworzyć dla każdej z tych lokalizacji (sprawdzone na żywo, nie tylko odczytane z kodu akcji).
- [ ] Wydrukowano rzeczywiste etykiety lokalizacji w docelowym rozmiarze na docelowej drukarce/materiale.
- [ ] Każda wydrukowana etykieta lokalizacji skanuje się poprawnie telefonem prezentacyjnym i otwiera dokładnie właściwą lokalizację.
- [ ] Skan bez aktywnej sesji przechodzi przez logowanie i wraca do dokładnie zeskanowanej lokalizacji — odtworzone na aktualnym build, nie tylko przyjęte z próby historycznej.

**Część — decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono, jaki obiekt fizyczny faktycznie ma być skanowany jako „część" w demo — dziś nie ma trwałego celu QR dla części; potrzebna jest świadoma decyzja: (a) dodać minimalny typ celu QR dla części/pozycji na potrzeby tego konkretnego pokazu, albo (b) świadomie przeprojektować scenariusz demo tak, aby nie obiecywał skanowania samej części, tylko np. skanowanie lokalizacji z widoczną zawartością.
- [ ] Jeśli wybrano (a): istnieje trwały cel QR dla części/pozycji, zarejestrowany w `target-registry.ts`, z resolverem prowadzącym do sensownego widoku (nie do generycznego tekstu).
- [ ] Jeśli wybrano (a): etykieta części pokazuje wystarczające dane do identyfikacji (co najmniej SKU/numer katalogowy i krótką nazwę, plus QR) i jest wydrukowana/przetestowana na docelowym sprzęcie.
- [ ] Jeśli wybrano (b): scenariusz prezentacji i wypowiadane zdania nie obiecują funkcji, której nie ma — zweryfikowano treść pokazu pod tym kątem.

**Zestaw/kontener — decyzja architektoniczna wymagana przed pitchem**

- [ ] Ustalono, czy `inventory_containers` (istniejący, realny model z wieloma pozycjami/SKU, już wyświetlany w panelu lokalizacji) ma otrzymać minimalny typ celu QR na potrzeby demo, czy scenariusz demo celowo nie obejmuje skanowania zestawu jako osobnego obiektu.
- [ ] Jeśli tak: kontener ma trwały, przypisywalny cel QR zarejestrowany w rejestrze celów, z resolverem pokazującym tożsamość i zawartość zestawu (liczbę/rodzaj pozycji), nie tylko generyczny tekst.
- [ ] Jeśli tak: etykieta zestawu pokazuje wystarczające dane do identyfikacji (trwałe ID/kod zestawu, liczba pozycji, QR) i jest wydrukowana/przetestowana na docelowym sprzęcie.
- [ ] Jeśli nie: scenariusz prezentacji jawnie nie obiecuje skanowania zestawu jako osobnego, trwałego obiektu.

**Rejestr QR / autoryzacja skanowania**

- [ ] QR z innego oddziału/organizacji, nieprzypisany, odwołany lub usunięty nie prowadzi do niewłaściwej operacji ani nie ujawnia cudzych danych — sprawdzone na żywo dla każdego z faktycznie używanych w demo typów celu.
- [ ] Nieznany/zniekształcony token daje czytelny, bezpieczny błąd zamiast niejasnego zachowania.

**Przygotowanie fizyczne demo**

- [ ] Wybrano ostateczny rozmiar etykiety i przetestowano rzeczywisty druk (nie tylko podgląd PDF) na drukarce, która będzie użyta na prezentacji.
- [ ] Sprawdzono uprawnienia aparatu telefonu prezentacyjnego i warunki skanowania (odległość, oświetlenie) w miejscu, gdzie odbędzie się pokaz.
- [ ] Przygotowano dokładnie tyle etykiet (lokalizacji + ewentualnie części/zestawu, zależnie od powyższych decyzji), ile potrzeba do scenariusza — nie więcej, nie mniej.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 5 zweryfikowany ręcznie na aktualnym build i fizycznym sprzęcie prezentacji:** druk etykiety lokalizacji + etykiety części/zestawu (zgodnie z podjętą decyzją architektoniczną) → skan każdej na telefonie prezentacyjnym → przekierowanie przez logowanie tam, gdzie wymagane → każda prowadzi do właściwego, trwałego obiektu możliwego do dalszego wykorzystania w Strefie 6.

**Pitch gap:**

Lokalizacje mają kompletną, realną ścieżkę: trwały rekord, przypisanie/utworzenie QR (w tym automatyczne przy pierwszym druku etykiety), generowanie etykiety PDF/ZPL, publiczny resolver z poprawną autoryzacją i przekierowaniem przez logowanie. To solidny fundament, ale bez świeżej ręcznej weryfikacji nadal nie może przekroczyć PARTIAL zgodnie z regułami tego audytu.

Część i zestaw to inna sytuacja — to nie kwestia braku świeżej weryfikacji, tylko **brak samej funkcjonalności**: rejestr celów QR nie zna typu „część" ani „zestaw/kontener". Kontener jako model danych istnieje i jest realnie używany w interfejsie (panel lokalizacji pokazuje zawartość kontenerów), ale nie ma żadnego mostu do infrastruktury QR/etykiet — to dokładnie przypadek „prymityw bez frontowego workflow", nie ukończona funkcja. Scenariusz skryptu („skanuję część albo zestaw") wymaga świadomej decyzji przed pitchem: albo zbudować minimalny cel QR dla jednego lub obu tych typów, albo zawęzić obietnicę pokazu tak, żeby nie sugerowała funkcji, której dziś nie ma. Dodatkowo `qr_codes`/`qr_assignments` i `inventory_containers`/`inventory_container_lines` nie mają żadnej migracji w repozytorium — ograniczenia bazy i RLS dla tych tabel są nieznane z kodu źródłowego, co jest tą samą luką dryfu schematu odnotowaną już w Strefie 1.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Migracje dla `qr_codes`, `qr_assignments`, `inventory_containers`, `inventory_container_lines` odtworzone i zapisane w repozytorium, żeby ograniczenia/RLS tych tabel podlegały review, tak jak reszta schematu.
- [ ] Unikalność/integralność tokenów QR wymuszona na poziomie bazy (nie tylko konwencją aplikacji), łącznie z nowymi typami celu, jeśli część/zestaw zostaną dodane.
- [ ] Cykl życia odwołania QR (rewokacja, ponowne przypisanie, wygaśnięcie) jawnie ustalony i przetestowany dla każdego używanego w pilotażu typu celu.
- [ ] Ochrona przed ponownym użyciem/kolizją identyfikatorów fizycznych (np. dwa wydrukowane egzemplarze tej samej etykiety, zgubiona i odtworzona etykieta).
- [ ] Izolacja między organizacjami/oddziałami potwierdzona dla wszystkich używanych w pilotażu typów celu QR (lokalizacja, ewentualnie część/zestaw) — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla tych konkretnych tabel.
- [ ] Trwały ślad audytowy przypisań/rewokacji QR (kto i kiedy przypisał/cofnął QR do obiektu).
- [ ] Bezpieczna procedura wymiany zgubionej/uszkodzonej etykiety bez utraty powiązania z obiektem.
- [ ] Niezawodny druk masowy (wiele lokalizacji/części/zestawów naraz) przetestowany na realistycznej liczbie etykiet, nie tylko garstce demo.
- [ ] Trwałość i czytelność etykiet w rzeczywistych warunkach magazynowych (kurz, wilgoć, ścieranie) potwierdzona, nie tylko wydruk testowy w biurze.
- [ ] Zachowanie „osieroconego" QR po usunięciu/archiwizacji obiektu docelowego (lokalizacji, kontenera) jawnie ustalone — dziś nieznane z kodu.
- [ ] Uprawnienia do generowania/ponownego przypisywania QR zweryfikowane dla realnych ról pilotażowych, nie tylko konta demonstratora.
- [ ] Testy automatyczne resolvera QR rozszerzone o wszystkie faktycznie używane w pilotażu typy celu (dziś pełne pokrycie ma tylko `warehouse.location`).
- [ ] Realistyczny test wieloużytkownikowego skanowania (kilku pracowników skanujących różne obiekty jednocześnie) na tym samym oddziale.
- [ ] Jeśli część/zestaw otrzymają cel QR: decyzja, czy dotyczy to instancji fizycznej (jedna etykieta = jedna dostawa/partia) czy definicji katalogowej — i konsekwentne wymuszenie tego wyboru w modelu danych, żeby uniknąć nieporozumienia „jeden SKU = jeden QR dla wszystkich egzemplarzy".
- [ ] **Dokładny scenariusz pilotażu Strefy 5 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w warunkach zbliżonych do rzeczywistego magazynu.

**Pilot gap:**

Poza ogólnym pogłębieniem twardości QR (integralność, audyt, cykl życia rewokacji, trwałość fizyczna etykiet) najważniejsza dodatkowa praca pilotażowa to domknięcie luki schematu (brakujące migracje dla `qr_codes`/`qr_assignments`/`inventory_containers`) oraz, jeśli demo wprowadzi tymczasowy typ celu QR dla części/zestawu, przemyślenie go od nowa jako właściwego elementu modelu danych (instancja vs. katalog), a nie tylko wystarczającego do jednorazowego pokazu.

### Notes / evidence

- Rejestr celów QR ma dokładnie trzy zarejestrowane typy — `warehouse.location`, `helpdesk.ticket`, `planning.task` — `apps/web/src/server/qr/target-registry.ts:87-256`; komentarz w pliku („Phase 1 supports warehouse.location only") jest już nieaktualny, ale liczba typów pozostaje trzy, nigdy nie obejmuje części/kontenera.
- Ścieżka etykiety lokalizacji: przypisanie/utworzenie QR — `apps/web/src/app/actions/qr/assign-location.ts:20-149`; dialog druku — `apps/web/src/app/[locale]/dashboard/warehouse/locations/_components/print-location-label-dialog.tsx`; generowanie PDF/ZPL z automatycznym provisioningiem QR przy pierwszym druku — `apps/web/src/app/api/warehouse/locations/export-labels/route.ts:48-100`.
- `inventory_containers`/`inventory_container_lines`: realny model z `id, organization_id, branch_id, code, type, status, current_location_id, reference_type, reference_id` i wieloma pozycjami (`variant_id, unit_id, quantity`) — potwierdzony w wygenerowanych typach (`apps/web/supabase/types/target.types.ts`, brak migracji źródłowej) i realnie renderowany w `location-detail-panel.tsx:153-179,1000-1039` oraz `LocationsPage.tsx:241-267,602-605`. Brak jakiejkolwiek kolumny/powiązania QR.
- Brak jakiegokolwiek trwałego obiektu „fizyczna instancja części" odrębnego od katalogowego produktu/wariantu — potwierdzone szerokim wyszukiwaniem w usługach magazynowych; jedyne wystąpienia „item"/„product" blisko „qr" dotyczą tabeli zdjęć produktu (`inventory_item_images`), niepowiązanej z fizyczną identyfikacją.
- Stary schemat skanowania (`qr_labels`, `label_templates`, `qr_scan_logs`, `label_batches`, `scanning_operations`, `scanning_operation_items` z migracji `20250806120000`) jest dziś martwy — zero odwołań w bieżącym kodzie; obecny system używa wyłącznie `qr_codes`/`qr_assignments`.
- Ani `qr_codes`/`qr_assignments`, ani `inventory_containers`/`inventory_container_lines` nie mają odpowiadającej migracji w repozytorium — ten sam dryf schematu odnotowany w Strefie 1 dla tabel Matchera i Help Desku; ograniczenia/RLS tych tabel są nieznane z kodu źródłowego.
- Jedyna zapisana ręczna weryfikacja to test lokalizacji z 6 sierpnia 2026 (utworzenie lokalizacji w pustym oddziale, QR, etykieta, skan telefonem, powrót po logowaniu, wynik API etykiet 20/20) — dotyczy wyłącznie lokalizacji, oznaczony HISTORICAL, nieodtworzony w tej analizie.
- Zależność od Strefy 4: jeśli etykieta części/zestawu ma docelowo pokazywać odniesienie do zlecenia naprawczego, zależy to od trwałej tożsamości zlecenia/pozycji zlecenia ze Strefy 4, której dziś nie ma — tożsamość QR części/zestawu opisana w tej strefie może istnieć niezależnie od zlecenia (jako identyfikacja fizyczna), ale odniesienie do zlecenia na etykiecie wymaga najpierw Strefy 4.

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
