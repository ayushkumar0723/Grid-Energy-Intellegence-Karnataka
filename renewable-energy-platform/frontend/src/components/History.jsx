import { useEffect, useRef, useState } from "react";

/* ═══════════════════════════════════════════════════════════════════
   AURORA THEME — exact match to Dashboard
   Space Grotesk + JetBrains Mono · #0F172A bg · indigo/violet/rose
   /emerald/gold palette · glassmorphism cards · aurora glow bg
   ═══════════════════════════════════════════════════════════════════ */
const T = {
  indigo:  "#6366F1",
  violet:  "#8B5CF6",
  rose:    "#F43F5E",
  amber:   "#F59E0B",
  emerald: "#10B981",
  sky:     "#0EA5E9",
  gold:    "#FBBF24",
  solar:   "#FBBF24",
  wind:    "#0EA5E9",
  demand:  "#8B5CF6",
  text:    "#F8FAFC",
  textMd:  "rgba(248,250,252,0.60)",
  textLo:  "rgba(248,250,252,0.32)",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
  html, body { background:#0F172A; }

  @keyframes aurora-shift {
    0%,100% { opacity:.38; transform:scale(1) rotate(0deg); }
    33%      { opacity:.55; transform:scale(1.07) rotate(3deg); }
    66%      { opacity:.42; transform:scale(.96) rotate(-2deg); }
  }
  @keyframes fade-up {
    from { opacity:0; transform:translateY(10px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pulse-ring {
    0%   { box-shadow:0 0 0 0 rgba(16,185,129,.55); }
    70%  { box-shadow:0 0 0 8px rgba(16,185,129,0); }
    100% { box-shadow:0 0 0 0 rgba(16,185,129,0); }
  }
  @keyframes bar-rise {
    from { transform:scaleY(0); transform-origin:bottom; }
    to   { transform:scaleY(1); transform-origin:bottom; }
  }

  /* ── Root ── */
  .hy-root {
    font-family:'Space Grotesk',sans-serif;
    background:#0F172A;
    min-height:100vh;
    color:#F8FAFC;
    position:relative;
    overflow:hidden;
  }
  .hy-aurora { position:fixed; inset:0; z-index:0; pointer-events:none; overflow:hidden; }
  .hy-a1 {
    position:absolute; top:-20%; right:-8%; width:55%; height:55%;
    background:radial-gradient(ellipse,rgba(139,92,246,.16) 0%,transparent 70%);
    animation:aurora-shift 16s ease-in-out infinite;
  }
  .hy-a2 {
    position:absolute; bottom:-12%; left:-5%; width:50%; height:50%;
    background:radial-gradient(ellipse,rgba(16,185,129,.10) 0%,transparent 70%);
    animation:aurora-shift 20s ease-in-out infinite reverse;
  }
  .hy-a3 {
    position:absolute; top:45%; right:25%; width:35%; height:35%;
    background:radial-gradient(ellipse,rgba(251,191,36,.06) 0%,transparent 70%);
    animation:aurora-shift 25s ease-in-out infinite 6s;
  }
  .hy-content { position:relative; z-index:2; padding:26px 20px 56px; }

  /* ── Topbar ── */
  .hy-topbar {
    display:flex; align-items:center; justify-content:space-between;
    margin-bottom:22px; flex-wrap:wrap; gap:12px;
    padding-bottom:18px; border-bottom:1px solid rgba(255,255,255,.07);
  }
  .hy-brand { display:flex; align-items:center; gap:12px; }
  .hy-brand-icon {
    width:38px; height:38px; border-radius:11px; flex-shrink:0;
    background:linear-gradient(135deg,#8B5CF6,#10B981);
    display:flex; align-items:center; justify-content:center;
    font-size:18px; box-shadow:0 4px 16px rgba(139,92,246,.4);
  }
  .hy-brand-name { font-size:15px; font-weight:700; color:#F8FAFC; letter-spacing:-.01em; }
  .hy-brand-sub  { font-family:'JetBrains Mono',monospace; font-size:9px; color:rgba(248,250,252,.30); letter-spacing:.12em; text-transform:uppercase; margin-top:2px; }

  .hy-archive-badge {
    display:inline-flex; align-items:center; gap:8px;
    padding:6px 14px; border-radius:12px;
    background:rgba(16,185,129,.10); border:1px solid rgba(16,185,129,.24);
    font-family:'JetBrains Mono',monospace; font-size:10px; color:#10B981;
    letter-spacing:.06em;
  }
  .hy-archive-dot { width:6px; height:6px; border-radius:50%; background:#10B981; animation:pulse-ring 2s infinite; flex-shrink:0; }

  /* ── Section head shared ── */
  .hy-sh { display:flex; align-items:center; gap:9px; margin-bottom:16px; }
  .hy-sh-accent { width:3px; height:14px; border-radius:2px; flex-shrink:0; }
  .hy-sh-label  { font-family:'JetBrains Mono',monospace; font-size:9px; text-transform:uppercase; letter-spacing:.16em; color:rgba(248,250,252,.32); }

  /* ── KPI strip ── */
  .hy-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; margin-bottom:24px; }
  @media(max-width:1000px){ .hy-kpis { grid-template-columns:repeat(2,1fr); } }
  .hy-kpi {
    background:rgba(255,255,255,.045); border:1px solid rgba(255,255,255,.09);
    border-radius:16px; padding:16px 18px; position:relative; overflow:hidden;
    animation:fade-up .5s ease both; transition:border-color .2s,transform .2s;
  }
  .hy-kpi:hover { border-color:rgba(255,255,255,.16); transform:translateY(-2px); }
  .hy-kpi-glow   { position:absolute; top:-32px; right:-32px; width:90px; height:90px; border-radius:50%; filter:blur(28px); pointer-events:none; }
  .hy-kpi-lbl    { font-family:'JetBrains Mono',monospace; font-size:8.5px; text-transform:uppercase; letter-spacing:.14em; color:rgba(248,250,252,.32); margin-bottom:9px; }
  .hy-kpi-val    { font-size:26px; font-weight:700; letter-spacing:-.03em; line-height:1; margin-bottom:5px; }
  .hy-kpi-sub    { font-size:10.5px; color:rgba(248,250,252,.38); }
  .hy-kpi-stripe { position:absolute; bottom:0; left:10%; right:10%; height:1.5px; border-radius:2px; opacity:.5; }

  /* ── 2-col body ── */
  .hy-body { display:grid; grid-template-columns:1fr 300px; gap:20px; align-items:start; }
  @media(max-width:1000px){ .hy-body { grid-template-columns:1fr; } }

  /* ── Chart card ── */
  .hy-chart-card {
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    border-radius:20px; padding:22px 24px;
    animation:fade-up .55s ease both;
  }
  .hy-legend { display:flex; gap:18px; flex-wrap:wrap; align-items:center; margin-bottom:18px; }
  .hy-legend-item { display:flex; align-items:center; gap:8px; font-size:11.5px; color:rgba(248,250,252,.50); font-weight:500; }
  .hy-legend-box  { width:12px; height:12px; border-radius:3px; flex-shrink:0; }
  .hy-chart-wrap  { position:relative; height:240px; }

  /* ── Right sidebar ── */
  .hy-sidebar { display:flex; flex-direction:column; gap:18px; }

  /* Trend panel */
  .hy-trend-card {
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    border-radius:18px; padding:18px 20px;
    animation:fade-up .5s ease both;
  }
  .hy-trend-row { display:flex; align-items:center; justify-content:space-between; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.05); }
  .hy-trend-row:last-child { border-bottom:none; }
  .hy-trend-lbl { font-size:11.5px; color:rgba(248,250,252,.55); }
  .hy-trend-val { font-family:'JetBrains Mono',monospace; font-size:13px; font-weight:600; }

  /* Sparkline mini bars */
  .hy-spark { display:flex; align-items:flex-end; gap:3px; height:32px; margin-top:14px; }
  .hy-spark-bar {
    flex:1; border-radius:2px 2px 0 0;
    animation:bar-rise .8s cubic-bezier(.34,1,.64,1) both;
    min-height:3px;
  }

  /* ── Data table card ── */
  .hy-table-card {
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.09);
    border-radius:20px; overflow:hidden;
    animation:fade-up .6s ease both .05s;
    margin-top:20px;
  }
  .hy-table-hdr { padding:18px 22px 0; }

  table.hy-table { width:100%; border-collapse:collapse; font-size:12px; }
  .hy-table thead tr { border-bottom:1px solid rgba(255,255,255,.08); }
  .hy-table thead th {
    padding:10px 16px; text-align:left;
    font-family:'JetBrains Mono',monospace; font-size:9px; font-weight:600;
    text-transform:uppercase; letter-spacing:.1em; color:rgba(248,250,252,.30);
    white-space:nowrap;
  }
  .hy-table tbody tr { border-bottom:1px solid rgba(255,255,255,.04); transition:background .15s; }
  .hy-table tbody tr:last-child { border-bottom:none; }
  .hy-table tbody tr:hover { background:rgba(255,255,255,.025); }
  .hy-table td { padding:11px 16px; color:rgba(248,250,252,.55); white-space:nowrap; }

  .hy-td-date { color:rgba(248,250,252,.80) !important; font-weight:500; }

  /* Inline badges */
  .hy-badge {
    display:inline-flex; align-items:center; gap:4px;
    font-family:'JetBrains Mono',monospace; font-size:10px; font-weight:600;
    padding:3px 9px; border-radius:5px; border:1px solid transparent;
  }
  .hy-badge.danger  { background:rgba(244,63,94,.12);  color:#FDA4AF; border-color:rgba(244,63,94,.28);  }
  .hy-badge.warn    { background:rgba(245,158,11,.12); color:#FCD34D; border-color:rgba(245,158,11,.28); }
  .hy-badge.ok      { background:rgba(16,185,129,.10); color:#6EE7B7; border-color:rgba(16,185,129,.26); }

  /* Source badge */
  .hy-src {
    font-family:'JetBrains Mono',monospace; font-size:9.5px;
    color:rgba(248,250,252,.28); letter-spacing:.04em;
  }

  ::-webkit-scrollbar { width:5px; }
  ::-webkit-scrollbar-track { background:transparent; }
  ::-webkit-scrollbar-thumb { background:rgba(255,255,255,.10); border-radius:3px; }
`;

function injectCSS(id, css) {
  if (document.getElementById(id)) return;
  const s = document.createElement("style"); s.id = id; s.textContent = css;
  document.head.appendChild(s);
}

/* ═══════════════════════════════════════════════════════════════════
   HISTORY MAIN
   ═══════════════════════════════════════════════════════════════════ */
export default function History({ data }) {
  const chartRef      = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => { injectCSS("hy-aurora", CSS); }, []);

  useEffect(() => {
    if (!data || !chartRef.current) return;

    function initChart() {
      if (!window.Chart) return;
      if (chartInstance.current) chartInstance.current.destroy();
      const h = data.history;
      chartInstance.current = new window.Chart(chartRef.current, {
        type:"bar",
        data:{
          labels: h.map(d => d.label),
          datasets:[
            {
              label:"Solar GWh", data:h.map(d=>d.solar_gwh),
              backgroundColor:"rgba(251,191,36,0.70)",
              borderRadius:5, stack:"gen",
              hoverBackgroundColor:"rgba(251,191,36,0.90)",
            },
            {
              label:"Wind GWh", data:h.map(d=>d.wind_gwh),
              backgroundColor:"rgba(14,165,233,0.65)",
              borderRadius:5, stack:"gen",
              hoverBackgroundColor:"rgba(14,165,233,0.85)",
            },
            {
              label:"Demand GWh", data:h.map(d=>d.demand_gwh),
              backgroundColor:"rgba(139,92,246,0.12)",
              borderColor:"rgba(139,92,246,0.55)", borderWidth:1.5,
              borderRadius:5, stack:"dem",
            },
          ],
        },
        options:{
          responsive:true, maintainAspectRatio:false,
          plugins:{
            legend:{ display:false },
            tooltip:{
              backgroundColor:"rgba(15,23,42,0.97)",
              borderColor:"rgba(255,255,255,.09)", borderWidth:1,
              titleColor:"#F8FAFC", bodyColor:"rgba(248,250,252,.65)",
              padding:13, cornerRadius:12,
              titleFont:{ family:"'Space Grotesk',sans-serif", weight:"600", size:12 },
              bodyFont:{ family:"'JetBrains Mono',monospace", size:11 },
              callbacks:{ label:c=>`  ${c.dataset.label}: ${c.parsed.y} GWh` },
            },
          },
          scales:{
            x:{
              stacked:true,
              ticks:{ color:"rgba(248,250,252,.30)", font:{ size:10.5, family:"'JetBrains Mono',monospace" } },
              grid:{ display:false },
              border:{ color:"rgba(255,255,255,.06)" },
            },
            y:{
              stacked:false,
              ticks:{ callback:v=>`${v} GWh`, color:"rgba(248,250,252,.30)", font:{ size:10.5, family:"'JetBrains Mono',monospace" } },
              grid:{ color:"rgba(255,255,255,.055)", drawBorder:false },
              border:{ display:false },
            },
          },
        },
      });
    }

    if (!window.Chart) {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js";
      s.onload = initChart;
      document.head.appendChild(s);
    } else { initChart(); }

    return () => { if (chartInstance.current) chartInstance.current.destroy(); };
  }, [data]);

  if (!data) return null;
  const h = data.history;
  const totalSolar = h.reduce((a,d)=>a+d.solar_gwh,0).toFixed(1);
  const totalWind  = h.reduce((a,d)=>a+d.wind_gwh, 0).toFixed(1);
  const avgEff     = (h.reduce((a,d)=>a+d.efficiency_pct,0)/h.length).toFixed(1);
  const totalCo2   = h.reduce((a,d)=>a+d.co2_avoided_tonnes,0).toLocaleString("en-IN");
  const isReal     = h.length>0 && h[0].data_source==="open-meteo-archive";

  const kpis = [
    { lbl:"7-day Solar",     val:`${totalSolar} GWh`, sub:"Real solar generation",  color:T.solar,   delay:0   },
    { lbl:"7-day Wind",      val:`${totalWind} GWh`,  sub:"Real wind generation",   color:T.wind,    delay:70  },
    { lbl:"Avg Efficiency",  val:`${avgEff}%`,         sub:"7-day average",          color:parseFloat(avgEff)>=85?T.emerald:T.amber, delay:140 },
    { lbl:"CO₂ Avoided",    val:`${totalCo2} t`,      sub:"vs fossil baseline",     color:T.emerald, delay:210 },
  ];

  /* Max solar for sparkline scale */
  const maxSolar = Math.max(...h.map(d=>d.solar_gwh), 1);
  const maxWind  = Math.max(...h.map(d=>d.wind_gwh),  1);

  return (
    <div className="hy-root">
      <div className="hy-aurora">
        <div className="hy-a1" /><div className="hy-a2" /><div className="hy-a3" />
      </div>
      <div className="hy-content">

        {/* Topbar */}
        <div className="hy-topbar">
          <div className="hy-brand">
            <div className="hy-brand-icon">📊</div>
            <div>
              <div className="hy-brand-name">Historical Performance</div>
              <div className="hy-brand-sub">7-day energy archive · real weather data</div>
            </div>
          </div>
          {isReal && (
            <div className="hy-archive-badge">
              <div className="hy-archive-dot" />
              Open-Meteo Archive — real measured data
            </div>
          )}
        </div>

        {/* KPI strip */}
        <div className="hy-kpis">
          {kpis.map((k,i) => (
            <div key={i} className="hy-kpi" style={{ animationDelay:`${k.delay}ms` }}>
              <div className="hy-kpi-glow" style={{ background:`${k.color}22` }} />
              <div className="hy-kpi-lbl">{k.lbl}</div>
              <div className="hy-kpi-val" style={{ color:k.color, textShadow:`0 0 20px ${k.color}50` }}>{k.val}</div>
              <div className="hy-kpi-sub">{k.sub}</div>
              <div className="hy-kpi-stripe" style={{ background:`linear-gradient(90deg,transparent,${k.color},transparent)` }} />
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="hy-body">

          {/* Chart */}
          <div className="hy-chart-card">
            <div className="hy-sh">
              <div className="hy-sh-accent" style={{ background:T.violet, boxShadow:`0 0 8px ${T.violet}` }} />
              <span className="hy-sh-label">7-day Energy Balance</span>
            </div>

            {/* Legend */}
            <div className="hy-legend">
              {[
                { color:"rgba(251,191,36,0.80)", label:"Solar" },
                { color:"rgba(14,165,233,0.75)",  label:"Wind"  },
                { color:"rgba(139,92,246,0.35)",  label:"Demand", outline:true },
              ].map(l => (
                <span key={l.label} className="hy-legend-item">
                  <span className="hy-legend-box" style={{
                    background:l.color,
                    boxShadow:l.outline?`inset 0 0 0 1.5px rgba(139,92,246,.65)`:"none",
                  }} />
                  {l.label}
                </span>
              ))}
            </div>

            <div className="hy-chart-wrap">
              <canvas ref={chartRef} role="img" aria-label="7-day energy balance chart" />
            </div>
          </div>

          {/* Right sidebar */}
          <div className="hy-sidebar">

            {/* Weekly trend panel */}
            <div className="hy-trend-card">
              <div className="hy-sh">
                <div className="hy-sh-accent" style={{ background:T.emerald, boxShadow:`0 0 8px ${T.emerald}` }} />
                <span className="hy-sh-label">Week Summary</span>
              </div>

              {[
                { lbl:"Best solar day",   val:`${Math.max(...h.map(d=>d.solar_gwh))} GWh`,  color:T.solar   },
                { lbl:"Best wind day",    val:`${Math.max(...h.map(d=>d.wind_gwh))} GWh`,   color:T.wind    },
                { lbl:"Peak efficiency",  val:`${Math.max(...h.map(d=>d.efficiency_pct))}%`, color:T.emerald },
                { lbl:"Min wastage",      val:`${Math.min(...h.map(d=>d.wastage_pct))}%`,   color:T.emerald },
                { lbl:"Max wastage",      val:`${Math.max(...h.map(d=>d.wastage_pct))}%`,   color:T.rose    },
              ].map((r,i) => (
                <div key={i} className="hy-trend-row">
                  <div className="hy-trend-lbl">{r.lbl}</div>
                  <div className="hy-trend-val" style={{ color:r.color, textShadow:`0 0 10px ${r.color}40` }}>{r.val}</div>
                </div>
              ))}

              {/* Solar sparkline */}
              <div style={{ marginTop:18 }}>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8.5, textTransform:"uppercase",
                  letterSpacing:".12em", color:"rgba(248,250,252,.28)", marginBottom:8 }}>Solar — day by day</div>
                <div className="hy-spark">
                  {h.map((d,i) => (
                    <div key={i} className="hy-spark-bar" style={{
                      height:`${(d.solar_gwh/maxSolar)*100}%`,
                      background:`linear-gradient(180deg,${T.solar},${T.solar}80)`,
                      boxShadow:`0 0 6px ${T.solar}60`,
                      animationDelay:`${i*80}ms`,
                    }} />
                  ))}
                </div>
                <div className="hy-spark" style={{ marginTop:10 }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:8.5,
                    color:"rgba(248,250,252,.28)", letterSpacing:".12em", textTransform:"uppercase",
                    marginBottom:8, flex:"100%" }}>Wind — day by day</div>
                </div>
                <div className="hy-spark" style={{ height:32 }}>
                  {h.map((d,i) => (
                    <div key={i} className="hy-spark-bar" style={{
                      height:`${(d.wind_gwh/maxWind)*100}%`,
                      background:`linear-gradient(180deg,${T.wind},${T.wind}80)`,
                      boxShadow:`0 0 6px ${T.wind}50`,
                      animationDelay:`${i*80+40}ms`,
                    }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Data table */}
        <div className="hy-table-card">
          <div className="hy-table-hdr">
            <div className="hy-sh">
              <div className="hy-sh-accent" style={{ background:T.gold, boxShadow:`0 0 8px ${T.gold}` }} />
              <span className="hy-sh-label">Daily Breakdown</span>
            </div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table className="hy-table">
              <thead>
                <tr>
                  {["Date","Solar GWh","Wind GWh","Demand GWh","Wastage","Efficiency","Source"].map(c => (
                    <th key={c}>{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {h.map((row,i) => (
                  <tr key={i}>
                    <td className="hy-td-date">{row.label}</td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:T.solar, fontWeight:600 }}>
                      {row.solar_gwh}
                    </td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:T.wind, fontWeight:600 }}>
                      {row.wind_gwh}
                    </td>
                    <td style={{ fontFamily:"'JetBrains Mono',monospace", color:"rgba(248,250,252,.60)" }}>
                      {row.demand_gwh}
                    </td>
                    <td>
                      <span className={`hy-badge ${row.wastage_pct>10?"danger":row.wastage_pct>5?"warn":"ok"}`}>
                        {row.wastage_pct}%
                      </span>
                    </td>
                    <td>
                      <span className={`hy-badge ${row.efficiency_pct>=85?"ok":"warn"}`}>
                        {row.efficiency_pct}%
                      </span>
                    </td>
                    <td className="hy-src">{row.data_source||"physics"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}