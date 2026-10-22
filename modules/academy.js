// ============================================
// ACADEMY.JS - Nachwuchsleistungszentrum
// ============================================
// Drei Teile statt eines Pauschalbonus: Infrastruktur (Plaetze, Tempo),
// Jugendtrainer (Entwicklung, genauere Einschaetzung) und der Ruf der
// Akademie (bessere Bewerber, wenn Eigengewaechse es schaffen). Dazu:
// Potenzial ist eine Schaetzung, Talente koennen durchstarten oder
// stagnieren, Mentoren helfen, und wer keine Perspektive sieht, geht.

function acClamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }

// Feste Pseudo-Zufallszahl je Spieler, damit eine Spanne beim Neuzeichnen
// nicht springt.
function acHash(text, salt){
  let h = salt || 7;
  const s = String(text || "");
  for(let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973;
  return (h % 1000) / 1000;
}

// ---------- Zustand ----------

// Ausgangslage je Verein: grosse und ausbildende Vereine haben schon eine Akademie.
function getStartingAcademy(gameState, clubName, strength){
  const profil = typeof getClubProfileKey === "function" ? getClubProfileKey(gameState, clubName) : "solide";
  const ausbildung = profil === "ausbildung";
  const infra = acClamp(Math.round((strength - 55) / 9), 0, 4);
  const coaches = Math.min(4, acClamp(Math.round((strength - 58) / 10), 0, 3) + (ausbildung ? 1 : 0));
  const reputation = acClamp(Math.round(20 + (strength - 60) * 1.2 + (ausbildung ? 15 : 0) + (profil === "gross" ? 5 : 0)), 5, 85);
  return { infra, coaches, reputation };
}

function createAcademy(gameState, clubName, strength){
  const start = getStartingAcademy(gameState, clubName, strength);
  const a = {
    club: clubName,
    infra: start.infra, coaches: start.coaches,
    reputation: start.reputation, repBase: start.reputation,
    scouts: [], scoutMarket: null, prospects: [], reports: [],
    mentors: {}, titles: [], log: []
  };
  // Vorhandenes Personal: groessere Vereine haben schon Scouts.
  if(typeof createScout === "function"){
    const heim = getHomeRegionKey(gameState);
    // Der erste Scout stammt aus der Heimatregion, der zweite aus einer anderen.
    if(strength >= 66){
      const s = createScout(gameState, strength >= 84 ? 3 : 2, randChoice(SCOUT_REGIONS[heim].nats));
      Object.assign(s, { region: heim, focus: "talente" });
      a.scouts.push(s);
    }
    if(strength >= 80){
      const andere = randChoice(Object.keys(SCOUT_REGIONS).filter(k => k !== heim && !SCOUT_REGIONS[k].far));
      const s = createScout(gameState, 2, randChoice(SCOUT_REGIONS[andere].nats));
      Object.assign(s, { region: andere, focus: "jung" });
      a.scouts.push(s);
    }
  }
  return a;
}

// Legt die Akademie an (neue Karriere, Vereinswechsel, aeltere Spielstaende).
// Aeltere Staende: Jugendarbeit und Scouting aus den Investitionen uebernehmen.
function ensureAcademy(gameState){
  if(!gameState) return null;
  let a = gameState.academy;
  if(!a || a.club !== gameState.clubName){
    const staerke = gameState.clubStature != null ? gameState.clubStature
      : (typeof getOwnClubStrength === "function" ? getOwnClubStrength(gameState) : 65);
    a = createAcademy(gameState, gameState.clubName, staerke);
    const f = gameState.facilities || {};
    if(f.youth) a.infra = Math.max(a.infra, Math.min(ACADEMY_LEVELS, f.youth));
    if(f.scouting && typeof createScout === "function"){
      const scout = createScout(gameState, acClamp(1 + f.scouting, 1, 5));
      scout.region = getHomeRegionKey(gameState);
      a.scouts.push(scout);
    }
    gameState.academy = a;
  }
  if(gameState.facilities){ delete gameState.facilities.youth; delete gameState.facilities.scouting; }
  ["scouts", "prospects", "reports", "titles", "log"].forEach(k => { if(!Array.isArray(a[k])) a[k] = []; });
  if(!a.mentors) a.mentors = {};
  if(a.repBase == null) a.repBase = a.reputation;
  (gameState.youthSquad || []).forEach(p => { if(p.academySince == null) p.academySince = gameState.season; });
  return a;
}

// Ein neuer Verein bringt seine eigene Akademie mit, Personal inklusive.
function resetAcademyForClub(gameState){
  delete gameState.academy;
  return ensureAcademy(gameState);
}

// Startjahrgang: Die Akademie hat schon Talente, wenn der Trainer kommt.
function createStartingYouthSquad(gameState){
  const a = ensureAcademy(gameState);
  const anzahl = 3 + Math.round(a.infra / 2) + (a.coaches >= 3 ? 1 : 0);
  const kandidaten = shuffleArray(createYouthCandidates(gameState)).slice(0, anzahl);
  gameState.youthSquad = [];
  kandidaten.forEach(p => {
    p.age = randInt(16, 19);
    addToYouthSquad(gameState, p);
    p.academySince = gameState.season - (p.age - 16);
    p.clubDays = (p.age - 16) * TOTAL_MATCHDAYS;
  });
  return gameState.youthSquad;
}

function addAcademyLog(gameState, text, icon){
  const a = ensureAcademy(gameState);
  a.log.unshift({ season: gameState.season, md: gameState.matchday, text, icon: icon || "🌱" });
  if(a.log.length > 40) a.log.length = 40;
}

// ---------- Ausbau ----------

const ACADEMY_PARTS = {
  infra:   { label: "Infrastruktur", icon: "🏗", costs: ACADEMY_INFRA_COSTS },
  coaches: { label: "Jugendtrainer", icon: "🧑‍🏫", costs: ACADEMY_COACH_COSTS }
};

function getAcademyUpgradeCost(gameState, part){
  const a = ensureAcademy(gameState);
  const stufe = a[part] || 0;
  if(stufe >= ACADEMY_LEVELS) return null;
  return ACADEMY_PARTS[part].costs[stufe];
}

function upgradeAcademy(gameState, part){
  if(!ACADEMY_PARTS[part]) return { success: false, message: "Unbekannter Bereich." };
  const a = ensureAcademy(gameState);
  const kosten = getAcademyUpgradeCost(gameState, part);
  if(kosten === null) return { success: false, message: `${ACADEMY_PARTS[part].label} ist voll ausgebaut.` };
  if(kosten > gameState.budget) return { success: false, message: `Budget reicht nicht (${fmtMoney(kosten)}).` };
  gameState.budget -= kosten;
  a[part] += 1;
  const text = `${ACADEMY_PARTS[part].icon} ${ACADEMY_PARTS[part].label} auf Stufe ${a[part]} — ${fmtMoney(kosten)}.`;
  addAcademyLog(gameState, text, ACADEMY_PARTS[part].icon);
  return { success: true, message: text };
}

// ---------- Wirkungen ----------

function getYouthSquadCapacity(gameState){
  const a = ensureAcademy(gameState);
  return ACADEMY_SQUAD_BASE + (a ? a.infra : 0) * ACADEMY_SQUAD_PER_INFRA;
}

function getYouthIntakeCount(gameState){
  const a = ensureAcademy(gameState);
  return ACADEMY_INTAKE_BASE + Math.floor(a.infra / 2) + (a.reputation >= 60 ? 1 : 0);
}

// Aufschlag fuer den eigenen Jahrgang: Akademie, Vereinsprofil, Spielphilosophie.
function getYouthQualityBonus(gameState){
  const a = ensureAcademy(gameState);
  const profil = typeof getOwnProfile === "function" ? getOwnProfile(gameState).youth : { strength: 0, potential: 0 };
  const stil = typeof getPhilosophy === "function" ? getPhilosophy(gameState).youthPotential : 0;
  const ruf = a.reputation / 100;
  return {
    strength: a.infra * ACADEMY_STRENGTH_PER_INFRA + a.coaches * ACADEMY_STRENGTH_PER_COACH
      + ruf * ACADEMY_STRENGTH_FROM_REP + profil.strength,
    potential: a.infra * ACADEMY_POTENTIAL_PER_INFRA + a.coaches * ACADEMY_POTENTIAL_PER_COACH
      + ruf * ACADEMY_POTENTIAL_FROM_REP + profil.potential + stil
  };
}

// Entwicklungstempo im Jugendkader.
function getAcademyDevFactor(gameState){
  const a = ensureAcademy(gameState);
  return 1 + a.infra * ACADEMY_DEV_PER_INFRA + a.coaches * ACADEMY_DEV_PER_COACH;
}

// Laufende Kosten je Spieltag: Anlagen, Jugendtrainer, Scouts.
function getAcademyUpkeep(gameState){
  const a = gameState && gameState.academy;
  if(!a) return 0;
  const skala = Math.sqrt((typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1) + 0.05);
  const anlagen = (a.infra * FACILITY_UPKEEP_PER_LEVEL + a.coaches * ACADEMY_COACH_UPKEEP) * skala;
  const spieltage = typeof getSeasonMatchdays === "function" ? getSeasonMatchdays(gameState) : TOTAL_MATCHDAYS;
  const scouts = (a.scouts || []).reduce((s, x) => s + getScoutSalary(gameState, x), 0) / spieltage;
  return Math.round((anlagen + scouts) / 1000) * 1000;
}

function getAcademyRepLabel(rep){
  if(rep >= 80) return "Weltklasse";
  if(rep >= 60) return "renommiert";
  if(rep >= 40) return "angesehen";
  if(rep >= 20) return "regional";
  return "unbekannt";
}

function changeAcademyReputation(gameState, delta, grund){
  const a = ensureAcademy(gameState);
  const vorher = a.reputation;
  a.reputation = Math.round(acClamp(a.reputation + delta, 0, 100) * 10) / 10;
  if(grund && Math.abs(a.reputation - vorher) >= 0.5){
    addAcademyLog(gameState, `${grund}: Ruf der Akademie ${delta > 0 ? "+" : ""}${Math.round(a.reputation - vorher)}.`, delta > 0 ? "📈" : "📉");
  }
}

// ---------- Schaetzung des Potenzials ----------

function isOwnPlayer(gameState, player){
  const id = player && player.id;
  if(!id) return false;
  if(player.isIntakeCandidate) return true;
  return (gameState.squad || []).some(p => p.id === id)
    || (gameState.youthSquad || []).some(p => p.id === id)
    || (gameState.loans || []).some(l => l.player && l.player.id === id);
}

// Spanne um den wahren Wert: frac legt fest, wo er in der Spanne liegt,
// off verschiebt sie (ein Scout, der sich irrt).
function buildPotentialRange(player, width, frac, off){
  const wahr = player.maxStrength;
  if(width <= 1 && !off) return { lo: Math.round(wahr), hi: Math.round(wahr), exact: true };
  let lo = wahr + (off || 0) - frac * width;
  let hi = lo + width;
  if(hi > 99){ lo -= hi - 99; hi = 99; }
  if(lo < player.strength){ hi += player.strength - lo; lo = player.strength; }
  return { lo: Math.round(lo), hi: Math.round(Math.min(99, hi)), exact: false };
}

// Wie gut kennt der Verein ein eigenes Talent? Jugendtrainer und Zeit im Verein.
function getOwnEstimateWidth(gameState, player){
  if(player.age >= ACADEMY_EST_EXACT_AGE) return 0;
  const a = ensureAcademy(gameState);
  let breite = ACADEMY_EST_BASE - a.coaches * ACADEMY_EST_PER_COACH
    - Math.floor((player.clubDays || 0) / ACADEMY_EST_MATCHDAYS_PER_POINT);
  if(player.estWidth != null) breite = Math.min(breite, player.estWidth);
  return Math.max(ACADEMY_EST_MIN, breite);
}

// Potenzial als Spanne (absolute Werte). Quelle: eigener Verein, gezielte
// Beobachtung, Scoutbericht oder nur die allgemeine Einschaetzung am Markt.
function getPotentialEstimate(gameState, player){
  if(!player) return { lo: 0, hi: 0, exact: true, source: "none" };
  if(isOwnPlayer(gameState, player)){
    const breite = getOwnEstimateWidth(gameState, player);
    if(breite <= 0) return { lo: Math.round(player.maxStrength), hi: Math.round(player.maxStrength), exact: true, source: "eigen" };
    return Object.assign(buildPotentialRange(player, breite, acHash(player.id, 11), 0), { source: "eigen" });
  }
  if(gameState.scouted && gameState.scouted[player.id]){
    return { lo: Math.round(player.maxStrength), hi: Math.round(player.maxStrength), exact: true, source: "beobachtet" };
  }
  const bericht = typeof findReportFor === "function" ? findReportFor(gameState, player.id) : null;
  if(bericht){
    const breite = getReportWidth(bericht);
    const miss = bericht.miss || 0;
    const range = miss
      ? buildPotentialRange(player, breite, 0.5, Math.sign(miss) * (breite / 2 + Math.abs(miss)))
      : buildPotentialRange(player, breite, bericht.frac, 0);
    return Object.assign(range, { source: "bericht", report: bericht });
  }
  const sterne = typeof getRegionStars === "function" ? getRegionStars(gameState, player.nat) : 0;
  const breite = Math.max(SCOUT_REPORT_MIN_WIDTH[5], SCOUT_RANGE_BASE - sterne * SCOUT_RANGE_PER_STAR);
  return Object.assign(buildPotentialRange(player, breite, acHash(player.id, 3), 0), { source: "markt" });
}

// Ausnahmetalent ist erst sichtbar, wenn man den Spieler gut kennt.
function isTalentVisible(gameState, player){
  if(!player || !player.isTalent) return false;
  const e = getPotentialEstimate(gameState, player);
  return e.exact || e.hi - e.lo <= 6;
}

// ---------- Entwicklung mit Risiko ----------

// Persoenliches Tempo, Mentor, Eingewoehnung: gilt fuer junge Spieler.
function getPersonalDevFactor(gameState, player){
  if(!player || player.age > DEV_RISK_MAX_AGE) return 1;
  let f = player.devSpeed || 1;
  f *= getMentorDevFactor(gameState, player);
  if(player.adaptSeason === gameState.season) f *= PROSPECT_ADAPT_DEV;
  return f;
}

// Potenzialgrenze verschieben (alle Attribute gleich), nie unter den Istwert.
function shiftPlayerPotential(player, delta){
  if(!player.maxAttributes || !player.attributes){
    player.maxStrength = Math.max(player.strength, Math.min(99, player.maxStrength + delta));
    return;
  }
  ATTRIBUTES.forEach(a => {
    const neu = player.maxAttributes[a] + delta;
    player.maxAttributes[a] = acClamp(neu, player.attributes[a] + (delta < 0 ? 0.5 : 0), ATTRIBUTE_MAX);
  });
  player.maxStrength = Math.round(getMaxAttributeRating(player) * 10) / 10;
  refreshPlayerValue(player);
}

function getPracticeScore(player){
  return (player.gradeCount || 0) + 0.6 * (player.youthApps || 0) + (player.loanPractice ? 20 * player.loanPractice : 0);
}

function getDevEventChances(gameState, player){
  const a = ensureAcademy(gameState);
  const praxis = getPracticeScore(player);
  const mentor = getMentor(gameState, player);
  const leader = mentor && typeof hasTrait === "function" && hasTrait(mentor, "fuehrung");
  const trait = k => typeof hasTrait === "function" && hasTrait(player, k);
  const moral = typeof getMorale === "function" ? getMorale(player) : 60;
  const durchbruch = DEV_BREAKTHROUGH_BASE + (praxis >= DEV_EVENT_PRACTICE_APPS ? 0.04 : 0)
    + a.coaches * 0.005 + (trait("fleiss") ? 0.03 : 0)
    + (mentor ? MENTOR_BREAKTHROUGH + (leader ? 0.02 : 0) : 0);
  const stagnation = Math.max(0.02, DEV_STAGNATION_BASE + (praxis < DEV_EVENT_LOW_PRACTICE ? 0.06 : 0)
    - a.coaches * 0.008 + (moral < 40 ? 0.04 : 0) + (trait("launisch") ? 0.03 : 0));
  return { durchbruch, stagnation, praxis };
}

// Saisonende: Durchbruch oder Stagnation fuer junge Spieler.
function rollDevelopmentEvents(gameState){
  const ereignisse = [];
  const junge = (gameState.squad || []).concat(gameState.youthSquad || []).filter(p => p.age <= DEV_RISK_MAX_AGE);
  junge.forEach(p => {
    const c = getDevEventChances(gameState, p);
    const w = Math.random();
    if(w < c.durchbruch){
      const d = randInt(DEV_BREAKTHROUGH_MIN, DEV_BREAKTHROUGH_MAX);
      shiftPlayerPotential(p, d);
      ereignisse.push({ type: "durchbruch", player: p, delta: d });
    } else if(w < c.durchbruch + c.stagnation){
      const d = randInt(DEV_STAGNATION_MIN, DEV_STAGNATION_MAX);
      shiftPlayerPotential(p, -d);
      ereignisse.push({ type: "stagnation", player: p, delta: -d });
    }
  });
  return ereignisse;
}

// ---------- Mentoren ----------

function getMentor(gameState, player){
  const a = gameState && gameState.academy;
  if(!a || !a.mentors || !player) return null;
  const id = a.mentors[player.id];
  return id ? (gameState.squad || []).find(p => p.id === id) || null : null;
}

function getMentee(gameState, mentor){
  const a = gameState && gameState.academy;
  if(!a || !mentor) return null;
  const id = Object.keys(a.mentors).find(k => a.mentors[k] === mentor.id);
  return id ? (gameState.squad || []).concat(gameState.youthSquad || []).find(p => p.id === id) || null : null;
}

function canMentor(gameState, mentor, mentee){
  if(!mentor || !mentee) return "Spieler nicht gefunden.";
  if(mentee.age > DEV_RISK_MAX_AGE) return `Mentoren gibt es nur für Spieler bis ${DEV_RISK_MAX_AGE}.`;
  if(mentor.age < MENTOR_MIN_AGE) return `Ein Mentor sollte mindestens ${MENTOR_MIN_AGE} sein.`;
  if(mentor.strength < mentee.strength + MENTOR_MIN_GAP) return "Der Mentor muss deutlich stärker sein.";
  if(getPositionLine(mentor.pos) !== getPositionLine(mentee.pos)) return "Mentor und Talent spielen in verschiedenen Mannschaftsteilen.";
  const anderer = getMentee(gameState, mentor);
  if(anderer && anderer.id !== mentee.id) return `${mentor.name} betreut schon ${anderer.name}.`;
  return null;
}

function getMentorCandidates(gameState, mentee){
  return (gameState.squad || []).filter(m => m.id !== mentee.id && !canMentor(gameState, m, mentee))
    .sort((a, b) => (hasTrait(b, "fuehrung") ? 5 : 0) + b.strength - (hasTrait(a, "fuehrung") ? 5 : 0) - a.strength);
}

function assignMentor(gameState, menteeId, mentorId){
  const a = ensureAcademy(gameState);
  const alle = (gameState.squad || []).concat(gameState.youthSquad || []);
  const mentee = alle.find(p => p.id === menteeId);
  if(!mentorId){
    if(mentee) delete a.mentors[mentee.id];
    return { success: true, message: mentee ? `${mentee.name} hat keinen Mentor mehr.` : "Mentor entfernt." };
  }
  const mentor = (gameState.squad || []).find(p => p.id === mentorId);
  const sperre = canMentor(gameState, mentor, mentee);
  if(sperre) return { success: false, message: sperre };
  a.mentors[mentee.id] = mentor.id;
  return { success: true, message: `🤝 ${mentor.name} wird Mentor von ${mentee.name}.` };
}

function getMentorDevFactor(gameState, player){
  const m = getMentor(gameState, player);
  if(!m) return 1;
  const tag = (gameState.matchday || 0) + 1;
  if(typeof isUnavailable === "function" && isUnavailable(m, tag)) return 1;
  return typeof hasTrait === "function" && hasTrait(m, "fuehrung") ? MENTOR_DEV_LEADER : MENTOR_DEV;
}

// Verwaiste Zuordnungen entfernen (Verkauf, Karriereende, zu alt).
function cleanMentors(gameState){
  const a = gameState.academy;
  if(!a || !a.mentors) return;
  const kader = new Set((gameState.squad || []).map(p => p.id));
  const alle = new Map((gameState.squad || []).concat(gameState.youthSquad || []).map(p => [p.id, p]));
  Object.keys(a.mentors).forEach(id => {
    const talent = alle.get(id);
    if(!talent || talent.age > DEV_RISK_MAX_AGE || !kader.has(a.mentors[id])) delete a.mentors[id];
  });
}

// ---------- Perspektive und Ausbildungsentschaedigung ----------

// Talente ohne Profivertrag, die gut genug fuer die erste Mannschaft werden.
function getPerspectiveCandidates(gameState){
  const team = teamRating(gameState.squad, (gameState.matchday || 0) + 1);
  const grenze = Math.max(60, team - PERSPECTIVE_BELOW_TEAM);
  return (gameState.youthSquad || []).filter(p => !p.hasProContract && p.age >= PERSPECTIVE_MIN_AGE
    && p.maxStrength >= grenze && (p.academySince != null ? p.academySince : gameState.season) < gameState.season);
}

// Nach gut der Haelfte der Saison melden sie sich.
function checkPerspectiveWarnings(gameState){
  const tag = Math.round(getSeasonMatchdays(gameState) * PERSPECTIVE_WARN_SHARE);
  if(gameState.matchday !== tag) return [];
  const neu = getPerspectiveCandidates(gameState).filter(p => p.wantsPerspective !== gameState.season);
  neu.forEach(p => {
    p.wantsPerspective = gameState.season;
    const text = `🗣️ ${p.name} (${p.age}, ${p.pos}) will eine Perspektive: Ohne Profivertrag bis Saisonende droht der Abschied.`;
    addLogEntry(gameState, text, "loss", true);
    addAcademyLog(gameState, text.slice(3), "🗣️");
  });
  return neu;
}

function getTrainingCompensation(gameState, player){
  const jahre = Math.max(1, gameState.season - (player.academySince != null ? player.academySince : gameState.season) + 1);
  const skala = Math.sqrt(typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1);
  const wert = TRAINING_COMP_BASE * jahre * (1 + Math.max(0, player.maxStrength - 70) / 10) * skala;
  return Math.round(wert / 10000) * 10000;
}

function getPerspectiveLeaveChance(gameState, player){
  let c = PERSPECTIVE_LEAVE_CHANCE;
  if(typeof hasTrait === "function" && hasTrait(player, "treu")) c *= 0.5;
  if(typeof hasTrait === "function" && hasTrait(player, "launisch")) c *= 1.5;
  if(player.poachRejected === gameState.season) c += 0.15;
  return Math.min(0.9, c);
}

// Saisonende: wer gewarnt hat und keinen Profivertrag bekam, geht vielleicht.
function resolvePerspectives(gameState){
  const gehen = [];
  (gameState.youthSquad || []).slice().forEach(p => {
    if(p.wantsPerspective !== gameState.season || p.hasProContract) return;
    if(Math.random() >= getPerspectiveLeaveChance(gameState, p)) return;
    const geld = getTrainingCompensation(gameState, p);
    const ziel = typeof findNewClubFor === "function"
      ? (buildPoolClubList(gameState).filter(c => c.strength >= getOwnClubStrength(gameState)).sort(() => Math.random() - 0.5)[0] || findNewClubFor(gameState, p))
      : null;
    gameState.youthSquad = gameState.youthSquad.filter(x => x.id !== p.id);
    gameState.budget = addToBudget(gameState.budget, geld);
    delete p.isYouthSquad; delete p.wantsPerspective;
    if(gameState.pool){
      Object.assign(p, { clubName: ziel ? ziel.name : null, clubTier: ziel ? ziel.tier : "frei", transferListed: false,
        contractYears: randInt(2, 4), leftClub: gameState.clubName, leftSeason: gameState.season });
      gameState.pool.players.push(p);
    }
    gehen.push({ player: p, club: ziel ? ziel.name : "einem anderen Verein", fee: geld });
  });
  return gehen;
}

// ---------- Saisonende ----------

// Vor dem Altern: Wettbewerbe, Entwicklung, Perspektive, Ruf, Scouting.
function runAcademySeasonEnd(gameState){
  const a = ensureAcademy(gameState);
  const titel = typeof finishYouthCompetitions === "function" ? finishYouthCompetitions(gameState) : [];

  const ereignisse = rollDevelopmentEvents(gameState);
  ereignisse.forEach(e => {
    const text = e.type === "durchbruch"
      ? `🚀 Durchbruch: ${e.player.name} (${e.player.age}) macht einen Sprung, das Potenzial steigt.`
      : `📉 ${e.player.name} (${e.player.age}) stagniert, das Potenzial sinkt.`;
    addLogEntry(gameState, text, e.type === "durchbruch" ? "win" : "loss");
    addAcademyLog(gameState, text.slice(3), e.type === "durchbruch" ? "🚀" : "📉");
  });

  const gegangen = resolvePerspectives(gameState);
  gegangen.forEach(g => {
    const text = `👋 ${g.player.name} verweigert den Profivertrag und wechselt zu ${g.club}. Ausbildungsentschädigung ${fmtMoney(g.fee)}.`;
    addLogEntry(gameState, text, "loss", true);
    addAcademyLog(gameState, text.slice(3), "👋");
  });

  // Ruf: Eigengewaechse mit Profieinsaetzen, dann ein Stueck zurueck zum Grundwert.
  const profis = (gameState.squad || []).filter(p => p.isYouthProduct && (p.gradeCount || 0) >= ACADEMY_REP_PRODUCT_APPS).length;
  if(profis > 0) changeAcademyReputation(gameState, Math.min(4, profis) * ACADEMY_REP_PER_PRODUCT, `${profis} ${profis === 1 ? "Eigengewächs" : "Eigengewächse"} mit Profieinsätzen`);
  a.reputation = Math.round((a.reputation + (a.repBase - a.reputation) * ACADEMY_REP_DECAY) * 10) / 10;

  (gameState.squad || []).concat(gameState.youthSquad || []).forEach(p => { p.youthApps = 0; delete p.loanPractice; });
  cleanMentors(gameState);
  if(typeof advanceScoutingSeason === "function") advanceScoutingSeason(gameState);
  return { titel, ereignisse, gegangen };
}

// Je Spieltag: Talente lernt man besser kennen, Warnungen, Scouts.
function advanceAcademyMatchday(gameState){
  ensureAcademy(gameState);
  (gameState.youthSquad || []).forEach(p => { p.clubDays = (p.clubDays || 0) + 1; });
  (gameState.squad || []).forEach(p => { if(p.age <= DEV_RISK_MAX_AGE) p.clubDays = (p.clubDays || 0) + 1; });
  checkPerspectiveWarnings(gameState);
  cleanMentors(gameState);
  if(typeof runScoutingMatchday === "function") runScoutingMatchday(gameState);
}
