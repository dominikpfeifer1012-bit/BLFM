// ============================================
// IDENTITY.JS - Vereinsidentitaet
// ============================================
// Jeder Verein hat ein Profil. Es bestimmt Budget, Einnahmen, Anspruch und
// Geduld des Vorstands, die Jugendarbeit, Verkaufserloese und die
// Nebenziele, die der Vorstand jede Saison zusaetzlich setzt. Profile koennen
// sich aendern: steigt ein Investor ein, wird der Verein zum Investorenklub.

// budget/revenue: Faktoren auf Startbudget und Einnahmen.
// patience: wie hart Rueckschlaege den Vorstand treffen (1 = normal).
// target: Verschiebung des Zielplatzes (-1 = ein Platz besser gefordert).
// youth: Bonus fuer Jugendkandidaten, youthDev: Entwicklung bis 21 Jahre.
// sell: Faktor auf Verkaufserloese.
const CLUB_PROFILES = {
  gross: { label: "Großklub", icon: "👑", budget: 1.25, revenue: 1.15, patience: 1.3, target: -1,
    youth: { strength: 0, potential: 0 }, youthDev: 1, sell: 1,
    goals: ["titel", "europa_runde", "marktwert"],
    text: "Hohe Erwartungen, großes Budget, ungeduldiger Vorstand." },
  investor: { label: "Investorenklub", icon: "💼", budget: 1.5, revenue: 0.9, patience: 1.25, target: -1,
    youth: { strength: 0, potential: 0 }, youthDev: 1, sell: 1,
    goals: ["europa_platz", "europa_runde", "marktwert", "titel"],
    text: "Viel Geld vom Geldgeber, schneller Erfolg wird erwartet." },
  ausbildung: { label: "Ausbildungsverein", icon: "🌱", budget: 0.9, revenue: 0.95, patience: 0.85, target: 0,
    youth: { strength: 3, potential: 5 }, youthDev: 1.2, sell: 1.15,
    goals: ["eigengewaechse", "u23", "transferplus", "jung"],
    text: "Bessere Talente, junge Spieler entwickeln sich schneller, Verkäufe bringen mehr." },
  tradition: { label: "Traditionsverein", icon: "🏟️", budget: 1, revenue: 1.2, patience: 1.15, target: -1,
    youth: { strength: 1, potential: 1 }, youthDev: 1, sell: 1,
    goals: ["heim", "pokal", "derby"],
    text: "Große Fanbasis und hohe Einnahmen, unruhiges Umfeld." },
  kult: { label: "Kultklub", icon: "🏴", budget: 0.85, revenue: 1.1, patience: 0.7, target: 1,
    youth: { strength: 1, potential: 2 }, youthDev: 1.05, sell: 1,
    goals: ["eigengewaechse", "u23", "gehalt", "heim", "derby"],
    text: "Treue Fans, geduldiger Vorstand, wenig Geld." },
  solide: { label: "Solider Verein", icon: "🔧", budget: 0.95, revenue: 1, patience: 0.9, target: 0,
    youth: { strength: 0, potential: 1 }, youthDev: 1, sell: 1.05,
    goals: ["gehalt", "transferplus", "pokal"],
    text: "Solide Finanzen, sachlicher Vorstand." }
};
const CLUB_PROFILE_ORDER = ["gross", "investor", "ausbildung", "tradition", "kult", "solide"];

