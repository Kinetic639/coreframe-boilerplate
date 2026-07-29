# Ambra — Presentation Readiness Progress Tracker

## Cel dokumentu

Dokument służy do śledzenia gotowości Ambry przed prezentacją i pilotażem. Każdy z 19 obszarów można uznać za ukończony dopiero wtedy, gdy wszystkie kryteria są odhaczone, proces działa od początku do końca, dane są trwale zapisywane, uprawnienia zostały zweryfikowane, testy przechodzą, a funkcja została ręcznie sprawdzona na realistycznym scenariuszu oddziału.

---

# Główny progress tracker

## 1. Etykiety QR i lokalizacje

- [ ] Istnieje pełna struktura lokalizacji (1)
- [ ] Lokalizacje mają spójne nazwy i unikalne kody (2)
- [ ] Każda lokalizacja ma kod QR (3)
- [ ] Można generować i drukować etykiety seryjnie (4)
- [ ] Etykieta zawiera nazwę, kod i QR (5)
- [ ] Kod można zeskanować telefonem (6)
- [ ] Skanowanie otwiera widok lokalizacji (7)
- [ ] Można wyświetlić zawartość lokalizacji (8)
- [ ] Można rozpocząć ruch i audyt ze skanu (9)
- [ ] Można oznaczać kontenery, zwroty, reklamacje i części problemowe (10)
- [ ] Test druku i skanowania przechodzi (11)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (12)

## 2. Komunikacja doradca–części

- [ ] Istnieje wspólna kolejka ticketów (13)
- [ ] Ticket ma typ, priorytet, status i termin (14)
- [ ] Ticket może mieć numer zlecenia (15)
- [ ] Ticket ma osobę zgłaszającą i przypisanych wykonawców (16)
- [ ] Ticket ma komentarze i historię aktywności (17)
- [ ] Ticket może wymagać akceptacji (18)
- [ ] Istnieje lista uprawnionych akceptantów (19)
- [ ] Istnieje widok „oczekuje na moje działanie” (20)
- [ ] Istnieją kolejki według zespołu (21)
- [ ] Doradca ma prosty formularz tworzenia ticketu (22)
- [ ] Częściowcy widzą wszystkie tickety skierowane do zespołu (23)
- [ ] Powiadomienia o komentarzach i zmianie statusu działają (24)
- [ ] Gotowe są typy: domówienie części, termin, zwrot, reklamacja, wydanie, brak części, decyzja kierownika (154)
- [ ] Test E2E pełnego procesu ticketu przechodzi (155)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (156)

## 3. Przyjmowanie dokumentów dostawy

- [ ] Import wszystkich wymaganych dokumentów działa (25)
- [ ] Parser poprawnie odczytuje numery WDD (26)
- [ ] Parser poprawnie odczytuje numery zleceń (27)
- [ ] Dopasowanie dokumentów działa automatycznie (28)
- [ ] Niedopasowane pozycje są wyraźnie oznaczone (29)
- [ ] Użytkownik może poprawić błędne dopasowanie (30)
- [ ] Historia przetworzenia dokumentu jest zapisywana (31)
- [ ] Wynik może przejść bezpośrednio do procesu rozlokowania (219)
- [ ] Obsłużone są duplikaty i ponowne przesłanie pliku (32)
- [ ] Testy parsera i dopasowania przechodzą (33)
- [ ] Proces został sprawdzony na realnych dokumentach (34)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (220)

## 4. Import danych z AutoStacji

- [ ] Zdefiniowano minimalny zakres importowanych danych (35)
- [ ] Import numerów zleceń działa (36)
- [ ] Import wcześniejszych zamówień i list części działa (37)
- [ ] Import wolnych części działa (38)
- [ ] Import materiałów działa (39)
- [ ] Import raportu nierotów działa (40)
- [ ] Import danych inwentaryzacyjnych działa (41)
- [ ] Import wykrywa duplikaty i błędne wiersze (42)
- [ ] Import nie pozostawia częściowych danych po błędzie (43)
- [ ] Import ma podgląd przed zatwierdzeniem (44)
- [ ] Import zapisuje historię (45)
- [ ] Import można bezpiecznie poprawić lub cofnąć (46)
- [ ] Proces nie wymaga podwójnej pracy (47)
- [ ] Import nie kopiuje całej logiki AutoStacji (48)
- [ ] Testy importów i E2E przechodzą (49)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (50)

## 5. Minimalne zlecenie warsztatowe

