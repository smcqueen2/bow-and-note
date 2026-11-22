import { PitchDetector } from 'pitchy';

/**
 * @typedef {object} AudioObservation
 * @property {number} frequency Estimated frequency in Hz, or zero if unavailable.
 * @property {number} clarity Pitchy's confidence between 0 and 1.
 * @property {number} levelDb RMS signal level in dBFS.
 * @property {number} timeMs Monotonic timestamp of the reading.
 * @property {'microphone'|'simulation'} source
 */

export const AUDIO_WINDOW = 4096;

/** Return the RMS signal level on a full-scale decibel scale, excluding DC offset. */
export function signalLevel(samples) {
  let sum = 0;
  let sumSquares = 0;
  for (const sample of samples) {
    sum += sample;
    sumSquares += sample * sample;
  }
  const power = sumSquares / samples.length - (sum / samples.length) ** 2;
  return power > 0 ? 10 * Math.log10(power) : -Infinity;
}

/** Build a detector that turns raw audio frames into score-independent observations. */
export function createObserver(sampleRate) {
  const detector = PitchDetector.forFloat32Array(AUDIO_WINDOW);
  return (samples, timeMs) => {
    const levelDb = signalLevel(samples);
    const [frequency, clarity] = levelDb > -85 ? detector.findPitch(samples, sampleRate) : [0, 0];
    return { frequency, clarity, levelDb, timeMs, source: 'microphone' };
  };
}
