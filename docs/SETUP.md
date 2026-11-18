# One-time setup

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
3. APIs and Services, OAuth consent screen (Google Auth Platform). Audience: if it says Testing, add your Google address as a test user. Google will show an "unverified app" screen at sign-in. Choose Advanced, then continue. That is expected for a personal app.

Google tokens last one hour. When one runs out, Library, This app, Connect Google Drive renews it.

## 3. Gemini key (answer checks and lesson building)

1. Go to https://aistudio.google.com/apikey and create a key in the `peerless` Cloud project. Do not attach billing, so it stays on the free tier.
2. In the app: Library, This app, paste the key, Save key, reload.

The key is stored in your private Firestore record, never in this repo. Free-tier prompts may be used by Google to improve its products, so the app sends Gemini only case items, your answers, and the Drive files you ask it to build from. Reflections never go to Gemini.

## 4. Morning push

1. Firebase console, Project settings, Service accounts, Generate new private key. A JSON file downloads.
2. GitHub repo, Settings, Secrets and variables, Actions, New repository secret, four times:
   - `FIREBASE_SERVICE_ACCOUNT`: the whole JSON file's contents
   - `VAPID_PUBLIC_KEY`: the `vapidPublicKey` value in `site/js/config.js`
   - `VAPID_PRIVATE_KEY`: the private key that pairs with it
   - `VAPID_SUBJECT`: `mailto:` plus your email
3. Delete the downloaded JSON file.
4. On the iPhone: open the app in Safari, Share, Add to Home Screen. Open it from the Home Screen, sign in, Library, This app, Turn on morning push, Allow.
5. Test: GitHub, Actions, Morning push, Run workflow, check "Send now", Run.

The job runs weekdays at 12:11 and 13:11 UTC and sends once, between 8 and 10 am Eastern, with the count of cases due. GitHub often starts cron jobs 5 to 20 minutes late.

To make new VAPID keys: `npx web-push generate-vapid-keys`, then update the public key in `config.js` and both secrets, and turn push off and on again on each device.

## 5. Point the program at the new address

The weekday morning task and the weekly session still link to the old Claude artifact. Update them to https://lambertmichael-ai.github.io/peerless/
