import assert from 'node:assert/strict';
import test from 'node:test';
import { AUDIO_WINDOW, createObserver, signalLevel } from '../src/audio/observations.js';
import { centsBetween, frequencyToNote, midiToFrequency, pitchToMidi } from '../src/utils/pitch.js';

const strings = [[196, 'G3'], [293.66, 'D4'], [440, 'A4'], [659.25, 'E5']];

test('maps open strings and stopped pitches to the correct octave', () => {
  strings.forEach(([frequency, label]) => assert.equal(frequencyToNote(frequency).label, label));
  assert.equal(frequencyToNote(369.99).label, 'F♯4');
  assert.equal(frequencyToNote(523.25).label, 'C5');
  assert.equal(pitchToMidi('C', 5, -1), pitchToMidi('B', 4));
  assert.equal(pitchToMidi('B', 4, 1), pitchToMidi('C', 5));
  assert.equal(midiToFrequency(69), 440);
  assert.equal(frequencyToNote(NaN), null);
  assert.equal(frequencyToNote(0), null);
});

test('cents measure a signed logarithmic distance', () => {
  assert.equal(centsBetween(880, 440), 1200);
  assert.equal(centsBetween(220, 440), -1200);
  assert.ok(Math.abs(centsBetween(440 * 2 ** (35 / 1200), 440) - 35) < 0.0001);
});

test('Pitchy detects synthetic open strings and stopped notes at common sampling rates', () => {
  [44100, 48000].forEach((sampleRate) => {
    const observe = createObserver(sampleRate);
    [...strings, [554.37, 'C♯5']].forEach(([hz, label]) => {
      const samples = Float32Array.from({ length: AUDIO_WINDOW }, (_, index) => {
        const phase = 2 * Math.PI * hz * index / sampleRate;
        return 0.13 * Math.sin(phase) + 0.07 * Math.sin(2 * phase);
      });
      const frame = observe(samples, 0);
      assert.equal(frequencyToNote(frame.frequency).label, label);
      assert.ok(frame.clarity > 0.95);
      assert.ok(frame.levelDb > -45);
    });
  });
});

test('silence and a DC offset have no AC signal level', () => {
  assert.equal(signalLevel(new Float32Array(AUDIO_WINDOW).fill(0.125)), -Infinity);
  const observation = createObserver(48000)(new Float32Array(AUDIO_WINDOW), 5);
  assert.equal(observation.frequency, 0);
  assert.equal(observation.clarity, 0);
});
