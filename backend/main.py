"""
Noise Pollution Monitoring System - FastAPI Backend
Handles telemetry from ESP32 + MAX4466 Sound Sensor.
Serves live data and history to the web dashboard.
"""

from datetime import datetime, timezone
from collections import deque
import math
import os
from typing import Optional, List

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

app = FastAPI(
    title="Noise Pollution Monitoring System API",
    description="Backend for ESP32 + MAX4466 sound sensor telemetry",
    version="1.0.0"
)

# Enable CORS for cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Schemas
class SensorInput(BaseModel):
    rms: float = Field(..., description="Root Mean Square voltage reading (V) from MAX4466")
    db: Optional[float] = Field(None, description="Optional pre-calculated estimated noise level in dB")

class Reading(BaseModel):
    timestamp: str
    db: float
    rms: float
    status: str

class LatestReadingResponse(BaseModel):
    sensor_status: str  # "Connected" or "Disconnected"
    db: Optional[float] = None
    rms: Optional[float] = None
    status: Optional[str] = None
    timestamp: Optional[str] = None
    message: Optional[str] = None

# In-memory storage for sensor history (retains last 500 readings for historical data & graphs)
MAX_HISTORY_SIZE = 500
readings_history: deque[Reading] = deque(maxlen=MAX_HISTORY_SIZE)
last_received_time: Optional[datetime] = None

# Timeout threshold in seconds: if no reading arrives within 6 seconds, sensor is marked Disconnected
SENSOR_TIMEOUT_SECONDS = 6.0


def calculate_estimated_db(rms: float) -> float:
    """
    Estimate noise level (dB) from MAX4466 RMS voltage.
    Formula: 20 * log10(rms / V_ref) + calibration_offset
    Note: Uncalibrated approximation for MAX4466 electret microphone.
    """
    if rms <= 0.0001:
        return 32.0  # Ambient floor
    try:
        # Reference reference ~0.001V (1mV)
        calc_db = 20.0 * math.log10(rms / 0.001)
        # Shift and bound to realistic ambient scale (30 dB to 105 dB)
        clamped = max(30.0, min(105.0, round(calc_db, 1)))
        return clamped
    except Exception:
        return 40.0


def categorize_noise_status(db: float) -> str:
    """
    Classify noise level into 3 categories:
    - LOW: Below 50 dB
    - MEDIUM: 50 dB to 70 dB
    - HIGH: Above 70 dB
    """
    if db < 50.0:
        return "LOW"
    elif db <= 70.0:
        return "MEDIUM"
    else:
        return "HIGH"



def is_sensor_connected() -> bool:
    """Check if the sensor has sent a reading within the timeout window."""
    if last_received_time is None:
        return False
    elapsed = (datetime.now(timezone.utc) - last_received_time).total_seconds()
    return elapsed <= SENSOR_TIMEOUT_SECONDS


@app.post("/api/readings", status_code=status.HTTP_201_CREATED)
async def post_sensor_reading(data: SensorInput):
    """
    Endpoint for ESP32 to push live readings.
    ESP32 sends JSON: {"rms": 0.042} or {"rms": 0.042, "db": 62.5}
    """
    global last_received_time

    # Use provided dB or calculate from RMS
    db_val = data.db if data.db is not None else calculate_estimated_db(data.rms)
    db_val = round(float(db_val), 1)
    rms_val = round(float(data.rms), 4)
    noise_status = categorize_noise_status(db_val)
    now_utc = datetime.now(timezone.utc)
    last_received_time = now_utc

    reading = Reading(
        timestamp=now_utc.isoformat(),
        db=db_val,
        rms=rms_val,
        status=noise_status
    )
    readings_history.append(reading)

    return {"status": "success", "recorded": reading}


@app.get("/api/readings/latest", response_model=LatestReadingResponse)
async def get_latest_reading():
    """
    Endpoint for Dashboard to fetch the latest reading and sensor connectivity state.
    """
    connected = is_sensor_connected()

    if not readings_history:
        return LatestReadingResponse(
            sensor_status="Disconnected",
            db=None,
            rms=None,
            status=None,
            timestamp=None,
            message="No Sensor Data. Awaiting ESP32 transmission."
        )

    latest = readings_history[-1]

    if not connected:
        elapsed = int((datetime.now(timezone.utc) - last_received_time).total_seconds()) if last_received_time else 0
        return LatestReadingResponse(
            sensor_status="Disconnected",
            db=latest.db,
            rms=latest.rms,
            status=latest.status,
            timestamp=latest.timestamp,
            message=f"No Sensor Data. Signal lost ({elapsed}s since last reading). Check ESP32 power and WiFi."
        )

    return LatestReadingResponse(
        sensor_status="Connected",
        db=latest.db,
        rms=latest.rms,
        status=latest.status,
        timestamp=latest.timestamp,
        message="Sensor transmitting normally."
    )


@app.get("/api/readings", response_model=List[Reading])
async def get_history():
    """
    Endpoint for Dashboard to fetch history data for the line graph.
    """
    return list(readings_history)


# Mount frontend static files so dashboard is accessible directly at http://localhost:8000/
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    # Listen on 0.0.0.0 so ESP32 on local WiFi network can send readings to this IP
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
