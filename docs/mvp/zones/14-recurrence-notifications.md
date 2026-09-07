### 14. Cykliczność i powiadomienia operacyjne

**Priorytet:** P3

**Stan obecny:** 🟠 EARLY / DISCONNECTED

Cykliczność: brak jakiegokolwiek śladu wykonania w całym repozytorium, nie tylko w Planowaniu — zero kolumn/tabel/generatora/harmonogramu w obu drzewach migracji, zero infrastruktury schedulera/cron/pg_cron/edge function w całej aplikacji. Jedyny szczątkowy artefakt to martwy typ TypeScript `AuditSchedule` z polem `frequency`, bez żadnej tabeli, akcji ani UI, które by go używały. Powiadomienia: prawdziwe, zapisujące się do bazy ustawienia preferencji istnieją (`user_preferences.notification_settings`), a dzwonek w nagłówku ma realny, ładnie wyglądający interfejs listy — ale to dwa osobne, niepodłączone do siebie fragmenty: preferencje nie mają żadnego producenta, który by je odczytał, a dzwonek renderuje wyłącznie zaszyty na sztywno, przykładowy tablicowy zestaw powiadomień (z jawnym komentarzem TODO w kodzie), nie dane z bazy. Dwie dodatkowe flagi bazodanowe (`stock_alerts.notification_sent`, `helpdesk_settings.email_notifications`) istnieją w schemacie, ale nie mają żadnego kodu, który by je zapisywał lub odczytywał. To dokładnie sytuacja 🟠: realne prymitywy UI/schema/preferencji istnieją, silnik wykonania/dostarczania — nie.

**Dowody:**

