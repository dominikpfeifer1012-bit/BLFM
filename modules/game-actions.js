// ============================================
// GAME-ACTIONS.JS - Eingaben des Spielers: Taktik, Transfers, Spielstaende
// ============================================
// Teil der aufgeteilten Spiellogik. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

// Wichtig: eigene Objekte, damit die Staerke-Drift nicht die Konstante
// CLUBS ueberschreibt und in die naechste Karriere durchschlaegt.
// Die drei weiteren Bundesliga-Startplaetze gehen an die restlichen
// Top-4-Vereine der Vorsaison.
function handleFormationChange(name){
  if(!FORMATIONS[name]) return;
  gameState.formation = name;
  // Die Slot-Schluessel unterscheiden sich je Formation, alte Vorgaben passen nicht mehr.
  clearLineup(gameState);
  addLogEntry(gameState, `📋 Formation umgestellt auf ${name}.`);
  showToast(`Formation ${name} — Aufstellung wieder automatisch.`, "info");
  refreshSquadViews();
}

function handleTrainingChange(key){
  if(!TRAINING_FOCUS[key]) return;
  gameState.training = key;
  addLogEntry(gameState, `\u{1F3CB} Trainingsschwerpunkt: ${TRAINING_FOCUS[key].label}.`);
  showToast(`Training: ${TRAINING_FOCUS[key].label}`, "info");
  refreshSquadViews();
}

function handleTacticChange(key){
  if(!TACTICS[key]) return;
  gameState.tactic = key;
  addLogEntry(gameState, `📋 Ausrichtung: ${TACTICS[key].label}.`);
  showToast(`Ausrichtung: ${TACTICS[key].label}`, "info");
  refreshSquadViews();
}

function handleRenewContract(playerId){
  const spieler = (gameState.squad || []).find(p => p.id === playerId);
  const result = renewContract(gameState, playerId);
  if(result.success && spieler) applyRenewalMoraleBoost(spieler);
  showToast(result.message, result.success ? "success" : "error");
  if(result.success){
    addLogEntry(gameState, result.message);
    // Nur das offene Profil auffrischen; aus der Vertragsliste heraus kein neues Fenster.
    const profil = document.getElementById("playerModalOverlay");
    if(profil && profil.classList.contains("show")) showPlayerDetail(playerId);
    refreshSquadViews();
  }
}

// Der Transfers-Tab ist immer erreichbar. Ob gehandelt werden darf,
// entscheidet die Kauf- bzw. Verkaufslogik.
function openTransferMarket(){
  switchTab("transfers");
  renderMarket(gameState);
}

function handleSignPlayer(playerId){
  const budgetBefore = gameState.budget;
  const result = signPlayerFromPool(gameState, playerId);
  if(!result.success){
    showToast(result.message, "error");
    return;
  }

  addLogEntry(gameState, result.message, "win", true);
  showToast(result.message, "success");

  if(budgetBefore > 0 && result.fee > budgetBefore * 0.5) unlockAchievement("bigSigning");
  updateTransferRecords(gameState, result.player, result.fee);
  gameState.seasonTransferOut = (gameState.seasonTransferOut || 0) + result.fee;

  closePlayerModal();
  renderMarket(gameState);
  refreshSquadViews();
}

function handleSellPlayer(squadIndex){
  const result = sellPlayerToPool(gameState, squadIndex);
  if(!result.success){
    showToast(result.message, "error");
    return;
  }
  gameState.seasonTransferIn = (gameState.seasonTransferIn || 0) + (result.erloes || 0);
  addLogEntry(gameState, result.message);
  showToast(result.message, "success");
  renderMarket(gameState);
  refreshSquadViews();
}

function autoSave(){
  if(typeof gameState !== "undefined") autoSaveGameState(gameState);
}

// Auch Transfers und Umstellungen zwischen zwei Spieltagen sichern, wenn der
// Tab geschlossen oder auf dem Handy in den Hintergrund geschoben wird.
window.addEventListener("pagehide", autoSave);
document.addEventListener("visibilitychange", () => {
  if(document.visibilityState === "hidden") autoSave();
});

function saveGame(slot){
  const result = saveGameState(gameState, slot != null ? slot : (gameState.saveSlot || 1));
  if(result.success) gameState.saveSlot = slot != null ? slot : (gameState.saveSlot || 1);
  showToast(result.message, result.success ? "success" : "error");
  renderSaveSlots();
}

function handleSaveToSlot(slot){
  saveGame(slot);
}

function handleLoadFromSlot(slot){
  const geladen = loadGameState(slot);
  if(!geladen.found){ showToast("Auf diesem Platz liegt kein Spielstand.", "error"); return; }
  applyLoadedState(geladen.state);
  if(slot !== AUTOSAVE_SLOT) gameState.saveSlot = slot;
  closeSaveModal();
  showToast(slot === AUTOSAVE_SLOT ? "Automatisch gespeicherten Stand geladen." : `Spielstand von Platz ${slot} geladen.`, "success");
}

function handleDeleteSlot(slot){
  deleteSlot(slot);
  showToast(`Platz ${slot} gelöscht.`, "info");
  renderSaveSlots();
}

