'use strict';
// Render pipeline: project file -> LSDj save -> retroplug-cli -> WAV (cached by content hash).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { projectToSav } = require('./lsdprj');

function cacheKey(project, rom, maxDuration) {
  return crypto.createHash('sha256')
    .update(project).update(rom).update(String(maxDuration))
    .digest('hex').slice(0, 16);
}

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      const out = `${stdout}${stderr}`;
      if (err) { err.message = `${err.message}\n${out}`; reject(err); } else resolve(out);
    });
  });
}

// opts: { cli, romPath, maxDuration, rendersDir, workDir }
// Returns { key, wavPath, cached, name, durationMs, hff, missingKits, log }
async function renderProject(projectPath, opts) {
  const project = fs.readFileSync(projectPath);
  const rom = fs.readFileSync(opts.romPath);
  const key = cacheKey(project, rom, opts.maxDuration);
  const wavPath = path.join(opts.rendersDir, `${key}.wav`);
  const metaPath = path.join(opts.rendersDir, `${key}.json`);
  if (fs.existsSync(wavPath) && fs.existsSync(metaPath)) {
    return { ...JSON.parse(fs.readFileSync(metaPath, 'utf8')), key, wavPath, cached: true };
  }

  const conv = projectToSav(project, rom);
  fs.mkdirSync(opts.workDir, { recursive: true });
  fs.mkdirSync(opts.rendersDir, { recursive: true });
  const savPath = path.join(opts.workDir, `${key}.sav`);
  const tmpWav = path.join(opts.workDir, `${key}.wav`);
  fs.writeFileSync(savPath, conv.sav);
  const started = Date.now();
  let log;
  try {
    log = await run(opts.cli, ['render', opts.romPath, '--sav', savPath, '--out', tmpWav,
      '--max-duration', opts.maxDuration]);
  } finally {
    fs.rmSync(savPath, { force: true });
  }
  if (!fs.existsSync(tmpWav) || fs.statSync(tmpWav).size === 0) {
    throw new Error(`render produced no audio\n${log}`);
  }
  fs.renameSync(tmpWav, wavPath); // only complete renders land in the cache
  const m = /length:\s*(\d+)\s*ms.*hff:(true|false)/.exec(log);
  const meta = {
    name: conv.name,
    durationMs: m ? Number(m[1]) : null,
    hff: m ? m[2] === 'true' : null,
    missingKits: conv.missingKits,
    renderMs: Date.now() - started,
  };
  fs.writeFileSync(metaPath, JSON.stringify(meta));
  return { ...meta, key, wavPath, cached: false, log };
}

module.exports = { renderProject, cacheKey };
