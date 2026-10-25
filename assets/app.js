import { store, onAuth, getAuthState, JOB_FIELDS, ageFrom, uploadsEnabled } from "./store.js?v=1792946555";

/* ---------------- Constants ---------------- */
const CATEGORIES = [
  "Kasambahay / Househelper", "Yaya / Nanny", "Caregiver", "Cook", "Driver", "Laundry",
  "Gardener / Maintenance", "Food service", "Sales / Retail", "Delivery / Rider",
  "Construction / Skilled trade", "Security", "Office / Admin", "Other",
];
const TYPES = ["Live-in", "Stay-out", "Full-time", "Part-time", "Project-based"];
const CITIES = [
  "Bacolod City", "Talisay City", "Silay City", "Bago City", "Victorias City", "Cadiz City",
  "Sagay City", "La Carlota City", "Kabankalan City", "San Carlos City", "Escalante City",
  "Himamaylan City", "Sipalay City", "Murcia", "Valladolid", "Pulupandan", "E.B. Magalona",
  "Manapla", "Iloilo City", "Roxas City", "Dumaguete City", "Other",
];
const AVAILABILITY = ["Available now", "Within 2 weeks", "Within a month", "Not sure yet"];
const PERIODS = { month: "/ month", day: "/ day", hour: "/ hour" };
const REPORT_REASONS = {
  fee: "Asks jobseekers to pay a fee",
  scam: "Looks like a scam or fake job",
  illegal: "Illegal or unsafe work (e.g. minors, trafficking)",
  wrong: "Wrong or misleading details",
  filled: "Job already filled",
  other: "Other",
};
const STATUS_LABEL = { pending: "Under review", approved: "Live", rejected: "Rejected", closed: "Closed" };
const APP_STATUS = { new: "Sent", shortlisted: "Shortlisted", not_selected: "Not selected", hired: "Hired" };
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\//i.test(navigator.userAgent);

/* ---------------- Helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const nl2br = (s) => esc(s).replace(/\n/g, "<br>");
const opts = (list, sel) => list.map((c) => `<option ${sel === c ? "selected" : ""}>${esc(c)}</option>`).join("");
const firstName = (n) => String(n || "").trim().split(/\s+/)[0] || "Profile";

function salaryText(j) {
  if (!j.salaryMin && !j.salaryMax) return "Salary negotiable";
  const per = PERIODS[j.salaryPeriod] || "";
  if (j.salaryMin && j.salaryMax && j.salaryMax !== j.salaryMin) return `${peso(j.salaryMin)}–${peso(j.salaryMax)} ${per}`;
  return `${peso(j.salaryMin || j.salaryMax)} ${per}`;
}
function ago(ms) {
  if (!ms) return "";
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 60) return m <= 1 ? "just now" : `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24); if (d < 30) return `${d}d ago`;
  return new Date(ms).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}
const isLive = (j) => j.status === "approved" && (!j.expiresAt || j.expiresAt > Date.now());
const digits = (v) => String(v || "").replace(/[^\d+]/g, "");
const safeUrl = (v) => { try { const u = new URL(v); return /^https?:$/.test(u.protocol) ? u.href : null; } catch { return null; } };

function messengerUrl(v) {
  v = String(v || "").trim(); if (!v) return null;
  let user = v;
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      if (!/(^|\.)(m\.me|facebook\.com|messenger\.com)$/i.test(u.hostname)) return null;
      user = u.pathname.replace(/^\/+|\/+$/g, "").replace(/^t\//, "");
    }
  } catch { return null; }
  user = user.replace(/[^A-Za-z0-9.\-_]/g, "");
  return user ? `https://m.me/${user}` : null;
}
function contactLink(c) {
  if (!c) return null;
  const v = String(c.contactValue || "").trim();
  if (c.contactMethod === "phone") return { href: `tel:${digits(v)}`, label: `Call ${v}`, extra: `sms:${digits(v)}`, text: v };
  if (c.contactMethod === "email") {
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) return null;
    return { href: `mailto:${v}`, label: `Email ${v}`, text: v };
  }
  const m = messengerUrl(v);
  return m ? { href: m, label: "Message on Messenger", text: v } : null;
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2800);
}
const statusBadge = (j) => {
  const s = j.status === "approved" && !isLive(j) ? "expired" : j.status;
  return `<span class="badge badge-${s}">${s === "expired" ? "Expired" : STATUS_LABEL[s]}</span>`;
};
const appBadge = (s, employer) => `<span class="badge badge-app-${s}">${employer && s === "new" ? "New" : APP_STATUS[s] || s}</span>`;

function authError(err) {
  const code = err?.code || "";
  const map = {
    "auth/invalid-email": "That email address doesn't look right.",
    "auth/missing-password": "Enter your password.",
    "auth/weak-password": "Use a password with at least 6 characters.",
    "auth/email-already-in-use": "An account with this email already exists. Sign in instead.",
    "auth/invalid-credential": "Wrong email or password.",
    "auth/wrong-password": "Wrong email or password.",
    "auth/user-not-found": "No account with that email. Create one instead.",
    "auth/too-many-requests": "Too many tries. Wait a few minutes and try again.",
    "auth/popup-closed-by-user": "The Google window was closed before signing in.",
    "auth/popup-blocked": "Your browser blocked the Google window. Allow pop-ups or use email instead.",
    "auth/operation-not-allowed": "This sign-in method isn't turned on yet.",
    "auth/unauthorized-domain": "This website address isn't allowed for sign-in yet.",
    "auth/network-request-failed": "No internet connection. Check your connection and try again.",
  };
  return map[code] || `Something went wrong (${code || err?.message || "unknown"}).`;
}

// Two-click confirm without browser dialogs.
function confirmInline(btn, text = "Click again to confirm") {
  if (btn.dataset.armed) return true;
  const orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = text; btn.classList.add("armed");
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("armed"); }, 3000);
  return false;
}

/* ---------------- Auth flow helpers ---------------- */
let returnTo = null;
let signInPurpose = "";
let pendingName = "";
function goSignIn(purpose) {
  returnTo = location.hash || "#/";
  signInPurpose = purpose || "";
  location.hash = "#/signin";
}
function finishAuthFlow() {
  const { profile } = getAuthState();
  if (!profile) { location.hash = "#/profile"; return; }
  const to = returnTo && !/^#\/(signin|profile)/.test(returnTo) ? returnTo : "#/";
  returnTo = null;
  if (location.hash === to) route(); else location.hash = to;
}

/* ---------------- Nav ---------------- */
function renderNav() {
  const { user, profile, isAdmin } = getAuthState();
  const here = location.hash || "#/";
  const link = (href, label) => `<a href="${href}" class="${here === href || (href !== "#/" && here.startsWith(href)) ? "active" : ""}">${label}</a>`;
  const role = profile?.role;
  $("#nav").innerHTML = [
    link("#/", "Find jobs"),
    !user || role === "employer" ? link("#/post", "Post a job") : "",
    role === "employer" ? link("#/my", "My posts") : "",
    role === "jobseeker" ? link("#/applications", "My applications") : "",
    isAdmin ? link("#/admin", "Admin") : "",
    user ? link("#/profile", esc(profile ? firstName(profile.fullName) : "Set up profile")) : "",
    user
      ? `<button class="btn btn-ghost btn-sm" data-action="signout">Sign out</button>`
      : `<a class="btn btn-primary btn-sm nav-cta" href="#/signin" data-action="gosignin">Sign in</a>`,
  ].join("");
}
$("#nav-toggle").addEventListener("click", () => {
  const nav = $("#nav"); const open = nav.classList.toggle("open");
  $("#nav-toggle").setAttribute("aria-expanded", open);
});
document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-action]"); if (!a) return;
  if (a.dataset.action === "signout") { await store.signOut(); myAppsCache = null; toast("Signed out"); location.hash = "#/"; }
  if (a.dataset.action === "gosignin") { e.preventDefault(); goSignIn(a.dataset.purpose); }
});

