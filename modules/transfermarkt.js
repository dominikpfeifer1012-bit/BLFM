// ============================================
// TRANSFERMARKT.JS - Kauf-/Verkaufslogik mit einstellbaren Filtern
// ============================================

let market = [];

let marketFilters = {
  minAge: 17,
  maxAge: 36,
  minPriceMio: 0,
  maxPriceMio: 50
};

// Marktqualitaet richtet sich nach der aktuellen Vereinsstaerke aus dem
// Ligapool, nicht nach dem eingefrorenen Startwert in CLUBS.
function getOwnClubStrength(gameState){
  const pool = getAllLeagueClubs(gameState);
  const club = pool.find(c => c.name === gameState.clubName);
  if(club) return club.strength;
  const fallback = CLUBS.find(c => c.name === gameState.clubName);
  return fallback ? fallback.strength : 70;
}

function isTransferWindowOpen(currentMatchday1Based){
  return getTransferWindows().some(([start, end]) =>
    currentMatchday1Based >= start && currentMatchday1Based <= end
  );
}

function getNextWindowStart(currentMatchday1Based){
  for(const [start, end] of getTransferWindows()){
    if(currentMatchday1Based < start) return start;
  }
  return null;
}

function getCurrentWindowEnd(currentMatchday1Based){
  const win = getTransferWindows().find(([start, end]) =>
    currentMatchday1Based >= start && currentMatchday1Based <= end
  );
  return win ? win[1] : null;
}

function buildFilterPayload(){
  return {
    minAge: marketFilters.minAge,
    maxAge: marketFilters.maxAge,
    minPrice: Math.round(marketFilters.minPriceMio * 1000000),
    maxPrice: Math.round(marketFilters.maxPriceMio * 1000000)
  };
}

function setMarketFilters(newFilters){
  marketFilters = Object.assign({}, marketFilters, newFilters);
}

// Eine Regel fuer alle Wege zu einem neuen Angebot: erstes Oeffnen,
// Aktualisieren-Knopf und Filterwechsel teilen sich dasselbe Kontingent.
// Sonst liesse sich die Sperre ueber den Filter beliebig umgehen.
function canGenerateOffer(gameState){
  return gameState.marketRefreshedOnMatchday !== gameState.matchday;
}

function generateOffer(gameState){
  market = generateMarketOffer(getOwnClubStrength(gameState), buildFilterPayload());
  gameState.marketRefreshedOnMatchday = gameState.matchday;
  return market;
}

function initMarket(gameState){
  if(market.length === 0 && canGenerateOffer(gameState)) generateOffer(gameState);
  return market;
}

// Im gameState statt in einer Modulvariable: sonst waere die Sperre nach
// jedem Laden eines Spielstands wieder aufgehoben.
function refreshMarket(gameState){
  if(!canGenerateOffer(gameState)){
    return { success: false, message: "Das Angebot lässt sich nur einmal pro Spieltag erneuern." };
  }
  generateOffer(gameState);
  return { success: true, message: "Transfermarkt wurde aktualisiert." };
}

// Filter werden immer gespeichert. Ein neues Angebot gibt es nur, wenn das
// Kontingent des Spieltags noch frei ist.
function applyMarketFilters(gameState, filters){
  setMarketFilters(filters);
  if(!canGenerateOffer(gameState)){
    return { success: false, regenerated: false,
      message: "Filter gespeichert. Ein neues Angebot gibt es am nächsten Spieltag." };
  }
  generateOffer(gameState);
  return { success: true, regenerated: true, message: "Filter angewendet, neues Angebot erstellt." };
}

// Eine Stelle fuer die Fensterpruefung, damit sie nicht umgangen werden kann,
// wenn ein Tab oder Dialog den Markt auf einem anderen Weg erreichbar macht.
function checkTransferWindow(gameState){
  const currentDay = gameState.matchday + 1;
  if(isTransferWindowOpen(currentDay)) return { open: true };

  const nextStart = getNextWindowStart(currentDay);
  return {
    open: false,
    message: nextStart
      ? `Das Transferfenster ist geschlossen. Es öffnet wieder an Spieltag ${nextStart}.`
      : "Das Transferfenster ist geschlossen und öffnet in dieser Saison nicht mehr."
  };
}

function buyPlayerFromMarket(gameState, marketIndex){
  const window = checkTransferWindow(gameState);
  if(!window.open) return { success: false, message: window.message };

  const player = market[marketIndex];
  if(!player){
    return { success: false, message: "Spieler nicht mehr verfuegbar." };
  }

  const deduction = deductFromBudget(gameState.budget, player.value);
  if(!deduction.success){
    return {
      success: false,
      message: `Nicht genug Budget! Benötigt: ${fmtMoney(player.value)}, verfügbar: ${fmtMoney(gameState.budget)}`
    };
  }

  gameState.budget = deduction.newBudget;
  gameState.squad.push(player);
  market.splice(marketIndex, 1);

  const scoutTag = player.isScoutingFind ? " 🔍 Scouting-Fund!" : "";
  return {
    success: true,
    message: `✅ Transfer: ${player.name} (${player.pos}, Bewertung ${player.strength}) für ${fmtMoney(player.value)} verpflichtet.${scoutTag}`
  };
}

function sellPlayerFromSquad(gameState, squadIndex){
  const window = checkTransferWindow(gameState);
  if(!window.open) return { success: false, message: window.message };

  const player = gameState.squad[squadIndex];
  if(!player){
    return { success: false, message: "Spieler nicht gefunden." };
  }

  if(!canSellFromSquad(gameState.squad)){
    return { success: false, message: `Kader zu klein zum Verkaufen! (Minimum ${MIN_SQUAD_SIZE} Spieler)` };
  }

  const sellValue = calculateSellValue(player.value);
  gameState.budget = addToBudget(gameState.budget, sellValue);
  gameState.squad.splice(squadIndex, 1);
  pruneLineup(gameState);

  return {
    success: true,
    message: `💰 Transfer: ${player.name} für ${fmtMoney(sellValue)} verkauft.`
  };
}

function resetMarket(gameState){
  market = [];
  if(gameState) gameState.marketRefreshedOnMatchday = -1;
}
