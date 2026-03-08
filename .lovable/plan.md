

## Plan

### 1. Improve "Other" button placement
Currently the "Other" button is a small separate element next to the Geo-Easy/Geo-Hard tabs. Change the tab bar from a 2-column grid + separate button to a **3-column grid** (`grid-cols-3`) inside the same `bg-muted` container, making "Other" a first-class tab with equal size and visibility — right next to Geo-Easy and Geo-Hard.

**File:** `src/components/play/GuessMap.tsx` (lines 467-488)

### 2. Tie minigame scores to rounds instead of dates
Currently minigames use `todayDate()` as key, so a manual "New Round" mid-day doesn't reset them. Switch to using the active `round_id`:

- **`src/hooks/useMinigameScore.ts`**: 
  - Replace `todayDate()` usage with round-based lookups
  - Add a `useMinigameTodayScore(gameId, playerName, roundId)` that filters by `round_id` instead of date
  - `useSubmitMinigameScore` stores `round_id` instead of (or alongside) date
  - Keep `date` column populated for historical browsing, but uniqueness/replay-check uses `round_id`

- **Database migration**: Add `round_id uuid` column to `minigame_scores`, update the unique constraint from `(game_id, date, player_name)` to `(game_id, round_id, player_name)` so new rounds allow replay.

- **All game components** (`CityGuessGame`, `ThisOrThatGame`, `SudokuGame`, `PairsGame`, `LabyrinthGame`, `WordleGame`): Pass `roundId` from the active round to score hooks.

- **`MiniGamesSelector`**: Accept `roundId` prop and pass it down to each game.

- **`PlayPage` / `GuessMap`**: Use `useRounds()` to get `activeRound` and pass `roundId` through.

### 3. Ensure auto-reset edge function covers all games
The `auto-reset-round/index.ts` already creates a new round row. Since minigame scores will now key off `round_id`, a new round automatically means all games are fresh — no additional edge function changes needed. The new round_id propagates through the hooks.

### Technical details

**Migration SQL:**
```sql
ALTER TABLE minigame_scores ADD COLUMN round_id uuid REFERENCES rounds(id);
-- Backfill existing rows with the round that was active on their date (best effort)
UPDATE minigame_scores ms SET round_id = (
  SELECT r.id FROM rounds r WHERE r.created_at::date <= ms.date ORDER BY r.created_at DESC LIMIT 1
);
-- Drop old unique constraint and add new one
ALTER TABLE minigame_scores DROP CONSTRAINT IF EXISTS minigame_scores_game_id_date_player_name_key;
ALTER TABLE minigame_scores ADD CONSTRAINT minigame_scores_game_round_player_key UNIQUE (game_id, round_id, player_name);
```

**Files changed:**
- `src/components/play/GuessMap.tsx` — 3-col tab layout, pass roundId
- `src/hooks/useMinigameScore.ts` — round-based score checks
- `src/components/play/MiniGamesSelector.tsx` — accept/pass roundId
- `src/components/play/games/*.tsx` (5 files) — pass roundId to hooks
- `src/pages/PlayPage.tsx` — provide roundId from useRounds
- `supabase/functions/auto-reset-round/index.ts` — no changes needed
- New migration for round_id column