/* ---------------- Jobs list ---------------- */
let jobsCache = null;
let myAppsCache = null;
const filters = { q: "", category: "", city: "", type: "" };

async function getMyApps() {
  const { profile } = getAuthState();
  if (profile?.role !== "jobseeker") return [];
  if (!myAppsCache) myAppsCache = await store.myApplications().catch(() => []);
  return myAppsCache;
}

async function viewList() {
  document.title = "Job Search PH — Jobs in Negros & Western Visayas";
  const { user } = getAuthState();
  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">Free for jobseekers · No fees, ever</span>
      <h1>Find work near you in <em>Negros &amp; Western Visayas</em></h1>
      <p>Household, service and local jobs posted by employers in Bacolod and nearby cities. Create a free profile once, then apply to any job in one tap.</p>
      <form class="search" id="search" role="search">
        <input type="search" id="q" name="q" placeholder="Search jobs, e.g. yaya, driver, cook" value="${esc(filters.q)}" aria-label="Search jobs">
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
      <div class="hero-stats"><span><strong id="stat-jobs">–</strong> open jobs</span><span><strong id="stat-cities">–</strong> cities</span><span>New posts reviewed daily</span></div>
      ${user ? "" : `<div class="hero-actions"><a class="btn btn-ghost btn-sm" href="#/signin" data-action="gosignin" data-purpose="Create your free profile">Create a free profile</a><a class="btn btn-ghost btn-sm" href="#/post">I'm hiring</a></div>`}
    </section>
    <section class="filters" aria-label="Filters">
      <select id="f-category" name="category" aria-label="Category"><option value="">All categories</option>${opts(CATEGORIES, filters.category)}</select>
      <select id="f-city" name="city" aria-label="Location"><option value="">All locations</option>${opts(CITIES.filter((c) => c !== "Other"), filters.city)}</select>
      <select id="f-type" name="type" aria-label="Job type"><option value="">Any type</option>${opts(TYPES, filters.type)}</select>
    </section>
    <div class="list-head"><span id="count" class="muted"></span></div>
    <section id="results" class="cards"><p class="muted">Loading jobs…</p></section>
    <aside class="notice"><strong>Stay safe:</strong> legitimate employers never ask you to pay to apply, train or get hired. <a href="#/safety">Read safety tips</a></aside>`;

  let applied = new Set();
  const draw = () => {
    const q = filters.q.trim().toLowerCase();
    const list = (jobsCache || []).filter(isLive)
      .filter((j) => !filters.category || j.category === filters.category)
      .filter((j) => !filters.city || j.city === filters.city)
      .filter((j) => !filters.type || j.employmentType === filters.type)
      .filter((j) => !q || [j.title, j.category, j.employerName, j.city, j.description].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.featured - a.featured) || (b.approvedAt || b.createdAt) - (a.approvedAt || a.createdAt));
    $("#count").textContent = `${list.length} job${list.length === 1 ? "" : "s"} found`;
    $("#results").innerHTML = list.length ? list.map((j) => card(j, applied.has(j.id))).join("") :
      `<div class="empty"><p><strong>No jobs match yet.</strong></p><p class="muted">Try another category or location, or check back soon.</p></div>`;
  };
  $("#search").addEventListener("submit", (e) => { e.preventDefault(); filters.q = e.target.q.value; draw(); });
  $("#q").addEventListener("input", (e) => { filters.q = e.target.value; draw(); });
  app.querySelectorAll(".filters select").forEach((s) => s.addEventListener("change", () => { filters[s.name] = s.value; draw(); }));

  try {
    const [jobs, apps] = await Promise.all([jobsCache ? jobsCache : store.listPublic(), getMyApps()]);
    jobsCache = jobs; applied = new Set(apps.map((a) => a.jobId));
    if (!$("#results")) return;
    draw();
    const live = jobsCache.filter(isLive);
    $("#stat-jobs").textContent = live.length;
    $("#stat-cities").textContent = new Set(live.map((j) => j.city)).size;
  } catch (err) { console.error(err); if ($("#results")) $("#results").innerHTML = `<p class="error">Could not load jobs. Please refresh.</p>`; }
}

function card(j, applied) {
  return `
  <a class="card ${j.featured ? "card-featured" : ""}" href="#/job/${encodeURIComponent(j.id)}">
    ${j.featured ? `<span class="badge badge-featured">Featured</span>` : applied ? `<span class="badge badge-app-new">Applied</span>` : ""}
    <h3>${esc(j.title)}</h3>
    <p class="employer">${esc(j.employerName)}</p>
    <ul class="meta"><li>${esc(j.city)}</li><li>${esc(j.employmentType)}</li><li>${esc(j.category)}</li></ul>
    <div class="card-foot"><span class="salary">${salaryText(j)}</span><span class="muted">${ago(j.approvedAt || j.createdAt)}</span></div>
  </a>`;
}

/* ---------------- Job detail + apply ---------------- */
async function viewJob(id) {
  app.innerHTML = `<p class="muted">Loading…</p>`;
  const here = location.hash;
  const j = await store.getJob(id);
  if (location.hash !== here) return;
  const { user, isAdmin } = getAuthState();
  const isOwner = !!(j && user && j.ownerUid === user.uid);
  if (!j || (!isLive(j) && !isOwner && !isAdmin)) {
    app.innerHTML = `<div class="empty"><h2>This job is no longer available</h2><p class="muted">It may have been filled or removed.</p><p><a class="btn btn-primary" href="#/">Browse other jobs</a></p></div>`;
    return;
  }
  document.title = `${j.title} — ${j.city} | Job Search PH`;
  app.innerHTML = `
    <p><a href="#/" class="back">← All jobs</a></p>
    <article class="job">
      <div class="job-main">
        ${!isLive(j) ? `<p class="notice">This post is not public. Status: ${statusBadge(j)}</p>` : ""}
        <h1>${esc(j.title)}</h1>
        <p class="employer">${esc(j.employerName)} · ${esc(j.city)}</p>
        <ul class="meta"><li>${esc(j.employmentType)}</li><li>${esc(j.category)}</li><li>Posted ${ago(j.approvedAt || j.createdAt)}</li></ul>
        <p class="salary salary-lg">${salaryText(j)}</p>
        <h2>About the job</h2><p>${nl2br(j.description)}</p>
        ${j.requirements ? `<h2>Requirements</h2><ul class="reqs">${j.requirements.split("\n").filter(Boolean).map((r) => `<li>${esc(r.replace(/^[-•*]\s*/, ""))}</li>`).join("")}</ul>` : ""}
      </div>
      <aside class="job-side">
        <div class="panel" id="apply-panel"><p class="muted">Loading…</p></div>
        <div class="panel panel-warn">
          <strong>Never pay to get a job.</strong>
          <p>If the employer asks for a fee, deposit or your ID before an interview, stop and report the post.</p>
        </div>
        <details class="panel report">
          <summary>Report this post</summary>
          <form id="report-form">
            <label for="r-reason">Reason</label><select id="r-reason" name="reason" required>${Object.entries(REPORT_REASONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
            <label for="r-details">Details (optional)</label><textarea id="r-details" name="details" maxlength="500" rows="3"></textarea>
            <button class="btn btn-danger btn-sm" type="submit">Send report</button>
          </form>
        </details>
        <button class="btn btn-ghost btn-block" id="share">Share this job</button>
      </aside>
    </article>`;

  $("#share").addEventListener("click", async () => {
    try {
      if (navigator.share) await navigator.share({ title: j.title, text: `${j.title} — ${j.city}`, url: location.href });
      else { await navigator.clipboard.writeText(location.href); toast("Link copied"); }
    } catch {}
  });
  $("#report-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await store.report(j.id, f.reason.value, f.details.value.trim().slice(0, 500)); f.closest("details").innerHTML = `<p>Thanks. We'll review this post.</p>`; }
    catch { toast("Could not send report. Try again."); }
  });
  renderApplyPanel(j, isOwner);
}

