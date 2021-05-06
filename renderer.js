// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// No Node.js APIs are available in this process because
// `nodeIntegration` is turned off. Use `preload.js` to
// selectively enable features needed in the rendering
// process.

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
