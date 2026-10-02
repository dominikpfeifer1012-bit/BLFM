// ============================================
// HALFTIME.JS - Live-Spiel mit Eingriff zur Halbzeit
// ============================================
// Im Live-Modus wird ein Ligaspiel jetzt in zwei Haelften gespielt. Zur
// Pause haelt der Ticker an, und der Trainer waehlt die Ausrichtung fuer
// die zweite Haelfte. Erst danach steht das Ergebnis fest und der Spieltag
// wird regulaer abgeschlossen — Tabelle, Torschuetzen, Karten und
// Verletzungen passen dadurch zum gezeigten Spiel.

let halftimeState = null;

function drawMinutesInRange(anzahl, von, bis, belegt){
  const ergebnis = [];
  for(let i = 0; i < anzahl; i++){
    let m = randInt(von, bis), guard = 0;
    while(belegt.has(m) && guard++ < 60) m = randInt(von, bis);
    belegt.add(m);
    ergebnis.push(m);
  }
  return ergebnis.sort((a, b) => a - b);
}

function findOwnFixtureToday(gameState){
  const day = gameState.matchday;
  return getRoundFixtures(gameState.fixtures, gameState.teams.length, day).find(f => !f.played &&
    (f.home === gameState.clubName || f.away === gameState.clubName)) || null;
}

// Ereignisse einer Haelfte: Tore mit Schuetzen plus Chancen und Paraden.
function buildHalfEvents(hs, ownIds, oppIds, von, bis){
  const belegt = new Set([45, 90]);
  const events = [];
  const name = (liste, id) => { const p = liste.find(x => x.id === id); return p ? p.name : null; };
  drawMinutesInRange(ownIds.length, von, bis, belegt).forEach((m, i) =>
    events.push({ minute: m, type: "goal", side: "own", scorer: name(hs.ownPlayers, ownIds[i]) }));
  drawMinutesInRange(oppIds.length, von, bis, belegt).forEach((m, i) =>
    events.push({ minute: m, type: "goal", side: "opp", scorer: name(hs.roster, oppIds[i]) }));
  const torwart = kader => { const tw = kader.find(p => p.pos === "TW"); return tw ? tw.name : null; };
  [["own", hs.xi, hs.roster], ["opp", hs.roster, hs.xi]].forEach(([seite, angreifer, verteidiger]) => {
    drawMinutesInRange(randInt(1, 2), von, Math.min(bis, von + 43), belegt).forEach(m => {
      const r = Math.random();
      const s = pickScorer(angreifer.filter(p => p.pos !== "TW"));
      events.push({ minute: m, type: r < 0.45 ? "chance" : r < 0.85 ? "save" : "post", side: seite,
        player: s ? s.name : null, keeper: torwart(verteidiger) });
    });
  });
  return events;
}

// Laufende Zwischenstaende eintragen.
function applyRunningScore(events, ownIsHome, startH, startA){
  let h = startH, a = startA;
  events.sort((x, y) => x.minute - y.minute || (x.order || 0) - (y.order || 0));
  events.forEach(e => {
    if(e.type === "goal"){ if((e.side === "own") === ownIsHome) h++; else a++; }
    e.homeScore = h; e.awayScore = a;
  });
  return { h, a };
}

function pickScorerIds(spieler, anzahl){
  const ids = [];
  for(let i = 0; i < anzahl; i++){ const p = pickScorer(spieler.filter(x => x.pos !== "TW")); ids.push(p ? p.id : null); }
  return ids;
}

