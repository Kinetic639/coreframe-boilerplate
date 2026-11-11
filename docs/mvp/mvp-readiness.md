# Ambra — gotowość do prezentacji i pilotażu

> **Stan na 15.10.2026 (dzień prezentacji).** To jest jedyny bieżący dokument statusu. Wcześniejsze audyty, przeglądy i plany wdrożeń stref (wrzesień) zostały usunięte 14–15.10 — są w historii gita (np. `git show ddc19a82:docs/mvp/reviews/…`).
>
> - Scenariusz prezentacji: [`ambra-skrypt-prezentacji.md`](ambra-skrypt-prezentacji.md)
> - Środowisko demo, konta, dane i lista kontrolna na dzień prezentacji: [`presentation-demo-setup.md`](presentation-demo-setup.md)
> - Pilotaż i kierunki rozwoju: [`planning/controlled-pilot.md`](planning/controlled-pilot.md), [`planning/product-roadmap.md`](planning/product-roadmap.md)
> - Tło biznesowe (analiza pracy działu części, sierpień): [`mvp-readiness-plan.md`](mvp-readiness-plan.md)
> - Dokumenty stref w [`zones/`](zones/) opisują decyzje produktowe i historię prac. **Nagłówki „Stan obecny” w tych plikach są z września i nie są aktualne** — aktualny status jest tylko tutaj.

## Werdykt

**Ścieżka ze skryptu jest zaimplementowana w całości.** Wszystkie wrześniowe blokery prezentacji są zamknięte w kodzie. Pełnej próby całego scenariusza od początku do końca nie odnotowano w dokumentach — zostaje próba na żywo i trzymanie się kilku zasad na scenie (niżej).

## Ścieżka prezentacji (skrypt) — stan

| Skrypt | Obszar                                             | Stan (kod gotowy; „próba” = do potwierdzenia na żywo)                                        |
| ------ | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| §3     | Matcher publiczny                                  | Gotowe                                                                                       |
| §6     | Matcher po zalogowaniu → zatwierdzenie do zlecenia | Gotowe; zlecenia w CNP Poznań z 14.10 pochodzą z prób — potwierdzić w próbie                 |
| §7     | Przyjęcie PZ, mobilne rozkładanie, raport          | Gotowe, próba (strefa przyjęć `PRZ`, „Do rozlokowania” na telefonie, raport z CSV)           |
| §9     | Zmiana lokalizacji, przeniesienie kontenera skanem | Gotowe, próba (QR lokalizacji i kontenerów)                                                  |
| §10    | Wyszukanie i wydanie na zlecenie                   | Gotowe, próba — wydanie to **RW (261)**, odpowiednik WU z AutoStacji; załączniki do zlecenia |
| §12    | Tickety, zakładka „Powiązania” na zleceniu         | Gotowe; ticket łączy się ze zleceniem przez numer zlecenia i wzmianki `@`                    |
| §14    | Powiadomienia i wiadomości (opcjonalnie)           | Gotowe i sprawdzone na dwóch kontach; e-maile z powiadomień przygotowane, ale wyłączone      |

Poza skryptem, ale gotowe do pokazania na pytanie: wyszukiwarka Ctrl+K, wiadomości między pracownikami (1:1 i grupy z zaproszeniami), wzmianki `@` osób i obiektów, portal Ambra Zapytania, strona zlecenia w zakładkach.

## Znane problemy i obejścia na dzień prezentacji

| Problem                                                                                                                | Obejście                                                                        |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| **Przełączanie oddziału z dowolnej strony poza Pulpitem się zawiesza** (BLOCKER-Z1-019): adres się zmienia, strona nie | Oddział przełączać **zawsze z Pulpitu** (`/dashboard/start`)                    |
| **Po zalogowaniu czasem zostaje formularz logowania**, choć adres to już `/dashboard/start`                            | Odświeżyć stronę (F5). Prawdopodobnie ta sama przyczyna co wyżej                |
| **Dane każdego oddziału są osobne** — w złym oddziale listy wyglądają na puste                                         | Wszystkie dane demo są w **CNP Poznań**; sprawdzić oddział przed każdym krokiem |
| Rejestracja i zakładanie organizacji mają znane błędy (5 opisanych w `presentation-demo-setup.md`)                     | Nie pokazywać; rejestracja wyłączona                                            |

## Po prezentacji

- Naprawić przełączanie oddziału z dowolnej strony i błąd po zalogowaniu (wspólna przyczyna: nawigacja w trakcie przejścia się nie kończy).
- Włączyć e-maile, przypomnienia i czyszczenie powiadomień: `docs/NOTIFICATIONS_CRON_SETUP.md`.
- Vercel: wdrożenia tylko z `main` są ustawione w `vercel.json`; w każdym projekcie włączyć „Skip deployments for unaffected projects”.
- Otwarte rzeczy z modułów: `docs/MESSAGES_PLAN.md`, `docs/NOTIFICATIONS_PLAN.md` (odpowiedź na wiadomość, czat na telefonie, Ctrl+K dla rozmów, wzmianki w pozostałych polach, powiadomienie o towarze do rozłożenia).
- Wzmocnienia pod pilotaż (z września, nadal aktualne): ochrona ostatniego właściciela organizacji, pełna macierz eskalacji uprawnień, synchronizacja z AutoStacją, idempotencja i współbieżność przyjęć, uporządkowanie historii migracji.
