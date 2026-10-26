// ============================================
// SCOUTING.JS - Scouts, Regionen, Berichte, Talentsichtung
// ============================================
// Scouts sind Personal mit Qualitaet (1–5 Sterne) und Gehalt. Jeder bekommt
// einen Auftrag: Region und Fokus. Sie liefern Berichte statt exakter
// Zahlen; die Spanne wird mit der Zeit enger. Talente (15–17) laedt man zum
// Probetraining ein und bietet ihnen einen Jugendvertrag an — wenn nicht
// vorher ein grosser Verein zuschlaegt.

// ---------- Regionen ----------

function getScoutRegionOf(nat){
  return Object.keys(SCOUT_REGIONS).find(k => SCOUT_REGIONS[k].nats.includes(nat)) || null;
}

function getHomeRegionKey(gameState){
  const nat = typeof getOwnHomeNationalityCode === "function" ? getOwnHomeNationalityCode() : "DE";
  return getScoutRegionOf(nat) || "dach";
}

// Beste Abdeckung einer Herkunft durch die eigenen Scouts (0 = keiner dort).
function getRegionStars(gameState, nat){
  const a = gameState && gameState.academy;
  if(!a || !nat) return 0;
  const region = getScoutRegionOf(nat);
  return (a.scouts || []).filter(s => s.region === region).reduce((m, s) => Math.max(m, getScoutStars(s)), 0);
}

// Wer seine Heimatregion bearbeitet, arbeitet einen Stern besser.
function getScoutStars(scout){
  return Math.min(5, scout.quality + (scout.region && scout.region === scout.home ? 1 : 0));
}

// Mehr Scouting-Funde am Markt (unterschaetzte Spieler) mit gutem Netzwerk.
function getScoutingChanceBonus(gameState){
  const a = gameState && gameState.academy;
  if(!a) return 1;
  const sterne = (a.scouts || []).reduce((s, x) => s + x.quality, 0);
  return 1 + SCOUT_NETWORK_BONUS * sterne / 5;
}

// ---------- Personal ----------

function rollScoutQuality(){
  const w = Math.random();
  return w < 0.25 ? 1 : w < 0.55 ? 2 : w < 0.8 ? 3 : w < 0.94 ? 4 : 5;
}

function createScout(gameState, quality, natCode){
  const nat = natCode && NATIONALITY_BY_CODE[natCode] ? NATIONALITY_BY_CODE[natCode] : pickNationality();
  return {
    id: "s" + Math.random().toString(36).slice(2, 9),
    name: generatePlayerName(nat), nat: nat.code,
    quality: quality || rollScoutQuality(),
    home: getScoutRegionOf(nat.code),
    region: null, focus: "talente", line: "alle",
    since: gameState ? gameState.season : null, finds: 0
  };
}

function getScoutSalary(gameState, scout){
  const skala = Math.sqrt((typeof getFinanceScale === "function" ? getFinanceScale(gameState) : 1) + 0.05);
  return Math.round(SCOUT_SALARY[scout.quality] * skala / 10000) * 10000;
}

// Jede Saison stehen ein paar Scouts zur Wahl.
function ensureScoutMarket(gameState){
  const a = ensureAcademy(gameState);
  if(!a.scoutMarket || a.scoutMarket.season !== gameState.season){
    a.scoutMarket = { season: gameState.season, scouts: Array.from({ length: SCOUT_MARKET_SIZE }, () => createScout(gameState)) };
  }
  return a.scoutMarket.scouts;
}

function hireScout(gameState, scoutId){
  const a = ensureAcademy(gameState);
  if(a.scouts.length >= SCOUT_MAX) return { success: false, message: `Höchstens ${SCOUT_MAX} Scouts.` };
  const markt = ensureScoutMarket(gameState);
  const s = markt.find(x => x.id === scoutId);
  if(!s) return { success: false, message: "Scout nicht mehr verfügbar." };
  a.scoutMarket.scouts = markt.filter(x => x.id !== scoutId);
  s.since = gameState.season;
  s.region = s.home || getHomeRegionKey(gameState);
  a.scouts.push(s);
  const text = `🔍 ${s.name} (${"★".repeat(s.quality)}) ist neuer Scout, Gehalt ${fmtMoney(getScoutSalary(gameState, s))} pro Saison.`;
  addAcademyLog(gameState, text.slice(3), "🔍");
  return { success: true, message: text };
}

