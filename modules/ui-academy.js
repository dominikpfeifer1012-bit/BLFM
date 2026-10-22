// ============================================
// UI-ACADEMY.JS - Akademie-Tab
// ============================================
// Akademie (Ausbau, Ruf), Scouts mit Auftrag, gesichtete Talente mit
// Probetraining und Vertrag, Marktberichte und die Chronik. Jugendkader und
// Jugendmannschaft (ui-squad.js) stehen im selben Tab.

function starText(n, max){
  return `<span class="stars" title="${n} von ${max || 5}">${"★".repeat(n)}<span style="color:var(--ink-faint);">${"★".repeat(Math.max(0, (max || 5) - n))}</span></span>`;
}

function potentialText(gameState, player){
  const e = getPotentialEstimate(gameState, player);
  return e.exact ? `${e.lo}` : `${e.lo}–${e.hi}`;
}

function renderAcademyTab(gameState){
  if(!gameState || !gameState.squad || !document.getElementById("academyPanel")) return;
  ensureAcademy(gameState);
  renderAcademyPanel(gameState);
  renderScoutPanel(gameState);
  renderProspectPanel(gameState);
  renderReportPanel(gameState);
  renderAcademyLog(gameState);
  if(typeof renderYouthSquad === "function") renderYouthSquad(gameState);
  if(typeof renderYouthPanel === "function") renderYouthPanel(gameState);
}

// ---------- Akademie ----------

function renderAcademyPanel(gameState){
  const el = document.getElementById("academyPanel");
  const a = ensureAcademy(gameState);
  const label = document.getElementById("academyRepLabel");
  if(label) label.textContent = `Ruf: ${getAcademyRepLabel(a.reputation)}`;
  const bonus = getYouthQualityBonus(gameState);
  const spieltage = getSeasonMatchdays(gameState);

  const teil = (key, wirkung) => {
    const p = ACADEMY_PARTS[key];
    const stufe = a[key];
    const kosten = getAcademyUpgradeCost(gameState, key);
    const balken = Array.from({ length: ACADEMY_LEVELS }, (_, i) =>
      `<span style="flex:1; height:6px; border-radius:2px; background:${i < stufe ? "var(--gold)" : "var(--bg-deep)"};"></span>`).join("");
    return `<div style="padding:10px 0; border-bottom:1px solid var(--line);">
      <div style="display:flex; align-items:baseline; justify-content:space-between; gap:10px;">
        <span><b>${p.icon} ${p.label}</b> <span class="muted" style="font-size:12px;">Stufe ${stufe}/${ACADEMY_LEVELS}</span></span>
        <button class="ghost" onclick="handleUpgradeAcademy('${key}')"${kosten === null || kosten > gameState.budget ? " disabled" : ""}>
          ${kosten === null ? "Ausgebaut" : (key === "coaches" ? "Verpflichten · " : "Ausbauen · ") + fmtMoney(kosten)}</button>
      </div>
      <div style="display:flex; gap:3px; margin:7px 0 5px;">${balken}</div>
      <p class="muted" style="margin:0; font-size:12px;">${wirkung}</p>
    </div>`;
  };

  el.innerHTML = `
    <div style="margin:0 0 6px;">
      <div style="display:flex; justify-content:space-between; font-size:13px;"><span>⭐ Ruf der Akademie</span><b class="num">${Math.round(a.reputation)}</b></div>
      <div class="bar" style="margin:6px 0 4px;"><i style="width:${a.reputation}%;"></i></div>
      <p class="muted" style="margin:0; font-size:12px;">Wächst mit Eigengewächsen bei den Profis, Jugendtiteln und Verkäufen.</p>
    </div>
    ${teil("infra", `${getYouthSquadCapacity(gameState)} Plätze · ${getYouthIntakeCount(gameState)} Vorschläge im Jahrgang · Entwicklung +${Math.round(a.infra * ACADEMY_DEV_PER_INFRA * 100)} %`)}
    ${teil("coaches", `Entwicklung +${Math.round(a.coaches * ACADEMY_DEV_PER_COACH * 100)} % · Einschätzung eigener Talente ±${Math.max(ACADEMY_EST_MIN, ACADEMY_EST_BASE - a.coaches * ACADEMY_EST_PER_COACH) / 2}`)}
    <div class="statGrid" style="margin-top:12px;">
      ${statBox("Jahrgang", `+${bonus.strength.toFixed(1)}`, `Bewertung · Potenzial +${(bonus.strength + bonus.potential).toFixed(1)}`)}
      ${statBox("Kosten", fmtMoney(getAcademyUpkeep(gameState) * spieltage), "pro Saison inkl. Scouts")}
    </div>
    ${a.titles.length ? `<p class="eyebrow" style="margin:12px 0 4px;">Jugendtitel</p>
      ${a.titles.slice(0, 6).map(t => `<p style="margin:2px 0; font-size:13px;">🏆 ${t.label} <span class="muted">${t.season}/${String(t.season + 1).slice(2)}</span></p>`).join("")}` : ""}`;
}

