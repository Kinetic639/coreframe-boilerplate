### 11. Tickety: komunikacja, akceptacja i problemowa część z QR

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

Rdzeń działa i jest spójny, nie tylko rozłączonymi prymitywami: prawdziwy wielo-użytkownikowy ticket z rzeczywistymi komentarzami (generyczny system załączników/komentarzy z Strefy 9), trwałą, niemutowalną historią aktywności, realnym procesem akceptacji wymuszanym po stronie RPC (nie tylko RLS), oraz w pełni działającym przypisaniem/skanowaniem QR ticketu prowadzącym do właściwego widoku szczegółów. To realna, sprawdzona (kodowo) funkcjonalność. Jednocześnie ujawniono konkretne, potwierdzone braki wymagające jawnego zawężenia wypowiedzi: **nie istnieje akcja odrzucenia** — jest wyłącznie akceptacja, żadnej symetrycznej decyzji negatywnej; **żadna kolumna nie łączy ticketu strukturalnie ze zleceniem, produktem, częścią ani kontenerem** — istnieje wprawdzie generyczna tabela `helpdesk_ticket_references` do takich powiązań, ale nie ma jej ani jednego wywołania w całym kodzie (martwa infrastruktura); wyszukiwanie ticketów dopasowuje wyłącznie tytuł, nie numer ticketu; przejścia statusu nie są wymuszane po stronie serwera poza zamknięciem (bezwarunkowym, z dowolnego statusu). Żaden typ „Zwrot" nie jest dziś zasiany domyślnie — trzeba by go utworzyć ręcznie przed pokazem jako typ niestandardowy.

**Dowody:**

- Kod: VERIFIED, na autorytatywnym drzewie migracji dla tego modułu (tabele `helpdesk_*` istnieją wyłącznie w `apps/web/supabase/migrations` — w przeciwieństwie do innych stref, nie ma tu problemu dwóch drzew/dryfu schematu). Prześledzono pełny schemat `helpdesk_tickets` i tabel powiązanych, tworzenie ticketu przez atomowy RPC `helpdesk_create_ticket`, model przypisania wielu użytkowników (`helpdesk_ticket_assignees`, domyślni odpowiedzialni/akceptanci per typ), generyczne komentarze (`CommentsService`/`CommentsThread` z `targetType="helpdesk.ticket"`), niemutowalną tabelę aktywności (`helpdesk_ticket_activity` — INSERT-only, bez polityki UPDATE/DELETE) z realnie logowanymi zdarzeniami (`ticket_created`, `ticket_accepted`, `ticket_closed`, `comment_added`, `attachment_added` — **brak** logowania zmiany statusu poza zamknięciem i brak logowania zmiany przypisania), proces akceptacji (`helpdesk_accept_ticket` RPC z autoryzacją wymuszoną wewnątrz funkcji, nie tylko przez RLS — potwierdzony brak jakiejkolwiek funkcji/akcji odrzucenia), oraz realny UI QR ticketu (`AssignQrDialog` — generowanie/przypisanie/skan/odłączenie) ze zweryfikowanym resolverem publicznym prowadzącym do poprawnej trasy szczegółów po `ticket_number`. Potwierdzono też dwie konkretne usterki: wyszukiwanie na liście ticketów filtruje wyłącznie `title` (`.ilike("title", ...)`), nie `ticket_number`; oraz że generyczna metoda `update()` serwisu (pozwalająca na dowolną zmianę statusu) istnieje, ale nie jest wywoływana z żadnej akcji — jedyna realna zmiana statusu po utworzeniu to bezwarunkowe zamknięcie.
- Testy automatyczne: NONE dla realnego zachowania ticketów. Wyczerpujące przeszukanie nie znalazło żadnego dedykowanego testu tworzenia ticketu, komentowania, akceptacji, zamknięcia ani przypisania QR — istniejące testy z „helpdesk" w nazwie dotyczą wyłącznie widoczności menu bocznego (gate uprawnień) albo integracji z kalendarzem planowania, z `HelpdeskTicketsService` całkowicie zamockowanym.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: utworzenie ticketu przez konto A → komentarz konta B → akceptacja przez uprawnione konto → ponowne otwarcie → skan QR na telefonie prowadzący do tego samego ticketu.

**Wymagany stan dla pitchu:** DEMO READY dla krótkiego pokazu

### Pitch readiness checklist

**Rdzeń ticketu**

