/*
 * Level maps for Choo-Choo Junction.
 *
 * Map legend
 *   >  ^  v  <   start (train faces this way; leave 3 tiles of track for the carriages)
 *   @            station
 *   ?            a spot where the player puts a piece
 *   - | ┌ ┐ └ ┘ + fixed track
 *   .  grass    f  flowers   ~  water    s  sheep
 *   T  tree     R  rock      h  house    M  mountain
 *
 * pickups: [[x, y], ...] friends waiting on fixed track who must be picked up.
 * pieces:  which pieces are in the tray.
 *
 * Run `node tools/check-levels.js` after editing to make sure every level can be solved.
 */
(function (root) {
  'use strict';

  const LEVELS = [
    {
      name: 'First Turn',
      hint: 'Tap the ? spot, then pick a track piece. Press GO!',
      pieces: ['straight', 'curve'],
      map: [
        '.........',
        '.T....@..',
        '......|.f',
        '>-----?..',
        '..f....T.',
        '.s.......',
      ],
    },
    {
      name: 'Zig-Zag',
      hint: 'Two spots this time! Tap a piece again to turn it.',
      pieces: ['straight', 'curve'],
      map: [
        '.........',
        '.@----┐T.',
        '......|..',
        '>--?..?..',
        '.f.|..|.s',
        '...└--┘..',
      ],
    },
    {
      name: 'Little Bridge',
      hint: 'Trains can’t swim! Try a bridge.',
      pieces: ['straight', 'curve', 'bridge1'],
      map: [
        '.....~...',
        '..T..~...',
        '>---?~-@.',
        '.....~...',
        '.f...~.T.',
        '..s..~...',
      ],
    },
    {
      name: 'Big River',
      hint: 'How wide is the river? Count the water squares!',
      pieces: ['straight', 'curve', 'bridge1', 'bridge2'],
      map: [
        '....~~...',
        '.T..~~.f.',
        '>--?~~-@.',
        '....~~...',
        '.s..~~.T.',
        '....~~...',
      ],
    },
    {
      name: 'Over the Pond',
      hint: 'Bridges need to point the way the train is going.',
      pieces: ['straight', 'curve', 'bridge1', 'bridge2'],
      map: [
        '...~~..T.',
        '..┌~?┐...',
        '.f|~.|.s.',
        '@-┘~.|...',
        '>----?...',
        '..T....f.',
      ],
    },
    {
      name: 'Tunnel Time',
      hint: 'A tunnel goes right through a mountain.',
      pieces: ['straight', 'curve', 'bridge1', 'tunnel'],
      map: [
        '...MM....',
        '.T.MMM...',
        '>--?MMM-@',
        '...MMM.f.',
        '.s..M..T.',
        '.........',
      ],
    },
    {
      name: 'Big Jump',
      hint: 'Whee! A jump ramp flies over three squares.',
      pieces: ['straight', 'curve', 'bridge2', 'jump'],
      map: [
        '.........',
        '.T.h.T...',
        '>--?ThT-@',
        '...T.R...',
        '.s....f..',
        '.........',
      ],
    },
    {
      name: 'Friends Waiting',
      hint: 'Pick up the bunny before you get to the station!',
      pieces: ['straight', 'curve', 'bridge1'],
      pickups: [[4, 1]],
      map: [
        '.....T...',
        '...┌-┐...',
        '.T.|.|.s.',
        '>--?-@...',
        '.f.......',
        '......T..',
      ],
    },
    {
      name: 'Loop-de-Loop',
      hint: 'Go around the loop to get the friend. The crossing piece lets tracks cross!',
      pieces: ['straight', 'curve', 'cross'],
      pickups: [[6, 2]],
      map: [
        '.........',
        '....┌-┐..',
        '.T..|.|.f',
        '>---?-┘..',
        '....|..s.',
        '....└---@',
      ],
    },
    {
      name: 'Mixed Bag',
      hint: 'Mountains, rivers and turns. Which piece goes where?',
      pieces: ['straight', 'curve', 'bridge1', 'bridge2', 'tunnel', 'jump'],
      map: [
        '...MM..T.',
        '>--?MM┐..',
        '.T.MM.|.s',
        '..┌~~?┘..',
        'f.|~~...T',
        '@-?~.....',
      ],
    },
    {
      name: 'Sheep Hop',
      hint: 'Don’t bump the sheep!',
      pieces: ['straight', 'curve', 'bridge1', 'bridge2', 'jump'],
      pickups: [[3, 4]],
      map: [
        '.........',
        '>--?sss?.',
        '.T.....|.',
        '...┌~~?┘.',
        '.f.|...T.',
        '...?-┐...',
        '..s..@...',
      ],
    },
    {
      name: 'Grand Tour',
      hint: 'Everything all at once! Pick up both friends.',
      pieces: ['straight', 'curve', 'cross', 'bridge1', 'bridge2', 'tunnel', 'jump'],
      pickups: [[6, 2], [8, 2]],
      map: [
        '...┌-?MM┐.',
        '>--?--┐M|.',
        '.T.|.f|.|.',
        '...└~?┘.|.',
        '@--sTh?-?.',
        '..~~....T.',
        '.f.~~..s..',
      ],
    },
  ];

  if (typeof module === 'object' && module.exports) module.exports = LEVELS;
  else root.TRAIN_LEVELS = LEVELS;
})(typeof self !== 'undefined' ? self : this);
