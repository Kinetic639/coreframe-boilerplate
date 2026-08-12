# Ambra — lista funkcji proponowanych do prezentacji

## Cel dokumentu

Dokument zawiera funkcje, które warto uwzględnić w prezentacji Ambry. Na tym etapie nie określa jeszcze kolejności prezentacji, aktorów ani szczegółowego scenariusza.

## 1. Przyjmowanie i importowanie danych

### SVWMS Matcher - niezalogowany użytkownik

- Publiczne parsowanie i porównywanie dokumentów.
- Przetwarzanie dokumentów dostawy po zalogowaniu.
- Utworzenie dokumentu dostawy na podstawie wyniku matchowania.

### SVWMS Matcher - zalogowany użytkownik

- Przekazanie utworzonego dokumentu (z listą części przypisaną do zleceń) do dalszego procesu magazynowego.

## 2. Zlecenia i części

### Minimalne zlecenie warsztatowe

- Lista zleceń.
- Lista części przypisanych do zlecenia.
- Lokalizacja części.
- Historia operacji związanych ze zleceniem.
- Wyszukiwanie zleceń i części.
- Rejestrowanie wydania części.
- Cyfrowe archiwum dokumentów wydania.

### Części wolne

- Rejestrowanie części nieprzypisanych do zlecenia.
- Wyszukiwanie części wolnych.
- Przypisywanie części wolnej do zlecenia.
- Lokalizacja i historia części wolnej.

## 3. Przyjęcie i rozkładanie dostawy

- Lista części znajdujących się w dostawie (utworzona przez SVWMS Matcher)
- Grupowanie części przeznaczonych do jednego zlecenia.
- Oznaczenie pojedynczej części lub całego zestawu etykietą QR.
- Przypisanie części do miejsca składowania przez zeskanowanie ich etykiety i kodu lokalizacji.
- Wykrywanie części oczekujących na oznaczenie lub przypisanie lokalizacji.
- Obsługa części przypisanych do wielu zleceń lub mających lokalizację indywidualną.

## 4. Lokalizacje i identyfikacja QR

- Generowanie i drukowanie etykiet QR.
- Szybkie wyszukiwanie obiektu po zeskanowaniu kodu.
- Skanowanie etykiet części, zestawów, zleceń i lokalizacji.

## 5. Lokalizacje i identyfikacja QR

- Struktura lokalizacji magazynowych.
- Przenoszenie całego oznaczonego zestawu / zlecenia / mateiałów / pojedynczych części.
- Historia zmian lokalizacji.

## 6. Wydawanie części

- Wyszukiwanie wydań po zleceniu, części lub odbiorcy.

## 7. Tickety i komunikacja operacyjna

- Tworzenie różnych typów ticketów.
- Komunikacja doradca–dział części.
- Kolejka ticketów dla zespołu części.
- Przypisywanie i przejmowanie ticketów.
- Komentarze, wzmianki i historia aktywności.
- Powiązanie ticketu ze zleceniem, częścią lub oznaczonym zestawem części.
- Zwroty wymagające akceptacji kierownika.
- Powiadomienia e-mailowe i wewnętrzne.
- Tworzenie zadania na podstawie ticketu.

## 8. Audyty i inwentaryzacje

- Audyt według lokalizacji.
- Audyt według dostawcy.
- Rejestrowanie różnic.
- Historia audytów.
- Harmonogram audytów.
- Powtarzalne audyty.
- Generowanie propozycji uzupełnienia stanów.

## 9. Organizacja pracy

### Zadania

- Tworzenie zwykłych zadań.
- Zadania powiązane z ticketami.
- Zadania powiązane ze zleceniami.
- Przypisywanie odpowiedzialnych osób.
- Terminy i priorytety.
- Zadania powtarzalne.

### Kalendarz

- Zadania i audyty w widoku kalendarza.
- Terminy i zadania zaległe.
- Planowanie pracy zespołu.

### Tablice

- Organizacja pracy na tablicach Kanban.
- Tworzenie zadań z poziomu tablicy.
- Śledzenie postępu pracy.

### Procedury

- Baza procedur operacyjnych.
- Powiązanie procedury z zadaniem lub ticketem.
- Checklisty.
- Potwierdzanie wykonania lub zapoznania się z procedurą.

## 10. Zarządzanie zapasem

- Materiały zużywalne.
- Stany minimalne i docelowe.
- Raportowanie zmian wartości zapasu.
- Dostawcy i przypisane do nich materiały.

## 11. Dashboard operacyjny

- Nowe i pilne tickety.
- Akceptacje oczekujące na decyzję.
- Reklamacje i terminy.
- Zadania bieżące i zaległe.
- Dostawy oczekujące na rozłożenie.
- Części oczekujące na oznaczenie lub przypisanie lokalizacji.
- Niekompletne zlecenia.
- Materiały poniżej minimum.
- Części nierotujące.
- Przejście z każdej informacji bezpośrednio do działania.

## 12. Oddziały i zarządzanie organizacją

- Obsługa wielu oddziałów.
- Przełączanie aktywnego oddziału.
- Izolacja danych oddziałów.
- Widok zbiorczy dla kierownika lub dyrektora.
- Użytkownicy, zaproszenia i członkostwo.
- Role i uprawnienia.
- Ograniczanie operacji według roli i oddziału.
- Historia istotnych operacji.

## 13. Funkcje platformowe

- Rejestracja i logowanie.
- Bezpieczne zarządzanie sesją.
- Responsywność i obsługa urządzeń mobilnych.
- Obsługa skanowania QR telefonem.
- Powiadomienia e-mailowe i wewnętrzne.
- Historia aktywności.
- Kontrola dostępu i ochrona danych.

## 14. Możliwy dalszy kierunek produktu

- Komunikacja pomiędzy oddziałami.
- Rozbudowane zarządzanie częściami nierotującymi.
- Rozbudowana baza procedur i wiedzy.
- Konta zewnętrznych dostawców.
- Propozycje i akceptacje zamówień.
- VMI zintegrowane z magazynem.
- Rozbudowane raportowanie między oddziałami.

## 15. Inne dodatkowe funkcjonalności, warte wymienienia ale nie bezpośrednio wpływające na pracę

### Import z AutoStacji

- Import zleceń.
- Import części przypisanych do zleceń.
- Import wcześniejszych zamówień.
- Import części wolnych.
- Podgląd i weryfikacja danych przed zatwierdzeniem.
- Historia importów i ochrona przed duplikatami.

## Następny krok

Po zatwierdzeniu kompletności tej listy każda grupa zostanie oznaczona jako:

- funkcja główna prezentowana na żywo,
- funkcja dodatkowa prezentowana na żywo,
- funkcja tylko wspomniana,
- przyszła wizja produktu.
