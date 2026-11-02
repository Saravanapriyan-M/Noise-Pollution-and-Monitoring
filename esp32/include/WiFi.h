#pragma once
#include <string>

enum wl_status_t {
    WL_NO_SHIELD = 255,
    WL_IDLE_STATUS = 0,
    WL_NO_SSID_AVAIL = 1,
    WL_SCAN_COMPLETED = 2,
    WL_CONNECTED = 3,
    WL_CONNECT_FAILED = 4,
    WL_CONNECTION_LOST = 5,
    WL_DISCONNECTED = 6
};

class IPAddress {
public:
    IPAddress() {}
    std::string toString() const { return "10.42.81.129"; }
};

inline std::string to_string(const IPAddress& ip) { return ip.toString(); }

class WiFiClass {
public:
    wl_status_t status() { return WL_CONNECTED; }
    void begin(const char* ssid, const char* passphrase = nullptr) {}
    IPAddress localIP() { return IPAddress(); }
    bool reconnect() { return true; }
    bool disconnect(bool wifioff = false) { return true; }
};

extern WiFiClass WiFi;
