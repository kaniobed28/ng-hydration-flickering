// Use an iPad or Android tablet/phone as a second screen for a Windows PC,
// over the same Wi-Fi or an Android USB-tethering cable.
// No dependencies, no internet: `node server.js`, then follow the printed steps.
//
// The PC page (opened on localhost) captures a display with getDisplayMedia and
// streams it over WebRTC to every device the PC has allowed. This server only
// serves the page and relays the offer/answer messages over Server-Sent Events.

const http = require('http');
const os = require('os');

const PORT = Number(process.env.PORT) || 8080;

let sender = null;          // event stream of the PC page
const viewers = new Map();  // viewer id -> { res, device }

const isLoopback = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress);

function write(res, msg) {
  if (res) res.write(`data: ${JSON.stringify(msg)}\n\n`);
  return !!res;
}

function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family === 'IPv4' && !a.internal) out.push({ name, url: `http://${a.address}:${PORT}` });
    }
  }
  return out;
}

function openStream(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-store',
    Connection: 'keep-alive',
  });
  res.write('retry: 2000\n\n');
  const ping = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(ping));
}

function onEvents(req, res, url) {
  const role = url.searchParams.get('role');

  if (role === 'sender') {
    // Only the PC itself may share its screen.
    if (!isLoopback(req)) { res.writeHead(403); return res.end(); }
    openStream(req, res);
    if (sender) { write(sender, { type: 'replaced' }); sender.end(); }
    sender = res;
    for (const [id, v] of viewers) {
      write(sender, { type: 'peer-joined', id, device: v.device });
      write(v.res, { type: 'peer-joined' });
    }
    req.on('close', () => {
      if (sender !== res) return;
      sender = null;
      for (const v of viewers.values()) write(v.res, { type: 'peer-left' });
    });
    return;
  }

  if (role === 'viewer') {
    const id = url.searchParams.get('id') || '';
    if (!/^[a-z0-9]{8,40}$/.test(id)) { res.writeHead(400); return res.end(); }
    const device = (url.searchParams.get('name') || 'Device').slice(0, 40);
    openStream(req, res);
    const old = viewers.get(id);
    if (old) { write(old.res, { type: 'replaced' }); old.res.end(); }
    viewers.set(id, { res, device });
    write(sender, { type: 'peer-joined', id, device });
    if (sender) write(res, { type: 'peer-joined' });
    req.on('close', () => {
      if (viewers.get(id)?.res !== res) return;
      viewers.delete(id);
      write(sender, { type: 'peer-left', id });
    });
    return;
  }

  res.writeHead(400);
  res.end();
}

function onSignal(req, res, url) {
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
    let delivered = false;
    if (to === 'sender') {
      // Stamp who it came from, so a device can only speak for itself.
      const from = url.searchParams.get('from');
      if (viewers.has(from)) delivered = write(sender, { ...msg, from });
    } else if (to === 'viewer' && isLoopback(req)) {
      delivered = write(viewers.get(url.searchParams.get('id'))?.res, msg);
    }
    res.writeHead(delivered ? 204 : 409);
    res.end();
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return res.end(PAGE.replace('__ADDRESSES__', JSON.stringify(lanAddresses())));
  }
  if (req.method === 'GET' && url.pathname === '/events') return onEvents(req, res, url);
  if (req.method === 'POST' && url.pathname === '/signal') return onSignal(req, res, url);
  res.writeHead(404);
  res.end();
});

