# Ambra — gotowość do prezentacji i kontrolowanego pilotażu

Audyt repozytorium: **7 września 2026**. Produkt: **wyłącznie `apps/web`**. Źródło zakresu: [skrypt prezentacji](ambra-skrypt-prezentacji.md). Dowody i ograniczenia: [audyt implementacji](mvp-readiness-audit.md).

**Pełny scenariusz ze skryptu nie jest jeszcze gotowy.** Istnieją rzeczywiste fundamenty, zapis sesji Matchera i operacje magazynowe, ale nie ma potwierdzonego ciągłego procesu sesja → mobilne rozłożenie → zlecenie/lokalizacja → wydanie → podpisany dokument. Najpierw domknąć tę ścieżkę; nie kończyć całej Ambry.

## Priorytety — od czego zacząć

Stan wymagany to **cel przed prezentacją**, nie ocena obecnej implementacji. Numery wskazują sekcje poniżej, nie dawne identyfikatory checklisty.

| Priorytet | Obszar                                                                     | Wymagany stan                     | Dlaczego ma znaczenie                                                     |
| --------- | -------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------- |
| P0        | 1. Logowanie, organizacja, aktywny oddział, autoryzacja i RLS ścieżki demo | FULLY READY w zakresie demo       | Każdy następny krok zależy od właściwego dostępu i danych                 |
| P0        | 2. Publiczny Matcher                                                       | DEMO READY                        | Pierwszy pokaz na tych samych dokumentach; zależność zewnętrzna wobec web |
| P0        | 3. Matcher zalogowany, trwałość sesji i przekazanie do przyjęcia           | DEMO READY                        | Przejście od narzędzia do procesu                                         |
| P0        | 4. Minimalny katalog części i widok zlecenia                               | DEMO READY                        | Tożsamość części i zleceń spina przyjęcie, szukanie i wydanie             |
| P0        | 5. Lokalizacje, QR i etykiety części/zestawów                              | DEMO READY                        | Warunek fizycznego pokazu na telefonie                                    |
| P0        | 6. Przyjęcie, mobilne rozłożenie, zamknięcie i raport                      | DEMO READY                        | Centralna demonstracja w §7 skryptu                                       |
| P0        | 7. Szukanie, zawartość lokalizacji, ruch części/zestawu, historia          | DEMO READY                        | Obiecana codzienna praca w §9                                             |
| P0        | 8. Zwykłe wydanie części                                                   | DEMO READY                        | Domknięcie cyklu części, §10–11                                           |
| P0        | 9. Zdjęcie podpisanego wydania i ponowne otwarcie                          | DEMO READY                        | Konkretna wartość dodatkowego potwierdzenia                               |
| P1        | 10. Użytkownicy, zaproszenia, członkostwa, administracja rolami            | DEMO READY                        | Wiarygodne, krótkie wyjaśnienie fundamentów w §5                          |
| P1        | 11. Tickety: komunikacja, prosta akceptacja, problemowa część z QR         | DEMO READY                        | Drugi, krótki pokaz w §12–13                                              |
| P1        | 12. Początkowy magazyn i propozycja pilotażu                               | DEMO READY (materiał i procedura) | Ograniczenia i decyzja biznesowa w §8, §16–23                             |
| P2        | 13. Zadania jednorazowe, kalendarz i Kanban                                | PARTIALLY READY                   | §14 zapowiada kierunek, bez kolejnego dużego demo                         |
| P3        | 14. Cykliczność i powiadomienia operacyjne                                 | ROADMAP ONLY                      | Zapowiedź, nie obietnica działającej automatyzacji                        |
| P3        | 15. Materiały, dostawcy, audyty i wsparcie zamawiania                      | ROADMAP ONLY                      | Są elementy backendu; §15 nie wymaga ich ukończenia                       |
| P3        | 16. VMI i dalsze procesy magazynowe                                        | ROADMAP ONLY                      | Kierunek po wynikach pilotażu                                             |
| P4        | 17. Szerokie importy historyczne i integracja DMS                          | ROADMAP ONLY                      | Skrypt dopuszcza naturalną rotację; DMS pozostaje źródłem                 |
| P4        | 18. Awaryjne pobrania i rozbudowane procesy zwrotów/reklamacji             | ROADMAP ONLY                      | Wykraczają poza zwykłe wydanie i jeden ticket                             |
| P4        | 19. Lakiery, nieroty, procedury i zbiorczy dashboard operacyjny            | ROADMAP ONLY                      | Brak wymogu w aktualnym pokazie                                           |

### MUST FINISH BEFORE PITCH

