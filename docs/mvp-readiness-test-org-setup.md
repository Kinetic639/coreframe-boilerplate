# Ambra — testowa organizacja i użytkownicy do prezentacji MVP

## Cel dokumentu

Ten dokument opisuje, jaką organizację testową, oddziały, role i kont użytkowników trzeba przygotować w aplikacji (`apps/web`), aby móc na żywo zaprezentować obszary MVP, które są dziś gotowe do pokazania: **Obszar 1 — Etykiety QR i lokalizacje** oraz **Obszar 2 — Komunikacja doradca–części (Help Desk)**.

Cała konfiguracja opisana poniżej odbywa się przez istniejące ekrany aplikacji — bez bezpośredniej ingerencji w bazę danych i bez zmian w kodzie.

---

## Zanim zaczniesz: dwa ryzyka do zweryfikowania

Nie są to rzeczy, które można naprawić z tego miejsca — to sygnały wprost z repozytorium, warte sprawdzenia zanim zbudujesz scenariusz prezentacji wokół nich:

1. **`docs/investor-feature-inventory.md` (katalog główny repo) stwierdza, że logowanie obecnie opiera się na zaszytym na sztywno ciasteczku „sesji demo", bez prawdziwego logowania.** Jeśli to nadal prawda, logowanie się jako realnie różni użytkownicy (doradca vs częściowiec, w osobnych kartach/urządzeniach) może nie działać tak, jak wymaga tego prezentacja z wieloma kontami. **Sprawdź to jako pierwszy krok**, zanim zbudujesz scenariusz zakładający przełączanie się między kontami na żywo.
2. **Nie istnieje żaden gotowy zestaw danych demonstracyjnych.** Wszystko poniżej trzeba przygotować ręcznie przez UI aplikacji — nie ma skrótu.

Dwa mniejsze utrudnienia, o których warto pamiętać:

- Przyjęcie zaproszenia do organizacji wymaga realnego dostępu do maila zaproszenia (albo ręcznego przejęcia tokena/linku) — użyj skrzynek, do których faktycznie masz dostęp.
- Jeśli plan wybrany przy zakładaniu organizacji nie zawiera od razu modułów `warehouse` i `help-desk`, jedyna droga naprawy w aplikacji (`/admin/entitlements`) wymaga flagi `dev_mode_enabled`, do której nie znaleziono przełącznika w UI — czyli utknięcia. **Wybierz właściwy plan już na etapie onboardingu.**

---

## Organizacja

Jedna organizacja wystarczy — żaden z gotowych obszarów nie wymaga prezentowania wielu organizacji jednocześnie. Nazwa dowolna, realistyczna (np. nawiązująca do marki Ambra albo fikcyjnego oddziału blacharsko-lakierniczego z wywiadów w `docs/mvp-readiness-plan.md`).

**Plan/pakiet:** taki, którego `enabled_modules` zawiera jednocześnie `warehouse` i `help-desk` — krok wyboru planu w kreatorze onboardingu pokazuje to wprost (lista modułów przy każdym planie), więc sprawdź to na miejscu zamiast zgadywać nazwę pakietu.

---

## Oddziały: 2

