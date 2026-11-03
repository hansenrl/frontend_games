# Dino Defenders

A pop-up book math game. Meteors are heading for Dino Valley, and each one carries a number.
Solve the problem, pick the right meteor (or type the answer), and Rex knocks it out of the sky.

Open `index.html` in a browser to play. No build step or server needed.

## How it plays

- **The map** is a pop-up book with six worlds, one per grade. Any world can be opened at any
  time. Rex walks the dotted path to the world you tap, and the walked part of the path turns
  red. When every level in a world has a star, Rex walks on to the next world by himself.
- **A world page** lists its levels (one per Common Core skill) with up to 3 stars each.
- **A level** is 10 problems. Every finished problem puts a star in the jar.
  Level stars: 1 for finishing, 2 for 7 or more right on the first try, 3 for 9 or more.
  The best result is kept; stars are never taken away.

### Mistakes are forgiving

1. A wrong answer is "Oops, give it another try!" The wrong meteor fades out, or a typed answer clears.
2. A picture of the problem appears (dots, ten-frames, tens and ones, egg rows, pies, number lines, coins…).
3. After a second miss Rex works it through in his speech bubble, only the right meteor is left
   (or the answer appears faintly in the box), and the child still taps or types it.

Tries are unlimited. There are no lives and no game over.

### Getting harder and easier

Inside a level there are three sizes of numbers. Five right in a row on the first try makes the
numbers bigger; needing Rex's help makes them smaller. The level remembers where it got to.

## Grown-up settings

The red **Grown-ups** tab. Each world has its own settings, saved on the device:

| Setting | Choices | Default |
|---|---|---|
| Answer style | Pick from 3 · Type the number | Pick for K–2, Type for 3–5 |
| Pace | Calm (meteors wait) · Zoom (they drift down; grade 3+ only) | Calm |
| Picture help | After a miss · Always · Off | After a miss |
| Read aloud | On · Off | On |

Sound effects can be turned off for every world, and there's a "Start over" button that clears
all stars. Some problems are always "pick" (true or false, <, = or >, odd or even, which is bigger).

## Typing

The on-screen pad has 1–5 on top and 6–0 below, a backspace and Go. Problems that need it also get
a **.** key (decimals), a **↓** key (to move from the top of a fraction to the bottom) or an **R** key
(remainders). A real keyboard works too: digits, `.`, Backspace, Enter, and `/` or Tab to jump to
the second box. In pick mode, arrow keys move between meteors and Enter picks.

## The math

Levels follow the Common Core standards for each grade. The full list, with the standard codes, is
in `problems.js` and `design_artifacts/README.md`.

| World | Grade | Levels |
|---|---|---|
| Hatchling Hill | K | Count the eggs, more or fewer, add with pictures, break a number apart, make 10, teen numbers, quick facts to 5 |
| Fern Forest | 1 | Add and subtract within 20, missing number, true or false, compare numbers, add within 100, ten more / ten less |
| Tar Pit Trail | 2 | Facts to 20, add and subtract to 100 and 1000, 10 or 100 more or less, odd or even, rows of eggs, coins |
| Pterodactyl Peaks | 3 | Times tables, division facts, missing factor, times tens, rounding, add and subtract to 1000, fractions, area |
| Long-Neck Lake | 4 | Big adding and subtracting, multiply, divide with remainders, factors and primes, equivalent fractions, add and subtract fractions, tenths and hundredths |
| Volcano Ridge | 5 | Multi-digit multiply, divide by two digits, decimals, powers of ten, unlike denominators, multiply and divide fractions, parentheses |

`node tools/check-problems.js` makes 1,200 problems for every level and checks every answer, choice
and typed answer. It runs before each deploy.

## Handy URLs for testing

- `?world=2` opens the grade 2 world page.
- `?play=3.1` opens grade 3, level 1 (`?play=0.1` is the first kindergarten level).

## Files

| File | What's in it |
|---|---|
| `index.html`, `style.css` | The page and the grown-up settings panel |
| `problems.js` | Worlds, levels and the problem generators (also used by the checker in Node) |
| `game.js` | Drawing, the pop-up book screens, and gameplay |
| `audio.js` | Paper sound effects (Web Audio) and read-aloud (speech synthesis) |
| `design_artifacts/` | The art-style mockups from both rounds, and the decisions made |
