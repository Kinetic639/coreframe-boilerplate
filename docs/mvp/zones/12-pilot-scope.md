### 12. Stan początkowy magazynu i propozycja kontrolowanego pilotażu

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

To strefa biznesowa/operacyjna, nie funkcjonalna — nie ma tu strony, tabeli ani akcji do zaudytowania jako takiej. Materiał skryptu (§8, §16–23) jest dojrzały i wewnętrznie uczciwy: już dziś wprost mówi, że Ambra pierwszego dnia nie zna całego starego magazynu, już dziś jasno rozdziela budżet pilotażu od ceny produktu, już dziś unika wymyślonych procentów sukcesu, już dziś traktuje negatywny wynik pilotażu jako wartościowy, a nie porażkę, i już dziś wprost mówi, że AutoStacja pozostaje źródłem prawdy podczas pilotażu. To nie jest fragmentaryczny szkic. Mimo to status nie może przekroczyć PARTIAL z dwóch niezależnych powodów: (1) sam materiał, choćby najlepszy, nie został tu odnotowany jako świeżo przećwiczony/porównany na głos z ustaleniami Stref 1–11; (2) skonfrontowanie tego materiału z realną implementacją ujawnia konkretną, nieoczywistą lukę — scenariusz „miesiąca 2: realna praca" w §18 milcząco zakłada, że dostawy realnie przechodzą przez Ambrę (przyjęcie, mobilne rozłożenie) i że wydanie działa — a Strefy 6 i 8 ustaliły, że mobilne rozłożenie, zamknięcie przyjęcia i dedykowane wydanie **dziś nie istnieją jako działające funkcje**, tylko jako placeholdery/obejścia. „Naturalna rotacja" ze §8 nie jest więc dziś operacyjnie wykonalna w takiej formie, w jakiej opisuje ją skrypt, dopóki te strefy nie osiągną co najmniej stanu DEMO READY.

**Dowody:**

