# RPG Maker MV Web Editor — ドキュメント

RPG Maker MV のエディタをウェブブラウザで使用できるように再実装したプロジェクトです。
オリジナルエディタの全機能を提供しつつ、**3D レンダリング**、**ライティングシステム**、**UI カスタマイズ** などの拡張機能も追加しています。

---

## 目次

### 基本エディタ

| ドキュメント | 内容 |
|------|------|
| [エディタ概要](01-overview.md) | 画面構成、メニューバー、ショートカット |
| [マップエディタ](02-map-editor.md) | タイル描画、イベント編集、オブジェクト、ライティング、カメラゾーン、FOW |
| [3D モード](03-3d-mode.md) | HD-2D レンダリング、スカイボックス、カメラ操作 |
| [UI エディタ](04-ui-editor.md) | UITheme スキンシステム、カスタムシーンエンジン |

### ツール

| ドキュメント | 内容 |
|------|------|
| [イベントエディタ](06-event-editor.md) | コマンド編集、ウェイポイント移動ルート、スクリプトテンプレート |
| [配布](07-deploy.md) | itch.io · Netlify · GitHub Pages · ローカルフォルダ配布 |

### 内蔵プラグイン

| ドキュメント | プラグイン | 概要 |
|------|----------|------|
| [タッチカメラ操作](../plugins/touch-camera.md) | TouchCameraControl | 3D カメラのドラッグ/ピンチ操作 |
| [スカイボックス](../plugins/skybox.md) | SkyBox | パノラマ空背景 |
| [オクルージョンシルエット](../plugins/occlusion-silhouette.md) | OcclusionSilhouette | キャラクター隠れ時のシルエット表示 |
| [ミニマップ](../plugins/minimap.md) | Minimap | FoW · リージョン色 · マーカー |
| [オートセーブ](../plugins/autosave.md) | AutoSave | マップ移動/戦闘後の自動セーブ |
| [ビジュアルノベルモード](../plugins/visual-novel-mode.md) | VisualNovelMode | VN スタイルメッセージ |
| [メニュートランジション](../plugins/menu-transition.md) | MenuTransition | メニュー背景 blur/sepia などの効果 |
| [WASD 移動](../plugins/wasd-movement.md) | WASD_Movement | WASD キーボード移動 |
| [アイテム図鑑](../plugins/item-book.md) | ItemBook | アイテム/武器/防具図鑑 |
| [エネミー図鑑](../plugins/enemy-book.md) | EnemyBook | 敵情報図鑑 |
| [テキストログ](../plugins/text-log.md) | TextLog | 会話ログ閲覧 |
| [タイトルクレジット](../plugins/title-credit.md) | TitleCredit | タイトル画面クレジット |
| [クエスト](../plugins/quest.md) | QuestSystem | クエスト定義・目標・報酬管理 |

---

## オリジナルとの主な違い

### ✅ 追加された機能

- **3D レンダリングモード** — マップを HD-2D パースペクティブビューで表示
- **ライティングシステム (EXT)** — マップ別動的ポイントライト/アンビエント設定
- **スカイボックス (EXT)** — 3D モードでパノラマ空背景
- **カメラゾーン (EXT)** — 特定エリア進入時にカメラ固定/アングル変更
- **オブジェクトシステム (EXT)** — 画像/タイル/アニメーションをレイヤー配置
- **FOW (EXT)** — マップ別フォグエフェクト (Fog of War) 設定
- **UI エディタ** — ウィンドウレイアウト · 9-slice スキン · フォントの視覚編集
- **カスタムシーンエンジン** — JSON でゲーム内 UI シーンを定義しリアルタイムプレビュー
- **MCP 統合** — Claude AI がイベントコマンドを直接作成・修正

### 🔄 互換性

- オリジナル RPG Maker MV の `Map*.json` 形式をそのまま使用
- 拡張データは `Map*_ext.json` に別途保存 (オリジナルエディタと完全互換)
- PIXI.js ランタイム (`index.html`) と Three.js ランタイム (`index_3d.html`) が共存

---

## クイックスタート

1. `npm run dev` — エディタサーバー (3001) + クライアント (5173) を同時起動
2. ブラウザで `http://localhost:5173` にアクセス
3. **ファイル → プロジェクトを開く** — RPG Maker MV プロジェクトフォルダを選択
4. マップツリーでマップをダブルクリックして編集開始
