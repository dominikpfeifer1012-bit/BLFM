// ============================================
// POOL.JS - Weltweiter Spielerbestand
// ============================================
// Jeder Verein hat einen Stamm von Spielern. Der Transfermarkt zeigt einen
// Ausschnitt daraus: gekaufte Spieler verlassen den Pool, verkaufte kehren
// zu einem Verein zurueck. Dadurch ist das Angebot endlich.
//
// Die Vereinsstaerke aus dem Ligapool bleibt der massgebliche Wert fuer die
// Spielsimulation. Der Poolbestand dient Transfers, Torschuetzen und Optik.

function buildPoolClubList(gameState){
  const clubs = [];
  // Alle Ligen liefern Vereine fuer den Bestand, nicht nur die ersten beiden.
  ensureLeaguePools(gameState);
  gameState.leaguePools.forEach((pool, idx) => {
    pool.forEach(c => clubs.push({ name: c.name, strength: c.strength, tier: "div" + (idx + 1) }));
  });

  shuffleArray(EURO_CLUBS).slice(0, POOL_FOREIGN_CLUB_COUNT).forEach(c => {
    clubs.push({ name: c.name, strength: c.strength, tier: "ausland" });
  });

  return clubs;
}

// Positionen so verteilen, dass jeder Verein einen spielfaehigen Stamm hat.
function poolPositionsForClub(count){
  const base = ["TW", "IV", "IV", "LV", "RV", "DM", "ZM", "ZM", "LM", "RM", "OM", "ST"];
  const positions = base.slice(0, count);
  while(positions.length < count) positions.push(randChoice(POSITION_ORDER));
  return positions;
}

// Kein Spieler darf seinen Verein deutlich ueberragen — sonst stehen
// Weltklassespieler bei Zweitligisten.
function capPoolPlayer(player, clubStrength){
  const deckel = clubStrength + POOL_MAX_ABOVE_CLUB;
  if(player.strength <= deckel) return player;
  applyAttributeChange(player, deckel - player.strength);
  refreshPlayerValue(player);
  return player;
}

function createWorldPool(gameState){
  const players = [];

  buildPoolClubList(gameState).forEach(club => {
    poolPositionsForClub(POOL_PLAYERS_PER_CLUB).forEach(pos => {
      const target = club.strength + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
      const player = genPlayer(Math.max(45, Math.min(94, target)), pos, [18, 34], true);
      capPoolPlayer(player, club.strength);
      player.clubName = club.name;
      player.clubTier = club.tier;
      players.push(player);
    });
  });

  // Vereinslose Spieler: kosten keine Abloese, nur Handgeld.
  for(let i = 0; i < POOL_FREE_AGENT_COUNT; i++){
    const player = genPlayer(randInt(48, 74), randChoice(POSITION_ORDER), [18, 35], true);
    player.clubName = null;
    player.clubTier = "frei";
    players.push(player);
  }

  const pool = { players: players, season: gameState.season };
  drawTransferList(pool);
  return pool;
}

// Wer in dieser Saison zu haben ist. Auslaufende Vertraege und Spieler
// vereinsloser Herkunft sind bevorzugt dabei.
function drawTransferList(pool){
  const gewicht = p => {
    let g = 1;
    if(!p.clubName) g += 4;
    if(isContractExpiring(p)) g += 3;
    // Talente bekommen ein eigenes Gewicht. Ohne das bestand die Liste fast
    // nur aus Routiniers mit auslaufendem Vertrag.
    if(p.age <= TRANSFER_LIST_YOUNG_MAX_AGE) g += 2;
    if(p.age <= 19 && p.maxStrength - p.strength > 10) g += 2;
    if(p.age >= 31) g += 1;
    return g * (0.5 + Math.random());
  };

  // Ein ausgebautes Scoutingnetz bringt mehr Spieler ans Licht.
  const scoutingBonus = typeof getScoutingChanceBonus === "function" && typeof gameState !== "undefined"
    ? 1 + (getScoutingChanceBonus(gameState) - 1) * 0.3 : 1;
  const anzahl = Math.max(TRANSFER_LIST_MIN,
    Math.round(pool.players.length * TRANSFER_LIST_SHARE * scoutingBonus));
  const sortiert = pool.players.map(p => ({ p, w: gewicht(p) })).sort((a, b) => b.w - a.w);

  // Erst einen Mindestanteil junger Spieler sichern, dann nach Gewicht
  // auffuellen. So ist auch nach vielen Saisons immer Nachwuchs im Angebot.
  const jungSoll = Math.round(anzahl * TRANSFER_LIST_YOUNG_SHARE);
  const gewaehlt = new Set();

  sortiert.filter(x => x.p.age <= TRANSFER_LIST_YOUNG_MAX_AGE)
    .slice(0, jungSoll)
    .forEach(x => gewaehlt.add(x.p.id));

  for(const x of sortiert){
    if(gewaehlt.size >= anzahl) break;
    gewaehlt.add(x.p.id);
  }

  pool.players.forEach(p => { p.transferListed = gewaehlt.has(p.id); });
  return pool;
}

