# Ambra — analiza pracy działu części i mapa usprawnień

## Cel dokumentu

Ten dokument zbiera:

1. skonsolidowane pytania i odpowiedzi opisujące rzeczywisty sposób pracy działu części zamiennych w oddziale blacharsko-lakierniczym;
2. mapę: **proces → problem → konsekwencja → rozwiązanie w Ambrze**.

Dokument nie zawiera oceny aktualnego stanu wdrożenia. Każdy opisany obszar powinien zostać osobno zweryfikowany bezpośrednio w repozytorium Ambry, a następnie dopracowany, dokończony albo zaimplementowany.

---

# Część 1. Pytania i odpowiedzi

## A. Przebieg naprawy blacharsko-lakierniczej

### 1. Jak wygląda typowa naprawa od przyjęcia auta do wydania klientowi?

Doradca klienta spotyka się z klientem, wykonuje oględziny samochodu i przygotowuje dokumentację. Następnie sprawa trafia do działu kosztorysów. Kosztorysanci określają zakres naprawy i jej koszty, a kosztorys tworzony jest w platformie Omnet, obecnie SV Cloud.

Na podstawie kosztorysu dział części zamawia potrzebne elementy. Po ich dostarczeniu częściowcy odbierają dostawy, przyjmują je na magazyn, rozkładają i lokalizują.

Kiedy rozpoczyna się naprawa, części są wydawane blacharzowi albo przekazywane do lakierowania. Podczas naprawy często okazuje się, że potrzebne są dodatkowe elementy. Doradca wystawia wtedy dodatek w SV Cloud albo wysyła wiadomość e-mail z prośbą o domówienie części.

Po dotarciu dodatkowych części i zakończeniu prac samochód jest wydawany klientowi.

---

## B. Komunikacja z doradcami

### 2. Jak obecnie wygląda komunikacja pomiędzy doradcami i działem części?

Większość komunikacji odbywa się e-mailowo albo ustnie.

Doradcy powinni wysyłać wiadomości do wszystkich częściowców, ale często kierują je tylko do jednej osoby. Jeśli ta osoba jest zajęta, nie przeczyta wiadomości przed zakończeniem zmiany albo zapomni przekazać temat, pozostali pracownicy nie wiedzą o sprawie.

E-maile dotyczą najczęściej:

- brakujących albo opóźnionych części;
- pilnego domówienia części;
- przygotowania wydań;
- wydania materiałów lub normaliów pod faktury;
- zwrotów;
- reklamacji;
- zapytań do VGP o dostępność i termin dostawy.

Zespół stara się prowadzić komunikację e-mailowo, aby pozostawał pisemny dowód ustaleń.

### 3. Czy zdarzają się sytuacje, w których doradca uważa, że dział części miał coś zrobić, ale informacja nie dotarła do całego zespołu?

Tak. Najczęściej doradca wysłał wiadomość tylko do jednej osoby. Osoba ta była zajęta, zakończyła zmianę bez przeczytania wiadomości, a pozostali częściowcy nie otrzymali żadnej informacji.

### 4. Jakie informacje powinny być wspólnie widoczne?

Przede wszystkim tickety:

- nowe zgłoszenia;
- osoby, do których zgłoszenie jest skierowane;
- osoby odpowiedzialne;
- status sprawy;
- historia komentarzy;
- sprawy wymagające akceptacji;
- decyzja kierownika;
- oczekiwane następne działanie.

Tickety powinny być widoczne dla całego właściwego zespołu, nawet jeśli konkretną sprawę prowadzi jedna osoba.

---

## C. Zamawianie części

### 5. Jak wygląda zamawianie części do naprawy?

Pierwsze zamówienie wykonywane jest najczęściej na podstawie kosztorysu w SV Cloud lub Omnet. Rzadziej wykorzystywany jest kosztorys papierowy.

Jeżeli podczas naprawy okazuje się, że potrzebne są dodatkowe części, doradca:

- wystawia dodatek w SV Cloud;
- albo wysyła e-mail z prośbą o domówienie części.

Częściowcy regularnie sprawdzają pojawiające się dodatki i zamawiają brakujące elementy.

### 6. Jak śledzone są zamówienia i opóźnione części?

Informacje o zamówieniu i dostawie sprawdzane są w AutoStacji.

Nie istnieje osobny proces kontroli, czy część dotarła zgodnie z planowanym terminem. Najczęściej brak zostaje zauważony dopiero podczas przygotowania wydania, gdy okazuje się, że nie wszystkie pozycje są dostępne.

W przypadku dłuższego oczekiwania doradca może poprosić o wysłanie zapytania do VGP. Częściowiec sprawdza w AutoStacji dostępność u importera, a następnie pyta VGP, kiedy część pojawi się w Polsce.

### 7. Jak kontrolowane są zamówienia pochodzące od różnych dostawców?

Części do jednego samochodu przychodzą zasadniczo według marek, dlatego najczęściej pochodzą od tego samego źródła.

### 8. Jak sprawdzacie, czy wszystkie części do naprawy już dotarły?

Trzeba wejść do konkretnego zlecenia w AutoStacji i sprawdzić:

- co zostało zamówione;
- co już dotarło;
- czego nadal brakuje;
- jaka jest dostępność u importera.

Kompletność jest również sprawdzana podczas przygotowania dokumentu wydania WU.

---

## D. Dostawy

