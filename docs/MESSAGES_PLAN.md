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
| M4   | Wzmianki `@`: osoby i obiekty z wyszukiwarki (Tiptap)      | ✅ kod + testy, czeka na test ręczny |
| M4b  | Wzmianki w komentarzach i innych edytorach                 | ✅ kod + testy, czeka na test ręczny |
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
- [x] **M4** — wzmianki `@`: osoby i obiekty z całej aplikacji (§3.3) — kod + testy, czeka na test ręczny
  - [x] **Silnik wyszukiwania jako wspólna warstwa:** jedno zapytanie `entitySearchQuery()` (`lib/global-search/entity-search.ts`) dla Ctrl+K i wzmianek (ten sam klucz cache, `globalSearchAction`, bramki źródeł, prefiksy `parsePaletteQuery`); źródła użytkownika w `SearchSourcesProvider` (dostępne w każdym edytorze)
  - [x] Wspólny wygląd wyników: `hit-display.tsx` (ikony typów, `hitDetails`, podświetlenie) używany przez paletę i okienko wzmianek
  - [x] Lista źródeł do wzmianek (`MENTION_SOURCES` w `lib/mentions`): osoby, zlecenia, części, zapytania, zadania, dokumenty magazynowe, kontenery, lokalizacje, kontrahenci, kontakty; edytor może ją zawęzić (`MentionScopeProvider`)
  - [ ] Inwentaryzacje i sesje Matchera jako źródła wzmianek (dziś pominięte)
  - [x] Tiptap: `@tiptap/extension-mention` + `@tiptap/suggestion` w `packages/rich-text` (`buildEntityMention`, atrybuty `{ type, id, label, code, href }`); pakiet nie zna bazy — aplikacja podaje komponent listy (`ENTITY_MENTIONS`)
  - [x] Kompaktowy edytor czatu `CompactEditor` (Enter wysyła, Shift+Enter nowa linia, pogrubienie / kursywa, wzmianki) zamiast pola tekstowego
  - [x] Okienko po `@`: zakładki zakresów (Wszystko / Osoby / Zlecenia / Części / …), Tab / Shift+Tab, prefiksy (`@zl:174232`), ↑↓, Enter, Esc; osoby od pierwszej litery (najpierw członkowie rozmowy), dane od 3 znaków; ostatnio wspominane obiekty przy pustym `@`
  - [x] Wstawiona wzmianka: znacznik (osoba: imię i nazwisko; obiekt: ikona typu + numer), klik otwiera obiekt; własna wzmianka wyróżniona
  - [ ] Karta obiektu w okienku czatu jak w designie (ZL/… · opis · status) — dziś znacznik z numerem i tytułem w podpowiedzi
  - [x] Bezpieczeństwo: `resolveMentionsAction(refs)` sprawdza wsadowo dostęp przez RLS oglądającego; brak dostępu → „brak dostępu” bez numeru i nazwy; link tylko do ścieżek `/dashboard/…`; `body_plain` zawiera numery / imiona
  - [x] Serwer: `sendMessageAction` sam wylicza `body_plain` i `mentions` (`[{ type, id }]`) z dokumentu — nie ufa klientowi
  - [ ] Indeks GIN na `mentions` + „Powiązane w rozmowie” w panelu szczegółów
  - [x] Powiadomienie o wzmiance osoby (migracja `20261011181736_chat_mention_notifications`): tylko aktywni członkowie rozmowy, bez autora; zakładka „Wzmianki” w dzwonku
  - [x] Testy: vitest (ekstrakcja, bezpieczne linki, lista podpowiedzi, znacznik, edytor: Enter / wstawianie / Esc), pgTAP `124_chat_mentions_test.sql` (9/9)
  - [ ] Test ręczny na deployu: dwa konta — wzmianka osoby (dzwonek + toast), wzmianka zlecenia (link), konto bez dostępu do obiektu
