# Powiadomienia Ambra — plan wdrożenia

> Dzwonek w nagłówku: zdarzenia w sprawach (przypisania, wzmianki w komentarzach, statusy, zapytania z portalu) na żywo, z szufladą, toastem i ustawieniami.
> Design: https://claude.ai/artifact/GChiiXxL2PBe1F2DEt8GAo — strona „Powiadomienia” (do przerobienia na kompaktowy styl jak ekrany „Wiadomości”).
> **Kolejność:** zaczynamy dopiero po wiadomościach (`docs/MESSAGES_PLAN.md`). Wzmianki `@` w edytorze powstają tam (faza M4) i stąd z nich korzystamy.
> Ten plik jest trackerem na żywo — checkboxy odhaczamy w trakcie pracy, nie na koniec sesji.

## Progress

| Faza | Zakres                                                | Status                               |
| ---- | ----------------------------------------------------- | ------------------------------------ |
| N0   | Tabela, RLS, `notify()`, kanał realtime               | ✅                                   |
| N1   | Źródła zdarzeń (tickety, komentarze, zadania, portal) | ✅ (wzmianki po M4)                  |
| N2   | Szuflada, licznik, toast, strona                      | ✅ kod + testy, czeka na test ręczny |
| N3   | Ustawienia, e-mail, przypomnienia, retencja           | 🟡 ustawienia gotowe, reszta czeka   |

- [x] **N0** — fundament (migracja `20261011054231_notifications`, wdrożona)
  - [x] Tabela `notifications` (§3.1), indeksy, RLS „tylko adresat” (select), bez zapisu z klienta
  - [x] `_notify(...)` SECURITY DEFINER: pomija autora akcji, tylko aktywni członkowie organizacji, respektuje ustawienia (`inApp.enabled`, `inApp.disabledTypes`), deduplikacja po `dedupe_key`
  - [x] Realtime: prywatny kanał `user:<uid>:notifications`, wysyłany z bazy (`realtime.send` w triggerze po insert), polityka na `realtime.messages`
  - [x] RPC: `notifications_list(org, filter, limit, before)`, `notifications_unread_count(org)`, `notifications_set_read(ids, read)` (przeczytane ↔ nieprzeczytane), `notifications_mark_all_read(org)`
  - [x] Serwis + akcje + hooki (`useNotifications`, `useUnreadNotificationsCount`, `useNotificationReadActions`, `useNotificationsRealtime`)
  - [x] pgTAP `123_notifications_test.sql` (15/15): cudzy adresat niewidoczny, inna organizacja, brak zapisu z `authenticated`, źródła zdarzeń
- [x] **N1** — źródła zdarzeń (triggery w bazie, nie w akcjach — działa też dla portalu i importów)
  - [x] Help Desk: przypisanie (`helpdesk_ticket_assignees`: `ticket.new` przy tworzeniu, `ticket.assigned` później), zmiana statusu / zamknięcie / akceptacja (`helpdesk_ticket_activity`), komentarz w tickecie
  - [x] Portal Ambra Zapytania: nowe zapytanie tworzy przypisania odpowiadających, więc dostają `ticket.new`
  - [x] Komentarze (`app_comments`): zgłaszający i przypisani (ticket; komentarz `internal` tylko do przypisanych), wykonawca i autor (zadanie), doradca (zlecenie)
  - [x] Zadania: przypisanie / zmiana wykonawcy (`planning_tasks.assigned_to`), zmiana statusu dla autora i wykonawcy
  - [x] Wzmianka `@` w czacie (migracja `20261011181736_chat_mention_notifications`, pgTAP `124` 9/9): wspomniany aktywny członek rozmowy, bez autora; cel `chat.conversation` otwiera rozmowę
  - [x] Wzmianka `@` w komentarzu (migracja `20261011183106_comment_mention_notifications`, pgTAP `125` 8/8): wspomniany dostaje ją tylko, gdy może czytać obiekt; jedno powiadomienie na osobę i komentarz
  - [ ] Zlecenia: obserwujący (model nie istnieje — dziś powiadomienie dostaje doradca)
  - [ ] Magazyn (P2): przyjęta dostawa z pozycjami do rozłożenia → osoby z uprawnieniem rozkładania w oddziale
- [x] **N2** — UI (kompaktowy styl jak wiadomości)
  - [x] Mock `components/v2/layout/header-notifications.tsx` zastąpiony prawdziwym dzwonkiem
  - [x] Dzwonek: licznik (9+), realtime, przeładowanie po ponownym połączeniu
  - [x] Szuflada: zakładki Wszystkie / Nieprzeczytane / Przypisane do mnie, grupy Dzisiaj / Wczoraj / Wcześniej, cytat przy komentarzu, „Oznacz wszystkie”, doczytywanie starszych
  - [x] Koperta przy powiadomieniu zamiast kropki: zamknięta = nieprzeczytane, otwarta = przeczytane; kliknięcie przełącza stan bez otwierania
  - [x] Kliknięcie w powiadomienie: oznacza przeczytane i otwiera obiekt
  - [x] Toast przy nowym (react-toastify): Otwórz / Oznacz jako przeczytane; bez toastu, gdy szuflada otwarta
  - [x] Strona `/dashboard/powiadomienia` (pełna lista, filtry), link w stopce szuflady
  - [x] Pusty stan, błąd, ładowanie; i18n pl/en; testy komponentów
  - [x] Zakładka „Wzmianki” (dzwonek i strona), pusty stan, na żywo
  - [ ] Test ręczny na deployu: dwa konta, przypisanie ticketu i komentarz → dzwonek i toast bez odświeżania
