#include <WiFi.h>
#include <WiFiMulti.h>
#include <WebServer.h>
#include "wifi_credentials.h"
#include "cloud_transport.h"

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
// Empirical screening thresholds; ADC does not provide a calibrated percentage.
const int ADC_THRESHOLD = 1711;
const int ADC_UNTOUCHED_THRESHOLD = 2850;

const char *screeningStatus(int adc) {
  return adc >= ADC_UNTOUCHED_THRESHOLD ? "UNTOUCHED" : adc >= ADC_THRESHOLD ? "PASS" : "FAIL";
}
const char *DEVICE_NAME = "CinnamonGradingSensor";

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
const char *SERVICE_UUID = "7f510001-8c3d-4b89-a9e7-71c3a0000001";
const char *MOISTURE_CHARACTERISTIC_UUID = "7f510002-8c3d-4b89-a9e7-71c3a0000001";
BLECharacteristic *moistureCharacteristic = nullptr;
volatile bool deviceConnected = false;
class ServerCallbacks : public BLEServerCallbacks {
  // Mark the optional BLE client connected so notifications can be sent.
  void onConnect(BLEServer *server) override {
    deviceConnected = true;
  }
  // Clear BLE connection state and resume advertising for another connection.
  void onDisconnect(BLEServer *server) override {
    deviceConnected = false;
    BLEDevice::startAdvertising();
  }
};
// Initialize the optional ADC read/notify BLE service and start advertising.
void startBle() {
  BLEDevice::init(DEVICE_NAME);
  BLEServer *bleServer = BLEDevice::createServer();
  bleServer->setCallbacks(new ServerCallbacks());
  BLEService *service = bleServer->createService(SERVICE_UUID);
  moistureCharacteristic = service->createCharacteristic(
      MOISTURE_CHARACTERISTIC_UUID,
      BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  moistureCharacteristic->addDescriptor(new BLE2902());
  service->start();
  BLEAdvertising *advertising = BLEDevice::getAdvertising();
  advertising->addServiceUUID(SERVICE_UUID);
  advertising->setScanResponse(true);
  BLEDevice::startAdvertising();
}
#endif

// Keep the HTTP server responsive while retaining the original sampling delay.
void responsiveDelay(unsigned long durationMs) {
  const unsigned long started = millis();
  while (millis() - started < durationMs) {
    if (serverStarted)
      server.handleClient();
    delay(1);
  }
}

// Sample GPIO34 twenty times and return the integer median after sorting.
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

// Serve the latest raw ADC, sample age and provisional status through the local HTTP
// endpoint.
void sendSensorReading() {
  server.sendHeader("Cache-Control", "no-store");
  // Allow the existing browser preview to read this local development endpoint too.
  server.sendHeader("Access-Control-Allow-Origin", "*");
  if (!hasReading) {
    server.send(503, "application/json",
                "{\"error\":\"Waiting for the first median ADC sample\"}");
    return;
  }
  String json = "{\"device\":\"" + String(DEVICE_NAME) + "\"";
  json += ",\"median_adc\":" + String(medianADC);
  json += ",\"sample_sequence\":" + String(sampleSequence);
  json += ",\"age_ms\":" + String(millis() - sampleUpdatedAt);
  json += ",\"threshold\":" + String(ADC_THRESHOLD);
  json += ",\"provisional\":true";
  json +=
      ",\"status\":\"" + String(screeningStatus(medianADC)) + "\"}";
  server.send(200, "application/json", json);
}

// Reconnect to a configured network and restart the local server when its IP changes.
void maintainWifi() {
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiAttempt >= 10000) {
    lastWifiAttempt = millis();
    Serial.println("Trying configured Wi-Fi networks...");
    wifiMulti.run(5000);
  }
  if (WiFi.status() != WL_CONNECTED) {
    if (serverStarted) {
      server.stop();
      serverStarted = false;
      lastAddress = "";
    }
    return;
  }
  const String address = WiFi.localIP().toString();
  if (!serverStarted || address != lastAddress) {
    if (serverStarted)
      server.stop();
    server.begin();
    serverStarted = true;
    lastAddress = address;
    Serial.print("Connected to: ");
    Serial.println(WiFi.SSID());
    Serial.print("Sensor endpoint: http://");
    Serial.print(address);
    Serial.println("/sensor");
  }
}

// Initialize serial, ADC, saved Wi-Fi networks and the enabled sensor transports.
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);
  delay(1000);
  Serial.println("\nCinnamon moisture sensor: Wi-Fi / ADC screening: PASS 1711-2849, untouched >=2850");
  WiFi.mode(WIFI_STA);
  WiFi.setHostname("cinnamon-sensor");
  if (strlen(WIFI_SSID_1) > 0)
    wifiMulti.addAP(WIFI_SSID_1, WIFI_PASSWORD_1);
  if (strlen(WIFI_SSID_2) > 0)
    wifiMulti.addAP(WIFI_SSID_2, WIFI_PASSWORD_2);
  // Optional third personal/shared-password network; older credentials still compile.
#if defined(WIFI_SSID_3) && defined(WIFI_PASSWORD_3)
  if (strlen(WIFI_SSID_3) > 0)
    wifiMulti.addAP(WIFI_SSID_3, WIFI_PASSWORD_3);
#endif
  server.on("/sensor", HTTP_GET, sendSensorReading);
  startCloud();
  lastWifiAttempt = millis() - 10000;
#if ENABLE_BLE
  startBle();
#endif
}

// Acquire the next median ADC sample and service local, cloud and optional BLE
// communication.
void loop() {
  maintainWifi();
  handleCloudSerial();
  medianADC = readMedianADC();
  sampleUpdatedAt = millis();
  sampleSequence++;
  hasReading = true;
  Serial.print("Median ADC: ");
  Serial.print(medianADC);
  Serial.print(" | Screening: ");
  Serial.println(screeningStatus(medianADC));
#if ENABLE_BLE
  String value = String(medianADC);
  moistureCharacteristic->setValue(value.c_str());
  if (deviceConnected)
    moistureCharacteristic->notify();
#endif
  sendCloudReading(medianADC, sampleSequence);
  responsiveDelay(2000);
}
