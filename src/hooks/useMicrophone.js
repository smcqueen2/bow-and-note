import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { describeMicrophoneError, openMicrophone } from '../audio/microphone.js';

/** Own the current permission request and microphone, including cleanup on unmount. */
export default function useMicrophone(onObservation, resetTiming) {
  const active = useRef(null);
  const receive = useRef(onObservation);
  const [status, setStatus] = useState({ phase: 'off', error: '' });

  useLayoutEffect(() => { receive.current = onObservation; }, [onObservation]);

  const stop = useCallback(() => {
    active.current?.abort();
    active.current = null;
    resetTiming();
    setStatus({ phase: 'off', error: '' });
  }, [resetTiming]);

  const start = useCallback(async () => {
    if (active.current) return;
    const request = new AbortController();
    active.current = request;
    resetTiming();
    setStatus({ phase: 'starting', error: '' });

    try {
      await openMicrophone({
        signal: request.signal,
        onObservation: (observation) => receive.current(observation),
        onEnded: () => {
          if (active.current !== request) return;
          stop();
          setStatus({ phase: 'off', error: 'The microphone disconnected. Reconnect it and try again.' });
        },
      });
      if (active.current === request) setStatus({ phase: 'live', error: '' });
    } catch (error) {
      if (active.current !== request) return;
      active.current = null;
      setStatus({ phase: 'off', error: describeMicrophoneError(error) });
    }
  }, [resetTiming, stop]);

  useEffect(() => () => {
    active.current?.abort();
    active.current = null;
  }, []);

  return { ...status, start, stop };
}
