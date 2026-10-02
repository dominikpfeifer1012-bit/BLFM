// ============================================
// UI-COMPETITIONS.JS - Wettbewerbe: Tabellen, Pokal, Europapokal, Spielplan
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function renderTable(gameState){
  const labelEl = document.getElementById("tableDivisionLabel");
  if(labelEl){
    labelEl.textContent = gameState.division === 2 ? "(2. Bundesliga)" : "(1. Bundesliga)";
  }

  const sorted = getSortedStandings(gameState.teams);
  let html = `<tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">S</th><th class="n">U</th><th class="n">N</th><th class="n">Tore</th><th class="n">Pkt</th></tr>`;
  sorted.forEach((t, i) => {
    const cls = t.name === gameState.clubName ? "highlight" : "";
    html += `<tr class="${cls}"><td class="n">${i+1}</td><td>${t.name}</td><td class="n">${t.played}</td><td class="n">${t.won}</td><td class="n">${t.drawn}</td><td class="n">${t.lost}</td><td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>`;
  });
  document.getElementById("tableStandings").innerHTML = html;
}

// Tabellen aller Ligen ausser der eigenen, untereinander.
function renderShadowTable(gameState){
  const el = document.getElementById("shadowTable");
  const lbl = document.getElementById("shadowTableLabel");
  if(!el) return;

  const nummern = typeof getShadowDivisionNumbers === "function"
    ? getShadowDivisionNumbers(gameState) : [];
  if(lbl) lbl.textContent = nummern.map(nr => getDivisionConfig(nr).short).join(" · ");

  if(nummern.length === 0){
    el.innerHTML = `<p class="muted">Keine weiteren Ligen.</p>`;
    return;
  }

  el.innerHTML = nummern.map(nr => buildDivisionTable(gameState, nr)).join("");
}

function buildDivisionTable(gameState, nr){
  const shadow = gameState.shadowLeagues[nr];
  const konfig = getDivisionConfig(nr);
  if(!shadow || !shadow.teams || shadow.teams.length === 0){
    return `<p class="muted">${konfig.label}: noch keine Daten.</p>`;
  }

  const sorted = getSortedStandings(shadow.teams);
  const letzte = getDivisionCount();

  let html = `<p class="eyebrow" style="margin:14px 0 6px;">${konfig.label}</p>
    <div class="tableWrap"><table>
    <tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>`;

  sorted.forEach((t, i) => {
    // Oben Aufstieg (ausser in Liga 1), unten Abstieg (ausser in der letzten).
    let markierung = "";
    if(nr > 1){
      if(i < 2) markierung = "var(--win)";
      else if(i === 2) markierung = "var(--draw)";
    }
    if(nr < letzte && !markierung){
      if(i >= sorted.length - 2) markierung = "var(--loss)";
      else if(i === sorted.length - 3) markierung = "var(--draw)";
    }
    const stil = markierung ? ` style="box-shadow:inset 3px 0 0 ${markierung};"` : "";
    html += `<tr${stil}><td class="n">${i + 1}</td><td>${t.name}</td>
      <td class="n">${t.played}</td><td class="n">${t.gf}:${t.ga}</td>
      <td class="n"><b>${t.points}</b></td></tr>`;
  });
  return html + `</table></div>`;
}

// ============================================
// Spielstaende
// ============================================

function renderCupStatus(gameState){
  const container = document.getElementById("cupStatus");
  if(!container) return;

  const cup = gameState.cup;
  if(!cup){ container.innerHTML = ""; return; }

  let statusLine;
  if(cup.champion === gameState.clubName){
    statusLine = `<span class="badge win">🏆 Pokalsieger!</span>`;
  } else if(cup.champion){
    statusLine = `Sieger: <b>${cup.champion}</b>`;
  } else if(cup.eliminated){
    statusLine = `<span class="badge loss">Ausgeschieden</span>`;
  } else if(cup.active){
    const nextTrigger = CUP_ROUND_TRIGGER_MATCHDAYS[cup.round];
    const roundLabel = CUP_ROUND_LABELS[cup.round] || `Runde ${cup.round + 1}`;
    statusLine = `<span class="badge win">Noch dabei</span> · Nächste Runde: ${roundLabel}${nextTrigger ? ` (Spieltag ${nextTrigger})` : ""} · ${cup.teamsRemaining.length} Teams verbleiben`;
  } else {
    statusLine = "—";
  }

  let historyHtml = "";
  if(cup.history.length > 0){
    const lastRound = cup.history[cup.history.length - 1];
    const ownMatch = lastRound.matches.find(m => m.home === gameState.clubName || m.away === gameState.clubName);
    if(ownMatch){
      historyHtml = `<p class="breakdownLine">Letztes Spiel: ${ownMatch.home} ${ownMatch.homeGoals}:${ownMatch.awayGoals} ${ownMatch.away}${ownMatch.wasDraw ? " (n.V./Elfm.)" : ""}</p>`;
    }
  }

  container.innerHTML = `<p>${statusLine}</p>${historyHtml}`;
}

