# Dino Defenders

A pop-up book math game. Sneaky pterodactyls want the eggs in Rex's nest, and each one carries
a sign with an answer. Solve the problem, pick the right pterodactyl (or type the answer), and
Rex roars it away.

Open `index.html` in a browser to play. No build step or server needed.

## How it plays

- **The grade** is a grown-up setting (Kindergarten to Grade 5). Each grade is a world:
  Hatchling Hill, Fern Forest, Tar Pit Trail, Pterodactyl Peaks, Long-Neck Lake and Volcano Ridge.
- **The map** is a pop-up book of that grade's stages, one per Common Core skill (7 or 8 of them).
  Tap a stage and Rex walks the dotted path to it, then it starts. The walked part of the path
  turns red. "Next stage" at the end of a stage sends Rex on to the next one. When every stage
  has a star, a banner says the world is all explored.
- **A stage** is 10 problems. Every finished problem puts a star in the jar.
  Stage stars: 1 for finishing, 2 for 7 or more right on the first try, 3 for 9 or more.
  The best result is kept; stars are never taken away.

### Mistakes are forgiving

1. A wrong answer is "Oops, give it another try!" The wrong pterodactyl shakes its head and
   flies off, or a typed answer clears.
2. A picture of the problem appears (dots, ten-frames, tens and ones, egg rows, pies, number lines, coins…).
3. After a second miss Rex works it through in his speech bubble, only the right pterodactyl is left
   (or the answer appears faintly in the box), and the child still taps or types it.

Tries are unlimited. There are no lives and no game over.

### Calm or timed

**Calm** (the default) has no clock: the pterodactyls hover and wait. **Timed** works at any grade:
the pterodactyls swoop toward the nest, a little faster as the streak grows. If they reach it, Rex
chases them back up and the problem carries on. Nothing is lost.

### Getting harder and easier

Inside a stage there are three sizes of numbers. Five right in a row on the first try makes the
numbers bigger; needing Rex's help makes them smaller. The stage remembers where it got to.

## Grown-up settings

The red **Grown-ups** tab (the green grade tab opens it too). Saved on the device.

| Setting | Choices | Default |
|---|---|---|
| Grade | K · 1 · 2 · 3 · 4 · 5 | K |
| Answer style | Type the number · Pick from 3 | Type |
| Pace | Calm (no clock) · Timed | Calm |
| Picture help | After a miss · Always · Off | After a miss |
| Read aloud | On · Off | Off |
| Sound effects | On · Off (also the speaker tab) | Off |

There's also a "Start over" button that clears all stars. Some problems are always "pick"
(true or false, <, = or >, odd or even, which is bigger), even when typing is on.

## Typing

The on-screen pad has 1–5 on top and 6–0 below, a backspace and Go. Problems that need it also get
a **.** key (decimals), a **↓** key (to move from the top of a fraction to the bottom) or an **R** key
(remainders). A real keyboard works too: digits, `.`, Backspace, Enter, and `/` or Tab to jump to
the second box. In pick mode, arrow keys move between pterodactyls and Enter picks.

## The math

Stages follow the Common Core standards for each grade. The full list, with the standard codes, is
in `problems.js` and `design_artifacts/README.md`.

| World | Grade | Stages |
|---|---|---|
| Hatchling Hill | K | Count the eggs, more or fewer, add with pictures, break a number apart, make 10, teen numbers, quick facts to 5 |
| Fern Forest | 1 | Add and subtract within 20, missing number, true or false, compare numbers, add within 100, ten more / ten less |
| Tar Pit Trail | 2 | Facts to 20, add and subtract to 100 and 1000, 10 or 100 more or less, odd or even, rows of eggs, coins |
| Pterodactyl Peaks | 3 | Times tables, division facts, missing factor, times tens, rounding, add and subtract to 1000, fractions, area |
| Long-Neck Lake | 4 | Big adding and subtracting, multiply, divide with remainders, factors and primes, equivalent fractions, add and subtract fractions, tenths and hundredths |
| Volcano Ridge | 5 | Multi-digit multiply, divide by two digits, decimals, powers of ten, unlike denominators, multiply and divide fractions, parentheses |

`node tools/check-problems.js` makes 1,200 problems for every stage and checks every answer, choice
and typed answer. It runs before each deploy.

## Handy URLs for testing

- `?grade=2` switches to grade 2's map.
- `?play=3.1` opens grade 3, stage 1 (`?play=0.1` is the first kindergarten stage).

## Files

| File | What's in it |
|---|---|
| `index.html`, `style.css` | The page and the grown-up settings panel |
| `problems.js` | Worlds, stages and the problem generators (also used by the checker in Node) |
| `game.js` | Drawing, the pop-up book map, and gameplay |
| `audio.js` | Paper sound effects (Web Audio) and read-aloud (speech synthesis) |
| `design_artifacts/` | The art-style mockups from both rounds, and the decisions made |
