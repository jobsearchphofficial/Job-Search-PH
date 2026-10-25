import { store, onAuth, getAuthState, isDemo, JOB_FIELDS } from "./store.js";

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
  "Manapla", "Iloilo City", "Roxas City", "Dumaguete City",
];
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

/* ---------------- Helpers ---------------- */
const $ = (s, el = document) => el.querySelector(s);
const app = $("#app");
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const peso = (n) => "₱" + Number(n).toLocaleString("en-PH");
const nl2br = (s) => esc(s).replace(/\n/g, "<br>");

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

function contactLink(j) {
  const v = String(j.contactValue || "").trim();
  if (j.contactMethod === "phone") {
    const digits = v.replace(/[^\d+]/g, "");
    return { href: `tel:${digits}`, label: `Call or text ${v}`, extra: `sms:${digits}` };
  }
  if (j.contactMethod === "email") {
    if (!/^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/.test(v)) return null;
    return { href: `mailto:${v}?subject=${encodeURIComponent("Application: " + j.title)}`, label: `Email ${v}` };
  }
  // Messenger: accept a username or an m.me / facebook.com link only
  let user = v;
  try {
    if (/^https?:\/\//i.test(v)) {
      const u = new URL(v);
      if (!/(^|\.)(m\.me|facebook\.com|messenger\.com)$/i.test(u.hostname)) return null;
      user = u.pathname.replace(/^\/+|\/+$/g, "").replace(/^t\//, "");
    }
  } catch { return null; }
  user = user.replace(/[^A-Za-z0-9.\-_]/g, "");
  if (!user) return null;
  return { href: `https://m.me/${user}`, label: "Message on Messenger" };
}

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
}
const statusBadge = (j) => {
  const s = j.status === "approved" && !isLive(j) ? "expired" : j.status;
  const label = s === "expired" ? "Expired" : STATUS_LABEL[s];
  return `<span class="badge badge-${s}">${label}</span>`;
};

/* ---------------- Nav ---------------- */
function renderNav() {
  const { user, isAdmin } = getAuthState();
  const here = location.hash || "#/";
  const link = (href, label) => `<a href="${href}" class="${here === href || (href !== "#/" && here.startsWith(href)) ? "active" : ""}">${label}</a>`;
  $("#nav").innerHTML = [
    link("#/", "Find jobs"),
    link("#/post", "Post a job"),
    user ? link("#/my", "My posts") : "",
    isAdmin ? link("#/admin", "Admin") : "",
    user
      ? `<button class="btn btn-ghost btn-sm" data-action="signout">Sign out</button>`
      : `<button class="btn btn-ghost btn-sm" data-action="signin">Employer sign in</button>`,
  ].join("");
}
$("#nav-toggle").addEventListener("click", () => {
  const nav = $("#nav"); const open = nav.classList.toggle("open");
  $("#nav-toggle").setAttribute("aria-expanded", open);
});

document.addEventListener("click", async (e) => {
  const a = e.target.closest("[data-action]");
  if (!a) return;
  const act = a.dataset.action;
  if (act === "signin") { try { await store.signIn(); toast("Signed in"); } catch (err) { toast("Sign-in failed: " + (err.code || err.message)); } }
  if (act === "signout") { await store.signOut(); toast("Signed out"); location.hash = "#/"; }
});

/* ---------------- Views ---------------- */
let jobsCache = null;
const filters = { q: "", category: "", city: "", type: "" };

