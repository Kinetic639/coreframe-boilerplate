# Ambra — pełny scenariusz prezentacji (wizja docelowa, wszystkie 19 obszarów)

## Uwaga na start

**To NIE jest scenariusz tego, co działa dzisiaj.** To jest scenariusz na wypadek, gdyby wszystkie 19 obszarów z `docs/mvp-readiness-pt.md` było ukończonych i gotowych do prezentacji — czyli pełna wizja produktu, jaką opisuje `docs/mvp-readiness-plan.md`. Stan faktyczny na dziś: 2 z 19 obszarów są zweryfikowane jako gotowe (patrz `docs/mvp-readiness-pitch-script.md` — to jest scenariusz do faktycznego użycia teraz). Ten dokument służy do:

- planowania, jak będzie wyglądać docelowa prezentacja, gdy kolejne obszary zostaną ukończone;
- oceny, w jakiej kolejności warto opowiadać historię produktu;
- ewentualnej prezentacji inwestorskiej opartej na wizji, wyraźnie oznaczonej jako plan/roadmapa, a nie stan bieżący.

**Nie używaj tego scenariusza tak, jakby wszystko w nim opisane już działało.** Przed każdym pokazywanym elementem sprawdź jego rzeczywisty status w `docs/mvp-readiness-pt.md`.

Kolejność poniżej odpowiada numeracji **Części 2** dokumentu `docs/mvp-readiness-plan.md` (proces → problem → rozwiązanie), czyli naturalnemu przebiegowi pracy w oddziale — nie kolejności wdrożeniowej z trackera (która jest ułożona według zależności technicznych, nie narracji).

Postacie z `docs/mvp-readiness-test-org-setup.md`: **Anna Kowalska** (kierownik/administrator), **Piotr Nowak** i **Tomasz Kowalczyk** (częściowcy), **Marek Wiśniewski** (doradca klienta). Do pełnej wizji dodatkowo: **Dyrektor** (rola przeglądowa, skupiona na wskaźnikach części nierotujących i wynikach oddziałów) — w praktyce może to być ten sam widok co kierownika, z innym naciskiem narracyjnym.

---

## 0. Otwarcie (ok. 1 minuta)

Bez logowania. Kontekst z rozmów z zespołem (`docs/mvp-readiness-plan.md`, Część 1): rozproszona komunikacja e-mailowa, ręcznie zapisywane lokalizacje, papierowe wydania, brak wspólnego obrazu dnia pracy działu części. Zapowiedź: pokażemy pełny cykl — od przyjęcia dostawy, przez wydanie części, po zwroty, reklamacje i zarządzanie zapasem — jednym systemem.

---

## 1. Przyjmowanie dokumentów dostawy (SVWMS Matcher)

**[Piotr Nowak — częściowiec]**

1. Wgraj cztery dokumenty dostawy (BC + trzy magazyny markowe) do SVWMS Matcher.
2. → System automatycznie dopasowuje numery WDD do numerów zleceń, oznacza pozycje niedopasowane do ręcznej korekty.
3. → Wynik: jeden uporządkowany dokument, gotowy do przejścia bezpośrednio do rozkładania dostawy — bez drukowania czterech papierów i ręcznego przepisywania numerów długopisem.

## 2. Rozkładanie dostawy na magazynie

**[Piotr Nowak]**

1. Z wyniku matchera otwórz proces rozkładania — system już zna części i przypisane do nich zlecenia.
2. Utwórz kontener, zeskanuj jego kod QR, zeskanuj kod QR lokalizacji docelowej.
3. → System zapisuje pełne powiązanie: zlecenie, część, kontener, lokalizacja, kto i kiedy — i nie pozwala zakończyć procesu, jeśli jakaś część nie ma przypisanej lokalizacji.

## 3. Wyszukiwanie części i zleceń

**[Marek Wiśniewski — doradca, dzwoni klient pytający o status]**

1. Wyszukaj po numerze zlecenia, SKU, numerze katalogowym, lokalizacji, kontenerze lub kodzie QR.
2. → Widok zlecenia pokazuje wszystkie części, status dostawy, kontener, lokalizację, historię przeniesień i informację o wydaniu — częściowym lub pełnym.
3. → Odpowiedź klientowi w kilka sekund, nie po przeszukaniu komentarzy w AutoStacji.

