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
  // Der eigene Verein hat seinen Kader in gameState.squad, nicht im Bestand.
  // Sonst stuenden eigene Spieler auf dem Transfermarkt.
  gameState.leaguePools.forEach((pool, idx) => {
    pool.forEach(c => {
      if(c.name !== gameState.clubName) clubs.push({ name: c.name, strength: c.strength, tier: "div" + (idx + 1),
        nat: getCountryConfig(getDivisionCountry(idx + 1)).nat, size: getPoolSizeForDivision(idx + 1) });
    });
  });

  shuffleArray(EURO_CLUBS).slice(0, POOL_FOREIGN_CLUB_COUNT).forEach(c => {
    clubs.push({ name: c.name, strength: c.strength, tier: "ausland", size: POOL_PLAYERS_PER_CLUB });
  });

  return clubs;
}

// Kleinere Bestaende in den auslaendischen zweiten Ligen halten Spielstand
// und Rechenzeit klein. Fuer Transfers und Torschuetzen reicht das.
function getPoolSizeForDivision(nr){
  const d = getDivisionConfig(nr);
  if(!d.country || d.country === "de" || d.tier === 1) return POOL_PLAYERS_PER_CLUB;
  return POOL_PLAYERS_PER_CLUB_SMALL;
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
  const clubs = buildPoolClubList(gameState);

  clubs.forEach(club => {
    poolPositionsForClub(club.size || POOL_PLAYERS_PER_CLUB).forEach(pos => {
      const target = club.strength + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
      const player = withHomeNationality(club.nat, () => genPlayer(Math.max(45, Math.min(94, target)), pos, [18, 34], true));
      capPoolPlayer(player, club.strength);
      player.clubName = club.name;
      player.clubTier = club.tier;
      // Gestaffelte Restlaufzeiten: schon im ersten Sommer laufen Vertraege aus.
      player.contractYears = randInt(1, CONTRACT_MAX_YEARS);
      players.push(player);
    });
  });

  // Vereinslose Spieler: kosten keine Abloese, nur Handgeld. Dazu ein paar
  // erfahrene gute Spieler, wie sie jeden Sommer auf dem Markt sind.
  for(let i = 0; i < POOL_FREE_AGENT_COUNT; i++){
    const routinier = i < FREE_AGENT_START_VETERANS;
    const player = routinier
      ? genPlayer(randInt(70, 78), randChoice(POSITION_ORDER.filter(p => p !== "TW")), [29, 33], false)
      : genPlayer(randInt(46, 66), randChoice(POSITION_ORDER), [22, 35], true);
    player.clubName = null;
    player.clubTier = "frei";
    players.push(player);
  }
  // Ausreisser der Zufallsstreuung (junger Star, 85+) kommen gleich unter.
  placeSurplusFreeAgents(gameState, players, clubs);

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
  // Wer seinem alten Trainer folgen will, draengt auf den Wechsel.
  const folgt = typeof isFollower === "function" && typeof gameState !== "undefined" && isFollower(gameState, player);
  return Math.round(player.value * (1 + premium) * (folgt ? 1 - FOLLOW_FEE_DISCOUNT : 1) / 10000) * 10000;
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
    else if(key === "potential") cmp = getPotentialView(gameState, a).mid - getPotentialView(gameState, b).mid;
    else cmp = a.strength - b.strength;
    return cmp * mult;
  });
}

// ---------- Transfers ----------

// Massgeblich ist das Standing des Vereins, nicht die Kaderbewertung —
// sonst liesse sich die Grenze durch Einkaeufe Schritt fuer Schritt anheben.
// Wer wechselt? Massgeblich ist das Hoechste aus Vereinsstaerke, Standing
// und der echten Kaderstaerke — ein aufgeruesteter Kader zieht bessere
// Spieler an, auch wenn der Verein selbst noch klein ist.
function getTransferInterestLimit(gameState){
  const kader = (gameState.squad || []).length ? teamRating(gameState.squad, (gameState.matchday || 0) + 1) : 0;
  const staerke = Math.max(getOwnClubStrength(gameState), gameState.clubStature || 0, kader);
  const bonus = typeof getDifficulty === "function" ? getDifficulty(gameState).transferBonus : 0;
  return Math.round(staerke + TRANSFER_MAX_ABOVE_CLUB + bonus);
}

