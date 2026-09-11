# AMBRA — SKRYPT PREZENTACJI

### Wersja do wydrukowania i prowadzenia prezentacji

---

## 1. WSTĘP — SKĄD WZIĘŁA SIĘ AMBRA

**Powiedzieć:**

Zanim pokażę samą aplikację, chciałbym krótko powiedzieć, skąd w ogóle wziął się ten projekt.

Wcześniej pracowałem jako programista i po zmianie pracy tak naprawdę nie przestałem programować. Dalej robiłem to po godzinach, głównie z czystej pasji i dlatego, że po prostu lubię tworzyć aplikacje i uczyć się nowych rzeczy.

Zacząłem pracować nad własną aplikacją. Od strony technicznej interesowało mnie szczególnie to, jak buduje się normalny system biznesowy: rejestracja i logowanie, autoryzacja i uwierzytelnianie, użytkownicy, organizacje, oddziały, role, uprawnienia, zakres dostępu do danych i zabezpieczenia.

Pod tym względem inspirowałem się również systemami, z którymi pracujemy na co dzień, między innymi AutoStacją. Nie chodziło o jej kopiowanie czy zastępowanie, tylko o sposób, w jaki aplikacja biznesowa odwzorowuje organizację i kontroluje dostęp do danych i funkcjonalności.

W pewnym momencie zacząłem się zastanawiać, czy skoro i tak nad tym pracuję, nie mógłbym wykorzystać tego projektu do rozwiązania rzeczywistych problemów, które mamy w codziennej pracy.

I znalazłem pierwszy bardzo konkretny przykład.

---

## 2. PROBLEM — RĘCZNE DOPASOWYWANIE DOKUMENTÓW

### POKAŻ FIZYCZNE WYDRUKI.

**Powiedzieć:**

To jest przykładowa dostawa.

Wcześniej, żeby ją przeprocesować, musieliśmy wydrukować dokumenty dla wszystkich realokacji.

Dla głównego magazynu BC mogło to być na przykład około 20 stron, a do tego dochodziły dokumenty pozostałych magazynów zawierające zlecenia.

### POKAŻ DRUGI STOS DOKUMENTÓW.

Następnie trzeba było przechodzić przez dokument główny pozycja po pozycji, szukać odpowiadających zleceń w pozostałych dokumentach, dopasowywać je i ręcznie przepisywać.

Przy większej dostawie oznaczało to przeglądanie dziesiątek stron.

To po pierwsze zabierało czas, a po drugie każda ręczna operacja oznacza możliwość pomyłki.

I stwierdziłem, że do rozwiązania akurat tego problemu wcale nie potrzebuję całej aplikacji.

Wystarczy małe narzędzie.

---

## 3. PUBLICZNY SVWMS MATCHER

### OTWÓRZ PUBLICZNEGO MATCHERA.

**Powiedzieć:**

I tak powstał SVWMS Matcher.

### WRZUĆ TE SAME DOKUMENTY.

### URUCHOM MATCHING.

### POKAŻ WYNIK.

Zamiast ręcznie przeglądać te wszystkie dokumenty, narzędzie robi dopasowanie automatycznie.

Co ważne, nie jest to coś, co stworzyłem specjalnie na tę prezentację.

**Z tego narzędzia korzystamy już od kwietnia i rzeczywiście oszczędza nam czas.**

Ta publiczna wersja jest celowo bardzo prosta. Nie wymaga konta, nie zapisuje sesji ani nie wykorzystuje przechowywanych wcześniej danych.

Dostaje dokumenty, wykonuje konkretne zadanie i zwraca wynik.

I to był pierwszy problem rozwiązany w ramach tego projektu.

---

## 4. POMYSŁ NA DALSZE WYKORZYSTANIE DANYCH

**Powiedzieć:**

Później zacząłem się jednak zastanawiać nad jedną rzeczą.

Matcher właśnie przeanalizował całą dostawę.

Wie, co przyszło. Wie, jakie części znajdują się w dokumentach. Wie, do jakich zleceń należą.

