'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, net } = require('electron');
const fs = require('fs');
const path = require('path');
const { ensureCli } = require('./lib/retroplug');
const { renderProject } = require('./lib/renderer');

const SONG_EXTS = ['lsdprj', 'lsdsng'];

// ---- open-file must be registered before 'ready' (Electron docs, app 'open-file')
const pendingOpens = [];
let win = null;
app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (win) { openSong(filePath); return; }
  pendingOpens.push(filePath); // flushed when the window has loaded
  if (app.isReady()) createWindow(); // macOS: app running with no window
});

// ---- paths & persistent state (all under userData)
const dataDir = () => app.getPath('userData');
const P = {
  config: () => path.join(dataDir(), 'config.json'),
  library: () => path.join(dataDir(), 'library.json'),
  renders: () => path.join(dataDir(), 'renders'),
  work: () => path.join(app.getPath('temp'), 'lsdj-player'),
  retroplug: () => path.join(dataDir(), 'retroplug'),
};

const readJson = (file, fallback) => {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
};
const writeJson = (file, value) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2));
};

let config = { romPath: null, maxDuration: '3m', autoReload: true };
let library = []; // newest first: { key, title, sourcePath, wavPath, createdAt, durationMs, hff, missingKits }

const send = (channel, payload) => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload); };
const status = (state, message) => send('status', { state, message });
const pushState = () => send('state', { config, library });

// ---- rendering
let busy = Promise.resolve();
let watcher = null;
let watched = null; // { dir, base, path }

async function openSong(filePath, { reason = 'open' } = {}) {
  busy = busy.then(() => doOpen(filePath, reason)).catch(() => {});
  return busy;
}

async function doOpen(filePath, reason) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (!SONG_EXTS.includes(ext)) { status('error', `Not an LSDj song: ${path.basename(filePath)}`); return; }
  if (!config.romPath || !fs.existsSync(config.romPath)) {
    status('error', 'Choose your LSDj ROM first (Settings).');
    return;
  }
  const title = path.basename(filePath, path.extname(filePath));
  try {
    status('busy', reason === 'reload' ? `Changed — rendering ${title}…` : `Rendering ${title}…`);
    const cli = await ensureCli(P.retroplug(), net.fetch);
    const r = await renderProject(filePath, {
      cli, romPath: config.romPath, maxDuration: config.maxDuration,
      rendersDir: P.renders(), workDir: P.work(),
    });
    library = library.filter((e) => e.key !== r.key);
    const entry = {
      key: r.key, title, sourcePath: filePath, wavPath: r.wavPath, createdAt: Date.now(),
      durationMs: r.durationMs, hff: r.hff, missingKits: r.missingKits,
    };
    library.unshift(entry);
    writeJson(P.library(), library);
    pushState();
    send('play', entry.key);
    const notes = [];
    if (r.hff === false) notes.push(`no HFF — cut at ${config.maxDuration}`);
    if (r.missingKits && r.missingKits.length) notes.push(`kits not in ROM: ${r.missingKits.join(', ')}`);
    status('ok', `${title}${r.cached ? ' (cached)' : ` rendered in ${(r.renderMs / 1000).toFixed(1)}s`}${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
    watch(filePath);
  } catch (err) {
    status('error', `${title}: ${String(err.message).split('\n')[0]}`);
    console.error(err);
  }
}

// Watch the song's folder (not the file) so atomic saves (write + rename) are caught too.
function watch(filePath) {
  if (watcher) { watcher.close(); watcher = null; }
  watched = null;
  if (!config.autoReload) return;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath);
  let timer = null;
  let last = fs.statSync(filePath).mtimeMs;
  try {
    watcher = fs.watch(dir, (_event, name) => {
      if (name && name !== base) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        let st;
        try { st = fs.statSync(filePath); } catch { return; }
        if (st.mtimeMs === last) return;
        last = st.mtimeMs;
        openSong(filePath, { reason: 'reload' });
      }, 300);
    });
    watched = { dir, base, path: filePath };
  } catch (err) { console.error(err); }
}

// ---- IPC
ipcMain.handle('get-state', () => ({ config, library }));
ipcMain.handle('open-dialog', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'], filters: [{ name: 'LSDj song', extensions: SONG_EXTS }],
  });
  if (!r.canceled && r.filePaths[0]) await openSong(r.filePaths[0]);
});
ipcMain.handle('open-path', (_e, p) => openSong(p));
ipcMain.handle('read-wav', (_e, key) => {
  const entry = library.find((x) => x.key === key);
  if (!entry || !fs.existsSync(entry.wavPath)) return null;
  return fs.readFileSync(entry.wavPath);
});
ipcMain.handle('reveal', (_e, key) => {
  const entry = library.find((x) => x.key === key);
  if (entry) shell.showItemInFolder(entry.wavPath);
});
ipcMain.handle('delete', (_e, key) => {
  const entry = library.find((x) => x.key === key);
  if (!entry) return;
  for (const f of [entry.wavPath, entry.wavPath.replace(/\.wav$/, '.json')]) fs.rmSync(f, { force: true });
  library = library.filter((x) => x.key !== key);
  writeJson(P.library(), library);
  pushState();
});
ipcMain.handle('choose-rom', async () => {
  const r = await dialog.showOpenDialog(win, {
    properties: ['openFile'], filters: [{ name: 'Game Boy ROM', extensions: ['gb', 'gbc'] }],
  });
  if (r.canceled || !r.filePaths[0]) return;
  config.romPath = r.filePaths[0];
  writeJson(P.config(), config);
  pushState();
});
ipcMain.handle('set-config', (_e, patch) => {
  if (typeof patch.maxDuration === 'string' && /^\d+(\.\d+)?(ms|s|m)?$/.test(patch.maxDuration)) {
    config.maxDuration = patch.maxDuration;
  }
  if (typeof patch.autoReload === 'boolean') {
    config.autoReload = patch.autoReload;
    if (!config.autoReload && watcher) { watcher.close(); watcher = null; watched = null; }
  }
  writeJson(P.config(), config);
  pushState();
});

// ---- app lifecycle
function createWindow() {
  win = new BrowserWindow({
    width: 560, height: 640, minWidth: 420, minHeight: 420,
    title: 'LSDj Player',
    backgroundColor: '#1b1d22',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.on('closed', () => { win = null; });
  win.webContents.once('did-finish-load', () => {
    pushState();
    // files passed on the command line (non-macOS, or `electron . song.lsdprj` in dev)
    const argvSongs = process.argv.slice(1).filter((a) => SONG_EXTS.includes(path.extname(a).slice(1).toLowerCase()));
    for (const p of [...argvSongs, ...pendingOpens.splice(0)]) openSong(path.resolve(p));
  });
}

app.whenReady().then(() => {
  config = { ...config, ...readJson(P.config(), {}) };
  library = readJson(P.library(), []).filter((e) => fs.existsSync(e.wavPath));
  createWindow();
  app.on('activate', () => { if (!win) createWindow(); });
});

app.on('window-all-closed', () => {
  if (watcher) watcher.close();
  if (process.platform !== 'darwin') app.quit();
});
