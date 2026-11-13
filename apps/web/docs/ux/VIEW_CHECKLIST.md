# Ambra — checklista przebudowy widoków

Stan inwentaryzacji: **11 listopada 2026**. Zakres: wyłącznie `apps/web`.

**113 plików stron + 121 dodatkowych widoków, wariantów i stanów = 234 pozycji.** Każda pozycja ma niezależny odbiór desktop i mobile.

## Jak używać

- Zaznacz checkbox dopiero po przebudowie, wykonaniu scenariusza użytkownika i weryfikacji na danym urządzeniu. Sam poprawny URL, screenshot albo responsywny CSS nie wystarcza.
- Do odebranej pozycji dopisz commit/PR, rozmiar ekranu, rolę testową, scenariusz i ścieżkę do dowodu. Nie zaznaczamy teraz nawet `dashboard/start`: to zaakceptowany kierunek stylistyczny, nie zamknięta weryfikacja UX.
- PL i EN są wariantami tego samego widoku, nie osobnymi zadaniami przebudowy. W odbiorze sprawdzamy oba języki. `[id]`, `[token]` i podobne oznaczają jeden typ ekranu, nie każdy rekord osobno.
- Status „UI istnieje” pochodzi z kodu i nie oznacza, że ekran został odwiedzony lub działa poprawnie. Dostęp może zależeć od planu, roli, oddziału, danych, tokenu i ustawień rejestracji. Konta demo właścicieli nie pokrywają ograniczonych ról ani administratora platformy.
- Szkielety pozostają w spisie; przed projektem potrzebują scenariusza i zakresu funkcjonalnego. Przekierowania mają checkboxy weryfikacji przebiegu, nie osobny projekt wizualny. API, eksporty i callbacki bez UI nie są stronami; ich komunikaty błędów sprawdzamy w uruchamiającym je ekranie.
- Widoki zagnieżdżone są zinwentaryzowane na podstawie aktualnie podłączonych komponentów i jawnych trybów. Przy wejściu w moduł dopisujemy odkryte warianty stanów; zamknięcie pozycji obejmuje również jej dialogi, filtry, ładowanie, pusty wynik, błąd, brak uprawnień i długie dane.

[Research i standard odbioru](README.md) · [Inspiracje do wyboru](INSPIRATIONS.md) · [Manifest źródłowy](view-inventory.json)

## 00. Wspólna powłoka aplikacji (10)

