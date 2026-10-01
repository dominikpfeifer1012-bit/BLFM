// ============================================
// YOUTH.JS - Jugendmannschaft
// ============================================
// Sie spielt an jedem Ligaspieltag parallel. Wer hier auflaeuft, entwickelt
// sich deutlich besser als auf der Bank. Damit lohnt sich ein Talent auch
// dann, wenn es fuer die Startelf noch zu schwach ist.

function createFreshYouthTeam(){
  return {
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0,
    lastResult: null, history: [], scorers: {}
  };
}

// Wer spielt: junge Spieler ausserhalb der Startelf zuerst, danach mit
// Reservisten aufgefuellt, damit elf Leute auf dem Platz stehen.
// Wer spielt: der Jugendkader zuerst — er braucht die Minuten am dringendsten.
// Danach junge Profis ausserhalb der Startelf, zuletzt Reservisten zum
// Auffuellen, damit elf Leute auf dem Platz stehen.
function getYouthLineup(gameState, currentMatchday1Based){
  const info = getStartingXIInfo(gameState.squad, currentMatchday1Based);
  const firstTeamIds = new Set(info.xi.map(p => p.id));

  const jugendkader = (gameState.youthSquad || [])
    .filter(p => !isUnavailable(p, currentMatchday1Based))
    .sort((a, b) => b.strength - a.strength);

  const verfuegbar = gameState.squad.filter(p =>
    !firstTeamIds.has(p.id) && !isUnavailable(p, currentMatchday1Based));

  const jungeProfis = verfuegbar.filter(p => p.age <= YOUTH_TEAM_MAX_AGE)
    .sort((a, b) => b.strength - a.strength);
  const reservisten = verfuegbar.filter(p => p.age > YOUTH_TEAM_MAX_AGE)
    .sort((a, b) => a.strength - b.strength);   // schwaechste zuerst

  return jugendkader.concat(jungeProfis, reservisten).slice(0, YOUTH_TEAM_SIZE);
}

function getYouthTeamStrength(lineup){
  if(lineup.length === 0) return 0;
  return lineup.reduce((sum, p) => sum + p.strength, 0) / lineup.length;
}

function simulateYouthMatchday(gameState){
  const youth = gameState.youth;
  if(!youth) return null;

  const day = gameState.matchday + 1;
  const lineup = getYouthLineup(gameState, day);
  if(lineup.length < YOUTH_TEAM_MIN_PLAYERS){
    return { skipped: true, reason: "zu wenige Spieler", appearances: new Set() };
  }

  const eigene = getYouthTeamStrength(lineup);
  const basis = (gameState.clubStature != null ? gameState.clubStature : 65) - YOUTH_OPPONENT_OFFSET;
  const gegner = Math.max(35, basis + randInt(-YOUTH_OPPONENT_SPREAD, YOUTH_OPPONENT_SPREAD));

  const { goalsA, goalsB } = simulateGenericMatch(eigene + 2, gegner);
  const scorers = assignYouthScorers(youth, lineup, goalsA);

  youth.played++;
  youth.gf += goalsA; youth.ga += goalsB;
  if(goalsA > goalsB) youth.won++;
  else if(goalsA < goalsB) youth.lost++;
  else youth.drawn++;

  const result = goalsA > goalsB ? "win" : goalsA < goalsB ? "loss" : "draw";
  youth.lastResult = { matchday: day, ownGoals: goalsA, oppGoals: goalsB,
    opponentStrength: gegner, result, scorers };
  youth.history.push(youth.lastResult);
  if(youth.history.length > 40) youth.history = youth.history.slice(-40);

  return {
    skipped: false,
    appearances: new Set(lineup.map(p => p.id)),
    lineup, result, ownGoals: goalsA, oppGoals: goalsB,
    opponentStrength: gegner, ownStrength: eigene, scorers
  };
}

// Torschuetzen der Jugend werden ueber die Saison mitgezaehlt.
function assignYouthScorers(youth, lineup, goalCount){
  if(goalCount <= 0) return [];
  const gewichtet = [];
  lineup.forEach(p => {
    const gewicht = SCORER_WEIGHTS[p.pos] != null ? SCORER_WEIGHTS[p.pos] : 1;
    for(let i = 0; i < gewicht; i++) gewichtet.push(p);
  });
  if(gewichtet.length === 0) return [];

  const namen = [];
  for(let i = 0; i < goalCount; i++){
    const s = randChoice(gewichtet);
    youth.scorers[s.id] = (youth.scorers[s.id] || 0) + 1;
    namen.push(s.name);
  }
  return namen;
}

function resetYouthSeason(gameState){
  gameState.youth = createFreshYouthTeam();
}

