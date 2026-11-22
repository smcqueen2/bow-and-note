import { DETECTION_RANGE, midiToFrequency, pitchToMidi } from '../utils/pitch.js';

const MAX_SIZE = 2 * 1024 * 1024;
const ACCIDENTALS = { '-2': '♭♭', '-1': '♭', 0: '', 1: '♯', 2: '♯♯' };
const PRINTED_ALTERATIONS = { 'flat-flat': -2, flat: -1, natural: 0, sharp: 1, 'double-sharp': 2, 'sharp-sharp': 2 };
const NAVIGATION = ['dacapo', 'dalsegno', 'fine', 'tocoda', 'segno', 'coda', 'forward-repeat'];
const ORNAMENTS = ['ornaments', 'harmonic', 'glissando', 'slide', 'bend'];
const REPEAT_TEXT = /^(?:d\.?\s*[cs]\.?\s*(?:al\s+(?:fine|coda))?|da capo(?:\s+al\s+(?:fine|coda))?|dal segno(?:\s+al\s+(?:fine|coda))?|to coda|fine|segno|coda)[.!]?$/i;

/**
 * @typedef {object} ScoreEvent
 * @property {'note'|'rest'} kind
 * @property {number} visualIndex First written note or rest in the selected part.
 * @property {number} visualCount Number of written notes covered by this event.
 * @property {number} measureIndex Zero-based measure index.
 * @property {string} measureNumber Printed measure label.
 * @property {number} durationQuarters Duration in quarter notes, including tied segments.
 * @property {string} label Written pitch and octave, or Rest.
 * @property {number} [midi] Sounding MIDI number.
 * @property {number} [frequency] Target frequency in Hz.
 * @property {{finger?: number, stringNumber?: number}} [fingering] Unambiguous technical markings at the attack.
 */

const children = (element, name) => Array.from(element.children).filter((node) => node.localName === name);
const child = (element, name) => children(element, name)[0];
const value = (element, name) => child(element, name)?.textContent.trim();
const descendants = (element, name) => Array.from(element.getElementsByTagNameNS('*', name));
const has = (element, names) => names.some((name) => descendants(element, name).length > 0);

