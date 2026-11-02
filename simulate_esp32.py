"""
ESP32 Telemetry Simulator for Testing
Simulates an ESP32 with MAX4466 sound sensor sending readings every 2 seconds.
Useful for testing the dashboard before connecting real hardware.
"""

import time
import random
import math
import urllib.request
import json

SERVER_URL = "http://localhost:8000/api/readings"

print("Starting ESP32 + MAX4466 Simulator...")
print(f"Sending telemetry to: {SERVER_URL}")
print("Press Ctrl+C at any time to simulate SENSOR DISCONNECT.\n")

# Base ambient noise floor
base_db = 48.0

try:
    while True:
        # Simulate realistic ambient noise variation + occasional noise spikes (conversation/traffic)
        fluctuation = random.uniform(-4.0, 5.0)
        spike = random.choice([0, 0, 0, 15, 25]) if random.random() < 0.25 else 0
        current_db = round(max(34.0, min(95.0, base_db + fluctuation + spike)), 1)

        # Estimate corresponding RMS voltage
        # Invert: db = 20 * log10(rms / 0.001) => rms = 0.001 * 10^(db/20)
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
            with urllib.request.urlopen(req, timeout=3) as response:
                print(f"[ESP32 SIM] Sent -> dB: {current_db:5.1f} | RMS: {calc_rms:.4f}V | HTTP {response.status}")
        except Exception as e:
            print(f"[ESP32 SIM] Transmission failed: {e}")

        # Refresh every 2 seconds
        time.sleep(2.0)

except KeyboardInterrupt:
    print("\nSimulator stopped. Watch the dashboard change to 'Disconnected' after 6 seconds!")
