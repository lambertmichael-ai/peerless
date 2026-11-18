# Peerless Daily

The phone app for The Peerless Build: morning check-ins, one lesson, the retrieval block, sprint work, and the evening reflection, five weekday stations in order. Weekends are off.

Live: https://lambertmichael-ai.github.io/peerless/

## How it runs, all on free tiers

| Piece | Service | Where |
| --- | --- | --- |
| Hosting | GitHub Pages | `.github/workflows/deploy.yml` |
| Tests | Playwright, run before every deploy | `tests/` |
| The record | Firebase Firestore, Spark plan, one private space per Google account | `site/js/platform.js`, `firebase/firestore.rules` |
| Sign-in | Firebase Auth with Google | `site/js/platform.js` |
| Answer checks and lesson building | Gemini API free tier, key stored in your own record | `site/js/platform.js` |
| Drive briefs in, record out | Google Drive API with your sign-in token | `site/js/platform.js` |
| Install and offline | Web app manifest and service worker | `site/manifest.webmanifest`, `site/sw.js` |
| Morning push | GitHub Actions cron plus web-push | `.github/workflows/morning-push.yml`, `scripts/send-push.mjs` |

Without Firebase settings in `site/js/config.js` the app runs in local mode: everything works, and the record stays in that one browser.

## Layout

```
site/            what Pages serves
  index.html
  css/app.css
  js/config.js   public settings (Firebase web config, VAPID public key, Gemini model names)
  js/platform.js sign-in, Firestore, Gemini, Drive, install, push
  js/app.js      the app: stations, retrieval scheduling, week, forecasts, library
  js/content.js  sprints, lessons, items
  js/steps.js    interactive lesson steps
  js/figures.js  lesson figures
  sw.js          offline shell and push display
scripts/         local server, push sender
tests/           Playwright
firebase/        Firestore rules
docs/SETUP.md    one-time setup for Firebase, Gemini, and push
```

## Work on it

```
npm install
npx playwright install chromium
npm test          # 24 tests, phone and desktop
npm run serve     # http://localhost:4173
```

Pushing to `main` runs the tests and deploys only if they pass.
