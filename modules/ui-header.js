// ============================================
// UI-HEADER.JS - Kopfbereich: Vereinszeile, Formband, naechstes Spiel
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function renderHeader(gameState){
  const crest = document.getElementById("clubCrest");
  if(crest) crest.textContent = gameState.clubName.replace(/^\d+\.\s*/, "").charAt(0);

  document.getElementById("clubHeader").textContent = gameState.clubName;
  const tag = Math.min(gameState.matchday + 1, TOTAL_MATCHDAYS);
  document.getElementById("statusLine").innerHTML =
    `<span class="hideMobile">${getManagerLabel(gameState)} · Saison <span class="num">${gameState.season}/${gameState.season + 1}</span> · Spieltag <span class="num">${tag}</span> von <span class="num">${TOTAL_MATCHDAYS}</span></span>` +
    `<span class="onlyMobile">Saison ${String(gameState.season).slice(2)}/${String(gameState.season + 1).slice(2)} · Spieltag ${tag}/${TOTAL_MATCHDAYS}</span>`;

  const chips = document.getElementById("headerChips");
  if(chips){
    const rating = teamRating(gameState.squad, gameState.matchday + 1);
    const negBudget = gameState.budget < 0 ? " neg" : "";
    chips.innerHTML = `
      <span class="divisionBadge ${gameState.division === 1 ? "div1" : "div2"}">${getDivisionConfig(gameState.division).short}</span>
      <span class="chip">Team <b>${rating}</b></span>
      <span class="chip${negBudget}"><span class="chipLabel">Budget </span><b>${fmtMoney(gameState.budget)}</b></span>
      <span class="chip chipSalary">Gehalt <b>${fmtMoney(getMatchdaySalaryCost(gameState.squad))}</b>/ST</span>`;
  }

  renderFormBand(gameState);

  const simBtn = document.getElementById("simulateBtn");
  if(simBtn && !simBtn.disabled) simBtn.textContent = getNextEventLabel();

  // Symbol plus Beschriftung; auf dem Handy bleibt nur das Symbol, der
  // Aus-Zustand ist dann am abgeblendeten Knopf erkennbar.
  const toggle = (btn, icon, label, an) => {
    if(!btn) return;
    btn.innerHTML = `<span class="btnIcon">${icon}</span><span class="btnLabel">${label}: ${an ? "an" : "aus"}</span>`;
    btn.classList.toggle("off", !an);
    btn.setAttribute("aria-label", `${label} ${an ? "an" : "aus"}`);
  };
  toggle(document.getElementById("pressToggleBtn"), "🎤", "Presse", isPressEnabled(gameState));
  toggle(document.getElementById("liveToggleBtn"), "📡", "Live", isLiveEnabled());

  const badgeEl = document.getElementById("transferWindowBadge");
  if(badgeEl){
    const currentDay = gameState.matchday + 1;
    if(isTransferWindowOpen(currentDay)){
      badgeEl.className = "windowBadge open";
      badgeEl.textContent = `Transferfenster offen bis Spieltag ${getCurrentWindowEnd(currentDay)}`;
    } else {
      const nextStart = getNextWindowStart(currentDay);
      badgeEl.className = "windowBadge closed";
      badgeEl.textContent = nextStart
        ? `Transferfenster geschlossen — öffnet Spieltag ${nextStart}`
        : "Transferfenster geschlossen";
    }
  }
}

// Signature: die ganze Saison als Band. Jedes Segment ist ein Spieltag,
// die Farbe das Ergebnis. Der Formverlauf wird damit auf einen Blick lesbar.

// Signature: die ganze Saison als Band. Jedes Segment ist ein Spieltag,
// die Farbe das Ergebnis. Der Formverlauf wird damit auf einen Blick lesbar.
function getOwnResults(gameState){
  const results = [];
  gameState.fixtures.forEach((f, idx) => {
    if(!f.played || f.homeGoals == null) return;   // Altstände ohne Tore überspringen
    if(f.home !== gameState.clubName && f.away !== gameState.clubName) return;
    results.push({
      matchday: Math.floor(idx / MATCHES_PER_MATCHDAY) + 1,
      result: getResultForClub(gameState.clubName, f.home, f.away, f.homeGoals, f.awayGoals),
      opponent: f.home === gameState.clubName ? f.away : f.home,
      isHome: f.home === gameState.clubName,
      goalsFor: f.home === gameState.clubName ? f.homeGoals : f.awayGoals,
      goalsAgainst: f.home === gameState.clubName ? f.awayGoals : f.homeGoals
    });
  });
  return results.sort((a, b) => a.matchday - b.matchday);
}

