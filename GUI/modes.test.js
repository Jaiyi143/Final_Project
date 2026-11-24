const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadGui() {
  const elements = {};
  const drawing = { fillRect() {}, clearRect() {} };
  const leds = Array.from({ length: 6 }, () => ({
    on: false,
    classList: { toggle(name, active) { if (name === 'on') this.owner.on = active; } }
  }));
  leds.forEach(led => led.classList.owner = led);
  const ids = ['lcd', 'serial-button', 'serial-status', 'latest-output', 'mode-idle', 'mode-blink', 'mode-alt', 'mode-run', 'mode-all'];
  for (const id of ids) {
    elements[id] = {
      textContent: '', disabled: false, clientWidth: 960, clientHeight: 200,
      classList: { toggle() {} }, listeners: {},
      addEventListener(name, handler) { this.listeners[name] = handler; },
      setAttribute(name, value) { this[name] = value; },
      getContext() { return drawing; }
    };
  }
  const written = [];
  const fakePort = {
    writable: { getWriter() { return {
      async write(bytes) { written.push(new TextDecoder().decode(bytes)); },
      releaseLock() {}
    }; } }
  };
  const context = vm.createContext({
    document: { getElementById: id => elements[id], querySelectorAll: () => leds },
    window: { devicePixelRatio: 1 }, navigator: {}, ResizeObserver: class { observe() {} },
    TextDecoder, TextEncoder, setInterval: () => 1, clearInterval() {}, fakePort
  });
  vm.runInContext(fs.readFileSync(__dirname + '/script.js', 'utf8'), context);
  vm.runInContext('port = fakePort; connected = true', context);
  return { context, elements, written, leds };
}

test('Run and ALT buttons send their correct mode numbers', async () => {
  const { elements, written } = loadGui();
  await elements['mode-run'].listeners.click();
  await elements['mode-alt'].listeners.click();
  assert.deepEqual(written, ['2\n', '3\n']);
});

test('Idle / Stop and Run All send their serial commands', async () => {
  const { elements, written } = loadGui();
  await elements['mode-all'].listeners.click();
  await elements['mode-idle'].listeners.click();
  assert.deepEqual(written, ['4\n', '0\n']);
});

test('Run All keeps its selection while each pattern runs', () => {
  const { context, elements } = loadGui();
  vm.runInContext("receiveText('MODE:4\\nSTEP:2\\n')", context);
  assert.equal(elements['mode-all']['aria-pressed'], 'true');
  assert.match(elements['serial-status'].textContent, /Run All.*Run/i);
  vm.runInContext("receiveText('DONE:4\\n')", context);
  assert.equal(elements['mode-all']['aria-pressed'], 'false');
});

test('LCD status and mode frames from the sketch update the web display', () => {
  const { context, elements } = loadGui();
  vm.runInContext("receiveText('MODE:3\\nLCD:STATUS:         |ALT             \\nDONE:3\\n')", context);
  assert.equal(vm.runInContext('serialLines[0]', context), 'STATUS:         ');
  assert.equal(vm.runInContext('serialLines[1]', context), 'ALT             ');
  assert.equal(elements['mode-alt']['aria-pressed'], 'false');
  assert.match(elements['serial-status'].textContent, /complete/i);
});

test('LED feedback follows the six physical output states', () => {
  const { context, leds } = loadGui();
  vm.runInContext("receiveText('LEDS:101010\\n')", context);
  assert.deepEqual(leds.map(led => led.on), [true, false, true, false, true, false]);
});

test('disconnected LCD keeps STATUS on the first row', () => {
  const { elements } = loadGui();
  assert.match(elements.lcd['aria-label'], /STATUS:.*first row/i);
  assert.match(elements.lcd['aria-label'], /DISCONNECTED.*second row/i);
});

test('physical switch selection overrides web mode buttons until 00', () => {
  const { context, elements } = loadGui();
  vm.runInContext("receiveText('SWITCH:2\\nMODE:2\\n')", context);
  assert.equal(elements['mode-run'].disabled, true);
  assert.match(elements['serial-status'].textContent, /physical switches.*Run/i);
  vm.runInContext("receiveText('SWITCH:0\\nMODE:0\\n')", context);
  assert.equal(elements['mode-run'].disabled, false);
});
