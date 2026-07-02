"""
Karnataka Day-Ahead Wind Generation Forecast
=============================================
Fetches 24-hour wind speed forecasts at 100 m hub height from Open-Meteo
for 10 wind clusters across Karnataka, applies IEC 61400 power curve mechanics,
and outputs a full MW generation matrix + summary table.

Wind clusters sourced from KREDL / MNRE commissioned capacity data.
Total fleet capacity: ~8,133 MW
"""

import requests
import json
import math
from datetime import datetime, timedelta, timezone
import pandas as pd

# ── 1. WIND CLUSTER DEFINITIONS ───────────────────────────────────────────
WIND_CLUSTERS = [
    # ── Major hubs
    {"name": "Vijayapura (Plains)",     "lat": 16.8270, "lon": 75.7175, "capacity_mw": 2694, "tier": "Major"},
    {"name": "Chitradurga (Ridges)",    "lat": 14.3200, "lon": 76.6200, "capacity_mw": 1884, "tier": "Major"},
    {"name": "Ballari (Industrial)",    "lat": 14.8825, "lon": 76.3213, "capacity_mw": 1447, "tier": "Major"},
    {"name": "Belagavi (Hills)",        "lat": 16.4348, "lon": 74.6740, "capacity_mw": 1114, "tier": "Major"},
    {"name": "Gadag (Mountain Range)",  "lat": 15.2046, "lon": 75.8846, "capacity_mw":  594, "tier": "Major"},
    # ── Minor hubs
    {"name": "Bagalkote",               "lat": 16.1812, "lon": 75.6999, "capacity_mw":  150, "tier": "Minor"},
    {"name": "Davangere",               "lat": 14.4644, "lon": 75.9218, "capacity_mw":  110, "tier": "Minor"},
    {"name": "Chikkamagaluru",          "lat": 13.3161, "lon": 75.7720, "capacity_mw":   80, "tier": "Minor"},
    {"name": "Koppal",                  "lat": 15.3503, "lon": 76.1556, "capacity_mw":   40, "tier": "Minor"},
    {"name": "Raichur",                 "lat": 16.2076, "lon": 77.3414, "capacity_mw":   20, "tier": "Minor"},
]
TOTAL_FLEET_MW = sum(c["capacity_mw"] for c in WIND_CLUSTERS)

# ── 2. IEC 61400 WIND POWER CURVE ─────────────────────────────────────────
V_CUTIN  =  3.0   # m/s — below this, no generation
V_RATED  = 12.0   # m/s — above this, full nameplate power
V_CUTOUT = 25.0   # m/s — above this, safety shutdown

def wind_cf(v: float) -> float:
    """
    IEC 61400 cubic power curve.
    Returns capacity factor CF ∈ [0, 1].

    CF = 0                                    if v < v_cutin or v >= v_cutout
    CF = (v³ - v_cutin³) / (v_rated³ - v_cutin³)   if v_cutin ≤ v < v_rated
    CF = 1.0                                  if v_rated ≤ v < v_cutout
    """
    if v < V_CUTIN or v >= V_CUTOUT:
        return 0.0
    if v >= V_RATED:
        return 1.0
    return (v**3 - V_CUTIN**3) / (V_RATED**3 - V_CUTIN**3)

def hub_mw(capacity_mw: float, v: float) -> float:
    """MW output = installed capacity × capacity factor."""
    return round(capacity_mw * wind_cf(v), 2)


# ── 3. FETCH WIND SPEED FORECASTS FROM OPEN-METEO ─────────────────────────
BASE_URL = "https://api.open-meteo.com/v1/forecast"

def fetch_wind_forecast(cluster: dict) -> dict:
    """
    Fetch 24-hour hourly wind speed at 100 m for one cluster.
    Returns {time: [...], wind_speed_100m: [...]}
    """
    params = {
        "latitude":        cluster["lat"],
        "longitude":       cluster["lon"],
        "hourly":          "wind_speed_100m",
        "wind_speed_unit": "ms",        # metres per second
        "timezone":        "Asia/Kolkata",
        "forecast_days":   2,           # today + tomorrow (48h)
    }
    try:
        r = requests.get(BASE_URL, params=params, timeout=15)
        r.raise_for_status()
        hourly = r.json().get("hourly", {})
        return {
            "time":            hourly.get("time", []),
            "wind_speed_100m": hourly.get("wind_speed_100m", []),
        }
    except Exception as e:
        print(f"  WARNING: fetch failed for {cluster['name']}: {e}")
        return {"time": [], "wind_speed_100m": []}

print("=" * 70)
print("  KARNATAKA DAY-AHEAD WIND GENERATION FORECAST")
print(f"  Run time : {datetime.now().strftime('%d %b %Y  %H:%M IST')}")
print(f"  Fleet    : {len(WIND_CLUSTERS)} clusters · {TOTAL_FLEET_MW:,} MW total installed")
print(f"  Source   : Open-Meteo API — wind_speed_100m, 1-hour resolution")
print(f"  Model    : IEC 61400 cubic power curve")
print(f"             Cut-in {V_CUTIN} m/s · Rated {V_RATED} m/s · Cut-out {V_CUTOUT} m/s")
print("=" * 70)

