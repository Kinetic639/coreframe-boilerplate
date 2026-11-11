# Produkty: Zoho + komponenty Kolor Sensu

Rzeczywisty widok: `/dashboard/magazyn/produkty` (PL), `/en/dashboard/warehouse/items` (EN). Podgląd aplikacji na porcie 3001. HTML z portu 4313 pozostaje archiwum propozycji, nie aktualną implementacją.

## Zaimplementowany zakres

Tabela korzysta z oryginalnego `DataTable`, `ColumnsMenu`, `ColumnResizer`, `TableRow`, `FilterBar`, Radix Popover/Tooltip oraz menu wiersza z Kolor Sensu. Panel korzysta z oryginalnej animacji GSAP, zakładek i komponentów właściwości. Pochodzenie oraz szczegóły zachowań opisuje [README komponentów](../../../src/components/kolor-sensu/README.md).

Wygląd tabeli odpowiada wybranemu kierunkowi D: fotografie lub jawne placeholdery, czytelne nazwy, spokojne poziome podziały i kompaktowe wiersze. Akcenty korzystają z aktywnej palety Ambry. Nie narzucamy czerwieni Zoho ani zieleni Kolor Sensu. Menu przenoszone przez Radix do `body` używają tych samych aliasów motywu.

Na desktopie pierwsza i ostatnia kolumna są przypięte. Ostatnia zawsze zawiera menu wiersza, a nagłówek ustawienia kolumn. Widoczność, kolejność i szerokość są zapisane w cookies na rok, osobno dla zalogowanego użytkownika i organizacji; odczyt serwerowy odtwarza je po reload. Kolejność pól w menu filtrów podąża za kolumnami. Te ustawienia nie synchronizują się między urządzeniami.

Na telefonie produkty są zwartą listą z miniaturami, menu każdego rekordu i tym samym wyborem kolumn. Widoczne pola i ich kolejność pochodzą z tej samej zapisanej konfiguracji. Szczegóły otwierają się jako ekran z zamknięciem i zakładkami, zachowując URL. Na desktopie panel pozostaje obok tabeli przy szerokości od 1280 px, poniżej nakłada się na listę zgodnie z wzorcem źródłowym.

Zachowano eksport CSV, import, tworzenie, edycję, pełną kartę, warianty oraz filtry i kolumny pól własnych. Wielokrotny wybór statusu/typu jest wykonywany w zapytaniach bazodanowych. Wyszukiwanie obejmuje nazwę oraz SKU. Stare adresy DataView są przekształcane do nowego kontraktu bez utraty wybranego rekordu i pól własnych, także ze znakiem `%`.

Uprawnienia odczytu i zarządzania są nadal sprawdzane po stronie serwera. Widok korzysta z rzeczywistych danych organizacji i oddziału. Nie tworzy fikcyjnych produktów ani zdjęć. Gdy produkt nie ma zdjęcia w bazie, pokazuje zarezerwowane miejsce z ikoną.

## Granice i kolejne pomiary

Sortowanie jest aktywne dla pól obsługiwanych poprawnie przez serwer: nazwa, typ, status i data aktualizacji. Nagłówki ilości i SKU nie udają sortowania: dotychczasowy backend sortował je po dacie aktualizacji. Globalne sortowanie po agregowanych stanach wymaga osobnego rozwiązania zapytań; nie zastępujemy go sortowaniem tylko bieżącej strony.

Lista jest renderowana na serwerze jak w Kolor Sensu, bez dodatkowego klientowego `QueryClient` tworzonego przez dawny DataView. Nie jest to deklaracja zmierzonego przyspieszenia API: dotychczasowe wzbogacanie rekordów nadal wykonuje kilka zapytań. Następny pomiar powinien objąć większy katalog, zimne/ciepłe wejście i zmianę oddziału.

## Weryfikacja

- Testy kontraktu URL: migracja, wielokrotne filtry, nieprawidłowe parametry, znak `%`, zamknięcie wybranego wariantu bez utraty listy.
- Testy serwisu: wielokrotny status/typ w obu trybach grupowania i zakres organizacji. Po scaleniu `origin/main` zachowano jego wyszukiwanie po SKU, kodzie kreskowym i nazwie wariantu oraz neutralizację znaków specjalnych w zapytaniach.
- **20/20 testów** w trzech plikach: kontrakt URL, nowe filtry serwisu oraz istniejące testy produktów. TypeScript, ESLint i formatowanie sprawdzone.
- Test przeglądarkowy na 79 produktach organizacji demo potwierdził: filtry wielokrotne i usuwanie etykiet, wyszukiwanie po rzeczywistym SKU, ukrywanie kolumn, przeciąganie klawiaturą i myszą oraz szerokości. Układ i szerokości odtworzono po pełnym reload. Sprawdzono URL szczegółów, zakładki, reload i Wstecz/Dalej.
- Sprawdzono kolory portali filtrów w **15 paletach × jasny/ciemny**. Obejrzano zrzut ciemnego motywu Amethyst. To kontrola integracji kolorów, nie pełny audyt kontrastu WCAG.
- Mobilna lista, menu kolumn i otwieranie/zamykanie szczegółów przeszły przy **320, 360, 390 i 430 px**, bez poziomego przepełnienia dokumentu. Test wykrył i pozwolił poprawić zasłanianie przycisku zamknięcia przez nagłówek aplikacji. Desktop sprawdzono przy 1440×900.
- Sprawdzono hashe 15 plików i zgodność ich struktury kodu z projektem źródłowym po pominięciu formatowania, komentarzy i nawiasów dodawanych przez formatter. Projekt Kolor Sensu pozostał bez zmian.
- W testowanych przepływach nie było błędów JavaScript. Konto: właściciel organizacji demo. Nie zmieniano uprawnień ani danych produktów.

Checkboxy końcowego odbioru pozostają otwarte do oceny użytkownika oraz przejścia całej definicji odbioru widoku.

## Integracja z aktualnym main

Scalono `origin/main` na commicie `08428e6d`. Nowy widok zachowuje również kolumny zarezerwowanych i zablokowanych ilości oraz `ItemStockPanel` z rozbiciem według lokalizacji. Panel lokalizacji i operacje magazynowe respektują uprawnienie `warehouse.inventory.read` i uprawnienia operacyjne źródłowego komponentu. Pozostałe widoki otrzymały najnowszą implementację DataView z main. Po scaleniu przeszły 104 testy w dziesięciu plikach obejmujących produkty, DataView, wyszukiwanie i nawodnienie szczegółów wariantów.
