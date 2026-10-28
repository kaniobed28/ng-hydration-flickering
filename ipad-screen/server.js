// Use an iPad as a second screen for a Windows PC over the local Wi-Fi.
// No dependencies, no internet: `node server.js`, then follow the printed steps.
//
// The PC page (opened on localhost) captures a display with getDisplayMedia and
// streams it over WebRTC. The iPad page receives it. This server only serves the
// page and relays the offer/answer between the two over Server-Sent Events.

const http = require('http');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;

// One live event stream per role; the newest tab wins.
const clients = { sender: null, viewer: null };

function send(role, msg) {
  const res = clients[role];
  if (!res) return false;
  res.write(`data: ${JSON.stringify(msg)}\n\n`);
  return true;
}

function lanAddresses() {
  const out = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push(`http://${a.address}:${PORT}`);
    }
  }
  return out;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE.replace('__ADDRESSES__', JSON.stringify(lanAddresses())));
  }

  if (req.method === 'GET' && url.pathname === '/events') {
    const role = url.searchParams.get('role');
    if (role !== 'sender' && role !== 'viewer') {
      res.writeHead(400);
      return res.end();
    }
    const other = role === 'sender' ? 'viewer' : 'sender';

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
    });
    res.write('retry: 2000\n\n');

    if (clients[role]) {
      send(role, { type: 'replaced' });
      clients[role].end();
    }
    clients[role] = res;
    send(other, { type: 'peer-joined' });
    if (clients[other]) send(role, { type: 'peer-joined' });

    const ping = setInterval(() => res.write(': ping\n\n'), 15000);
    req.on('close', () => {
      clearInterval(ping);
      if (clients[role] === res) {
        clients[role] = null;
        send(other, { type: 'peer-left' });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/signal') {
    const to = url.searchParams.get('to');
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) req.destroy();
    });
    req.on('end', () => {
      let msg;
      try {
        msg = JSON.parse(body);
      } catch {
        res.writeHead(400);
        return res.end();
      }
      const delivered = (to === 'sender' || to === 'viewer') && send(to, msg);
      res.writeHead(delivered ? 204 : 409);
      res.end();
    });
    return;
  }

  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddresses();
  console.log('\niPad second screen is running.\n');
  console.log(`  On this PC (Chrome or Edge):  http://localhost:${PORT}   -> tap Share, pick the virtual display`);
  if (lan.length) {
    for (const a of lan) console.log(`  On the iPad (Safari):         ${a}`);
  } else {
    console.log('  No Wi-Fi/LAN address found. Is this PC connected to the network?');
  }
  console.log('\nIf the iPad cannot load the page, allow Node through Windows Firewall');
  console.log('and set this Wi-Fi network to "Private". Press Ctrl+C to stop.\n');
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Second Screen</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #eee;
    font: 16px -apple-system, "Segoe UI", system-ui, sans-serif; }
  #bar { position: fixed; top: 0; left: 0; right: 0; z-index: 1; display: flex; gap: 12px;
    align-items: center; flex-wrap: wrap;
    padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; background: rgba(20,20,20,.85); }
  button { font: inherit; padding: 8px 18px; border: 0; border-radius: 8px; background: #2f6fed; color: #fff; }
  #status { opacity: .85; }
  #hint { width: 100%; font-size: 14px; opacity: .7; }
  video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
<div id="bar"><button id="btn"></button><span id="status"></span><div id="hint"></div></div>
<video id="v" autoplay playsinline muted></video>
<script>
const ADDRESSES = __ADDRESSES__;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const role = new URLSearchParams(location.search).get('role') || (local ? 'sender' : 'viewer');
const other = role === 'sender' ? 'viewer' : 'sender';

const v = document.getElementById('v');
const btn = document.getElementById('btn');
const hint = document.getElementById('hint');
const setStatus = (t) => { document.getElementById('status').textContent = t; };

let es, pc, stream, peerHere = false, queue = Promise.resolve();

const post = (msg) =>
  fetch('/signal?to=' + other, { method: 'POST', body: JSON.stringify(msg) }).catch(() => {});

function listen() {
  es = new EventSource('/events?role=' + role);
  es.onmessage = (e) => { const m = JSON.parse(e.data); queue = queue.then(() => onMsg(m)).catch(console.error); };
  es.onerror = () => setStatus('Reconnecting to the PC…');
}

// Same Wi-Fi, so the local (host) candidates are enough: no STUN/TURN servers.
// Waiting for gathering to finish lets each side send one complete description.
function gathered(p) {
  return new Promise((resolve) => {
    if (p.iceGatheringState === 'complete') return resolve();
    p.addEventListener('icegatheringstatechange', () => p.iceGatheringState === 'complete' && resolve());
    setTimeout(resolve, 2000);
  });
}

function newPc() {
  if (pc) pc.close();
  const p = new RTCPeerConnection();
  p.onconnectionstatechange = () => {
    const s = p.connectionState;
    if (s === 'connected') setStatus(role === 'sender' ? 'Streaming to the iPad' : 'Connected. Tap the video for full screen.');
    else if (s === 'failed') setStatus('Connection failed. Are both devices on the same Wi-Fi?');
    else if (s === 'connecting') setStatus('Connecting…');
  };
  return (pc = p);
}

async function offer() {
  const p = newPc();
  const [track] = stream.getVideoTracks();
  p.addTransceiver(track, { direction: 'sendonly', streams: [stream], sendEncodings: [{ maxBitrate: 12000000 }] });
  await p.setLocalDescription(await p.createOffer());
  await gathered(p);
  post({ type: 'offer', sdp: p.localDescription });
}

async function onMsg(m) {
  switch (m.type) {
    case 'replaced':
      es.close();
      setStatus('This page was opened in another tab.');
      break;
    case 'peer-joined':
      peerHere = true;
      if (role === 'sender') { if (stream) await offer(); }
      else if (!pc) setStatus('Connected to the PC. Waiting for it to share a screen…');
      break;
    case 'peer-left':
      peerHere = false;
      if (pc) { pc.close(); pc = null; }
      if (role === 'sender') setStatus(stream ? 'iPad disconnected. Waiting for it…' : '');
      else { v.srcObject = null; setStatus('The PC page was closed.'); }
      break;
    case 'bye':
      if (pc) { pc.close(); pc = null; }
      v.srcObject = null;
      setStatus('The PC stopped sharing. Waiting…');
      break;
    case 'offer': {
      const p = newPc();
      p.ontrack = (e) => { v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); };
      await p.setRemoteDescription(m.sdp);
      await p.setLocalDescription(await p.createAnswer());
      await gathered(p);
      post({ type: 'answer', sdp: p.localDescription });
      break;
    }
    case 'answer':
      if (pc) await pc.setRemoteDescription(m.sdp);
      break;
  }
}