- Jedna trwała dostawa z dokumentów Matchera, z identyfikacją zleceń/części, możliwa do wznowienia po odświeżeniu i na telefonie.
- Etykiety i skany części/zestawu oraz lokalizacji; rozłożenie kilku pozycji, kontrola braków, zamknięcie i raport faktycznych lokalizacji.
- Odnalezienie tych samych części, przeniesienie części i zestawu, wydanie oraz ponowne otwarcie zdjęcia podpisanego dokumentu.
- Dostęp demonstratora, właściwy oddział, odmowy niedozwolonych operacji, brak fikcyjnych sukcesów; publiczny Matcher i pełna próba P0.

### SHOULD FINISH BEFORE PITCH

- Wąski pokaz ticketu: zgłoszenie → odpowiedź → akceptacja → historia; QR otwierający opisany problem.
- Krótka prezentacja użytkowników, zaproszeń i ról; przygotowane konta zamiast długiego onboardingu na żywo.
- Materiał o stanie początkowym, trzech miesiącach pilotażu, odpowiedzialności, budżecie i kryteriach powodzenia.

### CAN REMAIN PARTIAL

- Zadania, kalendarz i Kanban: istniejący, stabilny przykład albo sama wzmianka.
- Zaawansowany katalog, zlecenia, kontenery, wyszukiwanie i tickety poza dokładnym scenariuszem P0/P1. Nieukończone warianty nie blokują sprawdzonej ścieżki.

### DO NOT SPEND TIME ON BEFORE PITCH

- Generator zadań cyklicznych, pełny system powiadomień, VMI, rozbudowa materiałów/audytów/zamawiania.
- Pełna migracja AutoStacji, nieroty, lakiery, procedury, awaryjne pobrania, Customer Care VGP i pełny dashboard.
- Pełne pokrycie testami wszystkich modułów, rozbudowana analityka i hardening całej produkcji. Ochrona danych demo pozostaje P0; wymagania pilotażu zachowano na końcu.

## Zasady odhaczania

- **P0 — PITCH BLOCKER:** awaria przerywa główną historię. **P1 — HIGH VALUE FOR PITCH:** bezpośrednio wzmacnia pokaz. **P2 — PARTIAL IMPLEMENTATION IS ENOUGH:** wystarcza wąski, prawdziwy przykład. **P3 — MENTION / ROADMAP ONLY:** bez istotnych prac przed spotkaniem. **P4 — DEFER:** odłożyć poza przygotowania.
- **FULLY READY:** end-to-end, trwałe dane, sprawdzone uprawnienia, happy path i główne błędy, brak mocków, ręczna próba. Tutaj dotyczy dostępu i bezpieczeństwa używanej ścieżki, nie całego IAM.
- **DEMO READY:** dokładny scenariusz działa na rzeczywistym backendzie i trwałych danych; szersze przypadki mogą pozostać otwarte. Nadal wymagane są sprawdzenie dostępu, test happy path/głównych błędów i próba ręczna.
- **PARTIALLY READY:** można uczciwie wspomnieć lub krótko pokazać część funkcji. **ROADMAP ONLY:** nie kończyć na potrzeby pitchu, nawet jeżeli część kodu już istnieje.
- `[x]` oznacza wyłącznie opisany dowód. Dawna próba ręczna nie jest świeżą certyfikacją wdrożenia. Nie odhaczamy obszaru na podstawie strony, migracji, testu z mockami ani wcześniejszego `[x]`.
- Przy zamknięciu P0/P1 zapisać wersję aplikacji, środowisko, datę, konta/role, scenariusz, wynik i dowód. Żaden obszar nie otrzymał w tym audycie nowego statusu „gotowy”.

## Kolejność zależności i pracy

**1 → 3 → 4 → 5 → 6 → 7 → 8 → 9** to ścieżka wewnątrz web. **2** przygotować jako osobne wejście do historii. Kolejność wystąpienia pozostaje zgodna ze skryptem; kolejność pracy wynika z zależności i braków.

Pierwszy zakres wykonawczy po audycie: zweryfikować środowisko/oddział, następnie domknąć **3 + minimalne 4 + 6**, korzystając z istniejących ruchów. Uwzględnić brakujące cele QR z **5**. Potem **7 → 8 → 9**, na końcu **10–12**. Nie rozbudowywać administracji ani katalogu przed sprawdzeniem tego przejścia.

## P0 — główny pokaz

### 1. Logowanie, organizacja, aktywny oddział, autoryzacja i RLS

