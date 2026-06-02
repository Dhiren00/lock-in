# Lock-in

An 8-hour daily focus website with camera-based motion alerts.

## Schedule

| Block | Duration |
|-------|----------|
| Segment 1 | 2 hours |
| Break | Manual |
| Segment 2 | 2 hours |
| Break | Manual |
| Segment 3 | 4 hours |

## Features

- **Daily tracking** — Records whether you started each day and completed segments (stored in `localStorage`).
- **Monthly 8-hour tracking** — Full calendar for any month with stats: days at 8h, partial days, missed days, and completion rate. A day counts as **8h complete** only when all three segments are finished.
- **8-hour timer** — Three segments (2h + 2h + 4h) with breaks between the first two.
- **Camera motion detection** — While a segment is running, movement triggers an alarm sound and on-screen alert.
- **Restart siren** — Restarting or resuming after a break plays a siren via Web Audio.

## Run locally

Camera and audio require a secure context. Use a local server (not `file://`):

```bash
cd lock-in
npx --yes serve .
```

Then open `http://localhost:3000` (or the port shown) and allow camera access when prompted.

## Usage

1. Click **Start lock-in** to begin segment 1 and enable the camera.
2. Stay seated during focus blocks — movement triggers the alarm.
3. Click **End segment · Break** when finished with a 2h block (or wait for the timer to finish).
4. After a break, click **Resume next segment** (siren plays).
5. **Restart segment** replays the siren and resets the current segment timer.

Progress resets automatically each calendar day.
