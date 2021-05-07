// Modules to control application life and create native browser window
const { app, BrowserWindow, protocol, session, dialog } = require('electron');
const { ipcMain } = require('electron/main');
const express = require('express')
const path = require('path')

protocol.registerSchemesAsPrivileged([
  { scheme: 'github', privileges: { supportFetchAPI: true } },
  { scheme: 'api', privileges: { supportFetchAPI: true } }
]);

function createWindow () {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  registerProtocols()
  startServer()
  registerIpcHandleEvents()
  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function registerIpcHandleEvents() {
  ipcMain.handle('dialog:showCertificateTrustDialog', (event, ...args) => dialog.showCertificateTrustDialog(...args));
  ipcMain.handle('dialog:showErrorBox', (event, ...args) => dialog.showErrorBox(...args));
  ipcMain.handle('dialog:showMessageBox', (event, ...args) => dialog.showMessageBox(...args));
  ipcMain.handle('dialog:showOpenDialog', (event, ...args) => dialog.showOpenDialog(...args));
  ipcMain.handle('dialog:showSaveDialog', (event, ...args) => dialog.showSaveDialog(...args));
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
