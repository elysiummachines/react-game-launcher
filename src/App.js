// src/App.js — REFACTORED v0.4.0
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { paths, STORAGE_KEYS } from "./config";
import rpcs3Icon from "./assets/rpc3-100.png";
import pcsx2Icon from "./assets/pcsx2-100.png";
import gogIcon from "./assets/gog-100.png";
import steamIcon from "./assets/steam-100.png";
import localIcon from "./assets/local-100.png";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToVerticalAxis, restrictToParentElement } from "@dnd-kit/modifiers";
function formatPlayTime(totalSeconds) {
  if (!totalSeconds || totalSeconds <= 0) return null;
  if (totalSeconds < 60) return "< 1 min";
  const hours = totalSeconds / 3600;
  if (hours >= 1) return `${hours.toFixed(1)}h`;
  return `${Math.floor(totalSeconds / 60)}m`;
}
function buildGameEntry(name, extraFields, history) {
  return {
    id: Date.now(),
    name: name.trim(),
    ...extraFields,
    lastPlayed: history ? history.lastPlayed : null,
    totalPlayTime: history ? history.totalPlayTime : 0,
  };
}
function getHistoryKey(gameName) { return gameName.toLowerCase().trim(); }
async function saveGameToHistory(game, platform) {
  if (!(window.electronAPI && window.electronAPI.loadPlayHistory)) return;
  try {
    const history = await window.electronAPI.loadPlayHistory();
    history[getHistoryKey(game.name)] = {
      name: game.name,
      totalPlayTime: game.totalPlayTime || 0,
      lastPlayed: game.lastPlayed || null,
      platform,
    };
    await window.electronAPI.savePlayHistory(history);
  } catch (err) { console.error("Failed to save game history:", err); }
}
async function getGameFromHistory(gameName) {
  if (!(window.electronAPI && window.electronAPI.getGameHistory)) return null;
  try { return await window.electronAPI.getGameHistory(gameName); }
  catch (err) { console.error("Failed to load game history:", err); return null; }
}
function useLocalStorageState(key, defaultValue = []) {
  const [state, setState] = useState(() => {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : defaultValue;
  });
  useEffect(() => { localStorage.setItem(key, JSON.stringify(state)); }, [key, state]);
  return [state, setState];
}
function SortableGameRow({ game, onPlay, onRemove, isSteam, isGog, isPcsx2, isRpcs3, isLocal }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: String(game.id) });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.85 : 1 };
  const playTime = formatPlayTime(game.totalPlayTime);
  return (
    <div ref={setNodeRef} style={style} className="flex justify-between items-center bg-gray-700 px-4 py-2 mb-2 rounded-lg select-none">
      <div className="flex items-start gap-3 text-left min-w-0">
        <button type="button" className="text-gray-300 hover:text-white mt-1" title="Drag to reorder" {...attributes} {...listeners}>☰</button>
        <div className="min-w-0">
          <p className="font-medium truncate">
            {game.name}
            {isSteam && game.launchMode === "steam" && <span className="text-xs text-sky-400 ml-1 relative -top-[1px]" title="Steam ID launch">🛡️</span>}
            {isSteam && game.launchMode !== "steam" && <span className="text-xs ml-1" title="Direct EXE">📁</span>}
            {isGog && <span className="text-xs ml-1 relative -top-[2px]" title="GOG game">📁</span>}
            {isPcsx2 && <span className="text-xs ml-1" title="ISO game">💿</span>}
            {isRpcs3 && <span className="text-xs ml-1 relative -top-[2px]" title="Game folder">📂</span>}
            {isLocal && <span className="text-xs ml-1 relative -top-[2px]" title="Local game">🖥️</span>}
          </p>
          {game.lastPlayed && (
            <p className="text-sm text-white">
              Last Played: {game.lastPlayed}
              {playTime && <span className="text-cyan-400 text-sm ml-0">⏱{playTime} played</span>}
            </p>
          )}
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={onPlay} className="text-green-400 hover:text-green-600 font-semibold" title="Launch">▶</button>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 font-semibold" title="Remove">✕</button>
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
    const oldIdx = ids.indexOf(String(active.id));
    const newIdx = ids.indexOf(String(over.id));
    if (oldIdx === -1 || newIdx === -1) return;
    setItems((prev) => arrayMove(prev, oldIdx, newIdx));
  };
  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} modifiers={[restrictToVerticalAxis, restrictToParentElement]}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>{items.map(renderRow)}</SortableContext>
    </DndContext>
  );
}
function PlatformSection({ title, icon, titleColor, buttonColor, games, setGames, onLaunch, launchLabel, renderForm, renderRow }) {
  return (
    <div className="bg-gray-800 rounded-2xl p-4 text-center">
      <h2 className={`text-xl font-semibold ${titleColor} mb-4 flex items-center justify-center gap-2`}>
        <img src={icon} alt={title} className="w-10 h-10 object-contain" />{title}
      </h2>
      <button onClick={onLaunch} className={`${buttonColor} px-4 py-2 rounded-lg font-semibold w-full mb-4`}>
        {launchLabel}
      </button>
      <div className="flex flex-col gap-2 mb-4">
        {renderForm()}
      </div>
      {games.length === 0 ? (
        <p className="text-gray-400 text-center">No {title} games added yet.</p>
      ) : (
        <ReorderableList items={games} setItems={setGames} renderRow={renderRow} />
      )}
    </div>
  );
}
export default function App() {
  const [steamGames, setSteamGames] = useLocalStorageState(STORAGE_KEYS.steam);
  const [gogGames, setGogGames] = useLocalStorageState(STORAGE_KEYS.gog);
  const [pcsx2Games, setPcsx2Games] = useLocalStorageState(STORAGE_KEYS.pcsx2);
  const [rpcs3Games, setRpcs3Games] = useLocalStorageState(STORAGE_KEYS.rpcs3);
  const [localGames, setLocalGames] = useLocalStorageState(STORAGE_KEYS.local);
  const steamRef = useRef(steamGames);
  const gogRef = useRef(gogGames);
  const pcsx2Ref = useRef(pcsx2Games);
  const rpcs3Ref = useRef(rpcs3Games);
  const localRef = useRef(localGames);
  useEffect(() => { steamRef.current = steamGames; }, [steamGames]);
  useEffect(() => { gogRef.current = gogGames; }, [gogGames]);
  useEffect(() => { pcsx2Ref.current = pcsx2Games; }, [pcsx2Games]);
  useEffect(() => { rpcs3Ref.current = rpcs3Games; }, [rpcs3Games]);
  useEffect(() => { localRef.current = localGames; }, [localGames]);
  const platformMap = useMemo(() => ({
    steam: { setter: setSteamGames, ref: steamRef },
    gog: { setter: setGogGames, ref: gogRef },
    pcsx2: { setter: setPcsx2Games, ref: pcsx2Ref },
    rpcs3: { setter: setRpcs3Games, ref: rpcs3Ref },
    local: { setter: setLocalGames, ref: localRef },
  }), [setSteamGames, setGogGames, setPcsx2Games, setRpcs3Games, setLocalGames]);
  const [steamForm, setSteamForm] = useState({ name: "", exePath: "", appId: "", launchMode: "steam", exeName: "" });
  const [gogForm, setGogForm] = useState({ name: "", exePath: "" });
  const [pcsx2Form, setPcsx2Form] = useState({ name: "", isoPath: "" });
  const [rpcs3Form, setRpcs3Form] = useState({ name: "", gamePath: "" });
  const [localForm, setLocalForm] = useState({ name: "", exePath: "" });
  useEffect(() => {
    if (!window.electronAPI?.onGameClosed) return;
    const unsub = window.electronAPI.onGameClosed((data) => {
      const { gameId, elapsedSeconds } = data;
      console.log(`Game closed: ${gameId}, played for ${elapsedSeconds}s`);
      const updater = (prev) =>
        prev.map((g) => String(g.id) === String(gameId) ? { ...g, totalPlayTime: (g.totalPlayTime || 0) + elapsedSeconds } : g);
      Object.values(platformMap).forEach(({ setter }) => setter(updater));
      Object.entries(platformMap).forEach(([platform, { ref }]) => {
        const game = ref.current.find((g) => String(g.id) === String(gameId));
        if (game) saveGameToHistory({ ...game, totalPlayTime: (game.totalPlayTime || 0) + elapsedSeconds }, platform);
      });
    });
    return () => unsub?.();
  }, [platformMap]);
  const ensureElectronGame = () => {
    if (!(window.electronAPI && window.electronAPI.launchGame)) { console.error("Electron bridge not found"); return false; }
    return true;
  };
  const launchAndTrack = useCallback((game, setter, platform) => {
    const now = new Date().toLocaleString();
    setter((prev) => prev.map((g) => (g.id === game.id ? { ...g, lastPlayed: now } : g)));
    saveGameToHistory({ ...game, lastPlayed: now }, platform);
  }, []);
  const removeGame = useCallback((id, setter) => {
    setter((prev) => prev.filter((g) => g.id !== id));
  }, []);
  // ---------- ADD ----------
  const addSteamGame = async () => {
    if (!steamForm.name.trim()) return;
    if (steamForm.launchMode === "steam" && !steamForm.appId.trim()) return;
    if (steamForm.launchMode === "exe" && !steamForm.exePath.trim()) return;
    const history = await getGameFromHistory(steamForm.name.trim());
    setSteamGames((prev) => [...prev, buildGameEntry(steamForm.name, {
      exePath: steamForm.exePath.trim(),
      steamAppId: steamForm.appId.trim(),
      launchMode: steamForm.launchMode,
      steamExeName: steamForm.exeName.trim(),
    }, history)]);
    setSteamForm({ name: "", exePath: "", appId: "", launchMode: "steam", exeName: "" });
  };
  const addGogGame = async () => {
    if (!gogForm.name.trim() || !gogForm.exePath.trim()) return;
    const history = await getGameFromHistory(gogForm.name.trim());
    setGogGames((prev) => [...prev, buildGameEntry(gogForm.name, { exePath: gogForm.exePath.trim() }, history)]);
    setGogForm({ name: "", exePath: "" });
  };
  const addPcsx2Game = async () => {
    if (!pcsx2Form.name.trim() || !pcsx2Form.isoPath.trim()) return;
    const history = await getGameFromHistory(pcsx2Form.name.trim());
    setPcsx2Games((prev) => [...prev, buildGameEntry(pcsx2Form.name, { isoPath: pcsx2Form.isoPath.trim() }, history)]);
    setPcsx2Form({ name: "", isoPath: "" });
  };
  const addRpcs3Game = async () => {
    if (!rpcs3Form.name.trim() || !rpcs3Form.gamePath.trim()) return;
    const history = await getGameFromHistory(rpcs3Form.name.trim());
    setRpcs3Games((prev) => [...prev, buildGameEntry(rpcs3Form.name, { gamePath: rpcs3Form.gamePath.trim() }, history)]);
    setRpcs3Form({ name: "", gamePath: "" });
  };
  const addLocalGame = async () => {
    if (!localForm.name.trim() || !localForm.exePath.trim()) return;
    const history = await getGameFromHistory(localForm.name.trim());
    setLocalGames((prev) => [...prev, buildGameEntry(localForm.name, { exePath: localForm.exePath.trim() }, history)]);
    setLocalForm({ name: "", exePath: "" });
  };
  // ---------- LAUNCH ----------
  const launchSteamGame = (game) => {
    if (game.launchMode === "steam" && game.steamAppId) {
      if (window.electronAPI && window.electronAPI.launchSteamUrl) {
        window.electronAPI.launchSteamUrl(`steam://rungameid/${game.steamAppId}`, game.id, game.steamExeName || null);
      } else if (window.electronAPI && window.electronAPI.launchGame) {
        window.electronAPI.launchGame(`cmd /c start "" "steam://rungameid/${game.steamAppId}"`, game.id);
      }
    } else {
      if (!ensureElectronGame()) return;
      window.electronAPI.launchGame(`"${game.exePath}"`, game.id);
    }
    launchAndTrack(game, setSteamGames, "steam");
  };
  const launchGogGame = (game) => {
    if (!ensureElectronGame()) return;
    window.electronAPI.launchGame(`"${game.exePath}"`, game.id);
    launchAndTrack(game, setGogGames, "gog");
  };
  const launchPcsx2GameWithIso = (game) => {
    if (!ensureElectronGame()) return;
    window.electronAPI.launchGame(`"${paths.pcsx2}" "${game.isoPath}"`, game.id, true );
    launchAndTrack(game, setPcsx2Games, "pcsx2");
  };
  const launchLocalGame = (game) => {
    if (!ensureElectronGame()) return;
    window.electronAPI.launchGame(`"${game.exePath}"`, game.id, true);
    launchAndTrack(game, setLocalGames, "local");
  };
  const launchPcsx2Only = () => { if (!ensureElectronGame()) return; window.electronAPI.launchGame(`"${paths.pcsx2}"`); };
  const launchRpcs3Only = () => { if (!ensureElectronGame()) return; window.electronAPI.launchGame(`"${paths.rpcs3}"`); };
  const launchGogOnly = () => { if (!ensureElectronGame()) return; window.electronAPI.launchGame(`"${paths.gog}"`); };
  const launchRpcs3Game = (game) => {
    if (!ensureElectronGame()) return;
    window.electronAPI.launchGame(`"${paths.rpcs3}" --no-gui "${game.gamePath}"`, game.id,);
    launchAndTrack(game, setRpcs3Games, "rpcs3");
  };
  // ---------- UI-JSX ----------
  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center py-10">
      <h1 className="text-4xl font-bold mb-8 flex items-center gap-2">🎮 Game Launcher</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 w-full px-4">
        {/* RPCS3 */}
        <PlatformSection
          title="RPCS3"
          icon={rpcs3Icon}
          titleColor="text-purple-300"
          buttonColor="bg-purple-800 hover:bg-purple-900"
          games={rpcs3Games}
          setGames={setRpcs3Games}
          onLaunch={launchRpcs3Only}
          launchLabel="Launch RPCS3"
          renderForm={() => (
            <>
              <input type="text" placeholder="Game name..." value={rpcs3Form.name} onChange={(e) => setRpcs3Form((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <input type="text" placeholder="Path to game folder..." value={rpcs3Form.gamePath} onChange={(e) => setRpcs3Form((prev) => ({ ...prev, gamePath: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <button onClick={addRpcs3Game} className="bg-purple-800 hover:bg-purple-900 px-4 py-2 rounded-lg font-semibold">Add</button>
            </>
          )}
          renderRow={(game) => (
            <SortableGameRow key={game.id} game={game} isRpcs3 onPlay={() => launchRpcs3Game(game)} onRemove={() => removeGame(game.id, setRpcs3Games)} />
          )}
        />
        {/* PCSX2 */}
        <PlatformSection
          title="PCSX2"
          icon={pcsx2Icon}
          titleColor="text-blue-400"
          buttonColor="bg-blue-700 hover:bg-blue-800"
          games={pcsx2Games}
          setGames={setPcsx2Games}
          onLaunch={launchPcsx2Only}
          launchLabel="Launch PCSX2"
          renderForm={() => (
            <>
              <input type="text" placeholder="Game name..." value={pcsx2Form.name} onChange={(e) => setPcsx2Form((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <input type="text" placeholder="Path to ISO..." value={pcsx2Form.isoPath} onChange={(e) => setPcsx2Form((prev) => ({ ...prev, isoPath: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <button onClick={addPcsx2Game} className="bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg font-semibold">Add</button>
            </>
          )}
          renderRow={(game) => (
            <SortableGameRow key={game.id} game={game} isPcsx2 onPlay={() => launchPcsx2GameWithIso(game)} onRemove={() => removeGame(game.id, setPcsx2Games)} />
          )}
        />
        {/* GOG */}
        <PlatformSection
          title="GOG"
          icon={gogIcon}
          titleColor="text-purple-400"
          buttonColor="bg-purple-600 hover:bg-purple-700"
          games={gogGames}
          setGames={setGogGames}
          onLaunch={launchGogOnly}
          launchLabel="Launch GOG"
          renderForm={() => (
            <>
              <input type="text" placeholder="Game name..." value={gogForm.name} onChange={(e) => setGogForm((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <input type="text" placeholder="Path to game exe..." value={gogForm.exePath} onChange={(e) => setGogForm((prev) => ({ ...prev, exePath: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <button onClick={addGogGame} className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-semibold">Add</button>
            </>
          )}
          renderRow={(game) => (
            <SortableGameRow key={game.id} game={game} isGog onPlay={() => launchGogGame(game)} onRemove={() => removeGame(game.id, setGogGames)} />
          )}
        />
        {/* Steam */}
        <PlatformSection
          title="Steam"
          icon={steamIcon}
          titleColor="text-sky-400"
          buttonColor="bg-sky-700 hover:bg-sky-800"
          games={steamGames}
          setGames={setSteamGames}
          onLaunch={() => { window.location.href = "steam://open/main"; }}
          launchLabel="Steam Launcher"
          renderForm={() => (
            <>
              <input type="text" placeholder="Game name..." value={steamForm.name} onChange={(e) => setSteamForm((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <div className="flex rounded-lg overflow-hidden border border-gray-600">
                <button type="button" onClick={() => setSteamForm((prev) => ({ ...prev, launchMode: "steam" }))}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${steamForm.launchMode === "steam" ? "bg-sky-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                  title="Launch via Steam protocol — anti-cheat safe, no 'custom arguments' popup">🛡️ Steam ID</button>
                <button type="button" onClick={() => setSteamForm((prev) => ({ ...prev, launchMode: "exe" }))}
                  className={`flex-1 px-3 py-2 text-sm font-semibold transition-colors ${steamForm.launchMode === "exe" ? "bg-sky-600 text-white" : "bg-gray-700 text-gray-400 hover:text-white"}`}
                  title="Launch exe directly — may trigger 'custom arguments' popup or break anti-cheat">📁 Direct EXE</button>
              </div>
              {steamForm.launchMode === "steam" ? (
                <>
                  <input type="text" placeholder="Steam App ID (e.g. 730 for CS2)..." value={steamForm.appId} onChange={(e) => setSteamForm((prev) => ({ ...prev, appId: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
                  <input type="text" placeholder="Process name (e.g. DOOMx64vk.exe)..." value={steamForm.exeName} onChange={(e) => setSteamForm((prev) => ({ ...prev, exeName: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
                </>
              ) : (
                <input type="text" placeholder="Path to game exe..." value={steamForm.exePath} onChange={(e) => setSteamForm((prev) => ({ ...prev, exePath: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              )}
              <button onClick={addSteamGame} className="bg-sky-700 hover:bg-sky-800 px-4 py-2 rounded-lg font-semibold">Add</button>
            </>
          )}
          renderRow={(game) => (
            <SortableGameRow key={game.id} game={game} isSteam onPlay={() => launchSteamGame(game)} onRemove={() => removeGame(game.id, setSteamGames)} />
          )}
        />
        {/* Local */}
        <PlatformSection
          title="Local"
          icon={localIcon}
          titleColor="text-gray-400"
          buttonColor="bg-gray-600 hover:bg-gray-700 cursor-default"
          games={localGames}
          setGames={setLocalGames}
          onLaunch={() => {}}
          launchLabel="Local Games"
          renderForm={() => (
            <>
              <input type="text" placeholder="Game name..." value={localForm.name} onChange={(e) => setLocalForm((prev) => ({ ...prev, name: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <input type="text" placeholder="Path to .exe..." value={localForm.exePath} onChange={(e) => setLocalForm((prev) => ({ ...prev, exePath: e.target.value }))} className="px-3 py-2 rounded-lg text-black" />
              <button onClick={addLocalGame} className="bg-gray-600 hover:bg-gray-700 px-4 py-2 rounded-lg font-semibold">Add</button>
            </>
          )}
          renderRow={(game) => (
            <SortableGameRow key={game.id} game={game} isLocal onPlay={() => launchLocalGame(game)} onRemove={() => removeGame(game.id, setLocalGames)} />
          )}
        />
      </div>
    </div>
  );
}
