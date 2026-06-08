/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  RotateCcw,
  Volume2,
  VolumeX,
  Music,
  ArrowLeft,
  Tv,
  HelpCircle,
  Trophy,
  Activity,
  Maximize2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Player,
  TileType,
  MovingPlatform,
  Enemy,
  Projectile,
  Particle,
  Collectible,
  Checkpoint,
  LevelConfig,
  GameStats
} from '../types';
import { soundEffects } from '../sound';

interface GameCanvasProps {
  level: LevelConfig;
  onLevelComplete: (stats: { score: number; coins: number; stars: number; deaths: number; time: number }) => void;
  onExit: () => void;
}

export default function GameCanvas({ level, onLevelComplete, onExit }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Game states in React for overlays
  const [isPaused, setIsPaused] = useState(false);
  const [deaths, setDeaths] = useState(0);
  const [coinsCollected, setCoinsCollected] = useState(0);
  const [starsCollected, setStarsCollected] = useState(0);
  const [score, setScore] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [hasKey, setHasKey] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [levelWon, setLevelWon] = useState(false);
  const [showTutorial, setShowTutorial] = useState(true);
  const [soundOn, setSoundOn] = useState(soundEffects.isSoundEnabled());
  const [musicOn, setMusicOn] = useState(soundEffects.isMusicEnabled());

  // Game engine refs (to avoid stale closures in frame loops)
  const playerRef = useRef<Player>({
    x: 32,
    y: 32,
    width: 10,
    height: 14,
    vx: 0,
    vy: 0,
    facing: 'right',
    state: 'idle',
    grounded: false,
    canDoubleJump: true,
    onWall: null,
    spawnX: 32,
    spawnY: 32,
    isGravityFlipped: false,
    invulnFrames: 0,
    dashCooldown: 0,
    isDashing: false,
    dashTime: 0
  });

  const collectiblesRef = useRef<Collectible[]>([]);
  const checkpointsRef = useRef<Checkpoint[]>([]);
  const movingPlatformsRef = useRef<MovingPlatform[]>([]);
  const enemiesRef = useRef<Enemy[]>([]);
  const projectilesRef = useRef<Projectile[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysPressed = useRef<{ [key: string]: boolean }>({});
  
  // Grid/World ref
  const levelGrid = useRef<TileType[][]>([]);
  const cameraRef = useRef({ x: 0, y: 0, shakeFrames: 0, shakeIntensity: 0 });

  // Timing
  const timerRef = useRef<number>(0);
  const frameCountRef = useRef(0);
  const requestRef = useRef<number | null>(null);
  const levelEndedRef = useRef(false);

  // Initialize and reload Level Map
  const loadLevel = () => {
    levelEndedRef.current = false;
    timerRef.current = 0;
    setCurrentTime(0);
    setCoinsCollected(0);
    setStarsCollected(0);
    setScore(0);
    setHasKey(false);
    setIsGameOver(false);
    setLevelWon(false);

    // Parse Tilemap Grid
    const grid: TileType[][] = [];
    const colls: Collectible[] = [];
    const checks: Checkpoint[] = [];
    let startX = 32;
    let startY = 32;

    for (let r = 0; r < level.gridHeight; r++) {
      const row: TileType[] = [];
      const rowChars = level.tilemap[r] || '';
      for (let c = 0; c < level.gridWidth; c++) {
        const char = rowChars[c] || '.';
        let type: TileType = 'empty';

        // Translate symbol to TileType
        if (char === '#') type = 'solid';
        else if (char === '=') type = 'ice';
        else if (char === '_') type = 'oneway';
        else if (char === '^') type = 'spike';
        else if (char === 'v') type = 'spike-down';
        else if (char === 'L') type = 'lava';
        else if (char === 'S') type = 'spring';
        else if (char === 'k') {
          type = 'empty'; // Item handled below
          colls.push({
            id: `key-${r}-${c}`,
            type: 'key',
            gridX: c,
            gridY: r,
            x: c * level.tileSize + level.tileSize / 2,
            y: r * level.tileSize + level.tileSize / 2,
            collected: false,
            pulseOffset: Math.random() * Math.PI
          });
        } else if (char === 'g') {
          type = 'gate';
        } else if (char === 'c') {
          type = 'empty'; // Item handled below
          colls.push({
            id: `coin-${r}-${c}`,
            type: 'coin',
            gridX: c,
            gridY: r,
            x: c * level.tileSize + level.tileSize / 2,
            y: r * level.tileSize + level.tileSize / 2,
            collected: false,
            pulseOffset: Math.random() * Math.PI
          });
        } else if (char === '*') {
          type = 'empty'; // Item handled below
          colls.push({
            id: `star-${r}-${c}`,
            type: 'star',
            gridX: c,
            gridY: r,
            x: c * level.tileSize + level.tileSize / 2,
            y: r * level.tileSize + level.tileSize / 2,
            collected: false,
            pulseOffset: Math.random() * Math.PI
          });
        } else if (char === 'C') {
          type = 'empty'; // Flag handled below
          checks.push({
            id: `checkpoint-${r}-${c}`,
            gridX: c,
            gridY: r,
            x: c * level.tileSize + level.tileSize / 2,
            y: r * level.tileSize + level.tileSize / 2,
            active: false
          });
        } else if (char === 'P') {
          type = 'portal';
        } else if (char === 'u') {
          type = 'gravity-up';
        } else if (char === 'd') {
          type = 'gravity-down';
        } else if (char === 'X') {
          startX = c * level.tileSize + 3;
          startY = r * level.tileSize + 1;
          type = 'empty';
        }

        row.push(type);
      }
      grid.push(row);
    }

    levelGrid.current = grid;
    collectiblesRef.current = colls;
    checkpointsRef.current = checks;
    projectilesRef.current = [];
    particlesRef.current = [];

    // Reset player
    playerRef.current = {
      x: startX,
      y: startY,
      width: 10,
      height: 14,
      vx: 0,
      vy: 0,
      facing: 'right',
      state: 'idle',
      grounded: false,
      canDoubleJump: true,
      onWall: null,
      spawnX: startX,
      spawnY: startY,
      isGravityFlipped: false,
      invulnFrames: 0,
      dashCooldown: 0,
      isDashing: false,
      dashTime: 0
    };

    // Load Moving Platforms from configuration template
    movingPlatformsRef.current = level.movingPlatforms.map((p, idx) => ({
      ...p,
      id: `mp-${idx}`,
      vx: p.speed,
      vy: 0
    }));

    // Load Enemies
    enemiesRef.current = level.enemies.map((e, idx) => ({
      ...e,
      id: `enemy-${idx}`,
      facing: 'left',
      shootCooldown: Math.random() * 60,
      jumpCooldown: Math.random() * 80 + 40,
      hp: e.type === 'shooter' ? 2 : 1
    }));

    cameraRef.current = { x: 0, y: 0, shakeFrames: 0, shakeIntensity: 0 };
  };

  useEffect(() => {
    loadLevel();
  }, [level]);

  // Audio switches triggers
  const toggleSound = () => {
    const nextVal = !soundOn;
    setSoundOn(nextVal);
    soundEffects.toggleSound(nextVal);
  };

  const toggleMusic = () => {
    const nextVal = !musicOn;
    setMusicOn(nextVal);
    soundEffects.toggleMusic(nextVal);
  };

  // Keyboard Event Handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      // Block scrolling
      if (['arrowup', 'arrowdown', ' ', 'arrowleft', 'arrowright'].includes(e.key)) {
        e.preventDefault();
      }
      keysPressed.current[k] = true;
      keysPressed.current[e.key] = true;

      // Single triggers
      if (e.key === 'p' || e.key === 'Escape') {
        setIsPaused(prev => !prev);
        soundEffects.playCollect();
      }
      if (k === 'r') {
        triggerRespawn(false);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Standard Respawns
  const triggerRespawn = (died: boolean) => {
    const player = playerRef.current;
    
    // Camera shake
    cameraRef.current.shakeFrames = 15;
    cameraRef.current.shakeIntensity = 5;

    // Particles splash
    spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, '#ff3e3e', 24);

    if (died) {
      setDeaths(d => d + 1);
      soundEffects.playDie();
    } else {
      soundEffects.playHurt();
    }

    // Teleport player back to nearest valid spawn location (e.g. active checkpoint)
    player.x = player.spawnX;
    player.y = player.spawnY;
    player.vx = 0;
    player.vy = 0;
    player.isGravityFlipped = false;
    player.invulnFrames = 30; // brief invulnerability
    player.isDashing = false;
    player.dashTime = 0;
  };

  // Particle Emitters
  const spawnExplosion = (x: number, y: number, color: string, count = 10) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 2.5 + 0.5;
      particlesRef.current.push({
        id: `p-${Math.random()}`,
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (Math.random() * 0.8),
        color,
        size: Math.random() * 2 + 1,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02,
        gravity: true
      });
    }
  };

  const spawnDashTrail = (x: number, y: number) => {
    particlesRef.current.push({
      id: `dash-${Math.random()}`,
      x,
      y,
      vx: (Math.random() - 0.5) * 0.5,
      vy: (Math.random() - 0.5) * 0.5,
      color: 'rgba(255, 255, 255, 0.7)',
      size: Math.random() * 3 + 1,
      life: 0.8,
      decay: 0.08,
      gravity: false
    });
  };

  // Game Physics Loop
  const updateGame = () => {
    if (isPaused || isGameOver || levelWon || levelEndedRef.current) return;

    frameCountRef.current++;
    
    // Speedrun timer
    timerRef.current += 1 / 60;
    if (frameCountRef.current % 60 === 0) {
      setCurrentTime(Math.floor(timerRef.current));
    }

    const player = playerRef.current;
    const grid = levelGrid.current;
    const size = level.tileSize;

    // Invulnerability frames
    if (player.invulnFrames > 0) {
      player.invulnFrames--;
    }

    // Gravity flip adjustments
    const gravityDir = player.isGravityFlipped ? -1 : 1;
    const gravityAcc = 0.35 * gravityDir;
    const terminalVelocity = 6.0;

    // Movement Key Actions
    const leftActive = keysPressed.current['arrowleft'] || keysPressed.current['a'];
    const rightActive = keysPressed.current['arrowright'] || keysPressed.current['d'];
    const jumpActive = keysPressed.current['arrowup'] || keysPressed.current['w'] || keysPressed.current[' '];
    const downActive = keysPressed.current['arrowdown'] || keysPressed.current['s'];
    const dashActive = keysPressed.current['shift'] || keysPressed.current['j'] || keysPressed.current['x'];

    // Handle Dash action
    if (player.dashCooldown > 0) player.dashCooldown--;

    if (dashActive && player.dashCooldown === 0 && !player.isDashing) {
      player.isDashing = true;
      player.dashTime = 10; // active for 10 frames
      player.dashCooldown = 45; // cooldown
      player.vx = player.facing === 'right' ? 5.5 : -5.5;
      player.vy = 0;
      soundEffects.playDoubleJump();
      spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, '#fff', 8);
    }

    if (player.isDashing) {
      player.dashTime--;
      spawnDashTrail(player.x + player.width / 2, player.y + player.height / 2);
      if (player.dashTime <= 0) {
        player.isDashing = false;
        player.vx *= 0.5; // decelerate smoothly
      }
    }

    // Ground and friction logic
    let playerTileUnder: TileType = 'empty';
    const pxGrid = Math.floor((player.x + player.width / 2) / size);
    const pyGridUnder = Math.floor((player.y + (player.isGravityFlipped ? -2 : player.height + 2)) / size);
    
    if (pxGrid >= 0 && pxGrid < level.gridWidth && pyGridUnder >= 0 && pyGridUnder < level.gridHeight) {
      playerTileUnder = grid[pyGridUnder][pxGrid];
    }

    const friction = playerTileUnder === 'ice' ? 0.98 : player.grounded ? 0.8 : 0.94;

    // Apply forces horizontally if NOT dashing
    if (!player.isDashing) {
      if (leftActive) {
        player.vx -= 0.38;
        if (player.vx < -3.2) player.vx = -3.2;
        player.facing = 'left';
      } else if (rightActive) {
        player.vx += 0.38;
        if (player.vx > 3.2) player.vx = 3.2;
        player.facing = 'right';
      } else {
        player.vx *= friction;
        if (Math.abs(player.vx) < 0.1) player.vx = 0;
      }

      // Apply Gravity
      player.vy += gravityAcc;
      if (player.isGravityFlipped) {
        if (player.vy < -terminalVelocity) player.vy = -terminalVelocity;
      } else {
        if (player.vy > terminalVelocity) player.vy = terminalVelocity;
      }
    }

    // Compute player vertical movement & bounding box collision
    player.y += player.vy;
    resolveVerticalCollisions(player, grid, size);

    // Compute player horizontal movement & collisions
    player.x += player.vx;
    resolveHorizontalCollisions(player, grid, size);

    // Wall slide check
    player.onWall = null;
    if (!player.grounded && !player.isDashing) {
      const wallCheckDist = 2;
      const leftWallBox = { x: player.x - wallCheckDist, y: player.y + 2, width: wallCheckDist, height: player.height - 4 };
      const rightWallBox = { x: player.x + player.width, y: player.y + 2, width: wallCheckDist, height: player.height - 4 };

      if (checkStaticSolidCollisions(leftWallBox, grid, size)) {
        player.onWall = 'left';
      } else if (checkStaticSolidCollisions(rightWallBox, grid, size)) {
        player.onWall = 'right';
      }

      if (player.onWall) {
        // Friction slide downwards
        const slideMaxSpeed = 1.0;
        if (player.isGravityFlipped) {
          if (player.vy < -slideMaxSpeed) player.vy = -slideMaxSpeed;
        } else {
          if (player.vy > slideMaxSpeed) player.vy = slideMaxSpeed;
        }
      }
    }

    // JUMP INPUT LOGIC
    if (jumpActive) {
      if (keysPressed.current['jumpJustPressed'] !== true) {
        keysPressed.current['jumpJustPressed'] = true;

        if (player.grounded) {
          player.vy = player.isGravityFlipped ? 5.8 : -5.8;
          player.grounded = false;
          soundEffects.playJump();
          spawnExplosion(player.x + player.width / 2, player.y + (player.isGravityFlipped ? 0 : player.height), '#00ffcc', 6);
        } else if (player.onWall) {
          // Wall jump diagonal bounce
          const bounceDir = player.onWall === 'left' ? 1 : -1;
          player.vx = bounceDir * 3.8;
          player.vy = player.isGravityFlipped ? 4.8 : -4.8;
          player.facing = player.onWall === 'left' ? 'right' : 'left';
          player.onWall = null;
          soundEffects.playJump();
          spawnExplosion(player.x + (bounceDir < 0 ? 0 : player.width), player.y + player.height / 2, '#ffffff', 8);
        } else if (player.canDoubleJump) {
          // Double jump
          player.vy = player.isGravityFlipped ? 5.2 : -5.2;
          player.canDoubleJump = false;
          soundEffects.playDoubleJump();
          spawnExplosion(player.x + player.width / 2, player.y + player.height / 2, '#ffcc00', 10);
        }
      }
    } else {
      keysPressed.current['jumpJustPressed'] = false;
    }

    // Update Moving Platforms
    movingPlatformsRef.current.forEach(p => {
      // Linear shift
      p.x += p.vx;
      p.y += p.vy;

      // Reverse at boundary
      const distFromStart = Math.sqrt(Math.pow(p.x - p.startX, 2) + Math.pow(p.y - p.startY, 2));
      const totalPath = Math.sqrt(Math.pow(p.endX - p.startX, 2) + Math.pow(p.endY - p.startY, 2));

      if (totalPath > 0 && distFromStart >= totalPath) {
        p.vx = -p.vx;
        p.vy = -p.vy;
      }

      // Carry player along vertically or horizontally if riding on platform
      const rideBuffer = 3;
      const isRiding = 
        player.x + player.width > p.x &&
        player.x < p.x + p.width &&
        Math.abs((player.y + player.height) - p.y) <= rideBuffer &&
        !player.isGravityFlipped;

      if (isRiding) {
        player.x += p.vx;
        player.y = p.y - player.height;
        player.grounded = true;
        player.canDoubleJump = true;
      }
    });

    // Update Enemies
    enemiesRef.current.forEach(e => {
      if (e.type === 'patrol') {
        e.x += e.vx;
        if (e.x <= e.startX || e.x + e.width >= e.endX) {
          e.vx = -e.vx;
          e.facing = e.vx > 0 ? 'right' : 'left';
        }
      } else if (e.type === 'flyer') {
        // Sine wave vertical floating or patrol
        if (e.startX === e.endX) {
          // Pure vertical float
          e.y += e.vy;
          if (e.y < 20 || e.y > 140) {
            e.vy = -e.vy;
          }
        } else {
          e.x += e.vx;
          if (e.x <= e.startX || e.x + e.width >= e.endX) {
            e.vx = -e.vx;
          }
          // Hover wave
          e.y += Math.sin(frameCountRef.current / 15) * 0.4;
        }
      } else if (e.type === 'jumper') {
        e.x += e.vx;
        if (e.x <= e.startX || e.x + e.width >= e.endX) {
          e.vx = -e.vx;
        }
        
        // Jumps on timer if grounded
        e.vy += 0.25;
        e.y += e.vy;

        // Check floor
        const enemyBottomGridY = Math.floor((e.y + e.height) / size);
        const enemyCenterGridX = Math.floor((e.x + e.width/2)/size);
        if (enemyBottomGridY >= 0 && enemyBottomGridY < level.gridHeight &&
            enemyCenterGridX >= 0 && enemyCenterGridX < level.gridWidth) {
          if (grid[enemyBottomGridY][enemyCenterGridX] === 'solid') {
            e.y = enemyBottomGridY * size - e.height;
            e.vy = 0;
            e.jumpCooldown--;
            if (e.jumpCooldown <= 0) {
              e.vy = -4.5; // Jump!
              e.jumpCooldown = Math.random() * 80 + 50;
            }
          }
        }
      } else if (e.type === 'shooter') {
        // Heavy turret shooter
        e.shootCooldown--;
        if (e.shootCooldown <= 0) {
          e.shootCooldown = 110 + Math.random() * 40; // timing interval
          const toRight = player.x > e.x;
          projectilesRef.current.push({
            x: toRight ? e.x + e.width + 2 : e.x - 8,
            y: e.y + e.height / 2 - 2,
            vx: toRight ? 2.2 : -2.2,
            vy: 0,
            width: 6,
            height: 4,
            fromEnemy: true
          });
          soundEffects.playLaser();
        }
      }

      // Check player damage collision against enemy body
      if (checkBoundingBoxCollision(player, e) && player.invulnFrames === 0) {
        // Can bounce off patrol heads if landing from above
        const isLandingOnHead = 
          !player.isGravityFlipped && 
          player.vy > 0 && 
          player.y + player.height - player.vy <= e.y + 4;

        if (isLandingOnHead && e.type !== 'shooter') {
          player.vy = -4.5;
          player.canDoubleJump = true;
          // Splat effect
          spawnExplosion(e.x + e.width/2, e.y, '#f59e0b', 8);
          soundEffects.playSpring();
          // damage/bounce enemy out of grid
          e.hp--;
        } else {
          // Take regular spike-style damage
          triggerRespawn(true);
        }
      }
    });

    // Remove dead enemies
    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0 && e.y < level.gridHeight * size + 20);

    // Update projectiles
    projectilesRef.current.forEach(proj => {
      proj.x += proj.vx;
      proj.y += proj.vy;

      // Projectile hit player
      if (checkBoundingBoxCollision(player, proj)) {
        if (player.invulnFrames === 0) {
          triggerRespawn(true);
        }
        proj.x = -1000; // dispose
      }

      // Collide with terrain blocks
      const projGX = Math.floor(proj.x / size);
      const projGY = Math.floor(proj.y / size);
      if (projGX >= 0 && projGX < level.gridWidth && projGY >= 0 && projGY < level.gridHeight) {
        if (grid[projGY][projGX] === 'solid') {
          proj.x = -1000; // remove
          spawnExplosion(proj.x, proj.y, '#ff4400', 3);
        }
      }
    });
    // Filter active projectiles
    projectilesRef.current = projectilesRef.current.filter(p => p.x > 0 && p.x < level.gridWidth * size);

    // Collectibles & Flag Triggers Checks
    collectiblesRef.current.forEach(c => {
      if (c.collected) return;

      const collBox = { x: c.x - 6, y: c.y - 6, width: 12, height: 12 };
      if (checkBoundingBoxCollision(player, collBox)) {
        c.collected = true;
        
        if (c.type === 'coin') {
          setCoinsCollected(prev => prev + 1);
          setScore(prev => prev + 100);
          soundEffects.playCollect();
          spawnExplosion(c.x, c.y, '#fbbf24', 6);
        } else if (c.type === 'star') {
          setStarsCollected(prev => prev + 1);
          setScore(prev => prev + 500);
          soundEffects.playCollectStar();
          spawnExplosion(c.x, c.y, '#a855f7', 12);
        } else if (c.type === 'key') {
          setHasKey(true);
          soundEffects.playCollectStar();
          spawnExplosion(c.x, c.y, '#38bdf8', 12);
          
          // Clear all gates on map
          for (let r = 0; r < level.gridHeight; r++) {
            for (let cols = 0; cols < level.gridWidth; cols++) {
              if (grid[r][cols] === 'gate') {
                grid[r][cols] = 'empty';
                spawnExplosion(cols * size + size/2, r * size + size/2, '#06b6d4', 8);
              }
            }
          }
          soundEffects.playGateOpen();
        }
      }
    });

    // Checkpoints activation triggers
    checkpointsRef.current.forEach(cp => {
      const flagBox = { x: cp.x - 8, y: cp.y - 12, width: 16, height: 20 };
      if (checkBoundingBoxCollision(player, flagBox) && !cp.active) {
        // Disengage other checkpoints
        checkpointsRef.current.forEach(other => other.active = false);

        cp.active = true;
        player.spawnX = cp.x;
        player.spawnY = cp.y - 4;
        soundEffects.playCheckpoint();
        spawnExplosion(cp.x, cp.y, '#34d399', 15);
      }
    });

    // Handle interactive platformer blocks (Springs, Portals, Lava, Gravity)
    const pCenterGX = Math.floor((player.x + player.width / 2) / size);
    const pCenterGY = Math.floor((player.y + player.height / 2) / size);
    
    if (pCenterGX >= 0 && pCenterGX < level.gridWidth && pCenterGY >= 0 && pCenterGY < level.gridHeight) {
      const tile = grid[pCenterGY][pCenterGX];

      if (tile === 'portal') {
        handleGoalMet();
      } else if (tile === 'gravity-up' && !player.isGravityFlipped) {
        player.isGravityFlipped = true;
        player.vy = -1.0;
        soundEffects.playSpring();
        spawnExplosion(player.x + player.width/2, player.y + player.height/2, '#d946ef', 12);
      } else if (tile === 'gravity-down' && player.isGravityFlipped) {
        player.isGravityFlipped = false;
        player.vy = 1.0;
        soundEffects.playSpring();
        spawnExplosion(player.x + player.width/2, player.y + player.height/2, '#6366f1', 12);
      }
    }

    // Check lower boundaries death (pit of death) or top boundaries if gravity flipped
    const outOfBoundsBottom = player.y > (level.gridHeight + 1) * size;
    const outOfBoundsTop = player.y < -size * 2;
    
    if (outOfBoundsBottom || (player.isGravityFlipped && outOfBoundsTop)) {
      triggerRespawn(true);
    }

    // Update Particles
    particlesRef.current.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      if (p.gravity) {
        p.vy += 0.1; // modest gravity descent
      }
      p.life -= p.decay;
    });

    // Remove dead particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
  };

  const handleGoalMet = () => {
    if (levelEndedRef.current) return;
    levelEndedRef.current = true;
    setLevelWon(true);
    soundEffects.playVictory();
    
    // Animate teleportation explosion
    const player = playerRef.current;
    spawnExplosion(player.x + player.width/2, player.y + player.height/2, '#a855f7', 35);
    
    setTimeout(() => {
      onLevelComplete({
        score: score + 1000 + Math.max(0, (level.timeLimit - currentTime) * 10),
        coins: coinsCollected,
        stars: starsCollected,
        deaths,
        time: currentTime
      });
    }, 1800);
  };

  // Static collision checks
  const checkStaticSolidCollisions = (box: { x: number; y: number; width: number; height: number }, grid: TileType[][], size: number): boolean => {
    const xStart = Math.max(0, Math.floor(box.x / size));
    const xEnd = Math.min(level.gridWidth - 1, Math.floor((box.x + box.width) / size));
    const yStart = Math.max(0, Math.floor(box.y / size));
    const yEnd = Math.min(level.gridHeight - 1, Math.floor((box.y + box.height) / size));

    for (let r = yStart; r <= yEnd; r++) {
      for (let c = xStart; c <= xEnd; c++) {
        const type = grid[r][c];
        if (type === 'solid' || type === 'brick' || type === 'gate') {
          return true;
        }
      }
    }
    return false;
  };

  // Dynamic Horizontal Collisions Solver
  const resolveHorizontalCollisions = (player: Player, grid: TileType[][], size: number) => {
    const xStart = Math.max(0, Math.floor(player.x / size));
    const xEnd = Math.min(level.gridWidth - 1, Math.floor((player.x + player.width) / size));
    const yStart = Math.max(0, Math.floor(player.y / size));
    const yEnd = Math.min(level.gridHeight - 1, Math.floor((player.y + player.height) / size));

    for (let r = yStart; r <= yEnd; r++) {
      for (let c = xStart; c <= xEnd; c++) {
        const tile = grid[r][c];
        if (tile === 'solid' || tile === 'brick' || tile === 'gate') {
          // Snap out
          if (player.vx > 0) {
            player.x = c * size - player.width - 0.05;
            player.vx = 0;
          } else if (player.vx < 0) {
            player.x = (c + 1) * size + 0.05;
            player.vx = 0;
          }
        }
      }
    }
  };

  // Dynamic Vertical Collisions Solver
  const resolveVerticalCollisions = (player: Player, grid: TileType[][], size: number) => {
    const xStart = Math.max(0, Math.floor(player.x / size));
    const xEnd = Math.min(level.gridWidth - 1, Math.floor((player.x + player.width) / size));
    const yStart = Math.max(0, Math.floor(player.y / size));
    const yEnd = Math.min(level.gridHeight - 1, Math.floor((player.y + player.height) / size));

    player.grounded = false;

    for (let r = yStart; r <= yEnd; r++) {
      for (let c = xStart; c <= xEnd; c++) {
        const tile = grid[r][c];
        
        // Hazard deaths instant checks
        if (tile === 'spike' || tile === 'spike-down' || tile === 'lava') {
          const buffer = tile === 'spike' ? 4 : 2;
          const damageBox = { 
            x: c * size + buffer, 
            y: r * size + (tile === 'spike' ? 6 : 0), 
            width: size - (buffer * 2), 
            height: size - 6 
          };
          if (checkBoundingBoxCollision(player, damageBox)) {
            triggerRespawn(true);
            return;
          }
        }

        // Spring acceleration
        if (tile === 'spring') {
          const springBox = { x: c * size, y: r * size + 4, width: size, height: size - 4 };
          if (checkBoundingBoxCollision(player, springBox)) {
            player.vy = player.isGravityFlipped ? 8.2 : -8.2;
            player.grounded = false;
            player.canDoubleJump = true;
            soundEffects.playSpring();
            spawnExplosion(c * size + size/2, r * size + size/2, '#fb7185', 15);
            return;
          }
        }

        // Solid grounds snaps
        if (tile === 'solid' || tile === 'brick' || tile === 'gate' || tile === 'ice') {
          if (player.isGravityFlipped) {
            // Flipped gravity block check (hits ceiling tile as landing)
            if (player.vy < 0) {
              player.y = (r + 1) * size + 0.05;
              player.vy = 0;
              player.grounded = true;
              player.canDoubleJump = true;
            } else if (player.vy > 0) { // Bump head from below
              player.y = r * size - player.height - 0.05;
              player.vy = 0;
            }
          } else {
            // Standard gravity
            if (player.vy > 0) { // Land on top
              player.y = r * size - player.height - 0.05;
              player.vy = 0;
              player.grounded = true;
              player.canDoubleJump = true;
            } else if (player.vy < 0) { // Bump head
              player.y = (r + 1) * size + 0.05;
              player.vy = 0;
            }
          }
        }

        // Semi-solid one way platforms handling
        if (tile === 'oneway' && !player.isGravityFlipped) {
          const platformTopY = r * size;
          // Block only if player is moving down AND player foot is near platform top
          if (player.vy > 0 && (player.y + player.height - player.vy <= platformTopY + 3)) {
            player.y = platformTopY - player.height - 0.01;
            player.vy = 0;
            player.grounded = true;
            player.canDoubleJump = true;
          }
        }
      }
    }
  };

  const checkBoundingBoxCollision = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number }
  ): boolean => {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  };

  // Rendering graphics on Canvas Node
  const renderGame = (ctx: CanvasRenderingContext2D) => {
    const player = playerRef.current;
    const grid = levelGrid.current;
    const size = level.tileSize;
    const worldWidth = level.gridWidth * size;
    const worldHeight = level.gridHeight * size;

    // Viewport dimensions
    const viewWidth = ctx.canvas.width;
    const viewHeight = ctx.canvas.height;

    // Camera side scrolling
    let targetCamX = player.x + player.width / 2 - viewWidth / 2;
    // Bind camera boundaries
    targetCamX = Math.max(0, Math.min(worldWidth - viewWidth, targetCamX));

    // Smooth camera damping
    cameraRef.current.x += (targetCamX - cameraRef.current.x) * 0.15;
    cameraRef.current.y = 0; // standard horizontal sidescroller, fixed Y height

    // Implement Camera screen shakes
    if (cameraRef.current.shakeFrames > 0) {
      cameraRef.current.shakeFrames--;
      cameraRef.current.x += (Math.random() - 0.5) * cameraRef.current.shakeIntensity;
      cameraRef.current.y += (Math.random() - 0.5) * cameraRef.current.shakeIntensity;
    }

    const camX = Math.floor(cameraRef.current.x);
    const camY = Math.floor(cameraRef.current.y);

    // 1. Draw Parallax Background Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, viewHeight);
    skyGrad.addColorStop(0, level.background.skyColor);
    skyGrad.addColorStop(1, '#0e0824');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, viewWidth, viewHeight);

    // Dynamic Parallax silhouettes: Mountains and hills
    // Back Layer mountains (scrolled at 10% speed)
    ctx.fillStyle = level.background.mountainColor + '44'; // semi transparent pre-blend
    ctx.beginPath();
    const backMountScroll = camX * 0.12 % viewWidth;
    ctx.moveTo(-backMountScroll, viewHeight);
    ctx.lineTo(80 - backMountScroll, viewHeight * 0.4);
    ctx.lineTo(200 - backMountScroll, viewHeight);
    ctx.lineTo(280 - backMountScroll, viewHeight * 0.35);
    ctx.lineTo(380 - backMountScroll, viewHeight);
    ctx.lineTo(500 - backMountScroll, viewHeight * 0.5);
    ctx.lineTo(600 - backMountScroll, viewHeight);
    ctx.fill();

    // Front Layer Hills (scrolled at 35% speed)
    ctx.fillStyle = level.background.mountainColor;
    ctx.beginPath();
    const hillScroll = camX * 0.35 % viewWidth;
    ctx.moveTo(-hillScroll, viewHeight);
    ctx.lineTo(40 - hillScroll, viewHeight * 0.7);
    ctx.lineTo(130 - hillScroll, viewHeight * 0.6);
    ctx.lineTo(220 - hillScroll, viewHeight);
    ctx.lineTo(310 - hillScroll, viewHeight * 0.75);
    ctx.lineTo(400 - hillScroll, viewHeight * 0.58);
    ctx.lineTo(500 - hillScroll, viewHeight);
    ctx.lineTo(640 - hillScroll, viewHeight * 0.65);
    ctx.lineTo(800 - hillScroll, viewHeight);
    ctx.fill();

    // Draw little pixelated circular stars or space dust particles in sky if sky is dark
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    const randSeed = level.id * 105;
    for (let sIdx = 0; sIdx < 15; sIdx++) {
      const starX = ((sIdx * 43 + randSeed) % viewWidth);
      const starY = ((sIdx * 19 + randSeed) % (viewHeight - 40));
      ctx.fillRect(starX, starY, 1, 1);
    }

    // Translate to local scroll camera coordinate system
    ctx.save();
    ctx.translate(-camX, -camY);

    // 2. Draw level environment Grid
    for (let r = 0; r < level.gridHeight; r++) {
      for (let c = 0; c < level.gridWidth; c++) {
        const tile = grid[r][c];
        if (tile === 'empty') continue;

        const tx = c * size;
        const ty = r * size;

        // Clip out tiles that are not currently in viewport bounds
        if (tx + size < camX || tx > camX + viewWidth) continue;

        if (tile === 'solid') {
          // Structured retro pixel bricks
          ctx.fillStyle = level.background.groundColor;
          ctx.fillRect(tx, ty, size, size);
          
          // Draw neat pixel cross grids and top surface light edge
          ctx.fillStyle = '#ffffff3c';
          ctx.fillRect(tx, ty, size, 2); // Highlight
          ctx.fillRect(tx, ty, 2, size);
          ctx.fillStyle = '#0000004c';
          ctx.fillRect(tx + size - 2, ty, 2, size); // Shadow
          ctx.fillRect(tx, ty + size - 2, size, 2);

          // Brick pattern cracks
          ctx.fillStyle = '#00000022';
          ctx.fillRect(tx + size/2, ty + 2, 1, size - 4);
          ctx.fillRect(tx + 2, ty + size/2, size/2, 1);
          ctx.fillRect(tx + size/2 + 2, ty + size/2 + 3, size/2 - 4, 1);
        } else if (tile === 'ice') {
          // Frozen blue blocks
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(tx, ty, size, size);
          
          // Glossy shines
          ctx.fillStyle = '#e0f2fe';
          ctx.fillRect(tx + 2, ty + 2, size - 4, 2);
          ctx.fillRect(tx + 2, ty + 2, 2, size - 4);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(tx + size - 3, ty + 2, 2, size - 4);
          ctx.fillRect(tx + 2, ty + size - 3, size - 4, 2);
        } else if (tile === 'oneway') {
          // Slatted thin wooden scaffold platform
          ctx.fillStyle = '#c2410c';
          ctx.fillRect(tx, ty, size, 5);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(tx, ty, size, 2); // border highlight
          
          // Ribs
          ctx.fillStyle = '#7c2d12';
          ctx.fillRect(tx + 2, ty + 2, 2, 3);
          ctx.fillRect(tx + size - 4, ty + 2, 2, 3);
        } else if (tile === 'spike') {
          // Sharp ground spikes
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(tx, ty + size);
          ctx.lineTo(tx + size/2, ty + 3);
          ctx.lineTo(tx + size, ty + size);
          ctx.fill();
          // Shadow/Refractions outline
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (tile === 'spike-down') {
          // Sharp roof spikes
          ctx.fillStyle = '#94a3b8';
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + size/2, ty + size - 3);
          ctx.lineTo(tx + size, ty);
          ctx.fill();
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else if (tile === 'spring') {
          // Crimson springpad
          ctx.fillStyle = '#e11d48';
          ctx.fillRect(tx + 1, ty + size - 6, size - 2, 6);
          ctx.fillStyle = '#fda4af';
          ctx.fillRect(tx + 2, ty + size - 5, size - 4, 2); // Coiled pad highlight
        } else if (tile === 'gate') {
          // Glowing lock digital gates
          ctx.fillStyle = '#0891b2';
          ctx.fillRect(tx, ty, size, size);
          // Laser grids
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx + 2, ty + 2, size - 4, size - 4);
          // Lock symbol
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(tx + 6, ty + 8, 4, 4);
          ctx.fillRect(tx + 7, ty + 5, 2, 3);
        } else if (tile === 'lava') {
          // Fluid dangerous lava loop animation
          const animateHeight = Math.sin((frameCountRef.current + tx * 3) / 10) * 1.5;
          ctx.fillStyle = '#fe5f01';
          ctx.fillRect(tx, ty + 3 + animateHeight, size, size - 3);
          
          ctx.fillStyle = '#fdbb00';
          ctx.fillRect(tx, ty + animateHeight, size, 3); // Lava foam crest
        } else if (tile === 'checkpoint') {
          // Checkpoints handled separately in loop
        } else if (tile === 'portal') {
          // Dynamic swirling black-hole portal goal
          const rotAngle = frameCountRef.current * 0.04;
          const centerX = tx + size/2;
          const centerY = ty + size/2;
          
          ctx.save();
          ctx.translate(centerX, centerY);
          ctx.rotate(rotAngle);
          
          // Outermost orbit
          ctx.fillStyle = 'rgba(168, 85, 247, 0.4)';
          ctx.fillRect(-10, -10, 20, 20);
          ctx.rotate(-rotAngle*1.5);
          ctx.fillStyle = 'rgba(14, 165, 233, 0.6)';
          ctx.fillRect(-7, -7, 14, 14);
          
          // Core
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(-4, -4, 8, 8);
          ctx.restore();
        } else if (tile === 'gravity-up') {
          // Up arrows trigger zone
          const flash = Math.abs(Math.sin(frameCountRef.current / 8)) * 0.4 + 0.3;
          ctx.fillStyle = `rgba(217, 70, 239, ${flash})`;
          ctx.fillRect(tx, ty, size, size);
          
          // White arrows points up
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(tx + size/2, ty + 2);
          ctx.lineTo(tx + 3, ty + 9);
          ctx.lineTo(tx + size - 3, ty + 9);
          ctx.fill();
        } else if (tile === 'gravity-down') {
          // Down arrows trigger zone
          const flash = Math.abs(Math.sin(frameCountRef.current / 8)) * 0.4 + 0.3;
          ctx.fillStyle = `rgba(99, 102, 241, ${flash})`;
          ctx.fillRect(tx, ty, size, size);
          
          // White arrows points down
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(tx + size/2, ty + size - 2);
          ctx.lineTo(tx + 3, ty + size - 9);
          ctx.lineTo(tx + size - 3, ty + size - 9);
          ctx.fill();
        }
      }
    }

    // 3. Draw Checkpoints Flags
    checkpointsRef.current.forEach(cp => {
      // Flagpole
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(cp.x - 1, cp.y - 12, 2, 16);
      
      const isAct = cp.active;
      // Waving cloth geometry
      const wave = Math.sin((frameCountRef.current + cp.x) / 8) * 2;
      ctx.fillStyle = isAct ? '#10b981' : '#ef4444'; // green active, red standby
      ctx.beginPath();
      ctx.moveTo(cp.x, cp.y - 12);
      ctx.lineTo(cp.x + 8, cp.y - 10 + wave);
      ctx.lineTo(cp.x, cp.y - 6);
      ctx.fill();

      // Pulsing lantern under active checkpoint
      if (isAct) {
        ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.beginPath();
        ctx.arc(cp.x, cp.y - 4, 8 + Math.abs(wave), 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 4. Draw Moving Platforms
    movingPlatformsRef.current.forEach(p => {
      ctx.fillStyle = '#475569'; // Slate armor design
      ctx.fillRect(p.x, p.y, p.width, p.height);
      
      // Iron rivet highlights
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(p.x + 2, p.y + 2, 2, 2);
      ctx.fillRect(p.x + p.width - 4, p.y + 2, 2, 2);
      
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(p.x, p.y + p.height - 2, p.width, 2); // shadow
    });

    // 5. Draw Collectibles (with sin-wave pulsing motion)
    collectiblesRef.current.forEach(c => {
      if (c.collected) return;

      const offset = Math.sin(frameCountRef.current * 0.08 + c.pulseOffset) * 2;
      const drawY = c.y + offset;

      if (c.type === 'coin') {
        // Octagonal gold coins
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(c.x, drawY, 4, 0, Math.PI * 2);
        ctx.fill();
        // Inner shine
        ctx.fillStyle = '#fffbeb';
        ctx.fillRect(c.x - 1, drawY - 2, 2, 2);
      } else if (c.type === 'star') {
        // Glowing purple cosmic shard stars
        ctx.fillStyle = '#d946ef';
        ctx.beginPath();
        ctx.moveTo(c.x, drawY - 5);
        ctx.lineTo(c.x + 4, drawY);
        ctx.lineTo(c.x, drawY + 5);
        ctx.lineTo(c.x - 4, drawY);
        ctx.fill();
        // core
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(c.x - 1.5, drawY - 1.5, 3, 3);
      } else if (c.type === 'key') {
        // Blue gate keys
        ctx.fillStyle = '#38bdf8';
        // handle Ring
        ctx.beginPath();
        ctx.arc(c.x, drawY - 3, 3, 0, Math.PI*2);
        ctx.fill();
        ctx.fillStyle = level.background.skyColor; // cut circle inside
        ctx.beginPath();
        ctx.arc(c.x, drawY - 3, 1, 0, Math.PI*2);
        ctx.fill();
        
        // key stem
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(c.x - 1, drawY, 2, 6);
        ctx.fillRect(c.x, drawY + 4, 3, 2); // teeth
      }
    });

    // 6. Draw Projectiles
    projectilesRef.current.forEach(p => {
      ctx.fillStyle = '#f43f5e'; // neon crimson
      ctx.fillRect(p.x, p.y, p.width, p.height);
      ctx.fillStyle = '#ffe4e6'; // bright core
      ctx.fillRect(p.x + 1, p.y + 1, p.width - 2, p.height - 2);
    });

    // 7. Draw Enemies
    enemiesRef.current.forEach(e => {
      const wobble = Math.sin(frameCountRef.current / (e.type === 'flyer' ? 6 : 10)) * 2;
      
      if (e.type === 'patrol') {
        // Spiky heavy snail-crab patrol
        ctx.fillStyle = '#d97706';
        ctx.fillRect(e.x, e.y + 2, e.width, e.height - 2);
        // Spikes shell
        ctx.fillStyle = '#7c2d12';
        ctx.fillRect(e.x + 2, e.y, e.width - 4, 3);
        // Angry eye
        ctx.fillStyle = '#fff';
        const eyeOffsetX = e.facing === 'left' ? 2 : e.width - 4;
        ctx.fillRect(e.x + eyeOffsetX, e.y + 4, 2, 2);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.x + eyeOffsetX + (e.facing === 'left' ? 0 : 1), e.y + 4, 1, 1);
      } else if (e.type === 'flyer') {
        // Airborne robotic floating bat
        ctx.fillStyle = '#9333ea';
        ctx.fillRect(e.x, e.y, e.width, e.height);
        
        // Animated flapping bat wings
        ctx.fillStyle = '#ddf';
        const wingH = wobble > 0 ? -4 : 4;
        ctx.beginPath();
        ctx.moveTo(e.x, e.y + 2);
        ctx.lineTo(e.x - 5, e.y + wingH);
        ctx.lineTo(e.x, e.y + 6);
        ctx.moveTo(e.x + e.width, e.y + 2);
        ctx.lineTo(e.x + e.width + 5, e.y + wingH);
        ctx.lineTo(e.x + e.width, e.y + 6);
        ctx.fill();

        // Glowing red cyber eyes
        ctx.fillStyle = '#ff003c';
        ctx.fillRect(e.x + 3, e.y + 3, 2, 2);
        ctx.fillRect(e.x + e.width - 5, e.y + 3, 2, 2);
      } else if (e.type === 'jumper') {
        // Springy green electronic frog-slime
        ctx.fillStyle = '#16a34a'; // dark slime green
        ctx.fillRect(e.x, e.y, e.width, e.height);
        ctx.fillStyle = '#4ade80'; // high-contrast top
        ctx.fillRect(e.x + 1, e.y, e.width - 2, 3);

        // Face
        ctx.fillStyle = '#000';
        ctx.fillRect(e.x + 2, e.y + 4, 2, 2);
        ctx.fillRect(e.x + e.width - 4, e.y + 4, 2, 2);
      } else if (e.type === 'shooter') {
        // Heavy armor robotic static Defense Cannon
        ctx.fillStyle = '#334155';
        ctx.fillRect(e.x, e.y + 3, e.width, e.height - 3); // base
        // Turret gun barrel pointing at player
        const toRight = player.x > e.x;
        ctx.fillStyle = '#1e293b';
        if (toRight) {
          ctx.fillRect(e.x + e.width - 2, e.y + 5, 5, 4);
        } else {
          ctx.fillRect(e.x - 3, e.y + 5, 5, 4);
        }
        // Glowing alert red center gem
        const alertFlash = Math.sin(frameCountRef.current / 5) > 0 ? '#ff1d53' : '#475569';
        ctx.fillStyle = alertFlash;
        ctx.fillRect(e.x + 5, e.y, 6, e.height - 6);
      }
    });

    // 8. Draw Player character (8-bit style)
    if (player.invulnFrames % 4 < 2) { // flashing effect on damage
      ctx.save();
      
      // Determine color
      let playerColor = '#f43f5e'; // classic hero neon pinkish red
      if (player.isDashing) playerColor = '#e0f2fe'; // frosty dynamic white trail inside dash
      
      ctx.fillStyle = playerColor;
      
      // Face direction flip
      ctx.translate(player.x + player.width/2, player.y + player.height/2);
      if (player.facing === 'left') {
        ctx.scale(-1, 1);
      }

      // Check if gravity is flipped down or up
      if (player.isGravityFlipped) {
        ctx.scale(1, -1);
      }

      // Character body box
      ctx.fillRect(-player.width / 2, -player.height / 2, player.width, player.height);

      // Hero Headscarf tail flow (animated wobble)
      const tailWobble = Math.sin(frameCountRef.current / 6) * 2;
      ctx.fillStyle = '#fddf47'; // golden headscarf
      ctx.fillRect(-player.width/2 - 3, -player.height/2 + 2 + tailWobble, 3, 2);
      ctx.fillRect(-player.width/2, -player.height/2, player.width, 2); // scarf top band

      // Cool pixel visor glasses
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(player.width/2 - 4, -player.height/2 + 3, 4, 3);
      ctx.fillStyle = '#22d3ee'; // neon azure eyes shine
      ctx.fillRect(player.width/2 - 2, -player.height/2 + 4, 2, 1);

      // Simple walking feet logic
      if (player.vx !== 0 && player.grounded) {
        ctx.fillStyle = '#ffffff';
        const walkPhase = Math.sin(frameCountRef.current / 4) > 0;
        if (walkPhase) {
          ctx.fillRect(-player.width/2 + 1, player.height/2, 2, 2); // Left leg forward
        } else {
          ctx.fillRect(player.width/2 - 3, player.height/2, 2, 2); // Right leg forward
        }
      } else if (!player.grounded) {
        // Jumping legs bent
        ctx.fillStyle = '#e2e8f0';
        ctx.fillRect(-player.width/2 + 1, player.height/2 - 1, 2, 1);
        ctx.fillRect(player.width/2 - 3, player.height/2 - 1, 2, 1);
      }

      ctx.restore();
    }

    // 9. Draw Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = `rgba(${p.color.startsWith('#') ? hexToRgb(p.color) : p.color}, ${p.life})`;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    ctx.restore(); // camera translate restore
  };

  // Helper inside renderer
  const hexToRgb = (hex: string): string => {
    const clean = hex.replace('#', '');
    const r = parseInt(clean.substring(0, 2), 16) || 255;
    const g = parseInt(clean.substring(2, 4), 16) || 255;
    const b = parseInt(clean.substring(4, 6), 16) || 255;
    return `${r}, ${g}, ${b}`;
  };

  // Main canvas refresh timer frame
  useEffect(() => {
    let active = true;

    const tick = () => {
      if (!active) return;
      
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Keep crisp retro scaling mode
          ctx.imageSmoothingEnabled = false;

          // Update state and re-render
          updateGame();
          renderGame(ctx);
        }
      }

      // Sync React metadata periodically
      if (frameCountRef.current % 12 === 0) {
        const player = playerRef.current;
        setHasKey(player.isGravityFlipped ? false : keysPressed.current['hasKey'] || hasKey);
      }

      requestRef.current = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      active = false;
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, isGameOver, levelWon]);

  // Touch handlers for responsive mobile triggers
  const handleTouchStart = (btn: string) => {
    keysPressed.current[btn] = true;
    keysPressed.current[btn.toLowerCase()] = true;
  };

  const handleTouchEnd = (btn: string) => {
    keysPressed.current[btn] = false;
    keysPressed.current[btn.toLowerCase()] = false;
  };

  return (
    <div className="relative w-full h-[525px] bg-[#0d0221] border-4 border-[#ff00ff] rounded-2xl overflow-hidden shadow-[0_0_35px_rgba(255,0,255,0.25)] flex flex-col font-mono select-none" id="retro-game-frame">
      {/* Game Visual Top HUD Overlay */}
      <div className="h-10 border-b-2 border-[#00f5ff]/30 bg-[#1a1a2e]/95 px-4 flex items-center justify-between text-xs text-[#00f5ff] font-mono z-10" id="game-hud">
        <div className="flex items-center gap-4" id="hud-stats-left">
          <span className="flex items-center gap-1.5" id="stat-level-name">
            <Tv size={13} className="text-[#00f5ff]" />
            <span className="text-white font-bold uppercase tracking-tight">{level.name}</span>
          </span>
          <span className="flex items-center gap-1 text-[#39ff14]" id="stat-coins">
            <span className="w-2 h-2 bg-[#39ff14] rounded-full animate-pulse inline-block" />
            COINS: <strong className="text-white font-black">{coinsCollected}</strong>
          </span>
          <span className="flex items-center gap-1 text-[#00f5ff]" id="stat-stars">
            ★ CORES: <strong className="text-white font-black">{starsCollected}</strong>
          </span>
        </div>

        <div className="flex items-center gap-4" id="hud-stats-right">
          <span className="flex items-center gap-1 text-[#ff00ff]" id="stat-deaths">
            <Activity size={13} />
            RESTORES: <strong className="text-white font-black">{deaths}</strong>
          </span>
          <span className="bg-[#0d0221] border border-[#00f5ff]/45 px-2 py-0.5 rounded text-[10px]" id="stat-timer">
            ⏱ TIME: <strong className="text-white">{currentTime}s</strong> / <span className="opacity-60">{level.timeLimit}s</span>
          </span>
        </div>
      </div>

      {/* Main Interactive Canvas Screen Container */}
      <div className="relative flex-1 bg-[#050110] flex items-center justify-center overflow-hidden" id="canvas-wrapper">
        <canvas
          ref={canvasRef}
          width={480}
          height={270}
          className="w-full h-full object-contain cursor-crosshair"
          style={{ imageRendering: 'pixelated' }}
          id="retro-canvas"
        />

        {/* Tutorial Splash Screen Prompt */}
        <AnimatePresence>
          {showTutorial && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#0d0221]/95 flex flex-col items-center justify-center p-6 text-center z-30 font-mono"
              id="tutorial-overlay"
            >
              <HelpCircle className="text-[#39ff14] w-10 h-10 mb-2 animate-bounce" />
              <h2 className="text-lg font-bold text-white tracking-widest uppercase">COORD INITIALIZE</h2>
              <p className="text-[10px] text-gray-300 max-w-sm mt-1 leading-relaxed">
                Coordinate your movement to reach the sparkling purple <span className="text-[#ff00ff] font-bold uppercase">Void Portal</span> at coordinates. Watch for lasers, spikes, magma traps, and robots!
              </p>

              <div className="grid grid-cols-2 gap-4 mt-4 w-full max-w-md text-left text-[10px] bg-[#1a1a2e] p-3 rounded border border-[#00f5ff]/40" id="tutorial-keys-grid">
                <div>
                  <span className="text-[#ff00ff] font-black block mb-1">🎮 VELOCITY CTRL:</span>
                  <p className="text-gray-300">← / A : Move Left</p>
                  <p className="text-gray-300">→ / D : Move Right</p>
                  <p className="text-gray-300">↑ / W / Space : Double Jump</p>
                </div>
                <div>
                  <span className="text-[#39ff14] font-black block mb-1">⚡ ADVANCED GEAR:</span>
                  <p className="text-gray-300">Shift / J / X : Action Dash</p>
                  <p className="text-gray-300">Borders : Grip Wall-Leap</p>
                  <p className="text-gray-300">R Button : Self Resets</p>
                </div>
              </div>

              <button
                onClick={() => {
                  setShowTutorial(false);
                  soundEffects.playCollect();
                }}
                className="mt-5 px-6 py-2 bg-transparent hover:bg-[#39ff14]/10 text-[#39ff14] uppercase font-bold tracking-widest text-xs border-2 border-[#39ff14] rounded-lg transition-transform active:scale-95 cursor-pointer"
                id="btn-tutorial-start"
              >
                UPLINK Trajectory
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Game Paused Overlay Screen */}
        <AnimatePresence>
          {isPaused && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20 font-mono"
              id="pause-overlay"
            >
              <div className="bg-[#1a1a2e] border-2 border-[#00f5ff] rounded-xl p-6 text-center max-w-xs w-full shadow-[0_0_20px_rgba(0,245,255,0.3)]" id="pause-card">
                <h3 className="text-lg font-bold text-[#00f5ff] tracking-widest uppercase mb-1">CORE INTERRUPT</h3>
                <p className="text-[10px] text-gray-400 mb-6 uppercase">System is temporarily locked</p>

                <div className="flex flex-col gap-2" id="pause-actions">
                  <button
                    onClick={() => {
                      setIsPaused(false);
                      soundEffects.playCollect();
                    }}
                    className="w-full py-2 bg-transparent hover:bg-[#39ff14]/10 border-2 border-[#39ff14] text-[#39ff14] rounded text-xs uppercase cursor-pointer"
                    id="btn-resume"
                  >
                    RESUME TRAJECTORY
                  </button>
                  <button
                    onClick={() => {
                      loadLevel();
                      setIsPaused(false);
                    }}
                    className="w-full py-2 bg-transparent hover:bg-white/10 border-2 border-white/60 text-white rounded text-xs uppercase flex items-center justify-center gap-1 cursor-pointer"
                    id="btn-restart-death"
                  >
                    <RotateCcw size={11} /> RESET MAP
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Win Success Animate Screen */}
        <AnimatePresence>
          {levelWon && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-[#0d0221]/95 flex flex-col items-center justify-center z-30 font-mono"
              id="win-overlay"
            >
              <motion.div
                initial={{ y: -30, scale: 0.9 }}
                animate={{ y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 100 }}
                className="text-center"
                id="win-card"
              >
                <Trophy className="text-[#39ff14] w-12 h-12 mx-auto mb-2 animate-bounce" />
                <h2 className="text-xl font-bold text-[#39ff14] tracking-widest uppercase">GRID CLEARED!</h2>
                <p className="text-[10px] text-gray-300 mt-1 uppercase">Memory vector sector successfully verified.</p>

                <div className="mt-5 bg-[#1a1a2e] border-2 border-[#ff00ff] p-4 rounded-xl inline-grid grid-cols-2 gap-x-6 gap-y-2 text-left text-[10px] max-w-sm w-full shadow-[0_0_15px_rgba(255,0,255,0.2)]" id="win-scores-dashboard">
                  <span className="text-gray-400 uppercase">SCORE VALUE:</span>
                  <span className="text-white font-bold text-right">{score}</span>
                  
                  <span className="text-gray-400 uppercase">COINS RECOVERED:</span>
                  <span className="text-[#39ff14] font-bold text-right">{coinsCollected}</span>
                  
                  <span className="text-gray-400 uppercase">SPECIAL STARS:</span>
                  <span className="text-[#00f5ff] font-bold text-right">{starsCollected}</span>
                  
                  <span className="text-gray-400 uppercase">SYSTEM LOSSES:</span>
                  <span className="text-[#ff00ff] font-bold text-right">{deaths}</span>
                  
                  <span className="text-gray-400 uppercase">SPEED SECONDS:</span>
                  <span className="text-[#00f5ff] font-bold text-right">{currentTime}s</span>
                </div>

                <div className="mt-6 flex items-center justify-center gap-2 text-[10px] text-[#00f5ff]" id="teleporting-label">
                  <span className="w-1.5 h-1.5 bg-[#00f5ff] rounded-full animate-ping" />
                  RECONNECTING GRID SYSTEM INTEGRITY...
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Interface: Interactive Retro Buttons Console and Sound controls */}
      <div className="h-16 bg-[#1a1a2e] border-t-2 border-[#ff00ff]/30 px-4 flex items-center justify-between z-10" id="game-controls-foot">
        <div className="flex items-center gap-2" id="foot-left">
          <button
            onClick={onExit}
            className="px-3 py-1.5 bg-[#0d0221] hover:bg-[#ff00ff]/10 border-2 border-[#ff00ff] rounded text-xs font-bold text-[#ff00ff] transition flex items-center gap-1 cursor-pointer"
            id="btn-return-campaign"
          >
            <ArrowLeft size={11} /> MAPS
          </button>
          
          <button
            onClick={() => loadLevel()}
            className="p-1.5 bg-[#0d0221] hover:bg-[#00f5ff]/10 border-2 border-[#00f5ff] rounded text-[#00f5ff] transition cursor-pointer"
            title="Reset active progress"
            id="btn-reload-level"
          >
            <RotateCcw size={12} />
          </button>
        </div>

        {/* Interactive Virtual Console Overlay (Arrow touch targets for tablet/mobile/mouse clicks) */}
        <div className="flex items-center gap-1 bg-[#0d0221] px-3 py-1 rounded border border-[#00f5ff]/35 mx-2" id="virtual-gamepad">
          {/* D-Pad Horizontal */}
          <button
            onMouseDown={() => handleTouchStart('ArrowLeft')}
            onMouseUp={() => handleTouchEnd('ArrowLeft')}
            onMouseLeave={() => handleTouchEnd('ArrowLeft')}
            onTouchStart={() => handleTouchStart('ArrowLeft')}
            onTouchEnd={() => handleTouchEnd('ArrowLeft')}
            className="w-10 h-8 bg-transparent hover:bg-[#39ff14]/10 border border-[#39ff14] rounded flex items-center justify-center text-xs font-bold text-[#39ff14] cursor-pointer select-none active:scale-95"
            id="virtual-key-left"
          >
            ◀
          </button>
          <button
            onMouseDown={() => handleTouchStart('ArrowRight')}
            onMouseUp={() => handleTouchEnd('ArrowRight')}
            onMouseLeave={() => handleTouchEnd('ArrowRight')}
            onTouchStart={() => handleTouchStart('ArrowRight')}
            onTouchEnd={() => handleTouchEnd('ArrowRight')}
            className="w-10 h-8 bg-transparent hover:bg-[#39ff14]/10 border border-[#39ff14] rounded flex items-center justify-center text-xs font-bold text-[#39ff14] cursor-pointer select-none active:scale-95"
            id="virtual-key-right"
          >
            ▶
          </button>
          
          <span className="w-2" />

          {/* Jump Action Target */}
          <button
            onMouseDown={() => handleTouchStart(' ')}
            onMouseUp={() => handleTouchEnd(' ')}
            onMouseLeave={() => handleTouchEnd(' ')}
            onTouchStart={() => handleTouchStart(' ')}
            onTouchEnd={() => handleTouchEnd(' ')}
            className="px-3 h-8 bg-transparent hover:bg-[#ff00ff]/10 border border-[#ff00ff] rounded text-[10px] font-bold text-[#ff00ff] cursor-pointer select-none uppercase tracking-tighter active:scale-95"
            id="virtual-key-jump"
          >
            Jump
          </button>

          {/* Dash Action Target */}
          <button
            onMouseDown={() => handleTouchStart('Shift')}
            onMouseUp={() => handleTouchEnd('Shift')}
            onMouseLeave={() => handleTouchEnd('Shift')}
            onTouchStart={() => handleTouchStart('Shift')}
            onTouchEnd={() => handleTouchEnd('Shift')}
            className="px-3 h-8 bg-transparent hover:bg-[#00f5ff]/10 border border-[#00f5ff] rounded text-[10px] font-bold text-[#00f5ff] cursor-pointer select-none uppercase tracking-tighter active:scale-95"
            id="virtual-key-dash"
          >
            Dash
          </button>
        </div>

        {/* Audio Controllers Sound togglers */}
        <div className="flex items-center gap-1.5" id="sound-controllers">
          <button
            onClick={toggleSound}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              soundOn 
                ? 'bg-[#1a1a2e] border-[#39ff14] text-[#39ff14]' 
                : 'bg-[#1a1a2e] border-red-500/40 text-red-500'
            }`}
            title="Toggle Sound Effects"
            id="btn-sound-fx"
          >
            {soundOn ? <Volume2 size={12} /> : <VolumeX size={12} />}
          </button>

          <button
            onClick={toggleMusic}
            className={`p-1.5 rounded border transition-colors cursor-pointer ${
              musicOn 
                ? 'bg-[#1a1a2e] border-[#ff00ff] text-[#ff00ff]' 
                : 'bg-[#1a1a2e] border-zinc-700 text-zinc-500'
            }`}
            title="Toggle Retro Chiptune Loop"
            id="btn-sound-music"
          >
            <Music size={12} className={musicOn ? 'animate-pulse' : ''} />
          </button>
        </div>
      </div>
    </div>
  );
}
