// ============================================
// PHILOSOPHY.JS - Spielphilosophie und Derbys
// ============================================
// Die Philosophie des Trainers gibt der Mannschaft eine Handschrift mit
// Staerken und Kosten. Sie passt mehr oder weniger zum Profil eines Vereins;
// das merken Vorstand und Vereine, die einen Trainer suchen.
// Derbys sind enger, emotionaler und wiegen fuer Fans und Vorstand mehr.

// att/def: Staerkepunkte, je nach Kraefteverhaeltnis (ahead = mindestens so stark wie der Gegner).
const PHILOSOPHIES = {
  ballbesitz: { label: "Ballbesitz", icon: "🎼", text: "Dominant gegen Schwächere, anfällig als Außenseiter.",
    ahead: { att: 0.6, def: 0.2 }, behind: { att: -0.4, def: -0.3 }, fatigue: 1, injury: 1, youthDev: 1, youthPotential: 0 },
  pressing: { label: "Gegenpressing", icon: "⚡", text: "Mehr Tore und weniger Gegentore, aber höhere Belastung.",
    ahead: { att: 0.6, def: 0.2 }, behind: { att: 0.6, def: 0.2 }, fatigue: 1.35, injury: 1.25, youthDev: 1, youthPotential: 0 },
  konter: { label: "Konterfußball", icon: "🏹", text: "Stark als Außenseiter, gegen tiefe Gegner harmlos.",
    ahead: { att: -0.4, def: 0.1 }, behind: { att: 0.6, def: 0.4 }, fatigue: 1, injury: 1, youthDev: 1, youthPotential: 0 },
  defensive: { label: "Defensivkunst", icon: "🧱", text: "Wenig Gegentore, wenig Spektakel.",
    ahead: { att: -0.6, def: 0.8 }, behind: { att: -0.6, def: 0.8 }, fatigue: 1, injury: 1, youthDev: 1, youthPotential: 0 },
  jugend: { label: "Jugendförderung", icon: "🌱", text: "Junge Spieler entwickeln sich schneller, Talente sind besser.",
    ahead: { att: 0, def: 0 }, behind: { att: 0, def: 0 }, fatigue: 1, injury: 1, youthDev: 1.15, youthPotential: 2 }
};
const PHILOSOPHY_ORDER = ["ballbesitz", "pressing", "konter", "defensive", "jugend"];
// Aeltere Spielstaende haben noch keine Philosophie: ohne Wirkung, frei waehlbar.
const PHILOSOPHY_NONE = { label: "Keine", icon: "–", text: "Noch keine Philosophie gewählt.",
  ahead: { att: 0, def: 0 }, behind: { att: 0, def: 0 }, fatigue: 1, injury: 1, youthDev: 1, youthPotential: 0 };

// Welche Philosophien zu welchem Vereinsprofil passen.
const PHILOSOPHY_FIT = {
  gross: ["ballbesitz"], investor: ["ballbesitz", "pressing"], ausbildung: ["jugend", "pressing"],
  tradition: ["pressing", "konter"], kult: ["pressing", "jugend"], solide: ["defensive", "konter"]
};

function getPhilosophy(gameState){
  const gs = gameState || (typeof window !== "undefined" ? window.gameState : null);
  return (gs && PHILOSOPHIES[gs.philosophy]) || PHILOSOPHY_NONE;
}

function philosophyFitsClub(gameState, clubName, key){
  const profil = typeof getClubProfileKey === "function" ? getClubProfileKey(gameState, clubName) : "solide";
  return (PHILOSOPHY_FIT[profil] || []).includes(key || (gameState && gameState.philosophy));
}

// Wirkung im Spiel, abhaengig vom Kraefteverhaeltnis.
function applyPhilosophy(gameState, own, opp){
  const ph = getPhilosophy(gameState);
  const wert = own.attack + own.defence >= opp.attack + opp.defence ? ph.ahead : ph.behind;
  return Object.assign({}, own, { attack: own.attack + wert.att, defence: own.defence + wert.def });
}

function canChangePhilosophy(gameState){
  return gameState.matchday === 0 || gameState.seasonEnded || !PHILOSOPHIES[gameState.philosophy];
}

