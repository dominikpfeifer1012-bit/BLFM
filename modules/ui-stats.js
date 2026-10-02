// ============================================
// UI-STATS.JS - Statistik: Bilanzen, Torjaeger, Bestmarken, Erfolge, Verlauf
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

function renderSeasonHistory(gameState){
  const container = document.getElementById("seasonHistoryTable");
  if(!container) return;

  if(!gameState.seasonHistory || gameState.seasonHistory.length === 0){
    container.innerHTML = `<tr><td class="muted">Noch keine abgeschlossene Saison.</td></tr>`;
    return;
  }

  const movementLabel = { promoted: "⬆️", relegated: "⬇️", stayed: "" };

  let html = `<tr><th>Saison</th><th>Verein</th><th>Liga</th><th class="n">Platz</th>
    <th class="n">Pkt</th><th>Pokal</th><th>Europa</th><th>Torjäger</th></tr>`;

  [...gameState.seasonHistory].reverse().forEach(sn => {
    const liga = getDivisionTag(sn.division || 1);
    const meister = isTopDivision(sn.division || 1) && sn.finalPosition === 1;
    const torjaeger = sn.topScorer
      ? `${sn.topScorer.name} <span class="num">${sn.topScorer.goals}</span>`
      : "—";
    const pokal = sn.cupResult === "Sieger"
      ? '<span class="badge win">Sieger</span>' : (sn.cupResult || "—");
    const europa = sn.europeResult
      ? (sn.europeResult === "Sieger" ? '<span class="badge win">Sieger</span>' : sn.europeResult)
      : "—";

    html += `<tr>
      <td class="n">${sn.season}/${(sn.season + 1) % 100}</td>
      <td>${sn.club || gameState.clubName}</td>
      <td>${liga}</td>
      <td class="n">${meister ? "🏆 " : ""}${sn.finalPosition}${movementLabel[sn.movement] || ""}</td>
      <td class="n">${sn.points != null ? sn.points : "—"}</td>
      <td style="font-size:12px;">${pokal}</td>
      <td style="font-size:12px;">${europa}</td>
      <td style="font-size:12px;">${torjaeger}</td>
    </tr>`;
  });
  container.innerHTML = html;
}

function renderTopScorers(gameState){
  const container = document.getElementById("topScorersTable");
  if(!container) return;

  const liste = getLeagueTopScorers(gameState, 10);
  if(liste.length === 0){
    container.innerHTML = `<tr><td class="muted">Noch keine Tore diese Saison.</td></tr>`;
    return;
  }

  let html = `<tr><th class="n">#</th><th>Name</th><th>Verein</th><th class="n">Tore</th></tr>`;
  liste.forEach((e, i) => {
    const nat = NATIONALITY_BY_CODE[e.nat];
    html += `<tr${e.eigen ? ' class="highlight"' : ""}>
      <td class="n">${i + 1}</td>
      <td>${nat ? nat.flag + " " : ""}${POSITION_ICONS[e.pos] || ""} ${e.name}</td>
      <td style="font-size:12px;">${e.club}</td>
      <td class="n"><b>${e.goals}</b></td></tr>`;
  });
  container.innerHTML = html;
}

function renderAchievements(gameState){
  const container = document.getElementById("achievementsList");
  if(!container) return;

  const unlocked = gameState.achievements || [];
  const countEl = document.getElementById("achievementCount");
  if(countEl) countEl.textContent = `${unlocked.length} von ${ACHIEVEMENTS.length}`;

  container.innerHTML = ACHIEVEMENTS.map(a => {
    const isUnlocked = unlocked.includes(a.key);
    return `<span class="achievement ${isUnlocked ? "unlocked" : "locked"}" title="${a.desc}">${isUnlocked ? a.label : "🔒 " + a.label}</span>`;
  }).join(" ");
}

function renderSeasonStats(gameState){
  const el = document.getElementById("seasonStats");
  if(!el) return;
  const { row, position } = getOwnTeamRow(gameState);
  const played = row ? row.played : 0;
  const ppg = played > 0 ? (row.points / played).toFixed(2) : "0.00";
  const results = getOwnResults(gameState);
  const biggest = results.reduce((best, r) => {
    const margin = r.goalsFor - r.goalsAgainst;
    return (!best || margin > best.margin) ? { margin, r } : best;
  }, null);

  el.innerHTML =
    statBox("Platz", position, `von ${gameState.teams.length}`, true) +
    statBox("Punkte", row ? row.points : 0, `${ppg} pro Spiel`) +
    statBox("Siege", row ? row.won : 0, `${row ? row.drawn : 0} U · ${row ? row.lost : 0} N`) +
    statBox("Tore", row ? row.gf : 0, played ? `${(row.gf / played).toFixed(2)} pro Spiel` : "") +
    statBox("Gegentore", row ? row.ga : 0, played ? `${(row.ga / played).toFixed(2)} pro Spiel` : "") +
    statBox("Höchster Sieg", biggest && biggest.margin > 0 ? `${biggest.r.goalsFor}:${biggest.r.goalsAgainst}` : "—",
      biggest && biggest.margin > 0 ? `vs. ${biggest.r.opponent}` : "");
}

