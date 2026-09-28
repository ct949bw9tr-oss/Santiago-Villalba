// EduTrack classroom reader for the M5Stack Dial (ESP32-S3 + WS1850S RFID).
//
// Behaviour:
//  - First start (or after a 5-second button press): opens the Wi-Fi network
//    "EduTrack-Lector". A phone connects to it and a form asks for the
//    school Wi-Fi and the reader token created in EduTrack
//    (Configuracion -> Lectores NFC).
//  - Then it shows "Acerca tu tarjeta". Each card UID is sent to
//    POST /api/v1/attendance/scans with the reader token, exactly like any
//    other EduTrack reader, and the answer is shown with a sound.
//  - Without internet it keeps accepting cards, stores them (also across
//    power cuts) and sends them when the connection comes back.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <M5Dial.h>
#include <Preferences.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <time.h>

#include <vector>

#include "certs.h"
#include "logic.h"

#ifndef EDUTRACK_SERVER
#define EDUTRACK_SERVER "https://santiago-villalba-admin-nu.vercel.app"
#endif

static const char* FW_VERSION = "1.0.0";
static const char* AP_NAME = "EduTrack-Lector";
static const size_t MAX_QUEUE = 150;
static const uint32_t RESULT_MS = 3500;
static const uint32_t RETRY_MS = 5000;
static const uint32_t HEARTBEAT_MS = 10UL * 60UL * 1000UL;
static const uint32_t SAME_CARD_MS = 3000;
static const uint32_t RESET_HOLD_MS = 5000;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

struct Pending {
  String uid;
  String key;
  String at;  // ISO-8601 UTC, empty if the clock wasn't set yet
};

Preferences prefs;
String server;
String token;
String readerName;
String schoolName;
std::vector<Pending> queue;

enum class Screen { Boot, Setup, Ready, Result, Info, Message };
Screen screen = Screen::Boot;
uint32_t returnToReadyAt = 0;
uint32_t lastRetry = 0;
uint32_t lastHeartbeat = 0;
bool lastOnline = false;
String lastUid;
uint32_t lastUidAt = 0;
bool tokenRejected = false;

// ---------------------------------------------------------------------------
// Drawing (240x240 round screen)
// ---------------------------------------------------------------------------

auto& lcd = M5Dial.Display;
const int CX = 120;
const int CY = 120;

uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return lcd.color565(r, g, b); }
uint16_t cNavy() { return rgb(11, 20, 55); }
uint16_t cBlue() { return rgb(61, 107, 255); }
uint16_t cSoft() { return rgb(159, 176, 230); }
uint16_t cGreen() { return rgb(34, 197, 94); }
uint16_t cAmber() { return rgb(245, 165, 36); }
uint16_t cRed() { return rgb(239, 68, 68); }
uint16_t cWhite() { return rgb(255, 255, 255); }

void base(uint16_t ring) {
  lcd.startWrite();
  lcd.fillScreen(cNavy());
  lcd.fillArc(CX, CY, 119, 111, 0, 360, ring);
  lcd.endWrite();
}

void text(const String& s, int y, const lgfx::IFont* font, uint16_t color) {
  lcd.setFont(font);
  lcd.setTextDatum(middle_center);
  lcd.setTextColor(color);
  lcd.drawString(s, CX, y);
}

void onlineDot() {
  bool online = WiFi.status() == WL_CONNECTED;
  uint16_t color = online ? cGreen() : cRed();
  lcd.fillSmoothCircle(CX, 34, 5, color);
  if (!queue.empty()) {
    text(String(queue.size()) + " por enviar", 206, &fonts::FreeSans9pt7b, cAmber());
  }
}

void badge(uint16_t color, edutrack::Tone tone) {
  lcd.fillSmoothCircle(CX, 78, 30, color);
  uint16_t w = cWhite();
  switch (tone) {
    case edutrack::Tone::Ok:
      lcd.drawWideLine(CX - 14, 79, CX - 4, 89, 4, w);
      lcd.drawWideLine(CX - 4, 89, CX + 15, 68, 4, w);
      break;
    case edutrack::Tone::Late:
    case edutrack::Tone::Warn:
      lcd.drawWideLine(CX, 78, CX, 62, 3, w);
      lcd.drawWideLine(CX, 78, CX + 11, 85, 3, w);
      break;
    case edutrack::Tone::Error:
      lcd.drawWideLine(CX - 11, 67, CX + 11, 89, 4, w);
      lcd.drawWideLine(CX + 11, 67, CX - 11, 89, 4, w);
      break;
  }
}

