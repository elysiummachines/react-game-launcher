# 🎮 Game Launcher

A lightweight desktop application that brings your game library and emulators under one roof.

![Game Launcher Screenshot](G.L.png)

## Overview

Game Launcher is an Electron + React application that lets you manage and launch games across multiple platforms from a single, clean interface.

**Supported Platforms**
- RPCS3 (PS3 Emulator)
- PCSX2 (PS2 Emulator)
- GOG
- Steam

## Features

- Launch emulators and game clients directly from the app
- Add and manage the current active games per platform
- Game list reordering within each column
- Last played timestamp tracking
- Persistent game library via local storage
- Clean, modern dark UI

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- npm

### Installation

```bash
git clone https://github.com/elysiummachines/react-game-launcher.git
cd react-game-launcher
npm install
```

### Development

```bash
npm run dev
```

Starts the React dev server and Electron together.

### Production Build

```bash
npm run dist
```

Outputs installer and portable `.exe` to the `dist/` folder.

## Project Structure

```
game-launcher/
├── assets/          # Electron app icons
├── public/          # Static files
├── src/             # React source
│   ├── assets/      # Platform icons
│   ├── App.js       # Main UI component
│   └── config.js    # Launcher paths config
├── main.js          # Electron main process
└── preload.js       # Electron preload bridge
```

## Configuration

Edit `src/config.js` to point to your local emulator and launcher executables.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

MIT