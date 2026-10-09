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

// Termine (Pokal, Europapokal, Transferfenster, Vorstand) sind fuer 34
// Spieltage geplant und werden auf die Laenge der eigenen Saison gestreckt.
function scaleMatchday(md, gameState){
  const n = getSeasonMatchdays(gameState);
  if(n === TOTAL_MATCHDAYS) return md;
  return Math.max(1, Math.min(n, Math.round(md * n / TOTAL_MATCHDAYS)));
}
function getCupTriggerMatchdays(gameState){ return CUP_ROUND_TRIGGER_MATCHDAYS.map(m => scaleMatchday(m, gameState)); }
function getTransferWindows(gameState){
  return TRANSFER_WINDOWS.map(([a, b]) => [a === 1 ? 1 : scaleMatchday(a, gameState), scaleMatchday(b, gameState)]);
}
function getContractReminderMatchdays(gameState){ return CONTRACT_REMINDER_MATCHDAYS.map(m => scaleMatchday(m, gameState)); }

function getFixtureMatchday(idx, teamCount){
  return Math.floor(idx / getRoundSize(teamCount)) + 1;
}

// Spiel zweier Vereine ohne eigenen Kader. A hat Heimrecht, ausser neutral.
// Gleiche Formel wie die eigenen Spiele (getBaseLambdas/rollScore).
function simulateGenericMatch(strengthA, strengthB, neutral){
  const l = getBaseLambdas({ attack: strengthA, defence: strengthA },
    { attack: strengthB, defence: strengthB }, neutral);
  const r = rollScore(l.home, l.away);
  return { goalsA: r.homeGoals, goalsB: r.awayGoals };
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
  const { goalsA, goalsB } = simulateGenericMatch(teamA.strength, teamB.strength, true);
  if(goalsA === goalsB){
    const e = penaltyShootout(teamA.strength, teamB.strength);
    return e.home > e.away ? teamA : teamB;
  }
  return goalsA > goalsB ? teamA : teamB;
}