void drawReady() {
  screen = Screen::Ready;
  bool online = WiFi.status() == WL_CONNECTED;
  base(online ? cBlue() : cAmber());
  // NFC waves
  for (int i = 0; i < 3; i++) {
    int r = 16 + i * 11;
    lcd.fillArc(CX - 24, 86, r + 3, r, 320, 360, cSoft());
    lcd.fillArc(CX - 24, 86, r + 3, r, 0, 40, cSoft());
  }
  text("Acerca tu", 132, &fonts::FreeSansBold12pt7b, cWhite());
  text("tarjeta", 158, &fonts::FreeSansBold12pt7b, cWhite());
  if (!online) {
    text("Sin internet", 186, &fonts::FreeSans9pt7b, cAmber());
  } else if (readerName.length()) {
    text(edutrack::toAscii(readerName.c_str()).c_str(), 186, &fonts::FreeSans9pt7b, cSoft());
  }
  onlineDot();
  lastOnline = online;
}

void drawMessage(uint16_t ring, const String& l1, const String& l2, const String& l3 = "") {
  screen = Screen::Message;
  base(ring);
  text(l1, 92, &fonts::FreeSansBold12pt7b, cWhite());
  if (l2.length()) text(l2, 122, &fonts::FreeSans9pt7b, cWhite());
  if (l3.length()) text(l3, 148, &fonts::FreeSans9pt7b, cSoft());
}

void drawSetup() {
  screen = Screen::Setup;
  base(cBlue());
  text("Configurar", 70, &fonts::FreeSans9pt7b, cSoft());
  text("Conectate al Wi-Fi", 104, &fonts::FreeSans9pt7b, cWhite());
  text(AP_NAME, 132, &fonts::FreeSansBold9pt7b, cWhite());
  text("desde tu celular", 160, &fonts::FreeSans9pt7b, cSoft());
}

void drawResult(const edutrack::Feedback& fb, const String& name, const String& detail) {
  screen = Screen::Result;
  uint16_t color = fb.tone == edutrack::Tone::Ok     ? cGreen()
                   : fb.tone == edutrack::Tone::Error ? cRed()
                                                      : cAmber();
  base(color);
  badge(color, fb.tone);
  int y = 136;
  if (name.length()) {
    text(name, y, &fonts::FreeSansBold12pt7b, cWhite());
    y += 28;
    text(String(fb.line1) + (fb.line2[0] ? String(" ") + fb.line2 : String("")), y, &fonts::FreeSans9pt7b, cWhite());
  } else {
    text(fb.line1, y, &fonts::FreeSansBold12pt7b, cWhite());
    y += 26;
    if (fb.line2[0]) text(fb.line2, y, &fonts::FreeSansBold12pt7b, cWhite());
  }
  if (detail.length()) text(detail, 190, &fonts::FreeSans9pt7b, cSoft());
  returnToReadyAt = millis() + RESULT_MS;
}

void drawInfo() {
  screen = Screen::Info;
  base(cSoft());
  text(edutrack::toAscii(schoolName.c_str()).c_str(), 66, &fonts::FreeSansBold9pt7b, cWhite());
  text(edutrack::toAscii(readerName.c_str()).c_str(), 92, &fonts::FreeSans9pt7b, cWhite());
  text(WiFi.status() == WL_CONNECTED ? WiFi.SSID() : String("Sin Wi-Fi"), 120, &fonts::FreeSans9pt7b, cSoft());
  text(String("Pendientes: ") + queue.size(), 146, &fonts::FreeSans9pt7b, cSoft());
  text(String("v") + FW_VERSION, 172, &fonts::FreeSans9pt7b, cSoft());
  returnToReadyAt = millis() + 6000;
}

// ---------------------------------------------------------------------------
// Sound
// ---------------------------------------------------------------------------