function renderSquadAnalysis(gameState){
  const el = document.getElementById("squadAnalysis");
  if(!el) return;
  const squad = gameState.squad;
  if(squad.length === 0){ el.innerHTML = ""; return; }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const youth = squad.filter(p => p.isYouthProduct).length;
  const veterans = squad.filter(p => p.age >= RETIREMENT_MIN_AGE).length;
  const best = [...squad].sort((a, b) => b.strength - a.strength)[0];
  const talent = [...squad].sort((a, b) => (b.maxStrength - b.strength) - (a.maxStrength - a.strength))[0];

  el.innerHTML =
    statBox("Ø Bewertung", avg(squad.map(p => p.strength)).toFixed(1), null, true) +
    statBox("Ø Alter", avg(squad.map(p => p.age)).toFixed(1), `${veterans} über ${RETIREMENT_MIN_AGE - 1}`) +
    statBox("Eigengewächse", youth, `von ${squad.length}`) +
    statBox("Bester", Math.round(best.strength), best.name) +
    statBox("Größtes Potenzial", `+${Math.round(talent.maxStrength - talent.strength)}`, talent.name) +
    ATTRIBUTES.map(a => {
      const werte = squad.filter(p => p.attributes).map(p => p.attributes[a]);
      return werte.length ? statBox(`Ø ${ATTRIBUTE_LABELS[a]}`, avg(werte).toFixed(1)) : "";
    }).join("") +
    statBox("Ø Stimmung", Math.round(getSquadMoraleAverage(squad)),
      `${squad.filter(p => getMorale(p) >= 85).length} begeistert`);
}

