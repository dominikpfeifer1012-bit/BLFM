// ============================================
// SAVE.JS - Spielstaende verwalten
// ============================================
// Mehrere benannte Plaetze plus Export und Import als Datei. Jeder Stand
// traegt eine Versionsnummer, damit spaetere Aenderungen am Datenmodell
// gezielt nachgezogen werden koennen statt ueber Rateheuristiken.

const SAVE_VERSION = 2;
const SAVE_PREFIX = "bl_career_";
const SAVE_SLOTS = 3;
const SAVE_LEGACY_KEY = "bl_career";

// Eigener Platz fuer das automatische Speichern. So ueberschreibt das Spiel
// nie einen Platz, den der Spieler selbst belegt hat.
const AUTOSAVE_SLOT = "auto";

function slotKey(slot){
  return SAVE_PREFIX + slot;
}

function buildSavePayload(gameState){
  return {
    version: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    label: `${gameState.clubName} · Saison ${gameState.season}/${(gameState.season + 1) % 100}`,
    matchday: gameState.matchday,
    manager: gameState.manager,
    state: gameState
  };
}

function saveGameState(gameState, slot){
  const nummer = slot != null ? slot : 1;
  const daten = JSON.stringify(buildSavePayload(gameState));
  try {
    try {
      localStorage.setItem(slotKey(nummer), daten);
    } catch(voll) {
      // Speicher voll: der automatische Stand darf ein bewusstes Speichern
      // nie verhindern. Er wird beim naechsten Spieltag neu angelegt.
      if(nummer === AUTOSAVE_SLOT || !localStorage.getItem(slotKey(AUTOSAVE_SLOT))) throw voll;
      localStorage.removeItem(slotKey(AUTOSAVE_SLOT));
      localStorage.setItem(slotKey(nummer), daten);
    }
    return { success: true, message: `Spielstand auf Platz ${nummer} gespeichert.` };
  } catch(e) {
    console.error("saveGameState:", e);
    return {
      success: false,
      message: "Speichern nicht möglich (der Browser blockiert den lokalen Speicher beim direkten Öffnen der Datei). Tipp: über einen lokalen Server öffnen oder den Export nutzen."
    };
  }
}

function autoSaveGameState(gameState){
  if(!gameState || !gameState.clubName) return false;
  try {
    localStorage.setItem(slotKey(AUTOSAVE_SLOT), JSON.stringify(buildSavePayload(gameState)));
    return true;
  } catch(e) {
    return false;   // Speicher blockiert: still bleiben, der Export funktioniert trotzdem
  }
}

function readAutoSaveInfo(){
  const daten = readSlot(AUTOSAVE_SLOT);
  if(!daten) return null;
  return { slot: AUTOSAVE_SLOT, belegt: true, label: daten.label || "Spielstand",
    manager: daten.manager, matchday: daten.matchday, savedAt: daten.savedAt, version: daten.version };
}

function readSlot(slot){
  try {
    const roh = localStorage.getItem(slotKey(slot));
    if(!roh) return null;
    return JSON.parse(roh);
  } catch(e) {
    console.warn("readSlot:", e);
    return null;
  }
}

// Uebersicht fuer die Auswahl: belegte und freie Plaetze.
function listSaveSlots(){
  const plaetze = [];
  for(let i = 1; i <= SAVE_SLOTS; i++){
    const daten = readSlot(i);
    plaetze.push({
      slot: i,
      belegt: !!daten,
      label: daten ? (daten.label || "Spielstand") : null,
      manager: daten ? daten.manager : null,
      matchday: daten ? daten.matchday : null,
      savedAt: daten ? daten.savedAt : null,
      version: daten ? daten.version : null
    });
  }
  return plaetze;
}

function loadGameState(slot){
  const daten = readSlot(slot != null ? slot : 1);
  if(!daten) return { found: false };
  const state = migrateSave(daten);
  return state ? { found: true, state: state } : { found: false };
}

function deleteSlot(slot){
  try { localStorage.removeItem(slotKey(slot)); return true; }
  catch(e) { return false; }
}

// Alte Einzelspeicherung uebernehmen, damit bisherige Staende nicht verloren gehen.
function migrateLegacySave(){
  try {
    const roh = localStorage.getItem(SAVE_LEGACY_KEY);
    if(!roh) return false;
    if(localStorage.getItem(slotKey(1))) return false;

    const daten = JSON.parse(roh);
    const state = daten.state || daten;
    if(!state || !state.clubName) return false;

    localStorage.setItem(slotKey(1), JSON.stringify({
      version: 1, savedAt: null, manager: state.manager,
      matchday: state.matchday,
      label: `${state.clubName} · Saison ${state.season}/${(state.season + 1) % 100}`,
      state: state
    }));
    localStorage.removeItem(SAVE_LEGACY_KEY);
    return true;
  } catch(e) {
    return false;
  }
}

// ---------- Versionierte Migration ----------
// Jede Funktion hebt einen Stand um genau eine Version an. Neue Aenderungen
// am Datenmodell bekommen kuenftig einen eigenen Schritt.
const SAVE_MIGRATIONS = {
  // Version 1 kannte weder Versionsfeld noch benannte Plaetze. Die
  // Feldergaenzungen selbst passieren beim Laden in confirmLoadGame.
  1: function(state){ return state; }
};

function migrateSave(daten){
  let state = daten.state || daten;
  let version = daten.version || 1;

  while(version < SAVE_VERSION){
    const schritt = SAVE_MIGRATIONS[version];
    if(!schritt){
      console.warn("Keine Migration für Version", version);
      break;
    }
    state = schritt(state);
    version++;
  }
  return state;
}

// ---------- Export und Import ----------

function exportGameState(gameState){
  try {
    const inhalt = JSON.stringify(buildSavePayload(gameState), null, 2);
    const blob = new Blob([inhalt], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const name = `${gameState.clubName.replace(/[^a-zA-Z0-9]/g, "_")}_${gameState.season}.json`;

    const a = document.createElement("a");
    a.href = url; a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return { success: true, message: `Spielstand als ${name} exportiert.` };
  } catch(e) {
    console.error("exportGameState:", e);
    return { success: false, message: "Export fehlgeschlagen." };
  }
}

function parseImportedSave(text){
  try {
    const daten = JSON.parse(text);
    const state = migrateSave(daten);
    if(!state || !state.clubName || !Array.isArray(state.squad)){
      return { success: false, message: "Die Datei enthält keinen gültigen Spielstand." };
    }
    return { success: true, state: state };
  } catch(e) {
    return { success: false, message: "Die Datei konnte nicht gelesen werden." };
  }
}

function clearSavedGame(slot){
  if(slot != null) return deleteSlot(slot);
  let ok = true;
  for(let i = 1; i <= SAVE_SLOTS; i++){ if(!deleteSlot(i)) ok = false; }
  try { localStorage.removeItem(SAVE_LEGACY_KEY); } catch(e) { ok = false; }
  return ok;
}