### 9. Jak wygląda proces przyjmowania dostawy?

Dostawy przyjmowane są za pomocą AutoStacji oraz programu SVWMS.

Po przyjęciu dokumentów części są odbierane ze śluzy, procesowane, dzielone według zleceń i rozkładane na regałach.

Pracownik sprawdza w AutoStacji, czy zlecenie ma już wpisaną lokalizację:

- jeśli tak, próbuje dołożyć nowe części w to samo miejsce;
- jeśli części się nie mieszczą, wybiera kolejne wolne miejsce i dopisuje lokalizację;
- jeśli lokalizacji nie ma, znajduje wolne miejsce i ręcznie wpisuje je w komentarzu zlecenia.

### 10. Jak zapisywane są lokalizacje części do zleceń?

AutoStacja nie ma wygodnego mechanizmu lokalizacji całych zleceń. Lokalizacje są wpisywane ręcznie w pole komentarza.

Powstają wpisy w rodzaju:

> A1, B2, C3, D4

Duże zlecenie może zajmować pięć lub sześć różnych miejsc. Komentarze stają się długie i trudne do aktualizacji.

### 11. Co dzieje się, gdy część jest błędna, uszkodzona albo brakuje jej w dostawie?

Zakładana jest reklamacja na portalu Customer Care VGP. Trzeba podać wymagane dane, między innymi numer dostawy i reklamowaną część.

Problemem jest późniejsze śledzenie odpowiedzi i terminu dalszego działania.

### 12. Jak sprawdzana jest kompletność zlecenia przed rozpoczęciem naprawy?

Najczęściej podczas przygotowania dokumentu WU w AutoStacji.

---

## E. Organizacja magazynu

### 13. Jakie rzeczy znajdują się na magazynie?

Na magazynie znajdują się:

- części przypisane do konkretnych zleceń;
- części wolne bez zlecenia;
- części cofnięte;
- części zdublowane;
- części możliwe do zarezerwowania pod inne zlecenia;
- części nierotujące;
- opony przypisane do zleceń;
- materiały zużywalne od zewnętrznych dostawców;
- materiały przychodzące z VGP;
- lakiery i materiały lakiernicze.

### 14. Czy istnieją osobne miejsca dla zwrotów, reklamacji i części problemowych?

W praktyce tak, ale nie są to formalnie zdefiniowane i oznaczone lokalizacje. Pracownicy sami uzgodnili między sobą, gdzie odkładać poszczególne grupy części.

### 15. Jak są oznaczone regały i półki?

Tylko część lokalizacji ma proste oznaczenia wydrukowane na zwykłych kartkach, na przykład „R13” albo „A”.

Nie są to spójne etykiety systemowe i nie zawierają kodów QR.

### 16. Jak wyglądają lokalizacje materiałów zużywalnych?

Materiały są rozłożone losowo w kilku szafach i na regałach. Nie mają stałych miejsc ani podziału według dostawców.

Jest ich od kilkudziesięciu do kilkuset pozycji.

---

## F. Wydawanie części

### 17. Kto pobiera części do naprawy?

Najczęściej blacharze. Czasami o przygotowanie wydania proszą doradcy albo mistrz zmiany.

### 18. Co dzieje się, gdy blacharz pobiera tylko część kompletu?

Tworzony jest dokument wydania wyłącznie na pobrane pozycje. Przykładowo blacharz może zabrać najpierw elementy wymagające gruntowania i lakierowania, a pozostałe części pobrać później.

### 19. Czy części są pobierane bez wiedzy działu części?

Tak. Pod nieobecność częściowców mistrz zmiany może wejść na magazyn i zabrać zlecenie bez utworzenia wydania.

Później pracownicy szukają części i nie wiedzą, kto je zabrał.

Zdarza się również przypadkowe przełożenie zlecenia albo błąd polegający na umieszczeniu go w innym miejscu niż wskazane w komentarzu AutoStacji.

### 20. Co dzieje się z niewykorzystaną częścią?

Po zatwierdzeniu zwrotu przez kierownika wykonywana jest korekta. Część wraca na stan dostępny i może zostać zarezerwowana pod inne zlecenie.

### 21. Kto odpowiada za część po jej wydaniu?

Jeśli część została sprawdzona, pozycje odhaczone, a osoba odbierająca podpisała wydanie, odpowiedzialność przechodzi na odbiorcę.

### 22. Jak przechowywane są dowody wydania?

Wydania są przechowywane papierowo w kartonach.

Jeżeli blacharz twierdzi, że nie otrzymał części, trzeba odnaleźć papierowe wydanie, na którym znajdują się odhaczone pozycje i podpis odbiorcy.

Jeżeli dokumenty nie są ułożone chronologicznie, odnalezienie konkretnego wydania jest bardzo trudne.

---

## G. Zwroty i reklamacje

### 23. Jak wygląda proces reklamacji?

Reklamacja lub zwrot zakładane są na portalu Customer Care VGP. Po wysłaniu zgłoszenia dział części czeka na odpowiedź.

Platforma nie zapewnia skutecznego powiadomienia o zmianie statusu. Pracownicy muszą ręcznie wchodzić do systemu i sprawdzać zgłoszenia.

### 24. Jakie ryzyko powoduje brak powiadomień?

Po zaakceptowaniu zwrotu lub reklamacji część musi zostać odesłana w określonym terminie.

