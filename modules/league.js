// ============================================
// LEAGUE.JS - Auf- und Abstieg zwischen 1. und 2. Bundesliga
// ============================================

// ---------- Ligagroesse ----------
// Die Ligen sind nicht mehr alle gleich gross: die 3. Liga hat wie in echt
// 20 Vereine und damit 38 Spieltage. Alles, was frueher mit festen 9 Spielen
// pro Spieltag und 34 Spieltagen rechnete, fragt jetzt hier nach.
function getRoundSize(teamCount){
  return Math.max(1, Math.floor((teamCount || 18) / 2));
}

function getRoundsForTeams(teamCount){
  return 2 * ((teamCount || 18) - 1);
}

// Spieltage der eigenen Liga in dieser Saison.
function getSeasonMatchdays(gameState){
  const gs = gameState || (typeof window !== "undefined" ? window.gameState : null);
  const n = gs && gs.teams && gs.teams.length ? gs.teams.length : 18;
  return getRoundsForTeams(n);
}

// Spiele eines Spieltags (0-basiert) aus einem Spielplan.
function getRoundFixtures(fixtures, teamCount, day){
  const proRunde = getRoundSize(teamCount);
  return fixtures.filter((f, idx) => Math.floor(idx / proRunde) === day);
}

function getFixtureMatchday(idx, teamCount){
  return Math.floor(idx / getRoundSize(teamCount)) + 1;
}

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

  // Unterste Liga gegen die Regionalliga: die letzten vier steigen ab,
  // vier Vereine aus dem Regionalliga-Kreis kommen hinzu.
  const regional = { down: [], up: [] };
  const untersteTab = standings[anzahl];
  if(untersteTab && untersteTab.length > REGIONAL_PROMOTIONS + 4){
    ensureRegionalClubs(gameState);
    untersteTab.slice(-REGIONAL_PROMOTIONS).forEach(t => {
      neueZuordnung.set(t.name, 0);
      regional.down.push(t.name);
    });
    regional.up = pickRegionalPromotions(gameState, REGIONAL_PROMOTIONS);
  }

  // Neue Ligapools aufbauen.
  const neuePools = Array.from({ length: anzahl }, () => []);
  alleVereine.forEach((club, name) => {
    const ziel = neueZuordnung.get(name);
    if(ziel === 0){
      // In die Regionalliga: Verein verlaesst die Ligen, schwaecht sich etwas ab.
      club.strength = Math.max(AI_STRENGTH_FLOOR, Math.round((club.strength - REGIONAL_RELEGATION_STRENGTH_LOSS) * 10) / 10);
      gameState.regionalClubs.push(club);
      return;
    }
    const nr = ziel || getClubDivision(gameState, name) || anzahl;
    neuePools[nr - 1].push(club);
  });
  regional.up.forEach(club => neuePools[anzahl - 1].push(club));
  gameState.leaguePools = neuePools;
  gameState.leagueOnePool = neuePools[0];   // Rueckwaertskompatibel
  gameState.leagueTwoPool = neuePools[1];

  const inRegionalliga = neueZuordnung.get(gameState.clubName) === 0;
  const neueEigene = inRegionalliga ? playedDivision : (neueZuordnung.get(gameState.clubName) || playedDivision);
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
    ownRelegatedToRegional: inRegionalliga,
    regionalDown: regional.down,
    regionalUp: regional.up.map(c => c.name),
    ownDivisionNow: neueEigene,
    movements: bewegungen,
    driftChanges
  };
}


// ---------- Regionalliga ----------

function ensureRegionalClubs(gameState){
  if(!Array.isArray(gameState.regionalClubs)){
    const inLigen = new Set(getAllLeagueClubs(gameState).map(c => c.name));
    gameState.regionalClubs = clonePool(REGIONAL_CLUBS).filter(c => !inLigen.has(c.name));
  }
  return gameState.regionalClubs;
}

// Aufsteiger aus der Regionalliga: nach Staerke gewichtet, ohne Zuruecklegen.
function pickRegionalPromotions(gameState, anzahl){
  const kreis = ensureRegionalClubs(gameState);
  const gewaehlt = [];
  for(let i = 0; i < anzahl && kreis.length > 0; i++){
    const gewichte = kreis.map(c => Math.pow(Math.max(1, c.strength - 30), 2));
    let wurf = Math.random() * gewichte.reduce((s, g) => s + g, 0);
    let idx = 0;
    for(; idx < kreis.length - 1; idx++){ wurf -= gewichte[idx]; if(wurf <= 0) break; }
    const club = kreis.splice(idx, 1)[0];
    if(club.baseStrength == null) club.baseStrength = club.strength;
    gewaehlt.push(club);
  }
  return gewaehlt;
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

  // Ligen unterschiedlicher Groesse laufen synchron: eine Liga mit 38
  // Spieltagen spielt neben einer mit 34 gelegentlich zwei Runden, damit
  // beide zum Saisonende fertig sind (und umgekehrt mal keine).
  const eigeneSpieltage = getSeasonMatchdays(gameState);
  let gespielt = 0;
  Object.keys(shadows).forEach(nr => {
    const shadow = shadows[nr];
    const runden = getRoundsForTeams(shadow.teams.length);
    const ziel = Math.min(runden, Math.round(gameState.matchday * runden / eigeneSpieltage));
    while(shadow.matchday < ziel){
      gespielt += playShadowRound(gameState, shadow);
    }
  });

  return gespielt > 0 ? { matches: gespielt } : null;
}

// Eine Runde einer Parallelliga.
function playShadowRound(gameState, shadow){
  const runde = getRoundFixtures(shadow.fixtures, shadow.teams.length, shadow.matchday).filter(f => !f.played);
  if(runde.length === 0){ shadow.matchday++; return 0; }

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
  return runde.length;
}

// Welche Ligen laufen neben der eigenen? Nach Nummer sortiert.
function getShadowDivisionNumbers(gameState){
  if(!gameState.shadowLeagues) return [];
  return Object.keys(gameState.shadowLeagues).map(Number).sort((a, b) => a - b);
}


