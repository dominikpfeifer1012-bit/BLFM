// ============================================
// GAME-LOOP.JS - Terminplan und Ablauf eines Spieltags
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function handleSimulateMatchday(){
  if(gameState.board && gameState.board.dismissed){
    showToast("Du wurdest entlassen.", "error");
    return;
  }
  if(gameState.seasonEnded){
    showToast("Saison beendet.", "info");
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
    let aufgeschoben = false;
    try {
      aufgeschoben = runNextEvent() === "deferred";
    } catch(e) {
      console.error("Simulation fehlgeschlagen:", e);
      showToast("Simulation fehlgeschlagen (Details in der Konsole).", "error");
    } finally {
      // Beim Halbzeit-Eingriff schliesst completeDeferredMatchday den Spieltag ab.
      if(!aufgeschoben) completeDeferredMatchday();
    }
  }, 550);
}

function completeDeferredMatchday(){
  autoSave();
  releaseModals();
  const btn = document.getElementById("simulateBtn");
  if(btn){
    btn.disabled = false;
    btn.textContent = getNextEventLabel();
  }
}

// Pokalrunden liegen zwischen den Ligaspieltagen und werden einzeln
// angestossen. Ein Klick = ein Termin, nicht mehrere Spiele auf einmal.

// Pokalrunden liegen zwischen den Ligaspieltagen und werden einzeln
// angestossen. Ein Klick = ein Termin, nicht mehrere Spiele auf einmal.
function getNextEvent(gameState){
  if(gameState.seasonEnded) return { type: "seasonEnd" };
  const upcomingDay = gameState.matchday + 1;

  // Supercups eroeffnen die Saison.
  const sc = typeof getPendingOwnSupercup === "function" ? getPendingOwnSupercup(gameState) : null;
  if(sc) return { type: "supercup", label: sc.name, beforeMatchday: upcomingDay };

  const cup = gameState.cup;
  if(cup && cup.active && getCupTriggerMatchdays(gameState)[cup.round] === upcomingDay){
    return { type: "cup", label: CUP_ROUND_LABELS[cup.round] || `Runde ${cup.round + 1}`, beforeMatchday: upcomingDay };
  }

  const euEvent = typeof getUefaEvent === "function" ? getUefaEvent(gameState) : null;
  if(euEvent){
    return { type: "europe", label: euEvent.label, comp: euEvent.comp, beforeMatchday: upcomingDay };
  }

  return { type: "league", matchday: upcomingDay };
}

function getNextEventLabel(){
  const evt = getNextEvent(gameState);
  if(evt.type === "supercup") return `${evt.label} spielen`;
  if(evt.type === "cup") return `${getCountryConfig(getOwnCountry(gameState)).cupShort}: ${evt.label} spielen`;
  if(evt.type === "europe") return `${evt.label} spielen`;
  if(evt.type === "seasonEnd") return "Saison beendet";
  return `Spieltag ${evt.matchday} simulieren`;
}

