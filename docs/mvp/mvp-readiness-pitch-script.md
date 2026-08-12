# Ambra — scenariusz prezentacji MVP

## Cel dokumentu

Scenariusz krok po kroku do prezentacji dwóch obszarów gotowych dziś do pokazania na żywo: **Obszar 1 — Etykiety QR i lokalizacje** oraz **Obszar 2 — Komunikacja doradca–części (Help Desk)**. Zakłada konfigurację opisaną w `docs/mvp-readiness-test-org-setup.md` (organizacja, 2 oddziały, 4 konta, 1 typ zgłoszenia). **Zrób próbny przebieg całości przed prawdziwą prezentacją** — ten dokument zakłada, że konfiguracja z tamtego pliku już istnieje i działa.

Konwencja: **[Kto]** = które konto ma być zalogowane w danym kroku. **→** = oczekiwany efekt, który odbiorcy powinni zobaczyć.

---

## 0. Otwarcie (ok. 30 sekund)

Bez logowania się do niczego — samo wprowadzenie.

Krótko: dział części w oddziale blacharsko-lakierniczym dziś pracuje na rozproszonej komunikacji e-mailowej, ręcznie zapisywanych lokalizacjach w komentarzach AutoStacji i papierowych wydaniach — źródło: bezpośrednie wywiady z zespołem, spisane w `docs/mvp-readiness-plan.md`. Ambra adresuje dwa z tych problemów już dziś: **gdzie fizycznie jest część** i **kto się czym zajmuje**.

---

## 1. Obszar 1 — Etykiety QR i lokalizacje

### 1.1 Lokalizacja z realnymi danymi (oddział Komorniki)

**[Częściowiec A — Piotr Nowak]**

1. Zaloguj się, upewnij się, że aktywny oddział to **Komorniki**.
2. Wejdź w moduł Magazyn → Lokalizacje.
3. → Widoczna jest realna, wcześniej przygotowana struktura lokalizacji (nie dane demonstracyjne) — to jest prawdziwy stan oddziału.
4. Otwórz jedną lokalizację, wygeneruj i wydrukuj (lub pokaż podgląd) jej etykietę.
5. → Etykieta zawiera nazwę lokalizacji, kod i kod QR — trzy elementy w jednym.
6. Zeskanuj etykietę telefonem.
7. → Skan przenosi bezpośrednio do widoku tej lokalizacji, z realną, zapisaną zawartością (nie placeholderem).

_Jeśli w trakcie skanowania telefon nie ma aktywnej sesji zalogowanego użytkownika: aplikacja poprawnie przekierowuje do logowania, a po zalogowaniu wraca dokładnie do zeskanowanej lokalizacji — warto to pokazać jako dodatkowy dowód, że przepływ jest kompletny, nie tylko „happy path"._

### 1.2 Pusty oddział i kontrola uprawnień (oddział Poznań Centrum)

To jest moment pokazujący dwie rzeczy naraz: **izolację danych między oddziałami** i **poprawkę usuwającą dane demonstracyjne**, którą wdrożyliśmy w ramach twardnienia MVP.

**[Częściowiec A lub Doradca — Marek Wiśniewski]**

1. Przełącz aktywny oddział na **Poznań Centrum** (przełącznik oddziałów w interfejsie).
2. → Lista lokalizacji jest pusta — **żadnych fałszywych/przykładowych danych**. To jest naprawiony stan: wcześniej w tym miejscu aplikacja pokazywała fikcyjne lokalizacje, jeśli oddział nie miał jeszcze żadnych prawdziwych.
3. **[Częściowiec A]** — jako osoba z uprawnieniem zarządzania lokalizacjami → widoczny jest przycisk „dodaj pierwszą lokalizację" w pustym stanie.
4. **[Doradca]** — to samo puste okno, ale bez uprawnienia zarządzania → widoczny jest tylko czysty komunikat informacyjny, bez przycisku. Kontrola uprawnień działa dokładnie tak, jak powinna: różni użytkownicy widzą różne możliwości działania w tym samym miejscu.

