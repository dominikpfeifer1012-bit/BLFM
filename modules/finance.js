// ============================================
// FINANCE.JS - Sponsoren, Trainingslager, Unterhalt
// ============================================
// Geld hatte zu wenig Nutzen: nach zehn Jahren lagen oft 60 bis 130 Mio.
// ungenutzt herum. Jetzt kosten Anlagen Unterhalt, ein Trainingslager vor
// der Saison bringt einen Formschub, und die Sponsorenwahl ist eine echte
// Entscheidung zwischen Sicherheit und Risiko.

// Alles, was pro Saison neu entschieden wird, liegt unter gameState.finance
// und wird beim ersten Zugriff in einer neuen Saison frisch angelegt. So
// braucht es keine eigenen Rueckstellungen beim Saisonwechsel.
function ensureSeasonFinance(gameState){
  if(!gameState.finance || gameState.finance.season !== gameState.season){
    gameState.finance = { season: gameState.season, sponsor: null, camp: null, sponsorWins: 0 };
  }
  return gameState.finance;
}

function getFinanceScale(gameState){
  const f = typeof getOwnRevenueFactor === "function" ? getOwnRevenueFactor() : 1;
  return 0.2 + f;
}

function getSponsorOffers(gameState){
  const basis = SPONSOR_BASE * getFinanceScale(gameState);
  const rund = x => Math.round(x / 50000) * 50000;
  return [
    { key: "fix", label: "Festbetrag", icon: "🏦", upfront: rund(basis), perWin: 0, goalBonus: 0 },
    { key: "leistung", label: "Leistung", icon: "📈", upfront: rund(basis * 0.25), perWin: rund(basis * 0.075), goalBonus: 0 },
    { key: "ziel", label: "Saisonziel", icon: "🎯", upfront: rund(basis * 0.4), perWin: 0, goalBonus: rund(basis * 1.25) }
  ];
}

function chooseSponsor(gameState, key, still){
  const fin = ensureSeasonFinance(gameState);
  if(fin.sponsor) return { success: false, message: "Für diese Saison ist bereits ein Sponsor gewählt." };
  const angebot = getSponsorOffers(gameState).find(o => o.key === key);
  if(!angebot) return { success: false, message: "Unbekanntes Angebot." };
  fin.sponsor = Object.assign({}, angebot);
  gameState.budget = addToBudget(gameState.budget, angebot.upfront);
  const text = `${angebot.icon} Sponsor gewählt: ${angebot.label} — ${fmtMoney(angebot.upfront)} sofort` +
    (angebot.perWin ? `, ${fmtMoney(angebot.perWin)} pro Sieg` : "") +
    (angebot.goalBonus ? `, ${fmtMoney(angebot.goalBonus)} bei erreichtem Saisonziel` : "") + ".";
  return { success: true, message: still ? text + " (automatisch gewählt)" : text };
}

function getSponsorWinBonus(gameState){
  const fin = ensureSeasonFinance(gameState);
  if(!fin.sponsor || !fin.sponsor.perWin) return 0;
  fin.sponsorWins = (fin.sponsorWins || 0) + 1;
  return fin.sponsor.perWin;
}

function getSponsorGoalBonus(gameState, finalPosition, targetPosition){
  const fin = ensureSeasonFinance(gameState);
  if(!fin.sponsor || !fin.sponsor.goalBonus) return 0;
  return finalPosition <= targetPosition ? fin.sponsor.goalBonus : 0;
}

function getCampOffers(gameState){
  const s = getFinanceScale(gameState);
  return CAMP_TIERS.map(t => Object.assign({}, t, { cost: Math.round(t.costBase * s / 50000) * 50000 }));
}

function canBookCamp(gameState){
  return gameState.matchday === 0 && !ensureSeasonFinance(gameState).camp;
}