function handleUpgradeAcademy(part){
  const r = upgradeAcademy(gameState, part);
  showToast(r.message, r.success ? "success" : "error");
  if(r.success){ addLogEntry(gameState, r.message); renderAcademyTab(gameState); renderHeader(gameState); }
}

// ---------- Scouts ----------

function renderScoutPanel(gameState){
  const el = document.getElementById("scoutPanel");
  const a = ensureAcademy(gameState);
  const zaehler = document.getElementById("scoutCount");
  if(zaehler) zaehler.textContent = `${a.scouts.length}/${SCOUT_MAX}`;

  const optionen = (obj, wert, text) => Object.keys(obj).map(k =>
    `<option value="${k}"${k === wert ? " selected" : ""}>${text(obj[k], k)}</option>`).join("");

  const eigene = a.scouts.length === 0
    ? `<p class="muted" style="margin:0 0 10px;">Keine Scouts. Ohne Scouts kennst du Spieler nur grob.</p>`
    : a.scouts.map(s => `<div class="offerRow">
        <div class="offerText">
          <b>${getFlag(s)} ${s.name}</b> ${starText(s.quality)}
          <span class="muted" style="font-size:12px;"> · ${fmtMoney(getScoutSalary(gameState, s))}/Saison${s.home ? ` · kennt ${SCOUT_REGIONS[s.home].label}` : ""} · ${s.finds || 0} Funde${s.lastFinds != null ? ` (Vorjahr ${s.lastFinds})` : ""}</span>
          <div class="scoutOrders">
            <select onchange="handleAssignScout('${s.id}', 'region', this.value)" aria-label="Region">
              ${optionen(SCOUT_REGIONS, s.region, (r, k) => `${r.flag} ${r.label}${k === s.home ? " ★" : ""}`)}</select>
            <select onchange="handleAssignScout('${s.id}', 'focus', this.value)" aria-label="Fokus">
              ${optionen(SCOUT_FOCUS, s.focus, f => `${f.icon} ${f.label}`)}</select>
            <select onchange="handleAssignScout('${s.id}', 'line', this.value)" aria-label="Position">
              ${optionen(SCOUT_LINES, s.line, l => l)}</select>
          </div>
        </div>
        <div class="offerButtons"><button class="ghost" onclick="handleFireScout('${s.id}')" title="Abfindung ${fmtMoney(getScoutSeverance(gameState, s))}">Entlassen</button></div>
      </div>`).join("");

  const markt = ensureScoutMarket(gameState);
  const voll = a.scouts.length >= SCOUT_MAX;
  const angebot = markt.length === 0 ? "" : `<p class="eyebrow" style="margin:14px 0 4px;">Verfügbar</p>
    ${markt.map(s => `<div class="offerRow">
      <div class="offerText"><b>${getFlag(s)} ${s.name}</b> ${starText(s.quality)}
        <span class="muted" style="font-size:12px;"> · ${fmtMoney(getScoutSalary(gameState, s))}/Saison${s.home ? ` · kennt ${SCOUT_REGIONS[s.home].label}` : ""}</span></div>
      <div class="offerButtons"><button class="ghost" onclick="handleHireScout('${s.id}')"${voll ? ` disabled title="Höchstens ${SCOUT_MAX} Scouts"` : ""}>Einstellen</button></div>
    </div>`).join("")}`;

  el.innerHTML = eigene + angebot;
}

function afterScoutAction(r){
  showToast(r.message, r.success ? "success" : "error");
  if(r.success) addLogEntry(gameState, r.message);
  renderAcademyTab(gameState);
  renderHeader(gameState);
}
function handleHireScout(id){ afterScoutAction(hireScout(gameState, id)); }
function handleFireScout(id){ afterScoutAction(fireScout(gameState, id)); }
function handleAssignScout(id, feld, wert){
  const r = assignScout(gameState, id, feld, wert);
  if(!r.success) showToast(r.message, "error");
  renderAcademyTab(gameState);
}

// ---------- Talente ----------