- Materiał/skrypt: VERIFIED. §8 wprost mówi: „Ambra oczywiście pierwszego dnia nie będzie wiedziała o wszystkich starych zleceniach i częściach" oraz przedstawia dwie alternatywy (naturalna rotacja / wprowadzenie przy porządkowaniu i inwentaryzacji) — obie jawnie odrzucają wielką migrację historyczną pierwszego dnia. §16–17 jasno formułują prośbę o zgodę na 3-miesięczny, ograniczony do jednego oddziału pilotaż, z celem „jaką wartość Ambra daje w rzeczywistej pracy", nie „czy potrafię ją zbudować". §18 opisuje strukturę miesiąc 1 (przygotowanie) → miesiąc 2 (realna praca) → miesiąc 3 (iteracje i ocena). §19 unika wymyślonych liczb, definiuje sukces jakościowo (mniej czynności ręcznych, łatwiejsze/szybsze wybrane procesy, mniej pomyłek, mniejsza zależność od pamięci pracownika, prostota dla innych użytkowników, i kluczowo: pracownicy _wolą_ używać Ambry niż wracać do starego sposobu). §20 jawnie odróżnia budżet pilotażu (~25 tys. zł: sprzęt, infrastruktura/narzędzia, praca poza obecnymi obowiązkami) od ceny gotowego produktu — ale sama treść skryptu wskazuje na osobny „przygotowany podział budżetu" pokazywany na slajdzie, którego dokładnej zawartości nie ma w tym pliku źródłowym. §21–22 jasno mówią, że negatywny/częściowy wynik pilotażu jest wartościowym wynikiem, nie porażką, i że decyzja o dalszym rozwoju zapada dopiero po pilotażu, nie teraz. §10–11 jawnie i wprost stwierdzają, że AutoStacja pozostaje systemem źródłowym dla stanów/dokumentacji podczas pilotażu.
- Implementacja wspierająca: PARTIAL. Realny mechanizm wprowadzenia istniejącego stanu do konkretnej lokalizacji istnieje: typy ruchu `401`/`402` („Korekta z inwentaryzacji — nadwyżka/niedobór", Strefa 8) księgują przez ten sam silnik co przyjęcie/wydanie, z realnym zabezpieczeniem przed błędami po stronie bazy — to technicznie wspiera opcję B skryptu (wprowadzenie przy porządkowaniu/inwentaryzacji). Istnieje też osobny, nieużywany dziś przez UI tryb `movement_kind: 'opening_balance'` w silniku księgowania (Strefa 6/8) — dodatkowy, potencjalny, ale dziś niepodłączony do żadnego ekranu mechanizm otwarcia salda. Opcja A (naturalna rotacja) zależy strukturalnie od tego, żeby nowe dostawy realnie przechodziły przez Ambrę od przyjęcia po rozłożenie — a Strefa 6 ustaliła, że mobilne rozłożenie i zamknięcie przyjęcia dziś nie istnieją (placeholdery), więc „naturalna rotacja" w praktyce dziś zatrzymuje się na etapie zaimportowanej, ale nieprzełożonej na fizyczne miejsce, dostawy. Żaden mechanizm programowy nie chroni dziś przed podwójnym wprowadzeniem tej samej pozycji legacy — to musi być regułą proceduralną, nie funkcją.
- Weryfikacja ręczna: NOT VERIFIED — materiał nie został odczytany na głos ani porównany punkt po punkcie z ustaleniami Stref 1–11 w tej sesji ani w żadnej odnotowanej wcześniejszej.
- Gotowość operacyjna: NOT VERIFIED — brak potwierdzenia, że oddział/użytkownicy/urządzenia/zgoda na dane są już uzgodnione; brak spisanej reguły antyduplikacyjnej; brak nazwanej osoby odpowiedzialnej za pilotaż w samym materiale (domyślnie prezenter, ale nie zapisane wprost); brak warunków zatrzymania pilotażu.

**Wymagany stan dla pitchu:** DEMO READY dla materiału i propozycji

### Pitch readiness checklist

**Stan początkowy**

- [ ] Prezenter wprost mówi na głos (nie tylko w slajdzie), że Ambra pierwszego dnia nie zna całego starego magazynu.
- [ ] Wybrano do rozmowy jedną lub obie strategie ze skryptu (naturalna rotacja / wprowadzenie przy porządkowaniu i inwentaryzacji) i przygotowano krótkie, konkretne sformułowanie każdej.
- [ ] Spisano prostą regułę proceduralną unikania podwójnego wprowadzenia tej samej pozycji legacy (kto może wprowadzać, jak oznaczyć „już wprowadzone") — dziś nic w oprogramowaniu tego nie pilnuje, więc musi to być jawna zasada organizacyjna, nie założenie.
- [ ] Prezenter jest świadomy (nawet jeśli nie mówi tego wprost na pitchu), że scenariusz „naturalnej rotacji" z §8 zakłada działające mobilne przyjęcie/rozłożenie ze Strefy 6, które dziś nie istnieje jako funkcja — przygotowano spójne, uczciwe sformułowanie tego w kontekście miesiąca 1 pilotażu („dokończenie wybranych procesów do realnego użycia" z §18 musi realnie obejmować dokończenie tych elementów, nie tylko konfigurację środowiska).

**Zakres pilotażu**

- [ ] Materiał jasno określa: jeden oddział, ograniczona liczba użytkowników, konkretne, wybrane procesy — nie cała firma, nie wszystkie procesy.
- [ ] Materiał nie sugeruje zastąpienia AutoStacji ani automatycznej synchronizacji.

**Trzy miesiące**

- [ ] Struktura miesiąc 1 (przygotowanie) → miesiąc 2 (realna praca) → miesiąc 3 (iteracje i ocena) jest gotowa do krótkiego przedstawienia zgodnie z §18.
- [ ] Zakres miesiąca 1 uwzględnia realistycznie to, co Strefy 1–11 pokazały jako brakujące w wybranych do pilotażu procesach (nie tylko „środowisko produkcyjne i backupy") — inaczej harmonogram miesiąca 1 jest niedoszacowany.
- [ ] Nazwano (choćby nieformalnie) osobę odpowiedzialną operacyjnie za pilotaż i punkt kontaktowy dla użytkowników przy problemach.

**Budżet**

- [ ] Kwota ~25 tys. zł jest przedstawiona wprost jako budżet pilotażu, nie cena Ambry — zgodnie z jawnym rozróżnieniem już obecnym w §20 skryptu.
- [ ] Przygotowano rzeczywisty, prosty podział budżetu (sprzęt / infrastruktura i narzędzia / praca poza obecnymi obowiązkami) na slajdzie — skrypt odsyła do „przygotowanej wersji" podziału, której samej treści nie ma w pliku źródłowym skryptu, więc trzeba potwierdzić, że faktycznie istnieje i jest gotowa.
- [ ] Brak sztucznej precyzji (np. rozbicia co do złotówki) tam, gdzie skrypt jej nie zakłada.

**Sukces i porażka**

- [ ] Kryteria sukcesu ze §19 (mniej czynności ręcznych, szybsze/łatwiejsze wybrane procesy, mniej pomyłek, mniejsza zależność od pamięci pracownika, prostota, preferencja pracowników wobec starego sposobu) są gotowe do przedstawienia bez wymyślonych liczb.
- [ ] Wypowiedź jasno mówi, że niepotwierdzenie założeń to nadal wartościowy wynik (§21), nie porażka całego projektu.
- [ ] Wypowiedź jasno mówi, że decyzja o dalszym rozwoju zapada dopiero po pilotażu, na podstawie dowodów (§22), nie jest przesądzona dziś.

**Brama końcowa**

- [ ] **Dokładna sekcja pitchu Strefy 12 przećwiczona/przejrzana na głos na aktualnym materiale, w konfrontacji ze Strefami 1–11:** wyjaśnienie stanu początkowego → ograniczony do jednego oddziału/liczby użytkowników pilotaż → struktura trzech miesięcy → prośba o wsparcie ~25 tys. zł → kryteria sukcesu/porażki → AutoStacja jako źródło prawdy → jasna prośba o zgodę/wsparcie → żadne zdanie nie sugeruje, że Ambra jest już gotowym produktem produkcyjnym ani że cały stary magazyn/procesy zostaną zmigrowane przed pilotażem.

**Pitch gap:**

Materiał źródłowy jest mocny i uczciwy — to nie jest strefa wymagająca przepisania skryptu. Realny gap to: (1) brak świeżej próby wygłoszenia/skonfrontowania tej sekcji z resztą audytu; (2) ciche założenie w §18 (miesiąc 2: „realna praca"), że przyjęcie/rozłożenie i wydanie już działają — podczas gdy Strefy 6 i 8 ustaliły, że kluczowe elementy tych procesów są dziś placeholderami; to nie unieważnia propozycji pilotażu (przygotowanie w miesiącu 1 może i powinno obejmować ich dokończenie), ale wymaga uczciwego, jawnego uwzględnienia tego w zakresie miesiąca 1, żeby nie obiecać zarządowi gotowości, której nie ma; (3) brak spisanej reguły antyduplikacyjnej dla wprowadzania zaległego stanu — dziś to czysto proceduralne, nieoprogramowane; (4) brak potwierdzenia, że osobny „przygotowany podział budżetu" (do którego odsyła skrypt) faktycznie istnieje jako gotowy materiał.

**Wymagany stan dla pilotażu:** PILOT READY operacyjnie

### Pilot readiness checklist

- [ ] Oddział pilotażowy wybrany i formalnie zatwierdzony przez firmę.
- [ ] Użytkownicy/role pilotażu wybrani i poinformowani, z minimalnym wprowadzeniem: co jest autorytatywne w Ambrze, co nadal trzeba robić w AutoStacji, jak zgłaszać problemy.
- [ ] Formalna zgoda firmy na wykorzystanie rzeczywistych danych/procesów w pilotażu — odesłanie do globalnej bramki „CONTROLLED PILOT" w tym dokumencie, nie duplikowanie jej tutaj.
- [ ] Nazwana osoba odpowiedzialna operacyjnie za pilotaż oraz punkt kontaktowy przy awarii/problemie.
- [ ] Spisana procedura uzgadniania z AutoStacją (co robić, gdy stany się rozjadą) — zależność już odnotowana w Strefie 8, tu potwierdzona jako wymóg organizacyjny przed startem pilotażu.
- [ ] Spisana, uzgodniona procedura wprowadzania stanu początkowego (kto, kiedy, jak oznaczyć „już wprowadzone", jak uniknąć duplikatu) — nie tylko koncepcja ze slajdu.
- [ ] Sprzęt/urządzenia gotowe: telefon(y) do skanowania, drukarka etykiet, etykiety, stanowisko komputerowe — zakres wynika z faktycznie testowanych procesów, nie z góry ustalonej listy zakupów.
- [ ] Środowisko (produkcja/staging, backupy, monitoring) gotowe — odesłanie do globalnej bramki „CONTROLLED PILOT", nie duplikowanie.
- [ ] Prosty plan pomiaru uzgodniony (znaczniki czasu tam, gdzie system je ma, ręczna obserwacja/próbkowanie czasu, log problemów/błędów, cykliczne zbieranie opinii) — bez rozbudowanej analityki.
- [ ] Ustalona częstotliwość przeglądu postępu pilotażu (np. cotygodniowa).
- [ ] Log incydentów/problemów pilotażu prowadzony w jednym uzgodnionym miejscu.
- [ ] Warunki zatrzymania pilotażu jawnie spisane (np. problem izolacji danych, niespójności stanu magazynowego, powtarzające się fałszywe sukcesy operacji, nieakceptowalna podwójna praca, niestabilność krytycznego procesu, utrata/uszkodzenie danych) — dziś nieobecne w materiale.
- [ ] Format i termin spotkania podsumowującego pilotaż oraz osoba decydująca o dalszych krokach ustalone z wyprzedzeniem.
- [ ] Wszystkie procesy faktycznie objęte pilotażem osiągnęły co najmniej DEMO READY (a najlepiej PILOT READY) w odpowiednich strefach tego dokumentu przed realnym uruchomieniem z danymi firmowymi — nie tylko przed samym pitchem.
- [ ] **Dokładny scenariusz pilotażu Strefy 12 zweryfikowany operacyjnie**: wszystkie powyższe punkty potwierdzone jako uzgodnione i gotowe, nie tylko zaplanowane.

**Pilot gap:**

Główna praca przed realnym pilotażem to nie technologia tej konkretnej strefy, tylko organizacja: spisanie reguł, które dziś istnieją wyłącznie jako dobre intencje (antyduplikacja, warunki zatrzymania, uzgadnianie z AutoStacją, odpowiedzialność), oraz — co ważniejsze — upewnienie się, że procesy faktycznie objęte pilotażem (przyjęcie/rozłożenie ze Strefy 6, wydanie ze Strefy 8, ewentualnie zlecenia ze Strefy 4) same osiągnęły wymagany poziom gotowości, zanim miesiąc 2 pilotażu („realna praca") będzie mógł się wydarzyć zgodnie z opisem w skrypcie.

### Notes / evidence

- Skrypt §8: „Ambra oczywiście pierwszego dnia nie będzie wiedziała o wszystkich starych zleceniach i częściach" + dwie strategie (naturalna rotacja / porządkowanie i inwentaryzacja) — jawnie odrzuca migrację historyczną.
- Skrypt §16–17: prośba o 3-miesięczny, ograniczony do jednego oddziału pilotaż; cel to sprawdzenie wartości w realnej pracy, nie dowód wykonalności technicznej.
- Skrypt §18: struktura miesiąc 1 (przygotowanie: środowisko produkcyjne, infrastruktura, backupy, monitoring, dopracowanie bezpieczeństwa i uprawnień, przygotowanie użytkowników/lokalizacji/etykiet/danych, dokończenie wybranych procesów) → miesiąc 2 (realna praca: prawdziwe dostawy/części/lokalizacje, inni użytkownicy, stopniowe uruchamianie, feedback) → miesiąc 3 (iteracje i ocena).
- Skrypt §19: kryteria sukcesu jakościowe, bez wymyślonych procentów — kluczowe: „przy konkretnych procesach pracownicy wolą używać Ambry niż wrócić do starego sposobu".
- Skrypt §20: budżet ~25 tys. zł jawnie odróżniony od ceny produktu; podział (sprzęt, infrastruktura/narzędzia, praca) ma być pokazany „zgodnie z przygotowaną wersją" — sama zawartość tego podziału nie jest częścią pliku źródłowego skryptu, wymaga potwierdzenia jako osobny, gotowy materiał.
- Skrypt §21–22: negatywny/częściowy wynik pilotażu to wartościowy wynik, nie porażka; decyzja o dalszym rozwoju zapada po pilotażu na podstawie dowodów, nie jest przesądzona.
- Skrypt §10–11: AutoStacja jawnie pozostaje systemem źródłowym dla stanów/dokumentacji podczas pilotażu — ta granica jest już dziś jasno wypowiedziana w materiale, nie wymaga dodania.
- Zależność krzyżowa ze Strefą 6: mobilne rozłożenie i zamknięcie przyjęcia to dziś potwierdzone placeholdery (`/warehouse/deliveries`, `/warehouse/scanning/delivery`) — „naturalna rotacja" ze §8 zakłada działający proces przyjęcia, którego dziś brakuje w części mobilnej.
- Zależność krzyżowa ze Strefą 8: dedykowane „wydanie" to dziś zaślepka zwracająca zaszyty błąd; jedyny działający substytut (ruch typu 402) nie ma pola odbiorcy — istotne dla „potwierdzenia wydania" wspomnianego w §10–11 skryptu jako elementu wartości testowanego w pilotażu.
- Zależność krzyżowa ze Strefą 4: jeśli pilotaż ma testować wartość lokalizacji/wyszukiwania w kontekście zlecenia naprawczego (część wartości opisanej w §17), zależy to od nieistniejącego dziś modelu zlecenia — do uwzględnienia przy ustalaniu dokładnego zakresu procesów testowanych w pilotażu, nie jako blokada samego pitchu.
- Mechanizm wprowadzenia stanu początkowego: realnie istnieje przez typy ruchu 401/402 (Strefa 8) oraz nieużywany dziś przez UI tryb `movement_kind: 'opening_balance'` w silniku księgowania (Strefa 6/8) — technicznie wspiera opcję B skryptu, ale bez żadnej wbudowanej ochrony przed podwójnym wprowadzeniem tej samej pozycji.
- Globalna bramka „CONTROLLED PILOT" w tym dokumencie (sekcja „Globalne bramki") pokrywa techniczne/bezpieczeństwowe wymagania pilotażu (RLS, backupy, monitoring, testy E2E) — nie duplikowana tutaj, tylko odnotowana jako punkt odniesienia dla wymagań operacyjnych tej strefy.

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
