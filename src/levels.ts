/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { LevelConfig } from './types';

// Let's design 5 distinct levels using a robust pixel symbol map.
// Key symbols:
// '.' = Air
// '#' = Solid Ground block
// '=' = Ice block (slippery friction)
// '_' = One-way platform
// 'X' = Player spawn location (parsed during load, placed as empty space)
// '^' = Spike (upright)
// 'v' = Spike (downward)
// 'L' = Lava (lethal ground liquid)
// 'c' = Coin
// '*' = Secret Glow Star
// 'k' = Key
// 'g' = Locked Gate block
// 'S' = Springboard
// 'C' = Checkpoint flag
// 'P' = Portal (exit goal)
// 'u' = Gravity Up trigger (flipped gravity)
// 'd' = Gravity Down trigger (standard gravity)

export const LEVEL_TEMPLATES: LevelConfig[] = [
  {
    id: 1,
    name: '1. Pixel Journey',
    difficulty: 'Easy',
    gridWidth: 50,
    gridHeight: 12,
    tileSize: 16,
    background: {
      skyColor: '#1a103c',      // Dark twilight
      mountainColor: '#2d1e57', // Midnight Purple
      cloudColor: '#4f3a7a',
      groundColor: '#4d8f1e'   // Grass green
    },
    tilemap: [
      '..................................................',
      '..................................................',
      '..................................................',
      '.........................*........................',
      '................._......###.......................',
      '........_.......###................_....C.........',
      '......###........................#####..##.......P',
      '....######..^................^..........###....###',
      '..X.........#####........######......######...####',
      '######..#########...lL..#######L...L#######..#####',
      '######..#########...ll..#######l...l#######..#####',
      '######..#########...ll..#######l...l#######..#####',
    ],
    enemies: [
      { type: 'patrol', x: 120, y: 112, width: 14, height: 14, vx: 0.8, vy: 0, startX: 100, endX: 180 },
      { type: 'patrol', x: 420, y: 80, width: 14, height: 14, vx: -0.9, vy: 0, startX: 400, endX: 460 }
    ],
    movingPlatforms: [],
    timeLimit: 90,
    author: 'AI Designer'
  },
  {
    id: 2,
    name: '2. Glacier Springs',
    difficulty: 'Medium',
    gridWidth: 60,
    gridHeight: 12,
    tileSize: 16,
    background: {
      skyColor: '#0b1d3a',      // Arctic dark
      mountainColor: '#12315b', // Deep frost blue
      cloudColor: '#366096',
      groundColor: '#7ba7d7'   // Ice light blue
    },
    tilemap: [
      '............................................................',
      '............................................................',
      '....................................................*.......',
      '.........._......._................_...............###......',
      '........====.....====............====....k........#####.....',
      '..........................S..............##.....########....',
      '......X..........========...==...=========##...#########...P',
      '....====...^...^.========..====..==========#..##########..##',
      '..======..===============.======.========..#.###########.###',
      '========.================.======.========..#.###########.###',
      '========.================.======.========..#.###########.###',
      '========.================.======.========..#.###########.###',
    ],
    enemies: [
      { type: 'patrol', x: 200, y: 112, width: 14, height: 14, vx: 1.2, vy: 0, startX: 180, endX: 250 },
      { type: 'flyer', x: 380, y: 30, width: 12, height: 12, vx: 0, vy: 1.0, startX: 380, endX: 380 }, // vertical flyer
    ],
    movingPlatforms: [
      { x: 112, y: 96, width: 24, height: 8, startX: 112, startY: 96, endX: 176, endY: 96, speed: 1.0 }
    ],
    timeLimit: 120,
    author: 'AI Designer'
  },
  {
    id: 3,
    name: '3. Lava Gates',
    difficulty: 'Hard',
    gridWidth: 70,
    gridHeight: 12,
    tileSize: 16,
    background: {
      skyColor: '#2b0b0b',      // Fiery ember
      mountainColor: '#3d1212', // Inferno brown
      cloudColor: '#6d2626',
      groundColor: '#b43a12'   // Burning red
    },
    tilemap: [
      '......................................................................',
      '.......k..............................................................',
      '......##..............................................................',
      '......##........._.....C.................*............................',
      '......##..X......##...###...............###.......g......g...........P',
      '......#####..^..###..#####..##_##......#####.....###....###.........##',
      '.....######.######..######..#####.....#######...####....####.......###',
      '....#######.######.#######..###.##...########..#####....#####.....####',
      '..#########.######.#######..#...##..#########.######....######...#####',
      '###########LLLLLLL.LLLLLLL..#S..##LLLLLLLLLLL.LLLLLLLLLLLLLLLLLLL#####',
      '###########LLLLLLL.LLLLLLL..##..##LLLLLLLLLLL.LLLLLLLLLLLLLLLLLLL#####',
      '###########LLLLLLL.LLLLLLL..##..##LLLLLLLLLLL.LLLLLLLLLLLLLLLLLLL#####',
    ],
    enemies: [
      { type: 'patrol', x: 112, y: 80, width: 14, height: 14, vx: 1.0, vy: 0, startX: 80, endX: 144 },
      { type: 'shooter', x: 368, y: 80, width: 16, height: 14, vx: 0, vy: 0, startX: 368, endX: 368 }, // Cannon
      { type: 'flyer', x: 500, y: 40, width: 12, height: 12, vx: 1.2, vy: 0, startX: 430, endX: 520 },
    ],
    movingPlatforms: [
      { x: 256, y: 80, width: 24, height: 8, startX: 256, startY: 80, endX: 256, endY: 32, speed: 0.8 },
      { x: 336, y: 64, width: 24, height: 8, startX: 336, startY: 64, endX: 390, endY: 64, speed: 1.2 }
    ],
    timeLimit: 150,
    author: 'AI Designer'
  },
  {
    id: 4,
    name: '4. Gravity Shift',
    difficulty: 'Expert',
    gridWidth: 75,
    gridHeight: 12,
    tileSize: 16,
    background: {
      skyColor: '#0a0914',      // Deep outer space
      mountainColor: '#131124', // Nebula dark violet
      cloudColor: '#2b2152',
      groundColor: '#7c53c4'   // Glowing magenta
    },
    tilemap: [
      '###########################################################################',
      '#u......v......v..........#vvvvv##..............................vvvvv#....#',
      '#.........................#.....##...................................#....#',
      '#....__......_............#.....##.......*...........................#...P#',
      '#...####....###....C......#.....##......###.......C..................#..###',
      '#..#####..X#####..###.....#.....##.....#####......#..................#..###',
      '#.......###....######.....#d....##................#u..k..d..u..k..d..#..###',
      '#.........................####..##....#######....##########################',
      '#...............................##...#########............................#',
      '#L..^......^.......^......^.....##..##########..L.........................#',
      '#LLLLLLLLLLLLLLLLLLLLLLLLLLLLLLL##..##########LLLLLLLLLLLLLLLLLLLLLLLLLLLL#',
      '###########################################################################',
    ],
    enemies: [
      { type: 'shooter', x: 320, y: 96, width: 16, height: 14, vx: 0, vy: 0, startX: 320, endX: 320 },
      { type: 'patrol', x: 480, y: 96, width: 14, height: 14, vx: 1.5, vy: 0, startX: 450, endX: 550 },
      { type: 'jumper', x: 530, y: 96, width: 14, height: 14, vx: 1.2, vy: 0, startX: 480, endX: 580 }
    ],
    movingPlatforms: [
      { x: 192, y: 48, width: 24, height: 8, startX: 192, startY: 48, endX: 256, endY: 48, speed: 1.5 }
    ],
    timeLimit: 180,
    author: 'AI Designer'
  },
  {
    id: 5,
    name: '5. The Final Nexus',
    difficulty: 'Brutal',
    gridWidth: 80,
    gridHeight: 12,
    tileSize: 16,
    background: {
      skyColor: '#120215',      // Apocalyptic dark violet
      mountainColor: '#210526', // Doom dark orchid
      cloudColor: '#3c0a44',
      groundColor: '#eb2df7'   // Retro digital synth neon
    },
    tilemap: [
      '################################################################################',
      '#vvvvvvvvvvvvv#........##..#vvvvvvv#vvvvvvvvvv#.....................vvvvvvvvvvv#',
      '#.............#........##..#.......#..........#................................#',
      '#.............#........##..#.......#...g......#.........g..g..g................#',
      '#..X.........._...._...##..#k......#..###.....#........#########......C.......P#',
      '#.####...S....##..##...##..#####...#..###.....#.......###########....###.....###',
      '#.....########........S##..........#...#k.....#......#############..#####...####',
      '#..^...............^...##........S.#...##.....#.....###############.######.#####',
      '#..#########..#######..##..#####...####g###.._#_.._################.######.#####',
      '#LL#########LL#######LL##LL#####LLL########LL###LL#################.######.#####',
      '#LL#########LL#######LL##LL#####LLL########LL###LL#################.######.#####',
      '################################################################################',
    ],
    enemies: [
      { type: 'shooter', x: 160, y: 112, width: 16, height: 14, vx: 0, vy: 0, startX: 160, endX: 160 },
      { type: 'flyer', x: 260, y: 30, width: 12, height: 12, vx: 1.5, vy: 0, startX: 220, endX: 300 },
      { type: 'jumper', x: 420, y: 112, width: 14, height: 14, vx: 0.8, vy: 0, startX: 390, endX: 470 },
      { type: 'shooter', x: 580, y: 112, width: 16, height: 14, vx: 0, vy: 0, startX: 580, endX: 580 },
    ],
    movingPlatforms: [
      { x: 304, y: 64, width: 24, height: 8, startX: 304, startY: 64, endX: 304, endY: 32, speed: 1.2 },
      { x: 512, y: 80, width: 24, height: 8, startX: 512, startY: 80, endX: 560, endY: 80, speed: 1.4 }
    ],
    timeLimit: 200,
    author: 'AI Designer'
  }
];
