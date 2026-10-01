// ============================================
// UI-MATCH.JS - Spielbericht: Live-Ansicht und Ergebnisdarstellung
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

let liveState = { timer: null, onDone: null, running: false };

const LIVE_EVENT_ICONS = {
  goal: "⚽", yellow: "🟨", yellowRed: "🟨🟥", red: "🟥", injury: "🩹",
  chance: "💨", save: "🧤", post: "🥅", half: "⏸", end: "🏁"
};

function isLiveEnabled(){
  return gameState && gameState.liveMatches !== false;
}

function toggleLiveMatches(){
  gameState.liveMatches = !isLiveEnabled();
  showToast(isLiveEnabled()
    ? "Live-Simulation eingeschaltet."
    : "Live-Simulation aus — Ergebnisse erscheinen sofort.", "info");
  renderHeader(gameState);
}

// match: { competition, label, home, away, homeGoals, awayGoals, timeline,
//          clubName, revenueLine, extraLines }

// match: { competition, label, home, away, homeGoals, awayGoals, timeline,
//          clubName, revenueLine, extraLines }
function showLiveMatch(match, onDone){
  const overlay = document.getElementById("liveOverlay");
  if(!overlay){ if(onDone) onDone(); return; }

  stopLiveTimer();
  liveState.onDone = onDone || null;
  liveState.running = true;

  const ownIsHome = match.home === match.clubName;
  document.getElementById("liveCompetition").textContent = match.label || "Ligaspiel";
  document.getElementById("liveHome").textContent = match.home;
  document.getElementById("liveAway").textContent = match.away;
  document.getElementById("liveHome").className = ownIsHome ? "liveTeam own" : "liveTeam";
  document.getElementById("liveAway").className = ownIsHome ? "liveTeam" : "liveTeam own";
  document.getElementById("liveScore").textContent = "0 : 0";
  document.getElementById("liveClock").textContent = "0'";
  document.getElementById("liveProgress").style.width = "0%";
  document.getElementById("liveFeed").innerHTML = "";
  document.getElementById("liveFooter").innerHTML =
    `<button class="ghost" onclick="skipLiveMatch()">Überspringen</button>`;

  overlay.classList.add("show");

  const events = match.timeline || [];
  let minute = 0, index = 0, pause = 0;

  liveState.timer = setInterval(() => {
    if(pause > 0){ pause -= LIVE_TICK_MS; return; }

    minute++;
    if(minute > MATCH_MINUTES){ finishLiveMatch(match); return; }

    document.getElementById("liveClock").textContent = minute + "'";
    document.getElementById("liveProgress").style.width = (minute / MATCH_MINUTES * 100) + "%";

    while(index < events.length && events[index].minute === minute){
      appendLiveEvent(events[index], match, ownIsHome);
      index++;
      pause = LIVE_EVENT_PAUSE_MS;
    }
  }, LIVE_TICK_MS);
}

function appendLiveEvent(evt, match, ownIsHome){
  const feed = document.getElementById("liveFeed");
  const scoreEl = document.getElementById("liveScore");

  if(evt.type === "goal"){
    scoreEl.textContent = `${evt.homeScore} : ${evt.awayScore}`;
    scoreEl.style.transform = "scale(1.14)";
    setTimeout(() => { scoreEl.style.transform = "scale(1)"; }, 220);
  }

  const own = evt.side === "own" || evt.type !== "goal";
  const teamOf = seite => (seite === "own") === ownIsHome ? match.home : match.away;
  const wer = evt.player ? `<b>${evt.player}</b>` : teamOf(evt.side);
  let text;
  if(evt.type === "half"){
    text = `<b>Halbzeit</b> · ${evt.homeScore}:${evt.awayScore}`;
  } else if(evt.type === "end"){
    text = `<b>Abpfiff</b> · ${evt.homeScore}:${evt.awayScore}`;
  } else if(evt.type === "chance"){
    text = `${wer} (${teamOf(evt.side)}) verzieht knapp`;
  } else if(evt.type === "save"){
    text = `${wer} zieht ab — ${evt.keeper ? `<b>${evt.keeper}</b> pariert` : "der Torwart pariert"}`;
  } else if(evt.type === "post"){
    text = `${wer} (${teamOf(evt.side)}) trifft nur den Pfosten!`;
  } else if(evt.type === "goal"){
    const team = (evt.side === "own") === ownIsHome ? match.home : match.away;
    text = evt.scorer ? `<b>${evt.scorer}</b> trifft für ${team}` : `Tor für ${team}`;
  } else if(evt.type === "yellow"){
    text = `<b>${evt.player}</b> sieht Gelb${evt.count ? ` (${evt.count}. der Saison)` : ""}`;
  } else if(evt.type === "yellowRed"){
    text = `<b>${evt.player}</b> sieht Gelb-Rot — gesperrt für das nächste Spiel`;
  } else if(evt.type === "red"){
    text = `<b>${evt.player}</b> sieht Rot — ${RED_CARD_BAN_MATCHES} Spiele gesperrt`;
  } else {
    text = `<b>${evt.player}</b> verletzt sich — ${evt.duration} Spieltage Pause`;
  }

  const row = document.createElement("div");
  row.className = "liveEvent" + (evt.type === "goal" && evt.side === "own" ? " own" : "");
  row.innerHTML = `<span class="liveMinute num">${evt.minute}'</span>
    <span class="liveIcon">${LIVE_EVENT_ICONS[evt.type] || "•"}</span>
    <span>${text}</span>`;
  feed.appendChild(row);
  feed.scrollTop = feed.scrollHeight;
}

function skipLiveMatch(){
  const overlay = document.getElementById("liveOverlay");
  if(!overlay || !liveState.running) return;
  stopLiveTimer();
  const match = liveState.currentMatch;
  if(match) renderFullTimeline(match);
  finishLiveMatch(match, true);
}

