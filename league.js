// ============================================
// LEAGUE.JS - Auf- und Abstieg zwischen 1. und 2. Bundesliga
// ============================================

function simulateGenericMatch(strengthA, strengthB){
  const diff = strengthA - strengthB;
  const lambdaA = Math.max(0.3, 1.3 + diff / 25);
  const lambdaB = Math.max(0.3, 1.2 - diff / 25);
  return { goalsA: poisson(lambdaA), goalsB: poisson(lambdaB) };
}

function simulateShadowSeason(clubPool){
  const teams = clubPool.map(c => ({
    name: c.name, strength: c.strength,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));
  const fixtures = generateFixtures(teams.map(t => t.name));

  fixtures.forEach(f => {
    const home = teams.find(t => t.name === f.home);
    const away = teams.find(t => t.name === f.away);
    const { goalsA, goalsB } = simulateGenericMatch(home.strength, away.strength);
    updateStandings(teams, f.home, f.away, goalsA, goalsB);
  });

  return getSortedStandings(teams);
}

function resolvePlayoff(teamA, teamB){
  const { goalsA, goalsB } = simulateGenericMatch(teamA.strength, teamB.strength);
  if(goalsA === goalsB){
    const diff = teamA.strength - teamB.strength;
    const winProb = Math.max(0.15, Math.min(0.85, 0.5 + diff / 200));
    return Math.random() < winProb ? teamA : teamB;
  }
  return goalsA > goalsB ? teamA : teamB;
}


// Pendelt die Vereinsstaerke um ihr festes Grundniveau. Drei Grenzen
// verhindern jede Inflation: Deckel pro Saison, maximaler Abstand zum
// Grundniveau und ein absoluter Ober-/Unterwert.
function applyClubStrengthDrift(clubs, standingsMap, movementMap){
  const changes = [];

  // Erwartete Platzierung = Rang nach Staerke innerhalb der gespielten Liga.
  // Belohnt wird nur, wer diese Erwartung uebertrifft. Dadurch kann sich der
  // staerkste Verein nicht immer weiter nach oben schrauben.
  const byDivision = new Map();
  clubs.forEach(club => {
    const entry = standingsMap.get(club.name);
    if(!entry) return;
    if(!byDivision.has(entry.division)) byDivision.set(entry.division, []);
    byDivision.get(entry.division).push(club);
  });
  const expectedRank = new Map();
  byDivision.forEach(list => {
    [...list]
      .sort((a, b) => b.strength - a.strength)
      .forEach((c, i) => expectedRank.set(c.name, i + 1));
  });

  clubs.forEach(club => {
    if(club.baseStrength == null) club.baseStrength = club.strength;
    const before = club.strength;

    const entry = standingsMap.get(club.name);
    const perf = (entry && entry.total > 1)
      ? (expectedRank.get(club.name) - entry.position) / (entry.total - 1)
      : 0;

    let delta = AI_DRIFT_REVERSION * (club.baseStrength - club.strength)
              + AI_DRIFT_PERFORMANCE * perf
              + randFloat(-AI_DRIFT_NOISE, AI_DRIFT_NOISE);

    const movement = movementMap.get(club.name);
    if(movement === "promoted") delta += AI_DRIFT_PROMOTION_BOOST;
    else if(movement === "relegated") delta += AI_DRIFT_RELEGATION_HIT;

    delta = Math.max(-AI_DRIFT_MAX_PER_SEASON, Math.min(AI_DRIFT_MAX_PER_SEASON, delta));

    let next = club.strength + delta;
    next = Math.max(club.baseStrength - AI_DRIFT_MAX_DEVIATION,
                    Math.min(club.baseStrength + AI_DRIFT_MAX_DEVIATION, next));
    next = Math.max(AI_STRENGTH_FLOOR, Math.min(AI_STRENGTH_CEILING, next));

    club.strength = Math.round(next * 10) / 10;
    changes.push({ name: club.name, before, after: club.strength, delta: club.strength - before });
  });

  return changes;
}

// ============================================
// Ligazugriff
// ============================================
// Alle Ligen liegen in gameState.leaguePools, indiziert ueber die Ligennummer
// minus eins. Fruehere Spielstaende kannten nur leagueOnePool/leagueTwoPool
// und werden beim Laden umgestellt.

function getDivisionCount(){
  return DIVISIONS.length;
}

function getDivisionConfig(nr){
  return DIVISIONS.find(d => d.nr === nr) || DIVISIONS[0];
}

function getDivisionLabel(nr){
  return getDivisionConfig(nr).label;
}

function ensureLeaguePools(gameState){
  if(!Array.isArray(gameState.leaguePools)){
    // Umstellung aus der alten Zwei-Ligen-Struktur.
    gameState.leaguePools = [
      gameState.leagueOnePool || clonePool(CLUBS),
      gameState.leagueTwoPool || clonePool(SECOND_DIVISION_CLUBS)
    ];
  }
  // Fehlende Ligen ergaenzen, ohne bestehende anzutasten.
  while(gameState.leaguePools.length < DIVISIONS.length){
    const nr = gameState.leaguePools.length + 1;
    gameState.leaguePools.push(clonePool(getDivisionConfig(nr).clubs));
  }
  return gameState.leaguePools;
}

function getLeaguePool(gameState, nr){
  ensureLeaguePools(gameState);
  return gameState.leaguePools[nr - 1] || [];
}

function getOwnLeaguePool(gameState){
  return getLeaguePool(gameState, gameState.division);
}

function getAllLeagueClubs(gameState){
  ensureLeaguePools(gameState);
  return gameState.leaguePools.flat();
}

function findClubEverywhere(gameState, name){
  return getAllLeagueClubs(gameState).find(c => c.name === name) || null;
}

function getClubDivision(gameState, name){
  ensureLeaguePools(gameState);
  for(let i = 0; i < gameState.leaguePools.length; i++){
    if(gameState.leaguePools[i].some(c => c.name === name)) return i + 1;
  }
  return null;
}

// ============================================
// Auf- und Abstieg ueber alle Ligen
// ============================================
// Zwischen je zwei benachbarten Ligen gilt dieselbe Regel: die letzten beiden
// steigen direkt ab, die ersten zwei direkt auf, der Drittletzte spielt gegen
// den Dritten der unteren Liga eine Relegation.

function getDivisionStandings(gameState, nr){
  if(nr === gameState.division) return getSortedStandings(gameState.teams);

  const shadow = gameState.shadowLeagues && gameState.shadowLeagues[nr];
  const pool = getLeaguePool(gameState, nr);
  if(shadow && shadow.teams && shadow.teams.length === pool.length && shadow.teams[0].played > 0){
    return getSortedStandings(shadow.teams);
  }
  // Rueckfallebene fuer alte Spielstaende oder abgebrochene Saisons.
  return simulateShadowSeason(pool);
}

function processPromotionRelegation(gameState){
  ensureLeaguePools(gameState);
  const playedDivision = gameState.division;
  const anzahl = gameState.leaguePools.length;

  // Tabellen aller Ligen einsammeln.
  const standings = {};
  for(let nr = 1; nr <= anzahl; nr++) standings[nr] = getDivisionStandings(gameState, nr);

  const alleVereine = new Map();
  getAllLeagueClubs(gameState).forEach(c => alleVereine.set(c.name, c));

  // Startbelegung: jeder bleibt zunaechst, wo er ist.
  const neueZuordnung = new Map();
  for(let nr = 1; nr <= anzahl; nr++){
    standings[nr].forEach(t => neueZuordnung.set(t.name, nr));
  }

  const bewegungen = [];

  // Jede Nahtstelle zwischen zwei Ligen getrennt abwickeln.
  for(let oben = 1; oben < anzahl; oben++){
    const unten = oben + 1;
    const obenTab = standings[oben], untenTab = standings[unten];
    if(obenTab.length < 3 || untenTab.length < 3) continue;

    const absteiger = [obenTab[obenTab.length - 2], obenTab[obenTab.length - 1]];
    const aufsteiger = [untenTab[0], untenTab[1]];
    const relegationOben = obenTab[obenTab.length - 3];
    const relegationUnten = untenTab[2];

    const sieger = resolvePlayoff(relegationOben, relegationUnten);
    const verlierer = sieger.name === relegationOben.name ? relegationUnten : relegationOben;

    absteiger.forEach(t => neueZuordnung.set(t.name, unten));
    aufsteiger.forEach(t => neueZuordnung.set(t.name, oben));
    neueZuordnung.set(sieger.name, oben);
    neueZuordnung.set(verlierer.name, unten);

    bewegungen.push({
      oben, unten,
      relegatedNames: absteiger.map(t => t.name),
      promotedNames: aufsteiger.map(t => t.name),
      playoffWinnerName: sieger.name,
      playoffLoserName: verlierer.name
    });
  }

  // Neue Ligapools aufbauen.
  const neuePools = Array.from({ length: anzahl }, () => []);
  alleVereine.forEach((club, name) => {
    const nr = neueZuordnung.get(name) || getClubDivision(gameState, name) || anzahl;
    neuePools[nr - 1].push(club);
  });
  gameState.leaguePools = neuePools;
  gameState.leagueOnePool = neuePools[0];   // Rueckwaertskompatibel
  gameState.leagueTwoPool = neuePools[1];

  const neueEigene = neueZuordnung.get(gameState.clubName) || playedDivision;
  gameState.division = neueEigene;

  // Staerkedrift mit den tatsaechlich gespielten Tabellen.
  const standingsMap = new Map();
  for(let nr = 1; nr <= anzahl; nr++){
    standings[nr].forEach((t, i) =>
      standingsMap.set(t.name, { position: i + 1, total: standings[nr].length, division: nr }));
  }
  const movementMap = new Map();
  alleVereine.forEach((club, name) => {
    const vorher = standingsMap.get(name) ? standingsMap.get(name).division : null;
    const nachher = neueZuordnung.get(name);
    movementMap.set(name, vorher === nachher ? "stayed" : (nachher < vorher ? "promoted" : "relegated"));
  });

  const driftChanges = applyClubStrengthDrift(
    getAllLeagueClubs(gameState), standingsMap, movementMap);

  // Die Nahtstelle der eigenen Liga fuer die Meldungen heraussuchen.
  const eigene = bewegungen.find(b => b.oben === playedDivision || b.unten === playedDivision)
    || bewegungen[0] || { relegatedNames: [], promotedNames: [],
         playoffWinnerName: "", playoffLoserName: "" };

  return {
    relegatedNames: eigene.relegatedNames,
    promotedNames: eigene.promotedNames,
    playoffWinnerName: eigene.playoffWinnerName,
    playoffLoserName: eigene.playoffLoserName,
    ownWasPromoted: neueEigene < playedDivision,
    ownWasRelegated: neueEigene > playedDivision,
    ownDivisionNow: neueEigene,
    movements: bewegungen,
    driftChanges
  };
}


// ============================================
// Die andere Liga laeuft parallel mit
// ============================================
// Frueher wurde sie erst am Saisonende in einem Rutsch simuliert. Dadurch
// war ihre Tabelle waehrend der Saison nicht einsehbar und die Ergebnisse
// hatten keinen Bezug zum eigenen Saisonverlauf.

// ============================================
// Die anderen Ligen laufen parallel mit
// ============================================
// Frueher wurde genau eine fremde Liga mitgespielt. Mit mehreren Ligen sind
// es alle ausser der eigenen — sonst waeren ihre Tabellen beim Auf- und
// Abstieg nicht belastbar.

function createShadowLeague(clubPool){
  const teams = clubPool.map(c => ({
    name: c.name, strength: c.strength,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));
  return {
    teams: teams,
    fixtures: generateFixtures(teams.map(t => t.name)),
    matchday: 0
  };
}

// Legt fuer jede fremde Liga eine Parallelsaison an.
function createShadowLeagues(gameState){
  ensureLeaguePools(gameState);
  const shadows = {};
  for(let nr = 1; nr <= gameState.leaguePools.length; nr++){
    if(nr === gameState.division) continue;
    shadows[nr] = createShadowLeague(getLeaguePool(gameState, nr));
  }
  return shadows;
}

function simulateShadowMatchday(gameState){
  const shadows = gameState.shadowLeagues;
  if(!shadows) return null;

  let gespielt = 0;
  Object.keys(shadows).forEach(nr => {
    const shadow = shadows[nr];
    const runde = shadow.fixtures.filter(
      (f, idx) => Math.floor(idx / MATCHES_PER_MATCHDAY) === shadow.matchday && !f.played);
    if(runde.length === 0) return;

    runde.forEach(f => {
      const home = shadow.teams.find(t => t.name === f.home);
      const away = shadow.teams.find(t => t.name === f.away);
      const { goalsA, goalsB } = simulateGenericMatch(home.strength + 3, away.strength);
      updateStandings(shadow.teams, f.home, f.away, goalsA, goalsB);
      f.played = true; f.homeGoals = goalsA; f.awayGoals = goalsB;

      // Auch hier bekommen die Tore Schuetzen, damit ein spaeterer Wechsel in
      // diese Liga keine leeren Statistiken hinterlaesst.
      if(typeof assignPoolScorers === "function"){
        assignPoolScorers(gameState, f.home, goalsA);
        assignPoolScorers(gameState, f.away, goalsB);
      }
    });
    shadow.matchday++;
    gespielt += runde.length;
  });

  return gespielt > 0 ? { matches: gespielt } : null;
}

// Welche Ligen laufen neben der eigenen? Nach Nummer sortiert.
function getShadowDivisionNumbers(gameState){
  if(!gameState.shadowLeagues) return [];
  return Object.keys(gameState.shadowLeagues).map(Number).sort((a, b) => a - b);
}


