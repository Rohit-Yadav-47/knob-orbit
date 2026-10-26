// Sends keystrokes / mouse wheel on Windows through user32 (via koffi, no compiling needed).

const KEYUP = 0x2;
const EXTENDED = 0x1;
const VOLUME_EXTRA = 0x4b4f5242; // Marks volume keys deliberately sent by Knob Orbit.

const VK = {
  ctrl: 0x11, control: 0x11, shift: 0x10, alt: 0x12, win: 0x5b, windows: 0x5b,
  tab: 0x09, enter: 0x0d, esc: 0x1b, escape: 0x1b, space: 0x20, backspace: 0x08,
  left: 0x25, up: 0x26, right: 0x27, down: 0x28,
  home: 0x24, end: 0x23, pageup: 0x21, pagedown: 0x22, delete: 0x2e, insert: 0x2d,
  printscreen: 0x2c, plus: 0xbb, '=': 0xbb, minus: 0xbd, '-': 0xbd,
  volumemute: 0xad, volumedown: 0xae, volumeup: 0xaf,
  medianext: 0xb0, mediaprev: 0xb1, mediastop: 0xb2, mediaplaypause: 0xb3,
};
for (let i = 0; i < 26; i++) VK[String.fromCharCode(97 + i)] = 0x41 + i;
for (let i = 0; i < 10; i++) VK[String(i)] = 0x30 + i;
for (let i = 1; i <= 12; i++) VK['f' + i] = 0x6f + i;

const EXT = new Set([0x5b, 0x25, 0x26, 0x27, 0x28, 0x24, 0x23, 0x21, 0x22, 0x2e, 0x2d,
  0xad, 0xae, 0xaf, 0xb0, 0xb1, 0xb2, 0xb3]);

let keybd = () => {};
let mouse = () => {};

if (process.platform === 'win32') {
  const koffi = require('koffi');
  const user32 = koffi.load('user32.dll');
  const keybd_event = user32.func('void __stdcall keybd_event(uint8_t vk, uint8_t scan, uint32_t flags, uintptr_t extra)');
  const mouse_event = user32.func('void __stdcall mouse_event(uint32_t flags, uint32_t dx, uint32_t dy, int32_t data, uintptr_t extra)');
  keybd = (vk, up) => keybd_event(vk, 0, (up ? KEYUP : 0) | (EXT.has(vk) ? EXTENDED : 0),
    vk >= 0xad && vk <= 0xaf ? VOLUME_EXTRA : 0);
  mouse = (delta) => mouse_event(0x0800, 0, 0, delta, 0);
} else {
  console.warn('[knob-orbit] input simulation only works on Windows');
}

const code = (k) => {
  const vk = VK[String(k).trim().toLowerCase()];
  if (vk === undefined) throw new Error(`Unknown key "${k}"`);
  return vk;
};

const down = (k) => keybd(code(k), false);
const up = (k) => keybd(code(k), true);

function combo(keys) {
  const list = Array.isArray(keys) ? keys : String(keys).split('+');
  const codes = list.map(code);
  codes.forEach((c) => keybd(c, false));
  codes.reverse().forEach((c) => keybd(c, true));
}

const wheel = (delta) => mouse(delta);

function ctrlWheel(delta) {
  keybd(VK.ctrl, false);
  mouse(delta);
  keybd(VK.ctrl, true);
}

module.exports = { down, up, combo, wheel, ctrlWheel };
