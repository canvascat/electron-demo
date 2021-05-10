const { dialog, systemPreferences, desktopCapturer, ipcRenderer } = require('electron');

document.querySelector('#dialog').addEventListener('click', () => {
  dialog.showMessageBox({
    title: 'title',
    type: 'info',
    message: 'message',
    checkboxLabel: 'checkboxLabel',
    checkboxChecked: true,
    buttons: ['cancel', 'confirm']
  })
    .then(console.log, console.warn)
})

/**
 *
 * @param {RequestInfo} input
 * @param {RequestInit} [init]
 * @returns {Promise<Response>}
 */
 const ajax = (input, init = {}) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.onload = () => resolve(new Response(xhr.responseText, { status: xhr.status }));
  xhr.onerror = () => reject(new TypeError('Local request failed'));
  const method = (init.method ?? 'GET').toUpperCase();
  xhr.open(method, input);
  xhr.send(null);
});

Object.defineProperty(window, 'ajax', { value: ajax });
console.log(systemPreferences.getMediaAccessStatus('screen'));

fetch('github://users/canvascat')
  .then(r => r.text())
  .then(text => {
    document.querySelector('#fetch-data').textContent = text;
  });

async function getDisplayMedia() {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  const sourceNames = sources.map(source => source.name);
  // https://www.electronjs.org/docs/api/context-bridge#parameter--error--return-type-support
  // 这里的source.thumbnail并不是一个NativeImage，而是被序列化后的普通对象，所以无法使用 NativeImage 的方法
  // 放到主进程或preload处理好后返回
  // sources.map(source => source.thumbnail.getSize());
  // console.log(sources);
  const { response } = await dialog.showMessageBox({
    title: '提示',
    message: '选择视频源',
    buttons: ['cancel', ...sourceNames]
  })
  if (response === 0) throw new Error('CANCEL');
  const chromeMediaSourceId = sources[response - 1].id;
  return navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: {
    chromeMediaSource: 'desktop',
    chromeMediaSourceId,
    minWidth: 1280,
    maxWidth: 1280,
    minHeight: 720,
    maxHeight: 720
  } } });
}

document.querySelector('#getDisplayMedia').addEventListener('click', () => {
  getDisplayMedia().then(stream => {
    const video = document.querySelector('#displayVideo');
    video.srcObject = stream;
    video.onloadedmetadata = (e) => video.play();
  }, err => {
    if (err.message !== 'CANCEL') {
      dialog.showErrorBox('提示', err.message);
    }
  })
});


document.querySelector('#createRTCWindow').addEventListener('click', () => {
  // ipcRenderer.send('window:createRTCWindow');
  ipcRenderer.send('RTC:open');
});