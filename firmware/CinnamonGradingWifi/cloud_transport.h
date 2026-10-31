#pragma once
#if __has_include("cloud_credentials.h")
#include "cloud_credentials.h"
#else
#include "cloud_credentials.example.h"
#endif
#if CLOUD_ENABLED
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h> // ArduinoJson 7.x
#include <time.h>
#include <esp_system.h>

static unsigned long cloudNextAttempt = 0;
static unsigned long cloudBackoff = 10000;
static String cloudBootId;
static String cloudCommand;

void startCloud() {
  char id[33];
  snprintf(id, sizeof(id), "%08lx%08lx%08lx%08lx", (unsigned long)esp_random(),
    (unsigned long)esp_random(), (unsigned long)esp_random(), (unsigned long)esp_random());
  cloudBootId = id;
  configTime(0, 0, "time.google.com", "pool.ntp.org");
}
int cloudPost(const char* path, const String& payload, bool pairing = false) {
  if (WiFi.status() != WL_CONNECTED || time(nullptr) < 1700000000 ||
      strlen(CLOUD_ROOT_CA) < 100 || strlen(CLOUD_DEVICE_TOKEN) < 40 ||
      !String(CLOUD_BASE_URL).startsWith("https://")) return -1;
  WiFiClientSecure tls;
  tls.setCACert(CLOUD_ROOT_CA);
  tls.setHandshakeTimeout(5);
  HTTPClient http;
  http.setConnectTimeout(5000); http.setTimeout(5000);
  // Do not follow redirects with credentials.
  http.setFollowRedirects(HTTPC_DISABLE_FOLLOW_REDIRECTS);
  if (!http.begin(tls, String(CLOUD_BASE_URL) + path)) return -1;
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", "Bearer " + String(CLOUD_DEVICE_TOKEN));
  int status = http.POST(payload);
  if (pairing && status == 200) {
    JsonDocument response;
    if (!deserializeJson(response, http.getString()) && response["code"].is<const char*>()) {
      Serial.print("Temporary pairing code (10 minutes): ");
      Serial.println(response["code"].as<const char*>());
    }
  }
  http.end();
  return status;
}
void sendCloudReading(int adc, unsigned long sequence) {
  // Only a fresh current sample is sent; never replay offline backlog as fresh.
  if ((long)(millis() - cloudNextAttempt) < 0) return;
  JsonDocument payload;
  payload["device_id"] = CLOUD_DEVICE_ID;
  payload["event_id"] = cloudBootId + "_" + String(sequence);
  payload["adc"] = adc;
  String body; serializeJson(payload, body);
  int status = cloudPost("/cloud/telemetry", body);
  if (status == 200) cloudBackoff = 10000;
  else cloudBackoff = min(cloudBackoff * 2, (unsigned long)60000);
  cloudNextAttempt = millis() + cloudBackoff + esp_random() % 500;
  Serial.print("Cloud telemetry HTTP status: "); Serial.println(status);
}
void handleCloudSerial() {
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      cloudCommand.trim();
      if (cloudCommand == "PAIR") {
        int status = cloudPost("/cloud/device/pair-code", "{}", true);
        Serial.print("Pair request HTTP status: "); Serial.println(status);
      }
      cloudCommand = "";
    } else if (cloudCommand.length() < 16) cloudCommand += c;
  }
}
#else
void startCloud() {}
void sendCloudReading(int, unsigned long) {}
void handleCloudSerial() {}
#endif
