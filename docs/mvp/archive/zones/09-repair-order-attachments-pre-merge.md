### 9. Załączniki zlecenia naprawczego i archiwum dokumentów

**Priorytet:** P0

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Generyczny system załączników jest realny, prywatny i genuinely reużywalny — to nie jest fasada ani coś specyficznego dla ticketów. Architektura oparta o `(targetType, targetId)` i rejestr deskryptorów celu jest w warstwie TypeScript prawdziwie generyczna: serwis, akcje serwerowe, trasa pobierania i komponent UI (`AttachmentsPanel`) nie mają ani jednej gałęzi specyficznej dla ticketu/zadania/karty Kanban — działają wyłącznie na podstawie rejestru. Ale **zlecenie naprawcze, które miałoby stać się czwartym celem, nie istnieje** (Strefa 4: NOT IMPLEMENTED), więc nie ma dziś niczego, do czego mógłby dołączyć się nowy typ. To dokładnie sytuacja opisana jako 🟠: realna, generyczna infrastruktura istnieje, ale brakujący cel (RepairOrder) uniemożliwia jej użycie w tej strefie. Dodatkowo warstwa autoryzacji SQL (`can_access_comment_target`) nie jest tak czysto wtykowa jak warstwa TypeScript — to zaszyty łańcuch `IF p_target_type = '...'`, więc dodanie nowego typu wymaga migracji kopiującej całe ciało funkcji, nie prostego wiersza w tabeli.

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny łańcuch: interfejs `CommentTargetDescriptor` i rejestr trzech typów (`apps/web/src/server/comments/target-registry.ts`), generyczne akcje serwerowe (`apps/web/src/app/actions/attachments/index.ts` — zero gałęzi specyficznych dla typu celu), generyczny serwis (`attachments.service.ts` — cztery metody, wszystkie rozwiązujące deskryptor przez rejestr), generyczną trasę pobierania z 60-minutowym podpisanym URL (`file-response.ts`), generyczny komponent UI (`AttachmentsPanel`, realnie użyty w szczegółach ticketu) oraz funkcję SQL `can_access_comment_target` (trzy migracje kolejno dopisujące gałęzie dla ticket/task/kanban_card — potwierdzony wzorzec kopiowania całego ciała funkcji). Potwierdzono: brak sprzężenia z komentarzami na poziomie tabeli (`app_attachments` nie ma FK do wątku komentarza), prywatny bucket Storage bez publicznych/zgadywalnych URL-i, walidację typu/rozmiaru pliku w trzech niezależnych miejscach (klient, serwis, konfiguracja bucketu Storage), oraz standardowy input pliku HTML bez żadnej dodatkowej integracji — działający natywnie z wyborem zdjęcia/aparatu na telefonie.
- Testy automatyczne: NONE. Wyczerpujące przeszukanie nie znalazło ani jednego testu (jednostkowego, integracyjnego ani e2e) dla całego systemu załączników — upload, listowanie, autoryzacja pobrania, odmowa między organizacjami/celami. Każde rozszerzenie systemu, w tym dodanie RepairOrder, byłoby dziś pozbawione jakiejkolwiek automatycznej ochrony przed regresją.
- Weryfikacja ręczna: NOT VERIFIED dla scenariusza RepairOrder (bo cel nie istnieje); NOT VERIFIED również dla samego mechanizmu na ticketach/zadaniach w tej analizie (brak odnotowanej świeżej próby).
- Przebieg end-to-end: NOT APPLICABLE dla zamierzonego scenariusza tej strefy — nie ma dziś RepairOrder, do którego można by cokolwiek dołączyć.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

**Zależność od Strefy 4**

- [ ] Potwierdzono, że trwałe zlecenie naprawcze ze Strefy 4 istnieje i ma stabilny identyfikator wewnętrzny, zanim rozpocznie się jakakolwiek praca nad tą strefą — bez tego cała reszta tej listy jest niewykonalna.

**Rejestracja RepairOrder jako celu**