Jeśli pracownicy zbyt późno zauważą odpowiedź, termin może upłynąć. Wtedy nawet wcześniej zaakceptowana sprawa może zostać odrzucona z powodu zbyt późnej wysyłki.

### 25. Dlaczego zwroty wymagają akceptacji kierownika?

Zwrot może spowodować pozostanie na magazynie części, która nie rotuje. Wpływa to na wyniki oddziału i pośrednio na wynagrodzenie kierownika.

Doradca wysyła prośbę o przyjęcie zwrotu, częściowiec przekazuje ją kierownikowi, sprawdzana jest rotacja części, a następnie kierownik wyraża zgodę albo odmawia.

---

## H. Organizacja pracy zespołu

### 26. Jak wyglądają zmiany pracowników?

Zmiany są ośmiogodzinne i nakładają się na siebie.

Dotychczas pracowały trzy osoby, docelowo mają pracować cztery.

Przykładowy podział:

- pracownik od 6:00 przygotowuje i przyjmuje dokumenty, obsługuje część dostaw oraz wykonuje materiałówki;
- pracownik od 7:00 odbiera przygotowane dokumenty, przynosi dostawę ze śluzy, przyjmuje ją i rozkłada;
- pracownik od 11:00 wykonuje pozostałe czynności, obsługuje mniejsze dostawy, e-maile, prośby doradców i problemy organizacyjne.

### 27. Jak przekazywane są zadania?

Głównie ustnie pomiędzy pracownikami, ponieważ zmiany częściowo się pokrywają.

Nie ma jednego widoku zadań ani formalnego procesu przekazywania tematów.

### 28. Skąd pracownicy wiedzą, co pozostało do wykonania?

Nie ma formalnego grafiku, procedur ani wspólnego zestawienia.

Zdarzają się przeoczenia i pomyłki.

### 29. Czy są sprawy, przy których nie wiadomo, kto się nimi zajmuje?

Tak. Przykładowo jedna osoba mogła zamówić część na podstawie wiadomości od doradcy, a później inny doradca pyta inną osobę o status sprawy. Wtedy trzeba ustalać, kto realizował temat.

### 30. Czy kierownik ma wspólny widok wykonanych, zaległych i zablokowanych zadań?

Nie.

---

## I. Zadania cykliczne

### 31. Jakie cykliczne zadania istnieją obecnie?

Obecnie regularnie wykonywane są przede wszystkim:

- cotygodniowa kontrola stanów lakierów;
- zamawianie lakierów;
- comiesięczna inwentaryzacja lakierów.

### 32. Jakie inne zadania mogłyby być cykliczne?

Po wdrożeniu odpowiedniego narzędzia można byłoby utworzyć więcej powtarzalnych procedur, na przykład:

- audyty materiałów według dostawcy;
- przegląd reklamacji;
- kontrola części bez lokalizacji;
- kontrola części nierotujących;
- przegląd części oczekujących na decyzję;
- kontrola materiałów poniżej minimum.

---

## J. Materiały zużywalne i dostawcy

### 33. Jak obecnie kontrolowane są stany materiałów zużywalnych?

W praktyce nie są kontrolowane systemowo.

Blacharze i lakiernicy mogą wejść do magazynu i zabrać materiał bez odnotowania pobrania, również wtedy, gdy nie ma żadnego częściowca.

Stan jest oceniany „na oko”.

### 34. Kiedy wykrywany jest brak?

Najczęściej dopiero wtedy, gdy ktoś potrzebuje danego materiału i okazuje się, że nie ma go w szafie.

Osoba zabierająca ostatnią sztukę nie ma obowiązku zgłoszenia niskiego stanu.

### 35. Kto zamawia materiały?

Zamówieniami zajmuje się kierownik oddziału, ponieważ posiada kontakty do dostawców.

Częściowcy obserwują stany orientacyjnie i informują kierownika, gdy zauważą brak albo niski stan.

Zamówienia są składane telefonicznie.

### 36. Jak wygląda współpraca z przedstawicielem Normfest?

Przedstawiciel przyjeżdża z własną aplikacją VMI, ale po stronie oddziału nie ma uporządkowanych lokalizacji ani wiarygodnych stanów.

Podczas wizyty pracownicy chodzą z przedstawicielem po całym magazynie i wspólnie oceniają „na oko”, czego jest mało.

### 37. Czy każde pobranie materiału może być rejestrowane skanerem?

Na obecnym etapie nie jest to realistyczne.

W przyszłości planowane są automaty lub szafy wymagające identyfikacji pracownika, ale prawdopodobnie będą dotyczyć tylko części najdroższych materiałów.

### 38. Jak powinien wyglądać realny model kontroli materiałów?

- uporządkowanie produktów według dostawców;
- utworzenie stałych lokalizacji;
- przypisanie materiałów do tych lokalizacji;
- regularne audyty według dostawcy lub lokalizacji;
- ręcznie ustalony stan minimalny;
- ręcznie ustalony stan docelowy;
- lista sugerowanych zamówień.

Audyty wykonywałby jeden z częściowców, zależnie od grafiku, zmiany i obciążenia danego dnia.

Częściowcy sami planowaliby terminy audytów.

---

## K. AutoStacja i systemy pomocnicze

### 39. Co w AutoStacji działa wystarczająco dobrze?

AutoStacja powinna pozostać systemem wykorzystywanym do procesów, które już dobrze obsługuje.

