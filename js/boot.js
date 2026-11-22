/* Start-up and global event wiring. */
(function () {
  const { S, C, $, $$, ic } = App;

  /* ---------- sign-in ---------- */
  async function login(e) {
    e.preventDefault();
    const name = $("#loginName").value.trim(), pass = $("#loginPass").value;
    const err = $("#loginError");
    const btn = $("#loginForm [type=submit]");
    err.hidden = true; btn.disabled = true;
    try {
      if (DB.mode === "supabase") {
        // Same original name/passcode UI; backend checks the passcode.
        const staff = await DB.authenticate(name, pass);
        S.user = staff.name; S.role = staff.role;
      } else {
        if (await U.sha256(pass) !== C.PASSCODE_SHA256) throw new Error("Incorrect demo passcode");
        S.user = name;
        try { sessionStorage.setItem("tcet_user", name); sessionStorage.setItem("tcet_auth", "1"); } catch (_) {}
      }
      start();
    } catch (ex) {
      err.textContent = ex.message || "Unable to sign in";
      err.hidden = false;
    } finally { btn.disabled = false; }
  }

  async function start() {
    $("#login").hidden = true; $("#app").hidden = false;
    S.user = S.user || sessionStorage.getItem("tcet_user") || "Event manager";
    $("#whoName").textContent = S.user; $("#whoAvatar").textContent = U.initials(S.user);
    App.syncThemeControls();
    $("#logoutBtn").innerHTML = ic("logout");
    const h = location.hash.slice(1);
    if (App.NAV.some((n) => n.id === h)) S.view = h;

    try {
      App.setSync("busy");
      App.showLoading();
      await App.loadEvents();
      await App.selectEvent(App.pickDefaultEvent());
      App.setSync("ok");
    } catch (err) {
      console.error(err);
      App.setSync("err", "Can't reach database");
      App.render();
      $("#view").setAttribute("aria-busy", "false");
      $("#view").innerHTML = `<div class="card"><div class="empty">${ic("alert")}<b>Couldn't load events</b>
        <p>${U.esc(err.message || String(err))}</p><p>Check the Supabase URL and key in <code>js/config.js</code>, the table names, and that Row Level Security allows reading.</p>
        <button class="btn btn-primary" data-act="retry">Try again</button></div></div>`;
    }
    clearInterval(S.fleetTimer);
    S.fleetTimer = setInterval(() => { if (!document.hidden && S.eventId) App.syncFleet(); }, 20000);
    clearInterval(S.pollTimer);
    S.pollTimer = setInterval(() => { if (!document.hidden && S.eventId && !S._busy) App.refresh(); }, Math.max(3, C.POLL_SECONDS) * 1000);
    // Updates time-window metrics without making another API request.
    clearInterval(S.liveTimer);
    S.liveTimer = setInterval(() => {
      if (document.hidden || !S.eventId) return;
      if (S.view === "wall" && App.views.updateWall) App.views.updateWall();
      if (S.view === "overview" && App.views.updateMission) App.views.updateMission();
    }, 15000);
  }

  /* ---------- clicks ---------- */
  document.addEventListener("click", (e) => {
    if (e.target.hasAttribute && e.target.hasAttribute("data-overlay")) { App.closeModal(); return; }
    const el = e.target.closest("[data-act]");
    if (!el) return;
    const act = el.dataset.act;
    if (act === "nav") { App.closeModal(); App.navigate(el.dataset.view); return; }
    if (act === "close") { App.closeModal(); return; }
    if (act === "retry") { start(); return; }
    if (act === "reset-demo") {
      App.confirm({ title: "Reset sample data?", body: "This replaces everything in demo mode with fresh sample events and registrations.", confirmLabel: "Reset", danger: true })
        .then(async (yes) => { if (yes) { DB.resetDemo(); await App.loadEvents(); await App.selectEvent(App.pickDefaultEvent()); App.toast("Sample data reset."); } });
      return;
    }
    const fn = App.actions[act];
    if (fn) fn(el, e);
  });

  document.addEventListener("submit", (e) => {
    const form = e.target;
    if (form.id === "loginForm") return login(e);
    if (form.dataset && form.dataset.form) { e.preventDefault(); const fn = App.forms[form.dataset.form]; if (fn) fn(form); }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && App.modalOpen()) {
      const no = $('[data-act="confirm-no"]');
      if (no) no.click(); else App.closeModal();
    }
    if (e.key === "Tab" && App.modalOpen()) {
      const dlg = $("#modalRoot [role=dialog]");
      if (!dlg) return;
      const els = [...dlg.querySelectorAll('a[href], button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')].filter(el => el.getClientRects().length > 0);
      if (!els.length) { e.preventDefault(); dlg.focus(); return; }
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && (document.activeElement === first || !dlg.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !dlg.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- inputs ---------- */
  const rerenderPeople = () => App.render({ soft: true });
  const onQ = U.debounce((val) => { S.q = val; S.page = 1; rerenderPeople(); }, 140);

  document.addEventListener("input", (e) => {
    if (e.target.id === "q") onQ(e.target.value);
  });
  document.addEventListener("change", async (e) => {
    const t = e.target;
    if (t.id === "fDept") { S.dept = t.value; S.page = 1; rerenderPeople(); }
    else if (t.id === "fYear") { S.year = t.value; S.page = 1; rerenderPeople(); }
    else if (t.id === "pageSize") { S.pageSize = Number(t.value); S.page = 1; rerenderPeople(); }
    else if (t.id === "selAll") {
      const rows = App.filteredRegs(), from = (S.page - 1) * S.pageSize;
      rows.slice(from, from + S.pageSize).forEach((r) => (t.checked ? S.selected.add(r.id) : S.selected.delete(r.id)));
      rerenderPeople();
    } else if (t.dataset && t.dataset.sel) { t.checked ? S.selected.add(t.dataset.sel) : S.selected.delete(t.dataset.sel); rerenderPeople(); }
    else if (t.id === "soundToggle") S.sound = t.checked;
    else if (t.id === "camSelect") { if (S.cam) { await App.views.stopCamera(); App.actions["cam-toggle"](); } }
    else if (t.name === "expset") { S.exportSet = t.value; App.render({ soft: true }); }
    else if (t.id === "eventSelect" || t.id === "eventSelectM") { await App.views.stopCamera(); App.selectEvent(t.value); }
  });

  $("#themeBtn").addEventListener("click", App.theme);
  $("#mobileThemeBtn").addEventListener("click", App.theme);
  $("#logoutBtn").addEventListener("click", App.signOut);
  $("#refreshBtn").addEventListener("click", async () => {
    if (["portfolio", "passes", "year"].includes(S.view) && App.loadPortfolio) {
      await App.loadPortfolio({ force: true });
      if (!S.portfolioError) App.toast("Event portfolio refreshed.");
      return;
    }
    try { await App.loadEvents(); } catch (e) { /* shown by refresh */ }
    await App.refresh({ force: true });
    App.toast("Up to date.");
  });
  window.addEventListener("pagehide", () => App.views.stopCamera && App.views.stopCamera());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && S.eventId && $("#app").hidden === false) { App.refresh(); App.syncFleet(); }
  });

  /* ---------- go ---------- */
  App.setLogos();
  if (DB.mode === "supabase") {
    // The original inputs and labels stay exactly as provided in index.html.
    DB.restoreSession().then(staff => {
      if (staff) { S.user = staff.name; S.role = staff.role; start(); }
      else App.showLogin();
    }).catch(() => App.showLogin());
  } else {
    let authed = false;
    try { authed = sessionStorage.getItem("tcet_auth") === "1"; } catch (_) {}
    if (authed) { S.user = sessionStorage.getItem("tcet_user"); start(); }
    else App.showLogin();
  }
})();
