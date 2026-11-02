#pragma once
#include <string>
#include "Arduino.h"

class HTTPClient {
public:
    HTTPClient() {}
    ~HTTPClient() {}

    bool begin(const char* url) { return true; }
    bool begin(const String& url) { return true; }
    void addHeader(const String& name, const String& value) {}
    void addHeader(const char* name, const char* value) {}
    int POST(const String& payload) { return 201; }
    int POST(const uint8_t* payload, size_t size) { return 201; }
    String errorToString(int error) { return String("OK"); }
    void end() {}
};