**Cel: FULLY READY w zakresie kont i danych demo. Skrypt: §5–7. Dowód: A1.** Są prawdziwe uwierzytelnienie, kontekst organizacji/oddziału, kompilowane uprawnienia, guardy i polityki. Ich istnienie nie dowodzi izolacji wdrożenia. Są osobne drzewa migracji legacy/target; używane środowisko wymaga potwierdzenia.

- [ ] Logowanie na komputerze i telefonie, wygaśnięcie sesji oraz powrót z QR prowadzą do właściwego obiektu.
- [ ] Aktywny oddział jest widoczny i trwały; zmiana odświeża dane i uprawnienia, bez wyników poprzedniego kontekstu.
- [ ] Użytkownik demo ma potrzebne moduły/uprawnienia; brak modułu, roli lub oddziału daje czytelną odmowę.
- [ ] Na kontach testowych sprawdzono odczyt/zapis obcej organizacji i niedozwolonego oddziału przez akcję/API i bezpośrednio przez bazę z JWT użytkownika.
- [ ] Ustalono zakres tabel: organizacyjny nie znaczy ograniczony do aktywnego oddziału. Szczególnie sprawdzić sesje Matchera, ruchy, QR i załączniki.
- [ ] Potwierdzono zgodność wdrożonego schematu z kodem demo, dostęp do Storage oraz brak service role w kliencie.
- [ ] **GATE 1:** pozytywny i negatywny scenariusz dostępu zapisany, bez nierozwiązanych błędów ujawniających lub uszkadzających dane demo.

### 2. Publiczny SVWMS Matcher

**Cel: DEMO READY. Skrypt: §2–4. Dowód: A2.** Web przekierowuje publiczne adresy do witryny marketingowej; implementacji poza web nie audytowano. To zależność prezentacyjna, nie powód do audytu innej aplikacji.

- [ ] Przygotowano właściwy adres i wydruki odpowiadające zanonimizowanym plikom demo.
- [ ] W docelowym publicznym narzędziu bez logowania sprawdzono upload, matching, niedopasowania i wynik dla tych plików.
- [ ] Potwierdzono stwierdzenie „nie zapisuje sesji” w działającym narzędziu; nie wnioskować z kodu zalogowanego Matchera.
- [ ] Autor potwierdził informację o używaniu od kwietnia; repo nie dowodzi tej historii.
- [ ] Przygotowano wynik/nagranie zapasowe z jasno opisanym pochodzeniem.
- [ ] **GATE 2:** próba otwarcia, matching i wynik w środowisku prezentacji.

### 3. Matcher zalogowany → trwała sesja → przyjęcie

**Cel: DEMO READY. Skrypt: §6–7. Dowód: A3.** Sesje, pliki, bloki, linie i dopasowania są zapisywane. Import typu `101` wybiera sesję z edytora ruchu. Test granicy modułów celowo wyklucza przyciski importu w wynikach Matchera. To częściowe połączenie, nie gotowa sesja fizycznego rozłożenia.

- [ ] Te same pliki tworzą sesję we właściwym oddziale; WDD/zlecenia, SKU i ilości odpowiadają dokumentom.
- [ ] Błędny PDF, niedopasowanie i błąd zapisu są widoczne; podgląd w pamięci nie udaje udanego zapisu w tle.
- [ ] Odświeżenie i drugie urządzenie odtwarzają te same dane, status i identyfikator po zakończeniu zapisu.
- [ ] Rzeczywista nawigacja do przyjęcia zachowuje dane bez przepisywania; brakujące produkty/jednostki można rozstrzygnąć przed zatwierdzeniem.
- [ ] Ponowienie zapisu/importu nie dubluje fizycznego przyjęcia; błąd pośredni nie pozostawia pozornie zakończonego procesu.
- [ ] Jest trwałe powiązanie wyniku Matchera, przyjęcia i postępu rozkładania. Status `approved` Matchera nie oznacza „rozłożono”.
- [ ] **GATE 3:** dokumenty → zapis → ponowne otwarcie → dane gotowe do 6, z testem integracji i próbą ręczną.

### 4. Minimalny katalog części i proste zlecenia

**Cel: DEMO READY. Skrypt: §5, §7, §9–11. Dowód: A4.** Katalog produktów/wariantów, jednostki i stany są rzeczywiste. Numery zleceń z Matchera są przenoszone w kontekście importu/notatkach pozycji. Workshop to „coming soon”; nie potwierdzono osobnej encji i pełnego widoku zlecenie → części → lokalizacje.

