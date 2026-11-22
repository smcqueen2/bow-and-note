import { centsBetween, DETECTION_RANGE } from '../utils/pitch.js';

export const DEFAULT_SETTINGS = Object.freeze({
  toleranceCents: 45,
  stableMs: 200,
  minLevelDb: -45,
  minClarity: 0.86,
});

export const RELEASE_MS = 120;
export const REST_MS = 300;
const MAX_FRAME_GAP_MS = 150;
const MAX_WOBBLE_CENTS = 35;

/**
 * @typedef {object} PracticeState
 * @property {number} index Index of the next event, equal to event count on completion.
 * @property {boolean} paused
 * @property {number|null} latchedMidi Last accepted pitch, until a continuous quiet gap.
 * @property {number|null} quietSince Beginning of the current quiet window.
 * @property {{since: number, frequency: number}|null} candidate Stable matching pitch window.
 * @property {import('../audio/observations.js').AudioObservation|null} observation
 * @property {string} reason Most recent decision.
 */

/** Return the initial state, with the first event highlighted. */
export function startPractice() {
  return {
    index: 0,
    paused: false,
    latchedMidi: null,
    quietSince: null,
    candidate: null,
    observation: null,
    reason: 'waiting',
  };
}

/** Check frame-level gates and calculate deviation against the expected pitch. */
export function inspectObservation(observation, expected, settings) {
  if (!observation) return { reason: 'waiting', cents: null, passed: false };
  const { frequency, clarity, levelDb } = observation;
  const cents = expected?.kind === 'note' && frequency > 0
    ? centsBetween(frequency, expected.frequency)
    : null;
  let reason = 'match';
  if (levelDb < settings.minLevelDb) reason = 'quiet';
  else if (clarity < settings.minClarity || !Number.isFinite(clarity)) reason = 'unclear';
  else if (!Number.isFinite(frequency) || frequency < DETECTION_RANGE.min || frequency > DETECTION_RANGE.max) reason = 'range';
  else if (expected?.kind !== 'note') reason = 'rest';
  else if (Math.abs(cents) > settings.toleranceCents) reason = 'wrong';
  return { cents, reason, passed: reason === 'match' };
}

/** Clear timing windows after a settings, microphone or pause change. Keep the repeat guard. */
export function clearTiming(state, paused = state.paused) {
  return { ...state, paused, observation: null, quietSince: null, candidate: null, reason: 'waiting' };
}

/** Move a single event using the manual controls. */
export function movePractice(state, events, delta) {
  const index = Math.max(0, Math.min(events.length, state.index + delta));
  const skipped = delta > 0 ? events[state.index] : null;
  return { ...clearTiming(state), index, latchedMidi: skipped?.midi ?? state.latchedMidi };
}

/** Apply one observation to wait-for-note practice, independent of audio capture or UI. */
export function observePractice(state, events, observation, settings = DEFAULT_SETTINGS) {
  const expected = events[state.index];
  if (state.paused || !expected) return { ...state, observation };

  const { timeMs } = observation;
  const elapsed = timeMs - (state.observation?.timeMs ?? -Infinity);
  const continuous = observation.source === state.observation?.source && elapsed > 0 && elapsed <= MAX_FRAME_GAP_MS;
  const { reason, passed } = inspectObservation(observation, expected, settings);
  const next = { ...state, observation, candidate: null, quietSince: null, reason };

  if (reason === 'quiet') {
    next.quietSince = (continuous ? state.quietSince : null) ?? timeMs;
    const quietMs = timeMs - next.quietSince;
    if (quietMs >= RELEASE_MS) next.latchedMidi = null;
    if (expected.kind === 'rest') {
      next.reason = 'rest';
      if (quietMs >= REST_MS) {
        next.index += 1;
        next.quietSince = null;
        next.reason = 'accepted';
      }
    } else if (next.latchedMidi === expected.midi) {
      next.reason = 'release';
    }
    return next;
  }

  if (!passed) return next;
  if (state.latchedMidi === expected.midi) return { ...next, reason: 'release' };

  const previous = continuous ? state.candidate : null;
  const stable = previous && Math.abs(centsBetween(observation.frequency, previous.frequency)) <= MAX_WOBBLE_CENTS;
  next.candidate = stable ? previous : { since: timeMs, frequency: observation.frequency };
  next.reason = 'steady';
  if (timeMs - next.candidate.since >= settings.stableMs) {
    next.index += 1;
    next.latchedMidi = expected.midi;
    next.candidate = null;
    next.reason = 'accepted';
  }
  return next;
}

/** Feed a separate simulated attack or rest through the same frame-based progression. */
export function simulatePractice(state, events, frequency, settings) {
  const interval = 40;
  let timeMs = (state.observation?.timeMs ?? 0) + interval;
  const silenceLength = frequency ? RELEASE_MS : REST_MS;
  function feedFrames(current, duration, pitch) {
    let result = current;
    for (let tick = 0; tick <= Math.ceil(duration / interval); tick += 1) {
      result = observePractice(result, events, {
        frequency: pitch,
        clarity: pitch ? 1 : 0,
        levelDb: pitch ? -18 : -Infinity,
        timeMs,
        source: 'simulation',
      }, settings);
      timeMs += interval;
    }
    return result;
  }
  const expected = events[state.index];
  const released = frequency && expected?.kind !== 'note' ? state : feedFrames(state, silenceLength, 0);
  return frequency ? feedFrames(released, settings.stableMs, frequency) : released;
}
