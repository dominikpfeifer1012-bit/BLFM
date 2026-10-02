// ============================================
// UI-SQUAD.JS - Kader: Tabelle, Filter, Spielfeld, Aufstellung, Spielerprofil
// ============================================
// Teil der aufgeteilten Oberflaeche. Alle Funktionen bleiben global,
// damit die Ladereihenfolge unkritisch bleibt.

let squadSortState = { key: "pos", dir: "asc" };

let squadFilterState = { pos: "ALL", search: "" };

function handleSquadFilterChange(){
  const posEl = document.getElementById("squadFilterPos");
  const searchEl = document.getElementById("squadFilterSearch");
  squadFilterState.pos = posEl ? posEl.value : "ALL";
  squadFilterState.search = searchEl ? searchEl.value.trim().toLowerCase() : "";
  renderSquad(gameState);
}

function filterSquad(squad){
  return squad.filter(p => {
    if(squadFilterState.pos !== "ALL" && p.pos !== squadFilterState.pos) return false;
    if(squadFilterState.search && !p.name.toLowerCase().includes(squadFilterState.search)) return false;
    return true;
  });
}

function sortSquadForDisplay(squad){
  const arr = filterSquad(squad);
  const { key, dir } = squadSortState;
  const mult = dir === "asc" ? 1 : -1;
  arr.sort((a, b) => {
    let cmp = 0;
    if(key === "pos"){
      cmp = POSITION_ORDER.indexOf(a.pos) - POSITION_ORDER.indexOf(b.pos);
      if(cmp === 0) cmp = b.strength - a.strength;
      return cmp;
    } else if(key === "name"){
      cmp = a.name.localeCompare(b.name);
    } else if(key === "strength"){
      cmp = a.strength - b.strength;
    } else if(key === "age"){
      cmp = a.age - b.age;
    } else if(key === "value"){
      cmp = a.value - b.value;
    } else if(key === "salary"){
      cmp = getPlayerSalary(a) - getPlayerSalary(b);
    } else if(key === "contract"){
      cmp = getContractYears(a) - getContractYears(b);
    } else if(key === "goals"){
      cmp = (a.goalsSeason || 0) - (b.goalsSeason || 0);
    }
    return cmp * mult;
  });
  return arr;
}

function sortArrow(key){
  if(squadSortState.key !== key) return "";
  return squadSortState.dir === "asc" ? " ▲" : " ▼";
}

function handleSquadSort(key){
  if(squadSortState.key === key){
    squadSortState.dir = squadSortState.dir === "asc" ? "desc" : "asc";
  } else {
    squadSortState.key = key;
    squadSortState.dir = (key === "pos" || key === "name") ? "asc" : "desc";
  }
  renderSquad(gameState);
}

