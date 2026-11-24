# ESP32 LED Pattern Controller

An ESP32 project that controls six LEDs using selectable lighting patterns, physical switches, and a 16×2 I2C LCD. A browser-based dashboard connects to the ESP32 over Web Serial so you can monitor the LCD output, view LED states, and select modes from a computer.

## Features

- Six LED outputs with configurable patterns:
  - **Idle / Stop**
  - **Blink**
  - **Run** — moves across the LEDs and back
  - **ALT** — alternates between the two LED groups
  - **Run All** — runs Blink, Run, and ALT in sequence
- 16×2 I2C LCD status display
- Physical switch control with debouncing
- Browser dashboard with a live LCD preview and LED indicators
- Serial communication at **115200 baud**
- Web Serial status messages for modes, LED states, LCD text, and errors

## Project Structure

```text
Final_Project/
├── GUI/
│   ├── index.html       # Web dashboard
│   ├── script.js        # Web Serial and LCD/LED visualization
│   ├── styles.css       # Dashboard styling
│   └── modes.test.js    # GUI mode tests
├── Main/
│   ├── Main.ino         # ESP32 entry point
│   ├── Modes.h           # LED modes, switches, and serial protocol
│   └── LCD.h             # I2C LCD configuration and helpers
└── README.md
```

## Hardware Connections

### LEDs

| LED | ESP32 GPIO |
| --- | ---: |
| LED 1 | 19 |
| LED 2 | 18 |
| LED 3 | 5 |
| LED 4 | 17 |
| LED 5 | 16 |
| LED 6 | 4 |

### Mode switches

| Switch | ESP32 GPIO |
| --- | ---: |
| SW0 | 32 |
| SW1 | 33 |

The switch combinations select the hardware-controlled modes:

- `00` — Stop
- `01` — Blink
- `10` — Run
- `11` — ALT

### I2C LCD

- **SDA:** GPIO 21
- **SCL:** GPIO 22
- **I2C address:** `0x27`
- **Display:** 16 columns × 2 rows

## Arduino Setup

1. Open `Main/Main.ino` in the Arduino IDE.
2. Select an ESP32-compatible board and its serial port.
3. Install the `LiquidCrystal_I2C` library if it is not already installed.
4. Upload the sketch to the ESP32.
5. Open the Serial Monitor at **115200 baud**, or use the web dashboard.

## Web Dashboard

Open `GUI/index.html` in a browser that supports Web Serial, such as a recent version of Chrome or Edge. For browser security reasons, serve the GUI from `localhost` when needed rather than opening it from an unsupported file context.

1. Connect the ESP32 by USB.
2. Open the dashboard.
3. Select **Connect ESP32**.
4. Choose the ESP32 serial port.
5. Use the mode buttons to start a pattern when the physical switches are in the Stop position.

When a physical switch selects a mode, web controls are locked and the dashboard reports that the switches have control.

## Serial Commands and Messages

The dashboard sends a mode number followed by a newline:

- `0` — Stop
- `1` — Blink
- `2` — Run
- `3` — ALT
- `4` — Run All

The ESP32 reports events using messages such as `MODE`, `STEP`, `LEDS`, `LCD`, `SWITCH`, `LOCKED`, and `DONE`.

## Testing

The GUI includes JavaScript tests in `GUI/modes.test.js` for mode behavior and serial message handling. Run them with the JavaScript test command configured in your development environment.

## License

This project is released under the license in [LICENSE](LICENSE).