function runNextEvent(){
  const evt = getNextEvent(gameState);

  // Ohne diese Sperre laeuft eine beendete Saison in runMatchdaySimulation
  // durch und finishSeason wird ein zweites Mal ausgefuehrt — dabei wird der
  // Auf-/Abstieg erneut abgewickelt und die Ligapools geraten durcheinander.
  if(evt.type === "seasonEnd"){
    showToast("Saison beendet.", "info");
    return;
  }

  if(evt.type === "supercup"){
    const sc = playSupercup(gameState, getPendingOwnSupercup(gameState));
    playBackgroundSupercups(gameState);
    renderAll(gameState);
    presentMatch({
      clubName: gameState.clubName, label: sc.name, home: sc.a, away: sc.b,
      homeGoals: sc.homeGoals, awayGoals: sc.awayGoals,
      timeline: buildMatchTimeline({ clubName: gameState.clubName, home: sc.a, away: sc.b,
        homeGoals: sc.homeGoals, awayGoals: sc.awayGoals, scorers: [], cards: [], injuries: [],
        knockout: sc.pens ? { extraTime: false, etHome: 0, etAway: 0, pens: sc.pens } : null }),
      summaryLine: sc.winner === gameState.clubName ? "🏆 Titel" : ""
    });
    return;
  }

  if(evt.type === "cup"){
    const cupResult = simulateCupRound(gameState);
    if(cupResult){
      processCupResult(cupResult);
      const load = cupResult.ownMatch ? applyMatchLoad(getCupName(gameState)) : null;
      advanceUefaBackground(gameState);
      renderAll(gameState);
      if(cupResult.ownMatch){
        const m = cupResult.ownMatch;
        presentMatch({
          clubName: gameState.clubName,
          label: `${getCupName(gameState)} · ${evt.label}`,
          home: m.home, away: m.away, homeGoals: m.homeGoals, awayGoals: m.awayGoals,
          timeline: buildMatchTimeline({
            clubName: gameState.clubName, home: m.home, away: m.away,
            homeGoals: m.homeGoals, awayGoals: m.awayGoals,
            scorers: [], cards: [], injuries: load ? load.injuries : [],
            knockout: m.wasDraw ? { extraTime: true, etHome: m.etHome, etAway: m.etAway, pens: m.pens } : null
          }),
          summaryLine: m.wasDraw ? (m.pens ? `Entscheidung im Elfmeterschießen (${m.pens.home}:${m.pens.away})` : "Entscheidung in der Verlängerung") : ""
        });
      }
      return;
    }
    renderAll(gameState);
    return;
  }

  if(evt.type === "europe"){
    const r = playUefaDate(gameState);
    advanceUefaBackground(gameState);
    if(r){
      const cfg = UEFA_COMPS[r.comp];
      const m = r.match;
      const load = applyMatchLoad(cfg.name);
      const ko = m.extraTime ? { extraTime: true, etHome: m.etHome, etAway: m.etAway, pens: m.pens } : null;
      const tie = m.tie;
      const gesamt = tie && tie.aggA != null
        ? ` · Gesamt ${tie.a === gameState.clubName ? tie.aggA : tie.aggB}:${tie.a === gameState.clubName ? tie.aggB : tie.aggA}` : "";
      const ergebnis = getResultForClub(gameState.clubName, m.home, m.away, m.homeGoals, m.awayGoals);
      addLogEntry(gameState, `${cfg.icon} ${cfg.name} · ${r.label}: ${m.home} ${m.homeGoals}:${m.awayGoals} ${m.away}${ko ? ` (${knockoutSuffix(ko)})` : ""}${gesamt}`, ergebnis, true);
      renderAll(gameState);
      presentMatch({
        clubName: gameState.clubName,
        label: `${cfg.name} · ${r.label}`,
        home: m.home, away: m.away, homeGoals: m.homeGoals, awayGoals: m.awayGoals,
        timeline: buildMatchTimeline({
          clubName: gameState.clubName, home: m.home, away: m.away,
          homeGoals: m.homeGoals, awayGoals: m.awayGoals,
          scorers: [], cards: [], injuries: load ? load.injuries : [], knockout: ko
        }),
        otherResults: r.others, tablePosition: r.tablePosition,
        tableLabel: r.stage.type === "league" ? `${cfg.short}-Ligaphase` : null,
        summaryLine: (tie && tie.winner ? (tie.winner === gameState.clubName ? "Weiter" : "Ausgeschieden") : "") + gesamt
      });
    } else renderAll(gameState);
    return;
  }

  // Live-Modus: erst die erste Halbzeit zeigen, der Rest folgt nach der Pause.
  if(typeof startHalftimeMatch === "function" && startHalftimeMatch()) return "deferred";
  runMatchdaySimulation();
}

// Pokalspiele zaehlen zur Belastung: sie erzeugen Verletzungen und lassen
// die Ermuedung weiterlaufen. Englische Wochen kosten damit wirklich Substanz.