async function viewList() {
  document.title = "Job Search PH — Jobs in Negros & Western Visayas";
  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">Free for jobseekers · No fees, ever</span>
      <h1>Find work near you in <em>Negros &amp; Western Visayas</em></h1>
      <p>Household, service and local jobs posted by employers in Bacolod and nearby cities. Apply directly by Messenger, call or email.</p>
      <form class="search" id="search" role="search">
        <input type="search" name="q" placeholder="Search jobs, e.g. yaya, driver, cook" value="${esc(filters.q)}" aria-label="Search jobs">
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
      <div class="hero-stats"><span><strong id="stat-jobs">–</strong> open jobs</span><span><strong id="stat-cities">–</strong> cities</span><span>New posts reviewed daily</span></div>
    </section>
    <section class="filters" aria-label="Filters">
      <select name="category" aria-label="Category"><option value="">All categories</option>${CATEGORIES.map((c) => `<option ${filters.category === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select name="city" aria-label="City"><option value="">All locations</option>${CITIES.map((c) => `<option ${filters.city === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
      <select name="type" aria-label="Job type"><option value="">Any type</option>${TYPES.map((c) => `<option ${filters.type === c ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>
    </section>
    <div class="list-head"><span id="count" class="muted"></span></div>
    <section id="results" class="cards"><p class="muted">Loading jobs…</p></section>
    <aside class="notice">
      <strong>Stay safe:</strong> legitimate employers never ask you to pay to apply, train or get hired.
      <a href="#/safety">Read safety tips</a>
    </aside>`;

  const draw = () => {
    const q = filters.q.trim().toLowerCase();
    const list = (jobsCache || []).filter(isLive)
      .filter((j) => !filters.category || j.category === filters.category)
      .filter((j) => !filters.city || j.city === filters.city)
      .filter((j) => !filters.type || j.employmentType === filters.type)
      .filter((j) => !q || [j.title, j.category, j.employerName, j.city, j.description].join(" ").toLowerCase().includes(q))
      .sort((a, b) => (b.featured - a.featured) || (b.approvedAt || b.createdAt) - (a.approvedAt || a.createdAt));
    $("#count").textContent = `${list.length} job${list.length === 1 ? "" : "s"} found`;
    $("#results").innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty"><p><strong>No jobs match yet.</strong></p><p class="muted">Try another category or location, or check back soon.</p></div>`;
  };

  $("#search").addEventListener("submit", (e) => { e.preventDefault(); filters.q = e.target.q.value; draw(); });
  $("#search").q.addEventListener("input", (e) => { filters.q = e.target.value; draw(); });
  app.querySelectorAll(".filters select").forEach((s) => s.addEventListener("change", () => { filters[s.name] = s.value; draw(); }));

  try {
    jobsCache = await store.listPublic(); draw();
    const live = jobsCache.filter(isLive);
    $("#stat-jobs").textContent = live.length;
    $("#stat-cities").textContent = new Set(live.map((j) => j.city)).size;
  }
  catch (err) { console.error(err); $("#results").innerHTML = `<p class="error">Could not load jobs. Please refresh.</p>`; }
}

function card(j) {
  return `
  <a class="card ${j.featured ? "card-featured" : ""}" href="#/job/${encodeURIComponent(j.id)}">
    ${j.featured ? `<span class="badge badge-featured">Featured</span>` : ""}
    <h3>${esc(j.title)}</h3>
    <p class="employer">${esc(j.employerName)}</p>
    <ul class="meta">
      <li>${esc(j.city)}</li><li>${esc(j.employmentType)}</li><li>${esc(j.category)}</li>
    </ul>
    <div class="card-foot"><span class="salary">${salaryText(j)}</span><span class="muted">${ago(j.approvedAt || j.createdAt)}</span></div>
  </a>`;
}

async function viewJob(id) {
  app.innerHTML = `<p class="muted">Loading…</p>`;
  const j = await store.getJob(id);
  const { user, isAdmin } = getAuthState();
  const canSeeHidden = j && (isAdmin || (user && j.ownerUid === user.uid));
  if (!j || (!isLive(j) && !canSeeHidden)) {
    app.innerHTML = `<div class="empty"><h2>This job is no longer available</h2><p class="muted">It may have been filled or removed.</p><p><a class="btn btn-primary" href="#/">Browse other jobs</a></p></div>`;
    return;
  }
  document.title = `${j.title} — ${j.city} | Job Search PH`;
  const c = contactLink(j);
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
        <div class="panel">
          <h2>Apply directly</h2>
          <p class="muted">Contact the employer yourself. Job Search PH is not involved in hiring.</p>
          ${c ? `<a class="btn btn-primary btn-block" href="${esc(c.href)}" target="_blank" rel="noopener nofollow">${esc(c.label)}</a>
                 ${c.extra ? `<a class="btn btn-ghost btn-block" href="${esc(c.extra)}">Send a text</a>` : ""}`
              : `<p class="error">Contact details are invalid. Please report this post.</p>`}
          <button class="btn btn-ghost btn-block" id="share">Share this job</button>
        </div>
        <div class="panel panel-warn">
          <strong>Never pay to get a job.</strong>
          <p>If the employer asks for a fee, deposit or your ID before an interview, stop and report the post.</p>
        </div>
        <details class="panel report">
          <summary>Report this post</summary>
          <form id="report-form">
            <label>Reason<select name="reason" required>${Object.entries(REPORT_REASONS).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select></label>
            <label>Details (optional)<textarea name="details" maxlength="500" rows="3"></textarea></label>
            <button class="btn btn-danger btn-sm" type="submit">Send report</button>
          </form>
        </details>
      </aside>
    </article>`;

  $("#share").addEventListener("click", async () => {
    const url = location.href;
    try {
      if (navigator.share) await navigator.share({ title: j.title, text: `${j.title} — ${j.city}`, url });
      else { await navigator.clipboard.writeText(url); toast("Link copied"); }
    } catch {}
  });
  $("#report-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    try { await store.report(j.id, f.reason.value, f.details.value.trim().slice(0, 500)); f.closest("details").innerHTML = `<p>Thanks — we'll review this post.</p>`; }
    catch { toast("Could not send report. Try again."); }
  });
}

function requireSignIn(purpose) {
  app.innerHTML = `
    <div class="empty">
      <h1>${esc(purpose)}</h1>
      <p class="muted">Sign in with Google so you can manage your posts later. Posting is free.</p>
      <p><button class="btn btn-primary" data-action="signin">Sign in with Google</button></p>
    </div>`;
}

function viewPost() {
  document.title = "Post a job | Job Search PH";
  const { user } = getAuthState();
  if (!user) return requireSignIn("Post a job for free");
  app.innerHTML = `
    <h1>Post a job</h1>
    <p class="muted">Posts are reviewed before going live, usually within a day. Live posts stay up for 30 days.</p>
    <form id="post-form" class="form" novalidate>
      <fieldset>
        <legend>The job</legend>
        <label>Job title *<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Live-in Kasambahay"></label>
        <div class="row">
          <label>Category *<select name="category" required><option value="">Choose…</option>${CATEGORIES.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
          <label>Job type *<select name="employmentType" required><option value="">Choose…</option>${TYPES.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
        </div>
        <div class="row">
          <label>Location *<select name="city" required><option value="">Choose…</option>${CITIES.map((c) => `<option>${esc(c)}</option>`).join("")}</select></label>
          <label>Employer / household name *<input name="employerName" required maxlength="80" placeholder="e.g. Reyes Family, Mandalagan"></label>
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
        <legend>How should applicants contact you?</legend>
        <div class="row">
          <label>Method *<select name="contactMethod" required><option value="messenger">Messenger</option><option value="phone">Phone / SMS</option><option value="email">Email</option></select></label>
          <label>Contact *<input name="contactValue" required maxlength="200" placeholder="Messenger username or m.me link"></label>
        </div>
        <p class="hint">This will be shown publicly on your post.</p>
      </fieldset>
      <label class="check"><input type="checkbox" name="agree" required>
        <span>I confirm this is a real job, I will not charge applicants any fee, and all workers will be at least 18 years old. I agree to the <a href="#/terms" target="_blank">Terms</a>.</span></label>
      <p id="form-error" class="error" hidden></p>
      <button class="btn btn-primary" type="submit">Submit for review</button>
    </form>`;

  const f = $("#post-form");
  const ph = { messenger: "Messenger username or m.me link", phone: "e.g. 0917 123 4567", email: "you@example.com" };
  const counter = document.createElement("p"); counter.className = "hint";
  f.description.after(counter);
  const count = () => { const n = f.description.value.trim().length; counter.textContent = n < 30 ? `${n}/30 characters minimum` : `${n} characters`; };
  f.description.addEventListener("input", count); count();
  f.addEventListener("input", (e) => e.target.classList?.remove("invalid"));
  f.contactMethod.addEventListener("change", () => (f.contactValue.placeholder = ph[f.contactMethod.value]));

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#form-error");
    const fail = (m) => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: "center", behavior: "smooth" }); };
    err.hidden = true;
    if (!f.checkValidity()) {
      const bad = f.querySelector("input:invalid, select:invalid, textarea:invalid");
      const msgs = {
        title: "Add a job title (at least 3 characters).",
        category: "Choose a category.",
        employmentType: "Choose a job type.",
        city: "Choose a location.",
        employerName: "Add the employer or household name.",
        description: "Write a description of at least 30 characters: duties, schedule, days off.",
        contactValue: "Add how applicants can contact you.",
        agree: "Tick the confirmation box at the bottom.",
        salaryMin: "Enter a valid amount.", salaryMax: "Enter a valid amount.",
      };
      f.querySelectorAll(".invalid").forEach((el) => el.classList.remove("invalid"));
      if (bad) { bad.classList.add("invalid"); setTimeout(() => bad.focus({ preventScroll: true }), 300); }
      return fail(msgs[bad?.name] || "Please complete the highlighted field.");
    }
    const data = {};
    JOB_FIELDS.forEach((k) => (data[k] = (f[k]?.value ?? "").trim()));
    data.salaryMin = data.salaryMin ? Number(data.salaryMin) : null;
    data.salaryMax = data.salaryMax ? Number(data.salaryMax) : null;
    if (data.salaryMin && data.salaryMax && data.salaryMax < data.salaryMin) return fail("The 'To' amount should be higher than 'From'.");
    if (!contactLink(data)) return fail("That contact doesn't look right. Check the username, number or email.");
    if (data.contactMethod === "phone" && data.contactValue.replace(/\D/g, "").length < 10) return fail("Please enter a complete phone number.");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Submitting…";
    try {
      await store.createJob(data);
      jobsCache = null;
      app.innerHTML = `<div class="empty"><h1>Thanks! Your post is under review.</h1><p class="muted">We'll check it soon. You can see its status under My posts.</p><p><a class="btn btn-primary" href="#/my">Go to My posts</a> <a class="btn btn-ghost" href="#/post" id="again">Post another</a></p></div>`;
      $("#again").addEventListener("click", (ev) => { ev.preventDefault(); viewPost(); });
    } catch (ex) {
      console.error(ex); btn.disabled = false; btn.textContent = "Submit for review";
      fail("Could not submit. Please check your details and try again.");
    }
  });
}