async function renderApplyPanel(j, isOwner) {
  const panel = $("#apply-panel"); if (!panel) return;
  const { user, profile, isAdmin } = getAuthState();

  if (isOwner || isAdmin) {
    const [apps, contact] = await Promise.all([isOwner ? store.applicationsForJob(j.id).catch(() => []) : [], store.getContact(j.id)]);
    const fresh = apps.filter((a) => a.status === "new").length;
    panel.innerHTML = `
      <h2>${isOwner ? "Your post" : "Admin view"}</h2>
      ${isOwner ? `<p class="muted">${apps.length} applicant${apps.length === 1 ? "" : "s"}${fresh ? ` · ${fresh} new` : ""}</p>
      <a class="btn btn-primary btn-block" href="#/applicants/${encodeURIComponent(j.id)}">View applicants</a>` : ""}
      ${contact ? `<p class="small muted">Contact shown to applicants: ${esc(contact.contactMethod)} · ${esc(contact.contactValue)}</p>` : ""}`;
    return;
  }
  if (!user) {
    panel.innerHTML = `
      <h2>Apply for this job</h2>
      <p class="muted">Sign in with a free profile to apply. The employer's contact details are shown after you apply.</p>
      <a class="btn btn-primary btn-block" href="#/signin" data-action="gosignin" data-purpose="Sign in to apply">Sign in to apply</a>`;
    return;
  }
  if (!profile) {
    returnTo = location.hash;
    panel.innerHTML = `<h2>Apply for this job</h2><p class="muted">Finish your profile first. It only takes a minute.</p><a class="btn btn-primary btn-block" href="#/profile">Finish my profile</a>`;
    return;
  }
  if (profile.role !== "jobseeker") {
    returnTo = location.hash;
    panel.innerHTML = `<h2>Apply for this job</h2><p class="muted">You're signed in as an employer. Switch your profile to "I'm looking for work" to apply.</p><a class="btn btn-ghost btn-block" href="#/profile">Change profile type</a>`;
    return;
  }
  const apps = await getMyApps();
  const mine = apps.find((a) => a.jobId === j.id);
  if (mine) {
    const contact = await store.getContact(j.id);
    const c = contactLink(contact);
    panel.innerHTML = `
      <h2>${mine.status === "new" ? "Application sent" : `You applied ${appBadge(mine.status)}`}</h2>
      <p class="muted">Sent ${ago(mine.createdAt)}. The employer can see your profile and may contact you at ${esc(profile.phone)}.</p>
      ${c ? `<p class="small"><strong>Employer contact</strong></p>
        <a class="btn btn-primary btn-block" href="${esc(c.href)}" target="_blank" rel="noopener nofollow">${esc(c.label)}</a>
        ${c.extra ? `<a class="btn btn-ghost btn-block" href="${esc(c.extra)}">Send a text</a>` : ""}
        <p class="small muted copyable">${esc(c.text)}</p>` : ""}
      <button class="btn btn-ghost btn-sm" id="withdraw">Withdraw application</button>`;
    $("#withdraw").addEventListener("click", async (e) => {
      if (!confirmInline(e.target, "Click again to withdraw")) return;
      try { await store.withdraw(mine.id); myAppsCache = null; toast("Application withdrawn"); renderApplyPanel(j, false); }
      catch { toast("Could not withdraw. Try again."); }
    });
    return;
  }
  if (!isLive(j)) { panel.innerHTML = `<p class="muted">This job is not accepting applications.</p>`; return; }
  const age = ageFrom(profile.birthDate);
  panel.innerHTML = `
    <h2>Apply for this job</h2>
    <p class="muted small">The employer will see your profile: <strong>${esc(profile.fullName)}</strong>${age ? `, ${age}` : ""}, ${esc(profile.city)}, ${esc(profile.phone)}, plus your experience${profile.resumeUrl || profile.resumeFileUrl ? " and resume" : ""}. <a href="#/profile">Edit profile</a></p>
    <form id="apply-form">
      <label for="a-msg" class="small"><strong>Message to the employer</strong> (optional)</label>
      <textarea id="a-msg" name="message" rows="3" maxlength="1000" placeholder="e.g. I have 3 years experience as a yaya and can start next week."></textarea>
      <button class="btn btn-primary btn-block" type="submit">Apply now</button>
    </form>`;
  $("#apply-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector("button"); btn.disabled = true; btn.textContent = "Sending…";
    try { await store.apply(j, e.target.message.value.trim()); myAppsCache = null; toast("Application sent"); renderApplyPanel(j, false); }
    catch (err) { console.error(err); btn.disabled = false; btn.textContent = "Apply now"; toast(`Could not apply (${err.code || "error"}). Try again.`); }
  });
}

/* ---------------- Sign in ---------------- */
function viewSignIn() {
  document.title = "Sign in | Job Search PH";
  if (getAuthState().user) return finishAuthFlow();
  let mode = "signin";
  const draw = () => {
    app.innerHTML = `
      <div class="auth-wrap">
        <div class="auth-card">
          <h1>${mode === "signup" ? "Create your free account" : esc(signInPurpose || "Sign in")}</h1>
          <p class="muted">${mode === "signup" ? "For jobseekers and employers. It's free." : "Sign in to apply for jobs or manage your posts."}</p>
          ${IN_APP_BROWSER ? `<p class="notice small">You opened this inside Facebook or Messenger, which blocks Google sign-in. Use email below, or tap ⋯ and choose <strong>Open in browser</strong>.</p>` : ""}
          <button class="btn btn-ghost btn-block btn-google" id="google" ${IN_APP_BROWSER ? "disabled" : ""}>
            <svg viewBox="0 0 48 48" width="18" height="18" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            Continue with Google
          </button>
          <div class="divider"><span>or use email</span></div>
          <form id="email-form" class="auth-form" novalidate>
            ${mode === "signup" ? `<label for="s-name">Full name</label><input id="s-name" name="name" autocomplete="name" required maxlength="80">` : ""}
            <label for="s-email">Email</label><input id="s-email" name="email" type="email" autocomplete="email" required>
            <label for="s-pw">Password</label><input id="s-pw" name="pw" type="password" autocomplete="${mode === "signup" ? "new-password" : "current-password"}" required minlength="6">
            ${mode === "signup" ? `<p class="hint">At least 6 characters.</p>` : `<button type="button" class="linkbtn" id="forgot">Forgot password?</button>`}
            <p id="auth-error" class="error" hidden></p>
            <button class="btn btn-primary btn-block" type="submit">${mode === "signup" ? "Create account" : "Sign in"}</button>
          </form>
          <p class="switch">${mode === "signup" ? `Already have an account? <button class="linkbtn" id="toggle">Sign in</button>` : `New here? <button class="linkbtn" id="toggle">Create a free account</button>`}</p>
        </div>
      </div>`;
    const err = (m) => { const el = $("#auth-error"); el.textContent = m; el.hidden = !m; };
    $("#toggle").addEventListener("click", () => { mode = mode === "signup" ? "signin" : "signup"; draw(); });
    $("#google").addEventListener("click", async () => { try { await store.signInGoogle(); } catch (e) { err(authError(e)); } });
    $("#forgot")?.addEventListener("click", async () => {
      const email = $("#s-email").value.trim();
      if (!email) return err("Type your email above first, then tap Forgot password.");
      try { await store.resetPassword(email); err(""); toast("Password reset link sent. Check your email."); } catch (e) { err(authError(e)); }
    });
    $("#email-form").addEventListener("submit", async (e) => {
      e.preventDefault(); err("");
      const f = e.target; const btn = f.querySelector("button[type=submit]");
      const email = f.email.value.trim(), pw = f.pw.value;
      if (mode === "signup" && f.name.value.trim().length < 2) return err("Enter your full name.");
      if (!email) return err("Enter your email.");
      if (pw.length < 6) return err("Use a password with at least 6 characters.");
      btn.disabled = true;
      try {
        if (mode === "signup") { pendingName = f.name.value.trim(); await store.signUpEmail(email, pw, pendingName); }
        else await store.signInEmail(email, pw);
      } catch (ex) { err(authError(ex)); btn.disabled = false; }
    });
  };
  draw();
}

