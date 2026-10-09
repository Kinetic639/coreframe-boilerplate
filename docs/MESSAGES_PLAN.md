# Wiadomości Ambra — plan wdrożenia

> Czaty 1:1 i grupowe między pracownikami organizacji: prawy pasek (jak lewy sidebar), okienka czatów jak w Messengerze, pełna strona Wiadomości.
> Design: https://claude.ai/artifact/GChiiXxL2PBe1F2DEt8GAo — strona „Wiadomości”, ekrany 1–3 (kompaktowy styl widoku Start).
> Powiadomienia (dzwonek) to osobny moduł i osobny plan: `docs/NOTIFICATIONS_PLAN.md` — robimy je dopiero po wiadomościach.
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                                     | Status                               |
| ---- | ---------------------------------------------------------- | ------------------------------------ |
| M0   | Model danych, RLS, RPC, realtime, załączniki               | ✅                                   |
| M1   | Prawy pasek (zwinięty / rozsunięty)                        | ✅ kod + testy, czeka na test ręczny |
| M2   | Okienka czatów (jak Messenger)                             | ✅ kod + testy, czeka na test ręczny |
| M3   | Pełna strona, nowa rozmowa, zarządzanie grupą              | ✅ kod + testy, czeka na test ręczny |
| M4   | Wzmianki `@`: osoby i obiekty z wyszukiwarki (Tiptap)      | ⬜                                   |
| M4b  | Wzmianki w komentarzach i innych edytorach                 | ⬜                                   |
| M5   | Telefon, Ctrl+K, dźwięk, edycja wiadomości, e-mail offline | ⬜                                   |

**Na demo (15.10):** M0–M3. M4, M4b i M5 po demo (M4 wcześniej, jeśli zostanie czas).

- [x] **M0** — fundament
  - [x] Tabele `chat_conversations`, `chat_members`, `chat_messages` (§3.1), indeksy, RLS przez `is_chat_member()` (SECURITY DEFINER, bez rekurencji polityk)
  - [x] RPC: `chat_open_direct(user_id)` (idempotentne 1:1), `chat_create_group(name, user_ids)`, `chat_send(conv, body_rich, client_id)`, `chat_mark_read(conv, message_id)`, `chat_list_conversations(cursor, filter)` (z ostatnią wiadomością i liczbą nieprzeczytanych), `chat_list_messages(conv, before)`
  - [x] Grupy: role `owner` / `member`, dodaj / usuń osobę, zmień nazwę, opuść; wiadomości systemowe („Marta dodała Krzysztofa”)
  - [x] Realtime: prywatny kanał `user:<uid>:inbox` wysyłany z bazy (nowa wiadomość, przeczytanie, zmiana członków) — jeden kanał na użytkownika, nie jeden na rozmowę
  - [x] „Pisze…”: broadcast `chat:<conv>:typing` (polityka: członek rozmowy), jak w Help Desku
  - [x] Obecność (online): presence `org:<org>:presence`, tylko członkowie organizacji
  - [x] Załączniki: `app_attachments` z celem `chat.conversation` (nowy wpis w `COMMENT_TARGET_REGISTRY` + `can_access_comment_target`), ścieżka `org/<org>/chat/<conv>/…`
  - [x] Uprawnienie `messages.use` (role podstawowe `org_member` i `org_owner`, czyli każdy członek) — migracja `20261009193050_chat_foundation`
  - [x] Serwis + akcje + hooki (`useConversations`, `useMessages`, `useSendMessage` z optymistycznym dodaniem i `client_id` przeciw duplikatom)
  - [x] pgTAP `121_chat_test.sql` (25/25): nie-członek nie czyta i nie pisze, inna organizacja, usunięty członek traci dostęp, 1:1 nie duplikuje się, kanały typing / inbox tylko dla członków
- [x] **M1** — prawy pasek (design: ekrany 1 i 3) — `components/v2/messages/messages-bar.tsx`
  - [x] W `DashboardShell` obok `SidebarInset` (`MessagesRoot`): wysokość ekranu, nie przewija się ze stroną (przewija się tylko `<main>`), jak lewy sidebar
  - [x] Zwinięty (52 px): na górze ikona wiadomości z licznikiem rozmów (rozsuwa pasek), awatary rozmów (nieprzeczytane na górze, licznik, online), „Nowa rozmowa” na dole
  - [x] Rozsunięty (300 px): nagłówek (Wiadomości, licznik, nowa rozmowa, otwórz stronę, zwiń), szukaj, sekcje Nieprzeczytane / Ostatnie / Grupy
  - [x] Ikony wiadomości nie ma w nagłówku aplikacji (mock `header-messages.tsx` usunięty)
  - [x] Stan zwinięty / rozsunięty zapamiętany per użytkownik i organizacja (`chat-windows-store`, `localStorage`)
  - [ ] Zapis stanu w `user_preferences` (między urządzeniami) i skrót klawiszowy — po demo
  - [x] Treść strony się zwęża (bez nakładki); poniżej `lg` pasek ukryty (telefon: M5)