function isWillingToJoin(gameState, player){
  if(typeof isFollower === "function" && isFollower(gameState, player)) return true;
  return player.strength <= getTransferInterestLimit(gameState);
}

function signPlayerFromPool(gameState, playerId){
  const fenster = checkTransferWindow(gameState);
  if(!fenster.open) return { success: false, message: fenster.message };

  const pool = gameState.pool;
  const player = getPoolPlayer(pool, playerId);
  if(!player) return { success: false, message: "Dieser Spieler ist nicht mehr verfügbar." };
  if(!player.transferListed) return { success: false, message: `${player.name} steht diese Saison nicht zur Verfügung.` };
  if(gameState.squad.length >= MAX_SQUAD_SIZE){
    return { success: false, message: `Kader voll (${MAX_SQUAD_SIZE} Spieler).` };
  }
  if(!isWillingToJoin(gameState, player)){
    return { success: false,
      message: `${player.name} hat kein Interesse an einem Wechsel.` };
  }

  const fee = getTransferFee(player);
  const abbuchung = deductFromBudget(gameState.budget, fee);
  if(!abbuchung.success){
    return { success: false,
      message: `Budget reicht nicht (${fmtMoney(fee)}).` };
  }

  gameState.budget = abbuchung.newBudget;
  pool.players = pool.players.filter(p => p.id !== playerId);

  const herkunft = player.clubName;
  delete player.clubName;
  delete player.clubTier;
  delete player.transferListed;
  player.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
  player.joinedSeason = gameState.season;
  player.purchaseFee = fee;
  // Was Scouts ueber ihn wissen, bleibt beim Wechsel erhalten.
  const bericht = typeof findReportFor === "function" ? findReportFor(gameState, player.id) : null;
  if(gameState.scouted && gameState.scouted[player.id]) player.estWidth = 0;
  else if(bericht) player.estWidth = Math.round(getReportWidth(bericht));
  // Bilanz beim neuen Verein beginnt bei null.
  Object.assign(player, { clubApps: 0, clubGoals: 0, clubSeasons: 0, clubSince: gameState.season });
  delete player.followCoach; delete player.followSeason;
  if(!herkunft) player.salaryFactor = Math.max(player.salaryFactor || 1, FREE_AGENT_SALARY_FACTOR);
  player.seasonStartStrength = player.strength;
  gameState.squad.push(player);

  return {
    success: true, player: player, fee: fee,
    message: herkunft
      ? `✅ ${player.name} (${player.pos}, ${Math.round(player.strength)}) kommt von ${herkunft} für ${fmtMoney(fee)}.`
      : `✅ ${player.name} (${player.pos}, ${Math.round(player.strength)}) ablösefrei verpflichtet, Handgeld ${fmtMoney(fee)}.`
  };
}

