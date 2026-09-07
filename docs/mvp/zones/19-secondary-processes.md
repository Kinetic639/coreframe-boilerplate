### 19. Lakiery, nieroty, procedury, zbiorczy dashboard

**Priorytet:** P3

**Stan obecny:** 🔴 NOT IMPLEMENTED

Cztery odrębne podobszary, wszystkie w tym samym stanie: brak dedykowanej domeny. **Lakiery** — zero jakiejkolwiek reprezentacji w kodzie; jedyne trafienia „paint" to nazwy przykładowych lokalizacji demo w statycznym pliku ustaleń mapy magazynu i niezwiązane użycia słowa w innym kontekście (renderowanie React, narzędzie Matcher) — nie ma modelu koloru/formuły/mieszania, nie ma nawet dedykowanego typu produktu. **Nieroty** — tu jest istotne rozróżnienie: surowe dane (`inventory_balances.last_movement_at`/`last_movement_id`) istnieją, są realnie pobierane przez serwis i pokazane w tabeli magazynu jako zwykła kolumna „Ostatni ruch" (numer dokumentu) — ale to wyłącznie referencja, nie obliczenie wieku zapasu; zero logiki „dni bez ruchu", zero progu, zero raportu/filtra rotacji. Dane wystarczające do policzenia nierotów istnieją; sama funkcja — nie. **Procedury** — zero jakiejkolwiek reprezentacji: brak tabeli, brak strony, nawet link nawigacyjny „Baza wiedzy" w menu edukacyjnym prowadzi donikąd (brak odpowiadającej strony). **Zbiorczy dashboard operacyjny** — potwierdzone ponownie (zgodnie z ustaleniem Strefy 16): `/dashboard/start` to jeden statyczny nagłówek bez danych; jedyne realne, zasilane bazą ekrany w tej okolicy to kanały aktywności/audytu ze Strefy 16, które są zupełnie inną rzeczą niż zagregowany operacyjny pulpit (tickety/terminy/braki/audyty/nieroty w jednym miejscu) opisany w starym backlogu tej strefy — taki pulpit nie istnieje w żadnej formie, nawet częściowej.

**Dowody:**

- Kod: VERIFIED dla wszystkich czterech podobszarów, wynikiem w większości negatywnym. Lakiery: zero wyników poza niezwiązanymi trafieniami tekstowymi. Nieroty: potwierdzono istnienie kolumny `last_movement_at`/`last_movement_id` i jej użycie jako zwykłej kolumny „numer ostatniego ruchu" w `inventory-client.tsx`, bez żadnej matematyki wieku zapasu ani raportu — jedyny istniejący raport magazynowy to `warehouse/reports/reorder` (Strefa 15), nie ma `reports/aging`/`reports/nieroty`. Procedury: zero wyników w całym kodzie dla „procedura"/„SOP"/„checklist" w znaczeniu dokumentu zgodności; link „Baza wiedzy" w menu (`EducationalMenu.tsx`, `MobileMenu.tsx`) nie ma odpowiadającej strony w `src/app`. Dashboard: ponownie potwierdzone (bez zmian od Strefy 16) — brak jakiejkolwiek trasy zbiorczego/podsumowującego pulpitu pod `/dashboard/warehouse/` czy gdziekolwiek indziej.
- Testy automatyczne: NONE dla wszystkich czterech podobszarów — nie ma funkcji, którą można by testować.
- Weryfikacja ręczna: NOT APPLICABLE — strefa pozostaje ROADMAP ONLY.
- Przebieg end-to-end: NOT APPLICABLE — brak jakiejkolwiek ścieżki do zweryfikowania w którymkolwiek z czterech podobszarów.

**Wymagany stan dla pitchu:** ROADMAP ONLY

### Pitch readiness checklist

- [ ] Lakiery: nie wspominane jako istniejąca funkcja — jeśli w ogóle, wyłącznie jako przyszły kierunek oparty o generyczny katalog produktów (Strefa 15).
- [ ] Nieroty: jeśli wspominane, opisane precyzyjnie jako „mamy dane (historia ruchów) potrzebne do policzenia rotacji zapasu w przyszłości", nie jako istniejący raport — dziś nie ma żadnego obliczenia wieku ani filtra.
- [ ] Procedury: nie wspominane jako istniejąca funkcja; link „Baza wiedzy" w menu nie jest pokazywany na żywo (prowadzi donikąd).
- [ ] Zbiorczy dashboard operacyjny: nie jest punktem wejścia ani przystankiem demo — zgodnie z już przyjętą zasadą ze Strefy 16, że główna narracja pitchu nie przechodzi przez pulpit startowy.
- [ ] Żaden z czterech podobszarów nie jest pokazywany na żywo.

Brama końcowa nie jest wymagana — brak demonstracji na żywo dla tej strefy.

**Pitch gap:**

