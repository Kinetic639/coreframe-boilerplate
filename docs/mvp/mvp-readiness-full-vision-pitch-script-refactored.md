# AMBRA — MASTER PITCH & PILOT SCRIPT

## Wersja po refaktoryzacji

---

# 1. Cel dokumentu

Ten dokument jest nadrzędnym planem prezentacji Ambry.

Nie jest już katalogiem wszystkich funkcji systemu.

Jego zadaniem jest odpowiedzieć na pięć pytań:

1. **Czym właściwie jest Ambra jako produkt?**
2. **Które elementy powstały specjalnie dla obecnego środowiska pracy?**
3. **Co należy pokazać podczas prezentacji?**
4. **Co dokładnie chcemy sprawdzić podczas pilotażu?**
5. **Które funkcje są potencjalnym kierunkiem dalszego rozwoju, ale nie powinny rozszerzać zakresu pilota?**

Najważniejszym celem prezentacji nie jest udowodnienie, że Ambra ma bardzo dużo funkcji.

Celem jest pokazanie, że:

> Ambra osiągnęła poziom, na którym można przestać rozwijać ją wyłącznie jako projekt i rozpocząć kontrolowane testowanie w rzeczywistym środowisku pracy.

---

# 2. Główna narracja prezentacji

Cała prezentacja powinna opowiadać jedną historię:

**PROBLEM**

↓

**AMBRA**

↓

**RZECZYWISTY PROCES MAGAZYNOWY**

↓

**DOSTAWA**

↓

**PRZYJĘCIE**

↓

**LOKALIZACJA**

↓

**WYSZUKANIE**

↓

**WYDANIE**

↓

**OBSŁUGA WYJĄTKÓW**

↓

**SYSTEM JEST GOTOWY DO TESTÓW PRODUKCYJNYCH**

↓

**PILOT**

↓

**FEEDBACK I ITERACJE**

↓

**DALSZY POTENCJAŁ**

↓

**PROŚBA O WSPARCIE I FINANSOWANIE**

Prezentacja nie powinna wyglądać jak:

> „Tutaj mamy dashboard. Tutaj mamy zadania. Tutaj mamy kalendarz. Tutaj QR. Tutaj tickety. Tutaj jeszcze audyty.”

To byłby katalog funkcji.

Zamiast tego odbiorca ma zobaczyć **rzeczywisty przepływ pracy**.

---

# 3. Cztery warstwy Ambry

## WARSTWA A — AMBRA CORE

To są uniwersalne elementy systemu magazynowego.

Nie zależą bezpośrednio od naszego konkretnego przedsiębiorstwa i mogą stanowić publicznie prezentowaną część Ambry.

### Zlecenia i części

- lista zleceń,
- lista części przypisanych do zlecenia,
- części wolne,
- wyszukiwanie części,
- lokalizacja części,
- przypisywanie części wolnej do zlecenia,
- historia operacji,
- wydawanie części,
- archiwum dokumentów wydania.

### Przyjęcie i rozkładanie dostawy

- lista elementów dostawy,
- grupowanie części,
- obsługa części należących do jednego zlecenia,
- obsługa pojedynczych części,
- oznaczanie części oraz zestawów,
- przypisywanie miejsca składowania,
- identyfikacja części oczekujących na dalszą obsługę.

### Lokalizacje

- struktura magazynu,
- lokalizacje,
- przenoszenie części,
- przenoszenie zestawów,
- historia zmian lokalizacji.

### QR

- generowanie QR,
- drukowanie etykiet,
- skanowanie telefonem,
- identyfikacja lokalizacji,
- identyfikacja części,
- identyfikacja zestawów,
- szybkie przejście do odpowiedniego obiektu w systemie.

### Wydawanie

- wyszukiwanie części,
- identyfikacja lokalizacji,
- rejestrowanie wydania,
- wyszukiwanie wcześniejszych wydań,
- cyfrowa historia.

### Tickety

- zgłoszenia operacyjne,
- kolejka zgłoszeń,
- statusy,
- przypisywanie użytkowników,
- komentarze,
- historia,
- powiązania ze zleceniem, częścią albo zestawem,
- możliwość wykorzystania szablonów zgłoszeń.

### Organizacja

- oddziały,
- użytkownicy,
- role,
- uprawnienia,
- izolacja danych,
- historia ważnych operacji.

### Platforma

- logowanie,
- sesje,
- bezpieczeństwo,
- responsywność,
- urządzenia mobilne,
- powiadomienia,
- kontrola dostępu,
- historia aktywności.

---

# 4. WARSTWA B — WDROŻENIE DLA NASZEJ FIRMY

To bardzo istotne rozróżnienie.

Nie wszystko, co pokazujemy podczas prezentacji, jest uniwersalną funkcją Ambry.

Niektóre narzędzia powstały konkretnie dlatego, że znam obecny proces i mogłem dopasować system do rzeczywistego środowiska pracy.