- [ ] Kilka części demo ma trwałą tożsamość, SKU/numer katalogowy, nazwę i jednostkę; import nie tworzy ich duplikatów.
- [ ] Minimalny widok zlecenia pokazuje numer DMS, części, ilości i rzeczywiste lokalizacje, także przy dwóch lokalizacjach.
- [ ] Numer identyfikuje zlecenie w ustalonym zakresie; tekst w notatce nie jest prezentowany jako relacja bazodanowa.
- [ ] Jedna część wolna działa bez zlecenia; można ją znaleźć i wydać.
- [ ] Powiązania pozostają prawidłowe po przyjęciu, przeniesieniu, wydaniu i odświeżeniu.
- [ ] **GATE 4:** od numeru zlecenia do części/lokalizacji bez ręcznego szukania po notatkach.

Poza pitchem: pojazdy, naprawy, rozliczenia, pełne zamówienia, reklamacje i załączniki na poziomie zlecenia. Nie budować kopii AutoStacji.

### 5. Lokalizacje, QR, etykiety i identyfikacja części/zestawów

**Cel: DEMO READY. Skrypt: §5, §7, §9. Dowód: A5.** Lokalizacje i etykiety mają rzeczywisty backend. Rejestr QR obsługuje lokalizację, ticket i zadanie; nie obsługuje części ani kontenera. Generator grafiki QR nie zamyka tej luki.

- [ ] Mały zestaw lokalizacji oddziału ma unikalne kody, spójne nazwy i poprawne przeznaczenie do składowania.
- [x] Etykieta lokalizacji ma nazwę, kod i QR — potwierdzone statycznie w generatorze/kontekście etykiety oraz historyczną próbą.
- [x] Telefon zeskanował etykietę — **historyczna próba ręczna 2026-08-06**, nie powtórzona w audycie.
- [x] Skan bez sesji poprowadził przez logowanie do lokalizacji — **historyczna próba 2026-08-06**; resolver nadal wskazuje lokalizację.
- [x] Druk i skan sprawdzono — **historyczna próba 2026-08-06**, tylko scenariusz lokalizacji, nie cała infrastruktura QR.
- [ ] Wydrukowano potrzebną serię etykiet w docelowym rozmiarze; każdy kod prowadzi do poprawnego rekordu na telefonie prezentacyjnym.
- [ ] Część i zestaw mają obsługiwany trwały cel QR i odpowiedni widok; nie zastępuje go tekst bez powiązania.
- [ ] QR obcego oddziału, nieprzypisany, odwołany/usunięty nie kieruje do niewłaściwej operacji.
- [ ] **GATE 5:** świeży druk/skan lokalizacji i części/zestawu na właściwym środowisku, z obsługą odmowy kamery.

**Zachowana notatka z 6 sierpnia 2026:** ręcznie utworzono lokalizację w pustym oddziale, wygenerowano i przypisano QR, wygenerowano etykietę i zeskanowano telefonem. Po logowaniu powrót do lokalizacji zadziałał. Odnotowano usunięcie danych demonstracyjnych z pustego oddziału oraz wynik API etykiet **20/20**. Obecny kod ładuje lokalizacje z backendu; próba pustego oddziału i wynik 20/20 nie zostały tutaj odtworzone. Test API mockuje zależności i nie dowodzi fizycznego druku.

Nie blokują pitchu: oznaczenie wszystkich obiektów, zaawansowane szablony, uruchamianie audytu ze skanu.

### 6. Przyjęcie i mobilne rozłożenie → zamknięcie → raport

**Cel: DEMO READY. Skrypt: §7. Dowód: A6.** Ogólny silnik ruchów przyjmuje i księguje dane. `/warehouse/deliveries` i `/warehouse/scanning/delivery` są placeholderami. Reguły odkładania/tabele kontenerów nie są kompletnym workflow dostawy.

- [ ] Sesja z 3 pokazuje zlecenia, części, grupowanie oraz pozycje oczekujące i rozłożone.
- [ ] Zestaw i oznaczenia mają trwałe dane; oczekiwane części są odróżnione od fizycznie potwierdzonego stanu.
- [ ] Telefon: **skan części/zestawu → skan lokalizacji → potwierdzenie** zapisuje ilość, lokalizację, użytkownika i czas.
- [ ] Wykonano kilka pozycji; komputer i telefon pokazują ten sam postęp po odświeżeniu/wznowieniu.
- [ ] Błędny skan, zły oddział, ponowny tap i przerwany zapis nie powodują podwójnego ruchu ani fałszywego sukcesu.
- [ ] Można poprawić błędne odłożenie z historią; nie można ogłosić pełnego zakończenia, jeśli wymagane pozycje nie mają lokalizacji. Wyjątek/brak pozostaje jawny.
- [ ] Zamknięcie i raport korzystają z zapisanych lokalizacji, nie tylko odczytanych z PDF.
- [ ] Raport daje dane do ręcznej aktualizacji AutoStacji; nie udaje automatycznej integracji DMS.
- [ ] **GATE 6:** mała dostawa z 3 rozłożona na telefonie, zamknięta i wyeksportowana; test happy path i głównych błędów.