## 4. Pobranie części bez wiedzy działu części (tryb awaryjny)

**[Mistrz zmiany, pod nieobecność częściowców]**

1. Zeskanuj numer zlecenia lub kontenera, wskaż siebie jako osobę pobierającą, wybierz pobierane części.
2. → System zapisuje datę, godzinę, aktualizuje status lokalizacji, umożliwia dodanie zdjęcia lub podpisu potwierdzenia.
3. → Częściowcy następnego dnia widzą dokładnie, co i kto pobrał — zero zgadywania.

## 5. Papierowe wydania → cyfrowe archiwum

**[Piotr Nowak]**

1. Wydaj część blacharzowi, dodaj zdjęcie podpisanego dokumentu.
2. → Wydanie ma numer zlecenia, datę, odbiorcę, listę pozycji, obsługuje wydania częściowe i wielokrotne do jednego zlecenia.
3. **[Anna Kowalska — kierownik, spór z blacharzem o brakującą część]** — wyszukaj wydanie po części/zleceniu/osobie, otwórz dokument w kilka sekund. → Koniec przeszukiwania kartonów.

## 6. Komunikacja doradca–części _(zweryfikowane działające — patrz `docs/mvp-readiness-pitch-script.md`)_

**[Marek Wiśniewski → Piotr Nowak]** — pełny scenariusz opisany w scenariuszu bieżącym; tu tylko punkt spinający: to Help Desk jest wspólnym rdzeniem, do którego podłączają się kolejne obszary (zwroty, reklamacje) jako kolejne typy zgłoszeń.

## 7. Zwroty wymagające zgody kierownika

**[Marek Wiśniewski]**

1. Utwórz zgłoszenie typu „Zwrot": część, numer zlecenia, powód, informacja o rotacji, zdjęcia.
2. **[Anna Kowalska — kierownik]** — otwórz zgłoszenie, sprawdź rotację części, zaakceptuj lub odrzuć z komentarzem.
3. → Decyzja zapisana w historii, część otrzymuje etykietę QR i fizyczną lokalizację oczekiwania przypisaną przez skanowanie — koniec z „nie wiadomo, na czyją decyzję czeka sprawa".

## 8. Reklamacje Customer Care VGP

**[Piotr Nowak]**

1. Załóż równoległy ticket w Ambrze do zgłoszenia w Customer Care: link do portalu, numer reklamacji, część, numer zlecenia, termin następnej kontroli i odesłania.
2. → Dashboard reklamacji pokazuje wszystkie otwarte sprawy i te zagrożone terminem — zero przeoczonych odpowiedzi i utraconych terminów odesłania.

## 9. Powtarzalne zadania

**[Anna Kowalska]**

1. Skonfiguruj zadanie cykliczne: częstotliwość, dzień tygodnia, domyślny wykonawca, powiązanie z audytem lub ticketem.
2. → System generuje kolejne wystąpienia, przypomina, prowadzi historię wykonania całej serii — audyty i kontrole przestają być zależne od pamięci jednej osoby.

## 10. Materiały zużywalne

**[Piotr Nowak]**

1. Wykonaj audyt według dostawcy lub lokalizacji, mobilnie, skanerem.
2. → System zapisuje różnice, generuje listę zamówień według dostawcy na podstawie stanu minimalnego i docelowego — do zaakceptowania lub odrzucenia.
3. → Koniec z nagłymi brakami wykrywanymi dopiero przy pustej szafce.

## 11. Lakiery

**[Piotr Nowak, zadanie cykliczne z obszaru 9]**

1. Wykonaj cotygodniowy audyt lakierów w ramach zaplanowanego zadania.
2. → Różnice, raport i sugerowane zamówienie w jednym miejscu; comiesięczna inwentaryzacja ma pełną historię wyników do porównywania okresów — bez osobnego arkusza.

## 12. Części nierotujące

**[Piotr Nowak → Dyrektor]**

1. Zaimportuj raport nierotów, dla każdej pozycji sprawdź rotację na innych oddziałach bezpośrednio w systemie (nie ręcznie, oddział po oddziale).
2. Zapisz kontakt z sugerowanym oddziałem, wynik, termin kolejnego działania.
3. **[Dyrektor]** → raport zmniejszenia wartości zapasu nierotującego w czasie — dokładnie ten wskaźnik, na którym najbardziej zależy zarządowi.

