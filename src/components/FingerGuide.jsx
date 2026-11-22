import { memo } from 'react';
import { VIOLIN_STRINGS } from '../music/violinFingering.js';
import Icon from './Icon.jsx';

const NUT = 17;
const TAPE_MARKS = [[0, '0'], [2, '1'], [4, '2'], [5, '3'], [7, '4']];

/** Estimate where a semitone falls along the playing length of a string. */
function positionFor(semitones) {
  if (semitones === 0) return '7%';
  const fraction = (1 - 2 ** (-semitones / 12)) / (1 - 2 ** (-7 / 12));
  return `${NUT + 75 * fraction}%`;
}

function Fingerboard({ cue, label }) {
  return (
    <div className="fingerboard" role="img" aria-label={`Violin fingerboard. ${label}`}>
      <div className="fingerboard-head" aria-hidden="true">
        {TAPE_MARKS.map(([position, finger]) => (
          <span key={finger} style={{ left: positionFor(position) }}>{finger}</span>
        ))}
      </div>
      <div className="fingerboard-lanes" aria-hidden="true">
        <div className="fingerboard-nut" style={{ left: `${NUT}%` }} />
        {TAPE_MARKS.slice(1).map(([position]) => (
          <span key={position} className="fingerboard-tape" style={{ left: positionFor(position) }} />
        ))}
        {VIOLIN_STRINGS.map(({ name }) => {
          const active = cue?.string === name;
          return (
            <div className="fingerboard-lane" data-violin-string={name} key={name}>
              <span className="fingerboard-letter">{name}</span>
              <span className="fingerboard-wire" />
              {active && <strong className="fingering-marker" style={{ left: positionFor(cue.semitones) }}>{cue.finger}</strong>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function describeCue(event, cue) {
  if (!event) return 'Restart to see your first note.';
  if (event.kind === 'rest') return 'Rest · let the sound fade';
  if (cue) return `${cue.string} string · ${cue.label}`;
  if (event.fingering?.finger !== undefined) return `Score finger ${event.fingering.finger} · no position shown`;
  return 'No first-position cue for this note.';
}

/** Show the current first-position reference and the next few score events. */
function FingerGuide({ events, cues, index }) {
  const current = events[index];
  const cue = cues[index];
  const upcoming = events.slice(index + 1, index + 4);
  const label = describeCue(current, cue);

  return (
    <section className="finger-guide card" id="finger-guide" aria-labelledby="finger-guide-title">
      <div className="finger-guide-header">
        <span className="icon-tile"><Icon name="strings" /></span>
        <h2 id="finger-guide-title">Finger guide</h2>
        <span className="guide-position">First position</span>
      </div>
      <div className="finger-guide-layout">
        <figure className="finger-guide-current">
          <figcaption>
            <strong>{label}</strong>
            {cue?.marked && <span>From the score</span>}
          </figcaption>
          <Fingerboard cue={cue} label={label} />
        </figure>
        <div className="guide-upcoming">
          <h3>Coming up</h3>
          {upcoming.length ? (
            <ol>
              {upcoming.map((event, offset) => {
                const nextCue = cues[index + offset + 1];
                let detail = 'See score';
                if (event.kind === 'rest') detail = 'Stay quiet';
                else if (nextCue) detail = `${nextCue.string} string · ${nextCue.label}`;
                return (
                  <li data-violin-string={nextCue?.string} key={event.visualIndex}>
                    <strong>{event.label}</strong>
                    <span>{detail}</span>
                  </li>
                );
              })}
            </ol>
          ) : <p className="guide-end">This is the end of the exercise.</p>}
          <p className="guide-help">0 means open string. Follow your teacher’s fingering if it differs.</p>
        </div>
      </div>
    </section>
  );
}

export default memo(FingerGuide);