// Zuordnung nach Stand 2026. Vereine ohne Eintrag bekommen ein Profil nach
// Staerke (Spitzenvereine eines Landes werden Grossklubs, sonst solide).
const CLUB_PROFILE_MAP = {
  // Deutschland
  "FC Bayern München": "gross", "Borussia Dortmund": "gross",
  "RB Leipzig": "investor", "TSG Hoffenheim": "investor", "Bayer Leverkusen": "investor", "VfL Wolfsburg": "investor",
  "FC Ingolstadt 04": "investor",
  "SC Freiburg": "ausbildung", "1. FSV Mainz 05": "ausbildung", "VfB Stuttgart": "ausbildung", "Eintracht Frankfurt": "ausbildung",
  "VfB Stuttgart II": "ausbildung", "TSG Hoffenheim II": "ausbildung", "FC Bayern München II": "ausbildung", "SC Freiburg II": "ausbildung",
  "Borussia Mönchengladbach": "tradition", "Werder Bremen": "tradition", "Hamburger SV": "tradition", "FC Schalke 04": "tradition",
  "1. FC Köln": "tradition", "Hannover 96": "tradition", "1. FC Kaiserslautern": "tradition", "Hertha BSC": "tradition",
  "VfL Bochum": "tradition", "1. FC Nürnberg": "tradition", "Karlsruher SC": "tradition", "Dynamo Dresden": "tradition",
  "Arminia Bielefeld": "tradition", "1. FC Magdeburg": "tradition", "VfL Osnabrück": "tradition", "Energie Cottbus": "tradition",
  "Eintracht Braunschweig": "tradition", "Fortuna Düsseldorf": "tradition", "Rot-Weiss Essen": "tradition", "MSV Duisburg": "tradition",
  "Preußen Münster": "tradition", "Hansa Rostock": "tradition", "Alemannia Aachen": "tradition", "SV Waldhof Mannheim": "tradition",
  "1. FC Saarbrücken": "tradition", "TSV 1860 München": "tradition", "Kickers Offenbach": "tradition", "FC Erzgebirge Aue": "tradition",
  "Rot-Weiß Oberhausen": "tradition", "Wuppertaler SV": "tradition", "FC Carl Zeiss Jena": "tradition", "Chemnitzer FC": "tradition",
  "1. FC Lokomotive Leipzig": "tradition", "Hallescher FC": "tradition", "SV Meppen": "tradition",
  "FC St. Pauli": "kult", "1. FC Union Berlin": "kult", "SV Darmstadt 98": "kult",
  // England
  "Manchester United": "gross", "FC Liverpool": "gross", "FC Arsenal": "gross", "Tottenham Hotspur": "gross",
  "Manchester City": "investor", "FC Chelsea": "investor", "Newcastle United": "investor", "Nottingham Forest": "investor",
  "AFC Wrexham": "investor",
  "Brighton & Hove Albion": "ausbildung", "FC Brentford": "ausbildung", "FC Southampton": "ausbildung", "Crystal Palace": "ausbildung",
  "FC Everton": "tradition", "Aston Villa": "tradition", "Leeds United": "tradition", "AFC Sunderland": "tradition",
  "West Ham United": "tradition", "Wolverhampton Wanderers": "tradition", "Sheffield United": "tradition", "Sheffield Wednesday": "tradition",
  "Derby County": "tradition", "Blackburn Rovers": "tradition", "Bolton Wanderers": "tradition", "Ipswich Town": "tradition",
  "FC Middlesbrough": "tradition", "Coventry City": "tradition", "FC Portsmouth": "tradition", "Stoke City": "tradition",
  "West Bromwich Albion": "tradition", "Birmingham City": "tradition", "Norwich City": "tradition", "Leicester City": "tradition",
  "FC Millwall": "kult", "Charlton Athletic": "kult",
  // Spanien
  "Real Madrid": "gross", "FC Barcelona": "gross", "Atlético Madrid": "gross",
  "FC Girona": "investor", "UD Almería": "investor", "FC Andorra": "investor",
  "Athletic Bilbao": "ausbildung", "Real Sociedad": "ausbildung", "FC Villarreal": "ausbildung", "FC Valencia": "ausbildung",
  "Celta Vigo": "ausbildung", "UD Las Palmas": "ausbildung", "CD Mirandés": "ausbildung",
  "FC Sevilla": "tradition", "Real Betis Sevilla": "tradition", "Espanyol Barcelona": "tradition", "Deportivo La Coruña": "tradition",
  "Real Saragossa": "tradition", "Sporting Gijón": "tradition", "Real Oviedo": "tradition", "FC Málaga": "tradition",
  "Racing Santander": "tradition", "FC Cádiz": "tradition", "Real Valladolid": "tradition", "Hércules Alicante": "tradition",
  "Real Murcia": "tradition", "FC Córdoba": "tradition", "FC Granada": "tradition",
  "Rayo Vallecano": "kult", "CA Osasuna": "kult", "Cultural Leonesa": "kult",
  // Italien
  "Inter Mailand": "gross", "AC Mailand": "gross", "Juventus Turin": "gross", "SSC Neapel": "gross",
  "Como 1907": "investor", "Parma Calcio": "investor", "US Palermo": "investor", "FC Venedig": "investor",
  "Atalanta Bergamo": "ausbildung", "Udinese Calcio": "ausbildung", "US Sassuolo": "ausbildung", "FC Empoli": "ausbildung",
  "US Lecce": "ausbildung", "Spezia Calcio": "ausbildung",
  "AS Rom": "tradition", "Lazio Rom": "tradition", "AC Florenz": "tradition", "FC Turin": "tradition", "CFC Genua": "tradition",
  "Sampdoria Genua": "tradition", "FC Bologna": "tradition", "Cagliari Calcio": "tradition", "Hellas Verona": "tradition",
  "SSC Bari": "tradition", "Catania FC": "tradition", "US Salernitana": "tradition", "Delfino Pescara": "tradition",
  "AC Perugia": "tradition", "US Triestina": "tradition", "Calcio Padova": "tradition", "LR Vicenza": "tradition",
  "US Avellino": "tradition", "AC Monza": "solide",
  // Frankreich
  "Olympique Marseille": "gross",
  "Paris Saint-Germain": "investor", "AS Monaco": "investor", "OGC Nizza": "investor", "Racing Straßburg": "investor",
  "Paris FC": "investor", "ES Troyes AC": "investor",
  "Olympique Lyon": "ausbildung", "OSC Lille": "ausbildung", "Stade Rennes": "ausbildung", "Le Havre AC": "ausbildung",
  "AJ Auxerre": "ausbildung", "FC Metz": "ausbildung", "Stade Reims": "ausbildung", "FC Sochaux": "ausbildung",
  "RC Lens": "tradition", "AS Saint-Étienne": "tradition", "FC Nantes": "tradition", "Stade Malherbe Caen": "tradition",
  "Nîmes Olympique": "tradition", "AS Nancy": "tradition",
  "SC Bastia": "kult", "Red Star Paris": "kult", "EA Guingamp": "kult"
};

