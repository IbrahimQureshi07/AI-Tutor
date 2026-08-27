# Fortune Academy — SC Real Estate Exam Prep

Fortune Academy of Real Estate AI tutor for the South Carolina real estate salesperson exam. Five study modes (Assessment, Practice, Mistakes, Mock Exam, Final Test), a KPI-rich dashboard, and always-on AI chat that can answer questions about the SC exam — and deep-link from any practice question.

Built with **Next.js 15 (App Router)**, **Tailwind**, **shadcn-style UI**, **Framer Motion**, **Supabase**, and the **Vercel AI SDK** (pluggable Anthropic/OpenAI).

---

## Quick start

### 1. Install

```bash
npm install
# or: pnpm install / yarn / bun
```

### 2. Configure environment

Copy `.env.example` → `.env.local` and fill in:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...        # server-only

# AI (set at least one)
AI_PROVIDER=anthropic                 # or "openai"
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
```

### 3. Set up the database

In the Supabase dashboard → SQL editor, run in order:

1. `supabase/migrations/0001_init.sql` — creates all tables, views, RLS, and seeds the 12 sections (A1–B6).
2. *(Optional)* `supabase/seed/sample_questions.sql` — a dozen sample questions so the app is fully navigable before your CSV arrives.

In Supabase → **Authentication → Providers**, enable **Email** and *(optional)* **Google** OAuth. Set the redirect URL to `http://localhost:3000/auth/callback`.

### 4. Import your real question bank

Export the Apple Numbers file to CSV (`File → Export To → CSV` in Numbers) and drop it at `data/questions.csv`. Expected columns (case-insensitive; extra columns ignored):

| column | required | example |
| --- | --- | --- |
| `section` | yes | `A1`, `B3` |
| `prompt` / `question` | yes | "The bundle of rights…" |
| `option_a`, `option_b`, `option_c`, `option_d` | yes | — |
| `correct` / `correct_option` / `answer` | yes | `A`/`B`/`C`/`D` |
| `level` | no | `easy` / `medium` / `hard` |
| `hint` | no | short nudge |
| `explanation` | no | revealed on wrong answers |
| `source` | no | reference |
| `pool` | no | `standard` (default) or `final_holdout` |

Then run:

```bash
npm run import
```

(`npm run import:questions` does the same thing.)

### 5. Run the app

```bash
npm run dev
# http://localhost:3000
```

---

## Project layout

```
app/
  (marketing)/           Landing page
  (auth)/login|signup    Split-screen auth (email, magic link, Google)
  auth/callback          Supabase OAuth handler
  (app)/                 Protected app: sidebar + topbar + chat sheet
    dashboard/           KPIs, Mastery Map, Readiness ring, Activity, Next action
    assessment/          Diagnostic across A1–B6
    practice/            110 questions with hint + retry-with-hint
    mistakes/            Re-drill unresolved misses
    mock-exam/           Timed 120Q / 240min / 70% pass (SC format)
    final-test/          Held-out pool, unlocks after Mock >=70%
    chat/                Full-page AI tutor
    settings/
  api/
    chat/route.ts        Streaming AI (Anthropic | OpenAI)
    sessions/route.ts    Create session
    sessions/[id]/finish Finish & score session
    attempts/route.ts    Record per-question attempts

components/
  ui/                    shadcn-style primitives
  auth/                  split layout, auth form
  app/                   sidebar, topbar, mobile nav
  runner/                question card, timer, navigator, runner engine, results
  kpi/                   sparkline, mastery map, heatmap, readiness ring, mode cards
  chat/                  chat sheet + provider (global ⌘K)

lib/
  supabase/              client, server, admin (service-role)
  runner/                session + question loaders
  kpi/                   dashboard stats aggregator
  ai/                    provider resolver + SC-aware system prompt
  constants.ts           SECTIONS (A1–B6) and MODES config
  utils.ts

scripts/
  import-questions.ts    CSV → questions (service role)

supabase/
  migrations/0001_init.sql
  seed/sample_questions.sql

middleware.ts            Protects (app)/* routes
```

---

## The 5 modes

- **Assessment** — 24 questions, 2 per section across A1–B6. Reveal answers after each. Seeds the dashboard's Mastery Map.
- **Practice** — 110 random questions. Hint button. Wrong once → same question returns with hint revealed. Wrong twice → reveal explanation, log to Mistakes pool.
- **Mistakes** — Pulls from `v_user_mistakes` (unresolved misses). One shot per question. Two correct in a row resolves it.
- **Mock Exam** — SC format: 120 questions (80 National + 40 State), 240-minute timer, 70% to pass. No hints, no AI during exam.
- **Final Test** — Same format, drawn from `pool='final_holdout'` if you mark CSV rows accordingly. Unlocks only after a Mock ≥ 70%.

Every question card has a **✦ Ask AI** button that opens the chat sheet prefilled with that exact question's context (prompt, options, user's answer, correct answer, hint, explanation).

Global **⌘K / Ctrl+K** opens the AI chat sheet anywhere in the app.

---

## KPIs on the dashboard

- Overall accuracy (with last-14-days sparkline + 7-day delta)
- Questions attempted
- Study streak (flame)
- Readiness score (0–100, ring chart)
- Mastery Map (12 section tiles, color-coded)
- Strengths & focus areas (top 3 / bottom 3)
- 10-week activity heatmap
- Recent sessions (resume / review)
- Next Best Action (AI-style recommendation)

---

## Pluggable AI provider

Set `AI_PROVIDER=anthropic` (default) or `openai`. Override models via `ANTHROPIC_MODEL` / `OPENAI_MODEL`. The system prompt is in `lib/ai/provider.ts` — tuned for SC exam tutoring.

---

## Deploy

- **Hosting:** Vercel (recommended). Add the env vars in the Vercel project.
- **Database:** Supabase cloud. Ensure RLS policies from `0001_init.sql` are applied.
- **Auth redirects:** add your production URL to Supabase → Authentication → URL Configuration.

---

## Notes

- The app is fully navigable with the sample seed. Your CSV replaces those 12 questions with the full bank.
- RLS is strict: users can only see their own sessions, attempts, and chat. Questions and sections are readable by any authed user; writes require the service role (import script).
- The Apple Numbers file (`.numbers`) in the repo root is your source; `.gitignore` excludes it from commits.
