# Noise Pollution Monitoring System 🎙️📡

A modern, professional web dashboard with a **ChatGPT-inspired collapsible sidebar** for real-time acoustic noise telemetry using an **ESP32** microcontroller and **MAX4466 Electret Microphone Amplifier** with an automatic 2-second refresh rate.

---

## 🎨 Dashboard Design & Features

- **ChatGPT-Inspired Collapsible Sidebar**:
  - Fixed left sidebar with smooth sliding collapse/expand animation.
  - Top toggle button with keyboard shortcut (`Ctrl + B`).
  - When collapsed: displays only crisp navigation icons with floating tooltips.
  - When expanded: displays icons and section labels (`MAIN`, `MONITORING`, `MANAGEMENT`).
  - Responsive main content area that automatically expands to full width when the sidebar is collapsed.
  - Persistent active navigation state across page visits and refreshes.
  - Mobile responsive drawer with hamburger menu button and backdrop.
- **Professional Dark Navy Theme with Blue Accents**:
  - Deep dark navy palette (`#080d1a`, `#0b132b`, `#0f1c3f`) with electric cyan & sky blue accents (`#38bdf8`, `#0ea5e9`).
  - High contrast text (`Inter` & `JetBrains Mono`).
- **3-Category Noise Level Classification**:
  - **`LOW`** (Below 50 dB) — Emerald Green (Safe acoustic environment)
  - **`MEDIUM`** (50 dB to 70 dB) — Amber (Standard ambient activity)
  - **`HIGH`** (Above 70 dB) — Red (Excessive noise alert)
- **Automatic High Noise Alert Notification**:
  - Automatically triggers a prominent red warning banner when noise exceeds **70 dB**.
  - Web Audio API dual-tone siren plays once upon threshold crossing.
  - Automatically resolves and logs to the Alert History when noise returns to safe levels.
- **Dedicated Multi-Page SPA Experience (No Page Reloads)**:
  - **Overview**: Real-time noise gauge, RMS voltage, connected sensors count, ESP32 status, recent alerts, and live trend line graph.
  - **Live Noise Monitoring**: Instantaneous live dB and RMS readouts, visual LED-style intensity meter, session minimum/maximum, peak-to-peak ($V_{pp}$) variation, session average, and live incoming packet stream with reset capability.
  - **RMS Analysis**: Calculated RMS voltage, session average, minimum and maximum RMS, dedicated RMS history line chart, and technical ADC signal processing formula reference.
  - **Sensor Status**: Full hardware specifications for MAX4466 on ESP32 GPIO 34, live connection pulse, last reading, last communication time ticker, and pinout wiring diagram.
  - **Noise Analytics**: Doughnut exposure breakdown chart, classification metrics (% safe vs % hazardous), and WHO/OSHA environmental standards table.
  - **Alert History**: Stored log of threshold violations with timestamp, noise reading, category, status (`TRIGGERED` / `RESOLVED`), filter by status, search, and CSV export.
  - **Historical Data**: Searchable, filterable table of stored telemetry with category dropdown, custom row count (15, 30, 50, 100, All), and instant search.
  - **Reports**: Downloadable reports based on genuine stored data: Download CSV, Download JSON, and formatted Print / PDF Summary Report.
  - **Settings**: Interactive controls for high and medium noise thresholds, Web Audio siren toggle, audio tone pitch selector, live "Test Alert Audio" button, and persistent `localStorage` saving.
- **Bottom Sidebar Diagnostics**:
  - ESP32 Connection Status (with live pulsing dot).
  - MAX4466 Sensor Status (`GPIO 34 Active` / `No Signal`).
  - System Telemetry Information (`v2.0 • 2.0s Polling`).

---

## 📁 Project Structure

```
noise/
├── backend/
│   ├── main.py              # FastAPI server (telemetry endpoints + static hosting)
│   └── requirements.txt     # Python dependencies (fastapi, uvicorn)
├── frontend/
│   ├── index.html           # Collapsible sidebar interface & all functional pages
│   ├── style.css            # Dark navy theme with blue accents & responsive CSS
│   └── app.js               # Multi-page routing, Web Audio siren, Chart.js & polling
├── esp32/
│   └── esp32_max4466.ino    # Arduino sketch for ESP32 + MAX4466 on GPIO 34
├── simulate_esp32.py        # Telemetry simulator script for testing without hardware
└── README.md                # Documentation and running instructions
```

---

## 🚀 How to Run

### Step 1: Install Backend Dependencies
Open PowerShell or your terminal in the project directory:
```bash
pip install -r backend/requirements.txt
```

### Step 2: Start the FastAPI Backend
Run:
```bash
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
The server will start listening at `http://localhost:8000` (and on your local network IP for ESP32 access).

### Step 3: Open the Dashboard
Open your browser and navigate to:
```
http://localhost:8000
```
- The dashboard will open in **Disconnected** mode until telemetry arrives from your ESP32 or simulator.
- It refreshes automatically every **2 seconds**.

---

## 🧪 Testing Before Connecting Hardware (Simulator)

You can immediately test the dashboard without hardware using the simulator:

1. Keep the FastAPI backend running in one terminal.
2. Open a second terminal and run:
   ```bash
   python simulate_esp32.py
   ```
3. Watch the dashboard instantly update:
   - Sidebar dots turn green (**Connected**, **GPIO 34 Active**).
   - Live dB and RMS values fluctuate.
   - Live charts, analytics doughnut chart, and live packet stream update.
4. Press `Ctrl + C` in the simulator terminal. After 6 seconds of no data, the dashboard will automatically trigger the **Disconnected** banner.

---

## 🔌 Connecting Real ESP32 + MAX4466 Hardware

### Hardware Wiring:
| MAX4466 Pin | ESP32 Pin | Signal Type |
|---|---|---|
| **VCC** | 3.3V | Regulated 3.3V DC Power |
| **GND** | GND | Common Ground |
| **OUT** | GPIO 34 | ADC1_CH6 (Analog Input) |

*(Note: Adjust the small gain potentiometer on the back of the MAX4466 to approximately mid-position).*

### Flashing the ESP32:
1. Open [`esp32/esp32_max4466.ino`](esp32/esp32_max4466.ino) in the **Arduino IDE**.
2. Update your WiFi credentials:
   ```cpp
   const char* ssid     = "YOUR_WIFI_NAME";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```
3. Set your computer's local IP address (find it using `ipconfig` in cmd):
   ```cpp
   const char* serverUrl = "http://192.168.1.XXX:8000/api/readings";
   ```
4. Select board **ESP32 Dev Module** and upload the sketch.
5. Open the Serial Monitor (115200 baud) to view outgoing telemetry. The live dashboard will update automatically!

---

## 📡 API Endpoints

- `GET /api/readings/latest` - Returns the latest estimated dB, RMS voltage, noise status, sensor status, and timestamp.
- `GET /api/readings` - Returns recent history (last 500 readings) for charts, history table, and report generation.
- `POST /api/readings` - Ingests live telemetry from ESP32 (`{"rms": 0.042, "db": 62.5}`).
