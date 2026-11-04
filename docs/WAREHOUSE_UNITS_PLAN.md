# Oddziały, magazyny i jednostki w Ambrze — plan

Status: **kierunek zaakceptowany** (2026-11-04), szczegóły w sekcji 9 do potwierdzenia. Nic z tego nie jest jeszcze zbudowane.

## 0. Ustalone z właścicielem produktu (2026-11-04)

- W AutoStacji każdy magazyn (3112, 3252, 3332, 3142) jest **osobnym oddziałem**, a jednostki należą do magazynów. Żeby sprawdzić coś na Škodzie, będąc na Seacie, trzeba przełączać oddział, co bywa wolne. Wszystkie te „oddziały” to w rzeczywistości **jeden fizyczny oddział, Poznań Komorniki**.
- W Ambrze tego unikamy: **jeden oddział, pod nim magazyny, pod magazynami jednostki**. Wszystkie magazyny oddziału widać bez przełączania.
- Zostaje logika dokumentów z AS: **MMJ** między magazynami, **MM** tylko między jednostkami tego samego magazynu.

### Słownik AutoStacji (z kartoteki towarów, 2026-11-04)

Kartoteka „Towary w/g magazynów” dla oddziału **33 Škoda**:

| Kod AS | Nazwa w AS                      |
| ------ | ------------------------------- |
| 310    | Magazyn 310 (części)            |
| 315    | Magazyn 315 (blacharnia części) |
| 316    | Magazyn 316 (lakiery)           |
| 317    | Magazyn 317 (mieszalnik)        |
| 318    | Magazyn 318 (kompletacje)       |
| 319    | Magazyn 319 (usługi obce)       |

W AutoStacji:

- **oddział** (jednostka organizacyjna) to 3112 VW, 3252 Seat, 3332 Škoda, 3142 BC Komorniki. Przełącza się go, ma własną numerację, a między oddziałami idzie **MMJ**;
- **magazyn** to 310, 315, 316… w obrębie oddziału. Między magazynami jednego oddziału idzie **MM**.

W Ambrze **oddział** to fizyczne miejsce (Poznań Komorniki). Zawiera kilka oddziałów AS, a te dzielą się na magazyny AS. Kody zapisujemy **dokładnie jak w AS**, żeby import, eksport i numery dokumentów (ZL/…/3332/BL, ZW/…/3332) zgadzały się bez tłumaczenia.

## 1. Po co (stan sprzed decyzji)

Dziś Ambra utożsamia „jednostkę” z **oddziałem**. Każdy magazyn AutoStacji musiałby więc być osobnym oddziałem z osobnym przełączaniem i osobnymi stanami. Kody magazynów są tylko listą przy oddziale. Skutki:

- import z Matchera odrzuca zlecenia z kodem magazynu, którego oddział nie ma na liście („Magazyn spoza oddziału”, np. `ZL/51005/26/3252/BL`);
- MMJ (z akceptacją) działa tylko **między oddziałami**, a nie między magazynami jednego oddziału;
- Ambra nie wie, w którym magazynie AS (310, 315, 316…) jest część, więc nie da się zrobić MM 315 → 316.

Cel: **jeden oddział Ambry zawiera wiele jednostek (oddziałów AS), a każda jednostka ma swoje magazyny AS**. Import wie dokładnie, które jednostki i magazyny są „nasze”.

## 2. Jak to działa w AutoStacji

