# Ambra — kierunek UX i plan przebudowy

Research: 11 listopada 2026. Zakres: `apps/web`. Kierunek wizualny **czeka na wybór użytkownika**; nie rozpoczynamy masowej przebudowy.

Inwentaryzacja poniżej jest snapshotem kodu sprzed scalenia main (`be2bf1ca`). Aplikacja została następnie zaktualizowana do `08428e6d`; nowe strony dodane w main wymagają dopisania przed przebudową kolejnych modułów. Dla pilota produktów wybrano już kierunek D/Zoho z komponentami Kolor Sensu.

[Checklista desktop/mobile](VIEW_CHECKLIST.md) · [Inspiracje ze zrzutami ekranów](inspiration-board.html) · [Opis inspiracji i źródła](INSPIRATIONS.md) · [Manifest widoków](view-inventory.json)

Aktualny pilot wskazany przez użytkownika: **DataView i produkty**. [Analiza komponentu](dataview/ANALYSIS.md) · [Interaktywny prototyp sześciu kierunków](dataview/prototype.html) · [Galeria 24 ekranów](dataview/gallery.html). Podgląd z działającymi adresami i galerią wymaga lokalnego serwera prototypu na porcie 4313.

Wybrany kierunek: **tabela D/Zoho + oryginalne komponenty filtrów, menu i kolumn Kolor Sensu**. Aktualny wynik jest dostępny w aplikacji na `/dashboard/magazyn/produkty`, port 3001. [Opis implementacji i zachowań](dataview/IMPLEMENTATION.md). Prototyp HTML pozostaje materiałem porównawczym.

## Cel

Ambra ma działać jak zwarte narzędzie pracy ERP/CRM/WMS: czytelny kontekst organizacji i oddziału, szybkie odnajdywanie rekordów, przewidywalne akcje i mało zbędnych przejść. Preferowany przez użytkownika `dashboard/start` jest punktem odniesienia dla hierarchii informacji, akcentu marki, kompaktowych sekcji i priorytetu zadań operacyjnych. Nie traktujemy wszystkich jego obecnych zachowań jako już zweryfikowanego standardu.

„Jak aplikacja natywna” oznacza sposób obsługi: stałą nawigację, widoczne działania, listę i szczegóły, klawiaturę na desktopie oraz duże cele dotykowe i krótkie przepływy na telefonie. Sam redesign webowy nie zapewnia automatycznie pracy offline, natywnego dostępu do sprzętu ani funkcji systemowych.

## Wnioski z researchu

