// ============================================
// TRAITS.JS - Spielereigenschaften und Rollen
// ============================================
// Eigenschaften machen Spieler mit gleicher Bewertung unterschiedlich. Sie
// wirken auf Tore, Verletzungen, Ermuedung, Entwicklung und Stimmung.
// Rollen: Elfmeter- und Freistossschuetze (der Kapitaen ist in league-life.js).

const PLAYER_TRAITS = {
  fuehrung:    { label: "Führungsspieler",     icon: "🎖️", text: "Stärkt die Mannschaft, solange er spielt.", weight: 7 },
  torinstinkt: { label: "Torinstinkt",         icon: "🎯", text: "Trifft deutlich häufiger.", weight: 6, pos: ["ST", "OM", "LM", "RM", "ZM"] },
  standard:    { label: "Standardspezialist",  icon: "🧠", text: "Gefährliche Freistöße.", weight: 6, notPos: ["TW"] },
  elfmeter:    { label: "Elfmeterspezialist",  icon: "✔️", text: "Sicher vom Punkt.", weight: 5, notPos: ["TW"] },
  robust:      { label: "Robust",              icon: "💪", text: "Seltener verletzt, ermüdet langsamer.", weight: 8 },
  anfaellig:   { label: "Verletzungsanfällig", icon: "🩹", text: "Häufiger verletzt.", weight: 7 },
  fleiss:      { label: "Trainingsfleiß",      icon: "📈", text: "Entwickelt sich schneller.", weight: 7 },
  frueh:       { label: "Frühentwickler",      icon: "⚡", text: "Schnell reif, baut früher ab.", weight: 5 },
  spaet:       { label: "Spätzünder",          icon: "🌅", text: "Braucht Zeit, hält länger.", weight: 5 },
  treu:        { label: "Vereinstreu",         icon: "🤝", text: "Verlängert gern, bleibt auf der Bank gelassen.", weight: 6 },
  launisch:    { label: "Launisch",            icon: "🌪️", text: "Stimmung schwankt stark.", weight: 6 }
};
const TRAIT_EXCLUSIVE = [["robust", "anfaellig"], ["frueh", "spaet"], ["treu", "launisch"]];

function traitFitsPosition(key, pos){
  const t = PLAYER_TRAITS[key];
  if(t.pos && !t.pos.includes(pos)) return false;
  if(t.notPos && t.notPos.includes(pos)) return false;
  return true;
}

function rollTraits(pos){
  const wurf = Math.random();
  const anzahl = wurf < TRAIT_CHANCE_NONE ? 0 : wurf < TRAIT_CHANCE_NONE + TRAIT_CHANCE_ONE ? 1 : 2;
  const gewaehlt = [];
  for(let i = 0; i < anzahl; i++){
    const moeglich = Object.keys(PLAYER_TRAITS).filter(k => traitFitsPosition(k, pos) && !gewaehlt.includes(k)
      && !TRAIT_EXCLUSIVE.some(paar => paar.includes(k) && paar.some(x => gewaehlt.includes(x))));
    let summe = moeglich.reduce((s, k) => s + PLAYER_TRAITS[k].weight, 0);
    let r = Math.random() * summe;
    for(const k of moeglich){ r -= PLAYER_TRAITS[k].weight; if(r <= 0){ gewaehlt.push(k); break; } }
  }
  return gewaehlt;
}

// Aeltere Spielstaende: Spieler ohne Eigenschaften bekommen einmal welche.
function ensurePlayerTraits(spieler){
  (spieler || []).forEach(p => { if(!Array.isArray(p.traits)) p.traits = rollTraits(p.pos); });
}

function hasTrait(player, key){
  return !!(player && player.traits && player.traits.includes(key));
}

function renderTraitIcons(player){
  return (player.traits || []).map(k => PLAYER_TRAITS[k]
    ? `<span class="tagIcon" title="${PLAYER_TRAITS[k].label}: ${PLAYER_TRAITS[k].text}">${PLAYER_TRAITS[k].icon}</span>` : "").join("");
}

// ---------- Wirkungen ----------

function getScorerWeight(p){
  const basis = SCORER_WEIGHTS[p.pos] != null ? SCORER_WEIGHTS[p.pos] : 1;
  return hasTrait(p, "torinstinkt") ? basis * TRAIT_SCORER_FACTOR : basis;
}

function getTraitInjuryFactor(p){
  return hasTrait(p, "robust") ? TRAIT_ROBUST_INJURY : hasTrait(p, "anfaellig") ? TRAIT_FRAGILE_INJURY : 1;
}

function getTraitFatigueFactor(p){
  return hasTrait(p, "robust") ? TRAIT_ROBUST_FATIGUE : 1;
}

// Entwicklung: rate > 0 Wachstum, rate < 0 Abbau.
function getTraitDevFactor(p, rate){
  let f = 1;
  if(rate > 0 && hasTrait(p, "fleiss")) f *= TRAIT_DILIGENT_DEV;
  if(hasTrait(p, "frueh")){
    if(rate > 0 && p.age <= 22) f *= 1.3;
    if(rate < 0) f *= 1.3;
  }
  if(hasTrait(p, "spaet")){
    if(rate > 0 && p.age <= 22) f *= 0.8;
    if(rate > 0 && p.age >= 23 && p.age <= 28) f *= 1.3;
    if(rate < 0) f *= 0.6;
  }
  return f;
}

