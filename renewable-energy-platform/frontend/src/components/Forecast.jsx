import { useEffect, useRef, useState, useCallback } from "react";

const API_BASE = "http://localhost:8000/api";

/* ═══════════════════════════════════════════════════════════════════
   AURORA THEME — mirrors Dashboard palette exactly
   indigo #6366F1 · violet #8B5CF6 · rose #F43F5E
   emerald #10B981 · sky #0EA5E9 · gold #FBBF24 · amber #F59E0B
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  solar:   "#FBBF24",
  wind:    "#0EA5E9",
  total:   "#8B5CF6",
  demand:  "#F43F5E",
  emerald: "#10B981",
  indigo:  "#6366F1",
  amber:   "#F59E0B",
  text:    "#F8FAFC",
  textMd:  "rgba(248,250,252,0.60)",
  textLo:  "rgba(248,250,252,0.32)",
  ink:     "#0F172A",
  glass:   "rgba(255,255,255,0.055)",
  glassHi: "rgba(255,255,255,0.09)",
  border:  "rgba(255,255,255,0.09)",
};

const VIEWS   = [{ id:"today",label:"Today",icon:"☀" },{ id:"tomorrow",label:"Tomorrow",icon:"🌤" },{ id:"next24h",label:"Next 24h",icon:"⏱" }];
const SERIES  = [{ id:"all",label:"All",color:null },{ id:"solar",label:"Solar",color:T.solar },{ id:"wind",label:"Wind",color:T.wind },{ id:"total",label:"Total RE",color:T.total },{ id:"demand",label:"Demand",color:T.demand }];
const RES     = [{ id:"hourly",label:"Hourly" },{ id:"minutely_15",label:"15-min" }];

function hexToRgba(hex, alpha) {
  const h = hex.replace("#","");
  return `rgba(${parseInt(h.slice(0,2),16)},${parseInt(h.slice(2,4),16)},${parseInt(h.slice(4,6),16)},${alpha})`;
}

const SOLAR_DISTRICTS = [
  { name:"Tumkur/Pavagada",   installed_mw:2216 },
  { name:"Chitradurga",       installed_mw: 900 },
  { name:"Bellary",           installed_mw: 750 },
  { name:"Raichur",           installed_mw: 600 },
  { name:"Koppal",            installed_mw: 500 },
  { name:"Gadag",             installed_mw: 450 },
  { name:"Kalaburagi",        installed_mw: 350 },
  { name:"Vijayapura",        installed_mw: 300 },
  { name:"Bengaluru Rooftop", installed_mw: 400 },
  { name:"Rest of Karnataka", installed_mw:3434 },
];

/* ── Global CSS ─────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#0F172A; }

  @keyframes aurora-shift {
    0%,100% { opacity:.40; transform:scale(1) rotate(0deg); }
    33%      { opacity:.60; transform:scale(1.07) rotate(3deg); }
    66%      { opacity:.45; transform:scale(.96) rotate(-2deg); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes pulse-dot {
    0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.55); }
    70%      { box-shadow:0 0 0 8px rgba(16,185,129,0); }
  }
  @keyframes sun-pulse {
    0%,100% { r:5; }
    50%      { r:7; }
  }

  .fc-root {
    font-family:'Space Grotesk',sans-serif;
    background:#0F172A;
    min-height:100vh;
    color:#F8FAFC;
    position:relative;
    overflow:hidden;
  }
  .fc-aurora {
    position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden;
  }
  .fc-aurora-1 {
    position:absolute; top:-20%; left:-10%; width:58%; height:58%;
    background:radial-gradient(ellipse,rgba(99,102,241,.18) 0%,transparent 70%);
    animation:aurora-shift 14s ease-in-out infinite;
  }
  .fc-aurora-2 {
    position:absolute; bottom:-12%; right:-6%; width:54%; height:54%;
    background:radial-gradient(ellipse,rgba(244,63,94,.12) 0%,transparent 70%);
    animation:aurora-shift 19s ease-in-out infinite reverse;
  }
  .fc-aurora-3 {
    position:absolute; top:38%; left:30%; width:38%; height:38%;
    background:radial-gradient(ellipse,rgba(251,191,36,.07) 0%,transparent 70%);
    animation:aurora-shift 24s ease-in-out infinite 5s;
  }
  .fc-content {
    position:relative; z-index:2;
    padding:24px 20px 52px;
  }

  /* ── Topbar ── */
  .fc-topbar {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:26px; flex-wrap:wrap; gap:14px;
  }
  .fc-brand { display:flex; align-items:center; gap:12px; }
  .fc-brand-icon {
    width:38px; height:38px; border-radius:11px; flex-shrink:0;
    background:linear-gradient(135deg,#6366F1,#F43F5E);
    display:flex; align-items:center; justify-content:center;
    font-size:19px; box-shadow:0 4px 16px rgba(99,102,241,.4);
  }
  .fc-brand-title { font-size:16px; font-weight:700; color:#F8FAFC; letter-spacing:-.01em; }
  .fc-brand-sub { font-family:'JetBrains Mono',monospace; font-size:9px; color:rgba(248,250,252,.32); letter-spacing:.12em; text-transform:uppercase; margin-top:2px; }

  .fc-live-badge {
    display:flex; align-items:center; gap:7px;
    padding:5px 12px; border-radius:20px;
    background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.28);
    font-family:'JetBrains Mono',monospace; font-size:10px;
    font-weight:600; color:#10B981; letter-spacing:.08em;
  }
  .fc-live-dot {
    width:7px; height:7px; border-radius:50%; background:#10B981;
    animation:pulse-dot 1.8s ease-out infinite;
  }

  /* ── Control bar ── */
  .fc-controls {
    background:rgba(255,255,255,0.045);
    border:1px solid rgba(255,255,255,.09);
    border-radius:16px; padding:16px 20px;
    display:flex; flex-wrap:wrap; gap:18px; align-items:center;
    margin-bottom:22px;
    animation:fade-up .5s ease both;
  }
  .fc-ctrl-group { display:flex; flex-direction:column; gap:7px; }
  .fc-ctrl-label {
    font-family:'JetBrains Mono',monospace; font-size:8.5px;
    text-transform:uppercase; letter-spacing:.14em; color:rgba(248,250,252,.32);
  }
  .fc-ctrl-row { display:flex; gap:6px; flex-wrap:wrap; }

  .fc-pill {
    padding:6px 14px; font-size:11.5px; font-weight:500;
    border-radius:999px; border:1px solid rgba(255,255,255,.08);
    background:transparent; color:rgba(248,250,252,.45);
    cursor:pointer; transition:all .15s ease;
    font-family:'Space Grotesk',sans-serif; white-space:nowrap;
  }
  .fc-pill:hover { background:rgba(255,255,255,.06); color:rgba(248,250,252,.8); }
  .fc-pill.on {
    font-weight:600;
    background:rgba(99,102,241,.18); color:#A5B4FC;
    border-color:rgba(99,102,241,.35);
    box-shadow:0 0 14px rgba(99,102,241,.2);
  }
  .fc-pill.solar.on  { background:rgba(251,191,36,.14); color:#FBBF24; border-color:rgba(251,191,36,.3); box-shadow:0 0 14px rgba(251,191,36,.15); }
  .fc-pill.wind.on   { background:rgba(14,165,233,.14); color:#38BDF8; border-color:rgba(14,165,233,.3); box-shadow:0 0 14px rgba(14,165,233,.15); }
  .fc-pill.total.on  { background:rgba(139,92,246,.14); color:#C4B5FD; border-color:rgba(139,92,246,.3); box-shadow:0 0 14px rgba(139,92,246,.15); }
  .fc-pill.demand.on { background:rgba(244,63,94,.14);  color:#FDA4AF; border-color:rgba(244,63,94,.3);  box-shadow:0 0 14px rgba(244,63,94,.15); }

  .fc-divider { width:1px; height:32px; background:rgba(255,255,255,.08); }

  /* ── Stat cards strip ── */
  .fc-stats {
    display:grid; grid-template-columns:repeat(5,1fr); gap:14px;
    margin-bottom:22px;
  }
  @media(max-width:1100px){ .fc-stats { grid-template-columns:repeat(3,1fr); } }
  @media(max-width:700px) { .fc-stats { grid-template-columns:1fr 1fr; } }

  .fc-stat {
    background:rgba(255,255,255,.045);
    border:1px solid rgba(255,255,255,.09);
    border-radius:16px; padding:16px 18px;
    position:relative; overflow:hidden;
    animation:fade-up .5s ease both;
    transition:border-color .2s,transform .2s;
  }
  .fc-stat:hover { border-color:rgba(255,255,255,.16); transform:translateY(-2px); }
  .fc-stat-lbl {
    font-family:'JetBrains Mono',monospace; font-size:8.5px;
    text-transform:uppercase; letter-spacing:.14em;
    color:rgba(248,250,252,.32); margin-bottom:9px;
  }
  .fc-stat-val {
    font-size:22px; font-weight:700; letter-spacing:-.02em; line-height:1;
    margin-bottom:5px;
  }
  .fc-stat-sub { font-size:10.5px; color:rgba(248,250,252,.38); }
  .fc-stat-glow {
    position:absolute; top:-32px; right:-32px;
    width:90px; height:90px; border-radius:50%;
    filter:blur(30px); pointer-events:none;
  }
  .fc-stat-stripe {
    position:absolute; bottom:0; left:10%; right:10%; height:1.5px;
    border-radius:2px; opacity:.55;
  }

  /* ── Main 2-col layout ── */
  .fc-main {
    display:grid;
    grid-template-columns:1fr 380px;
    gap:20px;
    align-items:start;
  }
  @media(max-width:1000px){ .fc-main { grid-template-columns:1fr; } }

  /* ── Chart card ── */
  .fc-chart-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:20px; padding:22px 24px;
    animation:fade-up .55s ease both;
  }
  .fc-chart-legend {
    display:flex; gap:18px; flex-wrap:wrap;
    align-items:center; margin-bottom:18px;
  }
  .fc-legend-item { display:flex; align-items:center; gap:8px; font-size:11.5px; color:rgba(248,250,252,.55); font-weight:500; }
  .fc-legend-line { width:22px; height:2.5px; border-radius:2px; flex-shrink:0; }
  .fc-chart-wrap { position:relative; height:340px; }
  .fc-spinner {
    position:absolute; inset:0; display:flex;
    align-items:center; justify-content:center; gap:10px;
    color:rgba(248,250,252,.35); font-size:13px;
    font-family:'JetBrains Mono',monospace;
  }
  .fc-spinner-ring {
    width:18px; height:18px;
    border:2px solid rgba(255,255,255,.08);
    border-top-color:#6366F1;
    border-radius:50%;
    animation:spin .8s linear infinite;
  }
  .fc-error {
    padding:11px 14px; border-radius:10px; margin-bottom:14px;
    background:rgba(244,63,94,.1); border:1px solid rgba(244,63,94,.25);
    color:#FDA4AF; font-size:12px;
    font-family:'JetBrains Mono',monospace;
  }

  /* Section heading shared */
  .fc-section-head {
    display:flex; align-items:center; gap:9px;
    margin-bottom:16px;
  }
  .fc-section-accent { width:3px; height:14px; border-radius:2px; }
  .fc-section-label {
    font-family:'JetBrains Mono',monospace; font-size:9px;
    text-transform:uppercase; letter-spacing:.16em; color:rgba(248,250,252,.32);
    font-weight:600;
  }

  /* ── Right sidebar ── */
  .fc-sidebar { display:flex; flex-direction:column; gap:18px; }

  /* Day Arc card */
  .fc-arc-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:18px; padding:18px 20px;
    animation:fade-up .5s ease both;
  }

  /* Model info */
  .fc-model-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:18px; padding:18px 20px;
    animation:fade-up .55s ease both .08s;
  }
  .fc-model-item { margin-bottom:13px; }
  .fc-model-item:last-child { margin-bottom:0; }
  .fc-model-lbl {
    font-family:'JetBrains Mono',monospace; font-size:9px;
    text-transform:uppercase; letter-spacing:.12em;
    color:rgba(248,250,252,.32); margin-bottom:4px;
  }
  .fc-model-val { font-size:11.5px; color:rgba(248,250,252,.65); line-height:1.55; }

  /* ── Below-chart rows ── */
  .fc-bottom { display:flex; flex-direction:column; gap:20px; margin-top:20px; }

  /* District map */
  .fc-district-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:20px; padding:20px 22px;
    animation:fade-up .55s ease both;
  }
  .fc-district-hdr { display:flex; align-items:flex-start; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:18px; }
  .fc-district-title { font-size:14px; font-weight:600; color:#F8FAFC; }
  .fc-district-sub { font-size:11px; color:rgba(248,250,252,.35); margin-top:3px; }
  .fc-district-kpi-wrap { display:flex; gap:10px; flex-wrap:wrap; }
  .fc-district-kpi {
    border-radius:12px; padding:8px 16px;
    display:flex; flex-direction:column; align-items:center;
  }
  .fc-district-kpi-val { font-size:17px; font-weight:700; font-family:'JetBrains Mono',monospace; }
  .fc-district-kpi-lbl { font-size:9.5px; color:rgba(248,250,252,.38); margin-top:2px; }

  .fc-table-head {
    display:grid; grid-template-columns:1fr 60px 80px 52px;
    padding:8px 10px; border-bottom:1px solid rgba(255,255,255,.08);
    font-family:'JetBrains Mono',monospace; font-size:9px; text-transform:uppercase;
    letter-spacing:.1em; color:rgba(248,250,252,.32);
  }
  .fc-table-row {
    display:grid; grid-template-columns:1fr 60px 80px 52px;
    padding:10px 10px; border-bottom:1px solid rgba(255,255,255,.04);
    align-items:center; transition:background .15s; cursor:default;
    gap:4px;
  }
  .fc-table-row:hover { background:rgba(255,255,255,.025); }
  .fc-table-total {
    display:grid; grid-template-columns:1fr 60px 80px 52px;
    padding:11px 10px;
    border-top:1px solid rgba(255,255,255,.12);
    background:rgba(255,255,255,.025);
    border-radius:0 0 10px 10px;
    gap:4px;
  }
  .fc-mini-bar-wrap { height:3px; border-radius:2px; background:rgba(255,255,255,.07); margin-top:5px; overflow:hidden; }
  .fc-mini-bar { height:100%; border-radius:2px; transition:width .4s; }

  /* Grid events */
  .fc-events-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:20px; padding:20px 22px;
    animation:fade-up .6s ease both .05s;
  }
  .fc-event-row {
    display:grid; grid-template-columns:60px 1fr auto;
    gap:14px; align-items:center;
    padding:11px 14px; border-radius:12px;
    margin-bottom:8px; border:1px solid transparent;
    transition:border-color .2s;
  }
  .fc-event-row:hover { border-color:rgba(255,255,255,.1); }

  /* 15-min table */
  .fc-detail-card {
    background:rgba(255,255,255,.04);
    border:1px solid rgba(255,255,255,.09);
    border-radius:20px; padding:20px 22px;
    animation:fade-up .6s ease both .1s;
  }
  .fc-detail-table { width:100%; border-collapse:collapse; font-size:11.5px; }
  .fc-detail-table th {
    padding:8px 12px; text-align:right; border-bottom:1px solid rgba(255,255,255,.08);
    font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600;
    text-transform:uppercase; letter-spacing:.06em; color:rgba(248,250,252,.32);
    white-space:nowrap;
  }
  .fc-detail-table th:first-child { text-align:left; }
  .fc-detail-table td {
    padding:7px 12px; border-bottom:1px solid rgba(255,255,255,.04);
    text-align:right; font-family:'JetBrains Mono',monospace;
  }
  .fc-detail-table td:first-child { text-align:left; color:rgba(248,250,252,.4); }
  .fc-detail-table tbody tr:hover { background:rgba(255,255,255,.022); }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.1); border-radius:3px; }