function getPoolPlayer(pool, playerId){
  return pool && pool.players ? pool.players.find(p => p.id === playerId) : null;
}

// Abloese: Marktwert plus Aufschlag. Ein auslaufender Vertrag ist guenstig,
// ein vereinsloser Spieler kostet nur Handgeld.
function getTransferFee(player){
  if(!player.clubName) return Math.round(player.value * FREE_AGENT_SIGNING_FEE / 10000) * 10000;
  const premium = isContractExpiring(player) ? TRANSFER_FEE_EXPIRING_PREMIUM : TRANSFER_FEE_PREMIUM;
  return Math.round(player.value * (1 + premium) / 10000) * 10000;
}

// ---------- Suche ----------

function filterPool(pool, filters){
  filters = filters || {};
  const suche = (filters.search || "").trim().toLowerCase();

  return pool.players.filter(p => {
    if(!p.transferListed) return false;
    if(filters.pos && filters.pos !== "ALL" && p.pos !== filters.pos) return false;
    if(filters.minAge != null && p.age < filters.minAge) return false;
    if(filters.maxAge != null && p.age > filters.maxAge) return false;
    if(filters.minStrength != null && p.strength < filters.minStrength) return false;
    if(filters.maxFee != null && getTransferFee(p) > filters.maxFee) return false;
    if(filters.nat && filters.nat !== "ALL" && p.nat !== filters.nat) return false;
    if(filters.freeOnly && p.clubName) return false;
    if(filters.expiringOnly && !isContractExpiring(p)) return false;
    if(suche){
      const treffer = p.name.toLowerCase().includes(suche)
        || (p.clubName || "").toLowerCase().includes(suche);
      if(!treffer) return false;
    }
    return true;
  });
}

function sortPoolResults(list, key, dir){
  const mult = dir === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    let cmp = 0;
    if(key === "name") cmp = a.name.localeCompare(b.name);
    else if(key === "pos") cmp = POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos);
    else if(key === "age") cmp = a.age - b.age;
    else if(key === "fee") cmp = getTransferFee(a) - getTransferFee(b);
    else if(key === "potential") cmp = (a.maxStrength - a.strength) - (b.maxStrength - b.strength);
    else cmp = a.strength - b.strength;
    return cmp * mult;
  });
}

// ---------- Transfers ----------

function signPlayerFromPool(gameState, playerId){
  const fenster = checkTransferWindow(gameState);
  if(!fenster.open) return { success: false, message: fenster.message };

  const pool = gameState.pool;
  const player = getPoolPlayer(pool, playerId);
  if(!player) return { success: false, message: "Dieser Spieler ist nicht mehr verfügbar." };
  if(!player.transferListed) return { success: false, message: `${player.name} steht diese Saison nicht zur Verfügung.` };

  const fee = getTransferFee(player);
  const abbuchung = deductFromBudget(gameState.budget, fee);
  if(!abbuchung.success){
    return { success: false,
      message: `Ablöse nicht bezahlbar: ${fmtMoney(fee)} benötigt, ${fmtMoney(gameState.budget)} verfügbar.` };
  }

  gameState.budget = abbuchung.newBudget;
  pool.players = pool.players.filter(p => p.id !== playerId);

  const herkunft = player.clubName;
  delete player.clubName;
  delete player.clubTier;
  delete player.transferListed;
  player.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
  gameState.squad.push(player);

  return {
    success: true, player: player, fee: fee,
    message: herkunft
      ? `✅ ${player.name} (${player.pos}, ${Math.round(player.strength)}) kommt von ${herkunft} für ${fmtMoney(fee)}.`
      : `✅ ${player.name} (${player.pos}, ${Math.round(player.strength)}) ablösefrei verpflichtet, Handgeld ${fmtMoney(fee)}.`
  };
}

