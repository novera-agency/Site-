-- Table des carrières (code court → partie). À exécuter une fois dans Supabase : SQL Editor → New query → Run.
create table if not exists public.careers (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  data text not null check (length(data) < 3000000),
  updated_at timestamptz not null default now()
);
-- La table n'est pas lisible directement (aucune politique) : on n'y accède que par les deux fonctions ci-dessous,
-- donc il faut connaître le code pour lire une carrière ; il est impossible de lister les carrières des autres.
alter table public.careers enable row level security;
revoke all on table public.careers from anon, authenticated;

create or replace function public.career_put(p_code text, p_data text) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into careers (code, data, updated_at) values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function public.career_get(p_code text) returns text
language sql security definer set search_path = public stable as $$
  select data from careers where code = p_code
$$;

revoke all on function public.career_put(text, text), public.career_get(text) from public;
grant execute on function public.career_put(text, text), public.career_get(text) to anon, authenticated;
