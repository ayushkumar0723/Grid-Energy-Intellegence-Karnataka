import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   AURORA THEME — Indigo-to-Rose gradient, warm white panels
   Completely different from the dark SCADA terminal version.
   ═══════════════════════════════════════════════════════════════════ */
const C = {
  indigo:   "#6366F1",
  violet:   "#8B5CF6",
  rose:     "#F43F5E",
  amber:    "#F59E0B",
  emerald:  "#10B981",
  sky:      "#0EA5E9",
  gold:     "#FBBF24",
  ink:      "#0F172A",
  inkMd:    "#1E293B",
  inkLo:    "#334155",
  muted:    "#64748B",
  dim:      "#94A3B8",
  glass:    "rgba(255,255,255,0.06)",
  glassHi:  "rgba(255,255,255,0.10)",
  border:   "rgba(255,255,255,0.09)",
  text:     "#F8FAFC",
  textMd:   "rgba(248,250,252,0.65)",
  textLo:   "rgba(248,250,252,0.35)",
};

const ESCOM_COLORS = {
  BESCOM: C.sky,
  HESCOM: C.emerald,
  GESCOM: C.gold,
  MESCOM: C.violet,
  CESC:   C.amber,
};

const fmt  = (n) => Number(n || 0).toLocaleString("en-IN");
const fpct = (a, b) => b > 0 ? Math.min(100, (a / b) * 100).toFixed(1) : "0.0";

/* ═══════════════════════════════════════════════════════════════════
   INJECT GLOBAL CSS
   ═══════════════════════════════════════════════════════════════════ */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #0F172A; font-family: 'Space Grotesk', sans-serif; }

  @keyframes aurora-shift {
    0%, 100% { opacity: 0.45; transform: scale(1) rotate(0deg); }
    33%       { opacity: 0.65; transform: scale(1.08) rotate(4deg); }
    66%       { opacity: 0.50; transform: scale(0.95) rotate(-3deg); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes pulse-dot {
    0%, 100% { transform: scale(1);    opacity: 1;   }
    50%       { transform: scale(0.7); opacity: 0.4; }
  }
  @keyframes ring-expand {
    from { transform: scale(1); opacity: 0.7; }
    to   { transform: scale(2.4); opacity: 0; }
  }
  @keyframes ticker-flow {
    from { stroke-dashoffset: 600; }
    to   { stroke-dashoffset: 0; }
  }
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes count-in {
    from { opacity: 0; transform: scale(0.88); }
    to   { opacity: 1; transform: scale(1); }
  }

  .acard {
    background: rgba(255,255,255,0.055);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 20px;
    padding: 22px 24px;
    position: relative;
    overflow: hidden;
    animation: fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both;
    transition: border-color 0.2s, background 0.2s;
  }
  .acard::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(99,102,241,0.06) 0%, transparent 55%);
    pointer-events: none;
  }
  .acard:hover { border-color: rgba(255,255,255,0.16); background: rgba(255,255,255,0.075); }

  .kpi-card {
    border-radius: 18px;
    padding: 20px 22px;
    position: relative;
    overflow: hidden;
    animation: fade-up 0.55s cubic-bezier(0.22,1,0.36,1) both;
    cursor: default;
  }
  .kpi-card:hover { transform: translateY(-2px); transition: transform 0.2s ease; }

  .nav-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    border-radius: 12px;
    cursor: pointer;
    font-size: 13px;
    font-weight: 500;
    color: rgba(248,250,252,0.50);
    transition: all 0.18s ease;
  }
  .nav-item:hover { background: rgba(255,255,255,0.07); color: rgba(248,250,252,0.85); }
  .nav-item.active {
    background: rgba(99,102,241,0.18);
    color: #A5B4FC;
    border: 1px solid rgba(99,102,241,0.28);
  }

  .src-track {
    height: 5px;
    background: rgba(255,255,255,0.06);
    border-radius: 5px;
    overflow: hidden;
    margin-top: 7px;
  }
  .src-fill {
    height: 100%;
    border-radius: 5px;
    transition: width 1.3s cubic-bezier(0.34,1.56,0.64,1);
  }

  .zone-bar-bg {
    height: 8px;
    background: rgba(255,255,255,0.06);
    border-radius: 8px;
    overflow: visible;
    position: relative;
  }
  .zone-bar-fill {
    height: 100%;
    border-radius: 8px;
    transition: width 1s ease;
  }
  .alert-chip {
    display: flex;
    align-items: flex-start;
    gap: 11px;
    padding: 11px 14px;
    border-radius: 12px;
    margin-bottom: 8px;
    border-left: 3px solid transparent;
    transition: background 0.2s;
  }
  .alert-chip:hover { background: rgba(255,255,255,0.04); }

  .divider { height: 1px; background: rgba(255,255,255,0.07); margin: 18px 0; }

  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.10); border-radius: 3px; }
