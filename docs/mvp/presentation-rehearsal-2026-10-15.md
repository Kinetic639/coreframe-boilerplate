# Próba prezentacji — 15.10.2026

> Ręczna próba całego scenariusza [`ambra-skrypt-prezentacji.md`](ambra-skrypt-prezentacji.md) na produkcji (`app.ambra-system.com`), prowadzona przez właściciela produktu krok po kroku. Ten plik zapisuje, co działa, co się podoba i co poprawić. Środowisko: [`presentation-demo-setup.md`](presentation-demo-setup.md).
>
> Oznaczenia wyniku: ✅ działa · ⚠️ działa z uwagami · ❌ nie działa · ⏭️ pominięte.
> Priorytet poprawki: **P0** przed prezentacją · **P1** wkrótce po · **P2** kiedyś.

## Podsumowanie

| Sekcja skryptu                                 | Wynik | Uwagi                                                                                                 |
| ---------------------------------------------- | ----- | ----------------------------------------------------------------------------------------------------- |
| §3 Matcher publiczny                           | ⏭️    | Nie sprawdzany w próbie — narzędzie w codziennym użyciu od kwietnia 2026, uznane za zweryfikowane     |
| §6 Matcher po zalogowaniu → zlecenie           | ✅    | Działa; poprawki 1–8 (P0) sprawdzone w ponownej próbie 20.10, bez zastrzeżeń                          |
| §7 Przyjęcie, rozkładanie na telefonie, raport | ⚠️    | Działa (20.10): dostawa rozkłada się dobrze; uwagi tylko do wyglądu i przejrzystości UI — do zebrania |
| §9 Zmiana lokalizacji, przeniesienie kontenera |       |                                                                                                       |
| §10 Wyszukanie i wydanie (RW), załącznik       |       |                                                                                                       |
| §12–13 Tickety, Powiązania                     |       |                                                                                                       |
| §14 Powiadomienia i wiadomości (opcjonalnie)   |       |                                                                                                       |

## Lista poprawek

| #   | Sekcja | Co poprawić                                                                                                                                                                                                               | Priorytet                    |
| --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| 1   | §6     | Formularz ruchu magazynowego w całości po polsku: wszystkie etapy tworzenia, zakładki, dialogi importu i komunikaty (toasty)                                                                                              | **P0** — ✅ sprawdzone 20.10 |
| 2   | §6     | Dialog importu: przetłumaczyć na polski                                                                                                                                                                                   | **P0** — ✅ sprawdzone 20.10 |
| 3   | §6     | Dialog importu: usunąć pole „Movement type” — typ ruchu wybiera się w formularzu ruchu, nie w imporcie                                                                                                                    | **P0** — ✅ sprawdzone 20.10 |
| 4   | §6     | Dialog importu: nie wybierać samodzielnie źródła („SVWMS WDD matcher” ustawia się po sekundzie) — użytkownik wybiera źródło sam                                                                                           | **P0** — ✅ sprawdzone 20.10 |
| 5   | §6     | Wybór sesji: ostrzegać, jeśli sesja była już wcześniej zaimportowana (ryzyko zdublowania przyjęcia)                                                                                                                       | **P0** — ✅ sprawdzone 20.10 |
| 6   | §6     | **Szybki import**: jedno kliknięcie sprawdza całą sesję, tworzy brakujące zlecenia i brakujące części (jednostka domyślna: sztuki) i wypełnia formularz PZ. Obecny przegląd krok po kroku zostaje jako opcja dla chętnych | **P0** — ✅ sprawdzone 20.10 |
| 7   | §6     | Podsumowanie zaksięgowanego ruchu: przy każdej części pokazać, czy została zarezerwowana / przypisana i pod jaki obiekt (które zlecenie)                                                                                  | **P0** — ✅ sprawdzone 20.10 |
| 8   | §6     | Ostrzeżenie dla użytkownika, gdy przypisanie części do zleceń po zaksięgowaniu się nie uda (dziś tylko log serwera) — wykryte w weryfikacji kodu                                                                          | **P0** — ✅ sprawdzone 20.10 |

## Przebieg

### §3 Matcher publiczny — ⏭️ pominięty

- Nie weryfikowany w tej próbie: publiczny Matcher jest używany w codziennej pracy od kwietnia 2026, więc traktowany jako sprawdzone, przetestowane narzędzie.

### §6 Matcher po zalogowaniu → zlecenie — ✅ (ponowna próba 20.10)

**Ponowna próba 20.10** (po wdrożeniu rezerwacji i blokad): według właściciela produktu „śmiga pięknie”, bez zastrzeżeń. Po próbie dane demo i przypisania kodów QR zostały wyczyszczone. Opis poniżej dotyczy pierwszej próby 15.10.

