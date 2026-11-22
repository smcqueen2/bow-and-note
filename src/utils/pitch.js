const STEPS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const CHROMATIC = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

export const DETECTION_RANGE = Object.freeze({ min: 175, max: 1750 });

/** Convert a written pitch to its MIDI number, including accidentals that cross octaves. */
export function pitchToMidi(step, octave, alter = 0) {
  return 12 * (octave + 1) + STEPS[step] + alter;
}

/** Convert a MIDI note to its equal-tempered frequency at A4 = 440 Hz. */
export function midiToFrequency(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Return the signed distance between two frequencies in cents. */
export function centsBetween(frequency, reference) {
  return 1200 * Math.log2(frequency / reference);
}

/** Describe the nearest equal-tempered pitch, or return null for an invalid reading. */
export function frequencyToNote(frequency) {
  if (!Number.isFinite(frequency) || frequency <= 0) return null;
  const midi = Math.round(69 + 12 * Math.log2(frequency / 440));
  const octave = Math.floor(midi / 12) - 1;
  const name = CHROMATIC[((midi % 12) + 12) % 12];
  return { midi, name, octave, label: `${name}${octave}`, cents: centsBetween(frequency, midiToFrequency(midi)) };
}
