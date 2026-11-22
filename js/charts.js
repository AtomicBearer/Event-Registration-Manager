/* Chart helpers (Chart.js). Marks follow the data-viz spec: thin bars with 4px rounded
   ends, 2px surface gaps between stacked fills, 2px lines, recessive grid, legend for
   2+ series, tooltips on hover, and a "Table" view on every chart.            */
(function () {
  const instances = [];
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function palette() {
    return { s1: css("--s1"), s2: css("--s2"), track: css("--track"), ink: css("--ink"), ink2: css("--ink-2"), ink3: css("--ink-3"), grid: css("--grid"), surface: css("--surface"), nav: css("--nav") };
  }
  function resolve(P, c) { return { s1: P.s1, s2: P.s2, track: P.track }[c] || c; }
  function rgba(hex, a) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex); if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }

  const centerText = {
    id: "centerText",
    afterDraw(chart, _a, opts) {
      if (!opts || !opts.text) return;
      const { ctx, chartArea: a } = chart;
      const cx = (a.left + a.right) / 2, cy = (a.top + a.bottom) / 2;
      ctx.save(); ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillStyle = opts.color;
      ctx.font = `700 ${Math.min(44, (a.right - a.left) / 4.2)}px ${css("--font-display")}`;
      ctx.fillText(opts.text, cx, cy - (opts.sub ? 8 : 0));
      if (opts.sub) { ctx.fillStyle = opts.subColor; ctx.font = `500 13px ${css("--font-ui")}`; ctx.fillText(opts.sub, cx, cy + 24); }
      ctx.restore();
    }
  };

  function tableHTML(chart) {
    const d = chart.data, esc = U.esc;
    if (chart.config.type === "doughnut") {
      const ds = d.datasets[0], total = ds.data.reduce((a, b) => a + b, 0);
      return `<table class="data"><thead><tr><th>${esc(chart.$meta.tableHead || "Group")}</th><th>Count</th><th>Share</th></tr></thead><tbody>` +
        d.labels.map((l, i) => `<tr><td>${esc(l)}</td><td class="mono">${ds.data[i]}</td><td class="mono">${U.pct(ds.data[i], total)}%</td></tr>`).join("") + "</tbody></table>";
    }
    return `<table class="data"><thead><tr><th>${esc(chart.$meta.tableHead || "")}</th>${d.datasets.map((s) => `<th>${esc(s.label)}</th>`).join("")}</tr></thead><tbody>` +
      d.labels.map((l, i) => `<tr><td>${esc(l)}</td>${d.datasets.map((s) => `<td class="mono">${s.data[i] ?? 0}</td>`).join("")}</tr>`).join("") + "</tbody></table>";
  }

  const Charts = {
    destroyAll() { instances.splice(0).forEach((c) => c.destroy()); },

    /* spec: { type:'ring'|'hbar'|'bar'|'line', labels, series:[{label,data,color}], stacked, center:{text,sub}, empty, tableHead, fmt } */
    render(id, spec) {
      const card = document.querySelector(`[data-chart="${id}"]`);
      if (!card) return null;
      const body = card.querySelector(".chart-body");
      const canvas = card.querySelector("canvas");
      body.querySelectorAll(".chart-empty,.chart-table").forEach((n) => n.remove());
      canvas.style.visibility = "visible";

      const total = spec.series.reduce((s, x) => s + x.data.reduce((a, b) => a + (b || 0), 0), 0);
      if (!spec.labels.length || total === 0) {
        canvas.style.visibility = "hidden";
        body.insertAdjacentHTML("beforeend", `<div class="chart-empty"><div>${U.esc(spec.empty || "No data yet")}</div></div>`);
        card.querySelectorAll(".chart-tools button").forEach((b) => (b.disabled = true));
        return null;
      }
      card.querySelectorAll(".chart-tools button").forEach((b) => (b.disabled = false));

      const P = palette();
      Chart.defaults.font.family = css("--font-ui");
      Chart.defaults.font.size = 12.5;
      Chart.defaults.color = P.ink3;
      Chart.defaults.animation = reduce ? false : { duration: 380, easing: "easeOutQuart" };

      const multi = spec.series.length > 1 || spec.type === "ring";
      const base = {
        responsive: true, maintainAspectRatio: false,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: { display: multi, position: "bottom", labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, padding: 16, color: P.ink2 } },
          tooltip: { backgroundColor: P.nav, titleColor: "#f1fbf4", bodyColor: "#d8f1e1", padding: 12, cornerRadius: 10, boxPadding: 5, usePointStyle: true,
            callbacks: spec.fmt ? { label: (c) => ` ${c.dataset.label}: ${spec.fmt(c.parsed.y ?? c.parsed.x ?? c.parsed)}` } : {} }
        }
      };
      let cfg;

      if (spec.type === "ring") {
        const ds = spec.series[0];
        cfg = {
          type: "doughnut",
          data: { labels: spec.labels, datasets: [{ data: ds.data, backgroundColor: (ds.colors || []).map((c) => resolve(P, c)), borderColor: P.surface, borderWidth: 3, hoverOffset: 4 }] },
          options: { ...base, cutout: "72%", interaction: { mode: "nearest", intersect: true },
            plugins: { ...base.plugins, centerText: spec.center ? { text: spec.center.text, sub: spec.center.sub, color: P.ink, subColor: P.ink3 } : {},
              tooltip: { ...base.plugins.tooltip, callbacks: { label: (c) => ` ${c.label}: ${c.parsed} (${U.pct(c.parsed, ds.data.reduce((a, b) => a + b, 0))}%)` } } } },
          plugins: [centerText]
        };
      } else if (spec.type === "line") {
        cfg = {
          type: "line",
          data: { labels: spec.labels, datasets: spec.series.map((s) => {
            const col = resolve(P, s.color || "s1");
            return { label: s.label, data: s.data, borderColor: col, backgroundColor: rgba(col, 0.13), fill: spec.fill !== false, borderWidth: 2, tension: 0.28,
              pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: col, pointHoverBorderColor: P.surface, pointHoverBorderWidth: 2 };
          }) },
          options: { ...base, scales: {
            x: { grid: { display: false }, border: { color: P.grid }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 9 } },
            y: { beginAtZero: true, grid: { color: P.grid }, border: { display: false }, ticks: { precision: 0 } } } }
        };
      } else {
        const horizontal = spec.type === "hbar";
        const stacked = !!spec.stacked;
        cfg = {
          type: "bar",
          data: { labels: spec.labels, datasets: spec.series.map((s) => ({
            label: s.label, data: s.data, backgroundColor: resolve(P, s.color || "s1"),
            borderRadius: stacked ? 4 : (horizontal ? { topRight: 4, bottomRight: 4 } : { topLeft: 4, topRight: 4 }),
            borderSkipped: stacked ? false : "start", borderColor: P.surface, borderWidth: stacked ? 2 : 0,
            maxBarThickness: horizontal ? 22 : 34 })) },
          options: { ...base, indexAxis: horizontal ? "y" : "x",
            scales: horizontal ? {
              x: { stacked, beginAtZero: true, grid: { color: P.grid }, border: { display: false }, ticks: { precision: 0 } },
              y: { stacked, grid: { display: false }, border: { color: P.grid }, ticks: { color: P.ink2 } }
            } : {
              x: { stacked, grid: { display: false }, border: { color: P.grid }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12, color: P.ink2 } },
              y: { stacked, beginAtZero: true, grid: { color: P.grid }, border: { display: false }, ticks: { precision: 0 } }
            } }
        };
      }

      const chart = new Chart(canvas.getContext("2d"), cfg);
      chart.$meta = { tableHead: spec.tableHead };
      chart.$spec = spec;
      instances.push(chart);

      // "Chart | Table" toggle — every chart is also readable as numbers
      const tools = card.querySelector(".chart-tools");
      if (tools) {
        const [bChart, bTable] = tools.querySelectorAll("button");
        const show = (asTable) => {
          bChart.setAttribute("aria-pressed", String(!asTable));
          bTable.setAttribute("aria-pressed", String(asTable));
          body.querySelectorAll(".chart-table").forEach((n) => n.remove());
          canvas.style.visibility = asTable ? "hidden" : "visible";
          if (asTable) body.insertAdjacentHTML("beforeend", `<div class="chart-table chart-empty" style="place-items:start stretch;padding:0">${tableHTML(chart)}</div>`);
        };
        bChart.onclick = () => show(false);
        bTable.onclick = () => show(true);
        show(false);
      }
      return chart;
    }
  };

  window.Charts = Charts;
})();
