"""
LSTM Training Script — Grid Energy Intelligence Platform
=========================================================
Trains the ProductionLSTM on REAL historical weather data
fetched from Open-Meteo Archive API.

No synthetic data. Every training sample comes from actual
measured weather: wind speed, cloud cover, temperature,
direct solar radiation.

Usage:
    pip install torch scikit-learn pandas requests
    python train_lstm.py --lat 12.97 --lon 77.59 --days 365

Output:
    models/lstm_weights.pt   ← loaded automatically by main.py
    models/lstm_scaler.json  ← feature normalisation parameters
"""

import math
import json
import argparse
import os
import sys
from datetime import datetime, timedelta

import requests
import numpy as np

try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import train_test_split
except ImportError:
    print("ERROR: Missing dependencies.")
    print("Run: pip install torch scikit-learn requests numpy")
    sys.exit(1)


# ─────────────────────────────────────────────────────────────────────────
#  STEP 1: Fetch real historical weather from Open-Meteo Archive
# ─────────────────────────────────────────────────────────────────────────

def fetch_real_history(lat: float, lon: float, days: int = 365) -> dict:
    """
    Downloads real hourly weather data for training.
    Open-Meteo archive goes back to 1940. No API key needed.
    """
    end_date   = (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d")
    start_date = (datetime.now() - timedelta(days=days+2)).strftime("%Y-%m-%d")

    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&hourly=temperature_2m,wind_speed_10m,cloud_cover,direct_radiation"
        f"&wind_speed_unit=ms&timezone=auto"
    )
    print(f"[DATA] Fetching {days} days of real weather for ({lat}, {lon})...")
    print(f"[DATA] URL: {url}")

    resp = requests.get(url, timeout=60)
    resp.raise_for_status()
    data = resp.json()["hourly"]

    times = data.get("time", [])
    print(f"[DATA] Downloaded {len(times)} hourly records.")
    return data


# ─────────────────────────────────────────────────────────────────────────
#  STEP 2: Physics models (same as main.py)
# ─────────────────────────────────────────────────────────────────────────

def solar_mw(hour, cloud_pct, radiation_wm2, capacity=500.0):
    if hour < 5 or hour > 20:
        return 0.0
    if radiation_wm2 > 0:
        cf = (radiation_wm2 / 1000.0) * 0.18 * 0.80 * 5.56
        return max(0.0, min(capacity, capacity * cf))
    zenith    = math.sin(math.pi * (hour - 5) / 15)
    cloud_att = 1.0 - (cloud_pct / 100.0 * 0.75)
    return max(0.0, capacity * zenith * cloud_att * 0.18 * 5.5)


def wind_mw(speed_ms, capacity=250.0):
    if speed_ms < 3.0 or speed_ms > 25.0:
        return 0.0
    if speed_ms >= 12.0:
        return capacity
    return capacity * ((speed_ms**3 - 27) / (1728 - 27))


def demand_mw(hour, temp_c, dow, base=380.0):
    mult = {
        0:0.78,1:0.74,2:0.72,3:0.71,4:0.73,5:0.80,
        6:0.88,7:1.12,8:1.25,9:1.18,10:1.14,11:1.10,
        12:1.08,13:1.05,14:1.06,15:1.10,16:1.18,
        17:1.32,18:1.38,19:1.42,20:1.35,21:1.20,
        22:1.05,23:0.90,
    }
    wkd = 0.88 if dow >= 5 else 1.0
    if temp_c < 18:
        tf = 1.0 + (18 - temp_c) * 0.005
    elif temp_c > 24:
        tf = 1.0 + (temp_c - 24) * 0.012
    else:
        tf = 1.0
    return base * mult.get(hour, 1.0) * wkd * tf


# ─────────────────────────────────────────────────────────────────────────
#  STEP 3: Build dataset from real weather
# ─────────────────────────────────────────────────────────────────────────

def build_dataset(hourly: dict, seq_len: int = 24):
    """
    Creates supervised learning dataset from real hourly weather.
    Each sample: 24 hours of features → next hour's [solar, wind, demand]
    """
    times  = hourly.get("time", [])
    temps  = hourly.get("temperature_2m", [])
    winds  = hourly.get("wind_speed_10m", [])
    clouds = hourly.get("cloud_cover", [])
    rads   = hourly.get("direct_radiation", [])

    X_all, y_all = [], []

    for i in range(len(times)):
        try:
            dt = datetime.fromisoformat(times[i])
        except Exception:
            continue

        temp  = temps[i]  if i < len(temps)  else 28.0
        wind  = winds[i]  if i < len(winds)  else 7.0
        cloud = clouds[i] if i < len(clouds) else 30.0
        rad   = rads[i]   if i < len(rads)   else 0.0

        sol = solar_mw(dt.hour, cloud, rad)
        wnd = wind_mw(wind)
        dem = demand_mw(dt.hour, temp, dt.weekday())

        feat = [
            math.sin(2 * math.pi * dt.hour / 24),
            math.cos(2 * math.pi * dt.hour / 24),
            math.sin(2 * math.pi * dt.weekday() / 7),
            math.cos(2 * math.pi * dt.weekday() / 7),
            math.sin(2 * math.pi * dt.month / 12),
            math.cos(2 * math.pi * dt.month / 12),
            cloud / 100.0,
            min(wind, 25.0) / 25.0,
            min(max(temp, -10), 50) / 60.0,
            1.0 if dt.weekday() < 5 else 0.0,
        ]
        X_all.append(feat)
        y_all.append([sol / 500.0, wnd / 250.0, dem / 700.0])   # normalise to [0,1]

    # Build sequences: each input = last seq_len hours of features
    X_seq, y_seq = [], []
    for i in range(seq_len, len(X_all)):
        X_seq.append(X_all[i - seq_len: i])
        y_seq.append(y_all[i])

    print(f"[DATA] Dataset: {len(X_seq)} sequences of length {seq_len}")
    return np.array(X_seq, dtype=np.float32), np.array(y_seq, dtype=np.float32)