## SVWMS Matcher

Matcher jest narzędziem zaprojektowanym pod nasz istniejący proces.

Jego rolą jest między innymi:

- przetwarzanie odpowiednich dokumentów,
- porównywanie danych,
- budowanie informacji o dostawie,
- przypisywanie części,
- przygotowanie danych dla dalszego procesu magazynowego,
- przekazanie wyniku do Ambry.

### Klasyfikacja

**Warstwa:** rozwiązanie firmowe  
**Prezentacja:** TAK — live demo  
**Pilot:** TAK  
**Publiczna strona Ambry:** NIE  
**Publiczne materiały marketingowe:** NIE

Matcher nie powinien być elementem publicznego marketingu Ambry.

Jego wartość podczas prezentacji wewnętrznej jest jednak bardzo duża, ponieważ pokazuje:

> Ambra nie została zbudowana w oderwaniu od rzeczywistych procesów. System może zostać dopasowany do istniejącego środowiska organizacji.

---

# 5. Integracja / praca z AutoStacją

Import oraz współpraca z AutoStacją również należą do warstwy wdrożeniowej.

Obejmuje to między innymi:

- import zleceń,
- import części,
- import wcześniejszych danych,
- części wolne,
- weryfikację danych,
- zabezpieczenie przed duplikacją,
- aktualizację potrzebnych informacji po wykonaniu fizycznego procesu.

### Klasyfikacja

**Warstwa:** rozwiązanie firmowe  
**Prezentacja:** TAK  
**Pilot:** TAK  
**Publiczna strona:** NIE — co najwyżej ogólne „integracje z istniejącymi systemami”

Publicznie nie trzeba tłumaczyć architektury AutoStacji.

Podczas prezentacji wewnętrznej jest to natomiast jeden z ważniejszych argumentów:

> Ambra nie wymaga natychmiastowego zastąpienia istniejących systemów. Może stanowić warstwę usprawniającą codzienną pracę wokół nich.

---

# 6. WARSTWA C — ZAKRES PILOTA

Pilot nie ma służyć testowaniu każdego modułu Ambry.

Ma sprawdzić **podstawowy obieg części w rzeczywistym środowisku**.

## Główny zakres pilota

### 1. Dostawa

- przygotowanie danych dostawy,
- przekazanie ich do Ambry,
- rozpoczęcie sesji przyjęcia.

### 2. Identyfikacja

- QR,
- etykiety,
- zestawy części,
- pojedyncze części.

### 3. Rozkładanie

- przypisanie lokalizacji,
- skanowanie telefonem,
- fizyczne odkładanie części.

### 4. Lokalizacja

- zapis informacji o położeniu,
- zmiana lokalizacji,
- historia lokalizacji.

### 5. Wyszukiwanie

- znalezienie części,
- znalezienie zlecenia,
- wyświetlenie lokalizacji.

### 6. Wydanie

- rejestrowanie pobrania,
- historia wydania,
- dokumentacja.

### 7. Wyjątki

- problemy,
- zgłoszenia,
- niezgodności,
- nietypowe przypadki.

### 8. Praca na urządzeniu mobilnym

- skanowanie,
- szybka obsługa,
- sprawdzenie wygody użycia w rzeczywistych warunkach magazynowych.

---

# 7. Czego pilot ma NIE próbować udowodnić

Pilot nie ma odpowiadać na pytanie:

> „Czy Ambra posiada każdą możliwą funkcję magazynową?”

Nie powinien więc być uzależniony od pełnego wdrożenia:

- rozbudowanych audytów,
- audytów dostawców,
- gospodarki materiałami zużywalnymi,
- automatycznych zamówień,
- VMI,
- zaawansowanych raportów między oddziałami,
- pełnego systemu Kanban,
- kompletnego systemu procedur,
- rozbudowanego kalendarza operacyjnego,
- Combo,
- magazynu lakierniczego.

Te elementy mogą mieć już fundamenty albo nawet częściowo funkcjonować.

Nie są jednak potrzebne do odpowiedzi na najważniejsze pytanie pilota:

> **Czy podstawowy model pracy Ambry rzeczywiście usprawnia codzienną pracę magazynu?**

---

# 8. WARSTWA D — ROADMAP / DALSZY ROZWÓJ

Tutaj trafiają funkcjonalności pokazujące potencjał platformy.

## Materiały

- materiały zużywalne,
- stany minimalne,
- stany docelowe,
- historia zużycia,
- wartość zapasu.

## Dostawcy

- dostawcy,
- materiały przypisane do dostawców,
- kontrola dostaw,
- propozycje zamówień,
- akceptacje,
- potencjalne konta dostawców.

## Audyty

- audyty według lokalizacji,
- audyty według dostawcy,
- historia audytów,
- rejestrowanie różnic,
- harmonogramy,
- audyty cykliczne.

## VMI

Potencjalne rozwinięcie integrujące dostawcę i dane magazynowe.

## Organizacja pracy