function renderNationBreakdown(gameState){
  const el = document.getElementById("nationBreakdown");
  if(!el) return;
  const counts = {};
  gameState.squad.forEach(p => { if(p.nat) counts[p.nat] = (counts[p.nat] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if(entries.length === 0){ el.innerHTML = `<p class="muted">Keine Herkunftsdaten im Kader.</p>`; return; }
  const max = entries[0][1];

  el.innerHTML = entries.map(([code, count]) => {
    const nat = NATIONALITY_BY_CODE[code];
    return `<div style="display:flex; align-items:center; gap:10px; margin-bottom:7px;">
      <span style="width:24px;">${nat ? nat.flag : ""}</span>
      <span style="flex:0 0 116px; font-size:13px;">${nat ? nat.name : code}</span>
      <span class="bar" style="flex:1;"><i style="width:${(count / max) * 100}%;"></i></span>
      <span class="num" style="width:22px; text-align:right; font-size:13px;">${count}</span>
    </div>`;
  }).join("");
}

// Spielplan mit allen Terminen der Saison, Pokaltermine eingeordnet.

function renderRecords(gameState){
  const el = document.getElementById("recordsPanel");
  if(!el) return;
  const r = gameState.records;
  if(!r){ el.innerHTML = ""; return; }

  const zeile = (label, wert, zusatz) => wert == null ? "" : `
    <div style="display:flex; justify-content:space-between; align-items:baseline; gap:12px;
      padding:8px 0; border-bottom:1px solid var(--line);">
      <span class="eyebrow" style="flex:0 0 auto;">${label}</span>
      <span style="text-align:right; font-size:13px;">${wert}${
        zusatz ? `<br><span class="muted" style="font-size:11px;">${zusatz}</span>` : ""}</span>
    </div>`;

  const saison = s => s ? `Saison ${s}/${(s + 1) % 100}` : "";

  const html =
    zeile("Höchster Sieg", r.biggestWin
      ? `<b class="num">${r.biggestWin.goalsFor}:${r.biggestWin.goalsAgainst}</b> gegen ${r.biggestWin.opponent}`
      : null, r.biggestWin ? saison(r.biggestWin.season) : "") +
    zeile("Höchste Niederlage", r.biggestDefeat
      ? `<b class="num">${r.biggestDefeat.goalsFor}:${r.biggestDefeat.goalsAgainst}</b> gegen ${r.biggestDefeat.opponent}`
      : null, r.biggestDefeat ? saison(r.biggestDefeat.season) : "") +
    zeile("Längste Siegesserie", r.longestWinStreak > 0
      ? `<b class="num">${r.longestWinStreak}</b> Spiele` : null) +
    zeile("Längste Serie ohne Niederlage", r.longestUnbeaten > 0
      ? `<b class="num">${r.longestUnbeaten}</b> Spiele` : null) +
    zeile("Beste Saison", r.bestSeason
      ? `Platz <b class="num">${r.bestSeason.finalPosition}</b> in der ${getDivisionLabel(r.bestSeason.division || 1)}`
      : null, r.bestSeason ? `${r.bestSeason.club} · ${saison(r.bestSeason.season)}` : "") +
    zeile("Bester Torjäger einer Saison", r.topScorerSeason
      ? `<b class="num">${r.topScorerSeason.goals}</b> Tore — ${r.topScorerSeason.name}`
      : null, r.topScorerSeason ? `${r.topScorerSeason.club} · ${saison(r.topScorerSeason.season)}` : "") +
    zeile("Meiste Tore für uns", r.mostGoalsCareer
      ? `<b class="num">${r.mostGoalsCareer.goals}</b> Tore — ${r.mostGoalsCareer.name}` : null,
      "über die gesamte Amtszeit") +
    zeile("Teuerster Transfer", r.mostExpensiveSigning
      ? `<b>${fmtMoney(r.mostExpensiveSigning.fee)}</b> — ${r.mostExpensiveSigning.name}`
      : null, r.mostExpensiveSigning
        ? `${r.mostExpensiveSigning.pos}, Bewertung ${r.mostExpensiveSigning.strength} · ${saison(r.mostExpensiveSigning.season)}` : "") +
    zeile("Höchste Teambewertung", r.highestTeamRating
      ? `<b class="num">${r.highestTeamRating.value}</b>` : null,
      r.highestTeamRating ? saison(r.highestTeamRating.season) : "");

  el.innerHTML = html || `<p class="muted">Noch keine Bestmarken.</p>`;
}

// ============================================
// Tabelle der anderen Liga
// ============================================

// ============================================
// Mehrsaison-Analyse
// ============================================
// Zeigt die Entwicklung des Vereins ueber alle Saisons hinweg. Die Daten
// liegen in der Vereinsgeschichte und werden hier nur ausgewertet.

function buildTrendChart(werte, beschriftungen, farbe, invertiert){
  const gueltig = werte.map((w, i) => ({ w, i })).filter(x => x.w != null);
  if(gueltig.length < 2){
    return `<p class="muted" style="text-align:center; padding:14px 0; font-size:12px;">
      Ab zwei Saisons.</p>`;
  }

  const zahlen = gueltig.map(x => x.w);
  const min = Math.min(...zahlen), max = Math.max(...zahlen);
  const spanne = (max - min) || 1;
  const breite = 100, hoehe = 34;

  const punkte = gueltig.map((x, idx) => {
    const px = gueltig.length === 1 ? 0 : (idx / (gueltig.length - 1)) * breite;
    const anteil = (x.w - min) / spanne;
    const py = invertiert ? 2 + anteil * (hoehe - 4) : (hoehe - 2) - anteil * (hoehe - 4);
    return `${px.toFixed(1)},${py.toFixed(1)}`;
  });

  const letzter = gueltig[gueltig.length - 1];
  const erster = gueltig[0];
  const richtung = invertiert ? erster.w - letzter.w : letzter.w - erster.w;
  const pfeil = Math.abs(richtung) < 0.01 ? "→"
    : richtung > 0 ? '<span style="color:var(--win);">▲</span>'
    : '<span style="color:var(--loss);">▼</span>';

  return `<svg width="100%" height="${hoehe}" viewBox="0 0 ${breite} ${hoehe}" preserveAspectRatio="none"
      style="display:block;">
      <polyline points="${punkte.join(" ")}" fill="none" stroke="${farbe}" stroke-width="1.6"
        vector-effect="non-scaling-stroke" />
    </svg>
    <div style="display:flex; justify-content:space-between; font-size:11px; color:var(--ink-faint); margin-top:2px;">
      <span>${beschriftungen[erster.i]}</span>
      <span>${pfeil} ${beschriftungen[letzter.i]}</span>
    </div>`;
}

function renderSeasonTrends(gameState){
  const el = document.getElementById("trendPanel");
  if(!el) return;

  const historie = [...(gameState.seasonHistory || [])];
  if(historie.length === 0){
    el.innerHTML = `<p class="muted">Noch keine abgeschlossene Saison.</p>`;
    return;
  }

  const saisons = historie.map(s => `${s.season}/${(s.season + 1) % 100}`);

  const karte = (titel, werte, farbe, format, invertiert, hinweis) => {
    const gueltig = werte.filter(w => w != null);
    const letzter = gueltig.length ? gueltig[gueltig.length - 1] : null;
    return `<div class="stat" style="padding:12px 14px;">
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <span class="k">${titel}</span>
        <span class="num" style="font-size:15px; color:${farbe};">${letzter != null ? format(letzter) : "—"}</span>
      </div>
      ${buildTrendChart(werte, saisons, farbe, invertiert)}
      ${hinweis ? `<div class="sub" style="margin-top:4px;">${hinweis}</div>` : ""}
    </div>`;
  };

  const zahl = v => Math.round(v);
  const geld = v => fmtMoney(v);

  // Platzierung wird invertiert dargestellt: Platz 1 gehoert nach oben.
  const bilanz = historie.map(s => (s.transferIn || 0) - (s.transferOut || 0));

  el.innerHTML = `<div class="statGrid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));">
    ${karte("Platzierung", historie.map(s => s.finalPosition), "var(--gold)", v => "Platz " + zahl(v), true,
      "niedriger ist besser")}
    ${karte("Punkte", historie.map(s => s.points), "var(--win)", zahl, false)}
    ${karte("Vereinsstanding", historie.map(s => s.stature), "var(--info)", v => v.toFixed(1), false,
      "bestimmt die Einnahmen")}
    ${karte("Teambewertung", historie.map(s => s.teamRating), "var(--gold)", zahl, false)}
    ${karte("Kaderwert", historie.map(s => s.squadValue), "var(--win)", geld, false)}
    ${karte("Gehaltslast", historie.map(s => s.salaryTotal), "var(--loss)", geld, true,
      "pro Saison")}
    ${karte("Transferbilanz", bilanz, "var(--info)",
      v => (v >= 0 ? "+" : "") + fmtMoney(Math.abs(v)), false, "Erlöse minus Ablösen")}
    ${karte("Eigengewächse", historie.map(s => s.youthProducts), "var(--win)", zahl, false,
      "im Kader")}
    ${karte("Altersschnitt", historie.map(s => s.avgAge), "var(--ink-dim)", v => v.toFixed(1), false)}
    ${karte("Stimmung", historie.map(s => s.morale), "var(--draw)", zahl, false)}
  </div>
  ${renderTrendSummary(historie)}`;
}

// Eine kurze Einordnung in Worten — Zahlenreihen allein sagen wenig.
function renderTrendSummary(historie){
  if(historie.length < 2) return "";

  const erste = historie[0], letzte = historie[historie.length - 1];
  const saetze = [];

  const platzDiff = erste.finalPosition - letzte.finalPosition;
  if(Math.abs(platzDiff) >= 2){
    saetze.push(platzDiff > 0
      ? `Platz +${platzDiff} seit Saison 1`
      : `Platz −${-platzDiff} seit Saison 1`);
  }

  if(erste.stature != null && letzte.stature != null){
    const d = letzte.stature - erste.stature;
    if(Math.abs(d) >= 2){
      saetze.push(`Standing ${erste.stature.toFixed(1)} → ${letzte.stature.toFixed(1)}`);
    }
  }

  const titel = historie.filter(s => isTopDivision(s.division || 1) && s.finalPosition === 1).length;
  if(titel > 0) saetze.push(`${titel}× Meister`);

  const pokale = historie.filter(s => s.cupResult === "Sieger").length;
  if(pokale > 0) saetze.push(`${pokale}× Pokal`);

  const gesamtBilanz = historie.reduce((sum, s) => sum + (s.transferIn || 0) - (s.transferOut || 0), 0);
  if(Math.abs(gesamtBilanz) > 100000){
    saetze.push(`Transferbilanz ${gesamtBilanz >= 0 ? "+" : "−"}${fmtMoney(Math.abs(gesamtBilanz))}`);
  }

  const vereine = [...new Set(historie.map(s => s.club).filter(Boolean))];
  if(vereine.length > 1) saetze.push(`Stationen: ${vereine.join(", ")}`);

  if(saetze.length === 0) return "";
  return `<p class="muted" style="margin:14px 0 0; font-size:13px;">${saetze.join(" · ")}</p>`;
}