### 7. Szukanie, lokalizacje, ruch części/zestawów i historia

**Cel: DEMO READY. Skrypt: §9. Dowód: A7.** Są zapytania katalogu/pickera, stany i historia ruchów lokalizacji. Wyszukiwanie nagłówka przeszukuje nawigację, nie zlecenia. Akcje kontenerów istnieją, ale nie znaleziono wywołań poza plikiem definicji; ich odczyt nie oznacza dostępnej operacji.

- [ ] Szukanie po zleceniu oraz SKU/numerze części prowadzi do części i lokalizacji; także część wolna.
- [ ] Skan lokalizacji pokazuje rzeczywistą zawartość; skan części/zestawu identyfikuje właściwy obiekt.
- [ ] „Zmień lokalizację” pozwala wskazać/skanować cel i trwale przenieść część.
- [ ] Przeniesienie zestawu aktualizuje jego części, alokacje i lokalizację spójnie; błąd/ponowienie nie rozjeżdża danych.
- [ ] Historia pokazuje źródło/cel, ilość, użytkownika i czas oraz pozostaje dostępna po ponownym wejściu.
- [ ] Po ruchu zlecenie i wyniki pokazują nowy stan, nie tylko ostatni ruch produktu bez kontekstu zlecenia.
- [ ] **GATE 7:** na danych z 6 znaleziono zlecenie/część wolną, przeniesiono część i zestaw, sprawdzono obie lokalizacje/historię.

Odłożyć pełne przepakowywanie, wszystkie filtry i duże wolumeny. Podstawowy ruch zestawu pozostaje P0, ponieważ skrypt każe go pokazać.

### 8. Zwykłe odnalezienie i wydanie

**Cel: DEMO READY. Skrypt: §10–11. Dowód: A8.** Istnieje backend dokumentów/ruchów i księgowania zmieniającego stany. Nie dowodzi to kompletnego wydania do zlecenia. Usunięcie pozycji kontenera tylko zwalnia alokację — nie jest wydaniem.

- [ ] Z odnalezionej części/zlecenia można zapisać wydanie z ilością, odbiorcą, datą i identyfikowalnym dokumentem.
- [ ] Zatwierdzenie zmniejsza właściwy stan, zachowuje historię i nie pozwala wydać więcej niż dostępne.
- [ ] Ponowne zatwierdzenie/błąd sieci nie dubluje wydania; błędny zapis nie udaje sukcesu.
- [ ] Po odświeżeniu widać dokument i zmniejszony stan; pozostałość części nadal można odnaleźć.
- [ ] Wypowiedź zachowuje wydanie w AutoStacji jako obowiązującą operację źródłową.
- [ ] **GATE 8:** wydano część z 7 i sprawdzono saldo/historię z odpowiednią rolą.

Pełne warianty wydań częściowych i tryb awaryjny nie blokują podstawowego pokazu. Usunięcie zwykłego wydania z demo wymagałoby zmiany obietnicy skryptu.

### 9. Podpisany dokument i cyfrowe archiwum wydania

**Cel: DEMO READY. Skrypt: §10–11. Dowód: A9.** Jest prywatny mechanizm załączników dla ticketów, zadań i kart Kanban. Rejestr celów nie zawiera wydania/ruchu; brak podłączenia załączników w badanych szczegółach ruchu.

- [ ] Zdjęcie podpisanego dokumentu DMS można dodać do wydania z 8, z kontrolą formatu/rozmiaru.
- [ ] Plik i powiązanie są trwałe; błąd uploadu nie tworzy pozornego dokumentu.
- [ ] Po zamknięciu widoku i ponownym zalogowaniu można znaleźć wydanie i otworzyć zdjęcie.
- [ ] Pobranie wymaga dostępu do wydania; obca organizacja/nieuprawniony użytkownik nie otrzymuje pliku.
- [ ] **GATE 9:** wyszukane wydanie → podpisany dokument, przy innym wejściu niż bezpośrednio po uploadzie.

Nie potrzeba podpisu elektronicznego, OCR ani pełnego DMS. Retencja, usuwanie i odtwarzanie dokumentów firmowych pozostają wymaganiem pilotażu.

## P1 — mocne uzupełnienie prezentacji

### 10. Użytkownicy, zaproszenia, członkostwa i administracja rolami

