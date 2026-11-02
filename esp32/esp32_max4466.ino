/*
 * =========================================================================
 * ESP32 + MAX4466 Sound Sensor Telemetry
 * Noise Pollution Monitoring System
 * =========================================================================
 *
 * Hardware Connections:
 *   MAX4466 VCC  --> ESP32 3.3V
 *   MAX4466 GND  --> ESP32 GND
 *   MAX4466 OUT  --> ESP32 GPIO 34 (ADC1 channel, works with WiFi active)
 *
 * Description:
 *   Samples sound waveform over a 50ms window, calculates Root Mean Square
 *   (RMS) voltage and estimated noise level (dB), then sends an HTTP POST
 *   request every 2 seconds to the FastAPI backend at /api/readings.
 */

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFi.h>

// ---------------------- WiFi Configuration ----------------------
const char *ssid = "Saravana's S23 FE";
const char *password = "11111111";

// ---------------------- Backend Server URL ----------------------
// Connected to Saravana's S23 FE hotspot (PC IP: 10.42.81.129)
const char *serverUrl = "http://10.42.81.129:8000/api/readings";

// ---------------------- Sensor Pin & ADC ------------------------
const int MIC_PIN = 34;                    // GPIO 34 (ADC1_CH6)
const unsigned long SAMPLE_WINDOW_MS = 50; // 50ms sample window (20Hz)
const float ADC_REF_VOLTAGE = 3.3;         // 3.3V reference
const int ADC_RESOLUTION = 4095;           // 12-bit ADC

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n--- Noise Pollution Monitoring System (ESP32) ---");

  // Configure ADC pin
  pinMode(MIC_PIN, INPUT);
  analogReadResolution(12); // 12-bit (0-4095)

  // Connect to Wi-Fi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi Connected!");
  Serial.print("ESP32 IP Address: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  // Sample audio waveform over 50ms window
  unsigned long startMillis = millis();
  float sumSquares = 0.0;
  int sampleCount = 0;

  // DC bias level (center voltage is ~1.65V on 3.3V rail)
  const float DC_OFFSET_VOLTS = 1.65;

  while (millis() - startMillis < SAMPLE_WINDOW_MS) {
    int rawValue = analogRead(MIC_PIN);
    float voltage = (rawValue / (float)ADC_RESOLUTION) * ADC_REF_VOLTAGE;

    // AC component (remove DC bias)
    float acVoltage = voltage - DC_OFFSET_VOLTS;
    sumSquares += (acVoltage * acVoltage);
    sampleCount++;
  }

  // Calculate Root Mean Square (RMS) Voltage
  float rmsVoltage = 0.0;
  if (sampleCount > 0) {
    rmsVoltage = sqrt(sumSquares / sampleCount);
  }

  // Calculate Estimated dB (Uncalibrated approximation for MAX4466)
  // Formula: 20 * log10(V_rms / V_ref) + offset
  float estimatedDb = 35.0; // Ambient default floor
  if (rmsVoltage > 0.0005) {
    float calcDb = 20.0 * log10(rmsVoltage / 0.001);
    estimatedDb = constrain(calcDb, 30.0, 105.0);
  }

  Serial.printf("RMS: %.4f V | Estimated Noise: %.1f dB\n", rmsVoltage,
                estimatedDb);

  // Send Telemetry to FastAPI Backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");

    // JSON Payload
    String jsonPayload = "{\"rms\": " + String(rmsVoltage, 4) +
                         ", \"db\": " + String(estimatedDb, 1) + "}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.printf("POST Response Code: %d\n", httpResponseCode);
    } else {
      Serial.printf("Error on POST request: %s\n",
                    http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected. Reconnecting...");
    WiFi.reconnect();
  }

  // Refresh every 2 seconds
  delay(2000);
}
