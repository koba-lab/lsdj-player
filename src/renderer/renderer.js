'use strict';
const $ = (id) => document.getElementById(id);
const audio = $('audio');
let state = { config: {}, library: [] };
let currentKey = null;
let objectUrl = null;
let seeking = false;

const fmt = (sec) => {
  if (!Number.isFinite(sec)) return '0:00';
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const ago = (t) => new Date(t).toLocaleString(undefined, { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });

function renderLibrary() {
  const list = $('list');
  list.replaceChildren();
  $('empty').hidden = state.library.length > 0;
  for (const e of state.library) {
    const li = document.createElement('li');
    if (e.key === currentKey) li.className = 'current';
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = e.title;
    name.title = e.sourcePath;
    name.onclick = () => play(e.key);
    const meta = document.createElement('span');
    meta.className = 'meta';
    meta.textContent = `${e.durationMs ? fmt(e.durationMs / 1000) : ''} · ${ago(e.createdAt)}`;
    const reveal = document.createElement('button');
    reveal.textContent = 'Show';
    reveal.title = 'Show WAV in Finder';
    reveal.onclick = () => window.lsdj.reveal(e.key);
    const del = document.createElement('button');
    del.textContent = 'Delete';
    del.onclick = async () => {
      if (e.key === currentKey) stop(true);
      await window.lsdj.remove(e.key);
    };
    li.append(name, meta, reveal, del);
    list.append(li);
  }
}

function renderSettings() {
  const c = state.config;
  $('rom').textContent = c.romPath || 'not set';
  $('rom').title = c.romPath || '';
  if (document.activeElement !== $('max')) $('max').value = c.maxDuration || '3m';
  $('autoReload').checked = !!c.autoReload;
  if (!c.romPath) $('settings')?.setAttribute('open', '');
}

async function play(key) {
  const entry = state.library.find((e) => e.key === key);
  if (!entry) return;
  const bytes = await window.lsdj.readWav(key);
  if (!bytes) { setStatus('error', `Missing render for ${entry.title}`); return; }
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
  currentKey = key;
  audio.src = objectUrl;
  audio.loop = $('loop').checked;
  $('title').textContent = entry.title;
  $('sub').textContent = entry.sourcePath;
  ['play', 'stop', 'seek'].forEach((id) => { $(id).disabled = false; });
  await audio.play().catch(() => {});
  renderLibrary();
}

function stop(unload = false) {
  audio.pause();
  audio.currentTime = 0;
  if (unload) {
    audio.removeAttribute('src');
    currentKey = null;
    $('title').textContent = 'No song';
    $('sub').textContent = 'Drop an .lsdprj / .lsdsng here, or open one';
    ['play', 'stop', 'seek'].forEach((id) => { $(id).disabled = true; });
  }
}

function setStatus(kind, message) {
  const el = $('status');
  el.className = `status ${kind}`;
  el.textContent = message || '';
}

// player controls
$('play').onclick = () => (audio.paused ? audio.play() : audio.pause());
$('stop').onclick = () => stop();
$('loop').onchange = () => { audio.loop = $('loop').checked; };
$('open').onclick = () => window.lsdj.openDialog();
audio.onplay = () => { $('play').textContent = 'Pause'; };
audio.onpause = () => { $('play').textContent = 'Play'; };
audio.onloadedmetadata = () => { $('dur').textContent = fmt(audio.duration); };
audio.ontimeupdate = () => {
  $('pos').textContent = fmt(audio.currentTime);
  if (!seeking && audio.duration) $('seek').value = String(Math.round((audio.currentTime / audio.duration) * 1000));
};
$('seek').oninput = () => { seeking = true; $('pos').textContent = fmt((Number($('seek').value) / 1000) * audio.duration); };
$('seek').onchange = () => { audio.currentTime = (Number($('seek').value) / 1000) * audio.duration; seeking = false; };
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type === 'text') return;
  if (e.code === 'Space' && currentKey) { e.preventDefault(); $('play').click(); }
});

// settings
$('chooseRom').onclick = () => window.lsdj.chooseRom();
$('max').onchange = () => window.lsdj.setConfig({ maxDuration: $('max').value.trim() });
$('autoReload').onchange = () => window.lsdj.setConfig({ autoReload: $('autoReload').checked });

// drag & drop
let dragDepth = 0;
document.addEventListener('dragenter', (e) => { e.preventDefault(); dragDepth++; document.body.classList.add('dragging'); });
document.addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; document.body.classList.remove('dragging'); } });
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  document.body.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) window.lsdj.openFile(file);
});

// events from main
window.lsdj.on('state', (s) => { state = s; renderLibrary(); renderSettings(); });
window.lsdj.on('status', (s) => setStatus(s.state, s.message));
window.lsdj.on('play', (key) => play(key));
window.lsdj.getState().then((s) => { state = s; renderLibrary(); renderSettings(); });