- ✅ Zalogowany użytkownik wchodzi do Matchera w Ambrze.
- ✅ Wgranie pliku działa tak samo jak w publicznym Matcherze; dokumenty zostają przetworzone.
- ✅ Sesja zapisuje się.
- Zlecenia **nie powstają przy zatwierdzaniu sesji w Matcherze**, tylko przy imporcie sesji do nowego PZ.

**Przebieg w aplikacji (opis właściciela produktu):**

1. Nowy ruch: `/dashboard/magazyn/inwentarz/ruchy/nowy`, typ **101 — PZ**, przycisk **Import** w prawym górnym rogu.
2. Dialog importu: pola _Movement type_, _Source_, _Matcher session_ → wybór sesji → **Preview data**.
3. Sekcja **„Zlecenia z tej dostawy”** — lista zleceń z sesji. Brakujące w Warsztacie trzeba zaznaczyć i kliknąć **„Importuj zaznaczone”**.
4. Sekcja **„Imported items”** — części do tych zleceń. Istniejące z ustawioną jednostką mają status _ready_; pozostałe trzeba zaznaczyć, wybrać jednostkę domyślną i kliknąć **„Import selected”**.
5. Dopiero po zaimportowaniu zleceń i części działa **„Fill movement”** — formularz PZ wypełnia się danymi.
6. **„Zapisz i zaksięguj”** księguje PZ; wszystko trafia do strefy przyjęć do rozłożenia.

**Weryfikacja w kodzie i bazie (Claude, 15.10):**

- ✅ Tworzenie zleceń: „Importuj zaznaczone” czyta sesję ponownie po stronie serwera i tworzy lub uzupełnia zlecenia z pozycjami (`repair_orders_import`); wymaga uprawnienia do zarządzania zleceniami.
- ✅ Odznaczenie zlecenia w „Zlecenia z tej dostawy” **usuwa jego części z całego PZ** (nie są przyjmowane w ogóle).
- ✅ Zaznaczone, ale nieutworzone w Warsztacie zlecenie: jego części wchodzą na PZ jako **wolny towar** (bez przypisania) — zgodnie z podpowiedzią w dialogu.
- ✅ Księgowanie: PZ (101) zawsze ląduje w strefie przyjęć oddziału (`PRZ`), niezależnie od lokalizacji w formularzu.
- ✅ Przypisanie do zleceń po zaksięgowaniu: po numerze ZL i kodzie części, w obrębie organizacji i oddziału; nadwyżka ponad zamówioną ilość zostaje wolnym towarem; ponowne przypisanie jest bezpieczne (nie dubluje). Kolejność pozycji PZ jest zachowana, więc dopasowanie pozycji nie może się przesunąć.
- ✅ **Dowód z bazy:** PZ/2026/000001 z 14.10 (CNP Poznań) — 29 pozycji, **wszystkie 29 przypisane do pozycji zleceń**, wszystkie w `PRZ`.
- ⚠️ Przypisanie do zleceń działa jako krok po zaksięgowaniu: jeśli ono samo się nie uda, PZ zostaje zaksięgowany, części są wolnym towarem w strefie przyjęć, a **użytkownik nie dostaje ostrzeżenia** (błąd trafia tylko do logów serwera). Przy normalnym działaniu edytor pokazuje komunikat, ile pozycji przypisano i ile pominięto.
- ⚠️ Dialog importu jest w dużej części po angielsku (_Movement type, Source, Preview data, Imported items, Import selected, Fill movement form_), w przeciwieństwie do sekcji „Zlecenia z tej dostawy”.

**Uwagi właściciela produktu (UX):**

- ❌ **Tłumaczenia:** formularz ruchu magazynowego nie jest w pełni po polsku — część tekstów na wszystkich etapach tworzenia ruchu, w dialogach importu, w zakładkach i w części komunikatów (toastów) jest po angielsku. → poprawka 1
- ❌ **Dialog importu nie jest przetłumaczony.** → poprawka 2
- ❌ **Zbędne pole „Movement type” w dialogu importu** — rodzaj ruchu jest już wybrany w formularzu ruchu, a to jest dialog importu, nie wyboru typu ruchu. → poprawka 3
- ❌ **Samoczynny wybór źródła** — po ok. sekundzie od otwarcia dialog sam wybiera „SVWMS WDD matcher”; nie powinien wybierać nic domyślnie. → poprawka 4
- ❌ **Brak ostrzeżenia przed ponownym importem tej samej sesji** — ryzyko zdublowania przyjęcia. → poprawka 5
- ❌ **Za dużo przeglądania i klikania:** po wyborze źródła i sesji trzeba ręcznie zaznaczyć i zaimportować brakujące zlecenia, potem osobno wszystkie brakujące części, i dopiero wtedy „Fill movement form”. To mocno wydłuża tworzenie ruchu. Oczekiwane: **szybki import**, który sam zweryfikuje zlecenia i części, doda brakujące zlecenia oraz części (jednostka domyślna: sztuki) i wypełni formularz; ręczny przegląd tylko jako opcja. → poprawka 6
- ❌ **Podsumowanie po zaksięgowaniu** nie pokazuje, czy części zostały zarezerwowane / przypisane i pod jaki obiekt (które zlecenie). → poprawka 7

