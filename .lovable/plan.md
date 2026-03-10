

## Fix: "Total visitors" should be sum of daily unique visitors

### Problem
Currently `totalUniqueDevices` counts unique usernames across the entire date range (a global Set). The user wants it to be the **sum of per-day unique visitor counts** — i.e., if "Alice" visits on Monday and Tuesday, she counts as 2 (once per day).

### Change
In `src/components/manager/UsageAnalytics.tsx`, replace the global `allUsers` Set approach:

- Remove `allUsers` Set and `allVisits` counter
- After building `byDate` (the per-day Sets), compute `totalUniqueDevices` as the sum of each day's Set size: `dayStats.reduce((sum, d) => sum + d.uniqueVisitors, 0)`
- The `addVisitor` function already deduplicates within a single day (same player on same day = 1), which is correct
- "Visits/person" becomes: total daily uniques ÷ number of distinct usernames across the period (keeps the global Set just for this denominator)

### File
- **Edit**: `src/components/manager/UsageAnalytics.tsx` — change how `totalUniqueDevices` and `totalVisitsCount` are computed after the `dayStats` array is built

