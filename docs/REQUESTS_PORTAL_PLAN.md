# Ambra Zapytania — plan portalu zapytań do działu części

Status: **w realizacji** — faza 0 zamknięta, kroki 1–3 zamknięte, design zatwierdzony, krok 4 w toku (2026-10-06). Demo: **15.10.2026**
Aplikacja: `apps/requests-portal` · Domena: `zapytania.ambra-system.com`

## Postęp (demo)

Szczegóły kroków: sekcja 8. Zmiany w bazie: sekcja 7.

- [x] **0. Decyzje** (sekcja 2a)
  - [x] obsługa zapytań: uprawnienie per oddział, na demo dla Prezentera i Jana Kowalskiego (CNP Poznań)
  - [x] doradca może zamknąć swoje zapytanie
  - [x] podgląd zlecenia: po demo
  - [x] rola doradcy: nowa „Doradca (portal)”
  - [x] termin demo: **15.10.2026**
- [x] **1. Szkielet** `apps/requests-portal`: Next.js, Tailwind, next-intl pl/en, `@repo/*`, turbo/pnpm, build przechodzi
- [x] **2. Logowanie:** `utils/supabase/*` i `proxy.ts`, ekran logowania „Ambra Zapytania” (jak w Ambrze), „Zapomniałeś hasła?”, wylogowanie (2026-10-06). Uwaga: link z maila resetu prowadzi do Ambry, patrz D5
- [x] **3. Kontekst portalu:** `src/server/portal-context.ts` (użytkownik, organizacja i oddziały z `user_effective_permissions`, uprawnienia per oddział), przełącznik oddziału (ciasteczko `rp_branch`), menu konta, ekran „Brak dostępu” (2026-10-06). Ścieżka po zalogowaniu nie przetestowana w przeglądarce
- [ ] **4. Dane:**
  - [ ] lista (filtry, sortowanie, stronicowanie, „Moje / Cały oddział”)
  - [ ] szczegóły
  - [ ] tworzenie (`helpdesk_create_ticket` + referencja ZL)
  - [ ] komentarze (bez wewnętrznych)
  - [ ] załączniki
- [ ] **5. Ekrany (mobile-first):**
  - [ ] lista zapytań
  - [ ] nowe zapytanie
  - [ ] szczegóły z wątkiem i załącznikami
  - [ ] na listach i w szczegółach: awatar zgłaszającego, kolorowy typ, status, tagi, status akceptacji
  - [ ] ustawienia (z `helpdesk.ticket-types.manage`): typy, kto rozwiązuje, akceptacja, tagi
- [ ] **5a. Baza: uprawnienia per oddział** (D3, D4, D6)
  - [ ] RLS ticketów, komentarzy i załączników na `has_branch_permission` po `branch_id` ticketu
  - [ ] doradca zamyka/anuluje tylko swoje zgłoszenia (status `closed`/`cancelled`), a jego komentarz w `resolved` przywraca `open`
  - [ ] testy pgTAP: doradca widzi tylko swój oddział, nie widzi komentarzy wewnętrznych; obsługa oddziału A nie widzi oddziału B
- [ ] **5b. Help Desk w Ambrze (obsługa kolejki, sekcja 3a)**
  - [ ] dwa przyciski komentarza: „Odpowiedz doradcy” / „Notatka wewnętrzna”
  - [ ] „Biorę”: przypisanie do siebie + status `in_progress`
  - [ ] widoki: Nieprzypisane w moim oddziale, Moje, Czeka na doradcę, Czeka na VGP / dostawcę
  - [ ] przełącznik oddziału (kolejka per oddział)
  - [ ] polskie nazwy statusów (sekcja 3a)
- [ ] **6. Dane demo:**
  - [ ] rola „Doradca (portal)” (D1) i rola „Obsługa zapytań” (D6)
  - [ ] przypisania: Marcin Kowalski → Doradca (portal) na CNP Poznań; Prezenter i Jan Kowalski → Obsługa zapytań na CNP Poznań
  - [ ] typy zapytań (D2)
  - [ ] konto doradcy w CNP
  - [ ] przykładowe zapytania po polsku
