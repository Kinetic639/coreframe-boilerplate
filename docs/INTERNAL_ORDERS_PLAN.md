# Zamówienia wewnętrzne (ZW) i widok magazynu w zleceniu — plan

Status: **wdrożony (E1–E4), do sprawdzenia** · 2026-10-21 · gałąź `requests-portal`

Plan dodaje do Ambry zamówienia wewnętrzne (ZW) jako ogniwo między zleceniem a częściami oraz przebudowuje widok zlecenia na wzór zakładek „Pozycje” i „Magazyn i Zam.” z DMS AutoStacja. Wszystko, co o AutoStacji opisano poniżej, pochodzi z opisu użytkownika i jego zrzutów ekranu z 21.10.2026. O AutoStacji nie zakładamy nic ponad to.

---

## 1. Jak to działa w AutoStacji (wg użytkownika)

- Istnieją **zamówienia wewnętrzne lub klienta (ZW)** oraz **zamówienia do dostawcy (WDD)**.
- Zamówienie części do zlecenia tworzy się ze zlecenia („utwórz ZW”). ZW jest powiązane ze zleceniem, a **pod jednym zleceniem może być wiele ZW**, bo mechanicy i blacharze stale dochodzą z dodatkami i brakami.
- Część dostępną na miejscu od razu rezerwuje się pod ZW. Część dostępną na innym oddziale rezerwuje się u nich, a oddział dostaje maila z prośbą o wysyłkę. Oddział wysyła dokument przesunięcia, a my przyjmujemy go u siebie.
- Raz albo dwa razy dziennie tworzy się zamówienie do dostawcy (WDD), które zbiera wszystkie niewysłane ZW. Łańcuch wygląda tak: **ZL ← ZW ← WDD**. Dzięki niemu wiadomo, pod co część jest zarezerwowana i skąd, oraz co już jest na miejscu.
- ZW może też istnieć **bez zlecenia**, na stronie „Zamówienia klienta”. Tak zamawia się części dla innych oddziałów: oddział, któremu brakuje do celu sprzedażowego, dostaje od innego działu maila z listą części i numerem ich zlecenia. Zakłada się ZW, zaznacza, że to zamówienie wewnętrzne, a jako klienta wpisuje oddział, który zamawia.
- W dokumentach SVWMS takie ZW ma w polu uwag kod oddziału docelowego (WYSOG = Wysogotowo, GOLEZ = Gołężycka) i nie ma ZL.
- Części z takiego ZW od razu z przyjęcia jadą na swój oddział.
- Jedno ZW może przyjść w kilku dostawach. W AutoStacji całe ZW jest jednym dokumentem, ale **dokument SVWMS pokazuje tylko to, co przyszło**, więc Ambra zna wyłącznie przyjęte pozycje.

Zakładka zlecenia „Magazyn i Zam.” w AutoStacji:

- u góry sekcja **Magazyn**: dokumenty magazynowe zlecenia (np. WU(315)) i obok pozycje wybranego dokumentu;
- u dołu sekcja **Zamówienia**: ZW zlecenia (numer, data wystawienia, termin) i obok pozycje wybranego ZW ze statusami Z (zamówione), W (wydane), A (anulowane), R (zarezerwowane), z ilością, ilością R i ilością W. Kolumna G jest pomijana.
- statusy to kwadraty w kolumnach Z/W/A/R: **zamalowany** = spełnione, **zamalowany do połowy po skosie** = spełnione częściowo, pusty = nie dotyczy.

Zakładka „Pozycje” w AutoStacji: jedna lista wszystkich części zlecenia, czyli wydanych (źródło WU) i zamówionych, jeszcze niewydanych (źródło ZW), z dokumentem źródłowym i filtrem (np. „Do dyspozycji”). Kolumna R oznacza rezerwację (znaczenie wartości „M” nieznane).

## 2. Stan w Ambrze (21.10.2026)

