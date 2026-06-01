# Security Specification - Banda de Baile

## Data Invariants
1. A song must belong to a user and have a valid title, artist, and duration.
2. A block must only contain song IDs that exist (checked visually/app-side, but rules prevent shadow fields).
3. Setlists must have a valid creation date and items list.

## The Dirty Dozen Payloads (Rejection Tests)

1. **Identity Spoofing**: Attempt to write to `/users/someone_else/songs/my_song`.
   ```json
   { "id": "my_song", "title": "Evil Song", "artist": "Hacker", "duration": 120, "style": "ROCK" }
   ```
2. **Path Poisoning**: Create a song with a 2KB document ID.
   ```json
   { "id": "v".repeat(2048), "title": "Long ID", "artist": "Poison", "duration": 120, "style": "ROCK" }
   ```
3. **Shadow Fields**: Add `isAdmin: true` to a song document.
   ```json
   { "id": "song1", "title": "Shadow", "artist": "X", "duration": 120, "style": "ROCK", "isAdmin": true }
   ```
4. **Type Confusion**: Set `duration` as a string "3:00".
   ```json
   { "id": "song1", "title": "Confused", "artist": "X", "duration": "3:00", "style": "ROCK" }
   ```
5. **Boundary Breach**: Song style exceeding 100 characters.
   ```json
   { "id": "song1", "title": "Long Style", "artist": "X", "duration": 120, "style": "A".repeat(101) }
   ```
6. **Unauthenticated Write**: Write to any collection while `request.auth == null`.
7. **Privilege Escalation**: User A attempts to delete User B's setlist.
8. **Incomplete Schema**: Create a song missing the `artist` field.
   ```json
   { "id": "song1", "title": "Missing Artist", "duration": 120, "style": "ROCK" }
   ```
9. **Malicious ID Charsets**: Document ID with invalid characters like `song$#@!`.
10. **State Shortcut**: Update a setlist `createdAt` to a point in the future.
11. **Resource Exhaustion**: Send an array of 50,000 strings in `songIds`.
12. **System Field Injection**: Attempting to write into `/settings/global` with extra non-schema fields.

## Test Runner (Logic)
All tests verify `PERMISSION_DENIED` for the above payloads.
