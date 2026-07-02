import { useState, useEffect, useCallback } from "react";
import Dashboard from "./components/Dashboard";
import Forecast from "./components/Forecast";
import Actions from "./components/Actions";
import History from "./components/History";

/* ═══════════════════════════════════════════════════════════════════
   AURORA APP SHELL — matches Dashboard / Forecast / Actions / History
   Space Grotesk + JetBrains Mono · #0D1117 bg · indigo/violet/rose
   Full-screen layout: sidebar nav + page content, no external padding
   ═══════════════════════════════════════════════════════════════════ */

const API_BASE = "http://localhost:8000/api";
const REFRESH_INTERVAL = 30000;

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html, body, #root {
    height: 100%;
    width: 100%;
    overflow: hidden;
    background: #0D1117;
    font-family: 'Space Grotesk', sans-serif;
    color: #F8FAFC;
  }

  /* ── Aurora ambient glows (fixed, behind everything) ── */
  @keyframes aurora-drift {
    0%,100% { opacity:.30; transform:scale(1) translate(0,0); }
    33%      { opacity:.50; transform:scale(1.10) translate(2%,1%); }
    66%      { opacity:.35; transform:scale(.94) translate(-1%,2%); }
  }
  @keyframes fade-in {
    from { opacity:0; transform:translateY(6px); }
    to   { opacity:1; transform:translateY(0); }
  }
  @keyframes pulse-live {
    0%,100% { box-shadow:0 0 0 0 rgba(16,185,129,.6); }
    70%      { box-shadow:0 0 0 7px rgba(16,185,129,0); }
  }
  @keyframes spin { to { transform:rotate(360deg); } }
  @keyframes tab-slide {
    from { opacity:0; transform:translateX(-6px); }
    to   { opacity:1; transform:translateX(0); }
  }

  .app-aurora {
    position: fixed; inset: 0; z-index: 0; pointer-events: none; overflow: hidden;
  }
  .app-aurora-1 {
    position:absolute; top:-18%; left:-6%; width:52%; height:52%;
    background:radial-gradient(ellipse,rgba(99,102,241,.16) 0%,transparent 70%);
    animation:aurora-drift 15s ease-in-out infinite;
  }
  .app-aurora-2 {
    position:absolute; bottom:-14%; right:-8%; width:50%; height:50%;
    background:radial-gradient(ellipse,rgba(244,63,94,.11) 0%,transparent 70%);
    animation:aurora-drift 20s ease-in-out infinite reverse;
  }
  .app-aurora-3 {
    position:absolute; top:42%; left:32%; width:34%; height:34%;
    background:radial-gradient(ellipse,rgba(16,185,129,.07) 0%,transparent 70%);
    animation:aurora-drift 26s ease-in-out infinite 5s;
  }

  /* ── Root layout: sidebar + content ── */
  .app-shell {
    position: relative;
    z-index: 1;
    display: flex;
    height: 100vh;
    width: 100vw;
    overflow: hidden;
  }

  /* ════════════════════════════════════
     SIDEBAR
     ════════════════════════════════════ */
  .app-sidebar {
    width: 220px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: rgba(255,255,255,0.032);
    border-right: 1px solid rgba(255,255,255,0.07);
    height: 100vh;
    overflow: hidden;
    z-index: 10;
    position: relative;
  }

  /* Brand block */
  .sb-brand {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 20px 18px 16px;
    border-bottom: 1px solid rgba(255,255,255,0.07);
    flex-shrink: 0;
  }
  .sb-brand-icon {
    width: 36px; height: 36px;
    border-radius: 10px; flex-shrink: 0;
    background: linear-gradient(135deg, #6366F1, #F43F5E);
    display: flex; align-items: center; justify-content: center;
    font-size: 17px;
    box-shadow: 0 4px 14px rgba(99,102,241,0.40);
  }
  .sb-brand-name {
    font-size: 12.5px; font-weight: 700;
    color: #F8FAFC; letter-spacing: -.01em; line-height: 1.2;
  }
  .sb-brand-sub {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8.5px; color: rgba(248,250,252,.30);
    letter-spacing: .10em; text-transform: uppercase;
    margin-top: 2px;
  }

  /* Live status */
  .sb-live {
    display: flex; align-items: center; gap: 8px;
    margin: 12px 14px;
    padding: 7px 12px; border-radius: 10px;
    background: rgba(16,185,129,.10);
    border: 1px solid rgba(16,185,129,.22);
    flex-shrink: 0;
  }
  .sb-live-dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: #10B981; flex-shrink: 0;
    animation: pulse-live 1.8s ease-out infinite;
  }
  .sb-live-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px; font-weight: 600;
    color: #10B981; letter-spacing: .08em;
    flex: 1;
  }
  .sb-live-time {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: rgba(248,250,252,.28);
  }

  /* Nav section label */
  .sb-nav-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px; letter-spacing: .16em;
    text-transform: uppercase; color: rgba(248,250,252,.22);
    padding: 10px 18px 6px;
    flex-shrink: 0;
  }

  /* Nav items */
  .sb-nav {
    display: flex; flex-direction: column;
    gap: 2px; padding: 0 10px;
    flex-shrink: 0;
  }
  .sb-nav-item {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 10px;
    cursor: pointer; font-size: 13px; font-weight: 500;
    color: rgba(248,250,252,.42);
    transition: all .15s ease;
    border: 1px solid transparent;
    position: relative;
    user-select: none;
  }
  .sb-nav-item:hover {
    background: rgba(255,255,255,.055);
    color: rgba(248,250,252,.80);
  }
  .sb-nav-item.active {
    background: rgba(99,102,241,.16);
    color: #A5B4FC;
    border-color: rgba(99,102,241,.28);
  }
  .sb-nav-icon { font-size: 15px; flex-shrink: 0; width: 20px; text-align: center; }
  .sb-nav-badge {
    margin-left: auto;
    background: #F43F5E;
    color: #fff;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; font-weight: 700;
    padding: 2px 6px; border-radius: 20px;
    min-width: 18px; text-align: center;
    box-shadow: 0 0 8px rgba(244,63,94,.50);
  }

  /* Divider */
  .sb-divider {
    height: 1px;
    background: rgba(255,255,255,.07);
    margin: 12px 14px;
    flex-shrink: 0;
  }

  /* Location block */
  .sb-location {
    margin: 0 14px;
    padding: 12px 14px;
    background: rgba(255,255,255,.03);
    border: 1px solid rgba(255,255,255,.07);
    border-radius: 12px;
    flex-shrink: 0;
  }
  .sb-loc-label {
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px; color: rgba(248,250,252,.28);
    text-transform: uppercase; letter-spacing: .14em;
    margin-bottom: 5px;
  }
  .sb-loc-name {
    font-size: 13px; font-weight: 600;
    color: rgba(248,250,252,.75);
  }
  .sb-loc-coords {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: rgba(248,250,252,.28);
    margin-top: 2px;
  }

  /* Updated at + refresh */
  .sb-footer {
    margin-top: auto;
    padding: 14px 14px 18px;
    border-top: 1px solid rgba(255,255,255,.07);
    flex-shrink: 0;
  }
  .sb-updated {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px; color: rgba(248,250,252,.24);
    margin-bottom: 10px; text-align: center;
    letter-spacing: .04em;
  }
  .sb-refresh {
    width: 100%;
    padding: 8px 0;
    border-radius: 9px;
    border: 1px solid rgba(255,255,255,.10);
    background: rgba(255,255,255,.04);
    color: rgba(248,250,252,.50);
    font-family: 'Space Grotesk', sans-serif;
    font-size: 12px; font-weight: 500;
    cursor: pointer;
    transition: all .15s;
    letter-spacing: .02em;
  }
  .sb-refresh:hover {
    background: rgba(99,102,241,.15);
    border-color: rgba(99,102,241,.32);
    color: #A5B4FC;
  }
  .sb-refresh:active { transform: scale(.98); }

  /* ════════════════════════════════════
     MAIN CONTENT AREA
     ════════════════════════════════════ */
  .app-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    height: 100vh;
    position: relative;
    /* Remove max-width constraint — full bleed */
  }
  .app-main > * {
    /* Each page component fills the full width */
    min-height: 100%;
  }

  /* ── Loading state ── */
  .app-loading {
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    height: 100vh; gap: 16px;
    color: rgba(248,250,252,.35);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px; letter-spacing: .08em;
  }
  .app-spinner {
    width: 32px; height: 32px;
    border: 2.5px solid rgba(255,255,255,.07);
    border-top-color: #6366F1;
    border-radius: 50%;
    animation: spin .9s linear infinite;
  }
  .app-spinner-label { color: rgba(248,250,252,.30); }

  /* ── Error banner ── */
  .app-error {
    margin: 20px 24px;
    padding: 14px 18px;
    background: rgba(244,63,94,.10);
    border: 1px solid rgba(244,63,94,.28);
    border-radius: 12px;
    font-size: 13px; color: #FDA4AF;
    line-height: 1.6;
    animation: fade-in .4s ease;
  }
  .app-error code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    background: rgba(244,63,94,.12);
    padding: 1px 6px; border-radius: 4px;
  }

  /* ── Page transition ── */
  .page-wrap { animation: fade-in .35s ease both; width: 100%; }

  /* ── Scrollbar ── */
  .app-main::-webkit-scrollbar { width: 5px; }
  .app-main::-webkit-scrollbar-track { background: transparent; }
  .app-main::-webkit-scrollbar-thumb { background: rgba(255,255,255,.10); border-radius: 3px; }

  /* ── Responsive: collapse sidebar on narrow screens ── */
  @media (max-width: 768px) {
    .app-sidebar { width: 64px; }
    .sb-brand-name, .sb-brand-sub,
    .sb-live-text, .sb-live-time,
    .sb-nav-label, .sb-nav-item span:not(.sb-nav-icon),
    .sb-location, .sb-updated,
    .sb-nav-badge { display: none; }
    .sb-brand { justify-content: center; padding: 16px 10px; }
    .sb-live  { justify-content: center; margin: 10px 8px; }
    .sb-nav   { padding: 0 6px; }
    .sb-nav-item { justify-content: center; padding: 10px; }
    .sb-refresh { font-size: 0; padding: 10px; }
    .sb-refresh::before { content: '↺'; font-size: 14px; }
  }
