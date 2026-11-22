/* ==========================================================================
   App core: state, icons, toasts, modals, data loading, navigation, sign-in.
   View code lives in views.js, exports in export.js, start-up in boot.js.
   ========================================================================== */
(function () {
  const C = window.APP_CONFIG;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- icons ---------- */
  const P = {
    overview: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
    scan: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3M21 21v.01M12 7v3a2 2 0 0 1-2 2H7M3 12h.01M12 3h.01M12 16v.01M16 12h1M21 12v.01M12 21v-1"/>',
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v18h18M18 17V9M13 17V5M8 17v-3"/>',
    calendar: '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    x: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2m-7.07-14.93 1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32 1.41-1.41"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>',
    copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    print: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/>',
    sheet: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    braces: '<path d="M8 3H7a2 2 0 0 0-2 2v5a2 2 0 0 1-2 2 2 2 0 0 1 2 2v5c0 1.1.9 2 2 2h1M16 21h1a2 2 0 0 0 2-2v-5c0-1.1.9-2 2-2a2 2 0 0 1-2-2V5a2 2 0 0 0-2-2h-1"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2"/>',
    up: '<path d="m18 15-6-6-6 6"/>',
    down: '<path d="m6 9 6 6 6-6"/>',
    hand: '<path d="M18 11V6a2 2 0 0 0-4 0M14 10V4a2 2 0 0 0-4 0v2M10 10.5V6a2 2 0 0 0-4 0v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/>',
    monitor: '<rect x="2" y="3" width="20" height="15" rx="2"/><path d="M8 22h8m-4-4v4M6 11l3-3 3 4 3-2 3-3"/>',
    devices: '<rect x="2" y="3" width="15" height="13" rx="2"/><path d="M6 21h7M9.5 16v5"/><rect x="18" y="9" width="4" height="12" rx="1"/>',
    palette: '<circle cx="13.5" cy="6.5" r="1.5"/><circle cx="17.5" cy="10.5" r="1.5"/><circle cx="8.5" cy="7.5" r="1.5"/><circle cx="6.5" cy="12.5" r="1.5"/><path d="M12 2a10 10 0 0 0 0 20h1a2 2 0 0 0 2-2 2 2 0 0 0-.8-1.6 1.8 1.8 0 0 1 .8-3.4H17a5 5 0 0 0 5-5A10 10 0 0 0 12 2Z"/>',
    spark: '<path d="M12 3 9.5 9.5 3 12l6.5 2.5L12 21l2.5-6.5L21 12l-6.5-2.5L12 3Z"/>'
  };
  const ic = (n) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ""}</svg>`;

  /* ---------- state ---------- */
  const S = {
    user: null, events: [], stats: {}, eventId: null, regs: [],
    view: "overview",
    // registrations view
    q: "", filter: "all", dept: "", year: "", sort: { key: "registeredAt", dir: "desc" }, page: 1, pageSize: 25, selected: new Set(),
    // export view
    exportSet: "all",
    // scanner
    scanLog: [], lastScan: null, cam: null, sound: true,
    unsub: null, pollTimer: null, liveTimer: null, sig: "",
    lastFetchAt: 0, fetchFailed: false,
    fleet: [], fleetLastAt: 0, fleetError: "", fleetBusy: false, fleetTimer: null, sessionScans: 0,
    portfolioEvents: [], portfolioStats: {}, portfolioBrands: {}, portfolioReady: false, portfolioBusy: false,
    portfolioError: "", passEventId: null, passQrFile: null, reportYear: null
  };
  const App = { S, C, $, $$, ic, views: {}, exporter: {} };
  window.App = App;
  // Device ID is a non-personal random identifier; stored for a stable desk label.
  function getClientId() {
    let id = ''; try { id = localStorage.getItem('tcet_scanner_client_v1') || ''; } catch (_) {}
    if (!/^[a-f0-9-]{36}$/i.test(id)) {
      if (!globalThis.crypto?.randomUUID) return null;
      id = globalThis.crypto.randomUUID();
      try { localStorage.setItem('tcet_scanner_client_v1', id); } catch (_) {}
    }
    return id;
  }
  S.clientId = getClientId();
  try { S.deviceLabel = localStorage.getItem('tcet_scanner_label_v1') || ''; } catch (_) { S.deviceLabel = ''; }
  if (!S.deviceLabel) S.deviceLabel = S.clientId ? 'Desk ' + S.clientId.slice(0, 5).toUpperCase() : 'This device';
  App.saveDeviceLabel = function (label) {
    const name = String(label || '').replace(/[\x00-\x1f<>]/g, '').trim().slice(0, 40);
    if (!name) throw new Error('Enter a desk name');
    S.deviceLabel = name;
    try { localStorage.setItem('tcet_scanner_label_v1', name); } catch (_) {}
  };
  App.syncFleet = async function () {
    if (S.fleetBusy || !S.eventId || !S.clientId || document.hidden || $('#app').hidden ||
        typeof DB.scannerHeartbeat !== 'function' || typeof DB.scannerFleet !== 'function') return;
    S.fleetBusy = true;
    const eid = S.eventId;
    try {
      await DB.scannerHeartbeat(eid, { clientId: S.clientId, label: S.deviceLabel,
        state: S.cam ? 'scanning' : 'idle', sessionScans: S.sessionScans });
      const response = await DB.scannerFleet(eid);
      if (eid !== S.eventId) return;
      S.fleet = Array.isArray(response) ? response : [];
      S.fleetLastAt = Date.now(); S.fleetError = '';
    } catch (err) {
      if (eid === S.eventId) S.fleetError = err?.message || 'Scanner presence unavailable';
    } finally {
      S.fleetBusy = false;
      if (S.view === 'fleet' && App.views.updateFleet) App.views.updateFleet();
    }
  };

  const NAV = [
    { id: "overview", label: "Overview", icon: "overview", title: "Live Mission Control" },
    { id: "scanner", label: "Scan", icon: "scan", title: "Scan check-ins" },
    { id: "people", label: "Registrations", icon: "people", title: "Registrations" },
    { id: "analytics", label: "Analytics", icon: "chart", title: "Analytics" },
    { id: "fleet", label: "Scanner Fleet", icon: "devices", title: "Scanner Fleet" },
    { id: "export", label: "Export", icon: "download", title: "Export" },
    { id: "wall", label: "Event Wall", icon: "monitor", title: "Event Wall" },
    { id: "portfolio", label: "Event Portfolio", icon: "calendar", title: "Event Portfolio" },
    { id: "passes", label: "Pass Studio", icon: "palette", title: "Digital Pass Studio" },
    { id: "year", label: "Year in Review", icon: "spark", title: "TCET Year in Review" }
  ];
  App.NAV = NAV;

  App.event = () => S.events.find((e) => e.id === S.eventId) || null;

  /* ---------- toasts & modals ---------- */
  App.toast = function (msg, kind = "ok") {
    const icon = kind === "ok" ? "check" : kind === "warn" ? "alert" : "x";
    const el = document.createElement("div");
    el.className = `toast ${kind}`; el.setAttribute("role", kind === "err" ? "alert" : "status");
    el.innerHTML = `${ic(icon)}<span>${U.esc(msg)}</span>`;
    $("#toasts").appendChild(el);
    setTimeout(() => el.remove(), kind === "err" ? 7000 : 3800);
  };

  let lastFocus = null;
  App.openModal = function (html, opts = {}) {
    App.closeModal();
    lastFocus = document.activeElement;
    const root = $("#modalRoot");
    root.innerHTML = `<div class="overlay ${opts.drawer ? "right" : ""}" data-overlay>
      <div class="${opts.drawer ? "drawer" : "modal"} ${opts.wide ? "wide" : ""}" role="dialog" aria-modal="true">${html}</div></div>`;
    const first = root.querySelector("[autofocus], input:not([type=hidden]), select, textarea, button");
    if (first && window.matchMedia("(pointer:fine)").matches) first.focus();
    return root.firstElementChild;
  };
  
App.closeModal = function () {
  if (S._parentScanSubmitting) return;

  if (S._parentScanPending) {
    S._parentScanPending = null;
    S._lastId = null;
  }

  const root = $("#modalRoot");

    if (!root.innerHTML) return;
    root.innerHTML = "";
    if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) { /* element gone */ }
  };
  App.modalOpen = () => !!$("#modalRoot").innerHTML;
  App.confirm = function ({ title, body, confirmLabel = "Confirm", danger = false }) {
    return new Promise((resolve) => {
      App.openModal(`<div class="modal-head"><div><h3>${U.esc(title)}</h3></div></div>
        <div class="modal-body"><p>${body}</p></div>
        <div class="modal-foot"><button class="btn" data-act="confirm-no">Cancel</button>
        <button class="btn ${danger ? "btn-danger" : "btn-primary"}" data-act="confirm-yes" autofocus>${U.esc(confirmLabel)}</button></div>`);
      const root = $("#modalRoot");
      const done = (v) => { root.removeEventListener("click", onClick); App.closeModal(); resolve(v); };
      const onClick = (e) => {
        const b = e.target.closest("[data-act]");
        if (b && b.dataset.act === "confirm-yes") done(true);
        else if ((b && (b.dataset.act === "confirm-no" || b.dataset.act === "close")) || e.target.hasAttribute("data-overlay")) done(false);
      };
      root.addEventListener("click", onClick);
    });
  };

  /* ---------- logo ---------- */
  App.setLogos = function () {
    $$("img[data-logo]").forEach((img) => {
      img.onerror = () => { img.onerror = null; img.src = C.ORG.logoFallback; };
      img.src = C.ORG.logo;
    });
  };

  /* ---------- sync indicator ---------- */
  App.setSync = function (state, text) {
    const el = $("#syncState"); if (!el) return;
    el.className = `sync ${state === "ok" ? "" : state}`;
    el.querySelector("span").textContent = text || (state === "ok" ? "Live" : state === "busy" ? "Updating…" : "Offline");
  };

  /* ---------- data loading ---------- */
  App.loadEvents = async function () {
    S.events = await DB.listEvents();
    try { S.stats = await DB.eventStats(); } catch (e) { S.stats = {}; }
    renderEventSelect();
  };

  function eventLabel(e) {
    const tag = e.status === "closed" ? " (closed)" : e.status === "draft" ? " (draft)" : "";
    return e.name + tag;
  }
  function renderEventSelect() {
    const opts = S.events.map((e) => `<option value="${e.id}" ${e.id === S.eventId ? "selected" : ""}>${U.esc(eventLabel(e))}</option>`).join("") ||
      `<option value="">No events yet</option>`;
    $("#eventSelect").innerHTML = opts;
    const m = $("#mobileEvent");
    if (m) m.innerHTML = S.events.length ? `<label class="mobile-event-label" for="eventSelectM">Live desk event</label><select id="eventSelectM" aria-label="Choose event">${opts}</select>` : "";
    const ev = App.event();
    $("#stubMeta").textContent = ev ? `${U.longDate(ev.eventDate)}${ev.venue ? " · " + ev.venue : ""}` : "Create an event to begin";
    App.renderEventContext();
  }
  App.renderEventSelect = renderEventSelect;

  function eventInitials(name) {
    return String(name || "EV").replace(/[^a-z0-9 ]/gi, " ").split(/\s+/).filter(Boolean).slice(0, 2)
      .map((part) => part.slice(0, 1).toUpperCase()).join("") || "EV";
  }
  App.renderEventContext = function () {
    const el = $("#eventContext"); if (!el) return;
    const ev = App.event();
    if (!ev) { el.hidden = true; el.textContent = ""; return; }
    const state = ev.status === "closed" ? "closed" : ev.status === "draft" ? "draft" : "open";
    const date = ev.eventDate ? U.longDate(ev.eventDate) : "Event selected";
    el.innerHTML = `<span class="event-monogram" aria-hidden="true">${U.esc(eventInitials(ev.name))}</span>` +
      `<span class="event-context-copy"><strong title="${U.esc(ev.name)}">${U.esc(ev.name)}</strong>` +
      `<span class="status-${state}">${state === "open" ? "Active" : state === "draft" ? "Draft" : "Closed"} · ${U.esc(date)}</span></span>`;
    el.hidden = false;
  };

  App.pickDefaultEvent = function () {
    let saved = null; try { saved = localStorage.getItem("tcet_event"); } catch (e) { /* ignore */ }
    if (saved && S.events.some((e) => e.id === saved)) return saved;
    const live = S.events.filter((e) => e.status === "active");
    const pool = live.length ? live : S.events;
    if (!pool.length) return null;
    const now = Date.now();
    return pool.slice().sort((a, b) => Math.abs(new Date(a.eventDate) - now) - Math.abs(new Date(b.eventDate) - now))[0].id;
  };

  App.signature = (regs) => {
    let att = 0, last = 0;
    regs.forEach((r) => { if (r.attended) { att++; const t = +new Date(r.attendedAt); if (t > last) last = t; } });
    return `${regs.length}|${att}|${last}`;
  };

  App.loadRegs = async function ({ silent = false } = {}) {
    if (!S.eventId) { S.regs = []; return false; }
    if (!silent) App.setSync("busy");
    try {
      const id = S.eventId;
      const regs = await DB.listRegistrations(id);
      if (id !== S.eventId) return false; // event switched while loading
      const sig = App.signature(regs);
      const changed = sig !== S.sig;
      S.regs = regs; S.sig = sig;
      S.lastFetchAt = Date.now(); S.fetchFailed = false;
      App.setSync("ok");
      return changed;
    } catch (e) {
      console.error(e); S.fetchFailed = true; App.setSync("err", "Can't reach database");
      if (!silent) App.toast("Couldn't load registrations. " + (e.message || ""), "err");
      return false;
    }
  };

  App.selectEvent = async function (id, { go } = {}) {
    S.eventId = id || null;
    try { localStorage.setItem("tcet_event", id || ""); } catch (e) { /* ignore */ }
    S.selected.clear(); S.page = 1; S.scanLog = []; S.lastScan = null; S.sig = "";
    S.sessionScans = 0; S.fleet = []; S.fleetLastAt = 0; S.fleetError = "";
    if (!S.cam) App.showLoading();
    if (S.unsub) { S.unsub(); S.unsub = null; }
    renderEventSelect();
    await App.loadRegs();
    if (S.eventId) S.unsub = DB.subscribe(S.eventId, U.debounce(() => App.refresh(), 600));
    if (go) S.view = go;
    App.render();
    App.syncFleet();
  };

  App.refresh = async function ({ force = false } = {}) {
    // Portfolio pages only need occasional aggregate refreshes, not the live
    // student roster. Avoid needless PII requests and re-rendering edited forms.
    if (["portfolio", "passes", "year"].includes(S.view) && typeof App.loadPortfolio === "function") {
      await App.loadPortfolio({ quiet: true, force });
      return;
    }
    if (!S.eventId) return;
    try { S.stats = await DB.eventStats(); } catch (e) { /* non-fatal */ }
    const changed = await App.loadRegs({ silent: !force });
    if (changed || force) App.render({ soft: true });
  };

  /* ---------- navigation / rendering ---------- */
  App.navigate = function (view) {
    if (S.view === "scanner" && view !== "scanner") App.views.stopCamera && App.views.stopCamera();
    if (S.view === "wall" && view !== "wall" && document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    }
    S.view = view;
    try { history.replaceState(null, "", "#" + view); } catch (e) { /* file:// restrictions */ }
    App.render();
    const main = $("#view");
    if (main && main.focus) try { main.focus({ preventScroll: true }); } catch (_) { /* ignore */ }
    window.scrollTo(0, 0);
  };

  function renderNav() {
    const html = NAV.map((n) => `<button data-act="nav" data-view="${n.id}" ${S.view === n.id ? 'aria-current="page"' : ""}>${ic(n.icon)}<span>${n.label}</span></button>`).join("");
    $("#nav").innerHTML = html;
    const shortNames = { overview: 'Home', scanner: 'Scan', people: 'People', analytics: 'Stats',
      fleet: 'Fleet', export: 'Export', wall: 'Wall', portfolio: 'Events', passes: 'Passes', year: 'Year' };
    const bottom = $("#bottomNav"), previousScroll = bottom.scrollLeft;
    bottom.innerHTML = NAV.map(n => `<button data-act="nav" data-view="${n.id}" ${S.view===n.id?'aria-current="page"':''}>${ic(n.icon)}<span>${shortNames[n.id]||n.label}</span></button>`).join('');
    bottom.scrollLeft = previousScroll;
    const active = bottom.querySelector('[aria-current="page"]');
    if (active && (active.offsetLeft < bottom.scrollLeft || active.offsetLeft + active.offsetWidth > bottom.scrollLeft + bottom.clientWidth))
      bottom.scrollLeft = Math.max(0, active.offsetLeft - bottom.clientWidth / 2);
  }

  App.showLoading = function () {
    const v = $("#view");
    if (!v || S.cam) return;
    v.setAttribute("aria-busy", "true");
    v.classList.remove("page-enter");
    v.innerHTML = `<div class="loading-view" role="status" aria-label="Loading event dashboard"><span class="loading-label">Loading event dashboard…</span><div class="loading-hero" aria-hidden="true"></div><div class="loading-bar" aria-hidden="true"></div><div class="loading-grid" aria-hidden="true"><div class="loading-block"></div><div class="loading-block"></div></div></div>`;
  };

  App.render = function ({ soft = false } = {}) {
    $("#app").classList.toggle("wall-view", S.view === "wall");
    renderNav();
    const nav = NAV.find((n) => n.id === S.view) || NAV[0];
    const ev = App.event();
    $("#pageTitle").textContent = nav.title;
    const portfolioPages = { portfolio: "Year-round event planning and comparisons", passes: "Event branding · original QR required", year: "Aggregate academic-year highlights" };
    $("#pageSub").textContent = portfolioPages[S.view] || (ev && S.view !== "events" ? `${ev.name}${ev.venue ? " · " + ev.venue : ""} · ${U.untilEvent(ev.eventDate)}` :
      S.view === "events" ? "Create, edit and switch between events" : "");
    renderEventSelect();
    const main = $("#view");
    main.setAttribute("aria-busy", "false");
    main.classList.toggle("page-enter", !soft);

    const banner = $("#demoBanner");
    if (DB.mode === "demo") {
      banner.hidden = false;
      banner.innerHTML = `<span><b>Demo mode.</b> You're looking at sample data saved in this browser. Add the Supabase URL and key in <code>js/config.js</code> to connect the real database.</span><button data-act="reset-demo">Reset sample data</button>`;
    } else banner.hidden = true;

    Charts.destroyAll();
    const fn = App.views[S.view];
    if (fn) fn({ soft });
  };

  /* ---------- sign-in ---------- */
  App.showLogin = function () {
    $("#app").hidden = true; $("#login").hidden = false;
    setTimeout(() => $("#loginName").focus(), 30);
  };
  App.signOut = async function () {
    App.views.stopCamera && App.views.stopCamera();
    try { if (DB.mode === "supabase") await DB.signOut(); } catch (_) {}
    try { sessionStorage.removeItem("tcet_user"); sessionStorage.removeItem("tcet_auth"); } catch (_) {}
    clearInterval(S.pollTimer); clearInterval(S.liveTimer); clearInterval(S.fleetTimer); if (S.unsub) S.unsub();
    Charts.destroyAll();
    location.reload();
  };
  App.syncThemeControls = function () {
    const dark = document.documentElement.getAttribute("data-theme") === "dark";
    ["#themeBtn", "#mobileThemeBtn"].forEach((id) => {
      const btn = $(id); if (!btn) return;
      btn.innerHTML = ic(dark ? "sun" : "moon");
      btn.title = dark ? "Switch to light theme" : "Switch to dark theme";
      btn.setAttribute("aria-label", btn.title);
      btn.setAttribute("aria-pressed", String(dark));
    });
    const themeMeta = document.querySelector('meta[name="theme-color"]');
    if (themeMeta) themeMeta.content = dark ? "#0e1913" : "#172721";
  };

  App.theme = function () {
    const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem("tcet_theme", next); } catch (e) { /* ignore */ }
    App.syncThemeControls();
    if (!$("#app").hidden) App.render({ soft: true });
  };
})();
