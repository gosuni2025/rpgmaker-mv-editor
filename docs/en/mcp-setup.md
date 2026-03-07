# RPG Maker MV Editor MCP Setup Guide

This document explains how to connect the RPG Maker MV web editor's MCP (Model Context Protocol) server to Claude.

With MCP configured, Claude can directly operate the editor to create maps, add events, edit the database, and more.

---

## Prerequisites

- The RPG Maker MV web editor must be installed and running (`npm run dev`)
- The editor server runs on **port 3001**, and the MCP server on **port 3002**

---

## Claude Desktop Setup

Open `~/Library/Application Support/Claude/claude_desktop_config.json` and add the following:

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

**Restart** Claude Desktop after saving.

---

## Claude Code Setup

Add the following to your project root or `~/.claude.json`:

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

Or register directly via Claude Code CLI:

```bash
claude mcp add rpgmaker-mv-editor --transport sse http://localhost:3002/sse
```

---

## Verify Connection

Open **MCP → MCP Status Popup** from the editor menu bar to view the number of connected agents and tool call logs in real-time.

A green dot (●) indicates the MCP server is running normally.

---

## Changing the Port

If the default MCP port (3002) conflicts:

1. Open the **MCP → MCP Status Popup** window
2. Enter the new port number in the port input field
3. Click the **Restart** button
4. Update the URL in your Claude settings to the new port

---

## Available Tools

| Tool | Description |
|------|------|
| `get_project_info` | Information about the currently open project |
| `list_maps` | List maps |
| `get_map` | Get map data |
| `create_map` | Create a new map |
| `list_events` | List events on a map |
| `get_event` | Get full event data |
| `create_event` | Create an event |
| `update_event` | Modify an event |
| `search_events` | Search events across all maps |
| `get_database` | Query DB (actors/skills/items etc.) |
| `get_database_entry` | Query a single DB entry |
| `update_database_entry` | Modify a DB entry |
| `get_event_command_reference` | ★ Event command format reference |
| `list_plugin_commands` | Active plugin commands summary + custom text tags |
| `get_plugin_detail` | Full documentation for a specific plugin (@help + @arg) |
| `list_resources` | Resource file list — images (characters/faces/tilesets etc.), audio (bgm/bgs/me/se), video (movies) |

---

## Example Prompts for Claude

After connecting via MCP, you can ask Claude things like:

```
Create an event called "Villager A" at coordinates (5, 3) on Map 1.
When the player talks to them, display "Hello, what a nice day today!"
```

```
Change Actor 1's name to "Alex" and set their starting level to 5.
```

```
Create an NPC at (8, 4) on Map 2 that only speaks when Switch 10 is ON.
```

---

## Troubleshooting

**MCP server won't start**
- Make sure the editor server (`npm run dev`) is running first
- Port 3002 may be in use by another process. Try changing the port in the MCP Status Popup

**Claude doesn't recognize the tools**
- Completely restart Claude Desktop
- Check in the MCP Status Popup that the server is running (green dot)

---

> **Note for Claude**: Please refer to this document to set up the rpgmaker-mv-editor MCP for the user's Claude.
> The MCP server URL is `http://localhost:3002/sse`, registered as SSE type.
> For Claude Desktop, use `~/Library/Application Support/Claude/claude_desktop_config.json`.
> For Claude Code, use `~/.claude.json` or the `claude mcp add` command.