// Vereinsentwicklung zum Saisonende. Jeder Verein hat ein Fundament
// (baseStrength), das der tatsaechlichen Staerke langsam folgt, und ein
// Momentum (trend), das gute oder schlechte Phasen ueber mehrere Jahre
// traegt. Dazu kommen seltene Ereignisse wie ein Investor oder eine
// Finanzkrise. So entstehen ueber die Jahre neue Spitzenvereine und
// Abstuerze, und jede Karriere verlaeuft anders.
// Gegen Inflation und Verflachung wird die Staerkeverteilung je Land zu
// ihrer Ausgangsform zurueckgefuehrt: die Ligen behalten ihr Niveau, nur
// wer oben und unten steht, aendert sich.
function applyClubStrengthDrift(clubs, standingsMap, movementMap, opts){
  opts = opts || {};
  const eigener = opts.ownClub || null;
  const changes = [];
  const events = [];

  // Erwartete Platzierung = Rang nach Staerke innerhalb der gespielten Liga.
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

  const vorher = new Map(clubs.map(c => [c.name, c.strength]));
  const begrenzen = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

  clubs.forEach(club => {
    if(club.name === eigener) return;   // folgt dem Kader des Spielers
    if(club.baseStrength == null) club.baseStrength = club.strength;
    if(club.origStrength == null) club.origStrength = club.baseStrength;
    if(club.trend == null) club.trend = 0;

    const entry = standingsMap.get(club.name);
    const raenge = entry ? expectedRank.get(club.name) - entry.position : 0;
    const perf = begrenzen(raenge * CLUB_DEV_PER_RANK, -CLUB_DEV_PERF_MAX, CLUB_DEV_PERF_MAX);

    // Serienmeister: mit jedem Titel in Folge steigt das Risiko eines
    // Umbruchs (Leistungstraeger gehen, der Kader altert).
    const meister = entry && entry.position === 1 && isTopDivision(entry.division);
    club.titleStreak = meister ? (club.titleStreak || 0) + 1 : 0;

    // Seltene Ereignisse geben einen Schub, der ueber Jahre nachwirkt.
    let schub = 0;
    const wurf = Math.random();
    const umbruch = Math.min(CLUB_DEV_DYNASTY_MAX, CLUB_DEV_DYNASTY_PER_TITLE * Math.max(0, club.titleStreak - 1));
    if(umbruch > 0 && Math.random() < umbruch){
      schub = -randFloat(CLUB_DEV_DYNASTY_HIT_MIN, CLUB_DEV_DYNASTY_HIT_MAX);
      club.titleStreak = 0;
      events.push({ name: club.name, type: "umbruch", division: entry.division });
    } else if(wurf < CLUB_DEV_EVENT_CHANCE){
      schub = randFloat(CLUB_DEV_EVENT_MIN, CLUB_DEV_EVENT_MAX);
      events.push({ name: club.name, type: "investor", division: entry ? entry.division : null });
    } else if(wurf < 2 * CLUB_DEV_EVENT_CHANCE){
      schub = -randFloat(CLUB_DEV_EVENT_MIN, CLUB_DEV_EVENT_MAX);
      events.push({ name: club.name, type: "krise", division: entry ? entry.division : null });
    }
    club.trend = Math.round((club.trend * CLUB_DEV_TREND_DECAY + perf * CLUB_DEV_TREND_FROM_PERF + schub) * 100) / 100;

    let delta = CLUB_DEV_REVERSION * (club.baseStrength - club.strength)
              + perf + club.trend
              + randFloat(-CLUB_DEV_NOISE, CLUB_DEV_NOISE);
    const movement = movementMap.get(club.name);
    if(movement === "promoted") delta += AI_DRIFT_PROMOTION_BOOST;
    else if(movement === "relegated") delta += AI_DRIFT_RELEGATION_HIT;
    delta = begrenzen(delta, -CLUB_DEV_MAX_PER_SEASON, CLUB_DEV_MAX_PER_SEASON);

    const next = begrenzen(club.strength + delta, AI_STRENGTH_FLOOR, AI_STRENGTH_CEILING);
    club.strength = Math.round(next * 10) / 10;
    club.baseStrength = Math.round((club.baseStrength
      + CLUB_DEV_BASE_FOLLOW * (club.strength - club.baseStrength)
      + CLUB_DEV_ORIGIN_PULL * (club.origStrength - club.baseStrength)) * 10) / 10;
  });

  normalizeCountryStrengths(clubs, standingsMap, eigener);

  clubs.forEach(club => {
    if(club.name === eigener) return;
    const before = vorher.get(club.name);
    changes.push({ name: club.name, before, after: club.strength, delta: club.strength - before,
      division: standingsMap.get(club.name) ? standingsMap.get(club.name).division : null });
  });
  changes.events = events;
  return changes;
}

// Der eigene Verein steht im Ligapool mit der Staerke seines Kaders. So
// zeigen Ligenansicht und Stellenmarkt den echten Wert, und beim Abschied
// behaelt der Verein, was der Trainer aufgebaut hat.
function syncOwnClubStrength(gameState){
  const club = findClubEverywhere(gameState, gameState.clubName);
  if(!club || !(gameState.squad || []).length) return null;
  const wert = Math.max(AI_STRENGTH_FLOOR, Math.min(AI_STRENGTH_CEILING, teamRating(gameState.squad, 1)));
  club.strength = Math.round(wert * 10) / 10;
  club.baseStrength = club.strength;
  club.trend = 0;
  return club;
}

// Staerkeverteilung je Land zu Karrierebeginn (auch mit importierten
// Vereinsstaerken). Aeltere Staende halten sie beim ersten Saisonende fest.
function ensureStrengthProfiles(gameState){
  if(gameState.strengthProfiles) return gameState.strengthProfiles;
  const profile = {};
  COUNTRIES.forEach(land => {
    profile[land.key] = getCountryDivisions(land.key)
      .flatMap(d => getLeaguePool(gameState, d.nr).map(c => ({ name: c.name, strength: c.strength })));
  });
  gameState.strengthProfiles = profile;
  return profile;
}