**Cel: DEMO READY dla krótkiego omówienia. Skrypt: §5. Dowód: A1.** Realne usługi, akcje i testy istnieją. Działający dostęp jest P0; pełne administrowanie na żywo nie.

- [ ] Przygotowano konta demonstratora, pracownika i akceptanta z członkostwami/rolami.
- [ ] Można pokazać członków, zaproszenie i zakres roli bez obietnicy ukończenia całej administracji.
- [ ] Jedno zaproszenie/przyjęcie sprawdzono przed spotkaniem, w tym błędny/wygasły token i zmianę dostępu.
- [ ] Uprawnienia serwera potwierdza scenariusz odmowy z 1, nie tylko ukryty przycisk.
- [ ] **GATE 10:** prawdziwy opis fundamentów mieszczący się w około dwóch minutach.

Nie kończyć wszystkich edytorów ról, pozycji, profili, billingów i pełnej macierzy administracyjnych edge cases przed pitchem.

### 11. Tickety: doradca ↔ części, akceptacja i problem z QR

**Cel: DEMO READY. Skrypt: §12–13. Dowód: A10.** Są typy/statusy, wykonawcy, komentarze, aktywność, akceptanci i RPC akceptacji; działa rejestr QR ticketu. Nie potwierdzono relacji do encji części/zlecenia/kontenera ani kompletnego procesu decyzji o zwrocie.

- [ ] Jeden ticket trafia do przygotowanych częściowców, ma typ/status, odpowiedzialną osobę i termin; druga osoba odpowiada, historia jest trwała.
- [ ] Przykład „Zwrot” wymaga wskazanej akceptacji i pokazuje autora/czas; niedozwolona decyzja jest odrzucana.
- [ ] Nie przedstawiać akceptacji ticketu jako pełnego silnika zwrotów z odrzuceniem, eskalacją i blokadami — sprawdzić konkretny pokazany warunek.
- [ ] QR na problemowej części otwiera ticket z opisem/statusem/historią. Wyjaśnić, czy to etykieta ticketu na części, czy rzeczywista relacja do części.
- [ ] Jeśli zachowujemy zdanie o bezpośrednim powiązaniu ze zleceniem/częścią/zestawem, musi istnieć trwałe, nawigowalne powiązanie; numer w opisie nie wystarcza.
- [ ] **GATE 11:** przebieg na dwóch rolach, ponowne otwarcie i skan QR, bez udawanych powiadomień.

Połączono komunikację, tickety wewnętrzne i jeden przykład akceptacji. Siedem typów, raporty zwrotów, Customer Care i pełne SLA nie są bramką pitchu. Niedokończone P1 wymaga jawnego zawężenia wypowiedzi przed próbą.

### 12. Stan początkowy i propozycja pilotażu

**Cel: DEMO READY dla materiału i planu. Skrypt: §8, §16–23.** To nie zlecenie implementacji migracji historycznej.

- [ ] Wyjaśniono, że pierwszego dnia system nie zna całego starego magazynu; nowe dostawy nie dowodzą pełnego stanu.
- [ ] Wybrano do rozmowy naturalną rotację albo ograniczone wprowadzenie przy porządkowaniu/inwentaryzacji; określono unikanie podwójnego przyjęcia.
- [ ] Materiał opisuje jeden oddział, trzy miesiące (przygotowanie → realna praca → ocena), odpowiedzialność i zgodę na dane.
- [ ] Około 25 tys. zł ma podział: sprzęt, infrastruktura/narzędzia, praca; nie jest ceną gotowego produktu.
- [ ] Mierniki obejmują czas przyjęcia/szukania, pomyłki lokalizacji, koszt podwójnego potwierdzenia wydania, opinie i warunki zatrzymania pilota.
- [ ] **GATE 12:** konkretny wniosek oddziela pokaz od dopuszczenia danych firmowych.

## P2 — wystarczy część działającego obszaru

### 13. Zadania jednorazowe, kalendarz, Kanban

**Cel: PARTIALLY READY. Skrypt: §14. Dowód: A11.** Są trwałe zadania, kalendarze/źródła kalendarza i tablice/karty Kanban. Nie są wyłącznie makietami; bez świeżej próby nie uznajemy całych modułów za gotowe.

- [ ] Wybrano najwyżej jeden zapisany przykład; ewentualny pokaz nie rozszerza głównego demo.
- [ ] Opis odróżnia istniejące zadania/planowanie od niepotwierdzonej cykliczności i powiadomień.
- [ ] Jeśli ekran nie jest stabilny, pozostać przy uczciwej wzmiance. Brak demo nie blokuje P0.