function renderProspectPanel(gameState){
  const el = document.getElementById("prospectPanel");
  const a = ensureAcademy(gameState);
  const zaehler = document.getElementById("prospectCount");
  if(zaehler) zaehler.textContent = a.prospects.length ? `${a.prospects.length} Talente` : "";
  if(!a.prospects.length){
    el.innerHTML = `<p class="muted" style="margin:0;">${a.scouts.some(s => s.focus === "talente")
      ? "Noch keine Meldungen. Deine Scouts sind unterwegs."
      : "Schicke einen Scout mit Fokus „Talente“ in eine Region."}</p>`;
    return;
  }
  const plaetze = getYouthSquadCapacity(gameState) - (gameState.youthSquad || []).length;
  const laufend = a.prospects.filter(x => x.trial && !x.trial.done).length;
  el.innerHTML = a.prospects.map(pr => {
    const p = pr.player;
    const e = getPotentialEstimate(gameState, p);
    const empf = getRecommendation(gameState, (e.lo + e.hi) / 2, p.strength);
    const region = SCOUT_REGIONS[pr.region] || { label: "", flag: "" };
    const fee = getProspectFee(gameState, pr);
    const chance = getProspectAcceptChance(gameState, pr);
    const chanceText = chance >= 0.7 ? "gut" : chance >= 0.45 ? "offen" : "gering";
    const probe = pr.trial
      ? (pr.trial.done ? `Probetraining: ${pr.impression || "abgeschlossen"}` : `Probetraining bis Spieltag ${pr.trial.until}`)
      : "";
    const scout = a.scouts.find(s => s.id === pr.scoutId);
    return `<div class="offerRow">
      <div class="offerText">
        <b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b> ${getFlag(p)} <b>${p.name}</b> <span class="muted">(${p.age})</span>${isTalentVisible(gameState, p) ? " ✨" : ""}
        <div style="font-size:12.5px; margin-top:2px;">Stärke ${Math.round(p.strength)} · Potenzial <b>${e.exact ? e.lo : `${e.lo}–${e.hi}`}</b> · ${starText(empf.stars)} <span class="muted">${empf.text}</span></div>
        <div class="muted" style="font-size:12px;">${region.flag} ${pr.club || "vereinslos"}${scout ? ` · ${scout.name}` : ""} · Zusage ${chanceText}${probe ? ` · ${probe}` : ""}</div>
      </div>
      <div class="offerButtons">
        ${pr.trial ? "" : `<button class="ghost" onclick="handleStartTrial('${pr.id}')"${laufend >= TRIAL_MAX || getTrialCost(gameState, pr) > gameState.budget ? " disabled" : ""}>Probetraining · ${fmtMoney(getTrialCost(gameState, pr))}</button>`}
        <button onclick="handleOfferYouthContract('${pr.id}')"${plaetze <= 0 || fee > gameState.budget ? " disabled" : ""} title="${plaetze <= 0 ? "Jugendkader voll" : "Ausbildungsentschädigung"}">Vertrag${fee ? " · " + fmtMoney(fee) : ""}</button>
        <button class="ghost" onclick="handleDropProspect('${pr.id}')" title="Nicht weiter beobachten" aria-label="Verwerfen">✕</button>
      </div>
    </div>`;
  }).join("");
}

function afterProspectAction(r){
  showToast(r.message, r.success ? (r.accepted === false ? "info" : "success") : "error");
  if(r.success) addLogEntry(gameState, r.message, r.accepted === false ? "loss" : null);
  renderAcademyTab(gameState);
  renderHeader(gameState);
}
function handleStartTrial(id){ afterProspectAction(startTrial(gameState, id)); }
function handleOfferYouthContract(id){ afterProspectAction(offerYouthContract(gameState, id)); }
function handleDropProspect(id){ afterProspectAction(dropProspect(gameState, id)); }

// ---------- Marktberichte ----------

function renderReportPanel(gameState){
  const el = document.getElementById("reportPanel");
  const a = ensureAcademy(gameState);
  const berichte = a.reports.filter(r => r.kind === "markt")
    .map(r => ({ r, p: getPoolPlayer(gameState.pool, r.playerId) })).filter(x => x.p);
  if(!berichte.length){
    el.innerHTML = `<p class="muted" style="margin:0;">Keine Berichte. Scouts mit Fokus „Junge Profis“ oder „Alle Profis“ melden Spieler vom Markt.</p>`;
    return;
  }
  const zeilen = berichte.map(({ r, p }) => {
    const e = getPotentialEstimate(gameState, p);
    return { r, p, e, empf: getRecommendation(gameState, (e.lo + e.hi) / 2, p.strength) };
  }).sort((x, y) => y.empf.stars - x.empf.stars || y.e.hi - x.e.hi);
  el.innerHTML = `<div class="tableWrap"><table>
    <tr><th>Pos</th><th>Name</th><th class="hideMobile">Verein</th><th class="n">Bew.</th><th class="n">Pot.</th><th>Empfehlung</th></tr>
    ${zeilen.map(({ p, e, empf }) => `<tr class="rowLink" onclick="showPoolPlayerDetail('${p.id}')">
      <td><b>${p.pos}</b></td>
      <td>${getFlag(p)} ${p.name} <span class="muted">${p.age}</span></td>
      <td class="hideMobile" style="font-size:12px;">${p.clubName || "vereinslos"}</td>
      <td class="n">${Math.round(p.strength)}</td>
      <td class="n" style="font-size:12px;">${e.exact ? e.lo : `${e.lo}–${e.hi}`}</td>
      <td title="${empf.text}">${starText(empf.stars)}</td></tr>`).join("")}
  </table></div>`;
}

