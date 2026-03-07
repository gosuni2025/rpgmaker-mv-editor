# 内蔵プラグイン一覧

![プラグイン概要](../images/plugins/plugin-overview.png)

エディターにデフォルトで含まれているプラグインの一覧です。
プロジェクトを開くと `js/plugins/` フォルダに自動的にコピーされます。

---

## 3D / カメラ

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **TouchCameraControl** | タッチ/マウスで 3D カメラ回転・ズーム操作、HD-2D キャラクター方向自動補正 | [→](../plugins/touch-camera.md) |
| **SkyBox** | Three.js スカイドーム — Equirectangular パノラマ空背景 | [→](../plugins/skybox.md) |

## UI / ビジュアル

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **UITheme** | 9-slice スキン · フォント · ウィンドウレイアウトの完全カスタマイズ (JSON ベース) | [→](../plugins/ui-theme.md) |
| **CustomSceneEngine** | JSON でゲーム内 UI シーンを動的生成 | [→](../plugins/custom-scene.md) |
| **MenuTransition** | メニュー開閉時の背景 blur/sepia/zoom など 15 種類のエフェクト | [→](../plugins/menu-transition.md) |
| **VisualNovelMode** | ビジュアルノベルスタイルのタイプライターメッセージ + インライン選択肢 | [→](../plugins/visual-novel-mode.md) |
| **OcclusionSilhouette** | オブジェクトの後ろに隠れたキャラクターをシルエットで表示 | [→](../plugins/occlusion-silhouette.md) |

## HUD / 情報

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **Minimap** | FoW · リージョン色 · マーカー対応ミニマップ (2D/3D) | [→](../plugins/minimap.md) |
| **ItemBook** | 入手したアイテム/武器/防具の図鑑 | [→](../plugins/item-book.md) |
| **EnemyBook** | 遭遇した敵の図鑑 | [→](../plugins/enemy-book.md) |
| **NPCNameDisplay** | NPC の頭上に名前を表示 | — |
| **TextLog** | メッセージ会話ログ閲覧 | [→](../plugins/text-log.md) |

## クエスト

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **QuestSystem** | クエストの定義・目標・報酬をデータベースで管理 | [→](../plugins/quest.md) |

## 操作 / システム

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **WASD_Movement** | W/A/S/D キーを方向キーに、Q/E を PageUp/Down にマッピング | [→](../plugins/wasd-movement.md) |
| **AutoSave** | マップ移動・戦闘終了・メニュー閉じた後に自動セーブ | [→](../plugins/autosave.md) |
| **ShopStock** | ショップ在庫システム | — |
| **TouchDestAnimation** | タッチ移動先アニメーション | — |

## タイトル / その他

| プラグイン | 概要 | ドキュメント |
|----------|------|------|
| **TitleCredit** | タイトル画面にクレジットボタンを追加 (Credits.txt を読み込む) | [→](../plugins/title-credit.md) |
| **BuildVersion** | タイトル右下にビルド番号を表示 | — |
| **MessageWindowCustom** | メッセージウィンドウのカスタマイズ | — |

---

## プラグイン管理

**ツール → プラグインマネージャー**メニューでプラグインを管理します。

- チェックボックスで個別プラグインを有効化/無効化
- ドラッグでロード順序を変更 (順序が重要なプラグインあり)
- プラグインパラメーターの設定

### 推奨ロード順序

3D モード使用時の推奨順序:

```
1. UITheme
2. CustomSceneEngine
3. TouchCameraControl
4. SkyBox
5. OcclusionSilhouette
6. Minimap
7. AutoSave
8. VisualNovelMode
9. MenuTransition
10. WASD_Movement
... (その他のプラグイン)
```
