# DataView produktów — analiza i propozycje

11 listopada 2026. Zakres: DataView w `apps/web`, jego podłączenie do `/dashboard/magazyn/produkty`, powiązany serwis produktów oraz porównanie tylko do odczytu z `D:\dev\kolor-sensu-review`.

[Interaktywny prototyp](prototype.html) · [Galeria 24 ekranów](gallery.html)

## Wynik

Warto zachować model lista–szczegóły sterowany URL-em, oddzielne pobieranie danych szczegółowych, filtry, kolumny, warianty produktów i powrót do kontekstu listy. Problemy nie sprowadzają się do wyglądu: dotyczą też cyklu życia cache, kluczy zapytań, odtwarzania URL, obsługi odświeżania i pracy serwera.

To analiza kodu wsparta testami oraz odtworzeniem jednego błędu parsera. Nie jest pomiarem produkcyjnych czasów odpowiedzi. Nie ma podstaw, żeby na podstawie szybkości lokalnego prototypu obiecywać konkretny wzrost wydajności aplikacji.

## Potwierdzone ustalenia

### 1. Pamięć danych kończy się wraz z instancją DataView

Źródło: [data-view.tsx:11](../../../src/components/data-view/data-view.tsx#L11), [data-view.tsx:48](../../../src/components/data-view/data-view.tsx#L48).

Komponent tworzy własny `QueryClient` w `useState` i obejmuje nim swój provider. Powrót po odmontowaniu widoku tworzy nowy cache, mimo że dashboard ma już nadrzędnego providera. Zamknięcie samych szczegółów nie musi odmontowywać DataView; problem dotyczy faktycznego ponownego montowania, np. nawigacji poza stronę i powrotu. Sam cache TanStack Query nie jest trwałym magazynem danych między przeładowaniami dokumentu.

Propozycja: cache o kontrolowanym cyklu życia na poziomie przestrzeni aplikacji; SSR zasila dokładnie właściwy klucz zapytania. Wylogowanie i zmiana konta mają jawnie czyścić dane odpowiedniego zakresu.

### 2. Klucze produktów nie opisują organizacji i oddziału

Źródło: [inventory-products-client.tsx:42](../../../src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx#L42), [use-data-view-query.ts](../../../src/components/data-view/use-data-view-query.ts), [akcje produktów](../../../src/app/actions/warehouse/inventory/index.ts#L105).

Przekazywany prefiks to `['inventory-products']`. Hook dopisuje parametry listy albo ID szczegółów, ale nie organizację i oddział. Akcje serwera pobierają tymczasem dane według aktualnego kontekstu. To potwierdzona niespójność identyfikacji cache; błędny wynik przy przełączeniu kontekstu jest ryzykiem wymagającym testu pełnego przepływu, a nie dowodem obejścia RLS.

Propozycja: klucze obejmują tożsamość konta/zakres sesji, organizację, oddział, encję i parametry. Takie zmienne powinny identyfikować cache, jeśli zmieniają wynik zapytania. [Dokumentacja TanStack Query](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys).

### 3. Odświeżanie usuwa z ekranu dane, które są już dostępne

Źródło: [data-view-provider.tsx:248](../../../src/components/data-view/data-view-provider.tsx#L248), [data-view-table.tsx](../../../src/components/data-view/data-view-table.tsx), [data-view-mobile-layout.tsx](../../../src/components/data-view/data-view-mobile-layout.tsx), [data-view-provider.tsx:385](../../../src/components/data-view/data-view-provider.tsx#L385).

`listIsLoading` i `listIsTransitioning` są oba oparte na `isFetching`. Tabela i mobilna lista pokazują wtedy szkielet zamiast istniejących wierszy. Szczegóły również traktują dowolny fetch jako pełne ładowanie. Efekt jest sprzeczny z intencją `placeholderData`: komponent ma poprzednie dane, ale ich nie pokazuje.

Propozycja: rozdzielić pierwsze ładowanie, zmianę parametrów oraz odświeżanie istniejącego wyniku. Szkielet tylko bez danych; przy refetchu dyskretny wskaźnik. Gdy wyświetlane są wyniki poprzednich filtrów, zaznaczyć ten stan i zabezpieczyć operacje zależne od aktualnego zestawu. [TanStack — paginated queries](https://tanstack.com/query/latest/docs/framework/react/guides/paginated-queries).

### 4. Serwer ponownie dekoduje już zdekodowane filtry

Źródło: [data-view-search-params.ts:31](../../../src/components/data-view/data-view-search-params.ts#L31).

Kod wykonuje `JSON.parse(decodeURIComponent(raw))` na wartości ze `searchParams`. Odtworzono przypadek tekstowej wartości pola własnego zawierającej procent: dla już zdekodowanego JSON-a z wartością `100% zapasu` parser zwraca `{}`. `decodeURIComponent` rzuca wyjątek, który jest cicho ignorowany. To bezpośredni błąd odtwarzania stanu, nie hipoteza dotycząca szybkości bazy.

Próba wykonana na prawdziwej funkcji:

```text
wejście: { filters: JSON.stringify({ searchLabel: '100% zapasu' }) }
wynik:   filters = {}
```

`searchLabel` to przykładowy klucz próby parsera; rzeczywiste tekstowe pola własne produktów mają klucze `custom_field:<id>`. Wartość z `%` może wystąpić również w takim polu. Potrzebny jest jeden schemat parsowania/serializacji współdzielony między serwerem i klientem, z testami procentów, znaków narodowych, pustych i nieprawidłowych wartości.

### 5. Lista i panel boczny mają dwa cache, a panel może zostać zasiany poprzednimi filtrami

Źródło: [use-data-view-query.ts:70](../../../src/components/data-view/use-data-view-query.ts#L70), [data-view-provider.tsx](../../../src/components/data-view/data-view-provider.tsx), [data-view-sidebar.tsx](../../../src/components/data-view/data-view-sidebar.tsx).

Do infinite query przekazywane jest `resolvedListData`, które podczas przejścia może być placeholderem poprzednich filtrów. Warunek zasiania sprawdza jedynie stronę i rozmiar strony, bez tożsamości wyszukiwania/sortowania/filtrów. Takie dane są następnie uznawane za świeże przez 30 s. To potwierdzona luka w warunku; konkretny wyścig wymaga testu: zmień filtr i otwórz szczegóły przed końcem pobierania.

Panel boczny ma również efekt doładowujący kolejną stronę przy nowym kluczu zawierającym wybrany rekord. Przeglądanie rekordów może więc uruchamiać kolejne doładowania, niezależnie od przewinięcia do końca listy.

Propozycja: współdzielenie stron listy i sprawdzanie pełnego podpisu parametrów przed użyciem danych początkowych. Prefetch następnego rekordu/strony powinien mieć limit i nie uruchamiać serii niepotrzebnych odczytów.

### 6. Zapis kolumn nie respektuje deklarowanego `defaultVisible`

Źródło: [data-view-columns.tsx:78](../../../src/components/data-view/data-view-columns.tsx#L78).

Hook dostaje klucze kolumn, a brakującej preferencji nadaje `true`; nie dostaje ich `defaultVisible`. Klucz localStorage zawiera encję, ale nie użytkownika. Preferencje kolejności, szerokości i sortowania nie są równoważne zapisanej widoczności kolumn.

Propozycja: wersjonowane preferencje per użytkownik i encja, z odrębnymi wartościami domyślnymi. Rekordy biznesowe nie powinny trafiać do localStorage przy okazji zapisywania wyglądu tabeli.

### 7. UX listy nie odpowiada temu, co naprawdę robi serwer

Źródło: [inventory-products.service.ts:123](../../../src/server/services/inventory-products.service.ts#L123), [inventory-products.service.ts:178](../../../src/server/services/inventory-products.service.ts#L178), [inventory-products.service.ts:2474](../../../src/server/services/inventory-products.service.ts#L2474).

- Wyszukiwanie listy filtruje nazwę produktu; SKU nie jest objęte tym samym wyszukiwaniem.
- Sortowanie ilości „na stanie” i „dostępne” jest mapowane na `updated_at`, więc nie sortuje ilości. Dotyczy map sortowania listy grupowanej i spłaszczonej.
- Wzbogacanie listy obejmuje sekwencję odczytów: warianty, jednostki, salda, zdjęcia, reguły uzupełnień, powiązania opcji, grupy/wartości opcji, tagi i pola własne. Część kroków jest zależna, część może być niezależna. To nie jest dowód problemu N+1 per wiersz; jest to widoczna kaskada zapytań do pomiaru.

Propozycja: oddzielić minimalny model listy od pełnego produktu, dopasować faktyczne filtrowanie i sortowanie do kontrolek, zmierzyć etapy i zrównoleglić niezależne odczyty po ustaleniu zależności. Nie deklarować przyspieszenia przed pomiarem.

### 8. Responsywność istnieje w kodzie, ale nie jest pełnym rozwiązaniem układu

Źródło: [data-view-layout.tsx](../../../src/components/data-view/data-view-layout.tsx), [data-view-mobile-layout.tsx](../../../src/components/data-view/data-view-mobile-layout.tsx), [items/page.tsx:59](../../../src/app/[locale]/dashboard/warehouse/items/page.tsx#L59), [inventory-products-client.tsx](../../../src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx).

Obecny komponent ma mobilną gałąź poniżej 1024 px i pełnoekranowe szczegóły. Nie byłoby rzetelne twierdzić, że nie ma responsywności w ogóle. Natomiast widok produktów ma własny duży nagłówek, drugi pasek akcji i wysokość `100vh - 4rem`, niezależnie od powłoki. Toolbar ma kontrolki o stałych szerokościach. Desktop używa panelu 320 px, a otwarcie szczegółów zależy od zakończenia animacji zwijania szerokości.

Propozycja: projektować całe środowisko listy, nie tylko wnętrze tabeli. Mobilna lista ma priorytetowe pola i filtr w panelu; szczegóły zajmują ekran. Desktop może mieć tabelę i inspektor albo kompaktową listę i obiekt. Zmiana szerokości nie powinna blokować pokazania gotowych danych.

## Co przenieść z Kolor Sensu

Odnalezione źródła w drugim projekcie:

- `packages/ui/src/data-table/data-table.tsx`: wspólna tabela, wiersze 30 px, przypięte obszary, sortowanie i paginacja.
- `packages/ui/src/data-table/columns.ts`, `columns-menu.tsx`, `column-resizer.tsx`: preferencje kolejności, szerokości i widoczności.
- `packages/ui/src/data-table/filter-bar.tsx`: filtry powiązane z adresem; wyszukiwanie z debounce 300 ms.
- `packages/ui/src/client-table/client-table.tsx`, `client-panel.tsx`: lista i wybrany klient w panelu, wskazany przez URL.
- `packages/ui/src/visit-table/params.ts`: wspólne parsowanie i budowanie adresów, walidacja parametrów.
- `packages/ui/src/detail-page/detail-page.tsx`: kompaktowa karta obiektu, zakładki i sekcje; elementy dopasowujące się do małego ekranu.

To zestaw komponentów, nie jeden plik nazwany DataView. Wariant F korzysta z ich języka wizualnego i struktury. Kod drugiego projektu nie został zmieniony. Nie przenosimy automatycznie całej architektury pobierania: tam tabela jest renderowana przez serwer, a Ambra ma już SSR oraz cache klienta. Wybór wymaga decyzji o kontrakcie stanu i danych, nie mechanicznego kopiowania.

## Proponowany kontrakt nowego DataView

1. **URL:** wyszukiwanie, filtry, sort, strona, wybrany rekord i zakładka. Jeden schemat serwer/klient; głęboki link, reload i Wstecz/Dalej działają.
2. **Cache:** lista i szczegóły mają klucze obejmujące właściwy zakres konta/organizacji/oddziału. Otwarcie szczegółów nie pobiera ponownie niezmienionej listy.
3. **Preferencje:** kolumny, kolejność, szerokość i gęstość to wersjonowany stan użytkownika. Nie mieszamy go z cache produktów.
4. **Przejściowy stan UI:** otwarte filtry, rozwinięte warianty, fokus i scroll mają wyraźne reguły powrotu. Zaznaczenie zbiorcze jest świadomie ograniczone do strony lub całego wyniku; nie może udawać obu zachowań naraz.
5. **Adapter produktu:** serwis dostarcza prawdziwe sortowanie/wyszukiwanie; renderer listy nie musi pobierać pól używanych wyłącznie w szczegółach.
6. **Wariant układu:** lista → inspektor lub lista → obiekt na desktopie; lista → pełny ekran obiektu na telefonie. Bez klonowania logiki cache dla każdego wyglądu.
7. **Stany:** pierwsze ładowanie, odświeżanie, brak wyników, nieistniejący rekord, brak uprawnień i błąd z ponowieniem to osobne sytuacje. Komponenty muszą otrzymywać błąd, nie jedynie `data` i `isFetching`.

## Prototyp: sześć kierunków, 24 kombinacje

- **A:** autorska adaptacja Linear; oszczędny, ciemny układ i obiekt w obszarze skupienia.
- **B:** adaptacja Business Central; gęsta tabela, pasek poleceń, szczegóły po prawej.
- **C:** adaptacja SAP Fiori; filtry, lista–obiekt i jawne sekcje.
- **D:** adaptacja Zoho Inventory; operacyjna kartoteka. Desktop jest naszym rozwinięciem inspiracji mobilnej.
- **E:** adaptacja SAP iOS/iPad; grupowane listy i sekcje. Desktop nie jest oficjalnym produktem SAP.
- **F:** odwzorowanie wzorca Kolor Sensu: oryginalne zielone akcenty i granatowy tekst, zwarta siatka ze zdjęciami, panel 384 px, lupa rozwijana po kliknięciu lub `/`, menu pól filtrów, wielokrotny wybór wartości i edytowalne etykiety po prawej stronie paska. Wybór działa od razu, bez „Zastosuj”, zapisuje stan w URL i resetuje stronę oraz otwarty rekord. Mobilne kontrolki mają większe obszary dotyku.

Każdy kierunek ma desktop/mobile oraz listę/szczegóły. Przełączniki w prototypie pozwalają porównać ten sam produkt i te same filtry. Działają: wyszukiwanie nazwy/SKU, filtry, sortowanie, paginacja, kolumny, zaznaczanie desktopowe, wybór produktu, URL, powrót, reload i zakładki szczegółów. Część kontrolek, np. utworzenie i eksport, jest opisana jako poza zakresem prototypu.

18 produktów jest fikcyjnych. Filtry kategorii i zapasu oraz wyszukiwanie SKU pokazują **proponowany UX**, a nie deklarację ich gotowej implementacji w aktualnej aplikacji. Zmiana oddziału demonstruje reset kontekstu, lecz oba oddziały korzystają z tych samych danych przykładowych. Prototyp nie jest podłączony do Supabase.

Po uwadze użytkownika wszystkie warianty mają miniatury fotografii w tabeli, mobilnej liście i bocznej liście. Cztery przykładowe fotografie ilustrują kategorie, nie dokładne modele fikcyjnych produktów. Autorzy i licencje są dostępni w prototypie pod „Źródła zdjęć demo”: [taśma — Trimacoinc, CC BY-SA 4.0](https://commons.wikimedia.org/wiki/File:Paint_masking_tape.jpg), [reflektor — Cschirp, CC BY-SA 3.0](https://commons.wikimedia.org/wiki/File:LED_Headlamp_inside.jpg), [nity — Fructibus, CC0](https://commons.wikimedia.org/wiki/File:A_stack_of_blind_rivets_2017.jpg), [puszka — DTeetz, domena publiczna](https://commons.wikimedia.org/wiki/File:Alkydharzlack.jpg). Miniatury zmniejszono do 160×160 i przekonwertowano na WebP z białymi marginesami; pochodne zdjęć CC BY-SA zachowują odpowiednie licencje źródeł.

## Weryfikacja i następny krok

- Bieżący zestaw DataView: **38/38 testów przechodzi**. To nie jest potwierdzenie braku opisanych problemów; testy nie zastępują pomiaru ani przeglądu prawdziwego cyklu nawigacji.
- Odtworzenie błędu parsera `%`: wykonane na bieżącej funkcji serwerowej, wynik pustych filtrów potwierdzony.
- Prototyp: **24 widoki** sprawdzone przy 1440×900 i 390×844; brak poziomego przepełnienia dokumentu i paneli mobilnych w tych próbach.
- **12 przepływów** (każdy kierunek na obu urządzeniach): filtry → rekord → reload → lista → Wstecz/Dalej → zakładka historii; bez błędów JS w tych próbach.
- Po korekcie F: osobne scenariusze na desktopie i telefonie 320 px potwierdzają wielokrotny wybór, edycję/usuwanie etykiety, czyszczenie wszystkich filtrów, natychmiastowy URL, reset strony i rekordu, odtworzenie po reload oraz wyszukiwanie SKU z opóźnieniem 300 ms i skrótem `/`. Ponownie wykonano 24 podglądy i 12 przepływów; sprawdzono obecność widocznych, załadowanych miniatur list.
- Dodatkowo 36 układów mobilnych przy szerokościach 320, 360 i 430 px: bez poziomego przepełnienia dokumentu. Wszystkie 24 obrazy galerii załadowały się poprawnie.
- Powstały 24 zrzuty ekranów do galerii. Są obrazami prototypu, nie produkcyjnego DataView.

Po wyborze kierunku: najpierw scenariusze regresji i naprawa kontraktu cache/URL, potem renderer listy i szczegółów. Pomiar prawdziwej aplikacji: zimne/ciepłe wejście, powrót z innego modułu, szybkie wpisywanie, zmiana oddziału, filtr i szybkie otwarcie rekordu, duży katalog oraz odtworzenie linku po przeładowaniu. Rejestrujemy liczbę żądań i czasy etapów, zamiast zakładać, że nowa skórka rozwiązuje problemy danych.
