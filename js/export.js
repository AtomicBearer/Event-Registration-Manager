/* ==========================================================================
   Export: CSV, Excel (.xlsx), JSON and a print / save-as-PDF report.
   ========================================================================== */
(function () {
  const { S, C, $, ic } = App;
  const esc = U.esc;

  const p2 = (n) => String(n).padStart(2, "0");
  const ts = (v) => { if (!v) return ""; const d = new Date(v); return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}:${p2(d.getMinutes())}`; };
  const method = (m) => (m === "manual" ? "Manual" : m === "qr" ? "QR scan" : "");

  const REG_COLS = [
    { label: "Registration ID", key: "registrationId", get: (r) => r.id },
    { label: "Full name", key: "fullName", get: (r) => r.fullName },
    { label: "Email", key: "email", get: (r) => r.email },
    { label: "Phone", key: "phone", get: (r) => r.phone },
    { label: "Current school / college", key: "collegeSchoolName", get: (r) => r.collegeSchoolName },
    { label: "Class", key: "year", get: (r) => r.year },
    { label: "Stream", key: "stream", get: (r) => r.stream || r.department },
    { label: "Parent / guardian name", key: "parentName", get: (r) => r.parentName },
    { label: "Parent / guardian phone", key: "parentPhone", get: (r) => r.parentPhone },
    { label: "Parents (registration form)", key: "attendingWith", get: (r) => r.attendingWith },
    { label: "Parents (at check-in)", key: "eventDayParentAttendance", get: (r) => r.eventDayParentAttendance },
    { label: "Number of parents at check-in", key: "eventDayParentCount", get: (r) => ({"None":0,"One parent":1,"Both parents":2})[r.eventDayParentAttendance] ?? "" },
    { label: "Preferred Thakur institute", key: "preferredThakurInstitute", get: (r) => r.preferredThakurInstitute },
    { label: "Preferred programme", key: "preferredProgram", get: (r) => r.preferredProgram },
    { label: "Preferred engineering branch", key: "preferredBranches", get: (r) => r.preferredBranches },
    { label: "Division", key: "division", get: (r) => r.division },
    { label: "Registered at", key: "registeredAt", get: (r) => ts(r.registeredAt) },
    { label: "Status", key: "status", get: (r) => (r.attended ? "Present" : "Not yet") },
    { label: "Checked in at", key: "checkedInAt", get: (r) => ts(r.attendedAt) },
    { label: "Check-in method", key: "checkInMethod", get: (r) => method(r.checkInMethod) },
    { label: "Checked in by", key: "checkedInBy", get: (r) => r.checkedInBy },
    { label: "Manual reason", key: "manualReason", get: (r) => r.manualReason },
    { label: "Notes", key: "notes", get: (r) => r.notes }
  ];
  const EVENT_COLS = [
    { label: "Event", key: "event", get: (e) => e.name },
    { label: "Date", key: "date", get: (e) => ts(e.eventDate) },
    { label: "Venue", key: "venue", get: (e) => e.venue },
    { label: "Status", key: "status", get: (e) => e.status },
    { label: "Capacity", key: "capacity", get: (e) => e.capacity },
    { label: "Registered", key: "registered", get: (e) => (S.stats[e.id] || {}).registered || 0 },
    { label: "Attended", key: "attended", get: (e) => (S.stats[e.id] || {}).attended || 0 },
    { label: "Turnout %", key: "turnoutPercent", get: (e) => { const s = S.stats[e.id] || {}; return U.pct(s.attended || 0, s.registered || 0); } }
  ];

  function datasets() {
    const r = S.regs, sel = [...S.selected];
    return [
      { id: "all", label: "Everyone registered", hint: "Every registration for this event", n: r.length },
      { id: "present", label: "Present", hint: "Checked in, with time and method", n: r.filter((x) => x.attended).length },
      { id: "absent", label: "Not yet arrived", hint: "Registered but not checked in (the no-show list)", n: r.filter((x) => !x.attended).length },
      { id: "manual", label: "Manual check-ins", hint: "Marked by hand, with reasons", n: r.filter((x) => x.attended && x.checkInMethod === "manual").length },
      { id: "filtered", label: "Current search and filters", hint: "Exactly what the Registrations page is showing", n: App.filteredRegs().length },
      ...(sel.length ? [{ id: "selected", label: "Selected people", hint: "Rows ticked on the Registrations page", n: sel.length }] : []),
      { id: "operations", label: "Operations intelligence (aggregate)", hint: "Scanner throughput, staff activity, parent confirmations, 15-minute slots and data quality; no student names, emails, phone numbers or QR tokens", n: App.event() ? App.ops.analyze(S.regs,App.event()).report.length : 0 },
      { id: "events", label: "All events summary", hint: "One row per event with totals", n: S.events.length }
    ];
  }

  function pick(id) {
    const r = S.regs;
    if (id === "operations") {
      const report=App.ops.analyze(S.regs,App.event()).report;
      const rows=report.slice(1).filter(r=>r.length).map(r=>({metric:String(r[0]),value:r[1]??''}));
      return {rows,cols:[{label:'Metric / group',key:'metric',get:r=>r.metric},{label:'Value',key:'value',get:r=>r.value}],kind:'operations'};
    }
    if (id === "events") return { rows: S.events, cols: EVENT_COLS, kind: "events" };
    let rows = r;
    if (id === "present") rows = r.filter((x) => x.attended);
    else if (id === "absent") rows = r.filter((x) => !x.attended);
    else if (id === "manual") rows = r.filter((x) => x.attended && x.checkInMethod === "manual");
    else if (id === "filtered") rows = App.filteredRegs();
    else if (id === "selected") rows = r.filter((x) => S.selected.has(x.id));
    return { rows, cols: REG_COLS, kind: "registrations" };
  }

  const fileBase = (id) => {
    const ev = App.event(); const d = new Date();
    const date = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`;
    return id === "events" ? `tcet-events-summary-${date}` : `${U.slug(ev ? ev.name : "event")}-${id}-${date}`;
  };

  function summarySheet() {
    const ev = App.event(), st = App.calc(S.regs);
    const aoa = [["Event", ev.name], ["Date", ts(ev.eventDate)], ["Venue", ev.venue || ""], ["Exported", ts(new Date())], [],
      ["Registered", st.total], ["Attended", st.att], ["Not yet", st.notYet], ["Turnout %", st.rate], ["Checked in by QR", st.qr], ["Marked manually", st.manual], [],
      ["Stream", "Registered", "Attended", "Turnout %"], ...App.groupBy(S.regs, "department").map((g) => [g.label, g.total, g.att, U.pct(g.att, g.total)]), [],
      ["Class", "Registered", "Attended", "Turnout %"], ...App.groupBy(S.regs, "year", C.YEARS).map((g) => [g.label, g.total, g.att, U.pct(g.att, g.total)])];
    const ws = XLSX.utils.aoa_to_sheet(aoa); ws["!cols"] = [{ wch: 22 }, { wch: 28 }, { wch: 12 }, { wch: 12 }];
    return ws;
  }

  function run(format) {
    const id = S.exportSet, { rows, cols, kind } = pick(id);
    if (kind !== "events" && !App.event()) return App.toast("Choose an event first.", "warn");
    if (!rows.length) return App.toast("There's nothing in that list to export yet.", "warn");
    const base = fileBase(id);
    try {
      if (format === "csv") {
        U.download(base + ".csv", new Blob([U.toCSV(rows, cols)], { type: "text/csv;charset=utf-8" }));
      } else if (format === "xlsx") {
        const aoa = [cols.map((c) => c.label), ...rows.map((r) => cols.map((c) => { const v = c.get(r); return v === undefined || v === null ? "" : v; }))];
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws["!cols"] = cols.map((c) => ({ wch: Math.min(40, Math.max(c.label.length + 2, ...rows.slice(0, 200).map((r) => String(c.get(r) ?? "").length + 2))) }));
        ws["!freeze"] = { xSplit: 0, ySplit: 1 };
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, kind === "events" ? "Events" : kind === "operations" ? "Operations" : "Registrations");
        if (kind === "registrations") XLSX.utils.book_append_sheet(wb, summarySheet(), "Summary");
        XLSX.writeFile(wb, base + ".xlsx");
      } else if (format === "json") {
        const out = rows.map((r) => Object.fromEntries(cols.map((c) => [c.key, c.get(r) ?? null])));
        U.download(base + ".json", new Blob([JSON.stringify(out, null, 2)], { type: "application/json" }));
      } else if (format === "print") {
        printReport(rows, cols, kind, id);
        return;
      }
      App.toast(`Exported ${U.num(rows.length)} row${rows.length === 1 ? "" : "s"} as ${format === "xlsx" ? "Excel" : format.toUpperCase()}.`);
    } catch (e) { console.error(e); App.toast("Export failed: " + (e.message || e), "err"); }
  }

  function printReport(rows, cols, kind, id) {
    const ev = App.event(), st = App.calc(S.regs);
    const show = kind === "events" || kind === "operations" ? cols : REG_COLS.filter((c) => ["fullName", "collegeSchoolName", "stream", "year", "status", "checkedInAt", "checkInMethod"].includes(c.key));
    const dept = App.groupBy(S.regs, "department");
    $("#printReport").innerHTML = `
      <div class="pr-head"><img src="${esc(C.ORG.logo)}" onerror="this.onerror=null;this.src='${esc(C.ORG.logoFallback)}'" alt="">
        <div><h1>${esc(C.ORG.name)}</h1><div>${esc(ev ? ev.name : "Events")} ${ev ? "· " + esc(U.longDate(ev.eventDate)) + (ev.venue ? " · " + esc(ev.venue) : "") : ""}</div></div></div>
      ${kind === "operations" ? `<p class="muted" style="font-size:12px">Current active check-ins only · aggregate staff data · not a historical audit log</p>` : ''}
      ${kind === "registrations" ? `<div class="pr-stats"><div><b>${st.total}</b>registered</div><div><b>${st.att}</b>attended</div><div><b>${st.notYet}</b>not yet</div><div><b>${st.rate}%</b>turnout</div><div><b>${st.manual}</b>manual</div></div>
      <h2>By department</h2><table><thead><tr><th>Department</th><th>Registered</th><th>Attended</th><th>Turnout</th></tr></thead><tbody>
        ${dept.map((g) => `<tr><td>${esc(g.label)}</td><td>${g.total}</td><td>${g.att}</td><td>${U.pct(g.att, g.total)}%</td></tr>`).join("")}</tbody></table>` : ""}
      <h2>${esc(datasets().find((d) => d.id === id).label)} (${rows.length})</h2>
      <table><thead><tr>${show.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr></thead><tbody>
        ${rows.map((r) => `<tr>${show.map((c) => `<td>${esc(c.get(r) ?? "")}</td>`).join("")}</tr>`).join("")}</tbody></table>
      <p style="margin-top:14px;font-size:11px;color:#555">Printed ${esc(ts(new Date()))} by ${esc(S.user)}</p>`;
    const clear = () => { $("#printReport").innerHTML = ""; window.removeEventListener("afterprint", clear); };
    window.addEventListener("afterprint", clear);
    setTimeout(() => window.print(), 150);
  }

  App.views.export = function () {
    const v = $("#view");
    const ds = datasets();
    if (!ds.some((d) => d.id === S.exportSet)) S.exportSet = "all";
    const cur = ds.find((d) => d.id === S.exportSet);
    v.innerHTML = `<div class="export-grid">
      <section class="card"><div class="card-head"><div><h3>What to export</h3><p>${App.event() ? esc(App.event().name) : "No event selected"}</p></div></div>
        <div class="radio-list" role="radiogroup">${ds.map((d) => `<label><input type="radio" name="expset" value="${d.id}" ${d.id === S.exportSet ? "checked" : ""}>
          <span><b>${d.label} <span class="muted" style="font-weight:500">· ${U.num(d.n)}</span></b><small>${d.hint}</small></span></label>`).join("")}</div></section>
      <section class="card"><div class="card-head"><div><h3>Choose a format</h3><p>${U.num(cur.n)} row${cur.n === 1 ? "" : "s"} will be exported</p></div></div>
        <div class="format-btns">
          <button class="btn" data-act="export" data-format="csv">${ic("file")}CSV<small>opens in Excel, Sheets, Numbers</small></button>
          <button class="btn" data-act="export" data-format="xlsx">${ic("sheet")}Excel (.xlsx)<small>with a summary sheet</small></button>
          <button class="btn" data-act="export" data-format="json">${ic("braces")}JSON<small>for other tools and scripts</small></button>
          <button class="btn" data-act="export" data-format="print">${ic("print")}Print or save as PDF<small>report with TCET header</small></button>
        </div>
        <p class="muted" style="font-size:13px;margin-top:14px">Exports reflect the latest loaded snapshot. Operations reports are aggregate-only; registration exports contain personal data and should stay within authorized TCET staff.</p>
        <p class="muted" style="font-size:13px;margin-top:8px">CSV spreadsheet-formula injection protections remain enabled.</p></section>
    </div>`;
  };
  App.actions.export = (el) => run(el.dataset.format);
})();
