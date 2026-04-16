-- Food log table for the food tracker
-- Follows the same RLS pattern as workout_sessions and weight_log

create table if not exists food_log (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade not null default auth.uid(),
  date        date not null default current_date,
  meal        text check (meal in ('breakfast', 'lunch', 'dinner', 'snack')) default 'snack',
  name        text not null,
  quantity    numeric(6,2) not null default 1,
  unit        text not null default 'serving',
  calories    integer not null default 0,
  protein_g   numeric(6,1) not null default 0,
  carbs_g     numeric(6,1) not null default 0,
  fat_g       numeric(6,1) not null default 0,
  fibre_g     numeric(6,1) default 0,
  notes       text,
  created_at  timestamptz not null default now()
);

-- Enable RLS
alter table food_log enable row level security;

-- Users can only see their own entries
create policy "Users can view own food_log"
  on food_log for select
  using (auth.uid() = user_id);

-- Users can insert their own entries
create policy "Users can insert own food_log"
  on food_log for insert
  with check (auth.uid() = user_id);

-- Users can update their own entries
create policy "Users can update own food_log"
  on food_log for update
  using (auth.uid() = user_id);

-- Users can delete their own entries
create policy "Users can delete own food_log"
  on food_log for delete
  using (auth.uid() = user_id);

-- Index for fast daily lookups
create index if not exists food_log_user_date_idx on food_log (user_id, date desc);
