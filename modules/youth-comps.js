// ============================================
// YOUTH-COMPS.JS - Jugendwettbewerbe
// ============================================
// Die Jugendmannschaft spielt eine eigene Liga mit Tabelle gegen die
// Jugendteams der Vereine des Landes (Staerke nach Verein und Akademie).
// Wer in der Champions League spielt, ist mit der Jugend in der UEFA Youth
// League dabei (K.-o.-Runden ueber die Saison verteilt).

// Jugendstaerke eines KI-Vereins: Talentniveau plus Akademie nach Profil.
function getAiYouthStrength(gameState, club){
  const profil = typeof getClubProfileKey === "function" ? getClubProfileKey(gameState, club.name) : "solide";
  const akademie = AI_ACADEMY_BONUS[profil] != null ? AI_ACADEMY_BONUS[profil] : 0.5;
  return getYouthBaseStrength(club.strength) + YOUTH_OPPONENT_EDGE + akademie - 0.5 + randFloat(-1.5, 1.5);
}

function getYouthLeagueName(gameState){
  const namen = YOUTH_LEAGUE_NAMES[getOwnCountry(gameState)] || ["U19-Liga", "U19-Liga"];
  return isTopDivision(gameState.division || 1) ? namen[0] : namen[1];
}

// Liga: der eigene Verein und die im Niveau naechsten Vereine des Landes.
function createYouthLeague(gameState){
  const land = getOwnCountry(gameState);
  const spieltage = getSeasonMatchdays(gameState);
  let anzahl = Math.min(YOUTH_LEAGUE_MAX_TEAMS, Math.floor(spieltage / 2) + 1);
  const eigene = gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState);
  const andere = getCountryDivisions(land).flatMap(d => getLeaguePool(gameState, d.nr))
    .filter(c => c.name !== gameState.clubName)
    .sort((a, b) => Math.abs(a.strength - eigene) - Math.abs(b.strength - eigene));
  anzahl = Math.min(anzahl, andere.length + 1);
  if(anzahl % 2 === 1) anzahl -= 1;
  if(anzahl < 4) return null;
  const teams = [{ name: gameState.clubName, strength: null }]
    .concat(andere.slice(0, anzahl - 1).map(c => ({ name: c.name, strength: Math.round(getAiYouthStrength(gameState, c) * 10) / 10 })))
    .map(t => Object.assign(t, { played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0 }));
  return {
    season: gameState.season, name: getYouthLeagueName(gameState),
    teams, fixtures: generateFixtures(shuffleArray(teams.map(t => t.name))), round: 0
  };
}

function getYouthLeagueRounds(league){
  return league ? getRoundsForTeams(league.teams.length) : 0;
}

function recordYouthResult(teams, home, away, gh, ga){
  const h = teams.find(t => t.name === home), a = teams.find(t => t.name === away);
  if(!h || !a) return;
  h.played++; a.played++;
  h.gf += gh; h.ga += ga; a.gf += ga; a.ga += gh;
  if(gh > ga){ h.won++; a.lost++; h.points += 3; }
  else if(gh < ga){ a.won++; h.lost++; a.points += 3; }
  else { h.drawn++; a.drawn++; h.points++; a.points++; }
}

function getYouthLeagueTable(league){
  return league ? getSortedStandings(league.teams) : [];
}

// Naechster Gegner der eigenen Jugend in der Liga (oder null, wenn die
// Liga durch ist: dann gibt es Testspiele).
function getYouthLeagueFixture(gameState){
  const l = gameState.youthLeague;
  if(!l || l.round >= getYouthLeagueRounds(l)) return null;
  const runde = getRoundFixtures(l.fixtures, l.teams.length, l.round);
  const f = runde.find(x => x.home === gameState.clubName || x.away === gameState.clubName);
  if(!f) return null;
  const gegner = f.home === gameState.clubName ? f.away : f.home;
  return { fixture: f, opponent: gegner, home: f.home === gameState.clubName,
    strength: (l.teams.find(t => t.name === gegner) || {}).strength || 50 };
}

