// All of the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { contextBridge, ipcRenderer, shell, clipboard } = require('electron')

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
const electron = { ipcRenderer, shell, clipboard, dialog };
contextBridge.exposeInMainWorld('require', (name) => {
  switch (name) {
    case 'electron':
      return electron;
    default:
      throw new Error(`UNKNOWN_MODULE: ${name}`);
  }
});
