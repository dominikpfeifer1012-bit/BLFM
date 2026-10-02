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

// ---------- Kompression ----------
// Mit fuenf Laendern ist ein Spielstand rund 2 MB JSON. Der lokale Speicher
// des Browsers fasst etwa 5 MB — Autosave plus zwei Plaetze passten nicht.
// LZW mit gemeinsamem Alphabet; die Bits werden in 15er-Gruppen als Zeichen
// 32..32799 abgelegt (keine Surrogate, also sicher im localStorage).
const SAVE_COMPRESSED_MARK = "LZW1:";

function bitLength(x){ return x <= 1 ? 1 : 32 - Math.clz32(x); }

function compressSaveString(text){
  const out = [];
  let buf = 0, bufBits = 0;
  const write = (wert, bits) => {
    while(bits > 0){
      const teil = Math.min(bits, 15 - bufBits);
      buf |= (wert & ((1 << teil) - 1)) << bufBits;
      wert >>>= teil; bits -= teil; bufBits += teil;
      if(bufBits === 15){ out.push(String.fromCharCode(buf + 32)); buf = 0; bufBits = 0; }
    }
  };
  // Woerterbuch als Zahl -> Zahl: (Praefix-Code, Zeichen) -> Code. Deutlich
  // schneller als wachsende Zeichenketten als Schluessel.
  const alphabet = [];
  const alphaIdx = new Map();
  for(let i = 0; i < text.length; i++){
    const cc = text.charCodeAt(i);
    if(!alphaIdx.has(cc)){ alphaIdx.set(cc, alphabet.length); alphabet.push(text[i]); }
  }
  const dict = new Map();
  let groesse = alphabet.length;
  const codes = [];
  let w = text.length ? alphaIdx.get(text.charCodeAt(0)) : -1;
  for(let i = 1; i < text.length; i++){
    const cc = text.charCodeAt(i);
    const key = w * 65536 + cc;
    const vorhanden = dict.get(key);
    if(vorhanden !== undefined){ w = vorhanden; continue; }
    codes.push(w, groesse);
    dict.set(key, groesse++);
    w = alphaIdx.get(cc);
  }
  if(w >= 0) codes.push(w, groesse);
  const anzahl = codes.length / 2;
  write(anzahl & 0xFFFF, 16); write(anzahl >>> 16, 16);
  write(alphabet.length, 16);
  alphabet.forEach(c => write(c.charCodeAt(0), 16));
  for(let i = 0; i < codes.length; i += 2) write(codes[i], bitLength(codes[i + 1]));
  if(bufBits > 0) out.push(String.fromCharCode(buf + 32));
  return SAVE_COMPRESSED_MARK + out.join("");
}

function decompressSaveString(text){
  const daten = text.slice(SAVE_COMPRESSED_MARK.length);
  let pos = 0, bit = 0;
  const read = bits => {
    let wert = 0, schon = 0;
    while(bits > 0){
      const teil = Math.min(bits, 15 - bit);
      const einheit = daten.charCodeAt(pos) - 32;
      wert |= ((einheit >>> bit) & ((1 << teil) - 1)) << schon;
      schon += teil; bits -= teil; bit += teil;
      if(bit === 15){ bit = 0; pos++; }
    }
    return wert >>> 0;
  };
  const anzahl = read(16) + read(16) * 65536;
  const n = read(16);
  const eintraege = [];
  for(let i = 0; i < n; i++) eintraege.push(String.fromCharCode(read(16)));
  if(anzahl === 0) return "";
  let vorher = eintraege[read(bitLength(n))];
  const teile = [vorher];
  for(let k = 1; k < anzahl; k++){
    const code = read(bitLength(eintraege.length + 1));
    const eintrag = code < eintraege.length ? eintraege[code] : vorher + vorher[0];
    teile.push(eintrag);
    eintraege.push(vorher + eintrag[0]);
    vorher = eintrag;
  }
  return teile.join("");
}

function encodeSave(payload){
  return compressSaveString(JSON.stringify(payload));
}

function decodeSave(roh){
  if(roh == null) return null;
  return JSON.parse(roh.startsWith(SAVE_COMPRESSED_MARK) ? decompressSaveString(roh) : roh);
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
  const daten = encodeSave(buildSavePayload(gameState));
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
    localStorage.setItem(slotKey(AUTOSAVE_SLOT), encodeSave(buildSavePayload(gameState)));
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
    return decodeSave(roh);
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

    const neu = encodeSave({
      version: 1, savedAt: null, manager: state.manager,
      matchday: state.matchday,
      label: `${state.clubName} · Saison ${state.season}/${(state.season + 1) % 100}`,
      state: state
    });
    // Erst den alten Eintrag freigeben, sonst reicht der Speicher nicht.
    localStorage.removeItem(SAVE_LEGACY_KEY);
    try { localStorage.setItem(slotKey(1), neu); }
    catch(e){ localStorage.setItem(SAVE_LEGACY_KEY, roh); throw e; }
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