/** Parse uncompressed, partwise MusicXML and enumerate its selectable parts. */
export function readScore(xml, fallbackTitle, parse = (source) => new DOMParser().parseFromString(source, 'application/xml')) {
  if (!xml.trim()) throw new Error('This file is empty.');
  if (xml.length > MAX_SIZE) throw new Error('Choose a MusicXML file smaller than 2 MB.');
  if (/<!ENTITY\b|<!DOCTYPE\b[^>]*\[/i.test(xml)) {
    throw new Error('MusicXML with custom XML entities or an internal DTD is unsupported.');
  }

  let document;
  try {
    document = parse(xml);
  } catch {
    throw new Error('This file has malformed XML. Try exporting it again as uncompressed MusicXML.');
  }
  const root = document.documentElement;
  if (!root || root.localName === 'parsererror' || descendants(root, 'parsererror').length) {
    throw new Error('This file has malformed XML. Try exporting it again as uncompressed MusicXML.');
  }
  if (root.localName !== 'score-partwise') {
    throw new Error('Choose an uncompressed partwise MusicXML file (.musicxml or .xml).');
  }

  const partList = child(root, 'part-list');
  const definitions = partList ? children(partList, 'score-part') : [];
  const parts = children(root, 'part').map((element) => {
    const id = element.getAttribute('id');
    const definition = definitions.find((entry) => entry.getAttribute('id') === id);
    if (!id || !definition) throw new Error('A score part is missing its part-list entry.');
    return { id, name: value(definition, 'part-name') || id };
  });
  if (!parts.length || new Set(parts.map(({ id }) => id)).size !== parts.length) {
    throw new Error('The score must contain at least one part, with a unique ID for each part.');
  }
  const work = child(root, 'work');
  const title = value(root, 'movement-title') || (work && value(work, 'work-title')) || fallbackTitle;
  return { document, title, parts };
}

/** Clone the score with just the selected part, keeping its original engraving information. */
export function documentForPart(score, partId) {
  const document = score.document.cloneNode(true);
  const root = document.documentElement;
  const list = child(root, 'part-list');
  children(root, 'part').filter((part) => part.getAttribute('id') !== partId)
    .forEach((part) => root.removeChild(part));
  children(list, 'score-part').filter((part) => part.getAttribute('id') !== partId)
    .forEach((part) => list.removeChild(part));
  children(list, 'part-group').forEach((group) => list.removeChild(group));
  return document;
}

function readPitch(note, fail) {
  const pitch = child(note, 'pitch');
  if (!pitch) throw fail('A note is missing its pitch.');
  const step = value(pitch, 'step');
  const octaveText = value(pitch, 'octave');
  const alterText = value(pitch, 'alter');
  const octave = Number(octaveText);
  const alter = alterText === undefined ? 0 : Number(alterText);
  if (!step || !/^[A-G]$/.test(step) || !octaveText || !/^[0-9]$/.test(octaveText)) {
    throw fail('A pitch needs a step from A to G and an octave from 0 to 9.');
  }
  if (alterText === '' || !Object.hasOwn(ACCIDENTALS, alter)) {
    throw fail('Practice supports conventional sharps and flats up to double accidentals.');
  }
  const printed = value(note, 'accidental');
  if (Object.hasOwn(PRINTED_ALTERATIONS, printed) && PRINTED_ALTERATIONS[printed] !== alter) {
    throw fail('A printed accidental disagrees with the sounding pitch. Check its MusicXML alter value.');
  }
  // MusicXML encodes sounding accidentals in <alter>, including those supplied by the key.
  const midi = pitchToMidi(step, octave, alter);
  return { label: `${step}${ACCIDENTALS[alter]}${octave}`, midi, frequency: midiToFrequency(midi) };
}

function tieTypes(note) {
  const sounding = children(note, 'tie');
  const ties = sounding.length ? sounding : descendants(note, 'tied');
  const types = ties.map((tie) => tie.getAttribute('type'));
  return {
    starts: types.includes('start') || types.includes('continue'),
    stops: types.includes('stop') || types.includes('continue'),
  };
}

function primaryTechnicalNumber(note, name, pattern) {
  const values = new Set(descendants(note, name)
    .filter((entry) => entry.parentNode.localName === 'technical'
      && entry.getAttribute('alternate') !== 'yes' && entry.getAttribute('substitution') !== 'yes')
    .map((entry) => entry.textContent.trim()));
  const [number] = values;
  return values.size === 1 && pattern.test(number) ? Number(number) : undefined;
}

function readFingering(note) {
  const finger = primaryTechnicalNumber(note, 'fingering', /^[0-4]$/);
  const stringNumber = primaryTechnicalNumber(note, 'string', /^[1-4]$/);
  return finger !== undefined || stringNumber !== undefined ? { finger, stringNumber } : undefined;
}

/** Extract the written sequence for a single, non-transposing voice on one staff. */
export function extractPart(document) {
  const part = child(document.documentElement, 'part');
  const unsupported = [
    [['chord'], 'Chords and double stops are unsupported. Choose a part with one note at a time.'],
    [['backup', 'forward'], 'Overlapping voices or written time gaps are unsupported. Use a single melody with written rests.'],
    [['grace', 'cue', 'unpitched'], 'Grace notes, cue notes and unpitched notes are unsupported in practice.'],
    [['transpose', 'octave-shift', 'clef-octave-change'], 'Transposing parts and octave shifts are unsupported in practice.'],
    [['multiple-rest', 'measure-repeat', 'beat-repeat'], 'Shorthand for multiple rests, repeated measures or beats is unsupported.'],
  ];
  const problem = unsupported.find(([tags]) => has(part, tags));
  if (problem) throw new Error(problem[1]);

  const notes = descendants(part, 'note');
  const voices = new Set(notes.map((note) => value(note, 'voice') || '1'));
  const staves = descendants(part, 'staves');
  if (voices.size > 1 || staves.some((staff) => Number(staff.textContent) > 1)
    || notes.some((note) => Number(value(note, 'staff') || 1) !== 1)) {
    throw new Error('Practice needs a single voice on one staff. Try another part.');
  }
  if (notes.some((note) => note.getAttribute('print-object') === 'no')) {
    throw new Error('Hidden notes and rests are unsupported in practice.');
  }

  const warnings = [];
  if (has(part, ['repeat', 'ending', 'segno', 'coda'])
    || descendants(part, 'sound').some((sound) => NAVIGATION.some((name) => sound.hasAttribute(name)))
    || descendants(part, 'words').some((words) => REPEAT_TEXT.test(words.textContent.trim()))) {
    warnings.push('Practise one pass in printed order. Repeat signs, alternate endings and score jumps are shown where supported.');
  }
  if (has(part, ORNAMENTS)) {
    warnings.push('For ornaments, harmonics and slides, practise the written pitch.');
  }

  const events = [];
  let visualIndex = 0;
  let divisions;
  let openTie;
  children(part, 'measure').forEach((measure, measureIndex) => {
    const measureNumber = measure.getAttribute('number') || String(measureIndex + 1);
    const fail = (message) => new Error(`Measure ${measureNumber}. ${message}`);
    Array.from(measure.children).forEach((entry) => {
      if (entry.localName === 'attributes') {
        const nextDivisions = value(entry, 'divisions');
        if (nextDivisions !== undefined) {
          divisions = Number(nextDivisions);
          if (!Number.isFinite(divisions) || divisions <= 0) throw fail('Invalid divisions value.');
        }
      }
      if (entry.localName !== 'note') return;

      const duration = Number(value(entry, 'duration'));
      if (!divisions || !Number.isFinite(duration) || duration <= 0) {
        throw fail('Each note or rest needs a positive duration and a divisions value.');
      }
      const durationQuarters = duration / divisions;
      const position = { visualIndex, visualCount: 1, measureIndex, measureNumber, durationQuarters };
      visualIndex += 1;
      if (child(entry, 'rest')) {
        if (openTie) throw fail('A tie ends before this rest without a matching tied note.');
        events.push({ ...position, kind: 'rest', label: 'Rest' });
        return;
      }

      const pitch = readPitch(entry, fail);
      const { starts, stops } = tieTypes(entry);
      if (stops) {
        if (!openTie || openTie.midi !== pitch.midi) throw fail('A tie has no matching note of the same pitch.');
        openTie.durationQuarters += durationQuarters;
        openTie.visualCount += 1;
      } else {
        if (openTie) throw fail('A tie is missing its continuation.');
        events.push({
          ...position, ...pitch, kind: 'note', fingering: readFingering(entry),
        });
      }
      openTie = starts ? events.at(-1) : null;
    });
  });
  if (openTie) throw new Error('The final tie is missing its continuation.');
  const noteCount = events.filter(({ kind }) => kind === 'note').length;
  if (!noteCount) throw new Error('This part needs at least one pitched note.');
  if (events.some(({ frequency }) => frequency < DETECTION_RANGE.min || frequency > DETECTION_RANGE.max)) {
    warnings.push('Some pitches are outside the detection range. Use Next for those notes.');
  }
  return { events, visualCount: visualIndex, noteCount, warnings };
}
