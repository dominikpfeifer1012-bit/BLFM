// ============================================
// GAME-STATE.JS - Globaler Zustand, Karrierestart und Hilfsgroessen
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

var gameState = {};

let pendingLoad = null;

// Wichtig: eigene Objekte, damit die Staerke-Drift nicht die Konstante
// CLUBS ueberschreibt und in die naechste Karriere durchschlaegt.
// Die drei weiteren Bundesliga-Startplaetze gehen an die restlichen
// Top-4-Vereine der Vorsaison.

function clonePool(source){
  return source.map(c => ({ name: c.name, strength: c.strength, baseStrength: c.strength }));
}

function getOwnRevenueFactor(){
  const stature = gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState);
  return getClubRevenueFactor(stature, gameState.division);
}

function buildEuropeContext(){
  const pool = typeof getAllLeagueClubs === "function" ? getAllLeagueClubs(gameState) : [];
  const strengthOf = name => {
    const club = pool.find(c => c.name === name);
    return club ? club.strength : 78;
  };

  // Die Top-Vereine der fuenf grossen Ligen; aeltere Spielstaende kennen
  // nur die besten vier der eigenen Liga.
  const quali = gameState.europeQualifiers || gameState.lastTopFour || [];
  const others = quali
    .filter(n => n !== gameState.clubName)
    .map(n => ({ name: n, strength: strengthOf(n) }));

  return {
    ownClubName: gameState.clubName,
    ownStrength: teamRating(gameState.squad, 1),
    others
  };
}

function startCareer(){
  const managerName = document.getElementById("managerName").value.trim();
  const clubName = document.getElementById("clubSelect").value;
  const clubBase = DIVISIONS.flatMap(d => d.clubs).find(c => c.name === clubName);

  // Alle Ligen anlegen, nicht nur die ersten beiden.
  const leaguePools = DIVISIONS.map(d => clonePool(d.clubs));
  const startDivision = DIVISIONS.find(d =>
    d.clubs.some(c => c.name === clubName)) || DIVISIONS[0];
  const ownPool = leaguePools[startDivision.nr - 1];

  const teams = ownPool.map(c => ({
    name: c.name,
    strength: c.strength,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));

  gameState = {
    manager: managerName,
    clubName: clubName,
    season: 2026,
    matchday: 0,
    division: startDivision.nr,
    leaguePools: leaguePools,
    leagueOnePool: leaguePools[0],   // Rueckwaertskompatibel
    leagueTwoPool: leaguePools[1],
    fixtures: generateFixtures(teams.map(t => t.name)),
    teams: teams,
    squad: withHomeNationality(getCountryConfig(startDivision.country || "de").nat, () => generateSquad(clubBase.strength)),
    budget: calculateStartingBudget(clubBase.strength),
    lineup: {},
    clubStature: clubBase.strength,
    liveMatches: true,
    formation: DEFAULT_FORMATION,
    tactic: DEFAULT_TACTIC,
    training: DEFAULT_TRAINING,
    facilities: createFreshFacilities(),
    youthSquad: [],
    pendingYouthCandidates: null,
    pressConferences: true,
    seasonTransferIn: 0,
    seasonTransferOut: 0,
    lastPressMatchday: -99,
    pressHistory: [],
    marketRefreshedOnMatchday: -1,
    log: [],
    seasonEnded: false,
    lastSeasonSummary: null,
    ratingHistory: [],
    budgetHistory: [],
    seasonHistory: [],
    achievements: [],
    currentWinStreak: 0,
    cup: null,
    europe: createFreshEurope(false),
    lastTopFour: [],
    lastSeasonWasDivision1: isTopDivision(startDivision.nr),
    difficulty: (document.getElementById("difficultySelect") || {}).value || "normal",
    reputation: REPUTATION_START
  };

  gameState.cup = createFreshCup(gameState);
  gameState.board = createFreshBoard(clubBase.strength, startDivision.nr);
  gameState.pool = createWorldPool(gameState);
  gameState.records = createFreshRecords();
  gameState.shadowLeagues = createShadowLeagues(gameState);
  gameState.youth = createFreshYouthTeam();
  ensureSquadMorale(gameState.squad);

  // Schwierigkeit: Startbudget und Geduld des Vorstands
  const schwierigkeit = getDifficulty(gameState);
  gameState.budget = Math.round(gameState.budget * schwierigkeit.budget / 50000) * 50000;
  gameState.board.patience = schwierigkeit.patience;
  if(applyCustomData(gameState)){
    ensureSquadMorale(gameState.squad);
    // Vereinsstaerken koennen sich geaendert haben: Ziel neu bestimmen.
    gameState.board = createFreshBoard(getBoardReferenceStrength(gameState), gameState.division, schwierigkeit.patience);
    addLogEntry(gameState, "📂 Eigene Kaderdatei verwendet.");
  }
  ensureCoaches(gameState);
  markSeasonStart(gameState);
  simulateAiTransfers(gameState);

  document.getElementById("setup").style.display = "none";
  document.getElementById("stickyBar").style.display = "block";
  document.getElementById("game").style.display = "block";

  if(isTransferWindowOpen(1)){
    const end = getCurrentWindowEnd(1);
    addLogEntry(gameState, `📢 Das Transferfenster ist zu Saisonbeginn geöffnet! Transfers sind bis Spieltag ${end} möglich.`);
  }

  renderAll(gameState);
}

(function populateClubSelect(){
  const sel = document.getElementById("clubSelect");
  if(!sel) return;
  // Nach Land und Liga gruppiert, damit die Spielklasse beim Start sichtbar ist.
  COUNTRIES.forEach(land => getCountryDivisions(land.key).forEach(div => {
    const gruppe = document.createElement("optgroup");
    gruppe.label = `${land.name} · ${div.label}`;
    div.clubs.slice().sort((a, b) => b.strength - a.strength).forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.dataset.division = div.nr;
      opt.textContent = `${c.name} (Stärke ${c.strength})`;
      gruppe.appendChild(opt);
    });
    sel.appendChild(gruppe);
  }));
})();

(function populateSquadFilterOptions(){
  const sel = document.getElementById("squadFilterPos");
  if(!sel) return;
  POSITION_ORDER.forEach(pos => {
    const opt = document.createElement("option");
    opt.value = pos;
    opt.textContent = `${POSITION_ICONS[pos] || ""} ${pos}`;
    sel.appendChild(opt);
  });
})();