---

## 2. Obszar 2 — Komunikacja doradca–części (Help Desk)

Scenariusz: doradca zgłasza potrzebę domówienia części, zespół części to widzi, przejmuje i zamyka sprawę — cała komunikacja w jednym miejscu zamiast rozproszonych e-maili.

### 2.1 Doradca zgłasza potrzebę

**[Doradca — Marek Wiśniewski]**

1. Wejdź w Help Desk → Nowe zgłoszenie.
2. Wybierz typ **„Domówienie części"**, priorytet Średni, w opisie: „Potrzebne 2x klocki hamulcowe do zlecenia RO-12345."
3. Wyślij zgłoszenie.
4. → Zostajesz przeniesiony do widoku nowo utworzonego zgłoszenia — to realny, zapisany rekord, nie podgląd.

### 2.2 Zespół części widzi zgłoszenie we wspólnej kolejce

**[Częściowiec B — Tomasz Kowalczyk]** _(jeśli konfiguracja ma tylko 3 konta — pomiń ten krok i przejdź do 2.3 jako Częściowiec A, z komentarzem że każdy członek zespołu widziałby to samo)_

1. Zaloguj się, wejdź w Help Desk → Zgłoszenia.
2. → Zgłoszenie od Doradcy jest widoczne od razu, bez żadnego specjalnego filtra — to jest wspólna kolejka zespołu, nie prywatna lista jednej osoby.

### 2.3 Częściowiec przejmuje sprawę i odpowiada

**[Częściowiec A — Piotr Nowak]**

1. Otwórz to samo zgłoszenie z kolejki.
2. Dodaj komentarz: „Zamówione, dostawa w czwartek."
3. → Komentarz pojawia się natychmiast w wątku i w historii aktywności zgłoszenia.
4. Zamknij zgłoszenie („Zamknij zgłoszenie").
5. → Status zmienia się na zamknięte, zapisane w historii aktywności.

### 2.4 Doradca widzi aktualizację

**[Doradca — Marek Wiśniewski]**

1. Odśwież stronę zgłoszenia (celowo — dowód trwałości danych, nie tylko stanu w przeglądarce).
2. → Komentarz częściowca, zmieniony status i pełna historia aktywności są widoczne — to samo zgłoszenie, ta sama, trwale zapisana rozmowa.

---

## 3. Zamknięcie

Bez logowania — podsumowanie.

- Dwa z 19 zaplanowanych obszarów MVP (`docs/mvp-readiness-pt.md`) są dziś gotowe do pokazania na żywo, z realnymi, trwale zapisanymi danymi — nie prototypem czy makietą.
- Pozostałe obszary mają już ustaloną kolejność wdrażania, opartą na rzeczywistych zależnościach w kodzie, nie na przypadkowej kolejności z dokumentu planistycznego.
- Otwarte na pytania.

---

## Uwagi wykonawcze

- Całość da się przeprowadzić na jednym urządzeniu (przełączanie kont), ale **dwa urządzenia/przeglądarki równolegle** (np. laptop dla Doradcy, telefon zalogowany jako Częściowiec) robią dużo lepsze wrażenie przy kroku skanowania QR i przy pokazywaniu wspólnej kolejki w czasie rzeczywistym.
- Jeśli logowanie wieloma kontami nie działa tak, jak zakłada ten scenariusz (patrz ryzyko #1 w `docs/mvp-readiness-test-org-setup.md`), sekcje wymagające przełączania kont trzeba zastąpić narracją „wyobraźmy sobie, że to widzi teraz częściowiec" przy jednym koncie — ustal to na próbnym przebiegu, nie na żywo.
- Nie obiecuj odbiorcom niczego z pozostałych 17 obszarów jako „już działającego" — to zostawia miejsce na uczciwą rozmowę o mapie drogowej.
