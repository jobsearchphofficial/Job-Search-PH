// Security fixes: profile email must be the account's own; one counter bump pays for one write ("slot").
import { initializeTestEnvironment, assertSucceeds, assertFails } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, updateDoc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
await env.clearFirestore();
const tok = (email, ver) => ({ email, email_verified: ver, firebase: { sign_in_provider: ver ? "google.com" : "password" } });
const ctx = (u, email = `${u}@test.ph`, ver = true) => env.authenticatedContext(u, tok(email, ver)).firestore();
const admin = (fn) => env.withSecurityRulesDisabled((c) => fn(c.firestore()));
let bad = 0; const t = async (n, p) => { try { await p; console.log("PASS", n); } catch (e) { bad++; console.log("FAIL", n, e.message?.slice(0, 120)); } };
const prof = (extra) => ({ role: "jobseeker", fullName: "Maria Santos", phone: "09171234567", city: "Bacolod City", consent: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), ...extra });
const now = new Date(Date.now() + 8 * 3600000); const month = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; const day = Math.floor((Date.now() + 28800000) / 86400000);
const lim = (x) => ({ day, month, applies: 0, posts: 0, messages: 0, reports: 0, support: 0, postsM: 0, pays: 0, ...x });

// Profile email
await t("profile with own email", assertSucceeds(setDoc(doc(ctx("u1"), "users/u1"), prof({ email: "u1@test.ph", emailVerified: true }))));
await t("profile with someone else's email refused", assertFails(setDoc(doc(ctx("u2"), "users/u2"), prof({ email: "victim@example.com" }))));
await t("unconfirmed account can't claim 'confirmed'", assertFails(setDoc(doc(ctx("u3", "u3@test.ph", false), "users/u3"), prof({ email: "u3@test.ph", emailVerified: true }))));
await t("unconfirmed account saves as not confirmed", assertSucceeds(setDoc(doc(ctx("u3", "u3@test.ph", false), "users/u3"), prof({ email: "u3@test.ph", emailVerified: false }))));
await t("can't switch the email to someone else's", assertFails(updateDoc(doc(ctx("u1"), "users/u1"), { email: "victim@example.com", updatedAt: serverTimestamp() })));
await admin((db) => setDoc(doc(db, "users/old"), { ...prof({ email: "old-address@test.ph", emailVerified: true }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
await t("older profile keeps its saved email when editing other things", assertSucceeds(updateDoc(doc(ctx("old", "new-address@test.ph"), "users/old"), { city: "Talisay City", updatedAt: serverTimestamp() })));

// One bump = one write
await admin((db) => Promise.all([
  setDoc(doc(db, "jobs/j1"), { title: "Yaya", ownerUid: "emp", status: "approved", createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 9e8) }),
  setDoc(doc(db, "jobs/j2"), { title: "Cook", ownerUid: "emp", status: "approved", createdAt: Timestamp.now(), expiresAt: Timestamp.fromMillis(Date.now() + 9e8) }),
  setDoc(doc(db, "users/s1"), { ...prof({}), createdAt: Timestamp.now() }),
]));
const appDoc = (jobId, u) => ({ jobId, jobTitle: "Yaya", employerUid: "emp", applicantUid: u, applicant: { fullName: "Maria Santos", phone: "09171234567" }, message: "", status: "new", createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
const batchApps = async (u, jobs, slot) => { const db = ctx(u); const b = writeBatch(db); jobs.forEach((j) => b.set(doc(db, "applications", `${j}_${u}`), appDoc(j, u))); b.set(doc(db, "limits", u), lim({ applies: 1, ...(slot === undefined ? {} : { slot }) })); await b.commit(); };
await t("two applications paid by one bump refused", assertFails(batchApps("s1", ["j1", "j2"], "j1_s1")));
await t("bump naming another document refused", assertFails(batchApps("s1", ["j2"], "j1_s1")));
await t("one application with its own slot", assertSucceeds(batchApps("s1", ["j1"], "j1_s1")));
// Reports
const rep = (u, ids, slot) => { const db = ctx(u); const b = writeBatch(db); ids.forEach((id) => b.set(doc(db, "reports", id), { jobId: "j1", reason: "scam", details: "", createdAt: serverTimestamp() })); b.set(doc(db, "limits", u), lim({ reports: 1, slot })); return b.commit(); };
await t("two reports paid by one bump refused", assertFails(rep("r1", ["ra", "rb"], "ra")));
await t("one report with its slot", assertSucceeds(rep("r1", ["ra"], "ra")));
// Messages: one bump per message, named by chat/message id
await admin((db) => Promise.all([setDoc(doc(db, "applications/j1_m1"), { jobId: "j1", applicantUid: "m1", employerUid: "emp", status: "shortlisted" }),
  setDoc(doc(db, "applications/j2_m1"), { jobId: "j2", applicantUid: "m1", employerUid: "emp", status: "shortlisted" })]));
const msgs = (targets, slot) => { const db = ctx("m1"); const b = writeBatch(db);
  targets.forEach(([app, id]) => b.set(doc(db, `applications/${app}/messages/${id}`), { fromUid: "m1", text: "Hello po", createdAt: serverTimestamp() }));
  b.set(doc(db, "limits/m1"), lim({ messages: 1, msgAt: serverTimestamp(), slot })); return b.commit(); };
await t("messages to two chats paid by one bump refused", assertFails(msgs([["j1_m1", "x1"], ["j2_m1", "x2"]], "j1_m1/x1")));
await t("one message with its slot", assertSucceeds(msgs([["j1_m1", "x1"]], "j1_m1/x1")));
// "Pro, already paid" links
await admin((db) => setDoc(doc(db, "admins/boss2"), { name: "Mark" }));
await admin((db) => Promise.all([
  setDoc(doc(db, "jobs/pj"), { title: "Clinic assistant", ownerUid: "e9", status: "pending", plan: "unpaid", createdAt: Timestamp.now() }),
  setDoc(doc(db, "jobs/pj2"), { title: "Clinic assistant", ownerUid: "e9", status: "pending", plan: "unpaid", createdAt: Timestamp.now() }),
  setDoc(doc(db, "invites/PROTOK"), { pro: true, status: "used", usedBy: "e9", jobId: "pj" }),
  setDoc(doc(db, "invites/PLAINTOK"), { pro: false, status: "used", usedBy: "e9", jobId: "pj2" }),
]));
const up = (u, job, tokn) => updateDoc(doc(ctx(u), "jobs", job), { plan: "pro", paidAt: serverTimestamp(), inviteId: tokn });
await t("post from a Pro link becomes Pro", assertSucceeds(up("e9", "pj", "PROTOK")));
await t("post from a normal link can't become Pro", assertFails(up("e9", "pj2", "PLAINTOK")));
await t("can't use someone's Pro link for another post", assertFails(up("e9", "pj2", "PROTOK")));
await t("admin records a payment made outside the site", assertSucceeds(setDoc(doc(env.authenticatedContext("boss2", tok("boss2@test.ph", true)).firestore(), "payments/manual1"), { uid: "e9", amount: 199, status: "approved" }).catch(async (e) => { throw e; })));
console.log(bad ? `${bad} FAILED` : "all passed"); await env.cleanup(); process.exit(bad ? 1 : 0);
