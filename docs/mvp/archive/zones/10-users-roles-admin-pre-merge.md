### 10. Użytkownicy, zaproszenia, członkostwa, role i administracja dostępem

**Priorytet:** P1

**Stan obecny:** 🟡 PARTIAL

To najbardziej solidna strefa spośród dotychczas ocenionych — realna, w pełni podłączona administracja: lista członków, zaproszenia (tworzenie, akceptacja, odmowa, obsługa błędnych/wygasłych tokenów), role wbudowane i niestandardowe z edytorem uprawnień, przypisania ról w zakresie organizacji i oddziału (model „branch managera"), oraz rzeczywiste, testowane sprawdzenia uprawnień po stronie serwera — nie tylko ukrywanie przycisków. Zmiana roli działa bez wymuszania ponownego logowania (snapshot uprawnień jest czytany na świeżo przy każdym żądaniu SSR; JWT ma tylko kosmetyczne opóźnienie widoczne w wyświetlanej liście ról, nie w faktycznej autoryzacji). Jest jednak konkretna, potwierdzona w kodzie luka bezpieczeństwa administracyjnego: **nie istnieje żadne zabezpieczenie przed usunięciem/zdegradowaniem ostatniego właściciela organizacji ani przed samodzielnym odebraniem sobie dostępu** — ani w akcji, ani w serwisie, ani w RLS. To realny, potwierdzony brak, nie tylko niezweryfikowany szczegół, więc mimo mocnego fundamentu status nie przekracza PARTIAL.

**Dowody:**

- Kod: VERIFIED, na aktualnie działającym backendzie (`apps/web/.env.local` wskazuje projekt „target" — użyto migracji z `apps/web/supabase-target/supabase/migrations`, nie starszego drzewa `apps/web/supabase/migrations`). Prześledzono: listę członków (`members-client.tsx`, `OrgMembersService.listMembers`), pełny cykl zaproszenia (`createInvitationAction` → `OrgInvitationsService.createInvitation` → e-mail → `acceptInvitationAction`/`declineInvitationAction` → RPC `accept_invitation_and_join_org`/`decline_invitation`), rejestrację bez zaproszenia (`createOrganizationAction` → RPC `create_organization_for_current_user`, przypisanie roli `org_owner`), model ról (role wbudowane `org_owner`/`org_member` plus role niestandardowe per organizacja z edytorem uprawnień w `roles-client.tsx`), zmianę roli (`assignRoleToUserAction`/`removeRoleFromUserAction` → `user_role_assignments`, podwójna bramka `MEMBERS_MANAGE`/`BRANCH_ROLES_MANAGE`), administrację dostępem oddziałowym (ten sam mechanizm z `scope: "branch"`, filtrowany widok dla branch managerów) oraz świeżość uprawnień po zmianie (`compile_user_permissions` wywoływane jawnie po akceptacji zaproszenia; `PermissionServiceV2.getPermissionSnapshotForUser()` czytane na nowo przy każdym żądaniu SSR, nie z JWT). Potwierdzono realny brak: żadna z funkcji usuwania członka/roli (`OrgMembersService.removeMember`, akcje `roles.ts`) nie sprawdza liczby właścicieli ani tożsamości działającego użytkownika względem celu operacji; przeszukanie migracji `target` pod kątem „last_owner"/„owner_count" nie dało wyników.
- Testy automatyczne: PARTIAL/VERIFIED na papierze, nie uruchomione w tej sesji. Istnieje szeroki, konkretny zestaw testów (`invite-lifecycle.test.ts` — kody błędów `INVITE_NOT_FOUND`/`INVITE_EXPIRED`/`EMAIL_MISMATCH`/`INVITE_NOT_PENDING`; `actions-org-gaps.test.ts`, `roles.test.ts`, `branches.test.ts`, `member-detail-client.test.tsx`, `roles-client.test.tsx`, `branches-client.test.tsx` — w tym jawne przypadki „returns unauthorized when missing ..."), asercje odpowiadają dokładnie kształtowi realnego kodu. Zero testów dla scenariusza „ostatni właściciel"/samodzielnego odebrania dostępu — bo taka ochrona nie istnieje.
- Weryfikacja ręczna: NOT VERIFIED — brak jakiejkolwiek odnotowanej świeżej próby na aktualnym build.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo: otwarcie widoku członków → pokazanie realnych kont z różnymi rolami → jedna bezpieczna operacja (zmiana roli lub zaproszenie/akceptacja) → potwierdzenie efektu.

**Wymagany stan dla pitchu:** DEMO READY dla krótkiego omówienia

### Pitch readiness checklist

**Konta przygotowane przed spotkaniem**

- [ ] Konto administratora/właściciela przygotowane z pełnym dostępem.
- [ ] Konto pracownika magazynu przygotowane z rolą niestandardową odpowiednią do reszty pokazu (Strefy 6–9).
- [ ] Jeśli scenariusz tego wymaga: drugie konto (np. akceptant/doradca) przygotowane z inną, kontrastującą rolą.
- [ ] Członkostwa/role tych kont odpowiadają temu, co prezenter faktycznie pokaże — sprawdzone na żywo, nie tylko założone.

**Wybrany krótki scenariusz**

- [ ] Wybrano jeden, stabilny ekran administracyjny do pokazania (lista członków ze zróżnicowanymi rolami LUB zaproszenie z przypisaną rolą/zakresem) — nie oba naraz.
- [ ] Jeśli scenariusz obejmuje zmianę roli na żywo: sprawdzono na aktualnym build, że zmiana się zapisuje i jest widoczna bez konieczności wylogowania.
- [ ] Jeśli scenariusz obejmuje zaproszenie: jedno zaproszenie/przyjęcie przetestowano przed spotkaniem od początku do końca, łącznie z błędnym/wygasłym tokenem.
- [ ] Prezenter potrafi krótko i poprawnie terminologicznie opisać hierarchię organizacja → oddział → członek → rola → uprawnienie, zgodnie z rzeczywistym modelem w kodzie (role wbudowane + role niestandardowe per organizacja, nie sztywna lista „org_owner/manager/worker/viewer" nieodpowiadająca kodowi).
- [ ] Wypowiedź nie obiecuje funkcji, których nie ma (SSO, katalog HR, masowy import, pełny edytor macierzy uprawnień na poziomie enterprise) — pokaz ogranicza się do tego, co faktycznie działa.

**Bezpieczeństwo widoczne podczas pokazu**

- [ ] Konto bez uprawnień administracyjnych nie może wykonać tej samej operacji (zmiana roli/zaproszenie) — sprawdzone na żywo, nie tylko wywnioskowane z ukrytego przycisku.
- [ ] Podczas przygotowania demo nie wykonano przypadkowo operacji na ostatnim właścicielu organizacji — świadome ominięcie znanej luki (brak ochrony ostatniego właściciela), nie poleganie na tym, że nikt tego nie zrobi.

**Brama końcowa**

- [ ] **Dokładny scenariusz pitchu Strefy 10 zweryfikowany ręcznie na aktualnym build:** administrator otwiera realny widok administracji członkami/dostępem → pokazuje przygotowane konta z odrębnymi, rzeczywistymi członkostwami/rolami → wykonuje jedną wybraną, bezpieczną operację (zmiana roli LUB zaproszenie/akceptacja) → odświeżenie/ponowne zalogowanie w razie potrzeby → wynikowy dostęp jest widoczny i spójny ze Strefą 1 → konto nieuprawnione nie może wykonać tej samej operacji administracyjnej.

**Pitch gap:**

Fundament jest realny i solidniejszy niż w większości pozostałych stref — to nie jest kwestia budowania brakującej funkcjonalności, tylko krótkiej, świeżej weryfikacji ręcznej wybranego scenariusza na aktualnym build oraz świadomego, wąskiego doboru tego, co pokazać w ograniczonym czasie. Jedyna realna luka funkcjonalna — brak ochrony ostatniego właściciela/samodzielnej degradacji — nie blokuje pitchu wprost (nie jest to element scenariusza), ale wymaga ostrożności przy przygotowywaniu kont demo, żeby nie ujawnić jej przypadkowo na żywo.

**Wymagany stan dla pilotażu:** PILOT READY

### Pilot readiness checklist

- [ ] Ochrona ostatniego właściciela organizacji przed usunięciem/degradacją — dziś potwierdzona jako całkowicie nieobecna na wszystkich warstwach (akcja, serwis, RLS).
- [ ] Ochrona przed samodzielnym odebraniem sobie dostępu/degradacją własnej roli administracyjnej bez potwierdzenia.
- [ ] Ochrona przed eskalacją uprawnień (użytkownik przypisujący sobie lub innym rolę szerszą niż jego własne uprawnienia pozwalają) — do potwierdzenia dokładnego zakresu istniejących sprawdzeń.
- [ ] Trwały ślad audytowy zmian członkostwa/roli (kto/kiedy zmienił czyją rolę) dla ról administracyjnych.
- [ ] Natychmiastowe odwołanie dostępu po usunięciu członkostwa sprawdzone na żywo (nie tylko w kodzie) — czy trwająca sesja usuniętego użytkownika traci dostęp przy najbliższym żądaniu.
- [ ] Zachowanie przy współbieżnej zmianie roli tej samej osoby przez dwóch administratorów jednocześnie.
- [ ] Obsługa zduplikowanego zaproszenia (ten sam e-mail, dwa aktywne zaproszenia) sprawdzona na realnych danych.
- [ ] Odzyskiwanie po błędnym przypisaniu roli (jasna ścieżka korekty, nie tylko ręczna ingerencja w bazę).
- [ ] Testy integracyjne/RLS na żywej bazie dla scenariuszy administracji dostępem — dziś istniejące testy są w większości na zamockowanym kliencie; zależność od ogólnych ustaleń o realnych testach RLS ze Strefy 1, tu odnotowana jako wymaganie specyficzne dla tabel `user_role_assignments`/`organization_members`/`invitations`.
- [ ] Realistyczny test wielu pilotażowych ról jednocześnie (właściciel, pracownik magazynu, doradca/akceptant, ewentualny branch manager) na rzeczywistych kontach, nie tylko syntetycznych.
- [ ] **Dokładny scenariusz pilotażu Strefy 10 zweryfikowany ręcznie z reprezentatywnymi rolami/użytkownikami pilotażu**, w tym próba usunięcia/degradacji ostatniego właściciela jako świadomy test negatywny.

**Pilot gap:**

Główna dodatkowa praca pilotażowa to domknięcie jednej konkretnej, potwierdzonej luki bezpieczeństwa administracyjnego (ochrona ostatniego właściciela i samodzielnej degradacji) oraz rozszerzenie pokrycia testami z zamockowanego klienta na realną bazę dla tabel administracji dostępem. Reszta to pogłębienie audytu/współbieżności odpowiednie do skali pilotażu, nie nowy zakres funkcjonalny — fundament administracyjny jest już dziś zbudowany solidnie.

### Notes / evidence

- Backend runtime potwierdzony jako projekt „target" (`apps/web/.env.local` → `rjeraydumwechpjjzrus`); wszystkie cytowania DB pochodzą z `apps/web/supabase-target/supabase/migrations`, nie ze starszego, częściowo nieaktualnego drzewa `apps/web/supabase/migrations` — istotne rozróżnienie już wcześniej odnotowane w innych strefach (dryf/dwa drzewa migracji).
- Lista członków: `apps/web/src/app/[locale]/dashboard/organization/users/members/_components/members-client.tsx` + `apps/web/src/app/actions/organization/members.ts` (`listMembersAction` → `OrgMembersService.listMembers`) — realne dane, role/zakresy/oddziały widoczne per wiersz.
- Zaproszenia: `createInvitationAction`/`acceptInvitationAction`/`declineInvitationAction` (`apps/web/src/app/actions/organization/invitations.ts`) → RPC `accept_invitation_and_join_org`/`decline_invitation` (`apps/web/supabase-target/supabase/migrations/20260323000015_target_harden_p6_legacy_cleanup.sql:27-170`) — kopiuje przypisania ról z zaproszenia do `user_role_assignments` z rozróżnieniem zakresu org/oddział i jawnie wywołuje `compile_user_permissions` na końcu.
- Rejestracja bez zaproszenia: `createOrganizationAction` (`apps/web/src/app/actions/onboarding/index.ts:61-170`) → RPC `create_organization_for_current_user`, przypisanie wbudowanej roli `org_owner` (seed w `20260320000011_target_p3_b3_seed.sql:53-60`).
- Role: wbudowane `org_owner`/`org_member` (`is_basic=true`) plus role niestandardowe per organizacja (`is_basic=false`, `scope_type` org/oddział) z triggerem chroniącym niezmienność tych pól po utworzeniu — UI: `apps/web/src/app/[locale]/dashboard/organization/users/roles/_components/roles-client.tsx`, akcje: `apps/web/src/app/actions/organization/roles.ts` (`createRoleAction`/`updateRoleAction`, walidacja `validateBranchRolePermissions` blokująca uprawnienia tylko-organizacyjne na rolach oddziałowych).
- Zmiana roli bez wymuszonego ponownego logowania: `apps/web/src/server/loaders/v2/load-user-context.v2.ts:110-146` — JWT ma tylko kosmetyczne opóźnienie w wyświetlanej liście ról; faktyczna autoryzacja (RLS, `has_permission`/`has_branch_permission`, `PermissionServiceV2.getPermissionSnapshotForUser()`) czyta `user_effective_permissions` na świeżo przy każdym żądaniu SSR.
- Potwierdzony brak ochrony ostatniego właściciela/samodzielnej degradacji: `OrgMembersService.removeMember` (`organization.service.ts:293-338`) i akcje w `roles.ts` wykonują bezwarunkowe usunięcie/zmianę bez sprawdzenia liczby właścicieli ani tożsamości działającego użytkownika; brak odpowiadającej polityki RLS (`20260320000022_target_p1_b1_org_members_policies.sql:63-70` — polityka DELETE sprawdza tylko `members.manage`, nie liczbę właścicieli); pomocnicza funkcja `is_org_owner()` istnieje, ale jest używana wyłącznie do bramkowania panelu admina platformy, nie do ochrony przy usuwaniu/zmianie roli.
- Administracja dostępem oddziałowym („branch manager"): ten sam mechanizm `assignRoleToUserAction`/`removeRoleFromUserAction` z `scope: "branch"`, plus filtrowany widok dla branch managerów bez `MEMBERS_READ` (`roles.ts:58-62`, `:482-492`) — zgodne z modelem opisanym już w code memory tego projektu.
- Sprawdzenia uprawnień po stronie serwera są realne i testowane bezpośrednio na akcjach (z pominięciem UI): `actions-org-gaps.test.ts`, `roles.test.ts`, `branches.test.ts` — konkretne przypadki „returns unauthorized when missing ...".
- Zależność: Strefa 1 (ostateczne wymuszenie dostępu, RLS, izolacja oddziałowa/organizacyjna — nie duplikowana tutaj); przygotowane w tej strefie konta są używane jako dane wejściowe do demo P0 w Strefach 6-9.

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
