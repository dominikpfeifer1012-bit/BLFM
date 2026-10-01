// ============================================
// PLAYERS.JS - Spieler-Generierung
// ============================================

function randInt(min, max){
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min, max){
  return Math.random() * (max - min) + min;
}

function randChoice(arr){
  return arr[randInt(0, arr.length - 1)];
}

// Liegt hier statt in cup.js, weil inzwischen mehrere Module sie brauchen
// und die Ladereihenfolge sonst zur Stolperfalle wird.
function shuffleArray(arr){
  const a = [...arr];
  for(let i = a.length - 1; i > 0; i--){
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ============================================
// Attribute
// ============================================

// Erzeugt die vier Attribute so, dass der positionsgewichtete Schnitt EXAKT
// dem gewuenschten Gesamtwert entspricht. Deshalb wird nach der Streuung
// nachskaliert — sonst wuerden Marktwert und Gehalt driften.
function buildAttributes(overall, pos, spread){
  const shape = POSITION_SHAPES[pos] || POSITION_SHAPES.ZM;
  const raw = {};
  ATTRIBUTES.forEach(a => {
    const jitter = spread ? randFloat(-spread, spread) : 0;
    raw[a] = overall * shape[a] + jitter;
  });
  return normalizeAttributes(raw, overall, pos);
}

function normalizeAttributes(raw, targetOverall, pos){
  const weights = POSITION_WEIGHTS[pos] || POSITION_WEIGHTS.ZM;
  const attrs = {};
  ATTRIBUTES.forEach(a => { attrs[a] = raw[a]; });

  // Zwei Durchgaenge: nach dem Begrenzen kann der Schnitt wieder abweichen.
  for(let pass = 0; pass < 6; pass++){
    let weighted = 0;
    ATTRIBUTES.forEach(a => { weighted += weights[a] * attrs[a]; });
    if(weighted <= 0) break;
    const scale = targetOverall / weighted;
    if(Math.abs(scale - 1) < 0.0005) break;
    ATTRIBUTES.forEach(a => {
      attrs[a] = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, attrs[a] * scale));
    });
  }

  // Abschliessend begrenzen: Attribute ohne Gewicht auf dieser Position
  // (etwa Abschluss beim Torwart) beeinflussen die Normalisierung nicht und
  // wuerden sonst nie in den gueltigen Bereich gezogen.
  ATTRIBUTES.forEach(a => {
    const clamped = Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, attrs[a]));
    attrs[a] = Math.round(clamped * 10) / 10;
  });
  return attrs;
}

// Was ein Spieler auf einer BESTIMMTEN Position wert ist. Ein Innenverteidiger
// im Sturm faellt hier von allein ab, weil ihm der Abschluss fehlt.
function getAttributeRating(player, pos){
  const attrs = player.attributes;
  if(!attrs) return player.strength || 0;
  const weights = POSITION_WEIGHTS[pos] || POSITION_WEIGHTS.ZM;
  let sum = 0;
  ATTRIBUTES.forEach(a => { sum += weights[a] * (attrs[a] != null ? attrs[a] : 0); });
  return sum;
}

// Gesamtwert = Bewertung auf der eigenen Position.
function getOverallRating(player){
  return getAttributeRating(player, player.pos);
}

// Haelt strength mit den Attributen im Einklang.
function syncPlayerStrength(player){
  if(player.attributes) player.strength = Math.round(getOverallRating(player) * 10) / 10;
  return player;
}

function getMaxAttributeRating(player){
  if(!player.maxAttributes) return player.maxStrength != null ? player.maxStrength : player.strength;
  const weights = POSITION_WEIGHTS[player.pos] || POSITION_WEIGHTS.ZM;
  let sum = 0;
  ATTRIBUTES.forEach(a => { sum += weights[a] * player.maxAttributes[a]; });
  return sum;
}

// Nachtraeglich Attribute ergaenzen, damit alte Spielstaende weiterlaufen.
function ensurePlayerAttributes(player){
  if(!player.attributes){
    player.attributes = buildAttributes(player.strength, player.pos, ATTRIBUTE_SPREAD);
  }
  if(!player.maxAttributes){
    const cap = player.maxStrength != null ? player.maxStrength : player.strength;
    const gain = Math.max(0, cap - player.strength);
    player.maxAttributes = {};
    ATTRIBUTES.forEach(a => {
      player.maxAttributes[a] = Math.min(ATTRIBUTE_MAX, Math.round((player.attributes[a] + gain) * 10) / 10);
    });
  }
  syncPlayerStrength(player);
  return player;
}

function ensureSquadAttributes(squad){
  (squad || []).forEach(ensurePlayerAttributes);
  return squad;
}

function getLongevityFactor(age){
  const curve = VALUE_LONGEVITY_CURVE;
  if(age <= curve[0].age) return curve[0].factor;
  for(let i = 0; i < curve.length - 1; i++){
    const a = curve[i], b = curve[i + 1];
    if(age <= b.age){
      const progress = (age - a.age) / (b.age - a.age);
      return a.factor + (b.factor - a.factor) * progress;
    }
  }
  return curve[curve.length - 1].factor;
}

