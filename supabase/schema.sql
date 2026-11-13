-- Daybook database setup. Paste all of this into Supabase → SQL Editor → New query → Run.

create table if not exists public.items (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null,
  deleted boolean not null default false,
  server_updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists items_user_server_updated_idx on public.items (user_id, server_updated_at);

-- Let signed-in users reach the table through the API (needed when
-- "Automatically expose new tables" is turned off). Logged-out visitors get nothing.
revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

-- Row Level Security: each person can only ever see and change their own rows.
alter table public.items enable row level security;

drop policy if exists "items_select_own" on public.items;
drop policy if exists "items_insert_own" on public.items;
drop policy if exists "items_update_own" on public.items;
drop policy if exists "items_delete_own" on public.items;
create policy "items_select_own" on public.items for select to authenticated using ((select auth.uid()) = user_id);
create policy "items_insert_own" on public.items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "items_update_own" on public.items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "items_delete_own" on public.items for delete to authenticated using ((select auth.uid()) = user_id);

-- Last write wins: an older edit (by device timestamp) never overwrites a newer one.
create or replace function public.items_last_write_wins()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists items_last_write_wins on public.items;
create trigger items_last_write_wins
before insert or update on public.items
for each row execute function public.items_last_write_wins();

-- Live updates between your devices while both are open.
do $$
begin
  alter publication supabase_realtime add table public.items;
exception when duplicate_object then null;
end $$;
