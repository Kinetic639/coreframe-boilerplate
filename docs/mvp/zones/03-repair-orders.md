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

### Readiness progression plan

_To be rebuilt after the merged Zone 4 product model is clarified._

### Final pitch scope

_To be defined after clarification._

### Final controlled-pilot scope

_To be defined after clarification._

### Implementation and verification work plan

_To be defined after clarification._