function renderEuropeStatus(gameState){
  const container = document.getElementById("europeStatus");
  if(!container) return;
  const eu = gameState.europe;
  if(!eu){ container.innerHTML = ""; return; }

  if(!eu.qualified){
    container.innerHTML = `<p class="muted">Nicht qualifiziert — dafür ist Platz 1 bis 4 der 1. Bundesliga nötig.</p>`;
    return;
  }

  let head;
  if(eu.champion) head = `<span class="badge win">Europapokalsieger</span>`;
  else if(eu.eliminated) head = `<span class="badge loss">Ausgeschieden</span>${eu.winnerName ? ` · Sieger: <b>${eu.winnerName}</b>` : ""}`;
  else if(eu.phase === "group") head = `<span class="badge win">Gruppenphase</span> · Gruppe ${eu.ownGroup} · Spieltag ${eu.groupMatchday}/${EUROPE_GROUP_MATCHDAYS.length}`;
  else head = `<span class="badge win">${EUROPE_KO_LABELS[eu.knockoutRound] || "K.o.-Runde"}</span> · ${eu.knockoutTeams.length} Teams übrig`;

  let body = "";
  const standing = eu.groups && eu.groups.length ? getOwnGroupStanding(gameState) : null;
  if(standing){
    body += `<p class="eyebrow" style="margin-top:12px;">Gruppe ${standing.groupName}</p>
      <div class="tableWrap"><table><tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>` +
      standing.table.map((t, i) => {
        const cls = t.name === gameState.clubName ? ' class="highlight"' : "";
        const qual = i < EUROPE_QUALIFY_PER_GROUP ? "" : ' style="opacity:.6;"';
        return `<tr${cls}${qual}><td class="n">${i + 1}</td><td>${t.name}</td><td class="n">${t.played}</td><td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>`;
      }).join("") + `</table></div>`;
  }

  if(eu.history && eu.history.length > 0){
    const last = eu.history[eu.history.length - 1];
    body += `<p class="muted" style="margin-top:10px;">${last.round}: ${last.ownGoals}:${last.oppGoals} gegen ${last.opponent}${last.wasDraw ? " (n.V./Elfm.)" : ""}</p>`;
  }

  container.innerHTML = `<p style="margin:0;">${head}</p>${body}`;
}

// Spielplan mit allen Terminen der Saison, Pokaltermine eingeordnet.
function renderFixtureList(gameState){
  const el = document.getElementById("fixtureList");
  if(!el) return;

  const cupOn = {}, euroOn = {};
  CUP_ROUND_TRIGGER_MATCHDAYS.forEach((md, i) => { cupOn[md] = CUP_ROUND_LABELS[i] || `Runde ${i + 1}`; });
  EUROPE_GROUP_MATCHDAYS.forEach((md, i) => { euroOn[md] = `Gruppenphase ${i + 1}`; });
  EUROPE_KO_MATCHDAYS.forEach((md, i) => { euroOn[md] = EUROPE_KO_LABELS[i] || `K.o. ${i + 1}`; });

  const byDay = {};
  gameState.fixtures.forEach((f, idx) => {
    if(f.home !== gameState.clubName && f.away !== gameState.clubName) return;
    byDay[Math.floor(idx / MATCHES_PER_MATCHDAY) + 1] = f;
  });

  const qualified = gameState.europe && gameState.europe.qualified;
  let html = `<tr><th class="n">ST</th><th>Wettbewerb</th><th>Gegner</th><th class="n">Ergebnis</th><th></th></tr>`;

  for(let d = 1; d <= TOTAL_MATCHDAYS; d++){
    if(cupOn[d]) html += `<tr class="dim"><td class="n">${d}</td><td>🏆 DFB-Pokal</td><td colspan="3">${cupOn[d]}</td></tr>`;
    if(qualified && euroOn[d]) html += `<tr class="dim"><td class="n">${d}</td><td>🌍 Europapokal</td><td colspan="3">${euroOn[d]}</td></tr>`;

    const f = byDay[d];
    if(!f) continue;
    const isHome = f.home === gameState.clubName;
    const opponent = isHome ? f.away : f.home;
    const isNow = !gameState.seasonEnded && d === gameState.matchday + 1;

    let score = "—", badge = "";
    if(f.played && f.homeGoals != null){
      const r = getResultForClub(gameState.clubName, f.home, f.away, f.homeGoals, f.awayGoals);
      score = isHome ? `${f.homeGoals}:${f.awayGoals}` : `${f.awayGoals}:${f.homeGoals}`;
      badge = `<span class="badge ${r}">${LOG_BADGE_LABELS[r]}</span>`;
    }

    html += `<tr${isNow ? ' class="highlight"' : ""}>
      <td class="n">${d}</td>
      <td>${isHome ? "🏠 Heim" : "✈️ Auswärts"}</td>
      <td>${opponent}</td>
      <td class="n">${score}</td>
      <td>${badge}</td></tr>`;
  }
  el.innerHTML = html;
}

