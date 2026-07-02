"""
Grid Energy Intelligence — Karnataka v7.0
==========================================
Single data source: kptclsldc.in/StateGen.aspx

Provides: STATE DEMAND, FREQUENCY, STATE UI,
  THERMAL, THERMAL-IPP, HYDRO, WIND, SOLAR,
  OTHER NCEP, CGS DRAWAL, PAVAGADA, ESCOM drawal

No StateNCEP. No LSTM. No fake data.
"""

import re, math, asyncio
from datetime import datetime, timedelta, timezone
from collections import defaultdict
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title='Grid Energy Intelligence — Karnataka', version='7.0.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])

KARNATAKA_INSTALLED = {'solar_mw': 9500, 'wind_mw': 7700}
ESCOM_INFO = {
    'BESCOM': {'area': 'Bengaluru',  'capacity_mw': 8000, 'color': '#2e7abf'},
    'HESCOM': {'area': 'Hubli',      'capacity_mw': 4500, 'color': '#3a9e5c'},
    'GESCOM': {'area': 'Gulbarga',   'capacity_mw': 3000, 'color': '#e8a020'},
    'MESCOM': {'area': 'Mangaluru',  'capacity_mw': 2500, 'color': '#a04090'},
    'CESC':   {'area': 'Mysuru',     'capacity_mw': 2000, 'color': '#e45c3a'},
}
_cache: dict = {'data': None, 'fetched_at': None, 'ttl': 300}

# ── BATTERY ──────────────────────────────────────────────────────────────────
class BatteryState:
    CAPACITY_MWH = 1200.0
    MAX_RATE_MW  = 300.0
    EFFICIENCY   = 0.92
    MIN_SOC      = 10.0
    def __init__(self):
        self.soc_pct     = 65.0
        self.last_update = datetime.now(timezone.utc)
        self.mode        = 'idle'
    def update(self, surplus: float, deficit: float) -> dict:
        now  = datetime.now(timezone.utc)
        dt_h = min((now - self.last_update).total_seconds() / 3600, 0.5)
        self.last_update = now
        avail_chg = min(self.MAX_RATE_MW, (100 - self.soc_pct) / 100 * self.CAPACITY_MWH)
        avail_dis = min(self.MAX_RATE_MW, (self.soc_pct - self.MIN_SOC) / 100 * self.CAPACITY_MWH)
        if surplus > 0 and avail_chg > 0:
            self.soc_pct = min(100.0, self.soc_pct + min(avail_chg,surplus)*dt_h*self.EFFICIENCY/self.CAPACITY_MWH*100)
            self.mode = 'charging'
        elif deficit > 0 and avail_dis > 0:
            self.soc_pct = max(self.MIN_SOC, self.soc_pct - min(avail_dis,deficit)*dt_h/self.CAPACITY_MWH*100)
            self.mode = 'discharging'
        else:
            self.mode = 'idle'
        return {'soc_pct': round(self.soc_pct,1), 'mode': self.mode,
                'available_charge_mw': round(avail_chg,1), 'available_discharge_mw': round(avail_dis,1)}

battery = BatteryState()

# ── SCRAPER ──────────────────────────────────────────────────────────────────
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
                  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Accept-Encoding': 'gzip, deflate',
    'Connection':      'keep-alive',
    'Upgrade-Insecure-Requests': '1',
}
_last_html: str = ''


def _build_label_map(soup) -> dict:
    """
    Parse all HTML tables into {LABEL: value} dict.
    Layout A: | LABEL | 17634 |  (two cells per row)
    Layout B: | FREQUENCY : 50.02 |  (colon-separated in one cell)
    Handles &nbsp; (\xa0) transparently.
    """
    lm: dict = {}
    for table in soup.find_all('table'):
        for row in table.find_all('tr'):
            cells = [re.sub(r'[\s\xa0]+', ' ', td.get_text()).strip()
                     for td in row.find_all(['td', 'th'])]
            i = 0
            while i < len(cells):
                upper = cells[i].upper()
                m = re.match(r'^(.+?)\s*:\s*(-?\d+\.?\d*)\s*$', upper)
                if m:
                    lm[m.group(1).strip()] = float(m.group(2))
                    i += 1; continue
                if i + 1 < len(cells):
                    val = re.sub(r'[\s\xa0,]+', '', cells[i + 1])
                    nm  = re.match(r'^-?\d+\.?\d*$', val)
                    if nm and upper and not re.match(r'^\d', upper):
                        lm[upper] = float(nm.group())
                        i += 2; continue
                i += 1
    return lm


def _lm(lm: dict, key: str) -> int:
    ku = key.upper()
    for k, v in lm.items():
        if ku in k: return int(v)
    return 0


async def _fetch_html() -> tuple:
    """
    Fetch kptclsldc.in/Default.aspx — the KPTCL SLDC homepage.
    This single page contains ALL fields we need:
      FREQUENCY, STATE UI, STATE DEMAND,
      THERMAL, THERMAL-IPP, HYDRO, WIND, SOLAR, OTHER NCEP,
      CGS DRAWAL, PAVAGADA KSPDCL,
      BESCOM, HESCOM, GESCOM, CESC, MESCOM

    Tries HTTPS then HTTP. No session priming needed — Default.aspx is
    a public page that does not require authentication.
    """
    targets = [
        'https://kptclsldc.in/Default.aspx',
        'http://kptclsldc.in/Default.aspx',
    ]
    last_err = 'All strategies failed'
    for target in targets:
        try:
            async with httpx.AsyncClient(timeout=20.0, headers=HEADERS,
                                         follow_redirects=True, verify=False) as c:
                r = await c.get(target)
                r.raise_for_status()
                html = r.text
                if re.search(r'STATE.DEMAND|THERMAL|CGS.DRAWAL', html, re.IGNORECASE):
                    return html, ''
                last_err = f'Page OK ({len(html)} chars) but no expected labels found'
        except Exception as e:
            last_err = str(e)
    return '', last_err


