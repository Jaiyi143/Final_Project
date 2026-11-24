#pragma once

#include "LCD.h"
#include <string.h>

// Six LED outputs from the original lighting sketch.
const uint8_t LED[] = {19, 18, 5, 17, 16, 4};
const uint8_t NUM_LEDS = sizeof(LED) / sizeof(LED[0]);
const uint8_t SW0 = 32;
const uint8_t SW1 = 33;
const uint8_t REPEAT = 3;
bool ledState[NUM_LEDS] = {};

// Serial command numbers: 0=Stop, 1=Blink, 2=Run, 3=ALT, 4=Run All.
uint8_t currentMode = 0;
uint8_t phase = 0;
uint8_t cycles = 0;
unsigned long nextStepAt = 0;
const uint8_t RUN_ALL_ORDER[] = {1, 2, 3};
const uint8_t RUN_ALL_COUNT = sizeof(RUN_ALL_ORDER) / sizeof(RUN_ALL_ORDER[0]);
bool runningAll = false;
uint8_t allIndex = 0;
uint8_t rawSwitchState = 0;
uint8_t stableSwitchState = 0;
unsigned long switchChangedAt = 0;
const unsigned long SWITCH_DEBOUNCE_MS = 30;

// SW0 is bit 0, SW1 is bit 1: 00=Stop, 01=Blink, 10=Run, 11=ALT.
uint8_t readSwitchState() {
  return (digitalRead(SW0) == HIGH ? 1 : 0)
       | (digitalRead(SW1) == HIGH ? 2 : 0);
}

void writeLed(uint8_t index, bool on) {
  digitalWrite(LED[index], on ? HIGH : LOW);
  ledState[index] = on;
}

void allLedsOff() {
  for (uint8_t i = 0; i < NUM_LEDS; i++) writeLed(i, false);
}

void initLighting() {
  pinMode(SW0, INPUT);
  pinMode(SW1, INPUT);
  for (uint8_t i = 0; i < NUM_LEDS; i++) pinMode(LED[i], OUTPUT);
  allLedsOff();
  rawSwitchState = readSwitchState();
  stableSwitchState = rawSwitchState;
  switchChangedAt = millis();
}

void showFrame(const char *first, const char *second) {
  writeLcd(first, second);
  Serial.print("LEDS:");
  for (uint8_t i = 0; i < NUM_LEDS; i++) Serial.print(ledState[i] ? '1' : '0');
  Serial.println();
  Serial.print("LCD:");
  Serial.print(first);
  Serial.print('|');
  Serial.println(second);
}

void showIdle(const char *message) {
  char first[LCD_COLS + 1];
  char second[LCD_COLS + 1];
  memset(first, ' ', LCD_COLS);
  memset(second, ' ', LCD_COLS);
  first[LCD_COLS] = '\0';
  second[LCD_COLS] = '\0';
  putText(first, 0, "STATUS:");
  putText(second, 0, message);
  showFrame(first, second);
}

void advanceMode();
void beginPattern(uint8_t selected);

void finishMode() {
  uint8_t finished = currentMode;
  currentMode = 0;
  allLedsOff();
  if (stableSwitchState != 0) {
    beginPattern(stableSwitchState);
    return;
  }
  if (runningAll) {
    allIndex++;
    if (allIndex < RUN_ALL_COUNT) {
      beginPattern(RUN_ALL_ORDER[allIndex]);
      return;
    }
    runningAll = false;
    showIdle("ALL DONE");
    Serial.println("DONE:4");
    return;
  }
  showIdle(finished == 1 ? "BLINK DONE" : finished == 2 ? "RUN DONE" : "ALT DONE");
  Serial.print("DONE:");
  Serial.println(finished);
}

void advanceMode() {
  if (!currentMode) return;
  if (cycles >= REPEAT) {
    finishMode();
    return;
  }

  char first[LCD_COLS + 1];
  char second[LCD_COLS + 1];
  memset(first, ' ', LCD_COLS);
  memset(second, ' ', LCD_COLS);
  first[LCD_COLS] = '\0';
  second[LCD_COLS] = '\0';
  allLedsOff();
  putText(first, 0, "STATUS:");

  if (currentMode == 1) {
    // Blink all LEDs and flash the mode label on the second row.
    if (phase == 0) {
      for (uint8_t i = 0; i < NUM_LEDS; i++) writeLed(i, true);
      putText(second, 0, "BLINK");
    }
    phase++;
    if (phase == 2) { phase = 0; cycles++; }
    nextStepAt = millis() + 1000;
  } else if (currentMode == 3) {
    // Alternate both LED halves and shift the label across the second row.
    if (phase == 0) {
      for (uint8_t i = 0; i < NUM_LEDS / 2; i++) writeLed(i, true);
      putText(second, 0, "ALT");
    } else if (phase == 2) {
      for (uint8_t i = NUM_LEDS / 2; i < NUM_LEDS; i++) writeLed(i, true);
      putText(second, LCD_COLS - 3, "ALT");
    }
    phase++;
    if (phase == 4) { phase = 0; cycles++; }
    nextStepAt = millis() + 1000;
  } else {
    // Run one LED at a time, forward and back, three times.
    uint8_t ledIndex = phase < NUM_LEDS ? phase : 2 * NUM_LEDS - 1 - phase;
    writeLed(ledIndex, true);
    putText(second, ledIndex * 2, "RUN");
    phase++;
    if (phase == 2 * NUM_LEDS) { phase = 0; cycles++; }
    nextStepAt = millis() + 250;
  }
  showFrame(first, second);
}

void beginPattern(uint8_t selected) {
  currentMode = selected;
  phase = 0;
  cycles = 0;
  Serial.print(runningAll ? "STEP:" : "MODE:");
  Serial.println(selected);
  advanceMode();
}

void startMode(uint8_t selected) {
  if (selected > 4) {
    Serial.println("ERROR:MODE");
    return;
  }
  runningAll = false;
  allIndex = 0;
  if (selected == 0) {
    currentMode = 0;
    allLedsOff();
    Serial.println("MODE:0");
    showIdle("IDLE");
  } else if (selected == 4) {
    runningAll = true;
    Serial.println("MODE:4");
    beginPattern(RUN_ALL_ORDER[0]);
  } else {
    beginPattern(selected);
  }
}

void readCommands() {
  while (Serial.available()) {
    char character = (char)Serial.read();
    if (character >= '0' && character <= '4') {
      if (stableSwitchState != 0) {
        Serial.print("LOCKED:");
        Serial.println(stableSwitchState);
      } else {
        startMode(character - '0');
      }
    }
    else if (character != '\r' && character != '\n' && character != ' ')
      Serial.println("ERROR:MODE");
  }
}

void updateSwitches() {
  const uint8_t reading = readSwitchState();
  const unsigned long now = millis();
  if (reading != rawSwitchState) {
    rawSwitchState = reading;
    switchChangedAt = now;
  }
  if (reading != stableSwitchState && now - switchChangedAt >= SWITCH_DEBOUNCE_MS) {
    stableSwitchState = reading;
    Serial.print("SWITCH:");
    Serial.println(stableSwitchState);
    startMode(stableSwitchState);
  }
}

void updateLighting() {
  if (currentMode && (int32_t)(millis() - nextStepAt) >= 0) advanceMode();
}