function getPotentialPremium(age, strength, maxStrength){
  if(age >= DEV_PEAK_AGE_START) return 0;
  const cap = maxStrength != null ? maxStrength : strength;
  const remaining = Math.max(0, cap - strength);
  const premium = VALUE_POTENTIAL_PREMIUM_WEIGHT * remaining / VALUE_POTENTIAL_PREMIUM_DIVISOR;
  return Math.min(VALUE_POTENTIAL_PREMIUM_MAX, premium);
}

function calculatePlayerValue(strength, age, maxStrength){
  const longevity = getLongevityFactor(age);
  const premium = getPotentialPremium(age, strength, maxStrength);
  const ageFactor = longevity * (1 + premium);

  const rawValue = PRICE_CONFIG.baseValue *
    Math.pow(strength / PRICE_CONFIG.refStrength, PRICE_CONFIG.exponent) *
    ageFactor;
  return Math.max(PRICE_CONFIG.minValue, Math.round(rawValue / PRICE_CONFIG.roundTo) * PRICE_CONFIG.roundTo);
}

function calculateMaxPotentialGain(baseStrength){
  const rawGain = DEV_POTENTIAL_SLOPE * baseStrength + DEV_POTENTIAL_INTERCEPT;
  return Math.max(DEV_POTENTIAL_GAIN_MIN, Math.min(DEV_POTENTIAL_GAIN_MAX, rawGain));
}

function refreshPlayerValue(player){
  player.value = calculatePlayerValue(player.strength, player.age, player.maxStrength);
  return player;
}

// Die Attributgrenzen bei 99 koennen verhindern, dass ein sehr starker
// Spieler seinen Nennwert exakt erreicht. Deshalb wird der Gesamtwert am Ende
// immer aus den Attributen abgeleitet — beide koennen so nie auseinanderlaufen.
function finalizePlayer(player){
  syncPlayerStrength(player);
  // Nach der Normierung koennen einzelne Grenzen unter dem Istwert liegen.
  if(player.maxAttributes){
    ATTRIBUTES.forEach(a => {
      if(player.maxAttributes[a] < player.attributes[a]) player.maxAttributes[a] = player.attributes[a];
    });
  }
  player.baseStrength = player.strength;
  player.maxStrength = Math.round(getMaxAttributeRating(player) * 10) / 10;
  refreshPlayerValue(player);
  return player;
}

function genPlayer(baseStrength, pos, ageRange, allowScouting){
  const strength = Math.max(40, Math.min(99, baseStrength + randInt(-10, 10)));
  const range = ageRange || [18, 34];
  const age = randInt(range[0], range[1]);
  const maxPotentialGain = calculateMaxPotentialGain(strength);
  let maxStrength = Math.min(99, strength + maxPotentialGain);
  let isScoutingFind = false;

  // Ein Scouting-Fund ist unentdecktes Talent, keine hoehere Tagesform:
  // die Bewertung bleibt normal, nur die Obergrenze steigt. Der Preis zieht
  // ueber den Potenzialaufschlag nur teilweise mit — das ist der Gewinn.
  let scoutingBonus = 0;
  const scoutingChance = SCOUTING_CHANCE *
    (typeof getScoutingChanceBonus === "function" && typeof gameState !== "undefined"
      ? getScoutingChanceBonus(gameState) : 1);
  if(allowScouting && age < DEV_PEAK_AGE_START && Math.random() < scoutingChance){
    scoutingBonus = randInt(SCOUTING_POTENTIAL_BONUS_MIN, SCOUTING_POTENTIAL_BONUS_MAX);
    maxStrength = Math.min(SCOUTING_POTENTIAL_CAP, maxStrength + scoutingBonus);
    isScoutingFind = true;
  }

  const value = calculatePlayerValue(strength, age, maxStrength);

  const nat = pickNationality();
  const attributes = buildAttributes(strength, pos, ATTRIBUTE_SPREAD);
  // Die Potenzialgrenzen werden auf den vorgesehenen Hoechstwert normiert.
  // Ohne das wuerde der Scouting-Deckel wirkungslos, weil sich der Gesamtwert
  // aus den einzelnen Attributgrenzen ergibt.
  const rawMax = {};
  ATTRIBUTES.forEach(a => { rawMax[a] = attributes[a] + maxPotentialGain + scoutingBonus; });
  const maxAttributes = normalizeAttributes(rawMax, maxStrength, pos);

  return finalizePlayer({
    id: Math.random().toString(36).slice(2),
    name: generatePlayerName(nat),
    nat: nat.code,
    pos: pos,
    attributes: attributes,
    maxAttributes: maxAttributes,
    strength: strength,
    baseStrength: strength,
    maxStrength: maxStrength,
    age: age,
    value: value,
    injuredUntilMatchday: 0,
    isScoutingFind: isScoutingFind,
    contractYears: randInt(CONTRACT_MIN_YEARS, CONTRACT_MAX_YEARS),
    goalsSeason: 0,
    yellowCards: 0,
    suspendedUntilMatchday: 0,
    consecutiveStarts: 0
  });
}