- zadania,
- zadania cykliczne,
- kalendarz,
- Kanban,
- procedury,
- checklisty.

## Dalsze obszary

- Combo,
- magazyn lakierniczy,
- części nierotujące,
- współpraca między oddziałami,
- raportowanie wielooddziałowe,
- baza wiedzy.

Te elementy pokazują, że Ambra może rozwinąć się w większą platformę operacyjną.

Ale należy powiedzieć wyraźnie:

> Nie chcę rozwijać wszystkich tych obszarów w ciemno. Pilot ma nam pomóc ustalić, które z nich rzeczywiście przyniosą największą wartość.

---

# 9. PUBLICZNE VS WEWNĘTRZNE

## Publicznie można pokazywać

- UI Ambry,
- lokalizacje,
- QR,
- mobilną obsługę,
- zlecenia,
- części,
- historię,
- wyszukiwanie,
- wydawanie,
- tickety,
- dashboard,
- użytkowników,
- role i uprawnienia,
- architekturę produktu na wysokim poziomie,
- przyszłe możliwości.

## Publicznie nie pokazujemy

- SVWMS Matchera,
- rzeczywistych dokumentów firmy,
- szczegółowego flow wewnętrznego,
- danych z AutoStacji,
- wewnętrznej logiki integracji,
- danych produkcyjnych,
- informacji mogących ujawnić firmowe know-how.

---

# 10. STRONA PUBLICZNA AMBRY

Publiczna strona Ambry powinna być cyfrową wizytówką produktu.

Nie musi być częścią właściwego demo.

Powinna jednak być przygotowana na sytuację, w której po spotkaniu ktoś prześle link dalej.

Jej zadaniem jest odpowiedzieć w 60–120 sekund na pytania:

**Co to jest?**

**Co robi?**

**Czy to naprawdę istnieje?**

**Na jakim jest etapie?**

## Elementy strony

### Hero

AMBRA

Krótka definicja:

> System wspierający codzienną pracę magazynu — od przyjęcia i lokalizacji towaru po jego wyszukanie, wydanie i historię operacji.

### Interaktywny flow

**Przyjęcie → Identyfikacja → Lokalizacja → Magazyn → Wyszukanie → Wydanie**

### Prawdziwe komponenty aplikacji

Na przykładowych danych:

- lokalizacja,
- część,
- zlecenie,
- QR,
- ticket,
- historia operacji.

### Krótkie nagrania

Na przykład:

- utworzenie lokalizacji,
- skanowanie QR,
- przypisanie części,
- wyszukanie części,
- wydanie.

### Sekcja bezpieczeństwa i architektury

Krótko:

- role,
- uprawnienia,
- oddziały,
- historia operacji,
- bezpieczeństwo.

### Status produktu

> Ambra znajduje się na etapie przygotowania do kontrolowanego pilotażu produkcyjnego.

### Roadmap

Ogólnie:

- dalsza automatyzacja,
- gospodarka materiałowa,
- integracje,
- audyty,
- obsługa kolejnych procesów.

Bez Matchera i AutoStacji.

---

# 11. KLASYFIKACJA NA POTRZEBY PREZENTACJI

## LIVE DEMO — obowiązkowe

1. Matcher.
2. Przekazanie danych do Ambry.
3. Dostawa.
4. Lokalizacje.
5. Generowanie QR.
6. Mobilne skanowanie.
7. Odkładanie części.
8. Wyszukiwanie części.
9. Wydanie.
10. Ticket / wyjątek.

## LIVE DEMO — opcjonalne

- dashboard,
- części wolne,
- historia,
- archiwum,
- zarządzanie oddziałami,
- szybki przykład uprawnień.

## WSPOMNIEĆ

- bezpieczeństwo,
- architektura,
- role,
- historia operacji,
- responsywność,
- możliwość integracji.

## ROADMAP

- materiały,
- dostawcy,
- audyty,
- VMI,
- Combo,
- lakiernia,
- Kanban,
- procedury,
- rozbudowane raportowanie.

---

# 12. PEŁNY SKRYPT PREZENTACJI

## ETAP 1 — OTWARCIE

### Cel

Nie zaczynać od technologii.

Nie zaczynać od:

> „Zbudowałem aplikację.”

Najpierw trzeba stworzyć kontekst biznesowy.

### Slajd

**AMBRA**

Podtytuł:

**Od pomysłu i prototypu do pilotażu w rzeczywistym środowisku pracy**

### Co mówię

„Chciałbym dzisiaj pokazać projekt, nad którym pracuję od pewnego czasu — Ambrę.

Nie chcę jednak robić prezentacji wszystkich funkcji, które udało mi się stworzyć.

Dużo ważniejsze jest pokazanie jednego kompletnego procesu i odpowiedzenie na pytanie, czy doszliśmy już do momentu, w którym warto przetestować ten system w rzeczywistym środowisku pracy.

Ambra powstała z obserwacji codziennych procesów, które sam znam z pracy.