- [ ] Dodano wpis `workshop.repair_order` (lub równoważny) do `COMMENT_TARGET_REGISTRY` w `target-registry.ts`, z `validate()` sprawdzającym istnienie zlecenia w danej organizacji/oddziale — wzorowane bezpośrednio na trzech istniejących wpisach, bez tworzenia równoległej, zduplikowanej infrastruktury.
- [ ] Dodano odpowiadającą gałąź dla tego typu w funkcji SQL `can_access_comment_target` (pełna migracja kopiująca istniejące ciało funkcji plus nowy blok `IF`) — świadomie zaplanowane jako osobny krok, nie „przy okazji".
- [ ] Zdefiniowano minimalne uprawnienia odczytu/załącznika dla zlecenia naprawczego, spójne z resztą systemu uprawnień (Strefa 1).

**UI na szczegółach zlecenia**

- [ ] Widok szczegółów zlecenia (Strefa 4: Nagłówek/Pozycje/Magazyn i Zam.) zyskuje czwartą sekcję „Załączniki", renderującą istniejący, niezmieniony komponent `AttachmentsPanel` z `targetType="workshop.repair_order"` i `targetId` zlecenia — bez tworzenia nowego, dedykowanego komponentu.
- [ ] Dodawanie załącznika działa z tego widoku na aktualnym build.
- [ ] Lista załączników jest widoczna i pozwala otworzyć/pobrać plik.

**Wsparcie plików**

- [ ] Zdjęcie JPEG podpisanego dokumentu można wgrać — sprawdzone na żywo dla przygotowanego pliku demo.
- [ ] PDF, jeśli używany w demo, również działa.
- [ ] Limit rozmiaru (25 MB) i dozwolone typy są znane prezenterowi; przygotowany plik demo mieści się w limicie.

**Telefon**

- [ ] Upload z telefonu prezentacyjnego działa — standardowy wybór pliku/aparatu z poziomu przeglądarki, bez dodatkowej aplikacji.
- [ ] Stany ładowania/sukcesu/błędu są czytelne na ekranie telefonu.

**Trwałość**

- [ ] Załącznik pozostaje widoczny po odświeżeniu strony.
- [ ] Załącznik pozostaje widoczny po wylogowaniu i ponownym zalogowaniu.
- [ ] Powiązanie z zleceniem jest zapisane jako rekord w bazie (`target_type`/`target_id`), nie jako konwencja nazwy pliku czy stan lokalny.

**Prywatność**

- [ ] Konto bez dostępu do danego zlecenia/oddziału/organizacji nie może otworzyć załącznika — sprawdzone na żywo dwoma kontami, nie tylko wywnioskowane z kodu.
- [ ] Bezpośredni dostęp do pliku (bez przejścia przez autoryzowaną trasę aplikacji) nie jest możliwy — zgodne z architekturą prywatnego bucketu i podpisanych URL-i, do potwierdzenia na żywo.

**Scenariusz prezentacyjny podpisanego wydania**

- [ ] Przygotowany przykładowy „podpisany dokument wydania" wgrywa się jako zwykły, generyczny załącznik — bez żadnego dedykowanego mechanizmu „wgraj podpisane wydanie".
- [ ] Wypowiedź prezentera jasno opisuje to jako kopię dokumentu z AutoStacji/DMS dołączoną do zlecenia, nie jako oficjalny, podpisany elektronicznie dokument generowany przez Ambrę.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 9 zweryfikowany ręcznie na aktualnym build i urządzeniach prezentacji:** wyszukanie/otwarcie zlecenia naprawczego używanego w demo → otwarcie sekcji Załączniki → wgranie jednego przygotowanego, podpisanego dokumentu wydania AutoStacji/DMS jako zwykłego załącznika JPEG/PDF → potwierdzenie uploadu → wylogowanie → powrót przez normalne wyszukiwanie zlecenia → ponowne otwarcie tego samego zlecenia → załącznik nadal widoczny na liście → otwarcie go z sukcesem → potwierdzenie, że nieuprawnione konto nie ma dostępu do załącznika zlecenia.

