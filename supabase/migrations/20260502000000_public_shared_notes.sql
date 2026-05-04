-- Public shared notes — for the "share via link" feature.
-- Recipients can view the note in a browser without an account.
-- Owner can revoke (delete the row) at any time.

create table if not exists public.public_shared_notes (
  share_id    text primary key,             -- short random ID used in the URL
  user_id     uuid references auth.users(id) on delete cascade,
  title       text not null default '',
  content     text not null default '',     -- plain text (HTML stripped on the client)
  view_count  int  not null default 0,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz
);

-- Owners write & manage their own shares; anonymous users read via the
-- Edge Function (which uses service-role key), so we only enable RLS for
-- the owner's mutating ops.
alter table public.public_shared_notes enable row level security;

-- Owner can create their own share rows
create policy "owner_insert" on public.public_shared_notes
  for insert with check (auth.uid() = user_id);

-- Owner can delete their own share rows (revoke link)
create policy "owner_delete" on public.public_shared_notes
  for delete using (auth.uid() = user_id);

-- Owner can list their own shares
create policy "owner_select" on public.public_shared_notes
  for select using (auth.uid() = user_id);

-- Atomic view-count increment (called from the public viewer Edge Function)
create or replace function public.increment_share_view(p_share_id text)
returns void language sql security definer as $$
  update public.public_shared_notes
  set view_count = view_count + 1
  where share_id = p_share_id;
$$;
