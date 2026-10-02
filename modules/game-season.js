// ============================================
// GAME-SEASON.JS - Saisonabschluss, Kaderwechsel, Vorstand und Erfolge
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

// Hinweis auf Wechselwuensche — hoechstens einmal alle paar Spieltage,
// damit die Meldung nicht bei jedem Klick erscheint.
function reportUnhappyPlayers(){
  const unzufrieden = getUnhappyPlayers(gameState);
  if(unzufrieden.length === 0){ gameState.lastUnhappyReport = null; return; }

  const letzte = gameState.lastUnhappyReport || -99;
  if(gameState.matchday - letzte < 5) return;
  gameState.lastUnhappyReport = gameState.matchday;

  const namen = unzufrieden.slice(0, 3).map(p => `${p.name} (${Math.round(getMorale(p))})`).join(", ");
  addLogEntry(gameState,
    `\u{1F621} Unzufrieden im Kader: ${namen}${unzufrieden.length > 3 ? ` und ${unzufrieden.length - 3} weitere` : ""}. Mehr Einsatzzeit oder ein Wechsel würde helfen.`,
    "loss");
  showToast(`\u{1F621} ${unzufrieden.length} Spieler wollen mehr Einsatzzeit.`, "info");
}

function runBoardCheckpoint(){
  if(!isBoardCheckpoint(gameState.matchday)) return;
  const result = evaluateBoard(gameState);
  if(!result) return;

  const board = gameState.board;
  const richtung = result.swing >= 0 ? "+" : "";
  addLogEntry(gameState,
    `\u{1F454} Vorstand: Platz ${result.position}, erwartet wird ${result.target}. Geduld ${richtung}${result.swing} auf ${result.patienceAfter}.`,
    result.swing >= 0 ? "win" : "loss", true);

  if(result.reward > 0){
    addLogEntry(gameState,
      `\u{1F454} Der Vorstand ist beeindruckt: ${fmtMoney(result.reward)} zusätzliches Transferbudget.`,
      "win");
    showToast(`\u{1F454} Bonus vom Vorstand: ${fmtMoney(result.reward)}`, "success");
  }

  if(result.dismissed){
    addLogEntry(gameState, `\u{1F454} Der Vorstand hat dich freigestellt. Ziel verfehlt: ${board.goalLabel}.`, "loss", true);
    changeReputation(gameState, -10);
    queueModal(() => showDismissalModal(result));
    return;
  }

  if(board.patience < BOARD_WARN_THRESHOLD){
    showToast(`\u26A0\uFE0F Der Vorstand ist unzufrieden (Geduld ${board.patience}). Ziel: ${board.goalLabel}.`, "error");
  } else if(result.swing >= 0){
    showToast(`\u{1F454} Vorstand zufrieden \u2014 Platz ${result.position} bei Ziel ${result.target}.`, "success");
  } else {
    showToast(`\u{1F454} Vorstand mahnt: Platz ${result.position}, erwartet ${result.target}.`, "info");
  }
}

// Nach einer Entlassung geht die Karriere bei einem anderen Verein weiter.
// Erhalten bleiben Trainername, Erfolge, Vereinsgeschichte und Rekorde —
// alles Vereinsgebundene wird neu aufgesetzt.

