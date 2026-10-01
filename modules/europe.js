// ============================================
// EUROPE.JS - Europapokal im Championsleague-Format
// ============================================
// 32 Teilnehmer: 4 aus der Bundesliga (Top 4 der Vorsaison) und 28 aus
// EURO_CLUBS. Acht Gruppen zu vier Mannschaften, Hin- und Rueckspiel,
// die besten zwei jeder Gruppe erreichen das Achtelfinale.

function createFreshEurope(qualified, context){
  const eu = {
    qualified: !!qualified,
    active: !!qualified,
    phase: "group",
    groups: [],
    groupMatchday: 0,
    ownGroup: null,
    knockoutTeams: [],
    knockoutRound: 0,
    eliminated: false,
    champion: false,
    winnerName: null,
    history: []
  };
  if(!qualified || !context) return eu;

  eu.groups = drawEuropeGroups(buildEuropeField(context));
  eu.ownGroup = findOwnGroupName(eu.groups, context.ownClubName);
  return eu;
}

// Startfeld: eigener Verein, drei weitere Bundesligisten, aufgefuellt mit
// europaeischen Vereinen.
function buildEuropeField(context){
  const field = [{ name: context.ownClubName, strength: context.ownStrength, isOwn: true }];

  (context.others || []).slice(0, 3).forEach(c => {
    field.push({ name: c.name, strength: c.strength, isOwn: false });
  });

  const needed = EUROPE_GROUP_COUNT * EUROPE_TEAMS_PER_GROUP - field.length;
  shuffleArray(EURO_CLUBS).slice(0, needed).forEach(c => {
    field.push({ name: c.name, strength: c.strength, isOwn: false });
  });

  return field;
}

// Lostoepfe nach Staerke: jede Gruppe bekommt genau einen Verein je Topf.
function drawEuropeGroups(field){
  const sorted = [...field].sort((a, b) => b.strength - a.strength);
  const pots = [];
  for(let i = 0; i < EUROPE_TEAMS_PER_GROUP; i++){
    pots.push(shuffleArray(sorted.slice(i * EUROPE_GROUP_COUNT, (i + 1) * EUROPE_GROUP_COUNT)));
  }

  const groups = [];
  for(let g = 0; g < EUROPE_GROUP_COUNT; g++){
    const teams = pots.map(pot => pot[g]).filter(Boolean).map(c => ({
      name: c.name, strength: c.strength, isOwn: !!c.isOwn,
      played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
    }));
    groups.push({
      name: EUROPE_GROUP_NAMES[g],
      teams: teams,
      fixtures: generateFixtures(teams.map(t => t.name))
    });
  }
  return groups;
}

function findOwnGroupName(groups, ownClubName){
  const group = groups.find(g => g.teams.some(t => t.name === ownClubName));
  return group ? group.name : null;
}

// Der eigene Verein spielt immer mit der aktuellen Teambewertung, damit
// Transfers und Aufstellung auch international durchschlagen.
function europeStrengthOf(gameState, name, fallback){
  if(name === gameState.clubName) return teamRating(gameState.squad, gameState.matchday + 1);
  return fallback != null ? fallback : 78;
}

// Auch international zaehlen Angriff und Abwehr getrennt.
function europeSides(gameState, name, fallback){
  if(name === gameState.clubName){
    const ad = getTeamAttackDefence(gameState.squad, gameState.matchday + 1);
    return { attack: ad.attack, defence: ad.defence };
  }
  const s = fallback != null ? fallback : 78;
  return { attack: s, defence: s };
}

function europeMatch(gameState, homeName, homeStrength, awayName, awayStrength){
  const h = europeSides(gameState, homeName, homeStrength);
  const a = europeSides(gameState, awayName, awayStrength);
  let lambdaHome = Math.max(0.3, 1.3 + (h.attack + 2 - a.defence) / 25);
  let lambdaAway = Math.max(0.3, 1.2 + (a.attack - (h.defence + 2)) / 25);

  if(homeName === gameState.clubName){
    const t = applyTactic(gameState, lambdaHome, lambdaAway);
    lambdaHome = t.own; lambdaAway = t.opp;
  } else if(awayName === gameState.clubName){
    const t = applyTactic(gameState, lambdaAway, lambdaHome);
    lambdaAway = t.own; lambdaHome = t.opp;
  }

  // Auch international kontern sich die Ausrichtungen.
  const heimTaktik = getTeamTactic(gameState, homeName, awayName, h.attack, a.attack);
  const gastTaktik = getTeamTactic(gameState, awayName, homeName, a.attack, h.attack);
  const konter = getTacticMatchup(heimTaktik, gastTaktik);
  lambdaHome = Math.max(0.25, lambdaHome + konter.own);
  lambdaAway = Math.max(0.25, lambdaAway + konter.opp);

  return { homeGoals: poisson(lambdaHome), awayGoals: poisson(lambdaAway) };
}