**Pitch gap:**

To jedyna strefa P0, w której główna przeszkoda nie leży w samej ocenianej funkcjonalności, tylko w zewnętrznej zależności: generyczny system załączników jest gotowy, przemyślany i nie wymaga przebudowy — potrzebuje wyłącznie nowego wpisu w rejestrze i odpowiadającej gałęzi SQL, dokładnie według istniejącego wzorca, bez duplikowania logiki. Bez Strefy 4 (trwałe zlecenie naprawcze) nie ma jednak niczego, do czego można by ten wpis dodać — to twardy blokier sekwencyjny, nie równoległa praca. Dodatkowe realne ryzyko: warstwa autoryzacji SQL nie jest czystym punktem wtyku (wymaga pełnej migracji kopiującej ciało funkcji), a cały system załączników — łącznie z trzema już działającymi celami — nie ma dziś żadnego pokrycia testami automatycznymi, więc rozszerzenie go o czwarty typ jest pracą bez siatki bezpieczeństwa.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Testy automatyczne dla całego generycznego systemu załączników (upload, listowanie, autoryzacja pobrania, odmowa między organizacjami/celami) — dziś nieobecne dla wszystkich czterech celów, nie tylko dla nowego.
- [ ] Polityka retencji załączników zlecenia (jak długo przechowywać, czy i kto może usunąć) ustalona i wdrożona — dziś usuwanie na poziomie bazy jest całkowicie zablokowane (`DELETE ... USING (false)`), więc jakiekolwiek świadome usuwanie wymaga miękkiego usuwania przez serwis, do zweryfikowania dla nowego celu.
- [ ] Uprawnienia do usuwania/zastępowania błędnie wgranego załącznika ustalone dla realnych ról pilotażowych.
- [ ] Ślad audytowy dodania/usunięcia załącznika zlecenia dla ról administracyjnych.
- [ ] Sprzątanie osieroconych plików w Storage w przypadku nieudanego zapisu wiersza bazy (lub odwrotnie) — do zweryfikowania na realnych awariach, nie tylko szczęśliwej ścieżce.
- [ ] Realistyczne rozmiary zdjęć z telefonu (pełna rozdzielczość aparatu) sprawdzone pod kątem limitu 25 MB i czasu uploadu na realnej sieci magazynowej.
- [ ] Polityka wobec formatu HEIC (domyślny format zdjęć na iPhone) — dziś nieobsługiwany w liście dozwolonych typów; ustalić, czy wymaga dodania czy jawnego komunikatu dla użytkownika.
- [ ] Monitorowanie wykorzystania limitu Storage/bucketu przy realnym wolumenie pilotażowym.
- [ ] Izolacja oddziałowa/organizacyjna załączników zlecenia potwierdzona rzeczywistym testem na żywej bazie — zależność od ogólnych ustaleń RLS ze Strefy 1, tu odnotowana jako wymaganie dla nowej gałęzi `can_access_comment_target`.
- [ ] Współbieżne dodawanie wielu załączników przez różnych użytkowników do tego samego zlecenia sprawdzone pod kątem spójności listy.
- [ ] **Dokładny scenariusz pilotażu Strefy 9 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym realne zdjęcia z telefonu i co najmniej jedna próba nieuprawnionego dostępu.

**Pilot gap:**

Ponieważ generyczna infrastruktura jest już solidna, luka pilotażowa dla tej strefy jest węższa niż w większości pozostałych — głównie brakujące testy automatyczne (dotyczące całego systemu, nie tylko nowego celu), polityka retencji/usuwania (dziś zablokowana na poziomie bazy, wymaga świadomej decyzji operacyjnej) oraz realistyczne testy na prawdziwych zdjęciach z telefonu i realnym wolumenie. Nie wymaga to nowego zakresu architektonicznego — rozszerza istniejący, dobrze zaprojektowany system.

### Notes / evidence

