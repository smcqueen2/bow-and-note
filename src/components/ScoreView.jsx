import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Collect SVG note groups in printed order, independent of OSMD's playback repeat order. */
function getWrittenNotes(display, events) {
  const writtenNotes = display.GraphicSheet.MeasureList.flatMap((measures, measureIndex) => (
    measures.flatMap((measure) => measure.staffEntries.flatMap((entry) => (
      entry.graphicalVoiceEntries.flatMap((voice) => voice.notes.map((note) => ({
        measureIndex,
        rest: note.sourceNote.isRest(),
        element: note.getSVGGElement(),
      })))
    )))
  ));
  const writtenCount = events.reduce((count, event) => count + event.visualCount, 0);
  const mismatched = events.some((event) => {
    const notes = writtenNotes.slice(event.visualIndex, event.visualIndex + event.visualCount);
    return notes.some((note, segment) => !note.element || note.rest !== (event.kind === 'rest')
      || (segment === 0 && note.measureIndex !== event.measureIndex));
  });
  if (writtenCount !== writtenNotes.length || mismatched) {
    throw new Error('The notation rendered, but its note positions could not be matched to the practice sequence.');
  }
  return writtenNotes.map(({ element }) => element);
}

/** Keep the focus comfortable inside the score viewport without moving the whole page. */
function revealNote(viewport, noteRect) {
  const frame = viewport.getBoundingClientRect();
  const center = noteRect.left + noteRect.width / 2 - frame.left;
  const inset = Math.min(viewport.clientWidth * 0.18, 100);
  if (center < inset || center > viewport.clientWidth - inset) {
    viewport.scrollLeft += center - viewport.clientWidth / 2;
  }
  if (noteRect.top < frame.top + 12 || noteRect.bottom > frame.bottom - 12) {
    viewport.scrollTop += (noteRect.top + noteRect.bottom) / 2 - frame.top - viewport.clientHeight / 2;
  }
}

/** Render MusicXML with OSMD and overlay the active event from the practice engine. */
export default function ScoreView({ document, events, index, onStatus }) {
  const viewportRef = useRef(null);
  const canvasRef = useRef(null);
  const notationRef = useRef(null);
  const [notes, setNotes] = useState(null);
  const [highlight, setHighlight] = useState(null);

  useEffect(() => {
    const viewport = viewportRef.current;
    const notation = notationRef.current;
    let display;
    let resize;
    let cancelled = false;
    let renderedWidth;
    let renderRequest;

    function draw() {
      const width = viewport.clientWidth;
      if (cancelled || width <= 0 || width === renderedWidth) return;
      renderedWidth = width;
      try {
        display.render();
        if (events) setNotes(getWrittenNotes(display, events));
        onStatus({ phase: 'ready', error: '' });
      } catch (error) {
        setNotes(null);
        onStatus({ phase: 'error', error: error.message || 'This score could not be rendered.' });
      }
    }

    async function load() {
      try {
        const module = await import('opensheetmusicdisplay');
        if (cancelled) return;
        display = new module.OpenSheetMusicDisplay(notation, {
          autoResize: false,
          backend: 'svg',
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawPartNames: false,
          drawFingerings: true,
          autoGenerateMultipleRestMeasuresFromRestMeasures: false,
          renderSingleHorizontalStaffline: true,
          newSystemFromXML: false,
          newSystemFromNewPageInXML: false,
          newPageFromXML: false,
          disableCursor: true,
        });
        display.EngravingRules.RepetitionAllowFirstMeasureBeginningRepeatBarline = true;
        display.EngravingRules.PageTopMargin = 3;
        display.EngravingRules.PageBottomMargin = 3;
        display.EngravingRules.PageLeftMargin = 2;
        display.zoom = 1.19;
        await display.load(document);
        if (cancelled) return;
        draw();
        resize = new ResizeObserver(() => {
          cancelAnimationFrame(renderRequest);
          renderRequest = requestAnimationFrame(draw);
        });
        resize.observe(viewport);
      } catch (error) {
        if (!cancelled) {
          onStatus({ phase: 'error', error: `The score could not be opened. ${error.message || ''}`.trim() });
        }
      }
    }

    load();
    return () => {
      cancelled = true;
      resize?.disconnect();
      cancelAnimationFrame(renderRequest);
      display?.clear();
    };
  }, [document, events, onStatus]);

  useLayoutEffect(() => {
    if (!notes) return;
    const current = events[index];
    const completedUntil = current?.visualIndex ?? notes.length;
    notes.forEach((note, position) => {
      note.classList.toggle('played-note', position < completedUntil);
      note.classList.toggle('current-note', position === current?.visualIndex);
    });
    const element = current && notes[current.visualIndex];
    if (!element) {
      setHighlight(null);
      return;
    }
    const viewport = viewportRef.current;
    const canvas = canvasRef.current.getBoundingClientRect();
    const head = element.querySelector('.vf-notehead') || element;
    const note = head.getBoundingClientRect();
    setHighlight({
      left: note.left + note.width / 2 - canvas.left,
      top: note.top + note.height / 2 - canvas.top,
    });
    revealNote(viewport, note);
  }, [events, index, notes]);

  return (
    <div className="score-viewport" ref={viewportRef} tabIndex={0} aria-label="Scrollable sheet music">
      <div className="score-canvas" ref={canvasRef}>
        {highlight && notes && <span className="score-highlight" style={highlight} aria-hidden="true" />}
        <div className="notation" ref={notationRef} />
      </div>
    </div>
  );
}
