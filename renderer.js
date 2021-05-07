const { dialog } = require('electron');

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

fetch('github://users/canvascat')
  .then(r => r.text())
  .then(text => {
    document.querySelector('#fetch-data').textContent = text;
  });