// Spielt die uebrigen Partien der Runde und schliesst sie ab.
function completeYouthLeagueRound(gameState, eigenesErgebnis){
  const l = gameState.youthLeague;
  if(!l || l.round >= getYouthLeagueRounds(l)) return;
  const runde = getRoundFixtures(l.fixtures, l.teams.length, l.round);
  runde.forEach(f => {
    if(f.played) return;
    let gh, ga;
    if(eigenesErgebnis && (f.home === gameState.clubName || f.away === gameState.clubName)){
      const heim = f.home === gameState.clubName;
      gh = heim ? eigenesErgebnis.own : eigenesErgebnis.opp;
      ga = heim ? eigenesErgebnis.opp : eigenesErgebnis.own;
    } else {
      const sh = (l.teams.find(t => t.name === f.home) || {}).strength || 55;
      const sa = (l.teams.find(t => t.name === f.away) || {}).strength || 55;
      const r = simulateGenericMatch(sh, sa);
      gh = r.goalsA; ga = r.goalsB;
    }
    f.played = true; f.homeGoals = gh; f.awayGoals = ga;
    recordYouthResult(l.teams, f.home, f.away, gh, ga);
  });
  l.round++;
}

// ---------- UEFA Youth League ----------

function createYouthCup(gameState){
  const u = gameState.uefa;
  if(!u || u.own !== "cl" || !u.comps || !u.comps.cl) return null;
  const andere = shuffleArray(u.comps.cl.teams.filter(t => t.name !== gameState.clubName)).slice(0, 15);
  const teams = [{ name: gameState.clubName, strength: null }]
    .concat(andere.map(t => ({ name: t.name, strength: Math.round((getYouthBaseStrength(t.strength) + YOUTH_OPPONENT_EDGE + randFloat(0, 2.5)) * 10) / 10 })));
  return {
    season: gameState.season, name: YOUTH_CUP_NAME, teams,
    alive: shuffleArray(teams.map(t => t.name)), round: 0,
    matchdays: YOUTH_CUP_MATCHDAYS.map(m => scaleMatchday(m, gameState)),
    results: [], winner: null
  };
}

function getYouthCupStrength(gameState, cup, name, eigene){
  if(name === gameState.clubName) return eigene;
  return (cup.teams.find(t => t.name === name) || {}).strength || 55;
}

// Eine K.-o.-Runde, wenn ihr Spieltag erreicht ist.
function playYouthCupRound(gameState, eigeneStaerke, sofort){
  const c = gameState.youthCup;
  if(!c || c.winner || c.round >= YOUTH_CUP_ROUNDS.length) return null;
  if(!sofort && gameState.matchday + 1 !== c.matchdays[c.round]) return null;
  const weiter = [];
  let eigenes = null;
  for(let i = 0; i + 1 < c.alive.length; i += 2){
    const a = c.alive[i], b = c.alive[i + 1];
    const r = simulateGenericMatch(getYouthCupStrength(gameState, c, a, eigeneStaerke), getYouthCupStrength(gameState, c, b, eigeneStaerke), true);
    let sieger = r.goalsA > r.goalsB ? a : r.goalsB > r.goalsA ? b : (Math.random() < 0.5 ? a : b);
    const elfmeter = r.goalsA === r.goalsB;
    weiter.push(sieger);
    const eintrag = { round: c.round, a, b, ga: r.goalsA, gb: r.goalsB, winner: sieger, pens: elfmeter };
    c.results.push(eintrag);
    if(a === gameState.clubName || b === gameState.clubName) eigenes = eintrag;
  }
  c.alive = weiter;
  const runde = YOUTH_CUP_ROUNDS[c.round];
  c.round++;
  if(c.alive.length === 1) c.winner = c.alive[0];
  if(eigenes){
    const heim = eigenes.a === gameState.clubName;
    const gegner = heim ? eigenes.b : eigenes.a;
    const tore = heim ? `${eigenes.ga}:${eigenes.gb}` : `${eigenes.gb}:${eigenes.ga}`;
    const gewonnen = eigenes.winner === gameState.clubName;
    addLogEntry(gameState, `🌟 ${YOUTH_CUP_NAME}, ${runde}: ${tore} gegen ${gegner}${eigenes.pens ? " (i. E.)" : ""} · ${gewonnen ? (c.winner ? "Titel!" : "weiter") : "ausgeschieden"}`, gewonnen ? "win" : "loss");
  }
  return eigenes;
}

// ---------- Saisonstart und -ende ----------

function createYouthCompetitions(gameState){
  gameState.youthLeague = createYouthLeague(gameState);
  gameState.youthCup = createYouthCup(gameState);
}