// Beim Verkauf kehrt der Spieler in den Pool zurueck — bei einem Verein,
// der zu seiner Staerke passt.
function findNewClubFor(gameState, player){
  const kandidaten = buildPoolClubList(gameState)
    .filter(c => c.name !== gameState.clubName)
    .map(c => ({ club: c, abstand: Math.abs(c.strength - player.strength) }))
    .sort((a, b) => a.abstand - b.abstand)
    .slice(0, 5);
  return kandidaten.length > 0 ? randChoice(kandidaten).club : null;
}

function sellPlayerToPool(gameState, squadIndex){
  const fenster = checkTransferWindow(gameState);
  if(!fenster.open) return { success: false, message: fenster.message };

  const player = gameState.squad[squadIndex];
  if(!player) return { success: false, message: "Spieler nicht gefunden." };
  if(!canSellFromSquad(gameState.squad)){
    return { success: false, message: `Kader zu klein zum Verkaufen (Minimum ${MIN_SQUAD_SIZE} Spieler).` };
  }

  const erloes = calculateSellValue(player.value);
  gameState.budget = addToBudget(gameState.budget, erloes);
  gameState.squad.splice(squadIndex, 1);
  pruneLineup(gameState);

  const club = findNewClubFor(gameState, player);
  player.clubName = club ? club.name : null;
  player.clubTier = club ? club.tier : "frei";
  player.transferListed = false;
  player.consecutiveStarts = 0;
  gameState.pool.players.push(player);

  return {
    success: true, erloes: erloes,
    message: `💰 ${player.name} wechselt zu ${club ? club.name : "keinem Verein"} — Erlös ${fmtMoney(erloes)}.`
  };
}

// ---------- Jahreswechsel ----------

function advancePool(gameState){
  const pool = gameState.pool;
  if(!pool) return { abgaenge: 0, zugaenge: 0 };

  const bleibt = [];
  let abgaenge = 0;

  pool.players.forEach(p => {
    p.age += 1;
    p.contractYears = Math.max(0, getContractYears(p) - 1);

    if(Math.random() < getRetirementChance(p.age, p.strength)){
      releasePlayerName(p.name);   // sonst waechst die Namensreserve unbegrenzt
      abgaenge++;
      return;
    }

    // Leichte Entwicklung, damit der Bestand nicht einfriert.
    const rate = p.age <= 23 ? randFloat(0, POOL_DEV_YOUNG_GAIN)
               : p.age >= 31 ? -randFloat(0, POOL_DEV_DECLINE)
               : randFloat(-0.7, 0.7);
    applyAttributeChange(p, rate);
    refreshPlayerValue(p);

    if(p.contractYears <= 0) resolveExpiredPoolContract(gameState, p);
    bleibt.push(p);
  });

  const clubs = buildPoolClubList(gameState);
  const soll = clubs.length * POOL_PLAYERS_PER_CLUB + POOL_FREE_AGENT_COUNT;

  // Jede Saison kommt ein fester Jahrgang nach. Die Menge ist so bemessen,
  // dass sie den natuerlichen Abgaengen entspricht — die Pyramide traegt sich
  // damit selbst. Eine kleine Korrektur haelt die Bestandsgroesse in der Spur,
  // ohne die aeltesten Jahrgaenge wegzuschneiden.
  const jahrgang = Math.round(soll / POOL_AVERAGE_CAREER_YEARS);
  const abweichung = soll - bleibt.length - jahrgang;
  let zugaenge = jahrgang + Math.max(-15, Math.min(15, Math.round(abweichung / 3)));
  zugaenge = Math.max(0, zugaenge);

  // Nur wenn der Bestand deutlich ueber das Ziel laeuft, treten zusaetzlich
  // die aeltesten Spieler ab.
  const ueberhang = bleibt.length + zugaenge - (soll + POOL_MAX_SIZE_DRIFT);
  if(ueberhang > 0){
    bleibt.sort((a, b) => b.age - a.age);
    for(let i = 0; i < Math.min(ueberhang, bleibt.length); i++){
      releasePlayerName(bleibt[i].name);
      abgaenge++;
    }
    bleibt.splice(0, Math.min(ueberhang, bleibt.length));
  }

  for(let i = 0; i < zugaenge; i++){
    bleibt.push(createPoolProspect(randChoice(clubs)));
  }

  // Falls der Bestand trotzdem unter das Soll faellt, mit Spielern im
  // besten Alter auffuellen.
  while(bleibt.length < soll){
    const club = randChoice(clubs);
    const ziel = club.strength - POOL_INTAKE_BELOW_CLUB
      + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
    const neu = genPlayer(Math.max(45, Math.min(94, ziel)), randChoice(POSITION_ORDER), [21, 27], true);
    capPoolPlayer(neu, club.strength);
    neu.clubName = club.name;
    neu.clubTier = club.tier;
    if(typeof ensureMorale === "function") ensureMorale(neu);
    bleibt.push(neu);
    zugaenge++;
  }

  pool.players = bleibt;
  pool.season = gameState.season;
  drawTransferList(pool);
  return { abgaenge, zugaenge };
}