function handlePhilosophyChange(key){
  if(!PHILOSOPHIES[key] || !canChangePhilosophy(gameState)) return;
  gameState.philosophy = key;
  addLogEntry(gameState, `${PHILOSOPHIES[key].icon} Spielphilosophie: ${PHILOSOPHIES[key].label}.`);
  showToast(`Philosophie: ${PHILOSOPHIES[key].label}`, "info");
  if(typeof renderBoardPanel === "function") renderBoardPanel(gameState);
}

function renderPhilosophyBlock(gameState){
  const ph = getPhilosophy(gameState);
  const passt = philosophyFitsClub(gameState, gameState.clubName);
  const wahl = canChangePhilosophy(gameState)
    ? `<select onchange="handlePhilosophyChange(this.value)">${PHILOSOPHIES[gameState.philosophy] ? "" : '<option value="" selected>Wählen …</option>'}${PHILOSOPHY_ORDER.map(k =>
        `<option value="${k}"${k === gameState.philosophy ? " selected" : ""}>${PHILOSOPHIES[k].icon} ${PHILOSOPHIES[k].label}</option>`).join("")}</select>`
    : `<b>${ph.icon} ${ph.label}</b>`;
  return `<p class="eyebrow" style="margin-top:12px;">Spielphilosophie</p>
    <p style="margin:2px 0 2px;">${wahl} ${PHILOSOPHIES[gameState.philosophy] ? `<span class="muted" style="font-size:12px;">${passt ? "· passt zum Verein" : "· passt nicht zum Profil"}</span>` : ""}</p>
    <p class="muted" style="margin:0 0 6px; font-size:12px;">${ph.text}${canChangePhilosophy(gameState) ? "" : " · Wechsel nur zwischen den Saisons"}</p>`;
}

// ---------- Derbys ----------

const DERBIES = [
  // Deutschland
  ["Borussia Dortmund", "FC Schalke 04", "Revierderby"], ["FC Bayern München", "Borussia Dortmund", "Der Klassiker"],
  ["Hamburger SV", "Werder Bremen", "Nordderby"], ["Hamburger SV", "FC St. Pauli", "Hamburger Stadtderby"],
  ["1. FC Köln", "Borussia Mönchengladbach", "Rheinisches Derby"], ["1. FC Köln", "Fortuna Düsseldorf", "Rheinderby"],
  ["FC Bayern München", "TSV 1860 München", "Münchner Stadtderby"], ["1. FC Union Berlin", "Hertha BSC", "Berliner Stadtderby"],
  ["Eintracht Frankfurt", "Kickers Offenbach", "Mainderby"], ["VfB Stuttgart", "Karlsruher SC", "Baden-Württemberg-Derby"],
  ["1. FC Nürnberg", "SpVgg Greuther Fürth", "Frankenderby"], ["Hannover 96", "Eintracht Braunschweig", "Niedersachsenderby"],
  ["VfL Bochum", "FC Schalke 04", "Revierderby"], ["1. FC Kaiserslautern", "1. FC Saarbrücken", "Südwestderby"],
  ["Arminia Bielefeld", "SC Paderborn 07", "OWL-Derby"], ["1. FC Magdeburg", "Hallescher FC", "Sachsen-Anhalt-Derby"],
  ["Dynamo Dresden", "1. FC Lokomotive Leipzig", "Sachsenderby"], ["Rot-Weiss Essen", "Rot-Weiß Oberhausen", "Revierderby"],
  ["Hansa Rostock", "Dynamo Dresden", "Ostderby"], ["MSV Duisburg", "Rot-Weiss Essen", "Revierderby"],
  // England
  ["FC Arsenal", "Tottenham Hotspur", "North London Derby"], ["FC Liverpool", "FC Everton", "Merseyside Derby"],
  ["Manchester United", "Manchester City", "Manchester Derby"], ["FC Liverpool", "Manchester United", "North West Derby"],
  ["Newcastle United", "AFC Sunderland", "Tyne-Wear Derby"], ["Aston Villa", "Birmingham City", "Second City Derby"],
  ["Sheffield United", "Sheffield Wednesday", "Steel City Derby"], ["West Ham United", "FC Millwall", "Dockers Derby"],
  ["Nottingham Forest", "Derby County", "East Midlands Derby"], ["FC Southampton", "FC Portsmouth", "South Coast Derby"],
  ["Brighton & Hove Albion", "Crystal Palace", "M23 Derby"], ["West Bromwich Albion", "Wolverhampton Wanderers", "Black Country Derby"],
  ["Ipswich Town", "Norwich City", "East Anglian Derby"], ["FC Chelsea", "FC Arsenal", "London Derby"],
  // Spanien
  ["Real Madrid", "FC Barcelona", "El Clásico"], ["Real Madrid", "Atlético Madrid", "Derbi madrileño"],
  ["FC Sevilla", "Real Betis Sevilla", "Gran Derbi"], ["FC Barcelona", "Espanyol Barcelona", "Derbi barceloní"],
  ["Athletic Bilbao", "Real Sociedad", "Derbi vasco"], ["Celta Vigo", "Deportivo La Coruña", "Derbi gallego"],
  ["Sporting Gijón", "Real Oviedo", "Derbi asturiano"], ["UD Las Palmas", "CD Teneriffa", "Derbi canario"],
  ["FC Valencia", "FC Villarreal", "Derbi valenciano"],
  // Italien
  ["Inter Mailand", "AC Mailand", "Derby della Madonnina"], ["AS Rom", "Lazio Rom", "Derby della Capitale"],
  ["Juventus Turin", "FC Turin", "Derby della Mole"], ["Juventus Turin", "Inter Mailand", "Derby d'Italia"],
  ["CFC Genua", "Sampdoria Genua", "Derby della Lanterna"], ["US Palermo", "Catania FC", "Derby di Sicilia"],
  ["AC Florenz", "FC Bologna", "Derby dell'Appennino"], ["SSC Neapel", "AS Rom", "Derby del Sole"],
  // Frankreich
  ["Paris Saint-Germain", "Olympique Marseille", "Le Classique"], ["Olympique Lyon", "AS Saint-Étienne", "Derby du Rhône"],
  ["OGC Nizza", "AS Monaco", "Derby de la Côte d'Azur"], ["RC Lens", "OSC Lille", "Derby du Nord"],
  ["FC Nantes", "Stade Rennes", "Derby breton"], ["Paris Saint-Germain", "Paris FC", "Derby parisien"],
  ["FC Metz", "AS Nancy", "Derby lorrain"]
];

