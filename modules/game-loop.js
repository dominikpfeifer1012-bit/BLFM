// ============================================
// GAME-LOOP.JS - Terminplan und Ablauf eines Spieltags
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function handleSimulateMatchday(){
  if(gameState.board && gameState.board.dismissed){
    showToast("Du bist entlassen. Starte eine neue Karriere, um weiterzuspielen.", "error");
    return;
  }
  if(gameState.seasonEnded){
    showToast("Die Saison ist beendet. Starte die nächste Saison, um weiterzuspielen.", "info");
    return;
  }

  const btn = document.getElementById("simulateBtn");
  if(btn){
    btn.disabled = true;
    btn.dataset.originalText = btn.textContent;
    btn.textContent = "⏳ Simulation läuft...";
  }

  setTimeout(() => {
    // Ohne finally bliebe der Knopf nach einem Fehler dauerhaft gesperrt.
    holdModals();
    try {
      runNextEvent();
      autoSave();
    } catch(e) {
      console.error("Simulation fehlgeschlagen:", e);
      showToast("Die Simulation ist fehlgeschlagen. Details stehen in der Browser-Konsole.", "error");
    } finally {
      releaseModals();
      if(btn){
        btn.disabled = false;
        btn.textContent = getNextEventLabel();
      }
    }
  }, 550);
}

// Pokalrunden liegen zwischen den Ligaspieltagen und werden einzeln
// angestossen. Ein Klick = ein Termin, nicht mehrere Spiele auf einmal.

// Pokalrunden liegen zwischen den Ligaspieltagen und werden einzeln
// angestossen. Ein Klick = ein Termin, nicht mehrere Spiele auf einmal.
function getNextEvent(gameState){
  if(gameState.seasonEnded) return { type: "seasonEnd" };
  const upcomingDay = gameState.matchday + 1;

  const cup = gameState.cup;
  if(cup && cup.active && CUP_ROUND_TRIGGER_MATCHDAYS[cup.round] === upcomingDay){
    return { type: "cup", label: CUP_ROUND_LABELS[cup.round] || `Runde ${cup.round + 1}`, beforeMatchday: upcomingDay };
  }

  const euEvent = getEuropeEvent(gameState);
  if(euEvent){
    return { type: "europe", label: euEvent.label, stage: euEvent.stage, beforeMatchday: upcomingDay };
  }

  return { type: "league", matchday: upcomingDay };
}

function getNextEventLabel(){
  const evt = getNextEvent(gameState);
  if(evt.type === "cup") return `DFB-Pokal: ${evt.label} spielen`;
  if(evt.type === "europe") return `Europapokal: ${evt.label} spielen`;
  if(evt.type === "seasonEnd") return "Saison beendet";
  return `Spieltag ${evt.matchday} simulieren`;
}

function runNextEvent(){
  const evt = getNextEvent(gameState);

  // Ohne diese Sperre laeuft eine beendete Saison in runMatchdaySimulation
  // durch und finishSeason wird ein zweites Mal ausgefuehrt — dabei wird der
  // Auf-/Abstieg erneut abgewickelt und die Ligapools geraten durcheinander.
  if(evt.type === "seasonEnd"){
    showToast("Die Saison ist beendet. Starte die nächste Saison, um weiterzuspielen.", "info");
    return;
  }

  if(evt.type === "cup"){
    const cupResult = simulateCupRound(gameState);
    if(cupResult){
      processCupResult(cupResult);
      const load = cupResult.ownMatch ? applyMatchLoad("DFB-Pokal") : null;
      renderAll(gameState);
      if(cupResult.ownMatch){
        const m = cupResult.ownMatch;
        presentMatch({
          clubName: gameState.clubName,
          label: `DFB-Pokal · ${evt.label}`,
          home: m.home, away: m.away, homeGoals: m.homeGoals, awayGoals: m.awayGoals,
          timeline: buildMatchTimeline({
            clubName: gameState.clubName, home: m.home, away: m.away,
            homeGoals: m.homeGoals, awayGoals: m.awayGoals,
            scorers: [], cards: [], injuries: load ? load.injuries : []
          }),
          summaryLine: m.wasDraw ? "Entscheidung nach Verlängerung" : ""
        });
      }
      return;
    }
    renderAll(gameState);
    return;
  }

  if(evt.type === "europe"){
    const euResult = simulateEuropeEvent(gameState);
    if(euResult){
      processEuropeResult(euResult);
      const load = euResult.ownMatch ? applyMatchLoad("Europapokal") : null;
      renderAll(gameState);
      if(euResult.ownMatch){
        const m = euResult.ownMatch;
        const home = m.isHome ? gameState.clubName : m.opponent;
        const away = m.isHome ? m.opponent : gameState.clubName;
        presentMatch({
          clubName: gameState.clubName,
          label: `Europapokal · ${evt.label}`,
          home: home, away: away,
          homeGoals: m.isHome ? m.ownGoals : m.oppGoals,
          awayGoals: m.isHome ? m.oppGoals : m.ownGoals,
          timeline: buildMatchTimeline({
            clubName: gameState.clubName, home: home, away: away,
            homeGoals: m.isHome ? m.ownGoals : m.oppGoals,
            awayGoals: m.isHome ? m.oppGoals : m.ownGoals,
            scorers: [], cards: [], injuries: load ? load.injuries : []
          }),
          summaryLine: m.wasDraw ? "Entscheidung nach Verlängerung" : ""
        });
      }
      return;
    }
    renderAll(gameState);
    return;
  }

  runMatchdaySimulation();
}

