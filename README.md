# Bow & Note

Bow & Note is a browser-based violin practice proof of concept. Open a MusicXML exercise, play the highlighted note, and let the score advance at your pace. Imported files and audio are processed on the device. The app loads its site assets and bundled exercises from the same static host.

## Run locally

Use Node.js 22.12+ on the 22.x line, or Node.js 24+. From this directory, run:

```sh
npm ci
npm run dev
```

Open [http://localhost:5173/](http://localhost:5173/) or the URL printed by Vite. If PowerShell blocks the npm script launcher, use `npm.cmd` in place of `npm`.

Microphone access works on localhost and HTTPS. For an Android phone or tablet, use an HTTPS deployment. An HTTP URL pointing to a laptop’s LAN address can show the score and run the simulator, but browsers generally require a secure context for microphone capture. [MDN getUserMedia reference](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia)

## Try the school exercises without a violin

1. Open the app. **Under arrest!** opens automatically. Use **School exercises** to pick any of the eight worksheets. For a duet, use **Part** to switch between melody and accompaniment. You can also choose **Import MusicXML** to open a file from your device.
2. Leave the microphone off and open **Developer tools**. Press a different note to verify that the score stays put. Press the highlighted note once. A second press of the same button simulates a separate bow stroke.
3. When **Play this** shows **Rest**, press **Quiet**. Continue until the completion message appears. Test **Pause**, **Resume**, **Previous**, **Next** and **Restart** along the way.

| Exercise | Melody or solo | Accompaniment |
| --- | --- | --- |
| Bow down, O Belinda | 24 notes | 16 notes |
| Under arrest! | 27 notes, 5 rests | — |
| Jim along Josie | 20 notes | 16 notes |
| Down up | 31 notes, 1 rest | — |
| Two in a boat | 36 notes | 16 notes |
| London Bridge | 24 notes | 24 notes |
| Fast lane | 37 notes, 6 rests | — |
| In flight | 14 notes, 2 rests | — |

The score scrolls horizontally and keeps the highlighted note in view as you advance. Completed symbols fade. Progress counts pitched events, with each tie chain counted once. A final rest still needs to be completed after the note count reaches its total. **Next** and **Previous** move through one event, including rests. **Next** can also be used to skip a difficult note.

## Test with a real violin

1. Pick **Under arrest!**, open **Developer tools**, and press **Start microphone**. Allow access when the browser prompts. Check that the app says **Listening** and shows live signal level and clarity.
2. Play the open strings individually with a steady bow. **Heard** should report G3 (196.00 Hz), D4 (293.66 Hz), A4 (440 Hz), and E5 (659.25 Hz), with some variation from tuning. Hold D4 first while the highlight still expects G3. The score should stay at the first note.
3. Hold G3 steadily for roughly half a second. The score should advance once. Keep holding it to confirm the next G3 stays highlighted. Lift the bow for about a quarter to half a second, then play G3 again to advance.
4. Play through to a rest. Let the sound die away for a moment. If the room keeps the level above the quiet threshold, tap **Next**. Try finishing **Under arrest!** or **Down up**, including the final rest.
5. While listening, use **Pause** and play the expected note. The score should stay still while diagnostics continue. Resume, then press **Stop microphone** and confirm the browser releases its microphone indicator. Start again and switch exercise to check that the microphone is released on leaving the previous exercise.
6. If testing on Android, check the landscape and portrait layouts and confirm the highlight remains inside the score as it moves.

## Detection settings

Open **Developer tools** to adjust the thresholds during a session. **Reset settings** restores the defaults.

| Gate | Default | What to adjust |
| --- | --- | --- |
| Pitch tolerance | ±45 cents from the expected note, at A4 = 440 Hz | Increase slightly for beginner intonation. Decrease if you want a stricter match. |
| Minimum hold | 200 ms of continuous matching frames | Increase if short bursts register. Decrease if a deliberately steady note seldom registers. |
| Minimum signal level | −45 dBFS RMS | Set closer to zero in a noisy room. Use a more negative value if the violin is quiet at the microphone. |
| Minimum Pitchy clarity | 86% | Increase if noise registers as pitch. Decrease a little if clean bowed notes repeatedly fall just below the cutoff. |

The Web Audio analyser reads a 4,096-sample window about every 35–50 ms. Practice accepts 175–1,750 Hz and restarts the hold if the pitch moves more than 35 cents from the start of its stable window or there is a gap over 150 ms between frames. Consecutive notes of the same pitch rearm after at least 120 ms below the level floor. A rest advances after 300 ms below that floor. These timings apply to analyser frames, so account for the analyser window and let the string ring down.

Diagnostics show the raw frequency, the nearest note and its deviation, the expected note and its deviation, signal level, clarity, and the current frame’s pitch gates. The progression decision also reflects hold time, repeated-note release, rests and pause. If **Heard** reports the note an octave away, try moving the device nearer and bowing more steadily before changing thresholds.

## Checks

```sh
npm run lint
npm test
npm run build
npm run preview
```

The tests cover pitch and cents conversion, Pitchy with synthetic tones, event extraction and simulated completion of all 12 school exercise parts, accidentals, ties, support errors, repeated notes, timing, noise, rests and navigation. Production output is in `dist/`. Vite reports a large-chunk advisory for the dynamically loaded OSMD renderer (about 381 kB gzip).

**Under arrest!** and **Down up** completed in a microphone trial on a Pixel 9a. That trial verified all four open-string pitches, wrong-note rejection, repeated-note rearming and silence-based rests. The other school exercises have been checked with the simulator.

## MusicXML coverage and limitations

- Import accepts uncompressed partwise MusicXML (`.musicxml` or `.xml`) up to 2 MB. Choose the individual part in multi-part scores. Practice supports a single pitched melody with written rests on one staff.
- Score engraving uses OSMD. Note values, clefs, key and time signatures, rests, barlines and supported bowing markings come from the imported XML. Use a standard MusicXML export with the sounding `<alter>` on affected pitches, including pitches altered by the key signature. [MusicXML pitch specification](https://www.w3.org/2021/06/musicxml40/tutorial/midi-compatible-part/)
- Practice takes one pass in printed order, including when the score has repeat barlines or alternate endings. Markings for repeats and jumps remain visible where OSMD supports them. Chords, overlapping voices, transposing parts, grace notes and other unsupported notation show a message. Ornaments are practised at the written pitch.
- Wait-for-note checks pitch and sequence. Written rhythms and tie durations remain visible. Rests use a fixed silence window, and the app gives no rhythm grade.
- Continuous bow changes without a quiet break may need **Next**. Room noise, device audio processing, harmonics and widely varying intonation can interfere with pitch or silence detection. Pitchy’s clarity measures periodicity, so a steady pitched sound from elsewhere can also qualify.
- The school exercises in [public/samples](public/samples) retain their transcription-draft metadata. Compare them against the paper worksheets to confirm pitches, rhythms and bowing. **Fast lane** includes alternate endings and follows them in printed order.

If the violin trial goes well, the next improvements are an onset detector for legato bow changes, a room-noise calibration step, and a small collection of real violin test cases evaluated on the devices used for lessons. Repeat expansion and an optional tempo mode can come after the wait-for-note interaction is reliable.

## Deploy to GitHub Pages

1. Review the bundled files before putting them in a public repository. Include only sample scores you have permission to share. Local imports are available for private exercises.
2. Add the project source and lockfile to a GitHub repository, keeping the [Pages workflow](.github/workflows/pages.yml) on the default branch.
3. Set **Settings → Pages → Build and deployment → Source** to **GitHub Actions**. [GitHub Pages documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
4. Open **Actions → Deploy to GitHub Pages → Run workflow**. It installs dependencies, runs lint and tests, builds `dist/` and publishes the artifact. Open the resulting HTTPS site from the deployment summary.

Vite builds with a relative base, so the same files work at the domain root or a repository subpath. [Vite production build guide](https://vite.dev/guide/build.html#relative-base)

## Code map

- `src/audio/` handles capture and emits score-independent pitch observations.
- `src/music/` validates MusicXML, isolates the chosen part and extracts written events.
- `src/practice/` implements the wait-for-note state machine used by the microphone and simulator.
- `src/components/ScoreView.jsx` renders notation and maps practice events to OSMD’s printed SVG notes.
