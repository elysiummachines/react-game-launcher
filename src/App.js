// src/App.js
import { useEffect, useMemo, useState } from "react";
import { paths } from "./config";

// Platform icons
import rpcs3Icon from "./assets/rpc3-100.png";
import pcsx2Icon from "./assets/pcsx2-100.png";
import gogIcon from "./assets/gog-100.png";
import steamIcon from "./assets/steam-100.png";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";

import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";

/*
|--------------------------------------------------------------------------
| FORMAT PLAY TIME — converts total seconds into a readable string
|--------------------------------------------------------------------------
*/
function formatPlayTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return null;
  if (totalSeconds < 60) return "< 1 min";
  const hours = totalSeconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}m`;
}

/*
|--------------------------------------------------------------------------
| PLAY HISTORY HELPERS
|--------------------------------------------------------------------------
| These functions sync play time and last played date to a persistent
| JSON file via Electron IPC. The history is keyed by lowercase game
| name so re-adding a game with the same name restores its history.
|--------------------------------------------------------------------------
*/
function getHistoryKey(gameName) {
  return gameName.toLowerCase().trim();
}

async function saveGameToHistory(game, platform) {
  if (!(window.electronAPI && window.electronAPI.loadPlayHistory)) return;
  try {
    const history = await window.electronAPI.loadPlayHistory();
    const key = getHistoryKey(game.name);
    history[key] = {
      name: game.name,
      totalPlayTime: game.totalPlayTime || 0,
      lastPlayed: game.lastPlayed || null,
      platform: platform,
    };
    await window.electronAPI.savePlayHistory(history);
  } catch (err) {
    console.error("Failed to save game history:", err);
  }
}

async function getGameFromHistory(gameName) {
  if (!(window.electronAPI && window.electronAPI.getGameHistory)) return null;
  try {
    return await window.electronAPI.getGameHistory(gameName);
  } catch (err) {
    console.error("Failed to load game history:", err);
    return null;
  }
}

function SortableGameRow({ game, onPlay, onRemove, isSteam, isGog, isPcsx2, isRpcs3 }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(game.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

  const playTime = formatPlayTime(game.totalPlayTime);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex justify-between items-center bg-gray-700 px-4 py-2 mb-2 rounded-lg select-none"
    >
      <div className="flex items-start gap-3 text-left min-w-0">
        <button
          type="button"
          className="text-gray-300 hover:text-white mt-1"
          title="Drag to reorder"
          {...attributes}
          {...listeners}
        >
          ☰
        </button>

        <div className="min-w-0">
          <p className="font-medium truncate">
            {game.name}
            {isSteam && game.launchMode === "steam" && (
              <span className="text-xs text-sky-400 ml-1 relative -top-[1px]" title="Steam ID launch">🛡️</span>
            )}
            {isSteam && game.launchMode !== "steam" && (
              <span className="text-xs ml-1" title="Direct EXE">📁</span>
            )}
            {isGog && <span className="text-xs ml-1 relative -top-[2px]" title="GOG game">📁</span>}
            {isPcsx2 && <span className="text-xs ml-1" title="ISO game">💿</span>}
            {isRpcs3 && <span className="text-xs ml-1 relative -top-[2px]" title="Game folder">📂</span>}
          </p>
          {game.lastPlayed && (
            <p className="text-sm text-gray-400">
              Last Played: {game.lastPlayed}
              {playTime && (
                <span className="text-cyan-400 text-xs ml-0">⏱{playTime} played</span>
              )}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 shrink-0">
        <button
          onClick={onPlay}
          className="text-green-400 hover:text-green-600 font-semibold"
          title="Launch"
        >
          ▶
        </button>
        <button
          onClick={onRemove}
          className="text-red-400 hover:text-red-600 font-semibold"
          title="Remove"
        >
          ✕
        </button>
      </div>
    </div>
  );
}

function ReorderableList({ items, setItems, renderRow }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const ids = useMemo(() => items.map((x) => String(x.id)), [items]);

  const onDragEnd = (event) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;

    setItems((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
      modifiers={[restrictToVerticalAxis, restrictToParentElement]}
    >
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        {items.map(renderRow)}
      </SortableContext>
    </DndContext>
  );
}

export default function App() {
  // ---------- STATE ----------
  const [steamGames, setSteamGames] = useState(() => {
    const saved = localStorage.getItem("steamGames");
    return saved ? JSON.parse(saved) : [];
  });

  const [gogGames, setGogGames] = useState(() => {
    const saved = localStorage.getItem("gogGames");
    return saved ? JSON.parse(saved) : [];
  });

  const [pcsx2Games, setPcsx2Games] = useState(() => {
    const saved = localStorage.getItem("pcsx2Games");
    return saved ? JSON.parse(saved) : [];
  });

  const [rpcs3Games, setRpcs3Games] = useState(() => {
    const saved = localStorage.getItem("rpcs3Games");
    return saved ? JSON.parse(saved) : [];
  });

  const [newSteamGame, setNewSteamGame] = useState("");
  const [steamExePath, setSteamExePath] = useState("");
  const [steamAppId, setSteamAppId] = useState("");
  const [steamLaunchMode, setSteamLaunchMode] = useState("steam"); // "steam" or "exe"
  const [steamExeName, setSteamExeName] = useState("");

  const [newGogGame, setNewGogGame] = useState("");
  const [gogExePath, setGogExePath] = useState("");

  const [newPcsx2Game, setNewPcsx2Game] = useState("");
  const [pcsx2IsoPath, setPcsx2IsoPath] = useState("");

  const [newRpcs3Game, setNewRpcs3Game] = useState("");
  const [rpcs3GamePath, setRpcs3GamePath] = useState("");

  // ---------- STORAGE ----------
  useEffect(() => {
    localStorage.setItem("steamGames", JSON.stringify(steamGames));
  }, [steamGames]);

  useEffect(() => {
    localStorage.setItem("gogGames", JSON.stringify(gogGames));
  }, [gogGames]);

  useEffect(() => {
    localStorage.setItem("pcsx2Games", JSON.stringify(pcsx2Games));
  }, [pcsx2Games]);

  useEffect(() => {
    localStorage.setItem("rpcs3Games", JSON.stringify(rpcs3Games));
  }, [rpcs3Games]);

  /*
  |--------------------------------------------------------------------------
  | LISTEN FOR GAME CLOSED - accumulate play time + save to history
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    if (!(window.electronAPI && window.electronAPI.onGameClosed)) return;

    window.electronAPI.onGameClosed((data) => {
      const { gameId, elapsedSeconds } = data;
      console.log(`Game closed: ${gameId}, played for ${elapsedSeconds}s`);

      const updater = (prev) =>
        prev.map((g) =>
          String(g.id) === String(gameId)
            ? { ...g, totalPlayTime: (g.totalPlayTime || 0) + elapsedSeconds }
            : g
        );

      setSteamGames(updater);
      setGogGames(updater);
      setPcsx2Games(updater);
      setRpcs3Games(updater);

      // Save updated play time to persistent history
      // We need to find the game across all platforms to get its name
      const findAndSave = (games, platform) => {
        const game = games.find((g) => String(g.id) === String(gameId));
        if (game) {
          const updated = { ...game, totalPlayTime: (game.totalPlayTime || 0) + elapsedSeconds };
          saveGameToHistory(updated, platform);
        }
      };

      // Use current state via functional refs — we read from localStorage
      // since state may not be updated yet inside this callback
      try {
        const steam = JSON.parse(localStorage.getItem("steamGames") || "[]");
        const gog = JSON.parse(localStorage.getItem("gogGames") || "[]");
        const pcsx2 = JSON.parse(localStorage.getItem("pcsx2Games") || "[]");
        const rpcs3 = JSON.parse(localStorage.getItem("rpcs3Games") || "[]");

        findAndSave(steam, "steam");
        findAndSave(gog, "gog");
        findAndSave(pcsx2, "pcsx2");
        findAndSave(rpcs3, "rpcs3");
      } catch (err) {
        console.error("Failed to save play history on game close:", err);
      }
    });
  }, []);

  // ---------- HELPERS ----------
  const ensureElectronGame = () => {
    if (!(window.electronAPI && window.electronAPI.launchGame)) {
      console.error("Electron bridge not found: launchGame");
      return false;
    }
    return true;
  };

  // ---------- ADD (with history restore) ----------
  const addSteamGame = async () => {
    if (!newSteamGame.trim()) return;

    // For steam:// mode, we need an App ID. For exe mode, we need the exe path.
    if (steamLaunchMode === "steam" && !steamAppId.trim()) return;
    if (steamLaunchMode === "exe" && !steamExePath.trim()) return;

    // Check for existing play history
    const history = await getGameFromHistory(newSteamGame.trim());

    setSteamGames((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newSteamGame.trim(),
        exePath: steamExePath.trim(),
        steamAppId: steamAppId.trim(),
        launchMode: steamLaunchMode, // "steam" or "exe"
        steamExeName: steamExeName.trim(),
        lastPlayed: history ? history.lastPlayed : null,
        totalPlayTime: history ? history.totalPlayTime : 0,
      },
    ]);

    setNewSteamGame("");
    setSteamExePath("");
    setSteamAppId("");
    setSteamExeName("");
  };

  const addGogGame = async () => {
    if (!newGogGame.trim() || !gogExePath.trim()) return;

    const history = await getGameFromHistory(newGogGame.trim());

    setGogGames((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newGogGame.trim(),
        exePath: gogExePath.trim(),
        lastPlayed: history ? history.lastPlayed : null,
        totalPlayTime: history ? history.totalPlayTime : 0,
      },
    ]);

    setNewGogGame("");
    setGogExePath("");
  };

  const addPcsx2Game = async () => {
    if (!newPcsx2Game.trim() || !pcsx2IsoPath.trim()) return;

    const history = await getGameFromHistory(newPcsx2Game.trim());

    setPcsx2Games((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newPcsx2Game.trim(),
        isoPath: pcsx2IsoPath.trim(),
        lastPlayed: history ? history.lastPlayed : null,
        totalPlayTime: history ? history.totalPlayTime : 0,
      },
    ]);

    setNewPcsx2Game("");
    setPcsx2IsoPath("");
  };

  const addRpcs3Game = async () => {
    if (!newRpcs3Game.trim() || !rpcs3GamePath.trim()) return;

    const history = await getGameFromHistory(newRpcs3Game.trim());

    setRpcs3Games((prev) => [
      ...prev,
      {
        id: Date.now(),
        name: newRpcs3Game.trim(),
        gamePath: rpcs3GamePath.trim(),
        lastPlayed: history ? history.lastPlayed : null,
        totalPlayTime: history ? history.totalPlayTime : 0,
      },
    ]);

    setNewRpcs3Game("");
    setRpcs3GamePath("");
  };

  // ---------- LAUNCH (also saves lastPlayed to history) ----------

  /*
  |--------------------------------------------------------------------------
  | HYBRID STEAM LAUNCH
  |--------------------------------------------------------------------------
  | "steam" mode  → uses steam://rungameid/<appId>  (anti-cheat safe, no
  |                  "custom arguments" popup, Steam overlay works properly)
  | "exe" mode    → launches the exe directly (old behavior, for games that
  |                  don't need anti-cheat or Steam overlay)
  |--------------------------------------------------------------------------
  */
  const launchSteamGame = (game) => {
    if (game.launchMode === "steam" && game.steamAppId) {
      // Launch via Steam protocol — anti-cheat safe
      if (window.electronAPI && window.electronAPI.launchSteamUrl) {
        window.electronAPI.launchSteamUrl(`steam://rungameid/${game.steamAppId}`, game.id, game.steamExeName || null);
      } else if (window.electronAPI && window.electronAPI.launchGame) {
        // Fallback: use start command to open steam:// URL on Windows
        const command = `cmd /c start "" "steam://rungameid/${game.steamAppId}"`;
        window.electronAPI.launchGame(command, game.id);
      }
    } else {
      // Direct exe launch (old behavior)
      if (!ensureElectronGame()) return;
      const command = `"${game.exePath}"`;
      window.electronAPI.launchGame(command, game.id);
    }

    const now = new Date().toLocaleString();
    setSteamGames((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g))
    );
    saveGameToHistory({ ...game, lastPlayed: now }, "steam");
  };

  const launchGogGame = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${game.exePath}"`;
    window.electronAPI.launchGame(command, game.id);

    const now = new Date().toLocaleString();
    setGogGames((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g))
    );
    saveGameToHistory({ ...game, lastPlayed: now }, "gog");
  };

  const launchPcsx2GameWithIso = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${paths.pcsx2}" "${game.isoPath}"`;
    window.electronAPI.launchGame(command, game.id);

    const now = new Date().toLocaleString();
    setPcsx2Games((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g))
    );
    saveGameToHistory({ ...game, lastPlayed: now }, "pcsx2");
  };

  const launchPcsx2Only = () => {
    if (!ensureElectronGame()) return;
    const command = `"${paths.pcsx2}"`;
    window.electronAPI.launchGame(command);
  };

  const launchRpcs3Only = () => {
    if (!ensureElectronGame()) return;
    const command = `"${paths.rpcs3}"`;
    window.electronAPI.launchGame(command);
  };

  const launchRpcs3Game = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${paths.rpcs3}" --no-gui "${game.gamePath}"`;
    window.electronAPI.launchGame(command, game.id);

    const now = new Date().toLocaleString();
    setRpcs3Games((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g))
    );
    saveGameToHistory({ ...game, lastPlayed: now }, "rpcs3");
  };

  // ---------- REMOVE ----------
  const removeSteamGame = (id) => setSteamGames((prev) => prev.filter((g) => g.id !== id));
  const removeGogGame = (id) => setGogGames((prev) => prev.filter((g) => g.id !== id));
  const removePcsx2Game = (id) => setPcsx2Games((prev) => prev.filter((g) => g.id !== id));
  const removeRpcs3Game = (id) => setRpcs3Games((prev) => prev.filter((g) => g.id !== id));

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-8 flex items-center gap-2">🎮 Game Launcher</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl px-4">
        {/* RPCS3 */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-purple-300 mb-4 flex items-center justify-center gap-2">
            <img src={rpcs3Icon} alt="RPCS3" className="w-10 h-10 object-contain" />
            RPCS3</h2>
          <button
            onClick={launchRpcs3Only}
            className="bg-purple-800 hover:bg-purple-900 px-4 py-2 rounded-lg font-semibold w-full mb-4"
          >
            Launch RPCS3
          </button>

          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="Game name..."
              value={newRpcs3Game}
              onChange={(e) => setNewRpcs3Game(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <input
              type="text"
              placeholder="Path to game folder..."
              value={rpcs3GamePath}
              onChange={(e) => setRpcs3GamePath(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={addRpcs3Game}
              className="bg-purple-800 hover:bg-purple-900 px-4 py-2 rounded-lg font-semibold"
            >
              Add
            </button>
          </div>

          {rpcs3Games.length === 0 ? (
            <p className="text-gray-400 text-center">No RPCS3 games added yet.</p>
          ) : (
            <ReorderableList
              items={rpcs3Games}
              setItems={setRpcs3Games}
              renderRow={(game) => (
                <SortableGameRow
                  key={game.id}
                  game={game}
                  isRpcs3
                  onPlay={() => launchRpcs3Game(game)}
                  onRemove={() => removeRpcs3Game(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* PCSX2 */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-blue-400 mb-4 flex items-center justify-center gap-2">
            <img src={pcsx2Icon} alt="PCSX2" className="w-10 h-10 object-contain" />
            PCSX2</h2>
          <button
            onClick={launchPcsx2Only}
            className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold w-full mb-4"
          >
            Launch PCSX2
          </button>

          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="Game name..."
              value={newPcsx2Game}
              onChange={(e) => setNewPcsx2Game(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <input
              type="text"
              placeholder="Path to ISO..."
              value={pcsx2IsoPath}
              onChange={(e) => setPcsx2IsoPath(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={addPcsx2Game}
              className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold"
            >
              Add
            </button>
          </div>

          {pcsx2Games.length === 0 ? (
            <p className="text-gray-400 text-center">No PCSX2 games added yet.</p>
          ) : (
            <ReorderableList
              items={pcsx2Games}
              setItems={setPcsx2Games}
              renderRow={(game) => (
                <SortableGameRow
                  key={game.id}
                  game={game}
                  isPcsx2
                  onPlay={() => launchPcsx2GameWithIso(game)}
                  onRemove={() => removePcsx2Game(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* GOG */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-purple-400 mb-4 flex items-center justify-center gap-2">
            <img src={gogIcon} alt="GOG" className="w-10 h-10 object-contain" />
            GOG</h2>
          <button
            onClick={() => {
              if (!ensureElectronGame()) return;
              window.electronAPI.launchGame(`"${paths.gog}"`);
            }}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold w-full mb-4"
          >
            Launch GOG
          </button>

          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="Game name..."
              value={newGogGame}
              onChange={(e) => setNewGogGame(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <input
              type="text"
              placeholder="path to game exe..."
              value={gogExePath}
              onChange={(e) => setGogExePath(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={addGogGame}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold"
            >
              Add
            </button>
          </div>

          {gogGames.length === 0 ? (
            <p className="text-gray-400 text-center">No GOG games added yet.</p>
          ) : (
            <ReorderableList
              items={gogGames}
              setItems={setGogGames}
              renderRow={(game) => (
                <SortableGameRow
                  key={game.id}
                  game={game}
                  isGog
                  onPlay={() => launchGogGame(game)}
                  onRemove={() => removeGogGame(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* Steam - HYBRID LAUNCH */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-sky-400 mb-4 flex items-center justify-center gap-2">
            <img src={steamIcon} alt="Steam" className="w-10 h-10 object-contain" />
            Steam</h2>
          <button
            onClick={() => {
              window.location.href = "steam://open/main";
            }}
            className="bg-sky-700 hover:bg-sky-800 px-4 py-2 rounded-lg font-semibold w-full mb-4"
          >
            Steam Launcher
          </button>

          <div className="flex flex-col gap-2 mb-4">
            <input
              type="text"
              placeholder="Game name..."
              value={newSteamGame}
              onChange={(e) => setNewSteamGame(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />

            {/* Launch mode toggle */}
            <div className="flex rounded-lg overflow-hidden border border-gray-600">
              <button
                type="button"
                onClick={() => setSteamLaunchMode("steam")}
                className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                  steamLaunchMode === "steam"
                    ? "bg-sky-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
                title="Launch via Steam protocol — anti-cheat safe, no 'custom arguments' popup"
              >
                🛡️ Steam ID
              </button>
              <button
                type="button"
                onClick={() => setSteamLaunchMode("exe")}
                className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${
                  steamLaunchMode === "exe"
                    ? "bg-sky-600 text-white"
                    : "bg-gray-700 text-gray-400 hover:text-white"
                }`}
                title="Launch exe directly — may trigger 'custom arguments' popup or break anti-cheat"
              >
                📁 Direct EXE
              </button>
            </div>

            {steamLaunchMode === "steam" ? (
              <>
              <input
                type="text"
                placeholder="Steam App ID (e.g. 730 for CS2)..."
                value={steamAppId}
                onChange={(e) => setSteamAppId(e.target.value)}
                className="px-3 py-2 rounded-lg text-black"
              />
              <input
                type="text"
                placeholder="Process name (e.g. DOOMx64vk.exe)..."
                value={steamExeName}
                onChange={(e) => setSteamExeName(e.target.value)}
                className="px-3 py-2 rounded-lg text-black"
              />
              </>
            ) : (
              <input
                type="text"
                placeholder="Path to game exe..."
                value={steamExePath}
                onChange={(e) => setSteamExePath(e.target.value)}
                className="px-3 py-2 rounded-lg text-black"
              />
            )}

            <button
              onClick={addSteamGame}
              className="bg-sky-700 hover:bg-sky-800 px-4 py-2 rounded-lg font-semibold"
            >
              Add
            </button>
          </div>

          {steamGames.length === 0 ? (
            <p className="text-gray-400 text-center">No Steam games added yet.</p>
          ) : (
            <ReorderableList
              items={steamGames}
              setItems={setSteamGames}
              renderRow={(game) => (
                <SortableGameRow
                  key={game.id}
                  game={game}
                  isSteam
                  onPlay={() => launchSteamGame(game)}
                  onRemove={() => removeSteamGame(game.id)}
                />
              )}
            />
          )}
        </div>

      </div>
    </div>
  );
}