// Vereine wechseln zwischen den Ligen und der Regionalliga. Der Kader eines
// Vereins, der die Ligen verlaesst, geht an einen Aufsteiger aus demselben
// Land (beide spielen auf demselben Niveau). Frueher wurde er vereinslos und
// der Aufsteiger bekam neue Spieler: der Bestand lief jedes Jahr um rund 250
// Spieler ueber, und der Ueberhang wurde bei den Aeltesten abgeschnitten -
// der ganze Bestand wurde Jahr fuer Jahr juenger.
function syncPoolWithLeagues(gameState){
  if(!gameState.pool || !gameState.pool.players) return;
  const ligen = new Set(getAllLeagueClubs(gameState).map(c => c.name));
  const ausland = new Set(EURO_CLUBS.map(c => c.name));
  const verwaist = new Map();   // Land -> Map(alter Verein -> Spieler)
  gameState.pool.players.forEach(p => {
    if(p.clubName && !ligen.has(p.clubName) && !ausland.has(p.clubName)){
      const nr = /^div(\d+)$/.test(p.clubTier || "") ? parseInt(p.clubTier.slice(3), 10) : null;
      const land = nr ? getDivisionCountry(nr) : null;
      if(land){
        if(!verwaist.has(land)) verwaist.set(land, new Map());
        const kader = verwaist.get(land);
        if(!kader.has(p.clubName)) kader.set(p.clubName, []);
        kader.get(p.clubName).push(p);
      }
      p.clubName = null; p.clubTier = "frei";
    }
  });
  const proVerein = new Map();
  gameState.pool.players.forEach(p => { if(p.clubName) proVerein.set(p.clubName, (proVerein.get(p.clubName) || 0) + 1); });
  gameState.leaguePools.forEach((pool, idx) => pool.forEach(club => {
    if(club.name === gameState.clubName) return;
    let vorhanden = (proVerein.get(club.name) || 0);
    if(vorhanden >= 8) return;
    // Zuerst den Kader eines Vereins uebernehmen, der das Land verlassen hat.
    const reste = verwaist.get(getDivisionCountry(idx + 1));
    const alt = reste && reste.size ? reste.keys().next().value : null;
    if(alt){
      reste.get(alt).forEach(p => {
        if(p.clubName) return;   // inzwischen anderweitig untergekommen
        p.clubName = club.name; p.clubTier = "div" + (idx + 1);
        vorhanden++;
      });
      reste.delete(alt);
      proVerein.set(club.name, vorhanden);
    }
    // Nur neu hinzugekommene Vereine (Regionalliga-Aufsteiger) auffuellen;
    // den normalen Schwund gleicht der Jugend-Zustrom aus.
    if(vorhanden >= 8) return;
    const nat = getCountryConfig(getDivisionCountry(idx + 1)).nat;
    poolPositionsForClub(getPoolSizeForDivision(idx + 1)).slice(vorhanden).forEach(pos => {
      const ziel = club.strength + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
      const neu = withHomeNationality(nat, () => genPlayer(Math.max(40, Math.min(94, ziel)), pos, [19, 31], true));
      capPoolPlayer(neu, club.strength);
      neu.clubName = club.name;
      neu.clubTier = "div" + (idx + 1);
      if(typeof ensureMorale === "function") ensureMorale(neu);
      gameState.pool.players.push(neu);
    });
  }));
}

// Bestandsspieler, die noch beim eigenen Verein gefuehrt werden (alte
// Spielstaende, Vereinswechsel), wechseln zu einem passenden anderen Verein.
function detachOwnClubFromPool(gameState){
  if(!gameState.pool || !gameState.pool.players) return 0;
  let n = 0;
  gameState.pool.players.forEach(p => {
    if(p.clubName !== gameState.clubName) return;
    const club = findNewClubFor(gameState, p);
    p.clubName = club ? club.name : null;
    p.clubTier = club ? club.tier : "frei";
    n++;
  });
  return n;
}

