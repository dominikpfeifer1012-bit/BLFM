// ============================================
// BUDGET.JS - Budgetverwaltung und Praemienlogik
// ============================================

function calculateStartingBudget(clubStrength){
  const ratio = clubStrength / BUDGET_REFERENCE_STRENGTH;
  const raw = BUDGET_REFERENCE_AMOUNT * Math.pow(ratio, BUDGET_EXPONENT);
  return Math.round(raw / BUDGET_ROUND_TO) * BUDGET_ROUND_TO;
}

function getClubRevenueFactor(clubStature, division){
  const raw = Math.pow(clubStature / CLUB_REVENUE_REF_STRENGTH, CLUB_REVENUE_EXPONENT);
  const clamped = Math.max(CLUB_REVENUE_MIN_FACTOR, Math.min(CLUB_REVENUE_MAX_FACTOR, raw));
  // Jede Liga hat ihren eigenen Faktor; eine weitere ergaenzt man in DIVISIONS.
  const konfig = typeof getDivisionConfig === "function" ? getDivisionConfig(division) : null;
  return clamped * (konfig ? konfig.revenueFactor : (division === 2 ? DIVISION2_REVENUE_FACTOR : 1));
}

// Wohin sich das Standing entwickeln WILL: die Kaderstaerke, korrigiert um
// die Platzierung und einen Abschlag fuer die 2. Liga.
function getStatureTarget(squadRating, finalPosition, totalTeams, division){
  let target = squadRating;
  if(totalTeams > 1){
    const rel = 1 - 2 * ((finalPosition - 1) / (totalTeams - 1));   // +1 Erster, -1 Letzter
    target += rel * STATURE_POSITION_SWING;
  }
  const divKonfig = typeof getDivisionConfig === "function" ? getDivisionConfig(division) : null;
  target -= divKonfig ? divKonfig.staturePenalty : (division === 2 ? STATURE_DIVISION2_PENALTY : 0);
  return Math.max(STATURE_MIN, Math.min(STATURE_MAX, target));
}

// Bewegt sich pro Saison nur ein Stueck in Richtung Ziel — Aufstieg in die
// Oberklasse dauert damit mehrere erfolgreiche Jahre.
function advanceClubStature(current, target){
  const delta = target - current;
  const step = delta >= 0
    ? Math.min(delta, STATURE_MAX_RISE_PER_SEASON)
    : Math.max(delta, -STATURE_MAX_FALL_PER_SEASON);
  const next = current + step;
  return Math.round(Math.max(STATURE_MIN, Math.min(STATURE_MAX, next)) * 10) / 10;
}

function getMatchdayRevenue(revenueFactor){
  const factor = revenueFactor != null ? revenueFactor : 1;
  return Math.round(MATCHDAY_FLAT_REVENUE + MATCHDAY_SCALED_REVENUE * factor);
}

// Leistungspraemie: fuer jeden Verein gleich hoch. Der Ueberraschungsbonus
// obendrauf belohnt Siege gegen staerkere Gegner.
function getMatchBonus(result, ownStrength, opponentStrength){
  const base = MATCH_BONUS_BASE[result] || 0;
  if(base === 0) return 0;
  const strengthDiff = Math.max(0, opponentStrength - ownStrength);
  return base + Math.round(strengthDiff * UNDERDOG_BONUS_PER_POINT);
}

function addToBudget(currentBudget, amount){
  return currentBudget + amount;
}

function deductFromBudget(currentBudget, amount){
  if(currentBudget < amount){
    return { success: false, newBudget: currentBudget };
  }
  return { success: true, newBudget: currentBudget - amount };
}

function calculateSellValue(playerValue){
  return Math.round(playerValue * SELL_FACTOR);
}

function fmtMoney(value){
  if(value >= 1000000) return (value / 1000000).toFixed(2) + " Mio. €";
  return (value / 1000).toFixed(0) + " Tsd. €";
}

// Platzierungspreisgeld: identisch fuer alle. Der Meistertitel bringt einem
// Aufsteiger genau so viel wie dem Rekordmeister.
function calculateSeasonEndBonus(finalPosition, totalTeams){
  const factor = 1.0 - ((finalPosition - 1) / (totalTeams - 1)) * (1 - SEASON_END_BONUS_MIN_FACTOR);
  const raw = SEASON_END_BONUS_BASE * factor;
  return Math.round(raw / BUDGET_ROUND_TO) * BUDGET_ROUND_TO;
}

// Nachwuchs ist guenstiger — ein Anreiz, jung zu entwickeln statt zu kaufen.
function getSalaryAgeFactor(age){
  if(age <= SALARY_YOUTH_AGE) return SALARY_YOUTH_FACTOR;
  if(age >= SALARY_FULL_AGE) return 1;
  const progress = (age - SALARY_YOUTH_AGE) / (SALARY_FULL_AGE - SALARY_YOUTH_AGE);
  return SALARY_YOUTH_FACTOR + (1 - SALARY_YOUTH_FACTOR) * progress;
}

function calculatePlayerSalary(strength, age){
  const raw = SALARY_BASE
    * Math.pow(strength / SALARY_REF_STRENGTH, SALARY_EXPONENT)
    * getSalaryAgeFactor(age);
  return Math.max(SALARY_MIN, Math.round(raw / SALARY_ROUND_TO) * SALARY_ROUND_TO);
}

// Gehalt eines Spielers im eigenen Kader: Grundgehalt nach Staerke und Alter,
// multipliziert mit dem, was bei der letzten Vertragsverlaengerung
// ausgehandelt wurde.
function getPlayerSalary(p){
  return Math.round(calculatePlayerSalary(p.strength, p.age) * (p.salaryFactor || 1));
}

function getSquadSalaryTotal(squad){
  return squad.reduce((sum, p) => sum + getPlayerSalary(p), 0);
}

function getMatchdaySalaryCost(squad, youthSquad){
  const jugend = typeof getYouthSquadSalary === "function" && youthSquad
    ? youthSquad.reduce((sum, p) =>
        sum + Math.round(getPlayerSalary(p) * YOUTH_SALARY_FACTOR), 0)
    : 0;
  // Das Jahresgehalt verteilt sich auf die Spieltage der eigenen Liga.
  const spieltage = typeof getSeasonMatchdays === "function" ? getSeasonMatchdays() : TOTAL_MATCHDAYS;
  return Math.round((getSquadSalaryTotal(squad) + jugend) / spieltage);
}