// Abfindung: ein Viertel des Jahresgehalts.
function getScoutSeverance(gameState, scout){
  return Math.round(getScoutSalary(gameState, scout) * 0.25 / 10000) * 10000;
}

function fireScout(gameState, scoutId){
  const a = ensureAcademy(gameState);
  const s = a.scouts.find(x => x.id === scoutId);
  if(!s) return { success: false, message: "Scout nicht gefunden." };
  const abfindung = getScoutSeverance(gameState, s);
  gameState.budget -= abfindung;
  a.scouts = a.scouts.filter(x => x.id !== scoutId);
  return { success: true, message: `${s.name} verlässt die Scoutabteilung (Abfindung ${fmtMoney(abfindung)}).` };
}

function assignScout(gameState, scoutId, feld, wert){
  const a = ensureAcademy(gameState);
  const s = a.scouts.find(x => x.id === scoutId);
  if(!s) return { success: false, message: "Scout nicht gefunden." };
  if(feld === "region" && !SCOUT_REGIONS[wert]) return { success: false, message: "Unbekannte Region." };
  if(feld === "focus" && !SCOUT_FOCUS[wert]) return { success: false, message: "Unbekannter Fokus." };
  if(feld === "line" && !SCOUT_LINES[wert]) return { success: false, message: "Unbekannte Position." };
  s[feld] = wert;
  return { success: true, message: `${s.name}: ${feld === "region" ? SCOUT_REGIONS[wert].label : feld === "focus" ? SCOUT_FOCUS[wert].label : SCOUT_LINES[wert]}.` };
}

// ---------- Berichte ----------

function findReportFor(gameState, playerId){
  const a = gameState && gameState.academy;
  if(!a || !a.reports) return null;
  return a.reports.find(r => r.playerId === playerId) || null;
}

function getReportWidth(r){
  if(r.exact) return 0;
  const q = r.stars || 3;
  const breite = Math.max(SCOUT_REPORT_MIN_WIDTH[q], SCOUT_REPORT_WIDTH[q] - (r.watched || 0) * SCOUT_REPORT_NARROW * q);
  return r.trial ? Math.max(1, breite * TRIAL_WIDTH_FACTOR) : breite;
}

function createReport(gameState, scout, player, kind){
  const a = ensureAcademy(gameState);
  const sterne = getScoutStars(scout);
  const irrt = Math.random() < SCOUT_MISJUDGE[sterne];
  const r = {
    id: "r" + Math.random().toString(36).slice(2, 9),
    playerId: player.id, kind, scoutId: scout.id, region: scout.region, stars: sterne,
    season: gameState.season, md: gameState.matchday, watched: 0,
    frac: Math.random(),
    // Irrtum: die ganze Spanne liegt um so viele Punkte neben dem wahren Wert.
    miss: irrt ? (Math.random() < 0.5 ? -1 : 1) * randInt(SCOUT_MISJUDGE_MIN, SCOUT_MISJUDGE_MAX) : 0,
    trial: false
  };
  a.reports.unshift(r);
  // Aelteste Marktberichte fallen heraus, Talentberichte bleiben, solange es das Talent gibt.
  while(a.reports.length > SCOUT_MAX_REPORTS){
    const idx = a.reports.map(x => x.kind).lastIndexOf("markt");
    if(idx < 0) break;
    a.reports.splice(idx, 1);
  }
  scout.finds = (scout.finds || 0) + 1;
  return r;
}

