# Job Search PH — Job Board

A free job listing board for household, service and local jobs in Negros Occidental and Western Visayas.

- **Jobseekers** browse, filter and contact employers directly (Messenger, phone or email). No account and no fees.
- **Employers** sign in with Google and post jobs. Every post is reviewed before going live and expires after 30 days.
- **Admins** approve, reject, feature, renew, close or delete posts and handle reports.

Job Search PH only publishes listings. It does not recruit, screen, match or place workers.

Plain HTML/CSS/JS, hosted on GitHub Pages, with Firebase (Auth + Firestore). No build step.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Until Firebase is configured, the site runs in **demo mode** with sample jobs stored in your browser. In demo mode, "Employer sign in" logs you in as a demo admin, so you can try posting and approving.

## Go live (about 15 minutes)

1. **Create a Firebase project** at https://console.firebase.google.com (the free Spark plan is enough).
2. **Add a web app** (Project settings → Your apps → `</>`). Copy the config into `assets/firebase-config.js`.
3. **Turn on Google sign-in:** Authentication → Sign-in method → Google → Enable.
4. **Authorize your domains:** Authentication → Settings → Authorized domains. Add `<your-username>.github.io` and your custom domain if you have one.
5. **Create Firestore:** Firestore Database → Create database → production mode, region `asia-southeast1`.
6. **Paste the security rules:** Firestore → Rules. Paste everything from `firestore.rules`, then Publish.
7. **Make yourself admin:**
   - Sign in on the site once.
   - Copy your User UID from Authentication → Users.
   - In Firestore, create a collection `admins` with a document whose ID is that UID. Add any field, e.g. `name: "Mark"`.
   - Refresh the site. The **Admin** tab appears.
8. **Publish on GitHub Pages:** repo Settings → Pages → Deploy from branch → `main` / root.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `assets/app.js` | Pages, filters, forms, admin tools |
| `assets/store.js` | Data layer: Firebase, or demo data |
| `assets/firebase-config.js` | Your Firebase keys, plus how long listings last |
| `assets/styles.css` | Styles (light and dark) |
| `firestore.rules` | Database security rules |

## Before public launch

- Have a lawyer review the Terms and Privacy pages (`#/terms`, `#/privacy`). Both are drafts.
- Register a DTI business name, then BIR and a mayor's permit.
- Keep the model a pure listing board: no per-hire fees, no screening or matching.

## Ideas for later

- Paid featured posts (the `featured` flag already exists) or employer subscriptions
- Facebook sign-in
- Auto-posting new listings to the JSPH Facebook page
- Tagalog/Hiligaynon language toggle
