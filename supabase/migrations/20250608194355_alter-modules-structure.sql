-- Dodaj pole settings do tabeli modules
alter table public.modules
add column settings jsonb default '{}'::jsonb;

-- Zmień nazwę kolumny settings na setting_overrides w tabeli user_modules
alter table public.user_modules
rename column settings to setting_overrides;
