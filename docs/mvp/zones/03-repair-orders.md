### 3. Repair Orders / Car Workshop — zlecenia naprawcze, pozycje, dokumenty magazynowe i załączniki

**Priorytet:** P0

**Stan obecny:** 🔴 NOT IMPLEMENTED

Ta strefa powstała z połączenia dawnej Strefy 4 (Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe) i dawnej Strefy 9 (Załączniki zlecenia naprawczego i archiwum dokumentów). Stan pozostaje 🔴 NOT IMPLEMENTED, nie zmienia się na 🟠 na skutek połączenia. Rdzenna domena RepairOrder — trwała encja zlecenia, pozycje, powiązanie z dokumentami magazynowymi — dziś nie istnieje w ogóle (patrz audyt dawnej Strefy 4 poniżej). Dawna Strefa 9 potwierdziła, że generyczny system załączników (`app_attachments`, rejestr `target-registry.ts`) jest realną, prywatną, reużywalną infrastrukturą platformową — ale to ustalenie dotyczy wyłącznie tej infrastruktury, nie domeny RepairOrder. Reużywalny mechanizm załączników nie czyni zlecenia naprawczego częściowo zbudowanym, ponieważ dziś nie istnieje żaden cel (`workshop.repair_order`) w rejestrze, do którego załącznik mógłby się odnieść — nie ma encji, tabeli ani identyfikatora zlecenia, z którym załącznik mógłby zostać powiązany. Innymi słowy: istnienie generycznej, gotowej do rozszerzenia infrastruktury załączników jest faktem o platformie, a nie dowodem postępu w budowie tej strefy. Oba oryginalne audyty są zachowane poniżej w całości.

## Accepted implementation audit

### Former Zone 4 audit — Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe

**Priorytet:** P0

**Stan obecny:** 🔴 NOT IMPLEMENTED

Moduł Workshop to dziś wyłącznie siatka kart „coming soon" bez jakiejkolwiek warstwy trwałości. Nie istnieje żadna trwała encja zlecenia naprawczego, żadna migracja bazy danych z tabelą zlecenia, żadna usługa/akcja/typ `RepairOrder`/`WorkshopOrder`. Numery zleceń z Matchera (Strefa 3) trafiają wyłącznie do nieindeksowanego pola JSONB — nie stanowią to podstawy dla modelu domenowego opisanego w tym zadaniu. Co więcej, kod parsera **nie wyodrębnia dziś w ogóle** identyfikatora warsztatu/magazynu w stylu D3332/D3112 jako niezależnej wartości — jedyne miejsce, gdzie taki kod się pojawia, to funkcja generująca odtworzony PDF, która **wylicza** go z ostatnich cyfr numeru zlecenia/ZW/WDD, a nie odczytuje go z dokumentu źródłowego. Innymi słowy: założenie z tego zadania („ten sam numer zlecenia może wystąpić w różnych kontekstach warsztatowych") jest dziś strukturalnie niemożliwe do odróżnienia w systemie, ponieważ nie istnieje żaden niezależny sygnał kontekstu warsztatu poza samym numerem zlecenia. To nie jest „wczesna, rozłączona" implementacja — to brak modelu domenowego w całości, stąd 🔴 NOT IMPLEMENTED, nie 🟠 czy 🟡.

**Dowody:**