W wielu miejscach problemem nie jest brak danych.

Dane już istnieją.

Problem polega na tym, że informacje znajdują się w różnych systemach, dokumentach i w wiedzy poszczególnych osób, a pracownik musi wykonywać wiele dodatkowych czynności, żeby połączyć je w jeden proces.

Ambra ma być warstwą, która upraszcza tę codzienną pracę.”

---

# ETAP 2 — PROBLEM

### Slajd

**Informacja istnieje. Problemem jest przepływ.**

Można wizualnie pokazać:

Dokumenty  
↓  
System  
↓  
Magazyn  
↓  
Telefon  
↓  
Pracownik  
↓  
kolejny system

### Co mówię

„Jeżeli spojrzymy na zwykłą dostawę części, nie mamy jednego procesu cyfrowego od momentu pojawienia się dokumentów aż do momentu, kiedy część trafia na swoje miejsce.

Część informacji trzeba porównać.

Część przepisać.

Część zweryfikować.

Następnie trzeba fizycznie znaleźć miejsce dla części.

Później ktoś musi tę część ponownie znaleźć.

I w wielu miejscach powodzenie procesu zależy od tego, czy odpowiednia osoba pamięta, gdzie dana rzecz się znajduje albo jak została obsłużona.

Nie twierdzę, że Ambra rozwiązuje dzisiaj każdy problem magazynu.

Chcę pokazać, że potrafimy już połączyć najważniejszą część tego procesu.”

---

# ETAP 3 — POKAŻ CAŁY FLOW ZANIM ZACZNIESZ DEMO

### Slajd

**DOSTAWA → PRZYJĘCIE → QR → LOKALIZACJA → WYSZUKANIE → WYDANIE**

Dodatkowo mniejszym tekstem:

**+ obsługa wyjątków i historia**

### Co mówię

„To jest proces, który chciałbym dzisiaj przejść.

Najpierw przychodzi dostawa.

Tworzymy dane potrzebne do jej obsługi.

Następnie magazynier może ją przyjąć i rozłożyć.

Ambra zapamiętuje, gdzie znajduje się dana część.

Kiedy później jest potrzebna, możemy ją znaleźć, pobrać i zarejestrować wydanie.

A jeżeli po drodze pojawi się problem, mamy mechanizm obsługi wyjątków.

I właśnie ten proces chciałbym później sprawdzić w pilotażu.”

---

# ETAP 4 — MATCHER

### Przejście

„Zacznijmy jednak jeszcze krok wcześniej — od miejsca, w którym obecnie zaczyna się nasza rzeczywista praca.”

### Co pokazuję

Prawdziwe dokumenty demonstracyjne.

Uruchomienie Matchera.

Proces dopasowania.

Wynik.

### Co mówię

„To jest SVWMS Matcher.

To narzędzie nie jest uniwersalnym elementem Ambry i nie jest produktem publicznym.

Powstało specjalnie pod nasz sposób pracy.

Zbudowałem je dlatego, że znam dokładnie dokumenty, które otrzymujemy, oraz czynności, które wykonujemy na ich podstawie.

Matcher wykonuje część pracy związanej z ich porównaniem i przygotowuje ustrukturyzowane dane potrzebne do dalszego procesu.”

### Po wygenerowaniu wyniku

„Najważniejsze nie jest tutaj samo automatyczne przetworzenie dokumentów.

Najważniejsze jest to, co dzieje się dalej.

Wynik nie kończy się kolejnym Excelem czy PDF-em.

Może stać się początkiem rzeczywistego procesu magazynowego.”

---

# ETAP 5 — PRZEKAZANIE DO AMBRY

### Pokazuję

Przekazanie / utworzenie dostawy.

Widok dostawy w Ambrze.

### Co mówię

„Po zakończeniu Matchera informacje mogą zostać przekazane do Ambry.

Od tego momentu przestajemy patrzeć na dokument.

Zaczynamy pracować na rzeczywistej dostawie.

Ambra wie, jakie części znajdują się w dostawie i z czym są związane.

To jest ważne rozróżnienie:

Matcher przygotowuje dane pod nasze środowisko.

Ambra obsługuje proces magazynowy.”

---

# ETAP 6 — AUTOSTACJA I ISTNIEJĄCE ŚRODOWISKO

### Co mówię

„Tutaj pojawia się również AutoStacja.

Nie zakładam, że pierwszym etapem Ambry będzie zastąpienie systemów, które już istnieją.

To byłoby kosztowne i niepotrzebnie ryzykowne.

Dużo bardziej sensowne jest wykorzystanie istniejących danych i dodanie warstwy, która upraszcza proces tam, gdzie obecne narzędzia go nie obsługują.

Dlatego Ambra może pobierać i weryfikować potrzebne informacje oraz pracować wokół obecnego systemu.”

### Najważniejsza teza

> **Ambra nie musi zastąpić istniejącej infrastruktury, żeby przynieść wartość.**