/* ---------------- Profile ---------------- */
function viewProfile() {
  document.title = "My profile | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to set up your profile");
  const p = { ...(profile || {}) };
  if (!p.fullName) p.fullName = pendingName || user.displayName || "";
  let role = p.role || "";
  const isNew = !profile;

  const maxBirth = (() => { const d = new Date(); d.setFullYear(d.getFullYear() - 18); return d.toISOString().slice(0, 10); })();
  const chips = (name, list, selected = []) => `<div class="chips">${list.map((c) => `
    <label class="chip"><input type="checkbox" name="${name}" value="${esc(c)}" ${selected.includes(c) ? "checked" : ""}><span>${esc(c)}</span></label>`).join("")}</div>`;

  const formHtml = () => `
    <form id="profile-form" class="form" novalidate>
      <fieldset>
        <legend>About you</legend>
        <label>Full name *<input name="fullName" required minlength="2" maxlength="80" autocomplete="name" value="${esc(p.fullName)}"></label>
        <div class="row">
          <label>Mobile number *<input name="phone" required inputmode="tel" autocomplete="tel" placeholder="0917 123 4567" value="${esc(p.phone)}"></label>
          <label>City / municipality *<select name="city" required><option value="">Choose…</option>${opts(CITIES, p.city)}</select></label>
        </div>
        <div class="row">
          ${role === "jobseeker" ? `<label>Birthdate *<input name="birthDate" type="date" required max="${maxBirth}" value="${esc(p.birthDate)}"><span class="hint">You must be at least 18. Employers see your age, not your birthdate.</span></label>`
            : `<label>Household or business name<input name="companyName" maxlength="100" placeholder="e.g. Reyes Family or Inasal Express" value="${esc(p.companyName)}"></label>`}
          <label>Messenger (optional)<input name="messenger" maxlength="100" placeholder="Username or m.me link" value="${esc(p.messenger)}"></label>
        </div>
      </fieldset>
      ${role === "jobseeker" ? `
      <fieldset>
        <legend>Work you're looking for</legend>
        <div><span class="label">Jobs you want (up to 5)</span>${chips("jobCategories", CATEGORIES, p.jobCategories)}</div>
        <div><span class="label">Arrangement</span>${chips("jobTypes", TYPES, p.jobTypes)}</div>
        <div class="row">
          <label>Years of experience<input name="experienceYears" type="number" min="0" max="60" inputmode="numeric" value="${esc(p.experienceYears ?? "")}"></label>
          <label>Availability<select name="availability"><option value="">Choose…</option>${opts(AVAILABILITY, p.availability)}</select></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Experience &amp; resume</legend>
        <label>Skills<textarea name="skills" rows="2" maxlength="1000" placeholder="e.g. cooking Filipino dishes, ironing, caring for toddlers, basic first aid">${esc(p.skills)}</textarea></label>
        <label>Work history<textarea name="workHistory" rows="4" maxlength="3000" placeholder="One job per line, e.g.&#10;2022–2024 · Kasambahay · Santos family, Bacolod&#10;2020–2022 · Kitchen helper · Inasal stall, Silay">${esc(p.workHistory)}</textarea></label>
        <label>Highest education (optional)<input name="education" maxlength="300" placeholder="e.g. High school graduate, TESDA NC II Caregiving" value="${esc(p.education)}"></label>
        <label>Resume link (optional)<input name="resumeUrl" type="url" maxlength="500" placeholder="https://drive.google.com/…" value="${esc(p.resumeUrl)}"><span class="hint">A Google Drive or other link. Set sharing to "Anyone with the link".</span></label>
        ${uploadsEnabled ? `<label>Upload resume (optional)<input name="resumeFile" type="file" accept="application/pdf,image/jpeg,image/png,image/webp"><span class="hint">PDF or photo, up to 5 MB.${p.resumeFileName ? ` Current file: <a href="${esc(p.resumeFileUrl)}" target="_blank" rel="noopener">${esc(p.resumeFileName)}</a>` : ""}</span></label>` : ""}
      </fieldset>` : ""}
      <label class="check"><input type="checkbox" name="consent" ${profile?.consent ? "checked" : ""}>
        <span>${role === "jobseeker" ? "I agree that my profile is shared with employers when I apply to their jobs." : "I agree to only post real jobs and to use applicants' details only for hiring."} I accept the <a href="#/terms" target="_blank">Terms</a> and <a href="#/privacy" target="_blank">Privacy notice</a>.</span></label>
      <p id="form-error" class="error" hidden></p>
      <div class="form-actions">
        <button class="btn btn-primary" type="submit">${isNew ? "Save and continue" : "Save changes"}</button>
        ${!isNew ? `<button class="btn btn-danger btn-sm" type="button" id="del-profile">Delete my profile</button>` : ""}
      </div>
    </form>`;

  const collect = () => {
    const f = $("#profile-form"); if (!f) return;
    ["fullName", "phone", "city", "messenger", "birthDate", "companyName", "experienceYears", "availability", "skills", "workHistory", "education", "resumeUrl"]
      .forEach((k) => { if (f[k]) p[k] = f[k].value; });
    ["jobCategories", "jobTypes"].forEach((k) => { if (f.querySelector(`[name=${k}]`)) p[k] = [...f.querySelectorAll(`[name=${k}]:checked`)].map((i) => i.value); });
  };

  const bindForm = () => {
    const f = $("#profile-form");
    f.querySelectorAll("[name=jobCategories]").forEach((cb) => cb.addEventListener("change", () => {
      if (f.querySelectorAll("[name=jobCategories]:checked").length > 5) { cb.checked = false; toast("Pick up to 5 jobs"); }
    }));
    f.addEventListener("input", (e) => e.target.classList?.remove("invalid"));
    $("#del-profile")?.addEventListener("click", async (e) => {
      if (!confirmInline(e.target, "Click again to delete")) return;
      try { await store.deleteProfile(); myAppsCache = null; toast("Profile deleted"); await store.signOut(); location.hash = "#/"; }
      catch { toast("Could not delete profile"); }
    });
    f.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errEl = $("#form-error");
      const fail = (m, el) => { errEl.textContent = m; errEl.hidden = false; if (el) { el.classList.add("invalid"); el.focus({ preventScroll: true }); } errEl.scrollIntoView({ block: "center", behavior: "smooth" }); };
      errEl.hidden = true;
      collect();
      const fullName = (p.fullName || "").trim(), phone = (p.phone || "").trim();
      if (fullName.length < 2) return fail("Enter your full name.", f.fullName);
      const ph = digits(phone).replace(/^\+/, "");
      if (ph.length < 10 || ph.length > 13) return fail("Enter a complete mobile number, e.g. 0917 123 4567.", f.phone);
      if (!p.city) return fail("Choose your city or municipality.", f.city);
      if (p.messenger && !messengerUrl(p.messenger)) return fail("That Messenger username or link doesn't look right.", f.messenger);
      const data = { role, fullName, phone, city: p.city, messenger: (p.messenger || "").trim() };
      if (role === "jobseeker") {
        const age = ageFrom(p.birthDate);
        if (!p.birthDate || age === null) return fail("Enter your birthdate.", f.birthDate);
        if (age < 18) return fail("You must be at least 18 years old to apply for jobs here.", f.birthDate);
        if (age > 90) return fail("Check your birthdate.", f.birthDate);
        if (p.resumeUrl && !safeUrl(p.resumeUrl.trim())) return fail("The resume link should start with https://", f.resumeUrl);
        const exp = p.experienceYears === "" || p.experienceYears == null ? null : Number(p.experienceYears);
        Object.assign(data, {
          birthDate: p.birthDate, jobCategories: p.jobCategories || [], jobTypes: p.jobTypes || [],
          experienceYears: Number.isFinite(exp) && exp >= 0 ? Math.min(exp, 60) : null,
          skills: (p.skills || "").trim(), workHistory: (p.workHistory || "").trim(), education: (p.education || "").trim(),
          availability: p.availability || "", resumeUrl: (p.resumeUrl || "").trim(),
        });
      } else {
        data.companyName = (p.companyName || "").trim();
      }
      if (!f.consent.checked) return fail("Tick the box to agree before saving.", f.consent);
      const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
      try {
        const file = f.resumeFile?.files?.[0];
        if (file) {
          if (file.size > 5 * 1024 * 1024) throw Object.assign(new Error("too-big"), { friendly: "The resume file is over 5 MB." });
          btn.textContent = "Uploading resume…";
          const up = await store.uploadResume(file);
          data.resumeFileUrl = up.url; data.resumeFileName = up.name;
        }
        await store.saveProfile(data);
        myAppsCache = null; pendingName = "";
        toast("Profile saved");
        if (isNew || returnTo) finishAuthFlow(); else viewProfile();
      } catch (ex) {
        console.error(ex); btn.disabled = false; btn.textContent = isNew ? "Save and continue" : "Save changes";
        fail(ex.friendly || `Could not save your profile (${ex.code || ex.message}). Try again.`);
      }
    });
  };

  const draw = () => {
    app.innerHTML = `
      <div class="profile-wrap">
        <h1>${isNew ? "Set up your profile" : "My profile"}</h1>
        <p class="muted">${isNew ? "Tell us a bit about yourself so employers and jobseekers can reach each other easily." : `Signed in as ${esc(user.email || user.displayName || "")}`}</p>
        <div class="role-pick" role="radiogroup" aria-label="Profile type">
          <button type="button" class="role ${role === "jobseeker" ? "on" : ""}" data-role="jobseeker" role="radio" aria-checked="${role === "jobseeker"}">
            <strong>I'm looking for work</strong><span>Apply to jobs with one profile</span></button>
          <button type="button" class="role ${role === "employer" ? "on" : ""}" data-role="employer" role="radio" aria-checked="${role === "employer"}">
            <strong>I'm hiring</strong><span>Post jobs and review applicants</span></button>
        </div>
        ${role ? formHtml() : `<p class="muted center">Choose one to continue.</p>`}
      </div>`;
    app.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => { collect(); role = b.dataset.role; draw(); }));
    if (role) bindForm();
  };
  draw();
}

