> Historical/retired zone.
> Former Zone 18 was removed from the active product-zone model because it grouped unrelated future roadmap ideas and had no current pitch/pilot requirement.
> This file is historical evidence only and is not an active source of product requirements.

### 18. Awaryjne wydania, pełne zwroty i Customer Care VGP

**Priorytet:** P4

**Stan obecny:** 🔴 NOT IMPLEMENTED

Wszystkie cztery podobszary tej strefy — wydanie awaryjne, zwrot jako proces biznesowy, reklamacja/gwarancja, Customer Care VGP — są dziś niemal całkowicie nieobecne w kodzie, nie tylko niedokończone. Jedyne realne prymitywy w pobliżu to (a) generyczny, działający mechanizm cofnięcia/odwrócenia ruchu magazynowego (`inventory_reverse_movement`), który poprawnie zachowuje powiązanie z oryginalnym ruchem, ale ma na sztywno zaszyty powód `'REVERSAL'` i żadnego kontekstu biznesowego zwrotu (przyczyna, stan części, akceptacja) — to korekta księgowa, nie proces zwrotu; oraz (b) realny system ticketów z Strefy 11, który może służyć jako warstwa komunikacji dla zgłoszenia problemu, ale nie jest i nie udaje dedykowanego silnika reklamacji/RMA. Wydanie awaryjne nie istnieje w kodzie w ogóle — zero wyników wyszukiwania w całym repozytorium. Customer Care VGP to wyłącznie fraza z dokumentów planistycznych — zero reprezentacji w kodzie (trasa, tabela, serwis, akcja, uprawnienie) w obu aplikacjach.

**Dowody:**

- Kod: VERIFIED. Wyczerpujące przeszukanie repozytorium (kod, nie dokumentacja) pod kątem wydania awaryjnego — zero wyników. Potwierdzono, że akcja `reverseMovementAction` w UI jest trwałą zaślepką zwracającą błąd „Reversal not available in v1", a rzeczywisty silnik odwracania (`inventory_reverse_movement`) działa wyłącznie po stronie bazy, z zaszytym na sztywno powodem `'REVERSAL'`, bez taksonomii przyczyn zwrotu, stanu części czy akceptacji. Potwierdzono, że aktualny (target) schemat `movement_kind` w ogóle nie zawiera wartości `'return'` — starsze etykiety ruchów „Zwrot od klienta"/„Zwrot do dostawcy" (kody 103/203) to tylko nazwy w generycznym pickerze typu ruchu, bez żadnej dedykowanej logiki. Potwierdzono brak jakiejkolwiek kolumny stanu/dyspozycji części (uszkodzona/sprawna/do kontroli) na `inventory_balances` czy `inventory_movement_lines`. Potwierdzono zerową reprezentację kodową Customer Care VGP w obu aplikacjach — wyłącznie wzmianki w plikach `.md`. Potwierdzono, że rola `'client'` istnieje w generycznym CRUD encji CRM, ale nie ma żadnego konsumenta poza edycją rekordu — brak historii spraw/interakcji.
- Testy automatyczne: NONE dla realnego zachowania tej strefy. Jedyne dwa trafienia to test potwierdzający, że zaślepka `reverseMovementAction` zwraca błąd, oraz test sprawdzający obecność tekstu SQL nazwy funkcji odwracania ruchu w migracji — żaden nie testuje semantyki zwrotu/reklamacji/wydania awaryjnego.
- Weryfikacja ręczna: NOT APPLICABLE — strefa pozostaje ROADMAP ONLY, nie ma czego weryfikować na żywo.
- Przebieg end-to-end: NOT APPLICABLE — nie istnieje żadna spójna ścieżka do przetestowania w żadnym z czterech podobszarów.

**Wymagany stan dla pitchu:** ROADMAP ONLY

### Pitch readiness checklist

