# Dave's Fitness Dashboard

## Project
- Live URL: https://fitness.brightpathtechnology.io
- Repo: victorycross/fitness-dashboard (GitHub Pages via Actions)
- Stack: React 18 + Vite + Supabase JS + Recharts
- Deploy: git push to main → GitHub Actions builds → live in ~30s

## Supabase
- Project ID: ibiszdvdhffvrissciyj
- URL: https://ibiszdvdhffvrissciyj.supabase.co
- Tables: profiles, workout_sessions, weight_log (all with user_id RLS)

## Auth
- Email + password via Supabase Auth
- Main user: victorycross@gmail.com (David Martin)
- Height: 170cm, Target BMI: 24.9, Trainer: Susan Jadidi (McDonald YMCA, Fridays 4-5pm)

## Key files
- src/App.jsx — entire app (680 lines, single component file)
- src/supabase.js — Supabase client config

## To deploy
git add -A && git commit -m "message" && git push
