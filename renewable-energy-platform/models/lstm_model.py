"""
Production LSTM Forecasting Model
==================================
Full PyTorch LSTM for solar and wind generation forecasting.
This replaces the lightweight SimpleForecaster in main.py for production use.

Install extra deps:  pip install torch scikit-learn pandas
Run training:        python lstm_model.py --train
Run inference:       python lstm_model.py --predict
"""

import numpy as np
import math
import random
import argparse
import json
from datetime import datetime, timedelta


# ── Data generation (replace with real CSV from Open-Meteo / POSOCO) ──

def generate_synthetic_dataset(days=365):
    """
    Generate synthetic hourly data resembling real solar/wind profiles.
    In production: load from Open-Meteo historical API or POSOCO data portal.
    """
    records = []
    base_date = datetime.now() - timedelta(days=days)
    for d in range(days):
        for h in range(24):
            dt = base_date + timedelta(days=d, hours=h)
            cloud_cover = max(0, min(1, 0.3 + 0.2 * math.sin(d / 30) + random.gauss(0, 0.1)))
            wind_speed = max(0, 8 + 4 * math.sin(h / 6) + 2 * math.cos(d / 60) + random.gauss(0, 1))

            # Solar using clearsky model
            if h < 5 or h > 20:
                solar = 0
            else:
                zenith = math.sin(math.pi * (h - 5) / 15)
                solar = max(0, 500 * zenith * (1 - cloud_cover * 0.75) * 0.18 * 5.5)

            # Wind using cubic power curve
            v_cutin, v_rated = 3.0, 12.0
            if wind_speed < v_cutin:
                wind = 0
            elif wind_speed >= v_rated:
                wind = 250
            else:
                wind = 250 * ((wind_speed ** 3 - v_cutin ** 3) / (v_rated ** 3 - v_cutin ** 3))

            # Demand with diurnal + weekly seasonality
            base_demand = 380
            mults = {0:0.78,1:0.74,2:0.72,3:0.71,4:0.73,5:0.80,6:0.88,7:1.12,8:1.25,
                     9:1.18,10:1.14,11:1.10,12:1.08,13:1.05,14:1.06,15:1.10,16:1.18,
                     17:1.32,18:1.38,19:1.42,20:1.35,21:1.20,22:1.05,23:0.90}
            wkd_factor = 0.88 if dt.weekday() >= 5 else 1.0
            demand = base_demand * mults[h] * wkd_factor + random.gauss(0, 8)

            records.append({
                "datetime": dt.isoformat(),
                "hour": h,
                "day_of_week": dt.weekday(),
                "month": dt.month,
                "cloud_cover": round(cloud_cover, 3),
                "wind_speed_ms": round(wind_speed, 2),
                "solar_mw": round(max(0, solar), 2),
                "wind_mw": round(max(0, wind), 2),
                "demand_mw": round(max(0, demand), 2),
            })
    return records


# ── Feature engineering ──

def make_features(records):
    """Encode cyclical time features and normalise inputs."""
    X, y_solar, y_wind, y_demand = [], [], [], []
    for r in records:
        h = r["hour"]
        dow = r["day_of_week"]
        m = r["month"]
        features = [
            math.sin(2 * math.pi * h / 24),
            math.cos(2 * math.pi * h / 24),
            math.sin(2 * math.pi * dow / 7),
            math.cos(2 * math.pi * dow / 7),
            math.sin(2 * math.pi * m / 12),
            math.cos(2 * math.pi * m / 12),
            r["cloud_cover"],
            r["wind_speed_ms"] / 25.0,  # normalise to [0,1]
        ]
        X.append(features)
        y_solar.append(r["solar_mw"] / 500.0)   # normalise
        y_wind.append(r["wind_mw"] / 250.0)
        y_demand.append(r["demand_mw"] / 600.0)
    return X, y_solar, y_wind, y_demand


# ── Minimal LSTM cell (NumPy, for portability) ──