### V094 — Powłoka: nawigacja i sidebar

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [dashboard-shell.tsx](../../src/app/[locale]/dashboard/_components/dashboard-shell.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V095 — Powłoka: wybór oddziału

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [sidebar-branch-switcher.tsx](../../src/app/[locale]/dashboard/_components/sidebar-branch-switcher.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V096 — Powłoka: wyszukiwanie globalne

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-search.tsx](../../src/components/v2/layout/header-search.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V097 — Powłoka: menu szybkiego dodawania

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-quick-add.tsx](../../src/components/v2/layout/header-quick-add.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V098 — Szybkie dodawanie: zadanie

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-quick-add.tsx](../../src/components/v2/layout/header-quick-add.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V099 — Szybkie dodawanie: karta Kanban

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-quick-add.tsx](../../src/components/v2/layout/header-quick-add.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V100 — Powłoka: kontakty

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-contacts.tsx](../../src/components/v2/layout/header-contacts.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V101 — Powłoka: wiadomości

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-messages.tsx](../../src/components/v2/layout/header-messages.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V102 — Powłoka: powiadomienia

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [header-notifications.tsx](../../src/components/v2/layout/header-notifications.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V103 — Powłoka: konto i wylogowanie

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [nav-user.tsx](../../src/components/nav-user.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 01. Pulpit, aktywność, analityka i diagnostyka (9)

### R021 — Nieznana ścieżka dashboardu — przekierowanie do narzędzi

- Wejście: `/dashboard/[...slug]`.
- PL: `/dashboard/[...slug]` · EN: `/en/dashboard/[...slug]`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/[...slug]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R022 — Brak uprawnień

- Wejście: `/dashboard/access-denied`.
- PL: `/dashboard/brak-dostepu` · EN: `/en/dashboard/access-denied`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/access-denied/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R026 — Moja aktywność

- Wejście: `/dashboard/activity`.
- PL: `/dashboard/aktywnosc` · EN: `/en/dashboard/activity`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/activity/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R027 — Przegląd analityki

- Wejście: `/dashboard/analytics`.
- PL: `/dashboard/analityka` · EN: `/en/dashboard/analytics`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/analytics/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R028 — Aktywność organizacji

- Wejście: `/dashboard/analytics/activity`.
- PL: `/dashboard/analityka/aktywnosc` · EN: `/en/dashboard/analytics/activity`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/analytics/activity/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R029 — Dziennik audytu

- Wejście: `/dashboard/analytics/audit`.
- PL: `/dashboard/analityka/audyt` · EN: `/en/dashboard/analytics/audit`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/analytics/audit/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R034 — Demo DataView w dashboardzie

- Wejście: `/dashboard/data-view-demo`.
- PL: `/dashboard/data-view-demo` · EN: `/en/dashboard/data-view-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/data-view-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R035 — Diagnostyka kontekstu i uprawnień

- Wejście: `/dashboard/diagnostics`.
- PL: `/dashboard/diagnostyka` · EN: `/en/dashboard/diagnostics`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/diagnostics/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R063 — Pulpit operacyjny — punkt odniesienia

- Wejście: `/dashboard/start`.
- PL: `/dashboard/start` · EN: `/en/dashboard/start`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/start/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 02. Magazyn — WMS (70)

### R066 — Przegląd magazynu

- Wejście: `/dashboard/warehouse`.
- PL: `/dashboard/magazyn` · EN: `/en/dashboard/warehouse`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R067 — Alerty magazynowe

- Wejście: `/dashboard/warehouse/alerts`.
- PL: `/dashboard/magazyn/alerty` · EN: `/en/dashboard/warehouse/alerts`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/alerts/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R068 — Inwentaryzacje

- Wejście: `/dashboard/warehouse/audits`.
- PL: `/dashboard/magazyn/audyty` · EN: `/en/dashboard/warehouse/audits`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/audits/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R069 — Liczenie stanów

- Wejście: `/dashboard/warehouse/audits/[id]/count`.
- PL: `/dashboard/magazyn/audyty/[id]/liczenie` · EN: `/en/dashboard/warehouse/audits/[id]/count`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/count/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R070 — Raport inwentaryzacji

- Wejście: `/dashboard/warehouse/audits/[id]/report`.
- PL: `/dashboard/magazyn/audyty/[id]/raport` · EN: `/en/dashboard/warehouse/audits/[id]/report`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/report/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R071 — Weryfikacja różnic

- Wejście: `/dashboard/warehouse/audits/[id]/review`.
- PL: `/dashboard/magazyn/audyty/[id]/weryfikacja` · EN: `/en/dashboard/warehouse/audits/[id]/review`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/review/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R072 — Nowa inwentaryzacja

- Wejście: `/dashboard/warehouse/audits/new`.
- PL: `/dashboard/magazyn/audyty/nowy` · EN: `/en/dashboard/warehouse/audits/new`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/audits/new/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R073 — Klienci magazynu — stary moduł

- Wejście: `/dashboard/warehouse/clients`.
- PL: `/dashboard/magazyn/klienci` · EN: `/en/dashboard/warehouse/clients`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/clients/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R074 — Dostawy

- Wejście: `/dashboard/warehouse/deliveries`.
- PL: `/dashboard/magazyn/dostawy` · EN: `/en/dashboard/warehouse/deliveries`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/deliveries/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R075 — Stany magazynowe

- Wejście: `/dashboard/warehouse/inventory`.
- PL: `/dashboard/magazyn/inwentarz` · EN: `/en/dashboard/warehouse/inventory`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R076 — Korekty stanów

- Wejście: `/dashboard/warehouse/inventory/adjustments`.
- PL: `/dashboard/magazyn/inwentarz/korekty` · EN: `/en/dashboard/warehouse/inventory/adjustments`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/adjustments/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R077 — Dokumenty i ruchy magazynowe

- Wejście: `/dashboard/warehouse/inventory/movements`.
- PL: `/dashboard/magazyn/inwentarz/ruchy` · EN: `/en/dashboard/warehouse/inventory/movements`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R078 — Szczegóły dokumentu magazynowego

- Wejście: `/dashboard/warehouse/inventory/movements/[movementId]`.
- PL: `/dashboard/magazyn/inwentarz/ruchy/[movementId]` · EN: `/en/dashboard/warehouse/inventory/movements/[movementId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/[movementId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R079 — Edycja dokumentu magazynowego

- Wejście: `/dashboard/warehouse/inventory/movements/[movementId]/edit`.
- PL: `/dashboard/warehouse/inventory/movements/[movementId]/edit` · EN: `/en/dashboard/warehouse/inventory/movements/[movementId]/edit`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/[movementId]/edit/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R080 — Nowy dokument magazynowy

- Wejście: `/dashboard/warehouse/inventory/movements/new`.
- PL: `/dashboard/magazyn/inwentarz/ruchy/nowy` · EN: `/en/dashboard/warehouse/inventory/movements/new`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/new/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R081 — Kartoteka produktów

- Wejście: `/dashboard/warehouse/items`.
- PL: `/dashboard/magazyn/produkty` · EN: `/en/dashboard/warehouse/items`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R082 — Szczegóły produktu

- Wejście: `/dashboard/warehouse/items/[productId]`.
- PL: `/dashboard/magazyn/produkty/[productId]` · EN: `/en/dashboard/warehouse/items/[productId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/[productId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R083 — Edycja produktu

- Wejście: `/dashboard/warehouse/items/[productId]/edit`.
- PL: `/dashboard/magazyn/produkty/[productId]/edytuj` · EN: `/en/dashboard/warehouse/items/[productId]/edit`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/[productId]/edit/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R084 — Stary adres pól własnych — przekierowanie do ustawień

- Wejście: `/dashboard/warehouse/items/custom-fields`.
- PL: `/dashboard/warehouse/items/custom-fields` · EN: `/en/dashboard/warehouse/items/custom-fields`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/custom-fields/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R085 — Import produktów

- Wejście: `/dashboard/warehouse/items/import`.
- PL: `/dashboard/magazyn/produkty/import` · EN: `/en/dashboard/warehouse/items/import`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/import/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R086 — Nowy produkt

- Wejście: `/dashboard/warehouse/items/new`.
- PL: `/dashboard/magazyn/produkty/nowy` · EN: `/en/dashboard/warehouse/items/new`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/items/new/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R087 — Etykiety — stary moduł magazynowy

- Wejście: `/dashboard/warehouse/labels`.
- PL: `/dashboard/magazyn/etykiety` · EN: `/en/dashboard/warehouse/labels`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/labels/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R088 — Lokalizacje magazynowe

- Wejście: `/dashboard/warehouse/locations`.
- PL: `/dashboard/magazyn/lokalizacje` · EN: `/en/dashboard/warehouse/locations`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/locations/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R089 — Mapy magazynu

- Wejście: `/dashboard/warehouse/map`.
- PL: `/dashboard/magazyn/mapa` · EN: `/en/dashboard/warehouse/map`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/map/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R090 — Edytor mapy magazynu

- Wejście: `/dashboard/warehouse/map/[layoutId]`.
- PL: `/dashboard/magazyn/mapa/[layoutId]` · EN: `/en/dashboard/warehouse/map/[layoutId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/map/[layoutId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R091 — Zamówienia zakupu

- Wejście: `/dashboard/warehouse/purchase-orders`.
- PL: `/dashboard/magazyn/zamowienia-zakupu` · EN: `/en/dashboard/warehouse/purchase-orders`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/purchase-orders/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R092 — Przegląd zakupów

- Wejście: `/dashboard/warehouse/purchases`.
- PL: `/dashboard/magazyn/zakupy` · EN: `/en/dashboard/warehouse/purchases`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/purchases/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R093 — Sugestie uzupełnienia zapasów

- Wejście: `/dashboard/warehouse/reports/reorder`.
- PL: `/dashboard/magazyn/raporty/uzupelnienia` · EN: `/en/dashboard/warehouse/reports/reorder`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/reports/reorder/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R094 — Przegląd sprzedaży

- Wejście: `/dashboard/warehouse/sales`.
- PL: `/dashboard/magazyn/sprzedaz` · EN: `/en/dashboard/warehouse/sales`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/sales/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R095 — Zamówienia sprzedaży

- Wejście: `/dashboard/warehouse/sales-orders`.
- PL: `/dashboard/magazyn/zamowienia-sprzedazy` · EN: `/en/dashboard/warehouse/sales-orders`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/sales-orders/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R096 — Skanowanie dostawy

- Wejście: `/dashboard/warehouse/scanning/delivery`.
- PL: `/dashboard/magazyn/skanowanie/dostawy` · EN: `/en/dashboard/warehouse/scanning/delivery`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/scanning/delivery/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R097 — Ustawienia magazynu i słowniki

- Wejście: `/dashboard/warehouse/settings`.
- PL: `/dashboard/magazyn/ustawienia` · EN: `/en/dashboard/warehouse/settings`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/settings/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R098 — Dostawcy — stary moduł

- Wejście: `/dashboard/warehouse/suppliers`.
- PL: `/dashboard/magazyn/dostawcy` · EN: `/en/dashboard/warehouse/suppliers`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/warehouse/suppliers/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V053 — Liczenie: widok kompaktowy / warianty pozycji

- Wejście: `/dashboard/warehouse/audits/[id]/count` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/count/_components/guided-count/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V054 — Liczenie: zmiana lokalizacji

- Wejście: `/dashboard/warehouse/audits/[id]/count` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/count/_components/guided-count/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V055 — Liczenie: przerwanie i wznowienie sesji

- Wejście: `/dashboard/warehouse/audits/[id]/count` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/count/_components/guided-count/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V056 — Różnice: potwierdzenie opuszczenia weryfikacji

- Wejście: `/dashboard/warehouse/audits/[id]/review` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/review/_components/variance-review/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V057 — Inwentaryzacja: typ i oddział

- Wejście: `/dashboard/warehouse/audits/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/new/_components/audit-wizard/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V058 — Inwentaryzacja: zakres lokalizacji lub dostawcy

- Wejście: `/dashboard/warehouse/audits/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/new/_components/audit-wizard/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V059 — Inwentaryzacja: protokół

- Wejście: `/dashboard/warehouse/audits/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/new/_components/audit-wizard/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V060 — Inwentaryzacja: podsumowanie przed utworzeniem

- Wejście: `/dashboard/warehouse/audits/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [index.tsx](../../src/app/[locale]/dashboard/warehouse/audits/new/_components/audit-wizard/index.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V061 — Dokument magazynowy: szczegóły w panelu listy

- Wejście: `/dashboard/warehouse/inventory/movements` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [inventory-movements-client.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movements-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V062 — Produkt: szczegóły w panelu listy

- Wejście: `/dashboard/warehouse/items` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [inventory-products-client.tsx](../../src/app/[locale]/dashboard/warehouse/items/_components/inventory-products-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V063 — Wyszukanie i przypisanie kontrahenta w produkcie

- Wejście: `/dashboard/warehouse/items/[productId]/edit` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [contractor-lookup-dialog.tsx](../../src/components/crm/contractor-lookup-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V064 — Lokalizacja: informacje

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [location-detail-panel.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/location-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V065 — Lokalizacja: zawartość magazynowa

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [location-detail-panel.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/location-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V066 — Lokalizacja: historia ruchów

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [location-detail-panel.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/location-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V067 — Lokalizacja: przypisanie i skan QR

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [assign-qr-location-dialog.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/assign-qr-location-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V068 — Lokalizacja: druk pojedynczej etykiety

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [print-location-label-dialog.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/print-location-label-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V069 — Lokalizacje: druk etykiet zbiorczych

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [print-location-labels-dialog.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/print-location-labels-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V070 — Mapa: tworzenie nowego układu

- Wejście: `/dashboard/warehouse/map` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [map-list-client.tsx](../../src/app/[locale]/dashboard/warehouse/map/_components/map-list-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V071 — Edytor mapy: tryb edycji i podgląd

- Wejście: `/dashboard/warehouse/map/[layoutId]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [map-editor.tsx](../../src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V072 — Edytor mapy: konfiguracja i publikacja

- Wejście: `/dashboard/warehouse/map/[layoutId]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [map-editor.tsx](../../src/app/[locale]/dashboard/warehouse/map/[layoutId]/_components/map-editor.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V074 — Lokalizacje: drzewo i reorganizacja

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [ambra-locations-client.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/ambra-locations-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V075 — Lokalizacje: tabela / lista

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [locations-data-view.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_components/locations-data-view.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V076 — Lokalizacja: tworzenie

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationModal.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationModal.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V077 — Lokalizacja: edycja

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationModal.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationModal.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V078 — Lokalizacja: krok danych podstawowych

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationModal.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationModal.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V079 — Lokalizacja: krok typu i operacji

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationModal.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationModal.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V080 — Lokalizacja: krok parametrów fizycznych

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationModal.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationModal.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V081 — Lokalizacje: przeniesienie w hierarchii

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationsPage.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationsPage.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V082 — Lokalizacje: eksport danych

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [LocationExportDialog.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/LocationExportDialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V083 — Lokalizacje: raport spójności mapowania

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [WorkspaceHealthReportDialog.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/workspaces/WorkspaceHealthReportDialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V084 — Lokalizacje: interaktywny podgląd mapy

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [InteractiveLocationMapPreview.tsx](../../src/app/[locale]/dashboard/warehouse/locations/_ambra/components/locations/InteractiveLocationMapPreview.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V088 — Dokument: dane dokumentu

- Wejście: `/dashboard/warehouse/inventory/movements/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [movement-document-data-tab.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-document-data-tab.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V089 — Dokument: pozycje

- Wejście: `/dashboard/warehouse/inventory/movements/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [movement-positions-tab.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-positions-tab.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V090 — Dokument: import pozycji

- Wejście: `/dashboard/warehouse/inventory/movements/new` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [movement-import-dialog.tsx](../../src/app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-import-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V091 — Produkt: przypisanie dostawców

- Wejście: `/dashboard/warehouse/items/[productId]/edit` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [crm-item-suppliers-panel.tsx](../../src/app/[locale]/dashboard/warehouse/items/[productId]/edit/_components/crm-item-suppliers-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V092 — Raport inwentaryzacji: propozycje uzupełnień

- Wejście: `/dashboard/warehouse/audits/[id]/report` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [report-reorder-panel.tsx](../../src/app/[locale]/dashboard/warehouse/audits/[id]/report/_components/final-report/report-reorder-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V093 — Ustawienia: etykiety lokalizacji

- Wejście: `/dashboard/warehouse/settings` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [location-label-defaults-settings.tsx](../../src/app/[locale]/dashboard/warehouse/settings/_components/location-label-defaults-settings.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 03. Warsztat (4)

### R099 — Zlecenia warsztatowe

- Wejście: `/dashboard/workshop`.
- PL: `/dashboard/warsztat` · EN: `/en/dashboard/workshop`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/workshop/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R100 — Szczegóły zlecenia warsztatowego

- Wejście: `/dashboard/workshop/[id]`.
- PL: `/dashboard/warsztat/[id]` · EN: `/en/dashboard/workshop/[id]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/workshop/[id]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R101 — Nowe zlecenie warsztatowe

- Wejście: `/dashboard/workshop/new`.
- PL: `/dashboard/warsztat/nowe` · EN: `/en/dashboard/workshop/new`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/workshop/new/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V073 — Zlecenie warsztatowe: edycja nagłówka

- Wejście: `/dashboard/workshop/[id]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [repair-order-header-editor.tsx](../../src/app/[locale]/dashboard/workshop/[id]/_components/repair-order-header-editor.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 04. CRM (8)

### R030 — Pulpit CRM

- Wejście: `/dashboard/crm`.
- PL: `/dashboard/crm` · EN: `/en/dashboard/crm`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/crm/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R031 — Kontakty

- Wejście: `/dashboard/crm/contacts`.
- PL: `/dashboard/crm/contacts` · EN: `/en/dashboard/crm/contacts`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/crm/contacts/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R032 — Kontrahenci

- Wejście: `/dashboard/crm/parties`.
- PL: `/dashboard/crm/parties` · EN: `/en/dashboard/crm/parties`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/crm/parties/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R033 — Ustawienia CRM

- Wejście: `/dashboard/crm/settings`.
- PL: `/dashboard/crm/settings` · EN: `/en/dashboard/crm/settings`.
- Status: szkielet / brak pełnej funkcji; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/crm/settings/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V001 — Kontrahenci: panel szczegółów i edycja

- Wejście: `/dashboard/crm/parties` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [party-detail-panel.tsx](../../src/app/[locale]/dashboard/crm/parties/_components/party-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V002 — Kontrahenci: utworzenie nowego podmiotu

- Wejście: `/dashboard/crm/parties` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [party-detail-panel.tsx](../../src/app/[locale]/dashboard/crm/parties/_components/party-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V003 — Kontakty: panel szczegółów i edycja

- Wejście: `/dashboard/crm/contacts` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [contact-detail-panel.tsx](../../src/app/[locale]/dashboard/crm/contacts/_components/contact-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V004 — Kontakty: utworzenie kontaktu

- Wejście: `/dashboard/crm/contacts` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [contact-detail-panel.tsx](../../src/app/[locale]/dashboard/crm/contacts/_components/contact-detail-panel.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 05. Help Desk (14)

### R036 — Pulpit Help Desk

- Wejście: `/dashboard/help-desk`.
- PL: `/dashboard/help-desk` · EN: `/en/dashboard/help-desk`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R037 — Ustawienia Help Desk

- Wejście: `/dashboard/help-desk/settings`.
- PL: `/dashboard/help-desk/ustawienia` · EN: `/en/dashboard/help-desk/settings`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/settings/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R038 — Typy zgłoszeń

- Wejście: `/dashboard/help-desk/ticket-types`.
- PL: `/dashboard/help-desk/typy-zgloszen` · EN: `/en/dashboard/help-desk/ticket-types`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R039 — Szczegóły typu zgłoszenia

- Wejście: `/dashboard/help-desk/ticket-types/[typeId]`.
- PL: `/dashboard/help-desk/typy-zgloszen/[typeId]` · EN: `/en/dashboard/help-desk/ticket-types/[typeId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/[typeId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R040 — Zgłoszenia

- Wejście: `/dashboard/help-desk/tickets`.
- PL: `/dashboard/help-desk/zgloszenia` · EN: `/en/dashboard/help-desk/tickets`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R041 — Szczegóły zgłoszenia

- Wejście: `/dashboard/help-desk/tickets/[ticketId]`.
- PL: `/dashboard/help-desk/zgloszenia/[ticketId]` · EN: `/en/dashboard/help-desk/tickets/[ticketId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/[ticketId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R042 — Nowe zgłoszenie

- Wejście: `/dashboard/help-desk/tickets/new`.
- PL: `/dashboard/help-desk/zgloszenia/nowe` · EN: `/en/dashboard/help-desk/tickets/new`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/new/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V007 — Typ zgłoszenia: tworzenie

- Wejście: `/dashboard/help-desk/ticket-types` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [ticket-type-form-dialog.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/_components/ticket-type-form-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V008 — Typ zgłoszenia: edycja

- Wejście: `/dashboard/help-desk/ticket-types` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [ticket-type-form-dialog.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/_components/ticket-type-form-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V009 — Typy zgłoszeń: panel szczegółów

- Wejście: `/dashboard/help-desk/ticket-types` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [ticket-types-client.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/_components/ticket-types-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V010 — Typy zgłoszeń: archiwizacja

- Wejście: `/dashboard/help-desk/ticket-types` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [ticket-types-client.tsx](../../src/app/[locale]/dashboard/help-desk/ticket-types/_components/ticket-types-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V011 — Zgłoszenia: szczegóły w panelu listy

- Wejście: `/dashboard/help-desk/tickets` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tickets-client.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/_components/tickets-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V012 — Zgłoszenie: wygenerowanie/przypisanie QR

- Wejście: `/dashboard/help-desk/tickets` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [assign-qr-dialog.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/[ticketId]/_components/assign-qr-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V013 — Zgłoszenie: skanowanie istniejącej etykiety i odłączenie kodu

- Wejście: `/dashboard/help-desk/tickets` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [assign-qr-dialog.tsx](../../src/app/[locale]/dashboard/help-desk/tickets/[ticketId]/_components/assign-qr-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 06. Planowanie (16)

### R056 — Kalendarz planowania

- Wejście: `/dashboard/planning`.
- PL: `/dashboard/planowanie` · EN: `/en/dashboard/planning`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/planning/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R057 — Tablice Kanban

- Wejście: `/dashboard/planning/boards`.
- PL: `/dashboard/planowanie/tablice` · EN: `/en/dashboard/planning/boards`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/planning/boards/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R058 — Ustawienia planowania

- Wejście: `/dashboard/planning/settings`.
- PL: `/dashboard/planowanie/ustawienia` · EN: `/en/dashboard/planning/settings`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/planning/settings/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R059 — Zadania

- Wejście: `/dashboard/planning/tasks`.
- PL: `/dashboard/planowanie/zadania` · EN: `/en/dashboard/planning/tasks`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/planning/tasks/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R060 — Szczegóły zadania

- Wejście: `/dashboard/planning/tasks/[taskId]`.
- PL: `/dashboard/planowanie/zadania/[taskId]` · EN: `/en/dashboard/planning/tasks/[taskId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/planning/tasks/[taskId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V025 — Kalendarz: tryby prezentacji i wybór daty

- Wejście: `/dashboard/planning` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-calendar-client.tsx](../../src/app/[locale]/dashboard/planning/_components/planning-calendar-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V026 — Kalendarz: tworzenie i edycja wydarzenia

- Wejście: `/dashboard/planning` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-calendar-client.tsx](../../src/app/[locale]/dashboard/planning/_components/planning-calendar-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V027 — Kanban: wybór tablicy

- Wejście: `/dashboard/planning/boards` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-boards-client.tsx](../../src/app/[locale]/dashboard/planning/boards/_components/planning-boards-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V028 — Kanban: nowa tablica

- Wejście: `/dashboard/planning/boards` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-boards-client.tsx](../../src/app/[locale]/dashboard/planning/boards/_components/planning-boards-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V029 — Kanban: ustawienia tablicy

- Wejście: `/dashboard/planning/boards` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-boards-client.tsx](../../src/app/[locale]/dashboard/planning/boards/_components/planning-boards-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V030 — Kanban: dodanie karty

- Wejście: `/dashboard/planning/boards` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-boards-client.tsx](../../src/app/[locale]/dashboard/planning/boards/_components/planning-boards-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V031 — Kanban: szczegóły i edycja karty

- Wejście: `/dashboard/planning/boards` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-boards-client.tsx](../../src/app/[locale]/dashboard/planning/boards/_components/planning-boards-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V032 — Zadania: lista

- Wejście: `/dashboard/planning/tasks` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tasks-client.tsx](../../src/app/[locale]/dashboard/planning/tasks/_components/tasks-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V033 — Zadania: Kanban

- Wejście: `/dashboard/planning/tasks` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tasks-client.tsx](../../src/app/[locale]/dashboard/planning/tasks/_components/tasks-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V034 — Zadania: panel szczegółów

- Wejście: `/dashboard/planning/tasks` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tasks-client.tsx](../../src/app/[locale]/dashboard/planning/tasks/_components/tasks-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V035 — Zadanie: tworzenie w dialogu

- Wejście: `/dashboard/planning/tasks` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [planning-task-create-dialog.tsx](../../src/app/[locale]/dashboard/planning/tasks/_components/planning-task-create-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 07. Narzędzia (10)

### R064 — Katalog i moje narzędzia

- Wejście: `/dashboard/tools`.
- PL: `/dashboard/narzedzia` · EN: `/en/dashboard/tools`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/tools/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R065 — Ekran wybranego narzędzia

- Wejście: `/dashboard/tools/[slug]`.
- PL: `/dashboard/narzedzia/[slug]` · EN: `/en/dashboard/tools/[slug]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/tools/[slug]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V045 — Narzędzia: wszystkie narzędzia

- Wejście: `/dashboard/tools` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tools-unified-client.tsx](../../src/app/[locale]/dashboard/tools/_components/tools-unified-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V046 — Narzędzia: moje narzędzia

- Wejście: `/dashboard/tools` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [tools-unified-client.tsx](../../src/app/[locale]/dashboard/tools/_components/tools-unified-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V047 — Matcher SVWMS/WDD — osobne narzędzie

- Wejście: `/dashboard/tools/svwms-wdd-matcher` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [registry.tsx](../../src/lib/tools/registry.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V048 — Generator QR — osobne narzędzie

- Wejście: `/dashboard/tools/qr-generator` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [registry.tsx](../../src/lib/tools/registry.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V049 — Matcher: lista ekstrakcji

- Wejście: `/dashboard/tools/[slug]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [extraction-review-view.tsx](../../src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V050 — Matcher: wyniki dopasowania

- Wejście: `/dashboard/tools/[slug]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [extraction-review-view.tsx](../../src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V051 — Matcher: diagnostyka ekstrakcji

- Wejście: `/dashboard/tools/[slug]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [extraction-review-view.tsx](../../src/components/tools/svwms-wdd-matcher/extraction-review-view.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V052 — Matcher: podgląd dokumentu PDF

- Wejście: `/dashboard/tools/[slug]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [pdf-preview-dialog.tsx](../../src/components/tools/svwms-wdd-matcher/pdf-preview-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 08. QR i dostęp po skanowaniu (15)

### R061 — Zarządzanie kodami QR i etykietami

- Wejście: `/dashboard/qr`.
- PL: `/dashboard/kody-qr` · EN: `/en/dashboard/qr`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/qr/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R062 — Kreator przypisania kodu QR

- Wejście: `/dashboard/qr/assign/[token]`.
- PL: `/dashboard/kody-qr/przypisz/[token]` · EN: `/en/dashboard/qr/assign/[token]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/qr/assign/[token]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R106 — Obsługa publicznego kodu QR

- Wejście: `/qr/[token]`.
- PL: `/qr/[token]` · EN: `/qr/[token]`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/qr/[token]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R107 — Obsługa publicznego kodu QR

- Wejście: `/qr/[token]`.
- PL: `/qr/[token]` · EN: `/en/qr/[token]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/[locale]/qr/[token]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R108 — Błąd obsługi QR

- Wejście: `/qr/error`.
- PL: `/qr/error` · EN: `/qr/error`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/qr/error/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R109 — Nieznany kod QR

- Wejście: `/qr/not-found`.
- PL: `/qr/not-found` · EN: `/qr/not-found`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/qr/not-found/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V036 — QR: etap wyboru kodów

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [qr-management-client.tsx](../../src/app/[locale]/dashboard/qr/_components/qr-management-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V037 — QR: etap projektowania etykiet

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [qr-management-client.tsx](../../src/app/[locale]/dashboard/qr/_components/qr-management-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V038 — QR: panel szczegółów kodu

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [qr-management-client.tsx](../../src/app/[locale]/dashboard/qr/_components/qr-management-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V039 — Projektant etykiet: układ

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [label-designer.tsx](../../src/app/[locale]/dashboard/qr/_components/label-designer.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V040 — Projektant etykiet: kod QR

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [label-designer.tsx](../../src/app/[locale]/dashboard/qr/_components/label-designer.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V041 — Projektant etykiet: tekst

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [label-designer.tsx](../../src/app/[locale]/dashboard/qr/_components/label-designer.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V042 — Projektant etykiet: zapis i wybór szablonu

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [label-designer.tsx](../../src/app/[locale]/dashboard/qr/_components/label-designer.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V043 — Etykiety: podgląd PDF i drukowanie

- Wejście: `/dashboard/qr` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [qr-pdf-preview-dialog.tsx](../../src/app/[locale]/dashboard/qr/_components/qr-pdf-preview-dialog.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V044 — Przypisanie QR: wybór obiektu i finalizacja

- Wejście: `/dashboard/qr/assign/[token]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [quick-assign-wizard.tsx](../../src/app/[locale]/dashboard/qr/assign/[token]/_components/quick-assign-wizard.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 09. Organizacja i dostęp (27)

### R043 — Rozliczenia organizacji

- Wejście: `/dashboard/organization/billing`.
- PL: `/dashboard/organizacja/rozliczenia` · EN: `/en/dashboard/organization/billing`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/billing/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R044 — Oddziały

- Wejście: `/dashboard/organization/branches`.
- PL: `/dashboard/organizacja/oddzialy` · EN: `/en/dashboard/organization/branches`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/branches/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R045 — Edycja profilu organizacji

- Wejście: `/dashboard/organization/profile`.
- PL: `/dashboard/organizacja/profil` · EN: `/en/dashboard/organization/profile`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/profile/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R046 — Wejście do profilu publicznego organizacji

- Wejście: `/dashboard/organization/public-profile`.
- PL: `/dashboard/organizacja/profil-publiczny` · EN: `/en/dashboard/organization/public-profile`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R047 — Profil publiczny — organizacja, oddziały, członkowie

- Wejście: `/dashboard/organization/public-profile/[tab]`.
- PL: `/dashboard/organizacja/profil-publiczny/[tab]` · EN: `/en/dashboard/organization/public-profile/[tab]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/[tab]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R048 — Profil publiczny członka organizacji

- Wejście: `/dashboard/organization/public-profile/members/[memberId]`.
- PL: `/dashboard/organizacja/profil-publiczny/czlonkowie/[memberId]` · EN: `/en/dashboard/organization/public-profile/members/[memberId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/members/[memberId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R049 — Wejście do zarządzania użytkownikami

- Wejście: `/dashboard/organization/users`.
- PL: `/dashboard/organizacja/uzytkownicy` · EN: `/en/dashboard/organization/users`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R050 — Stary adres oddziałów

- Wejście: `/dashboard/organization/users/branches`.
- PL: `/dashboard/organizacja/uzytkownicy/oddzialy` · EN: `/en/dashboard/organization/users/branches`.
- Status: przekierowanie — zweryfikować przebieg; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/branches/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R051 — Zaproszenia

- Wejście: `/dashboard/organization/users/invitations`.
- PL: `/dashboard/organizacja/uzytkownicy/zaproszenia` · EN: `/en/dashboard/organization/users/invitations`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/invitations/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R052 — Członkowie organizacji

- Wejście: `/dashboard/organization/users/members`.
- PL: `/dashboard/organizacja/uzytkownicy/czlonkowie` · EN: `/en/dashboard/organization/users/members`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/members/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R053 — Szczegóły członka i jego dostępu

- Wejście: `/dashboard/organization/users/members/[memberId]`.
- PL: `/dashboard/organizacja/uzytkownicy/czlonkowie/[memberId]` · EN: `/en/dashboard/organization/users/members/[memberId]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/members/[memberId]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R054 — Stanowiska

- Wejście: `/dashboard/organization/users/positions`.
- PL: `/dashboard/organizacja/uzytkownicy/stanowiska` · EN: `/en/dashboard/organization/users/positions`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/positions/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R055 — Role i uprawnienia

- Wejście: `/dashboard/organization/users/roles`.
- PL: `/dashboard/organizacja/uzytkownicy/role` · EN: `/en/dashboard/organization/users/roles`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/users/roles/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V014 — Oddział: tworzenie

- Wejście: `/dashboard/organization/branches` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [branches-client.tsx](../../src/app/[locale]/dashboard/organization/branches/_components/branches-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V015 — Oddział: edycja

- Wejście: `/dashboard/organization/branches` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [branches-client.tsx](../../src/app/[locale]/dashboard/organization/branches/_components/branches-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V016 — Zaproszenie: formularz i zakres ról

- Wejście: `/dashboard/organization/users/invitations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [invitations-client.tsx](../../src/app/[locale]/dashboard/organization/users/invitations/_components/invitations-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V017 — Członkowie: dialog zaproszenia

- Wejście: `/dashboard/organization/users/members` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [members-client.tsx](../../src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V018 — Członkowie: zmiana roli / potwierdzenie usunięcia dostępu

- Wejście: `/dashboard/organization/users/members` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [members-client.tsx](../../src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V019 — Członek: zakładka informacji

- Wejście: `/dashboard/organization/users/members/[memberId]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [member-detail-client.tsx](../../src/app/[locale]/dashboard/organization/users/members/[memberId]/_components/member-detail-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V020 — Członek: zakładka dostępu i zakres oddziałów

- Wejście: `/dashboard/organization/users/members/[memberId]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [member-detail-client.tsx](../../src/app/[locale]/dashboard/organization/users/members/[memberId]/_components/member-detail-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V021 — Członek: edycja uprawnień / potwierdzenia

- Wejście: `/dashboard/organization/users/members/[memberId]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [member-detail-client.tsx](../../src/app/[locale]/dashboard/organization/users/members/[memberId]/_components/member-detail-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V022 — Stanowisko: tworzenie i edycja

- Wejście: `/dashboard/organization/users/positions` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [positions-client.tsx](../../src/app/[locale]/dashboard/organization/users/positions/_components/positions-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V023 — Rola: tworzenie

- Wejście: `/dashboard/organization/users/roles` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [roles-client.tsx](../../src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V024 — Rola: edycja i wybór uprawnień

- Wejście: `/dashboard/organization/users/roles` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [roles-client.tsx](../../src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V085 — Profil publiczny: organizacja

- Wejście: `/dashboard/organization/public-profile/organization` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/[tab]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V086 — Profil publiczny: oddziały

- Wejście: `/dashboard/organization/public-profile/branches` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/[tab]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V087 — Profil publiczny: członkowie

- Wejście: `/dashboard/organization/public-profile/members` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/organization/public-profile/[tab]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 10. Moje konto (5)

### R023 — Ustawienia powiadomień

- Wejście: `/dashboard/account/notifications`.
- PL: `/dashboard/konto/powiadomienia` · EN: `/en/dashboard/account/notifications`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/account/notifications/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R024 — Preferencje i wygląd

- Wejście: `/dashboard/account/preferences`.
- PL: `/dashboard/konto/ustawienia` · EN: `/en/dashboard/account/preferences`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/account/preferences/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R025 — Mój profil

- Wejście: `/dashboard/account/profile`.
- PL: `/dashboard/konto/profil` · EN: `/en/dashboard/account/profile`.
- Status: UI istnieje; wymaga przeglądu; dostęp: sesja + organizacja + uprawnienia modułu.
- Źródło: [page.tsx](../../src/app/[locale]/dashboard/account/profile/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V005 — Wygląd: potwierdzenie pobrania ustawień z chmury

- Wejście: `/dashboard/account/preferences` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [appearance-section.tsx](../../src/app/[locale]/dashboard/account/preferences/_components/appearance-section.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V006 — Wygląd: przywrócenie ustawień domyślnych

- Wejście: `/dashboard/account/preferences` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [appearance-section.tsx](../../src/app/[locale]/dashboard/account/preferences/_components/appearance-section.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 11. Administracja platformą i demonstracje (17)

### R002 — Panel administratora platformy

- Wejście: `/admin`.
- PL: `/admin` · EN: `/en/admin`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R003 — Analityka platformy

- Wejście: `/admin/analytics`.
- PL: `/admin/analityka` · EN: `/en/admin/analytics`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/analytics/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R004 — Zarządzanie aplikacją

- Wejście: `/admin/app-management`.
- PL: `/admin/zarzadzanie-aplikacja` · EN: `/en/admin/app-management`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/app-management/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R005 — Demo awatarów

- Wejście: `/admin/avatar-demo`.
- PL: `/admin/avatar-demo` · EN: `/en/admin/avatar-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/avatar-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R006 — Branding platformy

- Wejście: `/admin/branding`.
- PL: `/admin/branding` · EN: `/en/admin/branding`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/branding/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R007 — Demo kalendarza

- Wejście: `/admin/calendar-demo`.
- PL: `/admin/calendar-demo` · EN: `/en/admin/calendar-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/calendar-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R008 — Demo komentarzy

- Wejście: `/admin/comments-demo`.
- PL: `/admin/comments-demo` · EN: `/en/admin/comments-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/comments-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R009 — Demo list i szczegółów DataView

- Wejście: `/admin/data-view-demo`.
- PL: `/admin/data-view-demo` · EN: `/en/admin/data-view-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/data-view-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R010 — Dostęp do funkcji i limity organizacji

- Wejście: `/admin/entitlements`.
- PL: `/admin/entitlements` · EN: `/en/admin/entitlements`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/entitlements/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R011 — Logi systemowe

- Wejście: `/admin/logs`.
- PL: `/admin/logi` · EN: `/en/admin/logs`.
- Status: szkielet / brak pełnej funkcji; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/logs/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R012 — Użytkownicy organizacji — administracja

- Wejście: `/admin/org-members`.
- PL: `/admin/org-members` · EN: `/en/admin/org-members`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/org-members/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R013 — Plany subskrypcji

- Wejście: `/admin/plans`.
- PL: `/admin/plany` · EN: `/en/admin/plans`.
- Status: szkielet / brak pełnej funkcji; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/plans/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R014 — Konfiguracja cen

- Wejście: `/admin/pricing`.
- PL: `/admin/cennik` · EN: `/en/admin/pricing`.
- Status: szkielet / brak pełnej funkcji; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/pricing/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R015 — Katalog komponentów UI

- Wejście: `/admin/primitives`.
- PL: `/admin/primitives` · EN: `/en/admin/primitives`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/primitives/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R016 — Demo edytora treści

- Wejście: `/admin/rich-text-demo`.
- PL: `/admin/rich-text-demo` · EN: `/en/admin/rich-text-demo`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/rich-text-demo/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R017 — Ustawienia witryny i rejestracji

- Wejście: `/admin/site`.
- PL: `/admin/site` · EN: `/en/admin/site`.
- Status: UI istnieje; wymaga przeglądu; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/site/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R018 — Narzędzia testowe administratora

- Wejście: `/admin/testing`.
- PL: `/admin/testowanie` · EN: `/en/admin/testing`.
- Status: demo / diagnostyka — niższy priorytet; dostęp: administrator platformy; odrębne uprawnienia.
- Źródło: [page.tsx](../../src/app/[locale]/admin/testing/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 12. Uwierzytelnienie, onboarding i ekrany systemowe (11)

### R001 — Nieznany adres — publiczny ekran 404

- Wejście: `/[...rest]`.
- PL: `/[...rest]` · EN: `/en/[...rest]`.
- Status: ekran systemowy; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/[locale]/[...rest]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R019 — Błąd uwierzytelnienia — wersja lokalizowana

- Wejście: `/auth-code-error`.
- PL: `/auth-code-error` · EN: `/en/auth-code-error`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/auth-code-error/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R020 — Błąd uwierzytelnienia — wejście techniczne

- Wejście: `/auth/auth-code-error`.
- PL: `/auth/auth-code-error` · EN: `/auth/auth-code-error`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/auth/auth-code-error/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R102 — Odzyskanie hasła

- Wejście: `/forgot-password`.
- PL: `/forgot-password` · EN: `/en/forgot-password`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/forgot-password/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R103 — Podgląd i przyjęcie zaproszenia

- Wejście: `/invite/[token]`.
- PL: `/zaproszenie/[token]` · EN: `/en/invite/[token]`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/[locale]/invite/[token]/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R104 — Wybór oczekującego zaproszenia

- Wejście: `/invite/resolve`.
- PL: `/zaproszenie/resolve` · EN: `/en/invite/resolve`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/[locale]/invite/resolve/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R105 — Konfiguracja organizacji i obsługa zaproszeń

- Wejście: `/onboarding`.
- PL: `/onboarding` · EN: `/en/onboarding`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](../../src/app/[locale]/onboarding/page.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R110 — Rejestracja wyłączona

- Wejście: `/registration-disabled`.
- PL: `/registration-disabled` · EN: `/en/registration-disabled`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/registration-disabled/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R111 — Ustawienie lub zmiana hasła

- Wejście: `/reset-password`.
- PL: `/reset-password` · EN: `/en/reset-password`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/reset-password/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R112 — Logowanie

- Wejście: `/sign-in`.
- PL: `/sign-in` · EN: `/en/sign-in`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/sign-in/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### R113 — Rejestracja

- Wejście: `/sign-up`.
- PL: `/sign-up` · EN: `/en/sign-up`.
- Status: UI istnieje; wymaga przeglądu; dostęp: zależny od sesji/tokenu/konfiguracji.
- Źródło: [page.tsx](<../../src/app/[locale]/(public)/(auth)/sign-up/page.tsx>).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

## 13. Błędy i brak zasobu (18)

### V104 — Błąd i ponowienie: [locale]/dashboard/analytics

- Wejście: `/dashboard/analytics` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/analytics/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V105 — Błąd i ponowienie: [locale]/dashboard/crm/contacts

- Wejście: `/dashboard/crm/contacts` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/crm/contacts/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V106 — Błąd i ponowienie: [locale]/dashboard/crm

- Wejście: `/dashboard/crm` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/crm/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V107 — Błąd i ponowienie: [locale]/dashboard/crm/parties

- Wejście: `/dashboard/crm/parties` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/crm/parties/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V108 — Błąd i ponowienie: [locale]/dashboard/crm/settings

- Wejście: `/dashboard/crm/settings` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/crm/settings/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V109 — Błąd i ponowienie: [locale]/dashboard

- Wejście: `/dashboard` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V110 — Błąd i ponowienie: [locale]/dashboard/help-desk

- Wejście: `/dashboard/help-desk` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/help-desk/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V111 — Nie znaleziono zasobu: [locale]/dashboard

- Wejście: `/dashboard` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [not-found.tsx](../../src/app/[locale]/dashboard/not-found.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V112 — Błąd i ponowienie: [locale]/dashboard/organization

- Wejście: `/dashboard/organization` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/organization/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V113 — Błąd i ponowienie: [locale]/dashboard/organization/users

- Wejście: `/dashboard/organization/users` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/organization/users/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V114 — Błąd i ponowienie: [locale]/dashboard/planning

- Wejście: `/dashboard/planning` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/planning/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V115 — Błąd i ponowienie: [locale]/dashboard/start

- Wejście: `/dashboard/start` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/start/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V116 — Błąd i ponowienie: [locale]/dashboard/tools

- Wejście: `/dashboard/tools` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/tools/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V117 — Błąd i ponowienie: [locale]/dashboard/warehouse

- Wejście: `/dashboard/warehouse` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/warehouse/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V118 — Błąd i ponowienie: [locale]/dashboard/warehouse/locations

- Wejście: `/dashboard/warehouse/locations` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/warehouse/locations/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V119 — Błąd i ponowienie: [locale]/dashboard/workshop

- Wejście: `/dashboard/workshop` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/dashboard/workshop/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V120 — Błąd i ponowienie: [locale]

- Wejście: `/[locale]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [error.tsx](../../src/app/[locale]/error.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.

### V121 — Nie znaleziono zasobu: [locale]

- Wejście: `/[locale]` — wariant wewnątrz widoku / wskazany kontekst.
- Źródło: [not-found.tsx](../../src/app/[locale]/not-found.tsx).
- [ ] Desktop — zaprojektowany, wdrożony i zweryfikowany.
- [ ] Mobile — zaprojektowany, wdrożony i zweryfikowany.
- Dowód odbioru: do uzupełnienia po wykonaniu.
