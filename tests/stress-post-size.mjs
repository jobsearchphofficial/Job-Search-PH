// Biggest possible job posts must stay under Firestore's 1000-check limit. Run after changing the job create rule.
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";
import { doc, setDoc, writeBatch, serverTimestamp, Timestamp } from "firebase/firestore";
const env = await initializeTestEnvironment({ projectId: "demo-jsph", firestore: { rules: readFileSync("firestore.rules", "utf8"), host: "127.0.0.1", port: 8085 } });
const base = { title: "Live-in Yaya and Cook", category: "Yaya / Nanny", categoryOther: "x", employerName: "Private household", city: "Bacolod City", area: "Mandalagan", address: "Lacson St", addressHidden: false,
  employmentType: "Full-time", arrangement: "Live-in", schedule: "Full-time", shiftType: "fixed", shiftNote: "7-4", daysOff: 4, workplace: "household", salaryMin: 8000, salaryMax: 9000, salaryPeriod: "month",
  description: "Care for one baby and light cleaning, family of four in Mandalagan.", requirements: "", startDate: "2026-12-01", hours: "8 hours", reqEducation: "Any", reqExperience: 1,
  benefits: Array.from({ length: 12 }, (_, i) => "B" + i), reqList: Array.from({ length: 20 }, (_, i) => "R" + i), daysOffPer: "month" };
const now = new Date(Date.now() + 8 * 3600000); const month = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1; const day = Math.floor((Date.now() + 28800000) / 86400000);
const tok = { email_verified: true, firebase: { sign_in_provider: "password" } };
const L = (n, slot) => ({ day, month, applies: 0, posts: 0, messages: 0, reports: 0, support: 0, postsM: n, pays: 0, ...(slot ? { slot } : {}) });
for (const [name, plan, sub] of [["free", "free", null], ["unpaid", "unpaid", null], ["pro monthly", "pro", "monthly"], ["pro enterprise", "pro", "enterprise"]]) {
  const u = "st" + Math.random().toString(36).slice(2, 7);
  await env.withSecurityRulesDisabled(async (c) => { const f = c.firestore(); await setDoc(doc(f, "limits", u), L(3, "old")); await setDoc(doc(f, "bans", "nobody"), { r: 1 }); if (sub) await setDoc(doc(f, "subs", u), { plan: sub, until: Timestamp.fromMillis(Date.now() + 9e8) }); });
  const db = env.authenticatedContext(u, tok).firestore(); const b = writeBatch(db); const id = "y" + u;
  b.set(doc(db, "jobs", id), { ...base, plan, openings: plan === "free" ? 3 : 10, ownerUid: u, status: "pending", featured: false, appCount: 0, createdAt: serverTimestamp(), updatedAt: serverTimestamp(), approvedAt: null, expiresAt: null });
  b.set(doc(db, "jobs", id, "private", "contact"), { contactMethod: "phone", contactValue: "09171234567", address: "Lacson", contacts: [{ contactMethod: "phone", contactValue: "09171234567" }, { contactMethod: "email", contactValue: "a@b.ph" }] });
  b.set(doc(db, "limits", u), L(4, id));
  if (plan === "free") b.set(doc(db, "freeUsed", u), { jobId: id, at: serverTimestamp() });
  try { await b.commit(); console.log("OK  ", name); } catch (e) { console.log("FAIL", name, e.message.match(/maximum of 1000|false for '[a-z]+' @ L\d+/g)); }
}
await env.cleanup();
