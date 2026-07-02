import { useState, useEffect } from "react";

/* ═══════════════════════════════════════════════════════════════════
   AURORA THEME — exact match to Dashboard
   Space Grotesk + JetBrains Mono · #0F172A bg · indigo/violet/rose
   /emerald/gold palette · glassmorphism cards · aurora glow bg
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  indigo:  "#6366F1", indigoSoft: "rgba(99,102,241,0.18)",
  violet:  "#8B5CF6", violetSoft: "rgba(139,92,246,0.15)",
  rose:    "#F43F5E", roseSoft:   "rgba(244,63,94,0.15)",
  amber:   "#F59E0B", amberSoft:  "rgba(245,158,11,0.15)",
  emerald: "#10B981", emeraldSoft:"rgba(16,185,129,0.15)",
  sky:     "#0EA5E9", skyOft:     "rgba(14,165,233,0.15)",
  gold:    "#FBBF24",
  text:    "#F8FAFC",
  textMd:  "rgba(248,250,252,0.60)",
  textLo:  "rgba(248,250,252,0.32)",
  ink:     "#0F172A",
  card:    "rgba(255,255,255,0.055)",
  border:  "rgba(255,255,255,0.09)",
};

const PRIORITY = {
  critical: { color: T.rose,    soft: "rgba(244,63,94,0.14)",    border: "rgba(244,63,94,0.28)",    stripe: T.rose,    label: "CRITICAL" },
  high:     { color: T.amber,   soft: "rgba(245,158,11,0.12)",   border: "rgba(245,158,11,0.26)",   stripe: T.amber,   label: "HIGH"     },
  medium:   { color: T.indigo,  soft: "rgba(99,102,241,0.12)",   border: "rgba(99,102,241,0.26)",   stripe: T.indigo,  label: "MEDIUM"   },
  low:      { color: T.emerald, soft: "rgba(16,185,129,0.10)",   border: "rgba(16,185,129,0.24)",   stripe: T.emerald, label: "LOW"      },
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#0F172A; }

  @keyframes aurora-shift {
    0%,100% { opacity:.38; transform:scale(1) rotate(0deg); }
    33%      { opacity:.55; transform:scale(1.08) rotate(3deg); }
    66%      { opacity:.42; transform:scale(.95) rotate(-2deg); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes sweep-in {
    from { transform:scaleX(0); opacity:0; transform-origin:left; }
    to   { transform:scaleX(1); opacity:1; transform-origin:left; }
  }
  @keyframes pulse-ring {
    0%   { box-shadow:0 0 0 0 rgba(16,185,129,.55); }
    70%  { box-shadow:0 0 0 8px rgba(16,185,129,0); }
    100% { box-shadow:0 0 0 0 rgba(16,185,129,0); }
  }

  /* ── Root ── */
  .ac-root {
    font-family:'Space Grotesk',sans-serif;
    background:#0F172A;
    min-height:100vh;
    color:#F8FAFC;
    position:relative;
    overflow:hidden;
  }
  .ac-aurora { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
  .ac-a1 {
    position:absolute; top:-22%; left:-8%; width:56%; height:56%;
    background:radial-gradient(ellipse,rgba(99,102,241,.18) 0%,transparent 70%);
    animation:aurora-shift 13s ease-in-out infinite;
  }
  .ac-a2 {
    position:absolute; bottom:-10%; right:-5%; width:52%; height:52%;
    background:radial-gradient(ellipse,rgba(244,63,94,.12) 0%,transparent 70%);
    animation:aurora-shift 17s ease-in-out infinite reverse;
  }
  .ac-a3 {
    position:absolute; top:40%; left:35%; width:36%; height:36%;
    background:radial-gradient(ellipse,rgba(245,158,11,.07) 0%,transparent 70%);
    animation:aurora-shift 22s ease-in-out infinite 4s;
  }
  .ac-content { position:relative; z-index:2; padding:26px 20px 56px; }

  /* ── Topbar ── */
  .ac-topbar {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:22px; flex-wrap:wrap; gap:12px;
    padding-bottom:18px; border-bottom:1px solid rgba(255,255,255,.07);
  }
  .ac-brand { display:flex; align-items:center; gap:12px; }
  .ac-brand-icon {
    width:38px; height:38px; border-radius:11px; flex-shrink:0;
    background:linear-gradient(135deg,#6366F1,#F43F5E);
    display:flex; align-items:center; justify-content:center;
    font-size:18px; box-shadow:0 4px 16px rgba(99,102,241,.4);
  }
  .ac-brand-name { font-size:15px; font-weight:700; color:#F8FAFC; letter-spacing:-.01em; }
  .ac-brand-sub { font-family:'JetBrains Mono',monospace; font-size:9px; color:rgba(248,250,252,.30); letter-spacing:.12em; text-transform:uppercase; margin-top:2px; }

  .ac-live {
    display:flex; align-items:center; gap:7px;
    padding:5px 12px; border-radius:20px;
    background:rgba(16,185,129,.12); border:1px solid rgba(16,185,129,.28);
    font-family:'JetBrains Mono',monospace; font-size:10px;
    font-weight:600; color:#10B981; letter-spacing:.08em;
  }
  .ac-live-dot { width:7px; height:7px; border-radius:50%; background:#10B981; animation:pulse-ring 1.8s ease-out infinite; }

  /* ── Wastage meter (signature) ── */
  .ac-meter-wrap {
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:16px; padding:16px 22px;
    display:grid; grid-template-columns:140px 1fr 160px;
    gap:20px; align-items:center; margin-bottom:22px;
    animation:fade-up .45s ease both;
  }
  .ac-meter-lbl { font-family:'JetBrains Mono',monospace; font-size:9px; text-transform:uppercase; letter-spacing:.14em; color:rgba(248,250,252,.32); }
  .ac-meter-val { font-size:26px; font-weight:700; letter-spacing:-.02em; line-height:1; margin-top:4px; }
  .ac-meter-track {
    height:10px; background:rgba(255,255,255,.06); border-radius:5px; overflow:hidden; position:relative;
  }
  .ac-meter-fill {
    height:100%; border-radius:5px;
    animation:sweep-in 1.3s cubic-bezier(.22,1,.36,1) both;
    transition:width 1s ease;
  }
  .ac-meter-ticks { position:absolute; inset:0; display:flex; }
  .ac-meter-tick  { flex:1; border-right:1px solid rgba(0,0,0,.18); }
  .ac-meter-tick:last-child { border-right:none; }
  .ac-meter-status { text-align:right; font-family:'JetBrains Mono',monospace; font-size:10px; letter-spacing:.1em; text-transform:uppercase; }

  /* ── KPI row ── */
  .ac-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:22px; }
  @media(max-width:1000px){ .ac-kpis { grid-template-columns:repeat(2,1fr); } }
  .ac-kpi {
    background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.09);
    border-radius:16px; padding:16px 18px; position:relative; overflow:hidden;
    animation:fade-up .5s ease both; transition:border-color .2s,transform .2s;
  }
  .ac-kpi:hover { border-color:rgba(255,255,255,.16); transform:translateY(-2px); }
  .ac-kpi-glow { position:absolute; top:-30px; right:-30px; width:80px; height:80px; border-radius:50%; filter:blur(28px); pointer-events:none; }
  .ac-kpi-lbl { font-family:'JetBrains Mono',monospace; font-size:8.5px; text-transform:uppercase; letter-spacing:.14em; color:rgba(248,250,252,.32); margin-bottom:9px; }
  .ac-kpi-val { font-size:24px; font-weight:700; letter-spacing:-.02em; line-height:1; margin-bottom:5px; }
  .ac-kpi-sub { font-size:10.5px; color:rgba(248,250,252,.38); }
  .ac-kpi-stripe { position:absolute; bottom:0; left:10%; right:10%; height:1.5px; border-radius:2px; opacity:.5; }

  /* ── Section head ── */
  .ac-sh { display:flex; align-items:center; gap:9px; margin-bottom:16px; }
  .ac-sh-accent { width:3px; height:14px; border-radius:2px; flex-shrink:0; }
  .ac-sh-label { font-family:'JetBrains Mono',monospace; font-size:9px; text-transform:uppercase; letter-spacing:.16em; color:rgba(248,250,252,.32); }

  /* ── 2-col body ── */
  .ac-body { display:grid; grid-template-columns:280px 1fr; gap:20px; align-items:start; }
  @media(max-width:960px){ .ac-body { grid-template-columns:1fr; } }

  /* ── Left panel ── */
  .ac-left { display:flex; flex-direction:column; gap:16px; position:sticky; top:24px; }
  .ac-panel {
    background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.09);
    border-radius:16px; padding:18px 20px; animation:fade-up .5s ease both;
  }

  /* Priority rows */
  .ac-prow {
    display:flex; align-items:center; justify-content:space-between;
    padding:8px 8px; border-radius:10px; cursor:pointer; transition:background .15s;
    border-bottom:1px solid rgba(255,255,255,.05);
  }
  .ac-prow:last-of-type { border-bottom:none; }
  .ac-prow:hover { background:rgba(255,255,255,.04); }
  .ac-prow.sel { background:rgba(99,102,241,.09); }
  .ac-prow-l { display:flex; align-items:center; gap:10px; }
  .ac-prow-dot { width:9px; height:9px; border-radius:3px; flex-shrink:0; }
  .ac-prow-name { font-size:12px; font-weight:600; letter-spacing:.04em; }
  .ac-prow-count { font-family:'JetBrains Mono',monospace; font-size:17px; font-weight:700; color:#F8FAFC; }

  /* Forecast bars */
  .ac-frow { display:flex; align-items:center; gap:10px; margin-bottom:11px; }
  .ac-frow-lbl { font-size:11px; color:rgba(248,250,252,.50); flex:1; }
  .ac-frow-bar { flex:2; height:5px; background:rgba(255,255,255,.06); border-radius:3px; overflow:hidden; }
  .ac-frow-fill { height:100%; border-radius:3px; transition:width 1.2s cubic-bezier(.34,1,.64,1); }
  .ac-frow-val { font-family:'JetBrains Mono',monospace; font-size:11px; width:42px; text-align:right; font-weight:600; }

  /* Outcome grid */
  .ac-outcomes { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
  .ac-outcome {
    background:#0F172A; border:1px solid rgba(255,255,255,.08);
    border-radius:10px; padding:11px 13px; transition:border-color .2s;
  }
  .ac-outcome:hover { border-color:rgba(255,255,255,.16); }
  .ac-out-lbl { font-family:'JetBrains Mono',monospace; font-size:8px; text-transform:uppercase; letter-spacing:.12em; color:rgba(248,250,252,.30); margin-bottom:5px; }
  .ac-out-val { font-size:19px; font-weight:700; letter-spacing:-.02em; line-height:1; }
  .ac-out-sub { font-size:10px; color:rgba(248,250,252,.32); margin-top:3px; }

  /* ── Right feed ── */
  .ac-feed { display:flex; flex-direction:column; gap:12px; }
  .ac-feed-hdr { display:flex; align-items:center; justify-content:space-between; margin-bottom:4px; }
  .ac-feed-title { font-size:18px; font-weight:700; letter-spacing:-.02em; }
  .ac-feed-count { font-family:'JetBrains Mono',monospace; font-size:11px; color:rgba(248,250,252,.32); }

  /* Filter chips */
  .ac-chips { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:4px; }
  .ac-chip {
    font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:500;
    letter-spacing:.07em; text-transform:uppercase;
    padding:5px 12px; border-radius:6px;
    border:1px solid rgba(255,255,255,.09); background:transparent;
    color:rgba(248,250,252,.38); cursor:pointer; transition:all .15s;
  }
  .ac-chip:hover { border-color:rgba(255,255,255,.18); color:rgba(248,250,252,.75); }
  .ac-chip.all.on     { background:rgba(99,102,241,.15); border-color:rgba(99,102,241,.38); color:#A5B4FC; }
  .ac-chip.critical.on{ background:rgba(244,63,94,.14);  border-color:rgba(244,63,94,.35);  color:#FDA4AF; }
  .ac-chip.high.on    { background:rgba(245,158,11,.14); border-color:rgba(245,158,11,.35); color:#FCD34D; }
  .ac-chip.medium.on  { background:rgba(99,102,241,.14); border-color:rgba(99,102,241,.35); color:#A5B4FC; }
  .ac-chip.low.on     { background:rgba(16,185,129,.12); border-color:rgba(16,185,129,.32); color:#6EE7B7; }

  /* Action card */
  .ac-card {
    background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.09);
    border-radius:18px; overflow:hidden;
    animation:fade-up .45s cubic-bezier(.22,1,.36,1) both;
    transition:border-color .2s, box-shadow .2s;
    cursor:pointer;
  }
  .ac-card:hover { border-color:rgba(255,255,255,.18); box-shadow:0 8px 32px rgba(0,0,0,.35); }
  .ac-card-inner { display:flex; }
  .ac-card-stripe { width:4px; flex-shrink:0; }
  .ac-card-body { flex:1; padding:18px 20px; }

  .ac-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:8px; }
  .ac-card-title { font-size:14px; font-weight:700; letter-spacing:-.01em; color:#F8FAFC; line-height:1.3; flex:1; }
  .ac-card-badge {
    font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600;
    letter-spacing:.12em; text-transform:uppercase;
    padding:4px 10px; border-radius:5px; flex-shrink:0; border:1px solid transparent;
  }
  .ac-card-desc { font-size:12px; color:rgba(248,250,252,.52); line-height:1.65; margin-bottom:14px; }

  /* Metric pills */
  .ac-pills { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:14px; }
  .ac-pill {
    display:flex; align-items:center; gap:6px;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:8px; padding:6px 12px;
  }
  .ac-pill-icon { font-size:11px; }
  .ac-pill-val  { font-family:'JetBrains Mono',monospace; font-size:12px; font-weight:600; color:#F8FAFC; }
  .ac-pill-lbl  { font-size:10px; color:rgba(248,250,252,.38); }

  /* Expanded detail */
  .ac-detail { border-top:1px solid rgba(255,255,255,.07); padding-top:16px; margin-top:6px; display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .ac-detail-lbl-row { display:flex; justify-content:space-between; font-size:10.5px; color:rgba(248,250,252,.50); margin-bottom:6px; }
  .ac-detail-lbl-row span:last-child { font-family:'JetBrains Mono',monospace; color:#F8FAFC; }
  .ac-detail-track { height:6px; background:rgba(255,255,255,.06); border-radius:3px; overflow:hidden; }
  .ac-detail-fill  { height:100%; border-radius:3px; transition:width 1s cubic-bezier(.34,1,.64,1); }

  /* Protocol */
  .ac-proto {
    display:inline-flex; align-items:center; gap:6px;
    font-family:'JetBrains Mono',monospace; font-size:10px; color:rgba(248,250,252,.38);
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:6px; padding:4px 10px; margin-top:14px;
  }
  .ac-proto-dot { width:5px; height:5px; border-radius:50%; background:#6366F1; flex-shrink:0; }

  .ac-toggle {
    display:flex; align-items:center; gap:5px;
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
    color:rgba(248,250,252,.35); letter-spacing:.06em; text-transform:uppercase;
    cursor:pointer; user-select:none; transition:color .15s;
    margin-top:12px;
  }
  .ac-toggle:hover { color:rgba(248,250,252,.70); }
  .ac-toggle-arrow { font-size:8px; transition:transform .2s; }
  .ac-toggle-arrow.open { transform:rotate(180deg); }

  /* Empty */
  .ac-empty { border:1px dashed rgba(255,255,255,.09); border-radius:16px; padding:48px 32px; text-align:center; color:rgba(248,250,252,.28); }
  .ac-empty-icon { font-size:28px; margin-bottom:12px; filter:opacity(.5); }
  .ac-empty-text { font-size:13px; }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.10); border-radius:3px; }
`;

function injectCSS(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement("style"); s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

/* ── Live clock ─────────────────────────────────────────────────── */
function Clock() {
  const [t, setT] = useState(() => new Date().toLocaleTimeString("en-IN", { hour12:false }));
  useEffect(() => {
    const id = setInterval(() => setT(new Date().toLocaleTimeString("en-IN", { hour12:false })), 1000);
    return () => clearInterval(id);
  }, []);
  return <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"rgba(248,250,252,.28)" }}>{t}</span>;
}

/* ── Wastage meter ───────────────────────────────────────────────── */
function WastageMeter({ wastage, curtailed }) {
  const pct   = Math.min(100, wastage * 5);
  const bad   = wastage > 10, med = wastage > 5;
  const color = bad ? T.rose : med ? T.amber : T.emerald;
  const label = bad ? "CRITICAL STRESS" : med ? "ELEVATED" : "NOMINAL";
  return (
    <div className="ac-meter-wrap">
      <div>
        <div className="ac-meter-lbl">Grid Wastage</div>
        <div className="ac-meter-val" style={{ color, textShadow:`0 0 20px ${color}50` }}>{wastage}%</div>
      </div>
      <div>
        <div className="ac-meter-track">
          <div className="ac-meter-fill" style={{ width:`${pct}%`,
            background:`linear-gradient(90deg,${color}70,${color})`,
            boxShadow:`0 0 12px ${color}60` }} />
          <div className="ac-meter-ticks">
            {[...Array(10)].map((_,i) => <div key={i} className="ac-meter-tick" />)}
          </div>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", marginTop:6,
          fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:"rgba(248,250,252,.25)", letterSpacing:".06em" }}>
          <span>0%</span><span>50%</span><span>100%</span>
        </div>
      </div>
      <div className="ac-meter-status" style={{ color }}>
        {label}<br />
        <span style={{ color:"rgba(248,250,252,.28)", fontSize:9, display:"block", marginTop:3 }}>
          {(curtailed||0).toLocaleString("en-IN")} MW curtailed
        </span>
      </div>
    </div>
  );
}

/* ── Action card ─────────────────────────────────────────────────── */
function ActionCard({ action, index }) {
  const [open, setOpen] = useState(action.priority === "critical");
  const pm = PRIORITY[action.priority] || PRIORITY.low;
  const pills = [
    action.impact_mw > 0 && { icon:"⚡", val:`${action.impact_mw} MW`, lbl:"Impact" },
    action.wastage_reduction_pct > 0 && { icon:"↓", val:`−${action.wastage_reduction_pct}%`, lbl:"Wastage" },
    { icon:"↑", val:`+${action.efficiency_gain_pct}%`, lbl:"Efficiency" },
    { icon:"⏱", val:`${action.implementation_time_min}m`, lbl:"Lead time" },
  ].filter(Boolean);

  return (
    <div className="ac-card" style={{ animationDelay:`${index*55}ms` }} onClick={() => setOpen(o=>!o)}>
      <div className="ac-card-inner">
        <div className="ac-card-stripe" style={{ background:pm.stripe }} />
        <div className="ac-card-body">
          <div className="ac-card-top">
            <div className="ac-card-title">{action.title}</div>
            <span className="ac-card-badge" style={{ background:pm.soft, color:pm.color, borderColor:pm.border }}>
              {pm.label}
            </span>
          </div>
          <div className="ac-card-desc">{action.description}</div>
          <div className="ac-pills">
            {pills.map((p,i) => (
              <div key={i} className="ac-pill">
                <span className="ac-pill-icon">{p.icon}</span>
                <span className="ac-pill-val">{p.val}</span>
                <span className="ac-pill-lbl">{p.lbl}</span>
              </div>
            ))}
          </div>
          {open && (
            <div className="ac-detail">
              {action.impact_mw > 0 && (
                <div>
                  <div className="ac-detail-lbl-row"><span>Grid impact</span><span>{action.impact_mw} MW</span></div>
                  <div className="ac-detail-track">
                    <div className="ac-detail-fill" style={{ width:`${Math.min(100,action.impact_mw/2)}%`, background:pm.color, boxShadow:`0 0 8px ${pm.color}50` }} />
                  </div>
                </div>
              )}
              {action.wastage_reduction_pct > 0 && (
                <div>
                  <div className="ac-detail-lbl-row"><span>Wastage cut</span><span>−{action.wastage_reduction_pct}%</span></div>
                  <div className="ac-detail-track">
                    <div className="ac-detail-fill" style={{ width:`${Math.min(100,action.wastage_reduction_pct*4)}%`, background:T.emerald, boxShadow:`0 0 8px ${T.emerald}50` }} />
                  </div>
                </div>
              )}
              <div>
                <div className="ac-detail-lbl-row"><span>Efficiency gain</span><span>+{action.efficiency_gain_pct}%</span></div>
                <div className="ac-detail-track">
                  <div className="ac-detail-fill" style={{ width:`${Math.min(100,action.efficiency_gain_pct*6)}%`, background:T.indigo, boxShadow:`0 0 8px ${T.indigo}50` }} />
                </div>
              </div>
              <div>
                <div className="ac-detail-lbl-row"><span>Lead time</span><span>{action.implementation_time_min} min</span></div>
                <div className="ac-detail-track">
                  <div className="ac-detail-fill" style={{ width:`${Math.min(100,action.implementation_time_min*3)}%`, background:"rgba(248,250,252,.25)" }} />
                </div>
              </div>
            </div>
          )}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div className="ac-proto"><div className="ac-proto-dot" />{action.protocol}</div>
            <div className="ac-toggle" onClick={e=>{e.stopPropagation();setOpen(o=>!o);}}>
              {open?"Hide detail":"Show detail"}
              <span className={`ac-toggle-arrow ${open?"open":""}`}>▼</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   ACTIONS MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function Actions({ data }) {
  useEffect(() => { injectCSS("ac-aurora", CSS); }, []);
  if (!data) return null;
  const { actions, grid } = data;
  const [filter, setFilter] = useState("all");

  const priorities = ["critical","high","medium","low"];
  const counts  = Object.fromEntries(priorities.map(p=>[p, actions.filter(a=>a.priority===p).length]));
  const filtered = filter==="all" ? actions : actions.filter(a=>a.priority===filter);

  const wastage_pct       = Number(grid.wastage_pct)       || 0;
  const efficiency_pct    = Number(grid.efficiency_pct)    || 0;
  const total_gen_mw      = Number(grid.total_generation_mw) || 0;

  const projWaste = Math.max(2, wastage_pct - Math.round(wastage_pct * 0.72));
  const projEff   = Math.min(97, efficiency_pct + 11);
  const wasteReduction    = Math.max(0, wastage_pct - projWaste);
  const co2Saved  = total_gen_mw > 0
    ? Math.round((wasteReduction / 100) * total_gen_mw * 0.5 * 0.82)
    : 0;
  const revSavedRaw = total_gen_mw > 0
    ? Math.round((wasteReduction / 100) * total_gen_mw * 0.5 * 4200)
    : 0;

  const kpis = [
    { lbl:"Total actions",    val:actions.length,           sub:`${counts.critical||0} critical`,   color:T.indigo, delay:0   },
    { lbl:"Current wastage",  val:`${wastage_pct}%`,        sub:`${grid.curtailed_mw ?? "—"} MW curtailed`, color:wastage_pct>10?T.rose:T.amber, delay:70  },
    { lbl:"Projected wastage",val:`${projWaste}%`,          sub:"After all actions",                 color:T.emerald, delay:140 },
    { lbl:"Efficiency after", val:`${projEff}%`,            sub:`+${projEff - efficiency_pct} pts`, color:T.violet, delay:210 },
  ];

  const forecasts = [
    { lbl:"Current wastage",   val:`${wastage_pct}%`,    pct:Math.min(100, wastage_pct * 5),   color:T.rose    },
    { lbl:"Projected wastage", val:`${projWaste}%`,      pct:Math.min(100, projWaste * 5),     color:T.emerald },
    { lbl:"Efficiency now",    val:`${efficiency_pct}%`, pct:efficiency_pct,                   color:T.amber   },
    { lbl:"Efficiency after",  val:`${projEff}%`,        pct:projEff,                          color:T.emerald },
  ];

  // Smart revenue formatter: shows ₹0 if zero, ₹X if <1L, ₹X.XL if >=1L
  const fmtRevenue = (v) => {
    if (!v || v === 0) return "₹0";
    if (v < 100000)   return `₹${v.toLocaleString("en-IN")}`;
    return `₹${(v / 100000).toFixed(1)}L`;
  };

  const outcomes = [
    { lbl:"Wastage after",  val:`${projWaste}%`,           sub:`was ${wastage_pct}%`,            color:T.emerald },
    { lbl:"Efficiency",     val:`${projEff}%`,             sub:`+${projEff - efficiency_pct} pts`,color:T.indigo  },
    { lbl:"CO₂ avoided",   val:co2Saved > 0 ? `${co2Saved}t` : "—", sub:"est. per day",         color:T.emerald },
    { lbl:"Revenue saved",  val:fmtRevenue(revSavedRaw),   sub:"curtailment cut",                 color:T.gold    },
  ];

  return (
    <div className="ac-root">
      <div className="ac-aurora">
        <div className="ac-a1" /><div className="ac-a2" /><div className="ac-a3" />
      </div>
      <div className="ac-content">

        {/* Topbar */}
        <div className="ac-topbar">
          <div className="ac-brand">
            <div className="ac-brand-icon">⚡</div>
            <div>
              <div className="ac-brand-name">Grid Load Balancer</div>
              <div className="ac-brand-sub">KPTCL SLDC · Southern Region</div>
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:12 }}>
            <div className="ac-live"><div className="ac-live-dot" />LIVE</div>
            <Clock />
          </div>
        </div>

        {/* Wastage meter */}
        <WastageMeter wastage={grid.wastage_pct} curtailed={grid.curtailed_mw} />

        {/* KPI strip */}
        <div className="ac-kpis">
          {kpis.map((k,i) => (
            <div key={i} className="ac-kpi" style={{ animationDelay:`${k.delay}ms` }}>
              <div className="ac-kpi-glow" style={{ background:`${k.color}22` }} />
              <div className="ac-kpi-lbl">{k.lbl}</div>
              <div className="ac-kpi-val" style={{ color:k.color, textShadow:`0 0 20px ${k.color}50` }}>{k.val}</div>
              <div className="ac-kpi-sub">{k.sub}</div>
              <div className="ac-kpi-stripe" style={{ background:`linear-gradient(90deg,transparent,${k.color},transparent)` }} />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="ac-body">

          {/* Left panel */}
          <div className="ac-left">

            {/* Priority breakdown */}
            <div className="ac-panel" style={{ animationDelay:"0ms" }}>
              <div className="ac-sh">
                <div className="ac-sh-accent" style={{ background:T.indigo, boxShadow:`0 0 8px ${T.indigo}` }} />
                <span className="ac-sh-label">By Priority</span>
              </div>
              {priorities.map(p => {
                const pm = PRIORITY[p];
                return (
                  <div key={p} className={`ac-prow ${filter===p?"sel":""}`} onClick={()=>setFilter(f=>f===p?"all":p)}>
                    <div className="ac-prow-l">
                      <div className="ac-prow-dot" style={{ background:pm.color, boxShadow:`0 0 6px ${pm.color}` }} />
                      <div className="ac-prow-name" style={{ color:filter===p?pm.color:"rgba(248,250,252,.60)" }}>{pm.label}</div>
                    </div>
                    <div className="ac-prow-count">{counts[p]||0}</div>
                  </div>
                );
              })}
              <div style={{ marginTop:12, paddingTop:11, borderTop:"1px solid rgba(255,255,255,.07)",
                display:"flex", justifyContent:"space-between", fontSize:11, color:"rgba(248,250,252,.30)" }}>
                <span>Total actions</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", color:T.gold, fontWeight:600 }}>{actions.length}</span>
              </div>
            </div>

            {/* Forecast bars */}
            <div className="ac-panel" style={{ animationDelay:"70ms" }}>
              <div className="ac-sh">
                <div className="ac-sh-accent" style={{ background:T.violet, boxShadow:`0 0 8px ${T.violet}` }} />
                <span className="ac-sh-label">Impact Forecast</span>
              </div>
              {forecasts.map((f,i) => (
                <div key={i} className="ac-frow">
                  <div className="ac-frow-lbl">{f.lbl}</div>
                  <div className="ac-frow-bar">
                    <div className="ac-frow-fill" style={{ width:`${f.pct}%`, background:f.color, boxShadow:`0 0 6px ${f.color}50` }} />
                  </div>
                  <div className="ac-frow-val" style={{ color:f.color }}>{f.val}</div>
                </div>
              ))}
            </div>

            {/* Outcomes */}
            <div className="ac-panel" style={{ animationDelay:"140ms" }}>
              <div className="ac-sh">
                <div className="ac-sh-accent" style={{ background:T.emerald, boxShadow:`0 0 8px ${T.emerald}` }} />
                <span className="ac-sh-label">After All Actions</span>
              </div>
              <div className="ac-outcomes">
                {outcomes.map((o,i) => (
                  <div key={i} className="ac-outcome">
                    <div className="ac-out-lbl">{o.lbl}</div>
                    <div className="ac-out-val" style={{ color:o.color, textShadow:`0 0 14px ${o.color}40` }}>{o.val}</div>
                    <div className="ac-out-sub">{o.sub}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right feed */}
          <div className="ac-feed">
            <div className="ac-feed-hdr">
              <div className="ac-feed-title">Dispatch Queue</div>
              <div className="ac-feed-count">{filtered.length} of {actions.length} actions</div>
            </div>

            <div className="ac-chips">
              {[{ key:"all", label:`All  ${actions.length}` },
                ...priorities.filter(p=>counts[p]>0).map(p=>({ key:p, label:`${PRIORITY[p].label}  ${counts[p]}` }))
              ].map(c => (
                <button key={c.key} className={`ac-chip ${c.key} ${filter===c.key?"on":""}`}
                  onClick={()=>setFilter(c.key)}>{c.label}</button>
              ))}
            </div>

            {filtered.length===0 && (
              <div className="ac-empty">
                <div className="ac-empty-icon">✓</div>
                <div className="ac-empty-text">
                  {filter==="all" ? "Grid balanced — no actions pending." : `No ${filter} priority actions.`}
                </div>
              </div>
            )}

            {filtered.map((action,i) => <ActionCard key={i} action={action} index={i} />)}
          </div>
        </div>
      </div>
    </div>
  );
}