// ============================================
// UI-COMPETITIONS.JS - Wettbewerbe: Tabellen, Pokal, Europapokal, Spielplan
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function renderTable(gameState){
  const labelEl = document.getElementById("tableDivisionLabel");
  if(labelEl){
    const d = getDivisionConfig(gameState.division);
    labelEl.textContent = (d.country && d.country !== "de" ? getCountryBadge(d.country) + " " : "") + d.label;
  }

  const sorted = getSortedStandings(gameState.teams);
  const zonen = getDivisionZones(gameState.division, sorted.length);
  let html = `<tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">S</th><th class="n">U</th><th class="n">N</th><th class="n">Tore</th><th class="n">Pkt</th></tr>`;
  sorted.forEach((t, i) => {
    const cls = t.name === gameState.clubName ? "highlight" : "";
    const z = zonen[i] ? ` style="box-shadow:inset 3px 0 0 ${zonen[i]};"` : "";
    html += `<tr class="${cls}"${z}><td class="n">${i+1}</td><td><span class="clubLink" onclick="showClubDetail(this.dataset.club)" data-club="${t.name}">${t.name}</span></td><td class="n">${t.played}</td><td class="n">${t.won}</td><td class="n">${t.drawn}</td><td class="n">${t.lost}</td><td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>`;
  });
  document.getElementById("tableStandings").innerHTML = html;
  const cupTitle = document.getElementById("cupTitle");
  if(cupTitle) cupTitle.textContent = getCupName(gameState);
}

// Farbmarken je Tabellenplatz: Europapokal, Aufstieg, Play-off, Abstieg.
function getDivisionZones(nr, groesse){
  const d = getDivisionConfig(nr);
  const zonen = new Array(groesse).fill(null);
  const ligen = getCountryDivisions(d.country || "de");
  const idx = ligen.findIndex(x => x.nr === nr);
  const darueber = idx > 0 ? ligen[idx - 1] : null;
  const tiefer = idx < ligen.length - 1;
  if(d.europe && typeof getUefaSlotsForCountry === "function"){
    // CL blau, EL orange, Conference League gruen-grau.
    const s = getUefaSlotsForCountry(gameState, d.country || "de");
    for(let i = 0; i < s.cl + s.el + s.ecl && i < groesse; i++)
      zonen[i] = i < s.cl ? "var(--info)" : i < s.cl + s.el ? "#F08A24" : "#7FB77E";
  }
  if(darueber && darueber.seam){
    const s = darueber.seam;
    for(let i = 0; i < s.directUp; i++) zonen[i] = "var(--win)";
    if(s.playoff && s.playoff.type === "relegation") zonen[s.directUp] = "var(--draw)";
    if(s.playoff && s.playoff.positions) s.playoff.positions.forEach(p => { if(p - 1 < groesse) zonen[p - 1] = "var(--draw)"; });
  }
  if(tiefer && d.seam){
    for(let i = 0; i < d.seam.directDown; i++) zonen[groesse - 1 - i] = "var(--loss)";
    if(d.seam.playoff && d.seam.playoff.type !== "playoff") zonen[groesse - 1 - d.seam.directDown] = "var(--draw)";
  } else if(!tiefer){
    const land = getCountryConfig(d.country || "de");
    const n = land.reserve ? land.reserve.swaps : 0;
    for(let i = 0; i < n; i++) zonen[groesse - 1 - i] = "var(--loss)";
  }
  return zonen;
}

// ============================================
// Ligen-Ansicht: alle Laender und Ligen
// ============================================

let leagueBrowser = { country: null, nr: null };

function getLeagueBrowserSelection(gameState){
  const eigenesLand = getOwnCountry(gameState);
  let land = leagueBrowser.country || eigenesLand;
  let nr = leagueBrowser.nr;
  const ligen = getCountryDivisions(land);
  if(!nr || !ligen.some(d => d.nr === nr)){
    // Standard: im eigenen Land die erste fremde Liga, sonst die oberste.
    const fremd = ligen.find(d => d.nr !== gameState.division);
    nr = (land === eigenesLand && fremd ? fremd : ligen[0]).nr;
  }
  return { country: land, nr };
}

function selectLeagueBrowser(country, nr){
  leagueBrowser = { country, nr: nr || null };
  renderShadowTable(gameState);
}