async function viewMy() {
  document.title = "My posts | Job Search PH";
  const { user } = getAuthState();
  if (!user) return requireSignIn("Manage your job posts");
  app.innerHTML = `<div class="page-head"><h1>My posts</h1><a class="btn btn-primary" href="#/post">Post a job</a></div><div id="mine"><p class="muted">Loading…</p></div>`;
  const draw = async () => {
    const list = (await store.myJobs()).sort((a, b) => b.createdAt - a.createdAt);
    $("#mine").innerHTML = list.length ? `<div class="table">${list.map((j) => `
      <div class="trow">
        <div><a href="#/job/${encodeURIComponent(j.id)}"><strong>${esc(j.title)}</strong></a><div class="muted small">${esc(j.city)} · posted ${ago(j.createdAt)}${j.expiresAt ? ` · ${isLive(j) ? "expires" : "expired"} ${new Date(j.expiresAt).toLocaleDateString("en-PH")}` : ""}</div></div>
        <div>${statusBadge(j)}</div>
        <div class="actions">${j.status === "approved" || j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-close="${esc(j.id)}">Mark filled / close</button>` : ""}</div>
      </div>`).join("")}</div>` : `<div class="empty"><p>You haven't posted any jobs yet.</p></div>`;
  };
  $("#mine").addEventListener("click", async (e) => {
    const id = e.target.closest("[data-close]")?.dataset.close; if (!id) return;
    if (!confirmInline(e.target, "Close this post?")) return;
    try { await store.updateJob(id, { status: "closed" }); jobsCache = null; toast("Post closed"); draw(); } catch { toast("Could not close post"); }
  });
  draw();
}

