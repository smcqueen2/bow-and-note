import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './components/Icon.jsx';
import PracticeRoom from './components/PracticeRoom.jsx';
import { readScore } from './music/musicXml.js';
import { DEFAULT_SAMPLE, SAMPLES } from './music/samples.js';
import { DEFAULT_SETTINGS } from './practice/waitForNote.js';

const BASE = import.meta.env.BASE_URL;

/** Load bundled or local MusicXML, then open the selected exercise in the practice room. */
export default function App() {
  const fileInput = useRef(null);
  const latestRequest = useRef(0);
  const [exercise, setExercise] = useState(null);
  const [partId, setPartId] = useState(null);
  const [loadStatus, setLoadStatus] = useState({ busy: true, error: '' });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  const open = useCallback(async (read, title, sampleId = null) => {
    latestRequest.current += 1;
    const request = latestRequest.current;
    setLoadStatus({ busy: true, error: '' });
    try {
      const score = readScore(await read(), title);
      if (request !== latestRequest.current) return;
      setPartId(score.parts.find(({ name }) => /violin|^vln\.?$/i.test(name))?.id ?? score.parts[0].id);
      setExercise({ ...score, request, sampleId });
      setLoadStatus({ busy: false, error: '' });
    } catch (error) {
      if (request === latestRequest.current) setLoadStatus({ busy: false, error: error.message });
    }
  }, []);

  const openSample = useCallback(({ id, label }) => {
    open(async () => {
      const response = await fetch(`${BASE}samples/${id}`);
      if (!response.ok) throw new Error('The sample could not be loaded. Please try again.');
      return response.text();
    }, label, id);
  }, [open]);

  useEffect(() => {
    openSample(DEFAULT_SAMPLE);
    return () => { latestRequest.current += 1; };
  }, [openSample]);

  function selectSample(event) {
    const sample = SAMPLES.find(({ id }) => id === event.target.value);
    if (sample) openSample(sample);
  }

  function handleFile(event) {
    const file = event.target.files[0];
    event.target.value = '';
    if (!file) return;
    open(() => {
      if (!/\.(musicxml|xml)$/i.test(file.name)) throw new Error('Choose a .musicxml or .xml file.');
      if (file.size > 2 * 1024 * 1024) throw new Error('Choose a MusicXML file smaller than 2 MB.');
      return file.text();
    }, file.name.replace(/\.(musicxml|xml)$/i, ''));
  }

  return (
    <>
      <header className="site-header">
        <div className="header-content">
          <div className="brand"><span className="brand-icon"><Icon name="note" size={22} /></span> Bow <span>&amp;</span> Note</div>
          <button className="button button-outline import-button" type="button" onClick={() => fileInput.current?.click()}>
            <Icon name="upload" size={18} /> Import MusicXML
          </button>
          <input type="file" ref={fileInput} accept=".musicxml,.xml" onChange={handleFile} hidden />
        </div>
      </header>
      <main className="page">
        <section className="hero" aria-labelledby="page-title">
          <div>
            <h1 id="page-title">Violin practice</h1>
            <p>Play the highlighted note and the music will follow.</p>
          </div>
          <img src={`${BASE}violin.png`} alt="" className="hero-art" />
        </section>
        <label className="sample-picker" htmlFor="school-exercise">
          <span>School exercises</span>
          <span className="sample-select">
            <Icon name="note" size={17} />
            <select id="school-exercise" value={exercise?.sampleId ?? ''} onChange={selectSample}>
              <option value="" disabled>Choose an exercise</option>
              {SAMPLES.map(({ id, label }) => <option value={id} key={id}>{label}</option>)}
            </select>
            <Icon name="down" size={17} />
          </span>
        </label>
        {loadStatus.error && <p className="inline-message load-error" role="alert"><Icon name="info" />{loadStatus.error}</p>}
        {loadStatus.busy && <p className="inline-message load-error" role="status">Opening exercise…</p>}
        {exercise && (
          <PracticeRoom key={`${exercise.request}:${partId}`} exercise={exercise} partId={partId} onPart={setPartId}
            settings={settings} onSettings={setSettings} />
        )}
      </main>
    </>
  );
}
