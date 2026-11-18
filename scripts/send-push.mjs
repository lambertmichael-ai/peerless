// Morning push for Peerless Daily. Run by .github/workflows/morning-push.yml.
// Reads every push subscription from Firestore, and on a weekday between 8 and 10 am in the
// subscriber's time zone sends one notification per user per day, with the number of cases due.
// Env: FIREBASE_SERVICE_ACCOUNT (JSON), VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, APP_URL.
// Flag: --force sends now, ignoring the clock and the once-a-day guard (for testing).
import admin from "firebase-admin";
import webpush from "web-push";

const force = process.argv.includes("--force");
const need = k => { const v = process.env[k]; if (!v) { console.error("Missing secret " + k); process.exit(1); } return v; };
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(need("FIREBASE_SERVICE_ACCOUNT"))) });
webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:peerless@example.com", need("VAPID_PUBLIC_KEY"), need("VAPID_PRIVATE_KEY"));
const db = admin.firestore();
const appUrl = process.env.APP_URL || "./";

function local(tz) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hour12: false, weekday: "short" })
    .formatToParts(new Date()).reduce((o, p) => (o[p.type] = p.value, o), {});
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hour: Number(parts.hour) % 24, weekday: parts.weekday };
}

const subs = await db.collectionGroup("push").get();
const byUser = new Map();
for (const d of subs.docs) {
  const user = d.ref.parent.parent;
  if (!user || user.parent.id !== "users") continue;
  if (!byUser.has(user.id)) byUser.set(user.id, []);
  byUser.get(user.id).push(d);
}
let sent = 0;
for (const [uid, docs] of byUser) {
  const tz = docs[0].get("tz") || "America/New_York";
  const now = local(tz);
  if (!force && (now.weekday === "Sat" || now.weekday === "Sun" || now.hour < 8 || now.hour >= 10)) { console.log(uid.slice(0, 6), "outside the window", now); continue; }
  const guard = db.doc(`users/${uid}/private/push`);
  const g = await guard.get();
  if (!force && g.exists && g.get("lastSent") === now.date) { console.log(uid.slice(0, 6), "already sent today"); continue; }
  const items = (await db.doc(`users/${uid}/state/items`).get()).get("m") || {};
  const due = Object.values(items).filter(s => s && s.d && s.d <= now.date).length;
  const body = due ? `Morning check-ins, one lesson, and ${due} case${due === 1 ? "" : "s"} due.` : "Morning check-ins and one lesson. No cases due.";
  const payload = JSON.stringify({ title: "Peerless Daily", body, url: appUrl + "#today" });
  for (const d of docs) {
    try { await webpush.sendNotification({ endpoint: d.get("endpoint"), keys: d.get("keys") }, payload, { TTL: 4 * 3600 }); sent++; }
    catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) { await d.ref.delete(); console.log("removed an expired subscription"); }
      else console.error("push failed", e.statusCode, e.body);
    }
  }
  await guard.set({ lastSent: now.date, at: new Date().toISOString() }, { merge: true });
}
console.log(`sent ${sent} notification(s) to ${byUser.size} user(s)`);
