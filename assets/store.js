// Data layer. Same interface for Firebase (live) and demo (sample data in the browser).
import { firebaseConfig, DEMO_MODE, LISTING_DAYS } from "./firebase-config.js";

const DAY = 86400000;
const listeners = new Set();
let state = { user: null, isAdmin: false, ready: false };

function emit() { listeners.forEach((cb) => cb({ ...state })); }

export function onAuth(cb) { listeners.add(cb); if (state.ready) cb({ ...state }); return () => listeners.delete(cb); }
export function getAuthState() { return { ...state }; }
export const isDemo = DEMO_MODE;

// Fields an employer may submit.
export const JOB_FIELDS = [
  "title", "category", "employerName", "city", "employmentType",
  "salaryMin", "salaryMax", "salaryPeriod",
  "description", "requirements", "contactMethod", "contactValue",
];

let impl;

/* ---------------- Demo implementation ---------------- */
function demoImpl() {
  const KEY = "jsph-demo-v1";
  const now = Date.now();
  const seed = {
    jobs: [
      { id: "d1", title: "Live-in Kasambahay", category: "Kasambahay / Househelper", employerName: "Family in Villamonte", city: "Bacolod City", employmentType: "Live-in", salaryMin: 6000, salaryMax: 7000, salaryPeriod: "month", description: "Household of 4 (2 adults, 2 school-age kids). General cleaning, laundry and simple cooking. Own room, free meals, 1 day off per week.", requirements: "At least 18 years old\nWith experience preferred\nCan start within 2 weeks", contactMethod: "messenger", contactValue: "jobsearchph", ownerUid: "seed", status: "approved", featured: true, createdAt: now - 1 * DAY, approvedAt: now - 1 * DAY, expiresAt: now + 29 * DAY },
      { id: "d2", title: "Yaya for 2-year-old", category: "Yaya / Nanny", employerName: "Mendoza Family", city: "Talisay City", employmentType: "Live-in", salaryMin: 7000, salaryMax: 8000, salaryPeriod: "month", description: "Looking for a patient and caring yaya for our toddler. Help with feeding, bathing and playtime. Both parents work from home.", requirements: "Experience caring for toddlers\nWith references\nNon-smoker", contactMethod: "phone", contactValue: "09171234567", ownerUid: "seed", status: "approved", featured: false, createdAt: now - 2 * DAY, approvedAt: now - 2 * DAY, expiresAt: now + 28 * DAY },
      { id: "d3", title: "Family Driver", category: "Driver", employerName: "Private employer, Lacson St.", city: "Bacolod City", employmentType: "Stay-out", salaryMin: 15000, salaryMax: null, salaryPeriod: "month", description: "Drive family members to school and work, run errands. Monday to Saturday, 7am–6pm.", requirements: "Professional driver's license\nKnows Bacolod–Silay routes\nClean driving record", contactMethod: "email", contactValue: "hiring@example.com", ownerUid: "seed", status: "approved", featured: false, createdAt: now - 3 * DAY, approvedAt: now - 3 * DAY, expiresAt: now + 27 * DAY },
      { id: "d4", title: "Caregiver for elderly", category: "Caregiver", employerName: "Santos Household", city: "Silay City", employmentType: "Live-in", salaryMin: 9000, salaryMax: 10000, salaryPeriod: "month", description: "Care for an 80-year-old mother: meals, medicine reminders, light mobility assistance and companionship.", requirements: "Caregiving experience or NC II\nPatient and kind", contactMethod: "messenger", contactValue: "https://m.me/jobsearchph", ownerUid: "seed", status: "approved", featured: false, createdAt: now - 5 * DAY, approvedAt: now - 5 * DAY, expiresAt: now + 25 * DAY },
      { id: "d5", title: "Kitchen Helper", category: "Food service", employerName: "Inasal stall, Mandalagan", city: "Bacolod City", employmentType: "Full-time", salaryMin: 450, salaryMax: null, salaryPeriod: "day", description: "Prep ingredients, wash dishes and keep the kitchen clean. 6 days a week.", requirements: "Willing to work evenings\nWith health certificate or willing to get one", contactMethod: "phone", contactValue: "09281234567", ownerUid: "seed", status: "approved", featured: false, createdAt: now - 6 * DAY, approvedAt: now - 6 * DAY, expiresAt: now + 24 * DAY },
      { id: "d6", title: "Part-time Laundry Helper", category: "Laundry", employerName: "Family in Bata", city: "Bacolod City", employmentType: "Part-time", salaryMin: 400, salaryMax: null, salaryPeriod: "day", description: "Twice a week, washing and ironing for a family of 5.", requirements: "Experience with ironing formal clothes", contactMethod: "messenger", contactValue: "jobsearchph", ownerUid: "seed", status: "approved", featured: false, createdAt: now - 8 * DAY, approvedAt: now - 8 * DAY, expiresAt: now + 22 * DAY },
      { id: "d7", title: "Househelper (stay-out)", category: "Kasambahay / Househelper", employerName: "Demo Employer", city: "Bago City", employmentType: "Stay-out", salaryMin: 5500, salaryMax: null, salaryPeriod: "month", description: "Cleaning and laundry, Monday to Friday.", requirements: "", contactMethod: "phone", contactValue: "09991234567", ownerUid: "demo-user", status: "pending", featured: false, createdAt: now - 2 * 3600000, approvedAt: null, expiresAt: null },
    ],
    reports: [],
    signedIn: false,
  };
  let db;
  const load = () => { try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw); } catch {} return structuredClone(seed); };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const demoUser = { uid: "demo-user", displayName: "Demo Employer", email: "demo@example.com" };
  const wait = (v) => new Promise((r) => setTimeout(() => r(structuredClone(v)), 120));
  const find = (id) => db.jobs.find((j) => j.id === id);

  return {
    async init() {
      db = load();
      state = { user: db.signedIn ? demoUser : null, isAdmin: db.signedIn, ready: true };
      emit();
    },
    async signIn() { db.signedIn = true; save(); state = { user: demoUser, isAdmin: true, ready: true }; emit(); },
    async signOut() { db.signedIn = false; save(); state = { user: null, isAdmin: false, ready: true }; emit(); },
    async listPublic() { return wait(db.jobs.filter((j) => j.status === "approved")); },
    async getJob(id) { return wait(find(id) || null); },
    async createJob(data) {
      const job = { ...data, id: "j" + Date.now().toString(36), ownerUid: state.user.uid, status: "pending", featured: false, createdAt: Date.now(), approvedAt: null, expiresAt: null };
      db.jobs.unshift(job); save(); return wait(job);
    },
    async myJobs() { return wait(db.jobs.filter((j) => j.ownerUid === state.user?.uid)); },
    async listByStatus(status) { return wait(db.jobs.filter((j) => j.status === status)); },
    async updateJob(id, patch) { const j = find(id); if (j) Object.assign(j, patch); save(); return wait(j); },
    async approve(id) { const t = Date.now(); return this.updateJob(id, { status: "approved", approvedAt: t, expiresAt: t + LISTING_DAYS * DAY }); },
    async deleteJob(id) { db.jobs = db.jobs.filter((j) => j.id !== id); save(); },
    async report(jobId, reason, details) { db.reports.unshift({ id: "r" + Date.now().toString(36), jobId, reason, details, createdAt: Date.now() }); save(); },
    async listReports() { return wait(db.reports); },
    async dismissReport(id) { db.reports = db.reports.filter((r) => r.id !== id); save(); },
    async resetDemo() { db = structuredClone(seed); save(); state = { user: null, isAdmin: false, ready: true }; emit(); },
  };
}