// Spitzenvereine eines Landes ohne Eintrag gelten als Grossklub.
const CLUB_PROFILE_GROSS_FROM = 86;

function getDefaultClubProfile(name, strength){
  if(CLUB_PROFILE_MAP[name]) return CLUB_PROFILE_MAP[name];
  if(strength >= CLUB_PROFILE_GROSS_FROM) return "gross";
  if(/ II$/.test(name)) return "ausbildung";
  return "solide";
}

function allProfiledClubs(gameState){
  const ligen = typeof getAllLeagueClubs === "function" ? getAllLeagueClubs(gameState) : [];
  const reserve = Object.values(gameState.reservePools || {}).flat();
  return ligen.concat(reserve);
}

// Jeder Verein bekommt einmal sein Profil; es wandert mit dem Vereinsobjekt.
function ensureClubProfiles(gameState){
  allProfiledClubs(gameState).forEach(c => {
    if(!c.profile || !CLUB_PROFILES[c.profile]) c.profile = getDefaultClubProfile(c.name, c.baseStrength || c.strength);
    if(!c.profileOrigin) c.profileOrigin = c.profile;
  });
}

// Bevorzugtes System jedes Vereins, gewichtet ausgelost.
function rollClubFormation(){
  const eintraege = Object.entries(CLUB_FORMATION_WEIGHTS).filter(([n]) => FORMATIONS[n]);
  let wurf = Math.random() * eintraege.reduce((s, [, g]) => s + g, 0);
  for(const [name, g] of eintraege){ wurf -= g; if(wurf <= 0) return name; }
  return DEFAULT_FORMATION;
}

function ensureClubFormations(gameState){
  allProfiledClubs(gameState).forEach(c => { if(!c.formation || !FORMATIONS[c.formation]) c.formation = rollClubFormation(); });
}

function getClubFormation(gameState, name){
  const club = gameState && gameState.leaguePools ? allProfiledClubs(gameState).find(c => c.name === name) : null;
  return club && FORMATIONS[club.formation] ? club.formation : DEFAULT_FORMATION;
}

function getClubProfileKey(gameState, name){
  const gs = gameState || (typeof window !== "undefined" ? window.gameState : null);
  const club = gs && gs.leaguePools ? allProfiledClubs(gs).find(c => c.name === name) : null;
  if(club && club.profile && CLUB_PROFILES[club.profile]) return club.profile;
  const basis = DIVISIONS.flatMap(d => d.clubs).find(c => c.name === name);
  return getDefaultClubProfile(name, basis ? basis.strength : 60);
}

