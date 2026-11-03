# Design artifacts: Dino Defenders

A math-blasting game with a dinosaur theme. Meteors fall on Dino Valley carrying numbers;
solve the problem and your dino knocks the right one out of the sky. Levels run from
kindergarten to grade 5.

Art-style mockups made before building the game. Each is a self-contained HTML page of
animated canvas mockups; open it in a browser.

| File | Mockups |
|---|---|
| `round1-art-styles.html` | Saturday Cartoon, Papercraft, Pixel Arcade, Storybook Watercolor, Neon Jurassic |
| `round2-art-styles.html` | Crayon Drawing, Felt Board, Clay Studio, Vintage Picture Book, Pop-up Book (world map), plus the oops sequence and a working grown-up settings mock |

Each round-1 mockup also shows a different game mode, so the look and the play can be judged together:

| Mockup | Grade shown | Mode | How you answer |
|---|---|---|---|
| A. Saturday Cartoon | 1 | Meteor Shower | Tap one of three falling meteors |
| B. Papercraft | K | Egg Count | Tap one of three paper tags, with counting and a ten-frame |
| C. Pixel Arcade | 3 | Sky Gates | Steer a pterodactyl through the right cloud ring |
| D. Storybook Watercolor | 4 | Fraction Feast | Tap a stone; the pie is drawn as the dino eats |
| E. Neon Jurassic | 5 | Volcano Cannon | Type the answer on a number pad |

## Math ladder (Common Core, K–5)

One world per grade. Fluency goals are the standards that say "fluently"; they become the speed rounds.

| Grade | World | Fluency goal | Skill levels |
|---|---|---|---|
| K | Hatchling Hill | Add/subtract within 5 (K.OA.5) | Count to 20 (K.CC.5), more/fewer (K.CC.6–7), add/take away within 10 with pictures (K.OA.2), break apart numbers (K.OA.3), make 10 (K.OA.4), teen numbers (K.NBT.1) |
| 1 | Fern Forest | Add/subtract within 10 (1.OA.6) | Within 20 (1.OA.6), missing number (1.OA.8), true/false equations (1.OA.7), compare two-digit numbers (1.NBT.3), add within 100 (1.NBT.4), ten more/less (1.NBT.5–6) |
| 2 | Tar Pit Trail | Sums of one-digit numbers from memory (2.OA.2); within 100 (2.NBT.5) | Facts within 20, within 100, within 1000 (2.NBT.7), 10 or 100 more/less (2.NBT.8), odd/even and arrays (2.OA.3–4), coins (2.MD.8) |
| 3 | Pterodactyl Peaks | Multiply/divide within 100 (3.OA.7); add/subtract within 1000 (3.NBT.2) | Times tables and division facts, missing factor (3.OA.4), times multiples of 10 (3.NBT.3), rounding (3.NBT.1), fractions (3.NF.1–3), area (3.MD.7) |
| 4 | Long-Neck Lake | Multi-digit add/subtract, standard algorithm (4.NBT.4) | Big add/subtract, multiply up to 4×1 and 2×2 digits (4.NBT.5), divide with remainders (4.NBT.6), factors/primes (4.OA.4), equivalent and like-denominator fractions, fraction × whole (4.NF.1–4), tenths and hundredths (4.NF.6–7) |
| 5 | Volcano Ridge | Multi-digit multiplication, standard algorithm (5.NBT.5) | Multi-digit multiply, divide by 2 digits (5.NBT.6), decimals to hundredths (5.NBT.7), powers of ten (5.NBT.2), unlike denominators (5.NF.1), multiply/divide fractions (5.NF.4, 5.NF.7), parentheses (5.OA.1) |

## Rules for a young player (any look)

- Any grade can be played at any time; stars are kept per skill.
- Every problem is read aloud (browser speech), with a replay button.
- Answer style is a grown-up setting at every grade, kindergarten included:
  **pick from 3** or **type the number**. K–2 type on a big two-row pad (1–5 / 6–0);
  grade 3+ get a calculator-style pad, and a real keyboard always works.
- Very forgiving. A miss is "Oops, give it another try!":
  1. the wrong choice wobbles and fades (fewer choices next time) or a typed answer clears,
  2. the problem is drawn (dots, ten-frame, tens and ones, egg rows, pie),
  3. after a second miss Rex works it through with him, and he still taps the answer.
  Tries are unlimited. No lives, no game over, no streak that resets. Stars only go up.
- No speed in K–2: meteors stop and wait (parachutes, clouds). **Calm** is the default
  everywhere. **Zoom** (meteors drift down, faster with the streak) is opt-in, grade 3+ only,
  and meant for keyboard typing.
- Inside a level, 5 right in a row makes the numbers bigger and 2 misses makes them smaller.
- Grown-up settings per world: answer style, pace, picture help (after a miss / always / off), read aloud.

## Decisions

- **Round 1 favourites:** Storybook Watercolor, Papercraft, Saturday Cartoon.
- Answer style is configurable from kindergarten (type or pick).
- Mistakes never cost anything (see rules above).
- No speed at the early levels; Zoom is opt-in from grade 3.
- **Round 2 pick: Pop-up Book**, for the world map and for gameplay. The world map shows
  progress: Rex walks the path and the walked part turns red. Vintage Picture Book was the
  runner-up for gameplay.
- First build (`../index.html`): pop-up book map, world pages and gameplay. Meteors hang from paper
  strings; cards, Rex and the number pad fold up off the page.
- **After playing the first build:**
  - Hanging meteors didn't read as meteors when they weren't moving. **New conceit: egg-snatching
    pterodactyls.** They hover over Rex's nest holding answer signs, and Rex roars the right one away.
    Flying creatures hover naturally, so this works with no clock.
  - The grade is a grown-up setting. The map shows the stages (levels) of that one grade, and
    Rex explores them along the path.
  - Defaults: sound effects and read-aloud off, answers typed.
  - Timed mode can be switched on at any grade (it was grade 3+ only). It never costs anything.
  - Settings are now one set for the whole game, not one per world.
