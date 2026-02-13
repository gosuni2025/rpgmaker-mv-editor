# RPG Maker MV Editor

A web-based editor for RPG Maker MV projects, reimplemented as a modern desktop application.

## Download

**[Download Latest Release](https://github.com/painh/rpgmaker-mv-editor/releases/latest)**

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `.dmg` |
| macOS (Intel) | `.dmg` |
| Windows | `.exe` (installer) / `.zip` |
| Linux | `.AppImage` / `.zip` |

## Prerequisites

- **RPG Maker MV** is required. This editor works with RPG Maker MV project files and depends on its runtime assets.

## Development

### Requirements

- Node.js 20+
- npm

### Setup

```bash
# Install dependencies
npm install
cd server && npm install
cd ../client && npm install
cd ..

# Run in development mode (server:3001 + client:5173)
npm run dev
```

### Build

```bash
# Build all (client + server + electron)
npm run build

# Package as desktop app
npm run dist
```

## Architecture

- **Client**: React 18 + TypeScript + Vite + Zustand
- **Server**: Express + TypeScript
- **Desktop**: Electron (bundles client + server into a single app)

### AI Integration

The editor watches the project `data/` directory for external file changes via WebSocket. When an AI tool (or any external process) modifies project JSON files, the editor automatically reloads the affected data in real-time.

## License

[MIT](LICENSE)