// ---------- Chronik ----------

function renderAcademyLog(gameState){
  const el = document.getElementById("academyLogPanel");
  const a = ensureAcademy(gameState);
  el.innerHTML = a.log.length === 0
    ? `<p class="muted" style="margin:0;">Noch keine Einträge.</p>`
    : a.log.slice(0, 14).map(l => `<p style="margin:0 0 6px;">${l.icon} ${l.text} <span class="muted" style="font-size:11px;">${l.season}/${String(l.season + 1).slice(2)}</span></p>`).join("");
}

// ---------- Jugendwettbewerbe (Teil der Jugendmannschaft) ----------

function renderYouthCompetitionBlock(gameState){
  const l = gameState.youthLeague;
  const c = gameState.youthCup;
  let html = "";
  if(l){
    const tabelle = getYouthLeagueTable(l);
    const platz = tabelle.findIndex(t => t.name === gameState.clubName);
    // Spitze und die eigene Umgebung.
    const zeigen = new Set([0, 1, 2, 3, platz - 1, platz, platz + 1].filter(i => i >= 0 && i < tabelle.length));
    html += `<div class="tableWrap" style="margin-bottom:10px;"><table>
      <tr><th class="n">#</th><th>${l.name}</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>
      ${tabelle.map((t, i) => zeigen.has(i) ? `<tr${t.name === gameState.clubName ? ' class="me"' : ""}>
        <td class="n">${i + 1}</td><td>${t.name}</td><td class="n">${t.played}</td>
        <td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>` : "").join("")}
    </table></div>`;
  }
  if(c){
    const eigeneSpiele = c.results.filter(r => r.a === gameState.clubName || r.b === gameState.clubName);
    const raus = eigeneSpiele.some(r => r.winner !== gameState.clubName);
    const status = c.winner ? (c.winner === gameState.clubName ? "🏆 Sieger" : `Sieger: ${c.winner}`)
      : raus ? `ausgeschieden (${YOUTH_CUP_ROUNDS[eigeneSpiele[eigeneSpiele.length - 1].round]})`
      : `nächste Runde: ${YOUTH_CUP_ROUNDS[c.round]} (Spieltag ${c.matchdays[c.round]})`;
    html += `<p style="margin:0 0 12px; font-size:13px;">🌟 <b>${c.name}</b> · ${status}</p>`;
  }
  return html;
}

// ---------- Mentor im Spielerprofil ----------

function renderMentorBlock(gameState, player){
  if(!player || player.age > DEV_RISK_MAX_AGE) return "";
  const aktuell = getMentor(gameState, player);
  const kandidaten = getMentorCandidates(gameState, player).slice(0, 8);
  if(!aktuell && !kandidaten.length) return `<p class="muted" style="margin:-8px 0 16px; font-size:12px;">🤝 Kein passender Mentor im Kader (ab ${MENTOR_MIN_AGE} Jahre, deutlich stärker, gleicher Mannschaftsteil).</p>`;
  const liste = (aktuell && !kandidaten.some(m => m.id === aktuell.id) ? [aktuell] : []).concat(kandidaten);
  return `<div style="margin:-6px 0 16px; display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:13px;">
    <span>🤝 Mentor</span>
    <select onchange="handleAssignMentor('${player.id}', this.value)" aria-label="Mentor">
      <option value="">kein Mentor</option>
      ${liste.map(m => `<option value="${m.id}"${aktuell && aktuell.id === m.id ? " selected" : ""}>${m.name} · ${m.pos} ${Math.round(m.strength)} · ${m.age} J.${hasTrait(m, "fuehrung") ? " 🎖️" : ""}</option>`).join("")}
    </select>
    <span class="muted" style="font-size:12px;">schnellere Entwicklung, eher ein Durchbruch</span>
  </div>`;
}

function handleAssignMentor(menteeId, mentorId){
  const r = assignMentor(gameState, menteeId, mentorId || null);
  showToast(r.message, r.success ? "success" : "error");
  if(r.success) addLogEntry(gameState, r.message);
  showPlayerDetail(menteeId);
  renderAcademyTab(gameState);
}
