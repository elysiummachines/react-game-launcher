# Changelog

All notable changes to Game Launcher will be documented in this file.

## [0.2.3] - 2026-02-14

### Added
- Hybrid Steam launch mode — per-game toggle between Steam ID and Direct EXE
- Steam ID mode launches games via steam://rungameid/<appId> protocol
- Process name field for Steam ID games to enable play time tracking via tasklist polling
- launch-steam-url IPC handler in main.js using shell.openExternal()
- launchSteamUrl bridge method in preload.js
- Platform icons next to game titles: 🛡️ Steam ID, 📁 Direct EXE/GOG, 💿 PCSX2, 📂 RPCS3

### Fixed
- Steam games with anti-cheat (CS2, Callisto Protocol) now launch correctly through Steam's native process
- Eliminated "Launch Game with custom arguments" popup on Steam games
- Play time tracking now works for Steam games (both Steam ID and Direct EXE modes)
- Play time tracking now works for GOG games
- Play time display no longer wraps to a new line on longer timestamps

## [0.2.2] - 2026-02-13

###Added
- 0Play time tracking for RPCS3, PCSX2, and GOG games
- activeGames Map in main.js to track game process start/exit times
- gameId parameter to launch-game IPC handler for per-game tracking
- game-closed IPC event sends elapsed seconds back to renderer on process exit
- onGameClosed listener in preload.js
- formatPlayTime() helper in App.js (converts seconds to 11m, 1.5h, etc.)
- totalPlayTime field on all new game entries
- Play time displayed inline next to last played date with ⏱ icon
- Tasklist polling fallback for Steam games where the process exits immediately

### Changed
- Default window width increased from 1300 to 1400
- Default window height increased from 900 to 1100

## [0.2.1] - 2026-02-12

###Added
- Platform icons in column headers (RPCS3, PCSX2, GOG, Steam logos)
- Custom application icon for Windows taskbar, installer, and title bar

### Changed
- Improved column header layout with icon and text alignment

## [0.2.0] - 2026-02-11

### Changed
- Renamed application from "Game Manager" to "Game Launcher"
- Updated application ID to `com.yourname.gamelauncher`
- Removed React branding and default icons
- Updated all window titles to "Game Launcher"

### Added
- Dynamic version API - version now pulls automatically from package.json
- Exposed `window.electron.getAppVersion()` for displaying version in UI
- Comprehensive build configuration for proper installer naming
- Custom icon support throughout application

### Fixed
- Installer now correctly named "Game Launcher Setup 0.2.0.exe"
- Version number now consistent across all build artifacts
- Removed hardcoded version references
- Proper icon configuration for Windows taskbar and pinned shortcuts

### Technical
- Updated `main.js` with new app name and version API
- Updated `preload.js` to expose version to renderer
- Updated `package.json` build configuration
- Cleaned up public folder manifest and HTML

## [0.1.0] - 2026-01-20

### Added
- Initial release
- Support for RPCS3, PCSX2, GOG, and Steam launchers
- Drag-and-drop game reordering within columns
- Vertical-only drag lock for improved UX
- LocalStorage persistence for game library
- Last played timestamp tracking
- Launch buttons for each platform
- Game card UI with delete functionality

### Features
- Multi-platform game launcher (4 platforms)
- Reorderable game lists
- Persistent storage (LocalStorage)
- Clean, modern UI