// Pokalspiele zaehlen zur Belastung: sie erzeugen Verletzungen und lassen
// die Ermuedung weiterlaufen. Englische Wochen kosten damit wirklich Substanz.

// Pokalspiele zaehlen zur Belastung: sie erzeugen Verletzungen und lassen
// die Ermuedung weiterlaufen. Englische Wochen kosten damit wirklich Substanz.
function applyMatchLoad(wettbewerb){
  const day = gameState.matchday + 1;
  const startingInfo = getStartingXIInfo(gameState.squad, day);

  const injuries = processInjuries(gameState, day, CUP_INJURY_FACTOR);
  injuries.forEach(inj => {
    addLogEntry(gameState, `🩹 ${wettbewerb}: ${inj.player.name} (${inj.player.pos}) fällt ${inj.duration} Spieltage aus (zurück ab Spieltag ${inj.player.injuredUntilMatchday + 1}).`);
  });
  if(injuries.length > 0){
    showToast(`🩹 ${injuries.length} Verletzung(en) im ${wettbewerb}.`, "error");
  }

  updateFatigue(gameState.squad, new Set(startingInfo.xi.map(p => p.id)));
  return { injuries };
}

function runMatchdaySimulation(){
  // Die Jugend spielt VOR der Entwicklung, damit ihre Einsaetze in der
  // Entwicklung des Spieltags beruecksichtigt werden.
  const youthResult = gameState.youth ? simulateYouthMatchday(gameState) : null;
  gameState.pendingYouthAppearances = youthResult ? youthResult.appearances : new Set();

  const result = simulateMatchday(gameState);
  gameState.pendingYouthAppearances = null;

  // Die andere Liga spielt denselben Spieltag mit.
  simulateShadowMatchday(gameState);

  developYouthSquad(gameState, gameState.matchday,
    youthResult ? youthResult.appearances : new Set());

  if(result.events.length === 0 && result.finished){
    finishSeason();
    renderAll(gameState);
    return;
  }

  let ownEvt = null, ownBonus = 0;

  const revenueFactor = getOwnRevenueFactor();
  // Das Stadion hebt nur die Kommerzeinnahmen, nicht das Preisgeld.
  const baseRevenue = Math.round(getMatchdayRevenue(revenueFactor) * getStadiumRevenueBonus(gameState));
  gameState.budget = addToBudget(gameState.budget, baseRevenue);

  result.events.forEach((evt, idx) => {
    const bonus = getMatchBonus(evt.result, evt.ownStrength, evt.opponentStrength);
    gameState.budget = addToBudget(gameState.budget, bonus);
    const bonusText = bonus > 0 ? ` (+${fmtMoney(bonus)} Prämie)` : "";
    const scorerText = (evt.scorers && evt.scorers.length > 0) ? ` (⚽ ${evt.scorers.join(", ")})` : "";
    const msg = `Spieltag ${evt.matchday}: ${evt.home} ${evt.homeGoals}:${evt.awayGoals} ${evt.away}${bonusText}${scorerText}`;
    addLogEntry(gameState, msg, evt.result, idx === 0);

    ownEvt = evt;
    ownBonus = bonus;
    updateMatchRecords(gameState, evt);

    if(evt.result === "win"){
      gameState.currentWinStreak = (gameState.currentWinStreak || 0) + 1;
      unlockAchievement("firstWin");
      if(gameState.currentWinStreak >= 5) unlockAchievement("winStreak5");
    } else {
      gameState.currentWinStreak = 0;
    }
  });

  const salaryCost = getMatchdaySalaryCost(gameState.squad, gameState.youthSquad);
  const budgetBeforeSalary = gameState.budget;
  gameState.budget -= salaryCost;
  addLogEntry(gameState, `💰 Einnahmen: +${fmtMoney(baseRevenue + ownBonus)} · 💸 Gehälter: -${fmtMoney(salaryCost)} · Kontostand ${fmtMoney(gameState.budget)}`);
  if(budgetBeforeSalary >= 0 && gameState.budget < 0){
    addLogEntry(gameState, "⚠️ Das Konto ist im Minus. Transfers sind erst wieder möglich, wenn es ausgeglichen ist.", "loss", false);
    showToast("⚠️ Konto im Minus — verkaufe Spieler oder senke die Gehaltslast.", "error");
  }
  handleDebt();
  remindExpiringContracts();

  if(result.injuries && result.injuries.length > 0){
    result.injuries.forEach(inj => {
      const roleLabel = inj.wasStarter ? "Startelf" : "Bank";
      addLogEntry(gameState, `🩹 Verletzung: ${inj.player.name} (${inj.player.pos}, ${roleLabel}) fällt ${inj.duration} Spieltage aus (zurück ab Spieltag ${inj.player.injuredUntilMatchday + 1}).`);
    });
  }

  if(result.cards && result.cards.length > 0){
    result.cards.forEach(c => {
      if(c.type === "red"){
        addLogEntry(gameState, `🟥 ${c.player.name} sieht Rot und ist für ${RED_CARD_BAN_MATCHES} Spiele gesperrt (zurück ab Spieltag ${c.player.suspendedUntilMatchday + 1}).`);
      } else if(c.type === "banAccumulated"){
        addLogEntry(gameState, `🟨🟥 ${c.player.name} sieht die ${YELLOW_CARDS_FOR_BAN}. Gelbe Karte und ist für das nächste Spiel gesperrt.`);
      } else {
        addLogEntry(gameState, `🟨 ${c.player.name} sieht Gelb (${c.player.yellowCards}. Karte in dieser Saison).`);
      }
    });
  }

  gameState.ratingHistory = gameState.ratingHistory || [];
  gameState.budgetHistory = gameState.budgetHistory || [];
  gameState.ratingHistory.push(teamRating(gameState.squad, gameState.matchday + 1));
  gameState.budgetHistory.push(gameState.budget);
  if(gameState.ratingHistory.length > 60) gameState.ratingHistory = gameState.ratingHistory.slice(-60);
  if(gameState.budgetHistory.length > 60) gameState.budgetHistory = gameState.budgetHistory.slice(-60);

  updateSquadMorale(gameState, {
    result: ownEvt ? ownEvt.result : null,
    youthAppearances: youthResult ? youthResult.appearances : new Set()
  });
  reportUnhappyPlayers();

  if(youthResult && !youthResult.skipped){
    const y = youthResult;
    const torText = y.scorers.length > 0 ? ` (⚽ ${y.scorers.join(", ")})` : "";
    addLogEntry(gameState,
      `\u{1F331} Jugend: ${y.ownGoals}:${y.oppGoals} gegen eine Auswahl (Stärke ${Math.round(y.opponentStrength)})${torText}`);
  }

  checkYouthStarAchievement();
  runBoardCheckpoint();
  maybeOpenPressConference();
  announceTransferWindowChange();

  if(result.finished){
    finishSeason();
  }

  renderAll(gameState);

  if(ownEvt){
    presentMatch({
      clubName: gameState.clubName,
      label: `Bundesliga · Spieltag ${ownEvt.matchday}`,
      home: ownEvt.home, away: ownEvt.away,
      homeGoals: ownEvt.homeGoals, awayGoals: ownEvt.awayGoals,
      timeline: buildMatchTimeline({
        clubName: gameState.clubName,
        home: ownEvt.home, away: ownEvt.away,
        homeGoals: ownEvt.homeGoals, awayGoals: ownEvt.awayGoals,
        scorers: ownEvt.scorers, opponentScorers: ownEvt.opponentScorers,
        cards: result.cards, injuries: result.injuries
      }),
      summaryLine: `Einnahmen ${fmtMoney(ownBonus + baseRevenue)} · Gehälter ${fmtMoney(salaryCost)}`
    });
  }
}

