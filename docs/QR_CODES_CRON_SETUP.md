# Kody QR — włączenie automatycznego wygasania

> Funkcja w bazie jest wdrożona migracją `20261121140000_qr_codes_registry`, ale **nic nie dzieje się samo**, dopóki nie zaplanujesz jej w pg_cron (krok poniżej).
> Plan: `docs/QR_LABELS_PLAN.md` (faza Q1).

## Jak to działa

- **Wygasanie:** raz na dobę `public.qr_expire_unused_codes()` oznacza jako `expired` kody, które **nigdy nie były przypisane i nigdy nie zostały zeskanowane**, a są starsze niż limit organizacji (`qr_settings.unused_expiry_days`, domyślnie 180 dni, 0 = wyłączone). Licznik startuje od utworzenia kodu albo od jego przywrócenia. Kody istniejące przed wdrożeniem liczą od dnia migracji (wcześniej skany nie były zapisywane), więc nic nie wygaśnie od razu po wdrożeniu.
- **Usuwanie:** kody wygasłe od 90 dni i nieprzywrócone są ukrywane (`deleted_at`). Wiersz zostaje w bazie dla historii.
- **Kody przypisane nigdy nie wygasają.**
- **Skan wygasłego kodu** pokazuje ekran „Kod QR wygasł”. Kod można przywrócić w Organizacja → Kody QR (filtr „Wygasłe” → „Przywróć”).
- Limit dni ustawia się w Organizacja → Kody QR → ikona ustawień (uprawnienie `qr.revoke`).

## Krok 1 — pg_cron

W Supabase: Database → Extensions → włącz `pg_cron` (jeśli nie jest włączony), a potem w SQL Editor:

```sql
select cron.schedule(
  'qr-expire-unused-codes',
  '15 2 * * *',              -- codziennie 02:15 UTC
  $$ select public.qr_expire_unused_codes(); $$
);
```

Funkcja jest czysto SQL-owa: nie woła aplikacji, nie potrzebuje sekretów.

## Sprawdzenie

```sql
-- ręczne uruchomienie (zwraca {"expired": n, "deleted": m})
select public.qr_expire_unused_codes();

-- ostatnie przebiegi
select status, return_message, start_time
from cron.job_run_details
where jobid = (select jobid from cron.job where jobname = 'qr-expire-unused-codes')
order by start_time desc
limit 5;
```

## Wyłączenie

```sql
select cron.unschedule('qr-expire-unused-codes');
```