function renderSquad(gameState){
  const kapitaenId = (getCaptain(gameState) || {}).id;
  const currentDay = gameState.matchday + 1;
  const sortedSquad = sortSquadForDisplay(gameState.squad);
  const info = getStartingXIInfo(gameState.squad, currentDay);
  const startingIds = new Set(info.xi.map(p => p.id));
  const emergencyMap = info.emergencyPenalties;
  const roles = classifySquad(gameState.squad, currentDay, info).roles;

  let html = `<tr>
    <th class="sortable" onclick="handleSquadSort('pos')">Pos${sortArrow('pos')}</th>
    <th class="sortable" onclick="handleSquadSort('name')">Name${sortArrow('name')}</th>
    <th class="sortable" onclick="handleSquadSort('strength')">Bew.${sortArrow('strength')}</th>
    <th class="sortable" onclick="handleSquadSort('age')">Alter${sortArrow('age')}</th>
    <th class="sortable hideMobile" onclick="handleSquadSort('goals')">Tore${sortArrow('goals')}</th>
    <th class="sortable hideMobile" onclick="handleSquadSort('value')">Marktwert${sortArrow('value')}</th>
    <th class="sortable hideMobile" onclick="handleSquadSort('salary')">Gehalt${sortArrow('salary')}</th>
    <th class="sortable hideMobile" onclick="handleSquadSort('contract')">Vertrag${sortArrow('contract')}</th>
    <th>Status</th>
  </tr>`;

  if(sortedSquad.length === 0){
    html += `<tr><td colspan="9" style="text-align:center; color:#a8b3c7;">Keine Spieler passen zum aktuellen Filter.</td></tr>`;
  }

  sortedSquad.forEach(p => {
    let statusBadge, rowClass;
    if(isInjured(p, currentDay)){
      statusBadge = `<span class="badge loss">Verletzt (bis ST ${p.injuredUntilMatchday})</span>`;
      rowClass = "";
    } else if(isSuspended(p, currentDay)){
      statusBadge = `<span class="tag suspended">Gesperrt (bis ST ${p.suspendedUntilMatchday})</span>`;
      rowClass = "";
    } else if(startingIds.has(p.id)){
      statusBadge = '<span class="badge win">Startelf</span>';
      rowClass = "highlight";
    } else if(roles.get(p.id) === "bench"){
      statusBadge = '<span class="badge draw">Bank</span>';
      rowClass = "";
    } else {
      statusBadge = '<span class="badge reserve" title="Zählt nicht zur Teambewertung, kostet aber Gehalt">Reserve</span>';
      rowClass = "dim";
    }

    // Zusatzinfos nur als Symbol mit Tooltip: sonst waechst die Zeile
    // auf zwei Zeilen und die Tabelle wird unruhig.
    if(info.manualIds && info.manualIds.has(p.id) && !emergencyMap.has(p.id)){
      statusBadge += '<span class="tagIcon manual" title="Von dir aufgestellt">📌</span>';
    }

    if(emergencyMap.has(p.id)){
      const em = emergencyMap.get(p.id);
      const why = em.isManual
        ? `Von dir umgestellt: ${p.pos} spielt als ${em.playedAs} (-${em.penalty})`
        : `Notlösung: ${p.pos} spielt als ${em.playedAs} (-${em.penalty})`;
      statusBadge += `<span class="tagIcon emergency" title="${why}">${em.isManual ? "📌" : "⚠"}${em.penalty}</span>`;
    }

    const fatigue = getFatiguePenalty(p);
    if(fatigue > 0){
      statusBadge += `<span class="tagIcon" title="Ermüdung -${fatigue.toFixed(1)} · ${p.consecutiveStarts} Spiele in Folge">🥵</span>`;
    }

    const stimmung = getMoraleLabel(p);
    const moralWert = getMoraleStrengthEffect(p);
    statusBadge += `<span class="tagIcon" title="${stimmung.text} (${Math.round(getMorale(p))})${
      Math.abs(moralWert) >= 0.1 ? ` · ${moralWert > 0 ? "+" : ""}${moralWert.toFixed(1)} auf die Leistung` : ""
    }">${stimmung.icon}</span>`;

    const diff = p.strength - p.baseStrength;
    let trend = "";
    if(diff > 0.3) trend = ' <span style="color:#2a9d8f;">▲</span>';
    else if(diff < -0.3) trend = ' <span style="color:#e63946;">▼</span>';

    const icon = POSITION_ICONS[p.pos] || "";
    const youthTag = (p.isYouthProduct ? ' <span title="Eigengewächs aus der Jugend">🌱</span>' : "")
      + (p.id === kapitaenId ? ' <span class="badge" style="background:var(--gold); color:#10202C;" title="Kapitän">C</span>' : "");
    const flag = getFlag(p) ? `<span title="${getNationality(p).name}">${getFlag(p)}</span> ` : "";
    const ageStyle = p.age >= RETIREMENT_MIN_AGE ? ' style="color:#fca311;" title="Karriereende möglich"' : "";
    html += `<tr class="rowLink ${rowClass}" onclick="showPlayerDetail('${p.id}')"><td><b><span class="posIcon">${icon} </span>${p.pos}</b></td><td>${flag}${p.name}${youthTag}</td><td class="n">${Math.round(p.strength)}${trend}</td><td class="n"${ageStyle}>${p.age}</td><td class="n hideMobile">${p.goalsSeason || 0}</td><td class="n hideMobile">${fmtMoney(p.value)}</td><td class="n hideMobile">${fmtMoney(getPlayerSalary(p))}</td><td class="n hideMobile"${isContractExpiring(p) ? ' style="color:#FCA311;" title="Vertrag läuft aus"' : ""}>${getContractYears(p)} J.</td><td class="status">${statusBadge}</td></tr>`;
  });

  document.getElementById("squadTable").innerHTML = html;
  document.getElementById("squadCount").textContent = gameState.squad.length;
  const budgetEl = document.getElementById("budgetLine");
  budgetEl.textContent = fmtMoney(gameState.budget);
  budgetEl.style.color = gameState.budget < 0 ? "#e63946" : "";

  const salaryEl = document.getElementById("salaryLine");
  if(salaryEl){
    const perSeason = getSquadSalaryTotal(gameState.squad);
    const jugendGehalt = typeof getYouthSquadSalary === "function" ? getYouthSquadSalary(gameState) : 0;
    salaryEl.innerHTML = `Gehaltslast: <b>${fmtMoney(getMatchdaySalaryCost(gameState.squad, gameState.youthSquad))}</b> pro Spieltag · ${fmtMoney(perSeason + jugendGehalt)} pro Saison`
      + (jugendGehalt > 0 ? ` (davon ${fmtMoney(jugendGehalt)} Jugend)` : "");
  }

  const breakdown = getTeamRatingBreakdown(gameState.squad, currentDay);
  document.getElementById("teamRatingLine").textContent = breakdown.rating;
  const breakdownEl = document.getElementById("ratingBreakdownLine");
  if(breakdownEl){
    let text = `Startelf ${Math.round(breakdown.xiAvg)} · Bank ${Math.round(breakdown.benchAvg)}`;
    const moved = breakdown.emergencyDetails.filter(d => d.isManual).length;
    const forced = breakdown.emergencyDetails.length - moved;
    if(moved > 0) text += ` · ${moved} ${moved === 1 ? "Umstellung" : "Umstellungen"}`;
    if(forced > 0) text += ` · ${forced} ${forced === 1 ? "Notlösung" : "Notlösungen"}`;
    breakdownEl.textContent = text;
  }

  renderLineupControls(gameState, info);
  renderPitch(info);
  renderTopScorers(gameState);
  renderSquadStats(gameState);
}