- [ ] **7. Wdrożenie:**
  - [ ] projekt Vercel
  - [ ] zmienne środowiskowe
  - [ ] domena `zapytania.ambra-system.com` + DNS
  - [ ] przekierowania Supabase Auth (D5)
- [ ] **8. Próba scenariusza demo na telefonie** (sekcja 9) i poprawki
- [ ] **Weryfikacja:** komentarze wewnętrzne niewidoczne dla doradcy (D4); doradca nie wchodzi do Ambry

Przed pilotem (sekcja 10):

- [ ] powiadomienia mailowe
- [ ] podgląd zlecenia w portalu
- [ ] ekran „To konto korzysta z Ambra Zapytania” w `apps/web`
- [ ] rola „Obserwator” (notatki wewnętrzne bez odpowiadania i zmian statusu)
- [ ] automatyczne zamykanie po 3 dniach w `resolved`
- [ ] czas pierwszej reakcji per typ (SLA), obserwatorzy zgłoszenia

---

## 1. Cel

Doradcy serwisowi piszą zapytania do działu części i śledzą odpowiedzi: o części do zleceń, o zlecenia, o magazyn i o sprawy organizacyjne. Dziś robią to telefonicznie, ustnie albo mailem.

- Portal jest **osobną, prostą aplikacją**. Doradca nie widzi Ambry ani jej ekranu logowania.
- Działa jednak **na backendzie Ambry**: ta sama baza Supabase, konta, uprawnienia (RLS) i tickety Help Desk.
- Zapytanie założone w portalu trafia do działu części w module Help Desk w Ambrze. Odpowiedź wraca do portalu.

To wewnętrzny odpowiednik „Customer Care VGP”: tam dział części pisze do VGP, tu doradcy piszą do działu części.

## 2. Ustalenia

| Temat                         | Decyzja                                                                                                                                                             |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nazwa dla użytkownika         | **Ambra Zapytania**. Podtytuł np. „Zapytania do działu części — zlecenia, magazyn, sprawy organizacyjne”.                                                           |
| Domena                        | `zapytania.ambra-system.com`                                                                                                                                        |
| Aplikacja w monorepo          | `apps/requests-portal` (pakiet `requests-portal`), osobny projekt na Vercelu, np. `ambra-requests-portal`                                                           |
| Na demo                       | **Osobna aplikacja**, nie widok wewnątrz `apps/web`. Jakość prezentacyjna; gotowość na pilot nie jest wymagana.                                                     |
| Kim są użytkownicy            | Doradcy i częściowcy to współpracownicy tej samej organizacji i tych samych oddziałów. Doradcy to członkowie organizacji z rolą „Doradca”, a nie zewnętrzni goście. |
| Widoczność (jak w AutoStacji) | Wgląd we wszystko w oddziałach, do których użytkownik ma dostęp. Działania tylko w ramach własnej roli.                                                             |
| Zakres zapytań                | Części (termin, brak, uszkodzenie), zlecenia, magazyn, sprawy organizacyjne. Kategoriami są **typy ticketów**.                                                      |

## 2a. Decyzje fazy 0 (2026-10-06)

- **Obsługa zapytań jest nadawana per oddział**, a nie przez wskazanie osób przy typach zapytań. Rola „Obsługa zapytań” z zakresem oddziału: czytanie, tworzenie i zarządzanie ticketami w tym oddziale (statusy, przypisania, zamykanie, komentarze wewnętrzne). Osoba może ją mieć na kilku oddziałach, np. częściowiec na 5 oddziałach.
  - **Na demo:** Prezenter i Jan Kowalski (Magazynier) na **CNP Poznań**.
  - ~~Typy zapytań nie mają domyślnych osób odpowiedzialnych.~~ **Zmiana 2026-10-06:** typy konfiguruje w ustawieniach osoba z `helpdesk.ticket-types.manage`: nazwa, opis, kolor, ikona, zakres (organizacja / oddział), **kto rozwiązuje** (`helpdesk_ticket_type_default_responders`) i **akceptacja przełożonego** (`requires_acceptance` + `helpdesk_ticket_type_acceptors`). Wszystko to już istnieje w bazie i w Help Desku w Ambrze. Typ bez osób rozwiązujących trafia do kolejki oddziału, którą widzą wszyscy z „Obsługą zapytań” w tym oddziale.
