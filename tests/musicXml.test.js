import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { documentForPart, extractPart, readScore } from '../src/music/musicXml.js';

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

const samples = [
  ['02_under_arrest.musicxml', '2. Under arrest!', 27, 5, 'G3', true],
  ['04_down_up.musicxml', '4. Down up', 31, 1, 'E5', false],
];

samples.forEach(([filename, title, notes, rests, firstPitch, repeats]) => {
  test(`extracts the original ${filename} sample with its correct event counts`, async () => {
    const text = await readFile(new URL(`../public/samples/${filename}`, import.meta.url), 'utf8');
    const score = getScore(text);
    const { events, noteCount, warnings } = extractPart(documentForPart(score, 'P1'));
    assert.equal(score.title, title);
    assert.equal(events[0].label, firstPitch);
    assert.equal(noteCount, notes);
    assert.equal(events.length, notes + rests);
    assert.equal(events.at(-1).kind, 'rest');
    assert.equal(warnings.some((warning) => warning.includes('one pass')), repeats);
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

test('reports malformed XML, unsupported chords and unmatched ties', () => {
  assert.throws(() => getScore('<score-partwise><part></score-partwise>'), /malformed XML/);
  assert.throws(() => getScore('<score-timewise/>'), /partwise/);
  assert.throws(() => sequence(file(measure(divisions + note('G', 3, '', '<chord/>')))), /Chords/);
  assert.throws(() => sequence(file(measure(divisions + note('G', 3, '', '<tie type="stop"/>')))), /tie has no matching/);
  assert.throws(() => sequence(file(measure(divisions + note('F', 4, '', '<accidental>sharp</accidental>')))), /printed accidental/);
});
