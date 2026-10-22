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

function getPotentialAgeFactor(age){
  const stufe = POTENTIAL_AGE_FACTORS.find(s => age <= s.maxAge);
  return stufe ? stufe.factor : POTENTIAL_AGE_FACTORS[POTENTIAL_AGE_FACTORS.length - 1].factor;
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
  // Potenzial haengt vom Alter ab: ein 18-Jaehriger hat viel Luft nach oben,
  // ein 31-Jaehriger kaum noch. Vorher hatten beide im Schnitt fast gleich viel.
  const maxPotentialGain = Math.max(DEV_POTENTIAL_GAIN_MIN, Math.min(DEV_POTENTIAL_GAIN_MAX,
    Math.round(calculateMaxPotentialGain(strength) * getPotentialAgeFactor(age) * randFloat(0.7, 1.3))));
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
    consecutiveStarts: 0,
    altPos: rollNaturalSecondaryPositions(pos),
    traits: typeof rollTraits === "function" ? rollTraits(pos) : []
  });
}

// Manche Spieler koennen von Natur aus eine Nachbarposition (IV auch DM,
// ZM auch OM, LV auch RV ...).
function rollNaturalSecondaryPositions(pos){
  if(typeof getNeighbourPositions !== "function" || Math.random() >= SECONDARY_POS_CHANCE) return [];
  const nachbarn = getNeighbourPositions(pos);
  return nachbarn.length ? [randChoice(nachbarn)] : [];
}

function generateSquadRaw(baseStrength, plan){
  const squad = [];
  const zusammensetzung = plan ? plan.composition : SQUAD_COMPOSITION;
  zusammensetzung.forEach(entry => {
    for(let i = 0; i < entry.count; i++){
      const linie = plan ? (plan.lineOffset[getPositionLine(entry.pos)] || 0) : 0;
      squad.push(genPlayer(baseStrength + linie, entry.pos, null, false));
    }
  });
  return squad;
}

// Mannschaftsreihe einer Position: Abwehr, Mittelfeld oder Angriff.
function getPositionLine(pos){
  if(["RV", "IV", "LV"].includes(pos)) return "abwehr";
  if(["DM", "ZM", "LM", "RM"].includes(pos)) return "mittelfeld";
  if(["OM", "ST"].includes(pos)) return "angriff";
  return "tor";
}
const SQUAD_LINE_LABELS = { abwehr: "Abwehr", mittelfeld: "Mittelfeld", angriff: "Angriff" };

// Plan fuer einen individuellen Startkader: Besetzung nach dem System des
// Vereins, ein paar Engpaesse und Ueberbesetzungen, eine starke und eine
// schwache Reihe.
function buildSquadPlan(formationName){
  const needs = (FORMATIONS[formationName] || FORMATIONS[DEFAULT_FORMATION]).needs;
  const anzahl = {};
  POSITION_ORDER.forEach(pos => { anzahl[pos] = pos === "TW" ? 3 : (needs[pos] || 0) * 2; });
  const feld = POSITION_ORDER.filter(p => p !== "TW");
  const duenn = shuffleArray(feld.filter(p => anzahl[p] >= 2)).slice(0, randInt(SQUAD_THIN_SPOTS[0], SQUAD_THIN_SPOTS[1]));
  duenn.forEach(p => { anzahl[p] -= 1; });
  const extra = shuffleArray(feld.filter(p => !duenn.includes(p))).slice(0, randInt(SQUAD_EXTRA_SPOTS[0], SQUAD_EXTRA_SPOTS[1]));
  extra.forEach(p => { anzahl[p] += 1; });
  const reihen = shuffleArray(["abwehr", "mittelfeld", "angriff"]);
  const lineOffset = {};
  // In einem Drittel der Kader gibt es keine ausgepraegte Staerke.
  if(Math.random() > 0.33){ lineOffset[reihen[0]] = SQUAD_LINE_FOCUS; lineOffset[reihen[1]] = -SQUAD_LINE_FOCUS; }
  return {
    formation: formationName,
    composition: POSITION_ORDER.map(pos => ({ pos, count: anzahl[pos] })).filter(e => e.count > 0),
    thin: duenn, extra, lineOffset,
    strongLine: lineOffset[reihen[0]] ? reihen[0] : null,
    weakLine: lineOffset[reihen[0]] ? reihen[1] : null
  };
}