// Pokalspiele zaehlen zur Belastung: sie erzeugen Verletzungen und lassen
// die Ermuedung weiterlaufen. Englische Wochen kosten damit wirklich Substanz.
function getOwnTablePosition(gameState){
  if(!gameState.teams) return null;
  const idx = getSortedStandings(gameState.teams).findIndex(t => t.name === gameState.clubName);
  return idx >= 0 ? idx + 1 : null;
}

function applyMatchLoad(wettbewerb){
  const day = gameState.matchday + 1;
  const startingInfo = getStartingXIInfo(gameState.squad, day);

  const injuries = processInjuries(gameState, day, CUP_INJURY_FACTOR);
  injuries.forEach(inj => {
    addLogEntry(gameState, `🩹 ${wettbewerb}: ${inj.player.name} (${inj.player.pos}) fällt ${inj.duration} Spieltage aus (zurück ab Spieltag ${inj.player.injuredUntilMatchday + 1}).`);
  });
  if(injuries.length > 0){
    showToast(`🩹 ${wettbewerb}: ${injuries.length} ${injuries.length === 1 ? "Verletzung" : "Verletzungen"}`, "error");
  }

  updateFatigue(gameState.squad, new Set(startingInfo.xi.map(p => p.id)));
  return { injuries };
}