- [ ] Wypowiedź jasno oddziela dzisiejszy, realny fundament ticketów (Strefa 11) od przyszłego, pełnego silnika zwrotów/reklamacji — nie sugeruje, że to jedno i to samo.
- [ ] Wypowiedź nie twierdzi, że istnieje akcja odrzucenia w kontekście zwrotu/reklamacji — nie istnieje nigdzie w tej strefie (zgodnie z już ustalonym brakiem odrzucenia ticketów w Strefie 11).
- [ ] Wypowiedź nie sugeruje, że jakikolwiek ruch magazynowy automatycznie „wraca" na stan w ramach procesu zwrotu — istniejący mechanizm odwracania ruchu to korekta księgowa z zaszytym na sztywno powodem, nie zwrot biznesowy.
- [ ] Wypowiedź nie wspomina „Customer Care VGP" jako istniejącej funkcji — to dziś wyłącznie nazwa z dokumentów planistycznych, zero kodu.
- [ ] Wydanie awaryjne nie jest wspominane jako istniejąca funkcja — nie istnieje w żadnej formie.
- [ ] Żaden ekran tej strefy nie jest pokazywany na żywo — nie ma czego pokazać.

Brama końcowa nie jest wymagana — brak demonstracji na żywo dla tej strefy.

**Pitch gap:**

Brak luki blokującej pitch — to zgodne z zamierzeniem strefy jako czystej roadmapy, a skrypt prezentacji nie obiecuje niczego z tego zakresu poza jednym, wąskim przykładem ticketu (już pokrytym w Strefie 11). Jedyne ryzyko jest retoryczne: łatwo przez skrót myślowy powiedzieć „mamy już zwroty" na podstawie realnego systemu ticketów, podczas gdy to co innego.

**Wymagany stan dla pilotażu:** NOT REQUIRED FOR INITIAL CONTROLLED PILOT unless scope changes

### Pilot readiness checklist

Zgodnie ze Strefą 12, żaden z czterech podobszarów nie jest częścią wybranego, trzymiesięcznego, ograniczonego do jednego oddziału pilotażu. Poniższe to wyłącznie przyszły backlog, nie wymagania przed pilotażem:

- [ ] (Przyszłość, nie pilotaż) Jeśli biznes zdecyduje się na jeden wąski proces zwrotu: dedykowana semantyka ruchu (nie nadużyty ruch odwracający), powiązanie z oryginalnym wydaniem/przyjęciem, przyczyna, stan/dyspozycja części, decyzja akceptacji/odrzucenia, realny wpływ na stan, ślad audytowy, dowody (zdjęcia) przez już istniejący generyczny system załączników (Strefa 9), uprawnienia ról, ręczna weryfikacja.
- [ ] (Przyszłość, nie pilotaż) Jeśli biznes zdecyduje się na wydanie awaryjne: dedykowane uprawnienie, jawne oznaczenie „awaryjne" na dokumencie, potwierdzenie odbiorcy, ślad audytowy — dziś nie ma nawet punktu wyjścia do rozbudowy.
- [ ] (Przyszłość, nie pilotaż) Jeśli biznes zdecyduje się na Customer Care VGP: to nowy moduł od zera — dziś nie ma żadnego fundamentu technicznego do rozszerzenia, poza ogólną rolą „client" w CRM bez żadnego workflow.
- [ ] **Zakres pilotażu potwierdzony jako nieobejmujący tej strefy** — jeśli Strefa 12 to zmieni, wymaga to osobnej, szczegółowej analizy wybranego wąskiego procesu, nie całego zakresu tej strefy naraz.

**Pilot gap:**

Nie dotyczy — żaden z czterech podobszarów nie jest częścią zaakceptowanego zakresu pilotażu ze Strefy 12. Nie należy sztucznie włączać ich do zakresu.

### Notes / evidence

