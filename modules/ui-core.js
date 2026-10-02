// ============================================
// UI-CORE.JS - Grundlagen: Meldungen, Tabs, Protokoll, Sammelrendern
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

const LOG_BADGE_LABELS = { win: "Sieg", loss: "Niederlage", draw: "Remis" };

// short: Beschriftung in der Tab-Leiste am unteren Rand auf dem Handy.
const TABS = [
  { id:"uebersicht",  label:"Übersicht",   short:"Start",     icon:"🏠" },
  { id:"kader",       label:"Kader",       short:"Kader",     icon:"👥" },
  { id:"transfers",   label:"Transfers",   short:"Transfers", icon:"🔁" },
  { id:"wettbewerbe", label:"Wettbewerbe", short:"Tabellen",  icon:"🏆" },
  { id:"statistik",   label:"Statistik",   short:"Statistik", icon:"📊" },
  { id:"verlauf",     label:"Verlauf",     short:"Verlauf",   icon:"📜" }
];

let activeTab = "uebersicht";

function renderTabBar(){
  const bar = document.getElementById("tabBar");
  if(!bar) return;
  // Gruener Punkt am Transfers-Tab, solange das Transferfenster offen ist.
  const fensterOffen = typeof gameState !== "undefined" && gameState && gameState.fixtures
    && typeof isTransferWindowOpen === "function" && isTransferWindowOpen(gameState.matchday + 1);
  bar.innerHTML = TABS.map(t =>
    `<button class="tabBtn${t.id === activeTab ? " active" : ""}" onclick="switchTab('${t.id}')">` +
      `<span class="tabIcon">${t.icon}</span><span class="tabLong">${t.label}</span><span class="tabShort">${t.short}</span>` +
      `${t.id === "transfers" && fensterOffen ? '<span class="tabDot" title="Transferfenster offen"></span>' : ""}</button>`
  ).join("");
  TABS.forEach(t => {
    const panel = document.getElementById("tab-" + t.id);
    if(panel) panel.classList.toggle("active", t.id === activeTab);
  });
}

function switchTab(id){
  activeTab = id;
  renderTabBar();

  // Den geoeffneten Bereich neu zeichnen. Ohne das war der Transfermarkt
  // leer, wenn man den Tab direkt anklickt statt ueber einen Knopf zu gehen.
  if(typeof gameState === "undefined" || !gameState || !gameState.squad) return;
  if(id === "transfers" && typeof renderMarket === "function"){ renderMarket(gameState); renderOfferPanel(gameState); }
  if(id === "kader" && typeof renderSquad === "function") renderSquad(gameState);
  if(id === "wettbewerbe" && typeof renderFixtureList === "function") renderFixtureList(gameState);
  if(id === "uebersicht"){
    // Der Uebersichtsbereich enthaelt Karten, die sich zwischen zwei
    // Spieltagen aendern koennen — etwa nach einer Investition.
    [renderNextMatch, renderMiniTable, renderOverviewStats, renderOverviewCompetitions,
     renderOverviewLog, renderBoardPanel, renderFacilities].forEach(fn => {
      if(typeof fn === "function") fn(gameState);
    });
  }
  if(id === "statistik"){
    [renderSeasonStats, renderSquadAnalysis, renderNationBreakdown, renderTopScorers,
     renderRecords, renderSeasonTrends].forEach(fn => {
      if(typeof fn === "function") fn(gameState);
    });
  }
}

const TOAST_MAX_VISIBLE = 3;

