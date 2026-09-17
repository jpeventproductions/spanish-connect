# Spanish Connect

A colorful, phone-friendly English–Spanish phrase matching game with 300 original practice phrases.

## Play

Open `index.html` in a browser, or use the GitHub Pages site. No build or account is required.

- Six pairs stay on screen. Correct pairs are replaced with fresh phrases.
- Match at least six pairs without mistakes to shorten the next round by five seconds, down to 20 seconds.
- Wrong and unfinished phrases return in the retry bucket. Three consecutive mistakes reveal a brief hint.
- Tap phrases for device pronunciation. Voice availability varies by browser and device.
- Choose local background music in Settings. Music uses a local browser file URL, is never uploaded, and must be selected again after reopening the page.
- Progress and match times are saved in this browser. Export/import a JSON backup in Progress to move devices.
- Portrait uses two columns; landscape uses three bilingual groups across two rows.

The examples cover connecting words, word endings, present, past, future, and courteous everyday phrases. These are teaching examples, not a frequency-ranked corpus. English “-tion” often corresponds to Spanish “-ción,” with exceptions.

## Development

Run a local static server in this directory. Rebuild the phrase bundle with `node scripts/build-data.cjs` after editing `data/*.json`.

Checks:

```sh
node tests/engine.test.cjs
node tests/continuous.test.cjs
```

Publish with GitHub Pages from the `main` branch and repository root. The `.nojekyll` file keeps the static assets unchanged.
