// ============================================
// DEVELOPMENT.JS - Spielerentwicklung ueber die Saison
// ============================================

// playLevel: "starter" (Profi-Startelf), "youth" (Jugendmannschaft) oder
// "bench" (kein Einsatz). Der alte boolesche Aufruf bleibt gueltig.
function getPlayMultiplier(playLevel, growing){
  if(playLevel === true || playLevel === "starter"){
    return growing ? DEV_STARTER_GROWTH_MULTIPLIER : DEV_STARTER_DECLINE_MULTIPLIER;
  }
  if(playLevel === "youth"){
    return growing ? YOUTH_DEV_MULTIPLIER : (1 + DEV_STARTER_DECLINE_MULTIPLIER) / 2;
  }
  return 1;
}

function getDevelopmentRate(age, playLevel){
  let rate = 0;

  if(age <= DEV_YOUNG_AGE){
    rate = DEV_MAX_GROWTH_PER_MATCHDAY;
  } else if(age < DEV_PEAK_AGE_START){
    const span = DEV_PEAK_AGE_START - DEV_YOUNG_AGE;
    const progress = (age - DEV_YOUNG_AGE) / span;
    rate = DEV_MAX_GROWTH_PER_MATCHDAY * (1 - progress);
  } else if(age <= DEV_PEAK_AGE_END){
    rate = 0;
  } else if(age < DEV_DECLINE_END_AGE){
    const span = DEV_DECLINE_END_AGE - DEV_PEAK_AGE_END;
    const progress = (age - DEV_PEAK_AGE_END) / span;
    rate = -DEV_MAX_DECLINE_PER_MATCHDAY * progress;
  } else {
    rate = -DEV_MAX_DECLINE_PER_MATCHDAY;
  }

  if(rate > 0) rate *= getPlayMultiplier(playLevel, true);
  else if(rate < 0) rate *= getPlayMultiplier(playLevel, false);

  return rate;
}

// Alle vier Attribute wachsen mit derselben Rate. Weil die Positionsgewichte
// zusammen 1 ergeben, waechst der Gesamtwert dadurch genauso schnell wie
// vorher — die Entwicklungsbalance bleibt also erhalten.
function applyAttributeChange(player, rate){
  if(!player.attributes){
    const upperBound = player.maxStrength != null ? player.maxStrength : 99;
    player.strength = Math.max(30, Math.min(upperBound, player.strength + rate));
    return;
  }

  ATTRIBUTES.forEach(a => {
    const cap = player.maxAttributes && player.maxAttributes[a] != null
      ? player.maxAttributes[a] : ATTRIBUTE_MAX;
    // Der Trainingsfokus wirkt nur auf das Wachstum, nicht auf den Abbau —
    // sonst wuerde ein Schwerpunkt alte Spieler zusaetzlich bestrafen.
    const fokusRate = rate > 0
      ? rate * (typeof getTrainingAttributeFactor === "function" ? getTrainingAttributeFactor(a) : 1)
      : rate;
    const next = player.attributes[a] + fokusRate;
    // NICHT runden: der Abbau alter Spieler betraegt nur rund 0.04 pro
    // Spieltag. Auf eine Nachkommastelle gerundet faellt er komplett weg
    // und Spieler wuerden nie schwaecher. Gerundet wird erst in der Anzeige.
    player.attributes[a] = Math.max(ATTRIBUTE_MIN, Math.min(cap, next));
  });
  syncPlayerStrength(player);
}

function developSquad(squad, currentMatchday1Based, youthAppearances){
  const startingIds = getStartingXIIds(squad, currentMatchday1Based);
  const youthIds = youthAppearances || new Set();

  squad.forEach(player => {
    if(isInjured(player, currentMatchday1Based)){
      applyAttributeChange(player, -INJURY_DECLINE_PER_MATCHDAY);
      refreshPlayerValue(player);
      return;
    }

    const level = startingIds.has(player.id) ? "starter"
                : youthIds.has(player.id) ? "youth" : "bench";
    const moral = typeof getMoraleDevMultiplier === "function" ? getMoraleDevMultiplier(player) : 1;
    const trainer = typeof getCoachingDevBonus === "function" ? getCoachingDevBonus(gameState) : 1;
    const rate = getDevelopmentRate(player.age, level);
    // Bei Wachstum verstaerkt oder bremst die Moral; beim Abbau wirkt sie
    // umgekehrt. Der Trainerstab wirkt nur auf das Wachstum.
    applyAttributeChange(player, rate >= 0 ? rate * moral * trainer : rate / Math.max(0.5, moral));
    refreshPlayerValue(player);
  });
}

