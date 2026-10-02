// ============================================
// SQUAD.JS - Kaderverwaltung, Startelf, Teambewertung
// ============================================

// Semantik: injuredUntilMatchday / suspendedUntilMatchday bezeichnen den
// LETZTEN Spieltag, der noch verpasst wird (einschliesslich).
// Rueckkehr erfolgt also an Spieltag until + 1.
function isInjured(player, currentMatchday1Based){
  const until = player.injuredUntilMatchday || 0;
  return until > 0 && currentMatchday1Based <= until;
}

function isSuspended(player, currentMatchday1Based){
  const until = player.suspendedUntilMatchday || 0;
  return until > 0 && currentMatchday1Based <= until;
}

function isUnavailable(player, currentMatchday1Based){
  return isInjured(player, currentMatchday1Based) || isSuspended(player, currentMatchday1Based);
}

function getFatiguePenalty(player){
  const starts = player.consecutiveStarts || 0;
  if(starts <= FATIGUE_THRESHOLD_MATCHES) return 0;
  const over = starts - FATIGUE_THRESHOLD_MATCHES;
  const training = typeof getActiveTraining === "function" ? getActiveTraining().fatigue : 1;
  return Math.min(FATIGUE_MAX_PENALTY, over * FATIGUE_PENALTY_PER_EXTRA_MATCH * training);
}

// --- Aufstellung ----------------------------------------------------
// Die elf Startelf-Plaetze bekommen stabile Schluessel: TW0, RV0, IV0,
// IV1, LV0, ZM0, ZM1, LM0, RM0, OM0, ST0.
function getActiveFormationName(){
  if(typeof gameState === "undefined" || !gameState) return DEFAULT_FORMATION;
  return FORMATIONS[gameState.formation] ? gameState.formation : DEFAULT_FORMATION;
}

function getActiveFormation(){
  return FORMATIONS[getActiveFormationName()];
}

function getFormationNeeds(){
  return getActiveFormation().needs;
}

function getLineupSlotDefs(){
  const needs = getFormationNeeds();
  const defs = [];
  POSITION_ORDER.forEach(pos => {
    const need = needs[pos] || 0;
    for(let i = 0; i < need; i++){
      defs.push({ slotKey: pos + i, slotPos: pos });
    }
  });
  return defs;
}

// Leeres Objekt = alles automatisch. Ein Eintrag pro manuell gesetztem Platz.
function getActiveLineup(){
  if(typeof gameState === "undefined" || !gameState) return {};
  return gameState.lineup || {};
}

// Abstufung statt Alles-oder-nichts: der Malus waechst mit dem Weg, den ein
// Spieler von seiner Position aus zuruecklegen muss.
function getPositionPenalty(playerPos, slotPos){
  if(playerPos === slotPos) return 0;

  const a = POSITION_LAYOUT[playerPos];
  const b = POSITION_LAYOUT[slotPos];
  if(!a || !b) return POSITION_MAX_PENALTY;
  if(a.keeper || b.keeper) return POSITION_KEEPER_PENALTY;

  let penalty = Math.abs(a.line - b.line) * POSITION_LINE_PENALTY;
  if(a.side !== b.side){
    penalty += (a.side === "C" || b.side === "C")
      ? POSITION_FLANK_PENALTY
      : POSITION_MIRROR_PENALTY;
  }
  return Math.min(POSITION_MAX_PENALTY, Math.round(penalty * 10) / 10);
}

