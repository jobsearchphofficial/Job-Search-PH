// Firebase web app config (Firebase console → Project settings → Your apps).
export const firebaseConfig = {
  apiKey: "AIzaSyAc8z7FwRCxDbXj1g2WFdf7A_5iitPJytg",
  authDomain: "jobsearchph.com", // sign-in helper self-hosted in /__/auth (was job-search-ph-website.firebaseapp.com)
  projectId: "job-search-ph-website",
  storageBucket: "job-search-ph-website.firebasestorage.app",
  messagingSenderId: "541010223461",
  appId: "1:541010223461:web:137fa8725eef2465f8018c",
};

// How long an approved post stays live.
export const LISTING_DAYS = 30;

// Resume file uploads need Firebase Storage, which requires the Blaze plan.
// Turn this on after creating the Storage bucket and publishing storage.rules.
export const RESUME_UPLOADS = false;