// Hinweis auf Wechselwuensche — hoechstens einmal alle paar Spieltage,
// damit die Meldung nicht bei jedem Klick erscheint.

function announceTransferWindowChange(){
  const currentDay = gameState.matchday + 1;
  const isOpen = isTransferWindowOpen(currentDay);
  const wasOpenBefore = isTransferWindowOpen(currentDay - 1);

  if(isOpen && !wasOpenBefore){
    const end = getCurrentWindowEnd(currentDay);
    addLogEntry(gameState, `📢 Transferfenster geöffnet bis Spieltag ${end}.`);
  } else if(!isOpen && wasOpenBefore){
    const nextStart = getNextWindowStart(currentDay);
    const msg = nextStart
      ? `📢 Transferfenster geschlossen. Öffnet wieder an Spieltag ${nextStart}.`
      : `📢 Transferfenster geschlossen (Saisonende).`;
    addLogEntry(gameState, msg);
  }
}

// Der Transfers-Tab ist immer erreichbar. Ob gehandelt werden darf,
// entscheidet die Kauf- bzw. Verkaufslogik.

// Schulden haben Folgen: der Vorstand verliert pro Spieltag im Minus Geduld,
// und haelt das Minus an, verkauft er selbst den wertvollsten Spieler.
function handleDebt(){
  if(gameState.budget >= 0){ gameState.debtMatchdays = 0; return; }
  gameState.debtMatchdays = (gameState.debtMatchdays || 0) + 1;
  if(gameState.board && !gameState.board.dismissed){
    gameState.board.patience = Math.max(0, gameState.board.patience - DEBT_PATIENCE_PER_MATCHDAY);
  }
  if(gameState.debtMatchdays < DEBT_FORCED_SALE_AFTER || !canSellFromSquad(gameState.squad)) return;

  const idx = gameState.squad.reduce((best, p, i, arr) => p.value > arr[best].value ? i : best, 0);
  const spieler = gameState.squad[idx];
  const erloes = calculateSellValue(spieler.value);
  gameState.squad.splice(idx, 1);
  pruneLineup(gameState);
  const club = findNewClubFor(gameState, spieler);
  spieler.clubName = club ? club.name : null;
  spieler.clubTier = club ? club.tier : "frei";
  spieler.transferListed = false;
  spieler.consecutiveStarts = 0;
  if(gameState.pool) gameState.pool.players.push(spieler);
  gameState.budget += erloes;
  gameState.seasonTransferIn = (gameState.seasonTransferIn || 0) + erloes;
  gameState.debtMatchdays = 0;
  const text = `🏦 Zwangsverkauf: Der Vorstand gibt ${spieler.name} (${Math.round(spieler.strength)}) für ${fmtMoney(erloes)} an ${club ? club.name : "einen anderen Verein"} ab, um die Schulden zu decken.`;
  addLogEntry(gameState, text, "loss", false);
  showToast(text, "error");
}

// Rechtzeitig vor dem Sommer an auslaufende Vertraege erinnern.
function remindExpiringContracts(){
  if(!CONTRACT_REMINDER_MATCHDAYS.includes(gameState.matchday)) return;
  const n = (gameState.squad || []).filter(p => isContractExpiring(p) && p.age < RETIREMENT_FORCED_AGE - 1).length;
  if(n === 0) return;
  const text = `📝 ${n} Vertrag${n === 1 ? " läuft" : "e laufen"} zum Saisonende aus — Übersicht im Kader-Tab.`;
  addLogEntry(gameState, text, null, false);
  showToast(text, "info");
}
