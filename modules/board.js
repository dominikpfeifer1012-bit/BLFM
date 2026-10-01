// ============================================
// BOARD.JS - Vorstand, Saisonziel und Geduld
// ============================================

// Rang 1 = staerkster Verein der Liga. Gleich starke Vereine teilen sich den Rang.
function getStrengthRankInDivision(clubStrength, division){
  if(typeof gameState === "undefined" || !gameState || typeof getLeaguePool !== "function") return null;
  const pool = getLeaguePool(gameState, division) || [];
  if(pool.length === 0) return null;
  return 1 + pool.filter(c => c.strength > clubStrength).length;
}

function getSeasonGoal(clubStrength, division){
  const konfig = typeof getDivisionConfig === "function" ? getDivisionConfig(division) : null;
  const list = (konfig && konfig.goals) || BOARD_GOALS_DIV1;
  const rang = getStrengthRankInDivision(clubStrength, division);
  if(rang != null) return list.find(g => rang <= g.maxRank) || list[list.length - 1];
  return list.find(g => clubStrength >= g.minStrength) || list[list.length - 1];
}

function createFreshBoard(clubStrength, division, carryPatience){
  const goal = getSeasonGoal(clubStrength, division);
  return {
    patience: carryPatience != null ? carryPatience : BOARD_START_PATIENCE,
    goalLabel: goal.label,
    targetPosition: goal.target,
    checkpointsDone: 0,
    dismissed: false,
    credit: 0,
    history: []
  };
}

// Pokalerfolge zaehlen mit: eine gute Pokalsaison federt eine maue Liga ab.
function addBoardCredit(gameState, amount){
  if(!gameState.board) return;
  gameState.board.credit = (gameState.board.credit || 0) + amount;
}

function isBoardCheckpoint(matchday){
  return BOARD_CHECKPOINTS.includes(matchday);
}

function evaluateBoard(gameState){
  const board = gameState.board;
  if(!board || board.dismissed) return null;

  const sorted = getSortedStandings(gameState.teams);
  const position = sorted.findIndex(t => t.name === gameState.clubName) + 1;
  if(position === 0) return null;

  const rankDelta = board.targetPosition - position;
  const credit = board.credit || 0;

  // Erst den Ligaanteil deckeln, DANN den Pokalbonus draufrechnen. Andernfalls
  // waere der Bonus bei einer sehr schlechten Platzierung komplett unsichtbar,
  // weil der Ausschlag schon am unteren Anschlag klebt.
  // Ziel genau erreicht zaehlt als Erfolg, nicht als Stillstand.
  const ligaAnteil = Math.max(-BOARD_MAX_SWING, Math.min(BOARD_MAX_SWING,
    Math.max(rankDelta * BOARD_PATIENCE_PER_RANK, rankDelta >= 0 ? BOARD_GOAL_MET_BONUS : -Infinity)));
  let swing = Math.max(-BOARD_MAX_SWING, Math.min(BOARD_MAX_SWING, ligaAnteil + credit));

  // Der Bonus soll spuerbar bleiben, auch wenn der Ligaanteil am Anschlag ist.
  if(credit > 0 && swing <= ligaAnteil) swing = Math.min(BOARD_MAX_SWING, ligaAnteil + Math.round(credit / 2));

  const before = board.patience;
  board.patience = Math.min(BOARD_MAX_PATIENCE, Math.round(board.patience + swing));
  board.checkpointsDone += 1;
  board.credit = 0;

  // Uebererfuellung wird belohnt: zusaetzliches Transferbudget, sobald der
  // Verein deutlich besser dasteht als gefordert.
  let reward = 0;
  const ueber = board.targetPosition - position;
  if(ueber >= BOARD_REWARD_MIN_RANKS){
    const faktor = typeof getOwnRevenueFactor === "function" ? getOwnRevenueFactor() : 1;
    reward = Math.min(BOARD_REWARD_MAX,
      Math.round(ueber * BOARD_REWARD_PER_RANK * faktor / 50000) * 50000);
    gameState.budget = addToBudget(gameState.budget, reward);
  }

  const entry = {
    matchday: gameState.matchday,
    position: position,
    target: board.targetPosition,
    swing: swing,
    reward: reward,
    patienceBefore: before,
    patienceAfter: board.patience
  };
  board.history.push(entry);

  if(board.patience <= 0){
    board.patience = 0;
    board.dismissed = true;
    entry.dismissed = true;
  }

  return entry;
}

function getBoardMood(board){
  if(!board) return { label: "—", tone: "info" };
  if(board.dismissed) return { label: "Entlassen", tone: "loss" };
  if(board.patience >= 75) return { label: "Sehr zufrieden", tone: "win" };
  if(board.patience >= 50) return { label: "Zufrieden", tone: "win" };
  if(board.patience >= BOARD_WARN_THRESHOLD) return { label: "Skeptisch", tone: "draw" };
  return { label: "Unzufrieden", tone: "loss" };
}

function getNextBoardCheckpoint(matchday){
  return BOARD_CHECKPOINTS.find(cp => cp > matchday) || null;
}


// ============================================
// Angebote nach einer Entlassung
// ============================================
// Statt nur neu anfangen zu koennen, bekommt der Trainer Angebote von
// kleineren Vereinen. Die Karriere laeuft weiter, nur eben woanders.
function generateJobOffers(gameState){
  const letzteStaerke = gameState.clubStature != null
    ? gameState.clubStature : getOwnClubStrength(gameState);

  ensureLeaguePools(gameState);
  const alle = gameState.leaguePools.flatMap((pool, idx) =>
    pool.map(c => ({ name: c.name, strength: c.strength, division: idx + 1 }))
  ).filter(c => c.name !== gameState.clubName);

  const passend = alle.filter(c =>
    c.strength <= letzteStaerke - JOB_OFFER_MIN_STRENGTH_DROP &&
    c.strength >= letzteStaerke - JOB_OFFER_MAX_STRENGTH_DROP);

  // Falls das Feld zu duenn ist, mit den naechstschwaecheren auffuellen.
  const pool = passend.length >= JOB_OFFER_COUNT ? passend
    : alle.filter(c => c.strength < letzteStaerke)
          .sort((a, b) => b.strength - a.strength)
          .slice(0, JOB_OFFER_COUNT * 2);

  const auswahl = shuffleArray(pool.length > 0 ? pool : alle).slice(0, JOB_OFFER_COUNT);

  return auswahl.map(c => ({
    name: c.name,
    strength: c.strength,
    division: c.division,
    goal: getSeasonGoal(c.strength, c.division),
    budget: calculateStartingBudget(c.strength)
  }));
}