// ---------- Gruppenphase ----------

function simulateEuropeGroupMatchday(gameState){
  const eu = gameState.europe;
  if(!eu || !eu.active || eu.phase !== "group") return null;

  const md = eu.groupMatchday;
  const perMatchday = EUROPE_TEAMS_PER_GROUP / 2;
  let ownMatch = null;

  eu.groups.forEach(group => {
    group.fixtures.slice(md * perMatchday, (md + 1) * perMatchday).forEach(f => {
      const home = group.teams.find(t => t.name === f.home);
      const away = group.teams.find(t => t.name === f.away);
      const { homeGoals, awayGoals } = europeMatch(gameState, home.name, home.strength, away.name, away.strength);
      updateStandings(group.teams, f.home, f.away, homeGoals, awayGoals);
      f.played = true; f.homeGoals = homeGoals; f.awayGoals = awayGoals;

      if(f.home === gameState.clubName || f.away === gameState.clubName){
        const isHome = f.home === gameState.clubName;
        ownMatch = {
          opponent: isHome ? f.away : f.home,
          isHome: isHome,
          ownGoals: isHome ? homeGoals : awayGoals,
          oppGoals: isHome ? awayGoals : homeGoals,
          result: getResultForClub(gameState.clubName, f.home, f.away, homeGoals, awayGoals)
        };
      }
    });
  });

  eu.groupMatchday += 1;
  const result = {
    type: "group",
    matchday: eu.groupMatchday,
    totalMatchdays: EUROPE_GROUP_MATCHDAYS.length,
    ownMatch: ownMatch,
    ownStanding: getOwnGroupStanding(gameState)
  };

  if(eu.groupMatchday >= EUROPE_GROUP_MATCHDAYS.length){
    Object.assign(result, finishGroupStage(gameState));
  }
  return result;
}

function getOwnGroupStanding(gameState){
  const eu = gameState.europe;
  const group = (eu.groups || []).find(g => g.name === eu.ownGroup);
  if(!group) return null;
  const sorted = getSortedStandings(group.teams);
  return {
    groupName: group.name,
    position: sorted.findIndex(t => t.name === gameState.clubName) + 1,
    table: sorted
  };
}

function finishGroupStage(gameState){
  const eu = gameState.europe;
  const winners = [], runnersUp = [];

  eu.groups.forEach((group, idx) => {
    const sorted = getSortedStandings(group.teams);
    winners.push({ name: sorted[0].name, strength: sorted[0].strength, group: idx });
    runnersUp.push({ name: sorted[1].name, strength: sorted[1].strength, group: idx });
  });

  eu.knockoutTeams = [];
  drawRoundOf16(winners, runnersUp).forEach(pair => {
    eu.knockoutTeams.push(pair.home, pair.away);
  });
  eu.phase = "knockout";

  const standing = getOwnGroupStanding(gameState);
  const qualified = eu.knockoutTeams.some(t => t.name === gameState.clubName);

  if(!qualified){
    eu.eliminated = true;
    eu.exitLabel = "Gruppenphase";
    resolveRemainingEurope(gameState);
  }

  return {
    groupStageFinished: true,
    qualifiedForKnockout: qualified,
    ownStanding: standing,
    winnerName: eu.winnerName
  };
}

// Gruppensieger trifft auf einen Zweiten aus einer anderen Gruppe.
function drawRoundOf16(winners, runnersUp){
  for(let attempt = 0; attempt < 200; attempt++){
    const shuffled = shuffleArray(runnersUp);
    if(shuffled.every((r, i) => r.group !== winners[i].group)){
      return winners.map((w, i) => ({ home: w, away: shuffled[i] }));
    }
  }
  const shuffled = shuffleArray(runnersUp);
  return winners.map((w, i) => ({ home: w, away: shuffled[i] }));
}

// ---------- K.o.-Runde ----------

