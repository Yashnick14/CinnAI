#include <WiFi.h>
#include <WiFiMulti.h>
#include <WebServer.h>
#include "wifi_credentials.h"

// Wi-Fi is the transport for Expo Go. Enable only if you also want BLE available.
#define ENABLE_BLE 0
#if ENABLE_BLE
#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>
#endif

#define MOISTURE_PIN 34
const int SAMPLE_COUNT = 20;
// PROVISIONAL prototype threshold, NOT an ADC-to-percent calibration.
const int ADC_THRESHOLD = 2842;
const char* DEVICE_NAME = "CinnamonGradingSensor";

WiFiMulti wifiMulti;
WebServer server(80);
int medianADC = 0;
bool hasReading = false;
unsigned long sampleUpdatedAt = 0;
unsigned long sampleSequence = 0;
unsigned long lastWifiAttempt = 0;
String lastAddress;
bool serverStarted = false;

#if ENABLE_BLE
const char* SERVICE_UUID = "7f510001-8c3d-4b89-a9e7-71c3a0000001";
const char* MOISTURE_CHARACTERISTIC_UUID = "7f510002-8c3d-4b89-a9e7-71c3a0000001";
BLECharacteristic* moistureCharacteristic = nullptr;
volatile bool deviceConnected = false;
class ServerCallbacks : public BLEServerCallbacks {
  void onConnect(BLEServer* server) override { deviceConnected = true; }
  void onDisconnect(BLEServer* server) override {
    deviceConnected = false;
    BLEDevice::startAdvertising();
  }
};
void startBle() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer* bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  BLEService* service = bleServer->createService(SERVICE_UUID);
  moistureCharacteristic = service->createCharacteristic(
    MOISTURE_CHARACTERISTIC_UUID,
    BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  moistureCharacteristic->addDescriptor(new BLE2902());
  service->start();
  BLEAdvertising* advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
}
#endif

// Keep the HTTP server responsive while retaining the original sampling delay.
void responsiveDelay(unsigned long durationMs) {
  const unsigned long started = millis();
  while (millis() - started < durationMs) {
    if (serverStarted) server.handleClient();
    delay(1);
  }
}

int readMedianADC() {
  int readings[SAMPLE_COUNT];
  for (int i = 0; i < SAMPLE_COUNT; i++) {
    readings[i] = analogRead(MOISTURE_PIN);
    responsiveDelay(50);
  }
  for (int i = 0; i < SAMPLE_COUNT - 1; i++) {
    for (int j = i + 1; j < SAMPLE_COUNT; j++) {
      if (readings[j] < readings[i]) {
        const int temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }
  return (readings[SAMPLE_COUNT / 2 - 1] + readings[SAMPLE_COUNT / 2]) / 2;
}

void sendSensorReading() {
  server.sendHeader("Cache-Control", "no-store");
  // Allow the existing browser preview to read this local development endpoint too.
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!hasReading) {
    server.send(503, "application/json", "{\"error\":\"Waiting for the first median ADC sample\"}");
    return;
  }
  String json = "{\"device\":\"" + String(DEVICE_NAME) + "\"";
  json += ",\"median_adc\":" + String(medianADC);
  json += ",\"sample_sequence\":" + String(sampleSequence);
  json += ",\"age_ms\":" + String(millis() - sampleUpdatedAt);
  json += ",\"threshold\":" + String(ADC_THRESHOLD);
  json += ",\"provisional\":true";
  json += ",\"status\":\"" + String(medianADC >= ADC_THRESHOLD ? "PASS" : "FAIL") + "\"}";
  server.send(200, "application/json", json);
}

void maintainWifi() {
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiAttempt >= 10000) {
    lastWifiAttempt = millis();
    Serial.println("Trying configured Wi-Fi networks...");
    wifiMulti.run(5000);
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (serverStarted) { server.stop(); serverStarted = false; lastAddress = ""; }
    return;
  }
  const String address = WiFi.localIP().toString();
  if (!serverStarted || address != lastAddress) {
    if (serverStarted) server.stop();
    server.begin();
    serverStarted = true;
    lastAddress = address;
    Serial.print("Connected to: "); Serial.println(WiFi.SSID());
    Serial.print("Sensor endpoint: http://"); Serial.print(address); Serial.println("/sensor");
  }
}

void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  delay(1000);
  Serial.println("\nCinnamon moisture sensor: Wi-Fi / PROVISIONAL ADC threshold 2842");
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("cinnamon-sensor");
  wifiMulti.addAP(WIFI_SSID_1, WIFI_PASSWORD_1);
  wifiMulti.addAP(WIFI_SSID_2, WIFI_PASSWORD_2);
  server.on("/sensor", HTTP_GET, sendSensorReading);
  lastWifiAttempt = millis() - 10000;
#if ENABLE_BLE
  startBle();
#endif
}

void loop() {
  maintainWifi();
  medianADC = readMedianADC();
  sampleUpdatedAt = millis();
  sampleSequence++;
  hasReading = true;
  Serial.print("Median ADC: "); Serial.print(medianADC);
  Serial.println(medianADC >= ADC_THRESHOLD
    ? " | PROVISIONAL PASS / Below 14%"
    : " | PROVISIONAL FAIL / 14% or Above");
#if ENABLE_BLE
  String value = String(medianADC);
  moistureCharacteristic->setValue(value.c_str());
  if (deviceConnected) moistureCharacteristic->notify();
#endif
  responsiveDelay(2000);
}
