import assert from 'node:assert/strict';
import test from 'node:test';
import { getViolinFingering, VIOLIN_STRINGS } from '../src/music/violinFingering.js';
import { pitchToMidi } from '../src/utils/pitch.js';

const note = (step, octave, alter = 0, fingering) => ({
  kind: 'note',
  midi: pitchToMidi(step, octave, alter),
  fingering,
});

test('prefers open strings in standard tuning', () => {
  VIOLIN_STRINGS.forEach(({ name, midi }) => {
    const cue = getViolinFingering({ kind: 'note', midi });
    assert.deepEqual(cue, {
      string: name, semitones: 0, finger: 0, label: 'Open (0)', marked: false,
    });
  });
});

test('chooses stopped notes and distinguishes low and high finger positions', () => {
  const examples = [
    [note('A', 3), 'G', 2, '1st finger'],
    [note('E', 4, -1), 'D', 1, 'Low 1'],
    [note('F', 4), 'D', 3, 'Low 2'],
    [note('F', 4, 1), 'D', 4, 'High 2'],
    [note('G', 4), 'D', 5, '3rd finger'],
    [note('D', 5, 1), 'A', 6, 'High 3'],
    [note('B', 5), 'E', 7, '4th finger'],
  ];
  examples.forEach(([event, string, semitones, label]) => {
    const cue = getViolinFingering(event);
    assert.deepEqual([cue.string, cue.semitones, cue.label], [string, semitones, label]);
  });
});

test('uses playable score finger and string markings', () => {
  assert.deepEqual(getViolinFingering(note('A', 4, 0, { finger: 4 })), {
    string: 'D', finger: 4, semitones: 7, label: '4th finger', marked: true,
  });
  assert.equal(getViolinFingering(note('E', 5, 0, { stringNumber: 2 })).string, 'A');
  assert.equal(getViolinFingering(note('D', 5, 1, { finger: 4, stringNumber: 2 })).label, 'Low 4');
});

test('leaves rests, beyond-range pitches and incompatible markings without a placement', () => {
  assert.equal(getViolinFingering({ kind: 'rest' }), null);
  assert.equal(getViolinFingering(note('C', 6)), null);
  assert.equal(getViolinFingering(note('F', 3)), null);
  assert.equal(getViolinFingering(note('C', 5, 1, { finger: 4 })), null);
  assert.equal(getViolinFingering(note('A', 4, 0, { finger: 0, stringNumber: 3 })), null);
});
