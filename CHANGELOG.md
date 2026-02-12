# Changelog

All notable changes to Game Launcher will be documented in this file.

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