// Tabelle, Daten fuer eine beliebige Liga (auch die eigene).
function getDivisionLiveData(gameState, nr){
  if(nr === gameState.division) return { teams: gameState.teams, fixtures: gameState.fixtures, matchday: gameState.matchday };
  const sh = gameState.shadowLeagues && gameState.shadowLeagues[nr];
  if(sh && sh.teams) return sh;
  return null;
}

function renderShadowTable(gameState){
  const el = document.getElementById("shadowTable");
  const lbl = document.getElementById("shadowTableLabel");
  if(!el) return;
  const wahl = getLeagueBrowserSelection(gameState);

  const laender = COUNTRIES.map(c => `<button class="chipBtn${c.key === wahl.country ? " on" : ""}" onclick="selectLeagueBrowser('${c.key}')" title="${c.name}">${getCountryBadge(c.key)} ${c.name}</button>`).join("");
  const ligen = getCountryDivisions(wahl.country).map(d => `<button class="chipBtn${d.nr === wahl.nr ? " on" : ""}" onclick="selectLeagueBrowser('${wahl.country}', ${d.nr})">${d.label}${d.nr === gameState.division ? " ★" : ""}</button>`).join("");
  if(lbl) lbl.textContent = getDivisionLabel(wahl.nr);

  el.innerHTML = `<div class="chipBar">${laender}</div><div class="chipBar">${ligen}</div>${buildDivisionTable(gameState, wahl.nr)}`;
}

function buildDivisionTable(gameState, nr){
  const konfig = getDivisionConfig(nr);
  const daten = getDivisionLiveData(gameState, nr);
  if(!daten || !daten.teams || daten.teams.length === 0){
    return `<p class="muted">${konfig.label}: noch keine Daten.</p>`;
  }

  const sorted = getSortedStandings(daten.teams);
  const zonen = getDivisionZones(nr, sorted.length);
  let html = `<div class="tableWrap"><table>
    <tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>`;
  sorted.forEach((t, i) => {
    const stil = zonen[i] ? ` style="box-shadow:inset 3px 0 0 ${zonen[i]};"` : "";
    const eigen = t.name === gameState.clubName ? ` class="highlight"` : "";
    html += `<tr${eigen}${stil}><td class="n">${i + 1}</td><td><span class="clubLink" onclick="showClubDetail(this.dataset.club)" data-club="${t.name}">${t.name}</span></td>
      <td class="n">${t.played}</td><td class="n">${t.gf}:${t.ga}</td>
      <td class="n"><b>${t.points}</b></td></tr>`;
  });
  html += `</table></div>`;

  // Letzter Spieltag dieser Liga.
  const md = daten.matchday || 0;
  if(md > 0 && daten.fixtures){
    const runde = getRoundFixtures(daten.fixtures, daten.teams.length, md - 1).filter(f => f.played);
    if(runde.length){
      html += `<p class="eyebrow" style="margin:12px 0 6px;">Spieltag ${md}</p><div class="confList">${runde.map(f =>
        `<div class="confRow"><span>${f.home}</span><b class="num">${f.homeGoals}:${f.awayGoals}</b><span>${f.away}</span></div>`).join("")}</div>`;
    }
  }

  // Torjaeger dieser Liga.
  const scorer = getTopScorersForClubs(gameState, new Set(daten.teams.map(t => t.name)), 5);
  if(scorer.length){
    html += `<p class="eyebrow" style="margin:12px 0 6px;">Torjäger</p><div class="confList">${scorer.map(s =>
      `<div class="confRow"><span>${s.name}</span><b class="num">${s.goals}</b><span>${s.club}</span></div>`).join("")}</div>`;
  }

  const land = getCountryConfig(konfig.country || "de");
  const pokal = gameState.cupWinners && gameState.cupWinners[land.key];
  if(konfig.tier === 1 && pokal) html += `<p class="muted" style="margin-top:10px; font-size:12px;">🏆 ${land.cup} (Vorsaison): ${pokal}</p>`;
  return html;
}

