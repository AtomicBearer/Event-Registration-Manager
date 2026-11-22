/* ==========================================================================
   Views: overview, scanner, registrations, analytics, events.
   ========================================================================== */
(function () {
  const { S, C, $, $$, ic } = App;
  const esc = U.esc;
  App.actions = {};
  App.forms = {};
  const A = App.actions;
  const V = App.views;
  const canAdmin = () => DB.mode === "demo" || S.role === "admin";

  /* ---------- shared calculations ---------- */
  const calc = (regs) => {
    const total = regs.length, att = regs.filter((r) => r.attended).length;
    const manual = regs.filter((r) => r.attended && r.checkInMethod === "manual").length;
    return { total, att, notYet: total - att, rate: U.pct(att, total), manual, qr: att - manual };
  };
  App.calc = calc;

  function groupBy(regs, key, order) {
    const m = new Map();
    regs.forEach((r) => {
      const k = (r[key] || "").toString().trim() || "Not given";
      const g = m.get(k) || { label: k, total: 0, att: 0 };
      g.total++; if (r.attended) g.att++; m.set(k, g);
    });
    let rows = [...m.values()];
    if (order) rows.sort((a, b) => (order.indexOf(a.label) + 99) % 99 - (order.indexOf(b.label) + 99) % 99);
    else rows.sort((a, b) => b.total - a.total);
    return rows;
  }
  App.groupBy = groupBy;

  function arrivals(regs) {
    const times = regs.filter((r) => r.attendedAt).map((r) => +new Date(r.attendedAt)).sort((a, b) => a - b);
    if (!times.length) return { labels: [], data: [], step: 0, starts: [] };
    const span = times[times.length - 1] - times[0];
    const stepMin = span < 3 * 3600e3 ? 10 : span < 10 * 3600e3 ? 30 : 60;
    const step = stepMin * 60000;
    const start = Math.floor(times[0] / step) * step;
    const n = Math.min(Math.floor((times[times.length - 1] - start) / step) + 1, 240);
    const data = new Array(n).fill(0);
    times.forEach((t) => data[Math.min(Math.floor((t - start) / step), n - 1)]++);
    const starts = data.map((_, i) => start + i * step);
    const labels = starts.map((s) => (span > 20 * 3600e3 ? U.dateTime(s) : U.time(s)));
    return { labels, data, step, starts };
  }

  function registrationTimeline(regs) {
    if (!regs.length) return { labels: [], data: [] };
    const days = new Map();
    regs.forEach((r) => { const d = new Date(r.registeredAt); d.setHours(0, 0, 0, 0); days.set(+d, (days.get(+d) || 0) + 1); });
    const keys = [...days.keys()].sort((a, b) => a - b);
    const labels = [], data = [];
    let cum = 0;
    for (let t = keys[0], i = 0; t <= keys[keys.length - 1] && i < 150; t += 86400000, i++) {
      cum += days.get(t) || 0; labels.push(U.day(t)); data.push(cum);
    }
    return { labels, data };
  }

  const byAttendedDesc = (a, b) => new Date(b.attendedAt) - new Date(a.attendedAt);
  const stamp = (v) => (v ? U.dateTime(v) : "—");
  const methodLabel = (m) => (m === "manual" ? "Manual" : m === "qr" ? "QR scan" : "—");

  const noEvent = () => `<div class="card"><div class="empty">${ic("calendar")}<b>No event selected</b>
    <p>Create your first event to start tracking registrations and check-ins.</p>
    <button class="btn btn-primary" data-act="new-event">${ic("plus")}New event</button></div></div>`;

  const chartCard = (id, title, sub, cls = "") => `<section class="card chart-card" data-chart="${id}">
    <div class="card-head"><div><h3>${title}</h3>${sub ? `<p>${sub}</p>` : ""}</div>
    <div class="chart-tools"><button type="button" aria-pressed="true">Chart</button><button type="button" aria-pressed="false">Table</button></div></div>
    <div class="chart-body ${cls}"><canvas role="img" aria-label="${esc(title)}"></canvas></div></section>`;

  const statusBadge = (r) => r.attended
    ? `<span class="badge good">${ic("check")}Present</span>`
    : `<span class="badge neutral">Not yet</span>`;

  /* ======================================================================
     PHASE 2: Live, aggregation-only operations metrics.
     Backend remains the source of truth; all quantities come from the
     currently selected event's already-authorized registration records.
     ====================================================================== */
  function liveMetrics(now = Date.now()) {
    const st = calc(S.regs);
    const valid = (v) => {
      const ms = Date.parse(v || "");
      return Number.isFinite(ms) && ms <= now && ms > 0 ? ms : null;
    };
    const arrivalTimes = S.regs.map((r) => valid(r.attendedAt)).filter((n) => n !== null);
    const registrations = S.regs.map((r) => valid(r.registeredAt)).filter((n) => n !== null);
    const within = (times, minutes) => times.filter((t) => now - t < minutes * 60000).length;
    const minute = within(arrivalTimes, 1);
    const five = within(arrivalTimes, 5);
    const fifteen = within(arrivalTimes, 15);
    const hour = within(arrivalTimes, 60);
    const newHour = within(registrations, 60);
    const bucketMs = 5 * 60000;
    const endBucket = Math.floor(now / bucketMs) * bucketMs;
    const bins = Array.from({ length: 12 }, (_, i) => ({
      start: endBucket - (11 - i) * bucketMs, count: 0
    }));
    for (const t of arrivalTimes) {
      const offset = Math.floor(t / bucketMs) - Math.floor(endBucket / bucketMs) + 11;
      if (offset >= 0 && offset < bins.length) bins[offset].count++;
    }
    const peaks = new Map();
    for (const t of arrivalTimes) {
      const key = Math.floor(t / bucketMs) * bucketMs;
      peaks.set(key, (peaks.get(key) || 0) + 1);
    }
    let peak = null;
    for (const [start, count] of peaks) {
      if (!peak || count > peak.count || (count === peak.count && start > peak.start)) peak = { start, count };
    }
    const fresh = !!S.lastFetchAt && !S.fetchFailed && now - S.lastFetchAt <= Math.max(90000, Number(C.POLL_SECONDS || 15) * 3000);
    return { ...st, minute, five, fifteen, hour, newHour, bins, peak,
      fresh, lastFetchAt: S.lastFetchAt, maxBin: Math.max(1, ...bins.map((b) => b.count)) };
  }

  // Always display the data connection accurately; never suggest a fresh
  // successful fetch when the last fetch failed or the data is stale.
  function freshnessLabel(m) {
    if (!m.lastFetchAt) return "Waiting for first database update";
    if (S.fetchFailed) return "Connection lost — displaying last known counts";
    if (!m.fresh) return "Data may be delayed — last successful update " + U.ago(m.lastFetchAt);
    return "Updated " + U.ago(m.lastFetchAt);
  }

  function opsBars(m, wall = false) {
    return `<div class="ops-bars ${wall ? "ops-bars-wall" : ""}" role="img" aria-label="Check-ins per five-minute interval over the last hour: ${m.bins.map(b => b.count).join(', ')}">
      ${m.bins.map((b, i) => `<div class="ops-bar-col" title="${U.time(b.start)} · ${b.count} check-ins">
        <div class="ops-bar-track"><i style="height:${Math.max(b.count ? 12 : 2, 100 * b.count / m.maxBin)}%"></i></div>
        ${i === 0 || i === 5 || i === 11 ? `<span>${U.time(b.start)}</span>` : '<span aria-hidden="true">&nbsp;</span>'}
      </div>`).join('')}
    </div>`;
  }

  function missionPulse(m) {
    return `<section class="mission-panel" aria-label="Live entry velocity">
      <div class="mission-heading"><div><span class="mission-eyebrow">LIVE OPERATIONS</span><h3>Entry velocity</h3></div>
        <span class="live-fresh ${m.fresh ? "" : "is-stale"}"><i aria-hidden="true"></i>${esc(freshnessLabel(m))}</span></div>
      <div class="mission-kpis">
        <div><span>Last 60 seconds</span><strong class="mono">${U.num(m.minute)}</strong><small>check-ins / minute</small></div>
        <div><span>Last 5 minutes</span><strong class="mono">${U.num(m.five)}</strong><small>verified arrivals</small></div>
        <div><span>Last 15 minutes</span><strong class="mono">${U.num(m.fifteen)}</strong><small>verified arrivals</small></div>
        <div><span>New registrations / hour</span><strong class="mono">${U.num(m.newHour)}</strong><small>form registrations</small></div>
      </div>
      <div class="mission-chart-title"><strong>Arrival activity</strong><span>5-minute intervals · past hour</span></div>
      ${opsBars(m)}
      <div class="mission-foot"><span>${m.peak ? `Peak 5-min slot: <b>${U.num(m.peak.count)} arrivals</b> at ${U.time(m.peak.start)}` : 'Peak activity appears after the first check-in'}</span>
      <button class="btn btn-sm btn-ghost" type="button" data-act="nav" data-view="wall">${ic("monitor")} Open Event Wall</button></div>
    </section>`;
  }

  V.updateMission = () => {
    const target = $("#missionPanel");
    if (target && S.view === "overview") target.innerHTML = missionPulse(liveMetrics());
  };

  /* ======================================================================
     OVERVIEW
     ====================================================================== */
  V.overview = function () {
    const v = $("#view"), ev = App.event();
    if (!ev) { v.innerHTML = noEvent(); return; }
    const st = calc(S.regs);
    const last15 = S.regs.filter((r) => r.attendedAt && Date.now() - new Date(r.attendedAt) <= 15 * 60000).length;
    const latest = S.regs.filter((r) => r.attended).sort(byAttendedDesc);
    const new24 = S.regs.filter((r) => Date.now() - new Date(r.registeredAt) <= 86400000).length;
    const capNote = ev.capacity ? `${U.pct(st.total, ev.capacity)}%` : null;

    v.innerHTML = `
    <div class="stack">
      <section class="hero" aria-label="Check-in progress">
        <div>
          <div class="hero-event"><i aria-hidden="true"></i>${esc(ev.name)} · ${ev.status === "closed" ? "Closed" : ev.status === "draft" ? "Draft" : "Active event"}</div>
          <div class="hero-label">Checked in so far</div>
          <div class="hero-count"><b class="mono">${U.num(st.att)}</b><span>of ${U.num(st.total)} registered</span></div>
          <div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${st.rate}" aria-label="Turnout"><i style="width:${st.rate}%"></i></div>
          <div class="hero-facts">
            <div><b>${st.rate}%</b><span>turnout</span></div>
            <div><b>${U.num(st.notYet)}</b><span>yet to arrive</span></div>
            ${capNote ? `<div><b>${capNote}</b><span>of ${U.num(ev.capacity)} seats registered</span></div>` : ""}
          </div>
        </div>
        <div class="hero-side">
          <div>
            <h3>In the last 15 minutes</h3>
            <div class="big mono">${last15}</div>
            <p class="last">${latest[0] ? `Last in: ${esc(latest[0].fullName)}, ${U.ago(latest[0].attendedAt)}` : "No one has checked in yet"}</p>
          </div>
          <button class="btn btn-primary btn-lg" data-act="nav" data-view="scanner">${ic("scan")}Open scanner</button>
        </div>
      </section>

      <div id="missionPanel">${missionPulse(liveMetrics())}</div>

      <section class="strip" aria-label="Summary">
        <div><span>Registered</span><b class="mono">${U.num(st.total)}</b><small>${new24} in the last 24 hours</small></div>
        <div><span>Yet to arrive</span><b class="mono">${U.num(st.notYet)}</b><small>${100 - st.rate}% of registered</small></div>
        <div><span>Checked in by QR</span><b class="mono">${U.num(st.qr)}</b><small>${U.pct(st.qr, st.att)}% of check-ins</small></div>
        <div><span>Marked manually</span><b class="mono">${U.num(st.manual)}</b><small>${U.pct(st.manual, st.att)}% of check-ins</small></div>
      </section>

      <div class="grid g-main-side">
        ${chartCard("ov-arrivals", "Check-ins over time", "People entering in each time slot")}
        ${chartCard("ov-ring", "Attended vs not yet", "Share of registrations")}
      </div>

      <div class="grid g-main-side">
        ${chartCard("ov-dept", "Attendance by department", "Registered people, split by whether they checked in")}
        <section class="card">
          <div class="card-head"><div><h3>Latest check-ins</h3><p>Most recent first</p></div></div>
          <div class="feed">${latest.length ? latest.slice(0, 8).map((r) => `
            <div class="feed-row"><span class="avatar">${esc(U.initials(r.fullName))}</span>
              <div class="who-line"><b>${esc(r.fullName)}</b><span>${esc([r.department, r.year].filter(Boolean).join(" · ") || "—")} · ${methodLabel(r.checkInMethod)}</span></div>
              <time>${U.ago(r.attendedAt)}</time></div>`).join("") :
            `<div class="empty">${ic("scan")}<b>No check-ins yet</b><p>They'll appear here as soon as someone is scanned.</p></div>`}</div>
        </section>
      </div>
    </div>`;

    const ar = arrivals(S.regs);
    Charts.render("ov-arrivals", { type: "bar", labels: ar.labels, series: [{ label: "Check-ins", data: ar.data, color: "s1" }], tableHead: "Time slot", empty: "No check-ins yet. The chart fills in as people arrive." });
    Charts.render("ov-ring", { type: "ring", labels: ["Attended", "Not yet"], series: [{ label: "People", data: [st.att, st.notYet], colors: ["s1", "track"] }], center: { text: st.rate + "%", sub: "turnout" }, tableHead: "Status", empty: "No registrations yet." });
    const dg = groupBy(S.regs, "department");
    Charts.render("ov-dept", { type: "hbar", stacked: true, labels: dg.map((g) => g.label), series: [
      { label: "Attended", data: dg.map((g) => g.att), color: "s1" }, { label: "Not yet", data: dg.map((g) => g.total - g.att), color: "track" }], tableHead: "Department", empty: "No registrations yet." });
  };

  /* ======================================================================
     SCANNER
     ====================================================================== */
  function beep(kind) {
    if (!S.sound) return;
    try {
      const ac = App._ac || (App._ac = new (window.AudioContext || window.webkitAudioContext)());
      if (ac.state === "suspended") ac.resume();
      const seq = kind === "ok" ? [[880, 0.14, "sine", 0]] : kind === "warn" ? [[520, 0.1, "square", 0], [520, 0.1, "square", 0.17]] : [[150, 0.38, "sawtooth", 0]];
      seq.forEach(([f, d, type, off]) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = type; o.frequency.value = f; g.gain.value = 0.08;
        o.connect(g); g.connect(ac.destination);
        const t = ac.currentTime + off; o.start(t); o.stop(t + d);
      });
    } catch (e) { /* audio blocked: ignore */ }
    if (navigator.vibrate) navigator.vibrate(kind === "ok" ? 60 : kind === "warn" ? [60, 60, 60] : 250);
  }

  function ticketHTML(sc) {
    if (!sc) return `<div class="ticket idle-ticket"><div class="ticket-top">${ic("scan")}<div><h3>Ready to scan</h3><p>Hold a QR code up to the camera.</p></div></div>
      <div class="ticket-body"><p>The result of each scan shows here. Green means let them in.</p></div></div>`;
    const r = sc.registration, ev = r && S.events.find((e) => e.id === r.eventId);
    const detail = r ? `<div class="ticket-name">${esc(r.fullName)}</div>
      <div class="ticket-grid">
        <div><span>Roll no.</span><b>${esc(r.rollNo || "—")}</b></div>
        <div><span>Department and year</span><b>${esc([r.department, r.year].filter(Boolean).join(" · ") || "—")}</b></div>
        <div><span>Email</span><b>${esc(r.email || "—")}</b></div>
        <div><span>Registered</span><b>${U.dateTime(r.registeredAt)}</b></div></div>` : "";
    if (sc.status === "ok")
      return `<div class="ticket ok"><div class="ticket-top">${ic("check")}<div><h3>Checked in</h3><p>${U.time(r.attendedAt)} · let them in</p></div></div>
        <div class="ticket-body">${detail}${canAdmin() ? `<div class="ticket-actions"><button class="btn btn-sm" data-act="undo" data-id="${r.id}" data-from="scan">${ic("undo")}Undo this check-in</button></div>` : ""}</div></div>`;
    if (sc.status === "duplicate")
      return `<div class="ticket warn"><div class="ticket-top">${ic("alert")}<div><h3>Already checked in</h3><p>${U.dateTime(r.attendedAt)}${r.checkedInBy ? " by " + esc(r.checkedInBy) : ""} · ${methodLabel(r.checkInMethod)}</p></div></div>
        <div class="ticket-body">${detail}<div class="ticket-actions"><button class="btn btn-sm" data-act="details" data-id="${r.id}">View details</button></div></div></div>`;
    if (sc.status === "wrong_event")
      return `<div class="ticket bad"><div class="ticket-top">${ic("x")}<div><h3>Different event</h3><p>This QR pass does not belong to AC-STEM 9.0</p></div></div>
        <div class="ticket-body">${detail}<div class="ticket-actions">${ev ? `<button class="btn btn-sm btn-primary" data-act="switch-event" data-id="${ev.id}">Switch to ${esc(ev.name)}</button>` : ""}</div></div></div>`;
    return `<div class="ticket bad"><div class="ticket-top">${ic("x")}<div><h3>Not recognised</h3><p>This QR token does not match an active registration.</p></div></div>
      <div class="ticket-body"><p class="muted">Please search the registration list or use a verified manual check-in.</p>
      <div class="ticket-actions"><button class="btn btn-sm" data-act="nav" data-view="people">Search registrations</button></div></div></div>`;
  }

  function logHTML() {
    if (!S.scanLog.length) return `<p class="muted" style="padding:6px 0">Nothing scanned in this session yet.</p>`;
    return S.scanLog.map((l) => {
      const b = l.status === "ok" ? `<span class="badge good">${ic("check")}In</span>` : l.status === "duplicate" ? `<span class="badge warn">${ic("alert")}Repeat</span>` : `<span class="badge crit">${ic("x")}${l.status === "wrong_event" ? "Other event" : "Unknown"}</span>`;
      return `<div class="log-row">${b}<span class="nm">${esc(l.name || "Unknown code")}</span><span class="t">${U.time(l.at)}</span></div>`;
    }).join("");
  }

  function updateScanParts() {
    const t = $("#ticket"); if (t) t.innerHTML = ticketHTML(S.lastScan);
    const l = $("#scanLog"); if (l) l.innerHTML = logHTML();
    const st = calc(S.regs);
    const c = $("#scanCount"); if (c) c.innerHTML = `<b class="mono">${U.num(st.att)}</b><span>checked in of ${U.num(st.total)} registered</span>`;
  }


function finishScan(res) {
  if (res.status === 'ok' && S.view === 'scanner') {
    S.sessionScans = Math.min(999999, (S.sessionScans || 0) + 1);
    // Nonblocking presence update; check-in has already been committed by the backend.
    if (App.syncFleet) App.syncFleet();
  }
  if (res.status === 'ok' && res.registration) {
    const i = S.regs.findIndex(
      r => r.id === res.registration.id
    );

    if (i >= 0) S.regs[i] = res.registration;
    else S.regs.push(res.registration);

    S.sig = App.signature(S.regs);
  }

  S.lastScan = {
    ...res,
    at: new Date().toISOString()
  };

  S.scanLog.unshift({
    status: res.status,
    name: res.registration?.fullName,
    at: S.lastScan.at
  });

  S.scanLog = S.scanLog.slice(0, 15);

  beep(
    res.status === 'ok' ? 'ok' :
    res.status === 'duplicate' ? 'warn' : 'bad'
  );

  const vf = $('#viewfinder');

  if (vf) {
    vf.classList.remove(
      'flash-ok', 'flash-warn', 'flash-bad'
    );

    vf.classList.add(
      res.status === 'ok' ? 'flash-ok' :
      res.status === 'duplicate' ? 'flash-warn' :
      'flash-bad'
    );

    // Privacy-aware visual feedback: no participant names, emails or tokens
    // are placed over the camera or projected onto the scan viewport.
    const fx = $('#scanCinematic');
    if (fx) {
      const mode = res.status === 'ok' ? 'ok' : res.status === 'duplicate' ? 'warn' : 'bad';
      const label = mode === 'ok' ? 'ENTRY VERIFIED' : mode === 'warn' ? 'ALREADY CHECKED IN' : 'PASS NOT ACCEPTED';
      fx.className = 'scan-cinematic ' + mode;
      fx.innerHTML = `<span class="scan-fx-symbol">${ic(mode === 'ok' ? 'check' : mode === 'warn' ? 'alert' : 'x')}</span><strong>${label}</strong>`;
      fx.hidden = false;
      clearTimeout(S._scanFxTimer);
      S._scanFxTimer = setTimeout(() => { fx.hidden = true; fx.innerHTML = ''; }, 1050);
    }
    clearTimeout(S._scanFlashTimer);
    S._scanFlashTimer = setTimeout(() => {
      vf.classList.remove('flash-ok', 'flash-warn', 'flash-bad');
    }, 1050);
  }

  if (S.view === 'scanner') updateScanParts();

  App.setSync('ok');
}


// FIRST: Preview the QR without saving attendance.
App.processScan = async function (raw, source) {

  const token = DB.mode === 'demo'
    ? U.parseRegId(raw)
    : String(raw || '').trim();

  if (
    !token ||
    S._scanBusy ||
    S._parentScanPending ||
    S._parentScanSubmitting
  ) return;

  if (
    DB.mode === 'supabase' &&
    !/^[a-fA-F0-9]{64}$/.test(token)
  ) {
    App.toast(
      'Invalid QR pass. Use Registrations for manual check-in.',
      'warn'
    );
    return;
  }

  const now = Date.now();

  if (
    S._lastId === token &&
    now - S._lastAt < 4000
  ) return;

  S._lastId = token;
  S._lastAt = now;
  S._scanBusy = true;

  let preview;

  try {
    preview = DB.mode === 'supabase'
      ? await DB.previewScan(token, {
          eventId: S.eventId
        })
      : await DB.checkIn(token, {
          eventId: S.eventId,
          method: 'qr',
          by: S.user
        });

  } catch (e) {
    S._lastId = null;

    App.toast(
      'QR verification failed: ' +
      (e.message || 'network error'),
      'err'
    );

    return;

  } finally {
    S._scanBusy = false;
  }

  // Invalid, duplicate and wrong-event QR passes
  // are displayed without opening the question.
  if (
    DB.mode !== 'supabase' ||
    preview.status !== 'ok'
  ) {
    finishScan(preview);
    return;
  }

  const student = preview.registration || {};

  // SECOND: Ask about actual parent accompaniment.
  App.openModal(`
    <form data-form="parent-confirm">

      <div class="modal-head">
        <div>
          <h3>Confirm Parent Attendance</h3>
          <p>
            ${esc(student.fullName || 'Student')}
            · ${esc(student.year || '')}
          </p>
        </div>
      </div>

      <div class="modal-body">

        <p>
          How many parents are accompanying
          this student <b>right now</b>?
        </p>

        <div class="radio-list">

          <label>
            <input type="radio"
                   name="parentCount"
                   value="None" required>
            <span>
              <b>None</b>
              <small>0 parents</small>
            </span>
          </label>

          <label>
            <input type="radio"
                   name="parentCount"
                   value="One parent" required>
            <span>
              <b>Single</b>
              <small>1 parent</small>
            </span>
          </label>

          <label>
            <input type="radio"
                   name="parentCount"
                   value="Both parents" required>
            <span>
              <b>Both</b>
              <small>2 parents</small>
            </span>
          </label>

        </div>

        <p class="muted">
          Original form answer:
          ${esc(student.attendingWith || 'Not provided')}
        </p>

        <p id="parentScanErr"
           class="form-error"
           role="alert" hidden></p>

      </div>

      <div class="modal-foot">
        <button class="btn"
                type="button"
                data-act="close">
          Cancel
        </button>

        <button class="btn btn-primary"
                type="submit">
          Confirm &amp; Check In
        </button>
      </div>

    </form>
  `);

  S._parentScanPending = {
    token,
    eventId: S.eventId
  };
};


// THIRD: Record attendance only after confirmation.
App.forms['parent-confirm'] = async (form) => {

  const pending = S._parentScanPending;

  if (!pending || S._parentScanSubmitting)
    return;

  const selection =
    new FormData(form).get('parentCount');

  if (
    !['None', 'One parent', 'Both parents']
      .includes(selection)
  ) {
    const err = $('#parentScanErr');

    if (err) {
      err.textContent = 'Select an option first.';
      err.hidden = false;
    }

    return;
  }

  const btn = form.querySelector('[type="submit"]');

  btn.disabled = true;
  S._parentScanSubmitting = true;

  try {
    const result = await DB.checkIn(pending.token, {
      eventId: pending.eventId,
      method: 'qr',
      eventDayParentAttendance: selection
    });

    S._parentScanSubmitting = false;
    S._parentScanPending = null;

    App.closeModal();
    finishScan(result);

  } catch (e) {

    S._parentScanSubmitting = false;
    btn.disabled = false;

    const err = $('#parentScanErr');

    if (err) {
      err.textContent =
        'Check-in failed: ' +
        (e.message || 'Network error');

      err.hidden = false;
    }
  }
};


  V.stopCamera = async function () {
    const cam = S.cam; S.cam = null;
    if (cam) { try { await cam.stop(); } catch (e) { /* already stopped */ } try { cam.clear(); } catch (e) { /* ignore */ } }
    const vf = $("#viewfinder"); if (vf) vf.classList.remove("live");
    const b = $("#camToggle"); if (b) b.innerHTML = `${ic("camera")}Start camera`;
    if (App.syncFleet) App.syncFleet();
  };

  async function startCamera() {
    if (S.cam) return;
    if (!window.Html5Qrcode) { App.toast("The scanner library didn't load. Check the vendor folder.", "err"); return; }
    if (!window.isSecureContext) { App.toast("Camera needs a secure page (https:// or localhost). Use the ID box below, or open the dashboard over https.", "err"); return; }
    const sel = $("#camSelect");
    try {
      const cams = await Html5Qrcode.getCameras();
      if (!cams.length) throw new Error("No camera found");
      if (sel && !sel.options.length) {
        sel.innerHTML = cams.map((c, i) => `<option value="${esc(c.id)}">${esc(c.label || "Camera " + (i + 1))}</option>`).join("");
        const back = cams.find((c) => /back|rear|environment/i.test(c.label));
        if (back) sel.value = back.id;
      }
      const cam = new Html5Qrcode("reader", { verbose: false, formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE], experimentalFeatures: { useBarCodeDetectorIfSupported: true } });
      S.cam = cam;
      const source = sel && sel.value ? { deviceId: { exact: sel.value } } : { facingMode: "environment" };
      await cam.start(source, { fps: 10, qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.7); return { width: s, height: s }; } },
        (text) => App.processScan(text, "camera"), () => {});
      $("#viewfinder").classList.add("live");
      $("#camToggle").innerHTML = `${ic("x")}Stop camera`;
      if (App.syncFleet) App.syncFleet();
    } catch (e) {
      S.cam = null;
      const denied = /denied|permission|NotAllowed/i.test(String(e));
      App.toast(denied ? "Camera permission was blocked. Allow it in the browser's address bar, or use the ID box." : "Couldn't start the camera: " + (e.message || e), "err");
    }
  }

  V.scanner = function ({ soft } = {}) {
    const v = $("#view"), ev = App.event();
    if (!ev) { v.innerHTML = noEvent(); return; }
    if (soft && S.cam) { updateScanParts(); return; } // never rebuild the page under a running camera
    const st = calc(S.regs);
    v.innerHTML = `<div class="scan-layout">
      <div>
        <div class="scan-count" id="scanCount"><b class="mono">${U.num(st.att)}</b><span>checked in of ${U.num(st.total)} registered</span></div>
        <div class="viewfinder" id="viewfinder">
          <div id="reader"></div><div class="corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div id="scanCinematic" class="scan-cinematic" aria-hidden="true" hidden></div>
          <div class="idle">${ic("camera")}<div><b>Camera is off</b><p style="opacity:.8;margin-top:4px">Start the camera and point it at a pass.</p></div>
            <button class="btn btn-primary" data-act="cam-toggle">${ic("camera")}Start camera</button></div>
        </div>
        <div class="scan-controls">
          <button class="btn" id="camToggle" data-act="cam-toggle">${ic("camera")}Start camera</button>
          <select id="camSelect" aria-label="Camera"></select>
          <label class="btn btn-ghost" style="gap:8px"><input type="checkbox" id="soundToggle" ${S.sound ? "checked" : ""}> Sound</label>
        </div>
        <form class="id-entry" data-form="id-entry" autocomplete="off">
          <input type="text" id="idInput" placeholder="${DB.mode === "demo" ? "Demo registration ID" : "Scan or paste QR token, then press Enter"}" aria-label="QR pass input" spellcheck="false" autocomplete="off">
          <button class="btn btn-primary" type="submit">Check in</button>
        </form>
        <p class="muted" style="font-size:13px;margin-top:8px">A USB or Bluetooth barcode scanner works here too: click the box and scan.
          ${DB.mode === "demo" ? `<br>Demo: <button class="btn btn-sm" type="button" data-act="demo-scan" style="margin-top:6px">Scan a random pending pass</button>` : `<br>For manual ID-based attendance, use Registrations → Mark present.`}</p>
      </div>
      <div>
        <div id="ticket" role="status" aria-live="polite" aria-atomic="true">${ticketHTML(S.lastScan)}</div>
        <div class="scan-log card" style="margin-top:22px"><h4>This session</h4><div id="scanLog">${logHTML()}</div></div>
      </div></div>`;
    if (window.matchMedia("(pointer:fine)").matches) $("#idInput").focus();
  };
  A["cam-toggle"] = () => (S.cam ? V.stopCamera() : startCamera());
  A["demo-scan"] = () => {
    const pool = S.regs.filter((r) => !r.attended); if (!pool.length) return App.toast("Everyone is already checked in.", "warn");
    App.processScan(pool[Math.floor(Math.random() * pool.length)].id, "demo");
  };
  A["switch-event"] = (el) => App.selectEvent(el.dataset.id, { go: "scanner" });
  App.forms["id-entry"] = (form) => {
    const inp = form.querySelector("input"); const val = inp.value.trim(); inp.value = "";
    if (val) { S._lastId = null; App.processScan(val, "typed"); }
  };

  /* ======================================================================
     REGISTRATIONS
     ====================================================================== */
  // A staff-assisted lookup key, NOT an authentication credential or unique ID.
  // Example: "Meeth Lalwani" + "+91 98765 43210" -> "M3210".
  function backupCodeFor(r) {
    const initial = String(r.fullName || "").trim().slice(0, 1).toUpperCase();
    const phoneDigits = String(r.phone || "").replace(/\D/g, "");
    return /^[A-Z]$/.test(initial) && phoneDigits.length >= 4
      ? initial + phoneDigits.slice(-4) : "";
  }

  function backupCodeQuery(query) {
  const value = String(query || "").trim().toUpperCase();
  // Allow progressive searching:
  // M -> M3 -> M32 -> M321 -> M3210
  return /^[A-Z][0-9]{0,4}$/.test(value) ? value : "";
  }


  function filtered() {
    const code = backupCodeQuery(S.q);
    let r = S.regs;
    if (code) {
      // Match the short code EXACTLY. Ignore status/department/year filters
      // to show ALL collisions and also students who are already checked in.
      r = r.filter((x) => backupCodeFor(x).startsWith(code));
    } else {
      if (S.filter === "present") r = r.filter((x) => x.attended);
      else if (S.filter === "absent") r = r.filter((x) => !x.attended);
      else if (S.filter === "manual") r = r.filter((x) => x.attended && x.checkInMethod === "manual");
      if (S.dept) r = r.filter((x) => (x.department || "Not given") === S.dept);
      if (S.year) r = r.filter((x) => (x.year || "Not given") === S.year);
      const q = S.q.trim().toLowerCase();
      if (q) r = r.filter((x) => [x.fullName, x.email, x.rollNo, x.phone, x.id, x.department, backupCodeFor(x)]
        .some((f) => String(f || "").toLowerCase().includes(q)));
    }
    const { key, dir } = S.sort, m = dir === "asc" ? 1 : -1;
    const val = (x) => key === "fullName" ? (x.fullName || "").toLowerCase() : key === "attendedAt" ? (x.attended ? +new Date(x.attendedAt) : -1) : +new Date(x.registeredAt);
    return r.slice().sort((a, b) => (val(a) < val(b) ? -1 : val(a) > val(b) ? 1 : 0) * m);
  }
  App.filteredRegs = filtered;

  function sortBtn(key, label) {
    const on = S.sort.key === key;
    return `<button data-act="sort" data-key="${key}" aria-label="Sort by ${label}">${label}${on ? ic(S.sort.dir === "asc" ? "up" : "down") : ""}</button>`;
  }
  const pageSvgFix = () => $$("table.data th svg").forEach((s) => { s.style.width = "14px"; s.style.height = "14px"; });

  function renderPeopleBody() {
    const all = S.regs, rows = filtered();
    const shortQuery = backupCodeQuery(S.q);
    const codeInfo = shortQuery
      ? `<div class="muted" role="status" style="padding:12px 8px 14px">
        <b>${rows.length} matching registration${rows.length === 1 ? "" : "s"} for ${esc(shortQuery)}</b>
        · Confirm the student's full name and another detail before selecting Mark present.
        A backup code is not unique and does not automatically check anyone in.
        </div>` : "";
    const pages = Math.max(1, Math.ceil(rows.length / S.pageSize));
    if (S.page > pages) S.page = pages;
    const from = (S.page - 1) * S.pageSize, view = rows.slice(from, from + S.pageSize);
    const cnt = { all: all.length, present: all.filter((x) => x.attended).length };
    cnt.absent = all.length - cnt.present;
    cnt.manual = all.filter((x) => x.attended && x.checkInMethod === "manual").length;
    const seg = (id, label) => `<button data-act="filter" data-f="${id}" aria-pressed="${S.filter === id}">${label}<span class="n">${cnt[id]}</span></button>`;
    $("#segHost").innerHTML = `<div class="seg" role="group" aria-label="Show">${seg("all", "All")}${seg("present", "Present")}${seg("absent", "Not yet")}${seg("manual", "Manual")}</div>`;

    const allOnPage = view.length && view.every((r) => S.selected.has(r.id));
    const body = view.map((r) => {
      const sel = S.selected.has(r.id);
      return `<tr class="${sel ? "sel" : ""}">
        <td></td>
        <td class="cell-name" data-label="Name"><b>${esc(r.fullName)}</b><span>${esc(r.email || "")}${shortQuery ? ` · Backup: ${esc(backupCodeFor(r))}` : ""}</span></td>
        <td class="mono hide-sm">${esc(r.rollNo || "—")}</td>
        <td class="hide-sm">${esc([r.department, r.year].filter(Boolean).join(" · ") || "—")}</td>
        <td class="mono hide-sm">${U.dateTime(r.registeredAt)}</td>
        <td data-label="Status">${statusBadge(r)}${r.attended ? `<div class="muted mono" style="font-size:12.5px;margin-top:3px">${U.time(r.attendedAt)} · ${methodLabel(r.checkInMethod)}</div>` : ""}</td>
        <td data-label="Actions"><div class="row-actions">
          ${r.attended ? (canAdmin() ? `<button class="btn btn-sm btn-ghost" data-act="undo" data-id="${r.id}">${ic("undo")}Undo</button>` : "") : `<button class="btn btn-sm" data-act="mark-present" data-id="${r.id}">${ic("hand")}Mark present</button>`}
          <button class="btn btn-sm btn-ghost" data-act="details" data-id="${r.id}" aria-label="Details for ${esc(r.fullName)}">${ic("info")}</button></div></td></tr>`;
    }).join("");

    const sel = [...S.selected].filter((id) => S.regs.some((r) => r.id === id));
    const selPending = sel.filter((id) => !S.regs.find((r) => r.id === id).attended);
    $("#peopleBody").innerHTML = `
      ${codeInfo}
      <div class="table-wrap people-table"><table class="data" aria-label="Event registrations">
        <thead><tr><th style="width:36px"></th>
          <th>${sortBtn("fullName", "Name")}</th><th class="hide-sm">Roll no.</th><th class="hide-sm">Department</th><th class="hide-sm">${sortBtn("registeredAt", "Registered")}</th>
          <th>${sortBtn("attendedAt", "Status")}</th><th></th></tr></thead>
        <tbody>${body || `<tr class="empty-row"><td data-label="Empty" colspan="7"><div class="empty">${ic("search")}<b>${all.length ? "No one matches these filters" : "No registrations yet"}</b><p>${all.length ? "Try clearing the search or filters." : "Registrations submitted through the official AC-STEM Form appear here."}</p></div></td></tr>`}</tbody></table></div>
      <div class="pager"><span>${rows.length ? `Showing ${from + 1}–${Math.min(from + S.pageSize, rows.length)} of ${U.num(rows.length)}` : "0 results"}</span>
        <div><label for="pageSize" class="sr-only">Rows per page</label><select id="pageSize">${[25, 50, 100].map((n) => `<option ${n === S.pageSize ? "selected" : ""} value="${n}">${n} per page</option>`).join("")}</select>
          <button class="btn btn-sm" data-act="page" data-dir="-1" ${S.page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="mono">${S.page} / ${pages}</span>
          <button class="btn btn-sm" data-act="page" data-dir="1" ${S.page >= pages ? "disabled" : ""}>Next</button></div></div>
`;
    pageSvgFix();
  }

  V.people = function ({ soft } = {}) {
    const v = $("#view");
    if (!App.event()) { v.innerHTML = noEvent(); return; }
    if (soft && $("#peopleBody")) { renderPeopleBody(); return; }
    const depts = [...new Set(S.regs.map((r) => (r.department || "").trim() || "Not given"))].sort();
    const years = [...new Set(S.regs.map((r) => (r.year || "").trim() || "Not given"))].sort((a, b) => C.YEARS.indexOf(a) - C.YEARS.indexOf(b));
    v.innerHTML = `<div class="toolbar">
        <div class="grow">${ic("search")}<input type="search" id="q" placeholder="Live search: name, phone, ID or backup code (e.g. M3)" value="${esc(S.q)}" aria-label="Search registrations"></div>
        <span id="segHost"></span>
        <select id="fDept" aria-label="Department"><option value="">All departments</option>${depts.map((d) => `<option ${S.dept === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select>
        <select id="fYear" aria-label="Year"><option value="">All years</option>${years.map((d) => `<option ${S.year === d ? "selected" : ""}>${esc(d)}</option>`).join("")}</select>
        
${canAdmin() ? `<button class="btn btn-primary btn-sm" data-act="add-reg">${ic("plus")}Walk-in registration</button>` : ""}

      </div><div id="peopleBody"></div>`;
    renderPeopleBody();
  };

  A.sort = (el) => { const k = el.dataset.key; S.sort = { key: k, dir: S.sort.key === k && S.sort.dir === "desc" ? "asc" : (k === "fullName" ? "asc" : "desc") }; renderPeopleBody(); };
  A.filter = (el) => { S.filter = el.dataset.f; S.page = 1; renderPeopleBody(); };
  A.page = (el) => { S.page += Number(el.dataset.dir); renderPeopleBody(); };
  A["clear-sel"] = () => { S.selected.clear(); renderPeopleBody(); };
  A["sel-all-matching"] = () => { filtered().forEach((r) => S.selected.add(r.id)); renderPeopleBody(); };
  A["export-selected"] = () => { S.exportSet = "selected"; App.navigate("export"); };

  /* ---------- manual check-in (glitch fallback) ---------- */
  function manualModal(ids) {
    const regs = ids.map((id) => S.regs.find((r) => r.id === id)).filter((r) => r && !r.attended);
    if (!regs.length) return App.toast("Those people are already checked in.", "warn");
    const who = regs.length === 1 ? `<b>${esc(regs[0].fullName)}</b>${regs[0].rollNo ? " · " + esc(regs[0].rollNo) : ""}` : `<b>${regs.length} people</b>`;
    App.openModal(`<form data-form="manual" data-ids="${regs.map((r) => r.id).join(",")}">
      <div class="modal-head"><div><h3>Mark present manually</h3><p>${who}. Use this when scanning isn't working. It's recorded as a manual check-in under your name (${esc(S.user)}).</p></div></div>
      <div class="modal-body">
        <label class="field"><span>Why is this manual?</span><select name="reason" required>${C.MANUAL_REASONS.map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
        <label class="field"><span>Note (optional)</span><textarea name="note" placeholder="e.g. ID card checked, roll no. matches"></textarea></label>
        <p class="form-error" id="manualErr" hidden></p></div>
      <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">${ic("check")}Mark present</button></div></form>`);
  }
  A["mark-present"] = (el) => manualModal([el.dataset.id]);
  A["bulk-present"] = () => manualModal([...S.selected]);
  App.forms.manual = async (form) => {
    const f = new FormData(form), ids = form.dataset.ids.split(",");
    const reason = f.get("reason"), note = (f.get("note") || "").trim();
    if (reason === "Other" && !note) { const e = $("#manualErr"); e.textContent = "Add a short note so the reason is clear later."; e.hidden = false; return; }
    const btn = form.querySelector("[type=submit]"); btn.disabled = true;
    try {
      const { ok, skipped } = await DB.bulkCheckIn(ids, { eventId: S.eventId, method: "manual", by: S.user, reason, note });
      App.closeModal(); S.selected.clear();
      await App.refresh({ force: true });
      App.toast(ok ? `Marked ${ok} present${skipped ? ` (${skipped} already in)` : ""}.` : "Nobody was changed. They were already checked in.", ok ? "ok" : "warn");
    } catch (e) { btn.disabled = false; App.toast("Couldn't save: " + (e.message || e), "err"); }
  };

  A.undo = async (el) => {
    const r = S.regs.find((x) => x.id === el.dataset.id); if (!r) return;
    const yes = await App.confirm({ title: "Undo this check-in?", body: `${esc(r.fullName)} will go back to <b>Not yet</b> and can be checked in again.`, confirmLabel: "Undo check-in", danger: true });
    if (!yes) return;
    try {
      await DB.undoCheckIn(r.id);
      if (el.dataset.from === "scan") S.lastScan = null;
      App.closeModal(); await App.refresh({ force: true }); App.toast("Check-in undone.");
    } catch (e) { App.toast("Couldn't undo: " + (e.message || e), "err"); }
  };

  /* ---------- add registration ---------- */

A["add-reg"] = () => {
  if (!App.event()) return;

  const options = (items, placeholder) =>
    `<option value="">${esc(placeholder)}</option>` +
    items.map(x =>
      `<option value="${esc(x)}">${esc(x)}</option>`
    ).join("");

  const grades = ["9th", "10th", "11th", "12th"];

  const streams = [
    "School (9th / 10th)",
    "Science (PCM)",
    "Science (PCB)",
    "Science (PCMB)",
    "Commerce",
    "Arts / Humanities",
    "Vocational",
    "Other"
  ];

  const institutes = [
    "School of Engineering and Technology",
    "School of Computer Applications",
    "School of Business Management",
    "School of Higher and Skill Education",
    "Undecided"
  ];

  const branches = [
    "Computer Engineering",
    "Information Technology",
    "Electronics & Telecommunication Engineering",
    "Electronics and Computer Science",
    "Mechanical Engineering",
    "Civil Engineering",
    "Artificial Intelligence and Data Science",
    "Computer Science and Engineering (IoT)",
    "Artificial Intelligence and Machine Learning",
    "Computer Science and Engineering (Cyber Security)",
    "Mechanical and Mechatronics Engineering (Additive Manufacturing)",
    "Not sure yet"
  ];

  App.openModal(`
    <form data-form="reg">
      <div class="modal-head">
        <h3>Walk-in Registration</h3>
      </div>

      <div class="modal-body">
        <div class="form-grid">

          <label class="field span-2">
            <span>Student's Full Name</span>
            <input name="fullName" required maxlength="80">
          </label>

          <label class="field">
            <span>Email</span>
            <input name="email" type="email" required>
          </label>

          <label class="field">
            <span>Student Phone Number</span>
            <input name="phone" type="tel">
          </label>

          <label class="field span-2">
            <span>Current School / College Name</span>
            <input name="collegeSchoolName"
                   required maxlength="255">
          </label>

          <label class="field">
            <span>Currently Studying In</span>
            <select name="studentGrade" required>
              ${options(grades, "Select Class")}
            </select>
          </label>

          <label class="field">
            <span>Stream</span>
            <select name="stream">
              ${options(streams, "Select Stream")}
            </select>
          </label>

          <label class="field span-2">
            <span>Parent / Guardian Name(s)</span>
            <input name="parentName" required>
          </label>

          <label class="field">
            <span>Parent / Guardian Phone</span>
            <input name="parentPhone"
                   type="tel" required>
          </label>

          <label class="field">
            <span>Accompanied by Parents?</span>
            <select name="attendingWith" required>
              <option value="">Select</option>
              <option value="None">None</option>
              <option value="One parent">One parent</option>
              <option value="Both parents">Both parents</option>
            </select>
          </label>

          <label class="field span-2">
            <span>Preferred Thakur Institution</span>
            <select name="preferredThakurInstitute" required>
              ${options(institutes, "Select Institution")}
            </select>
          </label>

          <label class="field span-2">
            <span>Preferred Engineering Branch</span>
            <select name="preferredBranch">
              ${options(branches, "Select Branch")}
            </select>
          </label>

          <label class="field span-2">
            <input type="checkbox" name="present" checked>
            Mark Present Immediately
          </label>

        </div>

        <p class="form-error" id="regErr" hidden></p>
      </div>

      <div class="modal-foot">
        <button type="button" class="btn" data-act="close">
          Cancel
        </button>
        <button type="submit" class="btn btn-primary">
          Add Registration
        </button>
      </div>
    </form>
  `);

  const modal = $("#modalRoot");
  const grade = modal.querySelector('[name="studentGrade"]');
  const stream = modal.querySelector('[name="stream"]');
  const programme = modal.querySelector('[name="preferredProgram"]');
  const branch = modal.querySelector('[name="preferredBranch"]');

  function updateFields() {
    const showStream =
      ["11th", "12th"].includes(grade.value);

    modal.querySelector("[data-stream-wrap]")
      .style.display = showStream ? "" : "none";

    stream.required = showStream;
    if (!showStream) stream.value = "";

    const showBranch =
      programme.value === "B.E./B.Tech";

    modal.querySelector("[data-branch-wrap]")
      .style.display = showBranch ? "" : "none";

    branch.required = showBranch;
    if (!showBranch) branch.value = "";
  }

  grade.addEventListener("change", updateFields);
  programme.addEventListener("change", updateFields);
  updateFields();
};

  App.forms.reg = async (form) => {
    const f = new FormData(form), btn = form.querySelector("[type=submit]"); btn.disabled = true;
    

const data = {
  fullName: f.get("fullName").trim(),
  email: f.get("email").trim(),
  phone: f.get("phone").trim(),

  collegeSchoolName: f.get("collegeSchoolName").trim(),
  studentGrade: f.get("studentGrade"),
  stream: f.get("stream") || "Not applicable",

  parentName: f.get("parentName").trim(),
  parentPhone: f.get("parentPhone").trim(),
  attendingWith: f.get("attendingWith"),

  preferredThakurInstitute: f.get("preferredThakurInstitute"),
  preferredProgram: f.get("preferredProgram"),
  preferredBranch: f.get("preferredBranch") || ""
};

    try {
      const r = await DB.addRegistration(S.eventId, data, { markPresent: !!f.get("present"), by: S.user });
      App.closeModal(); await App.refresh({ force: true });
      App.toast(`${r.fullName} added${r.attended ? " and marked present" : ""}.`);
      if (r.oneTimeQrToken) {
        const qr = qrcode(0, "M"); qr.addData(r.oneTimeQrToken); qr.make();
        App.openModal(`<div class="modal-head"><div><h3>New walk-in QR pass</h3><p>${esc(r.fullName)} · ${esc(r.id)}</p></div></div>
          <div class="modal-body" style="text-align:center"><div class="qr-box">${qr.createSvgTag({ cellSize: 5, margin: 16, scalable: true })}</div>
          <p style="margin-top:14px">Show or save this QR pass now. For security, its original token cannot be recovered later from the database.</p></div>
          <div class="modal-foot"><button type="button" class="btn btn-primary" data-act="close">Done</button></div>`);
      }
    } catch (e) { btn.disabled = false; const el = $("#regErr"); el.textContent = e.message || "Couldn't add this registration."; el.hidden = false; }
  };

  /* ---------- details drawer (with QR for lost passes) ---------- */
  A.details = (el) => {
    const r = S.regs.find((x) => x.id === el.dataset.id) || (S.lastScan && S.lastScan.registration);
    if (!r) return;
    let qrSvg = "";
    if (DB.mode === "demo") {
      try { const q = qrcode(0, "M"); q.addData(r.id); q.make(); qrSvg = q.createSvgTag({ cellSize: 4, margin: 16, scalable: true }); } catch (e) { qrSvg = ""; }
    }
    const ev = S.events.find((e) => e.id === r.eventId);
    App.openModal(`<div class="modal-head"><div><h3>${esc(r.fullName)}</h3><p>${statusBadge(r)}</p></div><button class="icon-btn" data-act="close" aria-label="Close" style="color:var(--ink-2)">${ic("x")}</button></div>
      <div class="modal-body">
        ${qrSvg ? `<div><div class="qr-box" role="img" aria-label="QR code for this demo registration">${qrSvg}</div></div>` : `<p class="muted">For security, existing QR tokens cannot be recreated from the database's SHA-256 hash. Ask the student to use the original emailed pass.</p>`}
        <div class="id-chip"><span class="mono">${esc(r.id)}</span><button class="btn btn-sm" data-act="copy" data-text="${esc(r.id)}">${ic("copy")}Copy</button></div>
        <dl class="kv">
          <dt>Email</dt><dd>${esc(r.email || "—")}</dd><dt>Roll no.</dt><dd>${esc(r.rollNo || "—")}</dd><dt>Phone</dt><dd>${esc(r.phone || "—")}</dd>
          <dt>Department</dt><dd>${esc(r.department || "—")}</dd><dt>Year</dt><dd>${esc(r.year || "—")}${r.division ? " · Div " + esc(r.division) : ""}</dd>

<dt>Parents (registration form)</dt>
<dd>${esc(r.attendingWith || "—")}</dd>

${r.eventDayParentAttendance
  ? `<dt>Parents (actual arrival)</dt>
     <dd>${esc(r.eventDayParentAttendance)}</dd>`
  : ""}

          <dt>Event</dt><dd>${esc(ev ? ev.name : "—")}</dd><dt>Registered</dt><dd>${U.dateTime(r.registeredAt)}</dd>
          ${r.attended ? `<dt>Checked in</dt><dd>${U.dateTime(r.attendedAt)}</dd><dt>Method</dt><dd>${methodLabel(r.checkInMethod)}${r.checkedInBy ? " by " + esc(r.checkedInBy) : ""}</dd>${r.manualReason ? `<dt>Reason</dt><dd>${esc(r.manualReason)}</dd>` : ""}` : ""}
          ${r.notes ? `<dt>Note</dt><dd>${esc(r.notes)}</dd>` : ""}
        </dl></div>
      <div class="modal-foot">
        <span style="flex:1"></span>
        ${r.attended ? (canAdmin() ? `<button class="btn" data-act="undo" data-id="${r.id}">${ic("undo")}Undo check-in</button>` : "") : `<button class="btn btn-primary" data-act="mark-present" data-id="${r.id}">${ic("hand")}Mark present</button>`}
      </div>`, { drawer: true });
  };
  A.copy = async (el) => { try { await navigator.clipboard.writeText(el.dataset.text); App.toast("Copied."); } catch (e) { App.toast("Couldn't copy. Select the ID and copy it by hand.", "warn"); } };
  A["delete-reg"] = async (el) => {
    const r = S.regs.find((x) => x.id === el.dataset.id); if (!r) return;
    const yes = await App.confirm({ title: "Remove this registration?", body: DB.mode === "demo" ? `${esc(r.fullName)}'s registration will be deleted.` : `Remove ${esc(r.fullName)} from this event only? Their original Google Form registration will remain in Supabase.`, confirmLabel: "Remove", danger: true });
    if (!yes) return;
    try { await DB.deleteRegistration(r.id); S.selected.delete(r.id); App.closeModal(); await App.refresh({ force: true }); App.toast("Registration removed."); }
    catch (e) { App.toast("Couldn't remove: " + (e.message || e), "err"); }
  };

  /* ======================================================================
     ANALYTICS
     ====================================================================== */
  V.analytics = function () {
    const v = $("#view"), ev = App.event();
    if (!ev) { v.innerHTML = noEvent(); return; }
    const st = calc(S.regs), ar = arrivals(S.regs);
    const ops = App.ops.analyze(S.regs, ev);
    const dg = groupBy(S.regs, "department"), yg = groupBy(S.regs, "year", C.YEARS);

    // insights
    let peak = "—", peakSub = "No check-ins yet";
    if (ar.data.length) {
      const m = Math.max(...ar.data), i = ar.data.indexOf(m);
      peak = `${U.time(ar.starts[i])} – ${U.time(ar.starts[i] + ar.step)}`; peakSub = `${m} check-ins in that slot`;
    }
    const times = S.regs.filter((r) => r.attendedAt).map((r) => (+new Date(r.attendedAt) - +new Date(ev.eventDate)) / 60000).sort((a, b) => a - b);
    let med = "—", medSub = "No check-ins yet";
    if (times.length) { const m = times[Math.floor(times.length / 2)]; med = `${Math.round(Math.abs(m))} min ${m <= 0 ? "early" : "late"}`; medSub = "Median arrival compared with the start time"; }
    const ranked = dg.filter((g) => g.total >= 5).map((g) => ({ ...g, rate: U.pct(g.att, g.total) })).sort((a, b) => b.rate - a.rate);
    const best = ranked[0], worst = ranked[ranked.length - 1];

    v.innerHTML = `<div class="stack">
      <div class="insights">
        <div class="insight"><span>Busiest slot</span><b>${peak}</b><small>${peakSub}</small></div>
        <div class="insight"><span>Typical arrival</span><b>${med}</b><small>${medSub}</small></div>
        <div class="insight"><span>Best turnout</span><b>${best ? esc(best.label) + " · " + best.rate + "%" : "—"}</b><small>${best ? `${best.att} of ${best.total} registered` : "Needs a department with 5+ registrations"}</small></div>
        <div class="insight"><span>Lowest turnout</span><b>${worst && worst !== best ? esc(worst.label) + " · " + worst.rate + "%" : "—"}</b><small>${worst && worst !== best ? `${worst.total - worst.att} no-shows from ${worst.total}` : "Not enough data yet"}</small></div>
      </div>
      <div class="grid g-main-side">
        ${chartCard("an-arrivals", "Check-ins over time", "Entries per time slot", "tall")}
        ${chartCard("an-ring", "Attended vs not yet", `${st.att} of ${st.total} registered people`, "tall")}
      </div>
      <div class="grid g-2">
        ${chartCard("an-dept", "By department", "Attended and not yet, per department", "tall")}
        ${chartCard("an-year", "By year", "Attended and not yet, per year of study", "tall")}
      </div>
      <div class="grid g-2">
        ${chartCard("an-method", "How people were checked in", "QR scan or marked by hand")}
        ${chartCard("an-reason", "Why manual check-ins happened", "Reasons given when marking present by hand")}
      </div>
      ${chartCard("an-regs", "Registrations over time", "Running total of people registered, by day", "tall")}
      ${chartCard("an-events", "All events compared", "Registered and attended for every event")}
      <section class="card ops-report-card" aria-label="Operational intelligence">
        <div class="card-head"><div><h3>Operational intelligence</h3><p>From verified check-ins currently recorded in the event database</p></div>
        <button class="btn btn-primary btn-sm" data-act="ops-export">${ic('download')} Export operations report</button></div>
        <div class="ops-report-kpis">
          <div><span>Peak 1-minute volume</span><strong>${ops.kpis.peak ? U.num(ops.kpis.peak[1]) : '—'}</strong><small>${ops.kpis.peak ? U.dateTime(ops.kpis.peak[0]) : 'No arrivals yet'}</small></div>
          <div><span>Last 15 minutes</span><strong>${U.num(ops.kpis.fifteen)}</strong><small>Verified arrivals</small></div>
          <div><span>Before event start</span><strong>${ops.kpis.before===null?'—':U.num(ops.kpis.before)}</strong><small>Arrival timestamp comparison</small></div>
          <div><span>After event start</span><strong>${ops.kpis.late===null?'—':U.num(ops.kpis.late)}</strong><small>Arrival timestamp comparison</small></div>
        </div>
        <p class="muted report-caveat">${esc(ops.caveat)}</p>
        <div class="grid g-2 ops-section-grid">
          ${chartCard('an-operators','Check-ins by operator','Currently active records credited to staff')}
          ${chartCard('an-parents','Parents at check-in','Recorded parent accompaniment on arrival')}
        </div>
        <div class="ops-quality"><h4>Data quality checks</h4><div class="ops-quality-list">${ops.issues.map(i=>`<div><span>${esc(i.name)}</span><b class="mono">${U.num(i.count)}</b></div>`).join('')}</div></div>
      </section>
    </div>`;

    Charts.render("an-arrivals", { type: "bar", labels: ar.labels, series: [{ label: "Check-ins", data: ar.data, color: "s1" }], tableHead: "Time slot", empty: "No check-ins yet. The chart fills in as people arrive." });
    Charts.render("an-ring", { type: "ring", labels: ["Attended", "Not yet"], series: [{ label: "People", data: [st.att, st.notYet], colors: ["s1", "track"] }], center: { text: st.rate + "%", sub: "turnout" }, tableHead: "Status", empty: "No registrations yet." });
    const two = (g) => [{ label: "Attended", data: g.map((x) => x.att), color: "s1" }, { label: "Not yet", data: g.map((x) => x.total - x.att), color: "track" }];
    Charts.render("an-dept", { type: "hbar", stacked: true, labels: dg.map((g) => g.label), series: two(dg), tableHead: "Department", empty: "No registrations yet." });
    Charts.render("an-year", { type: "bar", stacked: true, labels: yg.map((g) => g.label), series: two(yg), tableHead: "Year", empty: "No registrations yet." });
    Charts.render("an-method", { type: "ring", labels: ["QR scan", "Manual"], series: [{ label: "Check-ins", data: [st.qr, st.manual], colors: ["s1", "s2"] }], center: { text: st.att ? U.pct(st.manual, st.att) + "%" : "0%", sub: "manual" }, tableHead: "Method", empty: "No check-ins yet." });
    const rs = new Map(); S.regs.filter((r) => r.attended && r.checkInMethod === "manual").forEach((r) => rs.set(r.manualReason || "No reason given", (rs.get(r.manualReason || "No reason given") || 0) + 1));
    const rr = [...rs.entries()].sort((a, b) => b[1] - a[1]);
    Charts.render("an-reason", { type: "hbar", labels: rr.map((x) => x[0]), series: [{ label: "Manual check-ins", data: rr.map((x) => x[1]), color: "s2" }], tableHead: "Reason", empty: "No manual check-ins. Scanning is working well." });
    const rt = registrationTimeline(S.regs);
    Charts.render("an-regs", { type: "line", labels: rt.labels, series: [{ label: "Registered so far", data: rt.data, color: "s1" }], tableHead: "Day", empty: "No registrations yet." });
    Charts.render('an-operators', { type:'hbar',labels:ops.operators.map(x=>x.name),
      series:[{label:'Active check-ins',data:ops.operators.map(x=>x.count),color:'s1'}],
      tableHead:'Operator',empty:'No operator check-ins recorded yet.' });
    Charts.render('an-parents',{type:'bar',labels:ops.parents.map(x=>x.name),
      series:[{label:'Active check-ins',data:ops.parents.map(x=>x.count),color:'s2'}],
      tableHead:'Parents at check-in',empty:'No parent confirmations recorded yet.'});
    const evs = S.events.slice().sort((a, b) => new Date(a.eventDate) - new Date(b.eventDate));
    Charts.render("an-events", { type: "bar", labels: evs.map((e) => e.name), series: [
      { label: "Registered", data: evs.map((e) => (S.stats[e.id] || {}).registered || 0), color: "track" },
      { label: "Attended", data: evs.map((e) => (S.stats[e.id] || {}).attended || 0), color: "s1" }], tableHead: "Event", empty: "No events yet." });
  };


  /* ======================================================================
     PHASE 3: Authenticated Scanner Fleet Management.
     Connectivity comes ONLY from recent server-side heartbeats.
     Operator throughput is computed ONLY from canonical active check-ins.
     ====================================================================== */
  function fleetStatus(row, now=Date.now()) {
    const age=now-Date.parse(row.lastSeenAt||'');
    if (!Number.isFinite(age)||age<0||age>75000) return {state:'offline',label:'Offline',age};
    return row.state==='scanning'?{state:'scanning',label:'Camera active',age}:
      {state:'idle',label:'Online · idle',age};
  }
  V.fleet = function () {
    const v=$('#view'), ev=App.event();
    if (!ev) {v.innerHTML=noEvent();return;}
    v.innerHTML=`<div class="stack">
      <section class="fleet-intro"><div><span class="mission-eyebrow">EVENT OPERATIONS / FLEET</span>
        <h3>Scanner health & activity</h3><p>Authenticated devices report presence automatically every 20 seconds. A device becomes offline when its heartbeat is older than 75 seconds.</p></div>
        <div class="fleet-intro-actions"><button class="btn" data-act="fleet-rename">${ic('pencil')} Rename this desk</button>
          <button class="btn btn-primary" data-act="fleet-refresh">${ic('undo')} Refresh fleet</button></div></section>
      <div id="fleetContent" role="status" aria-live="polite"></div></div>`;
    V.updateFleet();
  };
  V.updateFleet = function () {
    if (S.view!=='fleet') return;
    const host=$('#fleetContent'); if(!host) return;
    const now=Date.now();
    const fleet=Array.isArray(S.fleet)?S.fleet:[];
    const quality=!!S.fleetLastAt && now-S.fleetLastAt<60000 && !S.fleetError;
    const active=quality?fleet.filter(r=>fleetStatus(r,now).state!=='offline'):[];
    const scanning=quality?active.filter(r=>fleetStatus(r,now).state==='scanning'):[];
    const offline=quality?fleet.filter(r=>fleetStatus(r,now).state==='offline'):[];
    const ops=App.ops.analyze(S.regs,App.event(),now);
    const cards=fleet.map(r=>{
      const stat=fleetStatus(r,now), isMe=r.clientId===S.clientId;
      const op=ops.operators.find(x=>x.name===r.operatorName);
      return `<article class="card fleet-device"><div class="fleet-device-head">
          <div class="fleet-device-icon">${ic('devices')}</div>
          <div class="fleet-device-title"><h4>${esc(r.label||'Unnamed device')}${isMe?'<span class="fleet-this">This device</span>':''}</h4>
          <p>${esc(r.operatorName||'Event staff')}</p></div>
          <span class="fleet-pill ${stat.state}">${esc(stat.label)}</span></div>
        <div class="fleet-device-meta">
          <div><span>Last heartbeat</span><strong>${r.lastSeenAt?U.ago(r.lastSeenAt):'Unknown'}</strong></div>
          <div><span>Current active check-ins by operator</span><strong>${U.num(op?.count||0)}</strong></div>
          <div><span>Device session scans (self-reported)</span><strong>${U.num(r.sessionScans||0)}</strong></div>
        </div></article>`;
    }).join('');
    host.innerHTML=`
      ${S.fleetError?`<div class="fleet-warning" role="alert">${ic('alert')} Cannot verify live scanner presence: ${esc(S.fleetError)}. Previously reported devices are not treated as online.</div>`:''}
      <div class="fleet-stats">
        <div><span>Connected devices</span><b class="mono">${quality?U.num(active.length):'—'}</b><small>Heartbeat within 75 seconds</small></div>
        <div><span>Cameras active</span><b class="mono">${quality?U.num(scanning.length):'—'}</b><small>Reported scanning</small></div>
        <div><span>Online idle</span><b class="mono">${quality?U.num(active.length-scanning.length):'—'}</b><small>Authenticated browser active</small></div>
        <div><span>Recently offline</span><b class="mono">${quality?U.num(offline.length):'—'}</b><small>Older than 75 seconds</small></div>
      </div>
      <div class="fleet-summary card"><div><h4>Your desk: ${esc(S.deviceLabel)}</h4>
        <p>${quality?'Presence updated '+U.ago(S.fleetLastAt):'Presence unverified'} · ${esc(App.event()?.name||'Event')}</p></div>
        <span class="badge neutral">Operator: ${esc(S.user||'Event staff')}</span></div>
      <div class="fleet-device-grid">${cards||`<div class="card empty">${ic('devices')}<b>No scanner heartbeats received</b><p>Sign in on scanning devices and keep their dashboard open. Fleet activity will appear here after a successful heartbeat.</p></div>`}</div>
      <p class="muted fleet-footnote">Fleet connectivity is an approximate browser heartbeat, not proof of a working physical scanner. Operator check-in counts reflect currently active records, not deleted or reversed historical activity.</p>`;
  };
  A['fleet-refresh']=()=>App.syncFleet();
  A['fleet-rename']=()=>App.openModal(`<form data-form="fleet-rename"><div class="modal-head"><div><h3>Rename this scanning desk</h3><p>Shown only to authenticated TCET staff.</p></div></div>
    <div class="modal-body"><label class="field"><span>Desk label</span><input name="label" type="text" required maxlength="40" value="${esc(S.deviceLabel)}" autofocus></label></div>
    <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">Save desk name</button></div></form>`);
  App.forms['fleet-rename']=(form)=>{
    try { App.saveDeviceLabel(new FormData(form).get('label'));App.closeModal();V.updateFleet();App.syncFleet();App.toast('Desk name updated.'); }
    catch(e){App.toast(e.message||'Invalid desk label','err');}
  };
  A['ops-export']=()=>{S.exportSet='operations';App.navigate('export');};

  /* ======================================================================
     PHASE 2: Event Wall — projection-safe aggregate data ONLY.
     Uses the existing authenticated operator session. No public endpoint,
     anonymous database access, or sensitive individual records are exposed.
     ====================================================================== */
  function wallMetricsHtml(m) {
    const turn = Math.max(0, Math.min(100, Number(m.rate) || 0));
    return `<div class="wall-spotlight">
      <div class="wall-big-label">ATTENDEES CHECKED IN</div>
      <div class="wall-big-num mono">${U.num(m.att)}</div>
      <div class="wall-sublabel">of <strong>${U.num(m.total)}</strong> registered participants</div>
      <div class="wall-progress" role="progressbar" aria-label="Overall turnout" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${turn}"><span style="width:${turn}%"></span></div>
      <div class="wall-progress-note"><strong>${turn}%</strong> turnout <span>•</span> <strong>${U.num(m.notYet)}</strong> yet to arrive</div>
    </div>
    <div class="wall-side-stats">
      <div class="wall-stat"><span>ARRIVED IN THE LAST MINUTE</span><strong class="mono">${U.num(m.minute)}</strong><small>verified check-ins</small></div>
      <div class="wall-stat"><span>ARRIVED IN THE LAST 15 MINUTES</span><strong class="mono">${U.num(m.fifteen)}</strong><small>verified check-ins</small></div>
      <div class="wall-stat"><span>ARRIVED IN THE LAST HOUR</span><strong class="mono">${U.num(m.hour)}</strong><small>verified check-ins</small></div>
    </div>`;
  }

  V.wall = function () {
    const ev = App.event(), v = $("#view");
    if (!ev) { v.innerHTML = `<section class="wall-screen"><button class="btn btn-ghost" data-act="nav" data-view="overview">Exit Event Wall</button><p>No event selected.</p></section>`; return; }
    v.innerHTML = `<section class="wall-screen" aria-label="Public-facing event wall">
      <div class="wall-top"><div class="wall-brand"><span class="wall-brand-logo"><img data-logo alt="TCET logo"></span><span>TCET <em>EVENT WALL</em></span></div>
        <div class="wall-controls"><span id="wallFresh" class="wall-fresh" role="status">Connecting…</span>
          <button class="wall-button" type="button" data-act="wall-fullscreen">${ic('monitor')} <span>Full screen</span></button>
          <button class="wall-button" type="button" data-act="nav" data-view="overview">${ic('x')} <span>Exit wall</span></button></div>
      </div>
      <div class="wall-event-meta"><span class="wall-event-kicker">LIVE EVENT OVERVIEW</span><h1>${esc(ev.name)}</h1>
        <p>${U.longDate(ev.eventDate)}${ev.venue ? ' · ' + esc(ev.venue) : ''}</p></div>
      <div class="wall-metrics" id="wallMetrics"></div>
      <div class="wall-activity"><div class="wall-activity-head"><div><span>REAL-TIME ACTIVITY</span><h2>Arrival rhythm</h2></div><span>Past hour · five-minute intervals</span></div>
        <div id="wallActivity"></div></div>
      <footer class="wall-footer"><span>AC-STEM / TCET EVENT OPERATIONS</span><span>Aggregate attendance only · no participant details displayed</span></footer>
    </section>`;
    App.setLogos();
    V.updateWall();
  };

  V.updateWall = function () {
    if (S.view !== "wall") return;
    const metrics = $("#wallMetrics"), activity = $("#wallActivity"), fresh = $("#wallFresh");
    if (!metrics || !activity) return;
    const m = liveMetrics();
    metrics.innerHTML = wallMetricsHtml(m);
    activity.innerHTML = opsBars(m, true);
    if (fresh) {
      fresh.textContent = freshnessLabel(m);
      fresh.classList.toggle("is-stale", !m.fresh);
    }
    const btn = $('[data-act="wall-fullscreen"] span');
    if (btn) btn.textContent = document.fullscreenElement ? "Exit full screen" : "Full screen";
  };

  A['wall-fullscreen'] = () => {
    const app = $("#app");
    const task = document.fullscreenElement ? document.exitFullscreen() :
      (app.requestFullscreen ? app.requestFullscreen() : Promise.reject(new Error('Full screen is unavailable in this browser')));
    Promise.resolve(task).then(() => V.updateWall()).catch(() => App.toast('Full screen could not be enabled on this device.', 'warn'));
  };
  document.addEventListener('fullscreenchange', () => { if (S.view === 'wall') V.updateWall(); });

  /* ======================================================================
     EVENTS
     ====================================================================== */
  V.events = function () {
    const v = $("#view");
    const statusB = (s) => s === "closed" ? `<span class="badge neutral">Closed</span>` : s === "draft" ? `<span class="badge warn">Draft</span>` : `<span class="badge good">${ic("check")}Open</span>`;
    v.innerHTML = `<div class="card">
      <div class="card-head"><div><h3>${S.events.length} event${S.events.length === 1 ? "" : "s"}</h3><p>Each event has its own registrations, check-ins and charts.</p></div>
        ${canAdmin() ? `<button class="btn btn-primary" data-act="new-event">${ic("plus")}New event</button>` : ""}</div>
      ${S.events.length ? S.events.map((e) => {
        const s = S.stats[e.id] || { registered: 0, attended: 0 };
        return `<div class="event-row ${e.id === S.eventId ? "current" : ""}">
          <div><h4><span class="event-row-monogram" aria-hidden="true">${esc(String(e.name || "E").trim().charAt(0).toUpperCase())}</span>${esc(e.name)} ${statusB(e.status)}</h4><div class="sub">${U.longDate(e.eventDate)}${e.venue ? " · " + esc(e.venue) : ""}</div>${e.description ? `<div class="sub">${esc(e.description)}</div>` : ""}</div>
          <div><b class="mono" style="font-family:var(--font-display);font-size:22px">${U.num(s.attended)}</b> <span class="muted">of ${U.num(s.registered)} attended</span>
            <div class="mini-meter" aria-hidden="true"><i style="width:${U.pct(s.attended, s.registered)}%"></i></div></div>
          <div class="muted">${e.capacity ? `Capacity ${U.num(e.capacity)}<br>${U.pct(s.registered, e.capacity)}% registered` : "No capacity set"}</div>
          <div class="row-actions">
            ${e.id === S.eventId ? `<span class="badge info">Selected</span>` : `<button class="btn btn-sm" data-act="open-event" data-id="${e.id}">Open</button>`}
            ${canAdmin() ? `<button class="btn btn-sm btn-ghost" data-act="edit-event" data-id="${e.id}" aria-label="Edit ${esc(e.name)}">${ic("pencil")}</button>` : ""}
            ${canAdmin() && !e.isDefault ? `<button class="btn btn-sm btn-ghost" data-act="delete-event" data-id="${e.id}" aria-label="Delete ${esc(e.name)}">${ic("trash")}</button>` : ""}</div></div>`;
      }).join("") : `<div class="empty">${ic("calendar")}<b>No events yet</b><p>Create an event, then registrations from the form will show up under it.</p></div>`}
    </div>`;
  };

  function eventModal(e) {
    App.openModal(`<form data-form="event" data-id="${e ? e.id : ""}">
      <div class="modal-head"><div><h3>${e ? "Edit event" : "New event"}</h3></div></div>
      <div class="modal-body"><div class="form-grid">
        <label class="field span-2"><span>Event name</span><input name="name" type="text" required maxlength="100" value="${esc(e ? e.name : "")}"></label>
        <label class="field"><span>Date and time</span><input name="eventDate" type="datetime-local" required value="${e ? U.toLocalInput(e.eventDate) : ""}"></label>
        <label class="field"><span>Venue</span><input name="venue" type="text" maxlength="100" value="${esc(e ? e.venue || "" : "")}"></label>
        <label class="field"><span>Capacity</span><input name="capacity" type="number" min="0" value="${e && e.capacity ? e.capacity : ""}" placeholder="Seats available"></label>
        <label class="field"><span>Status</span><select name="status">${[["active", "Open"], ["draft", "Draft"], ["closed", "Closed"]].map(([v, l]) => `<option value="${v}" ${(e ? e.status : "active") === v ? "selected" : ""}>${l}</option>`).join("")}</select></label>
        <label class="field span-2"><span>Description (optional)</span><textarea name="description" maxlength="300">${esc(e ? e.description || "" : "")}</textarea></label>
      </div><p class="form-error" id="evErr" hidden></p></div>
      <div class="modal-foot"><button type="button" class="btn" data-act="close">Cancel</button><button class="btn btn-primary" type="submit">${e ? "Save changes" : "Create event"}</button></div></form>`);
  }
  A["new-event"] = () => eventModal(null);
  A["edit-event"] = (el) => eventModal(S.events.find((e) => e.id === el.dataset.id));
  A["open-event"] = (el) => App.selectEvent(el.dataset.id, { go: "overview" });
  App.forms.event = async (form) => {
    const f = new FormData(form), id = form.dataset.id, btn = form.querySelector("[type=submit]"); btn.disabled = true;
    const data = { name: f.get("name").trim(), eventDate: new Date(f.get("eventDate")).toISOString(), venue: f.get("venue").trim() || null,
      capacity: f.get("capacity") ? Number(f.get("capacity")) : null, status: f.get("status"), description: f.get("description").trim() || null };
    try {
      let saved;
      if (id) saved = await DB.updateEvent(id, data); else saved = await DB.createEvent(data);
      App.closeModal(); await App.loadEvents();
      if (!id) { App.toast("Event created."); await App.selectEvent(saved.id, { go: "overview" }); } else { App.toast("Event saved."); App.render(); }
    } catch (e) { btn.disabled = false; const el = $("#evErr"); el.textContent = e.message || "Couldn't save the event."; el.hidden = false; }
  };
  A["delete-event"] = async (el) => {
    const e = S.events.find((x) => x.id === el.dataset.id); if (!e) return;
    const n = (S.stats[e.id] || {}).registered || 0;
    const yes = await App.confirm({ title: `Delete “${e.name}”?`, body: DB.mode === "demo" ? `This deletes this demo event and its registrations.` : `You can only delete an empty, non-default event. Existing registrations and check-in history are protected.`, confirmLabel: "Delete event", danger: true });
    if (!yes) return;
    try {
      await DB.deleteEvent(e.id); await App.loadEvents();
      if (S.eventId === e.id) await App.selectEvent(App.pickDefaultEvent(), { go: "events" }); else App.render();
      App.toast("Event deleted.");
    } catch (err) { App.toast("Couldn't delete: " + (err.message || err), "err"); }
  };
})();