/* ---------------- Post a job ---------------- */
function viewPost() {
  document.title = "Post a job | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) {
    app.innerHTML = `<div class="empty"><h1>Post a job for free</h1><p class="muted">Create a free employer account to post jobs and review applicants in one place.</p><p><a class="btn btn-primary" href="#/signin" data-action="gosignin" data-purpose="Sign in to post a job">Sign in to post a job</a></p></div>`;
    return;
  }
  if (!profile) { returnTo = "#/post"; location.hash = "#/profile"; return; }
  if (profile.role !== "employer") {
    returnTo = "#/post";
    app.innerHTML = `<div class="empty"><h1>Hiring?</h1><p class="muted">Your profile is set to "I'm looking for work". Switch it to "I'm hiring" to post jobs.</p><p><a class="btn btn-primary" href="#/profile">Change profile type</a></p></div>`;
    return;
  }
  const defMethod = profile.messenger ? "messenger" : "phone";
  const defValue = profile.messenger || profile.phone || "";
  app.innerHTML = `
    <h1>Post a job</h1>
    <p class="muted">Posts are reviewed before going live, usually within a day. Live posts stay up for 30 days.</p>
    <form id="post-form" class="form" novalidate>
      <fieldset>
        <legend>The job</legend>
        <label>Job title *<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Live-in Kasambahay"></label>
        <div class="row">
          <label>Category *<select name="category" required><option value="">Choose…</option>${opts(CATEGORIES)}</select></label>
          <label>Job type *<select name="employmentType" required><option value="">Choose…</option>${opts(TYPES)}</select></label>
        </div>
        <div class="row">
          <label>Location *<select name="city" required><option value="">Choose…</option>${opts(CITIES.filter((c) => c !== "Other"), profile.city)}</select></label>
          <label>Employer / household name *<input name="employerName" required maxlength="80" placeholder="e.g. Reyes Family, Mandalagan" value="${esc(profile.companyName || "")}"></label>
        </div>
      </fieldset>
      <fieldset>
        <legend>Pay</legend>
        <div class="row row-3">
          <label>From (₱)<input name="salaryMin" type="number" min="0" step="1" inputmode="numeric"></label>
          <label>To (₱)<input name="salaryMax" type="number" min="0" step="1" inputmode="numeric"></label>
          <label>Per<select name="salaryPeriod"><option value="month">Month</option><option value="day">Day</option><option value="hour">Hour</option></select></label>
        </div>
        <p class="hint">Leave blank for "negotiable". Pay must meet the legal minimum for your area.</p>
      </fieldset>
      <fieldset>
        <legend>Details</legend>
        <label>Description *<textarea name="description" required minlength="30" maxlength="4000" rows="6" placeholder="Duties, schedule, days off, what's provided (room, meals)…"></textarea></label>
        <label>Requirements (one per line)<textarea name="requirements" maxlength="2000" rows="4" placeholder="At least 18 years old&#10;With experience"></textarea></label>
      </fieldset>
      <fieldset>
        <legend>Your contact for applicants</legend>
        <div class="row">
          <label>Method *<select name="contactMethod" required><option value="messenger" ${defMethod === "messenger" ? "selected" : ""}>Messenger</option><option value="phone" ${defMethod === "phone" ? "selected" : ""}>Phone / SMS</option><option value="email">Email</option></select></label>
          <label>Contact *<input name="contactValue" required maxlength="200" value="${esc(defValue)}"></label>
        </div>
        <p class="hint">Only people who apply can see this. You'll also get each applicant's phone number.</p>
      </fieldset>
      <label class="check"><input type="checkbox" name="agree" required>
        <span>I confirm this is a real job, I will not charge applicants any fee, and all workers will be at least 18 years old. I agree to the <a href="#/terms" target="_blank">Terms</a>.</span></label>
      <p id="form-error" class="error" hidden></p>
      <button class="btn btn-primary" type="submit">Submit for review</button>
    </form>`;

  const f = $("#post-form");
  const ph = { messenger: "Messenger username or m.me link", phone: "e.g. 0917 123 4567", email: "you@example.com" };
  f.contactValue.placeholder = ph[f.contactMethod.value];
  f.contactMethod.addEventListener("change", () => {
    f.contactValue.placeholder = ph[f.contactMethod.value];
    f.contactValue.value = f.contactMethod.value === "phone" ? profile.phone : f.contactMethod.value === "messenger" ? (profile.messenger || "") : (user.email || "");
  });
  const counter = document.createElement("p"); counter.className = "hint"; f.description.after(counter);
  const count = () => { const n = f.description.value.trim().length; counter.textContent = n < 30 ? `${n}/30 characters minimum` : `${n} characters`; };
  f.description.addEventListener("input", count); count();
  f.addEventListener("input", (e) => e.target.classList?.remove("invalid"));

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#form-error");
    const fail = (m) => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: "center", behavior: "smooth" }); };
    err.hidden = true;
    if (!f.checkValidity()) {
      const bad = f.querySelector("input:invalid, select:invalid, textarea:invalid");
      const msgs = {
        title: "Add a job title (at least 3 characters).", category: "Choose a category.", employmentType: "Choose a job type.",
        city: "Choose a location.", employerName: "Add the employer or household name.",
        description: "Write a description of at least 30 characters: duties, schedule, days off.",
        contactValue: "Add how applicants can contact you.", agree: "Tick the confirmation box at the bottom.",
        salaryMin: "Enter a valid amount.", salaryMax: "Enter a valid amount.",
      };
      if (bad) { bad.classList.add("invalid"); setTimeout(() => bad.focus({ preventScroll: true }), 300); }
      return fail(msgs[bad?.name] || "Please complete the highlighted field.");
    }
    const data = {};
    JOB_FIELDS.forEach((k) => (data[k] = (f[k]?.value ?? "").trim()));
    data.salaryMin = data.salaryMin ? Number(data.salaryMin) : null;
    data.salaryMax = data.salaryMax ? Number(data.salaryMax) : null;
    if (data.salaryMin && data.salaryMax && data.salaryMax < data.salaryMin) return fail("The 'To' amount should be higher than 'From'.");
    const contact = { contactMethod: f.contactMethod.value, contactValue: f.contactValue.value.trim() };
    if (!contactLink(contact)) return fail("That contact doesn't look right. Check the username, number or email.");
    if (contact.contactMethod === "phone" && digits(contact.contactValue).length < 10) return fail("Please enter a complete phone number.");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Submitting…";
    try {
      await store.createJob(data, contact);
      jobsCache = null;
      app.innerHTML = `<div class="empty"><h1>Thanks! Your post is under review.</h1><p class="muted">We'll check it soon. Applicants will appear under My posts once it's live.</p><p><a class="btn btn-primary" href="#/my">Go to My posts</a> <a class="btn btn-ghost" href="#/post" id="again">Post another</a></p></div>`;
      $("#again").addEventListener("click", (ev) => { ev.preventDefault(); viewPost(); });
    } catch (ex) {
      console.error(ex); btn.disabled = false; btn.textContent = "Submit for review";
      fail(`Could not submit (${ex.code || ex.message || "unknown error"}). Please try again.`);
    }
  });
}