- [x] **M4b** — wzmianki w pozostałych edytorach — kod + testy, czeka na test ręczny
  - [x] Komentarze (`CommentEditor` / `CommentsThread`: Help Desk, zlecenia, zadania) — bez zmian w tabelach, `body_rich` niesie wzmianki; walidacja serwera przepuszcza węzeł `mention` tylko z uuid i linkiem `/dashboard/…`
  - [x] Powiadomienie o wzmiance w komentarzu (migracja `20261011183106_comment_mention_notifications`, pgTAP `125` 8/8): tylko gdy wspomniany może czytać obiekt (ta sama funkcja co RLS, liczona dla niego); wspomniany uczestnik dostaje jedno powiadomienie (wzmianka zamiast „skomentował”)
  - [x] Opisy zadań (Planowanie) i zgłoszeń (Help Desk): edytor ze wzmiankami, widok ze znacznikami (`RichTextWithMentions`)
  - [ ] Powiadomienie o wzmiance w opisie zadania / zgłoszenia (dziś tylko czat i komentarze)
  - [ ] Pozostałe pola `RichTextEditorField` (karta Kanban, notatki dokumentów magazynowych, opis towaru)
  - [ ] Portal Ambra Zapytania: tylko jeśli zdecydujemy o zakresie źródeł dla klientów portalu (domyślnie bez wzmianek; wzmianka z komentarza publicznego widoczna tam jako zwykły tekst `@…`)
- [ ] **M5** — dopracowanie (część zrobiona 11.10, kod + testy, czeka na test ręczny)
  - [x] Ctrl+K: przy osobie akcja „Napisz wiadomość” (podmenu wyniku) otwiera rozmowę 1:1
  - [x] „Nowa wiadomość” (przycisk na pasku): domyślnie wiadomość prywatna — lista osób, ↑↓ i Enter albo klik otwiera rozmowę 1:1; osobny tryb „Utwórz grupę” z polami wyboru i nazwą
  - [x] Zaproszenia do grup zamiast dodawania na siłę: tworzenie grupy i „Zaproś osoby” wysyłają zaproszenie, członkiem zostaje się po „Dołącz”; do tego czasu zaproszony nie widzi rozmowy. Sekcja „Zaproszenia do grup” na pasku i na stronie Wiadomości, „Zaproszono — czeka na odpowiedź” w szczegółach grupy (migracja `20261011202425_chat_group_invitations`, pgTAP `129` 10/10)
  - [x] Wycofanie zaproszenia przez zapraszającego albo właściciela grupy (migracja `20261011203729_chat_invitation_withdraw`, pgTAP `130` 6/6)
  - [x] Grupa, którą opuścili wszyscy, jest zamykana (historia zostaje w bazie, nikt jej nie otworzy), a oczekujące zaproszenia przepadają; kto dołącza do grupy bez właściciela, zostaje właścicielem (migracja `20261012230252_chat_close_empty_group`, pgTAP `131` 6/6)
  - [ ] Ctrl+K: źródło „Rozmowy”
  - [x] Dźwięk nowej wiadomości (wyłączalny na pasku, pamiętany w przeglądarce), licznik rozmów z nieprzeczytanymi w tytule karty
  - [x] Edycja własnej wiadomości (15 min od wysłania, w polu wiadomości) i usuwanie (znacznik „Wiadomość usunięta”); na żywo u pozostałych (zdarzenie `message_updated`); migracja `20261011190404_chat_edit_delete_message`, pgTAP `127` 8/8
  - [ ] Odpowiedź na wiadomość
  - [x] E-mail o nieprzeczytanych wiadomościach: po 15 min, jedna wiadomość na serię nieprzeczytanych (do czasu przeczytania), bez wyciszonych rozmów; ta sama kolejka i ustawienia co powiadomienia (migracja `20261011191047_chat_unread_email_queue`, pgTAP `128` 7/7). **Włączenie: `docs/NOTIFICATIONS_CRON_SETUP.md`**
  - [x] Optymalizacje realtime: oznaczanie przeczytania w paczkach (2,5 s), bez „przeczytane” na żywo w grupach > 15 osób (migracja `20261011191633`) — `docs/MESSAGES_REALTIME_NOTES.md`
  - [ ] Obecność (online) — wymaga decyzji, patrz `docs/MESSAGES_REALTIME_NOTES.md` §5.1
  - [ ] Telefon: lista i rozmowa na pełnym ekranie (bez paska i okienek), wejście z nagłówka / dolnej nawigacji
  - [ ] Ustawienia wiadomości (design: „Stany”): otwieranie okienka, „piszę” / „przeczytane”

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
