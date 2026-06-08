import React, { useEffect, useState } from 'react';
import {
  Play,
  Award,
  Gamepad2,
  Tv,
  Trash2,
  HelpCircle,
  Volume2,
  VolumeX,
  Music,
  Clock,
  Skull,
  User,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GameStats, LevelConfig } from './types';
import { LEVEL_TEMPLATES } from './levels';
import { soundEffects } from './sound';
import GameCanvas from './components/GameCanvas';

// Key for storage persistence
const STORAGE_STATS_KEY = 'retro_8bit_platformer_stats_v2';

const initialStats: GameStats = {
  score: 0,
  coins: 0,
  starsCollected: 0,
  deaths: 0,
  timeElapsed: 0,
  completedLevels: []
};

// Map levels to individual high-score structure saved in storage
interface RecordEntry {
  levelId: number;
  bestTime: number; // in seconds
  fewestDeaths: number;
  highestScore: number;
}

export default function App() {
  const [screen, setScreen] = useState<'menu' | 'level-select' | 'controls' | 'stats' | 'playing'>('menu');
  const [activeLevel, setActiveLevel] = useState<LevelConfig | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(soundEffects.isSoundEnabled());
  const [musicEnabled, setMusicEnabled] = useState(soundEffects.isMusicEnabled());
  
  // High scores tracking state
  const [leaderboard, setLeaderboard] = useState<RecordEntry[]>([]);

  // Load scores on start
  useEffect(() => {
    try {
      const cached = localStorage.getItem(STORAGE_STATS_KEY);
      if (cached) {
        setLeaderboard(JSON.parse(cached));
      } else {
        // Seed default empty scores
        const defaults: RecordEntry[] = LEVEL_TEMPLATES.map(l => ({
          levelId: l.id,
          bestTime: 9999,
          fewestDeaths: 999,
          highestScore: 0
        }));
        setLeaderboard(defaults);
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(defaults));
      }
    } catch (e) {
      console.warn('LocalStorage not accessible', e);
    }
  }, []);

  const saveStatsRecord = (levelId: number, score: number, coins: number, stars: number, deaths: number, time: number) => {
    const updated = leaderboard.map(entry => {
      if (entry.levelId === levelId) {
        return {
          levelId,
          bestTime: Math.min(entry.bestTime, time),
          fewestDeaths: Math.min(entry.fewestDeaths, deaths),
          highestScore: Math.max(entry.highestScore, score)
        };
      }
      return entry;
    });

    setLeaderboard(updated);
    try {
      localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Failed to save scores', e);
    }
  };

  const handleClearRecords = () => {
    if (confirm('Are you sure you want to delete all your high scores and speedrun records?')) {
      const fresh: RecordEntry[] = LEVEL_TEMPLATES.map(l => ({
        levelId: l.id,
        bestTime: 9999,
        fewestDeaths: 999,
        highestScore: 0
      }));
      setLeaderboard(fresh);
      try {
        localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(fresh));
        soundEffects.playDie();
      } catch (e) {
        // silent
      }
    }
  };

  const toggleSound = () => {
    const newVal = !soundEnabled;
    setSoundEnabled(newVal);
    soundEffects.toggleSound(newVal);
    soundEffects.playCollect();
  };

  const toggleMusic = () => {
    const newVal = !musicEnabled;
    setMusicEnabled(newVal);
    soundEffects.toggleMusic(newVal);
    soundEffects.playCollect();
  };

  const startLevelPlay = (lvl: LevelConfig) => {
    setActiveLevel(lvl);
    setScreen('playing');
    soundEffects.playCollect();
  };

  // Callback when a level is successfully won
  const onLevelComplete = (stats: { score: number; coins: number; stars: number; deaths: number; time: number }) => {
    if (!activeLevel) return;

    // Save record
    saveStatsRecord(activeLevel.id, stats.score, stats.coins, stats.stars, stats.deaths, stats.time);

    // Auto load next level if available
    const nextLvlIndex = LEVEL_TEMPLATES.findIndex(l => l.id === activeLevel.id) + 1;
    if (nextLvlIndex < LEVEL_TEMPLATES.length) {
      setActiveLevel(LEVEL_TEMPLATES[nextLvlIndex]);
    } else {
      // Completed last level! Go to statistics dashboards
      setActiveLevel(null);
      setScreen('stats');
    }
  };

  const getDifficultyColor = (diff: string) => {
    switch (diff) {
      case 'Easy': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'Medium': return 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30';
      case 'Hard': return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'Expert': return 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30';
      case 'Brutal': return 'bg-red-500/10 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/10 text-slate-400 border-slate-500/30';
    }
  };

  return (
    <div
      className="min-h-screen bg-[#0d0221] text-[#00f5ff] flex flex-col items-center justify-center p-4 relative overflow-hidden"
      id="arcade-cabinet-root"
    >
      {/* Scanline CRT overlay for beautiful vintage vibe */}
      <div 
        className="pointer-events-none absolute inset-0 z-50 opacity-[0.03]"
        style={{
          background: 'repeating-linear-gradient(rgba(0,0,0,0) 0px, rgba(0,0,0,1) 2px, rgba(0,0,0,0) 4px)',
        }}
        id="retro-scan-overlay"
      />

      {/* Vignette styling for a true retro-cabinet monitor focus */}
      <div className="absolute inset-0 pointer-events-none z-40 opacity-20 bg-[radial-gradient(circle_at_center,_transparent_0%,_#000_100%)]" />

      {/* Decorative neon borders framing the game space */}
      <div className="absolute top-0 inset-x-0 h-[4px] bg-gradient-to-r from-[#ff00ff] via-[#39ff14] to-[#00f5ff] opacity-80" />
      
      <div className="max-w-4xl w-full flex flex-col gap-6 z-10" id="main-panel-body">
        
        {/* Game Title Shell / Retro Header */}
        <header className="flex items-center justify-between border-b-4 border-[#39ff14] bg-[#1a1a2e] px-4 md:px-8 py-4 shadow-[0_4px_20px_rgba(57,255,20,0.2)] rounded-lg relative z-30" id="app-header">
          <div 
            onClick={() => { setScreen('menu'); soundEffects.playCollect(); }}
            className="flex items-center gap-3 cursor-pointer group select-none"
            id="logo-wrap"
          >
            <div className="p-2 bg-[#0d0221] border-2 border-[#ff00ff] rounded shadow-[0_0_15px_rgba(255,0,255,0.4)] transition-transform duration-200 group-hover:scale-105" id="logo-badge">
              <Gamepad2 className="text-[#ff00ff] w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 
                className="text-xl md:text-2xl font-bold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ff00ff] via-[#39ff14] to-[#00f5ff] uppercase font-mono leading-none"
                style={{ textShadow: '0 0 10px rgba(0,245,255,0.3)' }}
                id="main-app-title"
              >
                8-Bit Vector Grid
              </h1>
              <span className="text-[10px] text-[#ff00ff] tracking-widest font-mono block mt-1" id="sub-title">CORE ARCADE INTERFACE • v2.1.8</span>
            </div>
          </div>

          {/* Quick Sound Toggles Header Panel */}
          <div className="flex items-center gap-2 bg-[#0d0221] p-1 rounded border border-[#00f5ff]/30" id="top-volume-controls">
            <button
              onClick={toggleSound}
              className={`p-2 rounded hover:bg-[#39ff14]/10 transition cursor-pointer ${soundEnabled ? 'text-[#39ff14]' : 'text-gray-600'}`}
              title="Toggle Sound FX"
              id="header-toggle-sfx"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
            <button
              onClick={toggleMusic}
              className={`p-2 rounded hover:bg-[#ff00ff]/10 transition cursor-pointer ${musicEnabled ? 'text-[#ff00ff]' : 'text-gray-600'}`}
              title="Toggle Chiptune loop"
              id="header-toggle-music"
            >
              <Music size={15} className={musicEnabled ? 'animate-pulse' : ''} />
            </button>
          </div>
        </header>

        {/* Dynamic Screens Router */}
        <main className="flex-1 min-h-[500px]" id="screen-viewport">
          <AnimatePresence mode="wait">
            
            {/* Screen 1: MAIN MENU */}
            {screen === 'menu' && (
              <motion.div
                key="menu"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                className="grid md:grid-cols-2 gap-8 items-center min-h-[460px]"
                id="screen-main-menu"
              >
                {/* Left side: Cyber Retro Visual Hero Card */}
                <div className="relative rounded-xl overflow-hidden border-2 border-[#ff00ff] bg-[#1a1a2e] p-8 flex flex-col justify-between min-h-[380px] group shadow-[0_0_25px_rgba(255,0,255,0.15)]" id="hero-arcade-card">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,245,255,0.15)_0%,transparent_60%)] pointer-events-none" />
                  
                  <div>
                    <span className="px-2 py-0.5 bg-[#ff00ff]/10 border border-[#ff00ff]/45 text-[#ff00ff] rounded text-[10px] font-mono uppercase tracking-widest font-bold">SYSTEM ACTIVE</span>
                    <h2 className="text-2xl font-bold text-white tracking-wide uppercase mt-4 leading-tight font-mono">
                      Master The <span className="text-[#39ff14]">8-Bit</span> Vector Gaps!
                    </h2>
                    <p className="text-gray-300 text-xs mt-3 leading-relaxed font-mono">
                      Control Standard Gravity, slide on cold ice spikes, execute perfect diagonal wall jumps, and dash through locking gates. Designed for hardcore retro platformer players who love tight precision controls.
                    </p>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#00f5ff]/20" id="hero-game-meta">
                    <div className="flex flex-wrap gap-4 text-[10px] text-gray-400 font-mono" id="hero-features-labels">
                      <span className="flex items-center gap-1 text-[#00f5ff]">⏰ PARALLAX SIDESCROLLER</span>
                      <span className="flex items-center gap-1 text-[#39ff14]">✦ DIAGONAL WALL JUMP</span>
                      <span className="flex items-center gap-1 text-[#ff00ff]">★ DYNAMIC SPEED DASH</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Action Menu Buttons */}
                <div className="flex flex-col gap-3 font-mono" id="main-menu-navigation">
                  <button
                    onClick={() => { setScreen('level-select'); soundEffects.playCollect(); }}
                    className="w-full group p-4 bg-[#1a1a2e] hover:bg-[#39ff14]/15 border-2 border-[#39ff14] text-[#39ff14] rounded-xl font-bold uppercase tracking-widest transition shadow-[0_0_15px_rgba(57,255,20,0.15)] hover:shadow-[0_0_25px_rgba(57,255,20,0.25)] active:translate-y-0.5 flex items-center justify-between cursor-pointer"
                    id="btn-goto-levelselect"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <Play className="w-5 h-5 fill-[#39ff14]" />
                      INITIALIZE SECTOR
                    </span>
                    <span className="text-xs opacity-60">ENTER →</span>
                  </button>

                  <button
                    onClick={() => { setScreen('controls'); soundEffects.playCollect(); }}
                    className="w-full group p-4 bg-[#1a1a2e] hover:bg-[#00f5ff]/10 border-2 border-[#00f5ff] text-[#00f5ff] rounded-xl font-bold uppercase tracking-widest transition shadow-[0_0_15px_rgba(0,245,255,0.1)] hover:shadow-[0_0_20px_rgba(0,245,255,0.2)] active:translate-y-0.5 flex items-center justify-between cursor-pointer"
                    id="btn-goto-controls"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <HelpCircle className="w-5 h-5 text-[#00f5ff]" />
                      COGNITIVE DATA MANUAL
                    </span>
                    <span className="text-xs text-[#00f5ff]/60">KEYS</span>
                  </button>

                  <button
                    onClick={() => { setScreen('stats'); soundEffects.playCollect(); }}
                    className="w-full group p-4 bg-[#1a1a2e] hover:bg-[#ff00ff]/10 border-2 border-[#ff00ff] text-[#ff00ff] rounded-xl font-bold uppercase tracking-widest transition shadow-[0_0_15px_rgba(255,0,255,0.1)] hover:shadow-[0_0_20px_rgba(255,0,255,0.2)] active:translate-y-0.5 flex items-center justify-between cursor-pointer"
                    id="btn-goto-stats"
                  >
                    <span className="flex items-center gap-3 text-sm">
                      <Award className="w-5 h-5 text-[#ff00ff]" />
                      SPEEDRUN ARCHIVAL
                    </span>
                    <span className="text-xs text-[#ff00ff]/60">SCORES</span>
                  </button>

                  {/* Aesthetic Credits note inside menu panel */}
                  <div className="mt-6 p-4 rounded bg-[#1a1a2e] border-2 border-[#00f5ff]/20 text-[10px] text-gray-400 font-mono leading-relaxed" id="credits-note">
                    <p>
                      <strong className="text-[#39ff14]">📡 AUDIO GRID SYNCHRONIZED:</strong> Toggle the <span className="text-[#ff00ff] font-bold">Chiptune loop (♫)</span> in the top-right console dashboard to activate deep space generative music.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Screen 2: LEVEL SELECT CAMPAIGN MAP */}
            {screen === 'level-select' && (
              <motion.div
                key="level-select"
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 15 }}
                className="flex flex-col gap-6 font-mono"
                id="screen-level-select"
              >
                <div className="flex items-center justify-between" id="level-select-header">
                  <div>
                    <h2 className="text-xl font-bold text-[#00f5ff] uppercase tracking-wider">SECTOR SELECT</h2>
                    <p className="text-[10px] text-gray-400 uppercase">Intercept vector cores and secure record times</p>
                  </div>
                  <button
                    onClick={() => { setScreen('menu'); soundEffects.playCollect(); }}
                    className="px-3 py-1.5 bg-[#1a1a2e] hover:bg-[#ff00ff]/15 border-2 border-[#ff00ff] text-[#ff00ff] rounded text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                    id="btn-levelselect-back"
                  >
                    ◀ BACK TO MAIN
                  </button>
                </div>

                {/* Level list Cards Grid */}
                <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4" id="levels-grid">
                  {LEVEL_TEMPLATES.map((lvl) => {
                    // Pull records for this level
                    const record = leaderboard.find(r => r.levelId === lvl.id);
                    const isCompletedCount = record && record.bestTime !== 9999;

                    return (
                      <div
                        key={lvl.id}
                        className="relative bg-[#1a1a2e] border-2 border-[#00f5ff]/30 hover:border-[#39ff14] rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-[0_0_15px_rgba(57,255,20,0.15)] group hover:-translate-y-0.5"
                        id={`level-card-${lvl.id}`}
                      >
                        <div id={`level-card-info-${lvl.id}`}>
                          <div className="flex items-center justify-between" id={`level-card-header-${lvl.id}`}>
                            <span className="text-[10px] font-mono text-[#00f5ff] font-bold tracking-widest">GRID #{lvl.id}</span>
                            <span className={`px-2 py-0.5 text-[9px] rounded font-bold border uppercase tracking-tighter ${getDifficultyColor(lvl.difficulty)}`} id={`diff-badge-${lvl.id}`}>
                              {lvl.difficulty}
                            </span>
                          </div>

                          <h3 className="text-base font-bold text-white mt-2 group-hover:text-[#39ff14] transition-colors uppercase tracking-tight" id={`level-card-title-${lvl.id}`}>
                            {lvl.name}
                          </h3>
                        </div>

                        {/* Best efforts and details */}
                        <div className="mt-4 pt-3 border-t border-[#00f5ff]/15 text-[10px] font-mono text-gray-400 flex flex-col gap-1" id={`level-card-stats-${lvl.id}`}>
                          {isCompletedCount ? (
                            <>
                              <span className="text-[#39ff14] flex items-center justify-between" id={`sc-best-${lvl.id}`}>
                                <span>🏆 HIGH SCORE:</span>
                                <strong className="text-white">{record.highestScore}</strong>
                              </span>
                              <span className="text-[#00f5ff] flex items-center justify-between" id={`sc-time-${lvl.id}`}>
                                <span>⏱ BEST SPEED:</span>
                                <strong className="text-white">{record.bestTime}s</strong>
                              </span>
                              <span className="text-[#ff00ff] flex items-center justify-between" id={`sc-deaths-${lvl.id}`}>
                                <span>☠ TOTAL LOST:</span>
                                <strong className="text-white">{record.fewestDeaths}</strong>
                              </span>
                            </>
                          ) : (
                            <span className="text-gray-500 flex items-center gap-1 italic uppercase" id={`sc-unlocked-${lvl.id}`}>
                              ★ READY FOR UPLOAD
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => startLevelPlay(lvl)}
                          className="mt-4 w-full py-2 bg-[#0d0221] group-hover:bg-[#39ff14]/10 border-2 border-[#00f5ff]/60 group-hover:border-[#39ff14] text-[#00f5ff] group-hover:text-[#39ff14] rounded font-bold uppercase text-[10px] tracking-widest transition-all cursor-pointer"
                          id={`level-card-btn-play-${lvl.id}`}
                        >
                          LAUNCH SCANNER
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* Screen 3: DETAILED CONTROLS PANEL */}
            {screen === 'controls' && (
              <motion.div
                key="controls"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1a1a2e] border-2 border-[#00f5ff] rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-[0_0_25px_rgba(0,245,255,0.15)] font-mono"
                id="screen-manual"
              >
                <div className="flex items-center justify-between border-b-2 border-[#00f5ff]/20 pb-4 mb-6" id="manual-header">
                  <h2 className="text-lg md:text-xl font-bold text-[#00f5ff] tracking-wider uppercase flex items-center gap-2">
                    <HelpCircle className="text-[#ff00ff]" /> COGNITIVE CORE SPECS
                  </h2>
                  <button
                    onClick={() => { setScreen('menu'); soundEffects.playCollect(); }}
                    className="px-3 py-1 bg-[#0d0221] hover:bg-[#ff00ff]/10 border-2 border-[#ff00ff] text-[#ff00ff] rounded text-xs font-bold transition cursor-pointer"
                    id="btn-manual-back"
                  >
                    ◀ MENU
                  </button>
                </div>

                <div className="space-y-6 text-xs text-gray-300" id="manual-body">
                  <div id="manual-sec-concept">
                    <h3 className="font-bold text-[#39ff14] mb-1 uppercase text-xs">OBJECTIVE INTERCEPT:</h3>
                    <p className="leading-relaxed">
                      Run, jump, and coordinate through the unstable virtual blocks to land on the purple vector Void Portal. Gather high-energy gold coins and celestial pulse stars across the coordinates to increase your core stats. Look out for heavy security gates—retrieve the blueprint Key to de-crystallize locks!
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-6" id="manual-sec-keys">
                    <div className="bg-[#0d0221] p-4 rounded border border-[#00f5ff]/30" id="manual-keyboard">
                      <h4 className="font-bold text-[#ff00ff] mb-2 uppercase text-[10px] tracking-wide">⌨ KEYBOARD INTERPRET:</h4>
                      <div className="space-y-2 text-gray-300" id="keyboard-list">
                        <p><strong className="text-white">← / A</strong> : Coordinate Left</p>
                        <p><strong className="text-white">→ / D</strong> : Coordinate Right</p>
                        <p><strong className="text-white">W / Space / ↑</strong> : Vector Jump</p>
                        <p><strong className="text-white">Shift / J / X</strong> : Quantum Dash</p>
                        <p><strong className="text-white">Esc / P</strong> : Pause Terminal</p>
                        <p><strong className="text-white">R</strong> : Checkpoint Respawn</p>
                      </div>
                    </div>

                    <div className="bg-[#0d0221] p-4 rounded border border-[#39ff14]/30" id="manual-mechanics">
                      <h4 className="font-bold text-[#39ff14] mb-2 uppercase text-[10px] tracking-wide">⚡ COMBINATORIAL CORES:</h4>
                      <div className="space-y-2" id="mechanics-list">
                        <p><span className="text-white font-bold">MULTIJUMP:</span> Leap again mid-vector to climb extreme gravity zones.</p>
                        <p><span className="text-white font-bold">WALL-BOUND:</span> Slide on vertical obstacles and bounce away dynamically.</p>
                        <p><span className="text-white font-bold">DASH-VECTOR:</span> Trigger straight ahead to clear spikes and chasms.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-red-950/20 border border-red-500/30 rounded" id="manual-danger-guide">
                    <h5 className="font-bold text-red-500 text-[10px] mb-1 uppercase tracking-wider">☠ WARNING: ENVIRONMENTAL THREATS</h5>
                    <p className="text-gray-400">
                      Sparks, spike beds, and molten lava fields will reset your module trajectory back to the nearest active anchor flag. Solid armor enemies cannot be bounced off!
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Screen 4: SPEEDRUN LEADERBOARD & RECORDS */}
            {screen === 'stats' && (
              <motion.div
                key="stats"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1a1a2e] border-2 border-[#ff00ff] rounded-2xl p-6 md:p-8 max-w-2xl mx-auto shadow-[0_0_25px_rgba(255,0,255,0.15)] font-mono"
                id="screen-records"
              >
                <div className="flex items-center justify-between border-b-2 border-[#ff00ff]/25 pb-4 mb-6" id="records-header">
                  <div>
                    <h2 className="text-lg md:text-xl font-bold text-[#ff00ff] tracking-wider uppercase flex items-center gap-2">
                      <Award className="text-[#ff00ff]" /> SECTOR RECORD ARCHIVAL
                    </h2>
                    <p className="text-[10px] text-gray-400 uppercase">Display dynamic local storage speedrun records</p>
                  </div>
                  <button
                    onClick={() => { setScreen('menu'); soundEffects.playCollect(); }}
                    className="px-3 py-1.5 bg-[#0d0221] hover:bg-[#00f5ff]/15 border-2 border-[#00f5ff] text-[#00f5ff] rounded text-xs font-bold transition cursor-pointer"
                    id="btn-records-back"
                  >
                    ◀ MENU
                  </button>
                </div>

                {/* Score list stats table */}
                <div className="space-y-4" id="records-table">
                  <div className="bg-[#0d0221] rounded-lg overflow-hidden border border-[#ff00ff]/30" id="table-wrapper">
                    <div className="grid grid-cols-4 bg-[#ff00ff]/10 p-3 text-[10px] text-[#ff00ff] font-bold text-center border-b border-[#ff00ff]/20" id="table-header">
                      <div className="text-left">COORDS</div>
                      <div>BEST SPEED</div>
                      <div>MIN DEATHS</div>
                      <div>SCORE RECORD</div>
                    </div>

                    <div className="divide-y divide-[#ff00ff]/15" id="table-rows">
                      {LEVEL_TEMPLATES.map(lvl => {
                        const record = leaderboard.find(r => r.levelId === lvl.id);
                        const hasScore = record && record.bestTime !== 9999;

                        return (
                          <div key={lvl.id} className="grid grid-cols-4 p-3 text-[10px] text-center hover:bg-[#ff00ff]/5 items-center transition" id={`table-row-${lvl.id}`}>
                            <div className="text-left font-bold text-white uppercase" id={`row-title-${lvl.id}`}>
                              #{lvl.id} - {lvl.name}
                            </div>
                            <div className={hasScore ? 'text-[#00f5ff] font-bold' : 'text-gray-600'} id={`row-time-${lvl.id}`}>
                              {hasScore ? `${record.bestTime}s` : '--'}
                            </div>
                            <div className={hasScore ? 'text-[#ff00ff] font-bold' : 'text-gray-600'} id={`row-deaths-${lvl.id}`}>
                              {hasScore ? record.fewestDeaths : '--'}
                            </div>
                            <div className={hasScore ? 'text-[#39ff14] font-bold' : 'text-gray-600'} id={`row-score-${lvl.id}`}>
                              {hasScore ? record.highestScore : '--'}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-between pt-4 gap-4 sm:gap-0" id="records-table-foot">
                    <button
                      onClick={handleClearRecords}
                      className="px-3 py-1.5 bg-[#0d0221]/80 hover:bg-red-500/10 border border-red-500 text-red-500 hover:text-white rounded text-[10px] font-bold flex items-center gap-1.5 transition cursor-pointer"
                      id="btn-delete-records"
                    >
                      <Trash2 size={12} /> WIPE COGNITIVE LOGS
                    </button>
                    
                    <span className="text-[9px] text-[#00f5ff]/70 tracking-wider font-mono uppercase" id="records-foot-note">
                      ⏱ LOCAL CACHE INTEGRITY SECURED
                    </span>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Screen 5: ACTIVE PLAY PLATFORMER GAMEPLAY VIEWPORT */}
            {screen === 'playing' && activeLevel && (
              <motion.div
                key="playing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="w-full flex justify-center py-2"
                id="screen-gameplay"
              >
                <GameCanvas
                  level={activeLevel}
                  onLevelComplete={onLevelComplete}
                  onExit={() => {
                    setActiveLevel(null);
                    setScreen('level-select');
                    soundEffects.playCollect();
                  }}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </main>

        {/* Vintage Arcade Machine Console Bezel Foot */}
        <footer className="text-center font-mono text-[9px] text-gray-500 uppercase tracking-[0.2em] border-t border-[#00f5ff]/20 pt-4" id="cabinet-footer">
          ⚡ SYSTEM CABINET OPERATIONAL • HIGH REFRESH RATE ACTIVE ⚡
        </footer>

      </div>
    </div>
  );
}