// Was ein Spieler auf einem fremden Platz wert ist. Setzt sich zusammen aus
// dem gedaempften Attributverlust und einem gedaempften Eingewoehnungsanteil.
function getSlotRating(player, slotPos){
  const overall = player.attributes ? getOverallRating(player) : (player.strength || 0);
  if(player.pos === slotPos) return overall;

  const layout = POSITION_LAYOUT[player.pos], target = POSITION_LAYOUT[slotPos];
  // Die Torwartgrenze bleibt eine harte Regel: Feldspieler halten nicht, und
  // Torhueter gehoeren nicht ins Feld. Ueber Attribute allein waere ein
  // Innenverteidiger im Tor sogar besser bewertet als auf seiner Position.
  if(!layout || !target || layout.keeper || target.keeper){
    return Math.max(ATTRIBUTE_MIN, overall - POSITION_KEEPER_PENALTY);
  }

  // Nie besser als auf der eigenen Position.
  const attrRating = player.attributes
    ? Math.min(getAttributeRating(player, slotPos), overall)
    : overall;
  const attrLoss = (overall - attrRating) * ATTRIBUTE_LOSS_FACTOR;
  const familiarity = getPositionPenalty(player.pos, slotPos) * FAMILIARITY_FACTOR;

  return Math.max(ATTRIBUTE_MIN, overall - attrLoss - familiarity);
}

// Gesamtabzug fuer die Anzeige: Differenz zwischen eigener Position und Platz.
function getPlayerSlotPenalty(player, slotPos){
  if(player.pos === slotPos) return 0;
  const overall = player.attributes ? getOverallRating(player) : (player.strength || 0);
  return Math.round((overall - getSlotRating(player, slotPos)) * 10) / 10;
}

// Was der Spieler auf genau diesem Platz wirklich bringt: Positionsbewertung
// abzueglich Ermuedung, zuzueglich Moralwirkung. Bei neutraler Moral ist der
// letzte Anteil exakt null.
function getStrengthOnSlot(player, slotPos){
  const moral = typeof getMoraleStrengthEffect === "function" ? getMoraleStrengthEffect(player) : 0;
  return Math.max(30, getSlotRating(player, slotPos) - getFatiguePenalty(player) + moral);
}

function setLineupSlot(gameState, slotKey, playerId){
  gameState.lineup = gameState.lineup || {};
  // Ein Spieler kann nur auf einem Platz stehen.
  Object.keys(gameState.lineup).forEach(key => {
    if(gameState.lineup[key] === playerId) delete gameState.lineup[key];
  });
  if(playerId) gameState.lineup[slotKey] = playerId;
  else delete gameState.lineup[slotKey];
}

function clearLineup(gameState){
  gameState.lineup = {};
}

// Verkaufte Spieler aus der Aufstellung entfernen.
function pruneLineup(gameState){
  if(!gameState || !gameState.lineup) return;
  const ids = new Set((gameState.squad || []).map(p => p.id));
  Object.keys(gameState.lineup).forEach(key => {
    if(!ids.has(gameState.lineup[key])) delete gameState.lineup[key];
  });
}

function countManualSlots(gameState){
  return gameState && gameState.lineup ? Object.keys(gameState.lineup).length : 0;
}

function getEffectiveStrength(player){
  const moral = typeof getMoraleStrengthEffect === "function" ? getMoraleStrengthEffect(player) : 0;
  return Math.max(30, player.strength - getFatiguePenalty(player) + moral);
}

function healAllInjuries(squad){
  squad.forEach(player => {
    player.injuredUntilMatchday = 0;
  });
}

function resetSeasonalPlayerState(squad){
  squad.forEach(player => {
    player.goalsSeason = 0;
    player.gradeSum = 0;
    player.gradeCount = 0;
    player.motmCount = 0;
    player.yellowCards = 0;
    player.suspendedUntilMatchday = 0;
    player.consecutiveStarts = 0;
  });
}

