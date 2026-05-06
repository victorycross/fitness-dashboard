-- Delegated access: lets a host grant read-only dashboard access to other users.

create table if not exists public.delegations (
  id               uuid primary key default gen_random_uuid(),
  host_user_id     uuid not null references auth.users(id) on delete cascade,
  delegate_email   text not null,
  delegate_user_id uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  unique (host_user_id, delegate_email)
);

alter table public.delegations enable row level security;

-- Host can fully manage their own delegation rows.
create policy "Host manages own delegations"
  on public.delegations for all
  to authenticated
  using  (host_user_id = auth.uid())
  with check (host_user_id = auth.uid());

-- Delegate can read rows where they are linked (by user_id).
create policy "Delegate views own delegation"
  on public.delegations for select
  to authenticated
  using (delegate_user_id = auth.uid());

-- ── Delegation-aware read policies on core tables ──────────────────────────

-- Helper: is the requesting user a delegate for a given host?
create or replace function public.is_delegate_for(host_id uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.delegations
    where host_user_id     = host_id
      and delegate_user_id = auth.uid()
  );
$$;

-- profiles: delegates can read the host's profile row.
create policy "Delegates can read host profile"
  on public.profiles for select
  to authenticated
  using (public.is_delegate_for(id));

-- workout_sessions
create policy "Delegates can read host sessions"
  on public.workout_sessions for select
  to authenticated
  using (public.is_delegate_for(user_id));

-- weight_log
create policy "Delegates can read host weight_log"
  on public.weight_log for select
  to authenticated
  using (public.is_delegate_for(user_id));

-- progress_photos
create policy "Delegates can read host progress_photos"
  on public.progress_photos for select
  to authenticated
  using (public.is_delegate_for(user_id));

-- food_log
create policy "Delegates can read host food_log"
  on public.food_log for select
  to authenticated
  using (public.is_delegate_for(user_id));

-- food_day_status
create policy "Delegates can read host food_day_status"
  on public.food_day_status for select
  to authenticated
  using (public.is_delegate_for(user_id));

-- ── Resolve delegate_user_id on sign-in ────────────────────────────────────
-- Called from the app after login to link the logged-in user's id to any
-- pending delegation rows that match their email.
create or replace function public.resolve_delegation()
returns void language sql security definer as $$
  update public.delegations
  set    delegate_user_id = auth.uid()
  where  delegate_email   = (select email from auth.users where id = auth.uid())
    and  delegate_user_id is null;
$$;
