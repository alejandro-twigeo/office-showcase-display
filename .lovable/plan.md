

## Daily News on the TV Dashboard

### What we're building
A news ticker/card section on the TV dashboard that displays daily news items stored in a database table. The data comes from your Google Sheets automation (you'll configure Sheets to also POST the JSON to a backend endpoint).

### Database

1. **Create `daily_news` table** with columns:
   - `id` (uuid, PK)
   - `run_date` (date, unique) -- one entry per day
   - `run_datetime` (timestamptz)
   - `items` (jsonb) -- the array of news items as-is
   - `created_at` (timestamptz, default now())

   RLS: public SELECT (no auth needed for TV dashboard reading).

2. **Create an edge function `ingest-news`** that accepts a POST with the JSON payload (the exact structure you showed), upserts into `daily_news` by `run_date`. This is what your Google Sheets automation will call. No auth required (or use a simple bearer token via a secret).

### Dashboard UI

3. **Create `NewsDisplay` component** that:
   - Fetches today's news from `daily_news` (latest entry)
   - Shows news items as a rotating card (one item at a time, cycling every ~10 seconds) or a scrolling list
   - Each card shows: headline, summary, audience badge, and a subtle link icon
   - Syncs rotation with the existing poll rotation timer for visual consistency

4. **Place it on the Dashboard** -- replace the poll section or add it as a rotation alongside polls (e.g., polls and news alternate every 30s, same as the leaderboard pattern). Given the current layout has YouTube (2fr) + Poll (1fr) on top, and games on bottom, the news could rotate with the poll display area.

### Technical details

- Edge function path: `supabase/functions/ingest-news/index.ts`
- CORS enabled, `verify_jwt = false` in config.toml
- Upsert logic: `ON CONFLICT (run_date) DO UPDATE SET items = EXCLUDED.items, run_datetime = EXCLUDED.run_datetime`
- Frontend hook: `useDailyNews()` fetching from `daily_news` ordered by `run_date DESC LIMIT 1`
- News card component cycles through `items[]` with a timer, showing headline + summary + audience badge
- Realtime subscription on `daily_news` so the TV updates automatically when new data is ingested

### Google Sheets integration
After implementation, you'll configure your Sheets automation to also make a POST request to the edge function URL with the same JSON payload it writes to the cell. The endpoint URL will be:
`https://jrpwlvdwhuxpbqykomzw.supabase.co/functions/v1/ingest-news`

