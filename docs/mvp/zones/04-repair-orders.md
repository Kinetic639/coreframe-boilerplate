### 4. Car Workshop — zlecenia naprawcze, pozycje i dokumenty magazynowe

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