Brak luki blokującej pitch — zgodne z zamierzeniem strefy jako czystej roadmapy, bez wymogu w skrypcie prezentacji. Jedyne ryzyko to retoryczne przecenienie „nierotów" — kolumna „ostatni ruch" w interfejsie magazynu może przypadkiem wyglądać, jakby już wspierała analizę rotacji, podczas gdy to tylko numer dokumentu.

**Wymagany stan dla pilotażu:** NOT REQUIRED FOR INITIAL CONTROLLED PILOT

### Pilot readiness checklist

Żaden z czterech podobszarów nie jest częścią zaakceptowanego zakresu pilotażu ze Strefy 12 (jeden oddział, wybrane procesy magazynowe rdzenia). Poniższe to wyłącznie przyszły backlog:

- [ ] (Przyszłość, nie pilotaż) Lakiery: dedykowany model (kod koloru/formuła), jeśli biznes uzna to za wartościowe po wynikach pilotażu.
- [ ] (Przyszłość, nie pilotaż) Nieroty: deterministyczna definicja progu (dni bez ruchu), zapytanie liczące wiek zapasu po stronie serwera, raport z możliwością przejścia do produktu/lokalizacji/historii, izolacja oddziałowa.
- [ ] (Przyszłość, nie pilotaż) Procedury: model dokumentu z wersjonowaniem, potwierdzeniem zapoznania i powiązaniem z rolami/oddziałami/ticketami — dziś brak jakiegokolwiek punktu wyjścia do rozbudowy.
- [ ] (Przyszłość, nie pilotaż) Zbiorczy dashboard: zdefiniowanie, jakie dane rzeczywiście powinien agregować (na bazie wyników pilotażu, nie z góry), i zbudowanie go od zera.
- [ ] **Zakres pilotażu potwierdzony jako nieobejmujący żadnego z tych czterech podobszarów.**

**Pilot gap:**

Nie dotyczy — żaden z czterech podobszarów nie jest częścią trzymiesięcznego, ograniczonego do jednego oddziału pilotażu zdefiniowanego w Strefie 12. Nie należy sztucznie włączać ich do zakresu.

### Notes / evidence

- Lakiery: zero dedykowanej reprezentacji; trafienia „paint" to wyłącznie nazwy przykładowych lokalizacji demo (`warehouse/locations/_ambra/constants.ts`) i niezwiązane użycia słowa gdzie indziej w kodzie.
- Nieroty — dane bez funkcji: `inventory_balances.last_movement_at`/`last_movement_id` istnieją i są pobierane (`inventory-balances.service.ts`, `ambra-location-inventory.service.ts`), pokazywane jako kolumna „Ostatni ruch" (numer dokumentu) w `inventory-client.tsx` — ale zero obliczenia „dni od ostatniego ruchu", zero progu/filtra, zero raportu rotacji/zalegania. Jedyny istniejący raport magazynowy to raport uzupełnienia stanu (Strefa 15, `warehouse/reports/reorder`) — nie ma odpowiednika dla nierotów.
- Procedury: zero wyników dla „procedura"/„SOP" w całym kodzie; jedyny pokrewny artefakt to statyczny, nieprowadzący donikąd link „Baza wiedzy" w menu edukacyjnym (`EducationalMenu.tsx`, `MobileMenu.tsx`) — brak odpowiadającej strony w `src/app`; jeden przycisk „Acknowledge Findings" w dialogu kondycji lokalizacji magazynowej tylko zamyka okno, nie zapisuje żadnego potwierdzenia.
- Dashboard: potwierdzone bez zmian względem Strefy 16 — `/dashboard/start` to statyczny nagłówek; brak jakiejkolwiek trasy zbiorczego/podsumowującego pulpitu operacyjnego pod `/dashboard/warehouse/` (tylko strony poszczególnych encji) ani gdziekolwiek indziej w aplikacji.
- Klasyfikacja poprzednich ustaleń trackera: „Cel: ROADMAP ONLY. Brak wymogu pokazu" — **CONFIRMED**. Zachowany backlog (lakiery: import/lokalizacje/progi/kontrola/inwentaryzacja/raport/historia; nieroty: import/dni/wartość/lokalizacja/status/rotacja/kontakty/raport; procedury: instrukcje/role/checklisty/wersje/potwierdzenie/linki/wyszukiwanie/szkolenie; dashboard: zakres osobisty/zespołowy, tickety/terminy/zadania, dostawy/braki/nieroty, odnośniki i odświeżanie, „nie tworzyć go dla katalogu funkcji") — **CONFIRMED** jako wciąż aktualny, kompletny opis przyszłej pracy dla wszystkich czterech podobszarów; żadna pozycja nie okazała się już częściowo zbudowana poza samą kolumną „ostatni ruch" (surowe dane, nie funkcja nierotów).
- Ta strefa jest ostatnią szczegółowo opisaną strefą w obecnym trackerze (numery 1–19); dalsze sekcje dokumentu to globalne bramki i decyzja o gotowości, nie kolejne ponumerowane strefy.

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
