### 15. Materiały, dostawcy, audyty i wsparcie zamawiania

**Priorytet:** P3

**Stan obecny:** 🟡 PARTIAL

Audyty/liczenie stanu magazynowego to zaskakująco mocny, w pełni zamknięty przepływ: sesja liczenia → skan QR/ręczne liczenie → obliczone różnice → przegląd i zatwierdzenie → **realne zaksięgowanie korekt jako ruchów 401/402 tym samym silnikiem księgowania co reszta magazynu** (Strefa 8) → raport końcowy z prawdziwą historią i sugestiami uzupełnienia. To zamyka pętlę „audyt → różnica → korekta stanu", nie tylko rejestruje różnicę. Dostawcy i zamawianie są natomiast rozproszone na trzy nakładające się, niedomknięte warstwy: placeholder strony „Dostawcy"/„Zakupy"/„Zamówienia zakupu", realne powiązanie dostawcy z pozycją katalogu przez encję CRM (osadzone na stronie edycji produktu, nie osobny ekran dostawców), oraz osobny, w pełni zbudowany na poziomie bazy/serwisu/RPC system zamówień zakupu (`inventory_purchase_orders`), który nie ma dziś żadnego wywołania z UI — istnieje, ale jest nieosiągalny dla użytkownika. Sugestie uzupełnienia stanu są realne i liczone na żywo z aktualnego stanu, ale akceptacja sugestii to wyłącznie zapis decyzji, nie tworzenie zamówienia. Materiały/artykuły eksploatacyjne nie są osobną domeną — to zwykły katalogowy produkt z flagą `consumable`.

**Dowody:**

- Kod: VERIFIED. Prześledzono pełny przepływ audytu (kreator zakresu → prowadzone liczenie z realnym skanem QR, znany już ze Strefy 6 — `count-scan-trigger.tsx` — → przegląd wariancji z zatwierdzeniem pojedynczym/masowym → raport końcowy z prawdziwą historią i osadzonym panelem sugestii uzupełnienia), funkcję zatwierdzania sesji `inventory_approve_count_session` (blokuje zatwierdzenie, jeśli jakakolwiek linia jest nierozstrzygnięta, następnie realnie tworzy i księguje ruchy 401/402 przez ten sam silnik `inventory_create_draft`/`inventory_finalize_posting` co reszta magazynu), oraz wyzwalacz bazy blokujący ponowne otwarcie zatwierdzonej sesji. Potwierdzono trzy nakładające się, niedomknięte warstwy dostawców: (1) placeholder stron `/warehouse/suppliers`, `/warehouse/purchases`, `/warehouse/purchase-orders`; (2) realne powiązanie dostawcy CRM z pozycją katalogu, osadzone w edycji produktu, nie jako osobny ekran; (3) w pełni zbudowany, ale bez żadnego wywołania z UI system `inventory_purchase_orders`/`inventory_suppliers` (akcje serwerowe istnieją i są uprawnieniowo bramkowane, ale nie mają żadnego wywołującego komponentu). Sugestie uzupełnienia: realny, liczony na żywo panel (`reorder-suggestions-panel.tsx`, porównanie stanu z `reorder_point`/`min_quantity`), z akceptacją/odrzuceniem zapisywanym jako pojedynczy wiersz decyzji — bez tworzenia jakiegokolwiek dokumentu zamówienia.
- Testy automatyczne: PARTIAL, skoncentrowane na audytach. Solidne testy dla sesji liczenia (zatwierdzanie, przejścia statusu, blokada ponownego otwarcia, raport uzupełnienia), migracji audytu (blokada częściowego księgowania, bramkowanie uprawnień, RLS) oraz czystej matematyki uzupełnienia. Testy dla powiązania dostawcy CRM z pozycją katalogu istnieją. Zero testów dla `inventory_purchase_orders`/`inventory_suppliers` — spójne z ich brakiem wywołania z UI.
- Weryfikacja ręczna: NOT APPLICABLE dla celów pitchu — ta strefa pozostaje ROADMAP ONLY, nie wymaga próby na żywo.
- Przebieg end-to-end: VERIFIED wyłącznie na podstawie kodu dla ścieżki audytu (nie odtworzone ręcznie w tej analizie); NOT APPLICABLE dla dostawców/zamawiania, bo nie ma spójnej ścieżki do przetestowania.

**Wymagany stan dla pitchu:** ROADMAP ONLY

### Pitch readiness checklist

- [ ] Wypowiedź może uczciwie wymienić audyty/liczenie stanu jako istniejącą, działającą funkcję (z realnym skanem QR i realnym księgowaniem różnic) — to nie jest nadinterpretacja.
- [ ] Wypowiedź nie sugeruje, że dostawcy mają dziś gotowy, spójny ekran zarządzania — to trzy rozłączone warstwy, nie jedna funkcja.
- [ ] Wypowiedź nie nazywa sugestii uzupełnienia stanu „zamówieniem" — to wyłącznie rekomendacja z decyzją akceptuj/odrzuć, bez tworzenia dokumentu.
- [ ] Wypowiedź nie sugeruje cyklicznych/automatycznych audytów — audyty są dziś wyłącznie ręcznie inicjowane (zależność od Strefy 14, gdzie potwierdzono brak jakiegokolwiek schedulera w całej aplikacji).
- [ ] Podczas pitchu nie nawiguje się do znanych stron placeholder (`/warehouse/suppliers`, `/warehouse/purchases`, `/warehouse/purchase-orders`).

Brama końcowa nie jest wymagana — ta strefa pozostaje słowną wzmianką/roadmapą, bez demonstracji na żywo.