- Zlecenia ZL mają pozycje. Rezerwacje (REZ), wydania (RW), kontenery i rozkładanie wiążą części **bezpośrednio z pozycją zlecenia**. Poziomu ZW nie ma.
- Matcher czyta bloki ZW (numer, ZL, klient, kod oddziału jako `manual_note`). Import przeskakuje jednak ZW i bierze tylko ZL.
- Blok ZW bez ZL z kodem oddziału jest od commitu `6c5302e5` domyślnie pomijany na PZ i pokazywany jako „Na inny oddział: <kod>”. To rozwiązanie tymczasowe.
- Moduł zamówień nie istnieje: strony Sprzedaż, Zamówienia sprzedaży, Zakupy, Zamówienia zakupu i Klienci to puste strony.
- Przesunięcie między oddziałami ma backend z IC-4 (`inventory_branch_transfers`, MM 311/312, stany przygotowane, w drodze, przyjęte). W interfejsie brakuje przycisku „Wyślij” i listy przychodzących.

## 3. Model docelowy

**Wariant (a), uzgodniony:** ZW i WDD nadal tworzy AutoStacja. Ambra zakłada swoje ZW z dokumentów SVWMS przy imporcie z Matchera albo ręcznie w zleceniu.

**ZW w Ambrze**

- własny numer Ambry **z kodem jednostki/magazynu**, tak jak w AutoStacji (3112, 3332…), w **tym samym układzie co AutoStacja**: `ZW/<nr>/<rr>/<magazyn>`, np. `ZW/1/26/3332`. Numeracja od 1, osobno dla każdego magazynu i roku. Numer Ambry i „ZW w AutoStacji” to osobne pola, więc się nie mieszają;
- pole **„ZW w AutoStacji”** (np. `ZW/1516/26/3332`), unikalne w organizacji, bo zawiera rok i magazyn. Ambra szuka po nim i nie tworzy drugiego ZW z tym samym numerem;
- klient: klient zlecenia albo oddział (kod oddziału z SVWMS, docelowo oddział z organizacji);
- opcjonalne powiązanie ze zleceniem ZL. Zlecenie może mieć wiele ZW;
- źródło: sesja Matchera albo ręczne założenie.

**Pozycje ZW**

- część, ilość, data i źródło dodania. Dopisanie to nowy wiersz, nic się nie nadpisuje;
- anulowanie (A) to wpis z datą, osobą i powodem, bez usuwania;
- pozycja ZW pod zleceniem wskazuje pozycję zlecenia, więc obecne rezerwacje, RW i rozkładanie działają bez przebudowy rdzenia.

**Ślad dokumentów (audit trail)**

- każde przyjęcie (PZ), rezerwacja (REZ), wydanie (RW) i wysyłka (MM) pod pozycję ZW to osobny wiersz: dokument, ilość, data. Wzór to dzisiejsze `repair_order_line_movement_links`;
- ilości i statusy Z/R/W/A są liczone z tych wierszy, nie przechowywane;
- przykład: ZW z AutoStacji 481 przychodzi 21.10 (5 części) i 22.10 (15 części). W Ambrze jest jedno ZW z dwiema dostawami (PZ/000001 + REZ/000001 oraz PZ/000002 + REZ/000002), a przy każdej pozycji widać, kiedy i na którym PZ przyszła.

**Status Z (zamówione)** zaznaczają tylko ZW założone w Ambrze (etap E3), bo wtedy Ambra wie, co zamówiono. ZW powstałe z dokumentów SVWMS przy PZ **nie mają zaznaczonego Z** i pokazują tylko rezerwacje (R), wydania (W) i anulowania (A). Ambra nie zna pozycji takiego ZW, które jeszcze nie przyszły, więc interfejs nie przedstawia go jako kompletnego zamówienia („Przyjęte pod ZW…: N pozycji”).

**Kwadraty statusów**, jak w AutoStacji: pełny = spełnione (np. cała ilość zarezerwowana), połowa po skosie = częściowo, pusty = nic.

