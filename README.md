# LSDj Player

A small macOS app that plays [Little Sound Dj](https://www.littlesounddj.com) project files (`.lsdprj` / `.lsdsng`).

Double-click a song, or drop it on the window. It is rendered by your own LSDj ROM running in an emulator, so it sounds the way LSDj plays it.

[日本語](#日本語)

## Features

- Opens `.lsdprj` / `.lsdsng` on double-click, drag & drop or **Open…**
- Play / pause, stop, seek and loop (Space toggles playback)
- Keeps every render in a list inside the app; click to replay, **Show** to reveal the WAV in Finder, **Delete** to remove it
- Re-renders automatically when the opened song file changes (can be turned off)
- Reuses an existing render when the same song is opened again

## How it works

1. The project file is converted into an LSDj save image in JavaScript.
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) boots the LSDj ROM in the SameBoy emulator and renders the song to WAV, stopping at the song's `HFF` command.
3. The WAV is stored in the app's data folder and played in the app.

Renders are identified by a hash of the song data, the ROM and the length cap. Opening an unchanged song plays the stored WAV without rendering; a changed song is rendered again.

Data is kept in `~/Library/Application Support/LSDj Player/`:

- `renders/` — rendered WAVs
- `retroplug/` — `retroplug-cli`, downloaded on first use from the official RetroPlug v0.7.4 release and checked against its SHA-256
- `config.json`, `library.json` — settings and the render list

## Requirements

- macOS (Apple Silicon or Intel)
- An LSDj ROM (`*.gb`) that you obtained yourself. It is **not** included: the LSDj license does not allow redistributing the ROM. Choose it under **Settings** on first launch.
- To build: Node.js and npm

## Build

```sh
git clone https://github.com/koba-lab/lsdj-player.git
cd lsdj-player
npm install
npm run dist
```

The app is written to `dist/mac-<arch>/LSDj Player.app` (ad-hoc signed). Move it to `/Applications` and open it once so macOS registers it for `.lsdprj` and `.lsdsng`.

If double-clicking a song does not open the app, right-click the song → **Open With** → **Other…** → `LSDj Player`, with **Always Open With** checked.

For development: `npm start`. Tests: `npm test`.

## Settings

- **LSDj ROM** — the ROM used for rendering
- **Max length** — cap for songs without an `HFF` (e.g. `90s`, `3m`; default `3m`)
- **Re-render when the song file changes**

## Limitations

- Songs without an `HFF` command are cut at **Max length**.
- Kits embedded in an `.lsdprj` are matched against identical kits already present in the ROM. Kits that are not in the ROM are not patched in, and this path is untested.
- Tested only with LSDj 4.9.4.

## Credits

- [RetroPlug](https://github.com/tommitytom/RetroPlug) by tommitytom — emulation and rendering. Downloaded at runtime, not included here; see its own licenses.
- [LSDPatcher](https://github.com/jkotlinski/lsdpatch) by Johan Kotlinski and [libLSDJ](https://github.com/stijnfrishert/libLSDJ) / the [`lsdj` crate](https://docs.rs/lsdj) by Stijn Frishert — file format references.
- [Little Sound Dj](https://www.littlesounddj.com) by Johan Kotlinski.

This project is not affiliated with LSDj or RetroPlug.

## License

[MIT](LICENSE). Applies to the code in this repository only.

---

## 日本語

[Little Sound Dj](https://www.littlesounddj.com) のプロジェクトファイル（`.lsdprj` / `.lsdsng`）を再生する macOS 用の小さなアプリです。

曲をダブルクリックするか、ウィンドウにドロップしてください。手元の LSDj ROM をエミュレータで動かして書き出すので、LSDj が鳴らす通りの音になります。

### 機能

- `.lsdprj` / `.lsdsng` をダブルクリック、ドラッグ＆ドロップ、または **Open…** で開く
- 再生／一時停止、停止、シーク、ループ（スペースキーで再生切替）
- 書き出した曲をアプリ内の一覧に保存。クリックで再生、**Show** で WAV を Finder に表示、**Delete** で削除
- 開いている曲のファイルが変更されたら自動で書き出し直す（オフにできます）
- 同じ曲を開き直したときは既存の書き出しを使う

### 仕組み

1. プロジェクトファイルを JavaScript で LSDj のセーブデータに変換します。
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) が SameBoy エミュレータ上で LSDj ROM を起動し、曲を WAV に書き出します。曲中の `HFF` で止まります。
3. WAV をアプリのデータフォルダに保存し、アプリ内で再生します。

書き出しは、曲データ・ROM・打ち切り長から計算したハッシュで識別します。変更のない曲を開くと書き出さずに保存済みの WAV を再生し、変更された曲は書き出し直します。

データは `~/Library/Application Support/LSDj Player/` に保存されます。

- `renders/` — 書き出した WAV
- `retroplug/` — `retroplug-cli`。初回利用時に RetroPlug 公式リリース v0.7.4 からダウンロードし、SHA-256 を検証します
- `config.json`、`library.json` — 設定と書き出し一覧

### 必要なもの

- macOS（Apple Silicon / Intel）
- 各自で入手した LSDj ROM（`*.gb`）。LSDj のライセンス上 ROM は再配布できないため、このリポジトリには含めていません。初回起動時に **Settings** で選択してください。
- ビルドには Node.js と npm

### ビルド

```sh
git clone https://github.com/koba-lab/lsdj-player.git
cd lsdj-player
npm install
npm run dist
```

`dist/mac-<arch>/LSDj Player.app`（アドホック署名）が作成されます。`/Applications` に移動して一度起動すると、`.lsdprj` と `.lsdsng` に関連付けられます。

ダブルクリックでアプリが開かない場合は、曲を右クリック →「このアプリケーションで開く」→「その他…」→ `LSDj Player` を選び、「常にこのアプリケーションで開く」にチェックを入れてください。

開発時は `npm start`、テストは `npm test` です。

### 設定

- **LSDj ROM** — 書き出しに使う ROM
- **Max length** — `HFF` が無い曲の打ち切り長（例: `90s`、`3m`。既定は `3m`）
- **Re-render when the song file changes** — 曲ファイル変更時の自動書き出し

### 制限

- `HFF` が無い曲は **Max length** で打ち切られます。
- `.lsdprj` に同梱されたキットは、ROM 内の同一キットに割り当てるだけです。ROM に無いキットは書き込まず、この処理は未検証です。
- 動作確認は LSDj 4.9.4 のみです。

### クレジット・ライセンス

英語版の Credits / License を参照してください。MIT ライセンスはこのリポジトリのコードにのみ適用されます。本プロジェクトは LSDj および RetroPlug とは無関係です。