- **Doradca może zamknąć swoje zapytanie** („Sprawa załatwiona”), ale tylko założone przez siebie. Nie przypisuje i nie zmienia innych statusów.
- **Podgląd zlecenia w portalu: po demo.**
- **Rola doradcy: nowa „Doradca (portal)”** (czytanie i tworzenie ticketów, dostęp do modułu, zamykanie własnych). Istniejąca szeroka rola „Doradca” zostaje bez zmian.
- **Termin demo: 15.10.2026.**

**Konsekwencja techniczna:** RLS ticketów sprawdza dziś `has_permission`, a ta funkcja uznaje tylko uprawnienia nadane na całą organizację (`branch_id IS NULL`). Rola nadana na oddział nie daje więc dostępu do ticketów, a rola nadana na organizację daje dostęp do wszystkich oddziałów. Model per oddział wymaga **D3 już na demo** (sekcja 7).

## 3. Model uprawnień

|                                     | Doradca (portal)                                                                                    | Częściowiec (Ambra)                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Oddziały                            | te, do których ma dostęp                                                                            | te, do których ma dostęp                             |
| Zapytania (tickety)                 | zakłada; widzi wszystkie w swoich oddziałach (domyślnie filtr „Moje”); komentuje; dodaje załączniki | widzi wszystkie, przypisuje, zmienia statusy, zamyka |
| Komentarze wewnętrzne działu części | nie widzi                                                                                           | widzi i pisze                                        |
| Zlecenia                            | wyszukiwanie po ZL w oddziale, tylko odczyt (etap po demo)                                          | pełna praca                                          |
| Magazyn (lokalizacje, PZ, stany)    | brak dostępu                                                                                        | pełna praca                                          |
| Ambra (`app.…`)                     | brak dostępu, odesłanie do portalu                                                                  | pełny dostęp                                         |

Ochrona danych odbywa się **w bazie (RLS)**. Portal decyduje tylko, co pokazać na ekranie.

## 3a. Model zgłoszeń (na podstawie praktyk Zendesk / Freshdesk / Jira Service Management / ServiceNow)

**Role i zakres (scope):**

| Branża                               | Ambra                                                                                                                     | Uprawnienia                                                                                                                         | Kiedy                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Zgłaszający (end user, customer)     | **Doradca (portal)**                                                                                                      | `helpdesk.read`, `tickets.read`, `tickets.create`, `module.helpdesk.access` — **nadawane na oddział**; zamyka i anuluje tylko swoje | demo                            |
| Udostępnianie zgłoszeń w organizacji | **Widoczność w oddziale** (jak AutoStacja): doradca widzi zgłoszenia swoich oddziałów, domyślnie filtr „Moje”             | wynika z oddziału roli                                                                                                              | demo                            |
| Agent ze scope grupowym              | **Obsługa zapytań** — kolejka oddziału                                                                                    | jw. + `tickets.manage`, **nadawane na oddział**                                                                                     | demo                            |
| Agent globalny                       | **Kierownik działu części** — wszystkie oddziały                                                                          | te same uprawnienia nadane na organizację (działa dziś)                                                                             | demo (Prezenter jako org_owner) |
| Light agent                          | **Obserwator** (np. kierownik serwisu): widzi, pisze tylko notatki wewnętrzne, nie odpowiada doradcy, nie zmienia statusu | nowe uprawnienie, np. `helpdesk.tickets.comment_internal`                                                                           | po demo                         |
| Grupy w ramach zespołu               | **Jedna kolejka = oddział.** Później opcjonalnie grupy w oddziale (np. Części, Magazyn), typ zgłoszenia ustawia grupę     | —                                                                                                                                   | po pilocie, jeśli potrzeba      |