function ageSquadOneYear(squad){
  squad.forEach(player => {
    player.age += 1;
    refreshPlayerValue(player);
  });
}

function updateFatigue(squad, startingIds){
  squad.forEach(player => {
    if(startingIds.has(player.id)){
      player.consecutiveStarts = (player.consecutiveStarts || 0) + 1;
    } else {
      player.consecutiveStarts = 0;
    }
  });
}

function getRetirementChance(age, strength){
  if(age < RETIREMENT_MIN_AGE) return 0;
  if(age >= RETIREMENT_FORCED_AGE) return 1;
  let chance = RETIREMENT_BASE_CHANCE + (age - RETIREMENT_MIN_AGE) * RETIREMENT_AGE_RAMP;
  if(strength < RETIREMENT_WEAK_THRESHOLD) chance += RETIREMENT_WEAK_BONUS;
  return Math.max(0, Math.min(1, chance));
}

function processRetirements(squad){
  const retired = [], remaining = [];
  squad.forEach(player => {
    const chance = getRetirementChance(player.age, player.strength);
    if(chance > 0 && Math.random() < chance) retired.push(player);
    else remaining.push(player);
  });
  return { retired, remaining };
}


// --- Vertraege ---
function getContractYears(player){
  return player.contractYears != null ? player.contractYears : CONTRACT_MIN_YEARS;
}

function isContractExpiring(player){
  return getContractYears(player) <= 1;
}

// Am Saisonende laeuft jeder Vertrag ein Jahr ab. Wer bei null ankommt,
// verlaesst den Verein ablosefrei.
function processContracts(squad){
  const leaving = [], remaining = [];
  squad.forEach(player => {
    player.contractYears = getContractYears(player) - 1;
    if(player.contractYears <= 0) leaving.push(player);
    else remaining.push(player);
  });
  return { leaving, remaining };
}

function getRenewalFee(player){
  return Math.max(50000, Math.round(player.value * CONTRACT_RENEWAL_FEE_FACTOR / 10000) * 10000);
}

// Vertragsverhandlung: Der Spieler stellt Forderungen, abhaengig von seiner
// Rolle im Team und seiner Stimmung. Unzufriedene Spieler und Stars, fuer
// die der Verein zu klein ist, lehnen ab. Vorher war die Verlaengerung eine
// Formsache mit festem Handgeld.
function getRenewalTerms(gameState, player){
  if(player.age >= RETIREMENT_FORCED_AGE - 1){
    return { refused: true, reason: `${player.name} beendet seine Karriere und verlängert nicht mehr.` };
  }
  const stimmung = typeof getMorale === "function" ? getMorale(player) : MORALE_NEUTRAL;
  if(stimmung < MORALE_UNHAPPY_THRESHOLD){
    return { refused: true, reason: `${player.name} ist unzufrieden und will nicht verlängern. Mehr Einsatzzeit oder bessere Ergebnisse könnten seine Meinung ändern.` };
  }
  if(typeof getTransferInterestLimit === "function" && player.strength > getTransferInterestLimit(gameState)){
    return { refused: true, reason: `${player.name} sieht seine Zukunft bei einem größeren Verein und lehnt eine Verlängerung ab.` };
  }

  const team = teamRating(gameState.squad, gameState.matchday + 1);
  // Gehaltsforderung: Leistungstraeger und Unzufriedene wollen mehr.
  const aufschlag = Math.max(0, Math.min(CONTRACT_RAISE_MAX,
    CONTRACT_RAISE_BASE + (player.strength - team) * 0.012 + (MORALE_NEUTRAL - stimmung) * 0.004));
  const basisFaktor = player.salaryFactor || 1;
  // Aeltere Spieler bekommen hoechstens zwei Jahre angeboten.
  const maxJahre = player.age >= 31 ? 2 : 4;
  const optionen = [];
  for(let jahre = 1; jahre <= maxJahre; jahre++){
    const handgeld = Math.max(50000, Math.round(player.value * CONTRACT_RENEWAL_FEE_FACTOR
      * (0.6 + 0.2 * jahre) * (1 + aufschlag) / 10000) * 10000);
    // Lange Vertraege geben Sicherheit, dafuer verzichtet der Spieler auf einen Teil des Aufschlags.
    const faktor = Math.round(basisFaktor * (1 + aufschlag * (1 - 0.08 * (jahre - 1))) * 100) / 100;
    optionen.push({ jahre, handgeld, faktor });
  }
  return { refused: false, aufschlag, optionen };
}