Ambra nie powinna kopiować funkcji tylko po to, aby wykonywać tę samą pracę drugi raz.

### 40. Jakie obszary AutoStacji są szczególnie problematyczne?

- lokalizacje zleceń;
- brak skanowania lokalizacji;
- konieczność wpisywania wielu lokalizacji w komentarzu;
- wyszukiwanie części nierotujących;
- sprawdzanie rotacji tej samej części na innych oddziałach;
- brak operacyjnego widoku spraw i zadań;
- brak wygodnego śledzenia procesów wykonywanych poza AutoStacją.

### 41. Jakie dane powinny być przenoszone z AutoStacji do Ambry?

Na początek przede wszystkim numer zlecenia.

Przydatne mogłyby być także:

- lista wcześniejszych zamówień;
- lista części w zamówieniach;
- eksport wolnych części;
- eksport materiałów;
- raporty potrzebne do przygotowania inwentaryzacji;
- dane o częściach nierotujących.

Nie jest pożądane silne łączenie obu systemów na początkowym etapie.

---

## L. SVWMS Matcher

### 42. Jaki problem rozwiązuje SVWMS Matcher?

Dostawy trafiają najpierw na wspólny magazyn BC 415 oraz bufor Audi, a później są rozsyłane na:

- magazyn 115 — Volkswagen i marki obce;
- magazyn 315 — Škoda;
- magazyn 515 — SEAT.

Dokumenty z BC zawierają numery WDD, ale nie zawierają numerów zleceń. Dokumenty realokacji dla poszczególnych marek zawierają numery zleceń, ale nie zawierają numerów WDD.

### 43. Jak wyglądał proces wcześniej?

Trzeba było wydrukować cztery dokumenty, ręcznie odnaleźć odpowiadające sobie pozycje i długopisem dopisywać numery zleceń na dokumencie z BC.

### 44. Jak działa narzędzie obecnie?

Ambra przyjmuje cztery dokumenty, parsuje je, dopasowuje numery WDD do zleceń i generuje nowy dokument zawierający:

- bloki dostaw;
- listy części;
- numery WDD;
- numery zleceń.

Narzędzie już teraz znacząco przyspiesza proces przyjmowania dostaw.

---

## M. Części nierotujące

### 45. Jak wygląda obecna praca z częściami nierotującymi?

Najpierw generowana jest lista części zalegających na magazynie dłużej niż pół roku.

Następnie każdą część trzeba osobno wyszukać na innych oddziałach i sprawdzić, czy tam rotuje.

Jeżeli część nie rotuje w danym oddziale, ale jest często używana w innym, pracownicy kontaktują się z tamtym oddziałem i próbują przekazać mu część.

### 46. Dlaczego jest to ważne dla kierownika i dyrektora?

Zmniejszenie wartości i liczby części nierotujących jest ważnym wskaźnikiem dla kierownictwa.

Dyrektor szczególnie koncentruje się na ograniczaniu zapasu zalegającego ponad pół roku.

### 47. Jak obecnie analizowane są nieroty?

Wykorzystywany jest arkusz Excel nazywany „Combo”.

Raport eksportowany z AutoStacji jest wczytywany do Excela przez Power Query. Arkusz analizuje, które części zalegają i od ilu dni.

---

## N. Brak procedur

### 48. Czy istnieją formalne procedury pracy?

W praktyce nie.

Pracownicy są w dużej mierze samoukami. Sposób realizacji zadań został:

- przejęty od starszych pracowników;
- wypracowany samodzielnie;
- dostosowany do lokalnych warunków oddziału.

Nie ma instrukcji krok po kroku dla większości procesów.

### 49. Czy różne oddziały pracują tak samo?

Nie.

Oddziały korzystają z różnych narzędzi, mają różne przepływy pracy i różne lokalne metody.

Niektóre usprawnienia stosowane w Komornikach nie są znane albo wykorzystywane w innych oddziałach.

---

## O. Najczęściej powtarzające się problemy

### 50. Jakie problemy wracają najczęściej?

- szukanie części na magazynie;
- brak wpisanej lokalizacji;
- część znajdująca się w innym miejscu niż podane w komentarzu;
- zlecenie rozłożone w kilku miejscach;
- przełożenie części bez aktualizacji komentarza;
- część odłożona przed wprowadzeniem faktury;
- część bez zlecenia i bez lokalizacji;
- nieuporządkowane części wolne;
- części nierotujące;
- brak kontroli materiałów zużywalnych;
- wykrywanie braków dopiero przy zerowym stanie;
- brak jasnego właściciela sprawy;
- przeoczone e-maile i zadania;
- brak terminowego monitorowania reklamacji.

---

## P. Jak ocenić, czy Ambra pomogła?

### 51. Po czym można poznać skuteczność Ambry?

- krótszy czas przyjmowania dostaw;
- mniej ręcznego przepisywania danych;
- mniej błędów w lokalizacjach;
- szybsze odnajdywanie części;
- mniej zleceń bez lokalizacji;
- wspólna komunikacja w ticketach zamiast pojedynczych e-maili;
- możliwość ustalenia, kto prowadzi sprawę;
- łatwiejsze dokumentowanie decyzji i akceptacji;
- szybsze odnajdywanie dowodów wydania;
- terminowe monitorowanie reklamacji;
- regularne audyty materiałów;
- mniej nagłych braków;
- gotowe listy zamówień;
- ograniczenie części nierotujących;
- przejrzyste przekazywanie pracy pomiędzy zmianami.

