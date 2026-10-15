// ============================================
// UI-UEFA.JS - Europapokal, Auslosung, Fuenfjahreswertung, Ehrentafel
// ============================================

let uefaView = null;   // im Europa-Bereich gewaehlter Wettbewerb

function selectUefaView(key){
  uefaView = key;
  renderEuropeStatus(gameState);
}

// Der eigene naechste Europapokal-Gegner (fuer Vorschau und Spielplan).
function getOwnUefaNextFixture(gameState){
  const uefa = gameState.uefa;
  if(!uefa || !isOwnUefaActive(gameState)) return null;
  const comp = uefa.comps[uefa.own];
  const d = uefa.dateIdx;
  const st = getUefaDateStage(comp, d);
  if(!st) return null;
  const me = gameState.clubName;
  if(st.type === "league"){
    const f = comp.fixtures.find(x => x.round === st.round && (x.home === me || x.away === me));
    return f ? { opponent: f.home === me ? f.away : f.home, isHome: f.home === me } : null;
  }
  const t = comp.ties.find(x => x.a === me || x.b === me);
  if(!t) return null;
  const gegner = t.a === me ? t.b : t.a;
  if(t.final) return { opponent: gegner, isHome: null };
  const heim = st.leg === 0 ? t.a === me : t.b === me;
  return { opponent: gegner, isHome: heim };
}

function renderEuropeStatus(gameState){
  const container = document.getElementById("europeStatus");
  if(!container) return;
  const uefa = gameState.uefa;
  if(!uefa || !uefa.comps){ container.innerHTML = ""; return; }

  const key = uefaView && uefa.comps[uefaView] ? uefaView : (uefa.own || "cl");
  const comp = uefa.comps[key];
  const cfg = UEFA_COMPS[key];
  const chips = UEFA_COMP_ORDER.map(k => `<button class="chipBtn${k === key ? " on" : ""}" onclick="selectUefaView('${k}')">${UEFA_COMPS[k].icon} ${UEFA_COMPS[k].short}${k === uefa.own ? " ★" : ""}</button>`).join("");

  let kopf = "";
  if(key === uefa.own){
    if(comp.winner === gameState.clubName) kopf = `<span class="badge win">${cfg.icon} Sieger</span>`;
    else if(comp.ownOut) kopf = `<span class="badge loss">Ausgeschieden</span> · ${comp.ownExit}`;
    else kopf = `<span class="badge win">Dabei</span> · ${comp.phase === "league" ? `Ligaphase ${comp.round}/${cfg.rounds}` : UEFA_KO_STAGES[comp.koStage] || ""}`;
    if(uefa.goal) kopf += ` · Ziel: ${uefa.goal.label}`;
  } else if(!uefa.own && key === "cl"){
    kopf = `<span class="muted">Nicht qualifiziert.</span>`;
  }
  if(comp.winner && comp.winner !== gameState.clubName) kopf += `${kopf ? " · " : ""}Sieger: <b>${comp.winner}</b>`;

  let body = "";

  // Eigene Gegner der Ligaphase.
  if(key === uefa.own){
    const me = gameState.clubName;
    const meine = comp.fixtures.filter(f => f.home === me || f.away === me).sort((a, b) => a.round - b.round);
    body += `<p class="eyebrow" style="margin:12px 0 6px;">Deine Ligaphase</p><div class="confList">${meine.map(f => {
      const heim = f.home === me;
      const gegner = heim ? f.away : f.home;
      const t = comp.teams.find(x => x.name === gegner);
      const erg = f.played ? `<b class="num">${heim ? f.homeGoals : f.awayGoals}:${heim ? f.awayGoals : f.homeGoals}</b>` : `<span class="muted">${f.round + 1}.</span>`;
      return `<div class="confRow"><span>${heim ? "🏠" : "✈️"} Topf ${t ? t.pot : "?"}</span>${erg}<span>${gegner}</span></div>`;
    }).join("")}</div>`;
  }

  // K.o.-Runden.
  const runden = [...comp.koHistory, ...(comp.phase === "ko" && comp.ties.length && !comp.koHistory.some(h => h.stage === comp.koStage) ? [{ stage: comp.koStage, ties: comp.ties }] : [])];
  runden.slice().reverse().forEach(r => {
    body += `<p class="eyebrow" style="margin:12px 0 6px;">${UEFA_KO_STAGES[r.stage]}</p><div class="confList">${r.ties.map(t => {
      const eigen = t.a === gameState.clubName || t.b === gameState.clubName;
      let erg = `<span class="muted">–</span>`;
      if(t.final && t.legs[0]){
        const s = t.legs[0];
        erg = `<b class="num">${s.homeGoals}:${s.awayGoals}</b>${s.pens ? ` <span class="muted">i.E.</span>` : s.extraTime ? ` <span class="muted">n.V.</span>` : ""}`;
      } else if(t.legs.length === 2) erg = `<b class="num">${t.aggA}:${t.aggB}</b>${t.legs[1].pens ? ` <span class="muted">i.E.</span>` : ""}`;
      else if(t.legs.length === 1) erg = `<span class="num">${t.legs[0].homeGoals}:${t.legs[0].awayGoals}</span>`;
      const name = n => t.winner === n ? `<b>${n}</b>` : n;
      return `<div class="confRow${eigen ? " own" : ""}"><span>${name(t.a)}</span>${erg}<span>${name(t.b)}</span></div>`;
    }).join("")}</div>`;
  });

  // Tabelle der Ligaphase (36 Teams, Zonen: Achtelfinale, Play-offs, raus).
  const tab = getUefaLeagueTable(comp);
  let tabelle = "";
  if(tab.some(t => t.played > 0) || comp.phase === "league"){
    tabelle += `<p class="eyebrow" style="margin:12px 0 6px;">Ligaphase</p><div class="tableWrap" style="max-height:540px; overflow-y:auto;"><table>
      <tr><th class="n">#</th><th>Verein</th><th class="n">Sp</th><th class="n">Tore</th><th class="n">Pkt</th></tr>${tab.map((t, i) => {
        const zone = i < UEFA_DIRECT_R16 ? "var(--win)" : i < UEFA_PLAYOFF_UNTIL ? "var(--draw)" : "var(--loss)";
        const eigen = t.name === gameState.clubName ? ' class="highlight"' : "";
        return `<tr${eigen} style="box-shadow:inset 3px 0 0 ${zone};"><td class="n">${i + 1}</td><td><span class="clubLink" onclick="showClubDetail(this.dataset.club)" data-club="${t.name}">${t.name}</span> <span class="muted" style="font-size:11px;">${uefaCountryTag(t.country)}</span></td><td class="n">${t.played}</td><td class="n">${t.gf}:${t.ga}</td><td class="n"><b>${t.points}</b></td></tr>`;
      }).join("")}</table></div>`;
  }

  container.innerHTML = `<div class="chipBar">${chips}</div><p style="margin:0;">${kopf}</p>
    <div class="uefaCols"><div>${body}</div><div>${tabelle}</div></div>`;
}