`;

function injectCSS() {
  if (document.getElementById("fc-aurora-css")) return;
  const s = document.createElement("style");
  s.id = "fc-aurora-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ── Day Arc ────────────────────────────────────────────────────── */
function DayArc({ hour }) {
  const cx = 80, cy = 76, r = 56;
  const angle = (hour / 24) * Math.PI * 2 - Math.PI / 2;
  const sx = cx + r * Math.cos(angle);
  const sy = cy + r * Math.sin(angle);
  const isDay = hour >= 6 && hour <= 18;
  const dotCol = isDay ? T.solar : T.wind;
  const progress = (hour / 24) * 100;

  return (
    <div>
      <div className="fc-section-head">
        <div className="fc-section-accent" style={{ background: T.indigo, boxShadow: `0 0 8px ${T.indigo}` }} />
        <span className="fc-section-label">Day position</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width={160} height={120} viewBox="0 0 160 120" style={{ flexShrink: 0 }}>
          <defs>
            <linearGradient id="arcG" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={T.wind} stopOpacity=".5" />
              <stop offset="40%" stopColor={T.solar} stopOpacity=".9" />
              <stop offset="60%" stopColor={T.solar} stopOpacity=".9" />
              <stop offset="100%" stopColor={T.wind} stopOpacity=".5" />
            </linearGradient>
          </defs>
          {/* Full orbit ring */}
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,.07)" strokeWidth={2} />
          {/* Day arc */}
          <path d={`M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`}
            fill="none" stroke="url(#arcG)" strokeWidth={2.5} strokeLinecap="round" opacity=".6" />
          {/* Sun/Moon dot */}
          <circle cx={sx} cy={sy} r={11} fill={dotCol} opacity=".12" />
          <circle cx={sx} cy={sy} r={6} fill={dotCol} style={{ filter: `drop-shadow(0 0 6px ${dotCol})` }}>
            <animate attributeName="r" values="5;7;5" dur="2.8s" repeatCount="indefinite" />
          </circle>
          {/* Hour text */}
          <text x={cx} y={cy+5} textAnchor="middle" fontSize="14"
            fill="rgba(248,250,252,.75)" fontFamily="'JetBrains Mono',monospace" fontWeight="600">
            {String(hour).padStart(2,"0")}:00
          </text>
          <text x={cx} y={cy+22} textAnchor="middle" fontSize="9.5"
            fill="rgba(248,250,252,.30)" fontFamily="'Space Grotesk',sans-serif">
            {isDay ? "daylight" : "night"}
          </text>
        </svg>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, color: "rgba(248,250,252,.32)",
            fontFamily: "'JetBrains Mono',monospace", letterSpacing: ".1em",
            textTransform: "uppercase", marginBottom: 8 }}>Day progress</div>
          <div style={{ height: 6, background: "rgba(255,255,255,.07)", borderRadius: 6, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${progress}%`,
              background: `linear-gradient(90deg, ${T.wind}80, ${T.solar})`,
              borderRadius: 6, boxShadow: `0 0 12px ${T.solar}50`,
              transition: "width 1s ease" }} />
          </div>
          <div style={{ fontSize: 10, color: "rgba(248,250,252,.35)", marginTop: 5 }}>
            {hour}h of 24h elapsed
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <div style={{ flex: 1, background: "rgba(251,191,36,.10)", border: "1px solid rgba(251,191,36,.22)",
              borderRadius: 9, padding: "7px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.solar, fontWeight: 600,
                fontFamily: "'JetBrains Mono',monospace" }}>06:00</div>
              <div style={{ fontSize: 9, color: "rgba(248,250,252,.32)", marginTop: 1 }}>sunrise</div>
            </div>
            <div style={{ flex: 1, background: "rgba(14,165,233,.10)", border: "1px solid rgba(14,165,233,.22)",
              borderRadius: 9, padding: "7px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: T.wind, fontWeight: 600,
                fontFamily: "'JetBrains Mono',monospace" }}>18:00</div>
              <div style={{ fontSize: 9, color: "rgba(248,250,252,.32)", marginTop: 1 }}>sunset</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────────── */
