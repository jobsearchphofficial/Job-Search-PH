// Paste your Firebase web app config here (Firebase console → Project settings → Your apps).
// While apiKey still starts with "YOUR_", the site runs in demo mode with sample data.
export const firebaseConfig = {
  apiKey: "AIzaSyAc8z7FwRCxDbXj1g2WFdf7A_5iitPJytg",
  authDomain: "job-search-ph-website.firebaseapp.com",
  projectId: "job-search-ph-website",
  storageBucket: "job-search-ph-website.firebasestorage.app",
  messagingSenderId: "541010223461",
  appId: "1:541010223461:web:137fa8725eef2465f8018c",
};

export const DEMO_MODE = firebaseConfig.apiKey.startsWith("YOUR_");

// How long an approved post stays live.
export const LISTING_DAYS = 30;