function showToast(message, type){
  type = type || "info";
  const container = document.getElementById("toastContainer");
  if(!container){ return; }
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  // Nach einem Spieltag kommen oft mehrere Meldungen auf einmal. Mehr als drei
  // gleichzeitig verdecken nur die Oberflaeche, die aeltesten weichen.
  const maxSichtbar = window.innerWidth <= 560 ? 2 : TOAST_MAX_VISIBLE;
  while(container.children.length > maxSichtbar) container.firstElementChild.remove();
  setTimeout(() => {
    toast.style.transition = "opacity .3s ease";
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 4200);
}

function statBox(k, v, sub, gold){
  return `<div class="stat"><div class="k">${k}</div><div class="v${gold ? " gold" : ""}">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;
}

function getOwnTeamRow(gameState){
  const sorted = getSortedStandings(gameState.teams);
  const idx = sorted.findIndex(t => t.name === gameState.clubName);
  return { row: sorted[idx], position: idx + 1, sorted };
}

let logPage = 0;

function renderLog(gameState){
  const el = document.getElementById("log");
  if(!el) return;

  const eintraege = gameState.log || [];
  const seiten = Math.max(1, Math.ceil(eintraege.length / LOG_PAGE_SIZE));
  if(logPage >= seiten) logPage = seiten - 1;
  if(logPage < 0) logPage = 0;

  const seite = eintraege.slice(logPage * LOG_PAGE_SIZE, (logPage + 1) * LOG_PAGE_SIZE);
  const zeilen = seite.map(entry => {
    const badge = entry.result
      ? `<span class="badge ${entry.result}">${LOG_BADGE_LABELS[entry.result]}</span> `
      : "";
    const cls = entry.isNewDay ? ' class="logDivider"' : "";
    return `<div${cls}>${badge}${entry.msg}</div>`;
  }).join("");

  const blaettern = seiten > 1 ? `
    <div style="display:flex; gap:8px; align-items:center; justify-content:center;
      margin-top:12px; padding-top:10px; border-top:1px solid var(--line);">
      <button class="ghost" onclick="logTurnPage(-1)"${logPage === 0 ? " disabled" : ""}>Neuer</button>
      <span class="muted" style="font-size:12px;">Seite ${logPage + 1} von ${seiten}</span>
      <button class="ghost" onclick="logTurnPage(1)"${logPage >= seiten - 1 ? " disabled" : ""}>Älter</button>
    </div>` : "";

  el.innerHTML = zeilen + blaettern;
}

function logTurnPage(delta){
  logPage += delta;
  renderLog(gameState);
}

function addLogEntry(gameState, msg, result, isNewDay){
  gameState.log.unshift({ msg, result: result || null, isNewDay: !!isNewDay });
  logPage = 0;   // neue Meldungen sollen sofort sichtbar sein
  // Sonst waechst das Protokoll ueber viele Saisons unbegrenzt in den Spielstand.
  if(gameState.log.length > LOG_MAX_ENTRIES) gameState.log.length = LOG_MAX_ENTRIES;
  renderLog(gameState);
}

function buildSparklineSVG(values, color){
  if(!values || values.length < 2){
    return `<div style="font-size:11px; color:#a8b3c7; padding:8px 0; text-align:center;">Noch nicht genug Daten</div>`;
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = (max - min) || 1;
  const stepX = 100 / (values.length - 1);
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = 28 - ((v - min) / range) * 26;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return `<svg width="100%" height="30" viewBox="0 0 100 30" preserveAspectRatio="none">
    <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
  </svg>`;
}

function renderSparklines(gameState){
  const ratingEl = document.getElementById("ratingSparkline");
  const budgetEl = document.getElementById("budgetSparkline");
  if(ratingEl) ratingEl.innerHTML = buildSparklineSVG(gameState.ratingHistory, "#ffb703");
  if(budgetEl) budgetEl.innerHTML = buildSparklineSVG((gameState.budgetHistory || []).map(b => b / 1e6), "#2a9d8f");
}

function renderAll(gameState){
  renderTabBar();
  renderHeader(gameState);
  renderOpponentPreview(gameState);
  renderNextMatch(gameState);
  renderMiniTable(gameState);
  renderOverviewStats(gameState);
  renderOverviewCompetitions(gameState);
  renderBoardPanel(gameState);
  renderFacilities(gameState);
  renderYouthPanel(gameState);
  renderYouthSquad(gameState);
  renderOverviewLog(gameState);
  renderTable(gameState);
  renderShadowTable(gameState);
  renderSquad(gameState);
  renderContractPanel(gameState);
  renderLoanPanel(gameState);
  renderSquadStats(gameState);
  renderMarket(gameState);
  renderOfferPanel(gameState);
  renderPreseasonPanel(gameState);
  renderNewsPanel(gameState);
  renderSeasonStats(gameState);
  renderSquadAnalysis(gameState);
  renderNationBreakdown(gameState);
  renderSparklines(gameState);
  renderSeasonHistory(gameState);
  renderSeasonTrends(gameState);
  renderRecords(gameState);
  renderCupStatus(gameState);
  renderEuropeStatus(gameState);
  renderUefaRanking(gameState);
  renderHonours(gameState);
  renderFixtureList(gameState);
  renderAchievements(gameState);
  renderLog(gameState);
}

function renderSeasonSummary(gameState){
  const summary = gameState.lastSeasonSummary;
  const host = document.getElementById("seasonSummaryHost");
  if(!summary || !host) return;

  host.innerHTML = `
    <div class="card" id="seasonSummary" style="margin-top:20px; border-color:var(--gold-deep);">
      <p class="eyebrow">Saison abgeschlossen</p>
      <h2 style="margin:4px 0 12px;">${summary.season}/${summary.season + 1}</h2>
      <div class="statGrid" style="margin-bottom:14px;">
        <div class="stat"><div class="k">Endplatzierung</div><div class="v gold">${summary.finalPosition}</div><div class="sub">von ${summary.totalTeams}</div></div>
        <div class="stat"><div class="k">Saisonbonus</div><div class="v">${fmtMoney(summary.bonus)}</div></div>
      </div>
      ${renderAwards(gameState.lastAwards)}
      ${renderSuccessOffers(gameState)}
      <button onclick="startNextSeason()">${(gameState.successOffers || []).length ? "Bleiben und nächste Saison starten" : "Nächste Saison starten"}</button>
    </div>`;
}

function renderSuccessOffers(gameState){
  const angebote = gameState.successOffers || [];
  if(angebote.length === 0) return "";
  return `<p class="eyebrow">Anfragen anderer Vereine · Trainer-Ruf ${Math.round(getReputation(gameState))} (${getReputationLabel(getReputation(gameState))})</p>
    <div class="choiceGrid" style="margin-bottom:14px;">${angebote.map(o => `
      <button class="ghost choiceBtn" onclick="acceptJobOffer('${o.name.replace(/'/g, "\\'")}')">
        <span class="choiceTitle">${o.name} · ${getDivisionTag(o.division)}</span>
        <span class="choiceSub">Stärke ${Math.round(o.strength)} · Ziel: ${o.goal.label} · Budget ${fmtMoney(o.budget)}</span>
        <span class="choiceSub">Wechseln</span></button>`).join("")}</div>`;
}

function hideSeasonSummary(){
  const host = document.getElementById("seasonSummaryHost");
  if(host) host.innerHTML = "";
}


// ============================================
// Übersicht und Statistik
// ============================================

// Die zwei staerksten Attribute als kurze Marken — im Markt schneller lesbar
// als vier Zahlen.
function topAttributeTags(player){
  if(!player.attributes) return "";
  return [...ATTRIBUTES]
    .sort((a, b) => player.attributes[b] - player.attributes[a])
    .slice(0, 2)
    .map(a => `<span class="tagIcon" title="${ATTRIBUTE_LABELS[a]} ${Math.round(player.attributes[a])}">${ATTRIBUTE_ICONS[a]}${Math.round(player.attributes[a])}</span>`)
    .join(" ");
}

// ============================================
// Live-Simulation mit Spielbericht
// ============================================

// ---------- Fenster-Warteschlange ----------
// Pressekonferenz, Jugend-Aufnahme und Entlassung entstehen mitten in der
// Simulation, waehrend der Spielbericht noch laeuft. Ohne Warteschlange lagen
// sie uebereinander. Jetzt oeffnet sich das naechste Fenster erst, wenn kein
// anderes mehr offen ist.
const modalQueue = [];
let modalHold = 0;

function isAnyModalOpen(){
  return !!document.querySelector(".modalOverlay.show");
}

function queueModal(open){
  modalQueue.push(open);
  pumpModalQueue();
}

function pumpModalQueue(){
  if(modalHold > 0 || isAnyModalOpen()) return;
  const next = modalQueue.shift();
  if(next) next();
}

// Waehrend eines Simulationsschritts zurueckhalten, bis der Spielbericht steht.
function holdModals(){ modalHold++; }
function releaseModals(){
  modalHold = Math.max(0, modalHold - 1);
  pumpModalQueue();
}

// Sobald irgendein Fenster schliesst, ist das naechste dran. Der kurze Aufschub
// laesst Schliessen-Handler, die direkt ein Folgefenster oeffnen, zuerst laufen.
document.querySelectorAll(".modalOverlay").forEach(el => {
  new MutationObserver(() => {
    if(!el.classList.contains("show")) setTimeout(pumpModalQueue, 0);
  }).observe(el, { attributes: true, attributeFilter: ["class"] });
});

// Zahlformate fuer Texte: Dezimalkomma, Einzahl/Mehrzahl.
function fmtDecimal(x){ return String(Math.round(x * 10) / 10).replace(".", ","); }
function fmtTore(n){ return `${n} ${n === 1 ? "Tor" : "Tore"}`; }
