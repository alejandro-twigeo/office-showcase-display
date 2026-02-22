
## Update Score Feedback to Friendly Language

### What changes
In the guess history section of `src/components/play/GuessMap.tsx` (lines 270-274), replace the technical formula display with simple, human-friendly text.

### Current display
```
277.3km away · base 574 × 100% (attempt 1) = 574
519.1km away · base 354 × 90% (attempt 2) = 319
```

### New display
```
277 km away · Full score · Attempt 1
519 km away · 10% reduction · Attempt 2
```

### Technical details

**File:** `src/components/play/GuessMap.tsx`, lines 260-275

- Remove the `baseScore` calculation (line 263) as it's no longer displayed
- Keep the `multiplier` calculation to determine the reduction percentage
- Replace the formula text (line 274) with:
  - Distance: round to nearest km (or show meters if under 1 km) -- same as current
  - Score message: if multiplier is 1.0, show "Full score"; otherwise show `{reduction}% reduction` where reduction = `Math.round((1 - multiplier) * 100)`
  - Attempt number: "Attempt {n}" in plain text
- Keep the score points display (`{score} pts`) unchanged on the line above