- [ ] Istnieje encja zlecenia (80)
- [ ] Zlecenie ma numer z AutoStacji (81)
- [ ] Numer jest unikalny w odpowiednim zakresie (82)
- [ ] Zlecenie może mieć części i wcześniejsze zamówienia (83)
- [ ] Zlecenie może mieć lokalizacje i kontenery (187)
- [ ] Zlecenie może mieć wydania i tickety (254)
- [ ] Zlecenie może mieć reklamacje i zwroty (157)
- [ ] Zlecenie może mieć załączniki (84)
- [ ] Zlecenie ma historię i oś czasu (85)
- [ ] Zlecenie nie duplikuje całej logiki AutoStacji (86)
- [ ] Import numeru zlecenia działa (87)
- [ ] Uprawnienia i RLS zostały zweryfikowane (88)
- [ ] Test E2E widoku zlecenia przechodzi (255)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (256)

## 6. Kontenery i jednostki kompletacyjne

- [ ] Istnieje encja kontenera (158)
- [ ] Kontener ma własny kod QR (159)
- [ ] Kontener może być przypisany do zlecenia (160)
- [ ] Kontener ma listę części i aktualną lokalizację (161)
- [ ] Kontener ma historię lokalizacji i status (162)
- [ ] Kontener może zostać przeniesiony przez skanowanie (163)
- [ ] Kontener może zostać wydany częściowo (164)
- [ ] Jedno zlecenie może mieć wiele kontenerów (165)
- [ ] Części można przenosić między kontenerami (166)
- [ ] System wykrywa pusty kontener i części bez kontenera (167)
- [ ] Operacje trafiają do audit logu (168)
- [ ] Uprawnienia do przenoszenia są zweryfikowane (169)
- [ ] Test E2E kontenera przechodzi (170)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (171)

## 7. Rozkładanie dostawy na magazynie

- [ ] Dostawa jest powiązana z numerami zleceń (188)
- [ ] System zna listę części w dostawie (189)
- [ ] Użytkownik może utworzyć lub wybrać kontener (190)
- [ ] Użytkownik może przypisać części do kontenera (191)
- [ ] Kontener może zostać zeskanowany kodem QR (192)
- [ ] Lokalizacja może zostać zeskanowana kodem QR (193)
- [ ] System zapisuje zlecenie, część, kontener i lokalizację (194)
- [ ] System zapisuje użytkownika, datę i godzinę operacji (195)
- [ ] Proces działa z telefonu (196)
- [ ] System wykrywa części bez lokalizacji (197)
- [ ] Nie można zakończyć rozkładania z brakującymi lokalizacjami (198)
- [ ] Można poprawić błędne przypisanie (199)
- [ ] Można rozdzielić jedno zlecenie na wiele kontenerów (200)
- [ ] Historia zmian jest widoczna (201)
- [ ] Test E2E całego procesu przechodzi (202)
- [ ] Proces został sprawdzony na realistycznej dostawie (203)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (204)

## 8. Wyszukiwanie części i zleceń

- [ ] Wyszukiwanie działa po numerze zlecenia (221)
- [ ] Wyszukiwanie działa po SKU (222)
- [ ] Wyszukiwanie działa po numerze katalogowym (223)
- [ ] Wyszukiwanie działa po nazwie części (224)
- [ ] Wyszukiwanie działa po lokalizacji (225)
- [ ] Wyszukiwanie działa po kontenerze (226)
- [ ] Wyszukiwanie działa po kodzie QR (227)
- [ ] Widok zlecenia pokazuje wszystkie części (228)
- [ ] Widok zlecenia pokazuje status dostawy (229)
- [ ] Widok zlecenia pokazuje kontenery i lokalizacje (230)
- [ ] Widok zlecenia pokazuje historię przeniesień (231)
- [ ] Widok zlecenia pokazuje wydania (232)
- [ ] Widok zlecenia pokazuje pozycje bez lokalizacji (233)
- [ ] Widok zlecenia pokazuje wydania częściowe (234)
- [ ] Wyniki wyszukiwania są szybkie i czytelne (235)
- [ ] Uprawnienia do podglądu zostały zweryfikowane (236)
- [ ] Testy E2E wyszukiwania przechodzą (237)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (238)

## 9. Pobranie części bez wiedzy działu części

- [ ] Istnieje szybki tryb awaryjnego wydania (205)
- [ ] Można zeskanować zlecenie lub kontener (206)
- [ ] Można wskazać osobę pobierającą (207)
- [ ] Można wybrać pobierane części (208)
- [ ] System zapisuje datę i godzinę pobrania (209)
- [ ] System aktualizuje status lokalizacji i kontenera (210)
- [ ] Można dodać zdjęcie dokumentu (211)
- [ ] Można dodać podpis lub potwierdzenie odbioru (212)
- [ ] Operacja trafia do historii (213)
- [ ] Wydanie można później odnaleźć (214)
- [ ] Uprawnienia do awaryjnego pobrania są ograniczone (215)
- [ ] Test E2E awaryjnego wydania przechodzi (216)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (217)