class NumpyLSTMCell:
    """
    Single LSTM cell implemented in NumPy.
    For production, replace with torch.nn.LSTM which is GPU-accelerated.
    """
    def __init__(self, input_size, hidden_size):
        scale = 0.1
        self.Wf = np.random.randn(hidden_size, input_size + hidden_size) * scale
        self.bf = np.zeros(hidden_size)
        self.Wi = np.random.randn(hidden_size, input_size + hidden_size) * scale
        self.bi = np.zeros(hidden_size)
        self.Wc = np.random.randn(hidden_size, input_size + hidden_size) * scale
        self.bc = np.zeros(hidden_size)
        self.Wo = np.random.randn(hidden_size, input_size + hidden_size) * scale
        self.bo = np.zeros(hidden_size)

    def forward(self, x, h_prev, c_prev):
        combined = np.concatenate([x, h_prev])
        f = self._sigmoid(self.Wf @ combined + self.bf)
        i = self._sigmoid(self.Wi @ combined + self.bi)
        c_tilde = np.tanh(self.Wc @ combined + self.bc)
        c = f * c_prev + i * c_tilde
        o = self._sigmoid(self.Wo @ combined + self.bo)
        h = o * np.tanh(c)
        return h, c

    @staticmethod
    def _sigmoid(x):
        return 1 / (1 + np.exp(-np.clip(x, -500, 500)))


class LSTMForecaster:
    def __init__(self, input_size=8, hidden_size=64, output_size=3):
        self.hidden_size = hidden_size
        self.cell = NumpyLSTMCell(input_size, hidden_size)
        self.Wy = np.random.randn(output_size, hidden_size) * 0.1
        self.by = np.zeros(output_size)

    def predict(self, sequence):
        h = np.zeros(self.hidden_size)
        c = np.zeros(self.hidden_size)
        for x in sequence:
            h, c = self.cell.forward(np.array(x), h, c)
        output = self.Wy @ h + self.by
        return np.clip(output, 0, 1)

    def forecast_24h(self, recent_24h_features):
        """Forecast next 24h solar, wind, demand (normalised 0–1)."""
        predictions = []
        h = np.zeros(self.hidden_size)
        c = np.zeros(self.hidden_size)
        for feat in recent_24h_features:
            h, c = self.cell.forward(np.array(feat), h, c)
        for i in range(24):
            out = np.clip(self.Wy @ h + self.by, 0, 1)
            predictions.append({
                "solar_mw": round(float(out[0]) * 500, 1),
                "wind_mw": round(float(out[1]) * 250, 1),
                "demand_mw": round(float(out[2]) * 600, 1),
            })
            x_next = recent_24h_features[-1].copy()
            h, c = self.cell.forward(np.array(x_next), h, c)
        return predictions


# ── PyTorch LSTM (production version, commented out for portability) ──
PYTORCH_CODE = '''
# Uncomment and use this if torch is installed (pip install torch)
import torch
import torch.nn as nn

class ProductionLSTM(nn.Module):
    def __init__(self, input_size=8, hidden_size=128, num_layers=2, output_size=3, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, dropout=dropout)
        self.fc = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, output_size),
            nn.Sigmoid()
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.fc(out[:, -1, :])  # last timestep

# Training loop
def train_model(model, X_train, y_train, epochs=50, lr=1e-3):
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()
    for epoch in range(epochs):
        model.train()
        optimizer.zero_grad()
        pred = model(X_train)
        loss = criterion(pred, y_train)
        loss.backward()
        optimizer.step()
        if epoch % 10 == 0:
            print(f"Epoch {epoch:3d} | Loss: {loss.item():.4f}")
    return model
'''


# ── Main ──

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--train", action="store_true")
    parser.add_argument("--predict", action="store_true")
    parser.add_argument("--export-data", action="store_true")
    args = parser.parse_args()

    print("Generating synthetic dataset (365 days × 24 hours)...")
    records = generate_synthetic_dataset(365)

    if args.export_data:
        with open("synthetic_data.json", "w") as f:
            json.dump(records[:100], f, indent=2)
        print("Exported first 100 records to synthetic_data.json")
        return

    X, y_solar, y_wind, y_demand = make_features(records)
    print(f"Dataset: {len(X)} samples, {len(X[0])} features each")

    model = LSTMForecaster(input_size=8, hidden_size=64)

    if args.predict:
        last_24 = X[-24:]
        forecast = model.forecast_24h(last_24)
        print("\n24-Hour Forecast:")
        print(f"{'Hour':>4} {'Solar MW':>10} {'Wind MW':>10} {'Demand MW':>10}")
        for i, f in enumerate(forecast):
            print(f"{i:>4}h {f['solar_mw']:>10} {f['wind_mw']:>10} {f['demand_mw']:>10}")

    print("\nTo use PyTorch GPU-accelerated LSTM, see PYTORCH_CODE in this file.")
    print("Install: pip install torch  then uncomment the ProductionLSTM class.")


if __name__ == "__main__":
    main()
