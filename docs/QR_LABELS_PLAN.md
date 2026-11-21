# Kody QR i etykiety — plan przebudowy

> Cel: użytkownik nigdy nie generuje tokenów ręcznie. Przypisanie kodu QR samo tworzy token, Generator etykiet QR służy tylko do szablonów i druku, a tokenami zarządza się w jednej tabeli z automatycznym wygasaniem nieużytych kodów.
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                             | Status                            |
| ---- | -------------------------------------------------- | --------------------------------- |
| Q1   | Tabela kodów QR, skany, partie, wygasanie          | ✅ wdrożone (#590), cron włączony |
| Q2   | Przypisywanie QR wszędzie bez ręcznego generowania | ✅ wdrożone (#590)                |
| Q3   | Generator etykiet QR: szablony + druk              | ✅ wdrożone (#591)                |
| Q4   | Sprzątanie starego kodu                            | 🟡 PR otwarty                     |

- [x] **Q1** — tabela kodów QR, skany, partie, wygasanie (PR 1)
  - [x] Migracja: `qr_codes.batch_id`, `last_scanned_at`, `scan_count`, `expired_at`, `unused_since`; status `expired`; indeksy (`20261121140000_qr_codes_registry`)
  - [x] Migracja: tabele `qr_label_layouts` (niezmienne, hash) i `qr_print_batches` (org, layout, szablon, liczba, kto, kiedy) + RLS
  - [x] Ustawienie organizacji: wygasanie nieużytych kodów po X dniach (domyślnie 180, 0 = wyłączone)
  - [x] Rejestrowanie skanu: `/qr/[token]`, skaner w aplikacji, putaway → `last_scanned_at` + `scan_count` (RPC, bez blokowania odpowiedzi)
  - [x] Funkcja SQL `qr_expire_unused_codes()`: nieprzypisane + nigdy nie skanowane + starsze niż X dni → `expired`; po kolejnych 90 dniach usunięcie
  - [x] pg_cron raz na dobę + instrukcja włączenia (`docs/QR_CODES_CRON_SETUP.md`, włączenie ręczne)
  - [x] Skan wygasłego kodu → ekran „kod wygasł” zamiast błędu
  - [x] Strona „Organizacja → Kody QR” (przeniesiona `/dashboard/kody-qr`, wpis w sidebarze, routing pl/en)
  - [x] Tabela: token, status, przypisanie (link do obiektu), partia, utworzony, ostatni skan, liczba skanów
  - [x] Filtry: nieprzypisane, nieużywane od X dni, wygasłe, unieważnione, partia
  - [x] Akcje zbiorcze: unieważnij, usuń (tylko nieprzypisane), dodrukuj
  - [x] Usunięcie formularza „Generuj N tokenów” z tabeli
  - [x] Testy (serwis, RPC skanu, wygasanie, akcje), i18n pl/en
  - [ ] Test ręczny na deployu

- [x] **Q2** — przypisywanie QR bez ręcznego generowania (PR 2)
  - [x] Wspólny komponent „Przypisz kod QR”: domyślnie tworzy i przypisuje, druga opcja „Zeskanuj naklejoną etykietę”
  - [x] Lokalizacje, zgłoszenia, zadania — na wspólny komponent (kontenery miały już jedno kliknięcie + skan; ich druk w Q4)
  - [x] Zgłoszenia i zadania: „Drukuj etykietę” w sekcji QR (dodruk przy obiekcie, jak w lokalizacjach)
  - [x] Formularze nowego zgłoszenia i zadania: bez przycisku „Generuj”, kod tworzony przy zapisie (chyba że zeskanowano etykietę)
  - [x] Zbiorcze tworzenie kodów jednym insertem (`QrCodesService.createBatch`) zamiast N zapytań
  - [x] Testy, i18n pl/en
  - [ ] Test ręczny na deployu

- [x] **Q3** — Generator etykiet QR: szablony + druk (PR 3)
  - [x] Migracja `20261122090000_qr_label_templates`: tabela `qr_label_templates` (nazwa, typ obiektu, `layout_id`, domyślny) + RLS; FK `qr_print_batches.template_id`; `qr_label_layout_ensure()`; `qr_label_template_set_default()`
  - [x] Przeniesienie `warehouse_location_label_settings` do szablonu domyślnego dla lokalizacji (ustawienia magazynu edytują teraz ten szablon)
  - [x] Narzędzie „QR Label Generator” (slug `qr-generator` bez zmian, nowa nazwa i opis w `tools_catalog`)
  - [x] Lista szablonów: utwórz, edytuj w projektancie, duplikuj, usuń, ustaw domyślny
  - [x] Druk: wybór szablonu + liczba etykiet → tokeny tworzone przy wydruku jako jedna partia (`/api/qr/print`, maks. 500)
  - [x] Każdy wydruk (nowy i dodruk) zapisuje layout w `qr_label_layouts` (lub znajduje istniejący po hashu) i rekord w `qr_print_batches`; `last_print_batch_id` na kodach
  - [x] Dodruk: „Jak poprzednio” albo dowolny szablon (wybór nad projektantem)
  - [x] „Wydrukuj etykietę” przy obiekcie i w tabeli: układ z ostatniego wydruku → szablon domyślny typu → szablon ogólny → układ wbudowany
  - [x] Ponowne generowanie tego samego wydruku używa tych samych kodów (zakładka „Wydruki” → „Drukuj ponownie”)
  - [x] Podgląd w projektancie na przykładowym tokenie, bez zapisu w bazie (tryb edytora szablonu)
  - [x] Dodruk z tabeli kodów i druk etykiet lokalizacji korzystają z szablonów
  - [x] Testy, i18n pl/en
  - [ ] Test ręczny na deployu

- [ ] **Q4** — sprzątanie (PR 4)
  - [x] Kontenery: druk przez wspólny projektant (z szablonami dla kontenerów) zamiast `/api/qr/labels`, usunięcie starego endpointu
  - [x] Usunięcie `QrWorkspace` z narzędzia (Q3)
  - [x] Usunięcie formularza „Generuj N tokenów”, akcji `create-batch` i nieużywanych tłumaczeń
  - [x] Aktualizacja `apps/web/docs/QR_BARCODE_SYSTEM_PLAN.md` (nota o aktualnym stanie)

## Stan wyjściowy (przed Q1, 2026-11-21)

- Narzędzie `qr-generator` (katalog narzędzi, włączane per użytkownik) i strona `/dashboard/kody-qr` (poza sidebarem) pokazują ten sam `QrWorkspace`: formularz „generuj N tokenów” (maks. 50, osobny insert na token), lista, zaznaczenie, zakładka „Projekt” z `LabelDesigner`, eksport `/api/qr/export` (PDF/ZPL, maks. 200).
- Tokeny tworzą się już automatycznie w wielu miejscach: druk etykiet lokalizacji (`/api/warehouse/locations/export-labels`), kontenery, zgłoszenia (`createAndAssign`), pole `QrCodeStagingField` w formularzach zgłoszeń i zadań.
- Ręczne generowanie służy w praktyce tylko etykietom „in blanco”, które po naklejeniu skanuje się i przypisuje kreatorem `/dashboard/kody-qr/przypisz/[token]`.
- Aplikacja nie zapisuje skanów — nie da się dziś stwierdzić, który kod jest nieużywany.
- Domyślny układ etykiet lokalizacji siedzi w `warehouse_location_label_settings` (jeden `LabelConfig` na organizację).

## Decyzje

- **Tokeny nie są osobnym narzędziem ani serwisem.** Logika zostaje w `QrCodesService` / `QrAssignmentsService`; użytkownik widzi tylko tabelę kodów do zarządzania.
- **Tokeny powstają jako skutek akcji:** przypisania (Q2) albo wydruku pustych etykiet (Q3).
- **Nieużyte kody sprzątamy przez wygasanie (opcja 1),** nie przez tokeny bez wierszy w bazie. Koszt w bazie to ok. 250 B na kod, więc problem jest porządkowy, nie wydajnościowy. Przejście na zakresy podpisanych tokenów jest możliwe później bez zmiany UI.
- **Wygasa tylko kod nieprzypisany i nigdy nie zeskanowany.** Kody przypisane nie wygasają; żeby je usunąć, trzeba je najpierw unieważnić.
- **Slug narzędzia `qr-generator` zostaje,** żeby nikt nie stracił włączonego narzędzia.
- **Layouty są osobną, niezmienną tabelą** (`qr_label_layouts`, deduplikacja po hashu). Szablon (Q3) = nazwa + wskazanie na aktualny layout; edycja szablonu tworzy nowy layout. Każdy wydruk wskazuje `layout_id` (i `template_id`), a kod pamięta ostatni wydruk (`qr_codes.last_print_batch_id`). „Wydrukuj etykietę” bierze układ: ostatni wydruk kodu → domyślny szablon typu obiektu → domyślny szablon organizacji, i otwiera projektant z nim. Na etykiecie zapisane są pola, nie tekst — wartości są z aktualnych danych.
- **Dodruk etykiet istniejących kodów:** przy samym obiekcie (lokalizacja, kontener, zgłoszenie, zadanie) oraz zbiorczo w tabeli Organizacja → Kody QR. Generator etykiet nie zajmuje się dodrukiem.
- Uprawnienia bez zmian: `qr.read`, `qr.create`, `qr.assign`, `qr.export`, `qr.revoke`.

## Otwarte pytania

- Czy usuwanie wygasłych kodów ma być twarde (DELETE), czy zostawiamy wiersz z `deleted_at` na zawsze dla audytu?
- Czy Generator etykiet ma dalej wymagać włączenia w Narzędziach, czy być dostępny dla wszystkich z `qr.export`?