## 10. Papierowe wydania

- [ ] Istnieje cyfrowe archiwum wydań (239)
- [ ] Wydanie ma numer zlecenia, datę i odbiorcę (240)
- [ ] Wydanie zawiera listę pozycji (241)
- [ ] Można dodać zdjęcie podpisanego dokumentu (242)
- [ ] Można dodać komentarz (243)
- [ ] Wydanie ma historię zmian (244)
- [ ] Obsługiwane są wydania częściowe (245)
- [ ] Obsługiwane są wielokrotne wydania do jednego zlecenia (246)
- [ ] Można wyszukiwać po zleceniu, części i odbiorcy (247)
- [ ] Dokument można otworzyć w kilka sekund (248)
- [ ] Retencja i dostęp do załączników są zabezpieczone (249)
- [ ] Test E2E archiwum wydań przechodzi (250)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (251)

## 11. Zwroty wymagające zgody kierownika

- [ ] Istnieje typ ticketu „Zwrot” (89)
- [ ] Ticket zawiera część, numer zlecenia i powód (90)
- [ ] Ticket może zawierać wartość i informację o rotacji (91)
- [ ] Ticket obsługuje zdjęcia i załączniki (92)
- [ ] Ticket ma fizyczną lokalizację oczekiwania (93)
- [ ] Ticket wymaga akceptacji kierownika (94)
- [ ] Kierownik może zaakceptować, odrzucić i skomentować (95)
- [ ] Decyzja jest zapisywana w historii (96)
- [ ] Ticket ma termin dalszego działania (97)
- [ ] System może wydrukować etykietę QR (98)
- [ ] Etykietę można przypisać do części (99)
- [ ] Lokalizację można przypisać przez skanowanie (100)
- [ ] Istnieje raport otwartych zwrotów (101)
- [ ] Test E2E procesu zwrotu przechodzi (102)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (103)

## 12. Reklamacje Customer Care VGP

- [ ] Istnieje typ ticketu „Reklamacja VGP” (104)
- [ ] Ticket zawiera link do Customer Care (105)
- [ ] Ticket zawiera numer reklamacji, część i numer zlecenia (106)
- [ ] Ticket ma datę założenia i osobę prowadzącą (107)
- [ ] Ticket ma status wewnętrzny (108)
- [ ] Ticket ma termin następnej kontroli i odesłania (109)
- [ ] Działają przypomnienia i ostrzeżenia terminowe (110)
- [ ] Można dodawać zdjęcia i załączniki (111)
- [ ] Istnieje widok otwartych reklamacji (112)
- [ ] Istnieje widok reklamacji wymagających działania (113)
- [ ] Istnieje widok reklamacji zagrożonych terminem (114)
- [ ] Zakończenie reklamacji jest zapisywane w historii (115)
- [ ] Test E2E procesu reklamacji przechodzi (116)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (117)

## 13. Powtarzalne zadania

- [ ] Zadanie może mieć regułę powtarzalności (51)
- [ ] Obsługiwane są cykle dzienne, tygodniowe i miesięczne (52)
- [ ] Można wskazać dzień tygodnia (53)
- [ ] Można wskazać datę rozpoczęcia i zakończenia (54)
- [ ] Można wskazać domyślnego wykonawcę (55)
- [ ] Zadanie można przypisać ręcznie przed wykonaniem (56)
- [ ] Generowane są kolejne wystąpienia (57)
- [ ] Działają przypomnienia (58)
- [ ] Każde wystąpienie ma własny status (59)
- [ ] Istnieje historia wykonania serii (60)
- [ ] Można edytować jedno wystąpienie lub całą serię (61)
- [ ] Można pominąć jedno wystąpienie (62)
- [ ] Zadanie może być powiązane z audytem lub ticketem (63)
- [ ] Testy reguł cykliczności przechodzą (64)
- [ ] Test E2E zadania cyklicznego przechodzi (65)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (66)

## 14. Materiały zużywalne

