// ============================================
// CUSTOM-DATA.JS - Eigene Kaderdatei (echte Spieler und Trainer)
// ============================================
// Echte Namen werden nicht mit dem Spiel ausgeliefert: Spielernamen sind
// Persoenlichkeitsrechte, und das Spiel liegt oeffentlich im Netz. Stattdessen
// laedt jeder seine eigene Kaderdatei. Sie bleibt im Browser auf dem
// eigenen Geraet und wird bei jeder neuen Karriere verwendet.
//
// Format (JSON):
// { "version": 1,
//   "clubs": {
//     "FC Bayern München": {
//       "coach": "Name",            // optional
//       "strength": 92,             // optional, ersetzt die Vereinsstaerke
//       "players": [ { "name": "...", "pos": "ST", "age": 27, "strength": 90, "nat": "DE" } ]
//     } } }

const CUSTOM_DATA_KEY = "bl_custom_data";
let customDataCache;

function getCustomData(){
  if(customDataCache !== undefined) return customDataCache;
  try {
    const roh = localStorage.getItem(CUSTOM_DATA_KEY);
    customDataCache = roh ? JSON.parse(roh) : null;
  } catch(e) {
    customDataCache = null;
  }
  return customDataCache;
}

function getCustomClub(name){
  const d = getCustomData();
  return d && d.clubs && d.clubs[name] ? d.clubs[name] : null;
}

function getCustomCoach(name){
  const c = getCustomClub(name);
  return c && typeof c.coach === "string" && c.coach.trim() ? c.coach.trim() : null;
}

// Prueft und bereinigt eine geladene Datei. Unbekannte Vereine werden
// gemeldet, aber nicht abgelehnt.
function validateCustomData(daten){
  if(!daten || typeof daten !== "object" || !daten.clubs || typeof daten.clubs !== "object"){
    return { ok: false, message: "Die Datei hat kein Feld \"clubs\"." };
  }
  const bekannt = new Set(DIVISIONS.flatMap(d => d.clubs.map(c => c.name)));
  const unbekannt = [];
  let spieler = 0, vereine = 0, fehler = 0;
  Object.entries(daten.clubs).forEach(([name, club]) => {
    if(!bekannt.has(name)){ unbekannt.push(name); return; }
    vereine++;
    club.players = (Array.isArray(club.players) ? club.players : []).filter(p => {
      const gueltig = p && typeof p.name === "string" && POSITION_ORDER.includes(p.pos)
        && Number(p.strength) >= 30 && Number(p.strength) <= 99 && Number(p.age) >= 15 && Number(p.age) <= 45;
      if(!gueltig) fehler++;
      return gueltig;
    });
    spieler += club.players.length;
  });
  if(vereine === 0) return { ok: false, message: "Kein Verein aus der Datei passt zu den Vereinen im Spiel." };
  return { ok: true, vereine, spieler, fehler, unbekannt,
    message: `${vereine} Vereine, ${spieler} Spieler geladen` + (fehler ? `, ${fehler} ungültige Einträge übersprungen` : "")
      + (unbekannt.length ? `. Unbekannt: ${unbekannt.slice(0, 3).join(", ")}${unbekannt.length > 3 ? " …" : ""}` : "") + "." };
}

function saveCustomData(daten){
  try {
    localStorage.setItem(CUSTOM_DATA_KEY, JSON.stringify(daten));
    customDataCache = daten;
    return true;
  } catch(e) {
    customDataCache = daten;   // wenigstens fuer diese Sitzung
    return false;
  }
}

function clearCustomData(){
  try { localStorage.removeItem(CUSTOM_DATA_KEY); } catch(e) {}
  customDataCache = null;
}

// Ein Spieler aus der Datei: Name, Alter, Nation und Staerke wie angegeben,
// Attribute und Potenzial werden passend zur Position erzeugt.
function customToPlayer(e){
  const staerke = Math.round(Number(e.strength));
  const alter = Math.round(Number(e.age));
  const p = genPlayer(staerke, e.pos, [alter, alter], false);
  const gewinn = Math.max(DEV_POTENTIAL_GAIN_MIN, Math.min(DEV_POTENTIAL_GAIN_MAX,
    Math.round(calculateMaxPotentialGain(staerke) * getPotentialAgeFactor(alter))));
  p.attributes = buildAttributes(staerke, e.pos, ATTRIBUTE_SPREAD);
  const roh = {};
  ATTRIBUTES.forEach(a => { roh[a] = p.attributes[a] + gewinn; });
  p.maxAttributes = normalizeAttributes(roh, Math.min(99, staerke + gewinn), e.pos);
  p.age = alter;
  if(typeof releasePlayerName === "function") releasePlayerName(p.name);
  p.name = e.name.trim();
  if(typeof usedPlayerNames !== "undefined") usedPlayerNames.add(p.name);
  const code = e.nat ? String(e.nat).toUpperCase().trim() : "";
  if(/^[A-Z]{2}$/.test(code)) p.nat = code;
  p.isScoutingFind = false;
  finalizePlayer(p);
  ensureMorale(p);
  return p;
}

// Kader auf Mindestgroesse bringen: fehlende Positionen mit erzeugten
// Spielern auf Vereinsniveau auffuellen.
function fillSquadToComposition(squad, strength){
  SQUAD_COMPOSITION.forEach(entry => {
    let vorhanden = squad.filter(p => p.pos === entry.pos).length;
    while(vorhanden < entry.count && squad.length < 26){
      const p = genPlayer(strength, entry.pos, null, false);
      ensureMorale(p);
      squad.push(p);
      vorhanden++;
    }
  });
  return squad;
}

