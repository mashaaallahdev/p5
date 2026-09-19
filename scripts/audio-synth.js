// ============================================================
//  PROCEDURAL AUDIO SYNTHESIZER FOR SATISFYING ANIMATIONS
//  Generates 44.1kHz 16-bit stereo WAV with frame-perfect sync
// ============================================================

const fs = require('fs');

// Pentatonic / Diatonic harmonious scale (C3 up to G6)
// Zero dissonance: any combination sounds beautiful & musical
const SCALE_FREQS = [
  130.81, // C3 (0)
  146.83, // D3 (1)
  164.81, // E3 (2)
  196.00, // G3 (3)
  220.00, // A3 (4)
  261.63, // C4 (5)
  293.66, // D4 (6)
  329.63, // E4 (7)
  392.00, // G4 (8)
  440.00, // A4 (9)
  523.25, // C5 (10)
  587.33, // D5 (11)
  659.25, // E5 (12)
  783.99, // G5 (13)
  880.00, // A5 (14)
  1046.50,// C6 (15)
  1174.66,// D6 (16)
  1318.51,// E6 (17)
  1567.98 // G6 (18)
];

const SAMPLE_RATE = 44100;

function getPitchFreq(pitch, defaultIdx = 5) {
  if (typeof pitch === 'number') {
    return SCALE_FREQS[Math.abs(Math.floor(pitch)) % SCALE_FREQS.length];
  }
  return SCALE_FREQS[defaultIdx];
}

/**
 * Synthesize a stereo WAV buffer from sound events
 * @param {Array} soundEvents - [{ frame, type, pitch, x, pan }]
 * @param {number} durationSec - total duration in seconds
 * @param {number} fps - animation fps (default 60)
 * @returns {Buffer} WAV file buffer
 */
function generateWavFromEvents(soundEvents, durationSec, fps = 60) {
  const totalSamples = Math.ceil(durationSec * SAMPLE_RATE);
  const leftChannel = new Float32Array(totalSamples);
  const rightChannel = new Float32Array(totalSamples);

  // 1. Generate Warm Ambient Bed (Quiet, soothing, warm pad)
  const padFreqs = [130.81, 196.00, 329.63]; // C3, G3, E4
  const padVol = 0.045; // Gentle background presence
  for (let i = 0; i < totalSamples; i++) {
    const t = i / SAMPLE_RATE;
    // Gentle slow breathing tremolo
    const trem = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.18 * t);
    let padSample = 0;
    for (let f of padFreqs) {
      padSample += Math.sin(2 * Math.PI * f * t);
    }
    padSample = (padSample / padFreqs.length) * padVol * trem;

    // Fade in (2s) and fade out (2s)
    let env = 1.0;
    if (t < 2.0) env = t / 2.0;
    else if (t > durationSec - 2.0) env = Math.max(0, (durationSec - t) / 2.0);

    leftChannel[i] += padSample * env;
    rightChannel[i] += padSample * env;
  }

  // 2. Synthesize Interactive Sound Events
  for (const evt of soundEvents) {
    // Exact sample index matching animation frame
    const startSample = Math.floor((evt.frame / fps) * SAMPLE_RATE);
    if (startSample >= totalSamples) continue;

    // Pan: -0.6 (left) to +0.6 (right)
    let pan = 0;
    if (typeof evt.pan === 'number') {
      pan = Math.max(-0.8, Math.min(0.8, evt.pan));
    } else if (typeof evt.x === 'number') {
      // 0 = left (1080w), 540 = center, 1080 = right
      pan = ((evt.x / 1080) - 0.5) * 1.2;
      pan = Math.max(-0.8, Math.min(0.8, pan));
    }

    const leftGain = Math.cos((pan + 1) * Math.PI / 4);
    const rightGain = Math.sin((pan + 1) * Math.PI / 4);

    switch (evt.type) {
      case 'pop':
      case 'drop':
      case 'bubble':
        synthesizePop(leftChannel, rightChannel, startSample, evt.pitch, leftGain, rightGain);
        break;

      case 'click':
      case 'tap':
      case 'impact':
        synthesizeClick(leftChannel, rightChannel, startSample, leftGain, rightGain);
        break;

      case 'deep':
      case 'bell':
      case 'chord':
        synthesizeDeep(leftChannel, rightChannel, startSample, evt.pitch, leftGain, rightGain);
        break;

      case 'swoosh':
      case 'whoosh':
        synthesizeSwoosh(leftChannel, rightChannel, startSample, evt.pitch, leftGain, rightGain);
        break;

      default:
        synthesizePop(leftChannel, rightChannel, startSample, evt.pitch, leftGain, rightGain);
        break;
    }
  }

  // 3. Master Processing: Soft Limiter & Peak Normalization
  let maxPeak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const l = Math.abs(leftChannel[i]);
    const r = Math.abs(rightChannel[i]);
    if (l > maxPeak) maxPeak = l;
    if (r > maxPeak) maxPeak = r;
  }

  // Target peak -1.0 dBFS (~0.89)
  const targetPeak = 0.89;
  const gain = maxPeak > 0 ? Math.min(targetPeak / maxPeak, 3.5) : 1.0;

  // Convert Float32 (-1.0 to 1.0) to 16-bit signed PCM Buffer
  const wavHeader = createWavHeader(totalSamples, 2, SAMPLE_RATE, 16);
  const pcmBytes = Buffer.alloc(totalSamples * 4); // 2 channels * 2 bytes

  for (let i = 0; i < totalSamples; i++) {
    // Apply gain + soft saturator
    let l = leftChannel[i] * gain;
    let r = rightChannel[i] * gain;

    // Soft clip if any excursion beyond 0.95
    if (l > 0.95) l = 0.95 + 0.05 * Math.tanh((l - 0.95) / 0.05);
    else if (l < -0.95) l = -0.95 + 0.05 * Math.tanh((l + 0.95) / 0.05);

    if (r > 0.95) r = 0.95 + 0.05 * Math.tanh((r - 0.95) / 0.05);
    else if (r < -0.95) r = -0.95 + 0.05 * Math.tanh((r + 0.95) / 0.05);

    const intL = Math.max(-32768, Math.min(32767, Math.round(l * 32767)));
    const intR = Math.max(-32768, Math.min(32767, Math.round(r * 32767)));

    pcmBytes.writeInt16LE(intL, i * 4);
    pcmBytes.writeInt16LE(intR, i * 4 + 2);
  }

  return Buffer.concat([wavHeader, pcmBytes]);
}