- [x] **M2** — okienka czatów (design: ekran 2) — `chat-window.tsx`, `messages-root.tsx`
  - [x] Dok `position: fixed` przy dolnej krawędzi (nad paskiem stanu), obok paska; maks. 3 okienka (najnowsze z prawej), przesuwa się z szerokością paska; na stronie Wiadomości ukryty
  - [x] Okienko: nagłówek (awatar, nazwa, status; otwórz w pełnym widoku, zwiń do nagłówka, zamknij), wątek z doczytywaniem w górę, „pisze…”, „przeczytane”, pole z załącznikiem, Enter wysyła, Shift+Enter nowa linia, ponowienie nieudanej wysyłki
  - [x] Nowa wiadomość: okienko rozmowy otwiera się samo (zwinięte), nagłówek podświetlony przy nieprzeczytanych; rozmowa z otwartym okienkiem podświetlona na pasku; otwarte i widoczne okienko oznacza rozmowę jako przeczytaną
  - [x] Otwarte okienka i ich stan zapamiętane w `localStorage` (per użytkownik i organizacja) — przetrwają nawigację i odświeżenie
  - [x] Pole wiadomości na razie jako zwykły tekst (`body_plain`); edytor Tiptap z wzmiankami przychodzi w M4
- [x] **M3** — pełna strona `/dashboard/wiadomosci` — `app/[locale]/dashboard/messages`
  - [x] Lista rozmów (szukaj, Wszystkie / Nieprzeczytane / Grupy), wątek, panel szczegółów (członkowie, pliki); na telefonie lista albo rozmowa
  - [x] Nowa rozmowa: wybór osób (1 osoba = 1:1, więcej = grupa + nazwa) — także z paska
  - [x] Zarządzanie grupą: nazwa, dodaj / usuń (właściciel), opuść, wycisz
  - [x] Wejście z okienka i z paska („otwórz w pełnym widoku”) na konkretną rozmowę (`?c=<id>`)
  - [x] Strona w wyszukiwarce (Ctrl+K znajduje „Wiadomości”, uprawnienie `messages.use`)
  - [ ] Test ręczny na deployu: dwie przeglądarki, 1:1 i grupa, „pisze…”, przeczytane, załącznik
- [ ] **M4** — wzmianki `@`: osoby i obiekty z całej aplikacji (§3.3)
  - [ ] **Silnik wyszukiwania jako wspólna warstwa:** wydzielić z Ctrl+K rdzeń danych (`globalSearchAction` → `search_global_candidates` / `search_global`, bramki źródeł z `lib/global-search/sources.ts`, zakresy `SEARCH_SCOPES` z prefiksami, `hitDetails`, ikony typów, frecency) do modułu `lib/entity-search/` — Ctrl+K i wzmianki korzystają z tego samego, bez kopiowania zapytań
  - [ ] Wspólny komponent wyników (`EntityResultList`: wiersz z ikoną, numerem mono, opisem, podświetleniem) używany przez paletę Ctrl+K i okienko wzmianek
  - [ ] Lista źródeł do wzmianek (`MENTION_SOURCES`): osoby, zlecenia, towary, kontenery, lokalizacje, dokumenty magazynowe, zgłoszenia, zadania, kontrahenci, kontakty, inwentaryzacje, sesje Matchera; każdy edytor może ją zawęzić
  - [ ] Tiptap: `@tiptap/extension-mention` + `@tiptap/suggestion` w `packages/rich-text` jako rozszerzenie `EntityMention` (atrybuty `{ type, id, code, label }`) z wstrzykiwanym dostawcą wyników — pakiet nie zna bazy, aplikacja podaje funkcję wyszukiwania
  - [ ] Okienko po `@`: zakładki zakresów jak w Ctrl+K (Wszystko / Osoby / Zlecenia / Towary / …), Tab / Shift+Tab zmienia zakres, prefiksy działają (`@zl:174232`, `@cz:2K5807`), ↑↓ i Enter wstawia, Esc zamyka; osoby od pierwszej litery (lista członków lokalnie, najpierw członkowie rozmowy), dane od 3 znaków z debounce; ostatnio wspominane na górze
  - [ ] Wstawiona wzmianka: znacznik w tekście (ikona typu + numer / imię i nazwisko), klik otwiera obiekt (`hrefFor()` z wyszukiwarki), w okienku czatu karta obiektu jak w designie (ZL/… · opis · status)
  - [ ] Bezpieczeństwo: przy wyświetlaniu wzmianki rozwiązywane wsadowo akcją `resolveMentionsAction(refs)` przez RLS oglądającego; brak dostępu → neutralny znacznik „brak dostępu” bez nazwy obiektu; `body_plain` zawiera tylko numery / imiona (podgląd na liście rozmów)
  - [ ] Serwer: `extractMentions(body_rich)` → `chat_messages.mentions` (`[{ type, id }]`, indeks GIN) + „Powiązane w rozmowie” w panelu szczegółów
  - [ ] Testy: parser i ekstrakcja, rozszerzenie Tiptap (wstawianie, klawiatura, Tab zakresów), okienko wyników, rozwiązywanie z brakiem dostępu
