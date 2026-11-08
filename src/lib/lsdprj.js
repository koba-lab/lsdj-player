'use strict';
// Convert an .lsdprj / .lsdsng into an LSDj save image (SRAM) for rendering.
//
// Format reference: LSDPatcher (jkotlinski/lsdpatch) Document/LSDSavFile.java
//   .lsdsng = name[8] + version[1] + compressed song blocks (0x200 bytes each)
//   .lsdprj = .lsdsng + the kits the song uses (0x4000 bytes each)

const BLOCK = 0x200;
const KIT = 0x4000;
const SAV_SIZE = 0x20000;
const SONG_SIZE = 0x8000;
const FS = 0x8000; // filesystem start
const NAMES = FS;
const VERSIONS = FS + 0x100;
const ACTIVE = FS + 0x140;
const ALLOC = FS + 0x141;
const BLOCKS = FS + 0x200;
const NBLOCKS = 0xbf;

const DEFAULT_WAVE = [0x8e, 0xcd, 0xcc, 0xbb, 0xaa, 0xa9, 0x99, 0x88, 0x87, 0x76, 0x66, 0x55, 0x54, 0x43, 0x32, 0x31];
const DEFAULT_INSTR = [0xa8, 0, 0, 0xff, 0, 0, 3, 0, 0, 0xd0, 0, 0, 0, 0xf3, 0, 0];

// Returns { kind: 'eof' } or { kind: 'jump', offset } for one compressed block.
function scanBlock(blk) {
  let i = 0;
  while (i < BLOCK) {
    const b = blk[i];
    if (b === 0xc0) {
      i += (i + 1 < BLOCK && blk[i + 1] === 0xc0) ? 2 : 3;
      continue;
    }
    if (b === 0xe0) {
      const n = blk[i + 1];
      if (n === 0xe0) i += 2;
      else if (n === 0xff) return { kind: 'eof' };
      else if (n === 0xf0 || n === 0xf1) i += 3;
      else return { kind: 'jump', offset: i + 1 };
      continue;
    }
    i += 1;
  }
  throw new Error('song corrupted: block without jump/eof');
}

function splitProject(data) {
  if (data.length < 9 + BLOCK) throw new Error('file too short to be an LSDj song');
  const name = data.subarray(0, 8);
  const version = data[8];
  const blocks = [];
  let pos = 9;
  for (;;) {
    const blk = data.subarray(pos, pos + BLOCK);
    if (blk.length !== BLOCK) throw new Error('truncated song data');
    blocks.push(Buffer.from(blk));
    pos += BLOCK;
    if (scanBlock(blk).kind === 'eof') break;
  }
  const kits = [];
  for (let p = pos; p < data.length; p += KIT) {
    const kit = data.subarray(p, p + KIT);
    if (kit.length !== KIT) throw new Error('truncated kit data');
    kits.push(kit);
  }
  return { name, version, blocks, kits };
}

function decompress(blocks) {
  const out = Buffer.alloc(SONG_SIZE);
  let o = 0;
  const put = (v) => {
    if (o >= SONG_SIZE) throw new Error('decompressed song is too large');
    out[o++] = v;
  };
  let bi = 0;
  let i = 0;
  for (;;) {
    const blk = blocks[bi];
    if (!blk) throw new Error('song corrupted: ran past the last block');
    const b = blk[i];
    if (b === 0xc0) {
      if (blk[i + 1] === 0xc0) { put(0xc0); i += 2; } else {
        for (let k = 0; k < blk[i + 2]; k++) put(blk[i + 1]);
        i += 3;
      }
    } else if (b === 0xe0) {
      const n = blk[i + 1];
      if (n === 0xe0) { put(0xe0); i += 2; } else if (n === 0xff) {
        break;
      } else if (n === 0xf0 || n === 0xf1) {
        const pat = n === 0xf0 ? DEFAULT_WAVE : DEFAULT_INSTR;
        for (let k = 0; k < blk[i + 2]; k++) pat.forEach(put);
        i += 3;
      } else {
        // LSDPatcher (addSongFromFile) also assumes file order == chain order.
        bi += 1; i = 0;
      }
    } else { put(b); i += 1; }
  }
  if (o !== SONG_SIZE) throw new Error(`decompressed size 0x${o.toString(16)} != 0x8000`);
  return out;
}

// LSDj kit id <-> ROM bank (legacy layout: banks 8-26, 32-63).
const bankToKit = (bank) => (bank <= 26 ? bank - 8 : bank - 13);

// Point the song's kit instruments at identical kits already in the ROM.
// Embedded kits are stored in ascending order of the kit ids the song used.
// Returns the kit ids that could not be found in the ROM.
function remapKits(sav, kits, rom) {
  const used = new Set();
  for (let n = 0; n < 0x40; n++) {
    const p = 0x3080 + n * 0x10;
    if (sav[p] === 2) { used.add(sav[p + 2] & 0x3f); used.add(sav[p + 9] & 0x3f); }
  }
  const oldIds = [...used].sort((a, b) => a - b);
  const banks = [];
  for (let b = 8; b <= 26; b++) banks.push(b);
  for (let b = 32; b < rom.length / KIT; b++) banks.push(b);
  const mapping = new Map();
  const missing = [];
  oldIds.forEach((old, idx) => {
    const kit = kits[idx];
    if (!kit) return;
    const bank = banks.find((b) => rom.subarray(b * KIT, (b + 1) * KIT).equals(kit));
    if (bank === undefined) missing.push(old); else mapping.set(old, bankToKit(bank));
  });
  for (let n = 0; n < 0x40; n++) {
    const p = 0x3080 + n * 0x10;
    if (sav[p] !== 2) continue;
    for (const q of [p + 2, p + 9]) {
      const k = sav[q] & 0x3f;
      if (mapping.has(k)) sav[q] = (sav[q] & 0xc0) | mapping.get(k);
    }
  }
  return missing;
}

// project: Buffer of .lsdprj/.lsdsng, rom: optional Buffer of the LSDj ROM.
function projectToSav(project, rom) {
  const { name, version, blocks, kits } = splitProject(project);
  if (blocks.length > NBLOCKS) throw new Error('song too large');
  const sav = Buffer.alloc(SAV_SIZE);
  const song = decompress(blocks);
  song.copy(sav, 0); // working song: what LSDj boots into
  sav.write('jk', FS + 0x13e, 'latin1');
  sav.fill(0xff, ALLOC, ALLOC + NBLOCKS);
  // also store it as file slot 0 so the song keeps its name
  name.copy(sav, NAMES);
  sav[VERSIONS] = version;
  sav[ACTIVE] = 0;
  blocks.forEach((src, idx) => {
    const blk = Buffer.from(src);
    const s = scanBlock(blk);
    if (s.kind === 'jump') blk[s.offset] = idx + 2; // next block, 1-based (FAT is block 0)
    sav[ALLOC + idx] = 0;
    blk.copy(sav, BLOCKS + idx * BLOCK);
  });
  const missingKits = kits.length && rom ? remapKits(sav, kits, rom) : [];
  return {
    sav,
    name: name.toString('latin1').replace(/\0+$/, ''),
    blocks: blocks.length,
    kits: kits.length,
    missingKits,
  };
}

module.exports = { projectToSav };
