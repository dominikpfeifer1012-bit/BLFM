// Kompakte Absicherung der Kernpfade. Ersetzt die im Container verlorenen
// Einzelsuiten und prueft, dass alle bisherigen Stufen zusammenspielen.
const fs = require("fs");
const { JSDOM } = require("jsdom");

const html = fs.readFileSync("/home/claude/bl/index.html", "utf8")
  .replace(/<script src="modules\/[a-z]+\.js"><\/script>\s*/g, "");
const dom = new JSDOM(html, { runScripts: "outside-only", pretendToBeVisual: true, url: "http://localhost/" });
const win = dom.window;

const errors = [];
win.addEventListener("error", e => errors.push(e.message));

// Modulliste aus dem HTML lesen, damit sie nie veraltet.
const mods = [...fs.readFileSync("/home/claude/bl/index.html","utf8")
  .matchAll(/modules\/([a-z-]+\.js)/g)].map(m => m[1]);
win.eval("try{ localStorage.clear(); }catch(e){}");
win.eval(mods.map(f => fs.readFileSync("/home/claude/bl/" + f, "utf8")).join("\n") + `
  window.K = {
    CLUBS, SECOND_DIVISION_CLUBS, POSITION_ORDER, ATTRIBUTES, FORMATIONS, TACTICS,
    TOTAL_MATCHDAYS, MIN_SQUAD_SIZE, MORALE_NEUTRAL, MORALE_UNHAPPY_THRESHOLD,
    YOUTH_TEAM_MAX_AGE, CUP_FIELD_SIZE, EUROPE_GROUP_MATCHDAYS, EURO_CLUBS,
    BOARD_CHECKPOINTS, POOL_PLAYERS_PER_CLUB, MATCH_MINUTES,
    get market(){ return market; }, get liveState(){ return liveState; }
  };`);

let fails = 0;
function check(label, fn){
  try {
    const r = fn();
    const ok = r === true || r === undefined;
    console.log(`${ok ? "OK  " : "FAIL"}  ${label}${ok ? "" : " -> " + r}`);
    if(!ok) fails++;
  } catch(e){
    console.log(`FAIL  ${label} -> ${e.message}`);
    console.log(e.stack.split("\n").slice(1, 4).map(l => "      " + l.trim()).join("\n"));
    fails++;
  }
}
const $ = id => win.document.getElementById(id);
const K = win.K;