/**
 * Satisfying Marimba / Wooden ball / Droplet Pop
 * Rich organic timbre: fundamental with downward micro-pitch transient + 2nd harmonic
 */
function synthesizePop(left, right, startSample, pitch, leftGain, rightGain) {
  const f0 = getPitchFreq(pitch, 7); // Default E4
  const duration = 0.22; // 220ms
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const decayTau = 0.065; // exponential decay time constant
  const baseVol = 0.42;

  let phase1 = 0;
  let phase2 = 0;
  let phase3 = 0;

  for (let s = 0; s < numSamples; s++) {
    const idx = startSample + s;
    if (idx >= left.length) break;

    const t = s / SAMPLE_RATE;

    // Downward pitch bend at attack (bubble / wooden plop effect)
    // Drops by ~60% in first 15ms
    const pitchBend = 1.0 + 0.65 * Math.exp(-t / 0.012);
    const instFreq = f0 * pitchBend;

    const deltaPhase1 = (2 * Math.PI * instFreq) / SAMPLE_RATE;
    const deltaPhase2 = (2 * Math.PI * instFreq * 2.01) / SAMPLE_RATE;
    const deltaPhase3 = (2 * Math.PI * instFreq * 3.02) / SAMPLE_RATE;

    phase1 += deltaPhase1;
    phase2 += deltaPhase2;
    phase3 += deltaPhase3;

    // Fast attack (1.5ms) then exponential decay
    const attack = Math.min(1.0, t / 0.0015);
    const env = attack * Math.exp(-t / decayTau) * baseVol;

    // Rich wooden marimba blend: fundamental + overtone
    const sample = (Math.sin(phase1) * 0.75 + Math.sin(phase2) * 0.20 + Math.sin(phase3) * 0.05) * env;

    left[idx] += sample * leftGain;
    right[idx] += sample * rightGain;
  }
}

/**
 * Sharp, tactile acoustic click (ball bounce, Newton cradle impact)
 */