// Vereinsansicht: Stand, Staerke und Kader aus dem Weltbestand.
function showClubDetail(name){
  if(!name) return;
  if(name === gameState.clubName){ if(typeof switchTab === "function") switchTab("kader"); return; }
  const club = findClubEverywhere(gameState, name) || EURO_CLUBS.find(c => c.name === name);
  const nr = getClubDivision(gameState, name);
  const kader = getClubRoster(gameState.pool, name).sort((a, b) =>
    POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos) || b.strength - a.strength);
  const daten = nr ? getDivisionLiveData(gameState, nr) : null;
  const tab = daten ? getSortedStandings(daten.teams) : [];
  const platz = tab.findIndex(t => t.name === name) + 1;
  const trainer = typeof getCoachName === "function" ? getCoachName(gameState, name) : null;

  document.getElementById("clubModalContent").innerHTML = `
    <p class="eyebrow">${nr ? `${getDivisionTag(nr)} · ${getDivisionLabel(nr)}` : getUefaCountryName(club && club.country ? club.country : "?")}</p>
    <h2 style="margin:2px 0 6px;">${name}</h2>
    ${trainer ? `<p class="muted" style="margin:0 0 10px;">Trainer: ${trainer}</p>` : ""}
    <div class="statGrid" style="margin-bottom:12px;">
      <div class="stat"><div class="k">Stärke</div><div class="v">${club ? Math.round(club.strength) : "–"}</div></div>
      <div class="stat"><div class="k">Platz</div><div class="v">${platz || "–"}</div>${tab.length ? `<div class="sub">von ${tab.length}</div>` : ""}</div>
      <div class="stat"><div class="k">UEFA-Koeffizient</div><div class="v">${getClubCoefficient(gameState, name).toFixed(1)}</div></div>
    </div>
    ${(() => { const titel = getClubTitles(gameState, name);
      return titel.length ? `<p style="margin:-4px 0 12px; font-size:13px;">🏆 ${titel.map(t => `${t.count}× ${t.label}`).join(" · ")}</p>` : ""; })()}
    <div class="tableWrap" style="max-height:46vh; overflow-y:auto;"><table>
      <tr><th>Pos</th><th>Spieler</th><th class="n">Alter</th><th class="n">Stärke</th><th class="n hideMobile">Wert</th></tr>
      ${kader.map(p => `<tr class="rowLink" onclick="closeClubDetail(); showPoolPlayerDetail('${p.id}')">
        <td>${p.pos}</td><td>${getFlag(p) || ""} ${p.name}${p.transferListed ? ' <span class="badge win" title="Auf dem Transfermarkt">TM</span>' : ""}</td>
        <td class="n">${p.age}</td><td class="n">${Math.round(p.strength)}</td><td class="n hideMobile">${fmtMoney(p.value)}</td></tr>`).join("")}
    </table></div>`;
  document.getElementById("clubOverlay").classList.add("show");
}

function closeClubDetail(){
  document.getElementById("clubOverlay").classList.remove("show");
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
    statusLine = `<span class="badge win">🏆 Pokalsieger</span>`;
  } else if(cup.champion){
    statusLine = `Sieger: <b>${cup.champion}</b>`;
  } else if(cup.eliminated){
    statusLine = `<span class="badge loss">Ausgeschieden</span>`;
  } else if(cup.active){
    const nextTrigger = getCupTriggerMatchdays(gameState)[cup.round];
    const roundLabel = CUP_ROUND_LABELS[cup.round] || `Runde ${cup.round + 1}`;
    statusLine = `<span class="badge win">Dabei</span> · ${roundLabel}${nextTrigger ? ` vor Spieltag ${nextTrigger}` : ""} · ${cup.teamsRemaining.length} Teams`;
  } else {
    statusLine = "—";
  }

  let historyHtml = "";
  if(cup.history.length > 0){
    const lastRound = cup.history[cup.history.length - 1];
    const ownMatch = lastRound.matches.find(m => m.home === gameState.clubName || m.away === gameState.clubName);
    if(ownMatch){
      historyHtml = `<p class="breakdownLine">Letztes Spiel: ${ownMatch.home} ${ownMatch.homeGoals}:${ownMatch.awayGoals} ${ownMatch.away}${ownMatch.wasDraw ? ` (${knockoutSuffix(ownMatch)})` : ""}</p>`;
    }
  }

  container.innerHTML = `<p>${statusLine}</p>${historyHtml}`;
}

