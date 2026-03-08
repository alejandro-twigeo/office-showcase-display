

## Plan: Private Mode vs Live Share for Music

### Concept
Add a mode toggle at the top of the YouTube section: **"My Music"** (private, local-only) and **"Live Share"** (shared queue, current behavior). 

- **My Music**: Uses browser-local state only. Videos play in an embedded YouTube player directly on the Play page. No database writes — doesn't affect the TV dashboard or other users. Queue/history stored in React state (session-lived) or localStorage for persistence.
- **Live Share**: Exactly the current behavior — writes to `youtube_queue` table, syncs via realtime, drives the TV dashboard.

### Architecture

**No database changes needed.** Private mode is entirely client-side.

### File Changes

**1. `src/hooks/usePrivateQueue.ts`** (new)
- Local queue management using `useState` + `localStorage` for persistence
- Mirrors the `useYoutubeQueue` API surface: `currentVideo`, `queue`, `playNow`, `addToQueue`, `advanceQueue`, `removeFromQueue`, `reorderQueue`, `toggleFavorite`, `recentVideos`
- Uses `fetchYouTubeMeta` from existing hook to resolve titles/thumbnails
- Stores queue in localStorage key `private-music-queue`

**2. `src/components/play/YouTubeSection.tsx`** (major refactor)
- Add mode state: `'private' | 'live'` (default `'private'` or persisted in localStorage)
- Mode toggle UI at the top of the card — two pill buttons: 🎧 "My Music" and 📡 "Live Share"
- When in private mode:
  - Use `usePrivateQueue()` instead of `useYoutubeQueue()`
  - Show an embedded YouTube iframe player (using `<iframe>` with `enablejsapi=1`) at the top so the user hears music on their device
  - All queue/history/playlist actions route to the private queue
- When in live mode:
  - Current behavior unchanged — writes to shared DB, no local player (TV is the speaker)
- The `PlaylistsPanel` "Play list" action should route through whichever queue is active

**3. `src/components/play/PrivatePlayer.tsx`** (new)
- Small embedded YouTube player component for private mode
- Uses YouTube IFrame API (reuse the bootstrap pattern from `YouTubeDisplay.tsx`)
- Auto-advances to next track in private queue on video end
- Compact design: small player + now-playing info

**4. `src/components/play/PlaylistsPanel.tsx`** (minor)
- Accept an `onPlayNow` and `onAddToQueue` callback props instead of directly calling `useYoutubeQueue` mutations, so the parent can route to private or live queue

### UI Layout (Private Mode)

```text
┌─────────────────────────────────┐
│  🎧 My Music  │  📡 Live Share  │  ← mode toggle
├─────────────────────────────────┤
│  ▶ [  Embedded YT Player  ]    │  ← only in private mode
│  Now Playing: Song Title        │
├─────────────────────────────────┤
│  [Paste URL...]                 │
│  [Play Now]  [Add to Queue]    │
├─────────────────────────────────┤
│  Queue │ History │ Playlists    │
│  ...                            │
└─────────────────────────────────┘
```

### Technical Notes
- Private queue persists across page refreshes via localStorage but is device-specific
- The `fetchYouTubeMeta` function is already exported and reusable
- YouTube IFrame API bootstrap code will be extracted into a shared util from `YouTubeDisplay.tsx`
- Private player auto-advances using the `onStateChange` YT event (state 0 = ended)
- Live Share mode shows a note: "Music plays on the TV dashboard" to clarify there's no local playback