| Oddział                                                                                  | Rola w prezentacji                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Komorniki** (prawdziwa nazwa oddziału z wywiadów w planie — ładny, autentyczny akcent) | Główny oddział demo. Zawiera realne lokalizacje, oznaczone i zeskanowane etykietami QR — zgodnie ze scenariuszem Obszaru 1.                                                                                                                                                                                                                                                       |
| **Poznań Centrum** (lub dowolna druga nazwa)                                             | Celowo pozostawiony **bez żadnych lokalizacji**. To na nim pokazujesz prawdziwy pusty stan (i przycisk „dodaj pierwszą lokalizację" widoczny tylko dla uprawnionych — poprawkę wdrożoną w tej sesji), a także przełącznik oddziałów i izolację danych między oddziałami — kryterium gotowości, którego organizacja z jednym oddziałem fizycznie nie jest w stanie zademonstrować. |

Tworzenie oddziału: `/dashboard/organization/branches` (`createBranchAction`) — wymaga tylko nazwy.

---

## Użytkownicy: 4 (opcjonalnie 3)

| #   | Postać (zgodnie z rolami z Części 1 planu)      | Rola w systemie                       | Zakres            | Dlaczego                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------- | ------------------------------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Kierownik / administrator** — „Anna Kowalska" | wbudowana `org_owner`                 | cała organizacja  | Wykonuje całą konfigurację poniżej (oddziały, zaproszenia, typy zgłoszeń). Pełny dostęp (`module.*`, `warehouse.*`, `helpdesk.*`) — to też naturalny „kierownik" do przyszłych scenariuszy akceptacji (Obszary 7/11).                                                                                                                                                                     |
| 2   | **Częściowiec A** — „Piotr Nowak"               | **rola niestandardowa** — patrz niżej | oddział Komorniki | Główny aktor obu scenariuszy: tworzy/zarządza lokalizacjami, drukuje i skanuje etykiety QR, widzi wspólną kolejkę Help Desk, komentuje, zamyka zgłoszenia.                                                                                                                                                                                                                                |
| 3   | **Częściowiec B** — „Tomasz Kowalczyk"          | ta sama rola co #2                    | oddział Komorniki | Opcjonalny, ale wartościowy: zalogowanie się jako _drugi_ pracownik faktycznie dowodzi, że „cały zespół widzi wspólną kolejkę" (kryteria 13/23) — a nie tylko o tym mówi prezenter. Jeśli chcesz ograniczyć się do 3 kont, to pierwszy kandydat do usunięcia.                                                                                                                             |
| 4   | **Doradca** — „Marek Wiśniewski"                | wbudowana `org_member`                | cała organizacja  | Tworzy zgłoszenie w scenariuszu Obszaru 2. **Jednocześnie pełni rolę konta demonstrującego kontrolę uprawnień w Obszarze 1**: `org_member` nie ma `warehouse.locations.manage`, więc to konto pokazuje czysty, informacyjny pusty stan (bez przycisku „dodaj lokalizację") na oddziale Poznań Centrum — dowód, że kontrola uprawnień faktycznie działa. Nie trzeba do tego piątego konta. |

### Jedyna rola do utworzenia: „Pracownik Magazynu"

W aplikacji nie ma wbudowanej roli „częściowiec" ani „kierownik oddziału" — `org_owner` to pełen dostęp, `org_member` to głównie odczyt. Dla kont #2/#3 utwórz jedną niestandardową rolę **na poziomie oddziału** przez `/dashboard/organization/users/roles`, z uprawnieniami:

- `module.warehouse.access`, `warehouse.read`, `warehouse.locations.read`, `warehouse.locations.manage`
- `qr.read`, `qr.create`, `qr.assign`, `qr.export` (to ostatnie akurat odpowiada za eksport/druk etykiet — potwierdzone, że **nie** jest domyślnie nadawane roli `org_member`, więc mimo mało oczywistej nazwy trzeba je dodać jawnie)
- `module.helpdesk.access`, `helpdesk.read`, `helpdesk.tickets.read`, `helpdesk.tickets.create`, `helpdesk.tickets.manage` (to ostatnie pozwala zamykać zgłoszenia w demo)

**Zanim zatwierdzisz tę listę, sprawdź na żywo ekran ról** (`/dashboard/organization/users/roles`), co dokładnie ma domyślnie `org_member` w zakresie `warehouse.*`. Z kodu aplikacji potwierdzone jest, że `org_member` ma jawnie nadane `warehouse.layouts.read` i `warehouse.audits.read`, ale nie udało się jednoznacznie zweryfikować samym kodem, czy obejmuje to też `warehouse.locations.read`. Jeśli tak — Twoja niestandardowa rola potrzebuje tylko `.manage` plus uprawnień QR i Help Desk, bez `.read`.

