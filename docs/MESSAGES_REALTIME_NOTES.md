# Wiadomości — jak działają statusy na żywo i co z wydajnością

> Notatka z 11.10.2026. Część pierwsza wyjaśnia mechanizmy (online, „przeczytane”, „pisze…”).
> Część druga to wydajność i koszty oraz **lista rzeczy do zrobienia po demo** (§5).
> Plan modułu: `docs/MESSAGES_PLAN.md`. Kod: `apps/web/src/components/v2/messages/`, migracja `20261009193050_chat_foundation.sql`.

## Do zrobienia po demo (skrót)

- [ ] Obecność (online): nie ogłaszać jej na poziomie całej organizacji przy każdej otwartej karcie (§5.1) — **czeka na decyzję**: obie opcje zmieniają znaczenie zielonego znacznika
- [x] „Przeczytane” w dużych grupach: bez rozsyłania na żywo powyżej 15 osób (§5.2) — migracja `20261011191633_chat_read_receipts_large_groups` (11.10.2026; gałąź > 15 osób niesprawdzona na prawdziwej grupie — w organizacji testowej są 3 konta)
- [x] Oznaczanie przeczytania: w paczkach co 2,5 s zamiast przy każdej wiadomości (§5.3) — `lib/messages/read-batcher.ts` (11.10.2026)
- [ ] Pomiar listy rozmów i wątku na tymczasowym zestawie danych — **nie na produkcji** (§5.4)
- [ ] Sprawdzić w panelu Supabase realne zużycie komunikatów Realtime po 1–2 tygodniach używania (§4)
- [ ] Zweryfikować limity i ceny w aktualnym cenniku Supabase (liczby w §4 są z pamięci)

## 1. Jedno połączenie na żywo

Przeglądarka trzyma jedno połączenie (websocket) z Supabase Realtime, wspólne dla czatu, obecności, „pisze…” i Help Desku. Na nim działają trzy osobne mechanizmy.

Jak docierają same wiadomości:

- Każdy użytkownik ma jeden prywatny kanał „skrzynka” (`user:<id>:inbox`), którego może słuchać tylko on.
- Po zapisaniu wiadomości wyzwalacz w bazie (`_chat_broadcast_message`) wysyła ją do skrzynki każdego uczestnika rozmowy. Tym samym kanałem idą sygnały „przeczytane” i zmiany członkostwa.
- Dzięki temu jest jeden kanał na użytkownika, a nie osobny na każdą rozmowę.
- Po zerwaniu i powrocie połączenia aplikacja pobiera stan jeszcze raz, bo sygnały wysłane w przerwie przepadają (`ChatProvider`).

## 2. Mechanizmy

### Kto jest online (zielony znacznik)

- Każda otwarta karta z Ambrą dołącza do „pokoju” swojej organizacji (`org:<id>:presence`) i ogłasza „jestem tu”.
- Serwer Realtime sam prowadzi listę obecnych i rozsyła ją wszystkim przy każdej zmianie (mechanizm Presence).
- Zamknięcie karty albo utrata internetu usuwa osobę z listy — nic nie trzeba „wylogowywać”.
- Nic nie jest zapisywane w bazie; to stan ulotny, liczony z aktywnych połączeń.
- Do pokoju wchodzą tylko członkowie organizacji z uprawnieniem `messages.use` (sprawdza baza: `can_use_chat_topic`).

### „Przeczytane”

- Baza pamięta dla każdej osoby w każdej rozmowie jedną datę: do kiedy przeczytała (`chat_members.last_read_at`). Nie ma znacznika przy każdej wiadomości.
- Otwarta rozmowa przy widocznej karcie przesuwa tę datę na „teraz” (`chat_mark_read`, hook `useReadWhileVisible`).
- Każda zmiana daty uruchamia wyzwalacz (`_chat_broadcast_member`), który wysyła pozostałym uczestnikom sygnał „ta osoba przeczytała do tej godziny”.
- Ekran nadawcy porównuje: ostatnia własna wiadomość starsza niż data rozmówcy → „Przeczytane”; w grupie „Przeczytane przez N”.
- Z tej samej daty liczy się licznik nieprzeczytanych (wiadomości nowsze niż moja data).

### „Pisze…”

- Podczas pisania przeglądarka wysyła uczestnikom krótki sygnał, najwyżej raz na 2,5 s (`chat:<id>:typing`).
- Odbiorcy pokazują „X pisze…” przez 5 s od ostatniego sygnału albo do sygnału „przestał”.
- Nic nie trafia do bazy. Słuchać i nadawać mogą tylko członkowie rozmowy.
- To ten sam mechanizm co w komentarzach Help Desku (`useTypingIndicator` z `@repo/rich-text`).

