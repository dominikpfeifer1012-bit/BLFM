// ============================================
// MORALE.JS - Zufriedenheit der Spieler
// ============================================
// Wer regelmaessig spielt, ist zufrieden und entwickelt sich besser. Wer
// dauerhaft auf der Tribuene sitzt, wird unzufrieden, verliert an Leistung
// und will irgendwann weg.

function getMorale(player){
  return player.morale != null ? player.morale : MORALE_START;
}

function setMorale(player, value){
  player.morale = Math.max(MORALE_MIN, Math.min(MORALE_MAX, value));
  return player.morale;
}

function ensureMorale(player){
  if(player.morale == null) player.morale = MORALE_START;
  return player;
}

function ensureSquadMorale(squad){
  (squad || []).forEach(ensureMorale);
  return squad;
}

// Wirkung auf die Spielstaerke. Bei MORALE_NEUTRAL exakt null, damit die
// Moral die Gesamtbalance im Mittel nicht verschiebt.
function getMoraleStrengthEffect(player){
  const abweichung = getMorale(player) - MORALE_NEUTRAL;
  if(abweichung === 0) return 0;
  if(abweichung > 0){
    return (abweichung / (MORALE_MAX - MORALE_NEUTRAL)) * MORALE_BONUS_MAX;
  }
  return (abweichung / (MORALE_NEUTRAL - MORALE_MIN)) * MORALE_MALUS_MAX;
}

function getMoraleDevMultiplier(player){
  const m = getMorale(player);
  if(m >= MORALE_NEUTRAL){
    const anteil = (m - MORALE_NEUTRAL) / (MORALE_MAX - MORALE_NEUTRAL);
    return 1 + anteil * (MORALE_DEV_MAX - 1);
  }
  const anteil = (MORALE_NEUTRAL - m) / (MORALE_NEUTRAL - MORALE_MIN);
  return 1 - anteil * (1 - MORALE_DEV_MIN);
}

function getMoraleLabel(player){
  const m = getMorale(player);
  if(m >= 85) return { text: "Begeistert", tone: "win", icon: "😄" };
  if(m >= 65) return { text: "Zufrieden", tone: "win", icon: "🙂" };
  if(m >= 45) return { text: "Neutral", tone: "draw", icon: "😐" };
  if(m >= MORALE_UNHAPPY_THRESHOLD) return { text: "Unzufrieden", tone: "draw", icon: "😕" };
  if(m >= MORALE_CRITICAL_THRESHOLD) return { text: "Wechselwunsch", tone: "loss", icon: "😠" };
  return { text: "Will unbedingt weg", tone: "loss", icon: "🤬" };
}

// Einmal pro Spieltag: Einsatzrolle, Ergebnis und Vertragslage verrechnen.
function updateSquadMorale(gameState, context){
  context = context || {};
  const day = gameState.matchday;
  const info = getStartingXIInfo(gameState.squad, day);
  const xiIds = new Set(info.xi.map(p => p.id));
  const rollen = classifySquad(gameState.squad, day, info).roles;
  const youthIds = context.youthAppearances || new Set();
  const ergebnis = context.result ? (MORALE_RESULT[context.result] || 0) : 0;

  gameState.squad.forEach(player => {
    ensureMorale(player);
    let delta = ergebnis;

    if(isUnavailable(player, day)){
      delta += MORALE_INJURED;
    } else if(xiIds.has(player.id)){
      delta += MORALE_XI;
    } else if(youthIds.has(player.id)){
      delta += player.age <= YOUTH_TEAM_MAX_AGE ? MORALE_YOUTH_YOUNG : MORALE_YOUTH_OLD;
    } else if(rollen.get(player.id) === "bench"){
      delta += MORALE_BENCH;
    } else {
      delta += MORALE_RESERVE;
    }

    if(isContractExpiring(player)) delta += MORALE_EXPIRING_CONTRACT;
    if(typeof getActiveTraining === "function") delta += getActiveTraining().morale || 0;

    // Sanfte Rueckkehr zum Ruhepunkt: ohne sie wuerden Ausschlaege ewig
    // nachwirken und die Moral bliebe an den Raendern kleben.
    const aktuell = getMorale(player);
    delta += (MORALE_NEUTRAL - aktuell) * MORALE_REVERSION;

    setMorale(player, aktuell + delta);
  });
}

// Spieler, die einen Wechsel wollen — nach Dringlichkeit sortiert.
function getUnhappyPlayers(gameState){
  return (gameState.squad || [])
    .filter(p => getMorale(p) < MORALE_UNHAPPY_THRESHOLD)
    .sort((a, b) => getMorale(a) - getMorale(b));
}

function getSquadMoraleAverage(squad){
  if(!squad || squad.length === 0) return MORALE_NEUTRAL;
  return squad.reduce((sum, p) => sum + getMorale(p), 0) / squad.length;
}

// Eine Vertragsverlaengerung hebt die Stimmung spuerbar.
function applyRenewalMoraleBoost(player){
  setMorale(player, getMorale(player) + MORALE_RENEWAL_BOOST);
}

function resetMoraleForNewSeason(squad){
  (squad || []).forEach(p => {
    // Zur neuen Saison wird die Stimmung teilweise zurueckgesetzt: jeder
    // bekommt eine neue Chance, ohne dass Extreme voellig verschwinden.
    setMorale(p, getMorale(p) + (MORALE_START - getMorale(p)) * 0.5);
  });
}