## 4. Przebiegi

1. **Import z Matchera:** każdy blok ZW znajduje albo zakłada ZW (po „ZW w AutoStacji”) i dopisuje nowe pozycje. Blok z ZL zostaje podpięty pod zlecenie (zakładane jak dziś). Blok z kodem oddziału daje ZW dla oddziału, bez zlecenia.
2. **Zaksięgowanie PZ:** części są rezerwowane pod pozycje ZW, jeden REZ na każde ZW w danym PZ. Do wolnych idzie tylko to, czego nie ma na żadnym ZW.
3. **Nowe ZW ze zlecenia:** lista części, numer z AutoStacji od razu albo później. Dostępne części od razu są rezerwowane z magazynu. Późniejsza dostawa z tym numerem dołącza do tego ZW.
4. **Wydanie RW:** jak dziś, z informacją o ZW.
5. **ZW dla innego oddziału:** ze strefy przyjęć „Wyślij na oddział” (MM 311). Oddział docelowy przyjmuje MM 312.
6. **Rezerwacja na innym oddziale:** prośba do oddziału, który rezerwuje u siebie (stan „przygotowane”) i wysyła.

## 5. Widoki

- **Zlecenie → Pozycje:** lista wszystkich części ze wszystkich ZW i wydań. Kolumny: kwadraty statusów Z/R/W/A, ilości i dokument źródłowy (ZW albo RW, klikalny). Filtry: do dyspozycji, brakujące, wydane. **Tylko ilości, bez cen.**
- **Zlecenie → Magazyn i zamówienia (nowa zakładka):** u góry dokumenty magazynowe (PZ, REZ, MM, RW) z pozycjami wybranego dokumentu, u dołu ZW zlecenia z pozycjami wybranego ZW: kwadraty Z/R/W/A (pełny, połowa po skosie, pusty) oraz ilość, ilość R, ilość W. Przyciski „Nowe ZW” i „Zarezerwuj z magazynu”. Obecna zakładka Dokumenty wchodzi w tę zakładkę, a Historia zostaje.
- **Magazyn → Zamówienia wewnętrzne:** lista w miejscu pustej strony „Zamówienia sprzedaży”, z filtrami (pod zlecenie, dla oddziału, otwarte) i szczegółem ZW.
- **Strefa przyjęć i rozkładanie:** części pogrupowane po ZW. ZW dla oddziału ma przycisk „Wyślij”, a jego części nie idą na półki.
- **Import PZ:** raport pogrupowany po zleceniach i ZW.

## 6. Etapy

| Etap | Zakres                                                                            | Rozwiązuje                                           |
| ---- | --------------------------------------------------------------------------------- | ---------------------------------------------------- |
| E1   | Model ZW, import z Matchera, rezerwacja pod ZW przy PZ, testy pgTAP               | WYSOG/GOLEZ na PZ i zarezerwowane, ślad ZL ← ZW ← PZ |
| E2   | Zakładki Pozycje i Magazyn i zamówienia w zleceniu, lista ZW w Magazynie          | widok jak w AutoStacji                               |
| E3   | Nowe ZW ze zlecenia, rezerwacja z magazynu pod ZW, anulowanie pozycji             | dodatki mechaników i blacharzy                       |
| E4   | Kody oddziałów, wysyłka MM 311, przychodzące MM 312, rezerwacja na innym oddziale | przesunięcia między oddziałami                       |

Istniejące dane: ZW da się odtworzyć z bloków zapisanych w sesjach Matchera. Na demo wystarczy reset.

## 7. Decyzje i pytania

Ustalone:

- Wariant (a): ZW i WDD tworzy AutoStacja, Ambra odwzorowuje (2026-10-21).
- Jedno ZW Ambry na jedno ZW z AutoStacji, dostawy jako PZ i REZ podpięte pod nie. Nic się nie nadpisuje (2026-10-21).
- R = rezerwacja, kolumna G jest pomijana (2026-10-21).
- W Ambrze na razie tylko ilości, bez cen (2026-10-21).
- Zakładka Pozycje zostaje jako suma wszystkich ZW i wydań ze statusami (2026-10-21).
- Statusy jako kwadraty: pełny, połowa po skosie, pusty (2026-10-21).
- Status Z tylko dla ZW założonych w Ambrze; ZW z PZ pokazują R/W/A (2026-10-21).
- Bez eksportów z AutoStacji (2026-10-21).
- Numer ZW w Ambrze zawiera kod jednostki/magazynu (2026-10-21).
- Znaczenie kolumn IZ/IW/IR/ILI/INZ/IDP w PDF-ach SVWMS pomijamy, do sprawdzenia po prezentacji (2026-10-21).
- Realizacja od razu, całość E1–E4 (decyzja użytkownika 2026-10-21, zmienia wcześniejsze „po prezentacji”).

- „3642” w odbiorcy „3642 Blacharnia Audi (83570)” to kod oddziału Wysogotowo (2026-10-21). Przy mapowaniu oddziałów (E4) oddział może mieć zarówno kod z pola uwag (WYSOG), jak i kod jednostki (3642).
- Numer ZW w Ambrze w układzie AutoStacji `ZW/<nr>/<rr>/<magazyn>`, od 1. AutoStacja jest już w tysiącach, więc numery się nie pomylą (2026-10-21).

Otwarte: brak.

## 8. Wdrożenie (2026-10-21)

Migracje (`apps/web/supabase-target/supabase/migrations`):

| Plik                                                  | Zakres                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `20261021120000_internal_orders_e1.sql`               | tabele `internal_orders`, `internal_order_lines`, `internal_order_line_movement_links`, `internal_order_counters`; `inventory_reservation_lines.internal_order_line_id`; numeracja `ZW/<nr>/<rr>/<magazyn>`; ZW z linii Matchera przy PZ; rezerwacja pod ZW; strefa przyjęć; widok `internal_order_line_status`; rozkładanie nie bierze części pod ZW jako wolnych |
| `20261021140000_internal_orders_e3.sql`               | `internal_order_create`, `internal_order_reserve_from_stock`, `internal_order_cancel_line`, `internal_order_set_external_number`; dostawa ZW założonego w Ambrze dołącza do zamówionej pozycji                                                                                                                                                                     |
| `20261021160000_internal_orders_e4.sql`               | `branches.external_codes`, `branch_set_external_codes`, `internal_order_ship` (MM 311), `internal_order_request_from_branch`, `internal_order_accept_transfer` (MM 312 pod ZW), `internal_order_stock_elsewhere`; W liczy wysłane                                                                                                                                  |
| `20261021180000_internal_orders_demo_reset.sql`       | reset demo usuwa ZW i przesunięcia (uruchomić w SQL Editorze — zawiera DELETE)                                                                                                                                                                                                                                                                                     |
| `20261021190000_internal_orders_warehouse_choice.sql` | `internal_order_open` = zakładanie ZW z wyborem jednostki (magazynu); `internal_order_create` wywołuje ją bez wyboru                                                                                                                                                                                                                                               |

Testy pgTAP: `apps/web/supabase/tests/140_internal_orders_test.sql` (E1), `141_internal_orders_operations_test.sql` (E3/E4).

Ustalenia wdrożeniowe:

- Część pod ZW zlecenia jest rezerwowana dalej dokumentem REZ zlecenia (`reference_type = 'repair_order'`, jeden na zlecenie na zdarzenie), a linia REZ wskazuje pozycję ZW. Na tym typie opierają się kontenery, rozkładanie i wydania, więc się nie zmienia. ZW bez zlecenia ma własny REZ (`reference_type = 'internal_order'`).
- ZW z dokumentów dostawy: jedna pozycja ZW na linię Matchera; ilość = przyjęta ilość. Ponowny import tej samej linii nie tworzy nowej pozycji.
- Nowa część w ZW zlecenia staje się nową pozycją zlecenia. Wybranie istniejącej pozycji nie zmienia jej ilości.
- Anulowanie pozycji ZW (A) nie zmienia pozycji zlecenia; zwalnia otwarte rezerwacje tej pozycji ZW (w kontenerze — odmowa).
- Wysyłka ZW na oddział: rezerwacje ZW są zwalniane i od razu idą na jedno przesunięcie (przygotowane → w drodze, MM 311). Oddział docelowy przyjmuje je w strefie przyjęć (MM 312).
- Oddział docelowy jest szukany po kodzie z pola uwag (np. WYSOG), a potem po numerze jednostki, od którego zaczyna się klient (np. 3642).

Widoki:

- Zlecenie → **Pozycje**: kwadraty Z/R/W/A i kolumna „Zamówienie” (ZW, klikalne).
- Zlecenie → **Magazyn i zamówienia**: dokumenty + pozycje, ZW + pozycje, przycisk „Nowe ZW”.
- Magazyn → **Zamówienia wewnętrzne**: lista, szczegół ZW z operacjami; „Nowe ZW bez zlecenia”. Strona „Zamówienia sprzedaży” przekierowuje tutaj.
- **Rozkładanie**: sekcja „Zamówienia wewnętrzne” z „Wyślij”, sekcje „Przychodzące z innych oddziałów” i „Do wysłania na inne oddziały”.
- **Ustawienia magazynu**: kody oddziałów.
- **Import PZ**: ZW bez zlecenia jako osobna grupa „ZW … dla: WYSOG”, wchodzi na PZ zarezerwowane.

## 9. Przesunięcia między jednostkami: MMJ- / MMJ+ (2026-10-28)

Ustalone z właścicielem produktu (na wzór AutoStacji, nazwy jak w AutoStacji):

- **MM** — przesunięcie w obrębie jednostki (magazyny, półki), od razu (801, bez zmian).
- **MMJ-** (kod 303) i **MMJ+** (kod 305) — przesunięcie do innej jednostki. W Ambrze jednostka = oddział, a kod jednostki to kod magazynu (`branch_warehouses`). Stany zostają liczone w obrębie oddziału.
- **„Nie — wstrzymaj”** — szkic: części zarezerwowane u nadawcy, nic nie wysłane, bez numeru, odbiorca nic nie widzi.
- **„Tak — wyślij w drogę”** — w drodze (odpowiednik POTEM): nic nie jest księgowane, części zostają na stanie nadawcy, zarezerwowane; oba dokumenty widać jako „w drodze” bez numeru. Nadawca może wycofać do zatwierdzenia.
- **Zatwierdzenie** przez odbiorcę (tylko w całości, bez „odrzuć”): w jednej operacji MMJ- zdejmuje części u nadawcy, MMJ+ wkłada je do strefy przyjęć odbiorcy; oba dostają numery `MMJ-/<nr>/<rr>/<jednostka>`, `MMJ+/…` (licznik na jednostkę i rok), MMJ+ wskazuje MMJ- jako dokument powiązany.
- Kody 311/312 (poprzedni przebieg, księgowany przy wysłaniu) są wyłączone. Przesunięcia wysłane wcześniej po staremu można tylko zatwierdzić (zaksięguje się samo MMJ+).

Gdzie: edytor ruchu (rodzaj MMJ-, odbiorca = oddział, dialog „wyślij w drogę / wstrzymaj”), lista ruchów i Rozlokowanie (sekcje: przychodzące MMJ+ w drodze, wysłane MMJ- w drodze, wstrzymane), wysyłka ZW z Rozlokowania i ze szczegółu ZW.

Migracja: `20261028120000_unit_transfers_mmj.sql`. Test pgTAP: `142_unit_transfers_mmj_test.sql` (141 zaktualizowany).
