// ============================================
// OFFERS.JS - Angebote anderer Vereine fuer eigene Spieler
// ============================================
// Bisher konnte man nur selbst verkaufen; die Liga interessierte sich nie
// fuer den eigenen Kader. Jetzt melden sich waehrend der Transferfenster
// Vereine mit Angeboten. Man kann annehmen, ablehnen oder einmal
// nachverhandeln. Wer ein grosses Angebot eines groesseren Vereins
// ablehnt, hat danach einen enttaeuschten Spieler.

function ensureOffers(gameState){
  if(!Array.isArray(gameState.incomingOffers)) gameState.incomingOffers = [];
  return gameState.incomingOffers;
}

// Wer kommt als Kaeufer in Frage: Vereine, fuer die der Spieler eine
// Verstaerkung waere oder die ungefaehr auf seinem Niveau spielen.
function pickOfferBuyer(gameState, player){
  const kandidaten = buildPoolClubList(gameState)
    .filter(c => c.strength >= player.strength - OFFER_BUYER_MAX_BELOW && c.strength <= player.strength + 15);
  return kandidaten.length > 0 ? randChoice(kandidaten) : null;
}

// Interessant sind vor allem gute und junge Spieler. Gerade Verpflichtete
// werden nicht sofort weitergereicht.
function pickOfferTarget(gameState){
  const vergeben = new Set(ensureOffers(gameState).map(o => o.playerId));
  const kandidaten = (gameState.squad || []).filter(p =>
    !vergeben.has(p.id) && p.joinedSeason !== gameState.season && !p.isOnLoan);
  if(kandidaten.length === 0) return null;
  const gewichtet = kandidaten.map(p => ({ p, w: Math.pow(Math.max(1, p.value), 0.6) * (p.age <= 23 ? 1.5 : 1) }));
  const summe = gewichtet.reduce((s, x) => s + x.w, 0);
  let wurf = Math.random() * summe;
  for(const x of gewichtet){ wurf -= x.w; if(wurf <= 0) return x.p; }
  return gewichtet[gewichtet.length - 1].p;
}

// Nach jedem Spieltag: abgelaufene Angebote entfernen und vielleicht ein
// neues erzeugen. Gibt das neue Angebot zurueck (oder null).
function updateIncomingOffers(gameState){
  const offers = ensureOffers(gameState);
  const tag = gameState.matchday + 1;
  const offen = isTransferWindowOpen(tag);
  gameState.incomingOffers = offers.filter(o =>
    offen && o.expires >= tag && (gameState.squad || []).some(p => p.id === o.playerId));

  if(!offen || gameState.seasonEnded) return null;
  if(gameState.incomingOffers.length >= OFFER_MAX_ACTIVE) return null;
  if(Math.random() > OFFER_CHANCE_PER_MATCHDAY) return null;

  const spieler = pickOfferTarget(gameState);
  if(!spieler) return null;
  const kaeufer = pickOfferBuyer(gameState, spieler);
  if(!kaeufer) return null;

  const fee = Math.max(50000, Math.round(spieler.value * randFloat(OFFER_FEE_MIN, OFFER_FEE_MAX) / 50000) * 50000);
  const angebot = {
    id: Math.random().toString(36).slice(2),
    playerId: spieler.id, playerName: spieler.name, pos: spieler.pos,
    club: kaeufer.name, clubStrength: kaeufer.strength, clubTier: kaeufer.tier,
    fee: fee, expires: getCurrentWindowEnd(tag) || tag, countered: false
  };
  gameState.incomingOffers.push(angebot);
  return angebot;
}

function findOffer(gameState, offerId){
  return ensureOffers(gameState).find(o => o.id === offerId) || null;
}

function removeOffer(gameState, offerId){
  gameState.incomingOffers = ensureOffers(gameState).filter(o => o.id !== offerId);
}