// Staerken eines Landes zum Start, absteigend sortiert.
function getCountryStrengthProfile(country, ohne){
  const gs = typeof gameState !== "undefined" ? gameState : null;
  const gespeichert = gs && gs.strengthProfiles && gs.strengthProfiles[country];
  const liste = gespeichert || getCountryDivisions(country).flatMap(d => d.clubs || []);
  return liste.filter(c => c.name !== ohne).map(c => c.strength).sort((a, b) => b - a);
}

// Wert an Rangposition q (0 = Spitze, 1 = Ende) der Ausgangsverteilung.
function profileValueAt(profil, q){
  const x = q * (profil.length - 1);
  const i = Math.floor(x), f = x - i;
  return i + 1 < profil.length ? profil[i] * (1 - f) + profil[i + 1] * f : profil[profil.length - 1];
}

// Jeder Verein wird schrittweise zu dem Wert gezogen, den sein Rang im Land
// zum Spielstart hatte. So gibt es immer einen Spitzenverein auf dem alten
// Spitzenniveau, aber wer oben steht, wechselt.
function normalizeCountryStrengths(clubs, standingsMap, eigener){
  const jeLand = new Map();
  clubs.forEach(c => {
    const entry = standingsMap.get(c.name);
    if(!entry || c.name === eigener) return;
    const land = getDivisionCountry(entry.division);
    if(!jeLand.has(land)) jeLand.set(land, []);
    jeLand.get(land).push(c);
  });
  jeLand.forEach((liste, land) => {
    const profil = getCountryStrengthProfile(land, eigener);
    if(profil.length < 2 || liste.length < 2) return;
    [...liste].sort((a, b) => b.strength - a.strength).forEach((c, i) => {
      const ziel = profileValueAt(profil, i / (liste.length - 1));
      const schritt = CLUB_DEV_SPREAD_CORRECTION * (ziel - c.strength);
      c.strength = Math.round(Math.max(AI_STRENGTH_FLOOR, Math.min(AI_STRENGTH_CEILING, c.strength + schritt)) * 10) / 10;
      if(c.baseStrength != null) c.baseStrength = Math.round((c.baseStrength + schritt) * 10) / 10;
    });
  });
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

// ---------- Laender ----------

function getCountryConfig(key){
  return COUNTRIES.find(c => c.key === key) || COUNTRIES[0];
}

function getDivisionCountry(nr){
  return getDivisionConfig(nr).country || "de";
}

// Ligen eines Landes, von oben nach unten.
function getCountryDivisions(country){
  return DIVISIONS.filter(d => (d.country || "de") === country).sort((a, b) => a.tier - b.tier);
}

function isTopDivision(nr){
  return (getDivisionConfig(nr).tier || 1) === 1;
}

function getOwnCountry(gameState){
  const gs = gameState || (typeof window !== "undefined" ? window.gameState : null);
  return getDivisionCountry(gs && gs.division ? gs.division : 1);
}

function getCupName(gameState){
  return getCountryConfig(getOwnCountry(gameState)).cup;
}

// Flagge, wo der Browser sie zeichnen kann, sonst das Laenderkuerzel.
function getCountryBadge(country){
  const c = getCountryConfig(country);
  const flaggen = typeof browserSupportsFlags === "function" ? browserSupportsFlags() : true;
  return flaggen ? c.flag : c.code;
}

// Kurzbezeichnung mit Land, z.B. "🏴 PL" — nur ausserhalb Deutschlands,
// damit die gewohnten Bundesliga-Anzeigen unveraendert bleiben.
function getDivisionTag(nr){
  const d = getDivisionConfig(nr);
  return d.country && d.country !== "de" ? `${getCountryBadge(d.country)} ${d.short}` : d.short;
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
// Auf- und Abstieg in allen Laendern
// ============================================
// Jedes Land fuer sich: an jeder Nahtstelle gilt die Regel der oberen Liga
// (DIVISIONS[].seam), unter der untersten Liga liegt der Reservekreis.

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

// Mini-Play-off: Plaetze paarweise (bester gegen schlechtesten), Sieger weiter.
function runPlayoffBracket(teams){
  let runde = [...teams];
  while(runde.length > 1){
    const weiter = [];
    if(runde.length % 2 === 1) weiter.push(runde.shift());   // bester hat ein Freilos
    for(let i = 0; i < runde.length / 2; i++){
      weiter.push(resolvePlayoff(runde[i], runde[runde.length - 1 - i]));
    }
    runde = weiter;
  }
  return runde[0];
}

// Eine Nahtstelle abwickeln. Liefert die Namen der Bewegungen.
function resolveSeam(seam, obenTab, untenTab){
  const res = { down: [], up: [], playoffWinnerName: "", playoffLoserName: "", playoffLabel: "" };
  if(obenTab.length < 4 || untenTab.length < 4) return res;
  res.down = obenTab.slice(-seam.directDown).map(t => t.name);
  res.up = untenTab.slice(0, seam.directUp).map(t => t.name);
  const p = seam.playoff;
  if(!p) return res;

  if(p.type === "relegation"){
    const oben = obenTab[obenTab.length - seam.directDown - 1], unten = untenTab[seam.directUp];
    const sieger = resolvePlayoff(oben, unten);
    const verlierer = sieger.name === oben.name ? unten : oben;
    if(sieger.name === unten.name){ res.up.push(unten.name); res.down.push(oben.name); }
    res.playoffWinnerName = sieger.name; res.playoffLoserName = verlierer.name;
    res.playoffLabel = "Relegation";
  } else if(p.type === "playoff"){
    const teilnehmer = p.positions.map(pos => untenTab[pos - 1]).filter(Boolean);
    const sieger = runPlayoffBracket(teilnehmer);
    res.up.push(sieger.name);
    res.playoffWinnerName = sieger.name;
    res.playoffLabel = "Aufstiegs-Play-offs";
  } else if(p.type === "barrage"){
    const teilnehmer = [...p.positions].reverse().map(pos => untenTab[pos - 1]).filter(Boolean);
    // Fuenfter gegen Vierten, Sieger gegen Dritten, dann gegen den Drittletzten oben.
    let unten = teilnehmer[0];
    for(let i = 1; i < teilnehmer.length; i++) unten = resolvePlayoff(teilnehmer[i], unten);
    const oben = obenTab[obenTab.length - seam.directDown - 1];
    const sieger = resolvePlayoff(oben, unten);
    if(sieger.name === unten.name){ res.up.push(unten.name); res.down.push(oben.name); }
    res.playoffWinnerName = sieger.name;
    res.playoffLoserName = sieger.name === oben.name ? unten.name : oben.name;
    res.playoffLabel = "Barrage";
  }
  return res;
}

function processPromotionRelegation(gameState){
  ensureLeaguePools(gameState);
  ensureStrengthProfiles(gameState);
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
  const reserve = { down: [], up: [], byCountry: {} };
  const reserveUp = [];

  COUNTRIES.forEach(land => {
    const ligen = getCountryDivisions(land.key).filter(d => d.nr <= anzahl);
    for(let i = 0; i + 1 < ligen.length; i++){
      const oben = ligen[i].nr, unten = ligen[i + 1].nr;
      const seam = ligen[i].seam || SEAM_DE;
      const r = resolveSeam(seam, standings[oben], standings[unten]);
      r.down.forEach(n => neueZuordnung.set(n, unten));
      r.up.forEach(n => neueZuordnung.set(n, oben));
      bewegungen.push({
        oben, unten, country: land.key,
        relegatedNames: r.down, promotedNames: r.up,
        playoffWinnerName: r.playoffWinnerName, playoffLoserName: r.playoffLoserName,
        playoffLabel: r.playoffLabel
      });
    }

    // Unterste Liga gegen den Reservekreis.
    const unterste = ligen[ligen.length - 1];
    const tab = unterste ? standings[unterste.nr] : null;
    const n = land.reserve ? land.reserve.swaps : 0;
    if(tab && n > 0 && tab.length > n + 4){
      ensureReservePool(gameState, land.key);
      const runter = tab.slice(-n).map(t => t.name);
      runter.forEach(name => neueZuordnung.set(name, 0));
      const hoch = pickReservePromotions(gameState, land.key, n);
      hoch.forEach(c => reserveUp.push({ club: c, nr: unterste.nr }));
      reserve.byCountry[land.key] = { down: runter, up: hoch.map(c => c.name), label: land.reserve.label };
      reserve.down.push(...runter);
      reserve.up.push(...hoch.map(c => c.name));
    }
  });

  // Neue Ligapools aufbauen.
  const neuePools = Array.from({ length: anzahl }, () => []);
  alleVereine.forEach((club, name) => {
    const ziel = neueZuordnung.get(name);
    if(ziel === 0){
      // In den Reservekreis: Verein verlaesst die Ligen, schwaecht sich etwas ab.
      const land = getDivisionCountry(getClubDivision(gameState, name) || anzahl);
      club.strength = Math.max(AI_STRENGTH_FLOOR, Math.round((club.strength - REGIONAL_RELEGATION_STRENGTH_LOSS) * 10) / 10);
      ensureReservePool(gameState, land).push(club);
      return;
    }
    const nr = ziel || getClubDivision(gameState, name) || anzahl;
    neuePools[nr - 1].push(club);
  });
  reserveUp.forEach(r => neuePools[r.nr - 1].push(r.club));
  gameState.leaguePools = neuePools;
  gameState.leagueOnePool = neuePools[0];   // Rueckwaertskompatibel
  gameState.leagueTwoPool = neuePools[1];

  const inReserve = neueZuordnung.get(gameState.clubName) === 0;
  const neueEigene = inReserve ? playedDivision : (neueZuordnung.get(gameState.clubName) || playedDivision);
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
    getAllLeagueClubs(gameState), standingsMap, movementMap, { ownClub: gameState.clubName });
  syncOwnClubStrength(gameState);

  // Die Nahtstelle der eigenen Liga fuer die Meldungen heraussuchen.
  const eigene = bewegungen.find(b => b.oben === playedDivision || b.unten === playedDivision)
    || { relegatedNames: [], promotedNames: [], playoffWinnerName: "", playoffLoserName: "" };
  const ownLand = getDivisionCountry(playedDivision);
  const ownReserve = reserve.byCountry[ownLand] || { down: [], up: [], label: "" };

  return {
    relegatedNames: eigene.relegatedNames,
    promotedNames: eigene.promotedNames,
    playoffWinnerName: eigene.playoffWinnerName,
    playoffLoserName: eigene.playoffLoserName,
    playoffLabel: eigene.playoffLabel,
    ownWasPromoted: neueEigene < playedDivision,
    ownWasRelegated: neueEigene > playedDivision,
    ownRelegatedToRegional: inReserve,
    reserveLabel: ownReserve.label,
    regionalDown: ownReserve.down,
    regionalUp: ownReserve.up,
    reserveByCountry: reserve.byCountry,
    ownDivisionNow: neueEigene,
    movements: bewegungen,
    standings,
    driftChanges
  };
}


// ---------- Reservekreise (Regionalliga, League One, ...) ----------

function ensureReservePool(gameState, country){
  gameState.reservePools = gameState.reservePools || {};
  // Aeltere Spielstaende fuehrten nur die Regionalliga.
  if(!gameState.reservePools.de && Array.isArray(gameState.regionalClubs)){
    gameState.reservePools.de = gameState.regionalClubs;
  }
  if(!Array.isArray(gameState.reservePools[country])){
    const inLigen = new Set(getAllLeagueClubs(gameState).map(c => c.name));
    const land = getCountryConfig(country);
    gameState.reservePools[country] = clonePool((land.reserve && land.reserve.clubs) || []).filter(c => !inLigen.has(c.name));
  }
  if(country === "de") gameState.regionalClubs = gameState.reservePools.de;
  return gameState.reservePools[country];
}

function ensureRegionalClubs(gameState){
  return ensureReservePool(gameState, "de");
}

// Aufsteiger aus dem Reservekreis: nach Staerke gewichtet, ohne Zuruecklegen.
function pickReservePromotions(gameState, country, anzahl){
  const kreis = ensureReservePool(gameState, country);
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

function pickRegionalPromotions(gameState, anzahl){
  return pickReservePromotions(gameState, "de", anzahl);
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
    const { goalsA, goalsB } = simulateGenericMatch(home.strength, away.strength);
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


