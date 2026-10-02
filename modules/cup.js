// ============================================
// CUP.JS - DFB-Pokal (K.O.-Wettbewerb parallel zur Liga)
// ============================================

// shuffleArray liegt bei den Zufallshelfern in players.js.

// Teilnehmerfeld: alle Erstligisten des eigenen Landes, aufgefuellt mit
// gezogenen Vereinen der unteren Ligen. Der eigene Verein ist immer dabei.
function drawCupField(gameState, country){
  ensureLeaguePools(gameState);
  const land = country || getOwnCountry(gameState);
  const ligen = getCountryDivisions(land);
  const erstliga = ligen.length ? getLeaguePool(gameState, ligen[0].nr).map(c => c.name) : [];
  if(erstliga.length === 0){
    return shuffleArray((gameState.teams || []).map(t => t.name));
  }

  // Die naechsthoehere Liga zuerst, damit das Feld eine Pyramide bleibt.
  const field = [...erstliga].slice(0, CUP_FIELD_SIZE);
  const unten = [];
  ligen.slice(1).forEach(d => unten.push(...shuffleArray(getLeaguePool(gameState, d.nr).map(c => c.name))));

  let kandidaten = unten.filter(n => !field.includes(n));
  if(!country && !field.includes(gameState.clubName) && kandidaten.includes(gameState.clubName)){
    kandidaten = [gameState.clubName, ...kandidaten.filter(n => n !== gameState.clubName)];
  }
  field.push(...kandidaten.slice(0, Math.max(0, CUP_FIELD_SIZE - field.length)));

  return shuffleArray(field);
}

// Pokal eines anderen Landes: schnell im Hintergrund ausgespielt, nur der
// Sieger zaehlt (Nachrichten, Ligen-Ansicht).
function simulateForeignCup(gameState, country){
  let teams = drawCupField(gameState, country);
  const staerke = name => { const c = findClubEverywhere(gameState, name); return c ? c.strength : 50; };
  while(teams.length > 1){
    const weiter = [];
    if(teams.length % 2 === 1) weiter.push(teams.pop());
    for(let i = 0; i < teams.length; i += 2){
      const h = teams[i], a = teams[i + 1];
      const r = simulateGenericMatch(staerke(h), staerke(a), teams.length === 2);
      if(r.goalsA === r.goalsB){
        const e = penaltyShootout(staerke(h), staerke(a));
        weiter.push(e.home > e.away ? h : a);
      } else weiter.push(r.goalsA > r.goalsB ? h : a);
    }
    teams = shuffleArray(weiter);
  }
  return teams[0] || null;
}

function createFreshCup(gameState){
  return {
    active: true,
    round: 0,
    teamsRemaining: drawCupField(gameState),
    eliminated: false,
    champion: null,
    history: []
  };
}

// Spielklasse im eigenen Land (1 = oberste Liga).
function getCupDivisionRank(gameState, name){
  const nr = typeof getClubDivision === "function" ? getClubDivision(gameState, name) : null;
  return nr ? (getDivisionConfig(nr).tier || nr) : 2;
}

function simulateCupRound(gameState){
  const cup = gameState.cup;
  if(!cup || !cup.active || cup.champion) return null;

  let teams = shuffleArray(cup.teamsRemaining);
  if(teams.length <= 1){
    if(teams.length === 1) cup.champion = teams[0];
    cup.active = false;
    return null;
  }

  let byeTeam = null;
  if(teams.length % 2 === 1){
    byeTeam = teams.pop();
  }

  const matches = [];
  const winners = [];

  for(let i = 0; i < teams.length; i += 2){
    let home = teams[i], away = teams[i + 1];

    // Wie im echten Pokal: der klassentiefere Verein hat Heimrecht.
    if(getCupDivisionRank(gameState, away) > getCupDivisionRank(gameState, home)){
      const tmp = home; home = away; away = tmp;
    }

    const nach90 = simulateMatch(gameState, home, away);
    let homeGoals = nach90.homeGoals, awayGoals = nach90.awayGoals;
    let winner, ko = null;
    if(homeGoals === awayGoals){
      // Verlaengerung und, wenn noetig, Elfmeterschiessen.
      const l = getMatchLambdas(gameState, home, away);
      ko = resolveKnockoutDraw(l.home, l.away, getTeamStrength(gameState, home), getTeamStrength(gameState, away));
      homeGoals += ko.etHome; awayGoals += ko.etAway;
      winner = ko.homeWins ? home : away;
    } else {
      winner = homeGoals > awayGoals ? home : away;
    }
    const loser = winner === home ? away : home;
    matches.push({
      home, away, homeGoals, awayGoals, winner, wasDraw: !!ko,
      extraTime: !!ko, etHome: ko ? ko.etHome : 0, etAway: ko ? ko.etAway : 0, pens: ko ? ko.pens : null,
      // Pokalsensation: Zweitligist wirft einen Erstligisten raus
      upset: getCupDivisionRank(gameState, winner) > getCupDivisionRank(gameState, loser)
    });
    winners.push(winner);
  }

  if(byeTeam) winners.push(byeTeam);

  cup.round += 1;
  cup.teamsRemaining = winners;
  cup.history.push({ round: cup.round, matches, byeTeam });

  if(winners.length === 1){
    cup.champion = winners[0];
    cup.active = false;
  }

  const ownMatch = matches.find(m => m.home === gameState.clubName || m.away === gameState.clubName);
  if(ownMatch && ownMatch.winner !== gameState.clubName){
    cup.eliminated = true;
    // Festhalten, wo es endete: cup.round laeuft fuer die uebrigen Vereine weiter.
    cup.exitRound = cup.round;
  }

  return { matches, byeTeam, round: cup.round, champion: cup.champion, ownMatch };
}
