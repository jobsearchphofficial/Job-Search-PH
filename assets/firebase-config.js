// Firebase web app config (Firebase console → Project settings → Your apps).
// The same code runs on the live site and the test site (staging.jobsearchph.com).
// The test site uses its own Firebase project so tests never touch real users or jobs.
export const IS_STAGING = /^staging\./.test(location.hostname) || /\.github\.io$/.test(location.hostname);

// Test site project. Paste its config here after creating it; until then the test site won't start
// (it never falls back to the real database).
const STAGING_CONFIG = null;

const LIVE_CONFIG = {
  apiKey: "AIzaSyAc8z7FwRCxDbXj1g2WFdf7A_5iitPJytg",
  authDomain: "jobsearchph.com", // sign-in helper self-hosted in /__/auth (was job-search-ph-website.firebaseapp.com)
  projectId: "job-search-ph-website",
  storageBucket: "job-search-ph-website.firebasestorage.app",
  messagingSenderId: "541010223461",
  appId: "1:541010223461:web:137fa8725eef2465f8018c",
};

export const firebaseConfig = IS_STAGING ? STAGING_CONFIG : LIVE_CONFIG;

// How long an approved post stays live.
export const LISTING_DAYS = 30;

// Resume file uploads need Firebase Storage, which requires the Blaze plan.
// Turn this on after creating the Storage bucket and publishing storage.rules.
export const RESUME_UPLOADS = false;
