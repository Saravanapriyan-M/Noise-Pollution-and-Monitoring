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
from fastapi.responses import FileResponse, HTMLResponse, Response
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

# Timeout threshold in seconds: if no reading arrives within 25 seconds, sensor is marked Disconnected
# Note: In cloud/serverless environments (Vercel), network latency, TLS handshakes and serverless cold starts
# require a generous timeout window (25s) to prevent intermittent false disconnection alerts.
SENSOR_TIMEOUT_SECONDS = 25.0


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
async def get_latest_reading(response: Response):
    """
    Endpoint for Dashboard to fetch the latest reading and sensor connectivity state.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"

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
            message=f"No Sensor Data. Signal delayed ({elapsed}s since last reading). Check ESP32 power and WiFi."
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
async def get_history(response: Response):
    """
    Endpoint for Dashboard to fetch history data for the line graph.
    """
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    response.headers["Pragma"] = "no-cache"
    return list(readings_history)


def load_file_content(filename: str) -> Optional[str]:
    # Search all possible directories in order
    search_dirs = [
        os.path.dirname(os.path.abspath(__file__)),
        os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")),
        os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")),
        os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public")),
        os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "api")),
        os.getcwd(),
        os.path.normpath(os.path.join(os.getcwd(), "backend")),
        os.path.normpath(os.path.join(os.getcwd(), "api")),
        os.path.normpath(os.path.join(os.getcwd(), "frontend")),
        os.path.normpath(os.path.join(os.getcwd(), "public")),
    ]
    for d in search_dirs:
        path = os.path.join(d, filename)
        if os.path.exists(path):
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return f.read()
            except Exception:
                pass
    return None

# Direct routes for root and assets (ensures Vercel and local always return index.html)
@app.get("/", include_in_schema=False)
async def serve_index():
    content = load_file_content("index.html")
    if content:
        return HTMLResponse(content=content)
    return HTMLResponse(content="<!DOCTYPE html><html><body><h1>Noise Pollution Monitoring System</h1><p>Dashboard is loading...</p></body></html>")

@app.get("/style.css", include_in_schema=False)
async def serve_style():
    content = load_file_content("style.css")
    if content:
        return Response(content=content, media_type="text/css")
    raise HTTPException(status_code=404, detail="style.css not found")

@app.get("/app.js", include_in_schema=False)
async def serve_app_js():
    content = load_file_content("app.js")
    if content:
        return Response(content=content, media_type="application/javascript")
    raise HTTPException(status_code=404, detail="app.js not found")

# Support routes without /api prefix if Vercel function strips /api
@app.get("/readings", response_model=List[Reading], include_in_schema=False)
async def get_history_no_prefix():
    return await get_history()

@app.get("/readings/latest", response_model=LatestReadingResponse, include_in_schema=False)
async def get_latest_reading_no_prefix():
    return await get_latest_reading()

@app.post("/readings", status_code=status.HTTP_201_CREATED, include_in_schema=False)
async def post_sensor_reading_no_prefix(data: SensorInput):
    return await post_sensor_reading(data)

# Mount frontend static files directory
for candidate_dir in [
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "public"),
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public"),
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "frontend"),
    os.getcwd(),
]:
    if os.path.exists(candidate_dir) and os.path.exists(os.path.join(candidate_dir, "index.html")):
        app.mount("/static", StaticFiles(directory=candidate_dir), name="static")
        break

if __name__ == "__main__":
    import uvicorn
    # Listen on 0.0.0.0 so ESP32 on local WiFi network can send readings to this IP
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