/* ---------------- Firebase implementation ---------------- */
function firebaseImpl() {
  const CDN = "https://www.gstatic.com/firebasejs/10.12.2";
  let A, F, auth, db;
  const toMs = (v) => (v && typeof v.toMillis === "function" ? v.toMillis() : v ?? null);
  const norm = (snap) => {
    const d = snap.data();
    return { id: snap.id, ...d, createdAt: toMs(d.createdAt), approvedAt: toMs(d.approvedAt), expiresAt: toMs(d.expiresAt), updatedAt: toMs(d.updatedAt) };
  };
  const q = async (...constraints) => (await F.getDocs(F.query(F.collection(db, "jobs"), ...constraints))).docs.map(norm);

  return {
    async init() {
      const [appMod, authMod, fsMod] = await Promise.all([
        import(`${CDN}/firebase-app.js`), import(`${CDN}/firebase-auth.js`), import(`${CDN}/firebase-firestore.js`),
      ]);
      A = authMod; F = fsMod;
      const app = appMod.initializeApp(firebaseConfig);
      auth = A.getAuth(app);
      db = F.getFirestore(app);
      A.onAuthStateChanged(auth, async (user) => {
        let isAdmin = false;
        if (user) {
          try { isAdmin = (await F.getDoc(F.doc(db, "admins", user.uid))).exists(); } catch { isAdmin = false; }
        }
        state = { user: user ? { uid: user.uid, displayName: user.displayName, email: user.email } : null, isAdmin, ready: true };
        emit();
      });
    },
    async signIn() { await A.signInWithPopup(auth, new A.GoogleAuthProvider()); },
    async signOut() { await A.signOut(auth); },
    async listPublic() { return q(F.where("status", "==", "approved"), F.limit(500)); },
    async getJob(id) {
      try { const s = await F.getDoc(F.doc(db, "jobs", id)); return s.exists() ? norm(s) : null; }
      catch { return null; } // permission denied = not public
    },
    async createJob(data) {
      const ref = await F.addDoc(F.collection(db, "jobs"), {
        ...data, ownerUid: auth.currentUser.uid, status: "pending", featured: false,
        createdAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(), approvedAt: null, expiresAt: null,
      });
      return { id: ref.id };
    },
    async myJobs() { return q(F.where("ownerUid", "==", auth.currentUser.uid)); },
    async listByStatus(status) { return q(F.where("status", "==", status)); },
    async updateJob(id, patch) { await F.updateDoc(F.doc(db, "jobs", id), { ...patch, updatedAt: F.serverTimestamp() }); },
    async approve(id) {
      await F.updateDoc(F.doc(db, "jobs", id), {
        status: "approved", approvedAt: F.serverTimestamp(), updatedAt: F.serverTimestamp(),
        expiresAt: F.Timestamp.fromMillis(Date.now() + LISTING_DAYS * DAY),
      });
    },
    async deleteJob(id) { await F.deleteDoc(F.doc(db, "jobs", id)); },
    async report(jobId, reason, details) {
      await F.addDoc(F.collection(db, "reports"), { jobId, reason, details, createdAt: F.serverTimestamp() });
    },
    async listReports() {
      const s = await F.getDocs(F.query(F.collection(db, "reports"), F.orderBy("createdAt", "desc"), F.limit(200)));
      return s.docs.map((d) => ({ id: d.id, ...d.data(), createdAt: toMs(d.data().createdAt) }));
    },
    async dismissReport(id) { await F.deleteDoc(F.doc(db, "reports", id)); },
  };
}

impl = DEMO_MODE ? demoImpl() : firebaseImpl();
export const store = impl;