- [ ] Istnieje kompletny katalog materiałów (118)
- [ ] Materiał ma dostawcę, lokalizację i kod (119)
- [ ] Materiał ma stan minimalny, docelowy i punkt zamówienia (120)
- [ ] Materiał ma sugerowaną ilość zamówienia (121)
- [ ] Audyt według dostawcy działa (122)
- [ ] Audyt według lokalizacji działa (123)
- [ ] Audyt można wykonać mobilnie i skanerem (124)
- [ ] Audyt zapisuje różnice i notatki (125)
- [ ] System generuje listę zamówień według dostawcy (126)
- [ ] Sugestię można zaakceptować lub odrzucić (127)
- [ ] Historia audytów i zamówień jest dostępna (128)
- [ ] Można planować cykliczne audyty (129)
- [ ] Można masowo importować materiały (130)
- [ ] Można masowo przypisywać dostawców i lokalizacje (131)
- [ ] Można masowo ustawiać reguły zamawiania (132)
- [ ] Test E2E audytu i listy zamówień przechodzi (133)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (134)

## 15. Lakiery

- [ ] Lista lakierów jest zaimportowana (172)
- [ ] Lakiery mają lokalizacje i reguły stanów (173)
- [ ] Istnieje cotygodniowe zadanie kontroli (174)
- [ ] Istnieje comiesięczne zadanie inwentaryzacji (175)
- [ ] Audyt lakierów działa (176)
- [ ] Różnice i wyniki są zapisywane (177)
- [ ] System generuje raport i sugestie zamówień (178)
- [ ] Wykonanie zadania można potwierdzić (179)
- [ ] Historia miesięcznych wyników jest dostępna (180)
- [ ] Zadanie jest powiązane z kalendarzem i wykonawcą (181)
- [ ] Test E2E procesu lakierów przechodzi (182)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (183)

## 16. Części nierotujące

- [ ] Można importować raport nierotów (135)
- [ ] Import waliduje dane (136)
- [ ] Część ma liczbę dni bez rotacji, wartość i lokalizację (137)
- [ ] Część ma status procesu i osobę prowadzącą (138)
- [ ] Można zapisać rotację na innych oddziałach (139)
- [ ] Można wskazać sugerowany oddział (140)
- [ ] Można zapisać kontakt, rezultat i termin kolejnego działania (141)
- [ ] Istnieje historia kontaktów (142)
- [ ] Istnieje filtrowanie po dniach, wartości i statusie (143)
- [ ] Istnieje raport zmniejszenia nierotów (144)
- [ ] Istnieje raport wartości objętej działaniem (145)
- [ ] Proces działa dla wielu oddziałów (146)
- [ ] Test E2E procesu nierotów przechodzi (147)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (148)

## 17. Procedury i wiedza operacyjna

- [ ] Istnieje baza procedur (67)
- [ ] Procedura ma instrukcję krok po kroku (68)
- [ ] Procedura ma wymagane dane i odpowiedzialną rolę (69)
- [ ] Procedura może mieć checklistę i załączniki (70)
- [ ] Procedura ma wersje i historię zmian (71)
- [ ] Użytkownik może potwierdzić zapoznanie (72)
- [ ] Ticket i zadanie mogą linkować do procedury (73)
- [ ] Procedury można wyszukiwać (74)
- [ ] Procedurę można kopiować między oddziałami (75)
- [ ] Istnieje tryb szkoleniowy (76)
- [ ] Uprawnienia do edycji są ograniczone (77)
- [ ] Test E2E publikacji i użycia procedury przechodzi (78)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (79)

## 18. Dashboard operacyjny

- [ ] Dashboard pokazuje nowe i pilne tickety (149)
- [ ] Dashboard pokazuje oczekujące akceptacje (150)
- [ ] Dashboard pokazuje reklamacje z terminem (184)
- [ ] Dashboard pokazuje zadania na dziś i zaległe (151)
- [ ] Dashboard pokazuje części bez lokalizacji (252)
- [ ] Dashboard pokazuje dostawy do rozłożenia (253)
- [ ] Dashboard pokazuje zlecenia niekompletne (257)
- [ ] Dashboard pokazuje materiały poniżej minimum (185)
- [ ] Dashboard pokazuje ostatnie audyty (218)
- [ ] Dashboard pokazuje nieroty wymagające działania (186)
- [ ] Istnieje widok osobisty i zespołowy (152)
- [ ] Istnieje filtrowanie według oddziału (153)
- [ ] Każda karta prowadzi do konkretnego działania (258)
- [ ] Dane odświeżają się poprawnie (259)
- [ ] Dashboard działa szybko i respektuje uprawnienia (260)
- [ ] Test E2E dashboardu przechodzi (261)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (262)

## 19. VMI jako etap późniejszy