- Kod: VERIFIED, przeszukanie całego repozytorium (nie tylko Planowania). Zero wyników dla cykliczności w obu drzewach migracji i w kodzie źródłowym poza jednym martwym typem. Zero infrastruktury harmonogramowanej (brak `vercel.json` z cronami, brak `pg_cron`, jedyne trzy Supabase Edge Functions dotyczą wyłącznie uwierzytelniania). Dzwonek powiadomień (`header-notifications.tsx`) potwierdzony jako w pełni zaszyty na sztywno: tablica `EXAMPLE_NOTIFICATIONS` z pięcioma stałymi wpisami i statycznymi znacznikami czasu („5 min ago"), `isLoading` na sztywno `false`, licznik nieprzeczytanych liczony wyłącznie z lokalnej tablicy — brak jakiegokolwiek zapytania do bazy. `EmailService` jest realny i ogólnego przeznaczenia, ale ma dokładnie jednego wywołującego w całym kodzie — akcję zaproszeń (Strefa 10); żadne inne zdarzenie biznesowe (przypisanie zadania/ticketu, akceptacja, wymagane zatwierdzenie, przypomnienie o terminie) nie wysyła e-maila. Brak jakiejkolwiek koncepcji „overdue"/przypomnienia/eskalacji w całym kodzie źródłowym. Brak service workera, subskrypcji push, FCM/APNs.
- Testy automatyczne: PARTIAL wyłącznie dla warstwy preferencji (zapis/odczyt ustawień powiadomień jest testowany jako CRUD) — zero testów czegokolwiek związanego z cyklicznością (bo nie istnieje) i zero testów rzeczywistego dostarczania powiadomień (bo nie istnieje).
- Weryfikacja ręczna: NOT APPLICABLE — nie ma czego weryfikować ręcznie poza samym ekranem preferencji, który zapisuje dane bez żadnego efektu operacyjnego.
- Przebieg end-to-end: NOT APPLICABLE — nie istnieje żadna ścieżka od zdarzenia do faktycznie dostarczonego powiadomienia ani od reguły cyklicznej do wygenerowanego wystąpienia.

**Wymagany stan dla pitchu:** ROADMAP ONLY

### Pitch readiness checklist

- [ ] Wypowiedź nie twierdzi, że cykliczne zadania/zlecenia rzeczywiście się generują — dziś nie ma żadnego mechanizmu wykonania.
- [ ] Wypowiedź nie twierdzi, że powiadomienia są faktycznie dostarczane (e-mail/push/in-app) — dziś nic poza zaproszeniami nie wysyła realnej wiadomości.
- [ ] Wypowiedź nie myli istnienia ekranu ustawień preferencji powiadomień z działającym dostarczaniem — ustawienia zapisują się poprawnie, ale nic ich dziś nie odczytuje przy wysyłce.
- [ ] Dzwonek powiadomień w nagłówku nie jest klikany/pokazywany na żywo podczas pitchu jako dowód działającego systemu — renderuje wyłącznie zaszyte na sztywno przykładowe dane.
- [ ] Strefa 13 (zadania jednorazowe/kalendarz/Kanban) jest opisywana osobno i uczciwie jako dziś działająca funkcja, niezależnie od tego, że cykliczność/powiadomienia z tej strefy nie działają.
- [ ] Cykliczność i powiadomienia operacyjne są przedstawione jako naturalny, przemyślany kierunek rozwoju, nie jako gotowa funkcja — zgodnie z §14 skryptu.

Brama końcowa nie jest wymagana — brak ręcznej demonstracji na żywo dla tej strefy, zgodnie z jej statusem roadmapy.

**Pitch gap:**

Brak luki blokującej pitch — ta strefa nie jest częścią żadnej obiecanej demonstracji. Jedyne ryzyko to retoryczne: łatwo przez pomyłkę zasugerować (pokazując ekran preferencji albo dzwonek), że coś działa operacyjnie, podczas gdy działa tylko zapis ustawień i atrapa UI.

**Wymagany stan dla pilotażu:** deferred, chyba że jawnie włączone do zakresu — patrz Strefa 12

### Pilot readiness checklist

Poniższe dotyczy wyłącznie, jeśli pilotaż uzna którekolwiek z tych powiadomień za operacyjnie niezbędne (np. powiadomienie o wymaganej akceptacji ze Strefy 11, powiadomienie o przypisaniu zadania) — Strefa 12 powinna świadomie zdecydować, czy pilotaż może polegać na komunikacji ręcznej (Slack/e-mail/rozmowa) zamiast wbudowanych powiadomień, zanim którykolwiek z poniższych punktów stanie się wymaganiem, a nie tylko możliwością.

- [ ] Jeśli potrzebne: minimalny, jeden konkretny producent powiadomienia (np. „ticket wymaga akceptacji") z realnym zapisem do trwałego modelu powiadomień (dziś nieistniejącego) i realnym dostarczeniem (e-mail wystarczy, nie wymaga in-app/push).
- [ ] Jeśli potrzebne: dzwonek podłączony do rzeczywistych danych zamiast tablicy przykładowej, z realnym stanem przeczytane/nieprzeczytane.
- [ ] Jeśli potrzebne: polityka kanału (e-mail vs in-app), ochrona przed zalewem powiadomień, oraz respektowanie już istniejących preferencji użytkownika.
- [ ] Jeśli pilotaż ma polegać wyłącznie na komunikacji ręcznej: jawnie to zapisane jako świadoma decyzja, nie przeoczenie.
- [ ] **Dokładny zakres powiadomień pilotażu ustalony i zweryfikowany**, wyłącznie jeśli Strefa 12 włączy je do zakresu.

**Pilot gap:**

Nie dotyczy, dopóki Strefa 12 nie zdecyduje, że konkretne powiadomienie jest operacyjnie niezbędne dla wybranego zakresu pilotażu. Jeśli tak, wymagany jest jeden wąski, prawdziwy producent-odbiorca, nie pełny system powiadomień ani cykliczność.

### Notes / evidence

- Zero kolumn/tabel/generatora cykliczności w obu drzewach migracji i w całym `apps/web/src`; jedyny artefakt to martwy typ `AuditSchedule` (`src/lib/types/audit.ts`) z polem `frequency`, bez żadnej wspierającej tabeli (`audit_schedules`/`next_audit_date` nie istnieją nigdzie w migracjach) ani konsumenta w kodzie.
- Zero infrastruktury harmonogramowanej w całej aplikacji: brak `vercel.json` z cronami, brak `pg_cron` w migracjach, trzy istniejące Supabase Edge Functions dotyczą wyłącznie uwierzytelniania (`auth-hook`, `custom-access-token-hook`, `send-auth-email`).
- Dzwonek powiadomień: `apps/web/src/components/v2/layout/header-notifications.tsx` — jawny komentarz „TODO: Connect to real notifications system" (ok. linii 18-34), tablica `EXAMPLE_NOTIFICATIONS` (ok. linii 47-88) z pięcioma stałymi wpisami i statycznymi znacznikami czasu, `isLoading` zawsze `false`, licznik nieprzeczytanych liczony wyłącznie z lokalnej tablicy; wszystkie operacje (oznacz jako przeczytane, wyczyść, usuń) mutują wyłącznie lokalny stan React, nic nie zapisuje się ani nie czyta z bazy.
- Preferencje powiadomień: realne, zapisujące się do bazy (`user_preferences.notification_settings` JSONB, `UserPreferencesService.updateNotificationSettings`) — ale zero kodu producenta odczytuje tę kolumnę przed czymkolwiek, bo nic nie wysyła powiadomień.
- Dwie martwe flagi bazodanowe bez żadnego kodu zapisującego/odczytującego: `stock_alerts.notification_sent`/`notification_sent_at`/`notification_type` (migracja `20251117120002_phase3_stock_alerts.sql`, opisana w komentarzu jako „Two-Tier Notification System", ale bez jednego wywołania w kodzie) oraz `helpdesk_settings.email_notifications` (potwierdzone też w Strefie 11 jako nieczytane przez żadną akcję ticketu).
- `EmailService` (`src/server/services/email.service.ts`) jest realny i ogólnego przeznaczenia (generyczny `sendEmail`, dedykowane metody dla powitania/zaproszenia/resetu hasła), ale ma dokładnie jednego wywołującego w całym `src` — akcję zaproszeń ze Strefy 10; reset hasła w praktyce obsługuje osobna infrastruktura auth (edge function), nie ta usługa. Żadne inne zdarzenie biznesowe nie wysyła e-maila.
- Brak jakiejkolwiek koncepcji przypomnienia/eskalacji/„overdue" (nawet jako cecha wizualna) w całym przeszukanym kodzie źródłowym; brak service workera, subskrypcji push, FCM/APNs.
- Ustalenie to rozszerza i potwierdza wcześniejsze, węższe obserwacje z tej samej sesji: brak powiadomień dla ticketów (Strefa 11) i brak cykliczności/powiadomień w Planowaniu (Strefa 13) — tu potwierdzone jako zjawisko całej aplikacji, nie pojedynczego modułu.

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