Publiczna dokumentacja AutoStacji (SoftVig) nie opisuje konfiguracji magazynów i jednostek. Producent pokazuje tylko ogólny opis DMS i modułu WMS ([AutoStacja](https://softvig.pl/produkty/dms-autostacja/), [moduł WMS](https://softvig.pl/produkty/modul-wms/)). Instrukcja jest dla klientów w bazie wiedzy SoftVig. Poniżej jest więc **opis właściciela produktu**, nie dokumentacja. Rzeczy niepotwierdzone są w sekcji 9.

| Pojęcie                              | Przykład                                                                                                                   | Co to jest                                                                                         |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Oddział AS (jednostka organizacyjna) | 3112 VW, 3252 Seat, 3332 Škoda, 3142 BC Komorniki                                                                          | Osobny stan i numeracja dokumentów. Między oddziałami AS towar idzie przez **MMJ**.                |
| Magazyn AS                           | 3332: 310 części, 315 blacharnia, 316 lakiery, 317 mieszalnik, 318 kompletacje, 319 usługi obce; 3112: 115, 116, 117, 119… | Osobny stan w obrębie oddziału AS. Między magazynami jednego oddziału AS towar idzie przez **MM**. |

- **MM** (w obrębie magazynu, np. 116 → 117 w 3112): jeden dokument, księguje się od razu, bez wysyłania w drogę i bez przyjęcia u odbiorcy. Jednostek nie trzeba przełączać.
- **MMJ** (między magazynami, np. 115 z 3112 → 315 z 3332): MMJ- wysłane w drogę („POTEM”), po przełączeniu na docelowy magazyn przyjęte jako MMJ+. Tak to już działa w Ambrze (sekcja 9 w `INTERNAL_ORDERS_PLAN.md`), tylko między oddziałami.
- Tekst z okna AutoStacji przy MMJ: „nastąpi przesunięcie towarów do innej **jednostki organizacyjnej**”. W AS jednostką organizacyjną jest więc magazyn (3112), a nie 115.

## 3. Jak jest dziś w Ambrze

- `branches`: oddział, przełącznik i granica uprawnień oraz stanów.
- `branch_warehouses`: kody magazynów przy oddziale (CNP Poznań: 3112, 3122, 3252, 3332, 3142) z prefiksem ZL / ZLEC. Każdy kod należy do jednego oddziału w organizacji.
- `branches.external_codes`: kody, po których ZW „na inny oddział” rozpoznaje oddział docelowy.
- MMJ: jednostka to oddział, a numer `MMJ-/<nr>/<rr>/<kod>` bierze **pierwszy** kod magazynu oddziału (`inventory_branch_unit_code_internal`).
- Stan (`inventory_balances`) jest liczony per oddział, lokalizację i część. **Nie ma wymiaru magazynu ani jednostki.**
- Import zleceń: kod magazynu z numeru ZL (4. człon) musi być na liście magazynów aktywnego oddziału. Inaczej powstaje konflikt „Magazyn spoza oddziału”.
- Numeracja ZW (`ZW/<nr>/<rr>/<magazyn>`) jest już per kod magazynu.

Dlaczego w „Ambra – testy” teraz wyskakuje błąd: oddział „Poznań Komorniki” ma tylko testowy magazyn 9101, a zlecenia są z 3252, 3112, 3332 i 3142.

## 4. Model docelowy

Nazwy w Ambrze (propozycja, do potwierdzenia):

| Ambra         | AutoStacja                           | Przykład                                                                                  |
| ------------- | ------------------------------------ | ----------------------------------------------------------------------------------------- |
| **Oddział**   | — (fizyczne miejsce; w AS go nie ma) | Poznań Komorniki                                                                          |
| **Jednostka** | oddział / „jednostka organizacyjna”  | 3332 Škoda, 3252 Seat, 3112 VW, 3142 BC Komorniki                                         |
| **Magazyn**   | magazyn                              | 310 części, 315 blacharnia, 316 lakiery, 317 mieszalnik, 318 kompletacje, 319 usługi obce |

Nazwa „jednostka” pochodzi z samej AutoStacji: okno MMJ mówi o „przesunięciu do innej jednostki organizacyjnej”, a MMJ to „przesunięcie między jednostkami”.

```
Organizacja
└── Oddział Poznań Komorniki: przełącznik, uprawnienia, regały (lokalizacje fizyczne)
    ├── Jednostka 3332 Škoda: prefiks ZLEC, numeracja dokumentów
    │   ├── Magazyn 310 części
    │   ├── Magazyn 315 blacharnia części
    │   ├── Magazyn 316 lakiery
    │   ├── Magazyn 317 mieszalnik
    │   ├── Magazyn 318 kompletacje
    │   └── Magazyn 319 usługi obce
    ├── Jednostka 3112 Volkswagen: prefiks ZL
    │   └── Magazyny 11x…
    ├── Jednostka 3252 Seat
    └── Jednostka 3142 BC Komorniki
```

Zasady:

1. **Oddział** zostaje tym, czym jest: miejscem pracy, przełącznikiem, uprawnieniami i regałami. Wszystkie jednostki i magazyny oddziału widać **bez przełączania**. To jest główna przewaga nad AS.
2. **Jednostka** to dzisiejsze `branch_warehouses`, rozszerzone. Należy do jednego oddziału i ma kod AS (3332), nazwę, prefiks zleceń (ZL / ZLEC) i magazyn domyślny.
3. **Magazyn** to nowa tabela `unit_warehouses`. Należy do jednej jednostki i ma kod AS (315) i nazwę AS („blacharnia części”).
4. **Kody 1:1 z AS:** jednostka i magazyn przechowują kody dokładnie jak w AutoStacji, więc import, eksport i numery dokumentów nie wymagają tłumaczenia.
5. **Własność towaru vs miejsce:** lokalizacja (regał) mówi, gdzie część leży. Magazyn AS mówi, w czyim stanie jest w AutoStacji. Jeśli części różnych magazynów leżą na tych samych regałach (pytanie 1 w sekcji 9), magazyn trafia **do stanu jako osobny wymiar** (jak partia): saldo to (lokalizacja, część, magazyn AS). Jeśli każdy magazyn ma swoje regały, wystarczy przypisać lokalizacje do magazynów.

## 5. Ruchy

| Ruch                        | Kiedy                                                                                                     | Jak w Ambrze                                                                                                                                                                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **MM** (801)                | ten sam magazyn, inna lokalizacja (jak dziś) **albo** inny magazyn tej samej jednostki (315 → 316 w 3332) | Od razu, bez akceptacji. W edytorze dochodzi „magazyn źródłowy / docelowy”, a lista docelowych jest ograniczona do tej samej jednostki.                                                                                                          |
| **MMJ- / MMJ+** (303 / 305) | inna jednostka (3112/115 → 3332/315), także **w tym samym oddziale**                                      | Jak dziś: wstrzymane, w drodze (zarezerwowane u nadawcy) i przyjęcie w całości. Adresatem jest **jednostka i magazyn**, a nie oddział. Numer `MMJ-/<nr>/<rr>/<kod jednostki nadawcy>`. Przyjęcie w tym samym oddziale robi się bez przełączania. |
| PZ / RW / storno / korekty  | —                                                                                                         | Każda linia ma magazyn AS. PZ bierze magazyn z dokumentu (jeśli Matcher go zna) albo magazyn domyślny jednostki zlecenia. RW wydaje z magazynu rezerwacji.                                                                                       |

Edytor sam pilnuje reguły: MM pozwala wybrać tylko magazyn tej samej jednostki, a przy innej jednostce proponuje MMJ.

## 6. Import (Matcher, zlecenia, ZW)

- **Jednostka zlecenia i części** pochodzi z **ZW** (`ZW/806/26/3252`) i z **magazynu** w nagłówku bloku (515), **nie z numeru ZL**. Jednostka musi należeć do aktywnego oddziału. Jeśli należy do innego oddziału, komunikat mówi którego. Nieznany kod ma przycisk „Dodaj jednostkę 3252 do oddziału”. Numer ZL jest tylko identyfikatorem zlecenia.
- **Magazyn przyjęcia:** jeśli dokument (WDD / blok Matchera) niesie kod magazynu (315…), przyjmujemy na niego. Jeśli nie, bierzemy magazyn domyślny jednostki zlecenia.
- **ZW** `ZW/<nr>/<rr>/<jednostka>`: jednostka z 4. członu, oddział docelowy przez jednostkę. Zastępuje to `branches.external_codes`.

### Przyjęcie dostawy z Matchera: jedno PZ, nie PZ na jednostkę

Jedna sesja Matchera zawiera dokumenty kilku jednostek (VW 3112, Seat 3252, Škoda 3332, BC 3142).

- **„Utwórz PZ” dalej tworzy jedno PZ na całą dostawę**, a jego linie mają swoje magazyny (115, 515, 315, 415…). Jedno kliknięcie i jedno zaksięgowanie, jak dziś.
- Stan i rezerwacje lądują od razu w **magazynie AS każdej linii**, więc nic nie trzeba potem rozdzielać.
- **Raport po przyjęciu** (dla AutoStacji) i podgląd PZ grupują linie **per jednostka i magazyn**, żeby łatwo porównać z AS i zaktualizować ją jednostka po jednostce.
- Rozważana alternatywa: automatyczny podział na kilka PZ, po jednym na jednostkę, z numeracją per jednostka jak w AS. **Nie bierzemy jej na start**: więcej dokumentów, a dla stanu w Ambrze nic nie zmienia, bo magazyn i tak jest na linii. Da się ją dodać później bez zmiany modelu, jeśli porównanie z AS będzie tego wymagać.

## 7. Ustawienia (UI)

Organizacja → Oddziały → oddział → **Jednostki i magazyny** (rozbudowa istniejącego panelu magazynów oddziału, `branch-warehouses-panel`), z uprawnieniem `warehouse.structure.manage`:

- jednostki oddziału: kod AS, nazwa, prefiks ZL / ZLEC, magazyn domyślny;
- magazyny jednostki: kod AS, nazwa; dodaj, zmień nazwę, wyłącz (nie usuwaj, jeśli jest stan albo historia);
- przeniesienie jednostki do innego oddziału (admin organizacji), tylko bez towaru w drodze;
- podpowiedzi: kody jednostek i magazynów, które Ambra widziała w zleceniach i dokumentach, a nie ma ich w konfiguracji.

Wszędzie, gdzie dziś jest przełącznik oddziału, dochodzi **filtr jednostki / magazynu** (stany, ruchy, Rozlokowanie), bez przeładowania kontekstu.

## 8. Etapy

| Etap                | Zakres                                                                                                                                                                                                                                         | Efekt                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| **U1**              | Jednostki (rozszerzone `branch_warehouses`) i magazyny (nowa tabela), uprawnienie `warehouse.structure.manage`, ekran „Jednostki i magazyny” z podpowiedziami z Matchera, lepsze komunikaty importu (czyja jest jednostka, dodanie brakującej) | Koniec z „Magazyn spoza oddziału” po skonfigurowaniu. Ambra zna Twoje jednostki i magazyny AS. |
| **U2**              | Magazyn AS jako wymiar stanu (albo przypisanie lokalizacji do magazynów, zależnie od pytania 1). Migracja istniejącego stanu do magazynu domyślnego jednostki                                                                                  | Stany per magazyn i per jednostka, widoczne w jednym oddziale.                                 |
| **U3**              | MM między magazynami jednej jednostki. Magazyn w PZ, RW, rozkładaniu i przy wydaniu                                                                                                                                                            | MM 315 → 316 jak w AS.                                                                         |
| **U4**              | MMJ między jednostkami (także w obrębie oddziału) z adresatem „jednostka / magazyn”. ZW po kodach jednostek                                                                                                                                    | MMJ 3112 → 3332 bez osobnych oddziałów i bez przełączania.                                     |
| **U5**              | Filtry i raporty per jednostka i magazyn                                                                                                                                                                                                       | Widoki jak w AS, bez przełączania.                                                             |
| **M1** (równolegle) | Parser Matchera: kod, nazwa magazynu, dealer i marka z nagłówka bloku; sekcja „ZR” jako zmiana rezerwacji                                                                                                                                      | Import wie, na który magazyn przyjąć, bez zgadywania.                                          |

U1 można wdrożyć od razu i niezależnie. U2 to największa zmiana (silnik księgowania) i wymaga osobnego przeglądu oraz testów pgTAP na każdym typie ruchu.

## 9. Odpowiedzi i ustalenia (2026-11-04)

1. **Części różnych magazynów i jednostek leżą fizycznie razem.** Magazyn AS jest więc **wymiarem stanu** (saldo = lokalizacja, część, magazyn AS), a nie przypisaniem regału (U2 w tej wersji).
2. **Kod magazynu AS jest w dokumentach.** Matcher już go czyta z zamówień markowych (`warehouse_code` w bloku, z etykietą np. „blacharnia czesci”). W sesjach do 2026-11-03:

   | Marka | Jednostka (ZW / ZL) | Magazyn AS | Bloków |
   | ----- | ------------------- | ---------- | ------ |
   | Škoda | 3332                | 315        | 1203   |
   | Škoda | 3332                | 415        | 592    |
   | Seat  | 3252                | 515        | 519    |
   | VW    | 3112                | 115        | 399    |
   | BC    | 3142                | 415        | 167    |
   | Seat  | 3252                | 415        | 154    |
   | VW    | 3112                | 415        | 79     |

   Wzór (do potwierdzenia): **pierwsza cyfra magazynu wskazuje jednostkę**: 1xx = 3112 VW, 3xx = 3332 Škoda, 4xx = 3142 BC, 5xx = 3252 Seat. Magazyn 415 przy zamówieniu Škody, Seata albo VW oznaczałby więc część z magazynu BC Komorniki. Etykieta magazynu w Matcherze bywa błędna („VW”, „Seat”, „Mirror” zamiast „blacharnia czesci”), więc import ma brać **kod**, nie etykietę.

3. **Nazwy:** jednostka = kod oddziału AS (3112, 3332…), magazyn = kod magazynu AS (115, 315…). Potwierdzone.
4. „33” w „33 Škoda” nie ma znaczenia, pomijamy.
5. **3122 nie istnieje** (decyzja właściciela produktu). Wniosek: **jednostki nie bierzemy z numeru ZL** (jego 4. człon nie zawsze jest jednostką), tylko z **ZW i magazynu** (np. ZW/1421/26/3112 + magazyn 115). Numer ZL zostaje identyfikatorem zlecenia. 3122 usuwamy z konfiguracji CNP Poznań.

### Z dokumentów marek („Dyspozycja przeniesienia towarów”, 2026-11-03)

Każdy blok ma w nagłówku jednostkę (nazwę dealera), magazyn i markę, a w treści ZL i ZW:

| Dokument | Nagłówek bloku                                                             | ZW (jednostka części) | Sekcja                                          |
| -------- | -------------------------------------------------------------------------- | --------------------- | ----------------------------------------------- |
| VW       | „Dealer VW-O/D Poznan Wajsówny; Magazyn 115 (blacharnia czesci) 31 VWO”    | 3112                  | „Blacharnia D3112”                              |
| Seat     | „Dealer Seat Poznan Wajsówny; Magazyn 515 (blacharnia czesci) 32 Seat”     | 3252                  | „Blacharnia D3252”                              |
| Škoda    | „Dealer Skoda Poznan Wajsówny; Magazyn 315 (blacharnia czesci) 33 Skoda”   | 3332                  | „Blacharnia D3332”                              |
| BC       | „Body Center Poznan-Komorniki; Magazyn 415 (blacharnia czesci) 31 Audi_BC” | 3142                  | „Blacharnia D3142”, „99. Zamówienie WDD KOM_BC” |

- **Magazyn 415 w dokumentach VW, Seata i Škody** jest zawsze w sekcji „ZR – Zmiana rezerwacji” (ujemne IDP). To części z magazynu BC 415, którym zmienia się rezerwację na zlecenie innej jednostki.
- „31 VWO”, „32 Seat”, „33 Skoda”, „31 Audi_BC” to skrót przy magazynie (31 występuje i przy VWO, i przy Audi_BC). Znaczenie nieznane, **na razie pomijany**.
- „D3110 / D3330” obok daty to najpewniej stanowisko lub dział wydruku. Nie używamy.

### Konfiguracja i uprawnienia

- Jednostkami i magazynami oddziału zarządza użytkownik z uprawnieniem **`warehouse.structure.manage`** (nowe): **owner, kierownik magazynu i admin** (decyzja 2026-11-04). Owner ma je przez `warehouse.*`. W organizacjach nie ma podstawowych ról „kierownik magazynu” ani „admin oddziału” (role są własne, np. „Magazynier”), więc uprawnienie trzeba dodać do tych ról przy wdrożeniu. Ekran ról (naprawiony 2026-11-04) pokazuje cały katalog uprawnień z bazy pogrupowany po modułach, nie usuwa przy zapisie uprawnień spoza listy, a serwer odrzuca uprawnienia platformowe (`superadmin.*`) i nieznane.
- Uprawnienie pozwala dodawać, zmieniać nazwy, wyłączać i ustawiać magazyn domyślny.
- **Matcher podpowiada konfigurację:** z nagłówków bloków zbiera pary (kod magazynu, nazwa magazynu, nazwa jednostki, marka) oraz kody jednostek z ZL i ZW. Na ekranie „Jednostki i magazyny” pokazuje to, czego jeszcze brak („Matcher widział magazyn 515 blacharnia czesci przy jednostce 3252 — dodaj”). Nic nie dodaje się samo.
- **Parser Matchera (M1, zrobione 2026-11-04):** przyczyną błędnych etykiet („VW”, „Seat”, „Mirror”) był błędny _kod_ magazynu. Gdy w nagłówku bloku nie było linii „Magazyn N”, parser brał pierwszą liczbę 115/315/415/515 z dowolnego tekstu, np. z „ZW/415/26/3142” albo „BLWK/115”. Taki fałszywy 415 robił ze zwykłego bloku blok lustrzany. Teraz blok należy do sekcji otwartej ostatnią linią „Magazyn N (nazwa)” nad nim. Gdy takiej linii nie ma, kod zostaje pusty, bez zgadywania. Nowe pola bloku: `warehouse_name`, `dealer_name`, `reservation_change` (wszystkie pozycje mają operację ZR) i `reservation_change_lines`. Dotyczy tylko nowych sesji; stare bloki w bazie mają stare wartości. Kopia parsera w `apps/public-web` nie została zmieniona.

### U2: zrobione 2026-11-04 (wariant A)

Decyzja: magazyn AS **nie wchodzi do salda regału**. Jest osobnym saldem własności „magazyn × część” (`inventory_warehouse_stock`, historia w `inventory_warehouse_ledger`). Działa jak w AutoStacji, która w ogóle nie zna regałów. Silnik księgowania, rozlokowanie, kontenery i przenoszenie zostały bez zmian. Wariant B (magazyn w każdym saldzie regału) wymagał przepisania 25 funkcji naraz.

- **Skąd saldo:** trigger na księdze stanu (`inventory_stock_ledger_entries`, pole `on_hand`) przenosi każdy efekt ruchu na magazyn linii. PZ dodaje, RW, KPZ i różnice inwentaryzacji odejmują, a storno odwraca. MM 801 i rozlokowanie dają zero.
- **Magazyn linii:**
  - PZ z Matchera: ustala go serwer z sesji. Bierze magazyn z dokumentu (blok marki dopasowany do WDD, inaczej blok BC). Gdy go brak, bierze magazyn domyślny jednostki z ZW. Gdy i tego brak, linia zostaje bez magazynu.
  - Rezerwacja dziedziczy magazyn linii PZ (oraz rezerwacji, z której ją przeniesiono).
  - RW bierze magazyn rezerwacji zlecenia.
  - Storno wraca do magazynu oryginału.
  - Magazyn innego oddziału jest odrzucany.
- **Widok:** karta towaru ma sekcję „Magazyny AutoStacji”: jednostka, magazyn, ilość oraz „Bez magazynu”. Szczegóły dokumentu mają kolumnę „Magazyn”, gdy którakolwiek linia ma magazyn.
- **Bez magazynu zostają:** stan sprzed U2 (migracja dopiero po raporcie i akceptacji), ręczne PZ, MMJ 303/305, ruchy 311/312, 122/551 oraz RW z przydziału bez rezerwacji z magazynem. Szkic zapisany i ponownie zapisany w edytorze traci magazyn linii (edytor go jeszcze nie przenosi). Księgowanie „Utwórz PZ” z Matchera działa jednym wywołaniem, więc tego nie dotyczy.
- Migracje: `20261104170000_warehouse_stock_u2.sql` i `20261104170100_warehouse_stock_u2_reset.sql` (reset danych demo). Test: `147_warehouse_stock_u2_test.sql`.

## 10. Pytania otwarte

1. Wzór „pierwsza cyfra magazynu = jednostka” jest **możliwy, niepotwierdzony**. Ambra go **nie zakłada**: przypisanie magazynu do jednostki zawsze idzie z konfiguracji. Wzór służy tylko do podpowiedzi przy dodawaniu („515 wygląda na Seat 3252”).
2. Kto ma dostać `warehouse.structure.manage` poza ownerem: kierownik magazynu, admin oddziału?

## 11. Wpływ na ruchy, lokalizacje i resztę

Zasada: **żaden etap nie zmienia zachowania istniejących ruchów, zanim nie dostanie własnych testów.** Każdy etap kończy się testami pgTAP na wszystkich typach ruchów, a nie tylko na nowych.

**Lokalizacje (regały, strefa przyjęć, kontenery): bez zmian.** Należą do oddziału i opisują, gdzie część leży fizycznie. Jeden regał może mieć części wielu magazynów i jednostek, bo tak jest w rzeczywistości. Kontener zlecenia też zostaje, jak jest.

**Co się zmienia w kolejnych etapach:**

| Obszar                             | U1 (konfiguracja)                                      | U2 (magazyn w stanie)                                                                                                     | U3–U4 (ruchy)                                                                                    |
| ---------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Stany, D / R / B                   | bez zmian                                              | każda pozycja stanu ma magazyn AS; dotychczasowy stan trafia do magazynu domyślnego (migracja); sumy per oddział jak dziś | —                                                                                                |
| PZ (101)                           | bez zmian                                              | linia dostaje magazyn: z nagłówka bloku Matchera albo magazyn domyślny                                                    | —                                                                                                |
| Rezerwacje / kontenery (REZ / KON) | bez zmian                                              | rezerwacja dziedziczy magazyn linii PZ, z której powstała                                                                 | —                                                                                                |
| Rozkładanie                        | bez zmian                                              | przenosi część z jej magazynem (zmienia regał, nie magazyn)                                                               | —                                                                                                |
| RW (261), storno, korekty          | bez zmian                                              | wydaje lub cofa z magazynu rezerwacji                                                                                     | —                                                                                                |
| MM (801)                           | bez zmian                                              | jak dziś: zmiana regału w tym samym magazynie                                                                             | dochodzi zmiana magazynu w obrębie jednostki (315 → 316), od razu                                |
| MMJ- / MMJ+ (303 / 305)            | bez zmian                                              | zostaje między oddziałami, jak dziś                                                                                       | adresatem jest jednostka i magazyn, także w tym samym oddziale; „w drodze” i przyjęcie bez zmian |
| ZW                                 | bez zmian                                              | linia ZW ma magazyn                                                                                                       | rozpoznawanie odbiorcy po jednostce zamiast `external_codes`                                     |
| Inwentaryzacja                     | bez zmian                                              | liczenie per regał jak dziś; różnice księgowane do magazynu domyślnego albo wybranego                                     | —                                                                                                |
| Import zleceń                      | jednostka z ZW + magazynu, nie z ZL; lepsze komunikaty | —                                                                                                                         | —                                                                                                |

**Ryzyka i jak je ograniczamy:**

- **U2 dotyka silnika księgowania** (`inventory_finalize_posting_internal`, salda, księga). Dlatego magazyn wchodzi jako kolumna z wartością domyślną, a wszystkie istniejące funkcje działają dalej na magazynie domyślnym, dopóki ich nie przełączymy. Każdy typ ruchu przełączamy osobno, z testem.
- **MMJ już działa** (sekcja 9 w `INTERNAL_ORDERS_PLAN.md`). W U2 się nie zmienia. W U4 dochodzi tylko nowy adresat, a dotychczasowy przebieg między oddziałami zostaje i ma swoje testy (142).
- **Migracja stanu:** przed U2 robimy raport „co trafi do jakiego magazynu”: według ZW lub magazynu z dokumentów, z których powstały rezerwacje, a resztę do magazynu domyślnego jednostki. Uruchamiamy ją dopiero po Twojej akceptacji.