**Poprawki 1–8 (P0, 15.10, Claude) — do ponownej próby §6:**

- Dialog importu w całości po polsku (nagłówki, tabele, przyciski, problemy, komunikaty, notatka „Zaimportowano z …”); formularz ruchu: plakietki „Z importu”, „Włącz ręczne poprawki”, potwierdzenia i ostatnie angielskie komunikaty. → 1, 2
- Pole „Movement type” usunięte — import bierze typ z formularza ruchu. → 3
- Źródło nie wybiera się samo: pole „Źródło” startuje puste („Wybierz źródło”). → 4
- Sesja już przyjęta na PZ (szkic lub zaksięgowany, ten sam oddział) ma na liście dopisek „— już w PZ/…”, a po wyborze pojawia się żółte ostrzeżenie o zdublowaniu przyjęcia. → 5
- **Szybki import** (główny przycisk): wczytuje sesję → tworzy brakujące zlecenia → części znane dostają swoją jednostkę, nowe — SZT → tworzy brakujące części → wypełnia formularz i pokazuje podsumowanie („Nowe zlecenia: …, nowe części: …”). Zatrzymuje się i otwiera przegląd tylko, gdy część pasuje do kilku pozycji katalogu, brakuje uprawnień albo krok się nie uda. „Przegląd ręczny” zostaje obok. → 6
- Raport „Rozlokowanie dostawy” na stronie zaksięgowanego PZ: kolumna **Przypisanie** — „ZL …” jako link do zlecenia + ilość zarezerwowana (i reszta jako wolny towar, jeśli była nadwyżka) albo „Wolny towar”; nad tabelą „Przypisano do zleceń: X z Y poz.”. → 7
- Jeśli przypisanie do zleceń po zaksięgowaniu się nie uda, użytkownik dostaje stałe ostrzeżenie (PZ zaksięgowany, części jako wolny towar w strefie przyjęć). → 8
- Przy okazji: niejednoznaczne dopasowanie części/jednostki (kilka pozycji katalogu) było gubione po ponownej walidacji w dialogu — teraz rozpoznawane po statusie z serwera.

- **Raport przed importem** (prośba z próby): po wybraniu sesji dialog sam wczytuje podgląd (nic nie zapisuje) i pokazuje liczby zleceń (nowe / istniejące / konflikty) i części (w katalogu / do utworzenia / do wyboru ręcznego), werdykt — co zrobi szybki import albo na czym się zatrzyma, ile pozycji wejdzie jako wolny towar — oraz listę zleceń z klientem/pojazdem i ich częściami ze statusem każdej. Dopiero wtedy użytkownik wybiera „Szybki import” albo „Przegląd ręczny”.

### §7 Przyjęcie, rozkładanie, raport — ⚠️ działa, uwagi do UI (20.10)

**Ponowna próba 20.10** (nowy ekran rozlokowania: sekcje w kolejności pracy, jedna akcja na zlecenie, jeden MM na potwierdzenie, kody rozpoznawane w telefonie): rozkładanie dostawy działa. Uwagi właściciela produktu dotyczą wyglądu i przejrzystości, nie działania — do spisania w liście poprawek.

- ✅ Po zaksięgowaniu PZ części pojawiają się w strefie przyjęć do rozlokowania.
- ❌ **Lista „Do rozłożenia” nie mówi, skąd części się wzięły** (uwaga właściciela produktu). → poprawione: domyślny widok **„Według dokumentów”** — lista dokumentów (PZ, MM, korekty…), które wniosły towar do strefy przyjęć, od najnowszego: numer, rodzaj ruchu, data, referencja sesji, zlecenia, liczba pozycji. Po wejściu w dokument widać jego części do rozłożenia (pogrupowane po zleceniach, wolny towar osobno) i link „Otwórz dokument”. Widok „Wszystkie części” zostaje jako przełącznik.
  - Części na zlecenie są przypisane do dokumentu dokładnie (powiązanie przyjęcia). Wolny towar — do dokumentów, które wniosły tę część do strefy przyjęć, od najnowszego (to, co leży, przyszło najpóźniej), z odjęciem storn i korekt oraz tego, co dokument zarezerwował dla zleceń. Stan, którego nie da się przypisać, jest w grupie „Bez dokumentu”.

_(dalsze sekcje uzupełniane w trakcie próby)_