# Fetch all clusters
print("\nFetching wind forecasts ...")
cluster_data = []
for c in WIND_CLUSTERS:
    print(f"  → {c['name']} ({c['capacity_mw']} MW) ...", end=" ", flush=True)
    forecast = fetch_wind_forecast(c)
    cluster_data.append({**c, "forecast": forecast})
    n = len(forecast["time"])
    print(f"got {n} hours")

# ── 4. BUILD HOURLY GENERATION MATRIX ─────────────────────────────────────
# Use timestamps from the first cluster as the master time axis
master_times = cluster_data[0]["forecast"]["time"]

# Filter to day-ahead window: next 24 hours from current time
now_ist  = datetime.now(timezone(timedelta(hours=5, minutes=30)))
t_start  = now_ist.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
t_end    = t_start + timedelta(hours=24)

rows = []
for t_str in master_times:
    try:
        t = datetime.fromisoformat(t_str).replace(tzinfo=timezone(timedelta(hours=5, minutes=30)))
    except Exception:
        continue
    if not (t_start <= t < t_end):
        continue

    row = {
        "Hour": t.strftime("%d-%b %H:%M"),
        "IST":  t,
    }
    total_mw = 0.0

    for cd in cluster_data:
        times   = cd["forecast"]["time"]
        speeds  = cd["forecast"]["wind_speed_100m"]
        # Find matching index
        idx = next((i for i, ts in enumerate(times) if ts == t_str), None)
        v   = float(speeds[idx]) if idx is not None and idx < len(speeds) and speeds[idx] is not None else 0.0
        mw  = hub_mw(cd["capacity_mw"], v)
        cf  = round(wind_cf(v) * 100, 1)
        row[f"{cd['name']} v(m/s)"] = round(v, 1)
        row[f"{cd['name']} CF%"]    = cf
        row[f"{cd['name']} MW"]     = mw
        total_mw += mw

    row["Total MW"]    = round(total_mw, 1)
    row["Fleet CF%"]   = round(total_mw / TOTAL_FLEET_MW * 100, 1)
    rows.append(row)

if not rows:
    print("\n  ERROR: No data for the day-ahead window. Check API response.")
    exit(1)

df_full = pd.DataFrame(rows)


# ── 5. COMPACT SUMMARY TABLE (wind speed + MW per cluster per hour) ────────
print(f"\n\n{'─'*70}")
print("  A. HOURLY WIND SPEED (m/s) AT 100 m HUB HEIGHT — 10 CLUSTERS")
print(f"{'─'*70}")

speed_cols = ["Hour"] + [f"{cd['name']}" for cd in cluster_data]
speed_rows = []
for r in rows:
    sr = {"Hour": r["Hour"]}
    for cd in cluster_data:
        sr[cd["name"]] = r[f"{cd['name']} v(m/s)"]
    speed_rows.append(sr)

df_speed = pd.DataFrame(speed_rows).set_index("Hour")
# Shorten column names for display
df_speed.columns = [c.split(" (")[0][:12] for c in df_speed.columns]
print(df_speed.to_string())


print(f"\n\n{'─'*70}")
print("  B. HOURLY MW GENERATION PER CLUSTER")
print(f"{'─'*70}")

mw_rows = []
for r in rows:
    mr = {"Hour": r["Hour"]}
    for cd in cluster_data:
        mr[cd["name"]] = r[f"{cd['name']} MW"]
    mr["TOTAL"] = r["Total MW"]
    mr["CF%"]   = r["Fleet CF%"]
    mw_rows.append(mr)

df_mw = pd.DataFrame(mw_rows).set_index("Hour")
df_mw.columns = [c.split(" (")[0][:12] for c in df_mw.columns[:-2]] + ["TOTAL", "CF%"]
print(df_mw.to_string())


# ── 6. DAILY SUMMARY STATISTICS ───────────────────────────────────────────
print(f"\n\n{'─'*70}")
print("  C. 24-HOUR AGGREGATED SUMMARY PER CLUSTER")
print(f"{'─'*70}")

summary_rows = []
for cd in cluster_data:
    mw_vals  = [r[f"{cd['name']} MW"]  for r in rows]
    spd_vals = [r[f"{cd['name']} v(m/s)"] for r in rows]
    cf_vals  = [r[f"{cd['name']} CF%"] for r in rows]
    avg_mw   = round(sum(mw_vals)  / len(mw_vals),  1)
    peak_mw  = round(max(mw_vals), 1)
    avg_spd  = round(sum(spd_vals) / len(spd_vals), 1)
    peak_spd = round(max(spd_vals), 1)
    avg_cf   = round(sum(cf_vals)  / len(cf_vals),  1)
    energy   = round(sum(mw_vals), 1)   # MWh over 24 h (1 reading per hour)
    summary_rows.append({
        "Cluster":       cd["name"],
        "Tier":          cd["tier"],
        "Installed MW":  cd["capacity_mw"],
        "Avg Wind m/s":  avg_spd,
        "Peak Wind m/s": peak_spd,
        "Avg CF %":      avg_cf,
        "Avg Gen MW":    avg_mw,
        "Peak Gen MW":   peak_mw,
        "Energy MWh":    energy,
    })

