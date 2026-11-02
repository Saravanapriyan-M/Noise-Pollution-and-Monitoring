#pragma once
#include <stdint.h>
#include <stddef.h>
#include <string>
#include <cmath>

#define INPUT 0x0
#define OUTPUT 0x1
#define INPUT_PULLUP 0x2
#define HIGH 0x1
#define LOW 0x0

#ifndef constrain
#define constrain(amt, low, high) ((amt) < (low) ? (low) : ((amt) > (high) ? (high) : (amt)))
#endif

class HardwareSerial {
public:
    void begin(unsigned long baud) {}
    void print(const char* s) {}
    void print(const std::string& s) {}
    void print(int val) {}
    void print(float val) {}
    void println(const char* s = "") {}
    void println(const std::string& s) {}
    void println(int val) {}
    void println(float val) {}
    void println(double val) {}
    template<typename T>
    void println(const T& val) {}
    template<typename... Args>
    void printf(const char* format, Args... args) {}
};

extern HardwareSerial Serial;

void pinMode(uint8_t pin, uint8_t mode);
void analogReadResolution(uint8_t bits);
int analogRead(uint8_t pin);
unsigned long millis();
void delay(unsigned long ms);

class String : public std::string {
public:
    String() : std::string() {}
    String(const char* s) : std::string(s ? s : "") {}
    String(const std::string& s) : std::string(s) {}
    String(int val) : std::string(std::to_string(val)) {}
    String(unsigned int val) : std::string(std::to_string(val)) {}
    String(long val) : std::string(std::to_string(val)) {}
    String(unsigned long val) : std::string(std::to_string(val)) {}
    String(float val, int decimals = 2) : std::string(std::to_string(val)) {}
    String(double val, int decimals = 2) : std::string(std::to_string(val)) {}
    const char* c_str() const { return std::string::c_str(); }
};

inline String operator+(const char* a, const String& b) {
    return String(std::string(a) + b);
}

inline String operator+(const String& a, const char* b) {
    return String(a + std::string(b));
}

inline String operator+(const String& a, const String& b) {
    return String(static_cast<const std::string&>(a) + static_cast<const std::string&>(b));
}