function renderPitch(info){
  const container = document.getElementById("pitchView");
  if(!container) return;

  const slotsByPos = {};
  (info.allSlots || info.slots).forEach(s => {
    if(!slotsByPos[s.slotPos]) slotsByPos[s.slotPos] = [];
    slotsByPos[s.slotPos].push(s);
  });

  let html = "";
  getActiveFormation().rows.forEach(row => {
    const inRow = row.flatMap(pos => slotsByPos[pos] || []);
    if(inRow.length === 0) return;
    html += `<div class="pitchRow">${inRow.map(buildPitchSlot).join("")}</div>`;
  });

  container.innerHTML = html;
}

function buildPitchSlot(slot){
  const click = `onclick="openLineupPicker('${slot.slotKey}')"`;

  if(!slot.player){
    return `<div class="pitchSlot empty" ${click} title="Kein Spieler verfügbar – klicken zum Besetzen">
      <span class="slotPos">${slot.slotPos}</span>
      <span class="slotName">${POSITION_ICONS[slot.slotPos] || ""} frei</span>
      <span class="slotRating">besetzen</span>
    </div>`;
  }

  const p = slot.player;
  let cls = "";
  if(slot.isEmergency) cls = " emergency";
  else if(slot.isManual) cls = " manual";

  const ratingShown = Math.max(30, p.strength - (slot.penalty || 0) - getFatiguePenalty(p));
  const icon = POSITION_ICONS[p.pos] || "";
  const goalsTag = p.goalsSeason > 0 ? ` ⚽${p.goalsSeason}` : "";
  const pin = slot.isManual ? " 📌" : "";

  let title;
  if(slot.penalty > 0){
    title = `${slot.isManual ? "Manuell umgestellt" : "Notlösung"}: ${p.pos} spielt als ${slot.slotPos} (-${slot.penalty})`;
  } else {
    title = `${slot.slotPos} · ${slot.isManual ? "manuell gesetzt" : "automatisch gewählt"}`;
  }

  return `<div class="pitchSlot${cls}" ${click} title="${title}">
    <span class="slotPos">${slot.slotPos}${pin}</span>
    <span class="slotName">${icon} ${p.name}${goalsTag}</span>
    <span class="slotRating">${Math.round(ratingShown)}</span>
  </div>`;
}

function renderLineupControls(gameState, info){
  const el = document.getElementById("lineupControls");
  if(!el) return;

  const manualCount = countManualSlots(gameState);
  const status = manualCount === 0
    ? "Aufstellung: <b>automatisch</b>"
    : `<b>${manualCount} von 11</b> manuell gesetzt 📌`;

  const dropped = info.droppedManual || [];
  const warn = dropped.length > 0
    ? `<span style="color:#FCA311;"> · ⚠️ ${dropped.map(d => d.name).join(", ")} nicht einsatzbereit</span>`
    : "";

  const formOptions = Object.keys(FORMATIONS).map(name =>
    `<option value="${name}"${name === getActiveFormationName() ? " selected" : ""}>${name}</option>`).join("");
  const tacticOptions = Object.entries(TACTICS).map(([key, t]) =>
    `<option value="${key}"${key === (gameState.tactic || DEFAULT_TACTIC) ? " selected" : ""}>${t.label}</option>`).join("");
  const trainingOptions = Object.entries(TRAINING_FOCUS).map(([key, t]) =>
    `<option value="${key}"${key === (gameState.training || DEFAULT_TRAINING) ? " selected" : ""}>${t.label}</option>`).join("");
  const training = TRAINING_FOCUS[gameState.training] || TRAINING_FOCUS[DEFAULT_TRAINING];

  el.innerHTML = `
    <div class="filterBar">
      <label>Formation
        <select onchange="handleFormationChange(this.value)">${formOptions}</select>
      </label>
      <label>Ausrichtung
        <select onchange="handleTacticChange(this.value)">${tacticOptions}</select>
      </label>
      <label>Training
        <select onchange="handleTrainingChange(this.value)">${trainingOptions}</select>
      </label>
      <button class="ghost" onclick="resetLineup()"${manualCount === 0 ? " disabled" : ""}>Alles automatisch</button>
      <button class="ghost${gameState.autoRotate ? " on" : ""}" onclick="toggleAutoRotate()" title="Ab ${ROTATION_START_LIMIT} Spielen in Folge, Ersatz max. ${ROTATION_MAX_GAP} schwächer">🔄 Rotation: ${gameState.autoRotate ? "an" : "aus"}</button>
    </div>
    <p class="muted" style="margin:0 0 10px;">${status}${warn}</p>
    ${trainingEffects(training)}`;
}

// Trainingswirkung als knappe Zahlenzeile.
function trainingEffects(t){
  const teile = [];
  const z = v => (v > 0 ? "+" : "−") + String(Math.abs(v)).replace(".", ",");
  if(t.match && (t.match.att || t.match.def)) teile.push(`Angriff ${z(t.match.att)}`, `Abwehr ${z(t.match.def)}`);
  if(t.injury !== 1) teile.push(`<span style="color:${t.injury > 1 ? "var(--loss)" : "var(--win)"};">Verletzungen ${t.injury > 1 ? "+" : "−"}${Math.round(Math.abs(t.injury - 1) * 100)} %</span>`);
  if(t.fatigue !== 1) teile.push(`Ermüdung −${Math.round((1 - t.fatigue) * 100)} %`);
  if(t.desc) teile.unshift(t.desc);
  return teile.length ? `<p class="muted" style="margin:0 0 10px; font-size:12px;">Training ${t.label}: ${teile.join(" · ")}</p>` : "";
}

