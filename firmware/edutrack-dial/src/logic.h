// Pure helpers (no hardware), so they can be unit-tested on a computer.
#pragma once

#include <stdint.h>
#include <stddef.h>
#include <string>

namespace edutrack {

// Card UID bytes -> canonical uppercase hex ("04A22B1C"), the format EduTrack stores.
inline std::string uidToHex(const uint8_t* bytes, size_t len) {
  static const char* digits = "0123456789ABCDEF";
  std::string out;
  for (size_t i = 0; i < len; i++) {
    out += digits[bytes[i] >> 4];
    out += digits[bytes[i] & 0x0F];
  }
  return out;
}

// The display fonts are ASCII-only: turn "Sofía Núñez" into "Sofia Nunez".
inline std::string toAscii(const std::string& in) {
  std::string out;
  for (size_t i = 0; i < in.size(); i++) {
    unsigned char c = in[i];
    if (c < 0x80) {
      out += (char)c;
      continue;
    }
    if (c == 0xC3 && i + 1 < in.size()) {
      unsigned char d = in[++i];
      const char* map = nullptr;
      switch (d) {
        case 0x81: map = "A"; break; case 0x89: map = "E"; break; case 0x8D: map = "I"; break;
        case 0x93: map = "O"; break; case 0x9A: map = "U"; break; case 0x91: map = "N"; break;
        case 0x9C: map = "U"; break; case 0xA1: map = "a"; break; case 0xA9: map = "e"; break;
        case 0xAD: map = "i"; break; case 0xB3: map = "o"; break; case 0xBA: map = "u"; break;
        case 0xB1: map = "n"; break; case 0xBC: map = "u"; break; case 0xA0: map = "a"; break;
        case 0xA8: map = "e"; break; case 0xA7: map = "c"; break; case 0x87: map = "C"; break;
        default: map = "?";
      }
      out += map;
      continue;
    }
    // Other multi-byte characters: skip their continuation bytes, show "?".
    while (i + 1 < in.size() && (((unsigned char)in[i + 1]) & 0xC0) == 0x80) i++;
    out += '?';
  }
  return out;
}

enum class Tone { Ok, Late, Warn, Error };

struct Feedback {
  Tone tone;
  const char* line1;
  const char* line2;  // may be empty
};

// What to show for a scan outcome returned by POST /api/v1/attendance/scans.
// `status` is attendance.status when outcome == "recorded".
inline Feedback describeOutcome(const std::string& outcome, const std::string& status) {
  if (outcome == "recorded") {
    if (status == "late") return {Tone::Late, "Tarde", ""};
    if (status == "absent") return {Tone::Late, "Registrado", "como ausente"};
    if (status == "excused") return {Tone::Ok, "Excusado", ""};
    return {Tone::Ok, "Presente", ""};
  }
  if (outcome == "duplicate") return {Tone::Warn, "Ya estabas", "registrado"};
  if (outcome == "unknown_credential") return {Tone::Error, "Tarjeta no", "registrada"};
  if (outcome == "inactive_credential") return {Tone::Error, "Tarjeta", "desactivada"};
  if (outcome == "inactive_student") return {Tone::Error, "Estudiante", "inactivo"};
  if (outcome == "no_active_session") return {Tone::Error, "Sin clase", "en curso"};
  if (outcome == "not_enrolled") return {Tone::Error, "No inscrito", "en esta clase"};
  if (outcome == "too_early") return {Tone::Warn, "Muy", "temprano"};
  if (outcome == "after_cutoff") return {Tone::Error, "Fuera de", "horario"};
  if (outcome == "device_disabled") return {Tone::Error, "Lector", "desactivado"};
  if (outcome == "school_suspended") return {Tone::Error, "Colegio", "suspendido"};
  return {Tone::Error, "No se pudo", "registrar"};
}

// POSIX TZ string for the school's IANA timezone (the ESP32 has no tz database).
inline const char* posixTimezone(const std::string& iana) {
  if (iana == "America/Bogota" || iana == "America/Lima" || iana == "America/Guayaquil" || iana == "America/Panama")
    return "<-05>5";
  if (iana == "America/Mexico_City") return "CST6";
  if (iana == "America/Caracas" || iana == "America/La_Paz") return "<-04>4";
  if (iana == "America/Santiago") return "<-04>4<-03>,M9.1.6/24,M4.1.6/24";
  if (iana == "America/Argentina/Buenos_Aires" || iana == "America/Sao_Paulo" || iana == "America/Montevideo")
    return "<-03>3";
  if (iana == "America/New_York") return "EST5EDT,M3.2.0,M11.1.0";
  if (iana == "America/Chicago") return "CST6CDT,M3.2.0,M11.1.0";
  if (iana == "America/Denver") return "MST7MDT,M3.2.0,M11.1.0";
  if (iana == "America/Los_Angeles") return "PST8PDT,M3.2.0,M11.1.0";
  if (iana == "Europe/Madrid") return "CET-1CEST,M3.5.0,M10.5.0/3";
  return "<-05>5";  // EduTrack's default school timezone is America/Bogota.
}

}  // namespace edutrack
