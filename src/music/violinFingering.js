export const VIOLIN_STRINGS = [
  { name: 'G', number: 4, midi: 55 },
  { name: 'D', number: 3, midi: 62 },
  { name: 'A', number: 2, midi: 69 },
  { name: 'E', number: 1, midi: 76 },
];

// For each semitone above an open string, list the usual finger first.
const FIRST_POSITION = [
  [{ finger: 0, label: 'Open (0)' }],
  [{ finger: 1, label: 'Low 1' }],
  [{ finger: 1, label: '1st finger' }],
  [{ finger: 2, label: 'Low 2' }],
  [{ finger: 2, label: 'High 2' }, { finger: 3, label: 'Low 3' }],
  [{ finger: 3, label: '3rd finger' }],
  [{ finger: 3, label: 'High 3' }, { finger: 4, label: 'Low 4' }],
  [{ finger: 4, label: '4th finger' }],
];

/**
 * @typedef {object} FingerCue
 * @property {'G'|'D'|'A'|'E'} string
 * @property {number} semitones Distance from the open string, from 0 through 7.
 * @property {number} finger 0 means open string.
 * @property {string} label Finger label, including low or high placement where needed.
 * @property {boolean} marked The cue follows a finger or string indicated in the score.
 */

/**
 * Find a first-position fingering in standard tuning, using the highest eligible string.
 * Score markings constrain that choice. Rests and pitches without a match have no cue.
 * @param {import('./musicXml.js').ScoreEvent} event
 * @returns {FingerCue|null}
 */
export function getViolinFingering(event) {
  if (event?.kind !== 'note') return null;
  const { finger, stringNumber } = event.fingering ?? {};

  for (let index = VIOLIN_STRINGS.length - 1; index >= 0; index -= 1) {
    const string = VIOLIN_STRINGS[index];
    if (stringNumber !== undefined && string.number !== stringNumber) continue;
    const semitones = event.midi - string.midi;
    const placement = FIRST_POSITION[semitones]?.find((candidate) => finger === undefined || candidate.finger === finger);
    if (placement) {
      return {
        ...placement, string: string.name, semitones, marked: Boolean(event.fingering),
      };
    }
  }
  return null;
}