function getClubProfile(gameState, name){
  return CLUB_PROFILES[getClubProfileKey(gameState, name)];
}

function getOwnProfile(gameState){
  const gs = gameState || (typeof window !== "undefined" ? window.gameState : null);
  if(!gs || !gs.clubName) return CLUB_PROFILES.solide;
  return getClubProfile(gs, gs.clubName);
}

// Startbudget eines Vereins inklusive Profil.
function getClubStartBudget(gameState, name, strength){
  return Math.round(calculateStartingBudget(strength) * getClubProfile(gameState, name).budget / 50000) * 50000;
}

function getProfileBadge(gameState, name, mitText){
  const p = getClubProfile(gameState, name);
  return `<span class="profileTag" title="${p.label}: ${p.text}">${p.icon}${mitText ? " " + p.label : ""}</span>`;
}

// Profilwechsel durch Ereignisse (Investor steigt ein oder zieht sich zurueck).
function setClubProfile(club, key){
  if(!CLUB_PROFILES[key]) return false;
  if(!club.profileOrigin) club.profileOrigin = club.profile || key;
  const vorher = club.profile;
  club.profile = key;
  return vorher !== key;
}

// ---------- Eigener Verein: Investor kommt, Investor geht ----------

function rollOwnClubOwnership(gameState){
  const club = typeof findClubEverywhere === "function" ? findClubEverywhere(gameState, gameState.clubName) : null;
  if(!club) return null;
  if(club.profile === "investor" && club.profileOrigin !== "investor" && Math.random() < OWN_INVESTOR_LEAVE_CHANCE){
    setClubProfile(club, club.profileOrigin);
    return { type: "abzug", text: `Der Investor zieht sich bei ${club.name} zurück. Der Verein ist wieder ${CLUB_PROFILES[club.profile].label}.` };
  }
  if(["tradition", "solide", "ausbildung"].includes(club.profile) && Math.random() < OWN_INVESTOR_ARRIVE_CHANCE){
    setClubProfile(club, "investor");
    const geld = Math.round(calculateStartingBudget(club.strength) * OWN_INVESTOR_CASH / 50000) * 50000;
    gameState.budget = addToBudget(gameState.budget, geld);
    return { type: "einstieg", text: `Ein Investor steigt bei ${club.name} ein: ${fmtMoney(geld)} für Transfers. Der Vorstand erwartet jetzt mehr.` };
  }
  return null;
}

// ---------- Nebenziele ----------
// Neben dem Tabellenziel setzt der Vorstand je Saison zwei Ziele, die zum
// Profil passen. Erfuellt: Vertrauen und Geld, verfehlt: etwas Vertrauen.

function getCupRoundsWon(gameState){
  const cup = gameState.cup;
  if(!cup) return 0;
  if(cup.champion === gameState.clubName) return 99;
  return cup.eliminated ? Math.max(0, (cup.exitRound || 1) - 1) : (cup.round || 0);
}

function reachedUefaStage(gameState, stage){
  const u = gameState.uefa;
  const comp = u && u.own && u.comps ? u.comps[u.own] : null;
  if(!comp) return false;
  return (comp.koHistory || []).some(h => h.stage >= stage && h.ties.some(t => t.a === gameState.clubName || t.b === gameState.clubName))
    || comp.winner === gameState.clubName;
}

function getOwnPosition(gameState){
  const tab = getSortedStandings(gameState.teams || []);
  return tab.findIndex(t => t.name === gameState.clubName) + 1;
}

