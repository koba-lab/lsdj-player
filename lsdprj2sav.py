#!/usr/bin/env python3
"""Convert an .lsdprj / .lsdsng into an LSDj save (.sav) usable by retroplug-cli.

Format reference: LSDPatcher (jkotlinski/lsdpatch) Document/LSDSavFile.java
  .lsdsng = name[8] + version[1] + compressed blocks (0x200 each)
  .lsdprj = .lsdsng + used kits appended (0x4000 each)
"""
import sys

BLOCK = 0x200
KIT = 0x4000
SAV_SIZE = 0x20000
FS = 0x8000                   # filesystem start
NAMES, VERSIONS = FS, FS + 0x100
ACTIVE = FS + 0x140
ALLOC = FS + 0x141
BLOCKS = FS + 0x200
NBLOCKS = 0xBF

DEFAULT_WAVE = bytes([0x8E,0xCD,0xCC,0xBB,0xAA,0xA9,0x99,0x88,0x87,0x76,0x66,0x55,0x54,0x43,0x32,0x31])
DEFAULT_INSTR = bytes([0xA8,0,0,0xFF,0,0,3,0,0,0xD0,0,0,0,0xF3,0,0])


def scan_block(blk):
    """Return ('eof', None) / ('jump', offset_of_jump_byte); raise if neither."""
    i = 0
    while i < BLOCK:
        b = blk[i]
        if b == 0xC0:
            i += 1 if (i + 1 < BLOCK and blk[i + 1] == 0xC0) else 2
            i += 1
            continue
        if b == 0xE0:
            n = blk[i + 1]
            if n == 0xE0:
                i += 2
            elif n == 0xFF:
                return 'eof', None
            elif n in (0xF0, 0xF1):
                i += 3
            else:
                return 'jump', i + 1
            continue
        i += 1
    raise ValueError('song corrupted: block without jump/eof')


def split_project(data):
    name, version = data[:8], data[8]
    blocks = []
    pos = 9
    while True:
        blk = bytearray(data[pos:pos + BLOCK])
        if len(blk) != BLOCK:
            raise ValueError('truncated song data')
        blocks.append(blk)
        pos += BLOCK
        kind, _ = scan_block(blk)
        if kind == 'eof':
            break
    kits = [data[p:p + KIT] for p in range(pos, len(data), KIT)]
    if kits and len(kits[-1]) != KIT:
        raise ValueError('truncated kit data')
    return name, version, blocks, kits


def decompress(blocks):
    out = bytearray()
    bi, i = 0, 0
    while True:
        blk = blocks[bi]
        b = blk[i]
        if b == 0xC0:
            if blk[i + 1] == 0xC0:
                out.append(0xC0); i += 2
            else:
                out += bytes([blk[i + 1]]) * blk[i + 2]; i += 3
        elif b == 0xE0:
            n = blk[i + 1]
            if n == 0xE0:
                out.append(0xE0); i += 2
            elif n == 0xFF:
                break
            elif n == 0xF0:
                out += DEFAULT_WAVE * blk[i + 2]; i += 3
            elif n == 0xF1:
                out += DEFAULT_INSTR * blk[i + 2]; i += 3
            else:
                # LSDPatcher (addSongFromFile) also assumes file order == chain order
                bi += 1; i = 0
        else:
            out.append(b); i += 1
    if len(out) != 0x8000:
        raise ValueError(f'decompressed size {len(out):#x} != 0x8000')
    return out


def build_sav(name, version, blocks):
    sav = bytearray(SAV_SIZE)
    song = decompress(blocks)
    sav[0:0x8000] = song                       # working song (what LSDj boots into)
    sav[FS + 0x13E:FS + 0x140] = b'jk'
    sav[ALLOC:ALLOC + NBLOCKS] = b'\xff' * NBLOCKS
    # also store as file slot 0 so the song keeps its name
    sav[NAMES:NAMES + 8] = name
    sav[VERSIONS] = version
    sav[ACTIVE] = 0
    for idx, blk in enumerate(blocks):
        blk = bytearray(blk)
        kind, off = scan_block(blk)
        if kind == 'jump':
            blk[off] = idx + 2               # next block (1-based, FAT occupies block 0)
        sav[ALLOC + idx] = 0
        sav[BLOCKS + idx * BLOCK:BLOCKS + (idx + 1) * BLOCK] = blk
    return sav, song


def kit_bank(kit_id):
    """LSDj kit id -> ROM bank (legacy layout: banks 8-26, 32-63)."""
    bank = kit_id + 8
    return bank + 5 if bank > 26 else bank


def bank_kit(bank):
    return bank - 8 if bank <= 26 else bank - 13


def remap_kits(sav, kits, rom):
    """Point the song's kit instruments at identical kits already in the ROM.

    Embedded kits are written in ascending order of the kit ids the song used
    (LSDSavFile.writeKits). Kits missing from the ROM are reported, not patched.
    """
    used = set()
    for n in range(0x40):
        p = 0x3080 + n * 0x10
        if sav[p] == 2:
            used.add(sav[p + 2] & 0x3F); used.add(sav[p + 9] & 0x3F)
    old_ids = sorted(used)
    mapping, missing = {}, []
    for old, kit in zip(old_ids, kits):
        found = None
        for bank in list(range(8, 27)) + list(range(32, len(rom) // KIT)):
            if rom[bank * KIT:(bank + 1) * KIT] == kit:
                found = bank_kit(bank); break
        if found is None:
            missing.append(old)
        else:
            mapping[old] = found
    for n in range(0x40):
        p = 0x3080 + n * 0x10
        if sav[p] == 2:
            for q in (p + 2, p + 9):
                k = sav[q] & 0x3F
                if k in mapping:
                    sav[q] = (sav[q] & 0xC0) | mapping[k]
    return missing


def main():
    if len(sys.argv) not in (3, 4):
        sys.exit('usage: lsdprj2sav.py <in.lsdprj|in.lsdsng> <out.sav> [lsdj.gb]')
    data = open(sys.argv[1], 'rb').read()
    name, version, blocks, kits = split_project(data)
    if len(blocks) > NBLOCKS:
        sys.exit('song too large')
    sav, song = build_sav(name, version, blocks)
    missing = []
    if kits and len(sys.argv) == 4:
        missing = remap_kits(sav, kits, open(sys.argv[3], 'rb').read())
    open(sys.argv[2], 'wb').write(sav)
    print(f"name={name.rstrip(bytes(1)).decode('ascii','replace')} blocks={len(blocks)} "
          f"kits={len(kits)} song_format={song[0x7FFF]:#04x}", file=sys.stderr)
    if missing:
        print(f'warning: kits not found in ROM (ids {missing}); samples may sound wrong',
              file=sys.stderr)


if __name__ == '__main__':
    main()