function StatCard({ label, value, sub, color, delay = 0 }) {
  return (
    <div className="fc-stat" style={{ animationDelay: `${delay}ms` }}>
      <div className="fc-stat-glow" style={{ background: `${color}20` }} />
      <div className="fc-stat-lbl">{label}</div>
      <div className="fc-stat-val" style={{ color, textShadow: `0 0 20px ${color}50` }}>{value}</div>
      <div className="fc-stat-sub">{sub}</div>
      <div className="fc-stat-stripe" style={{ background: `linear-gradient(90deg,transparent,${color},transparent)` }} />
    </div>
  );
}

/* ── District Solar Map ─────────────────────────────────────────── */
function DistrictMap({ districts: propDistricts }) {
  const [live, setLive] = useState(null);
  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch(`${API_BASE}/solar/districts`);
        if (r.ok) setLive(await r.json());
      } catch (_) {}
    };
    go();
    const id = setInterval(go, 600000);
    return () => clearInterval(id);
  }, []);

  const cfColor = cf => cf >= 60 ? T.emerald : cf >= 30 ? T.solar : "#F43F5E";
  const liveList = live?.districts || propDistricts || [];

  return (
    <div className="fc-district-card">
      <div className="fc-district-hdr">
        <div>
          <div className="fc-section-head" style={{ marginBottom: 4 }}>
            <div className="fc-section-accent" style={{ background: T.solar, boxShadow: `0 0 8px ${T.solar}` }} />
            <span className="fc-section-label">District Solar Map</span>
          </div>
          <div className="fc-district-title">Live Generation by District</div>
          <div className="fc-district-sub">Open-Meteo · refreshes every 10 min</div>
        </div>
        {live && (
          <div className="fc-district-kpi-wrap">
            <div className="fc-district-kpi" style={{
              background: "rgba(251,191,36,.10)", border: "1px solid rgba(251,191,36,.22)" }}>
              <div className="fc-district-kpi-val" style={{ color: T.solar }}>
                {live.total_solar_mw?.toLocaleString("en-IN")} MW
              </div>
              <div className="fc-district-kpi-lbl">Karnataka total</div>
            </div>
            <div className="fc-district-kpi" style={{
              background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)" }}>
              <div className="fc-district-kpi-val" style={{ color: T.emerald }}>
                {live.state_cf_pct}%
              </div>
              <div className="fc-district-kpi-lbl">Capacity factor</div>
            </div>
          </div>
        )}
      </div>

      <div className="fc-table-head">
        <span>District</span>
        <span style={{ textAlign: "right" }}>Installed</span>
        <span style={{ textAlign: "right" }}>Live MW</span>
        <span style={{ textAlign: "right" }}>CF</span>
      </div>

      <div style={{ overflowY: "auto", maxHeight: 400 }}>
        {SOLAR_DISTRICTS.map((d, i) => {
          const row = liveList.find(x => x.name === d.name || x.district === d.name);
          const cf  = row?.cf_pct   ?? null;
          const mw  = row?.solar_mw ?? null;
          const sc  = cf !== null ? cfColor(cf) : "rgba(248,250,252,.25)";
          const pct = mw !== null ? Math.min(100, mw / d.installed_mw * 100) : 0;
          return (
            <div key={d.name} className="fc-table-row">
              <div>
                <div style={{ fontSize: 12.5, color: "rgba(248,250,252,.8)", fontWeight: 500 }}>{d.name}</div>
                <div className="fc-mini-bar-wrap">
                  <div className="fc-mini-bar" style={{ width: `${pct}%`, background: sc, boxShadow: `0 0 6px ${sc}99` }} />
                </div>
              </div>
              <div style={{ fontSize: 11, color: "rgba(248,250,252,.32)",
                textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
                {(d.installed_mw / 1000).toFixed(1)}k
              </div>
              <div style={{ fontSize: 12.5, color: T.solar, fontWeight: 700,
                textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
                {mw !== null ? mw.toLocaleString("en-IN") : "—"}
              </div>
              <div style={{ fontSize: 12.5, color: sc, fontWeight: 600,
                textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
                {cf !== null ? `${cf}%` : "—"}
              </div>
            </div>
          );
        })}

        {live && (
          <div className="fc-table-total">
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "#F8FAFC" }}>Karnataka total</div>
            <div style={{ fontSize: 11, color: "rgba(248,250,252,.32)", textAlign: "right",
              fontFamily: "'JetBrains Mono',monospace" }}>9.9k</div>
            <div style={{ fontSize: 12.5, color: T.solar, fontWeight: 700,
              textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
              {live.total_solar_mw?.toLocaleString("en-IN")}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, textAlign: "right",
              fontFamily: "'JetBrains Mono',monospace",
              color: (live.state_cf_pct >= 30 ? T.emerald : "rgba(248,250,252,.35)") }}>
              {live.state_cf_pct}%
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MAIN FORECAST COMPONENT
   ═══════════════════════════════════════════════════════════════════ */
export default function Forecast() {
  useEffect(() => { injectCSS(); }, []);

  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  const [data,       setData]       = useState(null);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);
  const [resolution, setResolution] = useState("hourly");
  const [view,       setView]       = useState("today");
  const [series,     setSeries]     = useState("all");
  const [districts,  setDistricts]  = useState([]);
  const [now,        setNow]        = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async (res, v) => {
    setLoading(true); setError(null);
    try {
      const r = await fetch(`${API_BASE}/forecast?resolution=${res}&view=${v}`);
      if (!r.ok) throw new Error(`Server error: ${r.status}`);
      setData(await r.json());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(resolution, view); }, [resolution, view, load]);

  useEffect(() => {
    const go = async () => {
      try {
        const r = await fetch(`${API_BASE}/solar/districts`);
        if (r.ok) setDistricts((await r.json()).districts || []);
      } catch (_) {}
    };
    go();
    const id = setInterval(go, 600000);
    return () => clearInterval(id);
  }, []);

  /* Load Chart.js */
  useEffect(() => {
    if (window.Chart) return;
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
    s.onload = () => { if (data) setData(d => ({...d})); };
    document.head.appendChild(s);
  }, []);

  /* Build chart */
  useEffect(() => {
    if (!data || !canvasRef.current || !window.Chart) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }

    const labels = data.labels || [];
    const ds     = [];
    const ctx    = canvasRef.current.getContext("2d");
    const h      = canvasRef.current.height || 340;

    const grad = (hex, a1, a2) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, hexToRgba(hex, a1));
      g.addColorStop(1, hexToRgba(hex, a2));
      return g;
    };

    if (series==="all"||series==="solar")
      ds.push({ label:"Solar MW", data:data.solar_mw,
        borderColor:T.solar, backgroundColor:grad(T.solar,.28,0),
        fill:true, tension:.45, borderWidth:2.5, pointRadius:0, pointHoverRadius:5 });

    if (series==="all"||series==="wind")
      ds.push({ label:"Wind MW", data:data.wind_mw,
        borderColor:T.wind, backgroundColor:grad(T.wind,.22,0),
        fill:true, tension:.4, borderWidth:2, pointRadius:0, pointHoverRadius:5 });

    if (series==="all"||series==="total")
      ds.push({ label:"Total RE", data:data.total_renewable_mw,
        borderColor:T.total, backgroundColor:"transparent",
        fill:false, tension:.4, borderWidth:2, borderDash:[4,3],
        pointRadius:0, pointHoverRadius:5 });

    if (series==="all"||series==="demand")
      ds.push({ label:"Demand (est)", data:data.demand_mw,
        borderColor:T.demand, backgroundColor:"transparent",
        fill:false, tension:.3, borderWidth:1.5, borderDash:[6,3],
        pointRadius:0, pointHoverRadius:4 });

    const nPts   = labels.length;
    const maxT   = resolution==="minutely_15" ? 16 : 12;
    const skipN  = Math.ceil(nPts / maxT);

    chartRef.current = new window.Chart(canvasRef.current, {
      type:"line",
      data:{ labels, datasets:ds },
      options:{
        responsive:true, maintainAspectRatio:false,
        interaction:{ mode:"index", intersect:false },
        plugins:{
          legend:{ display:false },
          tooltip:{
            backgroundColor:"rgba(15,23,42,0.97)",
            titleColor:"#F8FAFC", bodyColor:"rgba(248,250,252,.65)",
            borderColor:"rgba(255,255,255,.10)", borderWidth:1,
            padding:13, cornerRadius:12,
            titleFont:{ family:"'Space Grotesk',sans-serif", weight:"600", size:12 },
            bodyFont:{ family:"'JetBrains Mono',monospace", size:11 },
            callbacks:{ label:c=>`  ${c.dataset.label}: ${c.parsed.y?.toLocaleString("en-IN")} MW` },
          },
        },
        scales:{
          x:{
            ticks:{ maxTicksLimit:maxT, autoSkip:true, color:"rgba(248,250,252,.30)",
              font:{ size:10.5, family:"'JetBrains Mono',monospace" },
              callback:(_,i) => i % skipN===0 ? labels[i] : "" },
            grid:{ color:"rgba(255,255,255,.055)", drawBorder:false },
            border:{ display:false },
          },
          y:{
            ticks:{ color:"rgba(248,250,252,.30)",
              font:{ size:10.5, family:"'JetBrains Mono',monospace" },
              callback:v=>`${(v/1000).toFixed(1)}k` },
            grid:{ color:"rgba(255,255,255,.055)", drawBorder:false },
            border:{ display:false },
          },
        },
      },
    });
  }, [data, series, resolution]);

  const sm  = data?.summary;
  const hr  = now.getHours();
  const lbl = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;

  return (
    <div className="fc-root">
      {/* Aurora background */}
      <div className="fc-aurora">
        <div className="fc-aurora-1" />
        <div className="fc-aurora-2" />
        <div className="fc-aurora-3" />
      </div>

      <div className="fc-content">

        {/* ── TOP BAR ─────────────────────────────────────────────── */}
        <div className="fc-topbar">
          <div className="fc-brand">
            <div className="fc-brand-icon">☀</div>
            <div>
              <div className="fc-brand-title">Karnataka Grid Forecast</div>
              <div className="fc-brand-sub">24h Solar &amp; Wind · Open-Meteo</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            {data && (
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                color:"rgba(248,250,252,.32)", letterSpacing:".06em" }}>
                {data.data_points} pts
              </div>
            )}
            <div className="fc-live-badge">
              <div className="fc-live-dot" />
              LIVE · {lbl}
            </div>
          </div>
        </div>

        {/* ── CONTROLS ────────────────────────────────────────────── */}
        <div className="fc-controls">
          <div className="fc-ctrl-group">
            <div className="fc-ctrl-label">Period</div>
            <div className="fc-ctrl-row">
              {VIEWS.map(v => (
                <button key={v.id} className={`fc-pill ${view===v.id?"on":""}`}
                  onClick={() => setView(v.id)}>
                  {v.icon} {v.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fc-divider" />

          <div className="fc-ctrl-group">
            <div className="fc-ctrl-label">Resolution</div>
            <div className="fc-ctrl-row">
              {RES.map(r => (
                <button key={r.id} className={`fc-pill ${resolution===r.id?"on":""}`}
                  onClick={() => setResolution(r.id)}>
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          <div className="fc-divider" />

          <div className="fc-ctrl-group">
            <div className="fc-ctrl-label">Series</div>
            <div className="fc-ctrl-row">
              {SERIES.map(s => (
                <button key={s.id}
                  className={`fc-pill ${s.id} ${series===s.id?"on":""}`}
                  onClick={() => setSeries(s.id)}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── STAT STRIP ──────────────────────────────────────────── */}
        {sm && (
          <div className="fc-stats">
            <StatCard label="Peak Solar"   value={`${sm.peak_solar_mw?.toLocaleString("en-IN")} MW`} sub={`at ${sm.peak_solar_at}`}  color={T.solar}   delay={0}   />
            <StatCard label="Peak Wind"    value={`${sm.peak_wind_mw?.toLocaleString("en-IN")} MW`}  sub={`at ${sm.peak_wind_at}`}   color={T.wind}    delay={60}  />
            <StatCard label="Peak Total"   value={`${sm.peak_total_mw?.toLocaleString("en-IN")} MW`} sub="combined renewable"         color={T.total}   delay={120} />
            <StatCard label="Avg Solar"    value={`${sm.avg_solar_mw?.toLocaleString("en-IN")} MW`}  sub="period average"             color={T.amber}   delay={180} />
            <StatCard label="Avg Wind"     value={`${sm.avg_wind_mw?.toLocaleString("en-IN")} MW`}   sub="period average"             color={T.indigo}  delay={240} />
          </div>
        )}

        {/* ── MAIN 2-COL ──────────────────────────────────────────── */}
        <div className="fc-main">

          {/* LEFT: chart */}
          <div className="fc-chart-card">
            <div className="fc-section-head">
              <div className="fc-section-accent" style={{ background:T.indigo, boxShadow:`0 0 8px ${T.indigo}` }} />
              <span className="fc-section-label">Generation Forecast</span>
            </div>

            {/* Legend */}
            <div className="fc-chart-legend">
              {[
                { color:T.solar,  label:"Solar MW",       dash:false },
                { color:T.wind,   label:"Wind MW",        dash:false },
                { color:T.total,  label:"Total RE",       dash:true  },
                { color:T.demand, label:"Demand (est)",   dash:true  },
              ].map(l => (
                <span key={l.label} className="fc-legend-item">
                  <span className="fc-legend-line" style={{
                    background: l.dash ? "transparent" : l.color,
                    borderTop:  l.dash ? `2.5px dashed ${l.color}` : "none",
                    boxShadow:  l.dash ? "none" : `0 0 6px ${l.color}70`,
                  }} />
                  {l.label}
                </span>
              ))}
            </div>

            {error && <div className="fc-error">⚠ {error}</div>}

            <div className="fc-chart-wrap">
              {loading && (
                <div className="fc-spinner">
                  <span className="fc-spinner-ring" />
                  Loading forecast…
                </div>
              )}
              <canvas ref={canvasRef} role="img" aria-label="Renewable energy forecast chart" />
            </div>
          </div>

          {/* RIGHT: sidebar */}
          <div className="fc-sidebar">

            {/* Day arc */}
            <div className="fc-arc-card">
              <DayArc hour={hr} />
            </div>

            {/* Model info */}
            {data?.models && (
              <div className="fc-model-card">
                <div className="fc-section-head">
                  <div className="fc-section-accent" style={{ background:T.violet||T.total, boxShadow:`0 0 8px ${T.total}` }} />
                  <span className="fc-section-label">Forecast Models</span>
                </div>
                {[
                  { icon:"🔆", label:"Solar model", value:data.models.solar },
                  { icon:"🌬", label:"Wind model",  value:data.models.wind  },
                  { icon:"📡", label:"Input data",  value:data.models.data  },
                ].map(m => (
                  <div key={m.label} className="fc-model-item">
                    <div className="fc-model-lbl">{m.icon} {m.label}</div>
                    <div className="fc-model-val">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Source badge when no model info */}
            {!data?.models && data && (
              <div className="fc-model-card" style={{ textAlign:"center" }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                  color:"rgba(248,250,252,.32)", letterSpacing:".1em",
                  textTransform:"uppercase", marginBottom:10 }}>Data source</div>
                <div style={{ display:"inline-flex", alignItems:"center", gap:7,
                  padding:"6px 14px", borderRadius:20,
                  background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.28)",
                  color:T.emerald, fontSize:12, fontFamily:"'JetBrains Mono',monospace" }}>
                  <div style={{ width:6,height:6,borderRadius:"50%",background:T.emerald,
                    animation:"pulse-dot 1.8s infinite" }} />
                  Open-Meteo
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── BELOW-CHART SECTIONS ─────────────────────────────────── */}
        <div className="fc-bottom">

          {/* Grid Events */}
          {data?.grid_events?.length > 0 && (
            <div className="fc-events-card">
              <div className="fc-section-head">
                <div className="fc-section-accent" style={{ background:T.demand, boxShadow:`0 0 8px ${T.demand}` }} />
                <span className="fc-section-label">Grid Events</span>
              </div>
              {data.grid_events.map((ev, i) => {
                const isDanger = ev.impact_level === "danger";
                const ac = isDanger ? T.demand : T.solar;
                return (
                  <div key={i} className="fc-event-row" style={{
                    background:`${ac}0e`, borderColor:`${ac}22` }}>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace",
                      fontSize:12, color:ac, fontWeight:700 }}>{ev.time}</span>
                    <div>
                      <div style={{ fontSize:12.5, fontWeight:600, color:ac }}>{ev.event}</div>
                      <div style={{ fontSize:11, color:"rgba(248,250,252,.45)", marginTop:2 }}>{ev.action}</div>
                    </div>
                    <div style={{ fontSize:12, color:"rgba(248,250,252,.70)",
                      textAlign:"right", whiteSpace:"nowrap" }}>{ev.impact}</div>
                  </div>
                );
              })}
            </div>
          )}

          {/* District Map */}
          <DistrictMap districts={districts} />

          {/* 15-min table */}
          {data && resolution==="minutely_15" && data.hourly_detail?.length > 0 && (
            <div className="fc-detail-card">
              <div className="fc-section-head">
                <div className="fc-section-accent" style={{ background:T.total, boxShadow:`0 0 8px ${T.total}` }} />
                <span className="fc-section-label">15-min Breakdown</span>
              </div>
              <div style={{ overflowX:"auto" }}>
                <table className="fc-detail-table">
                  <thead>
                    <tr>
                      {["Time","Solar MW","Wind MW","Total MW","Demand MW","Balance MW","Rad W/m²","Wind m/s","Cloud %"].map(h => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.hourly_detail.slice(0,64).map((r, i) => {
                      const bal = r.balance_mw;
                      const bc  = bal > 200 ? T.emerald : bal < -200 ? T.demand : "rgba(248,250,252,.45)";
                      return (
                        <tr key={i}>
                          <td>{r.label}</td>
                          <td style={{ color:T.solar,  fontWeight:600 }}>{r.solar_mw?.toLocaleString("en-IN")}</td>
                          <td style={{ color:T.wind,   fontWeight:600 }}>{r.wind_mw?.toLocaleString("en-IN")}</td>
                          <td style={{ color:T.total,  fontWeight:600 }}>{r.total_renewable_mw?.toLocaleString("en-IN")}</td>
                          <td style={{ color:"rgba(248,250,252,.55)" }}>{r.demand_mw?.toLocaleString("en-IN")}</td>
                          <td style={{ color:bc, fontWeight:600 }}>{bal > 0 ? "+" : ""}{bal?.toLocaleString("en-IN")}</td>
                          <td style={{ color:"rgba(248,250,252,.35)" }}>{r.direct_radiation_wm2}</td>
                          <td style={{ color:"rgba(248,250,252,.35)" }}>{r.wind_speed_100m_ms}</td>
                          <td style={{ color:"rgba(248,250,252,.35)" }}>{r.cloud_cover_pct}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {data.hourly_detail.length > 64 && (
                  <div style={{ fontSize:11, color:"rgba(248,250,252,.28)",
                    padding:"10px 12px", fontFamily:"'JetBrains Mono',monospace" }}>
                    Showing 64 of {data.hourly_detail.length} rows
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>{/* /fc-content */}
    </div>
  );
}