## 3. Co jest tanie

- **Połączenia:** jedna karta = jedno połączenie. 150 osób to ok. 150–300 połączeń; plan Pro ma w cenie 500 jednoczesnych.
- **„Pisze…” i online:** nie dotykają bazy ani dysku.
- **„Przeczytane”:** jeden mały zapis na otwarcie rozmowy, nie na każdą wiadomość.
- **Lista rozmów i wątek:** jedno zapytanie na listę (do 100 rozmów), wiadomości doczytywane po 40, wszystko po indeksach.
- **Miejsce w bazie:** przy 7–8 tys. wiadomości dziennie rząd 1–3 GB rocznie (Pro: 8 GB w cenie). Załączniki osobno, jak w komentarzach.

## 4. Co kosztuje: liczba komunikatów na żywo

Supabase liczy każdy komunikat dostarczony do każdego odbiorcy. Plan Pro: ok. 5 mln miesięcznie w cenie, kolejny milion ok. 2,50 USD. **Liczby z pamięci — do sprawdzenia w cenniku.** Wszystko poniżej to szacunki z założeń, nie pomiary.

| Źródło                                 | Ile komunikatów                                            | Szacunek / miesiąc (150 osób) |
| -------------------------------------- | ---------------------------------------------------------- | ----------------------------- |
| Obecność na poziomie organizacji       | wejście lub wyjście jednej osoby → ok. 150 (do wszystkich) | 5–20 mln                      |
| Wiadomości i „przeczytane” w rozmowach | 1:1 ok. 4 na wiadomość; grupa 10 osób ok. 100 na wiadomość | ok. 3 mln                     |
| „Pisze…”                               | co 2,5 s × liczba słuchających z otwartą rozmową           | niewiele                      |

Razem ok. 8–25 mln miesięcznie, czyli ok. 10–50 USD ponad plan. To nie zagraża działaniu.

Trzy słabe punkty, od największego:

1. **Obecność na całą organizację.** Pełne odświeżenie strony = wyjście + wejście, każde rozsyłane do wszystkich obecnych. Przejścia między stronami w aplikacji tego nie wywołują.
2. **„Przeczytane” w dużych grupach.** Rośnie z kwadratem liczby osób: 10 osób ≈ 100 komunikatów na wiadomość (10 za wiadomość, po 9 za każde przeczytanie).
3. **Oznaczanie przeczytania przy każdej wiadomości.** Otwarte okienko: każda przychodząca wiadomość to wywołanie serwera, zapis i sygnał do pozostałych.

Czego nie wiadomo (niezmierzone):

- czas zapytania o listę rozmów (`chat_list_conversations`) przy tysiącach rozmów i setkach tysięcy wiadomości — testy pgTAP sprawdzają uprawnienia, nie szybkość;
- zachowanie instancji Micro przy dużym ruchu (zalecenie większej instancji przed produkcją dotyczy też czatu).

## 5. Optymalizacje po demo

### 5.1 Obecność

Dwie opcje, obie tną największą pozycję kilkukrotnie:

- ogłaszać obecność tylko wtedy, gdy ktoś ma rozsunięty pasek albo otwarte okienko czatu;
- albo zastąpić Presence polem „ostatnio aktywny” odświeżanym co minutę (jedno małe zapytanie zamiast rozsyłania do wszystkich).

Miejsce w kodzie: `ChatProvider` (`chat-provider.tsx`), kanał `org:<org>:presence`.

### 5.2 „Przeczytane” w grupach

Powyżej ok. 15 osób nie rozsyłać potwierdzeń na żywo; pokazywać je po otwarciu rozmowy (dane i tak są w `chat_get_conversation`). Miejsce: wyzwalacz `_chat_broadcast_member`.

### 5.3 Oznaczanie przeczytania

Zbierać w paczki co 2–3 s zamiast przy każdej wiadomości. Miejsce: `useReadWhileVisible` (`chat-window.tsx`) i `useMarkConversationRead`.

### 5.4 Pomiar

Zmierzyć listę rozmów i wątek na małym, tymczasowym zestawie danych. **Nie robić ciężkich testów na produkcyjnej bazie** — benchmark wyszukiwarki na 750 tys. zleceń zablokował ją na 1–2 minuty.