// Die beste Elf aus einem breiten Kader liegt ueber dem Schnitt der Spieler.
// Ohne Ausgleich startete der eigene Verein 3-4 Punkte staerker als derselbe
// Verein in der KI-Simulation. Deshalb wird die Erzeugungsstaerke so
// nachgefuehrt, dass die Teambewertung zur Vereinsstaerke passt.
// Mit Plan (buildSquadPlan) wird in dessen Formation kalibriert.
function generateSquad(baseStrength, plan){
  const erzeugen = () => {
    let erzeugung = baseStrength - 3;
    let bester = null, besterAbstand = Infinity;
    for(let versuch = 0; versuch < 12; versuch++){
      const kader = generateSquadRaw(erzeugung, plan);
      const abstand = teamRating(kader, 1) - baseStrength;
      if(Math.abs(abstand) < besterAbstand){ bester = kader; besterAbstand = Math.abs(abstand); }
      if(Math.abs(abstand) <= 0.5) break;
      erzeugung -= abstand;
    }
    return bester;
  };
  return plan && typeof withFormation === "function" ? withFormation(plan.formation, erzeugen) : erzeugen();
}

// Kurzbeschreibung eines Startkaders fuer das Protokoll.
function describeSquadPlan(plan){
  if(!plan) return "";
  const teile = [`System ${plan.formation}`];
  if(plan.strongLine) teile.push(`stark: ${SQUAD_LINE_LABELS[plan.strongLine]}`, `schwach: ${SQUAD_LINE_LABELS[plan.weakLine]}`);
  if(plan.thin.length) teile.push(`dünn besetzt: ${plan.thin.join(", ")}`);
  if(plan.extra.length) teile.push(`viele: ${plan.extra.join(", ")}`);
  return teile.join(" · ");
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
// Talentniveau eines Vereins: die Staerke zaehlt nur zu einem Teil.
function getYouthBaseStrength(clubStrength){
  return YOUTH_BASE_STRENGTH + (clubStrength - 70) * YOUTH_CLUB_FACTOR;
}

function genYouthPlayer(clubStrength, pos){
  const base = getYouthBaseStrength(clubStrength);
  const strength = Math.round(Math.max(38, Math.min(80,
    base + randInt(-YOUTH_STRENGTH_SPREAD, YOUTH_STRENGTH_SPREAD))));
  const isTalent = Math.random() < YOUTH_TALENT_CHANCE;
  const gain = randInt(YOUTH_GAIN_MIN, YOUTH_GAIN_MAX) + (isTalent ? YOUTH_TALENT_BONUS : 0);
  return buildYouthPlayer(strength, gain, pos, pickYouthNationality(), randInt(YOUTH_AGE_MIN, YOUTH_AGE_MAX), isTalent);
}

// Gemeinsamer Bau fuer Talente aus dem eigenen Jahrgang und aus dem Scouting.
// devSpeed ist das persoenliche Entwicklungstempo (verdeckt).
function buildYouthPlayer(strength, gain, pos, nat, age, isTalent){
  const maxStrength = Math.min(99, strength + gain);
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
    devSpeed: Math.round(randFloat(DEV_SPEED_MIN, DEV_SPEED_MAX) * 100) / 100,
    contractYears: CONTRACT_YOUTH_YEARS,
    goalsSeason: 0,
    yellowCards: 0,
    suspendedUntilMatchday: 0,
    consecutiveStarts: 0,
    traits: typeof rollTraits === "function" ? rollTraits(pos) : []
  });
}