// Two-click confirm without browser dialogs.
function confirmInline(btn, text) {
  if (btn.dataset.armed) return true;
  const orig = btn.textContent; btn.dataset.armed = "1"; btn.textContent = text; btn.classList.add("armed");
  setTimeout(() => { delete btn.dataset.armed; btn.textContent = orig; btn.classList.remove("armed"); }, 3000);
  return false;
}

let adminTab = "pending";
async function viewAdmin() {
  document.title = "Admin | Job Search PH";
  const { user, isAdmin } = getAuthState();
  if (!user) return requireSignIn("Admin sign in");
  if (!isAdmin) { app.innerHTML = `<div class="empty"><h1>Not authorized</h1><p class="muted">This account is not an admin.</p></div>`; return; }
  const tabs = { pending: "Pending", approved: "Live", reports: "Reports", rejected: "Rejected", closed: "Closed" };
  app.innerHTML = `
    <div class="page-head"><h1>Admin</h1>${isDemo ? `<button class="btn btn-ghost btn-sm" id="reset-demo">Reset demo data</button>` : ""}</div>
    <div class="tabs" role="tablist">${Object.entries(tabs).map(([k, v]) => `<button role="tab" class="tab ${adminTab === k ? "active" : ""}" data-tab="${k}">${v}</button>`).join("")}</div>
    <div id="admin-body"><p class="muted">Loading…</p></div>`;
  app.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { adminTab = b.dataset.tab; viewAdmin(); }));
  $("#reset-demo")?.addEventListener("click", async () => { await store.resetDemo(); jobsCache = null; toast("Demo reset"); location.hash = "#/"; });

  const body = $("#admin-body");
  if (adminTab === "reports") {
    const reports = await store.listReports();
    body.innerHTML = reports.length ? `<div class="table">${reports.map((r) => `
      <div class="trow">
        <div><a href="#/job/${encodeURIComponent(r.jobId)}"><strong>Job ${esc(r.jobId)}</strong></a><div class="small">${esc(REPORT_REASONS[r.reason] || r.reason)}</div>${r.details ? `<div class="muted small">“${esc(r.details)}”</div>` : ""}<div class="muted small">${ago(r.createdAt)}</div></div>
        <div class="actions"><button class="btn btn-danger btn-sm" data-act="closejob" data-id="${esc(r.jobId)}">Close job</button><button class="btn btn-ghost btn-sm" data-act="dismiss" data-id="${esc(r.id)}">Dismiss</button></div>
      </div>`).join("")}</div>` : `<div class="empty"><p>No reports. 🎉</p></div>`;
  } else {
    const list = (await store.listByStatus(adminTab)).sort((a, b) => b.createdAt - a.createdAt);
    body.innerHTML = list.length ? list.map((j) => `
      <div class="admin-item">
        <div class="admin-item-head">
          <div><strong>${esc(j.title)}</strong> ${statusBadge(j)} ${j.featured ? `<span class="badge badge-featured">Featured</span>` : ""}
            <div class="muted small">${esc(j.employerName)} · ${esc(j.city)} · ${esc(j.category)} · ${esc(j.employmentType)} · ${salaryText(j)} · submitted ${ago(j.createdAt)}</div></div>
        </div>
        <details><summary>View details</summary>
          <p>${nl2br(j.description)}</p>${j.requirements ? `<p class="small"><strong>Requirements:</strong><br>${nl2br(j.requirements)}</p>` : ""}
          <p class="small"><strong>Contact:</strong> ${esc(j.contactMethod)} — ${esc(j.contactValue)} · <strong>Owner UID:</strong> ${esc(j.ownerUid)}</p>
        </details>
        <div class="actions">
          ${j.status !== "approved" ? `<button class="btn btn-primary btn-sm" data-act="approve" data-id="${esc(j.id)}">${j.status === "pending" ? "Approve" : "Re-publish"}</button>` : `<button class="btn btn-ghost btn-sm" data-act="approve" data-id="${esc(j.id)}">Renew 30 days</button>`}
          ${j.status === "pending" ? `<button class="btn btn-ghost btn-sm" data-act="reject" data-id="${esc(j.id)}">Reject</button>` : ""}
          ${j.status === "approved" ? `<button class="btn btn-ghost btn-sm" data-act="feature" data-id="${esc(j.id)}" data-on="${j.featured ? 1 : 0}">${j.featured ? "Unfeature" : "Feature"}</button><button class="btn btn-ghost btn-sm" data-act="closejob" data-id="${esc(j.id)}">Close</button>` : ""}
          <button class="btn btn-danger btn-sm" data-act="delete" data-id="${esc(j.id)}">Delete</button>
        </div>
      </div>`).join("") : `<div class="empty"><p>Nothing here.</p></div>`;
  }

  body.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const { act, id } = b.dataset;
    if ((act === "delete" || act === "closejob") && !confirmInline(b, "Click again to confirm")) return;
    try {
      if (act === "approve") await store.approve(id);
      if (act === "reject") await store.updateJob(id, { status: "rejected" });
      if (act === "closejob") await store.updateJob(id, { status: "closed" });
      if (act === "feature") await store.updateJob(id, { featured: b.dataset.on !== "1" });
      if (act === "delete") await store.deleteJob(id);
      if (act === "dismiss") await store.dismissReport(id);
      jobsCache = null; toast("Done"); viewAdmin();
    } catch (err) { console.error(err); toast("Action failed: " + (err.code || err.message)); }
  });
}

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
      <p class="notice">Draft — have a lawyer review before launch.</p>
      <p>Job Search PH is an online job listing board. We publish job posts submitted by employers. We do not recruit, screen, refer, match or place workers, and we are not a party to any employment agreement.</p>
      <h2>Employers agree to</h2>
      <ul>
        <li>Post only real, currently open jobs that they will hire for directly.</li>
        <li>Never charge applicants any fee, deposit or deduction to apply or be hired.</li>
        <li>Hire only workers aged 18 and above, and follow Philippine labor laws, including the Kasambahay Law (RA 10361) and minimum wage rules.</li>
        <li>Not post jobs for recruitment agencies or overseas placement unless the agency is licensed by DOLE or DMW and the license number is included.</li>
      </ul>
      <h2>Our rights</h2>
      <p>We may review, reject, edit, close or remove any post, and suspend any account, at our discretion. Posts expire after 30 days.</p>
      <h2>No guarantee</h2>
      <p>We do not verify every employer or applicant. Jobseekers and employers deal with each other at their own risk and should follow our safety tips.</p>` },
    privacy: { title: "Privacy notice", body: `
      <p class="notice">Draft — review for Data Privacy Act (RA 10173) compliance before launch.</p>
      <p><strong>What we collect:</strong> for employers, your Google account name, email and user ID (to manage your posts) and the job details you submit, including the contact details you choose to publish. Jobseekers can browse without an account; if you submit a report we store its contents.</p>
      <p><strong>How we use it:</strong> to publish and moderate job posts and keep the site safe. We do not sell personal data.</p>
      <p><strong>Public information:</strong> anything in a live job post, including its contact details, is visible to everyone.</p>
      <p><strong>Your rights:</strong> you can close your posts any time and ask us to delete your account data by messaging Job Search PH.</p>` },
  };
  const p = pages[page];
  document.title = `${p.title} | Job Search PH`;
  app.innerHTML = `<article class="prose"><h1>${p.title}</h1>${p.body}</article>`;
}

/* ---------------- Router ---------------- */
async function route() {
  renderNav();
  $("#nav").classList.remove("open"); $("#nav-toggle").setAttribute("aria-expanded", "false");
  const [, page, arg] = (location.hash || "#/").split("/");
  window.scrollTo(0, 0);
  if (!page) return viewList();
  if (page === "job" && arg) return viewJob(decodeURIComponent(arg));
  if (page === "post") return viewPost();
  if (page === "my") return viewMy();
  if (page === "admin") return viewAdmin();
  if (["safety", "terms", "privacy"].includes(page)) return viewStatic(page);
  location.hash = "#/";
}

window.addEventListener("hashchange", route);
if (isDemo) $("#demo-banner").hidden = false;
let first = true;
onAuth(() => { if (first) { first = false; route(); } else { route(); } });
store.init().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="error">Could not start the site. Check assets/firebase-config.js.</p>`;
});
