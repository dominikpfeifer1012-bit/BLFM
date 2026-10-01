// ============================================
// RECORDS.JS - Bestmarken ueber alle Saisons
// ============================================
// Sammelt die Hoehepunkte einer Karriere. Die Daten entstehen ohnehin im
// Spielverlauf — hier werden sie nur festgehalten.

function createFreshRecords(){
  return {
    biggestWin: null,
    biggestDefeat: null,
    longestWinStreak: 0,
    longestUnbeaten: 0,
    currentUnbeaten: 0,
    topScorerSeason: null,
    mostGoalsCareer: null,
    mostExpensiveSigning: null,
    highestTeamRating: null,
    bestSeason: null,
    careerGoals: {}
  };
}

function ensureRecords(gameState){
  if(!gameState.records) gameState.records = createFreshRecords();
  return gameState.records;
}

// Nach jedem eigenen Ligaspiel
function updateMatchRecords(gameState, evt){
  const r = ensureRecords(gameState);
  const isHome = evt.home === gameState.clubName;
  const eigene = isHome ? evt.homeGoals : evt.awayGoals;
  const gegen = isHome ? evt.awayGoals : evt.homeGoals;
  const gegner = isHome ? evt.away : evt.home;
  const abstand = eigene - gegen;

  if(!r.biggestWin || abstand > r.biggestWin.margin ||
     (abstand === r.biggestWin.margin && eigene > r.biggestWin.goalsFor)){
    if(abstand > 0){
      r.biggestWin = { margin: abstand, goalsFor: eigene, goalsAgainst: gegen,
        opponent: gegner, season: gameState.season, matchday: evt.matchday };
    }
  }
  if(!r.biggestDefeat || -abstand > r.biggestDefeat.margin){
    if(abstand < 0){
      r.biggestDefeat = { margin: -abstand, goalsFor: eigene, goalsAgainst: gegen,
        opponent: gegner, season: gameState.season, matchday: evt.matchday };
    }
  }

  if(evt.result === "win"){
    r.longestWinStreak = Math.max(r.longestWinStreak, gameState.currentWinStreak || 0);
  }
  if(evt.result === "loss"){
    r.currentUnbeaten = 0;
  } else {
    r.currentUnbeaten = (r.currentUnbeaten || 0) + 1;
    r.longestUnbeaten = Math.max(r.longestUnbeaten, r.currentUnbeaten);
  }

  // Torjaeger ueber die gesamte Laufbahn
  (evt.scorers || []).forEach(name => {
    r.careerGoals[name] = (r.careerGoals[name] || 0) + 1;
  });
  const bester = Object.entries(r.careerGoals).sort((a, b) => b[1] - a[1])[0];
  if(bester) r.mostGoalsCareer = { name: bester[0], goals: bester[1] };

  const rating = teamRating(gameState.squad, gameState.matchday);
  if(!r.highestTeamRating || rating > r.highestTeamRating.value){
    r.highestTeamRating = { value: rating, season: gameState.season, matchday: evt.matchday };
  }
}

function updateTransferRecords(gameState, player, fee){
  const r = ensureRecords(gameState);
  if(!r.mostExpensiveSigning || fee > r.mostExpensiveSigning.fee){
    r.mostExpensiveSigning = { name: player.name, pos: player.pos, fee: fee,
      strength: Math.round(player.strength), season: gameState.season };
  }
}

// Am Saisonende: Torschuetzenkoenig und beste Platzierung festhalten.
function updateSeasonRecords(gameState, saisonEintrag){
  const r = ensureRecords(gameState);
  r.currentUnbeaten = 0;

  const liste = typeof getLeagueTopScorers === "function" ? getLeagueTopScorers(gameState, 1) : [];
  if(liste.length > 0){
    const koenig = liste[0];
    saisonEintrag.topScorer = { name: koenig.name, club: koenig.club, goals: koenig.goals };
    if(!r.topScorerSeason || koenig.goals > r.topScorerSeason.goals){
      r.topScorerSeason = { name: koenig.name, club: koenig.club,
        goals: koenig.goals, season: gameState.season };
    }
  }

  const besser = !r.bestSeason
    || saisonEintrag.division < r.bestSeason.division
    || (saisonEintrag.division === r.bestSeason.division
        && saisonEintrag.finalPosition < r.bestSeason.finalPosition);
  if(besser){
    r.bestSeason = { season: gameState.season, division: saisonEintrag.division,
      finalPosition: saisonEintrag.finalPosition, club: gameState.clubName };
  }
}