function renewContract(gameState, playerId, jahre){
  const player = (gameState.squad || []).find(p => p.id === playerId);
  if(!player) return { success:false, message:"Spieler nicht gefunden." };

  const terms = getRenewalTerms(gameState, player);
  if(terms.refused) return { success:false, message: terms.reason };
  const option = terms.optionen.find(o => o.jahre === (jahre || Math.min(CONTRACT_RENEWAL_YEARS, terms.optionen.length)))
    || terms.optionen[terms.optionen.length - 1];

  const deduction = deductFromBudget(gameState.budget, option.handgeld);
  if(!deduction.success){
    return { success:false, message:`Handgeld von ${fmtMoney(option.handgeld)} nicht bezahlbar (verfügbar: ${fmtMoney(gameState.budget)}).` };
  }

  gameState.budget = deduction.newBudget;
  player.contractYears = getContractYears(player) + option.jahre;
  player.salaryFactor = option.faktor;
  const plus = Math.round((option.faktor - 1) * 100);
  return {
    success: true, fee: option.handgeld,
    message: `📝 ${player.name} verlängert um ${option.jahre} Jahr${option.jahre === 1 ? "" : "e"}. Handgeld ${fmtMoney(option.handgeld)}${plus > 0 ? `, Gehalt +${plus} %` : ""}.`
  };
}

// --- Trainingsfokus ---

function getActiveTraining(){
  if(typeof gameState === "undefined" || !gameState) return TRAINING_FOCUS[DEFAULT_TRAINING];
  return TRAINING_FOCUS[gameState.training] || TRAINING_FOCUS[DEFAULT_TRAINING];
}

// Wie die Entwicklung eines einzelnen Attributs gewichtet wird.
function getTrainingAttributeFactor(attribut){
  const fokus = getActiveTraining();
  const f = fokus.attr ? fokus.attr[attribut] : 1;
  return f != null ? f : 1;
}

// Der Jugendkader entwickelt sich ueber seine eigenen Einsaetze. Er laeuft
// getrennt vom Profikader, deshalb braucht er einen eigenen Durchgang.
function developYouthSquad(gameState, currentMatchday1Based, youthAppearances){
  const kader = gameState.youthSquad || [];
  const eingesetzt = youthAppearances || new Set();

  kader.forEach(player => {
    if(isInjured(player, currentMatchday1Based)){
      applyAttributeChange(player, -INJURY_DECLINE_PER_MATCHDAY);
      refreshPlayerValue(player);
      return;
    }
    const level = eingesetzt.has(player.id) ? "youth" : "bench";
    const moral = typeof getMoraleDevMultiplier === "function" ? getMoraleDevMultiplier(player) : 1;
    const trainer = typeof getCoachingDevBonus === "function" ? getCoachingDevBonus(gameState) : 1;
    const rate = getDevelopmentRate(player.age, level);
    applyAttributeChange(player, rate >= 0 ? rate * moral * trainer : rate / Math.max(0.5, moral));
    refreshPlayerValue(player);
  });
}