- Wydanie awaryjne: zero wyników wyszukiwania w całym repozytorium (kod, nie dokumentacja) dla „emergency"/„awaryjn" oraz pokrewnych terminów w kontekście magazynowym.
- Zwrot — etykiety bez logiki: starszy, generyczny słownik typów ruchu zawiera kody `103` („Zwrot od klienta") i `203` („Zwrot do dostawcy") — `apps/web/supabase/migrations/20251024043520_enhance_movement_types.sql`, ale są to wyłącznie nazwy wybieralne w generycznym pickerze typu ruchu, bez żadnej dedykowanej logiki, formularza czy walidacji. Aktualny, docelowy schemat (`inventory_movement_headers.movement_kind`, `apps/web/supabase-target/supabase/migrations/20260505091000_inventory_phase1_core.sql:261-263`) ogranicza się do `receipt/issue/transfer/adjustment/opening_balance` — **nie zawiera wartości `return`**.
- Zwrot — odwracanie ruchu to korekta, nie zwrot: `reverseMovementAction` (`apps/web/src/app/actions/warehouse/inventory/index.ts:1837-1840`) to trwała zaślepka zwracająca błąd „Reversal not available in v1"; realny silnik `inventory_reverse_movement` (baza danych, `20260505092000_inventory_phase1_rpcs.sql:589-790`) poprawnie linkuje `original_movement_id`/`reversal_movement_id`, ale ma zaszyty na sztywno powód `'REVERSAL'` (linia 700), bez taksonomii przyczyn, stanu części czy kroku akceptacji — tylko sprawdzenie uprawnienia i wolny tekst notatki.
- Reklamacja/gwarancja: brak dedykowanej domeny; jedyne pokrewne pojęcie to wolnotekstowy (nie wymuszony przez bazę) słownik przyczyn wariancji audytu (`count-reason-codes.ts`: damaged/placement_error/theft/supplier_shortage/unexpected_surplus) — to etykieta różnicy inwentaryzacyjnej, nie obiekt reklamacji. Help Desk zasiewa domyślnie wyłącznie 3 typy ticketów (`general_request`/`question`/`task_request`) — brak domyślnego typu „Zwrot"/reklamacja (zgodne z ustaleniem Strefy 11).
- Stan/dyspozycja części: brak jakiejkolwiek kolumny (uszkodzona/sprawna/do kontroli/zablokowana) na `inventory_balances` czy `inventory_movement_lines` w aktualnym schemacie. Istnieje nieużywany typ ruchu „Zmiana statusu jakości" (kod 411, `affects_stock=0`), ale zero odwołań w kodzie.
- Customer Care VGP: zero reprezentacji kodowej w całym repozytorium (obie aplikacje) — wyłącznie wzmianki w plikach `docs/mvp/*.md`. Jedyne trafienie w kodzie to komentarz w parserze Matchera wykluczający „VGP" z rozpoznawania numerów (skrót nazwy klienta), niezwiązany z żadną funkcją Customer Care.
- CRM/dane klienta: rola `'client'` istnieje w ograniczeniu CHECK generycznej tabeli ról CRM (`crm_party_roles`), wybieralna w UI, ale bez żadnego konsumenta poza edycją samego rekordu — brak tabeli historii spraw/interakcji.
- Odrzucenie gdzie indziej: jedyny realny mechanizm decyzji z powodem w pobliżu tej strefy to odrzucenie transferu międzyoddziałowego (`declineBranchTransfer`, ze strefy magazynowej, nie zwrotów/reklamacji) — nieistotny dla tej strefy poza wykazaniem, że wzorzec „decyzja z powodem" jest gdzieś w kodzie zastosowany, tylko nie tutaj.
- Klasyfikacja poprzednich ustaleń trackera: „Cel: ROADMAP ONLY... awaryjne pobranie nie występuje w głównej narracji; zwrot/reklamacja to przykłady ticketu" — **CONFIRMED**. Zachowana lista przyszłych wymagań (uprawnienia awaryjne, odbiorca/czas/potwierdzenie, wartość/rotacja zwrotu, akceptacja/odrzucenie/komentarz/raport, numer/link Customer Care, terminy/alarmy/statusy/dowody reklamacji) — **CONFIRMED** jako wciąż aktualny, kompletny opis przyszłej pracy; żadna pozycja nie wymaga korekty ani nie okazała się już częściowo zbudowana.

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