Więc dlaczego po wykonaniu dopasowania mielibyśmy te informacje po prostu wyrzucić?

Tym bardziej że rozmawialiśmy już wcześniej o problemach występujących podczas fizycznego rozkładania dostaw.

Przy ręcznym wpisywaniu lokalizacji mogą pojawić się pomyłki. Trzeba też przechodzić pomiędzy komputerem a magazynem i ręcznie aktualizować informacje.

Pomyślałem więc:

**skoro Matcher już wie, co znajduje się w dostawie, dlaczego nie wykorzystać tych samych danych do pomocy przy jej fizycznym rozłożeniu?**

Ale w tym momencie sytuacja się zmienia.

Jeżeli chcemy te dane zachować i dalej procesować, potrzebujemy już użytkowników, organizacji, kontroli dostępu, bazy danych i odpowiednich zabezpieczeń.

Nie chciałem testować tego na danych firmowych w publicznym narzędziu.

Dlatego połączyłem Matchera z aplikacją, nad którą wcześniej pracowałem — Ambrą.

---

## 5. CO DZIAŁA POD SPODEM AMBRY

### KRÓTKO — OKOŁO 2 MINUT. NIE DEMONSTROWAĆ WSZYSTKIEGO.

**Powiedzieć:**

Zanim pokażę tę wersję Matchera, chcę tylko bardzo krótko powiedzieć, co znajduje się pod spodem Ambry, ponieważ za chwilę będę korzystał z tych mechanizmów i nie chciałbym później za każdym razem zatrzymywać prezentacji, żeby je tłumaczyć.

Ambra posiada już system **organizacji i wielu oddziałów**. Użytkownik może pracować w kontekście konkretnego oddziału, a poszczególne dane mogą mieć różny zakres — organizacji, oddziału albo konkretnego użytkownika czy obiektu.

Mamy **rejestrację, logowanie, zapraszanie użytkowników, członkostwa, role oraz szczegółowy system uprawnień**.

Kontrola dostępu nie kończy się na ukrywaniu przycisku w interfejsie. Uprawnienia są weryfikowane również po stronie aplikacji, a baza wykorzystuje między innymi **Row Level Security**, żeby dodatkowo kontrolować dostęp do danych.

Jest system **lokalizacji magazynowych**, dzięki któremu każdy oddział może odwzorować własną fizyczną strukturę magazynu.

Ambra potrafi **generować kody QR oraz gotowe etykiety do wydrukowania** dla lokalizacji, części i innych obiektów. Można je później skanować bezpośrednio telefonem.

Mamy **katalogi produktów i części, części wolne, proste zlecenia zawierające ich numery i listy należących do nich części oraz możliwość łączenia tych informacji z lokalizacjami i historią operacji**.

Aplikacja jest responsywna i część procesów została przygotowana specjalnie do wykonywania bezpośrednio na magazynie za pomocą telefonu.

Są również mechanizmy ticketów i powstają kolejne elementy związane z organizacją pracy.

Nie będę teraz prezentował każdego z tych systemów osobno.

Chciałem tylko pokazać, że to, co za chwilę zobaczycie, nie działa jako pojedynczy skrypt. Pod spodem znajduje się już infrastruktura normalnej aplikacji biznesowej.

---

## 6. MATCHER DLA ZALOGOWANYCH UŻYTKOWNIKÓW

### ZALOGUJ SIĘ.

### POKAŻ WERSJĘ MATCHERA W AMBRZE.

**Powiedzieć:**

I dzięki temu mogłem wziąć SVWMS Matchera o krok dalej.

Publiczna wersja kończy pracę po wygenerowaniu wyniku.

Tutaj podczas tego samego procesu możemy utworzyć **sesję dostawy**.

Nie musimy więc później ponownie przepisywać informacji ani tworzyć dostawy od początku.

Dane, które Matcher i tak już pozyskał podczas analizy dokumentów, stają się początkiem kolejnego procesu.

---

