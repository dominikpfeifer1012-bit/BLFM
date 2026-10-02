// ============================================
// FACILITIES.JS - Investitionen in den Verein
// ============================================
// Langfristige Ausgaben, die mit Transfers um dasselbe Budget konkurrieren.
// Anders als ein Spieler altert eine Investition nicht — sie wirkt dauerhaft.

function createFreshFacilities(){
  const f = {};
  Object.keys(FACILITIES).forEach(k => { f[k] = 0; });
  return f;
}

function ensureFacilities(gameState){
  if(!gameState.facilities) gameState.facilities = createFreshFacilities();
  Object.keys(FACILITIES).forEach(k => {
    if(gameState.facilities[k] == null) gameState.facilities[k] = 0;
  });
  return gameState.facilities;
}

function getFacilityLevel(gameState, key){
  if(!gameState || !gameState.facilities) return 0;
  return gameState.facilities[key] || 0;
}

// Kosten der naechsten Stufe. null bedeutet: bereits voll ausgebaut.
function getFacilityCost(gameState, key){
  const stufe = getFacilityLevel(gameState, key);
  if(stufe >= FACILITY_LEVELS) return null;
  return FACILITY_COSTS[stufe];
}

function upgradeFacility(gameState, key){
  if(!FACILITIES[key]) return { success: false, message: "Unbekannter Bereich." };
  ensureFacilities(gameState);

  const stufe = getFacilityLevel(gameState, key);
  if(stufe >= FACILITY_LEVELS){
    return { success: false, message: `${FACILITIES[key].label} ist bereits voll ausgebaut.` };
  }

  const kosten = getFacilityCost(gameState, key);
  const abbuchung = deductFromBudget(gameState.budget, kosten);
  if(!abbuchung.success){
    return { success: false,
      message: `Budget reicht nicht (${fmtMoney(kosten)}).` };
  }

  gameState.budget = abbuchung.newBudget;
  gameState.facilities[key] = stufe + 1;

  return {
    success: true, kosten: kosten, stufe: stufe + 1,
    message: `${FACILITIES[key].icon} ${FACILITIES[key].label} auf Stufe ${stufe + 1} ausgebaut — ${fmtMoney(kosten)}.`
  };
}

function getTotalInvested(gameState){
  let summe = 0;
  Object.keys(FACILITIES).forEach(k => {
    for(let i = 0; i < getFacilityLevel(gameState, k); i++) summe += FACILITY_COSTS[i];
  });
  return summe;
}

// ---------- Wirkungen ----------
// Jede Wirkung wird an genau einer Stelle abgefragt, damit sie nachvollziehbar
// bleibt und nicht versehentlich doppelt zaehlt.

function getStadiumRevenueBonus(gameState){
  return 1 + getFacilityLevel(gameState, "stadium") * FACILITIES.stadium.perLevel;
}

function getCoachingDevBonus(gameState){
  return 1 + getFacilityLevel(gameState, "coaching") * FACILITIES.coaching.perLevel;
}

function getYouthQualityBonus(gameState){
  const stufe = getFacilityLevel(gameState, "youth");
  return { strength: stufe * 2, potential: stufe * 3 };
}

function getMedicalInjuryFactor(gameState){
  return Math.max(0.2, 1 - getFacilityLevel(gameState, "medical") * FACILITIES.medical.perLevel);
}

function getScoutingChanceBonus(gameState){
  return 1 + getFacilityLevel(gameState, "scouting") * FACILITIES.scouting.perLevel;
}