// Beim Verkauf kehrt der Spieler in den Pool zurueck — bei einem Verein,
// der zu seiner Staerke passt.
function findNewClubFor(gameState, player, clubs){
  const kandidaten = (clubs || buildPoolClubList(gameState))
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
    return { success: false, message: `Mindestkader: ${MIN_SQUAD_SIZE} Spieler.` };
  }

  const erloes = getSellPrice(player);
  if(typeof noteDeparture === "function") noteDeparture(gameState, player, "verkauft");
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
  detachOwnClubFromPool(gameState);
  syncPoolWithLeagues(gameState);

  const bleibt = [];
  let abgaenge = 0;
  const clubs = buildPoolClubList(gameState);

  pool.players.forEach(p => {
    p.age += 1;
    p.contractYears = Math.max(0, getContractYears(p) - 1);

    if(Math.random() < getRetirementChance(p.age, p.strength)){
      if((p.formerCoachApps || 0) >= FORMER_COACH_MIN_APPS && typeof rememberRetiredPlayer === "function") rememberRetiredPlayer(gameState, p);
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

    if(!p.clubName){
      // Ohne Verein: Chance auf einen neuen Club, sonst Abbau ohne Spielpraxis.
      const club = Math.random() < POOL_FREE_AGENT_SIGN_CHANCE ? findNewClubFor(gameState, p, clubs) : null;
      if(club){
        p.clubName = club.name; p.clubTier = club.tier;
        p.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
      } else {
        applyAttributeChange(p, -randFloat(0, POOL_FREE_AGENT_DECLINE));
        refreshPlayerValue(p);
        p.contractYears = 1;
      }
    } else if(p.contractYears <= 0) resolveExpiredPoolContract(gameState, p, clubs);
    bleibt.push(p);
  });
  placeSurplusFreeAgents(gameState, bleibt, clubs);

  const soll = clubs.reduce((sum, c) => sum + (c.size || POOL_PLAYERS_PER_CLUB), 0) + POOL_FREE_AGENT_COUNT;
  // Zugaenge verteilen sich nach Bestandsgroesse der Vereine.
  const gewichtet = [];
  clubs.forEach(c => { for(let i = 0; i < (c.size || POOL_PLAYERS_PER_CLUB); i++) gewichtet.push(c); });

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

  const neueTalente = [];
  for(let i = 0; i < zugaenge; i++){
    const talent = createPoolProspect(randChoice(gewichtet));
    neueTalente.push(talent);
    bleibt.push(talent);
  }
  if(typeof announceAiJewel === "function") announceAiJewel(gameState, neueTalente);

  // Falls der Bestand trotzdem unter das Soll faellt, mit Spielern im
  // besten Alter auffuellen.
  while(bleibt.length < soll){
    const club = randChoice(gewichtet);
    const ziel = club.strength - POOL_INTAKE_BELOW_CLUB
      + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
    const neu = withHomeNationality(club.nat, () => genPlayer(Math.max(45, Math.min(94, ziel)), randChoice(POSITION_ORDER), [21, 27], true));
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

// Zu viele Vereinslose: die Staerksten kommen bei einem Verein unter.
// Der Markt der Vereinslosen soll wie im echten Sommer aussehen: viel
// Mittelmass, ein paar erfahrene gute Spieler, keine jungen Stars.
// Frueher kamen hier die Staerksten zuerst bei Vereinen unter, und uebrig
// blieben nur noch Spieler um 45 bis 50.
function placeSurplusFreeAgents(gameState, spieler, clubs){
  const unterbringen = p => {
    const club = findNewClubFor(gameState, p, clubs);
    if(!club) return false;
    p.clubName = club.name; p.clubTier = club.tier;
    p.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
    return true;
  };
  let frei = spieler.filter(p => !p.clubName);
  // Junge Leistungstraeger und Weltklasse bleiben nicht vereinslos.
  frei.filter(p => (p.age <= FREE_AGENT_YOUNG_MAX_AGE && p.strength >= FREE_AGENT_YOUNG_STAR)
    || p.strength >= FREE_AGENT_TOP_LIMIT).forEach(unterbringen);
  // Hoechstens ein paar Spitzenkraefte, bevorzugt die aelteren.
  frei = spieler.filter(p => !p.clubName);
  frei.filter(p => p.strength >= FREE_AGENT_ELITE_STRENGTH).sort((a, b) => a.age - b.age)
    .slice(0, Math.max(0, frei.filter(p => p.strength >= FREE_AGENT_ELITE_STRENGTH).length - FREE_AGENT_ELITE_MAX))
    .forEach(unterbringen);
  // Zu viele insgesamt: zufaellig ausgewaehlte finden einen Verein, damit
  // die Mischung erhalten bleibt.
  frei = shuffleArray(spieler.filter(p => !p.clubName));
  frei.slice(0, Math.max(0, frei.length - POOL_FREE_AGENT_MAX)).forEach(unterbringen);
}

// Ein Nachwuchsspieler fuer den Bestand: jung, noch schwach, mit Luft nach oben.
function createPoolProspect(club){
  const ziel = club.strength - POOL_INTAKE_BELOW_CLUB
    + randInt(-POOL_STRENGTH_SPREAD, POOL_STRENGTH_SPREAD);
  const spieler = withHomeNationality(club.nat, () => genPlayer(Math.max(42, Math.min(94, ziel)), randChoice(POSITION_ORDER),
    [POOL_INTAKE_AGE_MIN, POOL_INTAKE_AGE_MAX], true));
  capPoolPlayer(spieler, club.strength);
  spieler.clubName = club.name;
  spieler.clubTier = club.tier;
  // Auch KI-Vereine bilden aus: Eigengewaechse mit Akademie-Aufschlag.
  if(typeof markAiHomegrown === "function") markAiHomegrown(gameState, spieler, club);
  if(typeof ensureMorale === "function") ensureMorale(spieler);
  return spieler;
}

// Ohne diese Behandlung wuerde nach wenigen Saisons der gesamte Bestand
// vereinslos sein: Vertraege liefen ab und wurden nie erneuert.
function resolveExpiredPoolContract(gameState, player, clubs){
  const wurf = Math.random();

  if(wurf < POOL_RENEW_CHANCE && player.clubName){
    player.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
    return "verlaengert";
  }

  if(wurf < POOL_RENEW_CHANCE + POOL_TRANSFER_CHANCE){
    const club = findNewClubFor(gameState, player, clubs);
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
  return getTopScorersForClubs(gameState, new Set((gameState.teams || []).map(t => t.name)), limit);
}

// Torjaeger einer beliebigen Liga (Vereinsnamen als Set).
function getTopScorersForClubs(gameState, ligaNamen, limit){
  const eintraege = [];

  (ligaNamen.has(gameState.clubName) ? (gameState.squad || []) : []).forEach(p => {
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

// ---------- Scouting: Potenzial nur als Spanne ----------
// Fremde Spieler zeigen ihr Potenzial nicht mehr exakt, sondern als Spanne.
// Eine ausgebaute Scouting-Abteilung macht sie enger, gezieltes Beobachten
// deckt sie auf. Die Lage innerhalb der Spanne ist pro Spieler fest, damit
// sie sich nicht bei jedem Neuzeichnen verschiebt.
function isPlayerScouted(gameState, player){
  return !!(gameState.scouted && gameState.scouted[player.id]);
}

// Potenzial als Luft nach oben ("+8–14"). Die Spanne kommt aus der Akademie
// (eigene Spieler), aus Scoutberichten oder der allgemeinen Markteinschaetzung.
function getPotentialView(gameState, player){
  const e = getPotentialEstimate(gameState, player);
  const low = Math.max(0, Math.round(e.lo - player.strength));
  const high = Math.max(low, Math.round(e.hi - player.strength));
  return { exact: e.exact, low, high, mid: (low + high) / 2, lo: e.lo, hi: e.hi, source: e.source,
    report: e.report || null, text: e.exact ? `+${low}` : `+${low}–${high}` };
}

// Gezielte Beobachtung; mit einem eigenen Scout in der Region zum halben Preis.
function getScoutingCost(gameState, player){
  const s = typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1;
  const vorOrt = player && typeof getRegionStars === "function" && getRegionStars(gameState, player.nat) > 0 ? 0.5 : 1;
  return Math.round(SCOUT_COST_BASE * s * vorOrt / 10000) * 10000;
}

function scoutPlayer(gameState, playerId){
  const p = getPoolPlayer(gameState.pool, playerId);
  if(!p) return { success: false, message: "Spieler nicht gefunden." };
  if(isPlayerScouted(gameState, p)) return { success: false, message: "Bereits beobachtet." };
  const kosten = getScoutingCost(gameState, p);
  if(kosten > gameState.budget) return { success: false, message: `Budget reicht nicht (${fmtMoney(kosten)}).` };
  gameState.budget -= kosten;
  gameState.scouted = gameState.scouted || {};
  gameState.scouted[p.id] = true;
  return { success: true, message: `🔍 ${p.name} beobachtet (${fmtMoney(kosten)}): Potenzial +${Math.max(0, Math.round(p.maxStrength - p.strength))}.` };
}