function renderFormBand(gameState){
  const band = document.getElementById("formBand");
  if(!band) return;
  const byDay = {};
  getOwnResults(gameState).forEach(r => { byDay[r.matchday] = r; });

  let html = "";
  for(let d = 1; d <= TOTAL_MATCHDAYS; d++){
    const r = byDay[d];
    const isNow = !gameState.seasonEnded && d === gameState.matchday + 1;
    const title = r
      ? `ST ${d}: ${r.isHome ? "H" : "A"} vs. ${r.opponent} ${r.goalsFor}:${r.goalsAgainst}`
      : `Spieltag ${d}`;
    html += `<span class="formSeg${isNow ? " now" : ""}"${r ? ` data-r="${r.result}"` : ""} title="${title}"></span>`;
  }
  band.innerHTML = html;
}

function renderOpponentPreview(gameState){
  const el = document.getElementById("nextOpponentLine");
  if(!el) return;

  if(gameState.seasonEnded){
    el.innerHTML = "Saison beendet – starte die nächste Saison, um weiterzuspielen.";
    return;
  }

  const evt = getNextEvent(gameState);
  if(evt.type === "cup" || evt.type === "europe"){
    const wettbewerb = evt.type === "cup" ? "🏆 DFB-Pokal" : "🌍 Europapokal";
    el.innerHTML = `Als Nächstes: <b>${wettbewerb} — ${evt.label}</b> · danach geht es weiter mit Spieltag ${evt.beforeMatchday}`;
    return;
  }

  const info = getNextOpponentInfo(gameState);
  if(!info){
    el.innerHTML = "";
    return;
  }

  const diff = info.ownStrength - info.opponentStrength;
  let cls = "neutral", label = "Ausgeglichen";
  if(diff >= 3){ cls = "favored"; label = "Favorit"; }
  else if(diff <= -3){ cls = "underdog"; label = "Außenseiter"; }

  const venue = info.isHome ? "🏠 Heimspiel" : "✈️ Auswärtsspiel";
  const gegnerTaktik = TACTICS[info.opponentTactic];
  el.innerHTML = `Nächster Gegner: <b>${info.opponentName}</b> (Stärke ${Math.round(info.opponentStrength)}) · ${venue} · Eigene Stärke ${info.ownStrength}
    <span class="matchupTag ${cls}">${label}</span>${
      gegnerTaktik ? ` · erwartete Ausrichtung: <b>${gegnerTaktik.label}</b>` : ""}`;
}

