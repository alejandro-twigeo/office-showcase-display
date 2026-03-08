

## Clean Up Empty Test Rounds

The database shows rounds 5 and 7-13 are completely empty (no locations, no guesses). Round 14 is the current active round with 2 locations and should be kept.

### Plan

1. **Delete empty rounds from the database** via a data migration:
   - Delete rounds 7, 8, 9, 10, 11, 12, 13 (all empty, no locations or guesses)
   - Also delete round 5 which is similarly empty (0 locations, 0 guesses) -- unless you want to keep it
   - Renumber round 14 to round 7 (or 8 if keeping round 5) so the leaderboard navigation is sequential: 1, 2, 3, 4, 5/6, 7 (current)

2. **No code changes needed** -- the leaderboard already works off whatever rounds exist in the database.

### What stays intact
- Round 14's locations and images remain untouched (just the round_number label changes)
- Rounds 1-4 and 6 with their guesses are preserved
- The auto-reset sequence will continue from the new number