**Kierowanie zgłoszeń:** typ zapytania → kolejka oddziału (bez wskazywania osób). Mało typów i proste reguły, bo nadmiar kategorii i ręczne przekazywanie to główna przyczyna „krążenia” zgłoszeń.

**Komentarze:** dwa rodzaje, w Help Desku w Ambrze dwa wyraźne przyciski zamiast przełącznika:

- **„Odpowiedz doradcy”**: `visibility` publiczna, widoczna w portalu;
- **„Notatka wewnętrzna”**: tylko dla obsługi zapytań, nigdy w portalu.

W portalu doradca pisze tylko odpowiedzi.

**Przejmowanie:** przycisk **„Biorę”** przy zgłoszeniu z kolejki: przypisuje do siebie i zmienia status na `in_progress`.

**Statusy** (istniejące w bazie, z nadanym znaczeniem):

| Status             | Nazwa na ekranie        | Znaczenie                                                               | Kto ustawia                                                |
| ------------------ | ----------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------- |
| `open`             | Nowe                    | w kolejce oddziału                                                      | system / doradca (komentarz w `resolved` przywraca `open`) |
| `in_progress`      | W trakcie               | ktoś z obsługi wziął zgłoszenie                                         | obsługa („Biorę”)                                          |
| `waiting`          | Czeka na VGP / dostawcę | dział części czeka na stronę trzecią                                    | obsługa                                                    |
| `waiting_response` | Czeka na doradcę        | potrzebna odpowiedź doradcy                                             | obsługa                                                    |
| `resolved`         | Odpowiedziano           | dział części odpowiedział lub załatwił                                  | obsługa                                                    |
| `closed`           | Zamknięte               | sprawa załatwiona; po demo także automatycznie po 3 dniach w `resolved` | doradca (swoje) / obsługa                                  |
| `cancelled`        | Wycofane                | doradca wycofał zgłoszenie                                              | doradca (swoje) / obsługa                                  |

**Widoki obsługi zapytań** (kolejki zamiast jednej listy): Nieprzypisane w moim oddziale · Moje · Czeka na doradcę · Czeka na VGP / dostawcę · Wszystkie, z **przełącznikiem oddziału** dla częściowców z kilkoma oddziałami.

**Po pilocie:** czas pierwszej reakcji per typ (SLA, `waiting_response` wstrzymuje licznik), obserwatorzy zgłoszenia (doradca dopisuje kolegę), automatyczne zamykanie, powiadomienia.

## 4. Co już istnieje i z czego korzystamy

**Baza (wspólna):**

- `helpdesk_tickets`:
  - kolumny: `branch_id`, `ticket_type_id`, `status`, `priority`, `created_by`, `requested_by`, `assigned_to`, `due_date`, …;
  - tworzenie przez RPC **`helpdesk_create_ticket`** (numeracja, osoby odpowiedzialne, akceptacja);
  - historia w `helpdesk_ticket_activity`.
- `helpdesk_ticket_types`: kategorie z domyślnymi osobami odpowiedzialnymi i opcjonalną akceptacją. Mają `scope` i `branch_id`.
- `helpdesk_ticket_references`: powiązanie ticketu z obiektem z innego modułu (`source_module`, `source_type`, `source_id`, `context_snapshot`). **Tędy ticket przypina się do zlecenia.**
- **Komentarze i załączniki są generyczne:**
  - `app_comments` z `visibility` (wewnętrzne i publiczne) oraz `app_attachments` (bucket `app-attachments`);
  - uprawnienia w bazie przez `can_access_comment_target(org, target_type, target_id, action, visibility)`, gdzie target to `helpdesk.ticket`.

**Kod w `apps/web` (do skopiowania albo wzorowania, nie do importu):**