## P3 — wzmianka / roadmapa, bez prac przed pitchem

### 14. Zadania cykliczne i powiadomienia operacyjne

**Cel: ROADMAP ONLY. Skrypt: §14. Dowód: A11.** Nie znaleziono generatora cyklicznych wystąpień w badanej ścieżce. Ustawienia powiadomień zapisują preferencje; dzwonek ma TODO podłączenia systemu. To nie dowód dostarczania alertów.

Zachowany backlog: reguły dzienne/tygodniowe/miesięczne, zakres dat, domyślny wykonawca, generowanie/statusy wystąpień, historia serii, edycja serii/jednego terminu, pomijanie, powiązanie z audytem/ticketem, przypomnienia i testy cykliczności. Osobno trwały inbox, odbiorcy, dostarczenie i odczyt powiadomień.

### 15. Materiały, dostawcy, audyty, propozycje zamówień

**Cel: ROADMAP ONLY na potrzeby pitchu. Skrypt: §15. Dowód: A12.** Katalog, CRM/dostawcy pozycji, liczenia, różnice i sugestie uzupełnienia mają rzeczywiste elementy implementacji. Strona Warehouse „Dostawcy” jest placeholderem. Nie domykać całości przed spotkaniem.

Zachowany backlog: katalog/import materiałów, dostawcy/lokalizacje/kody, minimum/cel/punkt zamówienia, masowa konfiguracja, liczenie po lokalizacji/dostawcy, telefon/skan, różnice/notatki/akceptacja, historia, listy zamówień per dostawca, akceptacja/odrzucenie sugestii i E2E. Sugestia nie jest złożonym zamówieniem. Cykliczne audyty zależą od 14.

### 16. VMI i dalsze możliwości

**Cel: ROADMAP ONLY. Skrypt: §15, §22. Dowód: A13.** Nie potwierdzono dostępnego end-to-end VMI w web; tabele/stare deklaracje nie wystarczają.

Zachowany backlog: wiarygodne katalogi, dostawcy, lokalizacje, progi i audyty; potem zakres MVP VMI, prawdziwy backend, konta klientów/dostawców, trwała komunikacja/zamówienia/historia, połączenie z Warehouse, izolacja i E2E bez fixtures. Nie odhaczać przed pitchem.

## P4 — odłożyć

### 17. Pełne importy AutoStacji i integracja DMS

**Cel: ROADMAP ONLY.** Wąski import Matchera pozostaje w 3, raport w 6, wydanie w 8. Odłożyć import wszystkich starych zleceń/zamówień, materiałów, nierotów/inwentaryzacji oraz automatyczną synchronizację DMS.

Zachowane wymagania na wybrany później zakres: podgląd/walidacja, duplikaty, brak częściowych zapisów, historia, poprawienie/cofnięcie, testy i minimalizacja podwójnej pracy. „Proces nie wymaga podwójnej pracy” nie jest warunkiem pitchu: skrypt zakłada dodatkowe potwierdzenie wydania.

### 18. Awaryjne wydania, pełne zwroty i Customer Care VGP

**Cel: ROADMAP ONLY.** Awaryjne pobranie bez działu części nie występuje w głównej narracji. Zwrot/reklamacja to przykłady ticketu, nie obowiązek wdrożenia specjalistycznych procesów.

Zachowany backlog: uprawnienia awaryjne, odbiorca/czas/potwierdzenie, częściowe/wielokrotne wydania i pełny raport archiwum; wartość/rotacja/miejsce oczekiwania zwrotu, akceptacja/odrzucenie/komentarz i raport; numer/link Customer Care, terminy kontroli/odesłania, alarmy, prowadzący, statusy i dowody reklamacji. Uruchomiony proces wymaga trwałej historii i E2E przed realnym użyciem.

### 19. Lakiery, nieroty, procedury, zbiorczy dashboard

**Cel: ROADMAP ONLY. Brak wymogu pokazu. Dowód: A13.** Dashboard startowy to ekran powitalny, nie centrum operacyjne.

Zachowany backlog:

- Lakiery: import, lokalizacje/progi, cotygodniowa kontrola, miesięczna inwentaryzacja, raport/różnice/sugestie, historia i kalendarz z wykonawcą.
- Nieroty: walidowany import, dni/wartość/lokalizacja, status/prowadzący, rotacja innych oddziałów, kontakty/follow-up, raport efektów i wiele oddziałów.
- Procedury: instrukcje, role/checklisty/załączniki, wersje, potwierdzenie zapoznania, linki z ticketów/zadań, wyszukiwanie, kopiowanie, szkolenie i ograniczenie edycji.
- Dashboard: osobisty/zespołowy zakres oddziału, tickety/akceptacje/terminy/zadania, dostawy/braki lokalizacji/niekompletne zlecenia, materiały/audyty/nieroty, działające odnośniki i odświeżanie. Nie tworzyć go dla katalogu funkcji.