function synthesizeClick(left, right, startSample, leftGain, rightGain) {
  const duration = 0.045; // 45ms
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const baseVol = 0.38;

  let clickPhase = 0;
  let bodyPhase = 0;

  for (let s = 0; s < numSamples; s++) {
    const idx = startSample + s;
    if (idx >= left.length) break;

    const t = s / SAMPLE_RATE;

    // Sharp impact transient (2400Hz decaying in 4ms)
    const snapEnv = Math.exp(-t / 0.0035);
    clickPhase += (2 * Math.PI * 2400) / SAMPLE_RATE;
    const snap = Math.sin(clickPhase) * snapEnv * 0.55;

    // Body resonance (950Hz decaying in 25ms)
    const bodyEnv = Math.exp(-t / 0.022);
    bodyPhase += (2 * Math.PI * 950) / SAMPLE_RATE;
    const body = Math.sin(bodyPhase) * bodyEnv * 0.45;

    const sample = (snap + body) * baseVol;

    left[idx] += sample * leftGain;
    right[idx] += sample * rightGain;
  }
}

/**
 * Resonant completion gong / warm chord chime
 */
function synthesizeDeep(left, right, startSample, pitch, leftGain, rightGain) {
  const f0 = getPitchFreq(pitch, 2) * 0.5; // Lower octave
  const duration = 1.6; // 1.6s
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const baseVol = 0.48;

  // Harmonic series: root (1.0), 5th (1.5), octave (2.0), major 3rd (2.5)
  const harmonics = [1.0, 1.498, 2.0, 2.502];
  const weights = [0.45, 0.25, 0.20, 0.10];
  const phases = [0, 0, 0, 0];

  for (let s = 0; s < numSamples; s++) {
    const idx = startSample + s;
    if (idx >= left.length) break;

    const t = s / SAMPLE_RATE;
    const attack = Math.min(1.0, t / 0.008);
    const env = attack * Math.exp(-t / 0.45) * baseVol;

    let sample = 0;
    for (let h = 0; h < harmonics.length; h++) {
      phases[h] += (2 * Math.PI * f0 * harmonics[h]) / SAMPLE_RATE;
      sample += Math.sin(phases[h]) * weights[h];
    }

    sample *= env;

    left[idx] += sample * leftGain;
    right[idx] += sample * rightGain;
  }
}

/**
 * Smooth airy swoosh / whoosh
 */
function synthesizeSwoosh(left, right, startSample, pitch, leftGain, rightGain) {
  const duration = 0.45; // 450ms
  const numSamples = Math.floor(duration * SAMPLE_RATE);
  const centerFreq = getPitchFreq(pitch, 6);
  const baseVol = 0.32;

  let phase = 0;

  for (let s = 0; s < numSamples; s++) {
    const idx = startSample + s;
    if (idx >= left.length) break;

    const t = s / SAMPLE_RATE;
    // Bell curve amplitude
    const progress = t / duration;
    const env = Math.sin(progress * Math.PI) * baseVol;

    // Frequency sweep up and down
    const sweepFreq = centerFreq * (0.8 + 0.4 * Math.sin(progress * Math.PI));
    phase += (2 * Math.PI * sweepFreq) / SAMPLE_RATE;

    // Resonant airy tone with subtle noise
    const noise = (Math.random() * 2 - 1) * 0.15;
    const sample = (Math.sin(phase) * 0.85 + noise) * env;

    left[idx] += sample * leftGain;
    right[idx] += sample * rightGain;
  }
}

/**
 * Creates standard 44-byte RIFF WAV Header
 */
function createWavHeader(numSamples, numChannels, sampleRate, bitsPerSample) {
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const buffer = Buffer.alloc(44);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);             // Subchunk1Size (16 for PCM)
  buffer.writeUInt16LE(1, 20);              // AudioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);     // NumChannels
  buffer.writeUInt32LE(sampleRate, 24);     // SampleRate
  buffer.writeUInt32LE(byteRate, 28);       // ByteRate
  buffer.writeUInt16LE(blockAlign, 32);     // BlockAlign
  buffer.writeUInt16LE(bitsPerSample, 34);  // BitsPerSample
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  return buffer;
}

module.exports = {
  generateWavFromEvents,
  SCALE_FREQS
};
