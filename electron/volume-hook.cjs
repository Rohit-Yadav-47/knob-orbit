// Consume Windows volume keys before the shell changes the system volume.
// The knob presents itself as these media keys, so Windows cannot distinguish
// its presses from volume keys on another keyboard.
const koffi = require('koffi');

const user32 = koffi.load('user32.dll');
const KBDLLHOOKSTRUCT = koffi.struct('KBDLLHOOKSTRUCT', {
  vkCode: 'uint32_t',
  scanCode: 'uint32_t',
  flags: 'uint32_t',
  time: 'uint32_t',
  dwExtraInfo: 'uintptr_t',
});
const HookProc = koffi.proto('intptr_t __stdcall HookProc(int code, uintptr_t wParam, const KBDLLHOOKSTRUCT *data)');
const SetWindowsHookExW = user32.func('void * __stdcall SetWindowsHookExW(int idHook, HookProc *callback, void *module, uint32_t threadId)');
const CallNextHookEx = user32.func('intptr_t __stdcall CallNextHookEx(void *hook, int code, uintptr_t wParam, const KBDLLHOOKSTRUCT *data)');
const UnhookWindowsHookEx = user32.func('int __stdcall UnhookWindowsHookEx(void *hook)');

const VOLUME_KEYS = { 0xad: 'click', 0xae: 'left', 0xaf: 'right' };
const KEY_DOWN = new Set([0x100, 0x104]);
const KEY_MESSAGES = new Set([0x100, 0x101, 0x104, 0x105]);

function installVolumeHook(onKey) {
  let hook = null;
  let clickHeld = false;
  const callback = koffi.register((code, message, data) => {
    if (code >= 0 && KEY_MESSAGES.has(Number(message))) {
      const key = koffi.decode(data, KBDLLHOOKSTRUCT);
      const action = VOLUME_KEYS[key.vkCode];
      if (action) {
        if (KEY_DOWN.has(Number(message))) {
          if (action !== 'click' || !clickHeld) setImmediate(() => onKey(action));
          if (action === 'click') clickHeld = true;
        } else if (action === 'click') {
          clickHeld = false;
        }
        return 1;
      }
    }
    return CallNextHookEx(hook, code, message, data);
  }, koffi.pointer(HookProc));

  hook = SetWindowsHookExW(13, callback, null, 0); // WH_KEYBOARD_LL
  if (!hook) {
    koffi.unregister(callback);
    throw new Error('Could not install the Windows volume-key hook');
  }
  return () => {
    UnhookWindowsHookEx(hook);
    koffi.unregister(callback);
  };
}

module.exports = { installVolumeHook };
