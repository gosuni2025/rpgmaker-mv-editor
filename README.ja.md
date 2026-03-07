# RPG Maker MV Editor

[English](README.en.md) | [한국어](README.md)

| **[エディタデモ](https://rpgmakerdemo.gosuni.com/)** (保存不可) | **[デモプロジェクト](https://rpgmaker-mv-claudetest.pages.dev/)** |
|---|---|
| [![エディタデモ](docs/screenshot-editor.png)](https://rpgmakerdemo.gosuni.com/) | [![デモプロジェクト](docs/screenshot-game.png)](https://rpgmaker-mv-claudetest.pages.dev/) |

RPG Maker MV のプロジェクトをウェブブラウザで編集できるデスクトップエディタです。

## ダウンロード

**[最新リリース](https://github.com/gosuni2025/rpgmaker-mv-editor/releases/latest)**

| プラットフォーム | ファイル |
|---|---|
| macOS Apple Silicon | `*-mac-arm64.dmg` |
| macOS Intel | `*-mac-x64.dmg` |
| Windows | `*-win.zip` |

## 動作要件

- **RPG Maker MV** が必要です。このエディタは RPG Maker MV のプロジェクトファイルを編集し、そのランタイムアセットに依存しています。

## ドキュメント

- [エディタ概要・画面構成](docs/ja/01-overview.md)
- [マップエディタ](docs/ja/02-map-editor.md) — タイル編集、ライティング、オブジェクト、フォグ
- [3D モード](docs/ja/03-3d-mode.md) — カメラ操作、レンダリング、スカイボックス
- [UI エディタ](docs/ja/04-ui-editor.md) — スキンシステム、カスタムシーン
- [プラグイン一覧](docs/ja/05-plugins.md) — 同梱 14 プラグインのドキュメント
- [イベントエディタ](docs/ja/06-event-editor.md) — コマンド編集、スクリプト、移動ルート、条件分岐

## AI 連携 (MCP)

MCP (Model Context Protocol) サーバーを内蔵しており、Claude がエディタを直接操作できます。マップ生成、イベント作成、データベース編集などを自然言語で依頼できます。

**設定方法**: [docs/ja/mcp-setup.md](docs/ja/mcp-setup.md)

## 開発

### 要件

- Node.js 20+
- npm

### インストール・実行

```bash
# 依存関係のインストール（ルートで一度だけ — client/server は自動でインストールされます）
npm install

# 開発モードで起動 (server:3001 + client:5173, MCP:3002)
npm run dev
```

### ビルド

```bash
# フルビルド（クライアント + サーバー + Electron）
npm run build

# デスクトップアプリのパッケージング
npm run dist
```

## アーキテクチャ

- **クライアント**: React 18 + TypeScript + Vite + Zustand
- **サーバー**: Express + TypeScript
- **レンダリング**: Three.js + RPG Maker MV ランタイム（Spriteset_Map を直接使用し、実際のゲームと同一のマップレンダリングを実現）
- **デスクトップ**: Electron（クライアント + サーバーを一つのアプリにバンドル）
- **AI 連携**: MCP (Model Context Protocol) SSE サーバー内蔵（ポート 3002）

## ライセンス

[MIT](LICENSE)
