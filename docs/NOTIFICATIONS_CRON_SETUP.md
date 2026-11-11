# Powiadomienia — włączenie e-maili, przypomnień i czyszczenia

> Kod i funkcje w bazie są wdrożone (migracje `20261011185523_notifications_email_queue_task_due` i `20261011191047_chat_unread_email_queue`), ale **nic nie działa samo**, dopóki nie wykonasz kroków poniżej. Dzięki temu żaden e-mail nie wyjdzie do pracowników przed Twoją decyzją (np. przed demo 15.10).
> Plan: `docs/NOTIFICATIONS_PLAN.md` (faza N3).

## Jak to działa

- **E-mail:** co 5 minut baza woła endpoint aplikacji `POST /api/cron/notification-emails`. Aplikacja pobiera powiadomienia, które są nadal nieprzeczytane po 10 minutach, i wysyła jedną wiadomość na osobę i organizację (Resend, ten sam nadawca co reset hasła).
- **Czat:** ten sam endpoint wysyła też e-mail o wiadomościach czatu nieprzeczytanych po 15 minutach — jedną wiadomość na osobę, i nic więcej, dopóki nie przeczyta. Wyciszone rozmowy są pomijane. Wyłącza się to w ustawieniach (zdarzenie „Nieprzeczytana wiadomość na czacie”).
- **Kto dostaje:** tylko osoby z włączonym kanałem e-mail i tylko typy zaznaczone w `/dashboard/account/notifications` (domyślnie: nowe zgłoszenie dla mnie, przypisanie do zgłoszenia, przypisanie zadania, wzmianka, nieprzeczytana wiadomość na czacie).
- **Cisza nocna:** powiadomienie czeka do końca ciszy i wychodzi rano. Po 36 godzinach nie jest już wysyłane.
- **Przypomnienia:** tuż po północy czasu polskiego wykonawca każdego otwartego zadania z terminem „dziś” dostaje powiadomienie „termin zadania mija dziś” (raz na zadanie i dzień).
- **Czyszczenie:** raz na dobę usuwane są przeczytane powiadomienia starsze niż 90 dni. Nieprzeczytane zostają.

## Krok 1 — sekret w Vercel

1. Wygeneruj losowy sekret (min. 32 znaki), np. `openssl rand -hex 32`.
2. W projekcie Vercel dodaj zmienną `CRON_SECRET` (Production) z tą wartością i zrób redeploy.
3. Sprawdź, że w Vercel są też `RESEND_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` i `NEXT_PUBLIC_SITE_URL` (adres produkcyjny — z niego budowane są linki w e-mailach).

Bez `CRON_SECRET` endpoint odpowiada 401 i nic nie wysyła.

## Krok 2 — SQL Editor (Supabase, projekt produkcyjny)

Wklej całość, podmieniając dwie wartości oznaczone `<<…>>`. Skrypt można uruchomić ponownie.

```sql
-- Rozszerzenia: harmonogram i wywołania HTTP z bazy
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Sekret i adres aplikacji w Vault (nie w treści zadań)
SELECT vault.create_secret('<<TEN SAM SEKRET CO CRON_SECRET W VERCEL>>', 'notifications_cron_secret')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notifications_cron_secret');
SELECT vault.create_secret('<<https://ADRES-PRODUKCYJNY-AMBRY>>', 'notifications_app_url')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'notifications_app_url');

-- Czyszczenie: przeczytane powiadomienia starsze niż 90 dni
CREATE OR REPLACE FUNCTION public.notifications_cleanup_run()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_count integer;
BEGIN
  DELETE FROM public.notifications n
  WHERE n.read_at IS NOT NULL AND n.created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.notifications_cleanup_run() FROM PUBLIC, anon, authenticated;

-- E-maile: co 5 minut
SELECT cron.schedule('notifications-emails', '*/5 * * * *', $job$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'notifications_app_url')
           || '/api/cron/notification-emails',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets
                                     WHERE name = 'notifications_cron_secret')),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000);
$job$);

-- Przypomnienia o terminach: pg_cron liczy w UTC, a północ w Polsce to 22:00 (lato)
-- albo 23:00 (zima) UTC. Funkcja sama działa tylko w pierwszej godzinie po północy.
SELECT cron.schedule('notifications-task-due', '5 22,23 * * *',
  $job$SELECT public.notifications_task_due_run();$job$);

-- Czyszczenie: codziennie o 01:30 UTC
SELECT cron.schedule('notifications-cleanup', '30 1 * * *',
  $job$SELECT public.notifications_cleanup_run();$job$);
```

## Krok 3 — sprawdzenie

```sql
-- Zadania i ich ostatnie uruchomienia
SELECT jobname, schedule, active FROM cron.job WHERE jobname LIKE 'notifications-%';
SELECT j.jobname, d.status, d.return_message, d.start_time
FROM cron.job_run_details d JOIN cron.job j USING (jobid)
WHERE j.jobname LIKE 'notifications-%' ORDER BY d.start_time DESC LIMIT 10;

-- Odpowiedzi endpointu (200 = działa, 401 = zły sekret)
SELECT status_code, content, created FROM net._http_response ORDER BY created DESC LIMIT 5;
```

Test na żywo: przypisz komuś zgłoszenie, nie otwieraj powiadomienia — po 10–15 minutach powinien przyjść e-mail.

## Wyłączenie

```sql
SELECT cron.unschedule('notifications-emails');
SELECT cron.unschedule('notifications-task-due');
SELECT cron.unschedule('notifications-cleanup');
```

Zmiana sekretu: nowa wartość w Vercel (`CRON_SECRET`) i w Vault (`SELECT vault.update_secret(id, '<<NOWY>>') FROM vault.secrets WHERE name = 'notifications_cron_secret';`).