- [ ] Utworzono jeden reprezentatywny ticket na aktualnym build, z typem, statusem, terminem i co najmniej jedną przypisaną osobą (konto B ze Strefy 10).
- [ ] Ticket i jego pola przetrwały odświeżenie strony.

**Komunikacja dwóch użytkowników**

- [ ] Konto B (inne niż twórca) otwiera ticket i dodaje komentarz — sprawdzone na żywo, że komentarz jest widoczny z autorem i czasem.
- [ ] Konto A ponownie otwiera ticket i widzi komentarz konta B po nawigacji/odświeżeniu.

**Historia**

- [ ] Historia aktywności ticketu pokazuje rzeczywiste zdarzenia (utworzenie, komentarz, ewentualną akceptację/zamknięcie) — prezenter wie, że zmiana przypisania i zmiana statusu (poza zamknięciem) **nie są dziś logowane** w historii, więc nie obiecuje tego na żywo.

**Akceptacja — bez fałszywej symetrii**

- [ ] Jeśli demo pokazuje przykład „Zwrot": utworzono ręcznie typ ticketu z wymaganą akceptacją przed spotkaniem — nie istnieje on domyślnie.
- [ ] Wyznaczony akceptant (konto z uprawnieniem zarządzania lub wpisany na listę akceptantów tego ticketu) akceptuje ticket — decyzja jest trwała, z autorem i czasem, widoczna po ponownym wejściu.
- [ ] Konto nieuprawnione nie może wykonać akceptacji — sprawdzone na żywo, nie tylko wywnioskowane z ukrycia przycisku (RPC wymusza to niezależnie od RLS).
- [ ] Wypowiedź prezentera **nie wspomina o odrzuceniu ticketu** jako istniejącej funkcji — dziś istnieje wyłącznie akceptacja, nie ma żadnej symetrycznej akcji odrzucenia w kodzie.
- [ ] Akceptacja jest opisana dokładnie jako to, czym jest: potwierdzenie z autorem/czasem dla konkretnego ticketu, nie jako silnik decyzji biznesowych z eskalacją, blokadami czy automatycznym skutkiem magazynowym.

**QR ticketu**

- [ ] Dla ticketu demo wygenerowano/przypisano QR z realnego UI na stronie szczegółów.
- [ ] Skan QR na telefonie prezentacyjnym otwiera dokładnie ten ticket (weryfikacja rozwiązywania po `ticket_number`, nie tylko odczyt kodu z rejestru).
- [ ] Wypowiedź prezentera opisuje to jako „etykieta ticketu przyklejona do części", nie jako „QR identyfikuje część" — dziś QR nie ma żadnej strukturalnej relacji do fizycznej części (zależność od Strefy 5, gdzie nie ma celu QR dla części).

**Powiązania domenowe — jawne zawężenie wymagane**

- [ ] Jeśli scenariusz demo wspomina o powiązaniu ticketu ze zleceniem/częścią/zestawem: potwierdzono, że dziś nie istnieje żadna trwała, nawigowalna relacja (tabela `helpdesk_ticket_references` istnieje w schemacie, ale nie ma żadnego wywołania w kodzie — martwa infrastruktura) — wypowiedź ogranicza się do „QR na fizycznej części otwiera ticket z opisem problemu", nie do „ticket zna tę część".

**Wyszukiwanie i ponowne odnalezienie**

- [ ] Ticket demo można odnaleźć z listy po tytule — prezenter wie, że wyszukiwanie po numerze ticketu dziś nie działa (filtr sprawdza wyłącznie tytuł).
- [ ] Ponowne otwarcie po nawigacji pokazuje pełny, trwały stan (komentarze, historia, akceptacja).

**Uczciwość wobec powiadomień**

- [ ] Wypowiedź nie sugeruje, że utworzenie/przypisanie/skomentowanie ticketu wysyła realne powiadomienie (e-mail/push/in-app) — dziś żadne z tych zdarzeń nie wyzwala niczego poza zapisem w bazie.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 11 zweryfikowany ręcznie na aktualnym build, na dwóch przygotowanych kontach ze Strefy 10:** konto A tworzy reprezentatywny ticket → przypisuje go zgodnie z rzeczywistym modelem do konta B → konto B otwiera i komentuje → wybrana akcja statusu/akceptacji wykonana przez uprawnione konto → konto A ponownie otwiera ticket i widzi trwałe komentarze/historię/decyzję → QR tego ticketu zeskanowany na telefonie prezentacyjnym otwiera ten sam ticket → każde pokazane powiązanie ze zleceniem/częścią/zestawem jest potwierdzone jako strukturalne i nawigowalne, w przeciwnym razie prezenter jawnie opisuje QR jako etykietę ticketu fizycznie przyklejoną do części, nie jako cyfrową relację do części.