function handleExportSave(){
  showToast(exportGameState(gameState).message, "info");
}

function handleImportSave(input){
  const datei = input && input.files && input.files[0];
  if(!datei) return;
  const leser = new FileReader();
  leser.onload = function(){
    const ergebnis = parseImportedSave(String(leser.result));
    if(!ergebnis.success){ showToast(ergebnis.message, "error"); return; }
    applyLoadedState(ergebnis.state);
    closeSaveModal();
    showToast("Spielstand importiert.", "success");
  };
  leser.onerror = function(){ showToast("Die Datei ließ sich nicht lesen.", "error"); };
  leser.readAsText(datei);
  input.value = "";
}

window.onload = function(){
  migrateLegacySave();
  const belegt = listSaveSlots().filter(p => p.belegt);
  const auto = readAutoSaveInfo();
  if(auto) belegt.push(auto);
  if(belegt.length === 0) return;

  // Zuletzt gespeicherter Platz wird vorgeschlagen.
  const juengster = belegt.slice().sort((a, b) =>
    String(b.savedAt || "").localeCompare(String(a.savedAt || "")))[0];
  const geladen = loadGameState(juengster.slot);
  if(!geladen.found) return;

  pendingLoad = geladen;
  const info = document.getElementById("loadConfirmInfo");
  if(info) info.textContent = `${juengster.label} (${juengster.slot === AUTOSAVE_SLOT ? "automatisch gespeichert" : "Platz " + juengster.slot})`;
  document.getElementById("loadConfirmOverlay").classList.add("show");
};

// Nimmt einen geladenen Zustand entgegen, ergaenzt fehlende Felder und
// zeigt das Spiel an. Wird von Ladedialog, Platzauswahl und Import genutzt.

// Nimmt einen geladenen Zustand entgegen, ergaenzt fehlende Felder und
// zeigt das Spiel an. Wird von Ladedialog, Platzauswahl und Import genutzt.
function applyLoadedState(state){
  gameState = state;

    if(Array.isArray(gameState.log)){
      gameState.log = gameState.log.map(entry =>
        typeof entry === "string" ? { msg: entry, result: null, isNewDay: false } : entry
      );
    }
    gameState.ratingHistory = gameState.ratingHistory || [];
    gameState.budgetHistory = gameState.budgetHistory || [];
    gameState.seasonHistory = gameState.seasonHistory || [];
    gameState.achievements = gameState.achievements || [];
    gameState.currentWinStreak = gameState.currentWinStreak || 0;
    gameState.lineup = gameState.lineup || {};
    if(gameState.marketRefreshedOnMatchday == null) gameState.marketRefreshedOnMatchday = -1;
    if(!FORMATIONS[gameState.formation]) gameState.formation = DEFAULT_FORMATION;
    if(!TACTICS[gameState.tactic]) gameState.tactic = DEFAULT_TACTIC;
    if(!TRAINING_FOCUS[gameState.training]) gameState.training = DEFAULT_TRAINING;
    if(gameState.pressConferences == null) gameState.pressConferences = true;
    if(gameState.lastPressMatchday == null) gameState.lastPressMatchday = -99;
    gameState.pressHistory = gameState.pressHistory || [];
    ensureFacilities(gameState);
    if(!Array.isArray(gameState.youthSquad)) gameState.youthSquad = [];
    ensureSquadAttributes(gameState.youthSquad);
    if(typeof ensureSquadMorale === "function") ensureSquadMorale(gameState.youthSquad);
    registerExistingNames(gameState.youthSquad);
    if(gameState.clubStature == null) gameState.clubStature = getOwnClubStrength(gameState);
    if(gameState.liveMatches == null) gameState.liveMatches = true;
    ensureRecords(gameState);
    ensureLeaguePools(gameState);
    if(!gameState.shadowLeagues){
      gameState.shadowLeagues = createShadowLeagues(gameState);
    }
    if(!gameState.youth) gameState.youth = createFreshYouthTeam();
    ensureSquadMorale(gameState.squad);
    if(gameState.pool) ensureSquadMorale(gameState.pool.players);
    if(!gameState.board) gameState.board = createFreshBoard(getOwnClubStrength(gameState), gameState.division);
    gameState.division = gameState.division || 1;
    ensureLeaguePools(gameState);
    gameState.leagueOnePool = gameState.leaguePools[0];
    gameState.leagueTwoPool = gameState.leaguePools[1];
    getAllLeagueClubs(gameState).forEach(c => {
      if(c.baseStrength == null) c.baseStrength = c.strength;
    });
    gameState.lastSeasonWasDivision1 = gameState.lastSeasonWasDivision1 != null ? gameState.lastSeasonWasDivision1 : true;
    if(!gameState.cup || !Array.isArray(gameState.cup.teamsRemaining)) gameState.cup = createFreshCup(gameState);
    gameState.lastTopFour = gameState.lastTopFour || [];
    // Altstände ohne Gruppenphase laufen ohne Europapokal weiter.
    if(!gameState.europe || !gameState.europe.phase) gameState.europe = createFreshEurope(false);

    registerExistingNames(gameState.squad);

    // Spielstaende ohne Weltpool bekommen einen frisch erzeugten.
    if(!gameState.pool || !Array.isArray(gameState.pool.players)){
      gameState.pool = createWorldPool(gameState);
    } else {
      ensureSquadAttributes(gameState.pool.players);
      registerExistingNames(gameState.pool.players);
      gameState.pool.players.forEach(p => {
        if(p.contractYears == null) p.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
      });
      detachOwnClubFromPool(gameState);
    }

    (gameState.squad || []).forEach(p => {
      if(p.goalsSeason == null) p.goalsSeason = 0;
      if(p.yellowCards == null) p.yellowCards = 0;
      if(p.suspendedUntilMatchday == null) p.suspendedUntilMatchday = 0;
      if(p.consecutiveStarts == null) p.consecutiveStarts = 0;
      if(p.contractYears == null) p.contractYears = randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS);
      ensurePlayerAttributes(p);   // Attribute aus der alten Gesamtstaerke ableiten
    });

    
  document.getElementById("setup").style.display = "none";
  document.getElementById("stickyBar").style.display = "block";
  document.getElementById("game").style.display = "block";
  renderAll(gameState);
}