// available: ob das Ziel in dieser Saison Sinn ergibt; check: { met, stand }.
const SIDE_GOALS = {
  titel: {
    label: () => "Meisterschaft, Pokal oder Europapokal gewinnen",
    available: gs => (getStrengthRankInDivision(getOwnClubStrength(gs), gs.division) || 99) <= 3,
    check: gs => {
      const meister = getOwnPosition(gs) === 1 && gs.matchday >= getSeasonMatchdays(gs);
      const pokal = gs.cup && gs.cup.champion === gs.clubName;
      const u = gs.uefa, europa = u && u.own && u.comps && u.comps[u.own].winner === gs.clubName;
      const met = !!(meister || pokal || europa);
      return { met, stand: met ? "gewonnen" : "offen" };
    }
  },
  europa_runde: {
    label: () => "Europapokal: Achtelfinale erreichen",
    available: gs => !!(gs.uefa && gs.uefa.own),
    check: gs => { const met = reachedUefaStage(gs, 1); return { met, stand: met ? "erreicht" : "offen" }; }
  },
  europa_platz: {
    label: () => "Platz 6 oder besser",
    available: gs => isTopDivision(gs.division) && gs.board && gs.board.targetPosition > 6,
    check: gs => { const p = getOwnPosition(gs); return { met: p > 0 && p <= 6, stand: `Platz ${p}` }; }
  },
  marktwert: {
    label: () => "Kaderwert um 10 % steigern",
    baseline: gs => gs.squad.reduce((s, p) => s + p.value, 0),
    available: () => true,
    check: (gs, z) => {
      const jetzt = gs.squad.reduce((s, p) => s + p.value, 0);
      const pct = z.baseline ? Math.round((jetzt / z.baseline - 1) * 100) : 0;
      return { met: pct >= 10, stand: `${pct >= 0 ? "+" : ""}${pct} %` };
    }
  },
  eigengewaechse: {
    label: () => "2 Eigengewächse mit je 10 Einsätzen",
    // Erst sinnvoll, wenn es Eigengewaechse im Verein gibt.
    available: gs => gs.squad.concat(gs.youthSquad || []).filter(p => p.isYouthProduct).length >= 2,
    check: gs => {
      const n = gs.squad.filter(p => p.isYouthProduct && (p.gradeCount || 0) >= 10).length;
      return { met: n >= 2, stand: `${n} von 2` };
    }
  },
  u23: {
    label: () => "3 Spieler unter 23 mit je 10 Einsätzen",
    available: () => true,
    check: gs => {
      const n = gs.squad.filter(p => p.age < 23 && (p.gradeCount || 0) >= 10).length;
      return { met: n >= 3, stand: `${n} von 3` };
    }
  },
  transferplus: {
    label: () => "Transferüberschuss erzielen",
    available: () => true,
    check: gs => {
      const saldo = (gs.seasonTransferIn || 0) - (gs.seasonTransferOut || 0);
      return { met: saldo > 0, stand: `${saldo >= 0 ? "+" : "−"}${fmtMoney(Math.abs(saldo))}` };
    }
  },
  jung: {
    label: () => "Altersschnitt unter 26 Jahren",
    available: () => true,
    check: gs => {
      const schnitt = gs.squad.reduce((s, p) => s + p.age, 0) / Math.max(1, gs.squad.length);
      return { met: schnitt < 26, stand: `${schnitt.toFixed(1).replace(".", ",")} Jahre` };
    }
  },
  heim: {
    label: () => "Höchstens 3 Heimniederlagen",
    available: () => true,
    check: gs => {
      const n = getOwnResults(gs).filter(r => r.isHome && r.result === "loss").length;
      return { met: n <= 3, stand: `${n} Heimniederlagen` };
    }
  },
  pokal: {
    label: gs => `${typeof getCupName === "function" ? getCupName(gs) : "Pokal"}: Viertelfinale erreichen`,
    available: gs => !!gs.cup,
    check: gs => { const n = getCupRoundsWon(gs); return { met: n >= 2, stand: n >= 99 ? "Sieger" : `${n} Runden überstanden` }; }
  },
  gehalt: {
    label: () => "Gehaltskosten höchstens 10 % über Saisonbeginn",
    baseline: gs => getSquadSalaryTotal(gs.squad),
    available: () => true,
    check: (gs, z) => {
      const jetzt = getSquadSalaryTotal(gs.squad);
      const pct = z.baseline ? Math.round((jetzt / z.baseline - 1) * 100) : 0;
      return { met: pct <= 10, stand: `${pct >= 0 ? "+" : ""}${pct} %` };
    }
  },
  derby: {
    label: () => "Kein Derby verlieren",
    available: gs => typeof getOwnDerbyOpponents === "function" && getOwnDerbyOpponents(gs).length > 0,
    check: gs => {
      const gegner = typeof getOwnDerbyOpponents === "function" ? getOwnDerbyOpponents(gs) : [];
      const spiele = getOwnResults(gs).filter(r => gegner.includes(r.opponent));
      const niederlagen = spiele.filter(r => r.result === "loss").length;
      return { met: niederlagen === 0, stand: `${spiele.length} gespielt, ${niederlagen} verloren` };
    }
  }
};

