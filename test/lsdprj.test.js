'use strict';
// Builds a tiny synthetic song (no copyrighted data) and checks the save layout.
const test = require('node:test');
const assert = require('node:assert');
const { projectToSav } = require('../src/lib/lsdprj');

// One block: RLE 0x00 x 0xff repeated 128 times = 0x7f80 bytes, then 0x80 literal bytes, then EOF.
function syntheticSong() {
  const body = [];
  for (let i = 0; i < 128; i++) body.push(0xc0, 0x00, 0xff);
  const block = Buffer.alloc(0x200 * 2);
  let p = 0;
  // block 1: 128 RLE runs (384 bytes) + jump to next block
  for (const b of body) block[p++] = b;
  block[p++] = 0xe0; block[p++] = 0x07; // jump (original block number, rewritten on import)
  // block 2: 0x80 literal bytes then EOF
  p = 0x200;
  for (let i = 0; i < 0x80; i++) block[p++] = 0x72;
  block[p++] = 0xe0; block[p++] = 0xff;
  return Buffer.concat([Buffer.from('TESTSONG', 'latin1'), Buffer.from([3]), block]);
}

test('converts a project into a 128 KiB save with the song in working memory and slot 0', () => {
  const r = projectToSav(syntheticSong());
  assert.strictEqual(r.sav.length, 0x20000);
  assert.strictEqual(r.name, 'TESTSONG');
  assert.strictEqual(r.blocks, 2);
  assert.strictEqual(r.sav[0x7fff], 0x72);                       // working song decompressed
  assert.strictEqual(r.sav.toString('latin1', 0x813e, 0x8140), 'jk'); // filesystem check bytes
  assert.strictEqual(r.sav.toString('latin1', 0x8000, 0x8008), 'TESTSONG');
  assert.strictEqual(r.sav[0x8140], 0);                          // active file = slot 0
  assert.deepStrictEqual([...r.sav.subarray(0x8141, 0x8144)], [0, 0, 0xff]);
  assert.strictEqual(r.sav[0x8200 + 385], 2);                    // jump rewritten to block 2
});

test('rejects truncated data', () => {
  assert.throws(() => projectToSav(syntheticSong().subarray(0, 0x300)));
});