### Zapraszanie użytkowników

Przez `/dashboard/organization/users/invitations`: każde zaproszenie pozwala ustawić e-mail oraz jedno lub więcej przypisań roli, każde z zakresem (organizacja lub oddział) i — dla zakresu oddziałowego — konkretnym oddziałem/oddziałami. Uwaga: obecny formularz zaproszenia **nie ma pola na imię i nazwisko zapraszanej osoby** (realna, drobna luka — backend to obsługuje, UI jeszcze nie) — nazwiska trzeba będzie ustawić inaczej (np. w profilu użytkownika po akceptacji zaproszenia), albo po prostu nie przejmować się dokładnym dopasowaniem fikcyjnych imion powyżej.

---

## Krok poza modelem organizacja/oddział/użytkownik: co najmniej jeden typ zgłoszenia

Audyt Obszaru 2 nie mógł zweryfikować (brak dostępu do żywej bazy), czy świeża organizacja ma domyślnie jakikolwiek typ zgłoszenia Help Desk. Przed prezentacją, jako `org_owner`, otwórz `/dashboard/help-desk/ticket-types` i utwórz jeden prosty typ — np. **„Domówienie części"**, zgodnie z sugerowanym w planie pierwszym scenariuszem. Przy okazji ustaw jego **domyślnych realizatorów (default responders)** na Częściowiec A i B — to istniejąca funkcja „domyślni realizatorzy per typ zgłoszenia" i najbliższy odpowiednik „skierowania zgłoszenia do zespołu części" jaki oferuje dzisiejsza aplikacja (nie ma w niej jeszcze pierwszoklasowego obiektu „zespół"). Bez tego kroku krok 2 scenariusza Obszaru 2 („skierowane do zespołu części") sprowadzałby się do przypisania do jednej przypadkowej osoby.

---

## Lista kontrolna (w kolejności)

1. Zarejestruj się i przejdź onboarding jako przyszły `org_owner` — wybierz plan zawierający `warehouse` i `help-desk` (sprawdź to wprost w kroku wyboru planu w kreatorze).
2. Utwórz oddział „Poznań Centrum" (Komorniki to domyślny pierwszy oddział z onboardingu — albo zmień jego nazwę na „Komorniki").
3. Utwórz niestandardową rolę „Pracownik Magazynu" na poziomie oddziału Komorniki, z uprawnieniami opisanymi wyżej.
4. Zaproś Częściowca A i B z tą rolą, w zakresie oddziału Komorniki; zaproś Doradcę z wbudowaną rolą `org_member`, w zakresie całej organizacji. Zaakceptuj wszystkie trzy zaproszenia z realnych skrzynek pocztowych.
5. Jako `org_owner`, utwórz typ zgłoszenia „Domówienie części" z A i B jako domyślnymi realizatorami.
6. Jako Częściowiec A (lub `org_owner`), przygotuj realne lokalizacje i etykiety QR na oddziale Komorniki na potrzeby scenariusza Obszaru 1. Poznań Centrum celowo zostaw pusty.
7. Przeprowadź próbny przebieg obu scenariuszy prezentacji (zobacz `docs/mvp-readiness-pitch-script.md`) od początku do końca, zanim zrobisz to na żywo przed odbiorcami.

---

## Ograniczenia tej analizy

Ten dokument powstał bez dostępu do żywej bazy Supabase w trakcie sesji (MCP `supabase-target` wymaga autoryzacji, której nie można było dokończyć w tym środowisku) — wszystkie ustalenia pochodzą z analizy kodu aplikacji, nie z bezpośredniej weryfikacji danych produkcyjnych. Miejsca oznaczone jako niepewne (np. dokładny zestaw uprawnień `org_member` dla `warehouse.*`) warto zweryfikować bezpośrednio w UI przed samą konfiguracją.