- [ ] **M4b** — wzmianki w pozostałych edytorach (po M4, każdy edytor osobno)
  - [ ] Komentarze (`CommentEditor`: Help Desk, zlecenia, zadania) — bez zmian w tabelach, `body_rich` niesie wzmianki
  - [ ] Opisy zadań i zgłoszeń, inne pola `RichTextEditorField`
  - [ ] Portal Ambra Zapytania: tylko jeśli zdecydujemy o zakresie źródeł dla klientów portalu (domyślnie bez wzmianek)
- [ ] **M5** — po demo
  - [ ] Telefon: lista i rozmowa na pełnym ekranie (bez paska i okienek), wejście z nagłówka / dolnej nawigacji
  - [ ] Ctrl+K: źródło „Osoby → napisz wiadomość”, źródło „Rozmowy”
  - [ ] Dźwięk nowej wiadomości (wyłączalny), licznik w tytule karty przeglądarki
  - [ ] Edycja i usuwanie własnej wiadomości (okno czasowe), odpowiedź na wiadomość
  - [ ] E-mail, gdy wiadomość nieprzeczytana 15 min i odbiorca offline (Resend, `@react-email`)
  - [ ] Ustawienia wiadomości (design: „Stany”): otwieranie okienka, dźwięk, e-mail offline, „piszę” / „przeczytane”

## 1. Cel i zasady

- **Tylko wiadomości.** Nowa wiadomość nie trafia do dzwonka; licznik jest na ikonie wiadomości na prawym pasku (liczba rozmów z nieprzeczytanymi, jak w Messengerze). Powiadomienia przyjdą osobnym planem.
- **Bezpieczeństwo w bazie.** Każdy odczyt przez RLS, każdy zapis przez RPC SECURITY DEFINER ze sprawdzeniem członkostwa i organizacji. Klient nigdy nie wstawia wiadomości bezpośrednio do tabel.
- **Realtime jak w Help Desku**, z wnioskami z października (`project_realtime_debugging`): `setAuth()` przed `subscribe()`, unikalne nazwy kanałów, `realtime: { worker: true }`, doczytanie zaległych po ponownym dołączeniu.
- **Kompaktowy UI widoku Start** (design, ekrany 1–3): nagłówki 48 px, przyciski 24–30 px, zaokrąglenie 6 px, awatary jako kwadraty, tekst 11–13 px, obramowania zamiast cieni, mono dla numerów. Bez okrągłych pigułek, pływających kółek i dużych cieni shadcn.
- **Skala:** 150 pracowników, kilkadziesiąt oddziałów, kilka organizacji. Jeden kanał realtime na użytkownika, stronicowanie kursorem, liczniki z indeksów.

## 2. Zakres funkcji

| Funkcja                                                                     | Faza    |
| --------------------------------------------------------------------------- | ------- |
| Rozmowa 1:1                                                                 | M0      |
| Rozmowa grupowa (nazwa, członkowie, właściciel)                             | M0 / M3 |
| Załączniki (pliki, zdjęcia)                                                 | M0 / M2 |
| „Pisze…”, „przeczytane”, online                                             | M0 / M2 |
| Prawy pasek                                                                 | M1      |
| Okienka czatów                                                              | M2      |
| Pełna strona Wiadomości                                                     | M3      |
| Wzmianki `@`: osoby i obiekty (zlecenia, towary, dokumenty…) z wyszukiwarki | M4      |
| Wzmianki w komentarzach i innych edytorach                                  | M4b     |
| Telefon, Ctrl+K, dźwięk, edycja, e-mail offline                             | M5      |

## 3. Architektura

### 3.1 Baza

```
chat_conversations
  id, organization_id, kind ('direct'|'group'), name null, direct_key text null,
  created_by, created_at, last_message_at, deleted_at
  unique (organization_id, direct_key)            -- 1:1 = posortowana para user_id

chat_members
  conversation_id, user_id, role ('owner'|'member'),
  joined_at, left_at null, last_read_at, last_read_message_id, muted_until null
  pk (conversation_id, user_id); index (user_id) where left_at is null

chat_messages
  id, conversation_id, organization_id, author_id null (system),
  kind ('text'|'system'), body_plain, body_rich jsonb (Tiptap), mentions jsonb (M4),
  client_id uuid, created_at, edited_at null, deleted_at null
  index (conversation_id, created_at desc, id desc); unique (author_id, client_id)
```