---

# Część 2. Mapa procesów i rozwiązań

## 1. Przyjmowanie dokumentów dostawy

### Proces

Pracownik korzysta z dokumentów SVWMS pochodzących z BC oraz magazynów marek. Dokumenty zawierają różne zestawy informacji.

### Problem

- dokument BC ma numer WDD, ale nie ma numeru zlecenia;
- dokument marki ma numer zlecenia, ale nie ma numeru WDD;
- wcześniej dokumenty musiały być ręcznie dopasowywane.

### Konsekwencja

- drukowanie wielu dokumentów;
- ręczne wyszukiwanie odpowiadających sobie pozycji;
- dopisywanie numerów zleceń;
- ryzyko pomyłki;
- wydłużenie przyjęcia dostawy.

### Rozwiązanie w Ambrze

SVWMS Matcher powinien:

- przyjmować wszystkie potrzebne dokumenty;
- parsować ich zawartość;
- dopasowywać numery WDD i zleceń;
- wykrywać pozycje niedopasowane;
- generować jeden uporządkowany dokument;
- zapisywać historię przetworzenia;
- umożliwiać przejście bezpośrednio do procesu rozlokowania dostawy.

---

## 2. Rozkładanie dostawy na magazynie

### Proces

Pracownik sprawdza komentarz zlecenia w AutoStacji, szuka wcześniejszej lokalizacji, odkłada część, wraca do komputera i ręcznie dopisuje lokalizację.

### Problem

- lokalizacje są przechowywane w komentarzu tekstowym;
- jedno zlecenie może znajdować się w wielu miejscach;
- pracownik musi wielokrotnie wracać do komputera;
- nie ma wymuszenia wskazania lokalizacji.

### Konsekwencja

- długie komentarze;
- zapomniane wpisy;
- nieaktualne lokalizacje;
- wolniejsze rozkładanie dostawy;
- trudność w ustaleniu, które części znajdują się w którym miejscu;
- późniejsze szukanie części.

### Rozwiązanie w Ambrze

Mobilny proces rozkładania dostawy:

1. Ambra odczytuje dostawę z SVWMS Matcher.
2. System zna części oraz przypisane do nich numery zleceń.
3. Pracownik tworzy lub wybiera kontener.
4. Wskazuje, które części trafiają do danego kontenera.
5. Skanuje kod QR kontenera.
6. Skanuje kod QR lokalizacji.
7. Ambra zapisuje powiązanie: zlecenie, część, kontener, lokalizacja, użytkownik oraz data i godzina.
8. System nie pozwala zakończyć procesu, jeśli część nie ma przypisanej lokalizacji.

---

## 3. Wyszukiwanie części i zleceń

### Proces

Pracownik otwiera zlecenie w AutoStacji i odczytuje lokalizacje wpisane w komentarzu.

### Problem

- komentarz może być nieaktualny;
- część może znajdować się w kilku miejscach;
- nie wiadomo, które elementy leżą w której lokalizacji;
- część mogła zostać przełożona;
- część może nie mieć wpisanej lokalizacji.

### Konsekwencja

- czasochłonne poszukiwania;
- przestoje przy wydaniu;
- spory o to, czy część znajdowała się na magazynie;
- ryzyko ponownego zamówienia części, która już jest w oddziale;
- trudność w przekazywaniu pracy między zmianami.

### Rozwiązanie w Ambrze

Wyszukiwanie po:

- numerze zlecenia;
- SKU;
- numerze katalogowym;
- nazwie części;
- lokalizacji;
- kontenerze;
- kodzie QR.

Widok zlecenia powinien pokazywać:

- wszystkie części;
- status dostawy;
- ilość;
- kontener;
- lokalizację;
- historię przeniesień;
- informację o wydaniu;
- pozycje bez lokalizacji;
- pozycje wydane częściowo.

---

## 4. Pobranie części bez wiedzy działu części

### Proces

Mistrz albo inny pracownik może wejść na magazyn pod nieobecność częściowców i zabrać części bez utworzenia wydania.

### Problem

Nie pozostaje żaden ślad pobrania.

### Konsekwencja

- częściowcy szukają zlecenia;
- nie wiadomo, kto je pobrał;
- lokalizacja pozostaje nieaktualna;
- mogą wystąpić spory dotyczące wydania;
- pracownicy tracą czas na dochodzenie, co się wydarzyło.

### Rozwiązanie w Ambrze

Minimalny proces awaryjnego pobrania:

- zeskanowanie numeru zlecenia lub kontenera;
- wskazanie osoby pobierającej;
- szybkie wydanie;
- możliwość dodania zdjęcia albo podpisu;
- zapis daty i godziny;
- aktualizacja statusu lokalizacji;
- automatyczna historia operacji;
- możliwość późniejszego odnalezienia wydania.

---

## 5. Papierowe wydania

### Proces

Podpisane dokumenty wydań są przechowywane w kartonach.

### Problem

Trudno znaleźć dokument potwierdzający, że konkretna część została odebrana.

### Konsekwencja

- czasochłonne przeszukiwanie dokumentów;
- trudność w udowodnieniu wydania;
- zależność od prawidłowego ręcznego ułożenia papierów;
- utrudnione rozstrzyganie sporów.

### Rozwiązanie w Ambrze