function bookCamp(gameState, key){
  if(!canBookCamp(gameState)) return { success: false, message: "Trainingslager nicht mehr möglich." };
  const lager = getCampOffers(gameState).find(c => c.key === key);
  if(!lager) return { success: false, message: "Unbekanntes Trainingslager." };
  if(lager.cost > gameState.budget) return { success: false, message: `Nicht bezahlbar: ${fmtMoney(lager.cost)} nötig.` };
  gameState.budget -= lager.cost;
  ensureSeasonFinance(gameState).camp = { key: lager.key, label: lager.label, boost: lager.boost, untilMatchday: lager.matchdays };
  (gameState.squad || []).forEach(p => setMorale(p, getMorale(p) + lager.morale));
  return { success: true, message: `🏕 ${lager.label}: ${fmtMoney(lager.cost)} — Stimmung +${lager.morale}` +
    (lager.boost ? `, Stärke +${fmtDecimal(lager.boost)} für ${lager.matchdays} Spieltage` : "") + "." };
}

// Formschub aus dem Trainingslager fuer die ersten Spieltage.
function getCampBoost(gameState){
  const fin = gameState.finance;
  if(!fin || fin.season !== gameState.season || !fin.camp) return 0;
  return gameState.matchday < fin.camp.untilMatchday ? fin.camp.boost : 0;
}

// Unterhalt aller ausgebauten Anlagen pro Spieltag.
function getFacilityUpkeep(gameState){
  if(!gameState.facilities) return 0;
  const stufen = Object.values(gameState.facilities).reduce((s, v) => s + (v || 0), 0);
  return Math.round(stufen * FACILITY_UPKEEP_PER_LEVEL * Math.sqrt(getFinanceScale(gameState) + 0.05) / 1000) * 1000;
}

// ---------- Oberflaeche ----------

function renderPreseasonPanel(gameState){
  const el = document.getElementById("preseasonPanel");
  if(!el) return;
  const fin = ensureSeasonFinance(gameState);
  const zeigeSponsor = !fin.sponsor;
  const zeigeLager = canBookCamp(gameState);
  const card = el.closest(".card");
  if(!zeigeSponsor && !zeigeLager){
    if(card) card.style.display = "none";
    return;
  }
  if(card) card.style.display = "";
  let html = "";
  if(zeigeSponsor){
    html += `<p class="eyebrow">Sponsor für ${gameState.season}/${String(gameState.season + 1).slice(2)}</p>
      <div class="choiceGrid">${getSponsorOffers(gameState).map(o => `
        <button class="ghost choiceBtn" onclick="handleChooseSponsor('${o.key}')">
          <span class="choiceTitle">${o.icon} ${o.label}</span>
          <span class="choiceSub">${fmtMoney(o.upfront)} sofort${o.perWin ? ` · ${fmtMoney(o.perWin)} pro Sieg` : ""}${o.goalBonus ? ` · ${fmtMoney(o.goalBonus)} bei Saisonziel` : ""}</span></button>`).join("")}</div>`;
  }
  if(zeigeLager){
    html += `<p class="eyebrow" style="margin-top:14px;">Trainingslager</p>
      <div class="choiceGrid">${getCampOffers(gameState).map(c => `
        <button class="ghost choiceBtn" onclick="handleBookCamp('${c.key}')"${c.cost > gameState.budget ? " disabled" : ""}>
          <span class="choiceTitle">${c.icon} ${c.label} · ${fmtMoney(c.cost)}</span>
          <span class="choiceSub">Stimmung +${c.morale}${c.boost ? ` · Stärke +${fmtDecimal(c.boost)} für ${c.matchdays} Spieltage` : ""}</span></button>`).join("")}</div>`;
  }
  el.innerHTML = html;
}

function handleChooseSponsor(key){
  const r = chooseSponsor(gameState, key);
  showToast(r.message, r.success ? "success" : "error");
  if(r.success) addLogEntry(gameState, r.message);
  renderPreseasonPanel(gameState);
  renderHeader(gameState);
}

function handleBookCamp(key){
  const r = bookCamp(gameState, key);
  showToast(r.message, r.success ? "success" : "error");
  if(r.success) addLogEntry(gameState, r.message);
  renderPreseasonPanel(gameState);
  refreshSquadViews();
}
