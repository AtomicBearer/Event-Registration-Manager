-- AC-STEM 9.0 Phase 3 — additive scanner presence data only.
-- No modification to official registration or check-in tables.
create table if not exists public.desk_scanner_presence (
  event_id uuid not null references public.desk_events(id) on delete cascade,
  client_id uuid not null,
  operator_id uuid not null references public.desk_operators(id),
  label text not null check (char_length(label) between 1 and 40),
  scanner_state text not null check (scanner_state in ('idle','scanning')),
  session_scans integer not null default 0 check (session_scans between 0 and 999999),
  last_seen_at timestamptz not null default now(),
  primary key(event_id,client_id)
);
create index if not exists desk_scanner_presence_event_time_idx
  on public.desk_scanner_presence(event_id,last_seen_at desc);
alter table public.desk_scanner_presence enable row level security;
revoke all on table public.desk_scanner_presence from public,anon,authenticated;
-- No public policies: only service-role Edge Functions read/write this table.
