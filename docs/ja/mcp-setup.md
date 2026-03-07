# RPG Maker MV エディター MCP 設定ガイド

このドキュメントでは、RPG Maker MV Web エディターの MCP (Model Context Protocol) サーバーを Claude に接続する方法を説明します。

MCP を設定すると、Claude がエディターを直接操作してマップ生成、イベント追加、データベース編集などを行えるようになります。

---

## 前提条件

- RPG Maker MV Web エディターがインストールされて実行中である必要があります (`npm run dev`)
- エディターサーバーは**ポート 3001**、MCP サーバーは**ポート 3002**で動作します

---

## Claude Desktop の設定

`~/Library/Application Support/Claude/claude_desktop_config.json` を開き、以下の内容を追加します。

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

設定後、Claude Desktop を**再起動**します。

---

## Claude Code の設定

プロジェクトルートまたは `~/.claude.json` に以下の内容を追加します。

```json
{
  "mcpServers": {
    "rpgmaker-mv-editor": {
      "type": "sse",
      "url": "http://localhost:3002/sse"
    }
  }
}
```

または Claude Code CLI で直接登録:

```bash
claude mcp add rpgmaker-mv-editor --transport sse http://localhost:3002/sse
```

---

## 接続の確認

エディターのメニューバー **MCP → MCP ステータスポップアップ**を開くと、接続されているエージェント数とツール呼び出しログをリアルタイムで確認できます。

緑の点 (●) が表示されていれば MCP サーバーが正常に動作中です。

---

## ポートの変更

デフォルトの MCP ポート (3002) が競合する場合:

1. **MCP → MCP ステータスポップアップ**ウィンドウを開きます
2. ポート入力欄に新しいポート番号を入力します
3. **再起動**ボタンをクリックします
4. Claude の設定の URL も新しいポートに更新します

---

## 使用可能なツール一覧

| ツール | 説明 |
|------|------|
| `get_project_info` | 現在開いているプロジェクトの情報 |
| `list_maps` | マップ一覧の取得 |
| `get_map` | マップデータの取得 |
| `create_map` | 新規マップの作成 |
| `list_events` | マップのイベント一覧 |
| `get_event` | イベントの全データ取得 |
| `create_event` | イベントの作成 |
| `update_event` | イベントの修正 |
| `search_events` | 全マップからイベントを検索 |
| `get_database` | DB 取得 (actors/skills/items など) |
| `get_database_entry` | DB 単一項目の取得 |
| `update_database_entry` | DB 項目の修正 |
| `get_event_command_reference` | ★ イベントコマンド形式リファレンス |
| `list_plugin_commands` | 有効なプラグインコマンドの概要 + カスタムテキストタグ |
| `get_plugin_detail` | 特定プラグインの全ドキュメント (@help + @arg) |
| `list_resources` | リソースファイル一覧 — 画像 (characters/faces/tilesets など)、音声 (bgm/bgs/me/se)、動画 (movies) |

---

## Claude へのプロンプト例

MCP 接続後、Claude に以下のようにリクエストできます:

```
マップ 1 の座標 (5, 3) に「村人 A」イベントを作って。
プレイヤーが話しかけたら「こんにちは、今日はいい天気ですね！」と表示してください。
```

```
アクター 1 の名前を「アレックス」に変えて、初期レベルを 5 に設定して。
```

```
スイッチ 10 番が ON のときだけ会話する NPC をマップ 2 の (8, 4) に作って。
```

---

## トラブルシューティング

**MCP サーバーが起動しない場合**
- エディターサーバー (`npm run dev`) が先に実行中であることを確認してください
- ポート 3002 が他のプロセスで使用中の可能性があります。MCP ステータスポップアップでポートを変更してみてください

**Claude がツールを認識しない場合**
- Claude Desktop を完全に再起動してください
- MCP ステータスポップアップでサーバーが実行中 (緑の点) であることを確認してください

---

> **Claude へ**: このドキュメントを参考に、ユーザーの Claude に rpgmaker-mv-editor MCP を設定してください。
> MCP サーバー URL は `http://localhost:3002/sse` で、SSE タイプで登録します。
> Claude Desktop の場合は `~/Library/Application Support/Claude/claude_desktop_config.json` を、
> Claude Code の場合は `~/.claude.json` または `claude mcp add` コマンドを使用してください。