## 7. PRZYJĘCIE I ROZKŁADANIE DOSTAWY

### OD TEGO MOMENTU POKAZAĆ CAŁY PROCES BEZ DYGRESJI.

### POKAŻ:

- sesję,
- zlecenia,
- części,
- grupowanie,
- przygotowanie oznaczeń,
- QR/etykiety.

**Powiedzieć:**

Mamy więc przygotowaną dostawę i wiemy, co fizycznie powinno się w niej znajdować.

Teraz możemy przejść do jej rzeczywistego rozkładania.

### PRZEJDŹ NA TELEFON.

Zamiast co chwilę wracać do komputera, pracownik może wykonywać ten proces bezpośrednio przy regałach.

### DEMO:

**SKAN CZĘŚCI/ZESTAWU → SKAN LOKALIZACJI → POTWIERDZENIE**

**Powiedzieć:**

Skanuję część albo zestaw.

Następnie skanuję etykietę lokalizacji, na której ją odkładam.

Potwierdzam.

I przechodzę do następnej.

System na bieżąco wie, **co zostało już rozłożone, gdzie się znajduje oraz czego jeszcze brakuje do zakończenia dostawy.**

### ROZŁÓŻ KILKA POZYCJI.

### ZAKOŃCZ SESJĘ.

### WYGENERUJ RAPORT.

Na końcu mogę zamknąć proces i wygenerować informacje potrzebne do aktualizacji DMS/AutoStacji.

Czyli zaczęliśmy od dokładnie tych samych dokumentów, które przed chwilą trzymałem w rękach.

Matcher je przeanalizował, dane zostały zachowane, przeprowadziliśmy fizyczne rozłożenie dostawy i na końcu otrzymaliśmy informacje potrzebne do aktualizacji obecnego systemu.

---

## 8. POCZĄTKOWY STAN MAGAZYNU

**Powiedzieć:**

Tutaj jest jedna rzecz, którą trzeba wyjaśnić w kontekście ewentualnego pilotażu.

Ambra oczywiście pierwszego dnia nie będzie wiedziała o wszystkich starych zleceniach i częściach, które już znajdują się fizycznie na magazynie.

Widzę tutaj dwie możliwości.

Pierwsza to **naturalna rotacja**.

Stare zlecenia będą stopniowo zamykane, natomiast każda nowa dostawa będzie już trafiała do Ambry. Po pewnym czasie stare dane po prostu się wyrotują i system będzie miał pełny obraz bieżącego magazynu.

Druga możliwość to wykorzystanie porządkowania magazynu i nadchodzącej inwentaryzacji.

Skoro i tak będziemy wtedy fizycznie przeglądać regały, możemy równocześnie wprowadzić do Ambry to, co rzeczywiście znajduje się na magazynie.

Nie musimy więc pierwszego dnia wykonywać ogromnej migracji wszystkich historycznych danych.

---

## 9. CODZIENNA PRACA Z CZĘŚCIAMI

### POKAŻ:

- wyszukiwanie zlecenia,
- wyszukiwanie części,
- lokalizację,
- skan QR,
- część wolną,
- zmianę lokalizacji,
- przeniesienie zestawu,
- historię.

**Powiedzieć:**

Kiedy części są już w systemie, możemy wykorzystać te informacje również później.

Dzisiaj lokalizacje zapisane w komentarzach potrafią być problematyczne, szczególnie kiedy jedno zlecenie znajduje się w kilku miejscach.

Jeżeli chcemy później przeorganizować magazyn, znowu pojawia się chodzenie pomiędzy regałem a komputerem, szukanie części, szukanie wolnego miejsca i ręczne aktualizowanie lokalizacji.

Tutaj lokalizacja nie jest tylko tekstem wpisanym w komentarzu.

Jest rzeczywistym obiektem systemowym.

Mogę wyszukać zlecenie i zobaczyć jego części oraz ich lokalizacje.

Mogę zeskanować część.

Mogę zeskanować lokalizację i zobaczyć, co powinno się na niej znajdować.