server.listen(PORT, '0.0.0.0', () => {
  const lan = lanAddresses();
  console.log('\nSecond screen is running.\n');
  console.log(`  On this PC (Edge or Chrome):  http://localhost:${PORT}`);
  console.log('     click "Send extra screen to tablet" and pick the virtual display (Screen 2)\n');
  if (lan.length) {
    console.log('  On the iPad / Android (Safari or Chrome), open the address on the same network:');
    for (const a of lan) console.log(`     ${a.url.padEnd(28)} ${a.name}`);
  } else {
    console.log('  No network found. Connect to Wi-Fi, or turn on USB tethering on the Android device.');
  }
  console.log('\n  Turned on USB tethering or changed Wi-Fi? Restart this to see the new address.');
  console.log('  Press Ctrl+C to stop.\n');
});

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Second Screen</title>
<style>
  html, body { margin: 0; height: 100%; background: #000; color: #eee;
    font: 16px -apple-system, "Segoe UI", Roboto, system-ui, sans-serif; }
  #bar { position: fixed; top: 0; left: 0; right: 0; z-index: 1; display: flex; gap: 12px;
    align-items: center; flex-wrap: wrap;
    padding: calc(env(safe-area-inset-top, 0px) + 10px) 16px 10px; background: rgba(20,20,20,.88); }
  button { font: inherit; padding: 8px 18px; border: 0; border-radius: 8px; background: #2f6fed; color: #fff; cursor: pointer; }
  button.plain { background: #444; }
  #status { opacity: .85; }
  #hint { width: 100%; font-size: 14px; opacity: .7; }
  .ask { width: 100%; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    padding: 10px 12px; border-radius: 8px; background: #3a2f0b; }
  video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
<div id="bar"><button id="btn"></button><span id="status"></span><div id="hint"></div><div id="asks"></div></div>
<video id="v" autoplay playsinline muted></video>
<script>
const ADDRESSES = __ADDRESSES__;
const local = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
const role = local ? 'sender' : 'viewer';

const v = document.getElementById('v');
const btn = document.getElementById('btn');
const hint = document.getElementById('hint');
const asks = document.getElementById('asks');
const setStatus = (t) => { document.getElementById('status').textContent = t; };

let es, queue = Promise.resolve();

function listen(query) {
  es = new EventSource('/events?' + query);
  es.onmessage = (e) => { const m = JSON.parse(e.data); queue = queue.then(() => onMsg(m)).catch(console.error); };
  es.onerror = () => setStatus('Reconnecting…');
}

// Same network, so local (host) candidates are enough: no STUN/TURN servers.
// Waiting for gathering to finish lets each side send one complete description.
function gathered(p) {
  return new Promise((resolve) => {
    if (p.iceGatheringState === 'complete') return resolve();
    p.addEventListener('icegatheringstatechange', () => p.iceGatheringState === 'complete' && resolve());
    setTimeout(resolve, 2000);
  });
}

function storage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let onMsg;

if (role === 'sender') {
  // ---- PC: share a display with every allowed device ----
  const peers = new Map(); // id -> { device, allowed, pc, ask }
  const approved = new Set(storage('approved-devices', []));
  let stream = null;

  const postTo = (id, msg) =>
    fetch('/signal?to=viewer&id=' + encodeURIComponent(id), { method: 'POST', body: JSON.stringify(msg) }).catch(() => {});

  function render() {
    const live = [...peers.values()].filter((p) => p.allowed)
      .map((p) => p.device + (p.pc && p.pc.connectionState === 'connected' ? '' : ' (connecting)'));
    if (!stream) setStatus(live.length ? 'Connected: ' + live.join(', ') + '. Click the button to start.' : '');
    else setStatus(live.length ? 'Showing on: ' + live.join(', ') : 'Sharing. Waiting for a device to connect…');
  }

  function closePeer(p) {
    if (p.pc) { p.pc.close(); p.pc = null; }
  }

  async function offer(id) {
    const p = peers.get(id);
    closePeer(p);
    const pc = (p.pc = new RTCPeerConnection());
    pc.onconnectionstatechange = render;
    const [track] = stream.getVideoTracks();
    pc.addTransceiver(track, { direction: 'sendonly', streams: [stream], sendEncodings: [{ maxBitrate: 12000000 }] });
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    if (p.pc === pc) postTo(id, { type: 'offer', sdp: pc.localDescription });
    render();
  }

  function admit(id) {
    const p = peers.get(id);
    if (!p) return;
    p.allowed = true;
    postTo(id, { type: 'allowed' });
    if (stream) offer(id);
    render();
  }

  function ask(id) {
    const p = peers.get(id);
    const row = document.createElement('div');
    row.className = 'ask';
    const text = document.createElement('span');
    text.textContent = 'New device: ' + p.device + '. Let it see the extra screen?';
    const yes = document.createElement('button');
    yes.textContent = 'Allow';
    const no = document.createElement('button');
    no.textContent = "Don't allow";
    no.className = 'plain';
    yes.onclick = () => { row.remove(); approved.add(id); store('approved-devices', [...approved]); admit(id); };
    no.onclick = () => { row.remove(); postTo(id, { type: 'denied' }); };
    row.append(text, yes, no);
    asks.append(row);
    p.ask = row;
  }

  onMsg = async (m) => {
    switch (m.type) {
      case 'replaced':
        es.close();
        setStatus('This page was opened in another tab.');
        break;
      case 'peer-joined': {
        const old = peers.get(m.id);
        if (old) { closePeer(old); if (old.ask) old.ask.remove(); }
        peers.set(m.id, { device: m.device, allowed: false, pc: null, ask: null });
        if (approved.has(m.id)) admit(m.id); else ask(m.id);
        break;
      }
      case 'peer-left': {
        const p = peers.get(m.id);
        if (p) { closePeer(p); if (p.ask) p.ask.remove(); peers.delete(m.id); }
        render();
        break;
      }
      case 'answer': {
        const p = peers.get(m.from);
        if (p && p.pc) await p.pc.setRemoteDescription(m.sdp);
        break;
      }
    }
  };

  btn.textContent = 'Send extra screen to tablet';
  hint.textContent = ADDRESSES.length
    ? 'On the tablet, open ' + ADDRESSES.map((a) => a.url + ' (' + a.name + ')').join(' or ') + ' and tap Connect.'
    : 'No network found. Connect to Wi-Fi, or turn on USB tethering on the Android device.';

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
      v.srcObject = null;
      btn.textContent = 'Send extra screen to tablet';
      for (const [id, p] of peers) { closePeer(p); if (p.allowed) postTo(id, { type: 'bye' }); }
      render();
    };
    v.srcObject = stream;
    btn.textContent = 'Pick a different screen';
    for (const [id, p] of peers) if (p.allowed) await offer(id);
    render();
  };

  listen('role=sender');
} else {
  // ---- iPad / Android: show what the PC sends ----
  let pc = null, allowed = false;

  let id = storage('device-id', '');
  if (!/^[a-z0-9]{8,40}$/.test(id)) {
    id = (Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)).slice(0, 24);
    store('device-id', id);
  }
  const ua = navigator.userAgent;
  const device = /Android/.test(ua) ? (/Mobile/.test(ua) ? 'Android phone' : 'Android tablet')
    : /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) ? 'iPad'
    : /iPhone/.test(ua) ? 'iPhone' : 'Device';

  const post = (msg) =>
    fetch('/signal?to=sender&from=' + id, { method: 'POST', body: JSON.stringify(msg) }).catch(() => {});

  function drop() {
    if (pc) { pc.close(); pc = null; }
    v.srcObject = null;
  }

  onMsg = async (m) => {
    switch (m.type) {
      case 'replaced':
        es.close();
        setStatus('This page was opened in another tab.');
        break;
      case 'peer-joined':
        if (!allowed) setStatus('Waiting for the PC to allow this ' + device + '…');
        break;
      case 'allowed':
        allowed = true;
        if (!pc) setStatus('Allowed. Waiting for the PC to start sharing…');
        break;
      case 'denied':
        es.close();
        setStatus('The PC did not allow this device.');
        btn.hidden = false;
        break;
      case 'peer-left':
        allowed = false;
        drop();
        setStatus('The PC page was closed. Waiting for it…');
        break;
      case 'bye':
        drop();
        setStatus('The PC stopped sharing. Waiting…');
        break;
      case 'offer': {
        if (pc) pc.close();
        const p = (pc = new RTCPeerConnection());
        p.onconnectionstatechange = () => {
          if (p.connectionState === 'connected') setStatus('Connected. Tap the video for full screen.');
          else if (p.connectionState === 'failed') setStatus('Connection failed. Are both devices on the same network?');
        };
        p.ontrack = (e) => { v.srcObject = e.streams[0] || new MediaStream([e.track]); v.play().catch(() => {}); };
        await p.setRemoteDescription(m.sdp);
        await p.setLocalDescription(await p.createAnswer());
        await gathered(p);
        post({ type: 'answer', sdp: p.localDescription });
        break;
      }
    }
  };

  btn.textContent = 'Connect';
  btn.onclick = () => {
    btn.hidden = true;
    setStatus('Connecting to the PC…');
    listen('role=viewer&id=' + id + '&name=' + encodeURIComponent(device));
  };

  v.onclick = async () => {
    if (!v.srcObject) return;
    try {
      if (v.requestFullscreen) await v.requestFullscreen();
      else if (v.webkitRequestFullscreen) v.webkitRequestFullscreen();
      else if (v.webkitEnterFullscreen) v.webkitEnterFullscreen();
    } catch {}
    try { await screen.orientation.lock('landscape'); } catch {}
  };
}
</script>
</body>
</html>`;
