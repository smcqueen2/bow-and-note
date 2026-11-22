import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { documentForPart, extractPart, readScore } from '../src/music/musicXml.js';
import { DEFAULT_SAMPLE, SAMPLES } from '../src/music/samples.js';

const parse = (text) => new DOMParser({ onError: (_, message) => { throw new Error(message); } })
  .parseFromString(text, 'application/xml');
const divisions = '<attributes><divisions>4</divisions></attributes>';
const measure = (body, number = 1) => `<measure number="${number}">${body}</measure>`;
const note = (step, octave, alter = '', suffix = '') => (
  `<note><pitch><step>${step}</step>${alter}<octave>${octave}</octave></pitch><duration>4</duration>${suffix}</note>`
);
const file = (first, second) => `
<score-partwise version="4.0">
  <part-list>
    <score-part id="P1"><part-name>Violin</part-name></score-part>
    ${second ? '<score-part id="P2"><part-name>Second violin</part-name></score-part>' : ''}
  </part-list>
  <part id="P1">${first}</part>
  ${second ? `<part id="P2">${second}</part>` : ''}
</score-partwise>`;

const getScore = (xml) => readScore(xml, 'Test score', parse);
const sequence = (xml, part = 'P1') => extractPart(documentForPart(getScore(xml), part));

const samplesDirectory = new URL('../public/samples/', import.meta.url);
const expectedSamples = {
  '01_bow_down_o_belinda.musicxml': { parts: [[24, 0, 'G4'], [16, 0, 'G3']] },
  '02_under_arrest.musicxml': { parts: [[27, 5, 'G3']], repeats: true },
  '03_jim_along_josie.musicxml': { parts: [[20, 0, 'E5'], [16, 0, 'A4']], repeats: true },
  '04_down_up.musicxml': { parts: [[31, 1, 'E5']] },
  '05_two_in_a_boat.musicxml': { parts: [[36, 0, 'A4'], [16, 0, 'A4']] },
  '06_london_bridge.musicxml': { parts: [[24, 0, 'A4'], [24, 0, 'D4']] },
  '07_fast_lane.musicxml': { parts: [[37, 6, 'D4']], repeats: true },
  '08_in_flight.musicxml': { parts: [[14, 2, 'E5']], repeats: true },
};

test('lists every bundled score once, in worksheet order, and opens Under arrest by default', async () => {
  const filenames = (await readdir(samplesDirectory)).filter((filename) => filename.endsWith('.musicxml')).sort();
  assert.deepEqual(SAMPLES.map(({ id }) => id), filenames);
  assert.equal(DEFAULT_SAMPLE.id, '02_under_arrest.musicxml');
});

SAMPLES.forEach(({ id, label }) => {
  test(`extracts all parts and written events from ${label}`, async () => {
    const text = await readFile(new URL(id, samplesDirectory), 'utf8');
    const score = getScore(text);
    const { parts, repeats = false } = expectedSamples[id];
    assert.equal(score.title.replace(/^\d+\. /, ''), label);
    assert.equal(score.parts.length, parts.length);
    score.parts.forEach((part, index) => {
      const { events, noteCount, warnings } = extractPart(documentForPart(score, part.id));
      const [notes, rests, firstPitch] = parts[index];
      assert.equal(events[0].label, firstPitch);
      assert.equal(noteCount, notes);
      assert.equal(events.length, notes + rests);
      assert.equal(warnings.some((warning) => warning.includes('one pass')), repeats);
    });
  });
});

test('reads sounding alterations encoded by MusicXML under the key and a printed natural', () => {
  const key = '<attributes><divisions>4</divisions><key><fifths>1</fifths></key></attributes>';
  const { events } = sequence(file(measure(key + [
    note('F', 4, '<alter>1</alter>'),
    note('F', 4, '<alter>0</alter>', '<accidental>natural</accidental>'),
    note('G', 4, '<alter>-1</alter>', '<accidental>flat</accidental>'),
  ].join(''))));
  assert.deepEqual(events.map(({ label, midi }) => [label, midi]), [['F♯4', 66], ['F4', 65], ['G♭4', 66]]);
});

test('isolates a selected part without modifying the source document', () => {
  const score = getScore(file(measure(divisions + note('G', 3)), measure(divisions + note('E', 5))));
  assert.equal(score.parts.length, 2);
  const selected = documentForPart(score, 'P2');
  assert.equal(selected.getElementsByTagName('part').length, 1);
  assert.equal(selected.getElementsByTagName('score-part').length, 1);
  assert.equal(extractPart(selected).events[0].label, 'E5');
  assert.equal(score.document.getElementsByTagName('part').length, 2);
});

test('merges a tie chain across measures and preserves written cursor positions', () => {
  const first = measure(divisions + note('A', 4, '', '<tie type="start"/>'));
  const middle = measure(note('A', 4, '', '<tie type="stop"/><tie type="start"/>'), 2);
  const last = measure(note('A', 4, '', '<tie type="stop"/>') + note('A', 4), 3);
  const result = sequence(file(first + middle + last));
  assert.deepEqual(result.events.map(({ label, visualIndex, visualCount, durationQuarters }) => (
    [label, visualIndex, visualCount, durationQuarters]
  )), [['A4', 0, 3, 3], ['A4', 3, 1, 1]]);
  assert.equal(result.noteCount, 2);
});

test('retains the primary finger and string at a tied note’s attack', () => {
  const markup = '<notations><technical><fingering>4</fingering><fingering alternate="yes">0</fingering><string>3</string></technical></notations>';
  const substitute = '<notations><technical><fingering substitution="yes">0</fingering></technical></notations>';
  const first = measure(divisions + note('A', 4, '', '<tie type="start"/>' + markup));
  const second = measure(note('A', 4, '', '<tie type="stop"/>' + substitute), 2);
  const { events } = sequence(file(first + second));
  assert.equal(events.length, 1);
  assert.deepEqual(events[0].fingering, { finger: 4, stringNumber: 3 });
});

test('reports malformed XML, unsupported chords and unmatched ties', () => {
  assert.throws(() => getScore('<score-partwise><part></score-partwise>'), /malformed XML/);
  assert.throws(() => getScore('<score-timewise/>'), /partwise/);
  assert.throws(() => sequence(file(measure(divisions + note('G', 3, '', '<chord/>')))), /Chords/);
  assert.throws(() => sequence(file(measure(divisions + note('G', 3, '', '<tie type="stop"/>')))), /tie has no matching/);
  assert.throws(() => sequence(file(measure(divisions + note('F', 4, '', '<accidental>sharp</accidental>')))), /printed accidental/);
});
