-- Food export settings: which recipients + daily/weekly toggles
alter table profiles
  add column if not exists food_export_emails text[] not null default '{}',
  add column if not exists food_export_daily  boolean not null default false,
  add column if not exists food_export_weekly boolean not null default false;