// Startet die erste Haelfte. Gibt false zurueck, wenn heute kein eigenes
// Ligaspiel ansteht — dann laeuft der Spieltag wie gewohnt.
function startHalftimeMatch(){
  if(!isLiveEnabled()) return false;
  const f = findOwnFixtureToday(gameState);
  if(!f) return false;

  const ownIsHome = f.home === gameState.clubName;
  const gegner = ownIsHome ? f.away : f.home;
  const xi = getStartingXI(gameState.squad, gameState.matchday + 1);
  const roster = gameState.pool ? getClubRoster(gameState.pool, gegner) : [];
  const l = getMatchLambdas(gameState, f.home, f.away);
  const hg = poisson(l.home * HALFTIME_FIRST_SHARE), ag = poisson(l.away * HALFTIME_FIRST_SHARE);

  const hs = halftimeState = {
    home: f.home, away: f.away, ownIsHome, xi, roster, ownPlayers: gameState.squad,
    hg, ag, tacticBefore: gameState.tactic || DEFAULT_TACTIC,
    match: { clubName: gameState.clubName, home: f.home, away: f.away,
      label: `${getDivisionLabel(gameState.division)} · Spieltag ${gameState.matchday + 1}` }
  };
  hs.ownIds1 = pickScorerIds(xi, ownIsHome ? hg : ag);
  hs.oppIds1 = pickScorerIds(roster, ownIsHome ? ag : hg);
  const events = buildHalfEvents(hs, hs.ownIds1, hs.oppIds1, 1, 45);
  events.push({ minute: 45, type: "half", order: 1 });
  applyRunningScore(events, ownIsHome, 0, 0);

  openLiveShell(hs.match);
  playLiveSegment(hs.match, events, 0, 45, 0, 0, showHalftimeChoice);
  return true;
}

function openLiveShell(match){
  const overlay = document.getElementById("liveOverlay");
  stopLiveTimer();
  liveState.running = true;
  liveState.onDone = null;
  liveState.currentMatch = null;
  const ownIsHome = match.home === match.clubName;
  document.getElementById("liveCompetition").textContent = match.label;
  document.getElementById("liveHome").textContent = match.home;
  document.getElementById("liveAway").textContent = match.away;
  document.getElementById("liveHome").className = ownIsHome ? "liveTeam own" : "liveTeam";
  document.getElementById("liveAway").className = ownIsHome ? "liveTeam" : "liveTeam own";
  document.getElementById("liveScore").textContent = "0 : 0";
  document.getElementById("liveClock").textContent = "0'";
  document.getElementById("liveProgress").style.width = "0%";
  document.getElementById("liveFeed").innerHTML = "";
  overlay.classList.add("show");
}

// Spielt die Minuten von..bis ab. Ueberspringen zeigt den Rest sofort.
function playLiveSegment(match, events, von, bis, startH, startA, onEnd){
  const ownIsHome = match.home === match.clubName;
  let minute = von, index = 0, pause = 0, fertig = false;
  document.getElementById("liveScore").textContent = `${startH} : ${startA}`;
  const abschluss = () => {
    if(fertig) return;
    fertig = true;
    stopLiveTimer();
    while(index < events.length){ appendLiveEvent(events[index], match, ownIsHome); index++; }
    document.getElementById("liveClock").textContent = bis === MATCH_MINUTES ? "Ende" : "Halbzeit";
    document.getElementById("liveProgress").style.width = (bis / MATCH_MINUTES * 100) + "%";
    onEnd();
  };
  liveState.skipSegment = abschluss;
  document.getElementById("liveFooter").innerHTML =
    `<button class="ghost" onclick="liveState.skipSegment && liveState.skipSegment()">Überspringen</button>`;
  stopLiveTimer();
  liveState.timer = setInterval(() => {
    if(pause > 0){ pause -= LIVE_TICK_MS; return; }
    minute++;
    if(minute > bis){ abschluss(); return; }
    document.getElementById("liveClock").textContent = minute + "'";
    document.getElementById("liveProgress").style.width = (minute / MATCH_MINUTES * 100) + "%";
    while(index < events.length && events[index].minute === minute){
      appendLiveEvent(events[index], match, ownIsHome);
      index++;
      pause = LIVE_EVENT_PAUSE_MS;
    }
  }, LIVE_TICK_MS);
}