---

# ETAP 7 — LOKALIZACJE

### Przejście

„Zanim rozłożymy dostawę, potrzebujemy jednak odpowiedzieć na bardzo podstawowe pytanie:

Co dla systemu znaczy miejsce w magazynie?”

### Pokazuję

Nowy oddział.

Strukturę lokalizacji.

Dodanie lokalizacji.

### Co mówię

„W Ambrze fizyczny magazyn jest odwzorowany jako struktura lokalizacji.

Możemy tworzyć lokalizacje zależnie od potrzeb danego oddziału.

Nie musimy wcześniej programować każdej półki.

Jeżeli organizacja magazynu się zmieni, struktura może zmieniać się razem z nią.”

---

# ETAP 8 — QR

### Pokazuję

Generowanie QR.

Etykietę.

Druk.

### Co mówię

„Do lokalizacji możemy od razu wygenerować kod QR.

Możemy stworzyć etykietę i ją wydrukować.

To powoduje, że fizyczna przestrzeń magazynu zostaje połączona z systemem.

QR nie jest tutaj tylko numerem.

To skrót prowadzący bezpośrednio do konkretnego obiektu w Ambrze.”

### Skan

„Jeżeli zeskanuję ten kod telefonem, system wie, o którą lokalizację chodzi.

Jeżeli użytkownik nie jest zalogowany, najpierw przechodzi przez logowanie, a następnie wraca bezpośrednio do zeskanowanego obiektu.

To jest istotne, ponieważ pracownik nie powinien po zeskanowaniu kodu ręcznie szukać tego samego miejsca w aplikacji.”

---

# ETAP 9 — PRZYJĘCIE DOSTAWY

### Przejście

„Mamy dostawę.

Mamy już również cyfrowe odwzorowanie magazynu.

Teraz możemy połączyć te dwa światy.”

### Pokazuję

Sesję przyjęcia.

Listę części.

Grupowanie.

### Co mówię

„Magazynier otwiera dostawę i otrzymuje listę rzeczy, które wymagają obsługi.

System może grupować części należące do jednego zlecenia.

Nie wszystko jednak zawsze idealnie pasuje do jednego schematu, dlatego możemy również pracować z pojedynczymi elementami i częściami wymagającymi indywidualnego traktowania.”

---

# ETAP 10 — OZNACZANIE CZĘŚCI I ZESTAWÓW

### Pokazuję

QR dla części albo zestawu.

### Co mówię

„Nie każda pojedyncza rzecz musi koniecznie wymagać osobnego procesu.

Jeżeli kilka części ma być przechowywanych razem, możemy potraktować je jako oznaczony zestaw.

Jeżeli część wymaga indywidualnej identyfikacji, możemy oznaczyć ją osobno.

Chodzi o to, żeby system dostosowywał się do rzeczywistego sposobu magazynowania, a nie zmuszał magazyn do pracy pod strukturę aplikacji.”

---

# ETAP 11 — ODKŁADANIE TELEFONEM

### To jeden z kluczowych momentów demo.

### Pokazuję

Telefon.

Skan elementu.

Skan lokalizacji.

Potwierdzenie.

### Co mówię

„I tutaj dochodzimy do jednej z rzeczy, które chciałbym szczególnie sprawdzić podczas pilotażu.

Czy możemy przeprowadzić tę czynność bez powrotu do komputera?

Magazynier bierze telefon.

Skanuje część albo zestaw.

Następnie skanuje miejsce, w którym je odkłada.

System zapisuje relację między fizycznym obiektem a jego lokalizacją.”

### Po zapisaniu

„Od tego momentu informacja nie znajduje się tylko w pamięci osoby, która odkładała część.

Jest częścią historii systemu.”

---

# ETAP 12 — ZMIANA LOKALIZACJI

### Pokazuję

Przeniesienie.

### Co mówię

„Magazyn oczywiście nie jest statyczny.

Jeżeli później przenosimy część albo cały oznaczony zestaw, nie musimy tracić historii.

Aktualizujemy lokalizację, a Ambra zachowuje informację o zmianie.”

---

# ETAP 13 — DOMKNIĘCIE PRZYJĘCIA / AUTOSTACJA

### Co mówię

„To pozwala również inaczej podejść do aktualizowania AutoStacji.

Nie chcę, żeby pracownik po każdej pojedynczej czynności wykonywał dodatkowy proces administracyjny.

Najpierw wykonuje rzeczywistą pracę magazynową.

System zbiera informacje.

A aktualizację istniejącego systemu możemy wykonywać w kontrolowanym momencie.

To jest właśnie przykład miejsca, które pilot powinien zweryfikować w praktyce.”

---

# ETAP 14 — WYSZUKANIE CZĘŚCI

### Przejście narracyjne

„Do tej pory patrzyliśmy na proces od strony dostawy.

Ale prawdziwa wartość informacji o lokalizacji pojawia się później.