`;

function injectCSS() {
  if (document.getElementById("app-shell-css")) return;
  const s = document.createElement("style");
  s.id = "app-shell-css";
  s.textContent = CSS;
  document.head.appendChild(s);
}

/* ── Live clock ─────────────────────────────────────────────────── */
function LiveClock() {
  const [t, setT] = useState(() =>
    new Date().toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit" })
  );
  useEffect(() => {
    const id = setInterval(() =>
      setT(new Date().toLocaleTimeString("en-IN", { hour12: false, hour: "2-digit", minute: "2-digit" }))
    , 1000);
    return () => clearInterval(id);
  }, []);
  return <span className="sb-live-time">{t}</span>;
}

/* ── Nav items config ────────────────────────────────────────────── */
const NAV = [
  { id: "dashboard", icon: "◈", label: "Overview"      },
  { id: "forecast",  icon: "☀", label: "24h Forecast"  },
  { id: "actions",   icon: "⚡", label: "Load Balancing"},
  { id: "history",   icon: "📊", label: "History"       },
];

/* ═══════════════════════════════════════════════════════════════════
   APP ROOT
   ═══════════════════════════════════════════════════════════════════ */
export default function App() {
  useEffect(() => { injectCSS(); }, []);

  const [tab,         setTab]         = useState("dashboard");
  const [data,        setData]        = useState(null);
  const [history,     setHistory]     = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error,       setError]       = useState(null);

  const location = { lat: 12.97, lon: 77.59, name: "Bengaluru" };

  const fetchAll = useCallback(async () => {
    try {
      setError(null);
      const [currentRes, historyRes] = await Promise.all([
        fetch(`${API_BASE}/current?lat=${location.lat}&lon=${location.lon}`),
        fetch(`${API_BASE}/history`),
      ]);
      if (!currentRes.ok) throw new Error("Backend unreachable. Is the server running?");
      const [currentData, historyData] = await Promise.all([
        currentRes.json(),
        historyRes.json(),
      ]);
      setData(currentData);
      setHistory(historyData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const id = setInterval(fetchAll, REFRESH_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAll]);

  /* Count critical/high actions for badge */
  const urgentCount = data?.actions?.filter(
    a => a.priority === "critical" || a.priority === "high"
  ).length ?? 0;

  const updatedStr = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    : null;

  return (
    <>
      {/* Fixed aurora background */}
      <div className="app-aurora">
        <div className="app-aurora-1" />
        <div className="app-aurora-2" />
        <div className="app-aurora-3" />
      </div>

      <div className="app-shell">

        {/* ══ SIDEBAR ══════════════════════════════════════════════ */}
        <aside className="app-sidebar">

          {/* Brand */}
          <div className="sb-brand">
            <div className="sb-brand-icon">⚡</div>
            <div>
              <div className="sb-brand-name">Grid Energy<br />Intelligence</div>
              <div className="sb-brand-sub">KPTCL SLDC</div>
            </div>
          </div>

          {/* Live badge */}
          <div className="sb-live">
            <div className="sb-live-dot" />
            <span className="sb-live-text">LIVE</span>
            <LiveClock />
          </div>

          {/* Nav */}
          <div className="sb-nav-label">Navigation</div>
          <nav className="sb-nav">
            {NAV.map(n => (
              <div
                key={n.id}
                className={`sb-nav-item ${tab === n.id ? "active" : ""}`}
                onClick={() => setTab(n.id)}
              >
                <span className="sb-nav-icon">{n.icon}</span>
                <span>{n.label}</span>
                {n.id === "actions" && urgentCount > 0 && (
                  <span className="sb-nav-badge">{urgentCount}</span>
                )}
              </div>
            ))}
          </nav>

          <div className="sb-divider" />

          {/* Location */}
          <div className="sb-location">
            <div className="sb-loc-label">📍 Location</div>
            <div className="sb-loc-name">{location.name}</div>
            <div className="sb-loc-coords">{location.lat}°N · {location.lon}°E</div>
          </div>

          {/* Footer */}
          <div className="sb-footer">
            {updatedStr && (
              <div className="sb-updated">Updated {updatedStr}</div>
            )}
            <button className="sb-refresh" onClick={fetchAll}>
              ↺ &nbsp;Refresh
            </button>
          </div>

        </aside>

        {/* ══ MAIN CONTENT ════════════════════════════════════════ */}
        <main className="app-main">

          {error && (
            <div className="app-error">
              <strong>Connection error:</strong> {error}<br />
              <small>Make sure the backend is running: <code>cd backend && python main.py</code></small>
            </div>
          )}

          {loading ? (
            <div className="app-loading">
              <div className="app-spinner" />
              <span className="app-spinner-label">Connecting to grid…</span>
            </div>
          ) : (
            <div className="page-wrap" key={tab}>
              {tab === "dashboard" && <Dashboard data={data} />}
              {tab === "forecast"  && <Forecast />}
              {tab === "actions"   && <Actions data={data} />}
              {tab === "history"   && <History data={history} />}
            </div>
          )}

        </main>
      </div>
    </>
  );
}