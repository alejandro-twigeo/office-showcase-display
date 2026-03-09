

## AI-Generated Daily "This or That" Questions

Use Lovable AI (which includes Gemini models) to generate fresh questions daily, cached in the database.

### Architecture

```text
Player opens game
  → Frontend queries `daily_thisorthat` table for today's date
  → If row exists → use cached questions
  → If not → call `generate-thisorthat` edge function
      → Edge function calls Lovable AI gateway (Gemini)
      → Stores 5 questions in `daily_thisorthat`
      → Returns questions to frontend
```

### What gets built

1. **Database table** `daily_thisorthat` with columns: `id`, `run_date` (unique date), `questions` (jsonb array of 5 questions), `created_at`. Public read/insert RLS.

2. **Edge function** `generate-thisorthat` that:
   - Calls Lovable AI gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) using the pre-configured `LOVABLE_API_KEY`
   - Uses `google/gemini-3-flash-preview` (fast, cheap, good enough for trivia)
   - Prompts for 5 binary comparison questions with verified correct answers across diverse categories
   - Uses tool calling to extract structured JSON output (question, option A, option B, correct answer, category)
   - Upserts into `daily_thisorthat` keyed by today's date
   - No API key needed from you — `LOVABLE_API_KEY` is already configured

3. **Updated `ThisOrThatGame.tsx`**:
   - Replace hardcoded `QUESTION_POOL` with a database fetch
   - On mount: query `daily_thisorthat` for today; if missing, invoke the edge function
   - Keep the seeded random A/B swap so answer position varies
   - Show loading spinner while fetching
   - Keep hardcoded pool as fallback if AI generation fails

### Cost & limits
- Lovable AI includes free usage per month. Each daily generation is a single request, so cost is negligible.
- Questions are cached per day, so the AI is only called once per day (first player triggers it).

### Files to create/edit
- **Create**: DB migration for `daily_thisorthat` table
- **Create**: `supabase/functions/generate-thisorthat/index.ts`
- **Edit**: `supabase/config.toml` (add function config) — actually this is auto-managed
- **Edit**: `src/components/play/games/ThisOrThatGame.tsx`