// Wer in der Jugend so stark geworden ist, dass er der ersten Mannschaft
// hilft — dient nur als Hinweis, aufgestellt wird weiterhin von Hand.
function getYouthPromotionCandidates(gameState){
  const day = gameState.matchday + 1;
  const info = getStartingXIInfo(gameState.squad, day);
  const xiIds = new Set(info.xi.map(p => p.id));
  const schwaechsteImXI = {};

  info.slots.forEach(s => {
    const wert = getStrengthOnSlot(s.player, s.slotPos);
    if(schwaechsteImXI[s.slotPos] == null || wert < schwaechsteImXI[s.slotPos]){
      schwaechsteImXI[s.slotPos] = wert;
    }
  });

  return gameState.squad
    .filter(p => p.age <= YOUTH_TEAM_MAX_AGE && !xiIds.has(p.id) && !isUnavailable(p, day))
    .filter(p => {
      const grenze = schwaechsteImXI[p.pos];
      return grenze != null && getStrengthOnSlot(p, p.pos) >= grenze + YOUTH_PROMOTION_GAP;
    })
    .sort((a, b) => b.strength - a.strength);
}


// ============================================
// Eigener Jugendkader
// ============================================

function ensureYouthSquad(gameState){
  if(!Array.isArray(gameState.youthSquad)) gameState.youthSquad = [];
  return gameState.youthSquad;
}

// Am Saisonende stellt die Jugendabteilung Kandidaten vor. Angeboten werden
// mehr, als aufgenommen werden koennen — es ist also eine Auswahl.
function createYouthCandidates(gameState){
  const staerke = getOwnClubStrength(gameState);
  const kandidaten = [];
  const positionen = shuffleArray(POSITION_ORDER.slice());

  for(let i = 0; i < YOUTH_INTAKE_CANDIDATES; i++){
    const pos = positionen[i % positionen.length];
    const spieler = genYouthPlayer(staerke, pos);
    spieler.age = randInt(YOUTH_CANDIDATE_AGE_MIN, YOUTH_CANDIDATE_AGE_MAX);

    // Eine ausgebaute Jugendabteilung liefert stärkere Talente mit mehr Luft.
    const bonus = typeof getYouthQualityBonus === "function"
      ? getYouthQualityBonus(gameState) : { strength: 0, potential: 0 };
    if(bonus.strength > 0 || bonus.potential > 0){
      ATTRIBUTES.forEach(a => {
        spieler.maxAttributes[a] = Math.min(ATTRIBUTE_MAX,
          spieler.maxAttributes[a] + bonus.strength + bonus.potential);
      });
      applyAttributeChange(spieler, bonus.strength);
      spieler.baseStrength = spieler.strength;
      spieler.maxStrength = Math.round(getMaxAttributeRating(spieler) * 10) / 10;
    }
    refreshPlayerValue(spieler);
    if(typeof ensureMorale === "function") ensureMorale(spieler);
    kandidaten.push(spieler);
  }
  return kandidaten;
}

function addToYouthSquad(gameState, player){
  ensureYouthSquad(gameState);
  if(gameState.youthSquad.length >= YOUTH_SQUAD_MAX_SIZE){
    return { success: false, message: `Die Jugend ist voll (${YOUTH_SQUAD_MAX_SIZE} Plätze).` };
  }
  player.isYouthSquad = true;
  player.isYouthProduct = true;
  gameState.youthSquad.push(player);
  return { success: true, message: `${player.name} (${player.pos}) kommt in die Jugend.` };
}

// Hochziehen in den Profikader. Bewusst jederzeit moeglich und ohne
// Transferfenster — es ist ein interner Wechsel, kein Transfer.
function promoteYouthPlayer(gameState, playerId){
  ensureYouthSquad(gameState);
  const idx = gameState.youthSquad.findIndex(p => p.id === playerId);
  if(idx === -1) return { success: false, message: "Spieler nicht in der Jugend." };

  const player = gameState.youthSquad[idx];
  gameState.youthSquad.splice(idx, 1);
  delete player.isYouthSquad;
  player.contractYears = Math.max(getContractYears(player), CONTRACT_YOUTH_YEARS);
  gameState.squad.push(player);

  return { success: true, player: player,
    message: `⬆️ ${player.name} (${player.pos}, ${Math.round(player.strength)}) rückt in den Profikader auf.` };
}

// Umgekehrt: einen jungen Profi zurueck in die Jugend schicken, damit er
// dort Spielpraxis bekommt.
function demoteToYouthSquad(gameState, playerId){
  ensureYouthSquad(gameState);
  const idx = gameState.squad.findIndex(p => p.id === playerId);
  if(idx === -1) return { success: false, message: "Spieler nicht im Kader." };

  const player = gameState.squad[idx];
  if(player.age > YOUTH_SQUAD_MAX_AGE){
    return { success: false, message: `${player.name} ist mit ${player.age} zu alt für die Jugend.` };
  }
  if(gameState.squad.length - 1 < MIN_SQUAD_SIZE){
    return { success: false, message: `Der Profikader darf nicht unter ${MIN_SQUAD_SIZE} Spieler fallen.` };
  }
  if(gameState.youthSquad.length >= YOUTH_SQUAD_MAX_SIZE){
    return { success: false, message: "Die Jugend ist voll." };
  }

  gameState.squad.splice(idx, 1);
  pruneLineup(gameState);
  player.isYouthSquad = true;
  player.consecutiveStarts = 0;
  gameState.youthSquad.push(player);
  return { success: true, message: `⬇️ ${player.name} spielt vorerst in der Jugend.` };
}