// Einschaetzung im Vergleich zur eigenen Mannschaft, 1–5 Sterne.
function getRecommendation(gameState, mitte, staerke){
  const team = teamRating(gameState.squad, (gameState.matchday || 0) + 1);
  const wert = Math.max(mitte, staerke || 0);
  if(wert >= team + 2) return { stars: 5, text: "Kann ein Star werden" };
  if(wert >= team - 3) return { stars: 4, text: "Künftiger Stammspieler" };
  if(wert >= team - 8) return { stars: 3, text: "Kaderspieler" };
  if(wert >= team - 14) return { stars: 2, text: "Ergänzung" };
  return { stars: 1, text: "Nicht unser Niveau" };
}

// ---------- Talente (15–17) ----------

function getLinePositions(line){
  const map = { TW: "tor", ABW: "abwehr", MIT: "mittelfeld", STU: "angriff" };
  if(!map[line]) return POSITION_ORDER;
  return POSITION_ORDER.filter(p => getPositionLine(p) === map[line]);
}

// Wo spielt das Talent gerade? In den eigenen Ligen bei einem Verein des
// Landes, sonst in einer Akademie im Ausland.
function pickProspectClub(gameState, nat){
  const land = COUNTRIES.find(c => c.nat === nat);
  if(land && Math.random() < 0.7){
    const vereine = getCountryDivisions(land.key).flatMap(d => getLeaguePool(gameState, d.nr))
      .filter(c => c.name !== gameState.clubName);
    if(vereine.length) return randChoice(vereine).name;
  }
  return Math.random() < 0.5 ? null : `Akademie in ${NATIONALITY_BY_CODE[nat] ? NATIONALITY_BY_CODE[nat].name : nat}`;
}

function createProspect(gameState, scout){
  const a = ensureAcademy(gameState);
  const region = SCOUT_REGIONS[scout.region];
  const natCode = randChoice(region.nats);
  const pos = randChoice(getLinePositions(scout.line));
  const alter = randInt(15, 17);
  // Scouts suchen auf dem Niveau des Vereins: Bayern sichtet andere Talente als Verl.
  const niveau = ((gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState)) - 70) * PROSPECT_CLUB_FACTOR;
  const staerke = Math.round(acClamp(PROSPECT_BASE_STRENGTH + niveau + randInt(-6, 6) + (alter - 16) * 2, 40, 68));
  const talent = Math.random() < YOUTH_TALENT_CHANCE;
  const luft = randInt(PROSPECT_GAIN_MIN, PROSPECT_GAIN_MAX) + niveau + region.quality + (scout.quality - 3) * 1.2
    + (talent ? YOUTH_TALENT_BONUS : 0);
  const p = buildYouthPlayer(staerke, Math.round(luft), pos, NATIONALITY_BY_CODE[natCode] || pickNationality(), alter, talent);
  p.isYouthProduct = false;
  const verein = pickProspectClub(gameState, natCode);
  const prospect = {
    id: p.id, player: p, scoutId: scout.id, region: scout.region,
    club: verein, found: gameState.matchday, season: gameState.season,
    trial: null, interest: randInt(30, 60)
  };
  a.prospects.unshift(prospect);
  while(a.prospects.length > PROSPECT_MAX){
    const alt = a.prospects.pop();
    removeReportFor(gameState, alt.id);
  }
  createReport(gameState, scout, p, "talent");
  return prospect;
}

function removeReportFor(gameState, playerId){
  const a = gameState.academy;
  if(a) a.reports = a.reports.filter(r => r.playerId !== playerId);
}

function findProspect(gameState, id){
  const a = gameState.academy;
  return a ? a.prospects.find(x => x.id === id) || null : null;
}

// Ausbildungsentschaedigung an den abgebenden Verein.
// Der abgebende Verein kennt sein Talent: je hoeher das Potenzial, desto teurer.
function getProspectFee(gameState, prospect){
  if(!prospect.club) return 0;
  const p = prospect.player;
  const region = SCOUT_REGIONS[prospect.region] || { cost: 1 };
  const jahre = Math.max(1, p.age - 12);
  const wert = PROSPECT_FEE_BASE * jahre * region.cost * (1 + Math.max(0, p.maxStrength - 65) / 10);
  return Math.round(wert / 10000) * 10000;
}