Załóżmy, że kilka dni później potrzebuję konkretnej części.”

### Pokazuję

Wyszukiwarkę.

Numer części / zlecenie.

Wynik.

Lokalizację.

### Co mówię

„Nie muszę wiedzieć, kto przyjmował dostawę.

Nie muszę pamiętać, kiedy przyszła.

Nie muszę pytać osoby, która ją rozkładała.

Wyszukuję część albo zlecenie.

Ambra pokazuje mi aktualną lokalizację.”

---

# ETAP 15 — FIZYCZNE ODNALEZIENIE

### Pokazuję

Lokalizację.

Opcjonalnie QR.

### Co mówię

„Czyli zamykamy pętlę.

Informacja zapisana podczas przyjęcia staje się użyteczna w momencie, kiedy ktoś rzeczywiście potrzebuje tej części.”

---

# ETAP 16 — WYDANIE

### Pokazuję

Wydanie części.

### Co mówię

„Po pobraniu mogę zarejestrować wydanie.

Dzięki temu system nie kończy historii w momencie znalezienia części.

Mamy zapis kolejnego etapu procesu.”

### Pokazuję historię

„Możemy później zobaczyć, co działo się z częścią, kiedy zmieniała lokalizację i kiedy została wydana.”

---

# ETAP 17 — ARCHIWUM

### Co mówię

„Tam, gdzie powstają dokumenty związane z wydaniem, możemy również utrzymywać ich cyfrowe archiwum.

Nie chciałbym jednak robić z archiwum osobnego modułu prezentacji.

To jest po prostu kolejny element historii procesu.”

---

# ETAP 18 — A CO, JEŻELI COŚ PÓJDZIE NIE TAK?

### Slajd

**Happy path to za mało.**

### Co mówię

„Do tej pory celowo pokazywałem idealny proces.

Ale pilot nie ma sprawdzić systemu tylko wtedy, gdy wszystko działa idealnie.

Dużo ważniejsze będą sytuacje nietypowe.”

---

# ETAP 19 — TICKETY

### Pokazuję

Utworzenie ticketu.

Najlepiej z poziomu konkretnego obiektu.

### Co mówię

„Jeżeli pojawia się problem, możemy utworzyć zgłoszenie bez odrywania go od kontekstu.

Ticket może być związany z konkretną częścią, zleceniem albo oznaczonym zestawem.

Dzięki temu druga osoba nie dostaje wiadomości typu:

‘Mamy problem z tą częścią z wczoraj.’

Dostaje zgłoszenie wraz z informacją, czego ono dotyczy.”

### Szablony

„Dla powtarzalnych problemów możemy przygotować gotowe typy zgłoszeń.

To jest szczególnie interesujące w środowisku kilku oddziałów, ponieważ pozwala ustandaryzować sposób przekazywania problemów.”

---

# ETAP 20 — DASHBOARD

Dashboard pokazujemy krótko.

### Co mówię

„Informacje z tych procesów mogą być następnie agregowane w dashboardzie.

Nie chodzi o dashboard dla samego dashboardu.

Każdy element powinien prowadzić do konkretnego działania.”

### Pokazuję

- oczekujące dostawy,
- części bez lokalizacji,
- pilne tickety,
- inne rzeczy związane z podstawowym procesem.

Nie rozwijam materiałów i audytów.

---

# ETAP 21 — BEZPIECZEŃSTWO I ARCHITEKTURA

### Slajd

**To nie jest tylko demo interfejsu.**

### Co mówię

„Do tej pory pokazywałem przede wszystkim funkcje wpływające bezpośrednio na pracę.

Ale jeżeli system ma wejść do rzeczywistego środowiska, sama funkcjonalność nie wystarczy.

Dlatego Ambra od początku posiada również fundamenty organizacyjne i bezpieczeństwa.”

### Wymieniam

- użytkowników,
- oddziały,
- role,
- uprawnienia,
- izolację danych,
- bezpieczne sesje,
- historię operacji,
- urządzenia mobilne,
- kontrolę dostępu.

### Ważne

Nie robię 10-minutowego technicznego wykładu.

### Co mówię

„Nie chcę teraz przechodzić przez każdy mechanizm techniczny.

Chcę jedynie zaznaczyć, że Ambra nie jest prototypem, w którym każdy użytkownik może zrobić wszystko.

Fundament potrzebny do kontrolowanego pilotażu został przewidziany.”

---

# ETAP 22 — MOMENT ZMIANY NARRACJI

To jeden z najważniejszych momentów prezentacji.

Kończymy demo.

### Slajd

**Co teraz?**

### Co mówię

„I w tym miejscu chciałbym zatrzymać prezentowanie funkcji.

Mógłbym pokazać kolejne moduły.

Mógłbym również przez następne miesiące rozwijać system samodzielnie.

Tylko że moim zdaniem właśnie teraz nie jest to najlepszy kolejny krok.