- `src/server/services/helpdesk-tickets.service.ts` (ok. 1070 linii): `listForDataView`, `getDetail`, `createWithAssignees`, `addComment`, `closeTicket`, `listComments`, …
- `src/server/services/helpdesk-ticket-types.service.ts`
- `src/server/services/comments.service.ts`, `attachments.service.ts`, `src/server/comments/target-registry.ts`
- `src/app/actions/help-desk/index.ts` (zależne od ciężkiego `loadDashboardContextV2`; portal ma własny lekki odpowiednik)
- UI:
  - `src/components/features/comments/*` (wątek komentarzy), `src/components/features/attachments/*`;
  - `src/components/primitives/rich-text/*` (edytor i podgląd Tiptap), `primitives/avatar/*`;
  - `src/components/help-desk/ticket-status-badge.tsx`, `ticket-priority-badge.tsx`;
  - komponenty shadcn z `src/components/ui/*`.

**Logowanie (wzorzec):**

- `apps/public-web/src/utils/supabase/{server,client,proxy}.ts`: prawdziwe logowanie Supabase SSR w osobnej aplikacji.
- `apps/web/src/utils/supabase/*` i `apps/web/src/proxy.ts`: odświeżanie sesji w middleware.
- `apps/vmi-client` **nie jest wzorcem**: ma makietowe logowanie (ciasteczko „demo-session”) i mockowane dane.

**Pakiety wspólne:**

- `@repo/supabase` (typy bazy), `@repo/contracts` (stałe uprawnień `HELPDESK_*`), `@repo/auth` (odczyt ról z JWT), `@repo/i18n`, `@repo/ui`.
- Zgodnie z `docs/package-ownership.md` **klient Supabase i dostęp do ciasteczek zostają lokalnie w każdej aplikacji**, a do pakietów trafia tylko kod bez I/O.

## 5. Architektura `apps/requests-portal`

```
apps/requests-portal/
  package.json                     # next, react, next-intl, @supabase/ssr, tiptap, @repo/*
  src/proxy.ts                     # i18n + odświeżanie sesji + wymuszenie logowania
  src/i18n/                        # pl (domyślnie), en
  src/utils/supabase/              # server.ts, client.ts, proxy.ts (wzorowane na public-web)
  src/server/
    portal-context.ts              # kim jestem: user, org, oddziały, uprawnienia (lekki)
    requests.service.ts            # lista / szczegóły / tworzenie / zamknięcie (tickety)
    comments.service.ts            # app_comments dla target "helpdesk.ticket"
    attachments.service.ts         # app_attachments + signed URL
  src/app/actions/                 # server actions portalu (org i oddział zawsze z kontekstu)
  src/app/[locale]/
    sign-in/                       # logowanie „Ambra Zapytania”
    (portal)/layout.tsx            # nagłówek z marką, przełącznik oddziału, wyloguj
    (portal)/page.tsx              # lista zapytań
    (portal)/new/page.tsx          # nowe zapytanie
    (portal)/[ticketId]/page.tsx   # szczegóły + wątek + załączniki
  src/components/                  # skopiowane i uproszczone: comments, attachments, rich-text, badges, ui
```

**Logowanie i sesja:**

- Konta Supabase Auth są wspólne z Ambrą. Sesja dotyczy tylko domeny `zapytania.…`: zalogowanie do portalu nie loguje do Ambry i odwrotnie.
- Do zrobienia w Supabase Auth: dodać `https://zapytania.ambra-system.com/**` do dozwolonych przekierowań (reset hasła, zaproszenia).
- Użytkownik bez uprawnienia do zapytań zobaczy „Brak dostępu”.

**Lekki kontekst (`portal-context.ts`):**

- `auth.getUser()`, potem organizacja i oddziały użytkownika, potem lista uprawnień.
- Lista uprawnień wzorowana na `PermissionServiceV2.getPermissionSnapshotForUser`.
- Aktywny oddział jest zapamiętany w ciasteczku portalu (przełącznik w nagłówku). Domyślnie: wszystkie oddziały użytkownika.

**Doradca w Ambrze (`apps/web`):** konto z samą rolą „Doradca” po zalogowaniu do Ambry dostaje ekran „To konto korzysta z Ambra Zapytania” z linkiem do portalu. Mała zmiana w middleware lub layoucie dashboardu.

## 6. Ekrany (mobile-first)

