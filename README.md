# Daybook

A personal PWA for school, your cycle and everyday tasks. It works offline, syncs between devices through Supabase, and is hosted on GitHub Pages.

## What's inside

- **Today**: dailies (water fill-up glass, gym check + workout notes, custom checkmark habits), assignments due in the next 7 days, reminders with a quick-add box, an "upcoming" strip for important dates and exams, and a week strip that links to the calendar.
- **Calendar**: month view of assignments, exams, important dates, reminders and period/fertile days, with a panel for the chosen day.
- **School**: assignments (overdue / today / this week / later), exams with countdowns, and colour-coded classes.
- **Cycle**: cycle ring with phases (period, follicular, ovulation, luteal), predictions that depend on your birth control method, a pill-pack view for the combined pill, a log for flow / feelings / pain / sex / discharge / pill, stats split by birth control period, and symptom patterns by phase.
- **Dailies**: streaks, an 18-week heatmap per habit, a 14-day water chart, a workout log, routine notes, and controls to add, pause or reorder dailies.

Data is saved on the device first (IndexedDB), so everything works offline. Changes upload to Supabase when you're back online, and other open devices update live.

## One-time setup

### 1. Supabase (accounts and sync)
1. Create a free account at supabase.com and click **New project**. Pick any name and region, and save the database password somewhere safe. You won't need it here.
2. When the project is ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
3. Open **Project Settings → API** (or the **Connect** button) and copy the **Project URL** and the **anon / publishable key**. Put them in `src/config.js`. The anon key is safe to publish because Row Level Security keeps each account's data private.
4. Open **Authentication → URL Configuration**:
   - **Site URL**: `https://<your-github-username>.github.io/<repo-name>/`
   - Add the same URL under **Redirect URLs**.

### 2. GitHub Pages (hosting)
1. Push this folder to a GitHub repository.
2. In the repo, open **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Every push to `main` builds and deploys automatically. You can watch progress in the **Actions** tab. The site is at `https://<username>.github.io/<repo-name>/`.

### 3. Outlook calendar (optional, read-only)
1. Supabase → **Edge Functions → Deploy a new function → Via Editor**. Name it `outlook-ics`, paste `supabase/functions/outlook-ics/index.ts`, and deploy.
2. Open the function's **Details / Settings**, turn **Verify JWT** off, and save. The code checks the signed-in user itself.
3. Outlook on the web → Settings → **Calendar → Shared calendars → Publish a calendar**. Pick your calendar and **Can view all details**, click **Publish**, and copy the **ICS** link.
4. Daybook → **Settings → Outlook calendar**: paste the link.

### 4. Install it
- **iPhone**: open the site in **Safari** → Share → **Add to Home Screen**.
- **Mac**: in Safari, **File → Add to Dock**. In Chrome, use the install icon in the address bar.

Sign in with the same account on both devices.

## Developing locally
```bash
npm install
npm run dev
```