function openLineupPicker(slotKey){
  const currentDay = gameState.matchday + 1;
  const info = getStartingXIInfo(gameState.squad, currentDay);
  const slot = info.allSlots.find(s => s.slotKey === slotKey);
  if(!slot) return;

  const slotPos = slot.slotPos;
  const occupiedBy = new Map();
  info.allSlots.forEach(s => {
    if(s.player) occupiedBy.set(s.player.id, s);
  });

  // Sortiert direkt nach dem Wert auf diesem Platz — der Positionsmalus
  // steckt darin schon drin.
  const candidates = [...gameState.squad].sort((a, b) => {
    const outA = isUnavailable(a, currentDay) ? 1 : 0;
    const outB = isUnavailable(b, currentDay) ? 1 : 0;
    if(outA !== outB) return outA - outB;
    return getStrengthOnSlot(b, slotPos) - getStrengthOnSlot(a, slotPos);
  });

  const isManualHere = !!getActiveLineup()[slotKey];

  let html = `<h3>${POSITION_ICONS[slotPos] || ""} ${slotPos} besetzen</h3>
    <p class="breakdownLine">Der Wert rechts gilt für diesen Platz — Positionsmalus und Ermüdung sind schon abgezogen.</p>
    <div class="lineupOption auto" onclick="clearLineupSlot('${slotKey}')">
      <span>🔄 Automatisch wählen${isManualHere ? "" : " (aktiv)"}</span>
      <span class="lineupValue">stärkster ${slotPos}</span>
    </div>
    <div class="lineupList">`;

  candidates.forEach(p => {
    const out = isUnavailable(p, currentDay);
    const penalty = getPlayerSlotPenalty(p, slotPos);
    const here = occupiedBy.get(p.id);
    const icon = POSITION_ICONS[p.pos] || "";

    let note = "";
    if(out){
      note = isInjured(p, currentDay)
        ? `<span class="badge loss">Verletzt bis ST ${p.injuredUntilMatchday}</span>`
        : `<span class="tag suspended">Gesperrt bis ST ${p.suspendedUntilMatchday}</span>`;
    } else {
      if(penalty > 0) note += `<span class="tag emergency">${p.pos} → ${slotPos} · -${penalty.toFixed(1)}</span>`;
      if(here && here.slotKey !== slotKey) note += ` <span class="tag fatigue">steht auf ${here.slotPos}</span>`;
      if(here && here.slotKey === slotKey) note += ` <span class="badge win">aktuell hier</span>`;
    }

    const click = out ? "" : ` onclick="assignLineupPlayer('${slotKey}','${p.id}')"`;
    html += `<div class="lineupOption${out ? " disabled" : ""}"${click}>
      <span>${icon} <b>${p.name}</b> <span class="breakdownLine">${p.pos}, ${p.age} J.</span><br>${note}</span>
      <span class="lineupValue">${out ? "–" : Math.round(getStrengthOnSlot(p, slotPos))}</span>
    </div>`;
  });

  html += `</div>`;

  document.getElementById("lineupModalContent").innerHTML = html;
  document.getElementById("lineupModalOverlay").classList.add("show");
}

function closeLineupModal(){
  document.getElementById("lineupModalOverlay").classList.remove("show");
}

function assignLineupPlayer(slotKey, playerId){
  setLineupSlot(gameState, slotKey, playerId);
  closeLineupModal();
  refreshLineupViews();
}

function clearLineupSlot(slotKey){
  setLineupSlot(gameState, slotKey, null);
  closeLineupModal();
  refreshLineupViews();
}

function resetLineup(){
  clearLineup(gameState);
  refreshLineupViews();
  showToast("Aufstellung wieder auf automatisch gestellt.", "info");
}

// Jede Kaderaenderung wirkt sich auf Teambewertung, Budget, Gehaltslast und
// Gegner-Vorschau aus. Ohne diesen Sammelaufruf standen die Kennzahlen oben
// bis zum naechsten Spieltag still.

// Jede Kaderaenderung wirkt sich auf Teambewertung, Budget, Gehaltslast und
// Gegner-Vorschau aus. Ohne diesen Sammelaufruf standen die Kennzahlen oben
// bis zum naechsten Spieltag still.
function refreshSquadViews(){
  renderHeader(gameState);
  renderContractPanel(gameState);
  renderOpponentPreview(gameState);
  renderNextMatch(gameState);
  renderSquad(gameState);
  renderSquadAnalysis(gameState);
  renderNationBreakdown(gameState);
}

function refreshLineupViews(){
  refreshSquadViews();
}

