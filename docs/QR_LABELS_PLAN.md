# Kody QR i etykiety — plan przebudowy

> Cel: użytkownik nigdy nie generuje tokenów ręcznie. Przypisanie kodu QR samo tworzy token, Generator etykiet QR służy tylko do szablonów i druku, a tokenami zarządza się w jednej tabeli z automatycznym wygasaniem nieużytych kodów.
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                             | Status          |
| ---- | -------------------------------------------------- | --------------- |
| Q1   | Tabela kodów QR, skany, partie, wygasanie          | ⬜ do zrobienia |
| Q2   | Przypisywanie QR wszędzie bez ręcznego generowania | ⬜ do zrobienia |
| Q3   | Generator etykiet QR: szablony + druk              | ⬜ do zrobienia |
| Q4   | Sprzątanie starego kodu                            | ⬜ do zrobienia |

- [ ] **Q1** — tabela kodów QR, skany, partie, wygasanie (PR 1)
  - [ ] Migracja: `qr_codes.batch_id`, `last_scanned_at`, `scan_count`, `expires_at`; status `expired`; indeksy pod filtry
  - [ ] Migracja: tabela `qr_print_batches` (org, szablon, liczba, kto, kiedy) + RLS
  - [ ] Ustawienie organizacji: wygasanie nieużytych kodów po X dniach (domyślnie 180, 0 = wyłączone)
  - [ ] Rejestrowanie skanu: `/qr/[token]`, skaner w aplikacji, putaway → `last_scanned_at` + `scan_count` (RPC, bez blokowania odpowiedzi)
  - [ ] Funkcja SQL `qr_expire_unused_codes()`: nieprzypisane + nigdy nie skanowane + starsze niż X dni → `expired`; po kolejnych 90 dniach usunięcie
  - [ ] pg_cron raz na dobę + instrukcja włączenia (jak `NOTIFICATIONS_CRON_SETUP.md`)
  - [ ] Skan wygasłego kodu → ekran „kod wygasł” zamiast błędu
  - [ ] Strona „Organizacja → Kody QR” (przeniesiona `/dashboard/kody-qr`, wpis w sidebarze, routing pl/en)
  - [ ] Tabela: token, status, przypisanie (link do obiektu), partia, utworzony, ostatni skan, liczba skanów
  - [ ] Filtry: nieprzypisane, nieużywane od X dni, wygasłe, unieważnione, partia
  - [ ] Akcje zbiorcze: unieważnij, usuń (tylko nieprzypisane), dodrukuj
  - [ ] Usunięcie formularza „Generuj N tokenów” z tabeli
  - [ ] Testy (serwis, RPC skanu, wygasanie, akcje), i18n pl/en
  - [ ] Test ręczny na deployu

- [ ] **Q2** — przypisywanie QR bez ręcznego generowania (PR 2)
  - [ ] Wspólny komponent „Przypisz kod QR”: domyślnie tworzy i przypisuje, druga opcja „Zeskanuj naklejoną etykietę”
  - [ ] Lokalizacje, kontenery, zgłoszenia, zadania — na wspólny komponent
  - [ ] Formularze nowego zgłoszenia i zadania: bez przycisku „Generuj”, kod tworzony przy zapisie (chyba że zeskanowano etykietę)
  - [ ] Zbiorcze tworzenie kodów jednym insertem (`QrCodesService.createBatch`) zamiast N zapytań
  - [ ] Testy, i18n pl/en
  - [ ] Test ręczny na deployu

- [ ] **Q3** — Generator etykiet QR: szablony + druk (PR 3)
  - [ ] Migracja: tabela `qr_label_templates` (nazwa, format PDF/ZPL, `LabelConfig`, domyślny, kontekst) + RLS
  - [ ] Przeniesienie `warehouse_location_label_settings` do szablonu domyślnego dla lokalizacji
  - [ ] Narzędzie „Generator etykiet QR” (slug `qr-generator` bez zmian, nowa nazwa i opis w `tools_catalog`)
  - [ ] Lista szablonów: utwórz, edytuj w projektancie, duplikuj, usuń, ustaw domyślny
  - [ ] Druk: wybór szablonu + liczba etykiet → tokeny tworzone przy wydruku jako jedna partia
  - [ ] Ponowne generowanie tego samego wydruku używa tych samych kodów (bez nowych tokenów)
  - [ ] Podgląd w projektancie na przykładowym tokenie, bez zapisu w bazie
  - [ ] Dodruk z tabeli kodów i druk etykiet lokalizacji korzystają z szablonów
  - [ ] Testy, i18n pl/en
  - [ ] Test ręczny na deployu

- [ ] **Q4** — sprzątanie
  - [ ] Kontenery: druk przez wspólny projektant zamiast `/api/qr/labels`, usunięcie starego endpointu
  - [ ] Usunięcie `QrWorkspace` z narzędzia i nieużywanych akcji
  - [ ] Aktualizacja `apps/web/docs/QR_BARCODE_SYSTEM_PLAN.md`

## Stan obecny (2026-11-21)

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
- Uprawnienia bez zmian: `qr.read`, `qr.create`, `qr.assign`, `qr.export`, `qr.revoke`.

## Otwarte pytania

- Czy usuwanie wygasłych kodów ma być twarde (DELETE), czy zostawiamy wiersz z `deleted_at` na zawsze dla audytu?
- Czy Generator etykiet ma dalej wymagać włączenia w Narzędziach, czy być dostępny dla wszystkich z `qr.export`?
