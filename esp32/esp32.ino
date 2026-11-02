/*
 * =========================================================================
 * ESP32 + MAX4466 Sound Sensor Telemetry
 * Noise Pollution Monitoring System
 * =========================================================================
 *
 * Hardware Connections:
 *   MAX4466 VCC  --> ESP32 3.3V (Do NOT use 5V to protect ADC)
 *   MAX4466 GND  --> ESP32 GND
 *   MAX4466 OUT  --> ESP32 GPIO 34 (ADC1 channel, works with WiFi active)
 *
 * Description:
 *   Samples sound waveform over a 50ms window, calculates Root Mean Square
 *   (RMS) voltage and estimated noise level (dB), then sends an HTTP/HTTPS POST
 *   request every 2 seconds to the FastAPI backend at /api/readings.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>

// ================================================================
// 1. CLOUD / LOCAL TOGGLE
// ================================================================
// Set to 1: Sends data to your LIVE Vercel website (https://noise-pollution-and-monitoring.vercel.app)
// Set to 0: Sends data to your LOCAL PC server (http://10.42.81.129:8000)
#define USE_VERCEL_CLOUD 1

// ================================================================
// 2. WI-FI CONFIGURATION (Must be 2.4 GHz band)
// ================================================================
// Note: ESP32 only supports 2.4 GHz Wi-Fi.
// If using Samsung hotspot, turn on "Maximize Compatibility" (forces 2.4 GHz).
const char *ssid = "Saravana's S23 FE";
const char *password = "11111111";

// ================================================================
// 3. TARGET BACKEND URL
// ================================================================
#if USE_VERCEL_CLOUD
const char *serverUrl = "https://noise-pollution-and-monitoring.vercel.app/api/readings";
#else
const char *serverUrl = "http://10.42.81.129:8000/api/readings";
#endif

// ================================================================
// 4. SENSOR PIN & ADC CONFIGURATION
// ================================================================
const int MIC_PIN = 34;                    // GPIO 34 (ADC1_CH6)
const unsigned long SAMPLE_WINDOW_MS = 50; // 50ms sample window (20Hz)
const float ADC_REF_VOLTAGE = 3.3;         // 3.3V reference
const int ADC_RESOLUTION = 4095;           // 12-bit ADC

void setup() {
  Serial.begin(115200);
  delay(1000);
  Serial.println("\n==================================================");
  Serial.println("  Noise Pollution Monitoring System (ESP32)");
  Serial.println("==================================================");

  // Configure ADC pin
  pinMode(MIC_PIN, INPUT);
  analogReadResolution(12); // 12-bit resolution (0 - 4095)

  // Connect to Wi-Fi
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi Connected successfully!");
    Serial.print("ESP32 IP Address : ");
    Serial.println(WiFi.localIP());
    Serial.print("Target Server URL : ");
    Serial.println(serverUrl);
  } else {
    Serial.println("\nWiFi connection failed! Please check SSID, password, and ensure 2.4 GHz band.");
  }
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

  // Calculate Estimated dB (Acoustic approximation for MAX4466)
  // Formula: 20 * log10(V_rms / V_ref)
  float estimatedDb = 35.0; // Ambient default floor
  if (rmsVoltage > 0.0005) {
    float calcDb = 20.0 * log10(rmsVoltage / 0.001);
    estimatedDb = constrain(calcDb, 30.0, 105.0);
  }

  Serial.printf("[Sensor] RMS: %.4f V | Noise: %5.1f dB\n", rmsVoltage, estimatedDb);

  // Send Telemetry to Backend
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;

#if USE_VERCEL_CLOUD
    WiFiClientSecure secureClient;
    secureClient.setInsecure(); // Skip SSL certificate validation for cloud endpoint
    http.begin(secureClient, serverUrl);
#else
    http.begin(serverUrl);
#endif

    http.setTimeout(5000); // 5s timeout to avoid loop blocking
    http.addHeader("Content-Type", "application/json");

    // Construct JSON Payload
    String jsonPayload = "{\"rms\": " + String(rmsVoltage, 4) +
                         ", \"db\": " + String(estimatedDb, 1) + "}";

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0) {
      Serial.printf(" -> Cloud Response Code: %d (OK)\n", httpResponseCode);
    } else {
      Serial.printf(" -> Error sending POST: %s\n", http.errorToString(httpResponseCode).c_str());
    }

    http.end();
  } else {
    Serial.println("[WiFi] Lost connection. Reconnecting...");
    WiFi.reconnect();
  }

  // Send every 2 seconds
  delay(2000);
}