function showHalftimeChoice(){
  const hs = halftimeState;
  if(!hs) return;
  const eigene = hs.ownIsHome ? hs.hg : hs.ag, fremde = hs.ownIsHome ? hs.ag : hs.hg;
  const lage = eigene > fremde ? "Führung" : eigene < fremde ? "Rückstand" : "Unentschieden";
  document.getElementById("liveFooter").innerHTML = `
    <div class="halftimeBox">
      <p class="eyebrow" style="margin:0 0 6px;">Halbzeit · ${lage} · Ausrichtung für die 2. Hälfte</p>
      <div class="halftimeButtons">${Object.keys(TACTICS).map(k => `
        <button class="${k === hs.tacticBefore ? "" : "ghost"}" onclick="chooseSecondHalfTactic('${k}')">
          ${TACTICS[k].label}${k === hs.tacticBefore ? " (weiter so)" : ""}</button>`).join("")}</div>
    </div>`;
}

function chooseSecondHalfTactic(key){
  const hs = halftimeState;
  if(!hs || hs.decided) return;
  hs.decided = true;
  const vorher = gameState.tactic;
  gameState.tactic = TACTICS[key] ? key : vorher;
  const l = getMatchLambdas(gameState, hs.home, hs.away);
  gameState.tactic = vorher;
  const hg2 = poisson(l.home * (1 - HALFTIME_FIRST_SHARE)), ag2 = poisson(l.away * (1 - HALFTIME_FIRST_SHARE));
  hs.ownIds2 = pickScorerIds(hs.xi, hs.ownIsHome ? hg2 : ag2);
  hs.oppIds2 = pickScorerIds(hs.roster, hs.ownIsHome ? ag2 : hg2);
  hs.hg2 = hg2; hs.ag2 = ag2;
  if(key !== hs.tacticBefore) addLogEntry(gameState, `🔁 Halbzeit: Umstellung auf ${TACTICS[key].label}.`);

  const override = {
    home: hs.home, away: hs.away, homeGoals: hs.hg + hg2, awayGoals: hs.ag + ag2,
    ownScorerIds: [...hs.ownIds1, ...hs.ownIds2].filter(Boolean),
    oppScorerIds: [...hs.oppIds1, ...hs.oppIds2].filter(Boolean)
  };
  let fehler = null;
  try {
    runMatchdaySimulation(override);
  } catch(e){
    fehler = e;
    console.error("Simulation fehlgeschlagen:", e);
    showToast("Die Simulation ist fehlgeschlagen. Details stehen in der Browser-Konsole.", "error");
  }
  completeDeferredMatchday();
  if(fehler){ halftimeState = null; closeLiveMatch(); }
}

// Wird von runMatchdaySimulation statt presentMatch aufgerufen.
function continueSecondHalf(ownEvt, result, summaryLine){
  const hs = halftimeState;
  halftimeState = null;
  if(!hs) return;
  const events = buildHalfEvents(hs, hs.ownIds2, hs.oppIds2, 46, 90);
  (result.cards || []).forEach(c => events.push({ minute: randInt(46, 89),
    type: c.type === "red" ? "red" : c.type === "banAccumulated" ? "yellowRed" : "yellow",
    player: c.player.name, count: c.player.yellowCards }));
  (result.injuries || []).forEach(inj => events.push({ minute: randInt(46, 89), type: "injury",
    player: inj.player.name, duration: inj.duration }));
  events.push({ minute: 90, type: "end", order: 1 });
  applyRunningScore(events, hs.ownIsHome, hs.hg, hs.ag);

  const match = Object.assign({}, hs.match, {
    homeGoals: ownEvt.homeGoals, awayGoals: ownEvt.awayGoals, summaryLine, timeline: events
  });
  playLiveSegment(match, events, 45, 90, hs.hg, hs.ag, () => {
    liveState.currentMatch = match;
    finishLiveMatch(match, true);
  });
}