A jeżeli chcę coś przenieść:

### POKAŻ „ZMIEŃ LOKALIZACJĘ”.

### ZESKANUJ NOWĄ LOKALIZACJĘ.

wybieram zmianę lokalizacji, skanuję nową etykietę i system aktualizuje informację.

Dzięki temu reorganizacja magazynu może być znacznie prostsza, szczególnie przy zleceniach znajdujących się na kilku lokalizacjach.

---

## 10. ODNALEZIENIE I WYDANIE CZĘŚCI

### WYSZUKAJ ZLECENIE/CZĘŚĆ.

### POKAŻ LOKALIZACJĘ.

### ODNAJDŹ CZĘŚĆ.

### POKAŻ WYDANIE.

**Powiedzieć:**

Ten sam system prowadzi nas później do drugiego końca procesu.

Mogę wyszukać część albo zlecenie, zobaczyć dokładnie, gdzie się znajduje, pobrać ją i zarejestrować wydanie.

I tutaj od razu zaznaczę jedną rzecz.

**Na etapie pilotażu wydanie nadal wykonujemy również w AutoStacji.**

AutoStacja pozostaje systemem źródłowym dla stanów i dokumentacji, więc tego procesu nie możemy po prostu pominąć.

W Ambrze dochodzi więc dodatkowe potwierdzenie wydania.

Natomiast dostajemy za to kilka rzeczy.

Po pierwsze, użytkownik i tak jest już w Ambrze, ponieważ właśnie tutaj znalazł fizyczną lokalizację części.

Po drugie, dzięki potwierdzeniu wydania Ambra wie, że tej części nie ma już na regale.

Po trzecie, zachowujemy ciągłą historię:

**przyjęcie → lokalizacja → ewentualne przeniesienia → wydanie.**

I jest jeszcze jedna rzecz.

### POKAŻ MOŻLIWOŚĆ ZAŁĄCZENIA DOKUMENTU/ZDJĘCIA.

Po wydrukowaniu wydania z DMS i zebraniu podpisu możemy zrobić zdjęcie podpisanego dokumentu i przypisać je bezpośrednio do konkretnego wydania w Ambrze.

Jeżeli za kilka miesięcy pojawi się problem, nie musimy szukać jednej kartki wśród dokumentów zbieranych każdego dnia.

Otwieramy konkretne wydanie i możemy od razu zobaczyć podpisany dokument.

**Czy dodatkowe potwierdzenie w Ambrze daje wystarczającą wartość w stosunku do dodatkowej czynności — to jest właśnie jedna z rzeczy, które chciałbym sprawdzić podczas pilotażu.**

Jeżeli okaże się zbyt uciążliwe, będziemy wiedzieli, że właśnie tutaj potrzebujemy uproszczenia albo dalszej integracji.

---

## 11. PODSUMOWANIE WORKFLOW CZĘŚCI

**Powiedzieć:**

Jeżeli teraz spojrzymy na całość, to mamy już praktycznie cały podstawowy cykl części.

**Dokumenty dostawy.**

**Automatyczne dopasowanie.**

**Utworzenie sesji.**

**Przyjęcie.**

**Oznaczenie i fizyczne rozłożenie.**

**Lokalizacja.**

**Późniejsze wyszukanie i ewentualna reorganizacja.**

**Wydanie.**

**Historia i dokumentacja.**

I wszystko zaczęło się od tych dokumentów, które pokazałem na początku.

---

## 12. TICKETY — KOMUNIKACJA I ORGANIZACJA PRACY

**Powiedzieć:**

Jest jeszcze jeden rodzaj problemu, który zacząłem analizować.

Nie dotyczy już bezpośrednio tego, gdzie znajduje się część, tylko **tego, gdzie znajduje się informacja o problemie.**

Dzisiaj duża część komunikacji pomiędzy doradcami a działem części odbywa się mailowo.

Może się zdarzyć, że wiadomość nie trafi do wszystkich częściowców.

