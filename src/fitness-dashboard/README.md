# Dave's Fitness Dashboard

A personal fitness tracker built with React + Vite, backed by Supabase, deployed via GitHub Actions to GitHub Pages.

---

## 1. Supabase Setup

In your Supabase project, run this SQL in the **SQL Editor**:

```sql
-- Workout sessions
create table workout_sessions (
  id bigint primary key,
  date text not null,
  label text,
  location text,
  exercises jsonb,
  created_at timestamptz default now()
);

-- Weight log (one entry per day, upsert on conflict)
create table weight_log (
  date text primary key,
  kg numeric not null,
  created_at timestamptz default now()
);

-- Seed your first workout session
insert into workout_sessions (id, date, label, location, exercises) values (
  1,
  '2026-04-10',
  'Session #3',
  'YMCA with Susan',
  '[
    {"name":"Kettlebell Sumo Squat","sets":3,"reps":12,"weight":"30 lbs"},
    {"name":"Kettlebell RDL","sets":3,"reps":12,"weight":"25 lbs"},
    {"name":"Dumbbell Bench Press","sets":3,"reps":12,"weight":"10 lbs each"},
    {"name":"Shoulder Press","sets":3,"reps":12,"weight":"10 lbs each"},
    {"name":"Leg Press","sets":3,"reps":10,"weight":"100 lbs"},
    {"name":"Dead Bug","sets":3,"reps":10,"weight":"Bodyweight"},
    {"name":"Treadmill Cardio","sets":1,"reps":"25 min","weight":"Flat / 3.5 pace · ~190 cal"}
  ]'
);

-- Seed starting weight
insert into weight_log (date, kg) values ('2026-04-11', 106);

-- Row Level Security: allow anon read/write (personal app)
alter table workout_sessions enable row level security;
alter table weight_log enable row level security;

create policy "Allow all for anon" on workout_sessions for all using (true) with check (true);
create policy "Allow all for anon" on weight_log for all using (true) with check (true);
```

Then grab your credentials from **Supabase → Project Settings → API**:
- `Project URL` → `VITE_SUPABASE_URL`
- `anon public` key → `VITE_SUPABASE_ANON_KEY`

---

## 2. Local Development

```bash
git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
cd YOUR_REPO_NAME
npm install

# Set up env
cp .env.example .env
# Edit .env with your Supabase credentials and set VITE_BASE=/

npm run dev
```

---

## 3. GitHub Repository Setup

1. Create a new repo on GitHub (public or private)
2. Push this code:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
   git push -u origin main
   ```

---

## 4. GitHub Secrets

In your repo go to **Settings → Secrets and variables → Actions → New repository secret** and add:

| Secret name            | Value                                      |
|------------------------|--------------------------------------------|
| `VITE_SUPABASE_URL`    | Your Supabase project URL                  |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key                  |
| `VITE_BASE`            | `/your-repo-name/` (with leading/trailing slashes) |

---

## 5. Enable GitHub Pages

In your repo go to **Settings → Pages**:
- Source: **GitHub Actions**
- Save

On the next push to `main`, GitHub Actions will build and deploy automatically. Your site will be live at:

```
https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/
```

---

## Stack

- **React 18** + **Vite 5**
- **Supabase** (Postgres) for persistent storage
- **Recharts** for weight trend chart
- **GitHub Actions** for CI/CD
- **GitHub Pages** for hosting
