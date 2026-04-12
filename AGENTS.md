# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Canonical project scope
- The tracked app lives at repository root (`index.html`, `vite.config.js`, `src/`, `package.json`).
- There is an untracked nested copy under `src/fitness-dashboard/`; do not treat it as source of truth unless the user explicitly asks to work there.

## Development commands
- Install dependencies: `npm install`
- Start dev server: `npm run dev`
- Production build: `npm run build`
- Preview built app: `npm run preview`
- CI-equivalent install: `npm ci`

### Lint/test status
- No lint script is currently defined in `package.json`.
- No test framework or test scripts are configured.
- There is no supported “single test” command yet because there are no tests in this repo.

## Runtime configuration
- Supabase client reads env vars from Vite env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Base path is controlled via `VITE_BASE` in `vite.config.js` (defaults to `/`).
- Local env file should be `.env` (see `.gitignore` exclusions for `.env` and `.env.local`).

## High-level architecture
- Entrypoint: `src/main.jsx` mounts `<App />` into `#root` from `index.html`.
- Data access boundary: `src/supabase.js` creates and exports a singleton Supabase client.
- Main application logic/UI: `src/App.jsx` (single large component-based file).
  - Fetches two datasets on load via `loadData()`:
    - `workout_sessions` (ordered descending by `date`)
    - `weight_log` (ordered ascending by `date`)
  - Uses local React state for all UI state (tab selection, forms, expanded session, toast, error).
  - Performs CRUD directly from UI handlers:
    - Workouts: insert/delete in `workout_sessions`
    - Weight: upsert/delete in `weight_log` (upsert conflict key: `date`)
  - Derives metrics in-memory (total sets, weight deltas, BMI, target weight) and renders charting with Recharts.

## Database contract assumed by the app
- `workout_sessions` expects:
  - `id` (used as unique key, currently generated with `Date.now()`)
  - `date`, `label`, `location`
  - `exercises` JSON array of `{name, sets, reps, weight}`
- `weight_log` expects:
  - `date` (primary key behavior assumed by upsert)
  - `kg`

## Deployment pipeline
- GitHub Actions workflow: `.github/workflows/deploy.yml`
  - Triggers on push to `main`
  - Uses Node 20, runs `npm ci` then `npm run build`
  - Requires repository secrets:
    - `VITE_SUPABASE_URL`
    - `VITE_SUPABASE_ANON_KEY`
    - `VITE_BASE`
  - Publishes `dist/` to GitHub Pages.