// Ein Nachwuchsspieler fuer den Bestand: jung, noch schwach, mit Luft nach oben.
function createPoolProspect(club){
  const ziel = club.strength - POOL_INTAKE_BELOW_CLUB
    + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
  const spieler = genPlayer(Math.max(42, Math.min(94, ziel)), randChoice(POSITION_ORDER),
    [POOL_INTAKE_AGE_MIN, POOL_INTAKE_AGE_MAX], true);
  capPoolPlayer(spieler, club.strength);
  spieler.clubName = club.name;
  spieler.clubTier = club.tier;
  if(typeof ensureMorale === "function") ensureMorale(spieler);
  return spieler;
}

// Ohne diese Behandlung wuerde nach wenigen Saisons der gesamte Bestand
// vereinslos sein: Vertraege liefen ab und wurden nie erneuert.
function resolveExpiredPoolContract(gameState, player){
  const wurf = Math.random();

  if(wurf < POOL_RENEW_CHANCE && player.clubName){
    player.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
    return "verlaengert";
  }

  if(wurf < POOL_RENEW_CHANCE + POOL_TRANSFER_CHANCE){
    const club = findNewClubFor(gameState, player);
    if(club){
      player.clubName = club.name;
      player.clubTier = club.tier;
      player.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
      return "gewechselt";
    }
  }

  player.clubName = null;
  player.clubTier = "frei";
  player.contractYears = 1;
  return "vereinslos";
}

function getPoolStats(pool){
  if(!pool || !pool.players) return { gesamt: 0, gelistet: 0, frei: 0 };
  return {
    gesamt: pool.players.length,
    gelistet: pool.players.filter(p => p.transferListed).length,
    frei: pool.players.filter(p => p.transferListed && !p.clubName).length
  };
}


// ============================================
// Torschuetzen der KI-Vereine
// ============================================
// Erst mit dem Weltpool haben die KI-Vereine ueberhaupt Spieler. Damit wird
// eine ligaweite Torschuetzenliste moeglich.

function getClubRoster(pool, clubName){
  if(!pool || !pool.players) return [];
  return pool.players.filter(p => p.clubName === clubName);
}

// Verteilt die Tore eines KI-Vereins auf dessen Spieler.
function assignPoolScorers(gameState, clubName, goalCount){
  if(goalCount <= 0) return [];
  const kader = getClubRoster(gameState.pool, clubName);
  if(kader.length === 0) return [];

  const gewichtet = [];
  kader.forEach(p => {
    const gewicht = SCORER_WEIGHTS[p.pos] != null ? SCORER_WEIGHTS[p.pos] : 1;
    for(let i = 0; i < gewicht; i++) gewichtet.push(p);
  });
  if(gewichtet.length === 0) return [];

  const namen = [];
  for(let i = 0; i < goalCount; i++){
    const s = randChoice(gewichtet);
    s.goalsSeason = (s.goalsSeason || 0) + 1;
    namen.push(s.name);
  }
  return namen;
}

function resetPoolSeasonStats(pool){
  if(!pool || !pool.players) return;
  pool.players.forEach(p => { p.goalsSeason = 0; });
}

// Ligaweite Torschuetzenliste: eigener Kader und Bestandsspieler zusammen.
function getLeagueTopScorers(gameState, limit){
  const ligaNamen = new Set((gameState.teams || []).map(t => t.name));
  const eintraege = [];

  (gameState.squad || []).forEach(p => {
    if((p.goalsSeason || 0) > 0){
      eintraege.push({ name: p.name, pos: p.pos, nat: p.nat, goals: p.goalsSeason,
        club: gameState.clubName, eigen: true });
    }
  });

  ((gameState.pool && gameState.pool.players) || []).forEach(p => {
    if((p.goalsSeason || 0) > 0 && p.clubName && ligaNamen.has(p.clubName)){
      eintraege.push({ name: p.name, pos: p.pos, nat: p.nat, goals: p.goalsSeason,
        club: p.clubName, eigen: false });
    }
  });

  return eintraege.sort((a, b) => b.goals - a.goals).slice(0, limit || 10);
}