// Nach einer Entlassung geht die Karriere bei einem anderen Verein weiter.
// Erhalten bleiben Trainername, Erfolge, Vereinsgeschichte und Rekorde —
// alles Vereinsgebundene wird neu aufgesetzt.
function acceptJobOffer(clubName){
  const alle = getAllLeagueClubs(gameState);
  const club = alle.find(c => c.name === clubName);
  if(!club){ showToast("Dieser Verein ist nicht mehr verfügbar.", "error"); return; }

  const division = getClubDivision(gameState, clubName) || 1;

  // Der bisherige Kader wandert in den Bestand des alten Vereins, damit die
  // Spieler nicht einfach verschwinden und der Verein weiter Spieler hat.
  const alterVerein = gameState.clubName;
  const alteLiga = getClubDivision(gameState, alterVerein);
  (gameState.loans || []).forEach(l => gameState.squad.push(l.player));
  if(gameState.pool && gameState.pool.players){
    (gameState.squad || []).forEach(p => {
      p.clubName = alterVerein;
      p.clubTier = alteLiga ? "div" + alteLiga : "frei";
      p.transferListed = false;
      p.consecutiveStarts = 0;
      gameState.pool.players.push(p);
    });
  }

  gameState.clubName = clubName;
  gameState.division = division;
  gameState.clubStature = club.strength;
  gameState.squad = takeCustomRosterOnJobChange(gameState, clubName, club.strength)
    || withHomeNationality(getCountryConfig(getDivisionCountry(division)).nat, () => generateSquad(club.strength));
  ensureSquadMorale(gameState.squad);
  gameState.budget = Math.round(calculateStartingBudget(club.strength) * getDifficulty(gameState).budget / 50000) * 50000;
  gameState.captainId = null;
  gameState.lineup = {};
  gameState.formation = DEFAULT_FORMATION;
  gameState.tactic = DEFAULT_TACTIC;
  gameState.training = DEFAULT_TRAINING;
  gameState.board = createFreshBoard(club.strength, division);
  gameState.youth = createFreshYouthTeam();
  gameState.youthSquad = [];
  gameState.pendingYouthCandidates = null;
  if(typeof closeYouthIntakeModal === "function") closeYouthIntakeModal();
  // Anlagen gehoeren dem Verein, nicht dem Trainer.
  if(typeof createFreshFacilities === "function") gameState.facilities = createFreshFacilities();
  gameState.incomingOffers = [];
  gameState.loans = [];
  gameState.currentWinStreak = 0;
  gameState.lastTopFour = [];
  gameState.lastSeasonWasDivision1 = isTopDivision(division);
  gameState.seasonEnded = false;
  gameState.lastSeasonSummary = null;
  gameState.ratingHistory = [];
  gameState.budgetHistory = [];

  gameState.season += 1;
  gameState.matchday = 0;
  const pool = getOwnLeaguePool(gameState);
  gameState.teams = pool.map(c => ({
    name: c.name, strength: c.strength,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));
  gameState.fixtures = generateFixtures(gameState.teams.map(t => t.name));
  gameState.shadowLeagues = createShadowLeagues(gameState);
  gameState.cup = createFreshCup(gameState);
  startUefaSeasonForClub(gameState);
  gameState.marketRefreshedOnMatchday = -1;
  if(gameState.pool) advancePool(gameState);

  gameState.clubHistory = gameState.clubHistory || [];
  gameState.clubHistory.push({ club: clubName, seit: gameState.season });

  addLogEntry(gameState,
    `\u{1F91D} Neuer Verein: ${clubName} (${getDivisionLabel(division)}). Saisonziel: ${gameState.board.goalLabel}.`,
    "win", true);
  showToast(`Willkommen bei ${clubName}!`, "success");

  gameState.successOffers = [];
  ensureCoaches(gameState);
  delete gameState.coaches[clubName];
  markSeasonStart(gameState);
  closeDismissalModal();
  hideSeasonSummary();
  renderAll(gameState);
  autoSave();
}

function unlockAchievement(key){
  if(!gameState.achievements) gameState.achievements = [];
  if(gameState.achievements.includes(key)) return;
  gameState.achievements.push(key);
  const def = ACHIEVEMENTS.find(a => a.key === key);
  if(def) showToast(`${def.label} freigeschaltet!`, "success");
  renderAchievements(gameState);
}

// Jahreswechsel im Kader: Abgaenge durch Karriereende, danach Nachwuchs
// auf genau den Positionen, wo jetzt jemand fehlt.

// Jahreswechsel im Kader: Abgaenge durch Karriereende, danach Nachwuchs
// auf genau den Positionen, wo jetzt jemand fehlt.
function processSquadTurnover(){
  const contracts = processContracts(gameState.squad);
  gameState.squad = contracts.remaining;
  contracts.leaving.forEach(p => {
    addLogEntry(gameState, `📝 Vertragsende: ${p.name} (${p.pos}, Bewertung ${Math.round(p.strength)}) verlässt den Verein ablösefrei.`);
    // Der Spieler verschwindet nicht, sondern taucht wieder im Bestand auf.
    if(gameState.pool){
      p.clubName = null;
      p.clubTier = "frei";
      p.transferListed = false;
      // Merken, damit die Notverpflichtung ihn nicht sofort zurueckholt.
      p.leftClub = gameState.clubName;
      p.leftSeason = gameState.season;
      p.contractYears = 1;
      p.consecutiveStarts = 0;
      gameState.pool.players.push(p);
    }
  });
  if(contracts.leaving.length > 0){
    pruneLineup(gameState);
    showToast(`📝 ${contracts.leaving.length} Spieler verlassen den Verein ablösefrei.`, "info");
  }

  const { retired, remaining } = processRetirements(gameState.squad);
  gameState.squad = remaining;

  retired.forEach(p => {
    addLogEntry(gameState, `🏁 Karriereende: ${p.name} (${p.pos}, ${p.age} Jahre, Bewertung ${Math.round(p.strength)}) beendet seine Laufbahn.`);
    releasePlayerName(p.name);
  });
  if(retired.length > 0){
    pruneLineup(gameState);
    showToast(`🏁 ${retired.length} Spieler beenden ihre Karriere.`, "info");
  }

  // Der Nachwuchs kommt nicht mehr automatisch in den Profikader, sondern
  // wird am Saisonende ausgewaehlt und landet im eigenen Jugendkader.
  const jugendWechsel = advanceYouthSquad(gameState);
  jugendWechsel.hochgezogen.forEach(p => {
    addLogEntry(gameState, `\u2B06\uFE0F ${p.name} ist der Jugend entwachsen und rückt in den Profikader.`);
  });
  jugendWechsel.abgaenge.forEach(p => {
    addLogEntry(gameState, `\u{1F613} ${p.name} war zu alt für die Jugend und fand keinen Platz im Kader — er verlässt den Verein.`, "loss");
  });

  // Nach allen Abgaengen pruefen, ob der Kader noch spielfaehig ist.
  const aufgefuellt = ensureMinimumSquad(gameState);
  aufgefuellt.hochgezogen.forEach(p => {
    addLogEntry(gameState, `\u2B06\uFE0F Personalnot: ${p.name} rückt aus der Jugend nach.`);
  });
  if(aufgefuellt.verpflichtet.length > 0){
    addLogEntry(gameState,
      `\u{1F4DD} Der Kader war zu klein — ${aufgefuellt.verpflichtet.length} ablösefreie Spieler verpflichtet: ` +
      aufgefuellt.verpflichtet.map(p => `${p.name} (${p.pos})`).join(", "), "loss");
    showToast(`Kader aufgefüllt: ${aufgefuellt.verpflichtet.length} ablösefreie Verpflichtungen.`, "info");
  }

  gameState.pendingYouthCandidates = createYouthCandidates(gameState);
}

function checkYouthStarAchievement(){
  const star = (gameState.squad || []).some(p => p.isYouthProduct && p.strength >= YOUTH_STAR_ACHIEVEMENT_RATING);
  if(star) unlockAchievement("youthStar");
}

// Aeltere Spielstaende kennen exitRound noch nicht, dann bleibt nur der Rundenzaehler.
function describeCupExit(cup){
  const runde = cup.exitRound || cup.round;
  const label = CUP_ROUND_LABELS[Math.max(0, runde - 1)] || `Runde ${runde}`;
  return label === "1. Runde" ? "Aus in der 1. Runde" : `Aus im ${label}`;
}

function finishSeason(){
  const playedDivision = gameState.division;
  const sorted = getSortedStandings(gameState.teams);
  const finalPosition = sorted.findIndex(t => t.name === gameState.clubName) + 1;
  const totalTeams = gameState.teams.length;
  const bonus = calculateSeasonEndBonus(finalPosition, totalTeams);

  // Auszeichnungen vor dem Saisonwechsel (Tore und Entwicklung zaehlen noch).
  gameState.lastAwards = computeSeasonAwards(gameState);
  const tabelle = getSortedStandings(gameState.teams);
  if(tabelle[0]) addNews(gameState, `${tabelle[0].name} ist Meister der ${getDivisionLabel(playedDivision)} ${gameState.season}/${String(gameState.season + 1).slice(2)}.`, "🏆");
  if(gameState.cup && gameState.cup.champion) addNews(gameState, `${gameState.cup.champion} gewinnt den ${getCupName(gameState)}.`, "🏆");
  // Die Pokale der anderen Laender werden im Hintergrund ausgespielt.
  gameState.cupWinners = { [getOwnCountry(gameState)]: gameState.cup ? gameState.cup.champion : null };
  COUNTRIES.filter(l => l.key !== getOwnCountry(gameState)).forEach(l => {
    const sieger = simulateForeignCup(gameState, l.key);
    if(sieger){ gameState.cupWinners[l.key] = sieger; addNews(gameState, `${sieger} gewinnt den ${l.cup}.`, "🏆"); }
  });

  // Leihspieler kehren vor dem Altern und den Vertragslaeufen zurueck.
  returnLoans(gameState).forEach(r => addLogEntry(gameState,
    `🔁 ${r.name} kehrt von ${r.club} zurück: Bewertung ${r.vorher} → ${r.nachher}.`, r.nachher > r.vorher ? "win" : null));

  ageSquadOneYear(gameState.squad);
  processSquadTurnover();
  healAllInjuries(gameState.squad);
  resetSeasonalPlayerState(gameState.squad);
  gameState.budget = addToBudget(gameState.budget, bonus);

  const sponsorBonus = gameState.board ? getSponsorGoalBonus(gameState, finalPosition, gameState.board.targetPosition) : 0;
  if(sponsorBonus > 0){
    gameState.budget = addToBudget(gameState.budget, sponsorBonus);
    addLogEntry(gameState, `🎯 Sponsor zahlt den Bonus für das erreichte Saisonziel: ${fmtMoney(sponsorBonus)}.`, "win", true);
  }

  // Standing fortschreiben, bevor Auf-/Abstieg die Liga wechselt.
  const statureBefore = gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState);
  const statureTarget = getStatureTarget(
    teamRating(gameState.squad, 1), finalPosition, totalTeams, playedDivision);
  gameState.clubStature = advanceClubStature(statureBefore, statureTarget);

  // Europapokal abschliessen, bevor sich Ligen und Vereine aendern.
  if(typeof finishUefaSeason === "function") finishUefaSeason(gameState);
  const uefaHolders = typeof getUefaHolders === "function" ? getUefaHolders(gameState) : null;

  const promoRelResult = processPromotionRelegation(gameState);

  gameState.seasonEnded = true;
  gameState.lastSeasonSummary = { finalPosition, totalTeams, bonus, season: gameState.season };
  gameState.lastTopFour = sorted.slice(0, 4).map(t => t.name);
  gameState.lastSeasonWasDivision1 = isTopDivision(playedDivision);
  // Ehrentafel: Meister aller Ligen und alle Pokalsieger.
  DIVISIONS.forEach(d => {
    const meister = (promoRelResult.standings[d.nr] || [])[0];
    if(meister) addHonour(gameState, "league-" + d.nr, d.label, meister.name);
  });
  COUNTRIES.forEach(l => {
    const sieger = gameState.cupWinners && gameState.cupWinners[l.key];
    if(sieger) addHonour(gameState, "cup-" + l.key, l.cup, sieger);
  });
  // Startplaetze fuer die naechste Europapokal-Saison.
  gameState.lastTopTables = {};
  COUNTRIES.forEach(l => {
    const top = getCountryDivisions(l.key)[0];
    gameState.lastTopTables[l.key] = (promoRelResult.standings[top.nr] || []).map(t => t.name);
  });
  gameState.lastCupWinners = Object.assign({}, gameState.cupWinners || {});
  gameState.lastUefaHolders = uefaHolders;
  gameState.uefaQualification = computeUefaQualification(gameState, gameState.lastTopTables, gameState.lastCupWinners, uefaHolders);
  // Meister der anderen Ligen fuer die Nachrichten.
  DIVISIONS.filter(d => d.nr !== playedDivision && d.tier === 1).forEach(d => {
    const meister = (promoRelResult.standings[d.nr] || [])[0];
    if(meister) addNews(gameState, `${meister.name} ist Meister der ${d.label}.`, getCountryBadge(d.country));
  });

  let movement = "stayed";
  if(promoRelResult.ownWasPromoted) movement = "promoted";
  else if(promoRelResult.ownWasRelegated || promoRelResult.ownRelegatedToRegional) movement = "relegated";

  gameState.seasonHistory = gameState.seasonHistory || [];
  const cup = gameState.cup || {};
  const uefaErgebnis = typeof describeOwnUefaResult === "function" ? describeOwnUefaResult(gameState) : null;

  const saisonEintrag = {
    season: gameState.season, finalPosition, totalTeams, bonus,
    division: playedDivision, movement,
    club: gameState.clubName,
    cupResult: cup.champion === gameState.clubName ? "Sieger"
      : cup.eliminated ? describeCupExit(cup)
      : "—",
    europeResult: uefaErgebnis,
    boardPatience: gameState.board ? Math.round(gameState.board.patience) : null,
    goalsFor: sorted[finalPosition - 1] ? sorted[finalPosition - 1].gf : null,
    goalsAgainst: sorted[finalPosition - 1] ? sorted[finalPosition - 1].ga : null,
    points: sorted[finalPosition - 1] ? sorted[finalPosition - 1].points : null,
    // Kennzahlen fuer die Mehrsaison-Analyse. Sie entstehen ohnehin im
    // Spielverlauf und werden hier nur festgehalten.
    stature: gameState.clubStature != null ? Math.round(gameState.clubStature * 10) / 10 : null,
    teamRating: teamRating(gameState.squad, getSeasonMatchdays(gameState)),
    squadSize: gameState.squad.length,
    squadValue: gameState.squad.reduce((sum, p) => sum + p.value, 0),
    salaryTotal: getSquadSalaryTotal(gameState.squad),
    budget: gameState.budget,
    youthProducts: gameState.squad.filter(p => p.isYouthProduct).length,
    avgAge: Math.round(gameState.squad.reduce((sum, p) => sum + p.age, 0) / gameState.squad.length * 10) / 10,
    morale: typeof getSquadMoraleAverage === "function"
      ? Math.round(getSquadMoraleAverage(gameState.squad)) : null,
    transferIn: gameState.seasonTransferIn || 0,
    transferOut: gameState.seasonTransferOut || 0
  };
  updateSeasonRecords(gameState, saisonEintrag);
  gameState.seasonHistory.push(saisonEintrag);

  addLogEntry(gameState, `🏁 Saison ${gameState.season}/${gameState.season+1} beendet! Platz ${finalPosition} von ${totalTeams} (${getDivisionLabel(playedDivision)}).`, null, true);
  addLogEntry(gameState, `💰 Platzierungs-Preisgeld: +${fmtMoney(bonus)}`);

  if(Math.abs(gameState.clubStature - statureBefore) >= 0.1){
    const rising = gameState.clubStature > statureBefore;
    addLogEntry(gameState,
      `📈 Vereinsstanding ${rising ? "gestiegen" : "gesunken"}: ${statureBefore.toFixed(1)} → ${gameState.clubStature.toFixed(1)} — ${rising ? "höhere" : "geringere"} TV- und Sponsoreneinnahmen.`,
      rising ? "win" : "loss");
  }

  const neueLiga = getDivisionLabel(promoRelResult.ownDivisionNow);
  const reserveName = promoRelResult.reserveLabel || "Regionalliga";
  if(promoRelResult.ownRelegatedToRegional){
    addLogEntry(gameState, `⬇️ ${gameState.clubName} steigt in die ${reserveName} ab — der Verein trennt sich von dir.`, "loss", true);
    showToast(`⬇️ Abstieg in die ${reserveName}! ${gameState.clubName} trennt sich von dir.`, "error");
  } else if(promoRelResult.ownWasRelegated){
    addLogEntry(gameState, `⬇️ ${gameState.clubName} steigt in die ${neueLiga} ab!`, "loss", true);
    showToast(`⬇️ Abstieg! ${gameState.clubName} spielt nächste Saison ${neueLiga}.`, "error");
  } else if(promoRelResult.ownWasPromoted){
    addLogEntry(gameState, `⬆️ ${gameState.clubName} steigt in die ${neueLiga} auf!`, "win", true);
    showToast(`⬆️ Aufstieg! ${gameState.clubName} spielt nächste Saison ${neueLiga}!`, "success");
    unlockAchievement("promotion");
  }
  if(promoRelResult.regionalDown && promoRelResult.regionalDown.length){
    addLogEntry(gameState, `🔻 In die ${reserveName}: ${promoRelResult.regionalDown.join(", ")} · 🔺 Aus der ${reserveName}: ${promoRelResult.regionalUp.join(", ")}`);
    addNews(gameState, `Aufsteiger aus der ${reserveName}: ${promoRelResult.regionalUp.join(", ")}.`, "🔺");
  }

  logStrengthDrift(promoRelResult.driftChanges);

  if(promoRelResult.promotedNames.length || promoRelResult.relegatedNames.length){
    addLogEntry(gameState, `📋 Aufsteiger: ${promoRelResult.promotedNames.join(", ")} · Absteiger: ${promoRelResult.relegatedNames.join(", ")}`
      + (promoRelResult.playoffWinnerName ? ` · ${promoRelResult.playoffLabel || "Relegation"}: ${promoRelResult.playoffWinnerName} setzt sich durch` : ""));
  }

  if(isTopDivision(playedDivision) && finalPosition === 1) unlockAchievement("champion");
  if(isTopDivision(playedDivision) && finalPosition <= 4) unlockAchievement("topFour");

  // Trainer-Ruf und Anfragen groesserer Vereine
  const ziel = gameState.board ? gameState.board.targetPosition : finalPosition;
  const ruf = updateReputationForSeason(gameState, {
    position: finalPosition, target: ziel,
    champion: isTopDivision(playedDivision) && finalPosition === 1,
    cupWinner: cup.champion === gameState.clubName,
    europeWinner: !!(uefaErgebnis && uefaErgebnis.endsWith("Sieger")),
    promoted: promoRelResult.ownWasPromoted, relegated: promoRelResult.ownWasRelegated || promoRelResult.ownRelegatedToRegional
  });
  if(Math.abs(ruf.delta) >= 1){
    addLogEntry(gameState, `🎓 Trainer-Ruf ${ruf.delta > 0 ? "steigt" : "sinkt"} auf ${Math.round(ruf.neu)} (${getReputationLabel(ruf.neu)}).`, ruf.delta > 0 ? "win" : "loss");
  }
  gameState.successOffers = generateSuccessOffers(gameState, finalPosition, ziel);
  if(gameState.successOffers.length > 0){
    addLogEntry(gameState, `📞 Anfragen anderer Vereine: ${gameState.successOffers.map(o => o.name).join(", ")}.`, "win", true);
    showToast(`📞 ${gameState.successOffers.length} Verein${gameState.successOffers.length === 1 ? "" : "e"} wollen dich als Trainer — siehe Saisonbilanz.`, "success");
  }

  if(promoRelResult.ownRelegatedToRegional){
    // Mit dem Verein geht es nicht weiter: wie eine Entlassung, mit Angeboten.
    gameState.successOffers = [];
    gameState.pendingYouthCandidates = null;
    if(gameState.board){ gameState.board.dismissed = true; gameState.board.dismissedRegional = true; gameState.board.reserveLabel = reserveName; }
    changeReputation(gameState, -6);
    renderSeasonSummary(gameState);
    renderSeasonHistory(gameState);
    queueModal(() => showDismissalModal({ matchday: getSeasonMatchdays(gameState), position: finalPosition, regional: true, reserveLabel: reserveName }));
    return;
  }

  renderSeasonSummary(gameState);
  if(typeof showYouthIntakeModal === "function") queueModal(showYouthIntakeModal);
  renderSeasonHistory(gameState);
}

