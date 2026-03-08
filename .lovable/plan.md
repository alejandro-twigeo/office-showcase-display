

## Reset Today's Mini Game Scores

You have 5 minigame scores for today (city_guess, labyrinth, pairs, sudoku, this_or_that) under player "Alejandro". No wordle scores for today.

### Plan

1. **Run a data-cleanup migration** that deletes all rows from `minigame_scores` where `date = CURRENT_DATE`. This won't touch rounds, locations, or any other data.

2. **No code changes needed** -- the games already check for today's score and will show as playable once the records are gone.

### What stays intact
- All rounds and locations unchanged
- All geo-guessing scores unchanged
- Historical minigame scores from previous days preserved