**Ustalenie (2026-10-06):** ekrany logowania wzorujemy na Ambrze (`apps/web`, `(public)/(auth)`). Sam portal (lista, nowe zapytanie, szczegóły) projektujemy od zera: nowocześnie i kompaktowo, gęstość jak w Linear, wątek jak w Plain / Help Scout, bursztyn Ambry tylko jako akcent. Z `apps/web` bierzemy logikę, nie wygląd. Makiety do akceptacji przed krokiem 5: https://claude.ai/artifact/X6HYbsYe2dEjfszeegQ9Dy

**Karta na liście (wybrana 2026-10-06, wariant I, jasny motyw):** biała karta na tle `#F5F5F4`, obwódka 1 px. Wiersze: (1) typ wersalikami w kolorze typu · data po prawej; (2) tytuł w jednej linii z „…”, kropka nowej odpowiedzi; (3) metadane jako ikona + wartość: zlecenie, magazyn, numer HD, komentarze (na hover pojawiają się etykiety pól); (4) awatar zgłaszającego, tagi · status po prawej (kropka z poświatą + etykieta). Zaznaczona karta: bursztynowa obwódka.

1. **Logowanie:** marka „Ambra Zapytania”, e-mail i hasło, „Nie pamiętam hasła”.
2. **Lista zapytań:**
   - przełącznik **„Moje / Cały oddział”**;
   - filtry: status, typ, „z odpowiedzią / bez odpowiedzi”; wyszukiwanie po tytule i ZL;
   - sortowanie (najnowsze, ostatnia aktywność), stronicowanie;
   - wiersz: numer, tytuł, typ (kolor), status, ZL, autor, ostatnia aktywność, licznik komentarzy;
   - na telefonie wiersze jako karty; przycisk „Nowe zapytanie” na stałe w rogu.
3. **Nowe zapytanie:**
   - typ (kafelki: Części / Zlecenie / Magazyn / Organizacyjne), tytuł, opis (edytor), załączniki (zdjęcie z aparatu);
   - **zlecenie**: opcjonalne; doradca podaje **nr zlecenia** (np. 51481) i **magazyn** (np. 3252, 3332, 3142; ostatnio używane jako skróty). System szuka zlecenia w `repair_orders.zl_number` (`<prefiks>/<nr>/<rok>/<mag>/BL`). Prefiks zależy od magazynu (`ZL` dla 3252/3112/3122, `ZLEC` dla 3332/3142), a magazyn nie odpowiada jednemu oddziałowi Ambry, więc pełnego numeru nie składamy sami. Znalezione zlecenie → pełny numer i `helpdesk_ticket_references` z `source_type = repair_order`; nieznalezione → zapisujemy nr i magazyn w `context_snapshot`. W szczegółach: pełny numer oraz „nr 51481 · mag 3252 · oddział”; lista pokazuje numer zapytania (HD) w prawym górnym rogu wiersza;
   - tworzenie przez `helpdesk_create_ticket`.
4. **Szczegóły:**
   - nagłówek: numer, status, typ, ZL, autor, osoby odpowiedzialne;
   - opis, wątek komentarzy (bez wewnętrznych), załączniki z podglądem, pole odpowiedzi;
   - historia zmian statusu;
   - autor może zamknąć zapytanie („Sprawa załatwiona”).

## 7. Zmiany w bazie