function confirmLoadGame(accepted){
  document.getElementById("loadConfirmOverlay").classList.remove("show");
  if(accepted && pendingLoad) applyLoadedState(pendingLoad.state);
  pendingLoad = null;
}

// --- Pressekonferenzen ---

function maybeOpenPressConference(){
  if(gameState.board && gameState.board.dismissed) return;
  const situation = pickPressSituation(gameState);
  if(!situation) return;
  queueModal(() => showPressConference(situation));
}

function answerPressConference(situationKey, index){
  const antwort = applyPressAnswer(gameState, situationKey, index);
  closePressModal();
  if(!antwort) return;

  const teile = [];
  if(antwort.morale) teile.push(`Stimmung ${antwort.morale > 0 ? "+" : ""}${antwort.morale}`);
  if(antwort.patience) teile.push(`Vorstand ${antwort.patience > 0 ? "+" : ""}${antwort.patience}`);

  addLogEntry(gameState,
    `\u{1F399} Pressekonferenz: „${antwort.text}"${teile.length ? ` (${teile.join(", ")})` : ""}`);
  showToast(antwort.folge, antwort.morale >= 0 ? "success" : "info");
  refreshSquadViews();
  renderBoardPanel(gameState);
}

function togglePressConferences(){
  gameState.pressConferences = !isPressEnabled(gameState);
  showToast(isPressEnabled(gameState)
    ? "Pressekonferenzen eingeschaltet."
    : "Pressekonferenzen aus — es gibt keine Nachfragen mehr.", "info");
  renderHeader(gameState);
}

// --- Jugendkader ---

function handlePromoteYouth(playerId){
  const result = promoteYouthPlayer(gameState, playerId);
  showToast(result.message, result.success ? "success" : "error");
  if(result.success){
    addLogEntry(gameState, result.message, "win");
    closePlayerModal();
    refreshSquadViews();
  }
}

function handleDemoteToYouth(playerId){
  const result = demoteToYouthSquad(gameState, playerId);
  showToast(result.message, result.success ? "success" : "error");
  if(result.success){
    addLogEntry(gameState, result.message);
    closePlayerModal();
    refreshSquadViews();
  }
}

function handlePickYouthCandidate(index){
  const kandidaten = gameState.pendingYouthCandidates || [];
  const spieler = kandidaten[index];
  if(!spieler || spieler.__gewaehlt) return;

  const gewaehlt = kandidaten.filter(k => k.__gewaehlt).length;
  if(gewaehlt >= YOUTH_INTAKE_MAX_PICK){
    showToast(`Du kannst höchstens ${YOUTH_INTAKE_MAX_PICK} Talente aufnehmen.`, "info");
    return;
  }

  const result = addToYouthSquad(gameState, spieler);
  if(!result.success){ showToast(result.message, "error"); return; }

  spieler.__gewaehlt = true;
  addLogEntry(gameState, `\u{1F331} Aus der Jugendabteilung: ${spieler.name} (${spieler.pos}, Potenzial bis ${Math.round(spieler.maxStrength)}).`);
  renderYouthIntakeModal();
}

function finishYouthIntake(){
  const kandidaten = gameState.pendingYouthCandidates || [];
  const gewaehlt = kandidaten.filter(k => k.__gewaehlt).length;
  kandidaten.forEach(k => { if(!k.__gewaehlt && typeof releasePlayerName === "function") releasePlayerName(k.name); });

  gameState.pendingYouthCandidates = null;
  closeYouthIntakeModal();
  if(gewaehlt === 0) addLogEntry(gameState, "\u{1F331} Kein Talent aus dem Jahrgang übernommen.");
  refreshSquadViews();
}

// --- Investitionen ---

function handleUpgradeFacility(key){
  const result = upgradeFacility(gameState, key);
  showToast(result.message, result.success ? "success" : "error");
  if(result.success){
    addLogEntry(gameState, result.message, "win");
    renderFacilities(gameState);
    refreshSquadViews();
  }
}