function getTrialCost(gameState, prospect){
  const region = SCOUT_REGIONS[prospect.region] || {};
  return region.far ? TRIAL_FAR_COST : TRIAL_COST;
}

function getProspectAcceptChance(gameState, prospect){
  const a = ensureAcademy(gameState);
  const stature = gameState.clubStature != null ? gameState.clubStature : getOwnClubStrength(gameState);
  const heim = prospect.region === getHomeRegionKey(gameState) ? 10 : 0;
  const probe = prospect.trial && prospect.trial.done ? 15 : 0;
  const begehrt = Math.max(0, prospect.player.maxStrength - 75);
  const wert = prospect.interest + a.reputation * 0.3 + (stature - 65) * 0.8 + heim + probe - begehrt - 20;
  return acClamp(wert / 100, 0.1, 0.95);
}

function startTrial(gameState, prospectId){
  const a = ensureAcademy(gameState);
  const pr = findProspect(gameState, prospectId);
  if(!pr) return { success: false, message: "Talent nicht mehr verfügbar." };
  if(pr.trial) return { success: false, message: "Probetraining läuft bereits oder ist abgeschlossen." };
  if(a.prospects.filter(x => x.trial && !x.trial.done).length >= TRIAL_MAX){
    return { success: false, message: `Höchstens ${TRIAL_MAX} Probetrainings gleichzeitig.` };
  }
  const kosten = getTrialCost(gameState, pr);
  if(kosten > gameState.budget) return { success: false, message: `Budget reicht nicht (${fmtMoney(kosten)}).` };
  gameState.budget -= kosten;
  pr.trial = { until: gameState.matchday + TRIAL_MATCHDAYS, done: false };
  pr.interest = Math.min(95, pr.interest + 10);
  return { success: true, message: `🏃 ${pr.player.name} kommt für ${TRIAL_MATCHDAYS} Spieltage zum Probetraining (${fmtMoney(kosten)}).` };
}

// Eindruck nach dem Probetraining.
function describeTrial(gameState, prospect){
  const p = prospect.player;
  const traits = (p.traits || []).map(k => PLAYER_TRAITS[k] ? PLAYER_TRAITS[k].label : k);
  const fleiss = typeof hasTrait === "function" && hasTrait(p, "fleiss");
  const launisch = typeof hasTrait === "function" && hasTrait(p, "launisch");
  const charakter = fleiss ? "arbeitet hart" : launisch ? "schwierig im Umgang" : p.devSpeed >= 1.1 ? "lernt schnell" : p.devSpeed <= 0.9 ? "braucht Zeit" : "unauffällig";
  return `${charakter}${traits.length ? " · " + traits.join(", ") : ""}`;
}

function finishTrial(gameState, prospect){
  prospect.trial.done = true;
  const r = findReportFor(gameState, prospect.id);
  if(r){ r.trial = true; r.miss = 0; }
  prospect.impression = describeTrial(gameState, prospect);
  const e = getPotentialEstimate(gameState, prospect.player);
  const text = `🏃 Probetraining beendet: ${prospect.player.name} (${prospect.player.pos}), Potenzial ${e.lo}–${e.hi}, ${prospect.impression}.`;
  addLogEntry(gameState, text);
  addAcademyLog(gameState, text.slice(3), "🏃");
}