Przy zwrocie może zabraknąć kierownika, który powinien go zatwierdzić.

Informacja może znajdować się w skrzynce jednej osoby.

A po pewnym czasie trzeba jeszcze ustalić, co właściwie stało się z daną sprawą.

Dlatego w Ambrze powstał system ticketów.

### POKAŻ TICKETY.

Ticket może mieć określony typ, status, osobę odpowiedzialną, komentarze i historię.

Może być również bezpośrednio powiązany ze zleceniem, częścią albo zestawem.

Przy procesach takich jak zwrot można określić odpowiednią ścieżkę i wymaganą akceptację.

Ale tickety nie muszą służyć wyłącznie do komunikacji z doradcami.

---

## 13. TICKETY WEWNĄTRZ DZIAŁU CZĘŚCI

**Powiedzieć:**

Wyobraźmy sobie prostą sytuację.

Na magazynie leży jakaś nietypowa część.

Osoba, która ją przyjęła, wie, dlaczego tutaj jest. Reszta zespołu niekoniecznie.

Zamiast zostawiać ją z kartką albo liczyć na to, że odpowiednia osoba będzie akurat w pracy, możemy utworzyć ticket.

Opisujemy problem.

Przypisujemy część do ticketu.

Przyklejamy do niej wygenerowany kod QR.

Od tego momentu każdy pracownik może zeskanować część i zobaczyć:

- dlaczego tutaj leży,
- czego dotyczy sprawa,
- jaki jest status,
- kto się nią zajmuje,
- co zostało już zrobione.

To jest przejście od sytuacji:

**„jedna osoba wie, o co chodzi”**

do:

**„zespół ma dostęp do tej informacji”.**

Ten sam mechanizm można wykorzystać przy reklamacjach, zwrotach i wielu innych sprawach, których trzeba pilnować przez dłuższy czas.

---

## 14. ORGANIZACJA PRACY — CO DALEJ

**Powiedzieć:**

I tutaj zaczynam widzieć jeszcze szersze zastosowanie.

Pracuję również nad systemem **zadań, zadań cyklicznych, kalendarza, powiadomień i tablic Kanban**.

Część tych mechanizmów już istnieje albo jest rozpoczęta, ale nie chcę dzisiaj robić z nich kolejnego dużego demo.

Mogłyby one pozwolić nam organizować nie tylko problemy, ale również normalną pracę.

Reklamacja może stać się sprawą, której system pilnuje aż do zakończenia.

Możemy mieć zadania jednorazowe.

Możemy mieć rzeczy cykliczne — na przykład miesięczną inwentaryzację albo kontrolę, którą trzeba wykonywać regularnie.

Możemy przypisywać odpowiedzialność i widzieć, co nadal pozostaje do zrobienia.

I nawet gdyby okazało się, że na przykład komunikacja doradców z działem części nie powinna odbywać się przez Ambrę, te same narzędzia nadal mogą być wartościowe **wewnątrz samego działu części**.

A w przyszłości potencjalnie również dla innych pracowników.

---

## 15. INNE KIERUNKI

**Powiedzieć:**

Są też kolejne obszary, nad którymi już częściowo pracowałem.

Na przykład:

- materiały eksploatacyjne,
- stany minimalne i docelowe,
- dostawcy,
- audyty,
- cykliczne kontrole,
- propozycje zamówień,
- w przyszłości potencjalnie VMI,
- kolejne procesy magazynowe.

Nie chcę jednak dzisiaj przekonywać, że wszystkie te rzeczy powinniśmy teraz wdrażać.

Wręcz przeciwnie.

Właśnie tutaj dochodzę do głównego powodu, dla którego chciałem zorganizować to spotkanie.

---

## 16. PROPOZYCJA PILOTAŻU

**Powiedzieć:**

Do tej pory Ambrę rozwijałem samodzielnie, we własnym czasie i głównie za własne środki.

Dzięki temu doszedłem do momentu, w którym mogę już nie tylko opowiadać o pomysłach, ale pokazać działające rozwiązania.

