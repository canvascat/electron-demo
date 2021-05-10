'use strict';
const { ipcRenderer, desktopCapturer } = require('electron');

const clone = v => JSON.parse(JSON.stringify(v));
const sleep = (t = 0) => new Promise(resolve => setTimeout(resolve, t));

async function getDisplayMedia() {
  const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] });
  const chromeMediaSourceId = sources[(Math.random() * (sources.length - 1)) >> 0].id
  return navigator.mediaDevices.getUserMedia({ audio: false, video: { mandatory: {
    chromeMediaSource: 'desktop',
    chromeMediaSourceId,
    minWidth: 300,
    maxWidth: 600,
    minHeight: 200,
    maxHeight: 400
  } } });
}

const startButton = document.getElementById('startButton');
const callButton = document.getElementById('callButton');
const hangupButton = document.getElementById('hangupButton');
callButton.disabled = true;
hangupButton.disabled = true;
startButton.onclick = start;
callButton.onclick = call;
hangupButton.onclick = hangup;

/** @type {HTMLVideoElement} */
const localVideo  = document.querySelector('video#video1');
/** @type {HTMLVideoElement} */
const remoteVideo = document.querySelector('video#video2');

/** @type {RTCPeerConnection} */
let localPC;
/** @type {RTCPeerConnection} */
let remotePC;
/** @type {number[]} */
let IDS;

(async () => {
  await sleep(2000);
  IDS = await ipcRenderer.invoke('RTC:IDS');
})();

ipcRenderer.on('RTC:ICECandidate', (event, { sender, candidate, id }) => {
  candidate = new RTCIceCandidate(candidate);
  (id === IDS[0] ? localPC : remotePC)?.addIceCandidate(candidate).then(onAddIceCandidateSuccess, onAddIceCandidateError);
});
ipcRenderer.on('RTC:offerSdp', async (event, { sender, desc }) => {
  if (!remotePC) createRemotePC(sender);
  await remotePC.setRemoteDescription(desc);
  const answer = await remotePC.createAnswer();
  await remotePC.setLocalDescription(answer);
  console.log(`Answer from pc1Remote\n${answer.sdp}`);
  ipcRenderer.send('RTC:answerSdp', { desc: clone(answer), receiver: sender });
});

ipcRenderer.on('RTC:answerSdp', (event, { sender, desc }) => {
  localPC.setRemoteDescription(desc);
});
ipcRenderer.on('RTC:close', (event, { sender }) => {
  remotePC.close();
  remotePC = null;
})


const offerOptions = {
  offerToReceiveAudio: 1,
  offerToReceiveVideo: 1
};

async function start () {
  console.log('Requesting local stream');
  startButton.disabled = true;
  // const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
  const stream = await getDisplayMedia();
  console.log('Received local stream');
  localVideo.srcObject = stream;
  callButton.disabled = false;
}

async function call () {
  callButton.disabled = true;
  hangupButton.disabled = false;
  console.log('Starting calls');
  const localStream  = localVideo.srcObject;
  const audioTracks = localStream.getAudioTracks();
  const videoTracks = localStream.getVideoTracks();
  console.log(`Using audio device: ${audioTracks[0]?.label}`);
  console.log(`Using video device: ${videoTracks[0]?.label}`);
  localPC = new RTCPeerConnection();
  localPC.onicecandidate = e => sendICECandidate(e.candidate, IDS[0]);;
  console.log('pc: created local and remote peer connection objects');
  localStream.getTracks().forEach(track => localPC.addTrack(track, localStream));
  console.log('Adding local stream to pcLocal');
  const desc = await localPC.createOffer(offerOptions);
  await localPC.setLocalDescription(desc);
  console.log(`Offer from pc1Local\n${desc.sdp}`);

  ipcRenderer.send('RTC:offerSdp', {
    desc: clone(desc),
    receiver: IDS[1]
  });
}

function createRemotePC() {
  remotePC = new RTCPeerConnection();
  remotePC.ontrack = e => {
    if (remoteVideo.srcObject == e.streams[0]) return;
    remoteVideo.srcObject = e.streams[0];
    console.log('pc: received remote stream');
  }
  remotePC.onicecandidate = e => sendICECandidate(e.candidate, IDS[1]);
}

function sendICECandidate(candidate, id) {
  console.log(`ICE candidate: ${candidate ? candidate.candidate : '(null)'}`);
  candidate && ipcRenderer.send('RTC:ICECandidate', {
    candidate: clone(candidate),
    receiver: IDS[1],
    id
  });
}

function hangup () {
  console.log('Ending calls');
  localPC.close();
  ipcRenderer.send('RTC:close', { receiver: IDS[1] })
  localPC = null;
  hangupButton.disabled = true;
  callButton.disabled = false;
}

function onAddIceCandidateSuccess () {
  console.log('AddIceCandidate success.');
}

function onAddIceCandidateError (error) {
  console.log(`Failed to add ICE candidate: ${error.toString()}`);
}