function offerYouthContract(gameState, prospectId){
  const a = ensureAcademy(gameState);
  const pr = findProspect(gameState, prospectId);
  if(!pr) return { success: false, message: "Talent nicht mehr verfügbar." };
  if((gameState.youthSquad || []).length >= getYouthSquadCapacity(gameState)){
    return { success: false, message: `Die Jugend ist voll (${getYouthSquadCapacity(gameState)} Plätze).` };
  }
  const fee = getProspectFee(gameState, pr);
  if(fee > gameState.budget) return { success: false, message: `Budget reicht nicht (${fmtMoney(fee)} Ausbildungsentschädigung).` };

  const chance = getProspectAcceptChance(gameState, pr);
  a.prospects = a.prospects.filter(x => x.id !== pr.id);
  const bericht = findReportFor(gameState, pr.id);
  removeReportFor(gameState, pr.id);
  const p = pr.player;
  if(Math.random() >= chance){
    const konkurrent = pickRivalClub(gameState, pr);
    const text = `❌ ${p.name} entscheidet sich für ${konkurrent}.`;
    addAcademyLog(gameState, text.slice(2), "❌");
    if(typeof releasePlayerName === "function") releasePlayerName(p.name);
    return { success: true, accepted: false, message: text };
  }

  gameState.budget -= fee;
  // Was der Scout ueber ihn weiss, bleibt erhalten.
  if(bericht) p.estWidth = Math.round(getReportWidth(bericht));
  p.academySince = gameState.season;
  p.scoutedFrom = pr.region;
  p.isYouthProduct = true;
  p.contractYears = CONTRACT_YOUTH_YEARS;
  if(typeof ensureMorale === "function") ensureMorale(p);
  if((SCOUT_REGIONS[pr.region] || {}).far){
    p.adaptSeason = gameState.season;
    if(typeof setMorale === "function") setMorale(p, getMorale(p) - PROSPECT_ADAPT_MORALE);
  }
  addToYouthSquad(gameState, p);
  const text = `✍️ ${p.name} (${p.age}, ${p.pos}) unterschreibt einen Jugendvertrag${fee ? `, Ausbildungsentschädigung ${fmtMoney(fee)}` : ""}.`;
  addAcademyLog(gameState, text.slice(3), "✍️");
  return { success: true, accepted: true, player: p, message: text };
}

// Grosse Vereine, die einem ein Talent wegschnappen.
function pickRivalClub(gameState, prospect){
  const nat = prospect.player.nat;
  const land = COUNTRIES.find(c => c.nat === nat);
  const kandidaten = (land ? getCountryDivisions(land.key).slice(0, 1).flatMap(d => getLeaguePool(gameState, d.nr)) : [])
    .concat(getAllLeagueClubs(gameState).filter(c => c.strength >= 84))
    .filter(c => c.name !== gameState.clubName && c.strength >= 78);
  return kandidaten.length ? randChoice(kandidaten).name : "einen Großverein";
}

function dropProspect(gameState, prospectId){
  const a = ensureAcademy(gameState);
  const pr = findProspect(gameState, prospectId);
  if(!pr) return { success: false, message: "Talent nicht gefunden." };
  a.prospects = a.prospects.filter(x => x.id !== prospectId);
  removeReportFor(gameState, prospectId);
  if(typeof releasePlayerName === "function") releasePlayerName(pr.player.name);
  return { success: true, message: `${pr.player.name} wird nicht weiter beobachtet.` };
}

// ---------- Marktberichte ----------

function createMarketReport(gameState, scout){
  const region = SCOUT_REGIONS[scout.region];
  const positionen = new Set(getLinePositions(scout.line));
  const eigene = getOwnClubStrength(gameState);
  const kandidaten = ((gameState.pool && gameState.pool.players) || []).filter(p =>
    region.nats.includes(p.nat) && positionen.has(p.pos)
    && (scout.focus === "jung" ? p.age <= 23 : p.age <= 33)
    && p.strength >= eigene - 22 && !findReportFor(gameState, p.id)
    && !(gameState.scouted && gameState.scouted[p.id]));
  if(!kandidaten.length) return null;
  // Gute Scouts finden eher die Unterschaetzten.
  let wahl;
  if(Math.random() < scout.quality / 6){
    const sortiert = [...kandidaten].sort((a, b) => (b.maxStrength - b.strength) - (a.maxStrength - a.strength));
    wahl = randChoice(sortiert.slice(0, Math.max(1, Math.ceil(sortiert.length / 4))));
  } else wahl = randChoice(kandidaten);
  return createReport(gameState, scout, wahl, "markt");
}

