/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TileType =
  | 'empty'
  | 'solid'      // Regular ground block
  | 'brick'      // Breakable/decorative brick
  | 'ice'        // Low-friction block
  | 'oneway'     // Jump through from bottom, land on top
  | 'spike'      // Upward spike
  | 'spike-down' // Downward spike
  | 'lava'       // Dangerous liquid
  | 'spring'     // Bounces player high
  | 'key'        // Collectible to open gates
  | 'gate'       // Locked block, disappears when key is collected
  | 'coin'       // High-score collectible
  | 'star'       // Secret collectible
  | 'checkpoint' // Resets death location here
  | 'portal'     // End-of-level goal
  | 'gravity-up' // Flips gravity upwards
  | 'gravity-down'; // Standard gravity

export interface Point {
  x: number;
  y: number;
}

export interface Velocity {
  vx: number;
  vy: number;
}

export type PlayerState = 'idle' | 'running' | 'jumping' | 'falling' | 'sliding' | 'dead';

export interface Player {
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  facing: 'left' | 'right';
  state: PlayerState;
  grounded: boolean;
  canDoubleJump: boolean;
  onWall: 'left' | 'right' | null;
  spawnX: number;
  spawnY: number;
  isGravityFlipped: boolean;
  invulnFrames: number; // For taking damage
  dashCooldown: number;
  isDashing: boolean;
  dashTime: number;
}

export interface MovingPlatform {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  vx: number;
  vy: number;
  speed: number;
}

export interface Enemy {
  id: string;
  type: 'patrol' | 'flyer' | 'jumper' | 'shooter';
  x: number;
  y: number;
  width: number;
  height: number;
  vx: number;
  vy: number;
  startX: number;
  endX: number; // patrol bounds
  facing: 'left' | 'right';
  shootCooldown: number;
  jumpCooldown: number;
  hp: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  fromEnemy: boolean;
}

export interface Particle {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number; // max 1.0 down to 0.0
  decay: number;
  gravity: boolean;
}

export interface Collectible {
  id: string;
  type: 'coin' | 'star' | 'key' | 'heart';
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  collected: boolean;
  pulseOffset: number;
}

export interface Checkpoint {
  id: string;
  gridX: number;
  gridY: number;
  x: number;
  y: number;
  active: boolean;
}

export interface LevelConfig {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Expert' | 'Brutal';
  gridWidth: number;
  gridHeight: number;
  tileSize: number;
  background: {
    skyColor: string;
    mountainColor: string;
    cloudColor: string;
    groundColor: string;
  };
  tilemap: string[]; // Grid pattern
  enemies: Omit<Enemy, 'id' | 'facing' | 'shootCooldown' | 'jumpCooldown' | 'hp'>[];
  movingPlatforms: Omit<MovingPlatform, 'id' | 'vx' | 'vy'>[];
  timeLimit: number; // in seconds
  author: string;
}

export interface GameStats {
  score: number;
  coins: number;
  starsCollected: number;
  deaths: number;
  timeElapsed: number; // in seconds
  completedLevels: number[];
}
