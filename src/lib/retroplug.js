'use strict';
// Downloads retroplug-cli from the official RetroPlug release on first use and
// verifies it against the SHA-256 published on the release page.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');

const VERSION = 'v0.7.4';
const ASSETS = {
  'darwin': { name: `retroplug-${VERSION}-macos-universal-cli`, sha256: 'fba48c4c9aa524e71edaf4c19115b2391ec232fa4243934dab8be77d74f50043' },
  'linux-x64': { name: `retroplug-${VERSION}-linux-x86_64-cli`, sha256: '84416b96d88fd8561d80f4a8c745b5e60ea99fb5bfcc4c840daa1cb3877e0ce5' },
  'linux-arm64': { name: `retroplug-${VERSION}-linux-aarch64-cli`, sha256: '6f266af6cc295103c575f4b00031467e92fe8598c75ac18fa482bb6eb3ef45b7' },
};

function asset() {
  const key = process.platform === 'darwin' ? 'darwin' : `${process.platform}-${process.arch}`;
  const a = ASSETS[key];
  if (!a) throw new Error(`retroplug-cli is not available for ${key}`);
  return a;
}

function cliPath(baseDir) {
  const a = asset();
  return path.join(baseDir, a.name, 'retroplug-cli');
}

// fetchImpl: a fetch() that follows redirects (Electron's net.fetch or global fetch)
async function ensureCli(baseDir, fetchImpl = fetch) {
  const cli = cliPath(baseDir);
  if (fs.existsSync(cli)) return cli;
  const a = asset();
  fs.mkdirSync(baseDir, { recursive: true });
  const url = `https://github.com/tommitytom/RetroPlug/releases/download/${VERSION}/${a.name}.zip`;
  const res = await fetchImpl(url);
  if (!res.ok) throw new Error(`download failed: HTTP ${res.status}`);
  const zip = Buffer.from(await res.arrayBuffer());
  const got = crypto.createHash('sha256').update(zip).digest('hex');
  if (got !== a.sha256) throw new Error(`checksum mismatch for ${a.name}.zip`);
  const zipPath = path.join(baseDir, `${a.name}.zip`);
  fs.writeFileSync(zipPath, zip);
  try {
    await promisify(execFile)('unzip', ['-o', '-q', zipPath, '-d', baseDir]);
  } finally {
    fs.rmSync(zipPath, { force: true });
  }
  fs.chmodSync(cli, 0o755);
  return cli;
}

module.exports = { ensureCli, cliPath, VERSION };
