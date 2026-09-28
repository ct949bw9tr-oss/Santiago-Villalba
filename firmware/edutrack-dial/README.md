# EduTrack Wi-Fi reader (M5Stack Dial)

Firmware that turns an **M5Stack Dial** (ESP32-S3 + WS1850S 13.56 MHz RFID,
round screen, buzzer) into a classroom attendance reader for EduTrack. It only
needs a USB-C phone charger and the school Wi-Fi.

## What it does

- **First start** (or after holding the button 5 s): opens the Wi-Fi network
  `EduTrack-Lector`. From a phone, connect to it and fill in the school Wi-Fi,
  the reader token (EduTrack → Configuración → Lectores NFC) and the EduTrack
  address.
- **Normal use:** shows "Acerca tu tarjeta"; each card UID goes to
  `POST /api/v1/attendance/scans` with the reader token (same contract as any
  reader, see `attendance/docs/API.md`) and the result is shown with a sound:
  green ✓ present, amber late / duplicate, red ✗ with the reason.
- **Offline:** keeps accepting cards, stores up to 150 taps in flash (survives
  power cuts) and uploads them with their original time when back online.
- **Button:** short press shows school, reader, Wi-Fi and pending taps.

## Install on a Dial

Easiest: EduTrack → Configuración → Lectores NFC → **Instalar lector Wi-Fi**
(Chrome/Edge on a computer, USB-C data cable). It flashes
`attendance/public/firmware/edutrack-dial/edutrack-dial-<version>.bin`.

## Build

Requires PlatformIO (`pip install platformio`).

```bash
cd firmware/edutrack-dial
pio run                 # build
pio run -t upload       # flash a connected Dial
./build-release.sh      # build + publish the merged image for the web installer
g++ -std=c++17 test/logic_test.cpp -o /tmp/lt && /tmp/lt   # unit tests of src/logic.h
```

The default EduTrack address is set by `EDUTRACK_SERVER` in `src/main.cpp`
(overridable in the setup form). `src/certs.h` holds the public root CAs
(Let's Encrypt, Google Trust Services, GlobalSign, DigiCert, Amazon, Sectigo)
used to verify HTTPS; regenerate it from a current CA store if a hosting
provider changes issuer.

## Limits

- Wi-Fi: 2.4 GHz WPA/WPA2 with password. Captive-portal and enterprise
  (username + password) networks are not supported yet.
- Cards are read at 2–4 cm.
