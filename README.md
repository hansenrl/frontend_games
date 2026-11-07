# Family Game Shelf

A collection of small browser games to play with the kids. Plain HTML, CSS and JavaScript, so there's nothing to build.

Every push to `main` deploys to GitHub Pages:

| Game | URL |
| --- | --- |
| Home page (list of games) | https://hansenrl.github.io/frontend_games/ |
| Choo-Choo Junction | https://hansenrl.github.io/frontend_games/train-junction/ |
| Endurance Docking | https://hansenrl.github.io/frontend_games/interstellar-docking/ |

## One-time GitHub setup

1. In the repo, go to **Settings → Pages**.
2. Under **Build and deployment → Source**, choose **GitHub Actions**.
3. Push to `main` (or run the **Deploy to GitHub Pages** workflow by hand from the Actions tab).

## Play locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000/.

## Adding a new game

1. Make a new folder at the top level, e.g. `memory-match/`, with its own `index.html`.
2. Add a card for it in the top-level `index.html`.
3. Push to `main`. It will be live at `https://hansenrl.github.io/frontend_games/memory-match/`.

## Choo-Choo Junction

A paper-craft train puzzle. Put track pieces on the **?** spots, press **GO!** and watch where the train goes. If it crashes, it goes back to the start and you try something else.

Pieces:

- **Straight** and **Curve**: tap a piece again (or press ↻) to turn it.
- **Crossing**: lets the train cross its own track, for loops.
- **Small Bridge / Big Bridge**: cross 1 or 2 squares of water or other track. They can't go over trees, rocks or houses.
- **Tunnel**: goes straight through a mountain.
- **Jump Ramp**: flies over 3 squares of anything!

Later levels have animal friends waiting by the track. The train has to pick them all up before it reaches the station.

Keyboard: `Space` = GO, `R` = turn, `1`–`7` = pick a piece, `Tab` = next spot, `Delete` = remove.
Add `?level=5` to the URL to jump straight to a level.

### Editing levels

Levels are text maps in `train-junction/levels.js` (the legend is at the top of the file). After changing them, run:

```bash
node tools/check-levels.js
```

It tries every combination of pieces and makes sure each level can be solved. The deploy workflow runs it too, and won't publish a level that can't be solved.

## Endurance Docking

A two-player, top-down docking game inspired by the spinning-station docking scene in *Interstellar*. One player flies the Ranger with **W A S D** (thrust is always up/left/down/right on the screen), the other spins it with **←** and **→** (Settings can put the spin on autopilot so one player can fly alone). Match the station's position and drift, match its spin, hold for 10 seconds while the clamps lock, then slow the spin and push the station into the safe zone. The five fastest missions on each difficulty are kept on a leaderboard, each marked with the date and time it was flown.

`H` toggles flight data, `G` toggles hints, `T` toggles crew speech bubbles, `P` pauses, `R` restarts. More detail, and the art-style mockups it was designed from, are in [`interstellar-docking/`](interstellar-docking/).