function logStrengthDrift(changes){
  if(!changes || changes.length === 0) return;
  const sorted = [...changes].sort((a, b) => b.delta - a.delta);
  const fmt = c => `${c.name} ${c.delta > 0 ? "+" : ""}${c.delta.toFixed(1)} (jetzt ${c.after.toFixed(1)})`;
  const risers = sorted.filter(c => c.delta > 0.5).slice(0, 3);
  const fallers = sorted.filter(c => c.delta < -0.5).slice(-3).reverse();
  if(risers.length > 0) addLogEntry(gameState, `📈 Im Aufwind: ${risers.map(fmt).join(" · ")}`);
  if(fallers.length > 0) addLogEntry(gameState, `📉 Im Umbruch: ${fallers.map(fmt).join(" · ")}`);
}

function startNextSeason(){
  if(gameState.board && gameState.board.dismissed){
    showToast("Mit diesem Verein geht es nicht weiter. Nimm ein Angebot an oder starte neu.", "error");
    if(typeof showDismissalModal === "function") showDismissalModal({ matchday: gameState.matchday, position: getOwnTeamRow(gameState).position, regional: !!gameState.board.dismissedRegional, reserveLabel: gameState.board.reserveLabel });
    return;
  }
  gameState.season += 1;
  gameState.matchday = 0;
  gameState.seasonEnded = false;
  gameState.lastSeasonSummary = null;

  const currentPool = getOwnLeaguePool(gameState);
  gameState.teams = currentPool.map(c => ({
    name: c.name, strength: c.strength,
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));
  gameState.fixtures = generateFixtures(gameState.teams.map(t => t.name));
  gameState.shadowLeagues = createShadowLeagues(gameState);
  gameState.cup = createFreshCup(gameState);
  gameState.board = createFreshBoard(getBoardReferenceStrength(gameState), gameState.division,
    gameState.board ? gameState.board.patience : null);

  startUefaSeasonForClub(gameState);

  resetYouthSeason(gameState);
  resetMoraleForNewSeason(gameState.squad);
  gameState.seasonTransferIn = 0;
  gameState.seasonTransferOut = 0;
  resetPoolSeasonStats(gameState.pool);
  const poolWechsel = advancePool(gameState);
  addLogEntry(gameState,
    `🌍 Transfermarkt: ${getPoolStats(gameState.pool).gelistet} Spieler stehen diese Saison zur Verfügung` +
    ` (${poolWechsel.abgaenge} Karriereenden, ${poolWechsel.zugaenge} Neuzugänge im Bestand).`);

  addLogEntry(gameState, `🆕 Saison ${gameState.season}/${gameState.season+1} gestartet (${getDivisionLabel(gameState.division)})! Neuer ${getCupName(gameState)}-Wettbewerb beginnt.`, null, true);

  if(isTransferWindowOpen(1)){
    const end = getCurrentWindowEnd(1);
    addLogEntry(gameState, `📢 Transferfenster geöffnet bis Spieltag ${end}.`);
  }

  gameState.successOffers = [];
  ensureCoaches(gameState);
  markSeasonStart(gameState);
  simulateAiTransfers(gameState);
  renderAll(gameState);
  hideSeasonSummary();
  autoSave();
}

// Europapokal und Supercups einer neuen Saison anlegen (Saisonstart,
// Vereinswechsel, neue Karriere).
function startUefaSeasonForClub(gameState){
  createUefaSeason(gameState, gameState.uefaQualification);
  createSupercups(gameState);
  playBackgroundSupercups(gameState);
  advanceUefaBackground(gameState);
  const uefa = gameState.uefa;
  if(uefa && uefa.own){
    const cfg = UEFA_COMPS[uefa.own];
    addLogEntry(gameState, `${cfg.icon} Qualifiziert für die ${cfg.name}!`, "win", true);
    if(typeof queueUefaDrawModal === "function") queueUefaDrawModal(gameState, uefa.own, -1);
  }
}