void beep(edutrack::Tone tone) {
  switch (tone) {
    case edutrack::Tone::Ok:
      M5Dial.Speaker.tone(4000, 90);
      break;
    case edutrack::Tone::Late:
    case edutrack::Tone::Warn:
      M5Dial.Speaker.tone(3000, 80);
      delay(140);
      M5Dial.Speaker.tone(3000, 80);
      break;
    case edutrack::Tone::Error:
      M5Dial.Speaker.tone(1200, 450);
      break;
  }
}

// ---------------------------------------------------------------------------
// Time
// ---------------------------------------------------------------------------

bool clockReady() { return time(nullptr) > 1700000000; }

String isoNowUtc() {
  if (!clockReady()) return "";
  time_t now = time(nullptr);
  struct tm t;
  gmtime_r(&now, &t);
  char buf[32];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &t);
  return buf;
}

String localClock() {
  if (!clockReady()) return "";
  time_t now = time(nullptr);
  struct tm t;
  localtime_r(&now, &t);
  char buf[16];
  int h = t.tm_hour % 12 == 0 ? 12 : t.tm_hour % 12;
  snprintf(buf, sizeof(buf), "%d:%02d %s", h, t.tm_min, t.tm_hour < 12 ? "a. m." : "p. m.");
  return buf;
}

// ---------------------------------------------------------------------------
// Offline queue (kept in flash so it survives power cuts)
// ---------------------------------------------------------------------------

void saveQueue() {
  JsonDocument doc;
  JsonArray arr = doc.to<JsonArray>();
  for (auto& p : queue) {
    JsonObject o = arr.add<JsonObject>();
    o["u"] = p.uid;
    o["k"] = p.key;
    o["a"] = p.at;
  }
  String out;
  serializeJson(doc, out);
  prefs.putString("queue", out);
}

void loadQueue() {
  queue.clear();
  String raw = prefs.getString("queue", "[]");
  JsonDocument doc;
  if (deserializeJson(doc, raw)) return;
  for (JsonObject o : doc.as<JsonArray>()) {
    queue.push_back({o["u"].as<String>(), o["k"].as<String>(), o["a"].as<String>()});
  }
}

