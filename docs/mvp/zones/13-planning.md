### 13. Planning & Work Organization — zadania, kalendarz, Kanban i cykliczność

**Priorytet:** P2

**Stan obecny:** 🟡 PARTIAL

Ta strefa zachowuje w całości zaakceptowany audyt dawnej Strefy 13 (zadania jednorazowe, kalendarz, Kanban) i dodatkowo przejmuje własność koncepcyjną nad cyklicznością/harmonogramowaniem, która wcześniej była częścią dawnej Strefy 14 („Cykliczność i powiadomienia operacyjne"). Dawna Strefa 14 opisywała dwa różne tematy w jednym audycie: cykliczność (należy koncepcyjnie do Planowania) oraz powiadomienia (infrastruktura przekrojowa, używana przez wiele domen — NIE należy do Planowania). Powiadomienia zostały wydzielone do nowej, niezależnej aktywnej strefy: [Strefa 20 — Notifications & Operational Alerts](./20-notifications-operational-alerts.md). Scalenie NIE podnosi statusu — Stan obecny pozostaje 🟡 PARTIAL, dokładnie jak w oryginalnym audycie dawnej Strefy 13, i NIE staje się nowym blokerem pitchu (pozostaje opcjonalną/wspierającą strefą P2, tak jak wcześniej).

Ewidencja cykliczności z dawnej Strefy 14 nie jest w tym przebiegu w pełni przepisywana do tej strefy, żeby nie naruszyć proweniencji: pełny, oryginalny audyt dawnej Strefy 14 (obejmujący zarówno cykliczność, jak i powiadomienia — te dwa tematy są w wielu miejscach oryginalnego tekstu splecione w te same zdania/akapity i nie dają się bezpiecznie rozdzielić bez przepisywania) jest zachowany bez zmian w archiwum: [archived Zone 14](../archive/zones/14-recurrence-notifications-pre-split.md). Poniżej, w osobnej, jawnie oznaczonej podsekcji, przytoczono wyłącznie te dwa zdania z oryginalnego audytu dawnej Strefy 14, które dotyczą **wyłącznie** cykliczności i dają się precyzyjnie wyodrębnić bez ryzyka zmiany znaczenia (nie dotykają w ogóle tematu powiadomień).

## Accepted implementation audit

### Former Zone 13 audit — Zadania jednorazowe, kalendarz i Kanban

**Priorytet:** P2

**Stan obecny:** 🟡 PARTIAL

To realna, nietrywialna funkcjonalność — nie makieta. Zadania jednorazowe mają pełne CRUD z dziennikiem aktywności, kalendarz to prawdziwy, zapytaniowy agregator (zadania, karty Kanban i tickety pojawiają się na nim automatycznie, nie przez ręczny krok „dodaj do kalendarza"), a przeciąganie kart Kanban trwale zapisuje nową kolejność/kolumnę w bazie, nie tylko w stanie klienta. Uprawnienia są wymuszane po stronie serwera i przez RLS z `FORCE`. Status pozostaje PARTIAL (zgodnie z zastanym oczekiwaniem P2 — nie wymaga to podniesienia priorytetu), bo: (a) brak świeżej ręcznej próby na aktualnym build; (b) karta Kanban jest odrębnym bytem od zadania (potwierdzone brakiem jakiejkolwiek relacji FK) — prezenter musi to wiedzieć, żeby nie sugerować integracji, której nie ma; (c) panel załączników (`AttachmentsPanel`) nie jest dziś w ogóle renderowany w UI Planowania — `planning.task`/`planning.kanban_card` są zarejestrowane jako cele załączników na poziomie danych, ale bez żadnego konsumenta UI (w przeciwieństwie do komentarzy, które są w pełni podłączone).

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny CRUD zadania (`createTaskAction`/`updateTaskAction`/`changeTaskStatusAction`/`assignTaskAction` → `PlanningTasksService` → realne zapisy do `planning_tasks` + `planning_task_activity`), agregator kalendarza (`PlanningCalendarService.getCalendarData` — odkrywa źródła wg uprawnień/entitlementów: zadania, tickety, każda widoczna tablica Kanban, natywne kalendarze — i mapuje je do wspólnego DTO), oraz Kanban (`planning_kanban_boards/columns/cards`, `KanbanBoardsService.moveCard` — realne przeliczenie i zapis `position`/`column_id` dla każdej dotkniętej karty). Potwierdzono: pojedynczy przypisany użytkownik (nie wiele osób), karta Kanban nie ma żadnej kolumny odwołującej się do zadania — to w pełni odrębny prymityw, nie to samo co zadanie i nie zsynchronizowane z nim. Komentarze (`CommentsThread`) są realnie renderowane zarówno w szczegółach zadania, jak i karty Kanban. Załączniki — mimo że `planning.task`/`planning.kanban_card` są zarejestrowane jako obsługiwane cele na poziomie serwisu — nie mają dziś żadnego wywołania `AttachmentsPanel` w UI Planowania (tylko w Help Desk).
- Testy automatyczne: PARTIAL. Solidne testy jednostkowe na zamockowanym kliencie dla serwisu zadań (tworzenie, zmiana statusu, przypisanie, usunięcie) i agregatora kalendarza (odkrywanie źródeł wg uprawnień, mapowanie DTO). Zero testów dla serwisu Kanban (`kanban-boards.service.ts` nie ma pliku testowego) — przeciąganie/zapis kolejności kart jest dziś całkowicie nieprzetestowane na żadnym poziomie. Zero testów renderujących kalendarz/tablicę na realnych danych.
- Weryfikacja ręczna: NOT VERIFIED — brak odnotowanej świeżej próby.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: utworzenie zadania → widoczność na liście/kalendarzu → (opcjonalnie) karta na tablicy Kanban → trwałość po odświeżeniu.

**Wymagany stan dla pitchu:** PARTIALLY READY

### Pitch readiness checklist

- [ ] Wybrano najwyżej jeden mały, zapisany przykład (jedno zadanie, ewentualnie widoczne też na kalendarzu lub tablicy) — pokaz nie rozszerza głównego demo P0/P1.
- [ ] Jeśli przykład jest pokazywany na żywo: utworzenie/edycja/zakończenie jednego zadania jednorazowego sprawdzone na aktualnym build, z trwałością po odświeżeniu.
- [ ] Jeśli pokazywany jest kalendarz lub Kanban: wybrany widok jest stabilny; sprawdzone, że pokazane dane są rzeczywiście zapisane, nie przypadkowe/testowe śmieci.
- [ ] Wypowiedź jasno rozróżnia zadania i karty Kanban jako **osobne narzędzia organizacji pracy**, nie sugeruje, że karta Kanban to to samo zadanie lub że są zsynchronizowane.
- [ ] Wypowiedź nie wspomina o cykliczności zadań ani o dostarczaniu powiadomień — to nie istnieje i należy do przyszłej Strefy 14.
- [ ] Jeśli ekran okazuje się niestabilny podczas przygotowań: zamiana na samą wzmiankę słowną, bez pokazu na żywo — brak demo tej strefy nie blokuje głównego pitchu.

**Pitch gap:**

Brak istotnej luki funkcjonalnej blokującej krótką wzmiankę lub mały pokaz — to działający kod, nie fasada. Jedyne realne ryzyko to nadinterpretacja podczas prezentacji: sugerowanie integracji zadanie↔karta Kanban, której nie ma, albo cykliczności/powiadomień, których nie ma. Poza tym brakuje wyłącznie świeżej ręcznej próby wybranego przykładu.

**Wymagany stan dla pilotażu:** dotyczy wyłącznie, jeśli Planowanie zostanie świadomie włączone do zakresu pilotażu — patrz Strefa 12

### Pilot readiness checklist

Poniższe wymagania są istotne tylko wtedy, gdy pilotaż faktycznie obejmie operacyjne użycie zadań/kalendarza/Kanban (co dziś nie jest ustalone — Strefa 12 nie wymienia Planowania w zakresie pilotażu). Jeśli Planowanie nie wejdzie do zakresu pilotażu, poniższe punkty są N/A, nie blokerami.

- [ ] Testy dla serwisu Kanban (dziś całkowicie nieobecne) — w szczególności poprawność przeliczania kolejności kart przy współbieżnej edycji.
- [ ] Jawna decyzja o zakresie oddziałowym: `planning_tasks.branch_id` to dziś tylko opcjonalny tag filtrowania, nie wymuszona granica RLS; tablice Kanban nie mają w ogóle koncepcji oddziału (są całkowicie organizacyjne) — do zaakceptowania świadomie albo do utwardzenia przed realnym użyciem wieloddziałowym.
- [ ] Podłączenie `AttachmentsPanel` do UI zadań/kart Kanban, jeśli pilotaż ma z załączników korzystać — dziś zarejestrowane na poziomie danych, ale bez konsumenta UI.
- [ ] Zachowanie przypisania zadania po usunięciu/dezaktywacji przypisanego użytkownika.
- [ ] Ślad audytowy zmian statusu/przypisania dla ról administracyjnych (częściowo już istnieje przez `planning_task_activity`/`planning_kanban_card_activity` — do potwierdzenia jako wystarczający operacyjnie).
- [ ] Realistyczny test wieloużytkownikowej pracy na tej samej tablicy Kanban.
- [ ] **Dokładny scenariusz pilotażu Strefy 13 zweryfikowany ręcznie**, wyłącznie jeśli Planowanie wejdzie do zakresu pilotażu.

**Pilot gap:**

Nie dotyczy, dopóki Strefa 12 nie potwierdzi, że Planowanie jest częścią zakresu pilotażu. Jeśli zostanie włączone, głównym brakiem jest testowanie Kanban (dziś zerowe) i decyzja o twardości granicy oddziałowej.

### Notes / evidence

- Schemat `planning_tasks`: `id, organization_id, branch_id(opcjonalny), title, description(+rich), status(open/in_progress/completed/cancelled), priority, assigned_to(pojedynczy), created_by/updated_by, completed_at/started_at/cancelled_at/due_at, task_number, pola kalendarzowe (due_date, calendar_all_day/start/end/timezone)` — brak kolumn cykliczności, brak kolumny labels/tags (etykiety statusu/priorytetu to konfiguracja per-organizacja w `planning_settings`, nie pole zadania).
- CRUD zadania: `createTaskAction`/`updateTaskAction`/`changeTaskStatusAction`/`assignTaskAction` (`apps/web/src/app/actions/planning/index.ts`) → `PlanningTasksService` (`planning-tasks.service.ts`) — realne zapisy, potwierdzone testami sprawdzającymi dokładny kształt wywołań Supabase.
- Kalendarz: `PlanningCalendarService.getCalendarData` (`planning-calendar.service.ts:121-437`) — realny agregator odkrywający źródła (zadania/tickety/każda widoczna tablica Kanban/natywne kalendarze) wg uprawnień i entitlementów, mapujący je do wspólnego DTO; zadanie trafia na kalendarz automatycznie przez obecność pól `due_date`/`calendar_*`, nie przez ręczny krok.
- Kanban: `planning_kanban_boards/columns/cards` (`20260605130000_planning_kanban_boards.sql`) — realne tabele, `FORCE ROW LEVEL SECURITY`; przeciąganie karty (`moveCard` w `planning-boards-client.tsx` → `moveKanbanCardAction` → `KanbanBoardsService.moveCard`) realnie przelicza i zapisuje `position`/`column_id` dla każdej dotkniętej karty, z wycofaniem stanu klienta przy błędzie.
- Karta Kanban nie ma żadnej kolumny/FK odwołującej się do zadania — potwierdzone przeszukaniem wszystkich migracji Kanban; to w pełni odrębny prymityw, nie to samo zadanie ani nie zsynchronizowane.
- Komentarze są realnie podłączone w UI (zadanie i karta Kanban); załączniki są zarejestrowane jako obsługiwany cel na poziomie serwisu, ale `AttachmentsPanel` nie jest dziś wywoływany nigdzie w UI Planowania (tylko w Help Desk) — korekta wcześniejszego ustalenia „komentarze/załączniki podłączone", trafna tylko dla komentarzy.
- Uprawnienia wymuszane po stronie serwera (`checkPermission` w akcjach) i przez RLS z `FORCE` na `planning_tasks`/`planning_kanban_*`, z bezpośrednimi wywołaniami `has_permission(...)` w politykach.
- Cykliczność: brak jakichkolwiek kolumn/pól/generatora w tym module — potwierdzone, poza zakresem tej strefy (Strefa 14).
- Zero testów dla serwisu Kanban; solidne testy jednostkowe (zamockowane) dla serwisu zadań i agregatora kalendarza; zero testów renderujących realny widok kalendarza/tablicy.

### Recurrence-specific excerpt from former Zone 14 audit (notification-relevant findings excluded — see archive)

> Poniższe dwa zdania są przytoczone dosłownie z oryginalnego, zaakceptowanego audytu dawnej Strefy 14 (`Notes / evidence`). Dotyczą wyłącznie cykliczności/harmonogramowania i nie zawierają żadnej treści o powiadomieniach — dlatego mogły zostać bezpiecznie wyodrębnione bez ryzyka zniekształcenia znaczenia. Pełny oryginalny audyt (obie strony: cykliczność i powiadomienia razem) pozostaje jedynym pełnym źródłem prawdy w archiwum, patrz link wyżej.

- Zero kolumn/tabel/generatora cykliczności w obu drzewach migracji i w całym `apps/web/src`; jedyny artefakt to martwy typ `AuditSchedule` (`src/lib/types/audit.ts`) z polem `frequency`, bez żadnej wspierającej tabeli (`audit_schedules`/`next_audit_date` nie istnieją nigdzie w migracjach) ani konsumenta w kodzie.
- Zero infrastruktury harmonogramowanej w całej aplikacji: brak `vercel.json` z cronami, brak `pg_cron` w migracjach, trzy istniejące Supabase Edge Functions dotyczą wyłącznie uwierzytelniania (`auth-hook`, `custom-access-token-hook`, `send-auth-email`).

---

## Product clarification and final design

> This section is intentionally separate from the accepted implementation audit above.
>
> The audit describes what currently exists.
> This section will be used to determine how the functionality SHOULD ultimately behave before implementation work begins.
>
> Do not treat unanswered questions in this section as accepted requirements.

### Open questions

_To be reviewed together before implementation._

### Problems / ambiguities

_To be reviewed together before implementation._

### Product decisions

_No final decisions recorded yet._

### Final intended workflow

_To be defined after product clarification._

### Architecture implications

_To be defined after the intended workflow is agreed._

### Final pitch scope

_To be defined after clarification._

### Final controlled-pilot scope

_To be defined after clarification._