## 13. Procedury i wiedza operacyjna

**[Nowy pracownik + Anna Kowalska]**

1. Nowy częściowiec otwiera zadanie/ticket, klika link do powiązanej procedury — instrukcja krok po kroku, checklista, wymagane dane.
2. → Potwierdza zapoznanie się; ta sama procedura jest kopiowalna do innych oddziałów — usprawnienia z Komornik przestają być wiedzą tylko jednego oddziału.

## 14. Dashboard operacyjny

**[Anna Kowalska, początek zmiany]**

1. Otwórz dashboard działu części.
2. → Jednym spojrzeniem: nowe i pilne tickety, oczekujące akceptacje, reklamacje z terminem, zadania na dziś i zaległe, części bez lokalizacji, dostawy do rozłożenia, zlecenia niekompletne, materiały poniżej minimum, nieroty wymagające działania.
3. → Każda karta prowadzi bezpośrednio do działania — to jest widok, którego dziś kierownik nie ma, bo musi pytać ludzi.

## 15. Minimalne zlecenie warsztatowe

**[dowolna postać, w tle każdego z powyższych kroków]**

Numer zlecenia z AutoStacji spina wszystko powyżej: części, lokalizacje, kontenery, wydania, tickety, reklamacje, zwroty, zdjęcia, historię — jedna oś czasu na zlecenie, bez duplikowania logiki AutoStacji. Warto to nazwać wprost w prezentacji jako „kręgosłup" całego systemu, a nie osobny ekran do pokazania.

## 16. Kontenery i jednostki kompletacyjne

**[Piotr Nowak, w trakcie obszaru 2 lub 7]**

Kontener z własnym kodem QR, przypisany do zlecenia, z historią lokalizacji — pokazany naturalnie przy okazji rozkładania dostawy (obszar 2) i przy zwrocie oczekującym na decyzję (obszar 7), nie jako osobny punkt programu.

## 17. Etykiety QR i lokalizacje _(zweryfikowane działające — patrz `docs/mvp-readiness-pitch-script.md`)_

Fundament, na którym stoi większość powyższego — pełny scenariusz w scenariuszu bieżącym.

## 18. Import danych z AutoStacji

**[Anna Kowalska]**

1. Zaimportuj plik z AutoStacji: numery zleceń, wcześniejsze zamówienia, wolne części, materiały, raport nierotów.
2. → Podgląd przed zatwierdzeniem, wykrywanie duplikatów, historia importu, możliwość bezpiecznego cofnięcia — bez podwójnej pracy i bez kopiowania całej logiki AutoStacji.

## 19. VMI jako etap późniejszy

**[Anna Kowalska, z przedstawicielem dostawcy, np. Normfest]**

Po uporządkowaniu katalogu materiałów, lokalizacji i regularnych audytów (obszar 10) — pełne VMI: konta dostawców, propozycje zamówień, komunikacja, historia, powiązanie z Warehouse. Wyraźnie zaznacz w prezentacji, że to świadomie etap końcowy, zależny od dojrzałości obszaru 10, a nie brakujący element dzisiejszego MVP.

---

## Zamknięcie (wizja)

- Jeden system spinający cały cykl: od przyjęcia dostawy, przez wydanie i naprawę, po zwroty, reklamacje i zarządzanie zapasem.
- AutoStacja pozostaje systemem źródłowym tam, gdzie działa dobrze — Ambra nie duplikuje, tylko spina i automatyzuje to, czego dziś brakuje.
- Zaproszenie do dyskusji o priorytetach dalszego wdrożenia — kolejność już ustalona na podstawie zależności technicznych w `docs/mvp-readiness-pt.md`.

---

## Jak z tego korzystać odpowiedzialnie

- Przed każdą prezentacją opartą na tym scenariuszu zweryfikuj w `docs/mvp-readiness-pt.md`, które z powyższych 19 punktów są faktycznie ukończone (`[x]`), a które nadal nie.
- Nie prezentuj niedokończonych obszarów jako działających — użyj tego dokumentu do planowania i ćwiczenia narracji, a rzeczywistego stanu gotowości pilnuj osobno.
- W miarę ukończenia kolejnych obszarów, przenoś ich scenariusze z tego pliku do `docs/mvp-readiness-pitch-script.md` (scenariusz na dziś).
