// ============================================
// CUP.JS - DFB-Pokal (K.O.-Wettbewerb parallel zur Liga)
// ============================================

// shuffleArray liegt bei den Zufallshelfern in players.js.

// Teilnehmerfeld: alle Erstligisten, aufgefuellt mit gezogenen Zweitligisten.
// Der eigene Verein ist immer dabei, auch wenn er in Liga 2 spielt.
function drawCupField(gameState){
  ensureLeaguePools(gameState);
  const erstliga = getLeaguePool(gameState, 1).map(c => c.name);
  if(erstliga.length === 0){
    return shuffleArray((gameState.teams || []).map(t => t.name));
  }

  // Alle Erstligisten sind gesetzt, der Rest kommt aus den unteren Ligen —
  // die naechsthoehere zuerst, damit das Feld eine Pyramide bleibt.
  const field = [...erstliga];
  const unten = [];
  for(let nr = 2; nr <= gameState.leaguePools.length; nr++){
    unten.push(...shuffleArray(getLeaguePool(gameState, nr).map(c => c.name)));
  }

  let kandidaten = unten.filter(n => !field.includes(n));
  // Der eigene Verein ist immer dabei, egal in welcher Liga er spielt.
  if(!field.includes(gameState.clubName) && kandidaten.includes(gameState.clubName)){
    kandidaten = [gameState.clubName, ...kandidaten.filter(n => n !== gameState.clubName)];
  }
  field.push(...kandidaten.slice(0, Math.max(0, CUP_FIELD_SIZE - field.length)));

  return shuffleArray(field);
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

function getCupDivisionRank(gameState, name){
  const nr = typeof getClubDivision === "function" ? getClubDivision(gameState, name) : null;
  return nr || 2;
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

    const { homeGoals, awayGoals } = simulateMatch(gameState, home, away);
    let winner;
    if(homeGoals === awayGoals){
      const diff = getTeamStrength(gameState, home) - getTeamStrength(gameState, away);
      const winProb = Math.max(0.15, Math.min(0.85, 0.5 + diff / 200));
      winner = Math.random() < winProb ? home : away;
    } else {
      winner = homeGoals > awayGoals ? home : away;
    }
    const loser = winner === home ? away : home;
    matches.push({
      home, away, homeGoals, awayGoals, winner, wasDraw: homeGoals === awayGoals,
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
