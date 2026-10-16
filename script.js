/* ===== Supabase (PUBLIC values only; never put the secret key or DB password here) ===== */
const SB_URL = "https://plrligzbkudtoepzoiae.supabase.co";
const SB_KEY = "sb_publishable_uyiQFRMdaXl81hoJ3aQlng_yUMz-_TP";
const SESSION_KEY = "carey-sb-session";
const SKILL_COLORS = { PHP: "#7a86c8", WordPress: "#21759b", MySQL: "#e48c00", "HTML / CSS": "#e34c26", JavaScript: "#c9b400", "Deno / Node.js": "#3c873a", "Git & GitHub": "#333", "REST APIs": "#0c3a63", Figma: "#a259ff" };

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const year = new Date().getFullYear();

let data = { settings: { about: "", about_secondary: "", skills: [] }, projects: [], certificates: [], cats: [] };

/* ===== Auth + API helpers ===== */
let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null"); } catch {}
function setSession(s) {
  session = s ? { access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + s.expires_in } : null;
  session ? localStorage.setItem(SESSION_KEY, JSON.stringify(session)) : localStorage.removeItem(SESSION_KEY);
}
async function ensureSession() {
  if (!session) return false;
  if (Date.now() / 1000 < session.expires_at - 60) return true;
  try {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: session.refresh_token }) });
    if (!r.ok) throw 0;
    setSession(await r.json()); return true;
  } catch { setSession(null); return false; }
}
const authHeaders = (extra = {}) => ({ apikey: SB_KEY, ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}), ...extra });
async function api(path, { method = "GET", body, prefer } = {}) {
  await ensureSession();
  const r = await fetch(`${SB_URL}/rest/v1/${path}`, { method, headers: authHeaders({ "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) }), body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(await r.text());
  return method === "GET" ? r.json() : null;
}
const publicUrl = (path) => `${SB_URL}/storage/v1/object/public/cats/${path}`;

async function loadAll() {
  try {
    const [s, p, c, k] = await Promise.all([
      api("site_settings?id=eq.1&select=*"), api("projects?select=*&order=created_at.desc"),
      api("certificates?select=*&order=created_at.desc"), api("cats?select=*&order=created_at.desc"),
    ]);
    if (s[0]) data.settings = s[0];
    data.projects = p; data.certificates = c; data.cats = k;
  } catch (e) { console.error(e); $("#projectGrid").innerHTML = `<p class="muted">Couldn't load content right now.</p>`; return; }
  renderSite();
}

/* ===== Public site ===== */
function renderSite() {
  const st = data.settings;
  $("#about").textContent = st.about || "";
  $("#aboutSecondary").textContent = st.about_secondary || "";
  $("#skills").innerHTML = (st.skills || []).map((s) => `<span style="background:${SKILL_COLORS[s] || "#0c3a63"}">${esc(s)}</span>`).join("");
  $("#projectGrid").innerHTML = data.projects.length ? data.projects.map((p) => `
    <div class="card">
      <div class="meta"><span>Web Dev</span><span>${esc(p.year)}</span></div>
      <h3>${esc(p.title)}</h3><p>${esc(p.description)}</p>
      <div class="chips">${(p.stack || []).map((s) => `<span>${esc(s)}</span>`).join("")}</div>
      ${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noreferrer">Visit website →</a>` : ""}
    </div>`).join("") : `<p class="muted">Projects are coming soon.</p>`;
  $("#certs").hidden = !data.certificates.length;
  $("#certGrid").innerHTML = data.certificates.map((c) => `
    <article class="cert"><div class="mark">C</div><div><small>${esc(c.year)}</small><h3>${esc(c.title)}</h3><p>${esc(c.issuer)}</p>
    ${c.url ? `<a href="${esc(c.url)}" target="_blank" rel="noreferrer">View credential</a>` : ""}</div></article>`).join("");
  $("#openCats").hidden = !data.cats.length;
}

window.addEventListener("scroll", () => $("#header").classList.toggle("scrolled", scrollY > 8), { passive: true });
$("#burger").onclick = () => $("#navLinks").classList.toggle("open");
$("#navLinks").addEventListener("click", (e) => { if (e.target.tagName === "A") $("#navLinks").classList.remove("open"); });

let clicks = 0, clickTimer;
$("#secret").onclick = () => {
  clearTimeout(clickTimer);
  if (++clicks >= 3) { clicks = 0; location.hash = "#admin"; return; }
  clickTimer = setTimeout(() => (clicks = 0), 1600);
};

/* ===== Guest log ===== */
let lastPost = 0;
async function loadEntries() {
  try {
    const rows = await api("guestbook?select=name,message,created_at&order=created_at.desc&limit=50");
    $("#entries").innerHTML = rows.length
      ? rows.map((e) => `<div class="entry"><div><b>${esc(e.name)}</b><small>${new Date(e.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></div><p>${esc(e.message)}</p></div>`).join("")
      : `<p class="muted">No messages yet. Be the first!</p>`;
  } catch { $("#entries").innerHTML = `<p class="muted">Couldn't load messages right now.</p>`; }
}
$("#guestForm").onsubmit = async (e) => {
  e.preventDefault();
  const btn = $("#gBtn"), label = "Leave a message in the Guest log!";
  if (Date.now() - lastPost < 30000) { btn.textContent = "Please wait a moment..."; setTimeout(() => (btn.textContent = label), 2000); return; }
  const name = $("#gName").value.trim().slice(0, 50), message = $("#gMsg").value.trim().slice(0, 500);
  if (!name || !message) return;
  btn.disabled = true; btn.textContent = "Sending...";
  try { await api("guestbook", { method: "POST", body: { name, message }, prefer: "return=minimal" }); lastPost = Date.now(); e.target.reset(); btn.textContent = "✓ Message sent!"; loadEntries(); }
  catch { btn.textContent = "Couldn't send. Try again"; }
  setTimeout(() => { btn.textContent = label; btn.disabled = false; }, 2500);
};

$("#copyEmail").onclick = () => {
  navigator.clipboard?.writeText("careydayrit@email.com");
  const h = $("#copyHint"); h.textContent = "Copied!"; h.classList.add("ok");
  setTimeout(() => { h.textContent = "Click to copy"; h.classList.remove("ok"); }, 2000);
};

/* ===== Cat gallery ===== */
let active = null;
function openGallery() {
  $("#galleryCount").textContent = `${data.cats.length} photos · click a photo to enlarge · use arrow keys to navigate`;
  $("#galleryGrid").innerHTML = data.cats.map((c, i) => `<div class="tile" data-i="${i}"><img src="${esc(c.src)}" alt="${esc(c.name)}"><span>${esc(c.name)}</span></div>`).join("");
  $("#gallery").hidden = false; document.body.style.overflow = "hidden";
}
function closeGallery() { $("#gallery").hidden = true; $("#lightbox").hidden = true; active = null; document.body.style.overflow = ""; }
function showCat(i) {
  const n = data.cats.length; active = (i + n) % n; const c = data.cats[active];
  const img = $("#lbImg"); img.src = c.src; img.alt = c.name;
  $("#lbName").textContent = c.name; $("#lbCap").textContent = c.caption || ""; $("#lbNum").textContent = `${active + 1} / ${n}`;
  $("#lightbox").hidden = false;
}
$("#openCats").onclick = () => data.cats.length && openGallery();
$("#closeGallery").onclick = closeGallery;
$("#galleryGrid").onclick = (e) => { const t = e.target.closest(".tile"); if (t) showCat(+t.dataset.i); };
$("#gallery").onclick = (e) => { if (e.target.id === "gallery") closeGallery(); };
$("#lightbox").onclick = (e) => { if (e.target.id === "lightbox") { $("#lightbox").hidden = true; active = null; } };
$("#prevCat").onclick = (e) => { e.stopPropagation(); showCat(active - 1); };
$("#nextCat").onclick = (e) => { e.stopPropagation(); showCat(active + 1); };
document.addEventListener("keydown", (e) => {
  if ($("#gallery").hidden) return;
  if (e.key === "Escape") active !== null ? (($("#lightbox").hidden = true), (active = null)) : closeGallery();
  if (e.key === "ArrowRight" && active !== null) showCat(active + 1);
  if (e.key === "ArrowLeft" && active !== null) showCat(active - 1);
});

/* ===== Admin (real Supabase login; writes are blocked by the database unless signed in) ===== */
let section = "overview", savedTimer;
function flashSaved() { const s = $("#saved"); s.classList.add("show"); clearTimeout(savedTimer); savedTimer = setTimeout(() => s.classList.remove("show"), 1800); }

async function route() {
  const admin = location.hash === "#admin";
  $("#site").hidden = admin; $("#admin").hidden = !admin;
  if (!admin) return;
  const ok = await ensureSession();
  $("#login").hidden = ok; $("#shell").hidden = !ok;
  if (ok) renderAdmin();
}
addEventListener("hashchange", route);

$("#loginForm").onsubmit = async (e) => {
  e.preventDefault();
  try {
    const r = await fetch(`${SB_URL}/auth/v1/token?grant_type=password`, { method: "POST", headers: { apikey: SB_KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email: $("#email").value.trim(), password: $("#pw").value }) });
    if (!r.ok) throw 0;
    setSession(await r.json()); $("#pw").value = ""; $("#pwErr").hidden = true; route();
  } catch { $("#pwErr").hidden = false; $("#pw").value = ""; }
};
$("#pw").oninput = () => ($("#pwErr").hidden = true);
$("#logout").onclick = () => { setSession(null); route(); };
$("#adminNav").onclick = (e) => { const b = e.target.closest("button"); if (b) { section = b.dataset.s; renderAdmin(); } };

async function act(fn) {
  try { await fn(); await loadAll(); renderAdmin(); flashSaved(); }
  catch (err) { console.error(err); alert("Could not save. Are you still logged in?\n" + (err.message || "")); }
}
const fd = (form) => Object.fromEntries(new FormData(form));

async function renderAdmin() {
  document.querySelectorAll("#adminNav button").forEach((b) => b.classList.toggle("on", b.dataset.s === section));
  $("#adminTitle").textContent = $(`#adminNav [data-s="${section}"]`).textContent;
  const body = $("#adminBody"), st = data.settings;
  const del = (kind, id) => `<button class="del" data-del="${kind}" data-id="${esc(id)}">Delete</button>`;
  const empty = (t) => `<div class="acard"><h3>${t}</h3><p class="muted">Use the form to add your first one.</p></div>`;

  if (section === "overview") {
    body.innerHTML = `<div class="welcome"><p class="kicker light">Good to see you</p><h2>Keep your world up to date.</h2><p class="body soft">Everything you change here is saved to your database and appears for every visitor right away.</p></div>
    <div class="stats">${[["Cats", data.cats.length, "cats"], ["Skills", (st.skills || []).length, "about"], ["Projects", data.projects.length, "projects"], ["Certificates", data.certificates.length, "certificates"]].map(([l, n, s]) => `<button data-go="${s}"><b>${n}</b><span>${l}</span></button>`).join("")}</div>`;
  }
  if (section === "cats") {
    body.innerHTML = `<div class="acols"><form class="acard afrm" id="fCat"><h2>Meet a new friend</h2>
      <label>Cat's name<input name="name" required placeholder="e.g. Mochi"></label>
      <label>Short caption<input name="caption" placeholder="A professional napper"></label>
      <label>Photo (max 5 MB)<input name="photo" type="file" accept="image/*" required></label>
      <button class="pill pill-navy" type="submit">Add to gallery</button></form>
      <div class="alist">${data.cats.length ? data.cats.map((c) => `<article class="arow"><img src="${esc(c.src)}" alt=""><div><h3>${esc(c.name)}</h3><p>${esc(c.caption || "No caption")}</p></div>${del("cats", c.id)}</article>`).join("") : empty("No cats yet")}</div></div>`;
    $("#fCat").onsubmit = (e) => {
      e.preventDefault(); const f = e.target, file = f.photo.files[0];
      if (!file) return; if (file.size > 5 * 1024 * 1024) return alert("Please choose a photo under 5 MB.");
      act(async () => {
        await ensureSession();
        const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const up = await fetch(`${SB_URL}/storage/v1/object/cats/${path}`, { method: "POST", headers: authHeaders({ "Content-Type": file.type }), body: file });
        if (!up.ok) throw new Error(await up.text());
        await api("cats", { method: "POST", body: { name: f.name.value.trim(), caption: f.caption.value.trim(), path, src: publicUrl(path) }, prefer: "return=minimal" });
      });
    };
  }
  if (section === "about") {
    body.innerHTML = `<div class="acols"><form class="acard afrm" id="fAbout"><h2>Edit About Me</h2>
      <label>Primary bio<textarea name="about" rows="6">${esc(st.about)}</textarea></label>
      <label>Secondary bio<textarea name="about_secondary" rows="5">${esc(st.about_secondary)}</textarea></label>
      <button class="pill pill-navy" type="submit">Save bio</button></form>
      <div class="acard"><h2>Programming languages &amp; skills</h2>
      <form class="inline" id="fSkill"><input name="skill" placeholder="Add PHP, Laravel, React..."><button class="pill pill-navy" type="submit">Add</button></form>
      <div class="atags">${(st.skills || []).map((s, i) => `<span>${esc(s)}<button data-del="skills" data-id="${i}" aria-label="Remove ${esc(s)}">×</button></span>`).join("")}</div></div></div>`;
    $("#fAbout").onsubmit = (e) => { e.preventDefault(); const v = fd(e.target); act(() => api("site_settings?id=eq.1", { method: "PATCH", body: { about: v.about, about_secondary: v.about_secondary }, prefer: "return=minimal" })); };
    $("#fSkill").onsubmit = (e) => { e.preventDefault(); const v = e.target.skill.value.trim(); if (v) act(() => api("site_settings?id=eq.1", { method: "PATCH", body: { skills: [...(st.skills || []), v] }, prefer: "return=minimal" })); };
  }
  if (section === "projects") {
    body.innerHTML = `<div class="acols"><form class="acard afrm" id="fProj"><h2>Add a website project</h2>
      <label>Project name<input name="title" required placeholder="Client portfolio website"></label>
      <label>Description<textarea name="description" rows="4" required placeholder="What you built and the result..."></textarea></label>
      <label>Programming languages<input name="stack" placeholder="PHP, WordPress, JavaScript"></label>
      <div class="row2"><label>Year<input name="year" value="${year}"></label><label>Website URL<input name="url" type="url" placeholder="https://"></label></div>
      <button class="pill pill-navy" type="submit">Publish project</button></form>
      <div class="alist">${data.projects.length ? data.projects.map((p) => `<article class="arow"><div><small>${esc(p.year)}</small><h3>${esc(p.title)}</h3><p>${esc(p.description)}</p><small>${esc((p.stack || []).join(" · "))}</small></div>${del("projects", p.id)}</article>`).join("") : empty("No projects yet")}</div></div>`;
    $("#fProj").onsubmit = (e) => { e.preventDefault(); const v = fd(e.target);
      act(() => api("projects", { method: "POST", prefer: "return=minimal", body: { title: v.title.trim(), description: v.description.trim(), stack: v.stack.split(",").map((s) => s.trim()).filter(Boolean), year: v.year || String(year), url: v.url.trim() } })); };
  }
  if (section === "certificates") {
    body.innerHTML = `<div class="acols"><form class="acard afrm" id="fCert"><h2>Add a certificate</h2>
      <label>Certificate name<input name="title" required placeholder="Responsive Web Design"></label>
      <label>Issued by<input name="issuer" required placeholder="freeCodeCamp"></label>
      <div class="row2"><label>Year<input name="year" value="${year}"></label><label>Credential URL<input name="url" type="url" placeholder="https://"></label></div>
      <button class="pill pill-navy" type="submit">Add certificate</button></form>
      <div class="alist">${data.certificates.length ? data.certificates.map((c) => `<article class="arow"><div><small>${esc(c.year)}</small><h3>${esc(c.title)}</h3><p>${esc(c.issuer)}</p></div>${del("certificates", c.id)}</article>`).join("") : empty("No certificates yet")}</div></div>`;
    $("#fCert").onsubmit = (e) => { e.preventDefault(); const v = fd(e.target);
      act(() => api("certificates", { method: "POST", prefer: "return=minimal", body: { title: v.title.trim(), issuer: v.issuer.trim(), year: v.year || String(year), url: v.url.trim() } })); };
  }
  if (section === "guestbook") {
    body.innerHTML = `<p class="muted">Loading messages...</p>`;
    try {
      const rows = await api("guestbook?select=*&order=created_at.desc&limit=100");
      if (section !== "guestbook") return;
      body.innerHTML = `<div class="alist">${rows.length ? rows.map((g) => `<article class="arow"><div><small>${new Date(g.created_at).toLocaleString()}</small><h3>${esc(g.name)}</h3><p>${esc(g.message)}</p></div>${del("guestbook", g.id)}</article>`).join("") : empty("No messages yet")}</div>`;
    } catch { body.innerHTML = `<p class="muted">Couldn't load messages.</p>`; }
  }
}

$("#adminBody").addEventListener("click", (e) => {
  const d = e.target.closest("[data-del]"), g = e.target.closest("[data-go]");
  if (g) { section = g.dataset.go; renderAdmin(); }
  if (!d) return;
  const k = d.dataset.del, id = d.dataset.id;
  if (k !== "skills" && !confirm("Delete this permanently?")) return;
  act(async () => {
    if (k === "skills") return api("site_settings?id=eq.1", { method: "PATCH", prefer: "return=minimal", body: { skills: data.settings.skills.filter((_, i) => i !== +id) } });
    const cat = k === "cats" ? data.cats.find((c) => c.id === id) : null;
    await api(`${k}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
    if (cat?.path) fetch(`${SB_URL}/storage/v1/object/cats/${cat.path}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
  });
});

/* init */
loadAll(); loadEntries(); setInterval(loadEntries, 30000); route();
