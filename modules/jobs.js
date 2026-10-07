// ============================================
// JOBS.JS - Stellenmarkt fuer Trainer
// ============================================
// Jede Saison sind bei einem Teil der Vereine aller Ligen Trainerposten
// frei. Man kann sich bewerben; ob ein Verein zusagt, haengt am Trainer-Ruf
// und am Erfolg beim aktuellen Verein. Gewechselt wird zum Saisonende.

// Noetiger Ruf fuer einen Verein dieser Staerke.
function getJobRequirement(strength){
  return Math.max(0, Math.min(95, Math.round((strength - JOB_REP_BASE_STRENGTH) * JOB_REP_PER_POINT)));
}

// Freie Stellen werden je Saison einmal festgelegt.
function ensureJobMarket(gameState){
  const jm = gameState.jobMarket;
  if(jm && jm.season === gameState.season) return jm;
  const alle = getAllLeagueClubs(gameState).filter(c => c.name !== gameState.clubName);
  const frei = alle.filter(() => Math.random() < JOB_VACANCY_SHARE).map(c => c.name);
  gameState.jobMarket = { season: gameState.season, vacancies: frei, applications: {} };
  return gameState.jobMarket;
}

// Zusagechance: entweder reicht der Ruf, oder man ist beim jetzigen,
// mindestens gleich grossen Verein erfolgreich (ab der ersten vollen Saison).
function getJobChance(gameState, club){
  const ruf = getReputation(gameState);
  const vonRuf = ruf - getJobRequirement(club.strength);
  const eigene = gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState);
  const geduld = gameState.board && !gameState.board.dismissed ? gameState.board.patience : 0;
  const saisons = (gameState.seasonHistory || []).filter(h => h.club === gameState.clubName).length;
  const vonVerein = saisons >= 1 && geduld >= JOB_STATURE_MIN_PATIENCE ? (eigene + JOB_STATURE_MARGIN - club.strength) * 4 : -Infinity;
  const vorsprung = Math.max(vonRuf, vonVerein);
  if(vorsprung < -JOB_HOPELESS_GAP) return 0;
  return Math.max(0.1, Math.min(0.9, 0.45 + vorsprung / 40));
}

function getJobList(gameState){
  const jm = ensureJobMarket(gameState);
  const frei = new Set(jm.vacancies);
  return gameState.leaguePools.flatMap((pool, idx) => pool.map(c => ({
    name: c.name, strength: c.strength, division: idx + 1, country: getDivisionCountry(idx + 1)
  }))).filter(c => c.name !== gameState.clubName).map(c => Object.assign(c, {
    open: frei.has(c.name),
    requirement: getJobRequirement(c.strength),
    chance: getJobChance(gameState, c),
    status: jm.applications[c.name] || null
  }));
}

function applyForJob(gameState, clubName){
  const jm = ensureJobMarket(gameState);
  const club = getJobList(gameState).find(c => c.name === clubName);
  if(!club) return { success: false, message: "Verein nicht gefunden." };
  if(!club.open) return { success: false, message: `${clubName} sucht keinen Trainer.` };
  if(club.status) return { success: false, message: `Bewerbung bei ${clubName} läuft bereits.` };
  if(club.chance <= 0) return { success: false, message: `${clubName} lehnt ab: Trainer-Ruf zu gering.` };

  const zusage = Math.random() < club.chance;
  jm.applications[clubName] = zusage ? "zusage" : "absage";

  // Bewerbungen sprechen sich herum.
  let durchgesickert = false;
  if(gameState.board && !gameState.board.dismissed && Math.random() < JOB_LEAK_CHANCE){
    gameState.board.patience = Math.max(1, gameState.board.patience - JOB_LEAK_PATIENCE);
    durchgesickert = true;
  }

  const text = zusage
    ? `🤝 ${clubName} sagt zu. Wechsel zum Saisonende möglich.`
    : `✉️ ${clubName} sagt ab.`;
  addLogEntry(gameState, text + (durchgesickert ? " Die Bewerbung wurde bekannt, der Vorstand ist verstimmt." : ""),
    zusage ? "win" : null, zusage);
  return { success: true, accepted: zusage, leaked: durchgesickert, message: text };
}