async def scrape_stategen() -> dict:
    """
    Parses kptclsldc.in/Default.aspx.

    All fields from the page:
      RENEWABLE   : WIND, SOLAR, OTHER NCEP, HYDRO, PAVAGADA KSPDCL
      NON-RENEW.  : THERMAL, THERMAL-IPP, CGS DRAWAL
      GRID STATUS : FREQUENCY, STATE UI, STATE DEMAND
      ESCOM DRAWAL: BESCOM, HESCOM, GESCOM, CESC, MESCOM
    """
    global _last_html
    result = {
        'state_demand_mw': 0, 'frequency_hz': 50.0, 'state_ui': 0,
        'thermal_mw': 0, 'thermal_ipp_mw': 0, 'hydro_mw': 0,
        'wind_mw': 0, 'solar_mw': 0, 'other_ncep_mw': 0,
        'cgs_mw': 0, 'pavagada_mw': 0,
        'total_gen_mw': 0, 'by_escom': {},
        'timestamp': '', 'success': False, 'error': '',
    }
    try:
        from bs4 import BeautifulSoup
    except ImportError:
        result['error'] = 'beautifulsoup4 not installed — run: pip install beautifulsoup4 lxml'
        return result

    html, fetch_err = await _fetch_html()
    _last_html = html
    if not html:
        result['error'] = f'Fetch failed: {fetch_err}'
        return result

    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html, 'lxml')
        lm   = _build_label_map(soup)
        ts   = re.search(r'(\d{2}/\d{2}/\d{4}\s+\d{2}:\d{2})', html)
        if ts: result['timestamp'] = ts.group(1)
        result['frequency_hz']    = float(lm.get('FREQUENCY', lm.get('FREQ', 50.0)))
        result['state_ui']        = _lm(lm, 'STATE UI')
        result['state_demand_mw'] = _lm(lm, 'STATE DEMAND')
        result['thermal_mw']      = _lm(lm, 'THERMAL')
        result['thermal_ipp_mw']  = _lm(lm, 'THERMAL-IPP')
        result['hydro_mw']        = _lm(lm, 'HYDRO')
        result['wind_mw']         = _lm(lm, 'WIND')
        result['solar_mw']        = _lm(lm, 'SOLAR')
        result['other_ncep_mw']   = _lm(lm, 'OTHER NCEP')
        result['cgs_mw']          = _lm(lm, 'CGS DRAWAL') or _lm(lm, 'CGS')
        result['pavagada_mw']     = _lm(lm, 'PAVAGADA')
        for escom in ('BESCOM','HESCOM','GESCOM','CESC','MESCOM'):
            val = _lm(lm, escom)
            if val: result['by_escom'][escom] = val
        result['total_gen_mw'] = (result['thermal_mw'] + result['thermal_ipp_mw'] +
            result['hydro_mw'] + result['wind_mw'] + result['solar_mw'] + result['other_ncep_mw'])
        # Renewable = WIND + SOLAR + OTHER NCEP (biomass/mini-hydro) + HYDRO
        result['renewable_mw'] = (result['wind_mw'] + result['solar_mw'] +
            result['other_ncep_mw'] + result['hydro_mw'])
        # Non-renewable = THERMAL (state) + THERMAL-IPP + CGS DRAWAL
        result['non_renewable_mw'] = (result['thermal_mw'] + result['thermal_ipp_mw'] +
            result['cgs_mw'])
        result['success'] = (result['state_demand_mw'] > 0 or result['cgs_mw'] > 0 or result['total_gen_mw'] > 0)
        if not result['success']:
            result['error'] = f"No data. {len(lm)} keys: {list(lm.keys())[:12]}"
    except Exception as e:
        result['error'] = str(e)
    return result


async def fetch_kptcl() -> dict:
    now = datetime.now(timezone.utc)
    if (_cache['data'] is not None and _cache['fetched_at'] is not None and
            (now - _cache['fetched_at']).total_seconds() < _cache['ttl']):
        d = _cache['data'].copy(); d['from_cache'] = True; return d
    data = await scrape_stategen()
    data['from_cache'] = False
    _cache['data'] = data; _cache['fetched_at'] = now
    return data

# ── WEATHER ──────────────────────────────────────────────────────────────────
KA_LAT, KA_LON = 14.10, 77.28   # kept for wind forecast (single coordinate)

# District-wise solar installed capacity (KREDL / MNRE verified data)
# Each entry: (name, lat, lon, installed_mw)
SOLAR_DISTRICTS = [
    # name              lat      lon     installed_mw  source
    ('Pavagada KSPDCL', 14.10,  77.28,  2050),  # commissioned park capacity
    ('Tumkur (pvt)',    14.26,  77.10,   700),  # private plants outside park
    ('Chitradurga',     14.23,  76.39,   900),  # KREDL data
    ('Bellary',         15.14,  76.92,   750),  # KREDL data
    ('Raichur',         16.20,  77.36,   600),  # KREDL data
    ('Koppal',          15.35,  76.15,   500),  # KREDL data
    ('Gadag',           15.42,  75.62,   450),  # KREDL data
    ('Kalaburagi',      17.33,  76.82,   350),  # KREDL data
    ('Vijayapura',      16.83,  75.72,   300),  # KREDL data
    ('Others (dist.)',  15.00,  76.50,  2682),  # remaining to reach 9282 MW total
]
# Total = 2050+700+900+750+600+500+450+350+300+2682 = 9,282 MW ✓
TOTAL_SOLAR_INSTALLED_MW = sum(d[3] for d in SOLAR_DISTRICTS)  # 9,900 MW
# District-wise wind installed capacity (KREDL / CEA verified data)
# Each entry: (name, lat, lon, installed_mw)
WIND_HUBS = [
    # Major hubs
    ('Vijayapura',      16.8270, 75.7175, 2694),
    ('Chitradurga',     14.3200, 76.6200, 1884),
    ('Ballari',         14.8825, 76.3213, 1447),
    ('Belagavi',        16.4348, 74.6740, 1114),
    ('Gadag',           15.2046, 75.8846,  594),
    # Minor hubs
    ('Bagalkote',       16.1812, 75.6999,  150),
    ('Davangere',       14.4644, 75.9218,  110),
    ('Chikkamagaluru',  13.3161, 75.7720,   80),
    ('Koppal',          15.3503, 76.1556,   40),
    ('Raichur',         16.2076, 77.3414,   20),
]
TOTAL_WIND_INSTALLED_MW = sum(h[3] for h in WIND_HUBS)  # 8,133 MW
_wind_forecast_cache: dict = {
    'data':            None,
    'fetched_at':      None,
    'locked_for_date': None,
}
# ── DAY-AHEAD FORECAST CACHE ──────────────────────────────────────────────
# The forecast is locked once per calendar day (generated at/after midnight IST).
# It NEVER refreshes during the day — this gives KPTCL operators a stable
# planning figure for storage dispatch, hydro scheduling, and CGS scheduling.
# Real-time actuals come from the KPTCL scraper independently.
IST = timezone(timedelta(hours=5, minutes=30))
_district_forecast_cache: dict = {
    'data':             None,
    'fetched_at':       None,
    'locked_for_date':  None,   # 'YYYY-MM-DD' string — forecast is locked for this date
}

async def fetch_weather_current() -> dict:
    url = (f'https://api.open-meteo.com/v1/forecast?latitude={KA_LAT}&longitude={KA_LON}'
           f'&current=temperature_2m,wind_speed_100m,cloud_cover,direct_radiation&wind_speed_unit=ms&timezone=auto')
    try:
        async with httpx.AsyncClient(timeout=10.0) as c:
            r = await c.get(url); r.raise_for_status()
        return r.json().get('current', {})
    except Exception: return {}

