// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const electron = require('electron')
const { contextBridge, ipcRenderer, shell, clipboard, desktopCapturer } = electron;

window.addEventListener('DOMContentLoaded', () => {
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector)
    if (element) element.innerText = text
  }

  for (const type of ['chrome', 'node', 'electron']) {
    replaceText(`${type}-version`, process.versions[type])
  }
})

const dialog = {
  showCertificateTrustDialog: (...args) => ipcRenderer.invoke('dialog:showCertificateTrustDialog', ...args),
  showErrorBox: (...args) => ipcRenderer.invoke('dialog:showErrorBox', ...args),
  showMessageBox: (...args) => ipcRenderer.invoke('dialog:showMessageBox', ...args),
  showOpenDialog: (...args) => ipcRenderer.invoke('dialog:showOpenDialog', ...args),
  showSaveDialog: (...args) => ipcRenderer.invoke('dialog:showSaveDialog', ...args)
};

const systemPreferences = {
  getMediaAccessStatus: (...args) => ipcRenderer.sendSync('systemPreferences:getMediaAccessStatus', ...args)
}

const _ipcRenderer = {
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  postMessage: (channel, message, transfers) => ipcRenderer.postMessage(channel, message, transfers),
  send: (channel, ...args) => ipcRenderer.send(channel, ...args),
  sendSync: (channel, ...args) => ipcRenderer.send(channel, ...args),
  sendTo: (id, channel, ...args) => ipcRenderer.sendTo(id, channel, ...args),
  sendToHost: (channel, ...args) => ipcRenderer.sendToHost(channel, args),
  // event emitter methods 
  // https://www.electronjs.org/docs/api/context-bridge#parameter--error--return-type-support
  // 如果直接用 ipcRenderer，会导致原型链上的方法不会被克隆
  on: (channel, listener) => (ipcRenderer.on(channel, listener), _ipcRenderer),
  once: (channel, listener) => (ipcRenderer.once(channel, listener), _ipcRenderer),
  removeAllListeners: (channel) => (ipcRenderer.removeAllListeners(channel), _ipcRenderer),
  removeListener: (channel, listener) => (ipcRenderer.removeListener(channel, listener), _ipcRenderer),
  setMaxListeners: (n) => (ipcRenderer.setMaxListeners(n), _ipcRenderer),
  getMaxListeners: () => ipcRenderer.getMaxListeners(),
  listeners: (e) => ipcRenderer.listeners(e),
  rawListeners: (e) => ipcRenderer.rawListeners(e),
  emit: (e, ...args) => ipcRenderer.emit(e, ...args),
  listenerCount: (e) => ipcRenderer.listenerCount(e),
  addListener: (e, l) => (ipcRenderer.addListener(e, l), _ipcRenderer),
  off: (e, l) => (ipcRenderer.off(e, l), _ipcRenderer),
  prependListener: (e, l) => (ipcRenderer.prependListener(e, l), _ipcRenderer),
  prependOnceListener: (e, l) => (ipcRenderer.prependOnceListener(e, l), _ipcRenderer),
  eventNames: () => ipcRenderer.eventNames()
}

const api = { ipcRenderer: _ipcRenderer, shell, clipboard, dialog, systemPreferences, desktopCapturer };

contextBridge.exposeInMainWorld('electron', electron);

contextBridge.exposeInMainWorld('require', (name) => {
  switch (name) {
    case 'electron':
      return api;
    default:
      throw new Error(`UNKNOWN_MODULE: ${name}`);
  }
});