Cyfrowe archiwum wydania:

- numer zlecenia;
- data;
- odbiorca;
- lista pozycji;
- zdjęcie podpisanego dokumentu;
- komentarz;
- historia;
- możliwość wyszukania po części, zleceniu i osobie;
- obsługa wydań częściowych i wielokrotnych.

---

## 6. Komunikacja doradca–części

### Proces

Doradcy wysyłają e-maile, czasem tylko do jednego częściowca. Część ustaleń odbywa się ustnie.

### Problem

Informacja nie jest przypisana do wspólnej kolejki ani procesu.

### Konsekwencja

- pozostali pracownicy nie znają sprawy;
- wiadomość może zostać nieprzeczytana;
- nie wiadomo, kto odpowiada;
- trzeba przeszukiwać skrzynki;
- sprawa może przepaść po zakończeniu zmiany;
- brak jednolitej historii działań.

### Rozwiązanie w Ambrze

Help Desk jako wspólny system zgłoszeń:

- typ zgłoszenia;
- priorytet;
- numer zlecenia;
- osoba zgłaszająca;
- osoby przypisane;
- termin;
- komentarze;
- historia zmian;
- status;
- wymagana akceptacja;
- lista osób uprawnionych do akceptacji;
- widok „oczekuje na moje działanie”;
- kolejki według zespołu;
- powiadomienia o nowych komentarzach i zmianie statusu.

Przykładowe typy zgłoszeń:

- domówienie części;
- zapytanie o termin;
- zwrot;
- reklamacja;
- wydanie;
- brak części;
- decyzja kierownika.

---

## 7. Zwroty wymagające zgody kierownika

### Proces

Doradca wysyła e-mail. Częściowiec przekazuje temat kierownikowi. Sprawdzana jest rotacja. Kierownik podejmuje decyzję.

### Problem

Proces jest rozproszony między e-mailami i rozmowami.

### Konsekwencja

- nie wiadomo, na czyją decyzję czeka sprawa;
- prośba może trafić tylko do jednego pracownika;
- brak przejrzystej historii akceptacji;
- brak powiązania części z fizycznym miejscem oczekiwania;
- zwrot może zostać przeoczony.

### Rozwiązanie w Ambrze

Ticket typu „Zwrot” zawierający:

- część;
- numer zlecenia;
- powód zwrotu;
- informację o rotacji;
- wartość;
- zdjęcia;
- lokalizację oczekiwania;
- wymaganego akceptanta;
- decyzję;
- komentarz kierownika;
- termin dalszego działania;
- status procesu zwrotu;
- możliwość wydrukowania etykiety QR;
- możliwość przypisania części do lokalizacji poprzez skanowanie.

---

## 8. Reklamacje Customer Care VGP

### Proces

Reklamacja jest zakładana w zewnętrznym portalu. Pracownicy ręcznie sprawdzają, czy pojawiła się odpowiedź.

### Problem

Brak skutecznych powiadomień oraz wewnętrznego monitorowania terminu.

### Konsekwencja

- możliwość przeoczenia odpowiedzi;
- zaakceptowana reklamacja może zostać odrzucona z powodu późnego odesłania;
- utrata czasu i pieniędzy;
- brak widoku wszystkich otwartych reklamacji;
- niejasna odpowiedzialność za kolejne działanie.

### Rozwiązanie w Ambrze

Równoległy ticket w Ambrze:

- link do Customer Care;
- numer reklamacji;
- część;
- numer zlecenia;
- data założenia;
- osoba prowadząca;
- status ręcznie aktualizowany;
- termin następnej kontroli;
- termin odesłania;
- przypomnienia;
- załączniki;
- zdjęcia;
- dashboard otwartych reklamacji;
- widok reklamacji wymagających działania.

---

## 9. Powtarzalne zadania

### Proces

Zadania cykliczne są zapamiętywane lub wykonywane według przyzwyczajeń.

### Problem

Brak wspólnego mechanizmu planowania i powtarzalności.

### Konsekwencja

- audyty i kontrole mogą być pomijane;
- brak stałego rytmu pracy;
- trudność w przypisaniu zadania do osoby dostępnej danego dnia;
- brak historii wykonania;
- trudność w przekazywaniu odpowiedzialności.

### Rozwiązanie w Ambrze

Zadanie cykliczne powinno obsługiwać:

- częstotliwość;
- dzień tygodnia;
- datę rozpoczęcia;
- datę końca;
- przypisanie domyślne lub ręczne;
- generowanie kolejnych wystąpień;
- przypomnienie;
- historię wykonania;
- możliwość powiązania z audytem lub ticketem;
- edycję jednego wystąpienia lub całej serii;
- możliwość pominięcia;
- widok wykonania całej serii.

---

## 10. Materiały zużywalne

### Proces

Materiały są rozmieszczone losowo, pobierane bez rejestracji, a stan oceniany orientacyjnie.

### Problem

Brak stałych lokalizacji, spisu, stanów minimalnych i regularnych audytów.

### Konsekwencja

- nagłe braki;
- przestoje;
- pilne telefony do kierownika;
- przypadkowe wielkości zamówień;
- czasochłonne wizyty przedstawicieli;
- brak danych o rzeczywistym zapasie.

### Rozwiązanie w Ambrze

