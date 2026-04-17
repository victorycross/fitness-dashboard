-- Per-user per-day "finished for the day" flag.
-- One row = the user has closed out food logging for that date.

create table if not exists food_day_status (
  user_id      uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date         date not null default current_date,
  finalized_at timestamptz not null default now(),
  primary key (user_id, date)
);

alter table food_day_status enable row level security;

create policy "Users can view own food_day_status"
  on food_day_status for select
  using (auth.uid() = user_id);

create policy "Users can insert own food_day_status"
  on food_day_status for insert
  with check (auth.uid() = user_id);

create policy "Users can update own food_day_status"
  on food_day_status for update
  using (auth.uid() = user_id);

create policy "Users can delete own food_day_status"
  on food_day_status for delete
  using (auth.uid() = user_id);