`;

function injectCSS() {
  if (document.getElementById("aurora-dash")) return;
  const s = document.createElement("style");
  s.id = "aurora-dash";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════════════
   AURORA BACKGROUND — the signature ambient glow
   ═══════════════════════════════════════════════════════════════════ */
function AuroraBg() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
      <div style={{
        position: "absolute", top: "-20%", left: "-10%",
        width: "60%", height: "60%",
        background: "radial-gradient(ellipse, rgba(99,102,241,0.20) 0%, transparent 70%)",
        animation: "aurora-shift 14s ease-in-out infinite",
      }} />
      <div style={{
        position: "absolute", bottom: "-10%", right: "-5%",
        width: "55%", height: "55%",
        background: "radial-gradient(ellipse, rgba(244,63,94,0.14) 0%, transparent 70%)",
        animation: "aurora-shift 18s ease-in-out infinite reverse",
      }} />
      <div style={{
        position: "absolute", top: "35%", right: "15%",
        width: "40%", height: "40%",
        background: "radial-gradient(ellipse, rgba(16,185,129,0.09) 0%, transparent 70%)",
        animation: "aurora-shift 22s ease-in-out infinite 4s",
      }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LIVE FREQUENCY GAUGE — polar dial, not oscilloscope
   ═══════════════════════════════════════════════════════════════════ */
function FreqDial({ freq = 50.0 }) {
  const ok   = freq >= 49.9 && freq <= 50.1;
  const warn = !ok && freq >= 49.7;
  const color = ok ? C.emerald : warn ? C.amber : C.rose;
  const dev  = freq - 50.0;

  // Map 49.5–50.5 → -120° to +120°
  const angle = Math.max(-120, Math.min(120, dev * 240));
  const toRad = (d) => (d - 90) * (Math.PI / 180);
  const cx = 80, cy = 80, r = 64;

  // Arc from -120 to +120 deg (both relative to 12 o'clock)
  const arcStart = toRad(-120);
  const arcEnd   = toRad(+120);
  const arcX1 = cx + r * Math.cos(arcStart);
  const arcY1 = cy + r * Math.sin(arcStart);
  const arcX2 = cx + r * Math.cos(arcEnd);
  const arcY2 = cy + r * Math.sin(arcEnd);

  // Fill arc up to needle
  const fillEnd = toRad(angle);
  const fillX2  = cx + r * Math.cos(fillEnd);
  const fillY2  = cy + r * Math.sin(fillEnd);
  const fillLarge = angle > 0 ? 0 : 0; // always small arc from center

  // Needle tip
  const needleAngle = toRad(angle);
  const nx = cx + (r - 10) * Math.cos(needleAngle);
  const ny = cy + (r - 10) * Math.sin(needleAngle);

  const arcLarge = 1; // the background arc spans 240°

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      {/* Dial */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={160} height={110} viewBox="0 0 160 110">
          {/* Track arc */}
          <path
            d={`M ${cx + r * Math.cos(toRad(-120))} ${cy + r * Math.sin(toRad(-120))} A ${r} ${r} 0 1 1 ${arcX2} ${arcY2}`}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={8} strokeLinecap="round"
          />
          {/* Coloured fill arc from -120° to current angle */}
          {Math.abs(angle) > 1 && (
            <path
              d={`M ${cx + r * Math.cos(toRad(-120))} ${cy + r * Math.sin(toRad(-120))} A ${r} ${r} 0 ${Math.abs(angle) > 60 ? 1 : 0} 1 ${fillX2} ${fillY2}`}
              fill="none" stroke={color} strokeWidth={8} strokeLinecap="round"
              style={{ filter: `drop-shadow(0 0 5px ${color})`, transition: "all 0.8s ease" }}
            />
          )}
          {/* Zone markers */}
          {[-120, -60, 0, 60, 120].map((d, i) => {
            const rr = toRad(d);
            return (
              <line key={i}
                x1={cx + (r - 14) * Math.cos(rr)} y1={cy + (r - 14) * Math.sin(rr)}
                x2={cx + (r - 6)  * Math.cos(rr)} y2={cy + (r - 6)  * Math.sin(rr)}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1.5}
              />
            );
          })}
          {/* Needle */}
          <line x1={cx} y1={cy} x2={nx} y2={ny}
            stroke={color} strokeWidth={2.5} strokeLinecap="round"
            style={{ transition: "all 0.8s cubic-bezier(0.34,1.56,0.64,1)",
              filter: `drop-shadow(0 0 4px ${color})` }}
          />
          <circle cx={cx} cy={cy} r={5} fill={color}
            style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
        </svg>

        {/* Centre labels */}
        <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace",
            fontSize: 26, fontWeight: 700, color, lineHeight: 1,
            textShadow: `0 0 20px ${color}60` }}>
            {Number(freq).toFixed(2)}
          </div>
          <div style={{ fontSize: 10, color: C.textLo, marginTop: 2 }}>Hz</div>
        </div>
      </div>

      {/* Side info */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7,
          padding: "5px 12px", borderRadius: 30,
          background: ok ? "rgba(16,185,129,0.14)" : warn ? "rgba(245,158,11,0.14)" : "rgba(244,63,94,0.14)",
          border: `1px solid ${color}30` }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: color,
            display: "inline-block", boxShadow: `0 0 6px ${color}` }} />
          <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 11,
            fontWeight: 600, color, letterSpacing: "0.1em" }}>
            {ok ? "STABLE" : warn ? "WARNING" : "CRITICAL"}
          </span>
        </div>
        <div style={{ fontSize: 12, color: C.textLo }}>
          Deviation: <span style={{ color: C.textMd, fontFamily: "'JetBrains Mono',monospace" }}>
            {dev >= 0 ? "+" : ""}{dev.toFixed(3)} Hz
          </span>
        </div>
        <div style={{ fontSize: 11, color: C.textLo }}>
          Nominal: <span style={{ color: C.textMd, fontFamily: "'JetBrains Mono',monospace" }}>50.000 Hz</span>
        </div>
        <div style={{ fontSize: 11, color: C.textLo }}>Range:
          <span style={{ color: C.textMd, fontFamily: "'JetBrains Mono',monospace" }}> 49.7 – 50.3 Hz</span>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ENERGY DONUT — signature visual: animated multi-ring energy mix
   ═══════════════════════════════════════════════════════════════════ */
function EnergyDonut({ re, nr, dem }) {
  const solar  = re.solar_mw      || 0;
  const wind   = re.wind_mw       || 0;
  const hydro  = re.hydro_mw      || 0;
  const other  = re.other_ncep_mw || 0;
  const therm  = nr.thermal_mw    || 0;
  const ipp    = nr.thermal_ipp_mw|| 0;
  const cgs    = nr.cgs_mw        || 0;
  const total  = dem || 1;

  const segs = [
    { label: "Solar",   v: solar,  color: C.gold    },
    { label: "Wind",    v: wind,   color: C.sky     },
    { label: "Hydro",   v: hydro,  color: C.indigo  },
    { label: "Bio/Other",v: other, color: C.emerald },
    { label: "Thermal", v: therm,  color: C.muted   },
    { label: "IPP",     v: ipp,    color: "#475569"  },
    { label: "CGS",     v: cgs,    color: "#334155"  },
  ].filter(s => s.v > 0);

  const SIZE = 160, cx = 80, cy = 80, R = 68, stroke = 18;
  const circ = 2 * Math.PI * R;
  let cumPct = 0;

  const arcs = segs.map((s) => {
    const pctVal = s.v / total;
    const dashArr = circ * pctVal - 2;
    const offset  = circ - circ * cumPct;
    cumPct += pctVal;
    return { ...s, dashArr, offset };
  });

  const rePct  = Math.round(fpct(re.total_mw || 0, dem));
  const nrPct  = Math.round(fpct(nr.total_mw || 0, dem));

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
      {/* Donut */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <svg width={SIZE} height={SIZE} style={{ transform: "rotate(-90deg)" }}>
          {/* track */}
          <circle cx={cx} cy={cy} r={R} fill="none"
            stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} />
          {/* segments */}
          {arcs.map((a, i) => (
            <circle key={i} cx={cx} cy={cy} r={R} fill="none"
              stroke={a.color} strokeWidth={stroke}
              strokeDasharray={`${a.dashArr} ${circ}`}
              strokeDashoffset={a.offset}
              strokeLinecap="butt"
              style={{ filter: `drop-shadow(0 0 4px ${a.color}80)`,
                transition: "stroke-dasharray 1.3s cubic-bezier(0.34,1,0.64,1)" }}
            />
          ))}
        </svg>
        {/* Centre */}
        <div style={{ position: "absolute", inset: 0, display: "flex",
          flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'JetBrains Mono',monospace",
            fontSize: 22, fontWeight: 700, color: C.emerald,
            textShadow: `0 0 16px ${C.emerald}60`, lineHeight: 1 }}>
            {rePct}%
          </div>
          <div style={{ fontSize: 9, color: C.textLo, letterSpacing: "0.1em",
            textTransform: "uppercase", marginTop: 2 }}>renewable</div>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
        {segs.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: s.color,
              flexShrink: 0, boxShadow: `0 0 5px ${s.color}80` }} />
            <span style={{ color: C.textMd, flex: 1 }}>{s.label}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace",
              color: s.color, fontWeight: 600, fontSize: 11 }}>{fmt(s.v)}</span>
            <span style={{ color: C.textLo, fontSize: 10, width: 36, textAlign: "right" }}>
              {fpct(s.v, dem)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD — bold gradient top-strip cards
   ═══════════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, unit, sub, icon, gradient, delay = 0, accent }) {
  return (
    <div className="kpi-card" style={{
      background: gradient,
      border: `1px solid ${accent}30`,
      animationDelay: `${delay}ms`,
    }}>
      {/* Decorative circle */}
      <div style={{ position: "absolute", top: -24, right: -24, width: 88, height: 88,
        borderRadius: "50%", background: `${accent}18`, pointerEvents: "none" }} />
      <div style={{ position: "relative" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)",
            textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600 }}>{label}</div>
          <span style={{ fontSize: 20 }}>{icon}</span>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 10 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace",
            fontSize: 30, fontWeight: 700, color: "#fff",
            textShadow: `0 0 24px ${accent}60`, lineHeight: 1,
            animation: "count-in 0.7s ease both" }}>
            {value}
          </span>
          {unit && <span style={{ fontSize: 13, color: "rgba(255,255,255,0.50)", fontWeight: 400 }}>{unit}</span>}
        </div>
        {sub && <div style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", marginTop: 6 }}>{sub}</div>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   SOURCE ROW
   ═══════════════════════════════════════════════════════════════════ */
function SrcRow({ icon, label, mw, denom, color }) {
  const p = fpct(mw, denom);
  return (
    <div style={{ marginBottom: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <span style={{ fontSize: 12, color: C.textMd, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{icon}</span>{label}
        </span>
        <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
          <span style={{ fontFamily: "'JetBrains Mono',monospace",
            fontSize: 12, fontWeight: 600, color }}>{fmt(mw)}</span>
          <span style={{ fontSize: 10, color: C.textLo }}>MW</span>
        </div>
      </div>
      <div className="src-track">
        <div className="src-fill" style={{ width: `${p}%`, background: color,
          boxShadow: `0 0 8px ${color}60` }} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ESCOM ZONE ROW
   ═══════════════════════════════════════════════════════════════════ */
function ZoneRow({ name, area, mw, cap, utilPct, isLive }) {
  const color   = ESCOM_COLORS[name] || C.indigo;
  const statCol = utilPct > 90 ? C.rose : utilPct > 75 ? C.amber : C.emerald;
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "100px 1fr 64px",
        gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 9, height: 9, borderRadius: "50%", background: color,
              boxShadow: `0 0 6px ${color}` }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{name}</span>
          </div>
          <div style={{ fontSize: 10, color: C.textLo, paddingLeft: 16, marginTop: 1 }}>{area}</div>
          {!isLive && <div style={{ fontSize: 9, color: C.amber, paddingLeft: 16 }}>est.</div>}
        </div>
        <div>
          <div className="zone-bar-bg">
            <div className="zone-bar-fill" style={{
              width: `${Math.min(100, utilPct)}%`,
              background: `linear-gradient(90deg, ${color}70, ${color})`,
              boxShadow: `0 0 8px ${color}50`,
            }} />
            <div style={{ position: "absolute", top: -4, left: "90%",
              width: 1.5, height: 16, background: `${C.rose}80`, borderRadius: 1 }} />
          </div>
          <div style={{ fontSize: 9, color: C.textLo, marginTop: 4,
            fontFamily: "'JetBrains Mono',monospace" }}>
            {fmt(mw)} / {fmt(cap)} MW
          </div>
        </div>
        <div style={{ textAlign: "right",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: 15, fontWeight: 700, color: statCol,
          textShadow: `0 0 10px ${statCol}50` }}>
          {utilPct}%
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ALERT CHIP
   ═══════════════════════════════════════════════════════════════════ */
function AlertChip({ level, message }) {
  const cfg = {
    danger:  { color: C.rose,    icon: "⊗", bg: "rgba(244,63,94,0.10)",  border: C.rose    },
    warning: { color: C.amber,   icon: "⚠", bg: "rgba(245,158,11,0.10)", border: C.amber   },
    info:    { color: C.sky,     icon: "ℹ", bg: "rgba(14,165,233,0.10)", border: C.sky     },
    success: { color: C.emerald, icon: "✓", bg: "rgba(16,185,129,0.10)", border: C.emerald },
  };
  const m = cfg[level] || cfg.info;
  return (
    <div className="alert-chip" style={{ background: m.bg, borderLeftColor: m.border }}>
      <span style={{ fontSize: 14, color: m.color, flexShrink: 0 }}>{m.icon}</span>
      <span style={{ fontSize: 12, color: C.textMd, lineHeight: 1.5 }}>{message}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   MINI STAT
   ═══════════════════════════════════════════════════════════════════ */
function MiniStat({ label, value, unit, color = C.text }) {
  return (
    <div style={{ padding: "14px 16px",
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, transition: "all 0.2s" }}>
      <div style={{ fontSize: 9, color: C.textLo, textTransform: "uppercase",
        letterSpacing: "0.14em", fontFamily: "'JetBrains Mono',monospace", marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono',monospace",
        fontSize: 18, fontWeight: 700, color,
        textShadow: `0 0 14px ${color}40` }}>
        {value}
        {unit && <span style={{ fontSize: 11, color: C.textLo, fontWeight: 400, marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD ROOT
   ═══════════════════════════════════════════════════════════════════ */
export default function Dashboard({ data }) {
  useEffect(() => { injectCSS(); }, []);

  if (!data) return (
    <div style={{ height: 400, display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'JetBrains Mono',monospace", color: C.textLo, fontSize: 13 }}>
      ◈ Awaiting data feed…
    </div>
  );

  const { grid, zones = [], alerts = [], weather = {},
          frequency_hz, state_ui, kptcl_page_time,
          data_source, errors = [] } = data;

  const raw   = data.kptcl_raw || {};
  const re    = raw.renewable     || {};
  const nr    = raw.non_renewable || {};
  const dem   = raw.state_demand_mw || grid?.demand_mw || 0;
  const isLive = data_source === "kptcl-sldc-live";
  const rePct  = Math.round(+fpct(re.total_mw || 0, dem));
  const nrPct  = Math.round(+fpct(nr.total_mw || 0, dem));
  const bal    = grid?.balance_mw || 0;
  const balPos = bal >= 0;

  return (
    <div style={{ position: "relative", minHeight: "100vh",
      background: C.ink, fontFamily: "'Space Grotesk', sans-serif",
      color: C.text, padding: "24px 20px", overflow: "hidden" }}>

      <AuroraBg />

      {/* Error banner */}
      {errors?.length > 0 && (
        <div style={{ position: "relative", zIndex: 10, marginBottom: 16,
          background: "rgba(244,63,94,0.12)", border: "1px solid rgba(244,63,94,0.30)",
          borderRadius: 12, padding: "10px 16px", fontSize: 12, color: C.rose,
          display: "flex", gap: 8, fontFamily: "'JetBrains Mono',monospace" }}>
          ⚠ {errors[0]}
        </div>
      )}

      {/* Main layout */}
      <div style={{ position: "relative", zIndex: 2,}}>

        {/* ── MAIN CANVAS ─────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* ── PAGE HEADER ─────────────────────────────────────── */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div>
              <div style={{ fontSize: 11, color: C.textLo, textTransform: "uppercase",
                letterSpacing: "0.16em", marginBottom: 5,
                fontFamily: "'JetBrains Mono',monospace" }}>Real-time Overview</div>
              <h1 style={{ fontSize: 26, fontWeight: 700, color: C.text, lineHeight: 1.1,
                background: "linear-gradient(135deg, #F8FAFC, #94A3B8)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                Karnataka State Grid
              </h1>
            </div>
            <div style={{ fontSize: 10, color: C.textLo,
              fontFamily: "'JetBrains Mono',monospace", textAlign: "right" }}>
              {kptcl_page_time || "—"}
            </div>
          </div>

          {/* ── KPI STRIP ───────────────────────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            <KpiCard
              label="State Demand"
              value={fmt(dem)} unit="MW"
              sub="Current load on grid"
              icon="📊"
              accent={C.indigo}
              gradient="linear-gradient(135deg, rgba(99,102,241,0.28) 0%, rgba(99,102,241,0.08) 100%)"
              delay={0}
            />
            <KpiCard
              label="Grid Balance"
              value={(balPos ? "+" : "") + fmt(bal)} unit="MW"
              sub={balPos ? "Surplus — store or export" : "Deficit — release reserves"}
              icon={balPos ? "▲" : "▼"}
              accent={balPos ? C.emerald : C.rose}
              gradient={balPos
                ? "linear-gradient(135deg, rgba(16,185,129,0.28) 0%, rgba(16,185,129,0.07) 100%)"
                : "linear-gradient(135deg, rgba(244,63,94,0.28) 0%, rgba(244,63,94,0.07) 100%)"}
              delay={80}
            />
            <KpiCard
              label="Renewable Share"
              value={`${rePct}%`}
              sub={`${fmt(re.total_mw)} MW green energy`}
              icon="♻"
              accent={C.emerald}
              gradient="linear-gradient(135deg, rgba(16,185,129,0.24) 0%, rgba(16,185,129,0.06) 100%)"
              delay={160}
            />
            <KpiCard
              label="CO₂ Avoided"
              value={grid?.co2_avoided_tonnes_hr ?? 0} unit="t/hr"
              sub="vs baseline fossil mix"
              icon="🌿"
              accent={C.sky}
              gradient="linear-gradient(135deg, rgba(14,165,233,0.24) 0%, rgba(14,165,233,0.06) 100%)"
              delay={240}
            />
          </div>

          {/* ── ROW 2: Frequency dial + Energy donut + Balance detail ── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 220px", gap: 18 }}>

            {/* FREQUENCY */}
            <div className="acard">
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                textTransform: "uppercase", color: C.textLo,
                fontFamily: "'JetBrains Mono',monospace", marginBottom: 18 }}>
                ◈ Grid Frequency
              </div>
              <FreqDial freq={frequency_hz || 50.0} />
            </div>

            {/* ENERGY DONUT */}
            <div className="acard">
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: C.textLo,
                  fontFamily: "'JetBrains Mono',monospace" }}>◈ Generation Mix</div>
                <div style={{ display: "flex", gap: 8 }}>
                  <span style={{ fontSize: 11, color: C.emerald, fontFamily: "'JetBrains Mono',monospace",
                    fontWeight: 600 }}>{rePct}% RE</span>
                  <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono',monospace" }}>
                    {nrPct}% Fossil
                  </span>
                </div>
              </div>
              <EnergyDonut re={re} nr={nr} dem={dem} />
            </div>

            {/* DEMAND DETAIL */}
            <div className="acard">
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                textTransform: "uppercase", color: C.textLo,
                fontFamily: "'JetBrains Mono',monospace", marginBottom: 18 }}>◈ Demand Detail</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                {[
                  { l: "State UI drawal", v: `${state_ui > 0 ? "+" : ""}${fmt(state_ui)} MW`,
                    c: state_ui > 0 ? C.amber : C.emerald },
                  { l: "Net delivered",   v: `${fmt(grid?.net_delivered_mw)} MW`,  c: C.textMd },
                  { l: "Trans. loss",     v: `${fmt(grid?.transmission_loss_mw)} MW`, c: C.amber },
                  { l: "Curtailed",       v: `${fmt(grid?.curtailed_mw ?? 0)} MW`,
                    c: (grid?.curtailed_mw ?? 0) > 200 ? C.rose : C.textMd },
                  { l: "Grid efficiency", v: `${grid?.efficiency_pct ?? 0}%`, c: C.emerald },
                  { l: "Wastage",         v: `${grid?.wastage_pct ?? 0}%`,
                    c: (grid?.wastage_pct ?? 0) > 5 ? C.amber : C.textMd },
                ].map((r, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 11, paddingBottom: 9,
                    borderBottom: i < 5 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <span style={{ color: C.textLo }}>{r.l}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 600, color: r.c }}>{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── ROW 3: RE Sources + NR Sources + ESCOM ──────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>

            {/* RENEWABLE */}
            <div className="acard">
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: C.textLo,
                  fontFamily: "'JetBrains Mono',monospace" }}>◈ Renewable Sources</div>
                <span style={{ fontSize: 11, color: C.emerald, fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 700 }}>{fmt(re.total_mw)} MW</span>
              </div>
              <SrcRow icon="☀" label="Solar"      mw={re.solar_mw}      denom={dem} color={C.gold} />
              <SrcRow icon="💨" label="Wind"       mw={re.wind_mw}       denom={dem} color={C.sky} />
              <SrcRow icon="💧" label="Hydro"      mw={re.hydro_mw}      denom={dem} color={C.indigo} />
              <SrcRow icon="🌿" label="Other NCEP" mw={re.other_ncep_mw} denom={dem} color={C.emerald} />
              {(re.pavagada_mw || 0) > 0 && (
                <SrcRow icon="🌞" label="Pavagada Park" mw={re.pavagada_mw} denom={dem} color="#FB923C" />
              )}
              {/* Stacked bar */}
              <div style={{ height: 6, borderRadius: 6, display: "flex",
                overflow: "hidden", gap: 2, marginTop: 18 }}>
                {[
                  { v: re.solar_mw,       c: C.gold    },
                  { v: re.wind_mw,        c: C.sky     },
                  { v: re.hydro_mw,       c: C.indigo  },
                  { v: re.other_ncep_mw,  c: C.emerald },
                  { v: re.pavagada_mw,    c: "#FB923C" },
                ].filter(s => (s.v || 0) > 0).map((s, i) => (
                  <div key={i} style={{ flex: s.v, background: s.c,
                    boxShadow: `0 0 6px ${s.c}80` }} />
                ))}
              </div>
              <div style={{ fontSize: 9, color: C.textLo, marginTop: 5,
                fontFamily: "'JetBrains Mono',monospace" }}>
                share of {fmt(dem)} MW total demand
              </div>
            </div>

            {/* NON-RENEWABLE */}
            <div className="acard">
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 18 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: C.textLo,
                  fontFamily: "'JetBrains Mono',monospace" }}>◈ Conventional Sources</div>
                <span style={{ fontSize: 11, color: C.muted, fontFamily: "'JetBrains Mono',monospace",
                  fontWeight: 700 }}>{fmt(nr.total_mw)} MW</span>
              </div>
              <SrcRow icon="🏭" label="Thermal (State)" mw={nr.thermal_mw}     denom={dem} color="#94A3B8" />
              <SrcRow icon="⚙"  label="Thermal IPP"     mw={nr.thermal_ipp_mw} denom={dem} color="#F97316" />
              <SrcRow icon="🔌" label="CGS Drawal"       mw={nr.cgs_mw}         denom={dem} color="#A855F7" />

              <div className="divider" />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <MiniStat label="Total gen." value={fmt(raw.total_gen_mw)} unit="MW" color={C.textMd} />
                <MiniStat label="Efficiency" value={`${grid?.efficiency_pct ?? 0}%`} color={C.emerald} />
                <MiniStat label="Surplus"    value={fmt(grid?.surplus_mw)} unit="MW"
                  color={balPos ? C.emerald : C.textLo} />
                <MiniStat label="Deficit"    value={fmt(grid?.deficit_mw)} unit="MW"
                  color={!balPos ? C.rose : C.textLo} />
              </div>
            </div>

            {/* ESCOM ZONES */}
            <div className="acard">
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                textTransform: "uppercase", color: C.textLo,
                fontFamily: "'JetBrains Mono',monospace", marginBottom: 14 }}>
                ◈ ESCOM Zone Utilisation
              </div>
              {zones.map(z => (
                <ZoneRow
                  key={z.name}
                  name={z.name}
                  area={z.area}
                  mw={z.load_mw}
                  cap={z.capacity_mw}
                  utilPct={z.utilisation_pct}
                  isLive={z.data_source === "kptcl-live"}
                />
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6,
                marginTop: 12, fontSize: 10, color: C.textLo }}>
                <div style={{ width: 16, height: 1.5, background: C.rose, opacity: 0.6 }} />
                <span style={{ opacity: 0.65 }}>90% capacity threshold</span>
              </div>
            </div>
          </div>

          {/* ── ROW 4: Alerts + System health ───────────────────────── */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>

            {/* ALERTS */}
            <div className="acard">
              <div style={{ display: "flex", justifyContent: "space-between",
                alignItems: "center", marginBottom: 16 }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                  textTransform: "uppercase", color: C.textLo,
                  fontFamily: "'JetBrains Mono',monospace" }}>◈ System Alerts</div>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "3px 10px", borderRadius: 20, fontSize: 10,
                  fontFamily: "'JetBrains Mono',monospace", fontWeight: 600,
                  background: alerts.length === 0 ? "rgba(16,185,129,0.14)" : "rgba(245,158,11,0.14)",
                  color: alerts.length === 0 ? C.emerald : C.amber,
                  border: `1px solid ${alerts.length === 0 ? C.emerald : C.amber}28` }}>
                  {alerts.length === 0 ? "✓ All clear" : `${alerts.length} active`}
                </div>
              </div>
              {alerts.length === 0 ? (
                <div style={{ padding: "24px 0", textAlign: "center",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                  <div style={{ fontSize: 36, filter: `drop-shadow(0 0 12px ${C.emerald})` }}>✓</div>
                  <div style={{ fontSize: 13, color: C.emerald,
                    fontFamily: "'JetBrains Mono',monospace", fontWeight: 600 }}>
                    ALL SYSTEMS NORMAL
                  </div>
                  <div style={{ fontSize: 11, color: C.textLo }}>No active alerts at this time</div>
                </div>
              ) : (
                alerts.map((a, i) => <AlertChip key={i} level={a.level} message={a.message} />)
              )}
            </div>

            {/* GRID HEALTH */}
            <div className="acard">
              <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.16em",
                textTransform: "uppercase", color: C.textLo,
                fontFamily: "'JetBrains Mono',monospace", marginBottom: 18 }}>
                ◈ Grid Health
              </div>
              {/* Horizontal gauge bars for health metrics */}
              {[
                { label: "Renewable share", v: grid?.renewable_share_pct ?? 0, max: 100, color: C.emerald },
                { label: "Grid efficiency", v: grid?.efficiency_pct ?? 0,      max: 100, color: C.sky     },
                { label: "Wastage",         v: grid?.wastage_pct ?? 0,          max: 20,
                  color: (grid?.wastage_pct ?? 0) > 5 ? C.amber : C.emerald, invert: true },
              ].map((m, i) => (
                <div key={i} style={{ marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between",
                    fontSize: 11, marginBottom: 7 }}>
                    <span style={{ color: C.textLo }}>{m.label}</span>
                    <span style={{ fontFamily: "'JetBrains Mono',monospace",
                      fontWeight: 700, color: m.color }}>{m.v}%</span>
                  </div>
                  <div style={{ height: 7, background: "rgba(255,255,255,0.06)",
                    borderRadius: 7, overflow: "hidden" }}>
                    <div style={{
                      height: "100%",
                      width: `${Math.min(100, (m.v / m.max) * 100)}%`,
                      background: `linear-gradient(90deg, ${m.color}70, ${m.color})`,
                      borderRadius: 7, boxShadow: `0 0 10px ${m.color}50`,
                      transition: "width 1.2s ease",
                    }} />
                  </div>
                </div>
              ))}

              <div className="divider" style={{ margin: "14px 0" }} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <MiniStat label="CO₂ avoided" value={grid?.co2_avoided_tonnes_hr ?? 0} unit="t/hr" color={C.emerald} />
                <MiniStat label="Curtailed"   value={fmt(grid?.curtailed_mw ?? 0)} unit="MW"
                  color={(grid?.curtailed_mw ?? 0) > 200 ? C.rose : C.textMd} />
                <MiniStat label="Net deliv."  value={fmt(grid?.net_delivered_mw ?? 0)} unit="MW" color={C.sky} />
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div style={{ display: "flex", justifyContent: "space-between",
            paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)",
            fontSize: 10, color: C.textLo, fontFamily: "'JetBrains Mono',monospace" }}>
            <span>KPTCL SLDC · Karnataka State Load Despatch Centre</span>
            <span>kptclsldc.in · Data refreshes every 5 minutes</span>
          </div>

        </div>{/* end main canvas */}
      </div>{/* end layout */}
    </div>
  );
}