// ============================================
// Vorstand
// ============================================

function renderBoardPanel(gameState){
  const el = document.getElementById("boardPanel");
  if(!el) return;
  const board = gameState.board;
  if(!board){ el.innerHTML = ""; return; }

  const mood = getBoardMood(board);
  const next = getNextBoardCheckpoint(gameState.matchday);
  const pct = Math.max(0, Math.min(100, board.patience));
  const farbe = board.patience >= 50 ? "var(--win)"
              : board.patience >= BOARD_WARN_THRESHOLD ? "var(--draw)" : "var(--loss)";

  const { position } = getOwnTeamRow(gameState);
  const aufKurs = position <= board.targetPosition;

  let verlauf = "";
  if(board.history.length > 0){
    verlauf = '<p class="muted" style="margin:10px 0 0;">' + board.history.map(h =>
      `ST ${h.matchday}: Platz ${h.position} <span style="color:${h.swing >= 0 ? "var(--win)" : "var(--loss)"};">${h.swing >= 0 ? "+" : ""}${h.swing}</span>`
      + (h.reward > 0 ? ` <span style="color:var(--gold);">+${fmtMoney(h.reward)}</span>` : "")
    ).join(" · ") + "</p>";
  }

  el.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:10px;">
      <span class="badge ${mood.tone}">${mood.label}</span>
      <span class="num" style="font-size:19px; color:${farbe};">${board.patience}</span>
    </div>
    <div class="bar" style="margin:8px 0 12px;"><i style="width:${pct}%; background:${farbe};"></i></div>
    <p class="eyebrow">Saisonziel</p>
    <p style="margin:2px 0 8px;"><b>${board.goalLabel}</b> — mindestens Platz ${board.targetPosition}</p>
    <p class="muted" style="margin:0;">
      Aktuell Platz ${position} · <span style="color:${aufKurs ? "var(--win)" : "var(--loss)"};">${aufKurs ? "auf Kurs" : "hinter der Erwartung"}</span>
      ${next ? ` · nächste Bewertung an Spieltag ${next}` : " · letzte Bewertung erfolgt"}
    </p>
    <p class="muted" style="margin:6px 0 0;">🎓 Trainer-Ruf: <b>${Math.round(getReputation(gameState))}</b> (${getReputationLabel(getReputation(gameState))})</p>
    ${verlauf}`;
}

function showDismissalModal(result){
  const board = gameState.board;
  const el = document.getElementById("dismissalContent");
  if(!el) return;

  const saisons = (gameState.seasonHistory || []).length;
  const titel = (gameState.achievements || []).length;
  const angebote = generateJobOffers(gameState);

  const angebotsHtml = angebote.length > 0 ? `
    <p class="eyebrow" style="margin-top:18px;">Angebote anderer Vereine</p>
    <p class="muted" style="margin:2px 0 10px;">Deine Erfolge und die Vereinsgeschichte nimmst du mit.</p>
    ${angebote.map(a => `
      <div class="lineupOption" onclick="acceptJobOffer('${a.name.replace(/'/g, "\\'")}')">
        <span>
          <b>${a.name}</b>
          <span class="divisionBadge ${a.division === 1 ? "div1" : "div2"}">${getDivisionConfig(a.division).short}</span>
          <br><span class="breakdownLine muted">Ziel: ${a.goal.label} · Budget ${fmtMoney(a.budget)}</span>
        </span>
        <span class="lineupValue">${Math.round(a.strength)}</span>
      </div>`).join("")}` : "";

  el.innerHTML = `
    <p class="eyebrow">Der Vorstand hat entschieden</p>
    <h2 style="margin:4px 0 14px;">Du wurdest entlassen</h2>
    <p class="muted" style="margin:0 0 16px;">
      Nach Spieltag ${result.matchday} steht ${gameState.clubName} auf Platz ${result.position}.
      Erwartet wurde: <b>${board.goalLabel}</b> (mindestens Platz ${board.targetPosition}).
    </p>
    <div class="statGrid" style="margin-bottom:4px;">
      <div class="stat"><div class="k">Saisons im Amt</div><div class="v gold">${saisons + 1}</div></div>
      <div class="stat"><div class="k">Letzter Platz</div><div class="v">${result.position}</div></div>
      <div class="stat"><div class="k">Erfolge</div><div class="v">${titel}</div></div>
    </div>
    ${angebotsHtml}
    <div style="margin-top:18px;">
      <button class="ghost" onclick="restartAfterDismissal()">Stattdessen ganz neu anfangen</button>
    </div>`;

  document.getElementById("dismissalOverlay").classList.add("show");
}

function closeDismissalModal(){
  const el = document.getElementById("dismissalOverlay");
  if(el) el.classList.remove("show");
}

function restartAfterDismissal(){
  document.getElementById("dismissalOverlay").classList.remove("show");
  clearSavedGame();
  location.reload();
}

// Verkauf aus dem Spielerprofil: erst bestaetigen, dann ausfuehren.

// ============================================
// Pressekonferenz
// ============================================

function showPressConference(situation){
  const el = document.getElementById("pressContent");
  if(!el) return;

  const frage = typeof situation.frage === "function"
    ? situation.frage(gameState) : situation.frage;

  const wirkung = a => {
    const teile = [];
    if(a.morale) teile.push(`<span style="color:${a.morale > 0 ? "var(--win)" : "var(--loss)"};">Kabine ${a.morale > 0 ? "+" : ""}${a.morale}</span>`);
    if(a.patience) teile.push(`<span style="color:${a.patience > 0 ? "var(--win)" : "var(--loss)"};">Vorstand ${a.patience > 0 ? "+" : ""}${a.patience}</span>`);
    if(a.target) teile.push(`<span style="color:var(--draw);">Saisonziel ${a.target < 0 ? "härter" : "leichter"}</span>`);
    return teile.join(" · ") || '<span class="muted">ohne Wirkung</span>';
  };

  el.innerHTML = `
    <p class="eyebrow">Pressekonferenz · Spieltag ${gameState.matchday}</p>
    <h3 style="margin:6px 0 16px;">${frage}</h3>
    ${situation.antworten.map((a, i) => `
      <div class="lineupOption" onclick="answerPressConference('${situation.key}', ${i})">
        <span style="flex:1;">
          „${a.text}"<br>
          <span style="font-size:11px;">${wirkung(a)}</span>
        </span>
      </div>`).join("")}
    <div style="margin-top:14px; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
      <button class="ghost" onclick="answerPressConference('${situation.key}', null)">Keine Stellungnahme</button>
      <span class="muted" style="font-size:12px;">kostet etwas Stimmung und Geduld</span>
    </div>`;

  document.getElementById("pressOverlay").classList.add("show");
}

function closePressModal(){
  const el = document.getElementById("pressOverlay");
  if(el) el.classList.remove("show");
}

// ============================================
// Investitionen
// ============================================

function renderFacilities(gameState){
  const el = document.getElementById("facilitiesPanel");
  if(!el) return;
  ensureFacilities(gameState);

  const investiert = getTotalInvested(gameState);
  let html = `<p class="muted" style="margin:0 0 12px;">
    Bisher investiert: <b>${fmtMoney(investiert)}</b> · verfügbar: <b>${fmtMoney(gameState.budget)}</b></p>`;

  Object.entries(FACILITIES).forEach(([key, f]) => {
    const stufe = getFacilityLevel(gameState, key);
    const kosten = getFacilityCost(gameState, key);
    const voll = kosten === null;
    const bezahlbar = !voll && kosten <= gameState.budget;

    const balken = Array.from({ length: FACILITY_LEVELS }, (_, i) =>
      `<span style="flex:1; height:6px; border-radius:2px; background:${
        i < stufe ? "var(--gold)" : "var(--bg-deep)"};"></span>`).join("");

    html += `<div style="padding:11px 0; border-bottom:1px solid var(--line);">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;">
        <span><b>${f.icon} ${f.label}</b>
          <span class="muted" style="font-size:12px;">Stufe ${stufe}/${FACILITY_LEVELS}</span></span>
        <button class="ghost" onclick="handleUpgradeFacility('${key}')"${voll || !bezahlbar ? " disabled" : ""}>
          ${voll ? "Ausgebaut" : "Ausbauen · " + fmtMoney(kosten)}
        </button>
      </div>
      <div style="display:flex; gap:3px; margin:7px 0 5px;">${balken}</div>
      <p class="muted" style="margin:0; font-size:12px;">
        ${f.desc}${stufe > 0 ? ` <span style="color:var(--win);">Aktuell: ${f.wirkung(stufe)}</span>` : ""}
      </p>
    </div>`;
  });

  el.innerHTML = html;
}