1. **Gęstość zależy od obsługi, nie tylko szerokości.** SAP rozróżnia kompaktowy układ dla myszy/klawiatury i większe obszary dotykowe. Zmniejszanie odstępów nie wymaga zmniejszania tekstu. [SAP — content density](https://www.sap.com/design-system/fiori-design-web/v1-120/foundations/visual/cozy-compact).
2. **Lista i szczegóły to podstawowy układ operacyjny.** Na dużym ekranie mogą być obok siebie; na telefonie szczegóły zastępują listę. Nie dzielimy każdego ekranu na trzy kolumny — tylko tam, gdzie istnieje relacja lista–obiekt. [SAP — flexible column layout](https://www.sap.com/design-system/fiori-design-web/v1-136/page-types/page-layouts/flexible-column-layout-web-component/).
3. **Pulpit prowadzi do pracy właściwej dla roli.** Powinien eksponować istotne zadania i wejścia do procesów. [Microsoft — role centers](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/developer/devenv-designing-role-centers).
4. **Tabela ma wspólny pasek narzędzi.** Wyszukiwanie, filtry, ustawienia i akcje zbiorcze powinny mieć przewidywalne miejsce; zaznaczenie rekordów uruchamia kontekst działań zbiorczych. [IBM Carbon — data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines).
5. **Mobilna lista jest osobnym układem zadaniowym.** Identyfikator, nazwa, stan i najważniejsze działanie są widoczne; filtrowanie i szczegóły nie wymagają przenoszenia całej tabeli desktopowej na mały ekran. [SAP iOS — list report](https://www.sap.com/design-system/fiori-design-ios/v26-1/page-types/list-report).
6. **Skanowanie jest krótkim przepływem do obiektu lub operacji.** Po rozpoznaniu kodu użytkownik powinien dostać czytelny wynik i następną akcję. Potrzebne są też stany nieznanego kodu, odmowy aparatu i ręczne wyszukiwanie. [SAP iOS — barcode scanner](https://www.sap.com/design-system/fiori-design-ios/v26-1/patterns/scan/barcode-scanner).
7. **Zwartość nie może uniemożliwiać obsługi.** WCAG 2.2 AA określa minimalny cel 24×24 CSS px z wyjątkami; dla głównych kontrolek dotykowych Ambry proponujemy wygodniejsze 44–48 px. Operacje przeciągania muszą mieć alternatywę bez przeciągania, gdy wymagają tego kryteria. [W3C — rozmiar celu](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [W3C — przeciąganie](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html).

Poniższe wartości i rozwiązania są **propozycją dla Ambry**, a nie obowiązkowymi wymiarami przepisanymi z cudzych produktów.

## Wspólny język widoków

### Desktop

- Mały nagłówek: nazwa widoku, kontekst, licznik wyników, główna akcja. Pomocniczy opis tylko wtedy, gdy wyjaśnia nietypową operację.
- Orientacyjnie: tytuł 18–20 px, tekst roboczy 14 px, tekst pomocniczy 12–13 px; wiersze tabel 32–40 px. Wartości do potwierdzenia na pilocie.
- Jedna dominująca akcja w danym kontekście; operacje mniej częste w menu z czytelnymi nazwami. Ikony bez podpisu tylko dla znanych funkcji i z dostępną etykietą.
- Pasek listy: wyszukiwanie, filtry, sortowanie, wybór widoku i akcje zbiorcze. Liczby wyrównane, jednostki jawne, status nie przekazany wyłącznie kolorem.
- Lista i szczegóły w dwóch obszarach, jeśli przyspiesza to porównywanie rekordów. Duża edycja lub wieloetapowy dokument otrzymuje pełny ekran.
- Filtry, wybrany rekord, pozycja listy i kontekst oddziału przetrwają przejście do szczegółów i powrót. Głębokie linki i przyciski przeglądarki działają.
- Klawiatura: logiczny Tab, widoczny fokus, Escape zamyka odpowiedni panel, Enter nie zatwierdza przypadkiem niebezpiecznej operacji. Skróty z opisem, bez kolizji z przeglądarką.

### Mobile

- Osobna kompozycja dla telefonu; nie pomniejszona wersja desktopu. Jedna główna treść na ekranie, krótki nagłówek i wyraźny powrót.
- Lista z krótkimi wierszami i najważniejszymi polami; szczegóły w osobnym ekranie lub pełnoekranowym panelu. Nie zamieniamy automatycznie każdego rekordu w wielką dekoracyjną kartę.
- Główne obszary dotyku 44–48 px. Formularze zwykle jedna kolumna, poprawna klawiatura numeryczna/mailowa i widoczne błędy pól.
- Filtry w panelu z widoczną liczbą aktywnych warunków i możliwością wyczyszczenia. Powrót do listy zachowuje stan.
- Pasek Zapisz/Anuluj lub Potwierdź nie może być zasłaniany klawiaturą, bezpiecznym obszarem ani nawigacją. Unikamy kilku nakładających się przyklejonych pasków.
- Drzewo lokalizacji: ścieżka/breadcrumbs, wejście do poziomu, wyszukiwanie i szczegóły. Alternatywa dla przeciągania: „Przenieś do…”.
- Mapy i Kanban mogą wymagać przewijania dwuwymiarowego; to świadomy wyjątek, z alternatywą listową tam, gdzie występuje operacyjnie.
- Nie dodajemy dolnej nawigacji z kilkunastoma modułami. Jej ewentualny zakres wybieramy po ustaleniu najczęstszych zadań mobilnych.

## Rodziny ekranów

- **Pulpit operacyjny:** priorytety, wyjątki, najbliższe działania; rozwijamy charakter `dashboard/start`.
- **Lista robocza:** produkty, stany, kontrahenci, kontakty, zgłoszenia, członkowie.
- **Obiekt i jego historia:** produkt, lokalizacja, osoba, zgłoszenie, zlecenie.
- **Dokument i proces:** ruch magazynowy, import, inwentaryzacja; status, postęp, pozycje i jawna finalizacja.
- **Planowanie:** kalendarz i tablica, z czytelnym zakresem dat/osób i równoważną obsługą bez przeciągania.
- **Konfiguracja:** ustawienia pogrupowane zadaniowo, edycja słowników, zapis i informacja o zakresie zmian.
- **Narzędzie specjalistyczne:** skanowanie, matcher, projektant etykiet, edytor mapy; własne środowisko pracy, ale wspólne nazwy akcji i zachowania.

## Kolejność prac — propozycja

1. Wybór inspiracji wizualnych. Następnie ustalenie minimalnego zestawu wspólnych zasad; bez masowego przepisywania aplikacji.
2. Pilot: DataView na produktach — lista, filtry, szczegóły i URL na desktopie oraz telefonie. Po wyborze kierunku i naprawie kontraktu danych przenosimy wzorzec na kolejne kartoteki. Lokalizacje obejmą dodatkowo drzewo, tworzenie/edycję, przeniesienie i QR; dane demo są dostępne w dwóch oddziałach.
3. Kartoteka produktów i stany; wspólny układ listy, filtrów i szczegółów.
4. Dokumenty/ruchy magazynowe, import, inwentaryzacja i mapy.
5. CRM, warsztat i Help Desk.
6. Planowanie, narzędzia i QR.
7. Organizacja, uprawnienia, konto, analityka i uwierzytelnianie.
8. Administracja, demonstracje oraz szkielety wymagające osobnych decyzji produktowych.

## Odbiór pojedynczego widoku

Checkbox urządzenia w [checkliście](VIEW_CHECKLIST.md) zaznaczamy po spełnieniu całego zestawu:

1. Nazwany cel i główne zadanie; użytkownik wie, gdzie jest i co może zrobić.
2. Działają odczyt, wyszukanie, filtry, przejście do szczegółów i operacja właściwa dla danego widoku, z powrotem bez utraty kontekstu.
3. Sprawdzone: ładowanie, brak danych, brak wyników, błąd, brak uprawnień, długie nazwy i większa liczba rekordów. Zapis, walidacja, niezapisane zmiany i potwierdzenia tam, gdzie występują.
4. Desktop: przynajmniej 1280×800 i 1440×900, mysz i klawiatura. Mobile: przynajmniej 360×800 i 390×844, sprawdzenie 320 px i 430 px oraz klawiatury ekranowej. Tablet/układ pośredni około 768 px jako kontrola dodatkowa.
5. PL i EN, jasny i ciemny motyw, długi tekst i powiększenie; brak przypadkowego poziomego przewijania całej aplikacji.
6. Konto właściciela i konto z ograniczonym dostępem; uprawnienia UI odpowiadają serwerowi. Konto bez dostępu nie dostaje aktywnych operacji. Obsługa zmiany oddziału i wejścia bezpośrednim URL-em.
7. Dowód: rozmiar ekranu, rola, krótki scenariusz, screenshot/krótkie nagranie, commit/PR i adekwatny test regresji przepływu. Brak nowych błędów konsoli i nieudanych żądań związanych z operacją.
8. Odbiór użytkownika. Test techniczny nie zastępuje oceny zrozumiałości i ergonomii.

## Granice inwentaryzacji

Manifest obejmuje wszystkie 113 bieżących plików `page.tsx` oraz 121 dodatkowych widoków, wariantów i stanów: 234 pozycje, 468 checkboxów. To przegląd statyczny kodu, nie deklaracja odwiedzenia każdego ekranu. Wersje językowe nie są osobnymi implementacjami. Dynamiczne rekordy reprezentowane są wzorcami tras. Dwa wejścia `/qr/[token]` mają osobne pliki: publiczny resolver i ekran lokalizowany.

W spisie są również strony ukryte przed zwykłymi kontami, demonstracje i szkielety. Nie zwiększamy uprawnień użytkowników, żeby je odwiedzić. Rzeczywisty zakres każdego modułu i jego warunki wejścia potwierdzamy przed przebudową. Zagnieżdżone warianty odkryte później dopisujemy do checklisty — nie zamykamy pozycji głównej z pominięciem podwidoków.

`apps/public-web`, `apps/vmi-client`, aplikacja mobilna, archiwum i katalog `temp` są poza zakresem tej listy. VMI jest odniesieniem branżowym, nie deklaracją istnienia wszystkich funkcji VMI w `apps/web`.