Natomiast dalsze rozwijanie systemu wyłącznie przeze mnie, na podstawie moich własnych założeń, zaczyna mieć coraz mniejszą wartość.

Mogę zbudować kolejne dziesięć funkcji.

Tylko pytanie brzmi: **czy to właśnie tych dziesięciu funkcji potrzebują użytkownicy?**

Dlatego chciałbym zaproponować **trzymiesięczny, ograniczony pilotaż Ambry na naszym oddziale** i poprosić firmę o zgodę na jego przeprowadzenie oraz wsparcie potrzebne do jego realizacji.

---

## 17. CEL PILOTAŻU

**Powiedzieć:**

Nie traktowałbym pilotażu jako kolejnych trzech miesięcy tworzenia aplikacji w ciemno.

To powinien być eksperyment w rzeczywistym środowisku pracy.

Chciałbym zobaczyć:

- jak korzystają z systemu inni częściowcy,
- jak reagują na niego doradcy,
- które funkcje rzeczywiście oszczędzają czas,
- które są niepotrzebne,
- które okazują się niewygodne,
- gdzie proces trzeba uprościć,
- jakie problemy pojawiają się dopiero przy kilku użytkownikach,
- oraz które z tych dalszych kierunków rzeczywiście mają największą wartość.

Pilot nie ma odpowiedzieć na pytanie:

**„Czy potrafię zbudować taką aplikację?”**

To już częściowo możemy dzisiaj zobaczyć.

Ma odpowiedzieć na pytanie:

**„Jaką wartość Ambra daje w rzeczywistej pracy i co trzeba zmienić, żeby była naprawdę użyteczna?”**

---

## 18. TRZY MIESIĄCE

### MIESIĄC 1 — PRZYGOTOWANIE

- środowisko produkcyjne,
- infrastruktura,
- backupy,
- monitoring,
- dopracowanie bezpieczeństwa i uprawnień,
- przygotowanie użytkowników,
- lokalizacji,
- etykiet,
- potrzebnych danych,
- przygotowanie wybranych procesów do realnego użycia.

### MIESIĄC 2 — REALNA PRACA

- prawdziwe dostawy,
- prawdziwe części,
- rzeczywiste lokalizacje,
- inni użytkownicy,
- stopniowe uruchamianie procesów,
- zbieranie feedbacku,
- obserwowanie problemów.

### MIESIĄC 3 — ITERACJE I OCENA

- poprawki wynikające z użytkowania,
- ponowne testowanie,
- ocena rezultatów,
- zebranie opinii zespołu,
- podsumowanie.

Na końcu chcę móc powiedzieć:

- co przyspieszyliśmy,
- co uprościliśmy,
- co ograniczyło liczbę błędów,
- czego użytkownicy nie chcą,
- czego im brakuje,
- i czy dalszy rozwój ma sens.

---

## 19. CO UZNAJEMY ZA SUKCES

**Powiedzieć:**

Nie chciałbym dzisiaj obiecywać, że jakiś proces będzie o 30 czy 40 procent szybszy.

Właśnie po to potrzebujemy pilota.

Sukcesem byłoby potwierdzenie, że:

- zmniejszamy liczbę ręcznych czynności,
- wybrane procesy wykonujemy łatwiej albo szybciej,
- ograniczamy możliwość błędów,
- informacja jest łatwiej dostępna,
- mniej rzeczy zależy od pamięci konkretnego pracownika,
- system jest wystarczająco prosty dla innych użytkowników,
- i przede wszystkim — że przy konkretnych procesach pracownicy **wolą używać Ambry niż wrócić do starego sposobu**.

---

## 20. BUDŻET PILOTAŻU

### SLAJD: **3 MIESIĄCE — 25 000 ZŁ**

**Powiedzieć:**

Żeby przeprowadzić taki pilotaż w sposób, który ma sens, chciałbym poprosić o budżet około **25 tysięcy złotych na cały trzymiesięczny okres**.