// Beim Überspringen wird die komplette Zeitachse auf einmal gezeigt.

// Beim Überspringen wird die komplette Zeitachse auf einmal gezeigt.
function renderFullTimeline(match){
  const ownIsHome = match.home === match.clubName;
  const feed = document.getElementById("liveFeed");
  feed.innerHTML = "";
  (match.timeline || []).forEach(evt => appendLiveEvent(evt, match, ownIsHome));
}

function finishLiveMatch(match, skipped){
  stopLiveTimer();
  const m = match || liveState.currentMatch;
  if(!m) return;

  document.getElementById("liveClock").textContent = "Ende";
  document.getElementById("liveProgress").style.width = "100%";
  document.getElementById("liveScore").textContent = `${m.homeGoals} : ${m.awayGoals}`;

  if(!skipped && (m.timeline || []).length === 0){
    document.getElementById("liveFeed").innerHTML =
      `<p class="muted" style="text-align:center; margin:12px 0;">Ein ereignisarmes Spiel ohne Tore.</p>`;
  }

  const result = getResultForClub(m.clubName, m.home, m.away, m.homeGoals, m.awayGoals);
  const titel = { win: "Sieg", draw: "Remis", loss: "Niederlage" }[result];

  document.getElementById("liveFooter").innerHTML = `
    <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; justify-content:space-between;">
      <span class="badge ${result}">${titel}</span>
      <span class="muted">${m.summaryLine || ""}</span>
      <button onclick="closeLiveMatch()">Weiter</button>
    </div>`;
}

function stopLiveTimer(){
  if(liveState.timer){ clearInterval(liveState.timer); liveState.timer = null; }
}

function closeLiveMatch(){
  stopLiveTimer();
  liveState.running = false;
  const overlay = document.getElementById("liveOverlay");
  if(overlay) overlay.classList.remove("show");
  const done = liveState.onDone;
  liveState.onDone = null;
  if(done) done();
}

// Einstiegspunkt: entscheidet zwischen Live-Ansicht und Sofortergebnis.

// Einstiegspunkt: entscheidet zwischen Live-Ansicht und Sofortergebnis.
function presentMatch(match, onDone){
  liveState.currentMatch = match;
  if(!isLiveEnabled()){
    showStaticReport(match);
    if(onDone) onDone();
    return;
  }
  showLiveMatch(match, onDone);
}

// Ohne Live-Modus: Endstand samt vollständigem Bericht sofort.

// Ohne Live-Modus: Endstand samt vollständigem Bericht sofort.
function showStaticReport(match){
  const overlay = document.getElementById("liveOverlay");
  if(!overlay) return;
  liveState.currentMatch = match;
  liveState.onDone = null;
  liveState.running = true;

  const ownIsHome = match.home === match.clubName;
  document.getElementById("liveCompetition").textContent = match.label || "Ligaspiel";
  document.getElementById("liveHome").textContent = match.home;
  document.getElementById("liveAway").textContent = match.away;
  document.getElementById("liveHome").className = ownIsHome ? "liveTeam own" : "liveTeam";
  document.getElementById("liveAway").className = ownIsHome ? "liveTeam" : "liveTeam own";
  overlay.classList.add("show");
  renderFullTimeline(match);
  finishLiveMatch(match, true);
}

// ============================================
// Jugendmannschaft
// ============================================

function showMatchResultPopup(evt, bonus, injuries, cards, salaryCost){
  const titleMap = { win: "SIEG 🎉", loss: "NIEDERLAGE", draw: "REMIS" };
  const net = (bonus || 0) - (salaryCost || 0);
  const bonusLine = `<p>Einnahmen: <b>${fmtMoney(bonus || 0)}</b> · Gehälter: <b style="color:#e63946;">-${fmtMoney(salaryCost || 0)}</b><br>
    Bilanz des Spieltags: <b style="color:${net >= 0 ? "#2a9d8f" : "#e63946"};">${net >= 0 ? "+" : "-"}${fmtMoney(Math.abs(net))}</b></p>`;

  const scorerLine = (evt.scorers && evt.scorers.length > 0)
    ? `<p>⚽ Tore: ${evt.scorers.join(", ")}</p>`
    : "";

  const injuryLine = (injuries && injuries.length > 0)
    ? `<p style="color:#e63946;">🩹 ${injuries.map(i => i.player.name).join(", ")} verletzt.</p>`
    : "";

  const cardLines = (cards && cards.length > 0)
    ? cards.map(c => {
        if(c.type === "red") return `<p style="color:#e63946;">🟥 ${c.player.name} sieht Rot – gesperrt für ${RED_CARD_BAN_MATCHES} Spiele.</p>`;
        if(c.type === "banAccumulated") return `<p style="color:#fca311;">🟨🟥 ${c.player.name} sieht die ${YELLOW_CARDS_FOR_BAN}. Gelbe – gesperrt für das nächste Spiel.</p>`;
        return `<p>🟨 ${c.player.name} sieht Gelb (${c.player.yellowCards}.).</p>`;
      }).join("")
    : "";

  document.getElementById("matchResultContent").innerHTML = `
    <span class="matchResultTitle ${evt.result}">${titleMap[evt.result]}</span>
    <div class="matchResultScore">${evt.home} ${evt.homeGoals} : ${evt.awayGoals} ${evt.away}</div>
    <p>Spieltag ${evt.matchday}</p>
    ${scorerLine}
    ${bonusLine}
    ${injuryLine}
    ${cardLines}
  `;
  document.getElementById("matchResultOverlay").classList.add("show");
}

function closeMatchResultModal(){
  document.getElementById("matchResultOverlay").classList.remove("show");
}