function showPlayerDetail(playerId){
  let player = gameState.squad.find(p => p.id === playerId);
  // Auch Spieler aus dem Jugendkader haben ein Profil.
  const ausJugend = !player;
  if(!player) player = (gameState.youthSquad || []).find(p => p.id === playerId);
  if(!player) return;

  const currentDay = gameState.matchday + 1;
  const info = getStartingXIInfo(gameState.squad, currentDay);
  const emergencyInfo = info.emergencyPenalties.get(player.id);
  const injured = isInjured(player, currentDay);
  const suspended = isSuspended(player, currentDay);
  const nat = getNationality(player);

  let statusLine, statusClass;
  if(injured){ statusLine = `Verletzt bis Spieltag ${player.injuredUntilMatchday}`; statusClass = "loss"; }
  else if(suspended){ statusLine = `Gesperrt bis Spieltag ${player.suspendedUntilMatchday}`; statusClass = "loss"; }
  else if(getStartingXIIds(gameState.squad, currentDay).has(player.id)){ statusLine = "Startelf"; statusClass = "win"; }
  else { statusLine = "Bank"; statusClass = "draw"; }

  if(emergencyInfo){
    statusLine += ` · ${emergencyInfo.isManual ? "umgestellt" : "Notlösung"} als ${emergencyInfo.playedAs} (-${emergencyInfo.penalty})`;
  }

  // Entwicklungsbalken: Startwert, aktueller Stand, Potenzialgrenze auf einer Achse
  const lo = 30, hi = 99;
  const pct = v => Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100));
  const fatigue = getFatiguePenalty(player);

  // Verkauf im Profil nur, wenn Fenster offen und Kader gross genug ist.
  const sellWindow = checkTransferWindow(gameState);
  let sellBlock = null;
  if(ausJugend) sellBlock = null;
  else if(!sellWindow.open) sellBlock = sellWindow.message;
  else if(!canSellFromSquad(gameState.squad)) sellBlock = `Kader zu klein zum Verkaufen (Minimum ${MIN_SQUAD_SIZE} Spieler).`;

  const tags = [];
  if(player.isYouthProduct) tags.push('<span class="profTag gold">🌱 Eigengewächs</span>');
  if(player.isTalent) tags.push('<span class="profTag gold">✨ Ausnahmetalent</span>');
  if(player.isScoutingFind) tags.push('<span class="profTag gold">🔍 Scouting-Fund</span>');
  if(fatigue > 0) tags.push(`<span class="profTag warn">🥵 Müde -${fatigue.toFixed(1)}</span>`);
  if(player.age >= RETIREMENT_MIN_AGE) tags.push('<span class="profTag warn">Karriereende möglich</span>');
  if(isContractExpiring(player)) tags.push('<span class="profTag warn">📝 Vertrag läuft aus</span>');
  if(getMorale(player) < MORALE_UNHAPPY_THRESHOLD){
    tags.push(`<span class="profTag warn">${getMoraleLabel(player).icon} ${getMoraleLabel(player).text}</span>`);
  }

  const stat = (k, v, sub) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${sub ? `<div class="sub">${sub}</div>` : ""}</div>`;

  document.getElementById("playerModalContent").innerHTML = `
    <div class="profHead">
      <span class="profFlag">${getFlag(player) || POSITION_ICONS[player.pos] || "⚽"}</span>
      <div class="profName">
        <h3>${player.name}</h3>
        <p class="muted" style="margin:0;">${POSITION_ICONS[player.pos] || ""} ${player.pos} · ${player.age} Jahre${nat ? ` · ${nat.name}` : ""}</p>
      </div>
      <div class="profRating"><div class="v">${Math.round(player.strength)}</div><div class="k">Bewertung</div></div>
    </div>

    <p class="eyebrow">Attribute</p>
    <div style="margin:6px 0 16px;">
      ${ATTRIBUTES.map(a => {
        const wert = player.attributes ? player.attributes[a] : 0;
        const cap = player.maxAttributes ? player.maxAttributes[a] : wert;
        const gewicht = (POSITION_WEIGHTS[player.pos] || {})[a] || 0;
        const wichtig = gewicht >= 0.30;
        return `<div style="display:flex; align-items:center; gap:9px; margin-bottom:6px;">
          <span style="width:15px;">${ATTRIBUTE_ICONS[a]}</span>
          <span style="flex:0 0 74px; font-size:12px; color:${wichtig ? "var(--gold)" : "var(--ink-dim)"};">${ATTRIBUTE_LABELS[a]}</span>
          <span class="bar" style="flex:1;">
            <i class="ghost" style="width:${cap}%;"></i>
            <i style="width:${wert}%; position:relative;"></i>
          </span>
          <span class="num" style="width:52px; text-align:right; font-size:12px;">${Math.round(wert)}<span style="color:var(--ink-faint);">/${Math.round(cap)}</span></span>
        </div>`;
      }).join("")}
    </div>

    <p class="eyebrow">Entwicklung</p>
    <div class="bar" style="margin:6px 0 4px;">
      <i class="ghost" style="width:${pct(player.maxStrength)}%;"></i>
      <i style="width:${pct(player.strength)}%; position:relative;"></i>
    </div>
    <p class="muted" style="margin:0 0 16px;">
      Start <span class="num">${Math.round(player.baseStrength)}</span> ·
      jetzt <span class="num">${Math.round(player.strength)}</span> ·
      Potenzial <span class="num">${Math.round(player.maxStrength)}</span>
    </p>

    <div class="statGrid">
      ${stat("Marktwert", fmtMoney(player.value))}
      ${stat("Gehalt", fmtMoney(getPlayerSalary(player)), player.salaryFactor > 1.01 ? `pro Saison · ${Math.round((player.salaryFactor - 1) * 100)} % ausgehandelt` : "pro Saison")}
      ${stat("Tore", player.goalsSeason || 0, "diese Saison")}
      ${stat("Notenschnitt", fmtGrade(getAverageGrade(player)), player.gradeCount ? `${player.gradeCount} Spiele${player.motmCount ? ` · ${player.motmCount}× bester Spieler` : ""}` : "")}
      ${stat("Gelbe Karten", player.yellowCards || 0)}
      ${stat("In Folge", player.consecutiveStarts || 0, "in der Startelf")}
      ${stat("Vertrag", `${getContractYears(player)} J.`, isContractExpiring(player) ? "läuft aus" : "Restlaufzeit")}
      ${stat("Stimmung", `${getMoraleLabel(player).icon} ${Math.round(getMorale(player))}`,
        (() => { const e = getMoraleStrengthEffect(player);
          return Math.abs(e) >= 0.1 ? `${e > 0 ? "+" : "−"}${Math.abs(e).toFixed(1).replace(".", ",")} Stärke` : ""; })())}
    </div>

    ${ausJugend ? `
      <div style="margin-top:12px;">
        <button onclick="handlePromoteYouth('${player.id}')">⬆ In den Profikader</button>
        ${isReadyForPromotion(gameState, player) ? "" : `<p class="muted" style="margin:8px 0 0; font-size:12px;">Noch nicht auf Profiniveau.</p>`}
      </div>` : `
    <div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">
      ${player.id !== (getCaptain(gameState) || {}).id ? `<button class="ghost" onclick="handleSetCaptain('${player.id}')">©️ Zum Kapitän</button>` : `<span class="badge" style="background:var(--gold); color:#10202C; align-self:center;">Kapitän</span>`}
      <button class="ghost" id="profileSellBtn" onclick="handleProfileSell('${player.id}')"${sellBlock ? " disabled" : ""}
        title="${sellBlock || ""}">
        Verkaufen · ${fmtMoney(calculateSellValue(player.value))}
      </button>
      ${player.age <= YOUTH_SQUAD_MAX_AGE
        ? `<button class="ghost" onclick="handleDemoteToYouth('${player.id}')">⬇ In die Jugend</button>` : ""}
      ${player.age <= LOAN_MAX_AGE
        ? `<button class="ghost" onclick="handleLoanOut('${player.id}')"${canLoanOut(gameState, player) ? ` disabled title="${canLoanOut(gameState, player)}"` : ""}>🔁 Verleihen</button>` : ""}
    </div>
    ${sellBlock ? `<p class="muted" style="margin:8px 0 0;">${sellBlock}</p>` : ""}
    ${renderRenewalBlock(player)}`}

    <p style="margin:16px 0 0;"><span class="badge ${statusClass}">${statusLine}</span></p>
    ${tags.length ? `<div class="profTags">${tags.join("")}</div>` : ""}
  `;
  document.getElementById("playerModalOverlay").classList.add("show");
}

function closePlayerModal(){
  document.getElementById("playerModalOverlay").classList.remove("show");
}

// Verkauf aus dem Spielerprofil: erst bestaetigen, dann ausfuehren.
function handleProfileSell(playerId){
  const btn = document.getElementById("profileSellBtn");
  const index = gameState.squad.findIndex(p => p.id === playerId);
  if(index === -1) return;

  if(btn && btn.dataset.confirm !== "1"){
    btn.dataset.confirm = "1";
    btn.textContent = "Wirklich verkaufen? ✔";
    btn.style.background = "var(--loss)";
    btn.style.color = "#fff";
    return;
  }

  const result = sellPlayerToPool(gameState, index);
  showToast(result.message, result.success ? "success" : "error");
  if(result.success){
    addLogEntry(gameState, result.message);
    closePlayerModal();
    renderMarket(gameState);
    refreshSquadViews();
  }
}

// Die zwei staerksten Attribute als kurze Marken — im Markt schneller lesbar
// als vier Zahlen.

function renderSquadStats(gameState){
  const el = document.getElementById("squadStats");
  if(!el) return;
  const squad = gameState.squad;
  const breakdown = getTeamRatingBreakdown(squad, gameState.matchday + 1);
  const sides = getTeamAttackDefence(squad, gameState.matchday + 1);
  const negBudget = gameState.budget < 0;

  el.innerHTML =
    statBox("Teambewertung", breakdown.rating, null, true) +
    statBox("Angriff", Math.round(sides.attack)) +
    statBox("Abwehr", Math.round(sides.defence)) +
    statBox("Budget", fmtMoney(gameState.budget), negBudget ? "im Minus" : "verfügbar") +
    statBox("Gehalt", fmtMoney(getMatchdaySalaryCost(squad, gameState.youthSquad)), "pro Spieltag") +
    statBox("Kaderwert", fmtMoney(squad.reduce((s, p) => s + p.value, 0)), `${squad.length} Spieler`) +
    (() => {
      const schnitt = getSquadMoraleAverage(squad);
      const unzufrieden = getUnhappyPlayers(gameState).length;
      return statBox("Stimmung", Math.round(schnitt),
        unzufrieden > 0 ? `${unzufrieden} wollen weg` : "keine Wechselwünsche");
    })() +
    (() => {
      const c = classifySquad(squad, gameState.matchday + 1);
      const out = squad.length - c.xi.length - c.bench.length - c.reserve.length;
      return statBox("Spieltagskader", `${c.xi.length}+${c.bench.length}`,
        `${c.reserve.length} Reserve${out > 0 ? ` · ${out} nicht einsatzbereit` : ""}`);
    })();
}

function renderYouthPanel(gameState){
  const el = document.getElementById("youthPanel");
  if(!el) return;
  const youth = gameState.youth;
  if(!youth){ el.innerHTML = ""; return; }

  const day = gameState.matchday + 1;
  const lineup = getYouthLineup(gameState, day);
  const kandidaten = getYouthPromotionCandidates(gameState);

  if(lineup.length < YOUTH_TEAM_MIN_PLAYERS){
    el.innerHTML = `<p class="muted">Spielbetrieb ruht · mindestens ${YOUTH_TEAM_MIN_PLAYERS} Spieler nötig.</p>`;
    return;
  }

  const bilanz = youth.played > 0
    ? `${youth.won}-${youth.drawn}-${youth.lost} · ${youth.gf}:${youth.ga} Tore`
    : "–";

  const letztes = youth.lastResult
    ? `<p class="muted" style="margin:0 0 12px;">Letztes Spiel: <b>${youth.lastResult.ownGoals}:${youth.lastResult.oppGoals}</b>
       <span class="badge ${youth.lastResult.result}">${LOG_BADGE_LABELS[youth.lastResult.result]}</span></p>`
    : "";

  let html = `
    <div class="statGrid" style="margin-bottom:12px;">
      ${statBox("Spiele", youth.played, bilanz)}
      ${statBox("Im Kader", lineup.length, `Ø ${getYouthTeamStrength(lineup).toFixed(1)}`)}
    </div>
    ${letztes}`;

  if(kandidaten.length > 0){
    html += `<p style="margin:0 0 10px; color:var(--gold); font-size:13px;">
      Profireif: ${kandidaten.slice(0, 3).map(p => `<b>${p.name}</b> (${p.pos} ${Math.round(p.strength)})`).join(", ")}</p>`;
  }

  html += `<div class="tableWrap"><table>
    <tr><th>Pos</th><th>Name</th><th class="n">Bew.</th><th class="n">Pot.</th><th class="n">Alter</th><th class="n">Tore</th></tr>`;
  lineup.forEach(p => {
    const rest = Math.max(0, Math.round(p.maxStrength - p.strength));
    const tore = youth.scorers[p.id] || 0;
    const jung = p.age <= YOUTH_TEAM_MAX_AGE;
    html += `<tr class="rowLink${jung ? "" : " dim"}" onclick="showPlayerDetail('${p.id}')">
      <td><b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b></td>
      <td>${getFlag(p)} ${p.name}${p.isYouthProduct ? " 🌱" : ""}</td>
      <td class="n">${Math.round(p.strength)}</td>
      <td class="n" style="color:${rest > 8 ? "var(--win)" : "var(--ink-faint)"};">+${rest}</td>
      <td class="n">${p.age}</td>
      <td class="n">${tore || ""}</td></tr>`;
  });
  html += `</table></div>`;

  el.innerHTML = html;
}

// ============================================
// Rekorde
// ============================================

// ============================================
// Jugendkader
// ============================================

function renderYouthSquad(gameState){
  const el = document.getElementById("youthSquadPanel");
  if(!el) return;
  const kader = gameState.youthSquad || [];
  const day = gameState.matchday + 1;

  const kopf = `<div class="statGrid" style="margin-bottom:12px;">
    ${statBox("Jugendkader", `${kader.length}/${YOUTH_SQUAD_MAX_SIZE}`)}
    ${statBox("Gehalt", fmtMoney(getYouthSquadSalary(gameState)), "pro Saison")}
  </div>
  <label class="muted" style="display:flex; gap:8px; align-items:center; margin:0 0 12px; font-size:13px;">
    <input type="checkbox" onchange="gameState.youthAutoPromote = this.checked;"${gameState.youthAutoPromote ? " checked" : ""}>
    Bei Personalnot automatisch hochziehen
  </label>`;

  if(kader.length === 0){
    el.innerHTML = kopf + `<p class="muted">Keine Talente. Neuer Jahrgang zum Saisonende.</p>`;
    return;
  }

  let html = kopf + `<div class="tableWrap"><table>
    <tr><th>Pos</th><th>Name</th><th class="n">Bew.</th><th class="n">Pot.</th>
    <th class="n">Alter</th><th></th></tr>`;

  [...kader].sort((a, b) => b.strength - a.strength).forEach(p => {
    const rest = Math.max(0, Math.round(p.maxStrength - p.strength));
    const reif = isReadyForPromotion(gameState, p);
    const letztesJahr = p.age >= YOUTH_SQUAD_MAX_AGE;
    html += `<tr class="rowLink" onclick="showPlayerDetail('${p.id}')">
      <td><b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b></td>
      <td>${getFlag(p)} ${p.name}${p.isTalent ? " ✨" : ""}</td>
      <td class="n">${Math.round(p.strength)}</td>
      <td class="n" style="color:${rest > 8 ? "var(--win)" : "var(--ink-faint)"};">+${rest}</td>
      <td class="n"${letztesJahr ? ' style="color:#FCA311;" title="Letztes Jahr in der Jugend"' : ""}>${p.age}</td>
      <td><button class="ghost" onclick="event.stopPropagation(); handlePromoteYouth('${p.id}')"