Nie jest to cena Ambry.

Nie jest to również finansowanie stworzenia projektu od początku — duża część tej pracy została już wykonana.

To jest budżet potrzebny do przejścia z projektu rozwijanego przeze mnie samodzielnie do kontrolowanego testowania go jako rzeczywistego narzędzia.

### PRZEDSTAW PODZIAŁ BUDŻETU ZGODNIE Z PRZYGOTOWANĄ WERSJĄ:

- sprzęt,
- infrastruktura i narzędzia,
- praca przy pilotażu poza obecnymi obowiązkami.

---

## 21. CO JEŚLI PILOT NIE POTWIERDZI ZAŁOŻEŃ?

**Powiedzieć:**

Chciałbym też jasno powiedzieć, że pilot nie musi zakończyć się decyzją o dalszym rozwijaniu całej Ambry.

Może się okazać, że część procesów daje dużą wartość, a inne nie.

Może się okazać, że tickety mają sens wewnątrz działu części, ale nie w komunikacji z doradcami.

Może się okazać, że najbardziej wartościowe będą lokalizacje i organizacja magazynu.

Albo że większą wartość dadzą zadania, reklamacje, audyty czy organizacja pracy.

A może się również okazać, że całość nie daje korzyści wystarczającej do dalszej inwestycji.

**To również jest wartościowy wynik pilotażu.**

Po trzech miesiącach mamy wtedy odpowiedź opartą na rzeczywistym użytkowaniu, a nie na moich założeniach.

---

## 22. CO JEŚLI PILOT SIĘ UDA?

**Powiedzieć:**

Jeżeli natomiast użytkownicy będą chcieli dalej korzystać z Ambry i będziemy potrafili wskazać konkretne korzyści, wtedy możemy ponownie usiąść do rozmowy.

Dopiero wtedy będziemy decydować:

- które procesy rozwijamy,
- które usuwamy,
- które dodatkowe moduły mają sens,
- czy rozszerzamy wykorzystanie w naszym oddziale,
- czy warto sprawdzić wybrany proces w kolejnym oddziale,
- i jaki powinien być dalszy model rozwoju.

Nie chciałbym podejmować tych decyzji dzisiaj.

**Najpierw zbierzmy dane.**

---

## 23. ZAMKNIĘCIE

**Powiedzieć:**

Podsumowując:

Ambra zaczęła się od mojego zainteresowania programowaniem.

Później pojawiło się proste pytanie:

**czy mogę wykorzystać to, co tworzę, do rozwiązania któregoś z rzeczywistych problemów, które mamy w pracy?**

Pierwszą odpowiedzią był SVWMS Matcher.

Zaczęliśmy od stosu dokumentów i ręcznego procesu.

Dzisiaj Matcher wykonuje dużą część tej pracy automatycznie i korzystamy z niego już od kilku miesięcy.

Później zacząłem wykorzystywać te same informacje dalej — do przyjęcia dostawy, rozłożenia jej na magazynie, zarządzania lokalizacjami, wyszukiwania części, reorganizacji magazynu, wydawania i zachowania historii.

Powstały też kolejne narzędzia związane z ticketami i organizacją pracy.

Mógłbym dalej rozwijać to sam i dodawać kolejne funkcje.

Ale uważam, że **to nie jest już właściwy następny krok**.

Następnym krokiem powinno być sprawdzenie tego z ludźmi, którzy rzeczywiście będą z tego korzystać.

Dlatego moja propozycja to:

**trzymiesięczny pilotaż Ambry na naszym oddziale z budżetem około 25 tysięcy złotych.**

Po trzech miesiącach wracamy do stołu z wynikami, opiniami użytkowników i konkretnymi doświadczeniami.

I wtedy wspólnie odpowiadamy na najważniejsze pytanie:

**czy Ambra rzeczywiście jest czymś, co warto dalej rozwijać?**

### KONIEC. NIE DODAWAJ KOLEJNEGO SLAJDU. ODDAJ GŁOS UCZESTNIKOM.
