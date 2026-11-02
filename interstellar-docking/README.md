# Endurance Docking

A two-player, top-down docking game inspired by the docking scene in *Interstellar*.
Each mission opens with Dr. Mann trying to dock with the Endurance. His hatch blows, and the
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
| Anyone | M | Music on/off |
| Anyone | P or Esc | Pause |
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

Difficulty sets the station's spin and drift (Easy, Normal, Hard). On Normal and Hard the
station also starts farther from the Ranger, off to one side. On Hard the spin direction is
random and the station's drift path curves back and forth.

## Music

The game plays `music/no-time-for-caution.mp3` (or `.m4a` / `.ogg`) on a loop if that file
exists, and hides the Music button if it doesn't. The track isn't included in the repo.

## Files

- `index.html`: page, start and win screens, toggle buttons
- `game.js`: physics, rendering, HUD, hints, speech bubbles
- `design_artifacts/`: the art-style mockups this game was designed from (see its README)

## Tuning

Gameplay constants are at the top of `game.js`: `DIFF` (spin, drift, start gap and curve per difficulty),
`THRUST`, `TORQUE`, `TOL` (how close counts as matched), `HOLD_TIME` and `WIN_SPIN`.