function acceptIncomingOffer(gameState, offerId){
  const o = findOffer(gameState, offerId);
  if(!o) return { success: false, message: "Das Angebot liegt nicht mehr vor." };
  const idx = gameState.squad.findIndex(p => p.id === o.playerId);
  if(idx === -1){ removeOffer(gameState, offerId); return { success: false, message: "Der Spieler ist nicht mehr im Kader." }; }
  if(!canSellFromSquad(gameState.squad)){
    return { success: false, message: `Mindestkader: ${MIN_SQUAD_SIZE} Spieler.` };
  }
  const spieler = gameState.squad[idx];
  gameState.squad.splice(idx, 1);
  pruneLineup(gameState);
  spieler.clubName = o.club;
  spieler.clubTier = o.clubTier || "div1";
  spieler.transferListed = false;
  spieler.consecutiveStarts = 0;
  if(gameState.pool) gameState.pool.players.push(spieler);
  gameState.budget = addToBudget(gameState.budget, o.fee);
  gameState.seasonTransferIn = (gameState.seasonTransferIn || 0) + o.fee;
  // Andere Angebote fuer denselben Spieler sind damit hinfaellig.
  gameState.incomingOffers = ensureOffers(gameState).filter(x => x.playerId !== o.playerId);
  return { success: true, message: `💰 ${spieler.name} wechselt für ${fmtMoney(o.fee)} zu ${o.club}.` };
}

function rejectIncomingOffer(gameState, offerId){
  const o = findOffer(gameState, offerId);
  if(!o) return { success: false, message: "Das Angebot liegt nicht mehr vor." };
  removeOffer(gameState, offerId);
  const spieler = gameState.squad.find(p => p.id === o.playerId);
  // Ein Top-Angebot eines groesseren Vereins abzulehnen enttaeuscht den Spieler.
  const grosserVerein = o.clubStrength > getOwnClubStrength(gameState) + 3;
  if(spieler && grosserVerein && o.fee >= spieler.value * OFFER_DISAPPOINT_RATIO){
    setMorale(spieler, getMorale(spieler) - OFFER_REJECT_MORALE);
    return { success: true, disappointed: true,
      message: `${spieler.name} ist enttäuscht: Er wäre gern zu ${o.club} gewechselt.` };
  }
  return { success: true, message: `Angebot von ${o.club} für ${o.playerName} abgelehnt.` };
}

// Einmal pro Angebot: mehr fordern. Der Verein legt nach oder zieht zurueck.
function counterIncomingOffer(gameState, offerId){
  const o = findOffer(gameState, offerId);
  if(!o) return { success: false, message: "Das Angebot liegt nicht mehr vor." };
  if(o.countered) return { success: false, message: "Du hast bereits nachverhandelt." };
  const spieler = gameState.squad.find(p => p.id === o.playerId);
  const forderung = Math.round(o.fee * (1 + OFFER_COUNTER_RAISE) / 50000) * 50000;
  const ueberzahlt = spieler ? forderung / Math.max(1, spieler.value) : 1;
  // Je weiter die Forderung ueber dem Marktwert liegt, desto eher springt der Verein ab.
  const chance = Math.max(0.15, Math.min(0.8, 0.95 - (ueberzahlt - 1) * 0.9));
  if(Math.random() < chance){
    o.fee = forderung;
    o.countered = true;
    return { success: true, accepted: true, message: `${o.club} legt nach: ${fmtMoney(forderung)} für ${o.playerName}.` };
  }
  removeOffer(gameState, offerId);
  return { success: true, accepted: false, message: `${o.club} ist die Forderung zu hoch und zieht das Angebot zurück.` };
}

// ---------- Oberflaeche ----------

function renderOfferPanel(gameState){
  const el = document.getElementById("offerPanel");
  if(!el) return;
  const offers = ensureOffers(gameState);
  if(offers.length === 0){
    el.innerHTML = `<p class="muted" style="margin:0;">Keine Angebote.</p>`;
    return;
  }
  el.innerHTML = offers.map(o => {
    const p = gameState.squad.find(x => x.id === o.playerId);
    const verhaeltnis = p ? Math.round(o.fee / Math.max(1, p.value) * 100) : 100;
    return `<div class="offerRow">
      <div class="offerText"><b>${o.club}</b> bietet <b class="num">${fmtMoney(o.fee)}</b> für
        <b>${o.pos} ${o.playerName}</b>${p ? ` <span class="muted">(${Math.round(p.strength)}, ${p.age} J., ${verhaeltnis} % MW)</span>` : ""}
        <span class="muted"> · bis ST ${o.expires}</span></div>
      <div class="offerButtons">
        <button onclick="handleOfferAccept('${o.id}')">Annehmen</button>
        <button class="ghost" onclick="handleOfferCounter('${o.id}')"${o.countered ? " disabled" : ""}>Mehr fordern</button>
        <button class="ghost" onclick="handleOfferReject('${o.id}')">Ablehnen</button>
      </div>
    </div>`;
  }).join("");
}