if (role === 'sender') {
  btn.textContent = 'Share';
  hint.textContent = ADDRESSES.length
    ? 'On the iPad, open ' + ADDRESSES.join(' or ') + ' in Safari and tap Connect.'
    : 'No network address found. Connect this PC to the Wi-Fi.';
  btn.onclick = async () => {
    let s;
    try {
      s = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 60, cursor: 'always' }, audio: false });
    } catch {
      return setStatus('Sharing was cancelled.');
    }
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = s;
    const [track] = stream.getVideoTracks();
    track.contentHint = 'detail';
    track.onended = () => {
      if (stream !== s) return;
      stream = null;
      if (pc) { pc.close(); pc = null; }
      v.srcObject = null;
      btn.textContent = 'Share';
      post({ type: 'bye' });
      setStatus('Stopped sharing.');
    };
    v.srcObject = stream;
    btn.textContent = 'Share a different screen';
    if (peerHere) await offer();
    else setStatus('Sharing. Waiting for the iPad to connect…');
  };
  listen();
} else {
  btn.textContent = 'Connect';
  btn.onclick = () => {
    btn.hidden = true;
    setStatus('Connecting to the PC…');
    listen();
  };
  v.onclick = () => {
    if (!v.srcObject) return;
    const fs = v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen;
    if (fs) fs.call(v);
  };
}
</script>
</body>
</html>`;