// Stimmung: launische Spieler schwanken staerker, treue nehmen die Bank gelassen.
function getTraitMoraleDelta(p, delta){
  if(hasTrait(p, "launisch")) return delta * TRAIT_MOODY_FACTOR;
  if(hasTrait(p, "treu") && delta < 0) return delta * TRAIT_LOYAL_FACTOR;
  return delta;
}

// Fuehrungsspieler in der Startelf: kleiner Bonus fuer die ganze Mannschaft.
function getLeadershipBonus(gameState, xi){
  const fuehrung = (xi || []).filter(p => hasTrait(p, "fuehrung"));
  if(!fuehrung.length) return 0;
  const kapitaen = typeof getCaptain === "function" ? getCaptain(gameState) : null;
  return TRAIT_LEADER_BONUS + (kapitaen && hasTrait(kapitaen, "fuehrung") && xi.includes(kapitaen) ? TRAIT_LEADER_CAPTAIN_BONUS : 0);
}

// ---------- Rollen: Elfmeter und Freistoss ----------

function getSetPieceScore(p, rolle){
  const a = p.attributes || { sho: p.strength, pas: p.strength };
  if(rolle === "penalty") return a.sho + (hasTrait(p, "elfmeter") ? TRAIT_SPECIALIST_POINTS : 0);
  return 0.6 * a.sho + 0.4 * a.pas + (hasTrait(p, "standard") ? TRAIT_SPECIALIST_POINTS : 0);
}

// Gesetzter Schuetze, wenn er auf dem Platz steht, sonst der beste.
function getSetPieceTaker(spieler, rolle, gesetztId){
  const feld = (spieler || []).filter(p => p.pos !== "TW");
  if(!feld.length) return null;
  const gesetzt = gesetztId ? feld.find(p => p.id === gesetztId) : null;
  if(gesetzt) return gesetzt;
  return feld.reduce((best, p) => getSetPieceScore(p, rolle) > getSetPieceScore(best, rolle) ? p : best, feld[0]);
}

function getOwnRole(gameState, rolle){
  return (gameState.roles || {})[rolle] || null;
}

// Tor-Art und Schuetze: ein Teil der Tore faellt per Elfmeter oder Freistoss.
function pickGoalScorerWithType(spieler, rollen){
  const r = Math.random();
  if(r < SET_PIECE_PENALTY_SHARE){
    const p = getSetPieceTaker(spieler, "penalty", rollen && rollen.penalty);
    if(p) return { player: p, type: "Elfmeter" };
  } else if(r < SET_PIECE_PENALTY_SHARE + SET_PIECE_FREEKICK_SHARE){
    const p = getSetPieceTaker(spieler, "freekick", rollen && rollen.freekick);
    if(p) return { player: p, type: "Freistoß" };
  }
  return { player: pickScorer(spieler), type: null };
}

// Qualitaet der eigenen Schuetzen als kleiner Angriffsbonus, gemessen an der
// eigenen Mannschaft (ein Spezialist macht den Unterschied, nicht die Liga).
function getSetPieceBonus(gameState, xi){
  if(!xi || !xi.length) return 0;
  const rating = xi.reduce((s, p) => s + p.strength, 0) / xi.length;
  const anteil = rolle => {
    const p = getSetPieceTaker(xi, rolle, getOwnRole(gameState, rolle));
    // Der beste Schuetze liegt meist gut 8 Punkte ueber dem Schnitt: das ist
    // der Normalfall und bringt nichts extra.
    return p ? Math.max(-1, Math.min(1.5, (getSetPieceScore(p, rolle) - rating - SET_PIECE_TYPICAL_EDGE) / 20)) : 0;
  };
  return Math.round((anteil("penalty") * SET_PIECE_BONUS_PENALTY + anteil("freekick") * SET_PIECE_BONUS_FREEKICK) * 100) / 100;
}

function handleRoleChange(rolle, id){
  gameState.roles = gameState.roles || {};
  gameState.roles[rolle] = id || null;
  const p = id ? gameState.squad.find(x => x.id === id) : null;
  showToast(`${rolle === "penalty" ? "Elfmeter" : "Freistöße"}: ${p ? p.name : "automatisch"}`, "info");
  refreshSquadViews();
}

function renderRoleControls(gameState, xi){
  const option = (rolle) => {
    const gesetzt = getOwnRole(gameState, rolle);
    const auto = getSetPieceTaker(xi, rolle, null);
    const liste = [...gameState.squad].filter(p => p.pos !== "TW")
      .sort((a, b) => getSetPieceScore(b, rolle) - getSetPieceScore(a, rolle)).slice(0, 12);
    return `<option value=""${!gesetzt ? " selected" : ""}>Automatisch${auto ? ` (${auto.name})` : ""}</option>` +
      liste.map(p => `<option value="${p.id}"${p.id === gesetzt ? " selected" : ""}>${p.name} · ${Math.round(getSetPieceScore(p, rolle))}${hasTrait(p, rolle === "penalty" ? "elfmeter" : "standard") ? " ★" : ""}</option>`).join("");
  };
  return `<label>Elfmeter<select onchange="handleRoleChange('penalty', this.value)">${option("penalty")}</select></label>
    <label>Freistöße<select onchange="handleRoleChange('freekick', this.value)">${option("freekick")}</select></label>`;
}
