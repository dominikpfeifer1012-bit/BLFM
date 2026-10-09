// ============================================
// CAREER.JS - Trainerlaufbahn
// ============================================
// Stationen des Trainers mit Zeitraum, Bilanz und Titeln. Titel werden beim
// Vergeben dem Trainer zugeordnet (honours[].mine), damit Erfolge mit
// frueheren Vereinen erhalten bleiben und sich filtern lassen.

// Stationen: [{ club, from, to }] — to ist null fuer den aktuellen Verein.
// Aeltere Spielstaende werden aus dem Saisonverlauf rekonstruiert.
function ensureCareer(gameState){
  if(Array.isArray(gameState.career) && gameState.career.length) return gameState.career;
  const stationen = [];
  (gameState.seasonHistory || []).forEach(h => {
    const club = h.club || gameState.clubName;
    const letzte = stationen[stationen.length - 1];
    if(letzte && letzte.club === club) letzte.to = h.season;
    else stationen.push({ club, from: h.season, to: h.season });
  });
  const letzte = stationen[stationen.length - 1];
  if(letzte && letzte.club === gameState.clubName) letzte.to = null;
  else stationen.push({ club: gameState.clubName, from: gameState.season, to: null });
  gameState.career = stationen;
  return stationen;
}

// Vereinswechsel: aktuelle Station schliessen, neue ab der naechsten Saison.
function changeCareerClub(gameState, neuerVerein){
  const stationen = ensureCareer(gameState);
  const aktuell = stationen.find(s => s.to == null);
  if(aktuell) aktuell.to = gameState.season;
  stationen.push({ club: neuerVerein, from: gameState.season + 1, to: null });
}

function getCoachedClubAt(gameState, season){
  const st = ensureCareer(gameState).find(s => s.from <= season && (s.to == null || season <= s.to));
  return st ? st.club : null;
}

// Titel aus der Zeit vor der Zuordnung nachtraeglich zuweisen.
function ensureHonourAttribution(gameState){
  (gameState.honours || []).forEach(h => {
    if(h.mine === undefined) h.mine = getCoachedClubAt(gameState, h.season) === h.winner;
  });
}

function getMyHonours(gameState, club){
  ensureHonourAttribution(gameState);
  return (gameState.honours || []).filter(h => h.mine && (!club || h.winner === club));
}

function groupHonours(liste){
  const zaehler = {};
  liste.forEach(h => { zaehler[h.label] = (zaehler[h.label] || 0) + 1; });
  return Object.keys(zaehler).map(label => ({ label, count: zaehler[label] }))
    .sort((a, b) => b.count - a.count);
}

function getCareerOverview(gameState){
  ensureHonourAttribution(gameState);
  return ensureCareer(gameState).map(st => {
    const bis = st.to == null ? Infinity : st.to;
    const imZeitraum = s => s >= st.from && s <= bis;
    const saisons = (gameState.seasonHistory || [])
      .filter(h => (h.club || gameState.clubName) === st.club && imZeitraum(h.season));
    const titel = (gameState.honours || []).filter(h => h.mine && h.winner === st.club && imZeitraum(h.season));
    // Beste Platzierung: hoechste Liga zuerst, dann der Platz.
    const beste = saisons.reduce((b, h) => {
      const wert = (getDivisionConfig(h.division || 1).tier || 1) * 100 + h.finalPosition;
      return !b || wert < b.wert ? { wert, position: h.finalPosition, division: h.division || 1 } : b;
    }, null);
    return {
      club: st.club, from: st.from, to: st.to, laufend: st.to == null,
      saisons: saisons.length,
      punkte: saisons.reduce((s, h) => s + (h.points || 0), 0),
      aufstiege: saisons.filter(h => h.movement === "promoted").length,
      abstiege: saisons.filter(h => h.movement === "relegated").length,
      beste, titel: groupHonours(titel), titelAnzahl: titel.length
    };
  });
}

// Altstaende: Ex-Vereine fielen beim Abschied auf ihre alte Staerke zurueck.
// Der zurueckgelassene Kader steht noch im Bestand und zeigt den echten Wert.
function repairExClubStrengths(gameState){
  if(gameState.exClubsRepaired || !gameState.pool || !gameState.pool.players) return 0;
  gameState.exClubsRepaired = true;
  let n = 0;
  new Set(ensureCareer(gameState).map(s => s.club).filter(c => c !== gameState.clubName)).forEach(name => {
    const club = findClubEverywhere(gameState, name);
    const kader = gameState.pool.players.filter(p => p.clubName === name);
    if(!club || kader.length < 11) return;
    const wert = Math.min(AI_STRENGTH_CEILING, teamRating(kader, 1));
    if(wert >= club.strength + EX_CLUB_REPAIR_MIN_GAP){
      club.strength = club.baseStrength = Math.round(wert * 10) / 10;
      club.trend = 0;
      n++;
    }
  });
  return n;
}

// ---------- Oberflaeche ----------

function showCareer(){
  switchTab("statistik");
  const el = document.getElementById("careerPanel");
  if(el && el.scrollIntoView) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function formatCareerPeriod(st){
  const kurz = s => `${s}/${String(s + 1).slice(2)}`;
  return st.laufend ? `seit ${kurz(st.from)}` : st.from === st.to ? kurz(st.from) : `${kurz(st.from)} – ${kurz(st.to)}`;
}

function renderCareer(gameState){
  const el = document.getElementById("careerPanel");
  if(!el || !gameState || !gameState.clubName) return;
  const stationen = getCareerOverview(gameState);
  const saisons = stationen.reduce((s, st) => s + st.saisons, 0);
  const titel = stationen.reduce((s, st) => s + st.titelAnzahl, 0);
  el.innerHTML = `
    <p class="muted" style="margin:0 0 10px;">${stationen.length} ${stationen.length === 1 ? "Station" : "Stationen"} · ${saisons} ${saisons === 1 ? "Saison" : "Saisons"} · ${titel} ${titel === 1 ? "Titel" : "Titel"}</p>
    <div class="tableWrap"><table id="careerTable">
      <tr><th>Verein</th><th>Zeitraum</th><th class="n">Saisons</th><th class="hideMobile">Beste Platzierung</th><th class="hideMobile">Auf/Ab</th><th>Titel</th></tr>
      ${[...stationen].reverse().map(st => `<tr${st.laufend ? ' class="highlight"' : ""}>
        <td><b>${st.club}</b></td>
        <td>${formatCareerPeriod(st)}</td>
        <td class="n">${st.saisons}</td>
        <td class="hideMobile">${st.beste ? `${st.beste.position}. ${getDivisionTag(st.beste.division)}` : "—"}</td>
        <td class="hideMobile">${st.aufstiege || st.abstiege ? `${st.aufstiege ? "⬆️" + st.aufstiege : ""} ${st.abstiege ? "⬇️" + st.abstiege : ""}` : "—"}</td>
        <td>${st.titelAnzahl
          ? `<a href="#" class="textLink" onclick="setHonoursFilter('club:${st.club.replace(/'/g, "\\'")}'); return false;">${st.titel.map(t => `${t.count}× ${t.label}`).join(", ")}</a>`
          : `<span class="muted">—</span>`}</td></tr>`).join("")}
    </table></div>`;
}