- [ ] Katalog materiałów jest uporządkowany (263)
- [ ] Dostawcy i lokalizacje są przypisani (264)
- [ ] Stany minimalne i docelowe są skonfigurowane (265)
- [ ] Audyty dostarczają wiarygodne dane (266)
- [ ] Listy zamówień działają (267)
- [ ] Zdefiniowano zakres MVP VMI (268)
- [ ] Istnieje prawdziwy backend VMI (269)
- [ ] Dane nie pochodzą z fixtures (270)
- [ ] Konta klientów i dostawców działają (271)
- [ ] Izolacja organizacji została zweryfikowana (272)
- [ ] Propozycje, zamówienia i komunikacja są trwałe (273)
- [ ] Historia działań jest trwała (274)
- [ ] VMI jest powiązane z Warehouse (275)
- [ ] Uprawnienia i RLS zostały zweryfikowane (276)
- [ ] Test E2E głównego procesu VMI przechodzi (277)
- [ ] **OBSZAR GOTOWY DO PREZENTACJI** (278)

---

# Zbiorczy status obszarów

- [ ] 1. Etykiety QR i lokalizacje
- [ ] 2. Komunikacja doradca–części
- [ ] 3. Przyjmowanie dokumentów dostawy
- [ ] 4. Import danych z AutoStacji
- [ ] 5. Minimalne zlecenie warsztatowe
- [ ] 6. Kontenery i jednostki kompletacyjne
- [ ] 7. Rozkładanie dostawy na magazynie
- [ ] 8. Wyszukiwanie części i zleceń
- [ ] 9. Pobranie części bez wiedzy działu części
- [ ] 10. Papierowe wydania
- [ ] 11. Zwroty wymagające zgody kierownika
- [ ] 12. Reklamacje Customer Care VGP
- [ ] 13. Powtarzalne zadania
- [ ] 14. Materiały zużywalne
- [ ] 15. Lakiery
- [ ] 16. Części nierotujące
- [ ] 17. Procedury i wiedza operacyjna
- [ ] 18. Dashboard operacyjny
- [ ] 19. VMI jako etap późniejszy

---

# Globalne kryteria gotowości

## Jakość kodu

- [ ] Type-check całego monorepo przechodzi
- [ ] Lint całego monorepo przechodzi
- [ ] Build wszystkich prezentowanych aplikacji przechodzi
- [ ] Brak krytycznych błędów w konsoli
- [ ] Brak placeholderów i martwych przycisków w prezentowanych ekranach
- [ ] Brak danych mockowanych w procesach przedstawianych jako działające

## Baza danych i bezpieczeństwo

- [ ] Wszystkie migracje są zapisane lokalnie
- [ ] Migracje przechodzą na czystej bazie
- [ ] RLS i FORCE RLS są zweryfikowane
- [ ] Izolacja organizacji i oddziałów została przetestowana
- [ ] Krytyczne operacje są transakcyjne i idempotentne
- [ ] Service role key nie trafia do klienta
- [ ] Sekrety nie znajdują się w repozytorium
- [ ] Uploady są walidowane
- [ ] Audit log zapisuje kluczowe operacje

## Testy

- [ ] Testy jednostkowe przechodzą
- [ ] Testy usług i server actions przechodzą
- [ ] Testy migracji i RLS przechodzą
- [ ] Testy E2E krytycznych procesów przechodzą
- [ ] Ręczne testy mobilne zostały wykonane
- [ ] Testy na realistycznych danych zostały wykonane

## Stabilność

- [ ] Sentry jest skonfigurowane
- [ ] PostHog jest skonfigurowany
- [ ] Monitoring uptime jest skonfigurowany
- [ ] Backup bazy działa
- [ ] Odtworzenie backupu zostało przetestowane
- [ ] Istnieje procedura rollbacku
- [ ] Istnieje środowisko staging
- [ ] Preview deployments są chronione

## Gotowość prezentacyjna

- [ ] Dane demonstracyjne są realistyczne
- [ ] Każdy proces ma przygotowany scenariusz demo
- [ ] Każdy scenariusz działa od początku do końca
- [ ] Prezentowane ekrany są spójne wizualnie
- [ ] Demo nie wymaga ręcznej ingerencji w bazę
- [ ] Istnieje plan awaryjny na problemy z internetem
- [ ] Istnieją zrzuty ekranu lub nagranie zapasowe
- [ ] Pełne demo zostało wykonane próbnie
- [ ] Krytyczne błędy z próby zostały usunięte

---

# Ostateczna gotowość

- [ ] Wszystkie wymagane obszary MVP są ukończone
- [ ] Wszystkie globalne kryteria są spełnione
- [ ] Ambra jest gotowa do zaprezentowania kierownikowi
