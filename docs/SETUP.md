# One-time setup

Status, Nov 19, 2026: steps 1 and 2 are done (project `peerless-e432e`, Spark plan, Google sign-in, authorized domain, Firestore in nam5 with rules, Drive API on, consent screen in production for external users). Steps 3 and 4 need you, because they involve keys and secrets: one Gemini key in the app, one GitHub secret.

Pages works on its own in local mode. These steps turn on sync, Drive, answer checks, and morning push. All free. About 25 minutes.

## 1. Firebase project (the record)

1. Go to https://console.firebase.google.com and add a project named `peerless`. Turn Google Analytics off. Stay on the Spark plan. Never add billing.
2. Project overview, add app, Web. Name it `Peerless Daily`. Skip Hosting. Copy the `firebaseConfig` values (apiKey, authDomain, projectId, appId) into `site/js/config.js` in place of `firebase: null`. These values are public identifiers, not secrets.
3. Build, Authentication, Get started, Sign-in method, Google, Enable. Then Settings, Authorized domains, Add domain: `lambertmichael-ai.github.io`.
4. Build, Firestore Database, Create database, production mode, location `nam5` or `us-east1`. Then the Rules tab: paste `firebase/firestore.rules` and Publish.

## 2. Google Drive access

The app reads sprint briefs and source files from Drive and writes the daily export there, so it asks for full Drive access at sign-in.

1. Open https://console.cloud.google.com, pick the `peerless` project.
2. APIs and Services, Library, Google Drive API, Enable.
3. Google Auth Platform, Audience: In production, External. No test users needed. Google will show an "unverified app" screen at sign-in. Choose Advanced, then continue. That is expected for a personal app, and the cap is 100 users.

Google tokens last one hour. When one runs out, Library, This app, Connect Google Drive renews it.

## 3. Gemini key (answer checks and lesson building)

1. Go to https://aistudio.google.com/apikey and create a key in the `peerless` Cloud project. Do not attach billing, so it stays on the free tier.
2. In the app: Library, This app, paste the key, Save key, reload.

The key is stored in your private Firestore record, never in this repo. Free-tier prompts may be used by Google to improve its products, so the app sends Gemini only case items, your answers, and the Drive files you ask it to build from. Reflections never go to Gemini.

## 4. Morning push

1. Firebase console, Project settings, Service accounts, Generate new private key. A JSON file downloads.
2. GitHub repo, Settings, Secrets and variables, Actions, New repository secret. Name: `FIREBASE_SERVICE_ACCOUNT`. Value: the whole JSON file. This is the only secret.
3. Delete the downloaded JSON file.
4. GitHub, Actions, Morning push, Run workflow, check "Send now", Run. The first run makes the push keys and stores them in Firestore (`config/vapid`, closed to every browser, and `public/vapid`, the public half the app reads).
5. On the iPhone: open the app in Safari, Share, Add to Home Screen. Open it from the Home Screen, sign in, Library, This app, Turn on morning push, Allow.
6. Run the workflow with "Send now" once more to test.

The job runs weekdays at 12:11 and 13:11 UTC and sends once, between 8 and 10 am Eastern, with the count of cases due. GitHub often starts cron jobs 5 to 20 minutes late.

To replace the push keys: delete `config/vapid` and `public/vapid` in the Firestore console, run the workflow, then turn push off and on again on each device.

## 5. Point the program at the new address

The weekday morning task and the weekly session still link to the old Claude artifact. Update them to https://lambertmichael-ai.github.io/peerless/