function getDerby(a, b){
  const d = DERBIES.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return d ? { name: d[2] } : null;
}

function getOwnDerbyOpponents(gameState){
  const imLiga = new Set((gameState.teams || []).map(t => t.name));
  return DERBIES.filter(([x, y]) => (x === gameState.clubName && imLiga.has(y)) || (y === gameState.clubName && imLiga.has(x)))
    .map(([x, y]) => x === gameState.clubName ? y : x);
}

// Derbys sind enger: beide Torerwartungen ruecken zusammen.
function applyDerbyEqualizer(home, away, lambdaHome, lambdaAway){
  if(!getDerby(home, away)) return { home: lambdaHome, away: lambdaAway };
  const mittel = (lambdaHome + lambdaAway) / 2;
  return { home: lambdaHome + (mittel - lambdaHome) * DERBY_EQUALIZER, away: lambdaAway + (mittel - lambdaAway) * DERBY_EQUALIZER };
}

// Nach einem eigenen Derby: Stimmung und Vorstand reagieren staerker.
function applyDerbyResult(gameState, evt){
  const gegner = evt.home === gameState.clubName ? evt.away : evt.home;
  const derby = getDerby(gameState.clubName, gegner);
  if(!derby) return null;
  const stimmung = evt.result === "win" ? DERBY_MORALE : evt.result === "loss" ? -DERBY_MORALE : 0;
  if(stimmung) (gameState.squad || []).forEach(p => setMorale(p, getMorale(p) + stimmung));
  const vorstand = evt.result === "win" ? DERBY_PATIENCE : evt.result === "loss" ? -DERBY_PATIENCE : 0;
  if(gameState.board && !gameState.board.dismissed && vorstand){
    gameState.board.patience = Math.max(1, Math.min(BOARD_MAX_PATIENCE, gameState.board.patience + vorstand));
  }
  const text = evt.result === "win" ? `${derby.name} gewonnen: Die Fans feiern.` : evt.result === "loss" ? `${derby.name} verloren: Unruhe im Umfeld.` : `${derby.name}: Unentschieden.`;
  addLogEntry(gameState, `🔥 ${text}${vorstand ? ` Vorstand ${vorstand > 0 ? "+" : ""}${vorstand}.` : ""}`, evt.result);
  addNews(gameState, `${derby.name}: ${evt.home} ${evt.homeGoals}:${evt.awayGoals} ${evt.away}.`, "🔥");
  return derby;
}
