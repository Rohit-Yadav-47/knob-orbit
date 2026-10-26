const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 900,
    height: 650,
    show: false,
    webPreferences: { offscreen: true },
  });

  try {
    await win.loadFile(path.join(root, 'dist', 'index.html'));
    await win.webContents.executeJavaScript("window.orbitDemo('right'); window.orbitDemo('right');");
    await pause(1200);
    fs.writeFileSync(path.join(root, 'assets', 'preview.png'), await win.webContents.capturePage().then((image) => image.toPNG()));

    win.setSize(600, 400);
    await win.webContents.executeJavaScript("window.orbitDemo('click');");
    await pause(600);
    fs.writeFileSync(path.join(root, 'assets', 'mode.png'), await win.webContents.capturePage().then((image) => image.toPNG()));
  } finally {
    win.destroy();
    app.quit();
  }
}).catch((error) => {
  console.error(error);
  app.exit(1);
});
