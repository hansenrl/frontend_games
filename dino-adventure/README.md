# The Runaway Egg

A choose-your-own dinosaur story for early readers (about ages 5–7), in the paper-craft
style of the rest of the Family Game Shelf.

Rumble, rumble, BONK! An egg rolls down the hill and stops at Pip's feet. Pip (a young
Parasaurolophus with a very loud crest) picks a buddy and sets off to take the egg home to
Smoke Mountain. The surprise at the end: the rumbling was a worried T. rex mom stomping
around looking for her egg.

Open `index.html` in a browser to play. No build step needed.

## How it plays

- Each page has a picture, a few short lines, and 2–4 choices with a little picture on each.
- After a choice, a character answers before the page turns (and Pip earns a Brave, Kind or
  Clever star).
- A play-through is 12–13 pages. There are 22 pages in all, and 91,125 different ways through.
- The story branches and meets up again:
  - **Act 1:** the egg, Grandpa Longneck, picking a buddy (Tops, Zippy or Shelly), the fork in the path.
  - **Act 2:** the river path (crocodile logs, Baby Stego), the forest path (raptors, the glow cave),
    or the buddy's secret shortcut. Then everyone meets up at the hot springs, night camp and the giant footprints.
  - **Act 3:** Mama T. rex, the hatching, and naming the baby.
- **Five happy endings**, chosen by what happened along the way:
  - **Achoo!** if the egg got cold.
  - **The Big Song** if Pip learned the egg song.
  - **The Big Parade** with two or more friends made.
  - **Best Friends** for mostly kind choices.
  - **Home Sweet Home** otherwise.
- **The story remembers:**
  - Items in Pip's pouch (berries, a blue feather, moss, the egg song).
  - Friends made along the way.
  - How warm the egg is.
  - What you did. Your buddy brings it up at camp.
- **Secret choices** (gold, with a ⭐) only show up if you earned them earlier.
- The endings you've found are saved as stickers on the title page.

## Helping a new reader

- **Big words** (dinosaur names and so on) are orange and underlined. Tap one to hear it.
- 🗣️ reads the whole page out loud (uses the device's built-in voice).
- ↩ goes back a page, or undoes a choice.
- Tap the picture to make Pip TOOT.
- The story is saved as you go. "Keep reading" on the title page picks up where you left off.

## Files

| File | What's in it |
|---|---|
| `story.js` | Every page: words, choices, what each choice does, and how the ending is picked. Edit the story here. |
| `scenes.js` | The picture for every page (which characters, where, and how they move). |
| `art.js` | The paper-craft drawing kit: shapes, characters (Pip, the egg, T. rex, buddies...) and the paper cut-out painter. |
| `game.js` | Pages, choices, saving, sound effects, read-aloud and the animation loop. |
| `style.css` | Layout and paper styling. |
| `design_artifacts/` | Story ideas and the art-style mockups made before building. |

## Checking the story

```bash
node tools/check-story.js
```

It plays every path through the story and checks that every page has art, every path reaches an
ending within 7–20 pages, every page, choice and ending can be reached, and no line is longer than
12 words. It also runs before each deploy.

## Testing a page

Add `?page=<id>` to jump straight to a page, for example
`?page=a3_rex&buddy=zippy&items=feather&flags=song`. Other options: `friends=crocs,stego`,
`name=Chomp`, `warm=2`.
