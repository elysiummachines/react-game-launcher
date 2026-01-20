// src/App.js
import { useEffect, useMemo, useState } from "react";
import { paths } from "./config";

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

function SortableGameRow({ game, onPlay, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: String(game.id),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.85 : 1,
  };

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
          <p className="font-medium truncate">{game.name}</p>
          {game.lastPlayed && (
            <p className="text-sm text-gray-400">Last Played: {game.lastPlayed}</p>
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
  const [steamId, setSteamId] = useState("");

  const [newGogGame, setNewGogGame] = useState("");
  const [gogId, setGogId] = useState("");

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

  // ---------- HELPERS ----------
  const ensureElectronGame = () => {
    if (!(window.electronAPI && window.electronAPI.launchGame)) {
      console.error("Electron bridge not found: launchGame");
      return false;
    }
    return true;
  };

  const ensureElectronPCSX2 = () => {
    if (!(window.electronAPI && window.electronAPI.launchPCSX2)) {
      console.error("Electron bridge not found: launchPCSX2");
      return false;
    }
    return true;
  };

  // ---------- ADD ----------
  const addSteamGame = () => {
    if (!newSteamGame.trim() || !steamId.trim()) return;

    setSteamGames((prev) => [
      ...prev,
      { id: Date.now(), name: newSteamGame.trim(), steamId: steamId.trim(), lastPlayed: null },
    ]);

    setNewSteamGame("");
    setSteamId("");
  };

  const addGogGame = () => {
    if (!newGogGame.trim() || !gogId.trim()) return;

    setGogGames((prev) => [
      ...prev,
      { id: Date.now(), name: newGogGame.trim(), gogId: gogId.trim(), lastPlayed: null },
    ]);

    setNewGogGame("");
    setGogId("");
  };

  const addPcsx2Game = () => {
    if (!newPcsx2Game.trim() || !pcsx2IsoPath.trim()) return;

    setPcsx2Games((prev) => [
      ...prev,
      { id: Date.now(), name: newPcsx2Game.trim(), isoPath: pcsx2IsoPath.trim(), lastPlayed: null },
    ]);

    setNewPcsx2Game("");
    setPcsx2IsoPath("");
  };

  const addRpcs3Game = () => {
    if (!newRpcs3Game.trim() || !rpcs3GamePath.trim()) return;

    setRpcs3Games((prev) => [
      ...prev,
      { id: Date.now(), name: newRpcs3Game.trim(), gamePath: rpcs3GamePath.trim(), lastPlayed: null },
    ]);

    setNewRpcs3Game("");
    setRpcs3GamePath("");
  };

  // ---------- LAUNCH ----------
  const launchSteamGame = (game) => {
    window.location.href = `steam://rungameid/${game.steamId}`;
    setSteamGames((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: new Date().toLocaleString() } : g))
    );
  };

  const launchGogGame = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${paths.gog}" /command=runGame /gameId=${game.gogId}`;
    window.electronAPI.launchGame(command);

    setGogGames((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: new Date().toLocaleString() } : g))
    );
  };

  const launchPcsx2GameWithIso = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${paths.pcsx2}" "${game.isoPath}"`;
    window.electronAPI.launchGame(command);

    setPcsx2Games((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: new Date().toLocaleString() } : g))
    );
  };

  const launchPcsx2Only = () => {
    if (!ensureElectronPCSX2()) return;
    window.electronAPI.launchPCSX2(paths.pcsx2);
  };

  const launchRpcs3Only = () => {
    if (!ensureElectronGame()) return;
    const command = `"${paths.rpcs3}"`;
    window.electronAPI.launchGame(command);
  };

  const launchRpcs3Game = (game) => {
    if (!ensureElectronGame()) return;

    const command = `"${paths.rpcs3}" --no-gui "${game.gamePath}"`;
    window.electronAPI.launchGame(command);

    setRpcs3Games((prev) =>
      prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: new Date().toLocaleString() } : g))
    );
  };

  // ---------- REMOVE ----------
  const removeSteamGame = (id) => setSteamGames((prev) => prev.filter((g) => g.id !== id));
  const removeGogGame = (id) => setGogGames((prev) => prev.filter((g) => g.id !== id));
  const removePcsx2Game = (id) => setPcsx2Games((prev) => prev.filter((g) => g.id !== id));
  const removeRpcs3Game = (id) => setRpcs3Games((prev) => prev.filter((g) => g.id !== id));

  // ---------- UI ----------
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-8 flex items-center gap-2">🎮 Game Manager</h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 w-full max-w-7xl px-4">
        {/* RPCS3 */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-purple-400 mb-4">RPCS3</h2>

          <button
            onClick={launchRpcs3Only}
            className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold w-full mb-4"
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
              className="bg-purple-500 hover:bg-purple-600 px-4 py-2 rounded-lg font-semibold"
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
                  onPlay={() => launchRpcs3Game(game)}
                  onRemove={() => removeRpcs3Game(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* PCSX2 */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-blue-400 mb-4">PCSX2</h2>

          <button
            onClick={launchPcsx2Only}
            className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold w-full mb-4"
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
              className="bg-blue-500 hover:bg-blue-600 px-4 py-2 rounded-lg font-semibold"
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
                  onPlay={() => launchPcsx2GameWithIso(game)}
                  onRemove={() => removePcsx2Game(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* GOG */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-green-400 mb-4">GOG</h2>

          <button
            onClick={() => {
              if (!ensureElectronGame()) return;
              window.electronAPI.launchGame(`"${paths.gog}"`);
            }}
            className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg font-semibold w-full mb-4"
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
              placeholder="GOG game ID..."
              value={gogId}
              onChange={(e) => setGogId(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={addGogGame}
              className="bg-green-500 hover:bg-green-600 px-4 py-2 rounded-lg font-semibold"
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
                  onPlay={() => launchGogGame(game)}
                  onRemove={() => removeGogGame(game.id)}
                />
              )}
            />
          )}
        </div>

        {/* Steam */}
        <div className="bg-gray-800 rounded-2xl p-4 text-center">
          <h2 className="text-xl font-semibold text-yellow-400 mb-4">Steam</h2>

          <button
            onClick={() => {
              window.location.href = "steam://open/main";
            }}
            className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg font-semibold w-full mb-4"
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
            <input
              type="text"
              placeholder="Steam game ID..."
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              className="px-3 py-2 rounded-lg text-black"
            />
            <button
              onClick={addSteamGame}
              className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold"
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
