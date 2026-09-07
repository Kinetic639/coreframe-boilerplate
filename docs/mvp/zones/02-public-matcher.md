### 2. Publiczny SVWMS Matcher

**Priorytet:** P0

**Stan obecny:** 🟡 PARTIAL

Wbrew wcześniejszej notatce w tym dokumencie („implementacji poza web nie audytowano"), publiczny Matcher **istnieje w tym repozytorium** — nie w `apps/web`, tylko w `apps/public-web` (witryna marketingowa, na którą `apps/web` przekierowuje `/tools/svwms-wdd-matcher`). To realna, w pełni zaimplementowana ścieżka: bez logowania, bez zapisu do bazy, z prawdziwym parserem PDF i algorytmem dopasowania — nie atrapa i nie zewnętrzna czarna skrzynka poza zasięgiem repo. Mimo to status nie może przekroczyć PARTIAL: zero testów automatycznych faktycznie wykonuje ten pipeline, a żadna świeża próba ręczna na aktualnym build nie została odnotowana.

**Dowody:**

- Kod: VERIFIED — prześledzono cały pipeline: upload (`upload-zone.tsx`) → akcja serwerowa `runPublicWddMatcherAction` (`apps/public-web/src/app/actions/tools/wdd-matcher-public.ts:274-334`) → parser (`parser_v4.ts`, realna ekstrakcja PDF przez `pdfjs-dist`, nie stub) → dopasowanie (`matcher.ts`, `runWddEnrichment`) → wynik (`public-wdd-matcher.tsx`) → eksport JSON/PDF. Potwierdzono brak logowania (żaden gate autoryzacji na trasie `(public)/tools/svwms-wdd-matcher/page.tsx`) i brak zapisu sesji (żadne wywołanie Supabase/localStorage/cookie w całej ścieżce publicznej; syntetyczne rekordy sesji istnieją wyłącznie w pamięci na czas jednego wywołania akcji serwerowej). Silnik parsera i matchera (`parser_v4.ts`, `matcher.ts`) jest bajt-w-bajt identyczny z wersją używaną przez zalogowany Matcher w `apps/web` — to ten sam kod, zduplikowany, aktualnie zsynchronizowany, ale bez żadnego mechanizmu wymuszającego tę synchronizację w przyszłości.
- Testy automatyczne: NONE — jedyny test dotykający tego obszaru (`apps/public-web/src/components/tools/svwms-wdd-matcher/__tests__/movement-import-boundary.test.ts`) sprawdza tylko, że komponenty wyników nie zawierają stringów związanych z importem do ruchów magazynowych, oraz kształt osobnego adaptera importu — nie wykonuje żadnego realnego uploadu/parsowania/dopasowania. Zero testów jednostkowych `parser_v4.ts`/`matcher.ts` w `apps/public-web`, zero testów komponentów `upload-zone.tsx`/`public-wdd-matcher.tsx`.
- Weryfikacja ręczna: NOT VERIFIED — informacja skryptu „korzystamy z tego narzędzia od kwietnia" to deklaracja biznesowa właściciela projektu, nietestowalna przez repozytorium; przyjęta jako kontekst, ale nie zastępuje świeżej próby na aktualnym build. Nie odnaleziono żadnej odnotowanej próby ręcznej tej konkretnej trasy w dokumentacji repo.
- Przebieg end-to-end: NOT VERIFIED — nie odtworzono na żywo otwarcia właściwego publicznego adresu, uploadu przygotowanych dokumentów demo i porównania wyniku z dokumentami fizycznymi.

**Wymagany stan dla pitchu:** DEMO READY

### Pitch readiness checklist

- [ ] Potwierdzono na żywo, że właściwy publiczny adres (`https://www.ambra-system.com/tools/svwms-wdd-matcher`, warianty PL `/narzedzia/svwms-wdd-matcher` i EN) ładuje się i nie wymaga logowania — na docelowym urządzeniu i sieci prezentacji, nie tylko wywnioskowane z konfiguracji przekierowań.
- [ ] Przygotowano dokładny zestaw dokumentów demonstracyjnych (dostawa BC + dokumenty magazynów marek) w wersji fizycznej i cyfrowej, zanonimizowany jeśli pochodzi z realnej dostawy.
- [ ] Wgrano te same przygotowane dokumenty do docelowego publicznego narzędzia i potwierdzono udany upload oraz parsowanie bez błędów na aktualnym build.
- [ ] Dopasowanie zwraca oczekiwany, znany wcześniej wynik — liczba dopasowań dokładnych/częściowych/niejednoznacznych/niedopasowanych zgadza się z fizycznymi dokumentami.
- [ ] Jeśli przygotowany zestaw zawiera pozycje niedopasowane lub niejednoznaczne, prezenter wie to z wyprzedzeniem i potwierdzono, że interfejs wyraźnie je pokazuje, a nie ukrywa (`unmatched_bc`/`unmatched_brand`/`ambiguous` w `matcher.ts` są rozróżniane w UI).
- [ ] Potwierdzono wizualnie na żywo (np. w świeżej/incognito karcie), że narzędzie nie pokazuje żadnych śladów wcześniejszej zalogowanej sesji Ambry — zgodnie z architekturą (brak zapisu do bazy), ale niepotwierdzone dotąd na żywo.
- [ ] Potwierdzono, że żadne wrażliwe dane firmowe (nazwiska klientów, VINy, ceny) nie pojawiają się w przygotowanych dokumentach, jeśli pochodzą z realnej kwietniowej dostawy.
- [ ] Sprawdzono czas przetwarzania (parsowanie PDF odbywa się po stronie serwera przy każdym wywołaniu, bez cache) na docelowym urządzeniu/sieci — nie powoduje nieoczekiwanie długiej przerwy w trakcie prezentacji.
- [ ] Przygotowano zapasowy wynik/nagranie z jasno opisanym pochodzeniem na wypadek awarii sieci lub usługi w trakcie prezentacji.
- [ ] Ustalono, co powiedzieć w razie nieoczekiwanego błędu na dokładnie tych przygotowanych dokumentach na żywo — biorąc pod uwagę brak jakiegokolwiek automatycznego testu tego pipeline'u, pierwsza próba „na scenie" niesie realne, nie tylko teoretyczne ryzyko.
- [ ] **Dokładny scenariusz pitchu Strefy 2 zweryfikowany ręcznie na aktualnym build/wdrożeniu:** otwarcie publicznego adresu bez logowania → upload przygotowanych dokumentów → udane dopasowanie → wynik zgodny z dokumentami fizycznymi.

**Pitch gap:**

Implementacja jest realna i sprawdzona w kodzie — kompletny pipeline (upload → parsowanie PDF → dopasowanie → wynik → eksport), potwierdzony brak logowania i brak zapisu sesji, zgodnie z obietnicą skryptu. Główne braki to nie luki implementacyjne, tylko brak dowodu na aktualnym build: zero testów automatycznych faktycznie wykonujących ten pipeline (jedyny test sprawdza tylko granicę tekstową między komponentami), brak jakiejkolwiek odnotowanej świeżej próby ręcznej tej trasy, oraz niemożliwe do zweryfikowania z repozytorium, czy trasa jest dziś faktycznie wdrożona i odpowiada pod publicznym adresem (brak dostępu do sieci w tej analizie). Dodatkowo brak jakiegokolwiek rate-limitingu/ograniczenia liczby lub rozmiaru plików w kodzie tej trasy (tylko globalny limit body 10 MB) — niekrytyczne dla jednorazowego pokazu, ale warte odnotowania.

**Wymagany stan dla pilotażu:** minimalny ponad pitch — patrz uzasadnienie niżej

### Pilot readiness checklist

Publiczny Matcher **nie jest** planowaną ścieżką danych pilotażu — pilotaż przechodzi przez zalogowany Matcher z trwałą sesją (Strefa 3), objęty modelem organizacji/oddziału/RLS. Publiczne narzędzie z założenia architektonicznego pozostaje poza tym obwodem (bez logowania, bez zapisu, bez `org_id`/`branch_id` — placeholder `"public"` w rekordach). Dlatego lista wymagań pilotażowych dla tej strefy jest celowo krótka:

- [ ] Potwierdzono z właścicielem projektu, czy publiczne narzędzie ma nadal działać jako niezależny, używany od kwietnia tool równolegle do pilotażu, czy ma pełnić rolę wejścia do przepływu pilotażowego — to rozstrzyga, czy poniższy punkt w ogóle dotyczy tej strefy.
- [ ] Jeśli pozostaje niezależnym narzędziem: brak dodatkowego hardeningu ponad pitch — nie wymaga izolacji organizacyjnej/oddziałowej ani testów RLS, ponieważ z definicji nie przechowuje ani nie ujawnia danych żadnej organizacji.
- [ ] Jeśli w praktyce staje się nieformalnym punktem wejścia do pilotażu (pracownicy używają go zamiast zalogowanej wersji z przyzwyczajenia), ustalono jasną instrukcję, kiedy i jak wynik trzeba świadomie przenieść do zalogowanej Ambry — żeby dane z publicznego narzędzia nie „gubiły się" zamiast trafiać do procesu pilotażu.
- [ ] **Dokładny scenariusz pilotażu Strefy 2 zweryfikowany z reprezentatywnymi użytkownikami** — dotyczy wyłącznie, jeśli powyższy punkt ustali, że narzędzie pozostaje częścią przepływu pilotażu; w przeciwnym razie ten punkt jest nie dotyczy (N/A), nie otwartym blokerem.

**Pilot gap:**

Brak istotnej luki ponad pitch, o ile narzędzie pozostaje tym, czym jest dziś — niezależnym, przedpilotażowym tooli poza obwodem organizacji/oddziału/RLS. Jedyne realne ryzyko to niejednoznaczność roli: jeśli podczas pilotażu pracownicy nieformalnie dalej używają publicznej wersji zamiast zalogowanej (bo jest prostsza), dane z realnych dostaw pilotażu mogą nie trafiać do trwałego procesu, którego dotyczy Strefa 3. To wymaga ustalenia komunikacyjnego/proceduralnego, nie zmiany kodu.

### Notes / evidence

- Trasa istnieje w `apps/public-web` (nie `apps/web`): `apps/public-web/src/app/[locale]/(public)/tools/svwms-wdd-matcher/page.tsx`, komponent wejściowy `apps/public-web/src/components/tools/svwms-wdd-matcher/public-wdd-matcher.tsx`. `apps/web/next.config.ts:80-87` przekierowuje `/tools/svwms-wdd-matcher` (i warianty PL/EN) do `publicSiteUrl`, co potwierdza zamierzone umiejscowienie na witrynie marketingowej.
- Brak logowania potwierdzony: brak gate'u auth w `(public)/layout.tsx` (tylko odczyt ustawień strony przez klienta service-role, nieorganizacyjny), brak `middleware.ts` w `apps/public-web/src`, brak wywołań auth w `wdd-matcher-public.ts`.
- Brak zapisu sesji potwierdzony: zero wywołań Supabase/localStorage/sessionStorage/cookie w całej ścieżce publicznej; syntetyczny identyfikator sesji `public-${Date.now()}` istnieje tylko w pamięci na czas jednego żądania (`wdd-matcher-public.ts:274-334`). Potwierdza to też własna kopia PL aplikacji: „Nie wymaga logowania i nie zapisuje danych w bazie" (`apps/public-web/messages/pl.json:3844-3848`).
- Parser i matcher (`parser_v4.ts`, `matcher.ts`) są bajt-w-bajt identyczne (te same sumy MD5) z wersją używaną przez zalogowany Matcher w `apps/web/src/lib/tools/svwms-wdd-matcher/` — to zduplikowany, nie współdzielony przez pakiet kod; obecnie zsynchronizowany, ale bez wymuszenia tej synchronizacji.
- Niedopasowania są pierwszorzędnym stanem, nie efektem ubocznym: `unmatched_bc`, `unmatched_brand`, `ambiguous` w `matcher.ts` (np. linie 194-228, 303-365, 386-400), pokazywane w UI jako osobne liczniki (`public-wdd-matcher.tsx:49-56,170-180`).
- Plik `apps/public-web/src/server/services/movement-import-adapters/svwms-wdd-matcher.adapter.ts` **nie** należy do publicznej ścieżki — to część osobnego, w pełni zalogowanego mini-modułu magazynowego wewnątrz `apps/public-web` (`requireWarehouseContext()` w `.../warehouse/inventory/action-context.ts:11-24`), niepowiązanego z publicznym narzędziem; test graniczny (`movement-import-boundary.test.ts`) istnieje właśnie po to, żeby ten rozdział wymusić.
- Brak ochrony przed nadużyciem w kodzie tej trasy: brak rate-limitingu, brak limitu liczby/rozmiaru pojedynczego pliku poza globalnym `experimental.serverActions.bodySizeLimit: "10mb"` (`apps/public-web/next.config.ts:88`) — potencjalnie akceptowalne dla jednorazowego, kontrolowanego pokazu, ale warte świadomej decyzji, nie przeoczenia.
- Deklaracja skryptu „korzystamy z tego narzędzia już od kwietnia" jest twierdzeniem biznesowym właściciela projektu — repozytorium nie może i nie musi tego dowodzić; zapisane jako kontekst, nie jako dowód gotowości aktualnego build.

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