Przed wdrożeniem któregokolwiek: realne dane, uprawnienia, historia i odpowiednie testy. Nie są bramką pitchu.

## Globalne bramki — trzy różne decyzje

### A. PITCH SAFETY — przed pokazem (P0)

- [ ] Build, osobny type-check i lint web oraz używanych zależności przechodzą; nie wymagać innych aplikacji. Build ma `ignoreBuildErrors`, więc nie zastępuje type-checku.
- [ ] Wybrane testy kodu/integracji głównej ścieżki przechodzą, wynik zapisany. W audycie próba Vitest zakończyła się brakiem narzędzia, nie wynikiem testów.
- [ ] Demo ma trwałe, zanonimizowane dane na rzeczywistym backendzie, jawny oddział i role. Symulacja, fixture/nagranie nie udają operacji na żywo.
- [ ] Sprawdzono dostęp, izolację, uploady i ponawianie krytycznych zapisów z 1–9; pokaz nie wymaga ingerencji w bazę.
- [ ] Trasa demo nie ma martwych przycisków, nieobsłużonych błędów, placeholderów/niespójnych stanów; mobilny układ, HTTPS/kamera, wydruki i sieć sprawdzone na docelowych urządzeniach.
- [ ] Jest bezpieczna kopia danych demo/procedura ponownego przygotowania, plan awarii internetu i zapasowe nagranie/zrzuty rzeczywiście wykonanego procesu.
- [ ] Pełną próbę wykonano w kolejności skryptu bez dygresji; poprawiono blokery i porównano wypowiadane obietnice z pokazem.

### B. CONTROLLED PILOT — przed danymi firmowymi (nie warunek spotkania)

- [ ] Zgoda firmy, jeden oddział, odpowiedzialność, użytkownicy i procedura wsparcia ustalone.
- [ ] Produkcja/staging, chronione preview, inwentaryzacja migracji i odtworzenie wybranego schematu na czystej bazie sprawdzone.
- [ ] Macierz dostępu i rzeczywiste testy RLS uruchamianych procesów obejmują organizacje, oddziały, Storage/RPC; zweryfikowano FORCE RLS i uprawnienia uprzywilejowanych funkcji.
- [ ] Krytyczne operacje są transakcyjne/idempotentne, przetestowane przy kilku użytkownikach; historia nie znika przy błędzie pośrednim.
- [ ] Backup bazy i plików działa, odtworzenie przetestowane; procedura rollbacku/odtworzenia gotowa.
- [ ] Monitoring błędów (np. Sentry), uptime i alerty mają odbiorcę; brak sekretów w repo/kliencie zweryfikowany.
- [ ] Retencja/dostęp do podpisanych dokumentów, walidacja plików, usuwanie/eksport danych i audit log ustalone.
- [ ] E2E uruchamianych procesów, realistyczne dane i próby mobilne sprawdzone; stary magazyn nie dubluje nowych dostaw.
- [ ] AutoStacja pozostaje źródłem stanów/dokumentacji; mierzymy dodatkową pracę i korzyści, znamy warunki przerwania pilota.

### C. DALSZA PRODUKCJA — po wyborze zakresu na podstawie pilotażu

- [ ] Obserwowalność, wydajność, obciążenie, alerty i odtwarzanie odpowiadają docelowej skali.
- [ ] Analityka produktu (np. PostHog) służy miernikom; jej kompletność nie blokuje pokazu.
- [ ] Testy/hardening rozszerzono na nowe moduły, organizacje i oddziały; wykonano okresowe próby backupu/rollbacku.
- [ ] Roadmapę 14–19 uporządkowano na podstawie wyników, nie automatycznie jako obowiązkowy MVP.

## Decyzja o gotowości

- [ ] **Gotowy do pitchu:** GATE 1–9 + Pitch Safety; P1 pokazane w sprawdzonym zakresie lub jawnie zawężone, P2–P4 opisane uczciwie. Obecnie **niepotwierdzone / blokery otwarte**.
- [ ] **Gotowy do kontrolowanego pilotażu:** osobno spełniona bramka B. Gotowy pokaz nie oznacza tej zgody.
- [ ] **Gotowy do rozszerzania produkcji:** wyniki pilotażu i bramka C dla uzgodnionego zakresu. Nie wymaga się ukończenia wszystkich 19 obecnych obszarów przed prezentacją.