**Pitch gap:**

Brak luki blokującej pitch — strefa jest z założenia roadmapą. Jedyne ryzyko to przypadkowe przecenienie: audyty są na tyle realne i dopracowane, że łatwo przez pomyłkę powiedzieć o nich więcej, niż faktycznie robią (np. sugerować cykliczność), albo pomylić trzy rozłączone warstwy dostawców z jedną gotową funkcją.

**Wymagany stan dla pilotażu:** deferred, chyba że Strefa 12 jawnie włączy audyty do zakresu pilotażu

### Pilot readiness checklist

Poniższe dotyczy wyłącznie, jeśli pilotaż uzna audyty/liczenie stanu za operacyjnie przydatne (dostawcy/zamawianie pozostają poza zakresem pilotażu, bo nie tworzą dziś spójnej ścieżki do domknięcia w rozsądnym czasie).

- [ ] Jeśli audyty wejdą do zakresu: współbieżność liczenia (dwóch pracowników liczących tę samą lokalizację) sprawdzona na żywo.
- [ ] Jeśli audyty wejdą do zakresu: niezawodność liczenia na telefonie (skan QR, wprowadzanie ilości) w realnych warunkach magazynowych.
- [ ] Jeśli audyty wejdą do zakresu: ścieżka korekty błędnie zatwierdzonej linii bez naruszania blokady ponownego otwarcia sesji.
- [ ] Izolacja oddziałowa/organizacyjna sesji audytu — zależność od ogólnych ustaleń RLS ze Strefy 1, tu odnotowana jako wymaganie specyficzne dla `inventory_count_sessions`.
- [ ] **Dokładny zakres audytów w pilotażu ustalony i zweryfikowany**, wyłącznie jeśli Strefa 12 włączy je do zakresu.

**Pilot gap:**

Nie dotyczy, dopóki Strefa 12 nie zdecyduje, że audyty są częścią zakresu pilotażu. Jeśli tak, wymagana jest głównie weryfikacja współbieżności i niezawodności mobilnego liczenia na realnych danych — sam mechanizm księgowania różnic już działa i jest przetestowany.

### Notes / evidence

- Materiały/artykuły eksploatacyjne: brak osobnej domeny — `inventory_products.product_type` ma wartość `'consumable'` wśród sześciu dopuszczalnych typów, to zwykły produkt katalogowy z flagą, nie osobny model.
- Audyt: pełne drzewo stron (`audits/new` kreator zakresu lokalizacja/dostawca, `audits/[id]/count` prowadzone liczenie ze skanem QR, `audits/[id]/review` przegląd wariancji, `audits/[id]/report` raport końcowy) i serwis `InventoryCountSessionsService` (784 linii) z przepływem statusu `draft → counting → submitted → approved`, wymuszonym wyłącznie do przodu.
- Księgowanie różnic: `inventory_approve_count_session` (`apps/web/supabase-target/supabase/migrations/20260710131915_fix_audit_movement_and_zero_stock.sql:290-420`) blokuje zatwierdzenie przy jakiejkolwiek nierozstrzygniętej linii, następnie tworzy i księguje ruchy 401 (nadwyżka)/402 (niedobór) przez `inventory_create_draft`/`inventory_finalize_posting` — ten sam silnik, którego istnienie i semantykę potwierdzono w Strefie 8.
- Blokada ponownego otwarcia: wyzwalacz `inventory_count_sessions_guard_status_trigger` (`20260718092756_harden_inventory_audit_status_and_supplier_scope.sql:204-207`), potwierdzony testem „rejects reopening an approved session".
- Dostawcy — trzy rozłączone warstwy: (1) placeholder `/warehouse/suppliers`, `/warehouse/purchases`, `/warehouse/purchase-orders` (`WarehousePlaceholderPage`); (2) `warehouse_item_suppliers` łączący `inventory_products` z encją CRM `crm_parties`, realnie osadzony w panelu edycji produktu (`crm-item-suppliers-panel.tsx`), nie jako osobny ekran listy dostawców; (3) `inventory_suppliers`/`inventory_purchase_orders` — pełny schemat, serwis (`InventoryEnterpriseService.createSupplier/createPurchaseOrder/receivePurchaseOrder`) i uprawnieniowo bramkowane akcje serwerowe, ale zero wywołań z jakiegokolwiek komponentu UI w całym repozytorium.
- Minimum/cel/punkt zamówienia: realne kolumny `min_quantity`/`reorder_point`/`reorder_quantity` w `inventory_reorder_rules`, faktycznie odczytywane przez czystą funkcję `calculateSuggestedOrderQuantity` (`reorder-math.ts`) i raport uzupełnienia (`InventoryCountSessionsService.getReorderReport`) liczony na żywo z bieżącego stanu — nie tylko przechowywane, nieużywane liczby.
- Sugestie uzupełnienia: realny panel (`reorder-suggestions-panel.tsx`), akceptacja/odrzucenie zapisuje wyłącznie wiersz decyzji w `inventory_reorder_suggestion_actions` — potwierdzone komentarzem w migracji, że to jedyny efekt akceptacji; żaden dokument zamówienia nie powstaje.
- Zależność od Strefy 14: audyty są dziś wyłącznie ręcznie inicjowane; brak jakiegokolwiek schedulera/cyklicznego wyzwalacza w całej aplikacji (potwierdzone tam) oznacza, że „cykliczny audyt" pozostaje czystą roadmapą, niezależnie od tego, jak dopracowany jest pojedynczy, ręczny audyt.

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