// Spielplan mit allen Terminen der Saison, Pokaltermine eingeordnet.
function renderFixtureList(gameState){
  const el = document.getElementById("fixtureList");
  if(!el) return;

  const cupOn = {}, euroOn = {};
  getCupTriggerMatchdays(gameState).forEach((md, i) => { cupOn[md] = CUP_ROUND_LABELS[i] || `Runde ${i + 1}`; });
  const uefa = gameState.uefa;
  if(uefa && uefa.own){
    const cfg = UEFA_COMPS[uefa.own];
    getUefaDates(gameState).forEach((md, i) => {
      const titel = i < UEFA_LEAGUE_DATES ? (i < cfg.rounds ? `Ligaphase ${i + 1}` : null)
        : i === UEFA_DATES.length - 1 ? "Finale"
        : `${UEFA_KO_STAGES[Math.floor((i - UEFA_LEAGUE_DATES) / 2)]} ${(i - UEFA_LEAGUE_DATES) % 2 ? "(Rückspiel)" : "(Hinspiel)"}`;
      if(titel) euroOn[md] = `${cfg.icon} ${cfg.short} · ${titel}`;
    });
  }

  const byDay = {};
  gameState.fixtures.forEach((f, idx) => {
    if(f.home !== gameState.clubName && f.away !== gameState.clubName) return;
    byDay[getFixtureMatchday(idx, gameState.teams.length)] = f;
  });

  const qualified = !!(uefa && uefa.own);
  let html = `<tr><th class="n">ST</th><th>Wettbewerb</th><th>Gegner</th><th class="n">Ergebnis</th><th></th></tr>`;

  for(let d = 1; d <= getSeasonMatchdays(gameState); d++){
    if(cupOn[d]) html += `<tr class="dim"><td class="n">${d}</td><td>🏆 ${getCupName(gameState)}</td><td colspan="3">${cupOn[d]}</td></tr>`;
    if(qualified && euroOn[d]) html += `<tr class="dim"><td class="n">${d}</td><td>Europapokal</td><td colspan="3">${euroOn[d]}</td></tr>`;

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
    <p style="margin:2px 0 8px;"><b>${board.goalLabel}</b> · Platz ${board.targetPosition}</p>
    <p class="muted" style="margin:0;">
      Platz ${position} · <span style="color:${aufKurs ? "var(--win)" : "var(--loss)"};">${aufKurs ? "im Soll" : "unter Soll"}</span>${next ? ` · Bewertung Spieltag ${next}` : ""}
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
    ${angebote.map(a => `
      <div class="lineupOption" onclick="acceptJobOffer('${a.name.replace(/'/g, "\\'")}')">
        <span>
          <b>${a.name}</b>
          <span class="divisionBadge ${isTopDivision(a.division) ? "div1" : "div2"}">${getDivisionTag(a.division)}</span>
          <br><span class="breakdownLine muted">Ziel: ${a.goal.label} · Budget ${fmtMoney(a.budget)}</span>
        </span>
        <span class="lineupValue">${Math.round(a.strength)}</span>
      </div>`).join("")}` : "";

  el.innerHTML = `
    <p class="eyebrow">${result.regional ? `Abstieg in die ${result.reserveLabel || "Regionalliga"}` : "Der Vorstand hat entschieden"}</p>
    <h2 style="margin:4px 0 14px;">${result.regional ? "Vertrag aufgelöst" : "Entlassen"}</h2>
    <p class="muted" style="margin:0 0 16px;">
      ${result.regional
        ? `${gameState.clubName} · Platz ${result.position} in der ${getDivisionLabel(gameState.division)}`
        : `Spieltag ${result.matchday} · Platz ${result.position} · Ziel: ${board.goalLabel} (Platz ${board.targetPosition})`}
    </p>
    <div class="statGrid" style="margin-bottom:4px;">
      <div class="stat"><div class="k">Saisons im Amt</div><div class="v gold">${saisons + 1}</div></div>
      <div class="stat"><div class="k">Letzter Platz</div><div class="v">${result.position}</div></div>
      <div class="stat"><div class="k">Erfolge</div><div class="v">${titel}</div></div>
    </div>
    ${angebotsHtml}
    <div style="margin-top:18px;">
      <button class="ghost" onclick="restartAfterDismissal()">Neue Karriere</button>
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
    return teile.join(" · ") || '<span class="muted">–</span>';
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
  let html = `<p class="muted" style="margin:0 0 8px;">Investiert ${fmtMoney(investiert)}</p>`;

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
      <p class="muted" style="margin:0; font-size:12px;">${stufe > 0 ? f.wirkung(stufe) : `Stufe 1: ${f.wirkung(1)}`}</p>
    </div>`;
  });

  el.innerHTML = html;
}