function uefaCountryTag(key){
  if(COUNTRIES.some(c => c.key === key)) return getCountryBadge(key);
  return key;
}

// ---------- Auslosung ----------

// key: Wettbewerb; stufe -1 = Ligaphase, sonst K.o.-Runde.
function queueUefaDrawModal(gameState, key, stufe){
  if(typeof isBatchRunning === "function" && isBatchRunning()) return;
  if(typeof document === "undefined" || !document.getElementById("uefaDrawOverlay")) return;
  if(typeof queueModal === "function") queueModal(() => showUefaDrawModal(key, stufe));
}

function showUefaDrawModal(key, stufe){
  const uefa = gameState.uefa;
  if(!uefa || !uefa.comps[key]) return;
  const comp = uefa.comps[key];
  const cfg = UEFA_COMPS[key];
  const me = gameState.clubName;
  let inhalt = "";
  if(stufe < 0){
    const eigen = comp.teams.find(t => t.name === me);
    const meine = comp.fixtures.filter(f => f.home === me || f.away === me).sort((a, b) => a.round - b.round);
    inhalt = `<p class="muted" style="margin-top:-4px;">${me} · Topf ${eigen ? eigen.pot : "?"}</p>
      <div class="confList">${meine.map(f => {
        const heim = f.home === me, gegner = heim ? f.away : f.home;
        const t = comp.teams.find(x => x.name === gegner);
        return `<div class="confRow"><span>${f.round + 1}. Spieltag</span><b>${heim ? "🏠" : "✈️"}</b><span>${gegner} <span class="muted">(Topf ${t.pot}, ${Math.round(t.strength)})</span></span></div>`;
      }).join("")}</div>`;
    if(uefa.goal) inhalt += `<p style="margin-top:12px;">Vorstandsziel: <b>${uefa.goal.label}</b></p>`;
  } else {
    const t = comp.ties.find(x => x.a === me || x.b === me);
    if(!t) return;
    const gegner = t.a === me ? t.b : t.a;
    const g = comp.teams.find(x => x.name === gegner);
    inhalt = `<h3 style="margin:6px 0;">${me} – ${gegner}</h3>
      <p class="muted">${t.final ? "Neutraler Platz" : t.a === me ? "Hinspiel daheim" : "Hinspiel auswärts"} · Stärke ${g ? Math.round(g.strength) : "?"}</p>
      <p class="eyebrow" style="margin-top:12px;">Alle Paarungen</p>
      <div class="confList">${comp.ties.map(x => `<div class="confRow${x === t ? " own" : ""}"><span>${x.a}</span><b>–</b><span>${x.b}</span></div>`).join("")}</div>`;
  }
  document.getElementById("uefaDrawContent").innerHTML = `
    <p class="eyebrow">${cfg.icon} ${cfg.name} · Auslosung</p>
    <h2 style="margin:2px 0 10px;">${stufe < 0 ? "Ligaphase" : UEFA_KO_STAGES[stufe]}</h2>${inhalt}`;
  document.getElementById("uefaDrawOverlay").classList.add("show");
}

