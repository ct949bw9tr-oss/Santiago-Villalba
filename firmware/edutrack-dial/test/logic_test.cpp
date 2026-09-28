// Host-side test of src/logic.h: g++ -std=c++17 test/logic_test.cpp -o /tmp/lt && /tmp/lt
#include <cassert>
#include <cstdio>
#include <cstring>
#include "../src/logic.h"

using namespace edutrack;

int main() {
  const uint8_t four[] = {0x04, 0xA2, 0x2B, 0x1C};
  assert(uidToHex(four, 4) == "04A22B1C");
  const uint8_t seven[] = {0x04, 0xA2, 0x2B, 0x1C, 0x9F, 0x5E, 0x80};
  assert(uidToHex(seven, 7) == "04A22B1C9F5E80");

  assert(toAscii("Sofía Núñez") == "Sofia Nunez");
  assert(toAscii("Martín Cárdenas") == "Martin Cardenas");
  assert(toAscii("JOSÉ ÑOÑO") == "JOSE NONO");
  assert(toAscii("Ana") == "Ana");
  assert(toAscii("✓ ok") == "? ok");

  assert(describeOutcome("recorded", "present").tone == Tone::Ok);
  assert(strcmp(describeOutcome("recorded", "late").line1, "Tarde") == 0);
  assert(describeOutcome("duplicate", "").tone == Tone::Warn);
  assert(describeOutcome("unknown_credential", "").tone == Tone::Error);
  assert(strcmp(describeOutcome("no_active_session", "").line1, "Sin clase") == 0);
  assert(describeOutcome("something_new", "").tone == Tone::Error);

  assert(strcmp(posixTimezone("America/Bogota"), "<-05>5") == 0);
  assert(strcmp(posixTimezone("America/New_York"), "EST5EDT,M3.2.0,M11.1.0") == 0);
  assert(strcmp(posixTimezone("Unknown/Zone"), "<-05>5") == 0);

  std::puts("logic tests passed");
  return 0;
}