- katalog materiałów;
- przypisanie dostawcy;
- stała lokalizacja;
- kod kreskowy lub QR;
- stan minimalny;
- stan docelowy;
- punkt ponownego zamówienia;
- sugerowana ilość;
- audyt według dostawcy;
- audyt według lokalizacji;
- mobilne liczenie;
- lista zamówienia według dostawcy;
- możliwość zaakceptowania lub odrzucenia sugestii;
- historia wcześniejszych audytów i zamówień;
- możliwość planowania cyklicznych audytów.

---

## 11. Lakiery

### Proces

Stany lakierów są sprawdzane raz w tygodniu, a pełna inwentaryzacja wykonywana jest raz w miesiącu.

### Problem

Proces wymaga samodzielnego pilnowania terminów i korzysta z odrębnych narzędzi.

### Konsekwencja

- ryzyko pominięcia kontroli;
- brak wspólnego miejsca dla wyników;
- brak historii wykonanych kontroli w jednym systemie;
- trudność w porównywaniu kolejnych okresów.

### Rozwiązanie w Ambrze

- cykliczne zadanie;
- lista lakierów;
- audyt;
- zapis różnic;
- raport;
- sugerowane zamówienie;
- potwierdzenie wykonania;
- historia miesięcznych wyników;
- możliwość powiązania z kalendarzem i osobą odpowiedzialną.

---

## 12. Części nierotujące

### Proces

Raport z AutoStacji jest analizowany w arkuszu Combo. Następnie każda część jest ręcznie sprawdzana na innych oddziałach.

### Problem

- dane znajdują się w Excelu;
- analiza innych oddziałów jest ręczna;
- brak jednej kolejki działań;
- brak informacji, z kim już się kontaktowano;
- brak statusu części;
- brak historii działań.

### Konsekwencja

- dużo czasu poświęconego na wyszukiwanie;
- trudność w systematycznej redukcji nierotów;
- brak widocznego postępu;
- części nadal zwiększają wartość zapasu;
- kierownictwo nie widzi, jakie działania zostały podjęte.

### Rozwiązanie w Ambrze

Import raportu nierotów i utworzenie procesu obejmującego:

- część;
- liczbę dni bez rotacji;
- wartość;
- lokalizację;
- dostępność na oddziale;
- rotację na innych oddziałach;
- sugerowany oddział;
- osobę prowadzącą;
- status kontaktu;
- wynik;
- termin ponownego działania;
- historię kontaktów;
- raport zmniejszenia nierotów.

---

## 13. Procedury i wiedza operacyjna

### Proces

Pracownicy uczą się od innych osób albo wypracowują własne metody.

### Problem

Brak jednolitych instrukcji i standardu między oddziałami.

### Konsekwencja

- różna jakość pracy;
- zależność od doświadczenia konkretnej osoby;
- trudne wdrażanie nowego pracownika;
- utrata wiedzy przy odejściu pracownika;
- inne procesy w każdym oddziale;
- trudność w powielaniu najlepszych praktyk.

### Rozwiązanie w Ambrze

Baza procedur powiązana z procesami:

- instrukcja krok po kroku;
- wymagane dane;
- odpowiedzialna rola;
- checklista;
- załączniki;
- wersje procedury;
- potwierdzenie zapoznania;
- link z ticketu lub zadania do instrukcji;
- możliwość kopiowania procedury między oddziałami;
- tryb szkoleniowy dla nowych pracowników.

---

## 14. Dashboard operacyjny

### Proces

Nie istnieje jeden widok pracy działu.

### Problem

Informacje są rozproszone między e-mailami, AutoStacją, SV Cloud, Customer Care, dokumentami i pamięcią pracowników.

### Konsekwencja

- brak wspólnego obrazu dnia;
- trudność w przekazaniu zmiany;
- kierownik musi pytać pracowników;
- brak widoczności blokad i terminów;
- trudność w ustaleniu priorytetów.

### Rozwiązanie w Ambrze

Dashboard działu części powinien pokazywać:

- nowe tickety;
- pilne sprawy;
- oczekujące akceptacje;
- reklamacje z terminem;
- zadania na dziś;
- zadania zaległe;
- części bez lokalizacji;
- dostawy do rozłożenia;
- zlecenia niekompletne;
- materiały poniżej minimum;
- ostatnie audyty;
- części nierotujące wymagające działania.

Każda karta powinna prowadzić bezpośrednio do wykonania konkretnej czynności.

---

## 15. Minimalne zlecenie warsztatowe

### Proces

Ambra ma uzupełniać AutoStację, a nie ją zastępować.

### Problem

Bez minimalnego modelu zlecenia trudno powiązać ze sobą części, lokalizacje, kontenery, wydania, tickety, załączniki i historię.

### Konsekwencja

- procesy pozostają rozdzielone;
- trudno wyszukać wszystkie informacje dotyczące jednego zlecenia;
- nie można stworzyć spójnej osi czasu.

### Rozwiązanie w Ambrze

Minimalne zlecenie warsztatowe oparte przede wszystkim na numerze zlecenia z AutoStacji.

Powinno umożliwiać powiązanie:

- listy części;
- wcześniejszych zamówień;
- lokalizacji;
- kontenerów;
- wydań;
- ticketów;
- reklamacji;
- zwrotów;
- zdjęć;
- historii działań.

Na początkowym etapie nie powinno kopiować całej logiki AutoStacji.

---

## 16. Kontenery i jednostki kompletacyjne

### Proces