function generateSquad(baseStrength){
  const squad = [];
  SQUAD_COMPOSITION.forEach(entry => {
    for(let i = 0; i < entry.count; i++){
      squad.push(genPlayer(baseStrength, entry.pos, null, false));
    }
  });
  return squad;
}

function priceToApproxStrength(price, age){
  if(price <= 0) return 0;
  const longevity = getLongevityFactor(age);
  const ratio = price / (PRICE_CONFIG.baseValue * longevity);
  if(ratio <= 0) return 0;
  const strength = PRICE_CONFIG.refStrength * Math.pow(ratio, 1 / PRICE_CONFIG.exponent);
  return strength;
}

function generateMarketOffer(baseStrength, filters){
  filters = filters || {};
  const minAge = filters.minAge != null ? filters.minAge : 17;
  const maxAge = filters.maxAge != null ? filters.maxAge : 36;
  const minPrice = filters.minPrice != null ? filters.minPrice : 0;
  const maxPrice = filters.maxPrice != null && filters.maxPrice > 0 ? filters.maxPrice : Infinity;

  const refAge = Math.round((minAge + maxAge) / 2);

  let minStrengthFromPrice = minPrice > 0 ? priceToApproxStrength(minPrice, refAge) : 40;
  let maxStrengthFromPrice = maxPrice < Infinity ? priceToApproxStrength(maxPrice, refAge) : 99;

  minStrengthFromPrice = Math.max(40, Math.min(99, minStrengthFromPrice));
  maxStrengthFromPrice = Math.max(40, Math.min(99, maxStrengthFromPrice));
  if(minStrengthFromPrice > maxStrengthFromPrice){
    const tmp = minStrengthFromPrice;
    minStrengthFromPrice = maxStrengthFromPrice;
    maxStrengthFromPrice = tmp;
  }
  if(maxStrengthFromPrice - minStrengthFromPrice < 4){
    minStrengthFromPrice = Math.max(40, maxStrengthFromPrice - 6);
  }

  const offers = [];
  POSITION_ORDER.forEach(pos => {
    let attempts = 0;
    let found = null;

    while(attempts < 60 && !found){
      const targetStrength = randInt(Math.round(minStrengthFromPrice), Math.round(maxStrengthFromPrice));
      const candidate = genPlayer(targetStrength, pos, [minAge, maxAge], true);

      if(candidate.value >= minPrice && candidate.value <= maxPrice){
        found = candidate;
      }
      attempts++;
    }

    if(!found){
      const targetStrength = randInt(Math.round(minStrengthFromPrice), Math.round(maxStrengthFromPrice));
      found = genPlayer(targetStrength, pos, [minAge, maxAge], false);
    }

    offers.push(found);
  });
  return offers;
}

// Nachwuchs bekommt eine eigene Potenzialkurve: schwaecher als ein
// Marktspieler, aber mit deutlich mehr Entwicklungsspielraum.
function genYouthPlayer(clubStrength, pos){
  const base = Math.max(40, clubStrength - YOUTH_STRENGTH_OFFSET);
  const strength = Math.max(40, Math.min(99,
    base + randInt(-YOUTH_STRENGTH_SPREAD, YOUTH_STRENGTH_SPREAD)));
  const age = randInt(YOUTH_AGE_MIN, YOUTH_AGE_MAX);

  const isTalent = Math.random() < YOUTH_TALENT_CHANCE;
  const midPotential = Math.round((YOUTH_POTENTIAL_MIN + YOUTH_POTENTIAL_MAX) / 2);
  const gain = isTalent
    ? randInt(midPotential, YOUTH_POTENTIAL_MAX)
    : randInt(YOUTH_POTENTIAL_MIN, YOUTH_POTENTIAL_MAX);
  const maxStrength = Math.min(99, strength + gain);

  const nat = pickYouthNationality();
  const attributes = buildAttributes(strength, pos, ATTRIBUTE_SPREAD);
  const rawMax = {};
  ATTRIBUTES.forEach(a => { rawMax[a] = attributes[a] + gain; });
  const maxAttributes = normalizeAttributes(rawMax, maxStrength, pos);

  return finalizePlayer({
    id: Math.random().toString(36).slice(2),
    name: generatePlayerName(nat),
    nat: nat.code,
    pos: pos,
    attributes: attributes,
    maxAttributes: maxAttributes,
    strength: strength,
    baseStrength: strength,
    maxStrength: maxStrength,
    age: age,
    value: calculatePlayerValue(strength, age, maxStrength),
    injuredUntilMatchday: 0,
    isScoutingFind: false,
    isYouthProduct: true,
    isTalent: isTalent,
    contractYears: CONTRACT_YOUTH_YEARS,
    goalsSeason: 0,
    yellowCards: 0,
    suspendedUntilMatchday: 0,
    consecutiveStarts: 0
  });
}