function durchspielen(maxTermine){
  const gs = win.gameState;
  let n = 0;
  while(n++ < (maxTermine || 90) && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
}

// ---------------- Start ----------------
console.log("--- Karrierestart ---");
check("Karriere startet", () => {
  $("managerName").value = "Testtrainer";
  $("clubSelect").value = "VfB Stuttgart";
  win.startCareer();
  return $("game").style.display === "block";
});

const gs = win.gameState;
gs.liveMatches = false;

check("Alle Kernsysteme sind angelegt", () => {
  const fehlt = ["squad","pool","youth","board","cup","europe","teams","fixtures","lineup","formation","tactic","clubStature"]
    .filter(k => gs[k] == null);
  return fehlt.length === 0 ? true : "fehlt: " + fehlt.join(", ");
});

check("Spieler haben Attribute, Vertrag und Stimmung", () =>
  gs.squad.every(p => p.attributes && p.maxAttributes && p.contractYears > 0 && typeof p.morale === "number")
    ? true : "unvollständig");

check("Weltpool ist gefüllt", () => {
  const st = win.getPoolStats(gs.pool);
  return st.gesamt > 500 && st.gelistet > 40 ? true : `${st.gesamt}/${st.gelistet}`;
});

check("Pokalfeld umfasst 32 Vereine", () => gs.cup.teamsRemaining.length === K.CUP_FIELD_SIZE
  ? true : gs.cup.teamsRemaining.length);

// ---------------- Aufstellung ----------------
console.log("\n--- Aufstellung und Taktik ---");
check("Startelf ist vollständig", () => win.getStartingXIInfo(gs.squad, 1).xi.length === 11
  ? true : "nicht 11");

check("Alle Formationen ergeben elf Plätze", () => {
  const alt = gs.formation;
  for(const name of Object.keys(K.FORMATIONS)){
    gs.formation = name;
    if(win.getStartingXIInfo(gs.squad, 1).xi.length !== 11) return name + " unvollständig";
  }
  gs.formation = alt;
  return true;
});

check("Positionsmalus ist abgestuft und nie negativ", () => {
  const ideal = pos => ({ pos, attributes: win.buildAttributes(70, pos, 0), strength: 70, consecutiveStarts: 0, morale: K.MORALE_NEUTRAL });
  for(const a of K.POSITION_ORDER) for(const b of K.POSITION_ORDER){
    if(win.getPlayerSlotPenalty(ideal(a), b) < 0) return `${a}->${b} negativ`;
  }
  if(win.getPlayerSlotPenalty(ideal("LM"), "RM") > 2) return "LM->RM zu teuer";
  if(win.getPlayerSlotPenalty(ideal("IV"), "ST") < 12) return "IV->ST zu billig";
  return true;
});

check("Starker Umsteller verdrängt schwachen Positionsspieler", () => {
  const mk = (pos, s) => ({ id: pos + s + Math.random(), name: pos + "-" + s, pos, strength: s,
    baseStrength: s, maxStrength: s, age: 25, value: 1e6, morale: K.MORALE_NEUTRAL,
    attributes: win.buildAttributes(s, pos, 0), maxAttributes: win.buildAttributes(s, pos, 0),
    injuredUntilMatchday: 0, suspendedUntilMatchday: 0, consecutiveStarts: 0, goalsSeason: 0,
    yellowCards: 0, contractYears: 3 });
  const alt = gs.squad;
  gs.squad = [mk("TW",70),mk("RV",70),mk("IV",70),mk("IV",70),mk("LV",70),mk("DM",70),mk("DM",70),
    mk("RM",70),mk("OM",70),mk("ST",42),mk("LM",60),mk("LM",60)];
  win.clearLineup(gs);
  const st = win.getStartingXIInfo(gs.squad, 1).allSlots.find(s => s.slotKey === "ST0");
  const ergebnis = st.player.pos === "LM";
  gs.squad = alt;
  return ergebnis ? true : `ST0 = ${st.player.pos}`;
});

check("Manuelle Aufstellung hat Vorrang", () => {
  const iv = gs.squad.find(p => p.pos === "IV");
  win.assignLineupPlayer("ST0", iv.id);
  const gesetzt = win.getStartingXIInfo(gs.squad, 1).allSlots.find(s => s.slotKey === "ST0").player.id === iv.id;
  win.resetLineup();
  return gesetzt ? true : "Vorgabe ignoriert";
});

// ---------------- Transfers ----------------
console.log("\n--- Transfers ---");
check("Transferfenster wird durchgesetzt", () => {
  const vorher = gs.matchday;
  gs.matchday = 9;
  const kandidat = win.filterPool(gs.pool, {})[0];
  const zu = win.signPlayerFromPool(gs, kandidat.id).success;
  gs.matchday = vorher;   // exakt zuruecksetzen, sonst wird ein Spieltag uebersprungen
  return zu === false ? true : "Kauf trotz geschlossenem Fenster";
});

check("Verpflichtung entnimmt dem Bestand", () => {
  gs.budget = 100000000;
  const kandidat = win.filterPool(gs.pool, { maxFee: 15000000 })[0];
  const kader = gs.squad.length, bestand = gs.pool.players.length;
  win.handleSignPlayer(kandidat.id);
  return gs.squad.length === kader + 1 && gs.pool.players.length === bestand - 1
    ? true : "Bestand oder Kader stimmen nicht";
});

check("Verkauf gibt zurück in den Bestand", () => {
  const bestand = gs.pool.players.length;
  const kader = gs.squad.length;
  win.handleSellPlayer(gs.squad.length - 1);
  return gs.pool.players.length === bestand + 1 && gs.squad.length === kader - 1
    ? true : "Rückgabe fehlgeschlagen";
});

// ---------------- Saison ----------------
console.log("\n--- Saisonablauf ---");
// Erst bis zur Saisonmitte spielen: Tore und Formband werden am Saisonende
// bewusst zurueckgesetzt, muessen also vorher geprueft werden.
check("Halbe Saison läuft durch", () => {
  const ziel = 17;
  let n = 0;
  while(n++ < 60 && gs.matchday < ziel && !gs.seasonEnded){
    win.runNextEvent();
    if($("liveOverlay").classList.contains("show")){ win.skipLiveMatch(); win.closeLiveMatch(); }
  }
  return gs.matchday >= ziel ? true : `nur ${gs.matchday} Spieltage`;
});

check("Torschützen werden erfasst", () => gs.squad.some(p => p.goalsSeason > 0) ? true : "keine Tore");
check("Formband zeigt die gespielten Tage", () => {
  const gefaerbt = [...$("formBand").querySelectorAll(".formSeg")].filter(s => s.getAttribute("data-r")).length;
  return gefaerbt === gs.matchday ? true : `${gefaerbt} von ${gs.matchday}`;
});
check("Jugend hat parallel gespielt", () => gs.youth.played > 10 ? true : gs.youth.played);

check("Restliche Saison läuft durch", () => {
  durchspielen(90);
  return gs.matchday === K.TOTAL_MATCHDAYS ? true : `nur ${gs.matchday} Spieltage`;
});

check("Vorstand hat bewertet", () => gs.board.history.length >= 2 ? true : gs.board.history.length);

check("Saisonabschluss wird angeboten", () => /Nächste Saison/.test($("seasonSummaryHost").innerHTML)
  ? true : "kein Abschluss");

check("Weiterklicken nach Saisonende bricht nicht", () => {
  const eintraege = gs.seasonHistory.length;
  for(let i = 0; i < 4; i++) win.runNextEvent();
  return gs.seasonHistory.length === eintraege ? true : "Saison doppelt abgeschlossen";
});

check("Nächste Saison startet sauber", () => {
  win.startNextSeason();
  return gs.matchday === 0 && gs.youth.played === 0 && !gs.seasonEnded
    ? true : "Zustand nicht zurückgesetzt";
});

check("Kader bleibt über fünf Saisons spielfähig", () => {
  for(let s = 0; s < 5; s++){
    durchspielen(90);
    gs.board.patience = 90;
    win.startNextSeason();
    if(gs.squad.length < K.MIN_SQUAD_SIZE) return `Kader auf ${gs.squad.length}`;
    if(win.getStartingXIInfo(gs.squad, 1).xi.length !== 11) return "Startelf unvollständig";
  }
  return true;
});

check("Weltpool bleibt stabil", () => {
  const st = win.getPoolStats(gs.pool);
  return st.gesamt > 550 && st.gelistet > 40 ? true : `${st.gesamt}/${st.gelistet}`;
});

check("Stimmung bleibt in sinnvollem Bereich", () => {
  const m = win.getSquadMoraleAverage(gs.squad);
  return m > 35 && m < 95 ? true : m.toFixed(1);
});

// ---------------- Anzeige ----------------
console.log("\n--- Anzeige ---");
check("Alle sechs Tabs füllen sich", () => {
  for(const t of ["uebersicht","kader","transfers","wettbewerbe","statistik","verlauf"]){
    win.switchTab(t);
    if($("tab-" + t).textContent.trim().length < 30) return t + " leer";
  }
  return true;
});

// Regressionstest: der Transfermarkt war leer, wenn man den Tab direkt
// anklickte, weil ihn niemand gezeichnet hat.
check("Transfermarkt ist nach einem Tabwechsel gefüllt", () => {
  win.switchTab("uebersicht");
  $("marketList").innerHTML = "";
  win.switchTab("transfers");
  const inhalt = $("marketList").innerHTML;
  if(inhalt.length === 0) return "Markt blieb leer";
  return /Holen|Kein Spieler passt/.test(inhalt) ? true : "keine Angebotsliste";
});

check("Auch renderAll zeichnet den Markt", () => {
  $("marketList").innerHTML = "";
  win.renderAll(win.gameState);
  return $("marketList").innerHTML.length > 0 ? true : "Markt blieb leer";
});

check("Der Transfermarkt-Knopf führt zum Tab", () => {
  win.switchTab("uebersicht");
  win.openTransferMarket();
  return $("tab-transfers").classList.contains("active")
    && $("marketList").innerHTML.length > 0 ? true : "Knopf wirkungslos";
});

check("Spielerprofil zeigt Attribute, Vertrag und Stimmung", () => {
  win.showPlayerDetail(gs.squad[0].id);
  const t = $("playerModalContent").textContent;
  win.closePlayerModal();
  return /Attribute/.test(t) && /Vertrag/.test(t) && /Stimmung/.test(t) ? true : "unvollständig";
});

check("Keine Laufzeitfehler", () => errors.length === 0 ? true : errors.join(" | "));

console.log(fails === 0 ? "\nAlle Tests bestanden." : `\n${fails} Test(s) fehlgeschlagen.`);
process.exit(fails === 0 ? 0 : 1);
