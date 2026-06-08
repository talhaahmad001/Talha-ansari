/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

let audioCtx: AudioContext | null = null;
let soundVolume = 0.3;
let musicVolume = 0.15;
let soundEnabled = true;
let musicEnabled = false; // Off by default to avoid startling, can be toggled on
let musicIntervalId: any = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser security policy)
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

// Low-level helper to schedule custom synthesizer sweeps
function playBeep(
  freqs: number[],
  duration: number,
  type: OscillatorType = 'square',
  volumeFactor = 1.0,
  pitchSweep = true
) {
  if (!soundEnabled) return;
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc.type = type;
    osc.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(soundVolume * volumeFactor, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    if (freqs.length === 1) {
      osc.frequency.setValueAtTime(freqs[0], now);
    } else if (freqs.length > 1) {
      if (pitchSweep) {
        osc.frequency.setValueAtTime(freqs[0], now);
        osc.frequency.exponentialRampToValueAtTime(freqs[freqs.length - 1], now + duration);
      } else {
        // Play arpeggio
        const step = duration / freqs.length;
        freqs.forEach((f, idx) => {
          osc.frequency.setValueAtTime(f, now + idx * step);
        });
      }
    }

    osc.start(now);
    osc.stop(now + duration);
  } catch (error) {
    console.warn('Audio play failed:', error);
  }
}

export const soundEffects = {
  toggleSound(enabled: boolean) {
    soundEnabled = enabled;
  },
  
  toggleMusic(enabled: boolean) {
    musicEnabled = enabled;
    if (enabled) {
      this.startMusic();
    } else {
      this.stopMusic();
    }
  },

  isSoundEnabled() {
    return soundEnabled;
  },

  isMusicEnabled() {
    return musicEnabled;
  },

  playJump() {
    // Elegant rising pitch sweep using triangle wave for softer feel
    playBeep([150, 450], 0.15, 'triangle', 0.8);
  },

  playDoubleJump() {
    // Quick double pitch sweep starting higher
    playBeep([250, 600], 0.12, 'triangle', 0.8);
  },

  playCollect() {
    // Classic dual-tone ding
    playBeep([523.25, 1046.50], 0.12, 'sine', 0.6, false); // C5 then C6
  },

  playCollectStar() {
    // Sparkly minor-to-major ascending triad chirps
    playBeep([440, 554.37, 659.25, 880], 0.25, 'sine', 0.7, false);
  },

  playHurt() {
    // Downward buzzy tone
    playBeep([220, 80], 0.2, 'sawtooth', 0.6);
  },

  playDie() {
    // Buzzy game-over sequence
    playBeep([180, 140, 110, 80], 0.45, 'sawtooth', 0.8, false);
  },

  playSpring() {
    // Rapid spring/boing sound
    playBeep([100, 800, 150, 900], 0.3, 'triangle', 0.9, true);
  },

  playCheckpoint() {
    // Beautiful upward electronic chime
    playBeep([330, 392, 523, 659, 784], 0.35, 'square', 0.5, false);
  },

  playGateOpen() {
    // Heavy stone sliding rumble
    playBeep([120, 80, 120, 60], 0.4, 'triangle', 1.0, true);
  },

  playPortal() {
    // Interstellar teleportation sound
    playBeep([200, 1200, 300, 1800, 400], 0.5, 'sine', 0.6, true);
  },

  playLaser() {
    // Classic 8-bit laser zap
    playBeep([800, 100], 0.1, 'sawtooth', 0.4, true);
  },

  playVictory() {
    // Legendary retro victory fanfare
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Play a lovely little triumph progression (C - F - G - C)
    const playChordNote = (freq: number, startTime: number, dur: number, type: OscillatorType = 'triangle') => {
      if (!soundEnabled) return;
      try {
        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, startTime);
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(soundVolume * 0.4, startTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, startTime + dur);
        osc.start(startTime);
        osc.stop(startTime + dur);
      } catch (e) {
        // ignore
      }
    };

    // Timing of notes
    const s = 0.18;
    const notes = [
      { f: 523.25, t: 0, d: s }, // C5
      { f: 659.25, t: 0, d: s }, // E5
      { f: 783.99, t: 0, d: s }, // G5

      { f: 523.25, t: s * 1.2, d: s }, // C5
      { f: 659.25, t: s * 1.2, d: s }, // E5
      { f: 783.99, t: s * 1.2, d: s }, // G5

      { f: 587.33, t: s * 2.4, d: s }, // D5
      { f: 739.99, t: s * 2.4, d: s }, // F#5
      { f: 880.00, t: s * 2.4, d: s }, // A5

      { f: 523.25, t: s * 3.6, d: s * 3.0 }, // C5
      { f: 659.25, t: s * 3.6, d: s * 3.0 }, // E5
      { f: 783.99, t: s * 3.6, d: s * 3.0 }, // G5
      { f: 1046.5, t: s * 3.6, d: s * 3.0 }, // C6 (climax!)
    ];

    notes.forEach(note => {
      playChordNote(note.f, now + note.t, note.d, 'square');
    });
  },

  startMusic() {
    if (musicIntervalId) clearInterval(musicIntervalId);
    if (!musicEnabled) return;

    try {
      getAudioContext(); // Prepare context
    } catch (e) {
      return;
    }

    // Interactive custom 8-bit chiptune loop
    // Simple bassline and leading voice sequence
    const bassline = [110, 110, 130, 130, 146, 146, 165, 123]; // A2, C3, D3, E3...
    const melody = [440, 493.88, 523.25, 587.33, 659.25, 587.33, 523.25, 493.88];
    const sequenceLength = 8;
    let index = 0;

    musicIntervalId = setInterval(() => {
      if (!musicEnabled || !soundEnabled) return;
      try {
        const ctx = getAudioContext();
        if (ctx.state === 'suspended') return;
        const now = ctx.currentTime;

        // Play Bass note (Sawtooth wave, low gain, fast decay)
        const bassOsc = ctx.createOscillator();
        const bassGain = ctx.createGain();
        bassOsc.type = 'triangle';
        bassOsc.frequency.setValueAtTime(bassline[index % bassline.length], now);
        bassOsc.connect(bassGain);
        bassGain.connect(ctx.destination);
        bassGain.gain.setValueAtTime(0, now);
        bassGain.gain.linearRampToValueAtTime(musicVolume * 0.7, now + 0.01);
        bassGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
        bassOsc.start(now);
        bassOsc.stop(now + 0.25);

        // Play melody note occasionally (every other beat)
        if (index % 2 === 0) {
          const melOsc = ctx.createOscillator();
          const melGain = ctx.createGain();
          melOsc.type = 'square';
          melOsc.frequency.setValueAtTime(melody[(index / 2) % melody.length], now);
          melOsc.connect(melGain);
          melGain.connect(ctx.destination);
          melGain.gain.setValueAtTime(0, now);
          melGain.gain.linearRampToValueAtTime(musicVolume * 0.4, now + 0.01);
          melGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
          melOsc.start(now);
          melOsc.stop(now + 0.22);
        }

        index = (index + 1) % sequenceLength;
      } catch (e) {
        // silence errors
      }
    }, 280); // Beat speed
  },

  stopMusic() {
    if (musicIntervalId) {
      clearInterval(musicIntervalId);
      musicIntervalId = null;
    }
  },
};