// Zusagen als Angebote fuer das Saisonende.
function getAcceptedJobOffers(gameState){
  const jm = gameState.jobMarket;
  if(!jm || jm.season !== gameState.season) return [];
  return getJobList(gameState).filter(c => c.status === "zusage").map(c => ({
    name: c.name, strength: c.strength, division: c.division,
    goal: getSeasonGoal(c.strength, c.division), budget: calculateStartingBudget(c.strength)
  }));
}

// ---------- Oberflaeche ----------

let jobFilter = { country: "alle", onlyOpen: true };

function setJobFilter(feld, wert){
  jobFilter[feld] = wert;
  renderJobMarket(gameState);
}

function handleApplyForJob(clubName){
  const r = applyForJob(gameState, clubName);
  showToast(r.message, r.success ? (r.accepted ? "success" : "info") : "error");
  renderJobMarket(gameState);
  if(typeof renderBoardPanel === "function") renderBoardPanel(gameState);
}

function renderJobMarket(gameState){
  const el = document.getElementById("jobMarket");
  if(!el || !gameState || !gameState.leaguePools) return;
  const ruf = getReputation(gameState);
  const liste = getJobList(gameState)
    .filter(c => jobFilter.country === "alle" || c.country === jobFilter.country)
    .filter(c => !jobFilter.onlyOpen || c.open || c.status)
    .sort((a, b) => b.strength - a.strength);
  const zusagen = getJobList(gameState).filter(c => c.status === "zusage");

  const chanceText = c => c.chance <= 0 ? "chancenlos" : c.chance >= 0.7 ? "gut" : c.chance >= 0.4 ? "offen" : "gering";
  const aktion = c => {
    if(c.status === "zusage"){
      return gameState.seasonEnded
        ? `<button onclick="acceptJobOffer('${c.name.replace(/'/g, "\\'")}')">Wechseln</button>`
        : `<span class="badge win">Zusage</span>`;
    }
    if(c.status === "absage") return `<span class="badge loss">Absage</span>`;
    if(!c.open) return `<span class="muted">besetzt</span>`;
    if(c.chance <= 0) return `<span class="muted">Ruf zu gering</span>`;
    return `<button class="ghost" onclick="handleApplyForJob('${c.name.replace(/'/g, "\\'")}')">Bewerben</button>`;
  };

  el.innerHTML = `
    <p style="margin:0 0 10px;">Trainer-Ruf <b>${Math.round(ruf)}</b> (${getReputationLabel(ruf)})
      ${zusagen.length ? ` · <span style="color:var(--win);">${zusagen.length} ${zusagen.length === 1 ? "Zusage" : "Zusagen"}</span>` : ""}
      ${zusagen.length && !gameState.seasonEnded ? `<span class="muted"> · Wechsel zum Saisonende</span>` : ""}</p>
    <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; margin-bottom:10px;">
      <select onchange="setJobFilter('country', this.value)">
        <option value="alle"${jobFilter.country === "alle" ? " selected" : ""}>Alle Länder</option>
        ${COUNTRIES.map(c => `<option value="${c.key}"${jobFilter.country === c.key ? " selected" : ""}>${c.name}</option>`).join("")}
      </select>
      <label class="muted" style="display:flex; gap:6px; align-items:center;">
        <input type="checkbox"${jobFilter.onlyOpen ? " checked" : ""} onchange="setJobFilter('onlyOpen', this.checked)"> Nur freie Stellen
      </label>
    </div>
    ${liste.length === 0 ? `<p class="muted">Keine freien Stellen.</p>` : `
    <div class="tableWrap"><table id="jobTable">
      <tr><th>Verein</th><th class="n">Stärke</th><th class="n">Ruf</th><th class="hideMobile">Chance</th><th></th></tr>
      ${liste.map(c => `<tr>
        <td><b>${c.name}</b><br><span class="muted" style="font-size:11px;">${getDivisionTag(c.division)}</span></td>
        <td class="n">${Math.round(c.strength)}</td>
        <td class="n" style="color:${ruf >= c.requirement ? "var(--win)" : "var(--ink-dim)"};">${c.requirement}</td>
        <td class="muted hideMobile">${c.open && !c.status ? chanceText(c) : ""}</td>
        <td>${aktion(c)}</td></tr>`).join("")}
    </table></div>`}`;
}
