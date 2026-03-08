
ALTER TABLE minigame_scores ADD COLUMN round_id uuid REFERENCES rounds(id);

-- Backfill existing rows
UPDATE minigame_scores ms SET round_id = (
  SELECT r.id FROM rounds r WHERE r.created_at::date <= ms.date ORDER BY r.created_at DESC LIMIT 1
);

-- Drop old unique constraint and add new one
ALTER TABLE minigame_scores DROP CONSTRAINT IF EXISTS minigame_scores_game_id_date_player_name_key;
ALTER TABLE minigame_scores ADD CONSTRAINT minigame_scores_game_round_player_key UNIQUE (game_id, round_id, player_name);