// Bei Karrierestart: Vereinsstaerken, eigener Kader und Bestaende der
// anderen Vereine aus der Datei uebernehmen.
function applyCustomData(gameState){
  const d = getCustomData();
  if(!d || !d.clubs) return false;
  // Vereinsstaerken
  (gameState.leaguePools || []).forEach(pool => pool.forEach(c => {
    const cc = d.clubs[c.name];
    if(cc && Number(cc.strength) >= 30 && Number(cc.strength) <= 99){ c.strength = Number(cc.strength); c.baseStrength = c.strength; }
  }));
  (gameState.teams || []).forEach(t => { const cc = d.clubs[t.name]; if(cc && Number(cc.strength)) t.strength = Number(cc.strength); });

  // Eigener Kader
  const eigen = d.clubs[gameState.clubName];
  if(eigen && eigen.players && eigen.players.length){
    const staerke = getOwnClubStrength(gameState);
    gameState.squad = fillSquadToComposition(eigen.players.map(customToPlayer), staerke);
    gameState.squad.forEach(p => { p.contractYears = p.contractYears || randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS); });
  }

  // Bestaende der anderen Vereine
  if(gameState.pool){
    Object.entries(d.clubs).forEach(([name, club]) => {
      if(name === gameState.clubName || !club.players || club.players.length === 0) return;
      const tier = (buildPoolClubList(gameState).find(c => c.name === name) || {}).tier;
      if(!tier) return;
      gameState.pool.players = gameState.pool.players.filter(p => p.clubName !== name);
      club.players.forEach(e => {
        const p = customToPlayer(e);
        p.clubName = name; p.clubTier = tier;
        gameState.pool.players.push(p);
      });
    });
    drawTransferList(gameState.pool);
  }
  if(gameState.coaches){
    Object.keys(gameState.coaches).forEach(name => { const echt = getCustomCoach(name); if(echt) gameState.coaches[name].name = echt; });
  }
  return true;
}

// Beim Vereinswechsel: vorhandene Spieler des neuen Vereins aus dem Bestand
// uebernehmen, sofern die Kaderdatei diesen Verein enthaelt.
function takeCustomRosterOnJobChange(gameState, clubName, strength){
  const club = getCustomClub(clubName);
  if(!club || !club.players || club.players.length === 0 || !gameState.pool) return null;
  const roster = gameState.pool.players.filter(p => p.clubName === clubName);
  if(roster.length === 0) return null;
  gameState.pool.players = gameState.pool.players.filter(p => p.clubName !== clubName);
  roster.forEach(p => { delete p.clubName; delete p.clubTier; delete p.transferListed;
    p.contractYears = p.contractYears || randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS); });
  return fillSquadToComposition(roster, strength);
}

// Vorlage mit allen Vereinen zum Ausfuellen.
function buildCustomTemplate(){
  const clubs = {};
  DIVISIONS.forEach(div => div.clubs.forEach(c => {
    const vorhanden = getCustomClub(c.name);
    clubs[c.name] = vorhanden || { coach: "", strength: c.strength, players: [] };
  }));
  const beispiel = clubs[DIVISIONS[0].clubs[0].name];
  if(beispiel.players.length === 0){
    beispiel.players = [{ name: "Vorname Nachname", pos: "TW", age: 30, strength: 88, nat: "DE" }];
  }
  return { version: 1,
    hinweis: "Positionen: " + POSITION_ORDER.join(", ") + ". Stärke 30–99, Alter 15–45, nat = Ländercode wie DE, FR, BR. Vereine ohne Spieler behalten erfundene Kader.",
    clubs };
}

// ---------- Oberflaeche im Startbildschirm ----------

function renderCustomDataStatus(){
  const el = document.getElementById("customDataStatus");
  if(!el) return;
  const d = getCustomData();
  if(!d){ el.textContent = "Keine eigene Kaderdatei geladen — es spielen erfundene Spieler."; return; }
  const v = validateCustomData(JSON.parse(JSON.stringify(d)));
  el.textContent = v.ok ? `Eigene Kaderdatei aktiv: ${v.vereine} Vereine, ${v.spieler} Spieler.` : "Die gespeicherte Kaderdatei ist ungültig.";
}

function handleCustomDataFile(input){
  const datei = input && input.files && input.files[0];
  if(!datei) return;
  const leser = new FileReader();
  leser.onload = () => {
    let daten;
    try { daten = JSON.parse(String(leser.result)); }
    catch(e){ showToast("Die Datei ist kein gültiges JSON.", "error"); return; }
    const v = validateCustomData(daten);
    if(!v.ok){ showToast(v.message, "error"); return; }
    const gespeichert = saveCustomData(daten);
    showToast(v.message + (gespeichert ? "" : " (nur für diese Sitzung — der Browser blockiert den Speicher)"), "success");
    renderCustomDataStatus();
  };
  leser.readAsText(datei);
  input.value = "";
}

function handleCustomTemplateDownload(){
  const blob = new Blob([JSON.stringify(buildCustomTemplate(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "kaderdatei-vorlage.json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function handleCustomDataClear(){
  clearCustomData();
  showToast("Eigene Kaderdatei entfernt.", "info");
  renderCustomDataStatus();
}

if(typeof document !== "undefined") document.addEventListener("DOMContentLoaded", renderCustomDataStatus);
