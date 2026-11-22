import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { DOMParser } from '@xmldom/xmldom';
import { documentForPart, extractPart, readScore } from '../src/music/musicXml.js';
import { SAMPLES } from '../src/music/samples.js';
import {
  clearTiming, DEFAULT_SETTINGS, inspectObservation, movePractice, observePractice, simulatePractice, startPractice,
} from '../src/practice/waitForNote.js';
import { midiToFrequency } from '../src/utils/pitch.js';

const note = (midi) => ({ kind: 'note', midi, frequency: midiToFrequency(midi) });
const g = note(55);
const d = note(62);
const rest = { kind: 'rest' };
const frame = (timeMs, frequency = g.frequency, levelDb = -20, clarity = 0.95) => ({
  timeMs, frequency, levelDb, clarity, source: 'microphone',
});

function hold(state, events, times, frequency, levelDb, clarity) {
  return times.reduce((current, time) => (
    observePractice(current, events, frame(time, frequency, levelDb, clarity))
  ), state);
}

test('checks the configured pitch tolerance against the expected note', () => {
  const sharp = frame(0, g.frequency * 2 ** (36 / 1200));
  assert.equal(inspectObservation(sharp, g, DEFAULT_SETTINGS).passed, true);
  assert.equal(inspectObservation(sharp, g, { ...DEFAULT_SETTINGS, toleranceCents: 30 }).passed, false);
  assert.equal(inspectObservation(frame(0, g.frequency * 2), g, DEFAULT_SETTINGS).reason, 'wrong');
  assert.equal(inspectObservation(frame(0, 95), g, DEFAULT_SETTINGS).reason, 'range');
});

test('only advances for a continuous, stable target after enough time', () => {
  const events = [g, d];
  let state = hold(startPractice(), events, [0, 50, 100, 150, 200], d.frequency);
  assert.equal(state.index, 0);
  state = hold(state, events, [250, 300, 350, 400]);
  assert.equal(state.index, 0);
  state = hold(state, events, [450]);
  assert.equal(state.index, 1);
  state = hold(state, events, [500, 550, 600, 650, 700], d.frequency);
  assert.equal(state.index, events.length);
});

test('resets the hold after silence, noise, a skipped frame or a large pitch wobble', () => {
  const events = [g];
  let state = hold(startPractice(), events, [0, 50, 100, 150]);
  state = observePractice(state, events, frame(200, g.frequency, -60));
  assert.equal(state.reason, 'quiet');
  state = hold(state, events, [250, 300, 350, 400]);
  state = observePractice(state, events, frame(450, g.frequency, -18, 0.2));
  assert.equal(state.reason, 'unclear');
  state = hold(state, events, [500, 550, 600, 650, 1000]);
  assert.equal(state.index, 0);
  state = hold(state, events, [1050, 1100, 1150, 1200], g.frequency * 2 ** (42 / 1200));
  assert.equal(state.index, 0);
  assert.equal(state.candidate.since, 1050);
});

test('repeated pitch needs a quiet release before a second acceptance', () => {
  const events = [g, g, g];
  let state = hold(startPractice(), events, [0, 50, 100, 150, 200, 250, 300, 350, 400, 450]);
  assert.equal(state.index, 1);
  assert.equal(state.reason, 'release');
  state = hold(state, events, [500, 550], 0, -80, 0);
  state = hold(state, events, [600, 650, 700, 750, 800]);
  assert.equal(state.index, 1);
  state = hold(state, events, [850, 900, 950, 1000], 0, -80, 0);
  state = hold(state, events, [1050, 1100, 1150, 1200, 1250]);
  assert.equal(state.index, 2);
});

test('advances a rest after quiet and rejects loud unpitched noise', () => {
  const events = [g, rest, g];
  let state = simulatePractice(startPractice(), events, g.frequency, DEFAULT_SETTINGS);
  assert.equal(state.index, 1);
  state = simulatePractice(state, events, g.frequency, DEFAULT_SETTINGS);
  assert.equal(state.index, 1);
  state = hold(state, events, [1000, 1050, 1100, 1150, 1200, 1250, 1300], 0, -22, 0.15);
  assert.equal(state.index, 1);
  state = hold(state, events, [1350, 1400, 1450, 1500, 1550, 1600, 1650], 0, -65, 0);
  assert.equal(state.index, 2);
  assert.equal(state.latchedMidi, null);
});

test('pause stops progression and manual navigation remains usable', () => {
  const events = [g, rest, d];
  const paused = clearTiming(startPractice(), true);
  assert.equal(simulatePractice(paused, events, g.frequency, DEFAULT_SETTINGS).index, 0);
  assert.equal(movePractice(paused, events, -1).index, 0);
  assert.equal(movePractice(paused, events, 1).paused, true);
  const resumed = clearTiming(movePractice(paused, events, 1), false);
  const next = simulatePractice(resumed, events, 0, DEFAULT_SETTINGS);
  const complete = simulatePractice(next, events, d.frequency, DEFAULT_SETTINGS);
  assert.equal(complete.index, 3);
  assert.equal(movePractice(complete, events, 1).index, 3);
  assert.equal(movePractice(complete, events, -1).index, 2);
});

SAMPLES.forEach(({ id, label }) => {
  test(`completes every part of ${label} through the shared simulator`, async () => {
    const xml = await readFile(new URL(`../public/samples/${id}`, import.meta.url), 'utf8');
    const score = readScore(xml, label, (source) => new DOMParser().parseFromString(source, 'application/xml'));
    score.parts.forEach((part) => {
      const { events } = extractPart(documentForPart(score, part.id));
      const result = events.reduce((state, event, index) => {
        const next = simulatePractice(state, events, event.frequency ?? 0, DEFAULT_SETTINGS);
        assert.equal(next.index, index + 1, part.name);
        return next;
      }, startPractice());
      assert.equal(result.index, events.length);
    });
  });
});