/* ---------------- Employer: my posts + applicants ---------------- */
async function viewMy() {
  document.title = "My posts | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to manage your posts");
  if (!profile) { location.hash = "#/profile"; return; }
  app.innerHTML = `<div class="page-head"><h1>My posts</h1><a class="btn btn-primary" href="#/post">Post a job</a></div><div id="mine"><p class="muted">Loading…</p></div>`;
  const draw = async () => {
    const [list, apps] = await Promise.all([store.myJobs(), store.applicationsForEmployer().catch(() => [])]);
    if (!$("#mine")) return;
    list.sort((a, b) => b.createdAt - a.createdAt);
    const by = {}; apps.forEach((a) => { (by[a.jobId] ||= []).push(a); });
    $("#mine").innerHTML = list.length ? `<div class="table">${list.map((j) => {
      const a = by[j.id] || []; const fresh = a.filter((x) => x.status === "new").length;
      return `
      <div class="trow">
        <div><a href="#/job/${encodeURIComponent(j.id)}"><strong>${esc(j.title)}</strong></a> ${statusBadge(j)}
          <div class="muted small">${esc(j.city)} · posted ${ago(j.createdAt)}${j.expiresAt ? ` · ${isLive(j) ? "expires" : "expired"} ${new Date(j.expiresAt).toLocaleDateString("en-PH")}` : ""}</div></div>
        <div><a class="btn btn-ghost btn-sm" href="#/applicants/${encodeURIComponent(j.id)}">${a.length} applicant${a.length === 1 ? "" : "s"}${fresh ? ` <span class="dot">${fresh} new</span>` : ""}</a></div>
        <div class="actions">${j.status === "approved" || j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-close="${esc(j.id)}">Mark filled / close</button>` : ""}</div>
      </div>`; }).join("")}</div>` : `<div class="empty"><p>You haven't posted any jobs yet.</p></div>`;
  };
  $("#mine").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-close]"); if (!b) return;
    if (!confirmInline(b, "Click again to close")) return;
    try { await store.updateJob(b.dataset.close, { status: "closed" }); jobsCache = null; toast("Post closed"); draw(); } catch { toast("Could not close post"); }
  });
  draw().catch((e) => { console.error(e); $("#mine").innerHTML = `<p class="error">Could not load your posts (${esc(e.code || e.message)}).</p>`; });
}

