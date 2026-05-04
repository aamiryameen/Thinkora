-- user_backups: one row per authenticated user, storing their full app backup as JSONB.
-- On conflict (same user_id) we upsert — only ever one backup row per user.

create table if not exists public.user_backups (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data    jsonb  not null default '{}'::jsonb,
  backed_up_at timestamptz not null default now()
);

-- Only the owner can read/write their own backup.
alter table public.user_backups enable row level security;

create policy "owner_select" on public.user_backups
  for select using (auth.uid() = user_id);

create policy "owner_upsert" on public.user_backups
  for insert with check (auth.uid() = user_id);

create policy "owner_update" on public.user_backups
  for update using (auth.uid() = user_id);