| #   | Zmiana                                                                                                                                                                                                                                                                                                                                                               | Na demo                              | Przed pilotem       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------- |
| D1  | Nowa rola **„Doradca (portal)”**, nadawana na oddział: `helpdesk.read`, `helpdesk.tickets.read`, `helpdesk.tickets.create`, `module.helpdesk.access`; bez `helpdesk.tickets.manage`, `warehouse.*`, `workshop.*`. Zamykanie własnych zapytań przez regułę „autor” (D3).                                                                                              | tak                                  | tak                 |
| D2  | Typy zapytań: Części — termin dostawy, Części — brak / uszkodzenie, Zlecenie — pytanie, Magazyn, Organizacyjne. Konfigurowane w ustawieniach (osoby rozwiązujące, akceptacja); dane demo z osobami rozwiązującymi dla części typów, np. „Zwrot części na stan” z akceptacją.                                                                                         | tak (dane)                           | tak                 |
| D3  | **Uprawnienia ticketów per oddział w RLS:**<br>• `helpdesk_tickets` select/insert/update używa `has_branch_permission(org_id, branch_id, …)` zamiast `has_permission`;<br>• update: `helpdesk.tickets.manage` w oddziale albo autor, a autor tylko zamyka swoje;<br>• tickety bez oddziału (`branch_id IS NULL`) zostają na regułach organizacyjnych.                | **tak** (zmiana po decyzjach fazy 0) | tak                 |
| D4  | `can_access_comment_target` dla `helpdesk.ticket` (komentarze i załączniki): dostęp według oddziału ticketu; komentarze wewnętrzne tylko dla `helpdesk.tickets.manage` w oddziale                                                                                                                                                                                    | **tak**                              | tak                 |
| D6  | Nowa rola **„Obsługa zapytań”**, nadawana na oddział: `helpdesk.read`, `helpdesk.tickets.read`, `helpdesk.tickets.create`, `helpdesk.tickets.manage`, `module.helpdesk.access`. Na demo: Prezenter i Jan Kowalski na CNP Poznań.                                                                                                                                     | tak                                  | tak                 |
| D7  | **Tagi zapytań** (nowe): `helpdesk_tags` (org_id, name, color, sort_order, is_active) i `helpdesk_ticket_tags` (ticket_id, tag_id); RLS jak tickety (D3); zarządzanie z `helpdesk.ticket-types.manage`                                                                                                                                                               | tak                                  | tak                 |
| D5  | Dozwolone przekierowania Supabase Auth dla domeny portalu. **Dodatkowo:** edge function `send-auth-email` buduje link resetu ze stałego `SITE_URL` (Ambra) i ignoruje `redirect_to`, więc reset hasła z portalu kończy się na stronie Ambry. Przed pilotem: honorować `redirect_to` z listy dozwolonych domen i dodać w portalu `/auth/confirm` + `/zresetuj-haslo`. | tak (konfiguracja)                   | tak (edge function) |

## 8. Kolejność kroków i szacunek (demo)

| Krok | Zakres                                                                                                                                         | Czas                                        |
| ---- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1    | Szkielet `apps/requests-portal` (Next.js 16, Tailwind, next-intl pl/en, `@repo/*`), `turbo` i `pnpm`                                           | 0,5 dnia                                    |
| 2    | Logowanie: `utils/supabase/*` i `proxy.ts` wzorowane na `public-web`; ekran logowania z marką; wylogowanie                                     | 0,5 dnia                                    |
| 3    | `portal-context.ts`: użytkownik, organizacja, oddziały, uprawnienia; przełącznik oddziału                                                      | 2–3 h                                       |
| 4    | Warstwa danych: lista z filtrami i stronicowaniem, szczegóły, tworzenie (RPC `helpdesk_create_ticket` i referencja ZL), komentarze, załączniki | 0,5–1 dnia                                  |
| 5    | UI: lista, nowe zapytanie, szczegóły (skopiowane i uproszczone komponenty), mobile-first                                                       | 1 dzień                                     |
| 6    | Dane demo: rola „Doradca” (D1), typy (D2), konto doradcy w „Grupa Cichy-Zasada – CNP”, kilka przykładowych zapytań po polsku                   | 2–3 h                                       |
| 7    | Vercel: drugi projekt (root `apps/requests-portal`), zmienne środowiskowe, domena `zapytania.ambra-system.com`, przekierowania Auth (D5)       | 1–2 h (część po stronie właściciela domeny) |
| 8    | Przejście scenariusza demo na telefonie i poprawki                                                                                             | 0,5 dnia                                    |

