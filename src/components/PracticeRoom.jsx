import { useCallback, useMemo, useState } from 'react';
import useMicrophone from '../hooks/useMicrophone.js';
import { documentForPart, extractPart } from '../music/musicXml.js';
import { clearTiming, movePractice, observePractice, simulatePractice, startPractice } from '../practice/waitForNote.js';
import { frequencyToNote } from '../utils/pitch.js';
import DeveloperPanel from './DeveloperPanel.jsx';
import Icon from './Icon.jsx';
import ScoreView from './ScoreView.jsx';

const EMPTY_EVENTS = [];

function tipFor(expected, phase, state) {
  if (!expected) return 'Every note is complete.';
  if (state.paused) return 'Resume when you’re ready.';
  if (expected.kind === 'rest') return 'Stay quiet for a moment or tap Next.';
  if (state.latchedMidi === expected.midi) return 'Lift the bow briefly, then play the note again.';
  if (state.reason === 'wrong' && phase === 'live') return `Try playing ${expected.label}.`;
  if (state.reason === 'unclear' && phase === 'live') return 'Try a steady bow stroke.';
  return 'Hold the highlighted note steady.';
}

/** Display one selected exercise part and connect its score, controls and audio observations. */
export default function PracticeRoom({ exercise, partId, onPart, settings, onSettings }) {
  const { document, sequence, issue } = useMemo(() => {
    const partDocument = documentForPart(exercise, partId);
    try {
      return { document: partDocument, sequence: extractPart(partDocument), issue: '' };
    } catch (error) {
      return { document: partDocument, sequence: null, issue: error.message };
    }
  }, [exercise, partId]);
  const events = sequence?.events ?? EMPTY_EVENTS;
  const [scoreStatus, setScoreStatus] = useState({ phase: 'loading', error: '' });
  const [state, setState] = useState(startPractice);
  const onObservation = useCallback((observation) => {
    setState((current) => observePractice(current, events, observation, settings));
  }, [events, settings]);
  const resetTiming = useCallback(() => setState((current) => clearTiming(current)), []);
  const microphone = useMicrophone(onObservation, resetTiming);
  const disabled = !sequence || scoreStatus.phase !== 'ready';
  const complete = Boolean(sequence) && state.index === events.length;
  const expected = events[state.index];
  const noteCount = sequence?.noteCount ?? 0;
  const completedNotes = events.slice(0, state.index).filter(({ kind }) => kind === 'note').length;
  const detected = frequencyToNote(state.observation?.frequency);
  const reading = state.observation?.levelDb >= settings.minLevelDb
    && state.observation?.clarity >= settings.minClarity ? detected : null;
  const micLabel = { off: 'Off', starting: 'Connecting', live: 'Listening' }[microphone.phase];

  function changeSettings(next) {
    resetTiming();
    onSettings(next);
  }

  return (
    <>
      <div className="practice-grid">
        <section className="score-card card" aria-labelledby="exercise-title">
          <div className="score-header">
            <div className="score-heading">
              <div className="section-label"><Icon name="note" size={16} /> Sheet music</div>
              <h2 id="exercise-title">{exercise.title}</h2>
            </div>
            {exercise.parts.length > 1 && (
              <label className="part-picker">
                Part
                <span>
                  <select value={partId} onChange={(event) => onPart(event.target.value)}>
                    {exercise.parts.map(({ id, name }) => <option value={id} key={id}>{name}</option>)}
                  </select>
                  <Icon name="down" size={15} />
                </span>
              </label>
            )}
          </div>
          {sequence && (
            <div className="progress">
              <span>Progress</span>
              <strong>{completedNotes} of {noteCount} notes</strong>
              <progress value={completedNotes} max={noteCount} aria-label="Notes completed" />
            </div>
          )}
          {scoreStatus.phase === 'loading' && <p className="inline-message" role="status">Drawing the sheet music…</p>}
          <ScoreView document={document} events={sequence?.events} index={state.index} onStatus={setScoreStatus} />
          <div className="score-meta">
            <span><i className="legend-current" /> Current note</span>
            <span><i className="legend-played" /> Completed</span>
          </div>
          {issue && <p className="inline-message" role="alert"><Icon name="info" />{issue}</p>}
          {scoreStatus.error && <p className="inline-message" role="alert"><Icon name="info" />{scoreStatus.error}</p>}
          {sequence?.warnings.map((warning) => (
            <p key={warning} className="score-warning"><Icon name="info" size={17} />{warning}</p>
          ))}
          {complete && (
            <p className="completion" role="status"><Icon name="check" /> Exercise complete! All {noteCount} notes checked off.</p>
          )}
          <div className="score-controls">
            <button type="button" className="button button-outline" disabled={disabled || state.index === 0} onClick={() => setState((current) => movePractice(current, events, -1))}>
              <Icon name="previous" size={17} /> Previous
            </button>
            <button type="button" className="button button-outline" disabled={disabled} onClick={() => setState(startPractice)}>
              <Icon name="restart" size={17} /> Restart
            </button>
            <button type="button" className="button button-outline" disabled={disabled || complete} aria-pressed={state.paused} onClick={() => setState((current) => clearTiming(current, !current.paused))}>
              <Icon name={state.paused ? 'play' : 'pause'} size={17} /> {state.paused ? 'Resume' : 'Pause'}
            </button>
            <button type="button" className="button button-soft next-control" disabled={disabled || complete} onClick={() => setState((current) => movePractice(current, events, 1))}>
              Next <Icon name="next" size={17} />
            </button>
          </div>
        </section>

        <section className="microphone-card card" aria-labelledby="microphone-title">
          <div className="mic-header">
            <span className="icon-tile"><Icon name="mic" /></span>
            <h2 id="microphone-title">Microphone</h2>
            <span className={`mic-status ${microphone.phase}`} role="status"><i />{micLabel}</span>
          </div>
          {microphone.phase === 'off' ? (
            <button type="button" className="button button-primary mic-button" disabled={disabled} onClick={microphone.start}>
              <Icon name="mic" size={18} /> Start microphone
            </button>
          ) : (
            <button type="button" className="button button-soft mic-button" onClick={microphone.stop}>
              <Icon name="stop" size={18} /> {microphone.phase === 'starting' ? 'Cancel request' : 'Stop microphone'}
            </button>
          )}
          {microphone.error && <p className="mic-error" role="alert">{microphone.error}</p>}
          <p className="privacy-note">Your audio stays on this device.</p>
        </section>

        <section className="note-card card" aria-labelledby="note-heading">
          <div className="note-header"><span className="icon-tile mint"><Icon name="pulse" /></span><h2 id="note-heading">Note check</h2></div>
          <div className="note-readings">
            <div className="expected-reading">
              <span>Play this</span>
              <strong aria-live="polite">{complete ? <Icon name="check" size={29} /> : (expected?.label ?? '—')}</strong>
            </div>
            <div className="detected-reading">
              <span>Heard</span>
              <strong>{reading?.label || '—'}</strong>
            </div>
          </div>
          <p className="note-tip">{disabled ? 'Load a playable part to get started.' : tipFor(expected, microphone.phase, state)}</p>
          {reading && <p className="frequency">{state.observation.frequency.toFixed(1)} Hz · {Math.round(reading.cents)} ¢ from {reading.label}</p>}
        </section>
      </div>
      <DeveloperPanel events={events} expected={expected} state={state} settings={settings}
        onSettings={changeSettings} disabled={disabled} microphonePhase={microphone.phase}
        onSimulate={(frequency) => setState((current) => simulatePractice(current, events, frequency, settings))} />
    </>
  );
}
