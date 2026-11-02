# Endurance Docking

A two-player, top-down docking game inspired by the docking scene in *Interstellar*.
The Endurance is spinning and drifting after an explosion; fly the Ranger in, match
its spin, lock the clamps, slow the spin and push it into the safe zone.

Open `index.html` in a browser to play. No build step or server needed.

## Controls

Controls are oriented to the **screen**, not the ship: W always pushes up the screen,
however the Ranger is turned. Thrusters behave like real thrusters, so speed and spin
keep going after you let go until you push the other way.

| Player | Keys | Does |
|---|---|---|
| Pilot | W A S D | Thrust up / left / down / right |
| Co-pilot | K / L | Spin counter-clockwise / clockwise |
| Anyone | H | Flight data on/off (live readouts and meters) |
| Anyone | G | Hints on/off (ghost ship, trail, arrow hints) |
| Anyone | T | Crew talk on/off (speech bubbles) |
| Anyone | P or Esc | Pause |
| Anyone | R | Restart |

## How a mission goes

1. **Approach.** Endurance starts near the top at a random spot in the middle 75% of the
   play area, spinning and drifting up. The Ranger starts still near the bottom.
2. **Match position.** Fly onto the yellow hub and match its drift. The *Position* chip lights up.
3. **Match spin.** Line the Ranger up with the dashed ghost and match the spin rate.
   The *Spin* chip lights up. Any of the four spoke directions counts.
4. **Hold 10 seconds.** Keep both matched while the green ring fills. The clamps gently pull
   you into line while you hold; drift out and the timer starts over.
5. **Despin and tow.** The two ships are now joined and heavier. Slow the spin to (almost)
   zero, then push into the green safe zone on the right.

Difficulty sets the station's spin and drift (Easy, Normal, Hard). On Hard the spin
direction is random.

## Files

- `index.html`: page, start and win screens, toggle buttons
- `game.js`: physics, rendering, HUD, hints, speech bubbles
- `design_artifacts/`: the art-style mockups this game was designed from (see its README)

## Tuning

Gameplay constants are at the top of `game.js`: `DIFF` (spin and drift per difficulty),
`THRUST`, `TORQUE`, `TOL` (how close counts as matched), `HOLD_TIME` and `WIN_SPIN`.