| 5a | Baza: D3, D4 (RLS per oddział dla ticketów, komentarzy i załączników), D6, reguła zamykania przez autora; testy pgTAP; sprawdzenie, że moduł Help Desk w Ambrze nadal działa | 0,5–1 dnia |
| 5b | Help Desk w Ambrze: dwa przyciski komentarza, „Biorę”, widoki kolejek, przełącznik oddziału, polskie nazwy statusów (sekcja 3a) | ok. 0,5 dnia |

**Razem: ok. 4–5,5 dnia** — do 15.10 jest 7 dni roboczych. Świadomie pomijamy na demo: powiadomienia mailowe, podgląd zlecenia ze statusem części, testy poza podstawowymi.

## 9. Scenariusz demo

1. Doradca na telefonie otwiera `zapytania.ambra-system.com` i loguje się.
2. Zakłada zapytanie „Kiedy zderzak do ZL/51481/26/3252/BL?” (typ: Części — termin, ZL z podpowiedzi, zdjęcie).
3. Częściowiec w Ambrze widzi je w widoku „Nieprzypisane w moim oddziale”, przypięte do zlecenia, i klika **„Biorę”**.
4. Pisze **notatkę wewnętrzną** dla kolegów („zamówione, VGP potwierdza jutro”), ustawia status **„Czeka na VGP / dostawcę”** i **odpowiada doradcy**.
5. W portalu doradca widzi odpowiedź i status, ale nie widzi notatki wewnętrznej.
6. Po odpowiedzi VGP częściowiec odpisuje z terminem i ustawia „Odpowiedziano”. Doradca zamyka zapytanie: „Sprawa załatwiona”.

## 10. Po demo, przed pilotem

- Przegląd pozostałych tabel Help Desk (aktywność, przypisania, referencje, typy) pod kątem reguł per oddział z D3.
- Powiadomienia mailowe do autora o odpowiedzi i zmianie statusu, a do odpowiedzialnych o nowym zapytaniu (sprawdzić istniejące zdarzenia Help Desk).
- Podgląd zlecenia w portalu (tylko odczyt): czy części przyszły, czy są kompletne, czy wydane, bez stanów magazynu.
- Ekran „To konto korzysta z Ambra Zapytania” w `apps/web` dla kont z samą rolą Doradca.
- Testy: serwisy portalu, akcje (zakres org i oddziału z kontekstu), komponenty.

## 11. Po pilocie: wydzielenie wspólnego kodu (wersja C)

Zgodnie z `docs/package-ownership.md`:

- **`@repo/helpdesk-core`**: typy, statusy, priorytety, walidacje, schematy zod. Bez I/O.
- **`@repo/ui`**: komponenty shadcn, edytor i podgląd treści, wątek komentarzy i panel załączników z akcjami przekazywanymi jako parametry. Dzięki temu Ambra i portal używają jednego UI.
- **Bez zmian:** klienci Supabase, odświeżanie sesji i serwisy z zapytaniami zostają lokalnie w każdej aplikacji.

## 12. Ryzyka

| Ryzyko                                                        | Ograniczenie                                                                                                                                                   |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Zmiana RLS ticketów (D3, D4) dotyka modułu Help Desk w Ambrze | Migracja tylko dodaje reguły per oddział (uprawnienie na całą organizację nadal działa jak dziś); testy pgTAP i przejście modułu Help Desk w Ambrze po zmianie |
| Duplikacja UI komentarzy, załączników i edytora z `apps/web`  | Świadomy dług; wydzielenie do `@repo/ui` po pilocie (sekcja 11)                                                                                                |
| Logowanie na dwóch domenach                                   | Osobne sesje są zamierzone; przekierowania Auth dla obu domen                                                                                                  |
| Zakładanie zapytań w imieniu innych                           | `created_by` i `requested_by` ustawia serwer z kontekstu, nigdy klient                                                                                         |
| Załączniki ze zdjęciami z telefonu (rozmiar)                  | Limity z `@/lib/validations/attachments`, kompresja zdjęć po stronie klienta jako ulepszenie                                                                   |

## 13. Otwarte pytania

Brak otwartych pytań blokujących demo. Przełącznik oddziału w Help Desku: **tak** (krok 5b).
