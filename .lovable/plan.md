

## Split YouTube Display: Video + Queue Side-by-Side

### What Changes

The YouTube section on the TV dashboard will be split into two columns:
- **Left (larger)**: The video player, now-playing info, and "up next" label
- **Right (narrower)**: A scrollable list of queued songs with thumbnails, titles, and who queued them

This way the TV always shows what's coming up without needing to check a phone.

### Layout

```text
+-------------------------------+----------------+
|                               |  Queue (scroll) |
|       YouTube Player          |  1. Song A      |
|                               |  2. Song B      |
|                               |  3. Song C      |
+-------------------------------+  4. Song D      |
|  Now Playing: Title           |  ...            |
|  Queued by: Name   Up next:.. |                 |
+-------------------------------+----------------+
```

The split will use a CSS grid: roughly `3fr` for the video, `1fr` for the queue sidebar.

### File: `src/components/dashboard/YouTubeDisplay.tsx`

1. Wrap the existing content in a horizontal grid (`grid-cols-[3fr_1fr]`) inside the CardContent.
2. Left column: keeps the video player container and the now-playing info exactly as-is.
3. Right column: a new scrollable panel showing:
   - A small "Queue" heading with the count
   - Each queued song as a compact row: thumbnail, title (truncated), and queued-by name
   - If queue is empty, a subtle "Queue empty" message
4. Remove the "X in queue" badge from the header since the queue is now always visible.
5. Remove the "Up next" line from the bottom info bar (redundant with the visible queue).

No other files need to change. No database changes.
