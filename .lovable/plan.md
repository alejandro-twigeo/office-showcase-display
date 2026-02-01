

# Office TV Dashboard

A fun, interactive dashboard for your office TV with a GeoGuessr-like game, rotating polls, and a shared YouTube player. Colleagues can interact from their own devices via a Play page.

---

## Core Features

### 1. TV Dashboard Page (Main Display)
A modern, minimal layout divided into three visible sections:

- **GeoGuessr Section** (main area)
  - Displays a Google Street View panorama
  - Shows a live leaderboard ranking guessers by distance (closest to farthest)
  - Each player's name and their distance from the correct location
  - Updates in real-time as users submit guesses

- **Polls Section**
  - Displays one poll at a time with live voting results
  - Progress bar showing time remaining (30 seconds per poll)
  - Auto-rotates to the next poll when time expires
  - Shows vote counts and percentages

- **YouTube Player Section**
  - Embedded YouTube video player
  - Displays current video title
  - Shows who queued the current video

---

### 2. Play Page (User Interaction)
Where colleagues interact from their phones/laptops:

- **User Identification**: Simple name entry (remembered on device for convenience)

- **GeoGuessr Guessing**
  - Interactive map where users click/tap to place their guess marker
  - 3 guesses allowed per image
  - Shows remaining guesses
  - Confirmation before submitting

- **Polls Management**
  - View all active polls and vote
  - Create new polls (question + multiple choice options)
  - See if you've already voted

- **YouTube Control**
  - Search or paste YouTube URL
  - Queue a new video to play
  - View recently played videos

---

### 3. Content Management (No Admin Required)
- **New GeoGuessr Image**: Anyone can trigger loading a new Street View location and clear the leaderboard for fresh guessing
- **Polls**: Anyone can create polls; polls can be marked as "complete" by creator
- **YouTube**: Anyone can change the video

---

## Technical Approach

- **Backend**: Lovable Cloud with Supabase for database and real-time sync
- **Real-time Updates**: When a user submits a guess or vote, the TV dashboard updates instantly
- **Google Street View API**: For fetching random panoramic images with coordinates
- **Interactive Map**: For the guessing interface (Leaflet or similar)

---

## Database Structure (High Level)
- **Locations**: Current and past GeoGuessr images with coordinates
- **Guesses**: User guesses linked to locations with calculated distances
- **Polls**: Poll questions, options, and votes
- **YouTube Queue**: Current and queued videos

---

## User Experience Flow

1. **TV displays dashboard** with current GeoGuessr panorama, active poll, and playing video
2. **Colleague opens Play page** on their phone
3. **Enters their name** (saved for future sessions)
4. **Clicks on map** to guess the location (up to 3 tries)
5. **Leaderboard updates instantly** on the TV showing their rank
6. **Votes on the current poll** - results update live
7. **Queues a new song/video** when they want to change the music

