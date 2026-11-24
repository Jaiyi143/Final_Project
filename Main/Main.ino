#include "Modes.h"

void setup() {
  Serial.begin(115200);
  initLighting();
  initLcd();
  Serial.print("SWITCH:");
  Serial.println(stableSwitchState);
  startMode(stableSwitchState);
}

void loop() {
  readCommands();
  updateSwitches();
  updateLighting();
}
