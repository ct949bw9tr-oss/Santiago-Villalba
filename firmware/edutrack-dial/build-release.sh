#!/usr/bin/env bash
# Builds the firmware and publishes a single merged image for the web
# installer (attendance/public/firmware/edutrack-dial/).
set -euo pipefail
cd "$(dirname "$0")"
VERSION=$(grep -oP 'FW_VERSION = "\K[^"]+' src/main.cpp)
OUT=../../attendance/public/firmware/edutrack-dial
pio run
PKG="${PLATFORMIO_CORE_DIR:-$HOME/.platformio}/packages"
mkdir -p "$OUT"
python3 "$PKG/tool-esptoolpy/esptool.py" --chip esp32s3 merge_bin \
  -o "$OUT/edutrack-dial-$VERSION.bin" \
  --flash_mode keep --flash_freq keep --flash_size keep \
  0x0 .pio/build/m5dial/bootloader.bin \
  0x8000 .pio/build/m5dial/partitions.bin \
  0xe000 "$PKG/framework-arduinoespressif32/tools/partitions/boot_app0.bin" \
  0x10000 .pio/build/m5dial/firmware.bin
cat > "$OUT/manifest.json" <<JSON
{
  "name": "Lector EduTrack (M5Stack Dial)",
  "version": "$VERSION",
  "new_install_prompt_erase": true,
  "builds": [
    { "chipFamily": "ESP32-S3", "parts": [{ "path": "edutrack-dial-$VERSION.bin", "offset": 0 }] }
  ]
}
JSON
find "$OUT" -name 'edutrack-dial-*.bin' ! -name "edutrack-dial-$VERSION.bin" -delete
echo "Published $OUT/edutrack-dial-$VERSION.bin"
