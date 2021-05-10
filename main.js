// Modules to control application life and create native browser window
const { systemPreferences, webContents } = require('electron');
const { app, BrowserWindow, protocol, session, dialog, ipcMain } = require('electron/main');
const express = require('express')
const path = require('path')

const sleep = (t = 0) => new Promise(resolve => setTimeout(resolve, t));

/** @type {Map<number, [number, BrowserWindow]>} */
const RTC_MAP = new Map();
/** @type {Map<number, WebContents>} */
const WC_MAP = new Map();
/** @type {Record<number, string>} */
const SDP_OFFERS = Object.create(null);

/** @type {import('electron').BrowserViewConstructorOptions} */
const defaultOptions = {
  width: 800,
  height: 900,
  autoHideMenuBar: true,
  webPreferences: {
    // nodeIntegration: true,
    // https://github.com/electron/electron/blob/master/docs/breaking-changes.md#default-changed-contextisolation-defaults-to-true
    // contextIsolation: false,
    preload: path.join(__dirname, 'preload.js')
  }
}

protocol.registerSchemesAsPrivileged([
  { scheme: 'github', privileges: { supportFetchAPI: true } },
  { scheme: 'api', privileges: { supportFetchAPI: true } }
]);


/**
 * @param {string} filePath
 * @param {Electron.BrowserWindowConstructorOptions} [options=defaultOptions]
 */
async function createWindow (filePath, options = defaultOptions) {
  const win = new BrowserWindow(options);
  const { webContents } = win;
  const { id } = webContents;
  await win.loadFile(filePath);
  win.setTitle(`${win.title}-${id}`);
  webContents.openDevTools({ mode: 'bottom' });
  return win;
}

function createRTCWindow () {
  const win = new BrowserWindow(defaultOptions);
  const { webContents } = win;
  const { id } = webContents;
  // RTC_MAP.set(id, [webContents.id, win]);
  WC_MAP.set(id, webContents);
  win.loadFile('rtc/index.html').then(() => {
    win.setTitle(`${win.title}-${id}`);
  });
  webContents.openDevTools();
  win.once('closed', () => {
    WC_MAP.delete(id);
    WC_MAP.forEach(v => v.send('rtc:left', id));
    delete SDP_OFFERS[id];
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerProtocols();
  startServer();
  registerIpcHandleEvents();
  // registerRTCHandleEvents();
  _registerRTCHandleEvents();
  createWindow('index.html');

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow('index.html');
  });
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.


/** @param {number} id */
function getWindowByWebContentId(id) {
  return BrowserWindow.getAllWindows().find(win => win.webContents.id === id);
}

function registerIpcHandleEvents() {
  ipcMain.handle('dialog:showCertificateTrustDialog', (event, ...args) => dialog.showCertificateTrustDialog(...args));
  ipcMain.handle('dialog:showErrorBox', (event, ...args) => dialog.showErrorBox(...args));
  ipcMain.handle('dialog:showMessageBox', (event, ...args) => dialog.showMessageBox(getWindowByWebContentId(event.sender.id), ...args));
  ipcMain.handle('dialog:showOpenDialog', (event, ...args) => dialog.showOpenDialog(...args));
  ipcMain.handle('dialog:showSaveDialog', (event, ...args) => dialog.showSaveDialog(...args));

  ipcMain.on('systemPreferences:getMediaAccessStatus', (event, ...args) => (event.returnValue = systemPreferences.getMediaAccessStatus(...args)))
}

function registerRTCHandleEvents() {
  function handleRTCJoin(id, sdpOffer) {
    SDP_OFFERS[id] = sdpOffer;
    WC_MAP.forEach((v, k) => (k !== id && v.send('rtc:join', id, sdpOffer)));
  }
  function transferRTCICE(id, candidate) {
    WC_MAP.forEach((v, k) => id !== k && v.send('rtc:ice', id, candidate));
  }
  ipcMain.handle('rtc:fetchAllRTCIds', (event) => [...new Set([event.sender.id, ...WC_MAP.keys()])])
  ipcMain.handle('rtc:getSdpOffer', (event, id) => SDP_OFFERS[id]);
  ipcMain.on('rtc:getSdpOffer', (event, id) => (event.returnValue = SDP_OFFERS[id]));
  ipcMain.on('math', (event, n) => event.returnValue = Array(n).fill(Math.random()).join('\n'));
  ipcMain.on('window:createRTCWindow', createRTCWindow);
  ipcMain.on('win:createPC1', () => createWindow('rtc/multiple/index.html'));
  ipcMain.on('rtc:join', (event, sdpOffer) => handleRTCJoin(event.sender.id, sdpOffer));
  ipcMain.on('rtc:ice', (event, candidate) => transferRTCICE(event.sender.id, candidate))
  ipcMain.on('rtc:answer', (evnet, id, answerOffer) => WC_MAP.get(id)?.send('rtc:answer', answerOffer))
}

function registerProtocols () {
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ['http://localhost:5000/api/*'] }, (details, callback) => {
    details.requestHeaders['token'] = 'my-token';
    callback({ requestHeaders: details.requestHeaders });
  });
  protocol.registerHttpProtocol('github', (request, callback) => {
    request.url = `https://api.github.com/${request.url.substr(9)}`;
    callback(request);
  })
  protocol.registerHttpProtocol('api', (request, callback) => {
    request.url = `http://localhost:5000/api/${request.url.substr(6)}`;
    // request.headers.token = 'RANDOM_TOKEN';
    callback(request)
  })
}