function afterOfferAction(result){
  showToast(result.message, result.success && !result.disappointed && result.accepted !== false ? "success" : "info");
  if(result.success) addLogEntry(gameState, result.message);
  renderOfferPanel(gameState);
  renderMarket(gameState);
  refreshSquadViews();
}

function handleOfferAccept(id){ afterOfferAction(acceptIncomingOffer(gameState, id)); }
function handleOfferReject(id){ afterOfferAction(rejectIncomingOffer(gameState, id)); }
function handleOfferCounter(id){ afterOfferAction(counterIncomingOffer(gameState, id)); }

// ---------- Leihen ----------
// Junge Spieler sammeln bei einem passenden Verein Spielpraxis und kommen
// zum Saisonende weiterentwickelt zurueck. Waehrend der Leihe zaehlen sie
// nicht zum Kader und kosten kein Gehalt.
function ensureLoans(gameState){
  if(!Array.isArray(gameState.loans)) gameState.loans = [];
  return gameState.loans;
}

function canLoanOut(gameState, player){
  if(!checkTransferWindow(gameState).open) return "Verleihen geht nur, solange das Transferfenster offen ist.";
  if(player.age > LOAN_MAX_AGE) return `Verliehen werden nur Spieler bis ${LOAN_MAX_AGE} Jahre.`;
  if(!canSellFromSquad(gameState.squad)) return `Kader zu klein (Minimum ${MIN_SQUAD_SIZE} Spieler).`;
  return null;
}

function loanOutPlayer(gameState, playerId){
  const idx = gameState.squad.findIndex(p => p.id === playerId);
  if(idx === -1) return { success: false, message: "Spieler nicht gefunden." };
  const player = gameState.squad[idx];
  const sperre = canLoanOut(gameState, player);
  if(sperre) return { success: false, message: sperre };
  const club = findNewClubFor(gameState, player);
  gameState.squad.splice(idx, 1);
  pruneLineup(gameState);
  ensureLoans(gameState).push({ player, club: club ? club.name : "einem anderen Verein", fromMatchday: gameState.matchday });
  gameState.incomingOffers = ensureOffers(gameState).filter(o => o.playerId !== player.id);
  return { success: true, message: `🔁 ${player.name} wird bis Saisonende an ${club ? club.name : "einen anderen Verein"} verliehen.` };
}

// Zum Saisonende: Leihspieler kehren zurueck, mit Entwicklung je nach Leihdauer.
function returnLoans(gameState){
  const zurueck = [];
  ensureLoans(gameState).forEach(l => {
    const p = l.player;
    const spieltage = getSeasonMatchdays(gameState);
    const anteil = Math.max(0.3, (spieltage - (l.fromMatchday || 0)) / spieltage);
    const raum = Math.max(0, p.maxStrength - p.strength);
    const gewinn = Math.min(raum, randFloat(LOAN_GAIN_MIN, LOAN_GAIN_MAX) * anteil * (p.age <= 20 ? 1.2 : 1));
    const vorher = Math.round(p.strength);
    if(gewinn > 0){ applyAttributeChange(p, gewinn); refreshPlayerValue(p); }
    if(typeof setMorale === "function") setMorale(p, getMorale(p) + 5);
    p.consecutiveStarts = 0;
    gameState.squad.push(p);
    zurueck.push({ name: p.name, club: l.club, vorher, nachher: Math.round(p.strength) });
  });
  gameState.loans = [];
  return zurueck;
}

function handleLoanOut(playerId){
  const r = loanOutPlayer(gameState, playerId);
  showToast(r.message, r.success ? "success" : "error");
  if(r.success){ addLogEntry(gameState, r.message); closePlayerModal(); refreshSquadViews(); renderMarket(gameState); renderLoanPanel(gameState); }
}

function renderLoanPanel(gameState){
  const el = document.getElementById("loanPanel");
  if(!el) return;
  const loans = ensureLoans(gameState);
  el.innerHTML = loans.length === 0
    ? '<p class="muted" style="margin:0;">Keine Leihspieler.</p>'
    : loans.map(l => `<div class="contractRow"><span><b>${l.player.pos}</b> ${l.player.name} <span class="muted">· ${Math.round(l.player.strength)} · ${l.player.age} J.</span></span><span class="muted">bei ${l.club} bis Saisonende</span></div>`).join("");
}
