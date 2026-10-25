// Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
// While apiKey still starts with "YOUR_", the site runs in demo mode with sample data.
export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

export const DEMO_MODE = firebaseConfig.apiKey.startsWith("YOUR_");

// How long an approved post stays live.
export const LISTING_DAYS = 30;
