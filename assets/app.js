import { store, onAuth, getAuthState, JOB_FIELDS, ageFrom, uploadsEnabled } from "./store.js?v=1792950452";

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
const CAN_SMS = matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
const IN_APP_BROWSER = /FBAN|FBAV|FB_IAB|Instagram|Messenger|Line\//i.test(navigator.userAgent);

/* ---------------- Wages, work conditions, places ---------------- */
// Official minimums. Negros Occidental (incl. Bacolod) follows the Western Visayas wage board;
// Negros Oriental follows Central Visayas. Update these when new wage orders take effect.
const WAGES = {
  R6: { name: "Western Visayas", household: 6500, daily: 525, dailyLarge: 550, since: "Nov 19, 2025" },
  R7: { name: "Central Visayas", household: 7500, daily: null, since: "Oct 14, 2026" },
};
const CITY_REGION = { "Dumaguete City": "R7" };
const WORK_DAYS = 26; // days per month used to convert daily and monthly pay
const HOUSEHOLD_CATS = ["Kasambahay / Househelper", "Yaya / Nanny", "Caregiver", "Cook", "Driver", "Laundry", "Gardener / Maintenance"];
const BENEFITS = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay", "Free meals", "Free lodging", "Paid leave", "Overtime pay", "Transport allowance", "Uniform provided"];
const LEGAL_HOUSEHOLD = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay"];
const CITY_COORDS = {
  "Bacolod City": [10.6765, 122.9509], "Talisay City": [10.7363, 122.9672], "Silay City": [10.7947, 122.9748],
  "Bago City": [10.5333, 122.8333], "Victorias City": [10.901, 123.071], "Cadiz City": [10.9506, 123.309],
  "Sagay City": [10.8967, 123.4167], "La Carlota City": [10.4239, 122.9213], "Kabankalan City": [9.9846, 122.8114],
  "San Carlos City": [10.4929, 123.4095], "Escalante City": [10.8404, 123.4994], "Himamaylan City": [10.0989, 122.8706],
  "Sipalay City": [9.7516, 122.4041], "Murcia": [10.605, 123.042], "Valladolid": [10.46, 122.83], "Pulupandan": [10.52, 122.8],
  "E.B. Magalona": [10.87, 123.03], "Manapla": [10.96, 123.12], "Iloilo City": [10.7202, 122.5621], "Roxas City": [11.5853, 122.7511],
  "Dumaguete City": [9.3068, 123.3054],
};
function kmBetween([a, b], [c, d]) {
  const r = (x) => (x * Math.PI) / 180, R = 6371;
  const h = Math.sin(r(c - a) / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(r(d - b) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
// Lowest legal pay for a job, in the chosen pay period. Returns null when we have no rate to check.
function minimumPay(city, workplace, period) {
  const w = WAGES[CITY_REGION[city] || "R6"];
  let monthly;
  if (workplace === "household") monthly = w.household;
  else if (w.daily) monthly = w.daily * WORK_DAYS;
  else return null;
  const amt = period === "month" ? monthly : period === "day" ? monthly / WORK_DAYS : monthly / WORK_DAYS / 8;
  return { amount: Math.ceil(amt), region: w.name, since: w.since, basis: workplace === "household" ? `₱${w.household.toLocaleString("en-PH")}/month kasambahay minimum` : `₱${w.daily}/day minimum (₱${w.dailyLarge}/day if you have more than 10 workers)` };
}
const monthlyEquivalent = (j) => {
  const v = j.salaryMin || j.salaryMax; if (!v) return 0;
  return j.salaryPeriod === "month" ? v : j.salaryPeriod === "day" ? v * WORK_DAYS : v * 8 * WORK_DAYS;
};
const ICON = {
  pin: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" stroke="currentColor" stroke-width="1.8"/><circle cx="12" cy="10" r="2.3" stroke="currentColor" stroke-width="1.8"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="11" cy="11" r="6.5" stroke="currentColor" stroke-width="1.8"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  locate: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  clock: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  cal: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="4" y="5.5" width="16" height="14" rx="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>`,
  people: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8.5" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0M16 5.8a3 3 0 0 1 0 5.4M18 19a5.5 5.5 0 0 0-2.5-4.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
};
function requirementsHtml(j) {
  const exp = Number(j.reqExperience || 0);
  const facts = [];
  if (exp > 0) facts.push(["Experience", `${exp}+ year${exp === 1 ? "" : "s"}`]);
  else if (j.reqExperience === 0) facts.push(["Experience", "Not required"]);
  if (j.reqEducation && j.reqEducation !== "Any") facts.push(["Education", esc(j.reqEducation)]);
  const list = j.reqList || [];
  const other = (j.requirements || "").split("\n").map((r) => r.replace(/^[-•*]\s*/, "").trim()).filter(Boolean);
  if (!facts.length && !list.length && !other.length) return "";
  return `<h2>Requirements</h2>
    ${facts.length ? `<dl class="conds">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
    ${list.length ? `<ul class="benefits reqchips">${list.map((r) => `<li>${ICON.check}${esc(r)}</li>`).join("")}</ul>` : ""}
    ${other.length ? `<ul class="reqs">${other.map((r) => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}`;
}
function conditionsHtml(j) {
  const rows = [];
  if (j.workplace) rows.push([ICON.home, "Workplace", j.workplace === "household" ? "Private household" : "Business"]);
  if (j.hours) rows.push([ICON.clock, "Working hours", esc(j.hours)]);
  if (j.daysOff != null && j.daysOff !== "") rows.push([ICON.cal, "Days off", `${esc(j.daysOff)} day${Number(j.daysOff) === 1 ? "" : "s"} per ${j.daysOffPer === "month" ? "month" : "week"}`]);
  if (j.openings > 1) rows.push([ICON.people, "Openings", `${esc(j.openings)} people`]);
  if (j.startDate) rows.push([ICON.cal, "Start date", new Date(j.startDate + "T00:00:00").toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" })]);
  const ben = (j.benefits || []).length ? `<ul class="benefits">${j.benefits.map((b) => `<li>${ICON.check}${esc(b)}</li>`).join("")}</ul>` : "";
  if (!rows.length && !ben) return "";
  return `<h2>Work conditions</h2>
    ${rows.length ? `<dl class="conds">${rows.map(([i, k, v]) => `<div><dt>${i}${k}</dt><dd>${v}</dd></div>`).join("")}</dl>` : ""}
    ${ben ? `<h3 class="sub">Benefits</h3>${ben}` : ""}`;
}

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
  if (c.contactMethod === "phone") return { href: `tel:${digits(v)}`, label: `Call ${v}`, extra: CAN_SMS ? `sms:${digits(v)}` : null, text: v };
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
let signupIntent = "";
function goSignIn(purpose, intent) {
  returnTo = location.hash || "#/";
  if (intent) signupIntent = intent;
  if (intent === "employer" && /^#?\/?$/.test(location.hash)) returnTo = "#/post";
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

/* ---------------- Dialog (no browser popups) ---------------- */
function showDialog({ title, body, actions }) {
  return new Promise((resolve) => {
    const wrap = document.createElement("div");
    wrap.className = "dlg-backdrop";
    wrap.innerHTML = `<div class="dlg" role="dialog" aria-modal="true" aria-labelledby="dlg-t"><h2 id="dlg-t">${title}</h2><p>${body}</p>
      <div class="dlg-actions">${actions.map((a, i) => `<button class="btn ${a.primary ? "btn-primary" : "btn-ghost"}" data-i="${i}">${a.label}</button>`).join("")}</div></div>`;
    const done = (v) => { wrap.remove(); document.removeEventListener("keydown", onKey); resolve(v); };
    const onKey = (e) => { if (e.key === "Escape") done(null); };
    wrap.addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) done(actions[b.dataset.i].value); else if (e.target === wrap) done(null); });
    document.addEventListener("keydown", onKey);
    document.body.appendChild(wrap);
    wrap.querySelector(".btn-primary, .btn")?.focus();
  });
}

/* ---------------- Notifications ---------------- */
let notifs = [];
let unwatch = null;
let pendingForAdmin = 0;
const BELL = `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2H4.5l1.5-2Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><path d="M10 20.5a2 2 0 0 0 4 0" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`;
function startNotifications() {
  if (unwatch) { unwatch(); unwatch = null; }
  notifs = []; renderBell();
  const { user, isAdmin } = getAuthState();
  if (!user) return;
  unwatch = store.watchNotifications((list) => { if (list.length !== notifs.length) myAppsCache = null; notifs = list; renderBell(); });
  if (isAdmin) store.pendingCount().then((n) => { pendingForAdmin = n; renderBell(); renderNav(); });
}
function renderBell() {
  const wrap = $("#bell-wrap"); const { user, isAdmin } = getAuthState();
  if (!user) { wrap.innerHTML = ""; return; }
  const unread = notifs.filter((n) => !n.read).length + (isAdmin && pendingForAdmin ? 1 : 0);
  const open = wrap.classList.contains("open");
  const items = [
    ...(isAdmin && pendingForAdmin ? [{ id: "_pending", title: `${pendingForAdmin} post${pendingForAdmin === 1 ? "" : "s"} waiting for review`, body: "Approve or reject them in Admin.", link: "#/admin", read: false, createdAt: null, type: "admin" }] : []),
    ...notifs,
  ];
  wrap.innerHTML = `
    <button class="bell" id="bell-btn" aria-label="Notifications${unread ? `, ${unread} unread` : ""}" aria-expanded="${open}">${BELL}${unread ? `<span class="bell-count">${unread > 9 ? "9+" : unread}</span>` : ""}</button>
    <div class="notif-panel" ${open ? "" : "hidden"}>
      <div class="notif-head"><strong>Notifications</strong>${notifs.some((n) => !n.read) ? `<button class="linkbtn" id="mark-all">Mark all as read</button>` : ""}</div>
      <div class="notif-list">${items.length ? items.map((n) => `
        <button class="notif ${n.read ? "" : "unread"} t-${esc(n.type || "")}" data-nid="${esc(n.id)}" data-link="${esc(n.link || "")}">
          <span class="notif-dot" aria-hidden="true"></span>
          <span class="notif-text"><strong>${esc(n.title)}</strong>${n.body ? `<span>${esc(n.body)}</span>` : ""}${n.createdAt ? `<small>${ago(n.createdAt)}</small>` : ""}</span>
        </button>`).join("") : `<p class="notif-empty">No notifications yet. You'll see application updates here.</p>`}</div>
    </div>`;
}
document.addEventListener("click", async (e) => {
  const wrap = $("#bell-wrap");
  if (e.target.closest("#bell-btn")) { wrap.classList.toggle("open"); renderBell(); return; }
  if (e.target.closest("#mark-all")) { await store.markRead(notifs.filter((n) => !n.read).map((n) => n.id)).catch(() => {}); return; }
  const item = e.target.closest(".notif");
  if (item) {
    wrap.classList.remove("open");
    if (item.dataset.nid !== "_pending") store.markRead([item.dataset.nid]).catch(() => {});
    if (item.dataset.link) { if (location.hash === item.dataset.link) route(); else location.hash = item.dataset.link; }
    renderBell(); return;
  }
  if (wrap.classList.contains("open") && !e.target.closest("#bell-wrap")) { wrap.classList.remove("open"); renderBell(); }
});

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
    isAdmin ? link("#/admin", `Admin${pendingForAdmin ? ` <span class="dot">${pendingForAdmin}</span>` : ""}`) : "",
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
  if (a.dataset.action === "gosignin") { e.preventDefault(); goSignIn(a.dataset.purpose, a.dataset.intent); }
});

/* ---------------- Jobs list ---------------- */
let jobsCache = null;
let myAppsCache = null;
const filters = { q: "", where: "", category: "", type: "", minPay: "", sort: "new", near: null, nearCity: "" };

async function getMyApps() {
  const { profile } = getAuthState();
  if (profile?.role !== "jobseeker") return [];
  if (!myAppsCache) myAppsCache = await store.myApplications().catch(() => []);
  return myAppsCache;
}

async function viewList() {
  document.title = "Job Search PH — Jobs in Negros & Western Visayas";
  const { user } = getAuthState();
  const cityList = CITIES.filter((c) => c !== "Other");
  app.innerHTML = `
    <section class="hero">
      <span class="eyebrow">Free for jobseekers · No fees, ever</span>
      <h1>Find work near you in <em>Negros &amp; Western Visayas</em></h1>
      <p>Household, service and local jobs from employers in Bacolod and nearby cities. Every post is checked and must pay at least the legal minimum wage.</p>
      <form class="search2" id="search" role="search">
        <label class="field"><span class="ico">${ICON.search}</span><span class="sr">What</span>
          <input type="search" id="q" name="q" placeholder="Job title or keyword" value="${esc(filters.q)}" autocomplete="off"></label>
        <label class="field"><span class="ico">${ICON.pin}</span><span class="sr">Where</span>
          <input type="search" id="where" name="where" list="city-list" placeholder="City, town or barangay" value="${esc(filters.where)}" autocomplete="off"></label>
        <datalist id="city-list">${cityList.map((c) => `<option value="${esc(c)}"></option>`).join("")}</datalist>
        <button class="btn btn-primary" type="submit">Search</button>
      </form>
      <div class="hero-row">
        <button class="btn btn-ghost btn-sm near" id="near" type="button">${ICON.locate}<span>${filters.near ? `Near ${esc(filters.nearCity)}` : "Use my location"}</span></button>
        <div class="hero-stats"><span><strong id="stat-jobs">–</strong> open jobs</span><span><strong id="stat-cities">–</strong> locations</span></div>
      </div>
      ${user ? "" : `<div class="hero-actions"><a class="btn btn-ghost btn-sm" href="#/signin" data-action="gosignin" data-intent="jobseeker" data-purpose="Create your free profile">Create a free profile</a><a class="btn btn-ghost btn-sm" href="#/signin" data-action="gosignin" data-intent="employer" data-purpose="Sign in to post a job">I'm hiring</a></div>`}
    </section>
    <nav class="cat-chips" aria-label="Categories">
      <button class="cat ${!filters.category ? "on" : ""}" data-cat="">All jobs</button>
      ${CATEGORIES.map((c) => `<button class="cat ${filters.category === c ? "on" : ""}" data-cat="${esc(c)}">${esc(c)}</button>`).join("")}
    </nav>
    <div class="toolbar">
      <span id="count" class="muted"></span>
      <div class="toolbar-filters">
        <select id="f-type" name="type" aria-label="Job type"><option value="">Any type</option>${opts(TYPES, filters.type)}</select>
        <select id="f-pay" name="minPay" aria-label="Minimum pay">
          <option value="">Any pay</option>
          ${[8000, 10000, 15000, 20000].map((v) => `<option value="${v}" ${String(filters.minPay) === String(v) ? "selected" : ""}>₱${v.toLocaleString("en-PH")}+ / month</option>`).join("")}
        </select>
        <select id="f-sort" name="sort" aria-label="Sort">
          <option value="new" ${filters.sort === "new" ? "selected" : ""}>Newest</option>
          <option value="pay" ${filters.sort === "pay" ? "selected" : ""}>Highest pay</option>
          <option value="near" ${filters.sort === "near" ? "selected" : ""}>Nearest</option>
        </select>
      </div>
    </div>
    <div id="active-filters" class="active-filters"></div>
    <section id="results" class="cards"><p class="muted">Loading jobs…</p></section>
    <aside class="notice"><strong>Stay safe:</strong> legitimate employers never ask you to pay to apply, train or get hired. <a href="#/safety">Read safety tips</a></aside>`;

  let applied = new Set();
  const distanceOf = (j) => (filters.near && CITY_COORDS[j.city] ? kmBetween(filters.near, CITY_COORDS[j.city]) : null);
  const draw = () => {
    const q = filters.q.trim().toLowerCase();
    const where = filters.where.trim().toLowerCase();
    let list = (jobsCache || []).filter(isLive)
      .filter((j) => !filters.category || j.category === filters.category)
      .filter((j) => !filters.type || j.employmentType === filters.type || j.schedule === filters.type)
      .filter((j) => !filters.minPay || monthlyEquivalent(j) >= Number(filters.minPay))
      .filter((j) => !where || [j.city, j.area].join(" ").toLowerCase().includes(where.replace(/ city$/, "")))
      .filter((j) => !q || [j.title, j.category, j.employerName, j.description, (j.benefits || []).join(" ")].join(" ").toLowerCase().includes(q));
    const by = {
      new: (a, b) => (b.featured - a.featured) || (b.approvedAt || b.createdAt) - (a.approvedAt || a.createdAt),
      pay: (a, b) => monthlyEquivalent(b) - monthlyEquivalent(a),
      near: (a, b) => (distanceOf(a) ?? 1e9) - (distanceOf(b) ?? 1e9),
    };
    list.sort(by[filters.sort] || by.new);
    $("#count").textContent = `${list.length} job${list.length === 1 ? "" : "s"}${where ? ` in or near “${filters.where.trim()}”` : ""}`;
    const chips = [
      filters.q && ["q", `“${filters.q}”`], filters.where && ["where", filters.where], filters.category && ["category", filters.category],
      filters.type && ["type", filters.type], filters.minPay && ["minPay", `₱${Number(filters.minPay).toLocaleString("en-PH")}+`],
    ].filter(Boolean);
    $("#active-filters").innerHTML = chips.length ? chips.map(([k, v]) => `<button class="fchip" data-clear="${k}">${esc(v)} <span aria-hidden="true">×</span></button>`).join("") + `<button class="linkbtn" data-clear="all">Clear all</button>` : "";
    $("#results").innerHTML = list.length ? list.map((j) => card(j, applied.has(j.id), distanceOf(j))).join("") :
      `<div class="empty"><p><strong>No jobs match yet.</strong></p><p class="muted">Try a nearby city, another category, or clear your filters.</p></div>`;
  };
  const sync = () => { const f = $("#search"); filters.q = f.q.value; filters.where = f.where.value; draw(); };
  $("#search").addEventListener("submit", (e) => { e.preventDefault(); sync(); $("#results").scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("#q").addEventListener("input", sync);
  $("#where").addEventListener("input", sync);
  app.querySelectorAll(".toolbar select").forEach((s) => s.addEventListener("change", () => {
    filters[s.name] = s.value;
    if (s.name === "sort" && s.value === "near" && !filters.near) locate(); else draw();
  }));
  app.querySelectorAll("[data-cat]").forEach((b) => b.addEventListener("click", () => {
    filters.category = b.dataset.cat;
    app.querySelectorAll("[data-cat]").forEach((x) => x.classList.toggle("on", x === b)); draw();
  }));
  $("#active-filters").addEventListener("click", (e) => {
    const k = e.target.closest("[data-clear]")?.dataset.clear; if (!k) return;
    if (k === "all") Object.assign(filters, { q: "", where: "", category: "", type: "", minPay: "" }); else filters[k] = "";
    viewList();
  });
  const locate = () => {
    const btn = $("#near"); const label = btn.querySelector("span");
    if (!navigator.geolocation) { toast("Location isn't available on this device. Type your city instead."); return; }
    label.textContent = "Finding you…";
    navigator.geolocation.getCurrentPosition((pos) => {
      const here = [pos.coords.latitude, pos.coords.longitude];
      let best = null, bestKm = Infinity;
      for (const [c, xy] of Object.entries(CITY_COORDS)) { const k = kmBetween(here, xy); if (k < bestKm) { bestKm = k; best = c; } }
      filters.near = here; filters.nearCity = best; filters.sort = "near";
      label.textContent = `Near ${best}`; $("#f-sort").value = "near"; draw();
    }, () => { label.textContent = "Use my location"; toast("Couldn't get your location. Type your city instead."); }, { timeout: 10000, maximumAge: 600000 });
  };
  $("#near").addEventListener("click", locate);

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

function card(j, applied, km) {
  const perks = (j.benefits || []).filter((b) => ["Free meals", "Free lodging", "SSS", "13th month pay"].includes(b)).slice(0, 3);
  return `
  <a class="card ${j.featured ? "card-featured" : ""}" href="#/job/${encodeURIComponent(j.id)}">
    <div class="card-top">
      <span class="cat-tag">${esc(j.category)}</span>
      ${j.featured ? `<span class="badge badge-featured">Featured</span>` : applied ? `<span class="badge badge-app-new">Applied</span>` : ""}
    </div>
    <h3>${esc(j.title)}</h3>
    <p class="employer">${esc(j.employerName)}</p>
    <p class="loc">${ICON.pin}<span>${j.area ? `${esc(j.area)}, ` : ""}${esc(j.city)}${km != null ? ` · ${km < 1 ? "<1" : Math.round(km)} km` : ""}</span></p>
    <ul class="meta"><li>${esc(j.employmentType)}</li>${j.workplace === "household" && j.schedule ? `<li>${esc(j.schedule)}</li>` : ""}${perks.map((b) => `<li class="perk">${esc(b)}</li>`).join("")}</ul>
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
        <p class="employer">${esc(j.employerName)}</p>
        <p class="loc">${ICON.pin}<span>${j.area ? `${esc(j.area)}, ` : ""}${esc(j.city)}</span></p>
        <ul class="meta"><li>${esc(j.employmentType)}</li>${j.workplace === "household" && j.schedule ? `<li>${esc(j.schedule)}</li>` : ""}<li>${esc(j.category)}</li><li>Posted ${ago(j.approvedAt || j.createdAt)}</li></ul>
        <div class="pay-box"><span class="salary salary-lg">${salaryText(j)}</span>${(() => { const m = j.workplace && j.salaryMin ? minimumPay(j.city, j.workplace, j.salaryPeriod) : null; return m && j.salaryMin >= m.amount ? `<span class="minok">${ICON.check}Meets the legal minimum wage</span>` : ""; })()}</div>
        <h2>About the job</h2><p>${nl2br(j.description)}</p>
        ${conditionsHtml(j)}
        ${requirementsHtml(j)}
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
      <a class="btn btn-primary btn-block" href="#/signin" data-action="gosignin" data-intent="jobseeker" data-purpose="Sign in to apply">Sign in to apply</a>`;
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
  myAppsCache = null; // always check the latest status before showing Apply
  const apps = await getMyApps();
  const mine = apps.find((a) => a.jobId === j.id);
  const employed = apps.find((a) => a.status === "hired" && !a.employmentEnded && isFullTime(a.jobSchedule, a.jobArrangement));
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
  if (employed && isFullTime(j.schedule || j.employmentType, j.arrangement)) {
    panel.innerHTML = `
      <h2>You're employed full-time</h2>
      <p class="muted">You were hired for <a href="#/job/${encodeURIComponent(employed.jobId)}">${esc(employed.jobTitle)}</a>, so you can't apply to other full-time jobs right now. Part-time jobs are still open to you.</p>
      <p class="small muted">Did that job end? Update it in <a href="#/applications">My applications</a>.</p>`;
    return;
  }
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

function isFullTime(schedule, arrangement) {
  return schedule === "Full-time" || arrangement === "Live-in" || schedule === "Live-in" || schedule === "Stay-out";
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
  const isNew = !profile;
  let role = p.role || (isNew ? signupIntent : "") || "";
  const guided = isNew && !!signupIntent; // came from "Create a profile", "Apply" or "Post a job"

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
          ${role === "jobseeker" ? `<label>Birthdate *<span class="date-age"><input name="birthDate" type="date" required max="${maxBirth}" value="${esc(p.birthDate)}"><output id="age-out" class="age-pill">${ageFrom(p.birthDate) != null ? `${ageFrom(p.birthDate)} years old` : "Age"}</output></span><span class="hint">You must be at least 18. Employers see your age, not your birthdate.</span></label>`
            : `<label>Household or business name<input name="companyName" maxlength="100" placeholder="e.g. Reyes Family or Inasal Express" value="${esc(p.companyName)}"></label>`}
          <label>Messenger (optional)<input name="messenger" maxlength="100" placeholder="Username or m.me link" value="${esc(p.messenger)}"></label>
        </div>
        ${role === "jobseeker" ? `<div><span class="label">Gender</span><div class="pills tight" role="radiogroup">${["Male", "Female", "Other"].map((g) => `<label class="pill"><input type="radio" name="gender" value="${g}" ${p.gender === g ? "checked" : ""}><span>${g}</span></label>`).join("")}</div></div>` : ""}
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
    const g = f.querySelector("[name=gender]:checked"); if (f.querySelector("[name=gender]")) p.gender = g ? g.value : "";
    ["jobCategories", "jobTypes"].forEach((k) => { if (f.querySelector(`[name=${k}]`)) p[k] = [...f.querySelectorAll(`[name=${k}]:checked`)].map((i) => i.value); });
  };

  const bindForm = () => {
    const f = $("#profile-form");
    f.querySelectorAll("[name=jobCategories]").forEach((cb) => cb.addEventListener("change", () => {
      if (f.querySelectorAll("[name=jobCategories]:checked").length > 5) { cb.checked = false; toast("Pick up to 5 jobs"); }
    }));
    f.addEventListener("input", (e) => e.target.classList?.remove("invalid"));
    f.birthDate?.addEventListener("input", () => {
      const a = ageFrom(f.birthDate.value); const out = $("#age-out");
      out.textContent = a == null ? "Age" : `${a} years old`; out.classList.toggle("bad", a != null && a < 18);
    });
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
          birthDate: p.birthDate, gender: p.gender || "", jobCategories: p.jobCategories || [], jobTypes: p.jobTypes || [],
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
        myAppsCache = null; pendingName = ""; signupIntent = "";
        toast("Profile saved");
        if (isNew || returnTo) finishAuthFlow(); else viewProfile();
      } catch (ex) {
        console.error(ex); btn.disabled = false; btn.textContent = isNew ? "Save and continue" : "Save changes";
        fail(ex.friendly || `Could not save your profile (${ex.code || ex.message}). Try again.`);
      }
    });
  };

  const ICONS = {
    jobseeker: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="7" width="18" height="13" rx="2.5" stroke="currentColor" stroke-width="1.7"/><path d="M8.5 7V5.8A1.8 1.8 0 0 1 10.3 4h3.4a1.8 1.8 0 0 1 1.8 1.8V7" stroke="currentColor" stroke-width="1.7"/><path d="M3 12.5h18" stroke="currentColor" stroke-width="1.7"/><path d="M11 12.5v1.6h2v-1.6" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>`,
    employer: `<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19v-8.5Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12.2" r="2.2" stroke="currentColor" stroke-width="1.7"/><path d="M8.3 18.2a3.9 3.9 0 0 1 7.4 0" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  };
  const ROLES = {
    jobseeker: { title: "I'm looking for work", sub: "For kasambahay, yaya, drivers, cooks and other workers", points: ["Apply to any job in one tap", "See employer contact after you apply", "Track replies in My applications"] },
    employer: { title: "I'm hiring", sub: "For households and local businesses", points: ["Post jobs for free", "Get applicants with their full profile", "Call, text or message them directly"] },
  };
  const roleCard = (k) => `
    <button type="button" class="role ${role === k ? "on" : ""}" data-role="${k}" role="radio" aria-checked="${role === k}">
      <span class="role-top"><span class="role-icon">${ICONS[k]}</span><span class="role-check" aria-hidden="true"></span></span>
      <strong>${ROLES[k].title}</strong>
      <span class="role-sub">${ROLES[k].sub}</span>
      ${isNew ? `<ul>${ROLES[k].points.map((t) => `<li>${t}</li>`).join("")}</ul>` : ""}
    </button>`;

  const draw = () => {
    const name = p.fullName || user.displayName || "";
    const step = !role ? 1 : 2;
    app.innerHTML = `
      <div class="profile-wrap">
        <header class="profile-head">
          <span class="avatar" aria-hidden="true">${esc((name || user.email || "?").trim().charAt(0).toUpperCase())}</span>
          <div>
            ${isNew ? `<p class="kicker">${guided ? "Create your profile" : `Step ${step} of 2`}</p>` : `<p class="kicker">${role === "employer" ? "Employer" : "Jobseeker"} profile</p>`}
            <h1>${isNew ? `Welcome${name ? `, ${esc(firstName(name))}` : ""}` : "My profile"}</h1>
            <p class="muted">${isNew ? (role ? "Fill in your details. Fields marked * are required." : "How will you use Job Search PH? You can change this later.") : `Signed in as ${esc(user.email || user.displayName || "")}`}</p>
          </div>
        </header>
        ${isNew && !guided ? `<ol class="steps" aria-label="Progress"><li class="${step >= 1 ? "done" : ""} ${step === 1 ? "current" : ""}">Choose type</li><li class="${step === 2 ? "current" : ""}">Your details</li></ol>` : ""}
        ${guided ? `<div class="role-switch"><span class="role-now">${ICONS[role]}<span>${role === "employer" ? "Employer profile: post jobs and review applicants" : "Jobseeker profile: apply to jobs with one profile"}</span></span>
            <button type="button" class="linkbtn" data-role="${role === "employer" ? "jobseeker" : "employer"}">${role === "employer" ? "Looking for work instead?" : "Hiring instead?"}</button></div>`
          : `${!isNew ? `<p class="label">Profile type</p>` : ""}
        <div class="role-pick ${isNew ? "" : "compact"}" role="radiogroup" aria-label="Profile type">${roleCard("jobseeker")}${roleCard("employer")}</div>`}
        ${role ? formHtml() : `<div class="trust"><span>Free to use</span><span>No fees for jobseekers, ever</span><span>Your details are shared only when you apply</span></div>`}
      </div>`;
    app.querySelectorAll("[data-role]").forEach((b) => b.addEventListener("click", () => {
      const first = !role; collect(); role = b.dataset.role; draw();
      if (first) $("#profile-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
    if (role) bindForm();
  };
  draw();
}

/* ---------------- Post a job ---------------- */
const REQ_EXPERIENCE = [[0, "No experience needed"], [1, "1+ year"], [2, "2+ years"], [3, "3+ years"], [5, "5+ years"]];
const REQ_EDUCATION = ["Any", "Elementary", "High school", "Senior high school", "Vocational / TESDA", "College"];
const REQ_SKILLS = {
  household: ["Can cook", "Laundry & ironing", "Childcare experience", "Elderly care experience", "Professional driver's license", "Pet care", "Gardening"],
  business: ["Customer service", "Cash handling", "Food handling", "Professional driver's license", "Own motorcycle", "Computer skills", "Heavy lifting"],
  common: ["Non-smoker", "With references", "NBI or barangay clearance", "Medical certificate", "Can start immediately", "Speaks Hiligaynon", "Speaks English"],
};
const SCHEDULES = { household: ["Full-time", "Part-time"], business: ["Full-time", "Part-time", "Project-based", "Shifts"] };
const RECOMMENDED = ["SSS", "PhilHealth", "Pag-IBIG", "13th month pay"];

function viewPost() {
  document.title = "Post a job | Job Search PH";
  const { user, profile } = getAuthState();
  if (!user) {
    app.innerHTML = `<div class="empty"><h1>Post a job for free</h1><p class="muted">Create a free employer account to post jobs and review applicants in one place.</p><p><a class="btn btn-primary" href="#/signin" data-action="gosignin" data-intent="employer" data-purpose="Sign in to post a job">Sign in to post a job</a></p></div>`;
    return;
  }
  if (!profile) { returnTo = "#/post"; location.hash = "#/profile"; return; }
  if (profile.role !== "employer") {
    returnTo = "#/post";
    app.innerHTML = `<div class="empty"><h1>Hiring?</h1><p class="muted">Your profile is set to "I'm looking for work". Switch it to "I'm hiring" to post jobs.</p><p><a class="btn btn-primary" href="#/profile">Change profile type</a></p></div>`;
    return;
  }
  const cityList = CITIES.filter((c) => c !== "Other");
  const radioPills = (name, list, sel, cls = "") => `<div class="pills ${cls}" role="radiogroup">${list.map(([v, l]) => `<label class="pill"><input type="radio" name="${name}" value="${esc(v)}" ${String(sel) === String(v) ? "checked" : ""}><span>${esc(l)}</span></label>`).join("")}</div>`;
  const stepper = (name, val, min, max) => `<div class="stepper"><button type="button" data-step="-1" data-for="${name}" aria-label="Less">−</button><input name="${name}" type="number" inputmode="numeric" min="${min}" max="${max}" value="${val}"><button type="button" data-step="1" data-for="${name}" aria-label="More">+</button></div>`;

  app.innerHTML = `
    <div class="page-head"><div><p class="kicker">New job post</p><h1>Post a job</h1><p class="muted">Free to post. Reviewed within a day, then live for 30 days.</p></div></div>
    <div class="post-layout">
      <form id="post-form" class="form post-form" novalidate>
        <section class="pcard">
          <header><span class="num">1</span><div><h2>Who's hiring?</h2><p>This sets the right pay rules and job options.</p></div></header>
          <div class="seg" role="radiogroup">
            <label><input type="radio" name="workplace" value="household" required><span>${ICON.home}<strong>Private household</strong><small>Kasambahay, yaya, family driver, cook…</small></span></label>
            <label><input type="radio" name="workplace" value="business"><span>${ICON.people}<strong>Business</strong><small>Store, restaurant, office, site…</small></span></label>
          </div>
          <label class="fld">Employer or household name *<input name="employerName" required maxlength="80" placeholder="e.g. Reyes Family" value="${esc(profile.companyName || "")}"></label>
        </section>

        <section class="pcard" data-needs-workplace>
          <header><span class="num">2</span><div><h2>The job</h2></div></header>
          <label class="fld">Job title *<input name="title" required minlength="3" maxlength="100" placeholder="e.g. Live-in Kasambahay"></label>
          <div class="fld"><span class="label">Category *</span><div id="cat-pills" class="pills wrap-pills" role="radiogroup"></div></div>
          <div class="fld" id="arr-field"><span class="label">Live-in or stay-out? *</span>${radioPills("arrangement", [["Live-in", "Live-in"], ["Stay-out", "Stay-out"]], "")}</div>
          <div class="fld"><span class="label">Schedule *</span><div id="sched-pills"></div></div>
        </section>

        <section class="pcard">
          <header><span class="num">3</span><div><h2>Location</h2></div></header>
          <div class="row">
            <label class="fld">City or municipality *<select name="city" required><option value="">Choose…</option>${opts(cityList, cityList.includes(profile.city) ? profile.city : "")}</select></label>
            <label class="fld">Barangay or area<input name="area" maxlength="80" placeholder="e.g. Mandalagan"></label>
          </div>
          <p class="hint">The area helps jobseekers search nearby. Don't include house numbers.</p>
        </section>

        <section class="pcard">
          <header><span class="num">4</span><div><h2>Pay</h2></div></header>
          <div class="pay-row">
            <label class="fld money"><span>From *</span><span class="peso">₱</span><input name="salaryMin" type="number" min="1" step="1" required inputmode="numeric" placeholder="6,500"></label>
            <label class="fld money"><span>To</span><span class="peso">₱</span><input name="salaryMax" type="number" min="1" step="1" inputmode="numeric" placeholder="Optional"></label>
            <div class="fld"><span class="label">Per</span>${radioPills("salaryPeriod", [["month", "Month"], ["day", "Day"], ["hour", "Hour"]], "month", "tight")}</div>
          </div>
          <div id="wage-box" class="wage-box" aria-live="polite"></div>
        </section>

        <section class="pcard">
          <header><span class="num">5</span><div><h2>Work conditions</h2></div></header>
          <div class="row row-3">
            <label class="fld">Working hours<input name="hours" maxlength="60" placeholder="e.g. 7am–6pm"></label>
            <div class="fld"><span class="label">Days off per month</span>${stepper("daysOff", 4, 0, 15)}</div>
            <div class="fld"><span class="label">Openings (max 3)</span>${stepper("openings", 1, 1, 3)}</div>
          </div>
          <label class="fld half">Start date (optional)<input name="startDate" type="date"></label>
          <div class="fld"><span class="label">Benefits</span>
            <div class="chips">${BENEFITS.map((b) => `<label class="chip ${RECOMMENDED.includes(b) ? "rec" : ""}"><input type="checkbox" name="benefits" value="${esc(b)}"><span>${esc(b)}${RECOMMENDED.includes(b) ? `<em>Recommended</em>` : ""}</span></label>`).join("")}</div>
            <p class="hint" id="ben-hint">Posts with SSS, PhilHealth, Pag-IBIG and 13th month pay get more applicants.</p>
          </div>
        </section>

        <section class="pcard">
          <header><span class="num">6</span><div><h2>Requirements</h2><p>Pick what matters. Everything here is optional.</p></div></header>
          <div class="fld"><span class="label">Experience</span>${radioPills("reqExperience", REQ_EXPERIENCE, 0)}</div>
          <div class="fld"><span class="label">Education</span>${radioPills("reqEducation", REQ_EDUCATION.map((e) => [e, e]), "Any")}</div>
          <div class="fld"><span class="label">Skills &amp; documents</span><div id="req-chips" class="chips"></div></div>
          <label class="fld">Other requirements<textarea name="requirements" maxlength="2000" rows="3" placeholder="Anything else, one per line"></textarea></label>
          <p class="hint">All applicants are 18 or older. To follow the Anti-Age Discrimination Act, posts can't set an age range.</p>
        </section>

        <section class="pcard">
          <header><span class="num">7</span><div><h2>Description</h2></div></header>
          <label class="fld">About the job *<textarea name="description" required minlength="30" maxlength="4000" rows="6" placeholder="Duties, household size, what a normal day looks like…"></textarea></label>
        </section>

        <section class="pcard">
          <header><span class="num">8</span><div><h2>How applicants reach you</h2><p>Only people who apply can see this. You also get each applicant's phone number.</p></div></header>
          ${radioPills("contactMethod", [["messenger", "Messenger"], ["phone", "Phone / SMS"], ["email", "Email"]], profile.messenger ? "messenger" : "phone", "tight")}
          <label class="fld"><span class="sr">Contact</span><input name="contactValue" required maxlength="200" value="${esc(profile.messenger || profile.phone || "")}"></label>
        </section>

        <section class="pcard agree-box">
          <p class="label">Before you post, confirm that you will:</p>
          <label class="check"><input type="checkbox" name="agreeWage" required><span>Pay at least the legal minimum wage</span></label>
          <label class="check"><input type="checkbox" name="agreeFee" required><span>Never charge applicants any fee, deposit or deduction</span></label>
          <label class="check"><input type="checkbox" name="agreeAge" required><span>Only hire workers aged 18 or older</span></label>
          <label class="check"><input type="checkbox" name="agreeTerms" required><span>Follow Philippine labor law, including the Kasambahay Law, and the <a href="#/terms" target="_blank">Terms</a></span></label>
        </section>
        <p id="form-error" class="error" hidden></p>
        <button class="btn btn-primary btn-lg" type="submit">Submit for review</button>
      </form>
      <aside class="post-side">
        <p class="label">Preview</p>
        <div id="preview"></div>
        <div class="panel tips-panel"><strong>Posts that get more applicants</strong>
          <ul><li>Show the full pay range</li><li>Include SSS, PhilHealth and Pag-IBIG</li><li>Say what's provided: room, meals, uniform</li></ul></div>
      </aside>
    </div>`;

  const f = $("#post-form");
  const val = (n) => f.querySelector(`[name=${n}]:checked`)?.value ?? "";
  const workplace = () => val("workplace");
  let touchedBenefits = false;

  const renderOptions = () => {
    const wp = workplace() || "household";
    const cats = wp === "household" ? HOUSEHOLD_CATS.concat(["Other"]) : CATEGORIES;
    const curCat = val("category");
    $("#cat-pills").innerHTML = cats.map((c) => `<label class="pill"><input type="radio" name="category" value="${esc(c)}" required ${curCat === c ? "checked" : ""}><span>${esc(c)}</span></label>`).join("");
    const curSched = val("schedule");
    $("#sched-pills").innerHTML = radioPills("schedule", SCHEDULES[wp].map((s) => [s, s]), SCHEDULES[wp].includes(curSched) ? curSched : "Full-time");
    $("#arr-field").hidden = wp !== "household";
    f.querySelectorAll("[name=arrangement]").forEach((r) => (r.required = wp === "household"));
    const curReq = [...f.querySelectorAll("[name=reqList]:checked")].map((i) => i.value);
    $("#req-chips").innerHTML = REQ_SKILLS[wp].concat(REQ_SKILLS.common).map((s) => `<label class="chip"><input type="checkbox" name="reqList" value="${esc(s)}" ${curReq.includes(s) ? "checked" : ""}><span>${esc(s)}</span></label>`).join("");
    if (!touchedBenefits) f.querySelectorAll("[name=benefits]").forEach((cb) => { if (RECOMMENDED.includes(cb.value)) cb.checked = wp === "household"; });
    $("#ben-hint").textContent = wp === "household"
      ? "SSS, PhilHealth, Pag-IBIG and 13th month pay are pre-selected because the Kasambahay Law requires them for household workers. Posts that include them get more applicants."
      : "Posts with SSS, PhilHealth, Pag-IBIG and 13th month pay get more applicants.";
    f.querySelectorAll("[data-needs-workplace]").forEach((s) => s.classList.toggle("dim", !workplace()));
  };

  const collect = () => {
    const g = (n) => (f[n] && !(f[n] instanceof RadioNodeList) ? String(f[n].value ?? "").trim() : "");
    const wp = workplace();
    const arrangement = wp === "household" ? val("arrangement") : "";
    const schedule = val("schedule");
    return {
      title: g("title"), category: val("category"), employerName: g("employerName"), city: g("city"), area: g("area"),
      workplace: wp, arrangement, schedule,
      employmentType: wp === "household" ? (arrangement || "Live-in") : (schedule || "Full-time"),
      salaryMin: g("salaryMin") ? Number(g("salaryMin")) : null, salaryMax: g("salaryMax") ? Number(g("salaryMax")) : null,
      salaryPeriod: val("salaryPeriod") || "month", hours: g("hours"),
      daysOff: g("daysOff") === "" ? null : Math.max(0, Math.min(15, Number(g("daysOff")))), daysOffPer: "month",
      openings: Math.max(1, Math.min(3, Number(g("openings")) || 1)), startDate: g("startDate"),
      benefits: [...f.querySelectorAll("[name=benefits]:checked")].map((i) => i.value),
      reqExperience: Number(val("reqExperience") || 0), reqEducation: val("reqEducation") || "Any",
      reqList: [...f.querySelectorAll("[name=reqList]:checked")].map((i) => i.value),
      requirements: g("requirements"), description: g("description"),
    };
  };
  const currentMin = () => (f.city.value && workplace() ? minimumPay(f.city.value, workplace(), val("salaryPeriod") || "month") : null);
  const counter = document.createElement("p"); counter.className = "hint"; f.description.after(counter);
  const ph = { messenger: "Messenger username or m.me link", phone: "e.g. 0917 123 4567", email: "you@example.com" };

  const refresh = () => {
    const n = f.description.value.trim().length; counter.textContent = n < 30 ? `${n}/30 characters minimum` : `${n} characters`;
    f.contactValue.placeholder = ph[val("contactMethod")] || "";
    const box = $("#wage-box"); const min = currentMin(); const pay = Number(f.salaryMin.value) || 0; const per = val("salaryPeriod") || "month";
    if (!min) { box.className = "wage-box"; box.innerHTML = `<span class="small">Choose who's hiring and the city to see the legal minimum.</span>`; }
    else {
      const ok = pay >= min.amount;
      box.className = `wage-box ${pay ? (ok ? "ok" : "low") : ""}`;
      box.innerHTML = `<strong>Legal minimum: ₱${min.amount.toLocaleString("en-PH")} / ${per}</strong>
        <span class="small">${esc(min.basis)} in ${esc(min.region)}, effective ${esc(min.since)}.${per !== "month" ? ` Converted using ${WORK_DAYS} working days a month${per === "hour" ? " and 8 hours a day" : ""}.` : ""}</span>
        ${pay ? `<span class="verdict">${ok ? `${ICON.check} Your pay meets the minimum` : `Below the legal minimum. Raise it to at least ₱${min.amount.toLocaleString("en-PH")}.`}</span>` : ""}`;
    }
    const d = collect();
    $("#preview").innerHTML = card({ ...d, id: "preview", title: d.title || "Job title", employerName: d.employerName || "Employer name", city: d.city || "City", category: d.category || "Category", approvedAt: Date.now() }, false, null).replace(/href="[^"]*"/, 'href="#/post" tabindex="-1" aria-hidden="true"');
  };

  f.addEventListener("change", (e) => {
    if (e.target.name === "benefits") touchedBenefits = true;
    if (e.target.name === "workplace") renderOptions();
    if (e.target.name === "contactMethod") {
      const m = e.target.value; f.contactValue.value = m === "phone" ? profile.phone : m === "messenger" ? (profile.messenger || "") : (user.email || "");
    }
    refresh();
  });
  f.addEventListener("input", (e) => { e.target.classList?.remove("invalid"); refresh(); });
  f.addEventListener("click", (e) => {
    const b = e.target.closest("[data-step]"); if (!b) return;
    const i = f[b.dataset.for]; const v = Math.max(Number(i.min), Math.min(Number(i.max), (Number(i.value) || 0) + Number(b.dataset.step)));
    i.value = v; refresh();
  });
  renderOptions(); refresh();

  f.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#form-error");
    const fail = (m, el) => { err.textContent = m; err.hidden = false; if (el) { el.classList.add("invalid"); setTimeout(() => el.focus({ preventScroll: true }), 300); } (el || err).scrollIntoView({ block: "center", behavior: "smooth" }); };
    err.hidden = true;
    if (!f.checkValidity()) {
      const bad = f.querySelector("input:invalid, select:invalid, textarea:invalid");
      const msgs = {
        workplace: "Choose who's hiring: a private household or a business.", employerName: "Add the employer or household name.",
        title: "Add a job title (at least 3 characters).", category: "Choose a category.", arrangement: "Choose live-in or stay-out.",
        city: "Choose the city or municipality.", salaryMin: "Enter the pay. It must meet the legal minimum.",
        description: "Write a description of at least 30 characters: duties, schedule, household size.",
        contactValue: "Add how applicants can contact you.",
        agreeWage: "Confirm that you'll pay at least the legal minimum.", agreeFee: "Confirm that you won't charge applicants any fee.",
        agreeAge: "Confirm that you'll only hire workers aged 18 or older.", agreeTerms: "Confirm that you'll follow labor law and the Terms.",
      };
      const target = bad?.type === "radio" ? bad.closest(".pcard, .fld") : bad;
      if (bad?.type === "radio") { target?.classList.add("flash"); setTimeout(() => target?.classList.remove("flash"), 1600); }
      return fail(msgs[bad?.name] || "Please complete the highlighted field.", bad?.type === "radio" ? null : bad);
    }
    const data = collect();
    if (data.salaryMax && data.salaryMax < data.salaryMin) return fail("The 'To' amount should be higher than 'From'.", f.salaryMax);
    const min = currentMin();
    if (min && data.salaryMin < min.amount) return fail(`The pay is below the legal minimum of ₱${min.amount.toLocaleString("en-PH")} per ${data.salaryPeriod}. Please raise it.`, f.salaryMin);
    if (data.workplace === "household" && !(data.daysOff >= 4)) return fail("Household workers are entitled to a rest day every week, so give at least 4 days off a month.", f.daysOff);
    const contact = { contactMethod: val("contactMethod"), contactValue: f.contactValue.value.trim() };
    if (!contactLink(contact)) return fail("That contact doesn't look right. Check the username, number or email.", f.contactValue);
    if (contact.contactMethod === "phone" && digits(contact.contactValue).length < 10) return fail("Please enter a complete phone number.", f.contactValue);
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Submitting…";
    try {
      await store.createJob(data, contact);
      jobsCache = null;
      app.innerHTML = `<div class="empty"><h1>Thanks! Your post is under review.</h1><p class="muted">We'll check it soon. Applicants will appear under My posts once it's live.</p><p><a class="btn btn-primary" href="#/my">Go to My posts</a> <a class="btn btn-ghost" href="#/post" id="again">Post another</a></p></div>`;
      $("#again").addEventListener("click", (ev) => { ev.preventDefault(); viewPost(); });
    } catch (ex) {
      console.error(ex); btn.disabled = false; btn.textContent = "Submit for review";
      fail(ex.code === "permission-denied"
        ? "The database rejected this post. If you just updated the site, publish the latest database rules in Firebase, then try again."
        : `Could not submit (${ex.code || ex.message || "unknown error"}). Please try again.`);
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
        <p class="muted small">${x.gender ? `${esc(x.gender)} · ` : ""}${esc(x.city || "")}${x.experienceYears != null ? ` · ${x.experienceYears} yr${x.experienceYears === 1 ? "" : "s"} experience` : ""}${x.availability ? ` · ${esc(x.availability)}` : ""} · applied ${ago(a.createdAt)}</p></div>
      ${appBadge(a.status, true)}
    </header>
    ${a.message ? `<blockquote>${nl2br(a.message)}</blockquote>` : ""}
    <div class="contact-row">
      <a class="btn btn-primary btn-sm" href="tel:${esc(digits(x.phone))}">Call ${esc(x.phone)}</a>
      ${CAN_SMS ? `<a class="btn btn-ghost btn-sm" href="sms:${esc(digits(x.phone))}">Text</a>` : ""}
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
      const a = apps.find((x) => x.id === b.dataset.id); const st = b.dataset.st;
      try {
        await store.setApplicationStatus(a, st);
        if (st !== "hired") { toast(st === "shortlisted" ? "Shortlisted. We let them know." : "Updated. We let them know."); return draw(); }
        const openings = Number(job.openings) || 1;
        const hired = apps.filter((x) => x.status === "hired" && x.id !== a.id).length + 1;
        if (job.status === "approved" && hired >= openings) {
          const choice = await showDialog({
            title: "Close this job post?",
            body: `You've hired ${hired} of ${openings} opening${openings === 1 ? "" : "s"}. Closing removes the post from search and lets the other applicants know the position is filled.`,
            actions: [{ label: "Keep it open", value: "keep" }, { label: "Close the post", value: "close", primary: true }],
          });
          if (choice === "close") {
            await store.updateJob(job.id, { status: "closed" }); job.status = "closed"; jobsCache = null;
            await store.clearReportsFor(job.id).catch(() => {});
            await Promise.all(apps.filter((x) => x.id !== a.id && ["new", "shortlisted"].includes(x.status)).map((x) =>
              store.notify(x.applicantUid, { type: "job_filled", title: "Position filled", body: `${job.title} has been filled. Keep applying to other jobs!`, link: "#/", appId: x.id, jobId: job.id }).catch(() => {})));
            toast("Post closed. Applicants have been told.");
          } else toast(`Marked hired (${hired} of ${openings}).`);
        } else toast(`Marked hired${openings > 1 ? ` (${hired} of ${openings})` : ""}. We let them know.`);
        draw();
      } catch (err) { console.error(err); toast("Could not update"); }
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
      <div>${a.status === "hired" && a.employmentEnded ? `<span class="badge badge-closed">Job ended</span>` : appBadge(a.status)}</div>
      <div class="actions"><a class="btn btn-ghost btn-sm" href="#/job/${encodeURIComponent(a.jobId)}">View &amp; contact</a>${a.status === "hired" && !a.employmentEnded ? `<button class="btn btn-ghost btn-sm" data-ended="${esc(a.id)}">This job ended</button>` : ""}</div>
    </div>`).join("")}</div>`
    : `<div class="empty"><p><strong>No applications yet.</strong></p><p class="muted">Find a job you like and tap Apply.</p><p><a class="btn btn-primary" href="#/">Browse jobs</a></p></div>`;
  const hiredNow = apps.find((a) => a.status === "hired" && !a.employmentEnded && isFullTime(a.jobSchedule, a.jobArrangement));
  if (hiredNow) $("#apps").insertAdjacentHTML("beforebegin", `<p class="notice">You're employed full-time as <strong>${esc(hiredNow.jobTitle)}</strong>. You can apply to part-time jobs, and to full-time jobs again once this job ends.</p>`);
  $("#apps").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ended]"); if (!b) return;
    const ok = await showDialog({ title: "Did this job end?", body: "We'll mark it as ended so you can apply to full-time jobs again.", actions: [{ label: "Cancel", value: false }, { label: "Yes, it ended", value: true, primary: true }] });
    if (!ok) return;
    try { await store.endEmployment(b.dataset.ended); myAppsCache = null; toast("Updated. You can apply to full-time jobs again."); viewApplications(); } catch { toast("Could not update"); }
  });
}

/* ---------------- Admin ---------------- */
let adminTab = "pending";
const adminJobs = {};
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
    list.forEach((j) => (adminJobs[j.id] = j));
    if (adminTab === "pending" && pendingForAdmin !== list.length) { pendingForAdmin = list.length; renderBell(); renderNav(); }
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
      const aj = adminJobs[id];
      if (act === "approve") {
        await store.approve(id);
        if (aj) store.notify(aj.ownerUid, { type: "job_approved", title: "Your job post is live", body: `${aj.title} is now visible to jobseekers for 30 days.`, link: `#/job/${id}`, jobId: id }).catch(() => {});
      }
      if (act === "reject") {
        await store.updateJob(id, { status: "rejected" });
        if (aj) store.notify(aj.ownerUid, { type: "job_rejected", title: "Your job post wasn't approved", body: `${aj.title} didn't meet our posting rules. Check the pay, details and contact, then post again.`, link: "#/my", jobId: id }).catch(() => {});
      }
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
  if (changed) { myAppsCache = null; startNotifications(); }
  if (changed && uidNow && location.hash === "#/signin") return finishAuthFlow();
  route();
});
store.init().catch((err) => {
  console.error(err);
  app.innerHTML = `<p class="error">Could not start the site. Please refresh.</p>`;
});
