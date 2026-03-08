

## Persist Playback Position

The core problem: when the YouTube component unmounts (navigation) and remounts, it calls `loadVideoById()` which starts at 0:00 because no position is stored.

### Approach

**Add a `current_time_seconds` column** to `youtube_queue` and periodically write the playback position from the YT player. On mount, use `loadVideoById(videoId, { startSeconds })` to resume.

### Database Change

- Add `current_time_seconds` (integer, nullable, default null) to `youtube_queue`

### Code Changes

**1. `YouTubeDisplay.tsx` -- write position periodically**
- Add a `setInterval` (every 5s) that calls `player.getCurrentTime()` and writes it to the DB via a lightweight update (`ytQueue().update({ current_time_seconds }).eq("id", currentVideoId)`)
- On `onReady`, if `currentVideo.current_time_seconds` exists, call `player.seekTo(seconds, true)` instead of starting from 0

**2. `useYoutubeQueue.ts` -- expose `current_time_seconds`**
- Add `current_time_seconds` to the `YouTubeVideo` interface
- The existing query already does `select("*")`, so the new column will be included automatically

**3. Resume on mount**
- In `initPlayer`, after creating the YT.Player, use `startSeconds` in `playerVars` or call `seekTo` in the `onReady` callback using the value from the database
- When reusing an existing player (`loadVideoById`), pass `{ startSeconds }` as the second argument

### Flow

```text
Playing video → every 5s write current_time to DB
  ↓
Navigate away → component unmounts (interval cleared)
  ↓
Navigate back → component mounts, queries current-video
  ↓
current_time_seconds = 147 → player.seekTo(147)
```

This is lightweight (one small UPDATE every 5s on a single row) and fully solves the restart problem without needing a leader system.