function renderNextMatch(gameState){
  const el = document.getElementById("nextMatchCard");
  const dayEl = document.getElementById("nextMatchDay");
  if(!el) return;

  if(gameState.seasonEnded){
    el.innerHTML = `<p class="muted">Die Saison ist beendet. Starte die nächste Saison, um weiterzuspielen.</p>`;
    if(dayEl) dayEl.textContent = "";
    return;
  }

  const evt = getNextEvent(gameState);
  if(evt.type === "cup" || evt.type === "europe"){
    const isCup = evt.type === "cup";
    if(dayEl) dayEl.textContent = `vor Spieltag ${evt.beforeMatchday}`;
    const teamsLeft = isCup && gameState.cup
      ? `${gameState.cup.teamsRemaining.length} Mannschaften sind noch dabei.`
      : "Der Gegner wird bei Anpfiff ausgelost.";
    el.innerHTML = `
      <p class="eyebrow">${isCup ? "DFB-Pokal" : "Europapokal"}</p>
      <h2 style="margin:2px 0 6px;">${evt.label}</h2>
      <p class="muted" style="margin:0 0 10px;">${teamsLeft}</p>
      <div class="statGrid">
        ${statBox("Eigene Stärke", teamRating(gameState.squad, gameState.matchday + 1), null, true)}
      </div>`;
    return;
  }

  const info = getNextOpponentInfo(gameState);
  if(!info){ el.innerHTML = `<p class="muted">Kein Spiel angesetzt.</p>`; return; }
  if(dayEl) dayEl.textContent = `Spieltag ${gameState.matchday + 1}`;

  const diff = info.ownStrength - info.opponentStrength;
  let cls = "neutral", label = "Ausgeglichen";
  if(diff >= 3){ cls = "favored"; label = "Favorit"; }
  else if(diff <= -3){ cls = "underdog"; label = "Außenseiter"; }

  el.innerHTML = `
    <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
      <div style="flex:1; min-width:150px;">
        <p class="eyebrow">${info.isHome ? "Heimspiel gegen" : "Auswärts bei"}</p>
        <h2 style="margin:2px 0 6px;">${info.opponentName}</h2>
        <span class="matchupTag ${cls}">${label}</span>
      </div>
      <div class="statGrid" style="flex:1; min-width:190px;">
        ${statBox("Eigene Stärke", Math.round(info.ownStrength), null, true)}
        ${statBox("Gegner", Math.round(info.opponentStrength))}
      </div>
    </div>
    ${renderTacticMatchup(info)}`;
}

function renderMiniTable(gameState){
  const el = document.getElementById("miniTable");
  const lbl = document.getElementById("miniTableLabel");
  if(!el) return;
  if(lbl) lbl.textContent = getDivisionLabel(gameState.division);

  const { sorted, position } = getOwnTeamRow(gameState);
  const from = Math.max(0, Math.min(position - 3, sorted.length - 5));
  const slice = sorted.slice(from, from + 5);

  let html = `<tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>`;
  slice.forEach((t, i) => {
    const pos = from + i + 1;
    const cls = t.name === gameState.clubName ? ' class="highlight"' : "";
    html += `<tr${cls}><td class="n">${pos}</td><td>${t.name}</td><td class="n">${t.played}</td><td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>`;
  });
  el.innerHTML = html;
}

function renderOverviewStats(gameState){
  const el = document.getElementById("overviewStats");
  if(!el) return;
  const { row, position } = getOwnTeamRow(gameState);
  const results = getOwnResults(gameState);
  const last5 = results.slice(-5);
  const formHtml = last5.length
    ? last5.map(r => `<span class="badge ${r.result}" title="ST ${r.matchday}: ${r.goalsFor}:${r.goalsAgainst} vs. ${r.opponent}">${r.result === "win" ? "S" : r.result === "draw" ? "U" : "N"}</span>`).join(" ")
    : '<span class="muted">—</span>';

  el.innerHTML =
    statBox("Platz", position, `von ${gameState.teams.length}`, true) +
    statBox("Punkte", row ? row.points : 0, row ? `${row.won}-${row.drawn}-${row.lost}` : "") +
    statBox("Tore", row ? `${row.gf}:${row.ga}` : "0:0", row ? `${row.gf - row.ga > 0 ? "+" : ""}${row.gf - row.ga}` : "") +
    `<div class="stat"><div class="k">Letzte Spiele</div><div style="margin-top:6px; display:flex; gap:3px;">${formHtml}</div></div>`;
}

function renderOverviewCompetitions(gameState){
  const el = document.getElementById("overviewCompetitions");
  if(!el) return;
  const lines = [];

  const cup = gameState.cup;
  if(cup){
    if(cup.champion === gameState.clubName) lines.push(`<span class="badge win">Pokalsieger</span>`);
    else if(cup.eliminated) lines.push(`DFB-Pokal <span class="badge loss">ausgeschieden</span>`);
    else if(cup.active) lines.push(`DFB-Pokal · noch dabei · ${CUP_ROUND_LABELS[cup.round] || "nächste Runde"}`);
  }

  const eu = gameState.europe;
  if(eu && eu.qualified){
    if(eu.champion) lines.push(`<span class="badge win">Europapokalsieger</span>`);
    else if(eu.eliminated) lines.push(`Europapokal <span class="badge loss">ausgeschieden</span>`);
    else if(eu.active) lines.push(eu.phase === "group"
      ? `Europapokal · Gruppe ${eu.ownGroup} · Spieltag ${eu.groupMatchday}/${EUROPE_GROUP_MATCHDAYS.length}`
      : `Europapokal · ${EUROPE_KO_LABELS[eu.knockoutRound] || "K.o.-Runde"}`);
  } else {
    lines.push(`<span class="muted">Europapokal: nicht qualifiziert</span>`);
  }

  el.innerHTML = lines.map(l => `<p style="margin:0 0 8px; font-size:13px;">${l}</p>`).join("");
}