void enqueue(const Pending& p) {
  if (queue.size() >= MAX_QUEUE) queue.erase(queue.begin());
  queue.push_back(p);
  saveQueue();
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

struct Reply {
  int status;  // HTTP status, or < 0 for a network error
  JsonDocument body;
};

Reply request(const char* method, const String& path, const String& payload, const String& idemKey) {
  Reply reply;
  reply.status = -1;
  if (WiFi.status() != WL_CONNECTED) return reply;

  HTTPClient http;
  WiFiClientSecure secure;
  WiFiClient plain;
  String url = server + path;
  bool ok;
  if (url.startsWith("https://")) {
    secure.setCACert(ROOT_CAS);
    ok = http.begin(secure, url);
  } else {
    ok = http.begin(plain, url);  // local testing only
  }
  if (!ok) return reply;
  http.setTimeout(10000);
  http.addHeader("Authorization", "Bearer " + token);
  http.addHeader("Content-Type", "application/json");
  if (idemKey.length()) http.addHeader("Idempotency-Key", idemKey);

  int code = strcmp(method, "POST") == 0 ? http.POST(payload) : http.GET();
  reply.status = code;
  if (code > 0) deserializeJson(reply.body, http.getString());
  http.end();
  return reply;
}

Reply postScan(const Pending& p) {
  JsonDocument doc;
  doc["uid"] = p.uid;
  if (p.at.length()) doc["scanned_at"] = p.at;
  JsonObject reader = doc["reader"].to<JsonObject>();
  reader["model"] = "m5stack-dial";
  reader["firmware"] = FW_VERSION;
  String payload;
  serializeJson(doc, payload);
  return request("POST", "/api/v1/attendance/scans", payload, p.key);
}

// Checks the token and learns the names to display; also a heartbeat.
bool fetchIdentity() {
  Reply r = request("GET", "/api/v1/devices/me", "", "");
  if (r.status == 401) {
    tokenRejected = true;
    return false;
  }
  if (r.status != 200) return false;
  tokenRejected = false;
  readerName = r.body["device"]["name"].as<String>();
  schoolName = r.body["school"]["name"].as<String>();
  String tz = r.body["school"]["timezone"].as<String>();
  prefs.putString("rname", readerName);
  prefs.putString("sname", schoolName);
  if (tz.length() && tz != prefs.getString("tz", "")) {
    prefs.putString("tz", tz);
    setenv("TZ", edutrack::posixTimezone(tz.c_str()), 1);
    tzset();
  }
  return true;
}

String newKey() {
  char buf[40];
  snprintf(buf, sizeof(buf), "dial-%08lx%08lx%08lx", (unsigned long)esp_random(), (unsigned long)esp_random(),
           (unsigned long)esp_random());
  return buf;
}

// ---------------------------------------------------------------------------
// Card taps
// ---------------------------------------------------------------------------

void showReply(Reply& r) {
  if (r.status == 401) {
    tokenRejected = true;
    edutrack::Feedback fb{edutrack::Tone::Error, "Lector no", "autorizado"};
    beep(fb.tone);
    drawResult(fb, "", "Revisa el token");
    return;
  }
  if (r.status != 200) {
    edutrack::Feedback fb{edutrack::Tone::Error, "No se pudo", "registrar"};
    beep(fb.tone);
    drawResult(fb, "", String("Error ") + r.status);
    return;
  }
  std::string outcome = r.body["outcome"] | "";
  std::string status = r.body["attendance"]["status"] | "";
  std::string name = r.body["student"]["display_name"] | "";
  edutrack::Feedback fb = edutrack::describeOutcome(outcome, status);
  String detail;
  if (outcome == "recorded") {
    detail = localClock();
  } else if (outcome == "duplicate") {
    detail = "";
  }
  beep(fb.tone);
  drawResult(fb, edutrack::toAscii(name).c_str(), detail);
}

void handleTap(const String& uid) {
  Pending p{uid, newKey(), isoNowUtc()};
  if (WiFi.status() != WL_CONNECTED) {
    enqueue(p);
    edutrack::Feedback fb{edutrack::Tone::Warn, "Guardada", "sin internet"};
    beep(fb.tone);
    drawResult(fb, "", "Se enviara al volver");
    return;
  }
  drawMessage(cBlue(), "Leyendo...", "", "");
  Reply r = postScan(p);
  if (r.status < 0 || r.status >= 500) {
    enqueue(p);
    edutrack::Feedback fb{edutrack::Tone::Warn, "Guardada", "sin conexion"};
    beep(fb.tone);
    drawResult(fb, "", "Se enviara sola");
    return;
  }
  showReply(r);
}

void flushOne() {
  if (queue.empty() || WiFi.status() != WL_CONNECTED) return;
  Reply r = postScan(queue.front());
  if (r.status < 0 || r.status >= 500) return;  // still unreachable: try later
  queue.erase(queue.begin());                   // delivered, or rejected for good
  saveQueue();
  if (screen == Screen::Ready) drawReady();
}

// ---------------------------------------------------------------------------
// Setup portal
// ---------------------------------------------------------------------------

bool shouldSave = false;

void runPortal(bool force) {
  WiFiManager wm;
  wm.setTitle("EduTrack");
  wm.setHostname("edutrack-lector");
  wm.setConnectTimeout(20);
  std::vector<const char*> menu = {"wifi", "exit"};
  wm.setMenu(menu);
  wm.setCustomHeadElement(
      "<style>body{font-family:system-ui,sans-serif}button{background:#2f5bea;border-radius:8px}</style>");

  WiFiManagerParameter pToken("token", "Token del lector (EduTrack &rarr; Configuracion &rarr; Lectores NFC)",
                              token.c_str(), 80);
  WiFiManagerParameter pServer("server", "Direccion de EduTrack", server.c_str(), 120);
  wm.addParameter(&pToken);
  wm.addParameter(&pServer);
  wm.setSaveConfigCallback([]() { shouldSave = true; });
  wm.setSaveParamsCallback([]() { shouldSave = true; });
  wm.setAPCallback([](WiFiManager*) { drawSetup(); });

  bool connected = force || token.isEmpty() ? wm.startConfigPortal(AP_NAME) : wm.autoConnect(AP_NAME);

  if (shouldSave) {
    String t = String(pToken.getValue());
    String s = String(pServer.getValue());
    t.trim();
    s.trim();
    while (s.endsWith("/")) s.remove(s.length() - 1);
    if (t.length()) {
      token = t;
      prefs.putString("token", token);
    }
    if (s.length()) {
      server = s;
      prefs.putString("server", server);
    }
    shouldSave = false;
  }
  if (!connected) {
    drawMessage(cAmber(), "Sin Wi-Fi", "Reintentando...", "");
  }
}

void factoryReset() {
  drawMessage(cRed(), "Reiniciando", "configuracion", "");
  M5Dial.Speaker.tone(2000, 300);
  WiFiManager wm;
  wm.resetSettings();
  prefs.remove("token");
  prefs.remove("rname");
  prefs.remove("sname");
  delay(800);
  ESP.restart();
}

// ---------------------------------------------------------------------------
// Arduino entry points
// ---------------------------------------------------------------------------

void setup() {
  auto cfg = M5.config();
  M5Dial.begin(cfg, false, true);
  lcd.setBrightness(160);
  M5Dial.Speaker.setVolume(200);

  prefs.begin("edutrack", false);
  server = prefs.getString("server", EDUTRACK_SERVER);
  token = prefs.getString("token", "");
  readerName = prefs.getString("rname", "");
  schoolName = prefs.getString("sname", "");
  String tz = prefs.getString("tz", "America/Bogota");
  setenv("TZ", edutrack::posixTimezone(tz.c_str()), 1);
  tzset();
  loadQueue();

  drawMessage(cBlue(), "EduTrack", "Iniciando...", String("v") + FW_VERSION);
  WiFi.mode(WIFI_STA);
  runPortal(false);
  while (token.isEmpty()) runPortal(true);

  configTzTime(edutrack::posixTimezone(tz.c_str()), "pool.ntp.org", "time.google.com");
  if (WiFi.status() == WL_CONNECTED) {
    drawMessage(cBlue(), "Conectando", "con EduTrack...", "");
    fetchIdentity();
  }
  lastHeartbeat = millis();
  if (tokenRejected) {
    drawMessage(cRed(), "Token no valido", "Manten el boton 5 s", "para configurar");
  } else {
    M5Dial.Speaker.tone(4000, 60);
    drawReady();
  }
}

void loop() {
  M5Dial.update();
  uint32_t now = millis();

  // Button: short press = info, hold 5 s = reconfigure.
  if (M5Dial.BtnA.pressedFor(RESET_HOLD_MS)) factoryReset();
  if (M5Dial.BtnA.wasReleased() && screen != Screen::Info) drawInfo();

  // Back to the ready screen after a result or the info screen.
  if (returnToReadyAt && now > returnToReadyAt) {
    returnToReadyAt = 0;
    if (!tokenRejected) drawReady();
  }

  // Connection indicator follows Wi-Fi changes.
  bool online = WiFi.status() == WL_CONNECTED;
  if (screen == Screen::Ready && online != lastOnline) drawReady();

  // Send stored taps, and a periodic heartbeat.
  if (now - lastRetry > RETRY_MS) {
    lastRetry = now;
    flushOne();
  }
  if (online && now - lastHeartbeat > HEARTBEAT_MS) {
    lastHeartbeat = now;
    bool wasRejected = tokenRejected;
    fetchIdentity();
    if (wasRejected && !tokenRejected) drawReady();
  }

  // Cards.
  if (M5Dial.Rfid.PICC_IsNewCardPresent() && M5Dial.Rfid.PICC_ReadCardSerial()) {
    std::string hex = edutrack::uidToHex(M5Dial.Rfid.uid.uidByte, M5Dial.Rfid.uid.size);
    M5Dial.Rfid.PICC_HaltA();
    String uid = hex.c_str();
    bool repeat = uid == lastUid && now - lastUidAt < SAME_CARD_MS;
    lastUid = uid;
    lastUidAt = now;
    if (!repeat && !tokenRejected) handleTap(uid);
    if (tokenRejected && !repeat) {
      beep(edutrack::Tone::Error);
      drawMessage(cRed(), "Token no valido", "Manten el boton 5 s", "para configurar");
    }
  }
  delay(20);
}