// ---------- Ablauf je Spieltag ----------

function runScoutingMatchday(gameState){
  const a = ensureAcademy(gameState);
  const tag = gameState.matchday;
  const neu = [];
  a.scouts.forEach(s => {
    if(!s.region || !SCOUT_REGIONS[s.region]) return;
    const region = SCOUT_REGIONS[s.region];
    const chance = SCOUT_FIND_CHANCE * region.density * (0.7 + 0.1 * getScoutStars(s));
    if(Math.random() >= chance) return;
    if(s.focus === "talente"){
      const pr = createProspect(gameState, s);
      neu.push(pr);
      const e = getPotentialEstimate(gameState, pr.player);
      if(e.hi >= 80) addLogEntry(gameState, `🔍 ${s.name} meldet ein Talent: ${pr.player.name} (${pr.player.age}, ${pr.player.pos}, ${region.label}), Potenzial ${e.lo}–${e.hi}.`);
    } else {
      const r = createMarketReport(gameState, s);
      if(r) neu.push(r);
    }
  });

  // Berichte werden enger, solange der Scout in der Region bleibt.
  a.reports.forEach(r => {
    const s = a.scouts.find(x => x.id === r.scoutId);
    if(s && s.region === r.region) r.watched = (r.watched || 0) + 1;
  });

  // Probetrainings, Konkurrenz, nachlassendes Interesse.
  a.prospects.slice().forEach(pr => {
    if(pr.trial && !pr.trial.done && tag >= pr.trial.until) finishTrial(gameState, pr);
    const alter = (gameState.season - pr.season) * TOTAL_MATCHDAYS + tag - pr.found;
    const raub = (PROSPECT_STEAL_BASE + Math.max(0, pr.player.maxStrength - 70) * PROSPECT_STEAL_PER_POINT)
      * (pr.trial ? 0.5 : 1);
    if(Math.random() < raub){
      const verein = pickRivalClub(gameState, pr);
      a.prospects = a.prospects.filter(x => x.id !== pr.id);
      removeReportFor(gameState, pr.id);
      const text = `${pr.player.name} (${pr.player.age}) wechselt in die Akademie von ${verein}.`;
      addAcademyLog(gameState, text, "🏃‍♂️");
      if(pr.player.maxStrength >= 82 && typeof addNews === "function") addNews(gameState, `Toptalent ${pr.player.name} (${pr.player.age}) geht zu ${verein}.`, "🌱");
      return;
    }
    if(alter > PROSPECT_TTL + (pr.trial ? PROSPECT_TTL : 0) && !(pr.trial && !pr.trial.done)){
      a.prospects = a.prospects.filter(x => x.id !== pr.id);
      removeReportFor(gameState, pr.id);
      addAcademyLog(gameState, `${pr.player.name}: Interesse erloschen.`, "⌛");
    }
  });

  // Marktberichte zu Spielern, die es nicht mehr gibt oder die schon bei uns sind.
  const imPool = new Set(((gameState.pool && gameState.pool.players) || []).map(p => p.id));
  a.reports = a.reports.filter(r => r.kind === "talent" ? !!findProspect(gameState, r.playerId) : imPool.has(r.playerId));
  return neu;
}

// Saisonende: Talente werden aelter, Fund-Zaehler beginnen neu.
function advanceScoutingSeason(gameState){
  const a = ensureAcademy(gameState);
  // Laufende Probetrainings enden mit der Saison.
  a.prospects.forEach(pr => { if(pr.trial && !pr.trial.done) finishTrial(gameState, pr); });
  a.prospects.forEach(pr => { pr.player.age += 1; });
  a.prospects.filter(pr => pr.player.age > 18).forEach(pr => removeReportFor(gameState, pr.id));
  a.prospects = a.prospects.filter(pr => pr.player.age <= 18);
  a.scouts.forEach(s => { s.lastFinds = s.finds || 0; s.finds = 0; });
}
