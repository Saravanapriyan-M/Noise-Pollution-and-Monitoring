"""
ESP32 Telemetry Simulator for Testing
Simulates an ESP32 with MAX4466 sound sensor sending readings every 2 seconds.
Can send to local server or your deployed Vercel cloud dashboard!
"""

import time
import random
import math
import urllib.request
import json
import sys

# -------------------------------------------------------------
# Configuration Toggle:
# Set USE_VERCEL = True  to send live data directly to your deployed Vercel website!
# Set USE_VERCEL = False to send live data to your local backend (localhost:8000)
# -------------------------------------------------------------
USE_VERCEL = True

VERCEL_URL = "https://noise-pollution-and-monitoring.vercel.app/api/readings"
LOCAL_URL = "http://localhost:8000/api/readings"

SERVER_URL = VERCEL_URL if USE_VERCEL else LOCAL_URL

print("=" * 60)
print("  ESP32 + MAX4466 SOUND SENSOR TELEMETRY SIMULATOR")
print("=" * 60)
print(f"Target Mode : {'CLOUD DEPLOYMENT (Vercel)' if USE_VERCEL else 'LOCAL SERVER'}")
print(f"Target URL  : {SERVER_URL}")
print("Dashboard   : https://noise-pollution-and-monitoring.vercel.app")
print("Frequency   : Every 2.0 seconds")
print("Press Ctrl+C at any time to simulate SENSOR DISCONNECT.\n")

# Base ambient noise floor
base_db = 52.0

try:
    packet_id = 0
    while True:
        packet_id += 1
        # Simulate realistic ambient noise variation + occasional noise spikes
        fluctuation = random.uniform(-4.0, 5.0)
        spike = random.choice([0, 0, 0, 16, 26]) if random.random() < 0.25 else 0
        current_db = round(max(34.0, min(95.0, base_db + fluctuation + spike)), 1)

        # Estimate corresponding RMS voltage
        calc_rms = round(0.001 * math.pow(10, current_db / 20.0), 4)

        payload = {
            "rms": calc_rms,
            "db": current_db
        }

        req = urllib.request.Request(
            SERVER_URL,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                status_level = "HIGH (>70dB)" if current_db > 70 else ("MED (>50dB)" if current_db >= 50 else "LOW")
                print(f"[Packet #{packet_id:03d}] Sent -> {current_db:5.1f} dB [{status_level:12s}] | RMS: {calc_rms:.4f}V | HTTP {response.status}")
        except Exception as e:
            print(f"[Packet #{packet_id:03d}] Transmission failed: {e}")

        # Refresh every 2 seconds
        time.sleep(2.0)

except KeyboardInterrupt:
    print("\n[Simulator stopped] Sensor signal stopped.")
    print("Watch the dashboard change to 'Disconnected' after 6 seconds!\n")
