/* Small helpers shared by every module. Exposes window.U */
(function () {
  const U = {};

  /* ---------- hashing (passcode) ---------- */
  function sha256Fallback(str) {
    const bytes = new TextEncoder().encode(str);
    const rrot = (v, a) => (v >>> a) | (v << (32 - a));
    const frac = (x) => Math.floor((x - Math.floor(x)) * 4294967296);
    const primes = [];
    for (let n = 2; primes.length < 64; n++) if (primes.every((p) => n % p)) primes.push(n);
    const K = primes.map((p) => frac(Math.cbrt(p)));
    let H = primes.slice(0, 8).map((p) => frac(Math.sqrt(p)));
    const l = bytes.length;
    const nBlocks = ((l + 8) >> 6) + 1;
    const w = new Array(nBlocks * 16).fill(0);
    for (let i = 0; i < l; i++) w[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
    w[l >> 2] |= 0x80 << (24 - (l % 4) * 8);
    w[nBlocks * 16 - 1] = (l * 8) | 0;
    w[nBlocks * 16 - 2] = Math.floor((l * 8) / 4294967296);
    for (let b = 0; b < nBlocks; b++) {
      const W = w.slice(b * 16, b * 16 + 16);
      for (let t = 16; t < 64; t++) {
        const s0 = rrot(W[t - 15], 7) ^ rrot(W[t - 15], 18) ^ (W[t - 15] >>> 3);
        const s1 = rrot(W[t - 2], 17) ^ rrot(W[t - 2], 19) ^ (W[t - 2] >>> 10);
        W[t] = (W[t - 16] + s0 + W[t - 7] + s1) | 0;
      }
      let [a, b2, c, d, e, f, g, h] = H;
      for (let t = 0; t < 64; t++) {
        const S1 = rrot(e, 6) ^ rrot(e, 11) ^ rrot(e, 25);
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[t] + W[t]) | 0;
        const S0 = rrot(a, 2) ^ rrot(a, 13) ^ rrot(a, 22);
        const maj = (a & b2) ^ (a & c) ^ (b2 & c);
        const t2 = (S0 + maj) | 0;
        h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b2; b2 = a; a = (t1 + t2) | 0;
      }
      const v = [a, b2, c, d, e, f, g, h];
      H = H.map((x, i) => (x + v[i]) | 0);
    }
    return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  U.sha256Fallback = sha256Fallback;
  U.sha256 = async function (str) {
    if (window.crypto && crypto.subtle) {
      try {
        const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
        return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, "0")).join("");
      } catch (e) { /* fall through */ }
    }
    return sha256Fallback(str);
  };

  /* ---------- ids / text ---------- */
  U.uuid = function () {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    const b = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? crypto.getRandomValues(b) : b.forEach((_, i) => (b[i] = Math.random() * 256));
    b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  };

  U.esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  U.initials = (name) =>
    String(name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  U.debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  /* A scanned QR may hold a bare ID, a URL containing the ID, or JSON. Pull out the ID. */
  U.parseRegId = function (text) {
    const t = String(text || "").trim();
    const m = t.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (m) return m[0].toLowerCase();
    return t;
  };

  /* ---------- dates ---------- */
  const fDate = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const fDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" });
  const fTime = new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const fLong = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
  const d = (v) => (v ? new Date(v) : null);
  U.date = (v) => (d(v) ? fDate.format(d(v)) : "—");
  U.day = (v) => (d(v) ? fDay.format(d(v)) : "—");
  U.time = (v) => (d(v) ? fTime.format(d(v)).toUpperCase() : "—");
  U.dateTime = (v) => (d(v) ? `${fDay.format(d(v))}, ${fTime.format(d(v)).toUpperCase()}` : "—");
  U.longDate = (v) => (d(v) ? fLong.format(d(v)) : "—");
  U.toLocalInput = (v) => {
    if (!v) return "";
    const x = new Date(v); x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 16);
  };
  U.ago = function (v) {
    const s = Math.round((Date.now() - new Date(v).getTime()) / 1000);
    if (s < 45) return "just now";
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  };
  U.untilEvent = function (v) {
    if (!v) return "";
    const diff = new Date(v).getTime() - Date.now();
    const abs = Math.abs(diff), mins = abs / 60000;
    const txt = mins < 90 ? `${Math.round(mins)} min` : mins < 2880 ? `${Math.round(mins / 60)} h` : `${Math.round(mins / 1440)} days`;
    return diff > 0 ? `starts in ${txt}` : `started ${txt} ago`;
  };

  U.pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  U.num = (n) => Number(n || 0).toLocaleString("en-IN");

  /* ---------- export ---------- */
  U.download = function (filename, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  // Cells starting with = + - @ are prefixed so Excel can't run them as formulas
  // (registration data comes from a public form).
  const safeCell = (v) => {
    if (v === null || v === undefined) return "";
    let s = v instanceof Date ? v.toISOString() : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
    return s;
  };
  U.safeCell = safeCell;
  U.toCSV = function (rows, columns) {
    const q = (s) => (/[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const head = columns.map((c) => q(c.label)).join(",");
    const body = rows.map((r) => columns.map((c) => q(safeCell(c.get(r)))).join(","));
    return "﻿" + [head, ...body].join("\r\n");
  };

  U.slug = (s) => String(s || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

  window.U = U;
})();
