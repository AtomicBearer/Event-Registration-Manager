-- PHASE 4 BACKEND REFERENCE ONLY.
-- Already applied to project mrwrqcezfvhclymceyut on 19 Nov 2026.
-- Do not execute again against the same connected production project.
create table if not exists public.desk_event_branding (
 event_id uuid primary key references public.desk_events(id) on delete cascade,
 accent_color text not null default '#23885d' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
 secondary_color text not null default '#172b22' check (secondary_color ~ '^#[0-9a-fA-F]{6}$'),
 tagline text not null default '' check (length(tagline) <= 120),
 updated_at timestamptz not null default now()
);
alter table public.desk_event_branding enable row level security;
revoke all on table public.desk_event_branding from public, anon, authenticated;
-- Only the existing staff-authenticated, service-role backed Edge Function
-- can read or write event branding through role-authorized actions.