Jedno zlecenie może być rozłożone w kilku miejscach, ponieważ wszystkie części nie mieszczą się razem.

### Problem

Nie ma jednoznacznego powiązania pomiędzy konkretną grupą części a miejscem, w którym została odłożona.

### Konsekwencja

- długie listy lokalizacji;
- trudność w ustaleniu, które części znajdują się w którym miejscu;
- ryzyko niepełnego wydania;
- łatwiejsze przełożenie części bez aktualizacji informacji.

### Rozwiązanie w Ambrze

Kontener jako jednostka kompletacyjna:

- własny kod QR;
- przypisanie do zlecenia;
- lista zawartych części;
- aktualna lokalizacja;
- historia lokalizacji;
- status;
- możliwość częściowego wydania;
- możliwość przeniesienia przez ponowne skanowanie;
- możliwość utworzenia kilku kontenerów dla jednego zlecenia.

---

## 17. Etykiety QR i lokalizacje

### Proces

Tylko część regałów i półek ma proste oznaczenia wydrukowane na kartkach.

### Problem

Oznaczenia są niespójne, nie są połączone z systemem i nie umożliwiają skanowania.

### Konsekwencja

- ręczne wpisywanie lokalizacji;
- pomyłki;
- niejednolite nazewnictwo;
- trudność w szybkiej identyfikacji miejsca;
- brak automatyzacji procesów magazynowych.

### Rozwiązanie w Ambrze

- pełna struktura lokalizacji;
- spójne nazwy i kody;
- generowanie etykiet;
- kod QR na każdej lokalizacji;
- możliwość skanowania telefonem;
- druk seryjny;
- możliwość oznaczenia kontenerów, zwrotów, reklamacji i części problemowych;
- szybkie przejście z kodu do widoku lokalizacji.

---

## 18. Import danych z AutoStacji

### Proces

AutoStacja pozostaje głównym systemem dla zamówień, dokumentów i stanów księgowych.

### Problem

Ambra potrzebuje wybranych danych, ale nie powinna wymagać podwójnego wykonywania pracy.

### Konsekwencja

- ryzyko dublowania procesów;
- dodatkowe wpisywanie danych;
- niechęć użytkowników;
- większe ryzyko rozbieżności.

### Rozwiązanie w Ambrze

Na początek importować wyłącznie dane potrzebne operacyjnie:

- numer zlecenia;
- listę wcześniejszych zamówień;
- listę części w zamówieniach;
- listę wolnych części;
- listę materiałów;
- raport nierotów;
- raporty przygotowujące inwentaryzację.

Import powinien być możliwie prosty i oparty na plikach eksportowanych z AutoStacji, bez kopiowania całej logiki systemu.

---

## 19. VMI jako etap późniejszy

### Proces

Materiały zużywalne są obecnie kontrolowane ręcznie, a zamówienia składane telefonicznie.

### Problem

Brak uporządkowanej bazy, lokalizacji i wiarygodnych stanów uniemożliwia pełne wykorzystanie VMI.

### Konsekwencja

- przedstawiciel nadal musi chodzić po magazynie;
- zamówienia opierają się na ocenie „na oko”;
- system dostawcy nie rozwiązuje problemu organizacyjnego po stronie oddziału.

### Rozwiązanie w Ambrze

Najpierw:

- uporządkować katalog materiałów;
- przypisać dostawców;
- utworzyć lokalizacje;
- ustawić stany minimalne i docelowe;
- wykonywać regularne audyty;
- generować listy zamówień.

Dopiero później rozwijać pełne VMI obejmujące:

- prawdziwy backend;
- konta klientów i dostawców;
- propozycje zamówień;
- zamówienia;
- komunikację;
- historię;
- powiązanie z Warehouse.

---

# Część 3. Zasady dalszej pracy nad wdrożeniem

Dla każdego obszaru należy:

1. zweryfikować aktualny kod i migracje;
2. sprawdzić działający interfejs;
3. ustalić, czy funkcja jest kompletna procesowo;
4. wykryć brakujące połączenia między modułami;
5. zdefiniować minimalny zakres MVP;
6. rozpisać kryteria akceptacji;
7. dodać testy jednostkowe, integracyjne i E2E;
8. wdrożyć funkcję za feature flagą;
9. sprawdzić ją na rzeczywistym procesie oddziału;
10. dopiero po weryfikacji oznaczyć jako gotową do pilotażu.

---

# Część 4. Najważniejsze założenia produktowe

- Ambra nie ma zastępować AutoStacji.
- Ambra ma eliminować ręczne czynności i luki pomiędzy istniejącymi systemami.
- Każda nowa funkcja musi skracać lub upraszczać pracę, a nie tworzyć dodatkowe obowiązki.
- Numer zlecenia z AutoStacji powinien być podstawowym identyfikatorem łączącym procesy.
- System powinien być mobile-first dla pracy magazynowej.
- Skanowanie powinno zastępować ręczne wpisywanie tam, gdzie jest to możliwe.
- Tickety powinny zastępować rozproszoną komunikację e-mailową w procesach operacyjnych.
- Audyty powinny umożliwiać kontrolę materiałów bez konieczności rejestrowania każdego pobrania.
- Wszystkie operacje powinny pozostawiać historię użytkownika, czasu i zmiany.
- Dashboard powinien pokazywać działania wymagające uwagi, a nie dekoracyjne statystyki.
