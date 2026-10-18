// Knob Orbit - main process.
// Knob click opens the dial, rotation moves the selection, click runs it.
// Windows volume keys from the knob are consumed before they reach the shell.

const { app, BrowserWindow, globalShortcut, screen, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const input = require('./input.cjs');
const { installVolumeHook } = require('./volume-hook.cjs');

const ROOT = path.join(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'orbit.config.json');

let config = loadConfig();
let win = null;
let tray = null;

// state
let state = 'idle'; // idle | menu | mode
let sel = 0;
let pos = 0; // continuous position, so the highlight never spins backwards on wrap
let mode = null;
let tick = 0;
let menuTimer = null;
let altTimer = null;
let hideTimer = null;
let altDown = false;
let navCaptured = false;
let removeVolumeHook = null;

const isVolumeKey = (key) => /^(VolumeMute|VolumeDown|VolumeUp)$/i.test(key);

function loadConfig() {
  const c = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  c.keys = { right: 'VolumeUp', left: 'VolumeDown', click: 'VolumeMute', ...(c.keys || {}) };
  return c;
}

const items = () => config.items;

// ---------------------------------------------------------------- window ---
function createWindow() {
  win = new BrowserWindow({
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    movable: false,
    focusable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs') },
  });
  win.setIgnoreMouseEvents(true);
  win.loadFile(path.join(ROOT, 'dist', 'index.html'));
}

function send(payload) {
  win.webContents.send('orbit:state', { accent: config.accent, ...payload });
}

function showWindow() {
  clearTimeout(hideTimer);
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  win.setBounds(display.workArea);
  if (!win.isVisible()) win.showInactive();
  win.setAlwaysOnTop(true, 'screen-saver');
}

function hideWindow() {
  send({ view: null });
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => state === 'idle' && win.hide(), 320);
}

// --------------------------------------------------------------- capture ---
function register(accel, fn) {
  if (!globalShortcut.register(accel, fn)) console.warn(`[knob-orbit] could not register ${accel}`);
}

function captureClick(on) {
  if (isVolumeKey(config.keys.click)) return; // handled by the permanent hook
  if (on) register(config.keys.click, () => onKnob('click'));
  else globalShortcut.unregister(config.keys.click);
}

// Rotation (and arrow keys / Enter / Esc as a keyboard fallback) are only
// captured while the dial or a mode is active.
function captureNav(on) {
  if (on === navCaptured) return;
  const map = {
    [config.keys.right]: 'right', [config.keys.left]: 'left',
    Right: 'right', Left: 'left', Return: 'click', Escape: 'escape',
  };
  for (const [accel, action] of Object.entries(map)) {
    if (isVolumeKey(accel)) continue;
    if (on) register(accel, () => onKnob(action));
    else globalShortcut.unregister(accel);
  }
  navCaptured = on;
}

// ----------------------------------------------------------------- logic ---
function onKnob(action) {
  if (action === 'escape') return closeAll();

  if (state === 'idle') {
    if (action === 'click' || action === 'right' || action === 'left') {
      openMenu();
      if (action !== 'click') onKnob(action);
    }
  } else if (state === 'menu') {
    armMenuTimer();
    if (action === 'click') return activate();
    const d = action === 'right' ? 1 : -1;
    const n = items().length;
    sel = (sel + d + n) % n;
    pos += d;
    sendMenu();
  } else if (state === 'mode') {
    if (action === 'click') return closeAll();
    turnMode(action === 'right' ? 1 : -1);
  }
}

function sendMenu() {
  send({ view: 'menu', items: items(), sel, pos });
}

function openMenu() {
  state = 'menu';
  captureNav(true);
  showWindow();
  sendMenu();
  armMenuTimer();
}

function armMenuTimer() {
  clearTimeout(menuTimer);
  menuTimer = setTimeout(() => state === 'menu' && closeAll(), config.menuTimeoutMs || 6000);
}

function closeAll() {
  clearTimeout(menuTimer);
  releaseAlt();
  state = 'idle';
  mode = null;
  captureNav(false);
  hideWindow();
}

function activate() {
  const item = items()[sel];
  clearTimeout(menuTimer);
  if (item.type === 'mode') {
    state = 'mode';
    mode = item;
    tick = 0;
    send({ view: 'hud', item, tick });
  } else {
    closeAll();
    setTimeout(() => runAction(item), 140);
  }
}

function turnMode(d) {
  tick += d;
  send({ view: 'hud', item: mode, tick });
  switch (mode.mode) {
    case 'tabs':
      input.combo(d > 0 ? 'ctrl+tab' : 'ctrl+shift+tab');
      break;
    case 'scroll':
      input.wheel(d > 0 ? -240 : 240);
      break;
    case 'zoom':
      input.ctrlWheel(d > 0 ? 120 : -120);
      break;
    case 'media':
      input.combo(d > 0 ? 'medianext' : 'mediaprev');
      break;
    case 'apps':
      if (!altDown) {
        input.down('alt');
        altDown = true;
      }
      input.combo(d > 0 ? 'tab' : 'shift+tab');
      clearTimeout(altTimer);
      altTimer = setTimeout(releaseAlt, 900);
      break;
  }
}

function releaseAlt() {
  clearTimeout(altTimer);
  if (altDown) {
    input.up('alt');
    altDown = false;
  }
}

function runAction(item) {
  try {
    if (item.type === 'keys') {
      input.combo(item.keys);
    } else if (item.type === 'open') {
      if (/^[a-z]+:\/\//i.test(item.target)) shell.openExternal(item.target);
      else exec(`start "" "${item.target}"`);
    }
  } catch (err) {
    console.error('[knob-orbit]', err.message);
  }
}

// ------------------------------------------------------------------ tray ---
// When run via `electron .`, Windows must be told to launch electron.exe with this folder.
const loginArgs = () => ({ path: process.execPath, args: app.isPackaged ? [] : [ROOT] });

function trayMenu() {
  return Menu.buildFromTemplate([
    { label: 'Open dial', click: () => onKnob('click') },
    { type: 'separator' },
    {
      label: 'Start with Windows',
      type: 'checkbox',
      checked: app.getLoginItemSettings(loginArgs()).openAtLogin,
      click: (m) => app.setLoginItemSettings({ ...loginArgs(), openAtLogin: m.checked }),
    },
    { label: 'Edit dial items…', click: () => shell.openPath(CONFIG_PATH) },
    {
      label: 'Reload items',
      click: () => {
        try {
          captureClick(false);
          config = loadConfig();
          sel = pos = 0;
          captureClick(true);
        } catch (e) {
          tray.displayBalloon({ title: 'Knob Orbit', content: `Config error: ${e.message}` });
        }
      },
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

// ------------------------------------------------------------------- app ---
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.whenReady().then(() => {
    createWindow();
    removeVolumeHook = installVolumeHook((action) => {
      const key = { click: 'VolumeMute', left: 'VolumeDown', right: 'VolumeUp' }[action];
      if (config.keys[action]?.toLowerCase() === key.toLowerCase()) onKnob(action);
    });
    captureClick(true);
    register('CommandOrControl+Alt+Q', () => app.quit());

    tray = new Tray(nativeImage.createFromPath(path.join(ROOT, 'assets', 'tray.png')));
    tray.setToolTip('Knob Orbit — click the knob to open the dial');
    tray.setContextMenu(trayMenu());
    tray.on('click', () => onKnob('click'));
  });

  app.on('window-all-closed', () => {}); // keep running in the tray
  app.on('will-quit', () => {
    releaseAlt();
    removeVolumeHook?.();
    globalShortcut.unregisterAll();
  });
}