function playKnockoutPair(gameState, teamA, teamB){
  const { homeGoals, awayGoals } = europeMatch(gameState, teamA.name, teamA.strength, teamB.name, teamB.strength);
  const wasDraw = homeGoals === awayGoals;
  let winner;
  if(wasDraw){
    const diff = europeStrengthOf(gameState, teamA.name, teamA.strength)
               - europeStrengthOf(gameState, teamB.name, teamB.strength);
    const winProb = Math.max(0.15, Math.min(0.85, 0.5 + diff / 200));
    winner = Math.random() < winProb ? teamA : teamB;
  } else {
    winner = homeGoals > awayGoals ? teamA : teamB;
  }
  return { home: teamA, away: teamB, homeGoals, awayGoals, wasDraw, winner };
}

function simulateEuropeKnockoutRound(gameState){
  const eu = gameState.europe;
  if(!eu || !eu.active || eu.phase !== "knockout") return null;

  const teams = eu.knockoutTeams;
  const matches = [], winners = [];
  for(let i = 0; i < teams.length; i += 2){
    const match = playKnockoutPair(gameState, teams[i], teams[i + 1]);
    matches.push(match);
    winners.push(match.winner);
  }

  const roundLabel = EUROPE_KO_LABELS[eu.knockoutRound] || `Runde ${eu.knockoutRound + 1}`;
  eu.knockoutRound += 1;
  eu.knockoutTeams = shuffleArray(winners);

  const ownMatch = matches.find(m => m.home.name === gameState.clubName || m.away.name === gameState.clubName);
  let ownResult = null;
  if(ownMatch){
    const isHome = ownMatch.home.name === gameState.clubName;
    ownResult = {
      opponent: isHome ? ownMatch.away.name : ownMatch.home.name,
      opponentStrength: isHome ? ownMatch.away.strength : ownMatch.home.strength,
      isHome: isHome,
      ownGoals: isHome ? ownMatch.homeGoals : ownMatch.awayGoals,
      oppGoals: isHome ? ownMatch.awayGoals : ownMatch.homeGoals,
      wasDraw: ownMatch.wasDraw,
      won: ownMatch.winner.name === gameState.clubName
    };
    eu.history.push({
      round: roundLabel, opponent: ownResult.opponent, opponentStrength: ownResult.opponentStrength,
      ownGoals: ownResult.ownGoals, oppGoals: ownResult.oppGoals,
      won: ownResult.won, wasDraw: ownResult.wasDraw
    });
  }

  if(winners.length === 1){
    eu.winnerName = winners[0].name;
    eu.champion = winners[0].name === gameState.clubName;
    eu.active = false;
  } else if(ownResult && !ownResult.won){
    eu.eliminated = true;
    eu.exitLabel = `Aus im ${roundLabel}`;
    resolveRemainingEurope(gameState);
  }

  return {
    type: "knockout",
    roundLabel: roundLabel,
    ownMatch: ownResult,
    champion: eu.champion,
    winnerName: eu.winnerName,
    remaining: winners.length
  };
}

// Nach dem eigenen Ausscheiden laeuft der Wettbewerb in einem Rutsch zu Ende,
// damit ein Sieger feststeht und keine leeren Termine mehr anstehen.
function resolveRemainingEurope(gameState){
  const eu = gameState.europe;
  let guard = 0;
  while(eu.knockoutTeams.length > 1 && guard++ < 10){
    const winners = [];
    for(let i = 0; i < eu.knockoutTeams.length; i += 2){
      winners.push(playKnockoutPair(gameState, eu.knockoutTeams[i], eu.knockoutTeams[i + 1]).winner);
    }
    eu.knockoutTeams = shuffleArray(winners);
    eu.knockoutRound += 1;
  }
  if(eu.knockoutTeams.length === 1) eu.winnerName = eu.knockoutTeams[0].name;
  eu.active = false;
}

// ---------- Terminsteuerung ----------

function getEuropeEvent(gameState){
  const eu = gameState.europe;
  if(!eu || !eu.active) return null;
  const upcomingDay = gameState.matchday + 1;

  if(eu.phase === "group" && EUROPE_GROUP_MATCHDAYS[eu.groupMatchday] === upcomingDay){
    return { stage: "group", label: `Gruppenphase ${eu.groupMatchday + 1}/${EUROPE_GROUP_MATCHDAYS.length}` };
  }
  if(eu.phase === "knockout" && EUROPE_KO_MATCHDAYS[eu.knockoutRound] === upcomingDay){
    return { stage: "knockout", label: EUROPE_KO_LABELS[eu.knockoutRound] || "K.o.-Runde" };
  }
  return null;
}

function simulateEuropeEvent(gameState){
  const event = getEuropeEvent(gameState);
  if(!event) return null;
  return event.stage === "group"
    ? simulateEuropeGroupMatchday(gameState)
    : simulateEuropeKnockoutRound(gameState);
}