Doszliśmy do punktu, w którym najważniejszych odpowiedzi nie dostanę już podczas dalszego programowania.

Dostanę je dopiero wtedy, kiedy z Ambry zaczną korzystać prawdziwi użytkownicy.”

---

# ETAP 23 — DLACZEGO PILOT

### Slajd

**Od developmentu do walidacji**

### Co mówię

„Największe ryzyko nie polega już na tym, czy potrafię dodać kolejną funkcję.

Największe ryzyko polega na tym, że mógłbym rozwijać ją bez wystarczającego feedbacku od ludzi, którzy później mają jej używać.

Dlatego kolejnym etapem powinien być kontrolowany pilot.”

---

# ETAP 24 — CO CHCEMY SPRAWDZIĆ

### Slajd

**Pytania pilota**

### Co mówię

„Pilot ma odpowiedzieć na kilka bardzo konkretnych pytań.

Czy pracownikowi faktycznie łatwiej jest przyjąć i rozłożyć dostawę?

Czy QR jest wygodny w rzeczywistych warunkach magazynowych?

Czy telefon jest odpowiednim narzędziem do tych czynności?

Czy proponowany sposób grupowania części odpowiada rzeczywistym przypadkom?

Co dzieje się w sytuacjach nietypowych?

Czy informacja o lokalizacji jest wystarczająco dokładna?

Czy wyszukiwanie rzeczywiście skraca czas potrzebny do odnalezienia części?

Czy proces wydania jest naturalny?

Gdzie użytkownicy zaczynają omijać system?

Które kroki są zbędne?

Których informacji brakuje?

I przede wszystkim:

co powinniśmy poprawić, zanim pomyślimy o większym wdrożeniu?”

---

# ETAP 25 — JAK POWINIEN WYGLĄDAĆ PILOT

### Slajd

**Mała skala. Rzeczywista praca. Szybkie iteracje.**

### Schemat

WDROŻENIE

↓

TEST

↓

OBSERWACJA

↓

FEEDBACK

↓

POPRAWKA

↓

PONOWNY TEST

### Co mówię

„Nie proponuję wdrożenia Ambry w całej organizacji.

Proponuję mały, kontrolowany pilot.

Wybieramy ograniczony zakres procesu.

Pracujemy z niewielką grupą użytkowników.

Wykorzystujemy rzeczywiste dostawy i rzeczywiste części.

Obserwujemy problemy.

Zbieramy feedback.

Poprawiam system.

I ponownie go testujemy.

Dzięki temu każda kolejna decyzja dotycząca rozwoju Ambry będzie oparta na rzeczywistym użyciu, a nie wyłącznie na moich założeniach.”

---

# ETAP 26 — CO CELOWO NIE WCHODZI DO PILOTA

### Slajd

**Skupienie zamiast dokładania zakresu**

### Co mówię

„Ambra ma już fundamenty również w innych obszarach i mam pomysły na kolejne.

Nie chcę jednak uzależniać pilota od ich ukończenia.

Na przykład gospodarka materiałami, audyty dostawców czy bardziej rozbudowana automatyzacja zakupów mogą być wartościowe.

Ale nie potrzebujemy ich, żeby sprawdzić główną hipotezę tego pilota.

Dlatego świadomie odkładam je na później.”

---

# ETAP 27 — ROADMAP

### Slajd

**Jeżeli core się potwierdzi — co dalej?**

### Pokazuję

Kilka obszarów, nie 30 feature'ów.

### 1. Materiały i dostawcy

- stany,
- minima,
- audyty,
- zamówienia,
- VMI.

### 2. Kolejne obszary magazynu

- Combo,
- lakiernia.

### 3. Organizacja pracy

- zadania,
- procedury,
- harmonogramy.

### 4. Wielooddziałowość

- komunikacja,
- raportowanie,
- współpraca.

### Co mówię

„To nie jest zakres, za który dzisiaj proszę o finansowanie.

Pokazuję go tylko dlatego, żeby było jasne, że architektura Ambry nie kończy się na jednym workflow.

Jeżeli pilot potwierdzi wartość core'u, będziemy mogli świadomie zdecydować, które z tych kierunków mają największy sens.”

---

# ETAP 28 — PUBLICZNA AMBRA A NASZE WDROŻENIE

Opcjonalny slajd, jeśli chcesz pokazać stronę.

### Co mówię

„Chciałbym też rozdzielić dwie rzeczy.

Ambra jako system posiada uniwersalny core.

Natomiast to, co pokazuję dzisiaj, zawiera również rozwiązania przygotowane konkretnie pod nasze środowisko — takie jak Matcher czy współpraca z AutoStacją.

Dlatego publiczna strona Ambry pokazuje sam produkt i jego uniwersalne możliwości.

Rozwiązania specyficzne dla naszego procesu pozostają częścią naszego wdrożenia.”

---

# ETAP 29 — CZEGO POTRZEBUJĘ

### Slajd

**Propozycja kolejnego etapu**