- `is_chat_member(conv)` SECURITY DEFINER (STABLE) w politykach, żeby polityki `chat_members` nie odwoływały się same do siebie.
- Nieprzeczytane = wiadomości po `last_read_at` (z limitem 99); licznik na ikonie = liczba rozmów z nieprzeczytanymi.
- `chat_list_conversations` zwraca jednym zapytaniem: rozmowę, ostatnią wiadomość, nieprzeczytane, drugą osobę (1:1) lub nazwę grupy — bez N+1.
- Realtime: trigger AFTER INSERT na `chat_messages` → `realtime.send` do `user:<member>:inbox` dla każdego członka (grupy do kilkudziesięciu osób). Przy większych grupach: kanał `chat:<conv>` zamiast wysyłki per członek.
- Usunięcie członka: traci dostęp do rozmowy (RLS po `left_at`), nie widzi historii.
- Wiadomości tylko w obrębie organizacji; oddziały nie ograniczają (pracownicy różnych oddziałów piszą do siebie).

### 3.2 Klient

- `ChatProvider` montowany raz w `dashboard/layout.tsx`: jeden kanał `user:<uid>:inbox` + presence, dane przez TanStack Query (zdarzenia realtime aktualizują cache, po ponownym połączeniu `invalidate`).
- Prawy pasek i dok okienek to część layoutu (nie portal / dialog). Stan: ui store (zwinięty / rozsunięty), `localStorage` (otwarte okienka per użytkownik + organizacja).
- Komponenty w `components/v2/messages/`; edytor Tiptap z `@repo/rich-text` (ten sam co komentarze), wersja kompaktowa do okienek (jedna linia rosnąca do 5, bez paska narzędzi).

### 3.3 Wzmianki (M4)

```
@repo/rich-text                 lib/entity-search (apps/web)            baza
EntityMention (Tiptap)  ──▶  provider(query, scope)  ──▶  searchEntitiesAction  ──▶  search_global_candidates
  okienko, zakresy, Tab         people: lista członków lokalnie            (bramki źródeł,        (SECURITY DEFINER, ids)
  atrybuty {type,id,code,label} dane: ≥3 znaki, debounce 150 ms            RLS, aktywny oddział)  search_global (RLS)
```

- Jeden silnik wyszukiwania dla Ctrl+K i wzmianek: te same uprawnienia, zakresy, prefiksy, wydajność (progi prefiksowe, limit 300 przed rankingiem). Nowe źródło w wyszukiwarce automatycznie staje się wzmiankowalne (jeśli jest na liście `MENTION_SOURCES`).
- Pakiet `@repo/rich-text` pozostaje niezależny od Ambry: dostaje `mentionProvider` i `renderMention` z aplikacji, więc to samo rozszerzenie można włączyć w komentarzach, opisach i (kiedyś) w portalu.
- Wzmianka w treści przechowuje `{ type, id, code, label }` z chwili wstawienia; wyświetlanie zawsze sprawdza dostęp oglądającego (członek rozmowy może nie mieć dostępu do zlecenia innego oddziału).

## 4. Weryfikacja

- Vitest: pasek (zwinięty / rozsunięty), okienka (otwórz, zwiń, zamknij, maks. 3, zapamiętanie), wysyłanie z optymistycznym dodaniem, hooki realtime (zdarzenie → cache).
- pgTAP: izolacja organizacji, tylko członkowie czytają i piszą, RPC odmawiają nieuprawnionym, polityki kanałów realtime, deduplikacja 1:1, usunięty członek.
- Ręcznie: dwie przeglądarki (dwa konta) — rozmowa 1:1 i grupowa w okienkach, „pisze…”, przeczytane, załącznik, karta w tle i powrót, przewijanie strony (pasek i okienka stoją).
- `pnpm type-check`, `pnpm lint` przed każdym commitem.

## 5. Otwarte pytania

- Uprawnienia: wiadomości dla wszystkich członków organizacji (proponuję: nowe uprawnienie `messages.use` przypisane domyślnie każdej roli, bez osobnego modułu w planie abonamentu), czy jako moduł z entitlementem?
- Czy klienci portalu Ambra Zapytania mają w przyszłości pisać na czacie z doradcą (inny model: rozmowa przy zapytaniu), czy czat jest tylko wewnętrzny (założenie planu)?
- Retencja wiadomości: bez limitu (założenie) czy np. 2 lata?
