# Grid Energy Intelligence Platform
### Renewable Energy Forecasting & Load Balancing

A full-stack, real-world grid management system built for the hackathon.
Uses **live weather data** from Open-Meteo API, physics-based generation models,
and an AI-powered load balancing engine.

---

## Architecture

```
renewable-energy-platform/
├── backend/
│   ├── main.py              ← FastAPI server (all APIs)
│   └── requirements.txt
├── models/
│   └── lstm_model.py        ← LSTM forecasting model (NumPy + PyTorch guide)
├── frontend/
│   ├── src/
│   │   ├── App.jsx          ← Main app shell + routing
│   │   ├── App.css          ← Global styles
│   │   └── components/
│   │       ├── Dashboard.jsx   ← Live grid metrics
│   │       ├── Forecast.jsx    ← 24h generation forecast
│   │       ├── Actions.jsx     ← Load balancing actions
│   │       └── History.jsx     ← 7-day historical trend
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── start.sh                 ← One-command startup (Mac/Linux)
├── start.bat                ← One-command startup (Windows)
└── README.md
```

---

## Prerequisites

| Tool    | Minimum version | Download |
|---------|----------------|----------|
| Python  | 3.10+          | https://python.org |
| Node.js | 18+            | https://nodejs.org |
| npm     | 9+             | (comes with Node) |

---

## Quick Start

### Mac / Linux
```bash
chmod +x start.sh
./start.sh
```

### Windows
Double-click `start.bat`

### Manual start (any OS)

**Terminal 1 — Backend:**
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

**Terminal 2 — Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

---

## API Endpoints

| Method | Endpoint           | Description |
|--------|--------------------|-------------|
| GET    | `/api/current`     | Live grid status, metrics, alerts |
| GET    | `/api/forecast`    | 24-hour generation & demand forecast |
| GET    | `/api/history`     | 7-day historical energy balance |
| GET    | `/api/actions`     | Prioritised load balancing actions only |
| GET    | `/api/weather`     | Raw Open-Meteo weather data |
| GET    | `/docs`            | Interactive API documentation (Swagger) |

All endpoints accept `?lat=<lat>&lon=<lon>` to change location.

**Examples:**
```bash
# Bengaluru (default)
curl http://localhost:8000/api/current

# Mumbai
curl "http://localhost:8000/api/current?lat=19.07&lon=72.87"

# Chennai
curl "http://localhost:8000/api/current?lat=13.08&lon=80.27"
```

---

## How It Works

### 1. Solar Generation Model
Uses a physics-based clear-sky irradiance model:
- Sine-wave zenith angle profile (peak at solar noon)
- Cloud cover attenuation from live weather API
- Monocrystalline silicon efficiency (18%)
- Configurable panel capacity (default: 500 MW)

### 2. Wind Generation Model
Cubic power curve model (IEC 61400 standard):
- Cut-in speed: 3 m/s
- Rated speed: 12 m/s (full power)
- Cut-out speed: 25 m/s (safety shutdown)
- Configurable turbine capacity (default: 250 MW)

### 3. Demand Forecasting
POSOCO-style 24-hour load profile:
- Weekday vs weekend differentiation
- Morning peak (07:00–09:00)
- Evening peak (17:00–21:00)
- Off-peak trough (01:00–05:00)

### 4. AI Forecaster
Exponential smoothing + Fourier harmonics for 24h ahead prediction.
Upgrade path to full LSTM available in `models/lstm_model.py`.

### 5. Load Balancing Engine
Generates prioritised actions based on real-world grid rules:
- P-critical: Battery dispatch, deficit coverage
- P-high: Demand response (OpenADR 2.0), gas backup scheduling
- P-medium: Reactive power compensation, load export
- P-low: Transmission optimisation

---

## Upgrade to Full LSTM (Production)

```bash
pip install torch scikit-learn pandas

# Generate training dataset
python models/lstm_model.py --export-data

# Run inference
python models/lstm_model.py --predict
```

Then uncomment the `ProductionLSTM` class in `lstm_model.py` and integrate
with the backend by replacing the `SimpleForecaster` in `main.py`.

---

## Real Data Sources (Free APIs)

| Source | What it provides | URL |
|--------|-----------------|-----|
| Open-Meteo | Solar irradiance, wind speed, cloud cover | api.open-meteo.com |
| POSOCO | India grid load data | posoco.in |
| CERC | India electricity market | cercind.gov.in |
| EIA API | US grid data | api.eia.gov |
| ENTSO-E | European grid data | transparency.entsoe.eu |

---

## Hackathon Presentation Points

1. **Real-world physics** — solar and wind models match IEC/IEEE standards
2. **Live weather integration** — actual Open-Meteo API, not random data
3. **Actionable AI** — every recommendation has a real protocol (OpenADR, SCADA, DNP3)
4. **Economic impact** — CO₂ avoided and revenue saved calculated per action
5. **Scalable architecture** — swap in PyTorch LSTM, connect to real SCADA

---

## Team

Built for Hackathon 2026 — Renewable Energy Track

---

## License
MIT