// Jahreswechsel: alle altern. Wer die Altersgrenze ueberschreitet, muss
// hochgezogen werden — sonst verlaesst er den Verein. Das erzwingt eine
// Entscheidung, statt Talente unbegrenzt zu parken.
function advanceYouthSquad(gameState){
  ensureYouthSquad(gameState);
  const bleibt = [], abgaenge = [], hochgezogen = [];

  gameState.youthSquad.forEach(player => {
    player.age += 1;
    if(player.age <= YOUTH_SQUAD_MAX_AGE){ bleibt.push(player); return; }

    // Zu alt fuer die Jugend: automatisch hochziehen, wenn Platz ist.
    if(gameState.squad.length < SQUAD_COMPOSITION.reduce((s, e) => s + e.count, 0) + 4){
      delete player.isYouthSquad;
      player.contractYears = Math.max(getContractYears(player), CONTRACT_YOUTH_YEARS);
      gameState.squad.push(player);
      hochgezogen.push(player);
    } else {
      if(typeof releasePlayerName === "function") releasePlayerName(player.name);
      abgaenge.push(player);
    }
  });

  gameState.youthSquad = bleibt;
  return { hochgezogen, abgaenge };
}

function getYouthSquadSalary(gameState){
  return (gameState.youthSquad || []).reduce((sum, p) =>
    sum + Math.round(calculatePlayerSalary(p.strength, p.age) * YOUTH_SALARY_FACTOR), 0);
}

// Wer ist reif fuer den Sprung? Vergleich mit dem schwaechsten Profi auf
// derselben Position.
function isReadyForPromotion(gameState, player){
  const day = gameState.matchday + 1;
  const eigene = getStrengthOnSlot(player, player.pos);
  // Eine freie Position allein macht noch keinen Profi: sonst galt ein
  // 46er-Talent in einer 73er-Mannschaft als bereit.
  if(eigene < teamRating(gameState.squad, day) - YOUTH_READY_MAX_BELOW_TEAM) return false;
  const konkurrenz = gameState.squad
    .filter(p => p.pos === player.pos && !isUnavailable(p, day))
    .map(p => getStrengthOnSlot(p, p.pos));
  if(konkurrenz.length === 0) return true;
  return eigene >= Math.min(...konkurrenz);
}


// ============================================
// Auffangnetz fuer den Profikader
// ============================================
// Zuerst rueckt die Jugend nach, danach werden vereinslose Spieler
// verpflichtet. So bleibt der Verein immer spielfaehig, ohne dass der
// Nachwuchs automatisch hochgezogen wird.
function ensureMinimumSquad(gameState){
  const hochgezogen = [], verpflichtet = [];

  // 1. Die staerksten Jugendspieler, die reif genug sind.
  while(gameState.squad.length < SQUAD_REFILL_THRESHOLD && (gameState.youthSquad || []).length > 0){
    const beste = [...gameState.youthSquad].sort((a, b) => b.strength - a.strength)[0];
    const result = promoteYouthPlayer(gameState, beste.id);
    if(!result.success) break;
    hochgezogen.push(result.player);
  }

  // 2. Danach vereinslose Spieler aus dem Bestand — aber nur solche, die zum
  // Verein passen. Frueher kamen hier die besten Vereinslosen der Welt
  // kostenlos, und ein Drittligist hatte nach drei Sommern Nationalspieler,
  // ohne je selbst zu handeln. Notverpflichtungen liegen hoechstens auf
  // Vereinsniveau und kosten das uebliche Handgeld, sofern es bezahlbar ist.
  const deckel = getOwnClubStrength(gameState) + REFILL_MAX_ABOVE_CLUB;
  while(gameState.squad.length < SQUAD_REFILL_THRESHOLD){
    const frei = (gameState.pool && gameState.pool.players || [])
      .filter(p => !p.clubName && p.strength <= deckel)
      .sort((a, b) => b.strength - a.strength);

    if(frei.length === 0){
      // Letzte Rueckfallebene: ein Spieler wird neu erzeugt.
      const neu = genPlayer(Math.max(45, getOwnClubStrength(gameState) - 12),
        randChoice(POSITION_ORDER), [22, 30], false);
      if(typeof ensureMorale === "function") ensureMorale(neu);
      neu.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
      gameState.squad.push(neu);
      verpflichtet.push(neu);
      continue;
    }

    const spieler = frei[0];
    const handgeld = getTransferFee(spieler);
    if(handgeld <= gameState.budget) gameState.budget -= handgeld;
    gameState.pool.players = gameState.pool.players.filter(p => p.id !== spieler.id);
    delete spieler.clubName;
    delete spieler.clubTier;
    delete spieler.transferListed;
    spieler.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
    if(typeof ensureMorale === "function") ensureMorale(spieler);
    gameState.squad.push(spieler);
    verpflichtet.push(spieler);
  }

  return { hochgezogen, verpflichtet };
}
