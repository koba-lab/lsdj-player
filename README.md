# LSDj Player

Double-click an `.lsdprj` / `.lsdsng` file on macOS and hear it — rendered by the real LSDj ROM running in an emulator, then played in QuickTime Player.

Built for fast sketching loops: export (or have an AI generate) a song, double-click, listen, repeat.

[日本語は下にあります](#日本語)

## How it works

1. `lsdprj2sav.py` turns the project file into an LSDj save image (pure Python, standard library only).
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) boots your LSDj ROM in the SameBoy emulator and renders the song to WAV. The render stops at the song's `HFF` command.
3. The WAV is opened in QuickTime Player and starts playing.

The WAV is saved next to the song as `<name>.lsdj-player.<hash>.wav`. The hash is taken from the song bytes, the ROM and the length cap, so opening the same song again replays the existing file instantly, while an updated song with the same name is rendered again.

## Requirements

- macOS (Apple Silicon or Intel)
- `python3`
- Your own LSDj ROM (`*.gb`). It is **not** included — LSDj's license forbids redistributing the ROM. Tested with LSDj 4.9.4.

## Install

```sh
git clone <this repo> lsdj-player
cd lsdj-player
cp /path/to/your/lsdj.gb .
bash install.sh
```

`install.sh` downloads `retroplug-cli` v0.7.4 from the official RetroPlug release (SHA-256 verified), builds `LSDj Player.app` and registers it for `.lsdprj` / `.lsdsng`.

If double-clicking does not open the app, right-click a song → **Open With** → **LSDj Player**, with "Always Open With" checked.

## Usage

- Double-click an `.lsdprj` / `.lsdsng` in Finder.
- Or from a terminal: `./lsdj-play.sh path/to/song.lsdprj`

Environment variables:

| Variable   | Default                     | Meaning                                   |
|------------|-----------------------------|-------------------------------------------|
| `LSDJ_ROM` | first `*.gb` in this folder | ROM used for rendering                    |
| `LSDJ_MAX` | `3m`                        | Cap for songs without an `HFF` stop       |

The log of the last run is at `$TMPDIR/lsdj-player/last.log` (or `/tmp/lsdj-player/last.log`).

## Limitations

- End your song with `HFF`, otherwise it is cut at `LSDJ_MAX`.
- Kits embedded in an `.lsdprj` are matched against identical kits already in your ROM. Kits that are not in the ROM are not patched in yet. This path has not been tested with a kit-using song.
- Only verified with LSDj 4.9.4.

## Credits

- [RetroPlug](https://github.com/tommitytom/RetroPlug) by tommitytom — rendering (MIT; bundles SameBoy and other components under their own licenses, downloaded separately by `install.sh`)
- File format reference: [LSDPatcher](https://github.com/jkotlinski/lsdpatch) by Johan Kotlinski, and [libLSDJ](https://github.com/stijnfrishert/libLSDJ) / the [`lsdj` crate](https://docs.rs/lsdj) by Stijn Frishert
- [Little Sound Dj](https://www.littlesounddj.com) by Johan Kotlinski

## License

MIT — see [LICENSE](LICENSE). This applies to the code in this repository only.

---

## 日本語

macOS で `.lsdprj` / `.lsdsng` をダブルクリックすると、本物の LSDj ROM をエミュレータで動かして WAV に書き出し、QuickTime Player で再生するツールです。

曲のスケッチを高速に回すためのものです。曲を書き出す（または AI に生成させる）→ ダブルクリック → 聴く、を繰り返せます。

### 仕組み

1. `lsdprj2sav.py` がプロジェクトファイルを LSDj のセーブデータに変換します（Python 標準ライブラリのみ）。
2. [`retroplug-cli`](https://github.com/tommitytom/RetroPlug) が SameBoy エミュレータ上で LSDj ROM を起動し、曲を WAV に書き出します。曲中の `HFF` で止まります。
3. WAV を QuickTime Player で開いて再生します。

WAV は曲と同じフォルダに `曲名.lsdj-player.<ハッシュ>.wav` として保存されます。ハッシュは曲の中身・ROM・打ち切り長から計算するので、同じ曲を開き直すと既存の WAV をすぐ再生し、同名でも中身が変わった曲は書き出し直します。

### 必要なもの

- macOS（Apple Silicon / Intel）
- `python3`
- 自分の LSDj ROM（`*.gb`）。ライセンス上 ROM は再配布できないため、このリポジトリには含めていません。動作確認は LSDj 4.9.4 で行っています。

### インストール

```sh
git clone <このリポジトリ> lsdj-player
cd lsdj-player
cp /path/to/your/lsdj.gb .
bash install.sh
```

`install.sh` は RetroPlug 公式リリースから `retroplug-cli` v0.7.4 をダウンロードし（SHA-256 を検証）、`LSDj Player.app` を作って `.lsdprj` / `.lsdsng` に関連付けます。

ダブルクリックで開かない場合は、曲を右クリック →「このアプリケーションで開く」→ LSDj Player を選び、「常にこのアプリケーションで開く」にチェックを入れてください。

### 使い方

- Finder で `.lsdprj` / `.lsdsng` をダブルクリック
- ターミナルからなら `./lsdj-play.sh path/to/song.lsdprj`

環境変数:

| 変数       | 既定値                         | 意味                                 |
|------------|--------------------------------|--------------------------------------|
| `LSDJ_ROM` | このフォルダ内の最初の `*.gb`  | 書き出しに使う ROM                   |
| `LSDJ_MAX` | `3m`                           | `HFF` が無い曲の打ち切り長           |

直近の実行ログは `$TMPDIR/lsdj-player/last.log`（または `/tmp/lsdj-player/last.log`）にあります。

### 制限

- 曲末に `HFF` を入れてください。無い場合は `LSDJ_MAX` で打ち切ります。
- `.lsdprj` に同梱されたキットは、ROM 内の同一キットに割り当てるだけです。ROM に無いキットはまだ書き込めません。キットを使う曲での動作は未確認です。
- 動作確認は LSDj 4.9.4 のみです。

### クレジット・ライセンス

上の Credits / License を参照してください。ライセンス（MIT）はこのリポジトリのコードにのみ適用されます。
