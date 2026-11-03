/*
 * The Runaway Egg: every page of the story, its choices and what each choice does.
 *
 * Text is written for an early reader: short lines, one idea per line.
 * Words in *stars* are "big words" (dinosaur names and so on). The game shows them
 * in colour, and tapping one reads it out loud.
 *
 * {buddy} and {baby} are filled in with the buddy's name and the baby's name.
 *
 * A choice can have:
 *   icon, say         picture and words on the button (say can be a function of the state)
 *   react             lines shown after picking (a character answers), string[] or function
 *   next              id of the next page, or a function of the state
 *   if                function of the state; the choice only shows when it returns true
 *   secret            true for choices you earned earlier (shown with a star)
 *   star              'brave' | 'kind' | 'clever'
 *   give, take        item ids for Pip's pouch
 *   friend            a friend made on the way
 *   set               a flag to remember
 *   warm              how much warmer the egg gets
 *   buddy, name       picks the buddy / the baby's name
 *   sound             sound effect to play
 *
 * Checked by tools/check-story.js (every path, every ending, line length).
 */
(function (root) {
  'use strict';

  const BUDDIES = {
    tops: { name: 'Tops', kind: 'triceratops' },
    zippy: { name: 'Zippy', kind: 'pteranodon' },
    shelly: { name: 'Shelly', kind: 'ankylosaurus' },
  };

  const ITEMS = {
    berries: { icon: '🫐', name: 'Sweet berries' },
    feather: { icon: '🪶', name: 'Blue feather' },
    moss: { icon: '🌿', name: 'Soft moss' },
    song: { icon: '🎵', name: 'The egg song' },
  };

  const STARS = {
    brave: { icon: '💪', name: 'Brave', badge: 'You were so BRAVE!' },
    kind: { icon: '💚', name: 'Kind', badge: 'You were so KIND!' },
    clever: { icon: '💡', name: 'Clever', badge: 'You were so CLEVER!' },
  };

  const ENDINGS = [
    { id: 'end_home', title: 'Home Sweet Home', icon: '🏡' },
    { id: 'end_bff', title: 'Best Friends', icon: '💚' },
    { id: 'end_parade', title: 'The Big Parade', icon: '🎉' },
    { id: 'end_toot', title: 'The Big Song', icon: '🎵' },
    { id: 'end_achoo', title: 'Achoo!', icon: '🤧' },
  ];

  const FRIEND_LINES = {
    crocs: 'The *crocodiles* are there.',
    stego: 'Baby Stego and her mama are there.',
    raptors: 'The *raptors* are there.',
    glow: 'The glow worms are there. They light up the sky!',
  };

  const START = 's1_egg';

  function newState() {
    return {
      scene: START,
      buddy: null,
      name: null,
      stars: { brave: 0, kind: 0, clever: 0 },
      items: [],
      friends: [],
      flags: {},
      warm: 0,
      pages: 1,
    };
  }

  const has = (s, item) => s.items.includes(item);
  const B = (s) => (s.buddy ? BUDDIES[s.buddy].name : 'Your buddy');
  const N = (s) => s.name || 'The baby';

  function fill(str, s) {
    return str.replace(/\{buddy\}/g, B(s)).replace(/\{baby\}/g, N(s));
  }

  function pickEnding(s) {
    if (s.warm <= 0) return 'end_achoo';
    if (s.flags.song) return 'end_toot';
    if (s.friends.length >= 2) return 'end_parade';
    const { brave, kind, clever } = s.stars;
    if (kind >= brave && kind >= clever) return 'end_bff';
    return 'end_home';
  }

  function buddyMemory(s) {
    const b = B(s);
    let line = '"We make a good team, Pip."';
    if (s.friends.includes('crocs')) line = '"You asked a crocodile so nicely! That was brave."';
    else if (s.friends.includes('raptors')) line = '"You made friends with *raptors*. Wow!"';
    else if (s.friends.includes('stego')) line = '"You helped Baby Stego. That was kind."';
    else if (s.friends.includes('glow')) line = '"The glow worms helped us. So cool!"';
    else if (s.flags.smashed) line = '"I smashed those thorns! Did you see?"';
    else if (s.flags.loop) line = '"Did you see my loop the loop?"';
    else if (s.flags.counted) line = '"One hundred bones! I still can\'t count that high."';
    return [`"Huh? What?" says ${b}.`, `${b} sees the egg and smiles.`, line, '"It will hatch soon!"'];
  }

  const SCENES = {
    /* ---------------- Act 1: Fern Valley ---------------- */
    s1_egg: {
      title: 'The Runaway Egg',
      art: 'egg',
      text: [
        'This is Pip.',
        'Pip lives in Fern Valley.',
        'Rumble, rumble! The ground shakes.',
        'An egg rolls down the hill. BONK!',
        'It stops at Pip\'s feet.',
      ],
      choices: [
        { icon: '🥚', say: 'Pick it up.', star: 'kind', sound: 'tap',
          react: ['Pip hugs the egg.', 'It is warm!', 'Tap, tap, tap. Something is inside!'], next: 's2_grandpa' },
        { icon: '📯', say: 'Toot for help!', star: 'brave', sound: 'toot',
          react: ['TOOOOT!', 'Pip has a big, loud crest.', 'Far away, Grandpa *Longneck* hears it.'], next: 's2_grandpa' },
        { icon: '👀', say: 'Look up the hill.', star: 'clever', set: 'sawPrint',
          react: ['Pip looks up the hill.', 'There is a footprint. A BIG one!', 'Who made that?'], next: 's2_grandpa' },
      ],
    },

    s2_grandpa: {
      title: 'Grandpa Longneck',
      art: 'grandpa',
      text: [
        'Here comes Grandpa *Longneck*.',
        'He is so tall, he can see far away.',
        '"That egg is from Smoke Mountain," he says.',
        '"Take it home. Who will go with you?"',
      ],
      choices: [
        { icon: '💪', say: 'Tops. Tops is strong.', buddy: 'tops', give: 'berries',
          react: ['"Yes! A trip!" says Tops.', '"I am not scared of anything!"', 'Grandpa gives Pip berries for the trip.'], next: 's3_fork' },
        { icon: '☁️', say: 'Zippy. Zippy can fly.', buddy: 'zippy', give: 'berries',
          react: ['"Me? Me? Yay!" says Zippy.', '"I can fly up and find the way!"', 'Grandpa gives Pip berries for the trip.'], next: 's3_fork' },
        { icon: '🛡️', say: 'Shelly. Shelly is wise.', buddy: 'shelly', give: 'berries',
          react: ['Shelly nods. Slowly.', '"I know the old paths. Let\'s go."', 'Grandpa gives Pip berries for the trip.'], next: 's3_fork' },
      ],
    },

    s3_fork: {
      title: 'Which Way?',
      art: 'fork',
      text: (s) => [
        'The path splits in two.',
        'One way goes to the river.',
        'One way goes into the forest.',
        {
          tops: '"Or I can smash through the thorns!" says Tops.',
          zippy: '"Or I can fly up and look!" says Zippy.',
          shelly: '"Or we can take my secret tunnel," says Shelly.',
        }[s.buddy],
      ],
      choices: [
        { icon: '🌊', say: 'Go to the river.', next: 'r1_river' },
        { icon: '🌲', say: 'Go into the forest.', next: 'f1_forest' },
        { icon: '⭐', say: (s) => ({ tops: 'Smash the thorns!', zippy: 'Fly up and look!', shelly: 'Take the tunnel.' }[s.buddy]),
          next: (s) => 'b_' + s.buddy },
      ],
    },

    /* ---------------- Act 2: river path ---------------- */
    r1_river: {
      title: 'The Wobbly River',
      art: 'river',
      text: [
        'Here is the river. It is deep.',
        'Pip can not swim across.',
        'Three logs float in a row.',
        'Wait. Did that log just blink?',
      ],
      choices: [
        { icon: '👣', say: 'Hop on the logs!', star: 'brave', set: 'hopped', sound: 'splash',
          react: ['Hop! Hop! A log opens one big eye.', '"Hey! I am having a nap!"', 'The logs are *crocodiles*!', '"Fine, hop on," it grumbles. "No more jumping."'], next: 'r2_stego' },
        { icon: '🌉', say: 'Walk to the bridge.', star: 'clever',
          react: ['Pip walks to a tree that fell down.', 'It makes a bridge. Slow, but safe!', 'On the other side, someone is crying.'], next: 'r2_stego' },
        { icon: '🙏', say: 'Ask the logs nicely.', star: 'kind', friend: 'crocs',
          react: ['"Excuse me, logs. Can you help us?"', 'The logs open their eyes. *Crocodiles*!', '"You asked so nicely," says the big one.', '"Hop on! We will take you across."'], next: 'r2_stego' },
      ],
    },

    r2_stego: {
      title: 'Baby Stego',
      art: 'stego',
      text: [
        'On the other side, a baby *stegosaurus* is crying.',
        '"I can\'t find my mama!" she sobs.',
        'The egg wiggles. It wants to help too.',
      ],
      choices: [
        { icon: '🤗', say: 'Help her look.', star: 'kind', friend: 'stego',
          react: ['Pip and {buddy} look and look.', 'Behind a big bush... it is Mama Stego!', '"Thank you!" they say. "Come back and play!"'], next: 'j1_springs' },
        { icon: '📯', say: 'Toot for her mama!', star: 'brave', friend: 'stego', sound: 'toot',
          react: ['TOOOOT!', 'Far away, someone toots back.', 'Mama Stego runs to them. "My baby! Thank you!"'], next: 'j1_springs' },
        { icon: '👋', say: 'Wave bye and go on.', star: 'clever',
          react: ['"Sorry, we have to go," says Pip.', '"Follow the big tracks to your mama."', 'The baby waves bye-bye.'], next: 'j1_springs' },
      ],
    },

    /* ---------------- Act 2: forest path ---------------- */
    f1_forest: {
      title: 'The Dark Forest',
      art: 'forest',
      text: [
        'The forest is dark.',
        'Snap! Rustle, rustle!',
        'Three *raptors* jump out!',
        '"Ooh! An egg!" says the big one. "Can we have it?"',
      ],
      choices: [
        { icon: '🫐', say: 'Share the berries.', if: (s) => has(s, 'berries'), take: 'berries', give: 'feather', friend: 'raptors', star: 'kind',
          react: ['The *raptors* eat the berries. Yum, yum!', '"You are nice," they say.', 'They give Pip a blue feather.'], next: 'f2_cave' },
        { icon: '🙈', say: 'Play hide and seek!', star: 'clever', friend: 'raptors',
          react: ['Pip hides in a log.', 'The *raptors* look and look. They can\'t find Pip!', '"You win!" they say. "You can keep the egg."'], next: 'f2_cave' },
        { icon: '📯', say: 'Stand tall. TOOT!', star: 'brave', sound: 'toot',
          react: ['TOOOOOOT!', 'The *raptors* fall over. Bump, bump, bump!', '"Okay, okay! Keep your egg!"'], next: 'f2_cave' },
      ],
    },

    f2_cave: {
      title: 'The Glow Cave',
      art: 'cave',
      text: [
        'Now there is a cave. It is very dark.',
        'Look up! Tiny lights glow on the roof.',
        'They are glow worms!',
      ],
      choices: [
        { icon: '✨', say: 'Follow the lights.', star: 'clever', friend: 'glow',
          react: ['The glow worms make a path of light.', '"Thank you, glow worms!" says Pip.', 'They wiggle and glow even more.'], next: 'j1_springs' },
        { icon: '📯', say: 'Toot and listen.', star: 'brave', sound: 'toot',
          react: ['Toot... toot... toot...', 'The sound comes back from the way out.', 'Pip follows it. Out they go!'], next: 'j1_springs' },
      ],
    },

    /* ---------------- Act 2: buddy shortcuts ---------------- */
    b_tops: {
      title: 'The Thorn Wall',
      art: 'thorns',
      text: [
        'Here is a big wall of thorns.',
        'Ouch! They are sharp.',
        '"Stand back," says Tops. "I will smash it!"',
      ],
      choices: [
        { icon: '💥', say: 'Go, Tops, go!', star: 'brave', set: 'smashed', sound: 'crash',
          react: ['Tops runs. Stomp, stomp, stomp!', 'SMASH! CRASH!', 'Now there is a big hole. "Ta-da!" says Tops.'], next: 'j1_springs' },
        { icon: '🔍', say: 'Look for a gap.', star: 'clever', set: 'gap',
          react: ['Pip finds a little gap.', 'But Tops is too big for it!', 'So they dig it bigger, together.'], next: 'j1_springs' },
      ],
    },

    b_zippy: {
      title: 'Up in the Sky',
      art: 'sky',
      text: [
        'Zippy flies up, up, up!',
        '"I can see the river. I can see the forest."',
        '"And I can see Smoke Mountain!"',
      ],
      choices: [
        { icon: '➡️', say: 'Show us the way!', star: 'clever',
          react: ['"Follow me!" says Zippy.', 'Zippy finds a fast way.', 'Zoom, zoom!'], next: 'j1_springs' },
        { icon: '🔄', say: 'Do a loop!', star: 'brave', set: 'loop',
          react: ['Zippy does a loop the loop!', 'Pip claps. Wheee!', 'Then Zippy shows the way.'], next: 'j1_springs' },
      ],
    },

    b_shelly: {
      title: 'The Secret Tunnel',
      art: 'tunnel',
      text: [
        'Shelly finds the old tunnel.',
        'There are bones in the walls!',
        '"They are *fossils*," says Shelly. "Very, very old."',
      ],
      choices: [
        { icon: '🔢', say: 'Count the bones.', star: 'clever', set: 'counted',
          react: ['One, two, three... ten... one hundred!', 'Pip can\'t count them all.', 'Shelly laughs. "Me too."'], next: 'j1_springs' },
        { icon: '📯', say: 'Toot in the tunnel!', star: 'brave', sound: 'toot',
          react: ['TOOT! TOOT-OOT-OOT!', 'The tunnel toots back.', 'Pip and Shelly giggle all the way out.'], next: 'j1_springs' },
      ],
    },

    /* ---------------- Act 2: everyone meets up ---------------- */
    j1_springs: {
      title: 'The Hot Springs',
      art: 'springs',
      text: [
        'Next, Pip finds hot springs.',
        'The water bubbles. Blub, blub!',
        'Pip feels the egg. Oh no!',
        'The egg is cold.',
      ],
      choices: [
        { icon: '♨️', say: 'Warm it in the steam.', star: 'clever', warm: 2, sound: 'tap',
          react: ['Pip holds the egg in the warm steam.', 'Ahh. Nice and toasty!', 'Tap, tap! The egg says thank you.'], next: 'j2_camp' },
        { icon: '🌿', say: 'Wrap it in moss.', star: 'kind', warm: 1, give: 'moss',
          react: ['Pip wraps the egg in soft moss.', 'Snug as a bug in a rug!'], next: 'j2_camp' },
        { icon: '🏃', say: 'No time! Hurry on!', set: 'hurried',
          react: ['Pip runs fast. Puff, puff!', 'The egg is still a bit cold. Brrr.'], next: 'j2_camp' },
      ],
    },

    j2_camp: {
      title: 'Night Time',
      art: 'camp',
      text: [
        'Night comes. Out come the stars.',
        '{buddy} is fast asleep. Zzz.',
        'Then... wiggle, wiggle!',
        'The egg is moving!',
      ],
      choices: [
        { icon: '🎵', say: 'Sing it a song.', star: 'kind', set: 'song', give: 'song', sound: 'hum',
          react: ['Pip sings a soft song. La, la, loo.', 'The egg stops wiggling.', 'Tap... tap... tap. It likes the song!', 'Now Pip knows the egg song.'], next: 'j3_prints' },
        { icon: '🛏️', say: 'Tuck it in.', star: 'clever', warm: 1,
          react: (s) => [has(s, 'moss') ? 'Pip tucks the egg in the soft moss.' : 'Pip tucks the egg in a bed of ferns.', 'Warm and cozy.', 'Night night, egg.'], next: 'j3_prints' },
        { icon: '⏰', say: 'Wake up {buddy}!', set: 'woke', react: buddyMemory, next: 'j3_prints' },
      ],
    },

    j3_prints: {
      title: 'Big Footprints',
      art: 'prints',
      text: (s) => [
        'In the morning, Pip sees footprints.',
        'BIG footprints!',
        'Bigger than Grandpa *Longneck*\'s!',
        s.flags.sawPrint ? 'Pip saw one like this at home!' : 'They go up, up Smoke Mountain.',
      ],
      choices: [
        { icon: '👣', say: 'Follow the prints.', star: 'brave',
          react: ['Stomp, stomp.', 'Pip steps in a footprint.', 'It is as big as a pond!'], next: 'a3_rex' },
        { icon: '🧗', say: 'Climb the big rock.', star: 'clever',
          react: ['Pip climbs up high and looks.', 'Someone big is walking around and around.', 'VERY big.'], next: 'a3_rex' },
        { icon: '📯', say: 'Toot and listen.', star: 'brave', sound: 'roar',
          react: ['TOOT!', 'Far away, something says...', 'ROOOOAR!', 'Gulp.'], next: 'a3_rex' },
      ],
    },

    /* ---------------- Act 3: Smoke Mountain ---------------- */
    a3_rex: {
      title: 'Smoke Mountain',
      art: 'rex',
      text: [
        'At the top of Smoke Mountain, the ground shakes.',
        'A *T. rex* looks down at Pip.',
        'She is SO big!',
        'Sniff, sniff. She looks at the egg.',
      ],
      choices: [
        { icon: '🥚', say: 'Hold up the egg.', star: 'brave',
          react: ['Pip holds the egg up high.', 'The *T. rex* gasps!'], next: 'a3_mama' },
        { icon: '🙈', say: 'Hide behind a rock.', star: 'clever', set: 'hid',
          react: ['Pip hides behind a rock.', 'Sniff, sniff. "I can see your crest," says the *T. rex*.', 'Oops!'], next: 'a3_mama' },
        { icon: '🎵', say: 'Sing the egg song.', secret: true, if: (s) => !!s.flags.song, star: 'kind', sound: 'hum',
          react: ['Pip sings the egg song. La, la, loo.', 'The egg wiggles and taps.', 'The *T. rex* smiles. "That is MY song!"'], next: 'a3_mama' },
        { icon: '🪶', say: 'Give her the feather.', secret: true, if: (s) => has(s, 'feather'), take: 'feather', star: 'kind',
          react: ['Pip gives her the blue feather.', '"Oh! For me?" she says.', '"It is so pretty. Thank you."'], next: 'a3_mama' },
      ],
    },

    a3_mama: {
      title: 'The Big Surprise',
      art: 'mama',
      text: [
        '"My egg! You found my egg!"',
        '"I lost it. I looked and looked."',
        '"I stomped all over the place."',
        'So THAT was the rumble!',
      ],
      next: 'a3_hatch',
    },

    a3_hatch: {
      title: 'Crack, Crack!',
      art: 'hatch',
      text: (s) => [
        'Crack! Crack! The egg is hatching!',
        'Out pops a baby *T. rex*!',
        s.warm >= 3 ? 'It giggles. Hee, hee, hee!' : s.warm <= 0 ? 'It sniffles. Sniff, sniff.' : 'It yawns a big yawn.',
        '"Mama?" it says to Pip.',
      ],
      choices: [
        { icon: '🤗', say: 'Give it a hug.', star: 'kind',
          react: ['Pip gives the baby a big hug.', '"I am not your mama. I am Pip!"', '"Pip!" says the baby. "Pip, Pip, Pip!"'], next: 'a3_name' },
        { icon: '👆', say: 'Show it its mama.', star: 'clever',
          react: ['Pip points up. "THAT is your mama!"', 'The baby looks up, up, up.', '"MAMA!" Mama gives it a big lick.'], next: 'a3_name' },
        { icon: '📯', say: 'Toot hello!', star: 'brave', sound: 'toot',
          react: ['"Toot!" says Pip.', '"Squeak!" says the baby.', 'It wants to toot too!'], next: 'a3_name' },
      ],
    },

    a3_name: {
      title: 'A Name',
      art: 'name',
      text: [
        'Mama *T. rex* smiles at Pip.',
        '"Thank you, Pip."',
        '"Will you pick a name for my baby?"',
      ],
      choices: [
        { icon: '🦷', say: 'Chomp!', name: 'Chomp', sound: 'cheer',
          react: ['"Chomp! I love it!" says Mama.', 'Chomp claps tiny hands.'], next: pickEnding },
        { icon: '🥜', say: 'Peanut!', name: 'Peanut', sound: 'cheer',
          react: ['"Peanut! I love it!" says Mama.', 'Peanut claps tiny hands.'], next: pickEnding },
        { icon: '⚡', say: 'Rumble!', name: 'Rumble', sound: 'cheer',
          react: ['"Rumble! I love it!" says Mama.', 'Rumble claps tiny hands.'], next: pickEnding },
      ],
    },

    /* ---------------- Endings ---------------- */
    end_achoo: {
      title: 'Achoo!', art: 'end_achoo', end: true,
      text: [
        'Oh no. {baby} has a cold.',
        'The egg got too chilly!',
        '"Ah... ah... ah..." ACHOO!',
        'The sneeze blows Pip over. TOOOOT!',
        'Everyone laughs. Then they keep {baby} warm and cozy.',
      ],
    },
    end_toot: {
      title: 'The Big Song', art: 'end_toot', end: true,
      text: [
        'Pip sings the egg song. La, la, loo!',
        '{baby} sings too. Squeak, squeak!',
        'Then Mama sings. ROOOAR!',
        'It is the best, loudest song ever.',
      ],
    },
    end_parade: {
      title: 'The Big Parade', art: 'end_parade', end: true,
      text: (s) => [
        'Pip and {buddy} go home to Fern Valley.',
        'Look! Everyone is there.',
        ...s.friends.map((f) => FRIEND_LINES[f]),
        '"Hooray for Pip!"',
      ],
    },
    end_bff: {
      title: 'Best Friends', art: 'end_bff', end: true,
      text: [
        'The next day, guess who comes to play?',
        'It is {baby}!',
        'Pip and {baby} play all day.',
        'They are best friends.',
      ],
    },
    end_home: {
      title: 'Home Sweet Home', art: 'end_home', end: true,
      text: [
        'Mama gives Pip and {buddy} a ride home.',
        'Up on her head! Wheee!',
        'Now Fern Valley is quiet.',
        'Mama walks on tiptoe. Tip, tip, tip.',
      ],
    },
  };

  /* ---------------- helpers shared by the game and the checker ---------------- */
  const val = (v, s) => (typeof v === 'function' ? v(s) : v);
  const lines = (v, s) => (val(v, s) || []).map((l) => fill(l, s));

  function textFor(s) { return lines(SCENES[s.scene].text, s); }
  function choicesFor(s) {
    const sc = SCENES[s.scene];
    return (sc.choices || []).filter((c) => !c.if || c.if(s));
  }
  function labelFor(c, s) { return fill(val(c.say, s), s); }
  function applyChoice(s, c) {
    if (c.star) s.stars[c.star]++;
    if (c.take) s.items = s.items.filter((i) => i !== c.take);
    if (c.give && !s.items.includes(c.give)) s.items.push(c.give);
    if (c.friend && !s.friends.includes(c.friend)) s.friends.push(c.friend);
    if (c.set) s.flags[c.set] = true;
    if (c.warm) s.warm += c.warm;
    if (c.buddy) s.buddy = c.buddy;
    if (c.name) s.name = c.name;
    return s;
  }
  function reactFor(c, s) { return c.react ? lines(c.react, s) : null; }
  function nextFor(c, s) { return val(c ? c.next : SCENES[s.scene].next, s); }
  function goTo(s, id) { s.scene = id; s.pages++; return s; }
  function topStar(s) {
    const order = ['kind', 'brave', 'clever'];
    return order.reduce((a, b) => (s.stars[b] > s.stars[a] ? b : a), order[0]);
  }

  const api = {
    BUDDIES, ITEMS, STARS, ENDINGS, SCENES, START,
    newState, textFor, choicesFor, labelFor, applyChoice, reactFor, nextFor, goTo, pickEnding, topStar, fill,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.STORY = api;
})(this);