// Meister und Youth-League-Sieger; Titel fuer die eigene Akademie.
function finishYouthCompetitions(gameState){
  const titel = [];
  const l = gameState.youthLeague;
  // Restliche Runden ohne eigene Beteiligung zu Ende spielen.
  while(l && l.round < getYouthLeagueRounds(l)){
    const f = getYouthLeagueFixture(gameState);
    const eigene = getYouthTeamStrength(getYouthLineup(gameState, (gameState.matchday || 0) + 1), gameState);
    const r = f ? simulateGenericMatch(f.home ? eigene : f.strength, f.home ? f.strength : eigene) : null;
    completeYouthLeagueRound(gameState, r ? { own: f.home ? r.goalsA : r.goalsB, opp: f.home ? r.goalsB : r.goalsA } : null);
  }
  const skala = typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1;
  if(l){
    const meister = getYouthLeagueTable(l)[0];
    if(meister){
      // Jugendtitel zaehlen nicht als Trainertitel: Chronik und Liga-News statt Ehrentafel.
      if(typeof addNews === "function") addNews(gameState, `${meister.name} ist Meister der ${l.name}.`, "🌱");
      if(meister.name === gameState.clubName){
        const praemie = Math.round(YOUTH_LEAGUE_PRIZE * skala / 10000) * 10000;
        gameState.budget = addToBudget(gameState.budget, praemie);
        titel.push({ season: gameState.season, label: l.name });
        changeAcademyReputation(gameState, ACADEMY_REP_U19_TITLE, `Meister der ${l.name}`);
        addLogEntry(gameState, `🏆 Die Jugend ist Meister der ${l.name}! Prämie ${fmtMoney(praemie)}.`, "win", true);
      }
    }
  }
  const c = gameState.youthCup;
  while(c && !c.winner && c.round < YOUTH_CUP_ROUNDS.length){
    playYouthCupRound(gameState, getYouthTeamStrength(getYouthLineup(gameState, 1), gameState), true);
  }
  if(c && c.winner){
    if(typeof addNews === "function") addNews(gameState, `${c.winner} gewinnt die ${YOUTH_CUP_NAME}.`, "🌟");
    if(c.winner === gameState.clubName){
      const praemie = Math.round(YOUTH_CUP_PRIZE * skala / 10000) * 10000;
      gameState.budget = addToBudget(gameState.budget, praemie);
      titel.push({ season: gameState.season, label: YOUTH_CUP_NAME });
      changeAcademyReputation(gameState, ACADEMY_REP_YOUTH_LEAGUE_TITLE, `Sieg in der ${YOUTH_CUP_NAME}`);
      addLogEntry(gameState, `🏆 Die Jugend gewinnt die ${YOUTH_CUP_NAME}! Prämie ${fmtMoney(praemie)}.`, "win", true);
    }
  }
  if(titel.length){
    const a = ensureAcademy(gameState);
    a.titles = titel.concat(a.titles).slice(0, 30);
  }
  return titel;
}

// ---------- KI-Akademien ----------

// Neuzugaenge im Bestand: ein Teil stammt aus der eigenen Akademie des
// Vereins; gute Akademien (Ausbildungsvereine) bringen mehr Potenzial.
function markAiHomegrown(gameState, player, club){
  if(!club || club.tier === "ausland" || !club.nat || player.nat !== club.nat) return;
  if(Math.random() > AI_HOMEGROWN_SHARE) return;
  const profil = typeof getClubProfileKey === "function" ? getClubProfileKey(gameState, club.name) : "solide";
  const bonus = AI_ACADEMY_BONUS[profil] != null ? AI_ACADEMY_BONUS[profil] : 0.5;
  player.homegrownAt = club.name;
  const d = Math.round(bonus + randFloat(-1, 1));
  if(d !== 0 && typeof shiftPlayerPotential === "function") shiftPlayerPotential(player, d);
}

// Eine Meldung pro Saison: das groesste Juwel einer Akademie im eigenen Land.
function announceAiJewel(gameState, neue){
  const land = getOwnCountry(gameState);
  const juwel = neue.filter(p => p.homegrownAt && p.maxStrength >= 84
    && getDivisionCountry(getClubDivision(gameState, p.homegrownAt) || 1) === land)
    .sort((a, b) => b.maxStrength - a.maxStrength)[0];
  if(juwel && typeof addNews === "function"){
    addNews(gameState, `${juwel.homegrownAt}: Eigengewächs ${juwel.name} (${juwel.age}) gilt als Juwel der Akademie.`, "🌱");
  }
}