function setupSideGoals(gameState){
  if(!gameState.board) return [];
  const profil = getOwnProfile(gameState);
  const moeglich = shuffleArray(profil.goals.filter(k => SIDE_GOALS[k] && SIDE_GOALS[k].available(gameState)));
  // Fuellen mit allgemeinen Zielen, falls das Profil zu wenige hergibt.
  ["transferplus", "heim", "gehalt"].forEach(k => { if(!moeglich.includes(k)) moeglich.push(k); });
  gameState.board.sideGoals = moeglich.slice(0, SIDE_GOAL_COUNT).map(key => {
    const def = SIDE_GOALS[key];
    return { key, label: def.label(gameState), baseline: def.baseline ? def.baseline(gameState) : null };
  });
  return gameState.board.sideGoals;
}

function getSideGoalStatus(gameState){
  const ziele = (gameState.board && gameState.board.sideGoals) || [];
  return ziele.map(z => {
    const def = SIDE_GOALS[z.key];
    const r = def ? def.check(gameState, z) : { met: false, stand: "" };
    return Object.assign({}, z, r);
  });
}

// Saisonende: Nebenziele auswerten, Vertrauen und Geld verbuchen.
function evaluateSideGoals(gameState){
  const board = gameState.board;
  if(!board || board.dismissed) return [];
  const ergebnis = getSideGoalStatus(gameState);
  const skala = typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1;
  ergebnis.forEach(z => {
    if(z.met){
      const geld = Math.round(SIDE_GOAL_REWARD * skala / 50000) * 50000;
      board.patience = Math.min(BOARD_MAX_PATIENCE, board.patience + SIDE_GOAL_PATIENCE_MET);
      gameState.budget = addToBudget(gameState.budget, geld);
      z.reward = geld;
      addLogEntry(gameState, `🎯 Nebenziel erreicht: ${z.label} (${z.stand}) · +${fmtMoney(geld)}`, "win", true);
    } else {
      board.patience = Math.max(1, board.patience - SIDE_GOAL_PATIENCE_MISSED);
      addLogEntry(gameState, `🎯 Nebenziel verfehlt: ${z.label} (${z.stand})`, "loss");
    }
  });
  return ergebnis;
}

// ---------- Oberflaeche ----------

function renderIdentityBlock(gameState){
  const p = getOwnProfile(gameState);
  const ziele = getSideGoalStatus(gameState);
  const eff = [];
  const pct = f => `${f > 1 ? "+" : "−"}${Math.round(Math.abs(f - 1) * 100)} %`;
  if(p.budget !== 1) eff.push(`Budget ${pct(p.budget)}`);
  if(p.revenue !== 1) eff.push(`Einnahmen ${pct(p.revenue)}`);
  if(p.youth.strength || p.youth.potential) eff.push(`Talente +${p.youth.strength}/+${p.youth.potential}`);
  if(p.sell !== 1) eff.push(`Verkäufe ${pct(p.sell)}`);
  if(p.patience !== 1) eff.push(p.patience > 1 ? "ungeduldiger Vorstand" : "geduldiger Vorstand");
  return `<p class="eyebrow" style="margin-top:12px;">Vereinsprofil</p>
    <p style="margin:2px 0 4px;"><b>${p.icon} ${p.label}</b></p>
    <p class="muted" style="margin:0 0 8px; font-size:12px;">${eff.join(" · ")}</p>
    ${ziele.length ? `<p class="eyebrow">Nebenziele</p>
      ${ziele.map(z => `<p style="margin:2px 0;">${z.met ? "✅" : "⬜"} ${z.label} <span class="muted">· ${z.stand}</span></p>`).join("")}` : ""}`;
}

function updateClubProfileInfo(){
  const sel = document.getElementById("clubSelect");
  const el = document.getElementById("clubProfileInfo");
  if(!sel || !el) return;
  const p = getClubProfile(null, sel.value);
  el.innerHTML = `${p.icon} <b>${p.label}</b> · ${p.text}`;
}