function applicantCard(a) {
  const x = a.applicant || {};
  const m = messengerUrl(x.messenger);
  const resume = [safeUrl(x.resumeUrl) && `<a href="${esc(safeUrl(x.resumeUrl))}" target="_blank" rel="noopener nofollow">Resume link</a>`,
    safeUrl(x.resumeFileUrl) && `<a href="${esc(safeUrl(x.resumeFileUrl))}" target="_blank" rel="noopener">${esc(x.resumeFileName || "Resume file")}</a>`].filter(Boolean).join(" · ");
  return `
  <article class="applicant ${a.status === "new" ? "is-new" : ""}">
    <header>
      <div><h3>${esc(x.fullName)}${x.age ? `, ${x.age}` : ""}</h3>
        <p class="muted small">${esc(x.city || "")}${x.experienceYears != null ? ` · ${x.experienceYears} yr${x.experienceYears === 1 ? "" : "s"} experience` : ""}${x.availability ? ` · ${esc(x.availability)}` : ""} · applied ${ago(a.createdAt)}</p></div>
      ${appBadge(a.status, true)}
    </header>
    ${a.message ? `<blockquote>${nl2br(a.message)}</blockquote>` : ""}
    <div class="contact-row">
      <a class="btn btn-primary btn-sm" href="tel:${esc(digits(x.phone))}">Call ${esc(x.phone)}</a>
      <a class="btn btn-ghost btn-sm" href="sms:${esc(digits(x.phone))}">Text</a>
      ${m ? `<a class="btn btn-ghost btn-sm" href="${esc(m)}" target="_blank" rel="noopener nofollow">Messenger</a>` : ""}
      ${x.email ? `<a class="btn btn-ghost btn-sm" href="mailto:${esc(x.email)}">Email</a>` : ""}
    </div>
    ${(x.jobCategories || []).length ? `<ul class="meta">${x.jobCategories.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>` : ""}
    <details><summary>Experience &amp; resume</summary>
      ${x.skills ? `<p class="small"><strong>Skills:</strong> ${esc(x.skills)}</p>` : ""}
      ${x.workHistory ? `<p class="small"><strong>Work history:</strong><br>${nl2br(x.workHistory)}</p>` : ""}
      ${x.education ? `<p class="small"><strong>Education:</strong> ${esc(x.education)}</p>` : ""}
      ${resume ? `<p class="small"><strong>Resume:</strong> ${resume}</p>` : ""}
      ${!x.skills && !x.workHistory && !x.education && !resume ? `<p class="small muted">No details added.</p>` : ""}
      <p class="small muted copyable">Phone: ${esc(x.phone)}${x.email ? ` · ${esc(x.email)}` : ""}</p>
    </details>
    <div class="actions">
      ${a.status !== "shortlisted" ? `<button class="btn btn-ghost btn-sm" data-st="shortlisted" data-id="${esc(a.id)}">Shortlist</button>` : ""}
      ${a.status !== "hired" ? `<button class="btn btn-ghost btn-sm" data-st="hired" data-id="${esc(a.id)}">Mark hired</button>` : ""}
      ${a.status !== "not_selected" ? `<button class="btn btn-ghost btn-sm" data-st="not_selected" data-id="${esc(a.id)}">Not a fit</button>` : ""}
    </div>
  </article>`;
}

async function viewApplicants(jobId) {
  document.title = "Applicants | Job Search PH";
  const { user } = getAuthState();
  if (!user) return goSignIn("Sign in to see applicants");
  app.innerHTML = `<p class="muted">Loading…</p>`;
  const job = await store.getJob(jobId);
  if (!job || job.ownerUid !== user.uid) { app.innerHTML = `<div class="empty"><h1>Not found</h1><p class="muted">This post isn't yours or no longer exists.</p></div>`; return; }
  let tab = "all";
  const draw = async () => {
    const apps = (await store.applicationsForJob(jobId)).sort((a, b) => b.createdAt - a.createdAt);
    const counts = { all: apps.length, new: 0, shortlisted: 0, hired: 0, not_selected: 0 };
    apps.forEach((a) => counts[a.status]++);
    const shown = tab === "all" ? apps : apps.filter((a) => a.status === tab);
    app.innerHTML = `
      <p><a href="#/my" class="back">← My posts</a></p>
      <div class="page-head"><div><h1>Applicants</h1><p class="muted">${esc(job.title)} · ${esc(job.city)} ${statusBadge(job)}</p></div></div>
      <div class="tabs" role="tablist">${[["all", "All"], ["new", "New"], ["shortlisted", "Shortlisted"], ["hired", "Hired"], ["not_selected", "Not a fit"]]
        .map(([k, v]) => `<button class="tab ${tab === k ? "active" : ""}" data-tab="${k}">${v} <span class="count">${counts[k]}</span></button>`).join("")}</div>
      <div class="applicants">${shown.length ? shown.map(applicantCard).join("") : `<div class="empty"><p>${apps.length ? "No applicants in this group." : "No applicants yet. Share your post to get more."}</p></div>`}</div>`;
    app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { tab = b.dataset.tab; draw(); }));
    app.querySelectorAll("[data-st]").forEach((b) => b.addEventListener("click", async () => {
      try { await store.setApplicationStatus(b.dataset.id, b.dataset.st); toast("Updated"); draw(); } catch { toast("Could not update"); }
    }));
  };
  draw().catch((e) => { console.error(e); app.innerHTML = `<p class="error">Could not load applicants (${esc(e.code || e.message)}).</p>`; });
}

/* ---------------- Jobseeker: my applications ---------------- */
async function viewApplications() {
  document.title = "My applications | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) return goSignIn("Sign in to see your applications");
  if (!profile) { location.hash = "#/profile"; return; }
  app.innerHTML = `<div class="page-head"><h1>My applications</h1><a class="btn btn-ghost" href="#/">Find more jobs</a></div><div id="apps"><p class="muted">Loading…</p></div>`;
  myAppsCache = null;
  const apps = (await getMyApps()).sort((a, b) => b.createdAt - a.createdAt);
  if (!$("#apps")) return;
  $("#apps").innerHTML = apps.length ? `<div class="table">${apps.map((a) => `
    <div class="trow">
      <div><a href="#/job/${encodeURIComponent(a.jobId)}"><strong>${esc(a.jobTitle)}</strong></a><div class="muted small">${esc(a.jobCity || "")} · applied ${ago(a.createdAt)}</div></div>
      <div>${appBadge(a.status)}</div>
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/job/${encodeURIComponent(a.jobId)}">View &amp; contact</a></div>
    </div>`).join("")}</div>`
    : `<div class="empty"><p><strong>No applications yet.</strong></p><p class="muted">Find a job you like and tap Apply.</p><p><a class="btn btn-primary" href="#/">Browse jobs</a></p></div>`;
}

