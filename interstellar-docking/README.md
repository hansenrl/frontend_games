# Endurance Docking

A two-player, top-down docking game inspired by the docking scene in *Interstellar*.
Each mission opens with Dr. Mann docking with the Endurance. His lander latches on and he
starts opening the hatch while Brand warns him off; a few seconds later the hatch blows, and the
station starts to spin and drift. Fly the Ranger in, match its spin, lock the clamps, slow the
spin and push it into the safe zone.

Open `index.html` in a browser to play. No build step or server needed.

## Controls

Controls are oriented to the **screen**, not the ship: W always pushes up the screen,
however the Ranger is turned. Thrusters behave like real thrusters, so speed and spin
keep going after you let go until you push the other way.

| Player | Keys | Does |
|---|---|---|
| Pilot | W A S D | Thrust up / left / down / right |
| Co-pilot | ← / → | Spin counter-clockwise / clockwise |
| Anyone | H | Flight data on/off (live readouts and meters) |
| Anyone | G | Hints on/off (ghost ship, trail, arrow hints) |
| Anyone | T | Crew talk on/off (speech bubbles) |
| Anyone | M or 🔊 button | Sound on/off |
| Anyone | P or Esc | Pause (menu has Settings and Restart) |
| Anyone | R | Restart |

## How a mission goes

1. **Approach.** After the explosion, Endurance is near the top, spinning and drifting up.
   The Ranger starts still near the bottom.
2. **Match position.** Fly onto the yellow hub and match its drift. The *Position* chip lights up.
3. **Match spin.** Line the Ranger up with the dashed ghost and match the spin rate.
   The *Spin* chip lights up. Any of the four spoke directions counts.
4. **Hold 10 seconds.** Keep both matched while the green ring fills. The clamps gently pull
   you into line while you hold; drift out and the timer starts over.
5. **Despin and tow.** The two ships are now joined and heavier. Slow the spin to (almost)
   zero, then push into the green safe zone on the right.

Difficulty sets the station's spin and drift (Easy, Normal, Hard). The station always drifts
up and away from the safe zone, and the camera slides sideways to follow it. On Normal and Hard
the station starts much farther from the Ranger (about 650 m and 800 m, over on the left) and
the camera zooms out as far as it needs to keep both ships on screen, then back in as you close
in. On Hard the station drifts fastest and spins fastest (about 20 RPM), its spin direction is
random, and its drift path swings between straight up and up-left.

## Music

No music ships with the game. Pause, open **Settings** and choose an MP3. The browser keeps a
copy of it in IndexedDB, so it loops in the background every time you start the game, until you
remove it in Settings or clear the site's data. The speaker button (or M) turns sound on and off.

If the track is "No Time for Caution" from the film soundtrack (the game recognises its 4:06 length), the
music follows the mission. It crossfades ahead, landing on the beat, when the Ranger first moves (the ticking
comes in, 0:44), when it reaches the hub and the spin match starts (1:57), when the clamps lock and the despin
and tow begin (first big organ hit, 2:35) and when the docked ships reach the safe zone (the cut-off, 3:54). Until the next of those moments it loops the part it's in, so a slow mission never runs
ahead of the music. The cue times are in `SYNC_CUES` in `game.js`.

## Files

- `index.html`: page, start, pause, settings and win screens, toggle buttons
- `game.js`: physics, rendering, HUD, hints, speech bubbles
- `design_artifacts/`: the art-style mockups this game was designed from (see its README)

## Tuning

Gameplay constants are at the top of `game.js`: `DIFF` (spin, drift, start gap, curve and camera zoom per difficulty),
`THRUST`, `TORQUE`, `TOL` (how close counts as matched), `HOLD_TIME` and `WIN_SPIN`.