**Pitch gap:**

Rdzeń działa realnie i spójnie — to nie jest strefa wymagająca nowej implementacji, tylko precyzyjnego, zawężonego opisu tego, co faktycznie istnieje. Trzy konkretne rzeczy wymagają jawnego ograniczenia wypowiedzi, nie kodu: (1) brak akcji odrzucenia — tylko akceptacja; (2) brak jakiejkolwiek strukturalnej relacji do zlecenia/części/zestawu — istniejąca tabela do tego celu jest martwym kodem; (3) wyszukiwanie po numerze ticketu nie działa. Dodatkowo typ „Zwrot" wymaga ręcznego przygotowania przed spotkaniem, bo nie jest zasiany domyślnie. Nic z powyższego nie zostało odtworzone ręcznie na aktualnym build.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Izolacja oddziałowa ticketów — zależność od Strefy 1 (RLS `helpdesk_tickets` jest dziś tylko organizacyjne, nie wymuszone na poziomie oddziału mimo kolumny `branch_id`), tu odnotowana jako wymaganie specyficzne dla tego modułu, nie duplikowana.
- [ ] Testy automatyczne dla całego przepływu ticketu (utworzenie, przypisanie, komentarz, akceptacja, zamknięcie, QR) — dziś całkowicie nieobecne.
- [ ] Wymuszenie przejść statusu po stronie serwera (dziś dowolna zmiana byłaby możliwa przez nieużywaną, ale istniejącą generyczną metodę `update()`, gdyby ktoś ją podłączył bez ograniczeń) — ustalić właściwy model przed realnym użyciem operacyjnym.
- [ ] Decyzja: czy dodać akcję odrzucenia jako realną funkcję, czy świadomie pozostać przy modelu wyłącznie akceptacji dla pilotażu.
- [ ] Jeśli pilotaż ma operacyjnie korzystać z powiązania ticket ↔ zlecenie/część: podłączenie istniejącej, dziś martwej tabeli `helpdesk_ticket_references` (lub równoważnego mechanizmu) do rzeczywistego UI, zależne też od istnienia Strefy 4.
- [ ] Naprawa wyszukiwania po numerze ticketu na stałe.
- [ ] Ślad audytowy zmiany przypisania i zmiany statusu w historii aktywności (dziś logowane są tylko utworzenie/komentarz/załącznik/akceptacja/zamknięcie).
- [ ] Zachowanie przy usunięciu/dezaktywacji przypisanego użytkownika (czy ticket pozostaje przypisany do „widmowego" konta).
- [ ] Polityka powiadomień, jeśli pilotaż uzna je za potrzebne — dziś brak jakiejkolwiek implementacji, zależność od przyszłej Strefy 14.
- [ ] Testy integracyjne/RLS na żywej bazie dla ticketów i akceptacji — dziś brak jakichkolwiek testów.
- [ ] **Dokładny scenariusz pilotażu Strefy 11 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu.**

**Pilot gap:**

Główna dodatkowa praca pilotażowa to domknięcie luk już zidentyfikowanych dla pitchu (odrzucenie, relacje domenowe, wyszukiwanie, wymuszanie statusu) w sposób trwały, nie tymczasowy, plus pierwsze pokrycie testami całego modułu (dziś zerowe) i podjęcie świadomej decyzji o powiadomieniach. Nie wymaga to pełnego silnika zwrotów, Customer Care ani SLA — zgodnie z ograniczeniem zakresu tej strefy.

### Notes / evidence

- Autorytatywne drzewo migracji dla Help Desk to wyłącznie `apps/web/supabase/migrations` — brak plików `helpdesk_*` w `apps/web/supabase-target/supabase/migrations`, więc (w przeciwieństwie do innych stref) nie ma tu niejednoznaczności dwóch drzew.
- Schemat `helpdesk_tickets`: `id, org_id, ticket_number, title, description(+rich/plain), status, priority, ticket_type_id, assigned_to(vestigialne, nieużywane), created_by, branch_id, requested_by, closed_by, resolved_at, closed_at, due_at, requires_acceptance, accepted_by, accepted_at, created_at, updated_at, deleted_at`. Jedyna generyczna tabela relacji domenowych, `helpdesk_ticket_references` (`source_module, source_type, source_id, context_snapshot`), istnieje w schemacie z pełnym RLS, ale nie ma żadnego wywołania w `apps/web/src` — martwa infrastruktura.
- Typy ticketów: zasiane systemowo `general_request`, `question`, `task_request` — **brak domyślnego typu „Zwrot"**; typ wpływa na domyślny priorytet, domyślnych odpowiedzialnych/akceptantów i flagę `requires_acceptance`, ale to zachowanie jest realizowane po stronie klienta (`new-ticket-form.tsx`), nie wymuszane przez RPC tworzenia ticketu.
- Tworzenie: `createTicketAction` → `HelpdeskTicketsService.createWithAssignees` → RPC `helpdesk_create_ticket` (atomowy, generuje numer `HD-000001`, wstawia przypisania i akceptantów, loguje `ticket_created`); wymaga tytułu i co najmniej jednego przypisanego użytkownika.
- Przypisanie: model wielo-użytkownikowy przez `helpdesk_ticket_assignees` (rola responder/watcher, status), nie pojedynczy `assigned_to` (kolumna istnieje, ale nieużywana) i nie zespół/dział — nie ma koncepcji zespołu w schemacie.
- Komentarze: generyczny system z Strefy 9 (`CommentsService`/`CommentsThread`, `targetType="helpdesk.ticket"`) — trwałe, z autorem/czasem, RLS ograniczające widoczność do twórcy/przypisanego/managera z uprawnieniem odczytu.
- Historia: `helpdesk_ticket_activity`, tabela tylko-do-wstawiania (bez polityk UPDATE/DELETE), realnie loguje `ticket_created`/`ticket_accepted`/`ticket_closed`/`comment_added`/`attachment_added` — nie loguje zmiany przypisania ani zmiany statusu poza zamknięciem.
- Akceptacja: RPC `helpdesk_accept_ticket` z autoryzacją wymuszoną wewnątrz funkcji (manager LUB wpisany akceptant tego ticketu) — realny, RPC-poziomowy mechanizm obronny, nie tylko RLS. **Brak jakiejkolwiek funkcji/akcji odrzucenia** — potwierdzone brakiem wystąpień „reject"/„rejection" w migracjach i kodzie akcji/serwisu.
- QR: realny UI `AssignQrDialog` na stronie szczegółów ticketu (generowanie, skan istniejącej etykiety, odłączenie); resolver publiczny (`target-registry.ts`, wpis `helpdesk.ticket`) poprawnie rozwiązuje `ticket_number` do trasy `/dashboard/help-desk/tickets/{ticket_number}`, zgodnej z tym, czego faktycznie oczekuje strona szczegółów.
- Statusy: CHECK `('open','in_progress','waiting','waiting_response','resolved','closed','cancelled')` — brak wymuszania przejść; jedyna realna zmiana po utworzeniu to bezwarunkowe zamknięcie (`closeTicketAction`, dostępne dla twórcy lub managera); generyczna metoda `update()` pozwalająca na dowolną zmianę statusu istnieje w serwisie, ale nie jest wywoływana z żadnej akcji — martwa.
- Wyszukiwanie: lista ticketów filtruje `title` przez `.ilike`, nie `ticket_number` — ten sam wzorzec usterki co wyszukiwanie SKU w Strefie 7.
- Powiadomienia: zero implementacji dla ticketów (utworzenie/przypisanie/komentarz/akceptacja nie wyzwalają niczego poza zapisem w bazie) — spójne z ogólnym stanem powiadomień w projekcie (dzwonek z jawnym `TODO: Connect to real notifications system`), zależność od przyszłej Strefy 14.
- Zero testów jakiegokolwiek rodzaju dla realnego zachowania ticketów (tworzenie, komentarze, akceptacja, zamknięcie, QR) — istniejące testy z „helpdesk" w nazwie dotyczą wyłącznie widoczności menu i integracji z kalendarzem, z serwisem ticketów całkowicie zamockowanym.
- Zależności: Strefa 1 (izolacja oddziałowa RLS `helpdesk_tickets`), Strefa 4 (przyszła relacja do zlecenia, jeśli `helpdesk_ticket_references` zostanie podłączone), Strefa 5 (QR ticketu działa, ale nie ma celu QR dla samej części), Strefa 9 (współdzielony system komentarzy/załączników), Strefa 10 (przygotowane konta demo).

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
