/* Public settings for Peerless Daily. Everything here ships to the browser, so nothing secret goes in it.
   The Firebase web config is an identifier, not a password. The database is locked by firestore.rules.
   The Gemini key is not here. You paste it into the app once, and it is stored in your own Firestore record.
   Leave firebase as null to run in local mode: the record stays in this browser only. */
window.PEERLESS_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCYI-ZuUIqkP9cUfzL2GQKXe4qWfk0kIdI",
    authDomain: "peerless-e432e.firebaseapp.com",
    projectId: "peerless-e432e",
    appId: "1:1046017354160:web:ae5c4f70e7b9a929638e75"
  },
  firebaseSdk: "10.14.1",
  vapidPublicKey: "BFjTCXz4d5FPtETGm1aZTWucWpUMY8MxwHT6aW8ml8YuBgY8FbI2A3giDk3CjRdXYFOG6bLrRTICgvCTkqXndBY",
  gemini: { model: "gemini-flash-latest", quickModel: "gemini-flash-lite-latest", fallbackModel: "gemini-2.5-flash" }
};
