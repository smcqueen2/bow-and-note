import { DEFAULT_SETTINGS, inspectObservation } from '../practice/waitForNote.js';
import { frequencyToNote } from '../utils/pitch.js';
import Icon from './Icon.jsx';

const settingControls = [
  { key: 'toleranceCents', label: 'Pitch tolerance', min: 15, max: 49, step: 1, format: (value) => `±${value} ¢` },
  { key: 'stableMs', label: 'Minimum hold', min: 100, max: 450, step: 10, format: (value) => `${value} ms` },
  { key: 'minLevelDb', label: 'Minimum level', min: -65, max: -22, step: 1, format: (value) => `${value} dBFS` },
  { key: 'minClarity', label: 'Minimum clarity', min: 0.65, max: 0.99, step: 0.01, format: (value) => `${Math.round(value * 100)}%` },
];

const reasons = {
  waiting: 'Waiting',
  quiet: 'Below minimum level',
  unclear: 'Below minimum clarity',
  range: 'Outside detection range',
  wrong: 'Outside pitch tolerance',
  rest: 'Waiting for quiet',
  release: 'Waiting for bow release',
  steady: 'Checking pitch stability',
  accepted: 'Event accepted',
};

function formatCents(value) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value);
  return `${rounded > 0 ? '+' : ''}${rounded} ¢`;
}

/** Expose tuning thresholds and audio diagnostics apart from the practice controls. */
export default function DeveloperPanel({
  events, expected, state, settings, onSettings, onSimulate, microphonePhase, disabled,
}) {
  const { observation } = state;
  const detected = frequencyToNote(observation?.frequency);
  const gate = inspectObservation(observation, expected, settings);
  const availableNotes = [...new Map(events.filter(({ kind }) => kind === 'note')
    .map((event) => [event.midi, event])).values()].sort((left, right) => left.midi - right.midi);
  const simulationDisabled = disabled || state.paused || !expected || microphonePhase !== 'off';
  const data = [
    ['Source', observation?.source || '—'],
    ['Raw frequency', detected ? `${observation.frequency.toFixed(2)} Hz` : '—'],
    ['Nearest note', detected?.label || '—'],
    ['Nearest-note deviation', formatCents(detected?.cents)],
    ['Signal level', !observation ? '—' : Number.isFinite(observation.levelDb)
      ? `${observation.levelDb.toFixed(1)} dBFS` : '−∞ dBFS'],
    ['Clarity', observation ? `${Math.round(observation.clarity * 100)}%` : '—'],
    ['Expected note', expected?.label || '—'],
    ['Expected-note deviation', formatCents(gate.cents)],
    ['Frame passed pitch gates', observation ? (gate.passed ? 'Yes' : 'No') : '—'],
    ['Last progression decision', state.paused ? 'Paused' : (reasons[state.reason] || 'Matching pitch')],
  ];

  return (
    <details className="developer card">
      <summary><Icon name="tools" /> Developer tools <Icon name="down" size={17} /></summary>
      <div className="developer-content">
        <section>
          <h3>Test without a violin</h3>
          <p>Turn the microphone off. Tap a note to simulate a fresh bow stroke, or tap Quiet for a rest.</p>
          <div className="simulator-controls">
            {availableNotes.map(({ midi, label, frequency }) => (
              <button type="button" className="button button-outline" key={midi} disabled={simulationDisabled} onClick={() => onSimulate(frequency)}>
                {label}
              </button>
            ))}
            <button type="button" className="button button-outline" disabled={simulationDisabled} onClick={() => onSimulate(0)}>Quiet</button>
          </div>
          <h3>Detection settings</h3>
          <div className="sliders">
            {settingControls.map(({ key, label, min, max, step, format }) => (
              <label key={key}>
                <span>{label} <strong>{format(settings[key])}</strong></span>
                <input type="range" min={min} max={max} step={step} value={settings[key]} aria-valuetext={format(settings[key])}
                  onChange={(event) => onSettings({ ...settings, [key]: Number(event.target.value) })} />
              </label>
            ))}
          </div>
          <button type="button" className="button button-outline" onClick={() => onSettings(DEFAULT_SETTINGS)}>Reset settings</button>
        </section>
        <section>
          <h3>Live audio diagnostics</h3>
          <dl className="diagnostics">
            {data.map(([label, value]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd></div>
            ))}
          </dl>
        </section>
      </div>
    </details>
  );
}