df_summary = pd.DataFrame(summary_rows)

# Totals row
totals = {
    "Cluster":       "── KARNATAKA TOTAL",
    "Tier":          "",
    "Installed MW":  TOTAL_FLEET_MW,
    "Avg Wind m/s":  "",
    "Peak Wind m/s": "",
    "Avg CF %":      round(sum(r["Avg CF %"]  * r["Installed MW"] for r in summary_rows) / TOTAL_FLEET_MW, 1),
    "Avg Gen MW":    round(sum(r["Avg Gen MW"] for r in summary_rows), 1),
    "Peak Gen MW":   round(sum(r["Peak Gen MW"] for r in summary_rows), 1),
    "Energy MWh":    round(sum(r["Energy MWh"] for r in summary_rows), 1),
}
df_total = pd.concat([df_summary, pd.DataFrame([totals])], ignore_index=True)
print(df_total.to_string(index=False))


# ── 7. HOUR-BY-HOUR KARNATAKA TOTAL ───────────────────────────────────────
print(f"\n\n{'─'*70}")
print("  D. HOUR-BY-HOUR KARNATAKA STATE WIND GENERATION (MW)")
print(f"{'─'*70}")

total_rows = []
for r in rows:
    total_rows.append({
        "Hour":          r["Hour"],
        "Total MW":      r["Total MW"],
        "Fleet CF %":    r["Fleet CF%"],
        "vs Installed":  f"{r['Fleet CF%']}%",
        "Bar":           "█" * int(r["Fleet CF%"] / 2.5),
    })

df_total_hr = pd.DataFrame(total_rows)
print(df_total_hr.to_string(index=False))


# ── 8. KEY METRICS ─────────────────────────────────────────────────────────
all_totals = [r["Total MW"] for r in rows]
avg_total  = round(sum(all_totals) / len(all_totals), 1)
peak_total = round(max(all_totals), 1)
min_total  = round(min(all_totals), 1)
total_mwh  = round(sum(all_totals), 1)
fleet_cf   = round(avg_total / TOTAL_FLEET_MW * 100, 1)

peak_hour_row = rows[all_totals.index(peak_total)]
min_hour_row  = rows[all_totals.index(min_total)]

print(f"\n\n{'═'*70}")
print("  E. KEY FORECAST METRICS — KARNATAKA WIND (DAY-AHEAD)")
print(f"{'═'*70}")
print(f"  Forecast window      : {rows[0]['Hour']}  →  {rows[-1]['Hour']}  (IST)")
print(f"  Installed capacity   : {TOTAL_FLEET_MW:,} MW  ({len(WIND_CLUSTERS)} clusters)")
print(f"  Avg generation       : {avg_total:,} MW")
print(f"  Peak generation      : {peak_total:,} MW  at {peak_hour_row['Hour']}")
print(f"  Min  generation      : {min_total:,} MW  at {min_hour_row['Hour']}")
print(f"  Fleet capacity factor: {fleet_cf}%")
print(f"  Total energy (24 h)  : {total_mwh:,} MWh")
print(f"  Daily load factor    : {fleet_cf}%")
print(f"{'═'*70}\n")

print("  Top 3 generating clusters (by avg output):")
top3 = sorted(summary_rows, key=lambda x: x["Avg Gen MW"], reverse=True)[:3]
for i, r in enumerate(top3, 1):
    print(f"    {i}. {r['Cluster']:<30}  {r['Avg Gen MW']:>7} MW avg  (CF {r['Avg CF %']}%)")

print(f"\n  Power curve model applied:")
print(f"    Cut-in  {V_CUTIN} m/s  — turbines start spinning")
print(f"    Rated   {V_RATED} m/s  — full nameplate power")
print(f"    Cut-out {V_CUTOUT} m/s — safety shutdown")
print(f"    Formula: CF = (v³ − v_cutin³) / (v_rated³ − v_cutin³)  for v_cutin ≤ v < v_rated")
print(f"\n  Data source: Open-Meteo hourly forecast, wind_speed_100m")
print(f"  No API key required · free tier used\n")

# Save to CSV
out_path = "/mnt/user-data/outputs/karnataka_wind_forecast.csv"
df_mw_out = pd.DataFrame(mw_rows)
df_mw_out.to_csv(out_path, index=False)
print(f"  ✓ Full matrix saved to: {out_path}")
print(f"  ✓ Rows: {len(df_mw_out)}  (one per forecast hour)")