- Kod: VERIFIED (brak). `apps/web/src/app/[locale]/dashboard/workshop/page.tsx` renderuje statyczną siatkę kart (`repairs, vehicles, claims, parts, tasks, handover`) z odznaką „coming soon" i `opacity-60`, bez pobierania danych i bez formularzy. `layout.tsx` tego modułu tylko sprawdza uprawnienia/entitlement, nic więcej. Własna dokumentacja modułu (`apps/web/src/modules/workshop/MODULE.md`) wprost opisuje zakres „Now" jako wyłącznie fundament (shell + karty coming-soon + gate'y) i zakres „Future" jako niezaimplementowany (zlecenia naprawcze, przyjęcie pojazdu, reklamacje, zamawianie części, zadania, przekazanie klientowi). Przeszukano obie gałęzie migracji (`apps/web/supabase/migrations/`, `apps/web/supabase-target/supabase/migrations/`) pod kątem `repair_order`/`workshop_order`/`service_order`/`zlecenie` — zero trafień. Przeszukano `apps/web/src` pod kątem `RepairOrder`/`WorkshopOrder`/`ServiceOrder` — zero trafień.
- Identyfikator warsztatu/magazynu (Dxxxx): kod `D\d+` w `parser_v4.ts` występuje wyłącznie jako granica tekstu do wykrycia/odcięcia nagłówka bloku (`isBlockTitleLine`, linia ok. 477; czyszczenie nazwy grupy, linia ok. 1213) — nigdy nie trafia do żadnego pola/metadanej jako samodzielna wartość. Jedyne miejsce, gdzie etykieta „D####" trafia do wyniku, to `enhanced-delivery-pdf.tsx` (`bodyShopCode`, ok. linii 343-346) — funkcja czysto wyliczeniowa, budująca `"D" + ostatnie cyfry numeru zlecenia/ZW/WDD`, nie odczyt z dokumentu. Potwierdza to, że dzisiejszy system nie ma żadnego niezależnego sygnału kontekstu warsztatowego.
- Testy automatyczne: NONE — nie istnieje żaden test dotyczący zlecenia naprawczego, bo nie istnieje funkcjonalność, którą można by przetestować.
- Weryfikacja ręczna: NOT APPLICABLE — nie ma czego weryfikować ręcznie; strona pokazuje wyłącznie statyczne karty „wkrótce".
- Przebieg end-to-end: NOT VERIFIED / NIEMOŻLIWY DO WYKONANIA na dzisiejszym build — nie istnieje ścieżka wyszukania zlecenia → nagłówek → pozycje → dokumenty magazynowe, bo żaden z tych ekranów nie ma zaplecza.

**Wymagany stan dla pitchu:** DEMO READY

Skrypt (§5, §7, §9–11) zapowiada, że Ambra „łączy informacje z lokalizacjami i historią operacji" oraz pokazuje zlecenie → części → lokalizacje jako spójną ścieżkę. Ta strefa jest warunkiem tej obietnicy w zakresie, w jakim demo ma pokazywać rzeczywiste zlecenie z wieloma częściami i wieloma dokumentami dostawy — nie w zakresie pełnego modułu Workshop.

### Pitch readiness checklist

**Tożsamość zlecenia**

- [ ] Istnieje trwała encja zlecenia naprawczego z własnym wewnętrznym identyfikatorem (nie identyfikatorem sesji Matchera i nie surowym numerem zlecenia jako kluczem głównym).
- [ ] Tożsamość biznesowa zlecenia jest bezpieczna: sam `order_number`/`zl_number` NIE jest traktowany jako unikalny w skali organizacji/oddziału — ustalono i zaimplementowano złożony klucz (co najmniej: organizacja/oddział + kontekst warsztatu/magazynu, gdy jest dostępny + numer zlecenia).
- [ ] Ustalono, w jaki sposób system rzeczywiście pozyska kontekst warsztatu/magazynu (Dxxxx lub odpowiednik) — dziś nie jest on parsowany jako niezależna wartość, tylko wyliczany z numeru zlecenia w jednym, niepowiązanym miejscu (generator PDF). Bez realnego, niezależnego źródła tego sygnału złożony klucz z punktu wyżej jest fikcyjny.
- [ ] Ten sam numer zlecenia w innym kontekście warsztatowym nie koliduje z istniejącym zleceniem — sprawdzone na przygotowanych danych, nie tylko założone.

**Nagłówek**

- [ ] Minimalne dane źródłowe (numer zlecenia/ZL, BLWK, ZW, VIN jeśli dostępny, kontrahent/klient jeśli dostępny, marka/dealer, oddział) są trwale zapisane przy zleceniu, nie tylko odczytywane doraźnie z metadanych sesji Matchera.
- [ ] Widok nagłówka pokazuje te dane w jednym miejscu, czytelnie powiązane z konkretnym zleceniem.

**Pozycje**

- [ ] Zlecenie ma trwałą, kompletną, NIEGRUPOWANĄ według dokumentu WDD listę pozycji — użytkownik widzi wszystkie części zlecenia niezależnie od tego, którą dostawą dotarły.
- [ ] Każda pozycja ma SKU/numer katalogowy, nazwę, zamówioną ilość i jednostkę, powiązanie z konkretnym zleceniem (nie tylko z produktem katalogowym — rozróżnienie „produkt katalogowy" vs „pozycja zlecenia" jest zachowane).
- [ ] Widoczny jest aktualny stan magazynowy/status każdej pozycji (co najmniej: oczekiwana / przyjęta / gdzie się znajduje), pochodzący z realnych operacji magazynowych, nie z domysłu.
- [ ] Dostawa tej samej pozycji w kilku różnych dokumentach WDD nie tworzy duplikatu pozycji zlecenia — ilości/lokalizacje się sumują/aktualizują na tej samej logicznej pozycji.

**Magazyn i Zam. (dokumenty)**

- [ ] Jedno zlecenie może mieć wiele powiązanych dokumentów magazynowych (różne dokumenty WDD, ewentualne późniejsze wydanie) — każdy zachowany jako osobny rekord.
- [ ] Dwa różne dokumenty WDD odnoszące się do tego samego zlecenia (np. WDD 2647 i WDD 2663 dla tego samego ZL/ZLEC) są poprawnie powiązane z jednym zleceniem, nie tworzą dwóch osobnych zleceń — sprawdzone na przygotowanym przykładzie z rzeczywistych danych Matchera.
- [ ] Ponowny import tego samego dokumentu WDD nie duplikuje dokumentu ani jego pozycji.

**Integracja z Matcherem (Strefa 3 → Strefa 4)**

- [ ] Zapisana sesja Matchera (Strefa 3) potrafi rozpoznać/utworzyć zlecenie naprawcze na podstawie wyekstrahowanych identyfikatorów.
- [ ] Powtórne przetworzenie danych dla tego samego zlecenia rozwiązuje się do tego samego zlecenia, nie tworzy duplikatu.
- [ ] Różne dokumenty WDD dla tego samego zlecenia pozostają osobnymi dokumentami magazynowymi przypisanymi do jednego zlecenia, zgodnie z modelem wyżej.
- [ ] Pozycje z Matchera są poprawnie skojarzone z pozycjami zlecenia, nie tylko wyświetlone obok siebie.

**Interfejs**

- [ ] Istnieje wyszukiwanie zlecenia po numerze.
- [ ] Niejednoznaczny numer zlecenia (ten sam numer w różnych kontekstach warsztatowych) jest jawnie rozstrzygany w UI — użytkownik nie trafia po cichu do przypadkowego zlecenia.
- [ ] Istnieje widok szczegółów zlecenia z trzema sekcjami: Nagłówek, Pozycje, Magazyn i Zam.
- [ ] Odświeżenie strony i ponowne zalogowanie nie gubi żadnych z powyższych danych — wszystko odtwarzane z backendu.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 4 zweryfikowany ręcznie na aktualnym build, na reprezentatywnych danych obejmujących:** jedno zlecenie naprawcze z wieloma częściami, co najmniej dwa osobne dokumenty WDD dla tego samego zlecenia, obecny identyfikator kontekstu warsztatu/magazynu, wyszukanie zlecenia, oraz wszystkie trzy widoki (Nagłówek/Pozycje/Magazyn i Zam.) pokazujące spójne, trwałe dane po odświeżeniu.

**Pitch gap:**

Cała funkcjonalność wymagana przez tę strefę jest dziś nieobecna, nie częściowa. Nie ma trwałej encji zlecenia, nie ma pozycji zlecenia jako osobnej relacji od katalogu produktów, nie ma powiązania wiele-dokumentów-WDD-do-jednego-zlecenia, nie ma widoku Nagłówek/Pozycje/Magazyn i Zam., nie ma wyszukiwania zlecenia. Dodatkowo brakuje samego surowca potrzebnego do bezpiecznej tożsamości biznesowej: kod dziś nie wyodrębnia niezależnego identyfikatora kontekstu warsztatu/magazynu (Dxxxx) z dokumentu źródłowego — jedyna istniejąca „wersja" tego identyfikatora jest matematycznie wyliczona z samego numeru zlecenia w module generowania PDF, więc nie może pełnić roli niezależnego sygnału odróżniającego dwa zlecenia o tym samym numerze w różnych kontekstach. Zbudowanie tej strefy wymaga w praktyce: (1) nowego modelu danych zlecenia i pozycji zlecenia, (2) potwierdzenia lub wprowadzenia realnego parsowania identyfikatora warsztatu/magazynu z dokumentów źródłowych (nie z generowanego PDF), (3) logiki rozpoznawania/tworzenia zlecenia z danych Matchera, (4) nowego interfejsu z trzema widokami i wyszukiwaniem. To realna praca implementacyjna, nie tylko odhaczenie istniejącego kodu.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Ograniczenia bazy danych (unique constraints) wymuszające złożoną tożsamość biznesową zlecenia (organizacja/oddział + kontekst warsztatu + numer), nie tylko konwencję po stronie aplikacji.
- [ ] Import Matcher → zlecenie jest idempotentny — powtórne przetworzenie tych samych danych (błąd sieci, ponowny upload) nie tworzy duplikatu zlecenia ani duplikatu dokumentu WDD.
- [ ] Bezpieczeństwo współbieżnego importu — dwóch pracowników przetwarzających dostawy w tym samym czasie nie tworzy wyścigu prowadzącego do dwóch zleceń dla jednej sprawy.
- [ ] Ochrona przed zdublowanym dokumentem WDD (ten sam dokument wgrany dwukrotnie) na poziomie bazy, nie tylko UI.
- [ ] Granice transakcyjne przy tworzeniu/aktualizacji zlecenia i jego pozycji — częściowa awaria nie zostawia zlecenia w niespójnym stanie (np. dokument dodany, pozycje nie).
- [ ] Ścieżka korekty/pojednania błędnego rozpoznania identyfikatora źródłowego (np. źle zinterpretowany kontekst warsztatu) bez utraty historii i bez ręcznej ingerencji w bazę.
- [ ] Obsługa scalania/konfliktu, gdy dwa niezależnie utworzone rekordy okazują się dotyczyć tego samego zlecenia.
- [ ] Trwały ślad audytowy zmian zlecenia (kto/kiedy utworzył, powiązał dokument, zmienił status).
- [ ] Izolacja między organizacjami/oddziałami dla nowych tabel zlecenia i pozycji — zależność od ogólnych ustaleń RLS ze Strefy 1, tu tylko odnotowana jako wymaganie dla nowych tabel, nie duplikowana.
- [ ] Wydajność wyszukiwania zlecenia przy realistycznej liczbie zleceń/pozycji dla pilotażowego oddziału, nie tylko przy garstce danych demo.
- [ ] Zachowanie archiwizacji/zamknięcia zlecenia ustalone (co się dzieje ze zleceniem po zakończeniu obsługi).
- [ ] Bezpieczna obsługa niekompletnych/zniekształconych metadanych z Matchera (brak numeru zlecenia, brak kontekstu warsztatu) — zlecenie nie powstaje po cichu z błędnymi/pustymi danymi tożsamości.
- [ ] Bezpieczna ewolucja schematu przy przejściu z dzisiejszego stanu (brak modelu) do nowych tabel — plan migracji danych historycznych z Matchera, jeśli mają zostać powiązane retroaktywnie.
- [ ] Testy integracyjne automatyczne pokrywające: Matcher → rozpoznanie/utworzenie zlecenia → wiele dokumentów WDD → spójny widok pozycji.
- [ ] Realistyczny test wieloużytkownikowy: różni pracownicy przeglądający/aktualizujący to samo zlecenie jednocześnie.
- [ ] **Dokładny scenariusz pilotażu Strefy 4 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami**, w tym powtórny import i przypadek dwóch dokumentów WDD dla jednego zlecenia na realnych danych.

**Pilot gap:**

Ponieważ pitch-gate dla tej strefy wymaga zbudowania całego modelu domenowego od zera, lista pilotażowa nie dokłada nowego zakresu funkcjonalnego (nie żąda pełnego DMS, mechaników, harmonogramowania, faktur, CRM — zgodnie z jawnym wykluczeniem tego zadania) — dokłada wyłącznie twardość i bezpieczeństwo tego samego modelu: ograniczenia bazy, idempotencję, współbieżność, audyt i izolację, które są nieodzowne, zanim rzeczywiste zlecenia wielu pracowników i wiele dostaw dziennie zaczną tworzyć dane w tym module.

### Notes / evidence

- Placeholder potwierdzony: `apps/web/src/app/[locale]/dashboard/workshop/page.tsx` (siatka kart „coming soon"), `apps/web/src/app/[locale]/dashboard/workshop/layout.tsx` (tylko gate'y uprawnień), `apps/web/src/modules/workshop/MODULE.md` (jawny podział „Now"/„Future"), `apps/web/src/modules/workshop/config.ts` (`items: []`).
- Zero migracji, zero usług/typów `RepairOrder`/`WorkshopOrder`/`ServiceOrder` w całym repozytorium (obie gałęzie migracji przeszukane).
- Kod `D\d+` w parserze służy wyłącznie do wykrywania granicy bloku tekstu i jest odcinany, nie przechwytywany: `apps/web/src/lib/tools/svwms-wdd-matcher/parser_v4.ts` (`isBlockTitleLine` ok. linii 477; czyszczenie nazwy grupy ok. linii 1213; `isInterBlockClientRow` ok. linii 512) — plik bajt-w-bajt identyczny z kopią w `apps/public-web`.
- Jedyne miejsce, gdzie etykieta „D####" trafia do wyniku, to funkcja wyliczeniowa `bodyShopCode` w `apps/web/src/lib/tools/svwms-wdd-matcher/enhanced-delivery-pdf.tsx` (ok. linii 343-346), budująca ją z końcowych cyfr numeru zlecenia/ZW/WDD — nie z niezależnego odczytu dokumentu źródłowego.
- Silnik dopasowania (`matcher.ts`) i serwis (`wdd-matcher.service.ts`) używają `order_number`/`zl_number` wyłącznie do wyświetlania i sortowania (np. `wdd-matcher.service.ts` ok. linii 544-588) — nigdy jako klucza deduplikacji ani powiązania między sesjami.
- Żadna tabela ani ograniczenie w schemacie Matchera (`wdd_matcher_blocks`, `wdd_matcher_sessions` — `apps/web/supabase/migrations/20260415100000_svwms_wdd_matcher_tables.sql`) nie linkuje bloków/zleceń między różnymi sesjami — dopasowania są ograniczone wyłącznie do bloków w obrębie jednej sesji (`session_id` FK). Dwa osobne importy WDD dla tego samego zlecenia są dziś całkowicie niepowiązane w systemie.
- Ta strefa zależy od Strefy 3 jako źródła danych wejściowych (numer zlecenia, SKU, ilości, metadane) — nie duplikuje jej ustaleń, tylko z nich korzysta jako punktu startowego dla modelu domenowego, którego dziś brakuje.
- Przykład z rzeczywistych danych referencyjnych do wykorzystania przy przyszłej weryfikacji: zlecenie ZL/ZLEC 174646 (BLWK 81, ZW 1303, kontekst D3332) występujące w WDD 2647 i WDD 2663 — dziś nic w systemie nie wie, że to jedno zlecenie.

### Former Zone 9 audit — Załączniki zlecenia naprawczego i archiwum dokumentów

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

> This section is intentionally separate from the accepted implementation audits above.
>
> The audits describe what currently existed at the time they were accepted. This section documents a subsequent, deep architecture-planning pass (2026-09-09) combining live Supabase MCP inspection of the **target** project (`rjeraydumwechpjjzrus`, `ambra-system-target`) with fresh repository tracing. It proposes how RepairOrder SHOULD be built. Nothing in this section has been implemented.
>
> **PLAN STATUS: PROPOSED — REQUIRES PRODUCT OWNER REVIEW BEFORE IMPLEMENTATION.**
>
> **CORRECTION PASS (2026-09-09, same day):** the product owner reviewed the first version of this plan and accepted its overall shape, but rejected five specific architectural simplifications as premature. This section is the corrected version. Where the previous pass's conclusion is superseded, that is stated explicitly rather than silently rewritten, because the corrected reasoning (why the simplification was wrong) is itself part of the record other reviewers need. Evidence is tagged **LIVE VERIFIED** (fresh MCP query against `supabase-target` this pass), **REPO VERIFIED** (current repository state), **HISTORICAL** (true only at some past point / an artifact of test data), or **UNRESOLVED** (still needs product-owner input or further investigation before implementation).
>
> **FINAL CLARIFICATION PASS (2026-09-09, later same day):** the architecture above is broadly accepted. This further pass resolves three remaining ambiguities before approval: (1) exact semantics of `order_number` vs `zl_number`/`zw_number`/`wdd_number` vs the `BLWK`/`BL` prefix tokens — this **overturns the business-identity recommendation from the correction pass above** (that pass's Option A, keying on `order_number`, is superseded by Option B, keying on `zl_number`, per hard cardinality evidence below); (2) the source-document natural key, refined to account for content that legitimately varies across repeated occurrences of the same external number; (3) a documentation fix — the model was mislabeled "six-table," it has always been eight tables. No other accepted decision (CRM advisor model, approval gate, M:N provenance, movement-line linkage, atomic materialization, migration baseline prerequisite) is reopened.

### Verified technical findings

- **Workshop module has zero persistence** — REPO VERIFIED (unchanged from the frozen audit above; re-confirmed this pass by re-reading `apps/web/src/app/[locale]/dashboard/workshop/page.tsx`).
- **`wdd_matcher_sessions.status` enum has 5 values** (`pending`, `processing`, `ready_for_review`, `approved`, `rejected`, `failed` — 6 including `failed`) — REPO VERIFIED (enum definition) + LIVE VERIFIED (`approved` rows exist live, e.g. session `e6969705-262f-444b-8506-8fc91b96f864`, created 2026-04-14). No application code path calls `approveSession`/writes `status = 'approved'` — REPO VERIFIED, zero callers found for a `WddMatcherService.approveSession` method (it does not exist; only the enum value and presumably manually-seeded/test rows reach it).
- **`wdd_matcher_blocks`**: 8,916 rows live. `block_type` distribution — LIVE VERIFIED: `brand_order` 5,024 (56%), `wdd_reconciliation` 3,389 (38%), `direct_order` 503 (6%).
- **`wdd_matcher_lines.id` is a stable UUID primary key**, FK'd from `block_id` (→ `wdd_matcher_blocks`, `ON DELETE CASCADE`) and `session_id` (→ `wdd_matcher_sessions`, `ON DELETE CASCADE`) — LIVE VERIFIED (constraint list). `line_number` is an integer with no uniqueness constraint of its own — it is a block-relative array position, not a durable identity. No column on this table records any provenance beyond `block_id`/`session_id`; nothing dedupes rows sharing `product_code`.
- **`inventory_movement_lines` has no line-level reference/provenance column** — LIVE VERIFIED, fresh `information_schema.columns` query this pass (26 columns: id, organization*id, branch_id, movement_id, line_number, variant_id, source/destination_location_id, unit_id, quantity, unit_cost, total_cost, currency, note, timestamps, lot/serial/container_id, exchange_rate, five `snapshot*\*`display columns). None of these is a reference/external-id/metadata column usable to attribute a movement line back to a specific`RepairOrderLine`. Header-level `inventory_movement_headers.reference_type`/`reference_id` (REPO VERIFIED, unchanged from prior pass) is the only existing linkage mechanism, and it is order-level, not line-level.
- **`crm_contacts`** — LIVE VERIFIED fresh schema/constraint pull this pass. Columns: `id, organization_id, linked_user_id, visibility_scope, owner_user_id, branch_id, first_name, last_name, display_name, email, phone, mobile, avatar_storage_path, job_title, notes, created_by, updated_by, created_at, updated_at, deleted_at`. `linked_user_id` is a nullable FK to `public.users` (`ON DELETE SET NULL`) with **no unique constraint or unique index** — the DB does not today prevent two `crm_contacts` rows from linking to the same `user_id`. `visibility_scope` is a plain `text` CHECK-constrained enum (`private`/`branch`/`organization`), with companion CHECKs enforcing `branch_id` required when scope is `branch` and `owner_user_id` required when scope is `private`. There is no `contact_type` column.
- **`crm_party_roles.role`** is a plain `text` CHECK constraint (`supplier`, `client`, `contractor`, `vendor`, `partner`, `receiver`, `payer`, `other`) — LIVE VERIFIED, not a Postgres enum type. Table is a thin party↔role junction (`id, organization_id, party_id, role, created_at`). No `employee`/`advisor`/`staff` value exists today.
- **`wdd_matcher_session_files`** — LIVE VERIFIED schema: `id, session_id, organization_id, file_role, file_path, file_name, file_size, brand_label, parsed_at, parse_error, created_at`. One row per uploaded file, FK'd to exactly one session. A session can hold several files (different `file_role` values, e.g. per-brand exports), but each file belongs to exactly one session — there is no existing file-level identity that survives across sessions.

### Live Supabase findings — Correction 1 deep dive: the D-code (official warehouse/workshop code)

The first pass concluded the D-code (`D3112`/`D3142`/`D3252`/`D3332`-style values) was a near-absent artifact (46 of 8,916 blocks, 0.5%, only as a literal substring inside `warehouse_section`/`block_header_text`) and recommended descoping it from business identity. **The product owner correctly rejected this — the first pass under-searched.** Re-investigation this pass, going beyond the free-text header field into the _structured_ document-number metadata, overturns the conclusion:

- **A. Does the literal code exist in current source/live data? YES, and far more broadly than first found.** The 4-digit code (always prefixed `3`: `3112`, `3142`, `3252`, `3332`, plus a single-digit-transposition OCR artifact `3122` appearing 169 times, almost certainly a misread of `3112`) is embedded as a structured trailing segment inside three separate parsed document-number fields, not just the rare header text:
  - `metadata->>'zl_number'` (pattern `ZL/<seq>/<yr>/<Dcode>/BL` or `ZLEC/<seq>/<yr>/<Dcode>/BL`): present with a valid D-code on **4,674 of 5,024** `brand_order` blocks (93%).
  - `metadata->>'zw_number'` (pattern `ZW/<seq>/<yr>/<Dcode>`): present with a valid D-code on **3,586 of 5,024** `brand_order` blocks (71%) and **322 of 503** `direct_order` blocks (64%).
  - `metadata->>'wdd_number'` (pattern `WDD/<seq>/<yr>/<Dcode>`): present with a valid D-code on **2,544 of 3,389** `wdd_reconciliation` blocks (75%) — but see finding E below, this is not evidence the code varies per WDD document; it does not.
  - LIVE VERIFIED via `regexp_match` extraction across all 8,916 blocks this pass (superseding the prior pass's substring-only search of `warehouse_section`).
- **B. Is it stable enough to parse? YES**, more so than the free-text header. It sits at a fixed structural position (the segment before `/BL` in `zl_number`, or the final segment of `zw_number`/`wdd_number`) rather than embedded in freeform Polish sentence text. This is consistent with — not contradicted by — the frozen audit's finding above that `enhanced-delivery-pdf.tsx`'s `bodyShopCode` helper "computes" a D-code from "the last digits of the order/ZW/WDD number": that helper is reading the same structural segment, just doing so ad hoc inside a PDF-rendering function instead of persisting it as a first-class parsed field. The raw material was already being extracted into `zl_number`/`zw_number`/`wdd_number` metadata; only the D-code's independent extraction as its own field is missing.
- **C. Is it present for every relevant block? NO — this is the real limiting fact, and it cuts differently than the first pass thought.** Coverage is 64–93% depending on document type, not 100%, and — critically — **it is not 1:1 with `order_number` (`BLWK/<n>`)**. LIVE VERIFIED via a per-`order_number` grouping this pass: many `order_number` values span **multiple distinct D-codes** across their associated blocks (e.g. `BLWK/106`: 105 blocks, 3 distinct `zl_number` D-codes and 3 distinct `zw_number` D-codes; `BLWK/101`: 70 blocks, 3 distinct D-codes; this pattern recurs across dozens of `order_number` values, not as a rare exception). Only `3142` appears as a WDD-side D-code across the entire dataset (2,544 of 2,544 D-code-bearing `wdd_reconciliation` rows) — WDD reconciliation documents in this dataset are scoped to a single department/section.
- **D. Can it be normalized deterministically? Only at the ZL/ZW/WDD-number-and-block level, not at the `order_number`/RepairOrder level.** The D-code is a real, structurally stable, mostly-present attribute of an individual brand/direct order line-block or WDD reconciliation document — **but it is not a stable attribute of the coarser `order_number` (`BLWK/<n>`) grouping**, because one `order_number` legitimately spans multiple departments/warehouse sections, each carrying its own D-code. This directly contradicts a design that would store a single `official_warehouse_code` column on the RepairOrder header as an immutable, always-present value. It confirms — independently, from live data rather than from the abstract principle — the product owner's instinct that this needed a normalized (not a flattened/simplified) design: **the D-code belongs at the source-document / source-block level (Correction 3/4's provenance model), not as a scalar RepairOrder header field.** A RepairOrder header business-identity component derived from the D-code (see recommendation below) must be understood as "the D-code(s) observed across this order's source documents," which can legitimately be a set, not a single value.
- **E. Does the same source expose a branch/workshop code component (the "BLKOM" example)? YES, confirmed live, and it is a distinct concept from the D-code.** `metadata->>'order_number'` is **100% prefixed `BLWK/`** across all 5,062 non-null values live (`BLWK/6`, `BLWK/101`, …) — LIVE VERIFIED via prefix extraction, zero other prefixes found. `BLWK` functions exactly as the product owner's "BLKOM" example described: a constant branch/workshop-code component embedded in the order-number string, structurally distinct from the D-code (which lives in the ZL/ZW/WDD numbers, not in `order_number`). Because this dataset covers a single branch/workshop, cross-branch variability of the `BLWK`-equivalent prefix could not be observed live — but the _mechanism_ (a stable alpha prefix segment on `order_number`, independent of the numeric D-code segment elsewhere) is confirmed to exist in the source data, which is what matters for schema design. No other alpha-code token (4+ uppercase letters) was found anywhere in `warehouse_section`/`block_header_text` outside the literal word "Blacharnia" (Polish: "body shop" — a department name, not a code).
- **F. What fallback/resolution state is needed for missing cases? A staged/nullable model, not a hard NOT NULL business-identity column.** Given 7–36% of blocks (depending on type) carry no parseable D-code and a meaningful fraction of `order_number` groupings span more than one D-code, any RepairOrder business-identity design must treat the D-code as **optional, multi-valued at the order level, and independently resolvable per source document** — never as a single required field blocking order creation.

**Superseded conclusion (correction pass, no longer current — kept for the record, see final clarification pass below):** the correction pass above recommended `organization_id + branch_id + order_number` as RepairOrder business identity. The final clarification pass's cardinality analysis (next section) proves `order_number` is not fit for this purpose — it is superseded by `zl_number`.

### Live Supabase findings — final clarification pass: `order_number` vs `zl_number`/`ZLEC` vs `BLWK`/`BL` vs D-code

The correction pass above treated `order_number` (the field literally named that in Matcher metadata) as the RepairOrder business identifier, reasoning from its name and its high presence rate. This pass tests that assumption directly against `zl_number`, VIN, and D-code cardinality, using LIVE Supabase data, and finds the assumption wrong.

- **A. What `metadata.order_number` actually is: a coarse, unreliable internal batch/ticket label — NOT a repair-order identifier.** LIVE VERIFIED, joining `order_number` against `zl_number` and `vin` on the same block rows (4,677 blocks carry both): a single `order_number` value regularly aggregates dozens of distinct vehicles. `BLWK/6` alone spans **79 distinct `zl_number` values, 60 distinct VINs, and 5 distinct D-codes** across 1,172 blocks; `BLWK/67` spans 18 distinct `zl_number`/10 VINs/3 D-codes; this pattern (many-VINs-per-`order_number`) holds broadly, not as an outlier. Worse: `order_number` is **not even reliably 1:1 with a vehicle within a single session** — one specific vehicle (VIN `TMBZZZAAZHD605155`, `zl_number` `ZLEC/168728/26/3332/BL`) is tagged with **two different `order_number` values (`BLWK/24` and `BLWK/60`) inside the very same Matcher session** (`4c86dcbf-6082-4e8d-8be0-67d0b18f319b`, same timestamp). `order_number` is also frequently absent even when `zl_number`/`vin` are present (many blocks show `zl_number` + `vin` populated with `order_number = NULL`). Read together, this is consistent with `order_number` being AutoStacja's own internal ticket/batch-sequence label (its "WK" — likely a workshop-ticket counter) rather than a stable per-vehicle repair-order key — it groups by an internal administrative event, not by the repair order the business actually tracks.
- **B. What `zl_number`/`ZLEC` actually is: the true, stable, per-vehicle repair-order identifier.** LIVE VERIFIED: joining `zl_number` against `vin`, **every sampled `zl_number` maps to exactly 1 distinct VIN**, with zero exceptions found across the top-cardinality rows checked. This matches the product owner's own conceptual description of the business identifier (`52134/26/3112/BLKOM`-style: sequence/year/D-code/branch-suffix) far more closely than `order_number` ever did — `zl_number`'s actual live format is `ZL|ZLEC/<seq>/<yr>/<Dcode>/BL`, structurally the same shape. `order_number` cannot map to `zl_number` 1:1 (per finding A), but `zl_number` maps predictably to one vehicle. Content behind a given `zl_number` (the parts/lines attached to it) legitimately accumulates and changes across separate Matcher sessions over time — LIVE VERIFIED via a full-dataset check: of 171 `zl_number` values recurring across more than one session, 88 (51%) show a different line count/quantity total between sessions, not just repeated identical content. This is exactly the pattern the already-accepted M:N source-document model (Correction 3/4) was designed for: the same vehicle's order accumulating multiple, non-identical source documents over its life — further confirming `zl_number` is the right unit to call "the order," not `order_number`.
- **C. What `BLWK` and `BL` actually are: two distinct, separate branch/workshop-label tokens, not the same field.** LIVE VERIFIED: `BLWK` is a constant 4-letter prefix on `order_number` (`BLWK/<seq>`, 100% of 5,062 non-null values, zero other prefixes). `BL` is a constant 2-letter suffix on `zl_number`/`zlec_number` (`.../<Dcode>/BL`, confirmed via full-string suffix extraction, single value across the dataset). These are two different tokens on two different fields, not one field observed twice — both are branch/workshop-scoped constants in this single-branch dataset. The product owner's illustrative "BLKOM" example maps most directly to whichever of these AutoStacja actually calls the branch code in its own UI (not resolvable from data alone — a question for AutoStacja/product, not blocking this schema decision); what live data confirms is that **the mechanism exists on `zl_number` itself** (the `BL` suffix, riding along with the identifier that is now recommended as the true business key), so no separate lookup/config table is needed to attach a branch/workshop label — it is already present in the same string as the order number.
- **D. Is `BLWK/106` sufficient to identify one logical RepairOrder? NO.** Per finding A, `BLWK/106` aggregates 7 distinct `zl_number` values / 6 distinct VINs / 3 distinct D-codes across 105 blocks — it identifies a _batch of many vehicles' worth of order data_, not one RepairOrder.
- **E. Which field should become the RepairOrder's true business `order_number`? `zl_number`** (with `zw_number` and `wdd_number` remaining as distinct document-type identifiers at the source-document level, per the already-accepted M:N model — they are not alternative candidates for the order's own identity, they identify specific delivery/reconciliation documents _about_ the order identified by `zl_number`).

**Cardinality summary (LIVE VERIFIED, representative examples from full-dataset queries):**

| Relationship                          | Finding                                                                                                    |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `order_number` → distinct `zl_number` | up to 79 per value (e.g. `BLWK/6`); never 1                                                                |
| `zl_number` → distinct `order_number` | up to 4 per value (e.g. `ZLEC/168728/26/3332/BL` → 4); never a stable 1                                    |
| `order_number` → distinct VIN         | up to 60 per value; never 1                                                                                |
| `zl_number` → distinct VIN            | **always exactly 1**, zero exceptions found                                                                |
| `order_number` → distinct D-code      | up to 5 per value; never 1                                                                                 |
| `zl_number` → distinct D-code         | **always exactly 1** (D-code is a parsed substring of `zl_number` itself, so this is true by construction) |

**Revised recommendation for Correction 1 (supersedes the correction pass's `order_number`-based Option A):**

1. **RepairOrder business identity = OPTION B: `organization_id + branch_id + zl_number`.** `zl_number` is the field verified live to be 1:1 with the vehicle (VIN) and structurally matches the product owner's own description of the business identifier. `order_number` is retained on `repair_orders` as a **plain descriptive/reference column** (useful for cross-referencing AutoStacja's own internal ticket label in the UI, and as a search field) but is **explicitly removed from the uniqueness/identity role** it was given in the correction pass above.
2. **The D-code remains source-document-level, unchanged from the correction pass's conclusion** — now on stronger footing: since D-code is a parsed substring of `zl_number` itself, once `zl_number` is the order's identity, the D-code is trivially available as a derived/display attribute of that identity (or, per the already-accepted Correction 3/4 model, stored per source document) — either way it is not an independent header column requiring its own uniqueness handling.
3. **VIN remains explicitly excluded from uniqueness**, per standing product-owner instruction. It is now additionally confirmed live as a reliable 1:1 corroborating signal for `zl_number` and should be stored as a validated cross-check field (flag a mismatch if a `zl_number` is ever observed live with more than one VIN — not expected, but cheap to guard), never as part of the key itself.
4. **Unique-constraint strategy, updated**: a partial unique index on `repair_orders (organization_id, branch_id, zl_number) WHERE zl_number IS NOT NULL AND deleted_at IS NULL`, with the same `identity_status ('resolved'|'unresolved')` staged-identity mechanism as before for orders whose source blocks carry no parseable `zl_number` (LIVE VERIFIED: 213 blocks carry `order_number` but no `zl_number` — mostly `direct_order`-type blocks, which need the same unresolved-identity fallback path).
5. **Cross-branch collision**: `zl_number`'s `<seq>` component is presumably a per-branch DMS counter at AutoStacja — this cannot be proven from a single-branch live dataset (flagged as UNRESOLVED below, same caveat as the correction pass's D-code cross-branch note), which is exactly why `branch_id` remains part of the composite key rather than relying on `zl_number` alone.

### Live Supabase findings — Correction 2 deep dive: CRM-based advisor model

- `crm_contacts.linked_user_id` has **no unique constraint** (LIVE VERIFIED, fresh constraint pull this pass) — the schema today permits multiple contacts to point at the same `user_id`. This must be closed for advisor identity to be unambiguous: **add `UNIQUE (organization_id, linked_user_id) WHERE linked_user_id IS NOT NULL AND deleted_at IS NULL`** as part of the (not-yet-written) Zone 3 migration set. This is additive and safe — it does not touch existing CRM behavior for unlinked (pure external) contacts.
- **No internal-advisor/employee concept exists in CRM today.** `crm_party_roles.role` is a plain-text CHECK constraint, not an enum type — LIVE VERIFIED. Extending it to accept a new value (`employee` or `advisor`) is the smallest safe change: `ALTER TABLE crm_party_roles DROP CONSTRAINT crm_party_roles_role_check, ADD CONSTRAINT crm_party_roles_role_check CHECK (role = ANY (ARRAY[...existing..., 'employee']))`. This requires **no schema/type migration beyond a constraint replacement** — much cheaper than adding a `contact_type` column (which doesn't exist today and isn't needed) or a parallel staff-link table (which would fork identity resolution into two places).
- **Revised recommendation (confirms/refines the product owner's CRM-based direction — no change to the direction itself, only to the mechanics):**
  - `repair_orders.advisor_contact_id → crm_contacts.id` (nullable FK — an order can be created before an advisor is assigned).
  - `crm_contacts.linked_user_id → public.users.id`, now uniquely constrained per organization as above.
  - Add `employee` to `crm_party_roles.role`'s allowed values; a `crm_contacts` row representing an internal advisor gets a `crm_party_roles` row with `role = 'employee'` (in addition to whatever role model already exists) — this reuses the existing party-role junction rather than adding a new one.
  - **Ownership rule**: `current_user_id = crm_contacts.linked_user_id (via repair_orders.advisor_contact_id) AND has_branch_permission(org_id, branch_id, 'workshop.repair_orders.manage_own')` OR `has_branch_permission(org_id, branch_id, 'workshop.repair_orders.manage_all')`.
  - **Explicit boundary, unchanged from the product owner's framing**: advisor ownership never implies warehouse permissions (`inventory.*`) — it is scoped strictly to RepairOrder header/metadata fields (status notes, customer-facing fields, comments/attachments) via the existing `target-registry.ts` mechanism, never to `inventory_movement_*` mutation.

### Live Supabase findings — Correction 3 deep dive: SourceDocument↔RepairOrder is many-to-many

- **One `order_number` spans many Matcher sessions — LIVE VERIFIED, far more than a rare edge case.** A per-`order_number` session-count query this pass shows `BLWK/6` associated with blocks across **124 distinct sessions**, `BLWK/98` across 102, `BLWK/61` across 101, and dozens more `order_number` values each spanning 80–100+ distinct sessions. (Caveat: this dataset shows strong duplication characteristic of repeated test/demo uploads of similar source material — the raw session counts are inflated by that, and should not be read as "this order genuinely accumulated 124 real deliveries." But the _structural fact_ it demonstrates — the same `order_number` legitimately recurring across independently-created Matcher sessions over time — is exactly the pattern Correction 3 is about, and is unambiguous regardless of how much of the 124 is real-world repetition vs. test-data noise.)
- **One `wdd_number` also spans multiple sessions** — LIVE VERIFIED (e.g. `WDD/1003/26/3142` appears across 67 distinct sessions). Combined with the `order_number` finding, this confirms the previous 1:many design (`repair_order_source_documents.repair_order_id`, single FK) cannot hold: a single WDD document/session can carry blocks belonging to several orders, and a single order's data legitimately arrives via many separate source documents over time.
- **Revised recommendation (supersedes the first pass's 1:many `repair_order_source_documents` table):**
  - `workshop_source_documents` — one row per distinct source document identity: `(organization_id, branch_id, document_type, external_document_number, source_session_id, official_warehouse_code NULLABLE, block_id, created_at)`. See the final-clarification-pass natural-key correction directly below — the uniqueness scope here was refined after this pass's content-variance analysis.
  - `repair_order_source_document_links` — pure link table: `(repair_order_id, workshop_source_document_id, linked_at, linked_by)`, `PRIMARY KEY (repair_order_id, workshop_source_document_id)`. A document can link to more than one order (e.g. a `wdd_reconciliation` document covering parts for several orders in one delivery batch) and an order accumulates links over time as new documents arrive.

#### Final clarification pass — source-document natural key correction

The correction pass above proposed `UNIQUE (organization_id, document_type, external_document_number)` as the sole natural key — i.e., treat every recurrence of the same `zl_number`/`wdd_number` string as _the same document_ and collapse it into one `workshop_source_documents` row. This pass tested that assumption directly and found it unsafe.

- **A/B. Is the external document number unique within a branch, and could it recur across branches?** LIVE VERIFIED: within this single-branch dataset, numbers are not being tested for uniqueness in isolation — they recur constantly across sessions (see Correction 3 findings above, e.g. `WDD/1003/26/3142` across 67 sessions). Cross-branch behavior is UNRESOLVED (single-branch dataset, same caveat as Correction 1 finding C) — the recommended key below includes `branch_id` defensively for exactly this reason.
- **C. Can the same number occur under different `document_type` values?** LIVE VERIFIED: no. A cross-namespace intersection check (`wdd_number` sequence numbers vs `zw_number` sequence numbers) returned **zero overlaps** — the numbering spaces for `wdd_number`/`zw_number`/`zl_number` do not collide with each other even at the raw-sequence level, before the type-prefix is even considered. Keying by the full type-prefixed string (`WDD/…`, `ZW/…`, `ZL/…`/`ZLEC/…`) is safe from cross-type collision without needing `document_type` as a defensive discriminator — though `document_type` remains a useful explicit column for filtering/reporting.
- **D. Can the same number occur with a different D-code?** No — the D-code is a parsed substring of the number itself (e.g. the segment before `/BL` in `zl_number`), so by construction a given `external_document_number` string always carries the same D-code.
- **E/F. Can the same number occur with materially different content — is a repeated occurrence the same file re-uploaded, or a legitimately updated/different document?** **This is the finding that forces a correction.** LIVE VERIFIED, full-dataset check: of source numbers recurring across more than one session, content (line count and total quantity) differs between at least two occurrences in **88 of 171 (51%) recurring `zl_number` values** and **96 of 256 (37%) recurring `wdd_number` values**. A close read of one `wdd_number` example (`WDD/1003/26/3142`, 67 sessions) shows the _opposite_ case — every occurrence is a distinct file (`file_path`/`file_name` differ per session, e.g. `15.04.bc.pdf`, `15.04.seat.pdf`, …) but with byte-for-byte-identical parsed content (1 line, qty 1, every time), consistent with the same tiny fixture being re-uploaded repeatedly. **Both patterns are real and coexist**: pure re-uploads of unchanged content, and genuinely evolving/updated documents sharing the same external number. Neither document type (`zl`/`zw`-family vs `wdd`-family) is safely assumed to be one pattern or the other — variance is substantial in both (51% and 37% respectively). **Collapsing all occurrences of the same external number into a single `workshop_source_documents` row, as the correction pass proposed, would silently discard genuinely different content in roughly a third to half of recurrence cases.**
- **G. Is `wdd_matcher_session_files` identity useful for duplicate detection?** Partially — LIVE VERIFIED it provides a real, distinct `file_path`/`file_name` per session-upload, but two different `file_path` values were observed carrying identical parsed content (the fixture-reupload case above), so file identity alone does not prove content difference either; it is a useful signal, not a sufficient one.
- **H. Is source system needed in the natural key?** Not yet — REPO/LIVE VERIFIED only one source system (AutoStacja via Matcher) exists today. Deferred as a forward-compatibility note, not added now (avoids a column with only one possible value).

**Recommended natural key (supersedes the correction pass's Candidate 1):**

`workshop_source_documents` uniqueness = **`UNIQUE (organization_id, branch_id, document_type, external_document_number, source_session_id)`** — i.e., Candidate 3's shape minus `source_system` (deferred per H), with `source_session_id` (the originating `wdd_matcher_sessions.id`) added as a mandatory discriminator rather than optional. `branch_id` is not present on `wdd_matcher_blocks`/`wdd_matcher_lines` directly (LIVE VERIFIED — those tables carry only `session_id`/`organization_id`); it is sourced by joining through `session_id → wdd_matcher_sessions.branch_id` at the point `workshop_source_documents` rows are created, and denormalized onto the row (consistent with the already-accepted RLS pattern of direct columns on primary Tier-1 entities).

**How this handles both duplicate cases, as required:**

- **Same logical document re-uploaded (the `WDD/1003/26/3142` pattern)**: each session-upload still creates its own `workshop_source_documents` row (scoped by `source_session_id`), so no data is lost — but because content is verified byte-identical in this pattern, the redundancy is cheap and harmless, and a later optional content-hash column can layer a "these N rows are identical" annotation on top without changing the primary key. This is deliberately chosen over silently deduplicating, because the 51%/37% variance rates prove number-only dedup cannot reliably distinguish this case from the next one without inspecting content first — and inspecting content first is exactly what a hash-based secondary layer is for, not the primary constraint.
- **Different document that happens to share a number in another branch/session/context**: never collides, because `branch_id` and `source_session_id` are both part of the key — a different branch or a different session-originated occurrence of the same `external_document_number` is always a distinct row, exactly as required.
- **Numbers reused across `document_type`s**: cannot happen per finding C (zero cross-namespace overlap observed), and the key includes `document_type` regardless as defense-in-depth.

### Live Supabase findings — Correction 4 deep dive: durable line-level source provenance

- `wdd_matcher_lines.id` is a stable UUID primary key, unaffected by re-parsing/re-ordering — REPO VERIFIED (unchanged) + LIVE VERIFIED (constraint pull this pass confirms `PRIMARY KEY (id)`, `FOREIGN KEY (block_id)`, `FOREIGN KEY (session_id)`, both `ON DELETE CASCADE`). `line_number` remains block-relative, not a durable cross-block identity.
- No existing mechanism dedupes `wdd_matcher_lines` rows sharing the same `product_code` — grouping by SKU alone would silently merge lines that are legitimately separate deliveries/documents.
- **Revised recommendation (supersedes the first pass's single `source_wdd_line_id` FK on `repair_order_lines`):**
  - `workshop_source_document_lines` — one row per source line as it exists within a `workshop_source_documents` row: `(workshop_source_document_id, wdd_matcher_line_id NULLABLE, product_code, product_name, quantity, unit, raw_text, created_at)`. Nullable `wdd_matcher_line_id` accommodates manually-entered lines with no Matcher origin.
  - `repair_order_line_source_links` — `(repair_order_line_id, workshop_source_document_line_id, quantity_contribution, linked_at)`. A single logical `RepairOrderLine` (e.g. "part X, qty 5") can be backed by multiple source lines across multiple documents (partial deliveries, corrections, re-deliveries), each contributing a `quantity_contribution` that must sum to the logical line's total. A single source line can, in principle, also be split across more than one logical line (rare, but the M:N shape supports it without special-casing). Uniqueness: `UNIQUE (workshop_source_document_line_id)` **only if** the product decision is "a given source line may never be linked to more than one logical line" — recommended as the default (never destructively merge raw source storage; but each atom of source data belongs to exactly one logical order line) unless a concrete example emerges requiring one source line to split across two logical lines.

### Live Supabase findings — Correction 5 deep dive: durable line-level movement linkage

- **Confirmed, freshly, this pass: `inventory_movement_lines` has no line-level reference/metadata/external-id column.** Full 26-column list re-pulled live (see Verified technical findings above). Header-level `reference_type`/`reference_id` on `inventory_movement_headers` is the only existing linkage, and it cannot disambiguate when a RepairOrder has multiple lines sharing a SKU, or when receipts/issues against one RepairOrderLine happen across multiple movement batches.
- **Revised recommendation (supersedes the first pass's header-level-only design):**
  - `repair_order_line_movement_links` — `(id, repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, created_at)`, `relation_type ∈ {'receipt', 'issue', 'reversal'}`. `UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)` prevents the same movement line being double-applied to the same order line under the same relation.
  - **Derived quantities, never mutable counters**: `received_quantity = SUM(applied_quantity) WHERE relation_type = 'receipt'`, `issued_quantity = SUM(applied_quantity) WHERE relation_type = 'issue'`, `remaining_quantity = received_quantity - issued_quantity` (or `ordered_quantity - issued_quantity`, per final product definition of "remaining" — needs one product-owner confirmation, flagged in Remaining technical unknowns below), computed via a view or query, never stored as an updatable column.
  - **Worked example this design must prove** (ordered=5 across 3 receipt batches totaling 5, issued=3 across 2 issue batches, remaining=2): `repair_order_line_movement_links` holds 3 rows with `relation_type='receipt'` summing `applied_quantity` to 5 (e.g. 2+2+1), and 2 rows with `relation_type='issue'` summing to 3 (e.g. 2+1) — `received_quantity = 5`, `issued_quantity = 3`, `remaining_quantity = 2`, all derived by `SUM(...) GROUP BY relation_type`, none of it dependent on the lines sharing a SKU or on any assumption about batch count/order.

### Remaining technical unknowns

1. **D-code / `zl_number`-sequence cross-branch behavior is unverified** — this dataset covers a single branch/workshop (`BLWK` prefix on `order_number`, `BL` suffix on `zl_number`, only 4 D-code values, all from one branch). Whether other branches use a different alpha token, and whether the `zl_number` sequence counter and D-code numbering space are branch-scoped or organization-wide, cannot be confirmed from current live data. UNRESOLVED — needs either more source data from another branch, or explicit product-owner confirmation of AutoStacja's numbering convention. This is why `branch_id` remains part of both the RepairOrder identity key and the source-document natural key rather than relying on `zl_number`/external document numbers alone.
   1a. **CLOSED this final clarification pass**: which field is the RepairOrder's true business identity (`zl_number`, not `order_number`) and what the source-document natural key must include (`+ source_session_id`) — both resolved via live cardinality/content-variance evidence above.
   1b. **CLOSED this final clarification pass**: table/entity count terminology — the model has always been eight tables; the "six-table" label in the correction pass's prose was a documentation error, now fixed via the authoritative inventory table.
2. **"Remaining quantity" formula** (`ordered - issued` vs `received - issued`) is not yet product-decided — UNRESOLVED, flagged above under Correction 5.
3. **Matcher-correction/provenance-preservation model** (see Architecture implications below) needs a product decision on how much history to retain — event-log only vs. explicit reconcile action — UNRESOLVED, recommendation given below but not yet accepted.
4. Whether `workshop_source_document_lines.wdd_matcher_line_id` uniqueness should be enforced 1:1 (a Matcher line never contributes to more than one `workshop_source_document_lines` row) is assumed but not yet product-confirmed — UNRESOLVED, low risk, recommended default stated above.
5. Migration-tree drift remains SEVERE and unresolved (172 live versions on `supabase_migrations.schema_migrations`, only 23 matching local target-tree files, only 1 matching local legacy-tree files) — REPO VERIFIED + LIVE VERIFIED, unchanged from the first pass. This is now a hard Phase-0 prerequisite (see Data and migration strategy below), not merely a risk note.
6. The exact permission-key names for the new `employee`/advisor-scoped RepairOrder permissions (`workshop.repair_orders.manage_own` / `manage_all` used above) are illustrative, following the repo's documented `<module>.<resource>.<verb>` convention (`packages/contracts/src/permissions.ts`) — REPO VERIFIED convention exists, but the literal keys are not yet registered and need product/eng sign-off before implementation.

### Product decisions

Mapping against the original 43-point product intent, restated with this pass's corrections:

- **§4/§5 (business identity)** — **DECIDED, corrected again this final clarification pass**: `organization_id + branch_id + zl_number` is the business-identity key (Option B) — `zl_number` verified live as 1:1 with VIN and structurally matching the product owner's own description; `order_number` is retained only as a descriptive/reference field, not identity; VIN excluded from uniqueness; D-code remains source-document-level, not a RepairOrder header scalar. This **supersedes the correction pass's `organization_id + branch_id + order_number` recommendation** (Option A), which the cardinality analysis in this final pass proved wrong: `order_number` aggregates up to 79 distinct `zl_number`/60 distinct VINs under one value and is not even reliably 1:1 with a vehicle within a single session.
- **§8 (advisor model)** — **DECIDED**: CRM-contact-based (`repair_orders.advisor_contact_id → crm_contacts.id`, `crm_contacts.linked_user_id → users.id`). Supersedes the first pass's recommendation of a direct `user_id` column, which the product owner rejected as prematurely collapsing a real domain relationship for schema convenience.
- **§18 (approval gate)** — **DECIDED**: materialization occurs only when `wdd_matcher_sessions.status = 'approved'`, never off `ready_for_review`. This requires building the currently-nonexistent `WddMatcherService.approveSession` action and its UI trigger as a hard prerequisite — REPO VERIFIED zero existing callers. Supersedes the first pass's recommendation of gating on `ready_for_review`.
- **Source-document cardinality (not numbered in the original 43-point intent, raised as a gap by the product owner this pass)** — **DECIDED**: many-to-many via `workshop_source_documents` + `repair_order_source_document_links`, per Correction 3 above. **Natural key refined this final pass**: `(organization_id, branch_id, document_type, external_document_number, source_session_id)`, not the correction pass's plain `(organization_id, document_type, external_document_number)` — content-variance evidence (see above) proved number-only dedup would silently discard genuinely different content in 37–51% of recurrence cases.
- **Source-line provenance (same)** — **DECIDED**: durable many-to-many via `workshop_source_document_lines` + `repair_order_line_source_links` with `quantity_contribution`, per Correction 4 above.
- **Movement-line linkage (same)** — **DECIDED**: line-level via `repair_order_line_movement_links`, derived quantities only, per Correction 5 above.
- All other product-intent items from the first pass's mapping are unchanged by this correction pass and are not restated here to avoid duplicating that already-accepted content; see the git history of this section for the first pass's full 43-point table if needed.

### Proposed domain model (corrected)

Supersedes the first pass's 4-table model (`repair_orders`, `repair_order_lines`, `repair_order_source_documents`, `repair_order_legacy_records`). **Terminology correction (final clarification pass)**: the correction pass's document text called this a "six-table normalized model" while actually listing eight tables — this was a documentation error, not a design change. There are, and have consistently been, **eight** proposed tables. The count is not being optimized down or padded up; the authoritative inventory table below is the single source of truth for this going forward, and no zone document should describe the count in prose again (avoiding this class of drift).

- `repair_orders` — header. `id, organization_id, branch_id, zl_number, order_number (descriptive/reference only, not identity), identity_status ('resolved'|'unresolved'), advisor_contact_id NULLABLE FK→crm_contacts, status, vehicle_* fields (VIN stored as a descriptive/cross-check field only, never part of uniqueness), created_at, updated_at, deleted_at`. Partial unique index on `(organization_id, branch_id, zl_number)` per the final clarification pass's Correction 1 recommendation (Option B) — **corrected from the correction pass's `order_number`-keyed index**.
- `repair_order_lines` — logical order lines. `id, repair_order_id, product/variant reference, ordered_quantity, unit, status, created_at, updated_at, deleted_at`. No `source_wdd_line_id` column (removed — replaced by the link table below).
- `workshop_source_documents` — one row per distinct source document occurrence (Correction 3). `id, organization_id, branch_id, document_type, external_document_number, source_session_id, official_warehouse_code NULLABLE, block_id, created_at`. `UNIQUE (organization_id, branch_id, document_type, external_document_number, source_session_id)` — **corrected from the correction pass's session-blind key**, per the final clarification pass's content-variance evidence above.
- `repair_order_source_document_links` — link table (Correction 3). `repair_order_id, workshop_source_document_id, linked_at, linked_by`, composite PK.
- `workshop_source_document_lines` — one row per source line (Correction 4). `id, workshop_source_document_id, wdd_matcher_line_id NULLABLE, product_code, product_name, quantity, unit, raw_text, created_at`.
- `repair_order_line_source_links` — link table (Correction 4). `id, repair_order_line_id, workshop_source_document_line_id, quantity_contribution, linked_at`. `UNIQUE (workshop_source_document_line_id)` by default.
- `repair_order_line_movement_links` — link table (Correction 5). `id, repair_order_line_id, inventory_movement_line_id, applied_quantity, relation_type, created_at`. `UNIQUE (repair_order_line_id, inventory_movement_line_id, relation_type)`.
- `repair_order_legacy_records` — unchanged from the first pass (out of scope for this correction; carries pre-cutover manual-entry records, not touched by any of the three corrections in this pass).

#### Authoritative Zone 3 table/entity inventory

Eight tables total. Seven are required for pitch; one (`repair_order_legacy_records`) is pilot-only. Comments/attachments are explicitly **not** Zone-3-owned tables — they reuse the existing generic `app_attachments`/`target-registry.ts` and (pilot-only) comment infrastructure via a registered target type, and are not counted here.

| Table                                | Purpose                                                                                     | Scope | Owner/domain                | Required for first implementation?                                                            |
| ------------------------------------ | ------------------------------------------------------------------------------------------- | ----- | --------------------------- | --------------------------------------------------------------------------------------------- |
| `repair_orders`                      | Order header: business identity (`zl_number`), branch, advisor, status, vehicle fields      | PITCH | Workshop                    | Yes                                                                                           |
| `repair_order_lines`                 | Logical required parts (what the order needs)                                               | PITCH | Workshop                    | Yes                                                                                           |
| `workshop_source_documents`          | One row per distinct source-document occurrence (ZL/ZW/WDD, session-scoped)                 | PITCH | Workshop/Matcher boundary   | Yes                                                                                           |
| `repair_order_source_document_links` | M:N link: which documents evidence which order                                              | PITCH | Workshop/Matcher boundary   | Yes                                                                                           |
| `workshop_source_document_lines`     | One row per source line within a document occurrence                                        | PITCH | Workshop/Matcher boundary   | Yes                                                                                           |
| `repair_order_line_source_links`     | M:N link + `quantity_contribution`: which source lines back which logical line              | PITCH | Workshop/Matcher boundary   | Yes                                                                                           |
| `repair_order_line_movement_links`   | Line-level link to `inventory_movement_lines`, derived received/issued/remaining quantities | PITCH | Workshop/Inventory boundary | Yes (needed for the partial-receipt/issue worked example, which is a pitch-scope requirement) |
| `repair_order_legacy_records`        | Pre-cutover manual-entry records for the controlled pilot's initial-state strategy          | PILOT | Workshop                    | No — deferred to pilot phase (Phase 14)                                                       |

### Authorization and ownership model

- Ownership check: `current_user_id = crm_contacts.linked_user_id (joined via repair_orders.advisor_contact_id) AND has_branch_permission(org_id, branch_id, 'workshop.repair_orders.manage_own')` OR `has_branch_permission(org_id, branch_id, 'workshop.repair_orders.manage_all')`. Uses the repo's verified branch-aware helper (`has_branch_permission`), not the org-only `has_permission` (which is structurally blind to `branch_id` — REPO VERIFIED, `AND branch_id IS NULL` in its SQL body) — this distinction matters here because branch isolation is a stated pitch/pilot requirement.
- Advisor ownership is strictly scoped to RepairOrder header/metadata (status, customer-facing notes, comments/attachments via the existing `target-registry.ts` mechanism) — never to `inventory_movement_*` tables. Warehouse-side receiving/issuing against a RepairOrderLine requires separate `inventory.*` permissions regardless of advisor ownership.
- **RLS strategy per new table** (comparing direct-duplicated `organization_id`/`branch_id` columns vs join-derived scope, per the 3-tier classification established in prior Zone 3 work):
  - `repair_orders`, `workshop_source_documents`: **Tier 1** (FORCE RLS + `has_branch_permission`, direct `organization_id`/`branch_id` columns) — these are the primary scoped entities; direct columns avoid an extra join on every row-level check and match the pattern used elsewhere for primary domain tables (e.g. `inventory_movement_headers`).
  - `repair_order_lines`, `workshop_source_document_lines`: **Tier 1, scope join-derived from parent** (`repair_orders`/`workshop_source_documents` via FK) rather than duplicated columns — these are pure children with no independent existence outside their parent, so duplicating `organization_id`/`branch_id` here would only be a write-time consistency risk (a trigger or app-level bug could desync them) for no read-time benefit, since every real query already joins the parent. This deliberately diverges from the Tier 1 "direct columns" default for exactly this class of table, and should not be read as inconsistent.
  - `repair_order_source_document_links`, `repair_order_line_source_links`, `repair_order_line_movement_links`: **Tier 1, scope join-derived** through `repair_order_id` — pure link tables, same reasoning as above. `DELETE` policy: allow only via the same permission gate as the parent RepairOrder's `manage_own`/`manage_all` (a link is never independently deletable by someone without RepairOrder-level access, even if they could see the linked row through some other path).

### Architecture implications

- **Materialization must be one atomic transaction.** Creating/linking `repair_orders` + `repair_order_lines` + `workshop_source_documents` + `workshop_source_document_lines` + both sets of link tables from an approved Matcher session must happen inside a single SECURITY DEFINER RPC (following the repo's established pattern — `inventory_create_draft`, `inventory_finalize_posting`, `helpdesk_accept_ticket`, all taking an explicit `p_actor_user_id`), not as multiple sequential application-level Supabase calls. Application-level multi-call materialization is explicitly not acceptable — a partial failure would leave an order with lines but no source-document links, or vice versa, silently corrupting provenance.
- **Idempotency/concurrency, enforced at the DB level, not just the frontend:**
  - Duplicate materialization of the same approved session: the RPC must be safe to call twice (e.g. re-check `workshop_source_documents` uniqueness via `ON CONFLICT DO NOTHING`/`DO UPDATE` on the natural key before creating new order/line rows, and short-circuit if the session's documents are already fully linked).
  - Duplicate WDD import: covered by `workshop_source_documents`'s corrected key `UNIQUE (organization_id, branch_id, document_type, external_document_number, source_session_id)` (see final clarification pass under Correction 3 above).
  - Duplicate source-document-to-order link / duplicate source-line link: covered by the link tables' composite/unique constraints above — `ON CONFLICT DO NOTHING` at the RPC level.
  - Two workers materializing the same session simultaneously: the RPC should take a row-level lock (`SELECT ... FOR UPDATE`) on the `wdd_matcher_sessions` row (or transition its `status` as the first statement inside the transaction) so the second concurrent call sees the session already transitioned and short-circuits rather than racing.
- **Matcher-correction/post-approval flow**: post-approval corrections to a Matcher session must not silently overwrite already-materialized provenance. Recommended: an explicit **reconcile action** (a distinct RPC/service call, not a silent re-run of materialization) that creates new `workshop_source_document_lines`/link rows for the delta rather than mutating existing ones, paired with a `platform_events` emission (the repo's sole sanctioned audit mechanism) recording what changed. This avoids both silent data loss and building a full versioning system that isn't yet justified by a concrete requirement.

### Data and migration strategy

- **Hard Phase-0 prerequisite, not optional cleanup**: given the confirmed SEVERE migration-tree drift (172 live versions vs. 23/1 matching local target/legacy trees), no RepairOrder migration may be written against either local tree until the live target schema is reconciled into a trustworthy local baseline and reproducibility is verified (a fresh `supabase db diff`/equivalent against the live project shows zero unexpected drift after baselining). Writing Zone 3 migrations first and reconciling later — the pattern implicitly followed in earlier zones — is explicitly rejected for this zone.
- All new tables/columns/constraints described above (partial unique indexes — now keyed on `zl_number`, not `order_number` — `crm_contacts` unique constraint, `crm_party_roles` CHECK extension, the eight new/corrected tables in the authoritative inventory above) are additive — no existing table is altered destructively, no existing data is migrated or backfilled as part of this design (no migration has been written or applied; Supabase MCP access this entire pass was read-only).

### Testing strategy

- **Unit**: D-code extraction/normalization per document-number format (`zl_number`/`zw_number`/`wdd_number`); business-identity composition (`zl_number` parsing into sequence/year/D-code/`BL`-suffix — **corrected from the correction pass's `order_number` parsing**); `order_number` retained only as a non-unique descriptive/search field, tested as such (never asserted unique); source-line→logical-line mapping; quantity-contribution mapping (contributions summing correctly, rejecting over-allocation).
- **Service/domain**: one-document→many-orders; one-order→many-documents; one-logical-line→many-source-lines; same-SKU-on-multiple-lines (must not merge); source-line-linked-only-once (uniqueness enforcement); one-line→many-receipt-movement-lines; one-line→many-issue-movement-lines; worked quantity example from Correction 5; **new this pass**: same `wdd_number`/`zl_number` recurring across two sessions with genuinely different content must produce two distinct `workshop_source_document` rows (not a silent collapse) — directly testing the corrected natural key.
- **DB/RLS**: link-table isolation (cross-branch/cross-org rows invisible); duplicate-link prevention (constraint violations surfaced correctly, not silently swallowed); transaction rollback on partial materialization failure; cross-branch injection blocked on all eight tables in the authoritative inventory above.
- **Concurrency**: same-session-materialized-twice-simultaneously; same-WDD-imported-twice-simultaneously; duplicate-identity-raced (two orders racing to claim the same `zl_number` partial-unique-index slot — **corrected from `order_number`**).
- **E2E**: one-session→multiple-orders; one-WDD→multiple-orders (if pilot data supports it); later-WDD-attaches-to-existing-order; partial-receipt/issue-attribution-per-line matching the worked example.

### Readiness progression plan

Unchanged in dependency ordering from the first pass — the correction pass changes what is built inside each phase, not the phase sequence relative to other zones (Zone 3 remains gated on Zone 1's branch/permission model and feeds Zones 9/11).

### Final pitch scope

Unchanged from the first pass except: the pitch demo's "one order, multiple parts, multiple deliveries" narrative is now directly supported by the corrected M:N source-document model rather than requiring a simplified 1:many stand-in — no reduction in pitch ambition, the corrected architecture is a better match for the demo script's own claims (§5, §7, §9–11) than the first pass's simplified version was.

### Final controlled-pilot scope

Unchanged from the first pass in scope; the corrected architecture is what the pilot needs given real AutoStacja data will exhibit the same multi-department, multi-delivery patterns observed live in this dataset (even accounting for the test-data duplication noted in Correction 3).

### Proposed implementation and verification work plan

Corrected 16-phase shape (supersedes the first pass's 15-phase plan; Phase 0 is now split and hardened per the Phase-0 prerequisite above):

- **Phase 0A** — Migration baseline/reproducibility reconciliation (hard prerequisite; blocks all subsequent phases). Unchanged, still open — REPO/LIVE VERIFIED SEVERE drift, not addressed by this pass.
- **Phase 0B** — Close remaining Dxxxx/CRM/source-format unknowns. **Partially closed this final clarification pass**: business-identity field choice (`zl_number` vs `order_number`) and source-document natural key are now resolved with live evidence. Still open: cross-branch D-code/`zl_number`-sequence behavior, remaining-quantity formula, reconcile-flow sign-off (see Remaining technical unknowns).
- **Phase 1** — Corrected domain contracts (types for the eight-table model in the authoritative inventory above).
- **Phase 2** — Normalized schema + RLS design finalized into actual migration files (still not applied without separate review).
- **Phase 3** — Transactional domain/materialization RPC/service layer (SECURITY DEFINER, single-transaction).
- **Phase 4** — Build `WddMatcherService.approveSession` + UI approval workflow (prerequisite for Phase 5, currently nonexistent).
- **Phase 5** — Materialization wired to the approval gate.
- **Phase 6** — List/search.
- **Phase 7** — Header/advisor/lifecycle (CRM extension from Correction 2).
- **Phase 8** — Logical order lines.
- **Phase 9** — Source documents + lines + provenance links (Corrections 3/4).
- **Phase 10** — Movement-line linkage/warehouse read model (Correction 5).
- **Phase 11** — Magazyn/Zamówienia-Przyjęcia read-model views, built against the corrected M:N joins (conceptual only in this document — no UI implementation specified here).
- **Phase 12** — Attachments (registers `workshop.repair_order` in `target-registry.ts`).
- **Phase 13** — Pitch E2E.
- **Phase 14** — Controlled-pilot scope: manual lines, comments, legacy-issue path, AutoStacja import.
- **Phase 15** — Concurrency/idempotency/pilot hardening per the Testing strategy above.