- Interfejs `CommentTargetDescriptor` i rejestr trzech typów (`helpdesk.ticket`, `planning.task`, `planning.kanban_card`) — `apps/web/src/server/comments/target-registry.ts` (deskryptor: `type`, `requiredReadPermission`, `requiredCommentPermission`, `requiredModeratePermission?`, `requiredAttachmentPermission?`, `validate()`, opcjonalne `afterCommentCreated`/`afterAttachmentCreated`).
- Generyczne akcje/serwis bez żadnej gałęzi specyficznej dla typu celu: `apps/web/src/app/actions/attachments/index.ts` (`listAttachmentsForTargetAction`, `uploadAttachmentsAction`, `deleteAttachmentAction`), `apps/web/src/server/services/attachments.service.ts` (`listForTarget`, `uploadForTarget`, `softDelete`, `getById` — wszystkie rozwiązują deskryptor przez `getCommentTargetDescriptor`).
- Generyczna trasa pobierania z podpisanym URL ważnym 60 minut, bez ekspozycji publicznego/zgadywalnego adresu obiektu — `apps/web/src/server/attachments/file-response.ts`.
- Generyczny komponent `AttachmentsPanel` (props `targetType`/`targetId`) realnie użyty w szczegółach ticketu (`ticket-detail-client.tsx`) — ten sam komponent, nie duplikat per typ encji; ta sama zasada dotyczy wątku komentarzy (`CommentsThread`) na zadaniach i kartach Kanban.
- Funkcja SQL `can_access_comment_target` to zaszyty łańcuch `IF p_target_type = '...' THEN ... END IF`, dopisywany kolejnymi migracjami pełną podmianą ciała funkcji (`20260604170000_generic_app_comments.sql` — tylko ticket; `20260604173000_comments_planning_task_target.sql` — dodaje task; `20260605170000_planning_kanban_card_details.sql` — dodaje kanban_card) — dodanie RepairOrder wymaga tego samego wzorca, nie prostego wiersza konfiguracyjnego.
- Brak sprzężenia z komentarzami na poziomie tabeli: `app_attachments` nie ma kolumny/FK do wątku komentarza, jest kluczowane niezależnie przez `(org_id, target_type, target_id)` — `apps/web/supabase/migrations/20260607100000_generic_app_attachments.sql`.
- Prywatność: bucket `app-attachments` ma `public: false`; pobranie zawsze przechodzi przez `file-response.ts`, generujący 60-minutowy podpisany URL i strumieniujący plik przez trasę aplikacji, nie eksponujący go bezpośrednio klientowi; RLS Storage niezależnie re-weryfikuje `can_access_comment_target` przy SELECT/DELETE, INSERT wymaga zgodności segmentu folderu z `auth.uid()`, UPDATE zablokowane w całości.
- Walidacja pliku w trzech niezależnych miejscach: filtr klienta (`attachment-dropzone.tsx`), `validateFile()` w serwisie, oraz konfiguracja bucketu Storage (`allowed_mime_types`, `file_size_limit: 26214400`) — limit 25 MB, maksymalnie 10 plików na partię, brak wsparcia dla HEIC.
- Standardowy input pliku HTML (`&lt;input type="file" accept="..."&gt;`) bez atrybutu `capture` — działa natywnie z wyborem zdjęcia/aparatu telefonu bez dodatkowej integracji.
- Zero testów jakiegokolwiek rodzaju dla całego systemu załączników — potwierdzone wyczerpującym przeszukaniem (`*attachment*.test.*`, testy pgTAP, e2e) w całym `apps/web`.
- Zależności: Strefa 4 (twardy blokier sekwencyjny — bez trwałego RepairOrder ta strefa nie ma celu do rejestracji), Strefa 1 (izolacja oddziałowa/organizacyjna nowej gałęzi autoryzacji, ogólne bezpieczeństwo Storage), Strefa 8 (odnotowane wyłącznie jako źródło scenariusza biznesowego — podpisany dokument wydania — nie jako zależność architektoniczna; załącznik dołącza się do zlecenia, nie do ruchu magazynowego, zgodnie z zamierzonym modelem tej strefy).

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