function startServer () {
  const app = express();
  app.use(express.json());

  const books = [
    { id: 1, name: 'book1' },
    { id: 2, name: 'book2' },
    { id: 3, name: 'book3' },
  ];
  app.get('/api/books', (req, res) => {
    console.log(JSON.stringify(req.headers));
    res.json(books).end();
  });
  const port = 5000;
  app.listen(port, () => console.log(`Listening on port ${port}`));
}

function _registerRTCHandleEvents() {
  /** @type {Map<number, BrowserWindow>} */
  const RTCWinMap = new Map();
  async function creareRTCWin() {
    const win = await createWindow('rtc/pc/index.html');
    win.once('close', (e) => {
      const wins = [...RTCWinMap.values()];
      if (wins.length === 0) return;
      e.preventDefault();
      RTCWinMap.forEach((v, id) => RTCWinMap.delete(id));
      wins.forEach(w => w.close())
    });
    RTCWinMap.set(win.webContents.id, win);
  }
  ipcMain.on('RTC:open', () => {
    creareRTCWin();
    creareRTCWin();
  });
  ipcMain.handle('RTC:IDS', event => [...new Set([event.sender.id, ...RTCWinMap.keys()])]);
  ipcMain.on('RTC:ICECandidate', (event, { candidate, receiver, id }) => {
    const sender = event.sender.id;
    webContents.getAllWebContents().find(wc => wc.id === receiver)?.send('RTC:ICECandidate', { sender, candidate, id });
  })
  ipcMain.on('RTC:offerSdp', (event, { desc, receiver }) => {
    const sender = event.sender.id;
    // console.log(desc);
    webContents.getAllWebContents().find(wc => wc.id === receiver)?.send('RTC:offerSdp', { sender, desc });
  });
  ipcMain.on('RTC:answerSdp', (event, { desc, receiver }) => {
    const sender = event.sender.id;
    webContents.getAllWebContents().find(wc => wc.id === receiver)?.send('RTC:answerSdp', { sender, desc });
  });
  ipcMain.on('RTC:close', (event, { receiver }) => {
    const sender = event.sender.id;
    webContents.getAllWebContents().find(wc => wc.id === receiver)?.send('RTC:close', { sender });
  })
}