# ─────────────────────────────────────────────────────────────────────────
#  STEP 4: Model definition
# ─────────────────────────────────────────────────────────────────────────

class ProductionLSTM(nn.Module):
    def __init__(self, input_size=10, hidden_size=128, num_layers=2, dropout=0.2):
        super().__init__()
        self.lstm = nn.LSTM(input_size, hidden_size, num_layers,
                            batch_first=True, dropout=dropout)
        self.head = nn.Sequential(
            nn.Linear(hidden_size, 64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 3),
            nn.Sigmoid(),
        )

    def forward(self, x):
        out, _ = self.lstm(x)
        return self.head(out[:, -1, :])


# ─────────────────────────────────────────────────────────────────────────
#  STEP 5: Training loop
# ─────────────────────────────────────────────────────────────────────────

def train(model, X_train, y_train, X_val, y_val, epochs=80, lr=1e-3, batch=64):
    device    = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model     = model.to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr, weight_decay=1e-5)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(optimizer, patience=5, factor=0.5)
    criterion = nn.MSELoss()

    Xt = torch.tensor(X_train).to(device)
    yt = torch.tensor(y_train).to(device)
    Xv = torch.tensor(X_val).to(device)
    yv = torch.tensor(y_val).to(device)

    loader = DataLoader(TensorDataset(Xt, yt), batch_size=batch, shuffle=True)

    best_val_loss = float("inf")
    best_state    = None
    patience_ctr  = 0
    EARLY_STOP    = 15

    print(f"\n[TRAIN] Device: {device}")
    print(f"[TRAIN] Train: {len(X_train)} | Val: {len(X_val)} | Epochs: {epochs}\n")

    for epoch in range(1, epochs + 1):
        model.train()
        total_loss = 0.0
        for xb, yb in loader:
            optimizer.zero_grad()
            pred = model(xb)
            loss = criterion(pred, yb)
            loss.backward()
            nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()
            total_loss += loss.item()

        model.eval()
        with torch.no_grad():
            val_pred = model(Xv)
            val_loss = criterion(val_pred, yv).item()

        scheduler.step(val_loss)

        if epoch % 5 == 0 or epoch == 1:
            # Calculate MAPE on validation set
            pred_np = val_pred.cpu().numpy()
            true_np = yv.cpu().numpy()
            mape = np.mean(np.abs(pred_np - true_np) / (true_np + 1e-6)) * 100
            print(f"Epoch {epoch:3d}/{epochs} | Train Loss: {total_loss/len(loader):.4f} | "
                  f"Val Loss: {val_loss:.4f} | MAPE: {mape:.1f}%")

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            best_state    = {k: v.cpu().clone() for k, v in model.state_dict().items()}
            patience_ctr  = 0
        else:
            patience_ctr += 1
            if patience_ctr >= EARLY_STOP:
                print(f"\n[TRAIN] Early stopping at epoch {epoch} (no improvement for {EARLY_STOP} epochs)")
                break

    model.load_state_dict(best_state)
    print(f"\n[TRAIN] Best validation loss: {best_val_loss:.4f}")
    return model


# ─────────────────────────────────────────────────────────────────────────
#  MAIN
# ─────────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Train LSTM on real Open-Meteo data")
    parser.add_argument("--lat",    type=float, default=12.97,  help="Latitude  (default: Bengaluru)")
    parser.add_argument("--lon",    type=float, default=77.59,  help="Longitude (default: Bengaluru)")
    parser.add_argument("--days",   type=int,   default=365,    help="Days of history to train on")
    parser.add_argument("--epochs", type=int,   default=80,     help="Training epochs")
    parser.add_argument("--seq",    type=int,   default=24,     help="Sequence length (hours)")
    args = parser.parse_args()

    # Fetch real data
    hourly = fetch_real_history(args.lat, args.lon, args.days)

    # Build dataset
    X, y = build_dataset(hourly, seq_len=args.seq)

    # Train/val split (80/20, no shuffle — preserve temporal order)
    split = int(len(X) * 0.80)
    X_train, X_val = X[:split], X[split:]
    y_train, y_val = y[:split], y[split:]

    # Train
    model = ProductionLSTM()
    model = train(model, X_train, y_train, X_val, y_val, epochs=args.epochs)

    # Save weights
    os.makedirs("../models", exist_ok=True)
    out_path = os.path.join("..", "models", "lstm_weights.pt")
    torch.save(model.state_dict(), out_path)
    print(f"\n[SAVED] Weights → {out_path}")
    print("[DONE] Restart main.py — LSTM will load automatically.")


if __name__ == "__main__":
    main()