/* ---------------- Admin ---------------- */
let adminTab = "pending";
async function viewAdmin() {
  document.title = "Admin | Job Search PH";
  const { user, isAdmin } = getAuthState();
  if (!user) return goSignIn("Admin sign in");
  if (!isAdmin) { app.innerHTML = `<div class="empty"><h1>Not authorized</h1><p class="muted">This account is not an admin.</p></div>`; return; }
  const tabs = { pending: "Pending", approved: "Live", reports: "Reports", rejected: "Rejected", closed: "Closed" };
  app.innerHTML = `
    <div class="page-head"><h1>Admin</h1></div>
    <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" class="tab ${adminTab === k ? "active" : ""}" data-tab="${k}">${v}</button>`).join("")}</div>
    <div id="admin-body"><p class="muted">Loading…</p></div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { adminTab = b.dataset.tab; viewAdmin(); }));

  const body = $("#admin-body");
  if (adminTab === "reports") {
    const reports = await store.listReports();
    const jobs = {};
    await Promise.all([...new Set(reports.map((r) => r.jobId))].map(async (id) => { jobs[id] = await store.getJob(id); }));
    body.innerHTML = reports.length ? `<div class="table">${reports.map((r) => {
      const j = jobs[r.jobId];
      const title = j ? `<a href="#/job/${encodeURIComponent(r.jobId)}"><strong>${esc(j.title)}</strong></a> ${statusBadge(j)}` : `<strong class="muted">Job deleted</strong>`;
      return `
      <div class="trow">
        <div>${title}<div class="small">${esc(REPORT_REASONS[r.reason] || r.reason)}</div>${r.details ? `<div class="muted small">“${esc(r.details)}”</div>` : ""}<div class="muted small">${ago(r.createdAt)}</div></div>
        <div class="actions">${j && j.status !== "closed" ? `<button class="btn btn-danger btn-sm" data-act="closejob" data-id="${esc(r.jobId)}">Close job</button>` : ""}<button class="btn btn-ghost btn-sm" data-act="dismiss" data-id="${esc(r.id)}">Dismiss</button></div>
      </div>`; }).join("")}</div>` : `<div class="empty"><p>No reports.</p></div>`;
  } else {
    const list = (await store.listByStatus(adminTab)).sort((a, b) => b.createdAt - a.createdAt);
    body.innerHTML = list.length ? list.map((j) => `
      <div class="admin-item">
        <div><strong>${esc(j.title)}</strong> ${statusBadge(j)} ${j.featured ? `<span class="badge badge-featured">Featured</span>` : ""}
          <div class="muted small">${esc(j.employerName)} · ${esc(j.city)} · ${esc(j.category)} · ${esc(j.employmentType)} · ${salaryText(j)} · submitted ${ago(j.createdAt)}</div></div>
        <details data-contact="${esc(j.id)}"><summary>View details</summary>
          <p>${nl2br(j.description)}</p>${j.requirements ? `<p class="small"><strong>Requirements:</strong><br>${nl2br(j.requirements)}</p>` : ""}
          <p class="small contact-line"><strong>Contact:</strong> <span>loading…</span> · <strong>Owner UID:</strong> ${esc(j.ownerUid)}</p>
        </details>
        <div class="actions">
          ${j.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(j.id)}">${j.status === "pending" ? "Approve" : "Re-publish"}</button>` : `<button class="btn btn-ghost btn-sm" data-act="approve" data-id="${esc(j.id)}">Renew 30 days</button>`}
          ${j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(j.id)}">Reject</button>` : ""}
          ${j.status === "approved" ? `<button class="btn btn-ghost btn-sm" data-act="feature" data-id="${esc(j.id)}" data-on="${j.featured ? 1 : 0}">${j.featured ? "Unfeature" : "Feature"}</button><button class="btn btn-ghost btn-sm" data-act="closejob" data-id="${esc(j.id)}">Close</button>` : ""}
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${esc(j.id)}">Delete</button>
        </div>
      </div>`).join("") : `<div class="empty"><p>Nothing here.</p></div>`;
    body.querySelectorAll("details[data-contact]").forEach((d) => d.addEventListener("toggle", async () => {
      if (!d.open || d.dataset.loaded) return; d.dataset.loaded = 1;
      const c = await store.getContact(d.dataset.contact);
      d.querySelector(".contact-line span").textContent = c ? `${c.contactMethod} — ${c.contactValue}` : "not set";
    }));
  }

  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const { act, id } = b.dataset;
    if ((act === "delete" || act === "closejob") && !confirmInline(b)) return;
    try {
      if (act === "approve") await store.approve(id);
      if (act === "reject") await store.updateJob(id, { status: "rejected" });
      if (act === "closejob") { await store.updateJob(id, { status: "closed" }); await store.clearReportsFor(id); }
      if (act === "feature") await store.updateJob(id, { featured: b.dataset.on !== "1" });
      if (act === "delete") { await store.deleteJob(id); await store.clearReportsFor(id); }
      if (act === "dismiss") await store.dismissReport(id);
      jobsCache = null; toast("Done"); viewAdmin();
    } catch (err) { console.error(err); toast("Action failed: " + (err.code || err.message)); }
  });
}

/* ---------------- Static pages ---------------- */
function viewStatic(page) {
  const pages = {
    safety: { title: "Safety tips for jobseekers", body: `
      <ul class="tips">
        <li><strong>Never pay to apply.</strong> No legitimate employer asks for a processing, training, medical or "reservation" fee. Under the Kasambahay Law, household workers cannot be charged placement fees.</li>
        <li><strong>Don't send your ID, bank or GCash details</strong> before an interview, and never send money.</li>
        <li><strong>Meet in a public place</strong> or bring someone you trust to the first interview. Tell family where you're going.</li>
        <li><strong>Get the agreement in writing.</strong> Household workers are entitled to a written employment contract, minimum wage, days off and SSS, PhilHealth and Pag-IBIG once covered.</li>
        <li><strong>Overseas offers:</strong> only deal with agencies licensed by the DMW. Check the license on the DMW website before giving any documents.</li>
        <li><strong>Something feels wrong?</strong> Use the "Report this post" button on the job, and contact DOLE or the PNP if you are in danger.</li>
      </ul>` },
    terms: { title: "Terms of use", body: `
      <p class="notice">Draft. Have a lawyer review before launch.</p>
      <p>Job Search PH is an online job listing board. Employers publish job posts and jobseekers apply with their own profiles. We do not recruit, screen, refer, match or place workers, and we are not a party to any employment agreement.</p>
      <h2>Accounts</h2>
      <ul><li>You must be at least 18 years old and give true information in your profile.</li><li>Keep your password safe. You are responsible for activity on your account.</li></ul>
      <h2>Employers agree to</h2>
      <ul>
        <li>Post only real, currently open jobs that they will hire for directly.</li>
        <li>Never charge applicants any fee, deposit or deduction to apply or be hired.</li>
        <li>Hire only workers aged 18 and above, and follow Philippine labor laws, including the Kasambahay Law (RA 10361) and minimum wage rules.</li>
        <li>Use applicants' personal details only to consider them for the job they applied to, and not share them with anyone else.</li>
        <li>Not post jobs for recruitment agencies or overseas placement unless the agency is licensed by DOLE or DMW and the license number is included.</li>
      </ul>
      <h2>Our rights</h2>
      <p>We may review, reject, edit, close or remove any post, and suspend any account, at our discretion. Posts expire after 30 days.</p>
      <h2>No guarantee</h2>
      <p>We do not verify every employer or applicant. Jobseekers and employers deal with each other at their own risk and should follow our safety tips.</p>` },
    privacy: { title: "Privacy notice", body: `
      <p class="notice">Draft. Review for Data Privacy Act (RA 10173) compliance before launch.</p>
      <p><strong>What we collect:</strong> your sign-in email, and the profile you fill in. For jobseekers this is your name, birthdate, mobile number, city, Messenger, the jobs you want, experience, skills, work history, education and resume. For employers it is your name, household or business name, mobile number, city and job posts.</p>
      <p><strong>Who sees it:</strong> a jobseeker's profile is shared only with employers whose jobs they apply to. Employers see your age, not your birthdate. An employer's contact details are shown only to people who apply. Job posts themselves are public. Job Search PH admins can see all data to keep the site safe.</p>
      <p><strong>How we use it:</strong> to run accounts, show your applications and posts, and prevent abuse. We do not sell personal data.</p>
      <p><strong>Your rights:</strong> you can edit your profile at any time, withdraw applications, and delete your profile from the My profile page. To delete your whole account, message Job Search PH.</p>` },
  };
  const p = pages[page];
  document.title = `${p.title} | Job Search PH`;
  app.innerHTML = `<article class="prose"><h1>${p.title}</h1>${p.body}</article>`;
}

/* ---------------- Router ---------------- */
let lastUid;
async function route() {
  renderNav();
  $("#nav").classList.remove("open"); $("#nav-toggle").setAttribute("aria-expanded", "false");
  const [, page, arg] = (location.hash || "#/").split("/");
  window.scrollTo(0, 0);
  const { user, profile } = getAuthState();
  // New accounts finish their profile first; browsing jobs and reading info pages still work.
  if (user && !profile && !["", "job", "profile", "signin", "safety", "terms", "privacy"].includes(page || "")) {
    if (!returnTo) returnTo = location.hash;
    location.hash = "#/profile"; return;
  }
  if (!page) return viewList();
  if (page === "job" && arg) return viewJob(decodeURIComponent(arg));
  if (page === "signin") return viewSignIn();
  if (page === "profile") return viewProfile();
  if (page === "post") return viewPost();
  if (page === "my") return viewMy();
  if (page === "applicants" && arg) return viewApplicants(decodeURIComponent(arg));
  if (page === "applications") return viewApplications();
  if (page === "admin") return viewAdmin();
  if (["safety", "terms", "privacy"].includes(page)) return viewStatic(page);
  location.hash = "#/";
}

window.addEventListener("hashchange", route);
onAuth((s) => {
  const uidNow = s.user?.uid || null;
  const changed = uidNow !== lastUid; lastUid = uidNow;
  if (changed) myAppsCache = null;
  if (changed && uidNow && location.hash === "#/signin") return finishAuthFlow();
  route();
});
store.init().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="error">Could not start the site. Please refresh.</p>`;
});
