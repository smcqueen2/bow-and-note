import { AUDIO_WINDOW, createObserver } from './observations.js';

const OBSERVATION_INTERVAL_MS = 35;

/** Start a local audio analyser. Aborting also disposes streams granted after cancellation. */
export async function openMicrophone({ signal, onObservation, onEnded }) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('Microphone access needs HTTPS or localhost in a supported browser.');
  }
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) throw new Error('This browser does not support Web Audio.');

  const context = new AudioContext();
  let source;
  let stream;
  let frameId;
  let closed = false;

  function dispose() {
    if (closed) return;
    closed = true;
    signal.removeEventListener('abort', dispose);
    cancelAnimationFrame(frameId);
    source?.disconnect();
    stream?.getTracks().forEach((track) => {
      track.removeEventListener('ended', onEnded);
      track.stop();
    });
    if (context.state !== 'closed') context.close().catch(() => {});
  }

  signal.addEventListener('abort', dispose, { once: true });
  try {
    if (signal.aborted) throw new DOMException('Microphone start cancelled.', 'AbortError');
    const ready = context.resume();
    const capture = navigator.mediaDevices.getUserMedia({
      video: false,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
    }).then((availableStream) => {
      if (closed) {
        availableStream.getTracks().forEach((track) => track.stop());
        throw new DOMException('Microphone start cancelled.', 'AbortError');
      }
      stream = availableStream;
    });
    await Promise.all([ready, capture]);
    if (closed) return;

    const analyser = context.createAnalyser();
    analyser.fftSize = AUDIO_WINDOW;
    source = context.createMediaStreamSource(stream);
    source.connect(analyser);
    stream.getAudioTracks().forEach((track) => track.addEventListener('ended', onEnded, { once: true }));

    const samples = new Float32Array(AUDIO_WINDOW);
    const observe = createObserver(context.sampleRate);
    let lastFrame = -Infinity;
    function read(now) {
      if (now - lastFrame >= OBSERVATION_INTERVAL_MS) {
        lastFrame = now;
        analyser.getFloatTimeDomainData(samples);
        onObservation(observe(samples, now));
      }
      if (!closed) frameId = requestAnimationFrame(read);
    }
    frameId = requestAnimationFrame(read);
  } catch (error) {
    dispose();
    throw error;
  }
}

/** Translate common permission and hardware failures into actionable messages. */
export function describeMicrophoneError(error) {
  const messages = {
    NotAllowedError: 'Microphone access was blocked. Allow it in the browser’s site settings, then try again.',
    NotFoundError: 'No microphone found. Connect or enable a microphone, then try again.',
    NotReadableError: 'The microphone is busy or unavailable. Close other audio apps and try again.',
    SecurityError: 'Microphone access is disabled for this browser or page.',
  };
  return messages[error.name] || error.message || 'Could not start the microphone.';
}