function closeUefaDrawModal(){
  document.getElementById("uefaDrawOverlay").classList.remove("show");
}

// ---------- Fuenfjahreswertung ----------

function renderUefaRanking(gameState){
  const el = document.getElementById("uefaRanking");
  if(!el) return;
  const rang = getCountryRanking(gameState);
  const eps = getExtraClCountries(gameState);
  const eigenesLand = getOwnCountry(gameState);
  el.innerHTML = `<div class="tableWrap" style="max-height:360px; overflow-y:auto;"><table>
    <tr><th class="n">#</th><th>Land</th><th class="n">5 Jahre</th><th class="n">Vorjahr</th><th class="n">laufend</th></tr>
    ${rang.slice(0, 20).map((r, i) => `<tr${r.key === eigenesLand ? ' class="highlight"' : ""}><td class="n">${i + 1}</td>
      <td>${uefaCountryTag(r.key)} ${r.name}${eps.includes(r.key) ? ' <span class="badge win" title="Zusätzlicher CL-Platz">+1 CL</span>' : ""}</td>
      <td class="n"><b>${r.total.toFixed(1)}</b></td><td class="n">${r.last.toFixed(1)}</td><td class="n">${r.current.toFixed(1)}</td></tr>`).join("")}
  </table></div>
  <p class="muted" style="font-size:12px; margin-top:8px;">${gameState.clubName}: <b>${getClubCoefficient(gameState, gameState.clubName).toFixed(1).replace(".", ",")}</b></p>`;
}

// ---------- Ehrentafel ----------

// Filter: "alle", "meine" (alle Titel als Trainer) oder "club:<Name>".
let honoursFilter = "alle";
function setHonoursFilter(wert){
  honoursFilter = wert;
  renderHonours(gameState);
  const el = document.getElementById("honoursList");
  if(el && wert !== "alle" && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderHonours(gameState){
  const el = document.getElementById("honoursList");
  if(!el) return;
  const alle = gameState.honours || [];
  if(alle.length === 0){
    el.innerHTML = `<p class="muted">Noch keine Titel vergeben.</p>`;
    return;
  }
  ensureHonourAttribution(gameState);
  const vereine = [...new Set(ensureCareer(gameState).map(s => s.club))];
  const club = honoursFilter.startsWith("club:") ? honoursFilter.slice(5) : null;
  const passt = h => honoursFilter === "alle" || (h.mine && (!club || h.winner === club));
  const meine = groupHonours(getMyHonours(gameState, club));
  const titelzeile = club ? `Titel mit ${club}` : "Deine Titel";

  const saisons = [...new Set(alle.map(h => h.season))].sort((a, b) => b - a);
  const reihenfolge = k => k === "cl" ? 0 : k === "el" ? 1 : k === "ecl" ? 2 : k.startsWith("super-uefa") ? 3
    : k.startsWith("league-") ? 10 + Number(k.slice(7)) : k.startsWith("cup-") ? 30 : 40;
  const liste = saisons.map(sn => {
    const eintraege = alle.filter(h => h.season === sn && passt(h))
      .sort((a, b) => reihenfolge(a.key) - reihenfolge(b.key));
    if(!eintraege.length) return "";
    return `<p class="eyebrow" style="margin:12px 0 6px;">Saison ${sn}/${String(sn + 1).slice(2)}</p>
      <div class="honourGrid">${eintraege.map(h => `<div class="honourItem${h.mine ? " own" : ""}"><span class="muted">${h.label}</span><b>${h.winner}</b></div>`).join("")}</div>`;
  }).join("");

  el.innerHTML = `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
      <span>${meine.length ? `${titelzeile}: ${meine.map(t => `<b>${t.count}× ${t.label}</b>`).join(", ")}` : `<span class="muted">${titelzeile}: noch keine.</span>`}</span>
      <select id="honoursFilterSelect" onchange="setHonoursFilter(this.value)">
        <option value="alle"${honoursFilter === "alle" ? " selected" : ""}>Alle Titel</option>
        <option value="meine"${honoursFilter === "meine" ? " selected" : ""}>Meine Titel</option>
        ${vereine.map(v => `<option value="club:${v.replace(/"/g, "&quot;")}"${club === v ? " selected" : ""}>Mit ${v}</option>`).join("")}
      </select></div>
    ${liste || `<p class="muted">Keine Titel.</p>`}`;
}
