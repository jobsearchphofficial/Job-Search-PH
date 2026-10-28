# Job Search PH — Job Board

A free job listing board for household, service and local jobs in Negros Occidental. Live at https://jobsearchph.com (Beta v1).

- **Jobseekers** create a free profile, apply to jobs on the site, and message employers in the built-in chat. The employer's own contact is shared only after they accept a job offer. No fees, ever.
- **Employers** post jobs for free (5 posts per calendar month). Every post is reviewed before going live and expires after 30 days. Employers review applicants, send job offers, and chat with applicants.
- **Admins** see analytics, review posts, handle reports and support, and can ban users.

Job Search PH only publishes listings. It does not recruit, screen, match or place workers.

Plain HTML/CSS/JS on GitHub Pages, with Firebase Auth (Google, Facebook and email/password) and Firestore on the free plan. No build step for the app.

## Run it locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

This talks to the live Firebase project. For testing without touching real data, run the Firebase emulators (Firestore on port 8085, Auth on 9099) and open `http://localhost:8000/?emu`.

## Important: publish the rules after every change

All security (who can read what, daily and monthly limits, bans, chat closing) lives in `firestore.rules`. After any change to that file, paste it into Firebase console → Firestore Database → Rules → **Publish**. The site breaks in confusing ways if the published rules are older than the code.

## Limits (anti-spam)

| What | Limit |
|---|---|
| Applications | 10 per day |
| Job posts | 5 per calendar month (Philippine time) |
| Chat messages | 200 per day |
| Reports | 5 per day |
| Support messages | 3 per day (signed in) |

Set in `assets/store.js` (`LIMITS`) and enforced in `firestore.rules`. Change both together.

## Tracked links

Add `?src=<name>` to any link, e.g. `https://jobsearchph.com/?src=fb-bacolod-group`. The name is saved on the person's profile when they sign up, and **Admin → Analytics → Where users come from** shows sign-ups, posts and applications per source. Admin → Analytics also has a link maker.

## Public job pages (Google for Jobs)

`scripts/build-job-pages.mjs` builds `/jobs/<id>/` pages and `sitemap.xml` from live jobs. The GitHub Action `.github/workflows/job-pages.yml` runs it every 2 hours. Private households appear as "Private household in <city>" on these pages; only businesses show their name and street address.

## Files

| File | What it does |
|---|---|
| `index.html` | Page shell |
| `assets/app.js` | Pages, forms, chat, admin tools and analytics |
| `assets/store.js` | Firebase data layer and limits |
| `assets/firebase-config.js` | Firebase keys, listing length |
| `assets/styles.css` | Styles (light and dark) |
| `firestore.rules` | Database security rules |
| `scripts/build-job-pages.mjs` | Static job pages for search engines |

## Facebook login

Needs a Meta app (developers.facebook.com → My Apps → Create app → "Authenticate and request data from users with Facebook Login"). In Firebase → Authentication → Sign-in method → Facebook, paste the Meta **App ID** and **App secret**, then copy the **OAuth redirect URI** Firebase shows into Meta → Facebook Login → Settings → Valid OAuth Redirect URIs. Do this for both Firebase projects (live and test). Meta also needs the Privacy Policy URL and a data-deletion URL before the app can go Live; until then only people listed as app testers can use it.

Inside the Facebook/Messenger app, "Continue with Facebook" uses a full-page redirect instead of a popup. People who already have an account with the same email sign in their usual way first, then connect Facebook in My profile.

## Checking employers

Every pending post in **Admin → Pending** shows an *Employer check*: account age, sign-in method, phone, Facebook link, permit/DTI number, past posts, and warning signs (brand-new account, scam words like "fee" or "GCash", pay that's too high, a phone number shared with other accounts, earlier rejections or reports).

- **Ask for more info** keeps the post pending and notifies the employer, who can reply through support or update their profile.
- **Verify employer** (after a call or a Facebook check) adds a green *Verified* badge to all their posts. Remove it from their page in Admin → Users.

## Making someone an admin

In Firestore, create a document in the `admins` collection whose ID is their User UID (from Authentication → Users). Add any field, e.g. `name: "Mark"`.

## Still to do outside the code

- Have a lawyer review the Terms and Privacy pages.
- Register a DTI business name, then BIR and a mayor's permit, before charging for anything.