>
        ${reif ? "⬆ Hochziehen" : "Hochziehen"}</button></td>
    </tr>`;
  });
  html += `</table></div>
    <p class="muted" style="margin:10px 0 0; font-size:12px;">Höchstalter ${YOUTH_SQUAD_MAX_AGE} Jahre.</p>`;
  el.innerHTML = html;
}

function renderYouthIntakeModal(){
  const el = document.getElementById("youthIntakeContent");
  if(!el) return;
  const kandidaten = gameState.pendingYouthCandidates || [];
  const gewaehlt = kandidaten.filter(k => k.__gewaehlt).length;
  const frei = YOUTH_SQUAD_MAX_SIZE - (gameState.youthSquad || []).length;

  el.innerHTML = `
    <p class="eyebrow">Jugendabteilung</p>
    <h3 style="margin:6px 0 4px;">Der neue Jahrgang</h3>
    <p class="muted" style="margin:0 0 14px;">
      Aufgenommen <b>${gewaehlt}/${YOUTH_INTAKE_MAX_PICK}</b> · ${frei <= 0 ? "Jugendkader voll" : `${frei} Plätze frei`}
    </p>
    ${kandidaten.map((p, i) => {
      const rest = Math.max(0, Math.round(p.maxStrength - p.strength));
      const aus = p.__gewaehlt || gewaehlt >= YOUTH_INTAKE_MAX_PICK || frei <= 0;
      return `<div class="lineupOption${p.__gewaehlt ? " auto" : ""}${aus && !p.__gewaehlt ? " disabled" : ""}"
        ${p.__gewaehlt || aus ? "" : `onclick="handlePickYouthCandidate(${i})"`}>
        <span style="flex:1;">
          <b>${POSITION_ICONS[p.pos] || ""} ${p.pos}</b> ${getFlag(p)} ${p.name}${p.isTalent ? " ✨" : ""}
          <br><span class="muted" style="font-size:11px;">${p.age} Jahre · Gehalt ${fmtMoney(Math.round(getPlayerSalary(p) * YOUTH_SALARY_FACTOR))}</span>
        </span>
        <span style="text-align:right;">
          <span class="lineupValue">${Math.round(p.strength)}</span>
          <br><span style="font-size:11px; color:${rest > 12 ? "var(--win)" : "var(--ink-faint)"};">Potenzial +${rest}</span>
        </span>
        ${p.__gewaehlt ? '<span class="badge win" style="margin-left:8px;">aufgenommen</span>' : ""}
      </div>`;
    }).join("")}
    <div style="margin-top:16px;">
      <button onclick="finishYouthIntake()">${gewaehlt > 0 ? "Auswahl abschließen" : "Keinen übernehmen"}</button>
    </div>`;
}

function showYouthIntakeModal(){
  if(!gameState.pendingYouthCandidates || gameState.pendingYouthCandidates.length === 0) return;
  renderYouthIntakeModal();
  document.getElementById("youthIntakeOverlay").classList.add("show");
}

function closeYouthIntakeModal(){
  const el = document.getElementById("youthIntakeOverlay");
  if(el) el.classList.remove("show");
}

// Wer am Saisonende ablösefrei geht, wenn nichts passiert. Vorher kam das
// ohne Vorwarnung: jeden Sommer verliessen sieben bis neun Spieler den Verein.
function renderContractPanel(gameState){
  const el = document.getElementById("contractPanel");
  if(!el) return;
  const xi = new Set(getStartingXIIds(gameState.squad, gameState.matchday + 1));
  const liste = (gameState.squad || []).filter(p => isContractExpiring(p))
    .sort((a, b) => (xi.has(b.id) - xi.has(a.id)) || b.strength - a.strength);
  if(liste.length === 0){
    el.innerHTML = '<p class="muted" style="margin:0;">Keine auslaufenden Verträge.</p>';
    return;
  }
  el.innerHTML = `` +
    liste.map(p => {
      const zuAlt = p.age >= RETIREMENT_FORCED_AGE - 1;
      return `<div class="contractRow">
        <span class="contractName"><b>${p.pos}</b> ${p.name}${xi.has(p.id) ? ' <span class="badge win">Startelf</span>' : ""}
          <span class="muted"> · ${Math.round(p.strength)} · ${p.age} J.</span></span>
        ${zuAlt ? '<span class="muted" style="font-size:12px;">Karriereende</span>'
          : `<button class="ghost" onclick="showPlayerDetail('${p.id}')">Verhandeln</button>`}
      </div>`;
    }).join("");
}

// Verhandlungsblock im Profil: Laufzeit waehlen, Handgeld und Gehalt sehen.
function renderRenewalBlock(player){
  const terms = getRenewalTerms(gameState, player);
  if(terms.refused){
    return `<div class="renewBox"><p class="eyebrow">Vertrag</p><p class="muted" style="margin:4px 0 0;">${terms.reason}</p></div>`;
  }
  return `<div class="renewBox"><p class="eyebrow">Vertragsverlängerung · Gehalt +${Math.round(terms.aufschlag * 100)} %</p>
    <div class="renewOptions">${terms.optionen.map(o => {
      const plus = Math.round((o.faktor - 1) * 100);
      return `<button class="ghost" onclick="handleRenewContract('${player.id}', ${o.jahre})"${o.handgeld > gameState.budget ? " disabled" : ""}>
        +${o.jahre} J. · ${fmtMoney(o.handgeld)}<span class="renewSub">Gehalt ${plus > 0 ? "+" + plus + " %" : "gleich"}</span></button>`;
    }).join("")}</div></div>`;
}