// Ungarische Methode: ordnet jeder Zeile (Platz) hoechstens eine Spalte
// (Spieler) zu, sodass die Summe von value maximal wird. Bei weniger Spielern
// als Plaetzen bleiben Plaetze leer (null). Bei 11 Plaetzen und gut 25
// Spielern ist das in Sekundenbruchteilen erledigt.
function solveBestAssignment(rows, cols, value){
  const n = rows.length;
  if(n === 0) return [];
  // Platzhalter-Spalten, falls zu wenig Spieler da sind: Wert 0, also nur
  // genommen, wenn nichts anderes uebrig ist.
  const m = Math.max(cols.length, n);
  const cost = rows.map(r => {
    const zeile = new Array(m);
    for(let j = 0; j < m; j++) zeile[j] = j < cols.length ? -value(cols[j], r) : 0;
    return zeile;
  });

  const u = new Array(n + 1).fill(0), v = new Array(m + 1).fill(0);
  const p = new Array(m + 1).fill(0), way = new Array(m + 1).fill(0);
  for(let i = 1; i <= n; i++){
    p[0] = i;
    let j0 = 0;
    const minv = new Array(m + 1).fill(Infinity);
    const used = new Array(m + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = Infinity, j1 = 0;
      for(let j = 1; j <= m; j++){
        if(used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if(cur < minv[j]){ minv[j] = cur; way[j] = j0; }
        if(minv[j] < delta){ delta = minv[j]; j1 = j; }
      }
      for(let j = 0; j <= m; j++){
        if(used[j]){ u[p[j]] += delta; v[j] -= delta; }
        else minv[j] -= delta;
      }
      j0 = j1;
    } while(p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while(j0);
  }

  const ergebnis = new Array(n).fill(null);
  for(let j = 1; j <= m; j++){
    if(p[j] && j - 1 < cols.length) ergebnis[p[j] - 1] = j - 1;
  }
  return ergebnis;
}

function getStartingXIInfo(squad, currentMatchday1Based){
  currentMatchday1Based = currentMatchday1Based || 1;
  const lineup = getActiveLineup();
  const usedIds = new Set();
  const droppedManual = [];

  const slots = getLineupSlotDefs().map(def => ({
    slotKey: def.slotKey,
    slotPos: def.slotPos,
    player: null,
    isEmergency: false,
    isManual: false,
    penalty: 0
  }));

  // Rotation: muede Stammspieler (viele Einsaetze in Folge) bekommen einen
  // Abschlag und machen Platz, wenn ein Ersatz kaum schwaecher ist — auch
  // auf manuell gesetzten Positionen.
  const rotation = typeof gameState !== "undefined" && gameState && gameState.autoRotate;
  const muede = p => rotation && (p.consecutiveStarts || 0) >= ROTATION_START_LIMIT;

  // Phase 1: manuelle Vorgaben. Wer nicht spielen kann, faellt hier raus
  // und der Platz wird weiter unten automatisch nachbesetzt.
  slots.forEach(slot => {
    const wantedId = lineup[slot.slotKey];
    if(!wantedId) return;

    const player = squad.find(p => p.id === wantedId);
    if(!player || usedIds.has(player.id)) return;
    if(muede(player)) return;

    if(isUnavailable(player, currentMatchday1Based)){
      droppedManual.push({ slotKey: slot.slotKey, slotPos: slot.slotPos, name: player.name });
      return;
    }

    const penalty = getPlayerSlotPenalty(player, slot.slotPos);
    slot.player = player;
    slot.isManual = true;
    slot.isEmergency = penalty > 0;
    slot.penalty = penalty;
    usedIds.add(player.id);
  });

  // Phase 2: alle freien Plaetze gemeinsam besetzen. Bewertet wird jede
  // Kombination aus Platz und Spieler mit dem Wert, den der Spieler DORT
  // haette — Positionsmalus und Ermuedung eingerechnet.
  //
  // Vergeben wird die Zuordnung mit der hoechsten Summe fuer die ganze Elf,
  // nicht Paar fuer Paar. Die fruehere Paar-fuer-Paar-Vergabe konnte einen
  // Spieler auf einen fremden Platz ziehen, nur weil er dort minimal besser
  // war, und dafuer die eigene Position schwaecher besetzen. Ein starker
  // Umsteller verdraengt weiterhin einen deutlich schwaecheren
  // Positionsspieler; bei knappen Unterschieden behaelt der gelernte Spieler
  // dank AUTO_LINEUP_NATURAL_BONUS seinen Platz.
  const openSlots = slots.filter(s => !s.player);
  if(openSlots.length > 0){
    const available = squad.filter(p =>
      !usedIds.has(p.id) && !isUnavailable(p, currentMatchday1Based));

    const value = (player, slot) => getStrengthOnSlot(player, slot.slotPos)
      + (player.pos === slot.slotPos ? AUTO_LINEUP_NATURAL_BONUS : 0)
      - (muede(player) ? ROTATION_MAX_GAP : 0);
    const zuordnung = solveBestAssignment(openSlots, available, value);

    openSlots.forEach((slot, i) => {
      const player = zuordnung[i] != null ? available[zuordnung[i]] : null;
      if(!player) return;
      const penalty = getPlayerSlotPenalty(player, slot.slotPos);
      slot.player = player;
      slot.isEmergency = penalty > 0;
      slot.penalty = penalty;
      usedIds.add(player.id);
    });
  }

  const filledSlots = slots.filter(s => s.player !== null);
  const xi = filledSlots.map(s => s.player);

  const emergencyPenalties = new Map();
  filledSlots.forEach(s => {
    if(s.isEmergency){
      emergencyPenalties.set(s.player.id, {
        penalty: s.penalty,
        playedAs: s.slotPos,
        isManual: s.isManual
      });
    }
  });

  const manualIds = new Set(filledSlots.filter(s => s.isManual).map(s => s.player.id));

  return { slots: filledSlots, allSlots: slots, xi, emergencyPenalties, manualIds, droppedManual };
}

function getStartingXI(squad, currentMatchday1Based){
  return getStartingXIInfo(squad, currentMatchday1Based).xi;
}

function getStartingXIIds(squad, currentMatchday1Based){
  return new Set(getStartingXI(squad, currentMatchday1Based).map(p => p.id));
}

// Spieltagskader: 11 in der Startelf, danach die besten 7 auf der Bank.
// Alles darueber ist Reserve — kostet Gehalt, zaehlt aber nicht zur
// Teambewertung, solange niemand auf die Bank nachrueckt.
function classifySquad(squad, currentMatchday1Based, info){
  info = info || getStartingXIInfo(squad, currentMatchday1Based);
  const roles = new Map();
  const xiIds = new Set(info.xi.map(p => p.id));

  squad.forEach(p => {
    if(isUnavailable(p, currentMatchday1Based)) roles.set(p.id, "out");
    else if(xiIds.has(p.id)) roles.set(p.id, "xi");
  });

  const available = squad
    .filter(p => !roles.has(p.id))
    .sort((a, b) => getEffectiveStrength(b) - getEffectiveStrength(a));

  const bench = available.slice(0, TEAM_RATING_BENCH_SIZE);
  const reserve = available.slice(TEAM_RATING_BENCH_SIZE);
  bench.forEach(p => roles.set(p.id, "bench"));
  reserve.forEach(p => roles.set(p.id, "reserve"));

  return { roles, xi: info.xi, bench, reserve, info };
}

function getSquadRole(roles, player){
  return roles.get(player.id) || "reserve";
}

function getTeamRatingBreakdown(squad, currentMatchday1Based){
  const { slots, xi, emergencyPenalties } = getStartingXIInfo(squad, currentMatchday1Based);

  if(xi.length === 0){
    return { xiAvg: 0, benchAvg: 0, rating: 0, emergencyDetails: [] };
  }

  const xiSum = xi.reduce((acc, p) => {
    const emInfo = emergencyPenalties.get(p.id);
    const emPenalty = emInfo ? emInfo.penalty : 0;
    const moral = typeof getMoraleStrengthEffect === "function" ? getMoraleStrengthEffect(p) : 0;
    const effective = Math.max(30, p.strength - emPenalty - getFatiguePenalty(p) + moral);
    return acc + effective;
  }, 0);
  const xiAvg = xiSum / xi.length;

  const xiIds = new Set(xi.map(p => p.id));
  // Nur die tatsaechliche Ersatzbank zaehlt, Reservisten bleiben aussen vor.
  const benchPlayers = classifySquad(squad, currentMatchday1Based,
    { slots, xi, emergencyPenalties }).bench;
  const benchAvg = benchPlayers.length > 0
    ? benchPlayers.reduce((acc, p) => acc + p.strength, 0) / benchPlayers.length
    : xiAvg;

  const rating = xiAvg * TEAM_RATING_XI_WEIGHT + benchAvg * TEAM_RATING_BENCH_WEIGHT;

  const emergencyDetails = slots
    .filter(s => s.isEmergency)
    .map(s => ({
      name: s.player.name, actualPos: s.player.pos, playedAs: s.slotPos,
      penalty: s.penalty, isManual: s.isManual
    }));

  return { xiAvg, benchAvg, rating: Math.round(rating), emergencyDetails };
}

function teamRating(squad, currentMatchday1Based){
  return getTeamRatingBreakdown(squad, currentMatchday1Based).rating;
}

function sortSquadByPosition(squad){
  return [...squad].sort((a, b) => {
    const posDiff = POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos);
    if(posDiff !== 0) return posDiff;
    return b.strength - a.strength;
  });
}

function canSellFromSquad(squad){
  return squad.length > MIN_SQUAD_SIZE;
}

function countByPosition(squad){
  const counts = {};
  POSITION_ORDER.forEach(pos => counts[pos] = 0);
  squad.forEach(p => { counts[p.pos] = (counts[p.pos] || 0) + 1; });
  return counts;
}

// ============================================
// Mannschaftswerte fuer die Simulation
// ============================================
// Angriff und Abwehr getrennt aus der Startelf. Der Schnitt beider Werte
// entspricht bewusst der Teambewertung, damit die austarierte Balance haelt —
// die Attribute geben dem Ergebnis nur zusaetzliche Struktur.
function getTeamAttackDefence(squad, currentMatchday1Based){
  const info = getStartingXIInfo(squad, currentMatchday1Based);
  const rating = getTeamRatingBreakdown(squad, currentMatchday1Based).rating;

  if(info.slots.length === 0 || !info.slots[0].player.attributes){
    return { attack: rating, defence: rating, rating: rating };
  }

  let attack = 0, defence = 0, weightSum = 0;
  info.slots.forEach(slot => {
    const p = slot.player;
    const a = p.attributes;
    const line = (POSITION_LAYOUT[slot.slotPos] || { line: 3 }).line;
    // Vordere Spieler zaehlen mehr fuer den Angriff, hintere fuer die Abwehr.
    const attWeight = 0.25 + (line / 5) * 0.75;
    const defWeight = 1.0 - (line / 5) * 0.75;

    const offValue = 0.45 * a.sho + 0.35 * a.pas + 0.20 * a.pac;
    const defValue = 0.60 * a.def + 0.20 * a.pas + 0.20 * a.pac;

    attack += offValue * attWeight;
    defence += defValue * defWeight;
    weightSum += 1;
  });

  const attWeights = info.slots.reduce((s, sl) => s + (0.25 + ((POSITION_LAYOUT[sl.slotPos] || { line: 3 }).line / 5) * 0.75), 0);
  const defWeights = info.slots.reduce((s, sl) => s + (1.0 - ((POSITION_LAYOUT[sl.slotPos] || { line: 3 }).line / 5) * 0.75), 0);

  let att = attWeights > 0 ? attack / attWeights : rating;
  let def = defWeights > 0 ? defence / defWeights : rating;

  // Auf die Teambewertung zentrieren: der Schnitt bleibt gleich, nur die
  // Verteilung zwischen Angriff und Abwehr traegt die Attributinformation.
  const mid = (att + def) / 2;
  const shift = rating - mid;
  return {
    attack: Math.max(20, att + shift),
    defence: Math.max(20, def + shift),
    rating: rating
  };
}