function runMatchdaySimulation(override){
  // Die Jugend spielt VOR der Entwicklung, damit ihre Einsaetze in der
  // Entwicklung des Spieltags beruecksichtigt werden.
  const youthResult = gameState.youth ? simulateYouthMatchday(gameState) : null;
  gameState.pendingYouthAppearances = youthResult ? youthResult.appearances : new Set();

  const platzVorher = getOwnTablePosition(gameState);
  const result = simulateMatchday(gameState, override);
  gameState.pendingYouthAppearances = null;

  // Die andere Liga spielt denselben Spieltag mit.
  simulateShadowMatchday(gameState);
  // Europapokal-Termine ohne eigenes Spiel laufen im Hintergrund mit.
  if(typeof advanceUefaBackground === "function" && !result.finished) advanceUefaBackground(gameState);

  developYouthSquad(gameState, gameState.matchday,
    youthResult ? youthResult.appearances : new Set());

  if(result.events.length === 0 && result.finished){
    finishSeason();
    renderAll(gameState);
    return;
  }

  let ownEvt = null, ownBonus = 0;

  // Konferenz: die anderen Partien des Spieltags und der neue Tabellenplatz.
  result.events.forEach(evt => {
    evt.otherResults = getRoundFixtures(gameState.fixtures, gameState.teams.length, evt.matchday - 1)
      .filter(f => f.played && f.home !== gameState.clubName && f.away !== gameState.clubName)
      .map(f => ({ home: f.home, away: f.away, homeGoals: f.homeGoals, awayGoals: f.awayGoals }));
    evt.tablePosition = getOwnTablePosition(gameState);
    evt.tableDelta = platzVorher && evt.tablePosition && evt.matchday > 1 ? platzVorher - evt.tablePosition : 0;
    if(evt.grades && evt.grades.motm){
      addLogEntry(gameState, `⭐ Spieler des Spiels: ${evt.grades.motm.name} (Note ${fmtGrade(evt.grades.motm.grade)})`);
    }
  });

  // Ohne Wahl gilt der Festbetrag; der Sponsor zahlt dann vor dem ersten Spiel.
  if(!ensureSeasonFinance(gameState).sponsor){
    const auto = chooseSponsor(gameState, "fix", true);
    if(auto.success) addLogEntry(gameState, auto.message);
  }

  const revenueFactor = getOwnRevenueFactor();
  // Das Stadion hebt nur die Kommerzeinnahmen, nicht das Preisgeld.
  const baseRevenue = Math.round(getMatchdayRevenue(revenueFactor) * getStadiumRevenueBonus(gameState));
  gameState.budget = addToBudget(gameState.budget, baseRevenue);

  result.events.forEach((evt, idx) => {
    const bonus = getMatchBonus(evt.result, evt.ownStrength, evt.opponentStrength)
      + (evt.result === "win" ? getSponsorWinBonus(gameState) : 0);
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
  const upkeep = getFacilityUpkeep(gameState);
  const budgetBeforeSalary = gameState.budget;
  gameState.budget -= salaryCost + upkeep;
  addLogEntry(gameState, `💰 Einnahmen: +${fmtMoney(baseRevenue + ownBonus)} · 💸 Gehälter: -${fmtMoney(salaryCost)}${upkeep ? ` · 🏗 Unterhalt: -${fmtMoney(upkeep)}` : ""} · Kontostand ${fmtMoney(gameState.budget)}`);
  if(budgetBeforeSalary >= 0 && gameState.budget < 0){
    addLogEntry(gameState, "⚠️ Konto im Minus · Transfersperre bis zum Ausgleich", "loss", false);
    showToast("⚠️ Konto im Minus", "error");
  }
  handleDebt();
  remindExpiringContracts();
  const neuesAngebot = updateIncomingOffers(gameState);
  if(neuesAngebot){
    const text = `📨 ${neuesAngebot.club} bietet ${fmtMoney(neuesAngebot.fee)} für ${neuesAngebot.playerName} `;
    addLogEntry(gameState, text);
    showToast(text, "info");
  }

  if(result.injuries && result.injuries.length > 0){
    result.injuries.forEach(inj => {
      const roleLabel = inj.wasStarter ? "Startelf" : "Bank";
      addLogEntry(gameState, `🩹 Verletzung: ${inj.player.name} (${inj.player.pos}, ${roleLabel}) fällt ${inj.duration} Spieltage aus (zurück ab Spieltag ${inj.player.injuredUntilMatchday + 1}).`);
    });
  }

  if(result.cards && result.cards.length > 0){
    result.cards.forEach(c => {
      if(c.type === "red"){
        addLogEntry(gameState, `🟥 ${c.player.name} · Rote Karte, ${RED_CARD_BAN_MATCHES} Spiele gesperrt`);
      } else if(c.type === "banAccumulated"){
        addLogEntry(gameState, `🟨 ${c.player.name} · ${YELLOW_CARDS_FOR_BAN}. Gelbe Karte, 1 Spiel gesperrt`);
      } else {
        addLogEntry(gameState, `🟨 ${c.player.name} · ${c.player.yellowCards}. Gelbe Karte`);
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
  checkCoachChanges(gameState);
  simulateAiTransfers(gameState);
  maybeOpenPressConference();
  announceTransferWindowChange();

  if(result.finished){
    finishSeason();
  }

  renderAll(gameState);

  if(ownEvt && override && typeof continueSecondHalf === "function"){
    continueSecondHalf(ownEvt, result, `Einnahmen ${fmtMoney(ownBonus + baseRevenue)} · Gehälter ${fmtMoney(salaryCost)}`);
  } else if(ownEvt){
    presentMatch({
      clubName: gameState.clubName,
      label: `${getDivisionLabel(gameState.division)} · Spieltag ${ownEvt.matchday}`,
      home: ownEvt.home, away: ownEvt.away,
      homeGoals: ownEvt.homeGoals, awayGoals: ownEvt.awayGoals,
      timeline: buildMatchTimeline({
        clubName: gameState.clubName,
        home: ownEvt.home, away: ownEvt.away,
        homeGoals: ownEvt.homeGoals, awayGoals: ownEvt.awayGoals,
        scorers: ownEvt.scorers, opponentScorers: ownEvt.opponentScorers,
        goals: ownEvt.goals, incidents: ownEvt.incidents,
        cards: result.cards, injuries: result.injuries
      }),
      grades: ownEvt.grades, otherResults: ownEvt.otherResults,
      tablePosition: ownEvt.tablePosition, tableDelta: ownEvt.tableDelta,
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
      ? `📢 Transferfenster geschlossen bis Spieltag ${nextStart}.`
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
  const erloes = getSellPrice(spieler);
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
  if(!getContractReminderMatchdays(gameState).includes(gameState.matchday)) return;
  const n = (gameState.squad || []).filter(p => isContractExpiring(p) && p.age < RETIREMENT_FORCED_AGE - 1).length;
  if(n === 0) return;
  const text = `📝 ${n} Vertrag${n === 1 ? " läuft" : "e laufen"} zum Saisonende aus — Übersicht im Kader-Tab.`;
  addLogEntry(gameState, text, null, false);
  showToast(text, "info");
}

// ============================================
// Vorspulen: mehrere Termine am Stueck
// ============================================

let batchRun = null;

function isBatchRunning(){ return !!batchRun; }

function getFastForwardTargets(gameState){
  const ende = getSeasonMatchdays(gameState);
  const winter = Math.floor(ende / 2);
  const ziele = [];
  const jetzt = gameState.matchday;
  if(jetzt + 5 < ende) ziele.push({ ziel: jetzt + 5, titel: "5 Spieltage", sub: `bis Spieltag ${jetzt + 5}` });
  if(jetzt < winter) ziele.push({ ziel: winter, titel: "Bis zur Winterpause", sub: `bis Spieltag ${winter}` });
  const naechsterCheck = typeof getNextBoardCheckpoint === "function" ? getNextBoardCheckpoint(jetzt) : null;
  if(naechsterCheck && naechsterCheck < ende && naechsterCheck !== winter) ziele.push({ ziel: naechsterCheck, titel: "Bis zur Vorstandsbewertung", sub: `bis Spieltag ${naechsterCheck}` });
  ziele.push({ ziel: ende, titel: "Bis zum Saisonende", sub: `alle ${ende - jetzt} restlichen Spieltage` });
  return ziele;
}

function openFastForward(){
  if(gameState.board && gameState.board.dismissed){ showToast("Du bist entlassen.", "error"); return; }
  if(gameState.seasonEnded){ showToast("Saison beendet.", "info"); return; }
  document.getElementById("fastForwardChoices").innerHTML = getFastForwardTargets(gameState).map(z => `
    <button class="ghost choiceBtn" onclick="simulateUntil(${z.ziel})">
      <span class="choiceTitle">${z.titel}</span><span class="choiceSub">${z.sub}</span></button>`).join("");
  document.getElementById("fastForwardOverlay").classList.add("show");
}

function closeFastForward(){
  document.getElementById("fastForwardOverlay").classList.remove("show");
}

// Spielt alle Termine (Liga, Pokal, Europapokal) bis zum Zielspieltag.
function simulateUntil(ziel){
  closeFastForward();
  const startTag = gameState.matchday;
  const platzVorher = getOwnTablePosition(gameState);
  batchRun = { ziel };
  holdModals();
  let termine = 0;
  try {
    while(termine++ < 120){
      if(gameState.seasonEnded || (gameState.board && gameState.board.dismissed)) break;
      if(gameState.matchday >= ziel) break;
      runNextEvent();
    }
  } catch(e){
    console.error("Vorspulen fehlgeschlagen:", e);
    showToast("Vorspulen fehlgeschlagen (Details in der Konsole).", "error");
  } finally {
    batchRun = null;
  }

  const bilanz = { win: 0, draw: 0, loss: 0 };
  gameState.fixtures.forEach((f, idx) => {
    const tag = getFixtureMatchday(idx, gameState.teams.length);
    if(!f.played || tag <= startTag || (f.home !== gameState.clubName && f.away !== gameState.clubName)) return;
    bilanz[getResultForClub(gameState.clubName, f.home, f.away, f.homeGoals, f.awayGoals)]++;
  });
  const platz = getOwnTablePosition(gameState);
  const text = `⏭ ${gameState.matchday - startTag} Spieltage: ${bilanz.win} S · ${bilanz.draw} U · ${bilanz.loss} N`
    + (platz ? ` · Platz ${platz}${platzVorher && platzVorher !== platz ? ` (vorher ${platzVorher})` : ""}` : "");
  addLogEntry(gameState, text, bilanz.win >= bilanz.loss ? "win" : "loss", true);
  showToast(text, "info");
  renderAll(gameState);
  autoSave();
  releaseModals();
}
