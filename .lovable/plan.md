
## Name Conflict Handling: "Is That You?" Flow

### The Full Behaviour

When someone types a name and taps "Join the Game", the app checks the database for that name. Three possible outcomes:

1. **Name is free** (no prior guesses, or all guesses are from this same device) → proceed normally.

2. **Name exists on a different device** → Show a confirmation dialog:
   > "We found activity for **Alejandro** on another device. Is that you?"
   > - **Yes, that's me** → copy the old device ID to this device's localStorage, then proceed. The user is now linked.
   > - **No, change name** → dismiss the dialog, stay on the name entry form so they can pick a different name.

3. **Checking** → while the database query runs, the button shows a brief loading state.

### Files to Change

**`src/hooks/useDeviceId.ts`**
- Export a synchronous `getDeviceId()` utility (reads/creates the ID directly from localStorage, no React state involved). This lets `NameEntry` safely call it inside an async submit handler without waiting for a React render cycle.
- Export a `setDeviceId(id: string)` utility that writes a new value to localStorage. This is what gets called when the user confirms "Yes, that's me".

**`src/components/play/NameEntry.tsx`**
- Add `checking` state (boolean) — disables the button and shows "Checking..." while the query runs.
- Add `conflictDeviceId` state (string | null) — holds the device ID found in the database for the conflicting name. When non-null, the confirmation dialog is shown.
- On submit:
  1. Query the `guesses` table: find any row where `player_name = <typed name>` and `device_id != <current device id>`, limit 1.
  2. If a match exists → store the found `device_id` in `conflictDeviceId` state → show dialog.
  3. If no match → call `onSubmit` as before.
- **"Yes, that's me" button**: call `setDeviceId(conflictDeviceId)`, then call `onSubmit(name)`.
- **"No, change name" button**: clear `conflictDeviceId` state, keep the form open so the user can retype.

The dialog is built inline using the existing `Dialog` component from `@radix-ui/react-dialog` (already installed and wrapped in `src/components/ui/dialog.tsx`).

### Technical Notes
- No database schema changes needed.
- The check is a single lightweight query (`SELECT device_id ... LIMIT 1`), only triggered on form submit.
- `getDeviceId()` is synchronous (reads from `localStorage` directly), so no async race condition.
- After the user confirms "Yes", their new device will share the same `device_id` as their original device — the leaderboard will correctly group all their guesses together.