function renderOverviewLog(gameState){
  const el = document.getElementById("overviewLog");
  if(!el) return;
  el.innerHTML = gameState.log.slice(0, 6).map(entry => {
    const badge = entry.result ? `<span class="badge ${entry.result}">${LOG_BADGE_LABELS[entry.result]}</span> ` : "";
    return `<div style="padding:4px 0;">${badge}${entry.msg}</div>`;
  }).join("") || `<p class="muted">Noch keine Ereignisse.</p>`;
}

// Zeigt, wie die eigene Ausrichtung gegen die erwartete des Gegners wirkt.
// Ohne diese Anzeige waere der Konter unsichtbar und damit nicht spielbar.
function renderTacticMatchup(info){
  const eigene = TACTICS[info.ownTactic], gegner = TACTICS[info.opponentTactic];
  if(!eigene || !gegner) return "";

  const wirkung = getTacticMatchup(info.ownTactic, info.opponentTactic);
  const bewerten = w => w > 0.02 ? { text: "mehr", farbe: "var(--win)" }
                     : w < -0.02 ? { text: "weniger", farbe: "var(--loss)" }
                     : { text: "unverändert", farbe: "var(--ink-dim)" };
  const an = bewerten(wirkung.own);
  // Gegentore: Farbe nach Wirkung (mehr = schlecht = rot), Text nach Richtung.
  // Vorher wurde beides umgedreht, und es hiess "Gegentorgefahr weniger",
  // obwohl sie stieg.
  const ab = wirkung.opp > 0.02 ? { text: "höher", farbe: "var(--loss)" }
           : wirkung.opp < -0.02 ? { text: "geringer", farbe: "var(--win)" }
           : { text: "unverändert", farbe: "var(--ink-dim)" };

  // Empfehlung: welche eigene Ausrichtung bringt gegen diesen Gegner das
  // beste Verhaeltnis aus eigenen und gegnerischen Chancen?
  const beste = Object.keys(TACTICS)
    .map(k => ({ k, wert: getTacticMatchup(k, info.opponentTactic) }))
    .sort((a, b) => (b.wert.own - b.wert.opp) - (a.wert.own - a.wert.opp))[0];

  const hinweis = beste.k === info.ownTactic
    ? '<span style="color:var(--win);">Gute Wahl gegen diese Ausrichtung.</span>'
    : `<span style="color:var(--draw);">${TACTICS[beste.k].label} würde gegen ${gegner.label} besser greifen.</span>`;

  return `<div style="margin-top:14px; padding-top:12px; border-top:1px solid var(--line);">
    <p class="eyebrow">Taktisches Duell</p>
    <p style="margin:4px 0 6px; font-size:13px;">
      <b>${eigene.label}</b> gegen <b>${gegner.label}</b> —
      eigene Chancen <span style="color:${an.farbe};">${an.text}</span>,
      Gegentorgefahr <span style="color:${ab.farbe};">${ab.text}</span>
    </p>
    <p class="muted" style="margin:0; font-size:12px;">${hinweis}</p>
  </div>`;
}

// Ohne eingegebenen Namen nur "Trainer". Aeltere Spielstaende haben "Trainer"
// als Ersatznamen gespeichert, daraus wurde sonst "Trainer Trainer".
function getManagerLabel(gameState){
  const name = (gameState.manager || "").trim();
  return name && name !== "Trainer" ? `Trainer ${name}` : "Trainer";
}