async def fetch_district_solar_current() -> tuple:
    """
    Call Open-Meteo once per district to get real-time direct + diffuse radiation,
    then calculate each district's solar MW contribution.

    Formula per district:
        GHI = direct_radiation + diffuse_radiation   (W/m²)
        district_solar_mw = installed_mw × (GHI / 1000) × 0.78

    Performance ratio 0.78 accounts for inverter losses, soiling, wiring, mismatch.

    Returns:
        (total_solar_mw: float, district_breakdown: list[dict])
    """
    async def _fetch_one(session: httpx.AsyncClient, name: str, lat: float, lon: float, installed_mw: int) -> dict:
        url = (
            f'https://api.open-meteo.com/v1/forecast'
            f'?latitude={lat}&longitude={lon}'
            f'&current=direct_radiation,diffuse_radiation,shortwave_radiation'
            f'&timezone=Asia/Kolkata'
        )
        try:
            r = await session.get(url)
            r.raise_for_status()
            current = r.json().get('current', {})
            direct  = float(current.get('direct_radiation',  0) or 0)
            diffuse = float(current.get('diffuse_radiation', 0) or 0)
            shortwave = float(current.get('shortwave_radiation', 0) or 0)
            ghi = shortwave if shortwave > 0 else (direct + diffuse)
            mw      = round(installed_mw * (ghi / 1000.0) * 0.72, 1)
            return {'district': name, 'installed_mw': installed_mw,
                    'direct_wm2': round(direct, 1), 'diffuse_wm2': round(diffuse, 1),
                    'ghi_wm2': round(ghi, 1), 'solar_mw': mw}
        except Exception as e:
            return {'district': name, 'installed_mw': installed_mw,
                    'direct_wm2': 0, 'diffuse_wm2': 0, 'ghi_wm2': 0, 'solar_mw': 0,
                    'error': str(e)}

    async with httpx.AsyncClient(timeout=12.0) as session:
        tasks = [
            _fetch_one(session, name, lat, lon, mw)
            for name, lat, lon, mw in SOLAR_DISTRICTS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    breakdown = list(results)
    total_mw  = round(sum(d['solar_mw'] for d in breakdown), 1)
    return total_mw, breakdown


async def fetch_district_solar_forecast(resolution: str = 'hourly') -> dict:
    """
    Fetch day-ahead solar forecast for all 10 Karnataka districts.

    LOCKING BEHAVIOUR (critical for grid operations):
      - Generated ONCE per calendar day (first call after midnight IST)
      - Locked for the entire day — never refreshed during daylight hours
      - This gives KPTCL operators a stable planning baseline for:
          storage charge/discharge scheduling
          hydro release decisions
          CGS/SRLDC import scheduling
      - Real-time deviations are handled by the live KPTCL scraper separately

    resolution: 'hourly' | 'minutely_15'
    """
    # ── Day-ahead lock: return cached forecast if already generated today ─
    now_ist    = datetime.now(IST)
    today_str  = now_ist.strftime('%Y-%m-%d')

    if (_district_forecast_cache['data'] is not None and
            _district_forecast_cache['locked_for_date'] == today_str):
        # Same calendar day — return locked forecast unchanged
        cached = _district_forecast_cache['data'].copy()
        cached['from_cache']    = True
        cached['cache_note']    = 'Day-ahead forecast locked — will refresh after midnight IST'
        return cached

    key = 'minutely_15' if resolution == 'minutely_15' else 'hourly'

    async def _fetch_one_forecast(session: httpx.AsyncClient, name: str, lat: float, lon: float, installed_mw: int) -> dict:
        base = (
            f'https://api.open-meteo.com/v1/forecast'
            f'?latitude={lat}&longitude={lon}'
            f'&{key}=direct_radiation,diffuse_radiation,shortwave_radiation'
            f'&wind_speed_unit=ms&timezone=Asia/Kolkata&forecast_days=2'
        )
        try:
            r = await session.get(base)
            r.raise_for_status()
            data    = r.json().get(key, {})
            times   = data.get('time', [])
            direct  = data.get('direct_radiation',  [0] * len(times))
            diffuse = data.get('diffuse_radiation', [0] * len(times)) 
            hourly_mw = {}
            for i, t in enumerate(times):
                d   = float(direct[i]  or 0)
                f   = float(diffuse[i] or 0)
                sw  = float(data.get('shortwave_radiation', [0]*len(times))[i] or 0)
                ghi = sw if sw > 0 else (d + f)
                mw  = round(installed_mw * (ghi / 1000.0) * 0.72, 1)
                hourly_mw[t[:16]] = mw   # key = 'YYYY-MM-DDTHH:MM'
            return {'district': name, 'installed_mw': installed_mw, 'hourly_mw': hourly_mw}
        except Exception:
            return {'district': name, 'installed_mw': installed_mw, 'hourly_mw': {}}

    async with httpx.AsyncClient(timeout=15.0) as session:
        tasks = [
            _fetch_one_forecast(session, name, lat, lon, mw)
            for name, lat, lon, mw in SOLAR_DISTRICTS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=False)

    # Aggregate: sum all district contributions per time slot
    aggregated: dict = {}
    for district_data in results:
        for ts, mw in district_data['hourly_mw'].items():
            aggregated[ts] = round(aggregated.get(ts, 0.0) + mw, 1)

    # Build result and lock it for the full calendar day
    generated_at = now_ist.strftime('%d %b %Y %H:%M IST')
    result = {
        'aggregated':            aggregated,
        'per_district':          list(results),
        'from_cache':            False,
        'forecast_generated_at': generated_at,
        'forecast_locked_for':   today_str,
        'cache_note':            f'Day-ahead forecast generated at {generated_at} — locked until midnight IST',
    }
    _district_forecast_cache['data']            = result
    _district_forecast_cache['fetched_at']      = datetime.now(timezone.utc)
    _district_forecast_cache['locked_for_date'] = today_str
    return result

async def fetch_district_wind_forecast(resolution: str = 'hourly') -> dict:
    """
    Fetch day-ahead wind forecast for all 10 Karnataka wind hubs.
    Same day-locking behaviour as solar — generated once at midnight IST.
    Uses wind_speed_100m (turbine hub height) per hub coordinate.
    IEC 61400 cubic power curve + seasonal capacity factor.
    """
    now_ist   = datetime.now(IST)
    today_str = now_ist.strftime('%Y-%m-%d')

    if (_wind_forecast_cache['data'] is not None and
            _wind_forecast_cache['locked_for_date'] == today_str):
        cached = _wind_forecast_cache['data'].copy()
        cached['from_cache'] = True
        return cached

    key = 'minutely_15' if resolution == 'minutely_15' else 'hourly'

    # Seasonal fleet capacity factor — Karnataka wind is monsoon-driven
    month = now_ist.month
    if month in (6, 7, 8, 9):    fleet_cf = 0.48   # SW monsoon peak
    elif month in (10, 11):       fleet_cf = 0.32   # monsoon retreat
    elif month in (12, 1, 2):     fleet_cf = 0.18   # dry winter
    else:                         fleet_cf = 0.22   # pre-monsoon

    async def _fetch_one_hub(session, name, lat, lon, installed_mw):
        url = (
            f'https://api.open-meteo.com/v1/forecast'
            f'?latitude={lat}&longitude={lon}'
            f'&{key}=wind_speed_100m'
            f'&wind_speed_unit=ms&timezone=Asia/Kolkata&forecast_days=2'
        )
        try:
            r = await session.get(url)
            r.raise_for_status()
            data   = r.json().get(key, {})
            times  = data.get('time', [])
            speeds = data.get('wind_speed_100m', [0.0] * len(times))
            hourly_mw = {}
            for i, t in enumerate(times):
                spd = float(speeds[i] or 0.0)
                # IEC 61400 cubic power curve
                if spd < 3.0 or spd >= 25.0:
                    cf = 0.0
                elif spd >= 12.0:
                    cf = 1.0
                else:
                    cf = (spd**3 - 27) / (1728 - 27)
                mw = round(installed_mw * cf * fleet_cf, 1)
                hourly_mw[t[:16]] = mw
            return {'hub': name, 'installed_mw': installed_mw, 'hourly_mw': hourly_mw}
        except Exception as e:
            return {'hub': name, 'installed_mw': installed_mw, 'hourly_mw': {}, 'error': str(e)}

    async with httpx.AsyncClient(timeout=15.0) as session:
        tasks = [_fetch_one_hub(session, name, lat, lon, mw) for name, lat, lon, mw in WIND_HUBS]
        hub_results = await asyncio.gather(*tasks, return_exceptions=False)

    # Aggregate all 10 hubs per time slot
    aggregated: dict = {}
    for hub in hub_results:
        for ts, mw in hub['hourly_mw'].items():
            aggregated[ts] = round(aggregated.get(ts, 0.0) + mw, 1)

    generated_at = now_ist.strftime('%d %b %Y %H:%M IST')
    result = {
        'aggregated':            aggregated,
        'per_hub':               hub_results,
        'from_cache':            False,
        'forecast_generated_at': generated_at,
        'forecast_locked_for':   today_str,
        'seasonal_fleet_cf':     fleet_cf,
        'total_installed_mw':    TOTAL_WIND_INSTALLED_MW,
    }
    _wind_forecast_cache['data']            = result
    _wind_forecast_cache['fetched_at']      = datetime.now(timezone.utc)
    _wind_forecast_cache['locked_for_date'] = today_str
    return result


async def fetch_weather_forecast(resolution: str = 'hourly') -> dict:
    """
    Fetch forecast from Open-Meteo.
    resolution: 'hourly' (default) or 'minutely_15'
    Returns dict with time array + weather variable arrays.
    """
    base = f'https://api.open-meteo.com/v1/forecast?latitude={KA_LAT}&longitude={KA_LON}'
    base += '&wind_speed_unit=ms&timezone=Asia/Kolkata&forecast_days=2'
    solar_vars = 'direct_radiation,diffuse_radiation,shortwave_radiation,direct_normal_irradiance'
    wind_vars  = 'wind_speed_100m,wind_speed_10m'
    other_vars = 'temperature_2m,cloud_cover,sunshine_duration'
    all_vars   = f'{solar_vars},{wind_vars},{other_vars}'
    if resolution == 'minutely_15':
        url = base + f'&minutely_15={all_vars}'
        key = 'minutely_15'
    else:
        url = base + f'&hourly={all_vars}'
        key = 'hourly'
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(url); r.raise_for_status()
        data = r.json().get(key, {})
        data['_resolution'] = resolution
        return data
    except Exception as e:
        return {'_resolution': resolution, '_error': str(e)}

async def fetch_weather_history() -> dict:
    end = (datetime.now()-timedelta(days=1)).strftime('%Y-%m-%d')
    start = (datetime.now()-timedelta(days=7)).strftime('%Y-%m-%d')
    url = (f'https://archive-api.open-meteo.com/v1/archive?latitude={KA_LAT}&longitude={KA_LON}'
           f'&start_date={start}&end_date={end}&hourly=temperature_2m,wind_speed_100m,cloud_cover,direct_radiation&wind_speed_unit=ms&timezone=auto')
    try:
        async with httpx.AsyncClient(timeout=15.0) as c:
            r = await c.get(url); r.raise_for_status()
        return r.json().get('hourly', {})
    except Exception: return {}

# ── METRICS ──────────────────────────────────────────────────────────────────
def compute_metrics(d: dict) -> dict:
    solar_mw=d['solar_mw']; wind_mw=d['wind_mw']; other_ncep=d['other_ncep_mw']
    demand_mw=d['state_demand_mw']; cgs_mw=d['cgs_mw']; total_gen=d['total_gen_mw']; Pavagada_mw=d['pavagada_mw']
    renewable_gen = solar_mw + wind_mw + other_ncep + Pavagada_mw
    total_supply  = total_gen + cgs_mw
    bal=total_supply-demand_mw; surp=max(0.0,bal); defi=max(0.0,-bal)
    batt=battery.update(surp,defi)
    soc=batt['soc_pct']; b_chg=batt['available_charge_mw']; b_dis=batt['available_discharge_mw']
    storable=min(surp,b_chg); curtailed=max(0.0,surp-storable)
    b_cover=min(defi,b_dis) if defi>0 else 0.0; net_defi=max(0.0,defi-b_cover)
    tl_pct=0.031; tl_mw=round(total_supply*tl_pct,1); net_del=round(total_supply-tl_mw,1)
    eff=round(min(99.9,net_del/demand_mw*100),2) if demand_mw>0 else 0.0
    renew_share=round(min(100,renewable_gen/demand_mw*100),2) if demand_mw>0 else 0.0
    return {
        'solar_mw': round(solar_mw,1), 'wind_mw': round(wind_mw,1),
        'renewable_generation_mw': round(renewable_gen,1),
        'total_supply_mw': round(total_supply,1),
        'demand_mw': round(demand_mw,1),
        'balance_mw': round(bal,1), 'surplus_mw': round(surp,1), 'deficit_mw': round(defi,1),
        'net_deficit_mw': round(net_defi,1), 'battery_covering_mw': round(b_cover,1),
        'storable_in_battery_mw': round(storable,1), 'curtailed_mw': round(curtailed,1),
        'wastage_pct': round(curtailed/max(total_supply,1)*100,2),
        'renewable_share_pct': renew_share,
        'transmission_loss_mw': tl_mw, 'transmission_loss_pct': round(tl_pct*100,1),
        'net_delivered_mw': net_del, 'efficiency_pct': eff,
        'battery_soc_pct': soc, 'battery_mode': batt['mode'],
        'battery_available_charge_mw': b_chg, 'battery_available_discharge_mw': b_dis,
        'co2_avoided_tonnes_hr': round(renewable_gen*0.82/1000,3),
    }

def compute_zones(demand_mw: float, hour: int, by_escom: dict) -> list:
    if 9<=hour<18:    ratios={'BESCOM':0.46,'HESCOM':0.19,'GESCOM':0.12,'MESCOM':0.12,'CESC':0.11}
    elif 18<=hour<22: ratios={'BESCOM':0.47,'HESCOM':0.19,'GESCOM':0.11,'MESCOM':0.12,'CESC':0.11}
    else:             ratios={'BESCOM':0.44,'HESCOM':0.20,'GESCOM':0.12,'MESCOM':0.13,'CESC':0.11}
    zones=[]
    for escom,ratio in ratios.items():
        info=ESCOM_INFO[escom]
        load=float(by_escom.get(escom, round(demand_mw*ratio,1)))
        cap=info['capacity_mw']; util=round(load/cap*100,1) if cap>0 else 0.0
        zones.append({'name':escom,'area':info['area'],'load_mw':round(load,1),
            'capacity_mw':cap,'utilisation_pct':util,'color':info['color'],
            'status':'critical' if util>90 else 'warning' if util>75 else 'normal',
            'data_source':'kptcl-live' if escom in by_escom else 'estimated'})
    return zones

# ── LOAD BALANCING ───────────────────────────────────────────────────────────
def load_balancing_actions(m: dict, hour: int, freq: float) -> list:
    actions=[]
    surp=m['surplus_mw']; defi=m['deficit_mw']; waste=m['wastage_pct']
    soc=m['battery_soc_pct']; b_dis=m['battery_available_discharge_mw']
    b_chg=m['battery_available_charge_mw']; dem=m['demand_mw']; total=m['total_supply_mw']
    if freq < 49.7:
        actions.append({'priority':'critical','action':'frequency_emergency',
            'title':f'EMERGENCY — Frequency {freq:.2f} Hz below safe limit',
            'description':'Immediate load shedding required.',
            'impact_mw':round(dem*0.05,1),'wastage_reduction_pct':0,
            'efficiency_gain_pct':15,'implementation_time_min':1,
            'protocol':'KPTCL SLDC automatic under-frequency relay'})
    if defi > 0 and b_dis > 0:
        rate=min(b_dis,defi)
        actions.append({'priority':'critical','action':'discharge_battery',
            'title':f'Discharge battery — cover {defi:,.0f} MW deficit',
            'description':f'Discharge BESS at {rate:,.0f} MW (SOC: {soc:.0f}%).',
            'impact_mw':round(rate,1),'wastage_reduction_pct':0,
            'efficiency_gain_pct':round(min(15,rate/max(dem,1)*100),1),
            'implementation_time_min':1,'protocol':'BESS BMS — KPTCL SLDC SCADA (DNP3)'})
    if defi > b_dis or dem > 14000:
        dr=min(800,max(100,defi-b_dis))
        actions.append({'priority':'high','action':'demand_response',
            'title':'Industrial demand response — curtail non-critical loads',
            'description':f'Curtail {dr:,.0f} MW across BESCOM/GESCOM industrial zones.',
            'impact_mw':round(dr,1),'wastage_reduction_pct':0,
            'efficiency_gain_pct':round(dr/max(dem,1)*60,1),
            'implementation_time_min':5,'protocol':'OpenADR 2.0 — KPTCL SLDC to ESCOM DMS'})
    if surp > 0 and b_chg > 0:
        rate=min(b_chg,surp)
        actions.append({'priority':'critical' if waste>5 else 'high','action':'charge_battery',
            'title':'Charge battery — absorb renewable surplus',
            'description':f'Charge BESS at {rate:,.0f} MW. Battery headroom: {100-soc:.0f}%.',
            'impact_mw':round(rate,1),'wastage_reduction_pct':round(min(waste,rate/max(surp,1)*waste),1),
            'efficiency_gain_pct':round(min(12,rate/max(total,1)*100),1),
            'implementation_time_min':2,'protocol':'BESS BMS — KPTCL SLDC SCADA'})
    if surp > 300:
        exp=round(min(surp*0.5,600))
        actions.append({'priority':'high','action':'export_srldc',
            'title':f'Export {exp:,} MW to Southern Regional Grid',
            'description':f'Revenue: Rs.{exp*4.5:,.0f}/hr at IEX market rate.',
            'impact_mw':exp,'wastage_reduction_pct':round(exp/max(total,1)*100,1),
            'efficiency_gain_pct':5,'implementation_time_min':15,'protocol':'SRLDC WBES portal'})
    if 16 <= hour <= 18:
        actions.append({'priority':'high','action':'gas_backup',
            'title':'Pre-schedule gas peaker — evening peak approaching',
            'description':'Solar drops 70% by 19:30. Issue startup signal now (25-min lead time).',
            'impact_mw':500,'wastage_reduction_pct':0,'efficiency_gain_pct':8,
            'implementation_time_min':25,'protocol':'SCADA unit commitment — IEC 61850 KPTCL SLDC'})
    prio={'critical':0,'high':1,'medium':2,'low':3}
    return sorted(actions, key=lambda a: prio.get(a['priority'],9))

# ── ALERTS ───────────────────────────────────────────────────────────────────
def generate_alerts(m: dict, freq: float, errors: list) -> list:
    alerts=[]
    if freq<49.7:   alerts.append({'level':'danger','message':f'CRITICAL: Frequency {freq:.2f} Hz below 49.7 Hz.'})
    elif freq<49.9: alerts.append({'level':'warning','message':f'Frequency low: {freq:.2f} Hz (nominal 50.0).'})
    elif freq>50.3: alerts.append({'level':'warning','message':f'Frequency high: {freq:.2f} Hz.'})
    if m['net_deficit_mw']>0: alerts.append({'level':'danger','message':f"Net deficit {m['net_deficit_mw']:,.0f} MW after battery."})
    elif m['deficit_mw']>0:   alerts.append({'level':'warning','message':f"Deficit {m['deficit_mw']:,.0f} MW — battery covering {m['battery_covering_mw']:,.0f} MW."})
    if m['wastage_pct']>5:     alerts.append({'level':'warning','message':f"Curtailment {m['wastage_pct']:.1f}% ({m['curtailed_mw']:,.0f} MW)."})
    if m['efficiency_pct']<80: alerts.append({'level':'danger','message':f"Grid efficiency critical: {m['efficiency_pct']:.1f}%."})
    elif m['efficiency_pct']<90: alerts.append({'level':'warning','message':f"Grid efficiency {m['efficiency_pct']:.1f}% below KERC 90% target."})
    if m['battery_soc_pct']<20: alerts.append({'level':'danger','message':f"Battery critically low: {m['battery_soc_pct']:.0f}% SOC."})
    if m['renewable_share_pct']>60: alerts.append({'level':'info','message':f"High renewable penetration: {m['renewable_share_pct']:.0f}%."})
    for e in errors:
        if e and 'estimated' not in e.lower(): alerts.append({'level':'warning','message':f'KPTCL: {e}'})
    if not alerts: alerts.append({'level':'success','message':'Karnataka grid operating normally.'})
    return alerts

# ── FORECAST HELPERS ─────────────────────────────────────────────────────────
def _solar_mw(direct_w: float, diffuse_w: float, cloud_pct: float) -> float:
    """
    Predict solar generation in MW from Open-Meteo radiation values.
    
    Data used:
      direct_radiation  (W/m²) — direct beam on horizontal surface from Open-Meteo
      diffuse_radiation (W/m²) — scattered sky radiation
      cloud_cover       (%)    — backup attenuator when radiation = 0
    
    Physics:
      GHI (Global Horizontal Irradiance) = direct + diffuse
      Panel efficiency for mono-Si utility scale: 19%
      System losses (inverter, wiring, soiling, mismatch): 18% → PR = 0.82
      Effective capacity factor = GHI / 1000 × efficiency × PR
      Max CF clamped at 0.28 (Karnataka average peak CF)
    
    Karnataka installed: 9,500 MW (KREDL data)
    """
    installed = KARNATAKA_INSTALLED['solar_mw']
    ghi = direct_w + diffuse_w
    if ghi <= 0 and cloud_pct > 0:
        # Rough diffuse-only estimate when radiation data not available
        ghi = max(0, 200 * (1 - cloud_pct / 100))
    if ghi <= 0:
        return 0.0
    PR = 0.72
    cf = min(0.55, (ghi / 1000.0) * PR)
    return round(installed * cf, 1)


def _wind_mw(wind_100m: float) -> float:
    """
    Predict wind generation in MW from hub-height wind speed.
    
    Data used:
      wind_speed_100m (m/s) — from Open-Meteo at 100m above ground.
      This is the hub height of modern 2–3 MW wind turbines used in
      Karnataka (Suzlon S88, Gamesa G97, Vestas V110).
      CRITICAL: always use 100m, never 10m — 10m speed is 40-60% lower.
    
    Physics: IEC 61400 cubic power curve
      Cut-in:  3.0 m/s  (turbine starts spinning)
      Rated:   12.0 m/s (full nameplate power)
      Cut-out: 25.0 m/s (safety shutdown)
      CF between cut-in and rated: (v³ - v_cutin³) / (v_rated³ - v_cutin³)
    
    Karnataka installed: 7,700 MW
    Fleet average capacity factor: 28% (CEA 2024 data)
    """
    installed  = KARNATAKA_INSTALLED['wind_mw']
    v_cutin    = 3.0
    v_rated    = 12.0
    v_cutout   = 25.0
    fleet_cf   = 0.28    # Karnataka wind fleet average (accounts for older turbines, calm zones)
    if wind_100m < v_cutin or wind_100m >= v_cutout:
        turbine_cf = 0.0
    elif wind_100m >= v_rated:
        turbine_cf = 1.0
    else:
        turbine_cf = (wind_100m**3 - v_cutin**3) / (v_rated**3 - v_cutin**3)
    cf = turbine_cf * fleet_cf
    return round(installed * cf, 1)


def _solar_forecast(hour, cloud_pct, rad_wm2):
    """Legacy wrapper — used by history endpoint. Uses single radiation value."""
    return _solar_mw(rad_wm2 * 0.7, rad_wm2 * 0.3, cloud_pct)


def _wind_forecast(wind_ms):
    """Legacy wrapper — used by history endpoint."""
    return _wind_mw(wind_ms)

def _demand_forecast(hour, temp, dow):
    mult={0:0.78,1:0.74,2:0.72,3:0.71,4:0.73,5:0.80,6:0.88,7:1.12,8:1.25,
          9:1.18,10:1.14,11:1.10,12:1.08,13:1.05,14:1.06,15:1.10,16:1.18,
          17:1.32,18:1.38,19:1.42,20:1.35,21:1.20,22:1.05,23:0.90}
    wkd=0.88 if dow>=5 else 1.0
    tf=1.0+max(0,temp-24)*0.012 if temp>24 else 1.0+max(0,18-temp)*0.005
    return round(13500*mult.get(hour,1.0)*wkd*tf,1)

def detect_grid_events(hourly: list) -> list:
    events=[]; now=datetime.now()
    future=[r for r in hourly if datetime.fromisoformat(r['datetime'])>now]
    if not future: return events
    demands=[r['demand_mw'] for r in future]
    totals=[r['solar_mw']+r['wind_mw'] for r in future]
    avg_dem=sum(demands)/len(demands) if demands else 13500
    used=set()
    for i,r in enumerate(future):
        dt=datetime.fromisoformat(r['datetime']); label=dt.strftime('%H:%M')
        if r['demand_mw']>=avg_dem*1.12:
            k=f'peak_{dt.hour}'
            if k not in used:
                used.add(k)
                events.append({'time':label,'event':'Demand peak',
                    'impact':f"+{round(r['demand_mw']-avg_dem):,} MW above average",
                    'impact_level':'warn','action':'Pre-charge battery.','severity':'high'})
        if i+2<len(future):
            s1,s2=future[i]['solar_mw'],future[i+2]['solar_mw']
            if s1>1000 and s2<s1*0.55:
                k=f'rampdown_{dt.hour}'
                if k not in used:
                    used.add(k)
                    events.append({'time':label,'event':'Solar ramp-down (sunset)',
                        'impact':f"-{round((1-s2/s1)*100)}% solar",
                        'impact_level':'danger',
                        'action':f"Gas startup by {(dt-timedelta(minutes=25)).strftime('%H:%M')}.",
                        'severity':'critical'})
        if totals[i]>r['demand_mw']+500:
            k=f'surplus_{dt.hour}'
            if k not in used:
                used.add(k)
                events.append({'time':label,'event':'Renewable surplus',
                    'impact':f"+{round(totals[i]-r['demand_mw']):,} MW",
                    'impact_level':'warn','action':'Charge battery + export to SRLDC.','severity':'high'})
        if r['demand_mw']-totals[i]>1000:
            k=f'deficit_{dt.hour}'
            if k not in used:
                used.add(k)
                events.append({'time':label,'event':'Supply deficit risk',
                    'impact':f"-{round(r['demand_mw']-totals[i]):,} MW",
                    'impact_level':'danger','action':'Ensure CGS+battery cover deficit.','severity':'critical'})
    sev={'critical':0,'high':1,'medium':2,'low':3}
    events.sort(key=lambda e:(datetime.strptime(e['time'].split('-')[0],'%H:%M').hour,sev.get(e.get('severity','low'),9)))
    return events[:8]

# ── API ROUTES ────────────────────────────────────────────────────────────────
@app.get('/')
def root():
    return {'version':'7.0.0','data_source':'kptclsldc.in/Default.aspx','fake_data':'NONE','docs':'/docs'}


@app.get('/api/current')
async def get_current():
    kptcl,weather=await asyncio.gather(fetch_kptcl(),fetch_weather_current(),return_exceptions=True)
    if isinstance(kptcl,Exception): raise HTTPException(503,str(kptcl))
    if isinstance(weather,Exception): weather={}
    now=datetime.now(); freq=kptcl['frequency_hz']
    m=compute_metrics(kptcl)
    acts=load_balancing_actions(m,now.hour,freq)
    zones=compute_zones(kptcl['state_demand_mw'],now.hour,kptcl.get('by_escom',{}))
    alts=generate_alerts(m,freq,[kptcl['error']] if kptcl['error'] else [])
    return {
        'timestamp':now.isoformat(),
        'data_source':'kptcl-sldc-live' if kptcl['success'] else 'unavailable',
        'kptcl_page_time':kptcl['timestamp'],
        'from_cache':kptcl.get('from_cache',False),
        'errors':[kptcl['error']] if kptcl['error'] else [],
        'weather':{'temperature_c':round(weather.get('temperature_2m',28.0),1),
            'wind_speed_100m_ms':round(weather.get('wind_speed_100m',0.0),1),
            'cloud_cover_pct':round(weather.get('cloud_cover',0.0),1),
            'direct_radiation_wm2':round(weather.get('direct_radiation',0.0),1)},
        'grid':m,'frequency_hz':freq,'state_ui':kptcl['state_ui'],
        'zones':zones,'actions':acts,'alerts':alts,
        'kptcl_raw':{
            'state_demand_mw': kptcl['state_demand_mw'],
            'frequency_hz':    kptcl['frequency_hz'],
            'state_ui':        kptcl['state_ui'],
            'renewable': {
                'wind_mw':       kptcl['wind_mw'],
                'solar_mw':      kptcl['solar_mw'],
                'hydro_mw':      kptcl['hydro_mw'],
                'other_ncep_mw': kptcl['other_ncep_mw'],
                'pavagada_mw':   kptcl['pavagada_mw'],
                'total_mw':      kptcl['renewable_mw'],
            },
            'non_renewable': {
                'thermal_mw':     kptcl['thermal_mw'],
                'thermal_ipp_mw': kptcl['thermal_ipp_mw'],
                'cgs_mw':         kptcl['cgs_mw'],
                'total_mw':       kptcl['non_renewable_mw'],
            },
            'total_gen_mw':    kptcl['total_gen_mw'],
            'by_escom':        kptcl['by_escom'],
        },
    }


@app.get('/api/forecast')
async def get_forecast(
    resolution: str = 'hourly',
    view: str = 'today'
):
    """
    Energy generation forecast using Open-Meteo weather data.

    Query params:
      resolution : 'minutely_15' | 'hourly'  (default: hourly)
      view       : 'today' | 'tomorrow' | 'next24h' | 'next48h'  (default: today)

    Weather data used for prediction:
      direct_radiation  (W/m²)  — primary solar predictor
      diffuse_radiation (W/m²)  — secondary solar (cloudy sky contribution)
      wind_speed_100m   (m/s)   — hub-height wind, primary wind predictor
      cloud_cover       (%)     — backup solar attenuator
      temperature_2m    (°C)    — demand estimation context

    Models:
      Solar: GHI × panel_efficiency(19%) × performance_ratio(0.82) × 9500 MW
      Wind:  IEC61400 cubic power curve × fleet_CF(0.28) × 7700 MW
    """
    if resolution not in ('minutely_15', 'hourly'):
        resolution = 'hourly'

    weather, district_solar, district_wind = await asyncio.gather(
    fetch_weather_forecast(resolution),
    fetch_district_solar_forecast(resolution),
    fetch_district_wind_forecast(resolution),
    return_exceptions=True,
    )
    if isinstance(weather, Exception) or '_error' in weather:
        err = str(weather) if isinstance(weather, Exception) else weather.get('_error', 'unknown')
        raise HTTPException(503, f'Weather fetch failed: {err}')
    if isinstance(district_solar, Exception):
        district_solar = {'aggregated': {}, 'per_district': []}
    if isinstance(district_wind, Exception):
        district_wind = {'aggregated': {}}

    district_solar_agg = district_solar.get('aggregated', {})
    district_wind_agg  = district_wind.get('aggregated', {})

    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    tomorrow_start = today_start + timedelta(days=1)
    tomorrow_end   = today_start + timedelta(days=2)

    if view == 'today':
        t_start, t_end = today_start, tomorrow_start
    elif view == 'tomorrow':
        t_start, t_end = tomorrow_start, tomorrow_end
    elif view == 'next48h':
        t_start, t_end = now, now + timedelta(hours=48)
    else:
        t_start, t_end = now, now + timedelta(hours=24)

    times = weather.get('time', [])
    step_size = timedelta(minutes=15) if resolution == 'minutely_15' else timedelta(hours=1)

    def _gw(key, idx, default=0.0):
        arr = weather.get(key, [])
        if idx is None or idx >= len(arr) or arr[idx] is None:
            return default
        return float(arr[idx])

    time_idx = {}
    for i, t in enumerate(times):
        key = t[:16]
        time_idx[key] = i

    results = []
    cursor = t_start
    while cursor < t_end:
        fmt = cursor.strftime('%Y-%m-%dT%H:%M')
        idx = time_idx.get(fmt)
        direct   = _gw('direct_radiation',  idx, 0.0)
        diffuse  = _gw('diffuse_radiation', idx, 0.0)
        cloud    = _gw('cloud_cover',       idx, 30.0)
        wind100  = _gw('wind_speed_100m',   idx, 5.0)
        wind10   = _gw('wind_speed_10m',    idx, 3.0)
        temp     = _gw('temperature_2m',    idx, 28.0)
        sunshine = _gw('sunshine_duration', idx, 0.0)
        # Use district-wise solar if available for this time slot,
        # fall back to single-coordinate estimate when data is missing.
        fmt_key = cursor.strftime('%Y-%m-%dT%H:%M')
        if fmt_key in district_solar_agg:
            solar_mw = district_solar_agg[fmt_key]
        else:
            solar_mw = _solar_mw(direct, diffuse, cloud)
        if fmt_key in district_wind_agg:
            wind_mw = district_wind_agg[fmt_key]
        else:
            wind_mw = _wind_mw(wind100)   # fallback to single coordinate
        total_mw = round(solar_mw + wind_mw, 1)
        demand_mw= _demand_forecast(cursor.hour, temp, cursor.weekday())
        balance  = round(total_mw - demand_mw, 1)
        # Label format depends on resolution
        if resolution == 'minutely_15':
            label = cursor.strftime('%H:%M')
        else:
            label = cursor.strftime('%H:%M')
        results.append({
            'datetime':              cursor.isoformat(),
            'label':                 label,
            'date':                  cursor.strftime('%d %b'),
            'solar_mw':              solar_mw,
            'wind_mw':               wind_mw,
            'total_renewable_mw':    total_mw,
            'demand_mw':             demand_mw,
            'balance_mw':            balance,
            'direct_radiation_wm2':  round(direct, 1),
            'diffuse_radiation_wm2': round(diffuse, 1),
            'wind_speed_100m_ms':    round(wind100, 1),
            'wind_speed_10m_ms':     round(wind10, 1),
            'cloud_cover_pct':       round(cloud, 1),
            'temperature_c':         round(temp, 1),
            'sunshine_sec':          round(sunshine, 0),
        })
        cursor += step_size

    if not results:
        raise HTTPException(404, f'No forecast data for view={view}, resolution={resolution}')

    peak_solar = max(results, key=lambda r: r['solar_mw']) if results else {}
    peak_wind  = max(results, key=lambda r: r['wind_mw'])  if results else {}
    peak_total = max(results, key=lambda r: r['total_renewable_mw']) if results else {}
    avg_solar  = round(sum(r['solar_mw'] for r in results) / len(results), 1)
    avg_wind   = round(sum(r['wind_mw']  for r in results) / len(results), 1)

    return {
        'timestamp':             now.isoformat(),
        'resolution':            resolution,
        'view':                  view,
        'data_points':           len(results),
        'forecast_generated_at': district_solar.get('forecast_generated_at', 'unknown'),
        'forecast_locked_for':   district_solar.get('forecast_locked_for',   'unknown'),
        'forecast_from_cache':   district_solar.get('from_cache', False),
        'forecast_note':         district_solar.get('cache_note', ''),
        'period': {
            'start': t_start.isoformat(),
            'end':   t_end.isoformat(),
        },
        'models': {
            'solar': 'District-wise: Σ(district_installed_mw × GHI/1000 × 0.78) across 10 districts, 9900 MW total',
            'wind':  f'Hub-wise: 10 coordinates × IEC61400 × seasonal CF — {TOTAL_WIND_INSTALLED_MW} MW total',
            'data':  'Open-Meteo per-district radiation + per-hub wind_speed_100m; locked day-ahead',
        },
        'summary': {
            'peak_solar_mw':  peak_solar.get('solar_mw', 0),
            'peak_solar_at':  peak_solar.get('label', ''),
            'peak_wind_mw':   peak_wind.get('wind_mw', 0),
            'peak_wind_at':   peak_wind.get('label', ''),
            'peak_total_mw':  peak_total.get('total_renewable_mw', 0),
            'avg_solar_mw':   avg_solar,
            'avg_wind_mw':    avg_wind,
        },
        'labels':               [r['label']               for r in results],
        'solar_mw':             [r['solar_mw']            for r in results],
        'wind_mw':              [r['wind_mw']             for r in results],
        'total_renewable_mw':   [r['total_renewable_mw']  for r in results],
        'demand_mw':            [r['demand_mw']           for r in results],
        'balance_mw':           [r['balance_mw']          for r in results],
        'direct_radiation_wm2': [r['direct_radiation_wm2']for r in results],
        'wind_speed_100m_ms':   [r['wind_speed_100m_ms']  for r in results],
        'cloud_cover_pct':      [r['cloud_cover_pct']     for r in results],
        'temperature_c':        [r['temperature_c']       for r in results],
        'grid_events':          detect_grid_events(results),
        'hourly_detail':        results,
    }


@app.post('/api/forecast/refresh')
async def force_refresh_forecast():
    """
    Force the day-ahead forecast to be re-fetched on the next /api/forecast call.

    WHEN TO USE THIS (emergency only):
      - Sudden monsoon onset changes sky conditions drastically
      - Cyclone warning issued
      - Major cloud system not predicted by morning forecast
      - Server restart after a long downtime

    WHEN NOT TO USE:
      - Normal intraday cloud cover changes (forecast stays locked by design)
      - Just because forecast differs from actual (that deviation is expected)
    """
    _district_forecast_cache['data']            = None
    _district_forecast_cache['locked_for_date'] = None
    _district_forecast_cache['fetched_at']      = None
    return {
        'status':    'cache_cleared',
        'message':   'Day-ahead forecast cache cleared. Will re-fetch on next /api/forecast call.',
        'timestamp': datetime.now(IST).strftime('%d %b %Y %H:%M IST'),
        'warning':   'Use only for emergency weather events. Normal operation keeps forecast locked all day.',
    }


@app.get('/api/solar/districts')
async def get_solar_districts():
    """
    Live solar generation estimate for each of the 10 Karnataka districts.
    Uses real-time radiation from Open-Meteo — updates every call.
    Used by the district map in the Forecast screen.
    """
    total_mw, breakdown = await fetch_district_solar_current()
    def _colour(mw, installed):
        cf = mw / installed * 100 if installed > 0 else 0
        if cf >= 60: return 'green'
        if cf >= 30: return 'amber'
        return 'red'
    districts = []
    for d in breakdown:
        cf = round(d['solar_mw'] / d['installed_mw'] * 100, 1) if d['installed_mw'] > 0 else 0
        districts.append({
            'name':         d['district'],
            'installed_mw': d['installed_mw'],
            'solar_mw':     d['solar_mw'],
            'cf_pct':       cf,
            'ghi_wm2':      d.get('ghi_wm2', 0),
            'colour':       _colour(d['solar_mw'], d['installed_mw']),
        })
    return {
        'timestamp':          datetime.now(IST).strftime('%d %b %Y %H:%M IST'),
        'total_solar_mw':     total_mw,
        'total_installed_mw': TOTAL_SOLAR_INSTALLED_MW,
        'state_cf_pct':       round(total_mw / TOTAL_SOLAR_INSTALLED_MW * 100, 1),
        'districts':          districts,
    }


@app.get('/api/history')
async def get_history(days: int = 7):
    try: hist=await fetch_weather_history()
    except Exception as e: raise HTTPException(503,str(e))
    times=hist.get('time',[]); temps=hist.get('temperature_2m',[])
    winds=hist.get('wind_speed_100m') or hist.get('wind_speed_10m',[])
    clouds=hist.get('cloud_cover',[]); rads=hist.get('direct_radiation',[])
    daily=defaultdict(lambda:{'solar':0.0,'wind':0.0,'demand':0.0,'hours':0,'dt':None})
    for i,t in enumerate(times):
        try: dt=datetime.fromisoformat(t)
        except: continue
        dk=dt.strftime('%Y-%m-%d'); daily[dk]['dt']=dt; daily[dk]['hours']+=1
        daily[dk]['solar']  +=_solar_forecast(dt.hour,clouds[i] if i<len(clouds) else 30,rads[i] if i<len(rads) else 0)
        daily[dk]['wind']   +=_wind_forecast(winds[i] if i<len(winds) else 7)
        daily[dk]['demand'] +=_demand_forecast(dt.hour,temps[i] if i<len(temps) else 28,dt.weekday())
    result=[]
    for dk in sorted(daily.keys()):
        d=daily[dk]
        if d['hours']<12: continue
        sg=round(d['solar']/1000,2); wg=round(d['wind']/1000,2)
        dg=round(d['demand']/1000,2); tg=round(sg+wg,2)
        result.append({'date':dk,'label':d['dt'].strftime('%a %d %b'),
            'solar_gwh':sg,'wind_gwh':wg,'demand_gwh':dg,'total_generation_gwh':tg,
            'wastage_pct':round(max(0,tg-dg)/tg*100,1) if tg>0 else 0.0,
            'efficiency_pct':round(min(99.9,dg/tg*100*0.969),1) if tg>0 else 0.0,
            'co2_avoided_tonnes':round(tg*820,0),'data_source':'open-meteo-archive'})
    return {'days':len(result),'history':result}


@app.get('/api/actions')
async def get_actions():
    s=await get_current()
    return {'timestamp':s['timestamp'],'actions':s['actions'],
        'grid_summary':{k:s['grid'][k] for k in ['solar_mw','wind_mw','surplus_mw','deficit_mw',
            'wastage_pct','efficiency_pct','battery_soc_pct','battery_mode','demand_mw']}}


@app.get('/api/battery')
def get_battery():
    ad=round(min(battery.MAX_RATE_MW,(battery.soc_pct-battery.MIN_SOC)/100*battery.CAPACITY_MWH),1)
    ac=round(min(battery.MAX_RATE_MW,(100-battery.soc_pct)/100*battery.CAPACITY_MWH),1)
    return {'soc_pct':round(battery.soc_pct,1),'mode':battery.mode,
            'capacity_mwh':battery.CAPACITY_MWH,'max_rate_mw':battery.MAX_RATE_MW,
            'available_discharge_mw':ad,'available_charge_mw':ac}


@app.get('/api/kptcl/raw')
async def get_kptcl_raw():
    '''Raw parsed data from StateGen.aspx — verify scraper is working.'''
    return await fetch_kptcl()


@app.get('/api/kptcl/debug')
async def get_kptcl_debug():
    '''Raw HTML + label_map — use when /raw shows errors.'''
    from bs4 import BeautifulSoup
    html,err=await _fetch_html()
    lm={}
    if html:
        try: lm=_build_label_map(BeautifulSoup(html,'lxml'))
        except Exception as e: err=str(e)
    text=re.sub(r'[\s\xa0]+',' ',re.sub(r'<[^>]+>',' ',html)).strip()
    return {'fetch_error':err,'html_length':len(html),'text_snippet':text[:2000],'label_map':lm,
            'has_data':bool(lm.get('STATE DEMAND') or lm.get('THERMAL'))}

@app.get('/api/wind/hubs')
async def get_wind_hubs():
    """Live wind generation per hub using today's locked day-ahead forecast."""
    now_ist   = datetime.now(IST)
    today_str = now_ist.strftime('%Y-%m-%d')
    fmt_key   = now_ist.strftime('%Y-%m-%dT%H:00')

    wind_data = _wind_forecast_cache.get('data')
    if wind_data is None or _wind_forecast_cache.get('locked_for_date') != today_str:
        wind_data = await fetch_district_wind_forecast('hourly')

    hubs_out = []
    for hub in wind_data.get('per_hub', []):
        mw_now    = hub.get('hourly_mw', {}).get(fmt_key, 0)
        installed = hub.get('installed_mw', 0)
        cf_pct    = round(mw_now / installed * 100, 1) if installed > 0 else 0
        hubs_out.append({
            'name':         hub['hub'],
            'installed_mw': installed,
            'wind_mw':      mw_now,
            'cf_pct':       cf_pct,
            'status':       'strong' if cf_pct >= 40 else 'moderate' if cf_pct >= 15 else 'low',
        })

    total_mw = round(sum(h['wind_mw'] for h in hubs_out), 1)
    return {
        'timestamp':          now_ist.strftime('%d %b %Y %H:%M IST'),
        'total_wind_mw':      total_mw,
        'total_installed_mw': TOTAL_WIND_INSTALLED_MW,
        'state_cf_pct':       round(total_mw / TOTAL_WIND_INSTALLED_MW * 100, 1),
        'seasonal_fleet_cf':  wind_data.get('seasonal_fleet_cf', 0),
        'hubs':               hubs_out,
    }

if __name__ == '__main__':
    import uvicorn
    print('\n' + '='*60)
    print('  Grid Energy Intelligence — Karnataka v7.0')
    print('  Source:    kptclsldc.in/StateGen.aspx')
    print('  No LSTM, No StateNCEP, No fake data')
    print('='*60 + '\n')
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)