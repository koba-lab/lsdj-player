# LSDj Player

A small macOS helper that plays [Little Sound Dj](https://www.littlesounddj.com) project files (`.lsdprj` / `.lsdsng`) on double-click.

The song is rendered by your own LSDj ROM running in an emulator, so it sounds the way LSDj plays it. The result is saved as a WAV and opened in QuickTime Player.

[日本語](#日本語)

## How it works

1. `lsdprj2sav.py` converts the project file into an LSDj save image.
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) boots the LSDj ROM in the SameBoy emulator and renders the song to WAV, stopping at the song's `HFF` command.
3. The WAV is opened in QuickTime Player and starts playing.

The WAV is written next to the song as `<name>.lsdj-player.<hash>.wav`. The hash covers the song data, the ROM and the length cap: opening the same song again plays the existing WAV without rendering, and a changed song is rendered again.

## Requirements

- macOS (Apple Silicon or Intel)
- Python 3 (`/usr/bin/python3` on a fresh macOS is only a stub that asks to install the Command Line Tools)
- An LSDj ROM (`*.gb`) that you obtained yourself. It is **not** included: the LSDj license does not allow redistributing the ROM.

## Install

```sh
git clone <this repository> lsdj-player
cd lsdj-player
cp /path/to/lsdj.gb .
bash install.sh
```

`install.sh`:

- downloads `retroplug-cli` v0.7.4 from the official RetroPlug release and verifies its SHA-256
- builds `LSDj Player.app` and registers it for `.lsdprj` and `.lsdsng`

If double-clicking a song does not open the app, right-click the song → **Open With** → **Other…** → `LSDj Player`, with **Always Open With** checked.

## Usage

- Double-click an `.lsdprj` / `.lsdsng` in Finder.
- Or run `./lsdj-play.sh path/to/song.lsdprj`.

| Environment variable | Default                     | Description                               |
|----------------------|-----------------------------|-------------------------------------------|
| `LSDJ_ROM`           | first `*.gb` in this folder | ROM used for rendering                    |
| `LSDJ_MAX`           | `3m`                        | Length cap for songs without an `HFF`     |

The log of the last run is written to `$TMPDIR/lsdj-player/last.log` (`/tmp/lsdj-player/last.log` if `TMPDIR` is unset).

## Limitations

- Songs without an `HFF` command are cut at `LSDJ_MAX`.
- Kits embedded in an `.lsdprj` are matched against identical kits already present in the ROM. Kits that are not in the ROM are not patched in, and this path is untested.
- Tested only with LSDj 4.9.4.

## Credits

- [RetroPlug](https://github.com/tommitytom/RetroPlug) by tommitytom — emulation and rendering. Downloaded by `install.sh`, not included here; see its own licenses.
- [LSDPatcher](https://github.com/jkotlinski/lsdpatch) by Johan Kotlinski and [libLSDJ](https://github.com/stijnfrishert/libLSDJ) / the [`lsdj` crate](https://docs.rs/lsdj) by Stijn Frishert — file format references.
- [Little Sound Dj](https://www.littlesounddj.com) by Johan Kotlinski.

This project is not affiliated with LSDj or RetroPlug.

## License

[MIT](LICENSE). Applies to the code in this repository only.

---

## 日本語

[Little Sound Dj](https://www.littlesounddj.com) のプロジェクトファイル（`.lsdprj` / `.lsdsng`）をダブルクリックで再生する macOS 用の小さなツールです。

手元の LSDj ROM をエミュレータで動かして書き出すので、LSDj が鳴らす通りの音になります。書き出した WAV は QuickTime Player で開きます。

### 仕組み

1. `lsdprj2sav.py` がプロジェクトファイルを LSDj のセーブデータに変換します。
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) が SameBoy エミュレータ上で LSDj ROM を起動し、曲を WAV に書き出します。曲中の `HFF` で止まります。
3. WAV を QuickTime Player で開いて再生します。

WAV は曲と同じフォルダに `曲名.lsdj-player.<ハッシュ>.wav` として保存されます。ハッシュは曲データ・ROM・打ち切り長から計算するため、同じ曲を開き直すと書き出さずに既存の WAV を再生し、内容が変わった曲は書き出し直します。

### 必要なもの

- macOS（Apple Silicon / Intel）
- Python 3（素の macOS の `/usr/bin/python3` は Command Line Tools のインストールを促すだけの代理プログラムです）
- 各自で入手した LSDj ROM（`*.gb`）。LSDj のライセンス上 ROM は再配布できないため、このリポジトリには含めていません。

### インストール

```sh
git clone <このリポジトリ> lsdj-player
cd lsdj-player
cp /path/to/lsdj.gb .
bash install.sh
```

`install.sh` は次を行います。

- RetroPlug 公式リリースから `retroplug-cli` v0.7.4 をダウンロードし、SHA-256 を検証
- `LSDj Player.app` を作成し、`.lsdprj` と `.lsdsng` に関連付け

ダブルクリックでアプリが開かない場合は、曲を右クリック →「このアプリケーションで開く」→「その他…」→ `LSDj Player` を選び、「常にこのアプリケーションで開く」にチェックを入れてください。

### 使い方

- Finder で `.lsdprj` / `.lsdsng` をダブルクリック
- または `./lsdj-play.sh path/to/song.lsdprj`

| 環境変数   | 既定値                        | 説明                              |
|------------|-------------------------------|-----------------------------------|
| `LSDJ_ROM` | このフォルダ内の最初の `*.gb` | 書き出しに使う ROM                |
| `LSDJ_MAX` | `3m`                          | `HFF` が無い曲の打ち切り長        |

直近の実行ログは `$TMPDIR/lsdj-player/last.log`（`TMPDIR` が未設定なら `/tmp/lsdj-player/last.log`）に出力されます。

### 制限

- `HFF` が無い曲は `LSDJ_MAX` で打ち切られます。
- `.lsdprj` に同梱されたキットは、ROM 内の同一キットに割り当てるだけです。ROM に無いキットは書き込まず、この処理は未検証です。
- 動作確認は LSDj 4.9.4 のみです。

### クレジット・ライセンス

英語版の Credits / License を参照してください。MIT ライセンスはこのリポジトリのコードにのみ適用されます。本プロジェクトは LSDj および RetroPlug とは無関係です。