### Co mówię

„Żeby przejść do tego etapu, potrzebuję przede wszystkim trzech rzeczy.

Po pierwsze — zgody na przeprowadzenie kontrolowanego pilota.

Po drugie — możliwości pracy z niewielką grupą użytkowników i dostępem do rzeczywistego procesu, żeby zbierać feedback i iterować rozwiązanie.

Po trzecie — budżetu pozwalającego sfinansować dalsze przygotowanie, rozwój i prowadzenie pilotażu.”

---

# ETAP 30 — 25 000 ZŁ

### Slajd

**Budżet pilotażu: 25 000 zł**

### Co mówię

„Proponowany budżet tego etapu to 25 tysięcy złotych.

Chcę bardzo wyraźnie zaznaczyć jedną rzecz.

To nie jest wycena całego systemu Ambra.

I nie jest to również budżet na zbudowanie całej roadmapy, którą przed chwilą pokazałem.

To jest budżet na przejście z obecnego etapu projektu do rzeczywistego pilotażu — przygotowanie środowiska, dalsze dopracowanie core'u, pracę z użytkownikami, poprawki wynikające z testów i ocenę rezultatów.”

---

# ETAP 31 — DLACZEGO TERAZ

### Co mówię

„Moim zdaniem właśnie teraz jest dobry moment.

Gdyby Ambra była wyłącznie koncepcją albo makietą, proszenie o pilot byłoby za wczesne.

Gdyby była już zakończonym produktem, pilot byłby spóźniony.

Dzisiaj mamy działający system, ale nadal wystarczająco dużo przestrzeni, żeby feedback użytkowników rzeczywiście wpłynął na jego konstrukcję.

To jest dokładnie moment, w którym pilot daje największą wartość.”

---

# ETAP 32 — ZAMKNIĘCIE

### Slajd

**Nie pytamy już, czy da się to zbudować.**

Niżej:

**Sprawdźmy, czy działa w praktyce.**

### Co mówię

„Na początku tego projektu główne pytanie brzmiało:

Czy jestem w stanie zbudować system, który połączy te procesy?

Dzisiaj możemy już zobaczyć, że technicznie jest to możliwe.

Dlatego nie chciałbym, żeby kolejnym etapem było kolejne kilka miesięcy samotnego dokładania funkcji.

Kolejne pytanie jest dużo ważniejsze:

Czy Ambra rzeczywiście usprawni pracę wtedy, kiedy zaczniemy używać jej w normalnym środowisku produkcyjnym?

Tego nie rozstrzygniemy na prezentacji.

Możemy to sprawdzić tylko w praktyce.

I właśnie o możliwość przeprowadzenia takiego pilota chciałbym dzisiaj poprosić.”

---

# 13. SKRÓCONA MAPA CAŁEJ PREZENTACJI

## CZĘŚĆ I — DLACZEGO

1. Ambra.
2. Problem.
3. Cały workflow.

## CZĘŚĆ II — POKAZUJEMY, ŻE TO DZIAŁA

4. Matcher.
5. Przekazanie do Ambry.
6. AutoStacja.
7. Lokalizacje.
8. QR.
9. Przyjęcie.
10. Zestawy.
11. Telefon.
12. Odkładanie.
13. Zmiana lokalizacji.
14. Aktualizacja systemu.
15. Wyszukanie.
16. Odnalezienie.
17. Wydanie.
18. Historia.
19. Wyjątki.
20. Tickety.
21. Dashboard.
22. Bezpieczeństwo.

## CZĘŚĆ III — ZMIENIAMY PYTANIE

23. Co teraz?
24. Dlaczego pilot?
25. Co mierzymy?
26. Jak testujemy?

## CZĘŚĆ IV — SKUPIENIE

27. Co nie wchodzi do pilota.
28. Roadmap.
29. Core Ambra vs wdrożenie firmowe.

## CZĘŚĆ V — DECYZJA

30. Czego potrzebuję.
31. 25 000 zł.
32. Dlaczego teraz.
33. Zamknięcie.

---

# 14. ZASADA PROWADZENIA DEMO

Każda funkcja prezentowana na żywo powinna odpowiadać na jedno z trzech pytań:

### 1. Jaką ręczną czynność usuwamy?

albo

### 2. Jaką informację, która wcześniej była rozproszona, zachowujemy?

albo

### 3. Jak pomagamy pracownikowi wykonać kolejną czynność?

Jeżeli feature nie odpowiada na żadne z tych pytań, prawdopodobnie nie powinien zajmować czasu podczas głównego demo.

---

# 15. NAJWAŻNIEJSZA ZASADA CAŁEGO PITCHU

Nie próbujemy udowodnić:

> **„Ambra jest skończona.”**

Próbujemy udowodnić:

> **„Ambra jest wystarczająco dojrzała, żeby przestać rozwijać ją w izolacji i zacząć testować ją z użytkownikami.”**

To jest fundament całej prezentacji.