- [ ] **N3** — ustawienia i e-mail
  - [x] Ustawienia na `/dashboard/account/notifications`: zdarzenie × kanał (W aplikacji / E-mail), `user_preferences.notification_settings` (`inApp.disabledTypes` czytane przez `_notify()`, `email.types` z domyślnymi: przypisania i wzmianki); naprawione nadpisywanie wyborów przez przełącznik kanału
  - [ ] E-mail (Resend, `@react-email`): przypisanie i wzmianka, z opóźnieniem (np. 10 min), wysyłane tylko gdy nieprzeczytane; cisza nocna
  - [ ] Przypomnienia terminów zadań (pg_cron: „Termin mija dziś o 15:00”)
  - [ ] Retencja: przeczytane starsze niż 90 dni usuwane (pg_cron)

## 1. Cel i zasady

- **Dzwonek = zdarzenia w sprawach.** Wiadomości czatu tu nie trafiają (mają licznik na prawym pasku); z czatu przychodzi tylko wzmianka `@`.
- **Bezpieczeństwo w bazie.** Odczyt przez RLS (tylko adresat), tworzenie wyłącznie przez `notify()` wywoływane z triggerów; klient nie wstawia powiadomień.
- **Realtime jak w Help Desku i wiadomościach** (`project_realtime_debugging`): `setAuth()`, unikalne kanały, `worker: true`, doczytanie zaległych.
- **Kompaktowy UI widoku Start**, jak ekrany „Wiadomości” w designie.

## 2. Źródła powiadomień

| Typ (`type`)            | Kiedy                                          | Kto dostaje                                          | Faza    |
| ----------------------- | ---------------------------------------------- | ---------------------------------------------------- | ------- |
| `ticket.assigned`       | przypisanie do zgłoszenia                      | przypisany                                           | N1      |
| `ticket.status`         | zmiana statusu, zamknięcie                     | zgłaszający, przypisani (bez autora zmiany)          | N1      |
| `ticket.comment`        | nowy komentarz w zgłoszeniu                    | zgłaszający, przypisani (internal: tylko uprawnieni) | N1      |
| `request.created`       | nowe zapytanie z portalu Ambra Zapytania       | domyślni odpowiadający typu zgłoszenia               | N1      |
| `mention`               | `@` w komentarzu (dowolny obiekt) lub w czacie | wspomniany, jeśli ma dostęp do obiektu               | N1      |
| `task.assigned`         | przypisanie / zmiana wykonawcy zadania         | nowy wykonawca                                       | N1      |
| `task.status`           | zmiana statusu zadania                         | autor zadania                                        | N1      |
| `repair_order.comment`  | komentarz w zleceniu                           | doradca zlecenia (i obserwujący, gdy powstaną)       | N1      |
| `stock.putaway_pending` | PZ z pozycjami do rozłożenia                   | uprawnieni do rozkładania w oddziale                 | N1 (P2) |
| `task.due`              | termin zadania mija dziś                       | wykonawca                                            | N3      |

## 3. Architektura

### 3.1 Baza

```
notifications
  id uuid pk, organization_id uuid, branch_id uuid null,
  recipient_id uuid, actor_id uuid null,
  type text, target_type text, target_id uuid, target_code text null,
  title text, snippet text null, data jsonb,
  dedupe_key text null, created_at timestamptz, read_at timestamptz null
  unique (recipient_id, dedupe_key) where dedupe_key is not null
  index (recipient_id, created_at desc, id desc)
  index (recipient_id) where read_at is null      -- licznik
```

- `title` / `snippet` zapisywane w chwili zdarzenia (to, co adresat i tak mógł przeczytać). `notify()` sprawdza dostęp adresata do obiektu tymi samymi funkcjami co RLS obiektu (`can_access_comment_target`, uprawnienia oddziału) — nikt nie dostaje treści, której nie mógłby otworzyć.
- Link do obiektu liczony po stronie aplikacji z `target_type` + `target_id` (rejestr celów jak `hrefFor()` w wyszukiwarce), nie zapisywany.
- Realtime: trigger AFTER INSERT → `realtime.send(payload, 'notification', 'user:<uid>:notifications', true)`; polityka na `realtime.messages`: temat `user:<auth.uid()>:…`.
- Ustawienia: `user_preferences.notification_settings` (`inApp.types`, `email.types`, `quietHours`) — typ wyłączony = `notify()` nie tworzy wiersza.

### 3.2 Klient

- `NotificationsProvider` montowany raz w `dashboard/layout.tsx`: kanał `user:<uid>:notifications`, dane przez TanStack Query (zdarzenia realtime aktualizują cache, po ponownym połączeniu `invalidate`).
- Komponenty w `components/v2/notifications/`.

## 4. Weryfikacja

- Vitest: szuflada (zakładki, grupy, oznaczanie), dzwonek, toast, hooki realtime.
- pgTAP: tylko adresat, izolacja organizacji, brak insert z klienta, polityka kanału, każde źródło (kto dostaje, kto nie).
- Ręcznie: dwie przeglądarki — przypisanie ticketu / wzmianka w komentarzu → dzwonek i toast u drugiej osoby bez odświeżania.
- `pnpm type-check`, `pnpm lint` przed każdym commitem.

## 5. Otwarte pytania

- Model „obserwujących” zlecenie — na razie powiadomienia o komentarzu w zleceniu dostaje doradca.
- Które typy domyślnie wysyłają e-mail (propozycja: przypisanie i wzmianka)?
