// ============================================
// LEGENDS.JS - Legenden und Beziehungen
// ============================================
// Spieler, die lange unter dem Trainer gespielt haben, werden zu Legenden
// ihres Vereins. Sie erinnern sich an ihren Trainer: manche folgen ihm zu
// einem neuen Verein, ehemalige Spieler werden spaeter selbst Trainer, und
// die Rueckkehr zu einem frueheren Verein wird nicht vergessen.

// ---------- Bilanz unter dem Trainer ----------

// Einsatz in einem eigenen Pflichtspiel (aus der Notenvergabe).
function countCoachAppearance(player){
  player.clubApps = (player.clubApps || 0) + 1;
}

function getClubGoals(player){
  return (player.clubGoals || 0) + (player.goalsFolded ? 0 : (player.goalsSeason || 0));
}

function isLegendWorthy(apps, goals){
  return apps >= LEGEND_MIN_APPS || goals >= LEGEND_MIN_GOALS;
}

// Eintrag anlegen oder fortschreiben.
function upsertLegend(gameState, player, extra){
  gameState.legends = gameState.legends || [];
  const apps = player.clubApps || 0, goals = getClubGoals(player);
  let eintrag = gameState.legends.find(l => l.id === player.id && l.club === gameState.clubName);
  if(!eintrag){
    if(!isLegendWorthy(apps, goals)) return null;
    eintrag = { id: player.id, name: player.name, pos: player.pos, nat: player.nat, club: gameState.clubName,
      since: player.clubSince || gameState.season, active: true };
    gameState.legends.push(eintrag);
    addLogEntry(gameState, `🏛️ ${player.name} ist jetzt Vereinslegende von ${gameState.clubName} (${apps} Spiele, ${goals} Tore).`, "win", true);
  }
  Object.assign(eintrag, { apps, goals, seasons: Math.max(eintrag.seasons || 0, player.clubSeasons || 0), last: gameState.season }, extra || {});
  return eintrag;
}

// Saisonende: Tore und Saisons fortschreiben, Legenden aktualisieren.
function updateLegendsAtSeasonEnd(gameState){
  (gameState.squad || []).forEach(p => {
    if(p.clubSince == null) p.clubSince = gameState.season;
    upsertLegend(gameState, p);
    p.clubGoals = getClubGoals(p);
    p.goalsFolded = true;
    p.clubSeasons = (p.clubSeasons || 0) + 1;
  });
}

// Ein Spieler verlaesst den Kader (Verkauf, Vertragsende, Karriereende).
function noteDeparture(gameState, player, grund){
  if(!player) return;
  const eintrag = upsertLegend(gameState, player, { active: false, reason: grund });
  player.formerCoachApps = player.clubApps || 0;
  player.formerClub = gameState.clubName;
  if(grund === "Karriereende" && player.formerCoachApps >= FORMER_COACH_MIN_APPS) rememberRetiredPlayer(gameState, player);
  return eintrag;
}

// Trainer wechselt: Bilanz der bisherigen Spieler einfrieren.
function closeClubLegends(gameState){
  (gameState.squad || []).forEach(p => {
    upsertLegend(gameState, p, { active: false, reason: "Trainerwechsel" });
    p.formerCoachApps = p.clubApps || 0;
    p.formerClub = gameState.clubName;
  });
}

function getLegends(gameState, club){
  return (gameState.legends || []).filter(l => !club || l.club === club).sort((a, b) => b.apps - a.apps);
}

// ---------- Spieler folgen dem Trainer ----------

// Beim Vereinswechsel: die engsten Vertrauten aus dem alten Kader.
function pickFollowers(squad){
  return [...squad]
    .filter(p => (p.clubApps || 0) >= FOLLOW_MIN_APPS && p.age <= FOLLOW_MAX_AGE && getMorale(p) >= MORALE_NEUTRAL - 5)
    .sort((a, b) => (b.clubApps || 0) - (a.clubApps || 0))
    .slice(0, FOLLOW_MAX_PLAYERS);
}

function markFollowers(gameState, ids, neuerVerein){
  const pool = gameState.pool && gameState.pool.players;
  if(!pool) return [];
  const folger = pool.filter(p => ids.includes(p.id));
  folger.forEach(p => {
    p.followCoach = neuerVerein;
    p.followSeason = gameState.season;
    p.transferListed = true;
  });
  return folger;
}

function isFollower(gameState, player){
  return player && player.followCoach === gameState.clubName && player.followSeason === gameState.season;
}

// ---------- Ehemalige werden Trainer ----------

function rememberRetiredPlayer(gameState, player){
  gameState.retiredFormer = gameState.retiredFormer || [];
  if(gameState.retiredFormer.some(r => r.id === player.id)) return;
  gameState.retiredFormer.push({ id: player.id, name: player.name, nat: player.nat,
    club: player.formerClub || gameState.clubName, apps: player.formerCoachApps || player.clubApps || 0,
    retired: gameState.season, coach: null });
}

// Ein Verein sucht einen Trainer: manchmal wird es ein ehemaliger Spieler.
function pickFormerPlayerAsCoach(gameState, clubName){
  const frei = (gameState.retiredFormer || []).filter(r => !r.coach && gameState.season - r.retired >= FORMER_COACH_MIN_YEARS);
  if(!frei.length || Math.random() > FORMER_COACH_CHANCE) return null;
  const r = randChoice(frei);
  r.coach = clubName;
  return { name: r.name, nat: r.nat, since: gameState.season, former: true, formerClub: r.club };
}

// ---------- Rueckkehr zu einem frueheren Verein ----------

function applyHomecoming(gameState, clubName){
  const frueher = (gameState.career || []).filter(s => s.club === clubName && s.to != null);
  if(!frueher.length || !gameState.board) return null;
  const titel = (gameState.honours || []).filter(h => h.mine && h.winner === clubName).length;
  const entlassen = frueher.some(s => s.dismissed);
  let delta = 0, text;
  if(titel > 0){ delta = HOMECOMING_HERO_BONUS; text = `Rückkehr nach ${titel === 1 ? "einem Titel" : titel + " Titeln"}: Die Fans feiern den alten Trainer.`; }
  else if(entlassen){ delta = -HOMECOMING_SKEPTIC_MALUS; text = "Rückkehr nach der Entlassung: Im Umfeld herrscht Skepsis."; }
  else { delta = 3; text = "Rückkehr an die alte Wirkungsstätte."; }
  gameState.board.patience = Math.max(10, Math.min(BOARD_MAX_PATIENCE, gameState.board.patience + delta));
  return { delta, text };
}

// ---------- Oberflaeche ----------

function renderLegendList(gameState, club, limit){
  const liste = getLegends(gameState, club).slice(0, limit || 10);
  if(!liste.length) return "";
  return `<div class="tableWrap"><table>
    <tr><th>Spieler</th>${club ? "" : "<th>Verein</th>"}<th class="n">Spiele</th><th class="n">Tore</th><th class="hideMobile">Status</th></tr>
    ${liste.map(l => `<tr><td>🏛️ <b>${l.name}</b> <span class="muted">${l.pos}</span></td>${club ? "" : `<td>${l.club}</td>`}
      <td class="n">${l.apps}</td><td class="n">${l.goals}</td>
      <td class="hideMobile muted">${l.active ? "im Kader" : (l.reason || "gegangen")}</td></tr>`).join("")}
  </table></div>`;
}
