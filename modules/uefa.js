// ============================================
// UEFA.JS - Champions League, Europa League, Conference League
// ============================================
// Format seit 2024/25: 36 Teams je Wettbewerb in einer gemeinsamen
// Ligaphase, danach K.o.-Play-offs (Platz 9-24), Achtel-, Viertel- und
// Halbfinale mit Hin- und Rueckspiel und ein Finale auf neutralem Platz.
// Alle drei Wettbewerbe laufen parallel; der eigene Verein spielt seinen
// selbst, die anderen werden im Hintergrund ausgespielt.
//
// Dazu: Fuenfjahreswertung fuer Laender und Vereine (Startplaetze und
// Lostoepfe), Supercups zum Saisonauftakt und eine Ehrentafel.

// ---------- Grunddaten ----------

function uefaCountryOf(gameState, name){
  const nr = typeof getClubDivision === "function" ? getClubDivision(gameState, name) : null;
  if(nr) return getDivisionCountry(nr);
  const e = EURO_CLUBS.find(c => c.name === name);
  return e ? e.country : "?";
}

function getUefaCountryName(key){
  if(UEFA_COUNTRY_NAMES[key]) return UEFA_COUNTRY_NAMES[key];
  const c = COUNTRIES.find(x => x.key === key);
  return c ? c.name : key;
}

// Vereinsstaerke ohne eigenen Kader (Anzeige, Lostoepfe, Hintergrundspiele).
function uefaClubStrength(gameState, name){
  const c = findClubEverywhere(gameState, name) || EURO_CLUBS.find(x => x.name === name);
  return c ? c.strength : 65;
}

// ---------- Fuenfjahreswertung ----------

function ensureCoefficients(gameState){
  if(gameState.coefficients && gameState.coefficients.countries) return gameState.coefficients;
  const countries = {};
  Object.keys(UEFA_COUNTRY_SEED).forEach(k => { countries[k] = [...UEFA_COUNTRY_SEED[k]]; });
  gameState.coefficients = { countries, clubs: {}, seasonClubs: {}, seasonCountryClubs: {} };
  return gameState.coefficients;
}

// Startwert eines Vereins aus seiner Grundstaerke: Spitzenclubs bringen eine
// gute Europapokal-Historie mit, kleine Vereine keine.
function seedClubCoefficient(strength){
  const proSaison = Math.round(Math.max(0, (strength - 62) * 0.9) * 10) / 10;
  return new Array(UEFA_COEFF_YEARS).fill(proSaison);
}

function getCountryCoefficient(gameState, key){
  const arr = ensureCoefficients(gameState).countries[key] || [];
  return Math.round(arr.reduce((s, x) => s + x, 0) * 10) / 10;
}

function getCountryLastSeason(gameState, key){
  const arr = ensureCoefficients(gameState).countries[key] || [];
  return arr.length ? arr[arr.length - 1] : 0;
}

// Wie bei der UEFA: eigene Punkte oder 20 % der Laenderwertung.
function getClubCoefficient(gameState, name){
  const co = ensureCoefficients(gameState);
  if(!co.clubs[name]){
    const club = findClubEverywhere(gameState, name) || EURO_CLUBS.find(x => x.name === name);
    co.clubs[name] = seedClubCoefficient(club ? (club.baseStrength || club.strength) : 60);
  }
  const eigen = co.clubs[name].reduce((s, x) => s + x, 0);
  const land = getCountryCoefficient(gameState, uefaCountryOf(gameState, name)) * 0.2;
  return Math.round(Math.max(eigen, land) * 10) / 10;
}

function addCoefficientPoints(gameState, name, punkte){
  const co = ensureCoefficients(gameState);
  co.seasonClubs[name] = (co.seasonClubs[name] || 0) + punkte;
}

// Saisonabschluss der Wertung: Vereinspunkte festschreiben, Laenderwert =
// Summe der Vereinspunkte geteilt durch die Zahl der Teilnehmer.
function closeCoefficientSeason(gameState){
  const co = ensureCoefficients(gameState);
  const uefa = gameState.uefa;
  if(!uefa || uefa.coeffClosed) return;
  const teilnehmer = new Set();
  UEFA_COMP_ORDER.forEach(k => (uefa.comps[k] ? uefa.comps[k].teams : []).forEach(t => teilnehmer.add(t.name)));

  const proLand = {};
  teilnehmer.forEach(name => {
    const land = uefaCountryOf(gameState, name);
    proLand[land] = proLand[land] || { summe: 0, n: 0 };
    proLand[land].summe += co.seasonClubs[name] || 0;
    proLand[land].n++;
  });
  Object.keys(co.countries).forEach(land => {
    const p = proLand[land];
    co.countries[land].push(p ? Math.round(p.summe / p.n * 10) / 10 : 0);
    while(co.countries[land].length > UEFA_COEFF_YEARS) co.countries[land].shift();
  });
  Object.keys(co.clubs).forEach(name => {
    co.clubs[name].push(Math.round((co.seasonClubs[name] || 0) * 10) / 10);
    while(co.clubs[name].length > UEFA_COEFF_YEARS) co.clubs[name].shift();
  });
  teilnehmer.forEach(name => {
    if(!co.clubs[name]){
      getClubCoefficient(gameState, name);
      co.clubs[name][UEFA_COEFF_YEARS - 1] = co.seasonClubs[name] || 0;
    }
  });
  co.lastSeasonClubs = co.seasonClubs;
  co.seasonClubs = {};
  uefa.coeffClosed = true;
}

// Rangliste der Laender nach Fuenfjahreswertung.
function getCountryRanking(gameState){
  const co = ensureCoefficients(gameState);
  return Object.keys(co.countries)
    .map(k => ({ key: k, name: getUefaCountryName(k), total: getCountryCoefficient(gameState, k),
      last: getCountryLastSeason(gameState, k), current: getCurrentSeasonCountryPoints(gameState, k) }))
    .sort((a, b) => b.total - a.total);
}

// Laufende Saison (fuer die Anzeige).
function getCurrentSeasonCountryPoints(gameState, key){
  const co = ensureCoefficients(gameState);
  const uefa = gameState.uefa;
  if(!uefa) return 0;
  let summe = 0, n = 0;
  UEFA_COMP_ORDER.forEach(k => (uefa.comps[k] ? uefa.comps[k].teams : []).forEach(t => {
    if(uefaCountryOf(gameState, t.name) !== key) return;
    summe += co.seasonClubs[t.name] || 0; n++;
  }));
  return n ? Math.round(summe / n * 10) / 10 : 0;
}

// Die zwei besten der fuenf grossen Ligen in der Vorjahreswertung bekommen
// einen zusaetzlichen CL-Platz ("European Performance Spot").
function getExtraClCountries(gameState){
  return Object.keys(UEFA_CL_SLOTS)
    .sort((a, b) => getCountryLastSeason(gameState, b) - getCountryLastSeason(gameState, a))
    .slice(0, UEFA_EXTRA_CL_COUNTRIES);
}

// Startplaetze einer Liga nach Tabellenplatz (fuer Tabellenzonen).
function getUefaSlotsForCountry(gameState, country){
  if(!UEFA_CL_SLOTS[country]) return { cl: 0, el: 0, ecl: 0 };
  const cl = UEFA_CL_SLOTS[country] + (getExtraClCountries(gameState).includes(country) ? 1 : 0);
  return { cl, el: 1, ecl: 1 };
}

// ---------- Qualifikation ----------

// tables: { land: [Vereinsnamen nach Platzierung] } der jeweils ersten Liga.
// cupWinners: { land: Name }, holders: { cl, el, ecl } der abgelaufenen Saison.
function computeUefaQualification(gameState, tables, cupWinners, holders){
  const eps = getExtraClCountries(gameState);
  const q = { cl: [], el: [], ecl: [], eps };
  // Titelverteidiger zuerst: CL- und EL-Sieger spielen CL, der Sieger der
  // Conference League EL. Ihre Plaetze gehen nicht von der Liga ab.
  const gesetzt = new Set();
  if(holders){
    [holders.cl, holders.el].filter(Boolean).forEach(n => { if(!gesetzt.has(n)){ q.cl.push(n); gesetzt.add(n); } });
    if(holders.ecl && !gesetzt.has(holders.ecl)){ q.el.push(holders.ecl); gesetzt.add(holders.ecl); }
  }
  Object.keys(UEFA_CL_SLOTS).forEach(land => {
    const tab = (tables[land] || []).filter(n => !gesetzt.has(n));
    const nCl = UEFA_CL_SLOTS[land] + (eps.includes(land) ? 1 : 0);
    const cl = tab.slice(0, nCl);
    const el = [];
    const cw = cupWinners ? cupWinners[land] : null;
    if(cw && !cl.includes(cw) && !gesetzt.has(cw)) el.push(cw);
    const frei = tab.slice(nCl).filter(n => n !== cw);
    while(el.length < 2 && frei.length) el.push(frei.shift());
    q.cl.push(...cl);
    q.el.push(...el);
    if(frei.length) q.ecl.push(frei.shift());
  });
  q.holders = holders || null;
  return q;
}

// Erste Saison: die Vorsaison wird aus der Staerke abgeleitet.
function seedUefaQualification(gameState){
  const tables = {}, cups = {};
  Object.keys(UEFA_CL_SLOTS).forEach(land => {
    const top = getCountryDivisions(land)[0];
    const pool = [...getLeaguePool(gameState, top.nr)].sort((a, b) => b.strength - a.strength);
    tables[land] = pool.map(c => c.name);
    // Pokalsieger der Vorsaison: einer der acht Staerksten, gewichtet.
    const kandidaten = pool.slice(0, 8);
    const gewichte = kandidaten.map(c => Math.pow(Math.max(1, c.strength - 60), 2));
    let wurf = Math.random() * gewichte.reduce((s, g) => s + g, 0);
    let i = 0;
    for(; i < kandidaten.length - 1; i++){ wurf -= gewichte[i]; if(wurf <= 0) break; }
    cups[land] = kandidaten[i] ? kandidaten[i].name : null;
  });
  gameState.lastTopTables = tables;
  gameState.lastCupWinners = cups;
  return computeUefaQualification(gameState, tables, cups, null);
}

// Felder auffuellen: Vereine aus anderen Laendern nach Staerke, die
// staerksten in die CL, die naechsten in die EL, dann die Conference League.
function fillUefaFields(gameState, q){
  const vergeben = new Set([...q.cl, ...q.el, ...q.ecl]);
  const andere = EURO_CLUBS.filter(c => !vergeben.has(c.name))
    .map(c => ({ name: c.name, wert: getClubCoefficient(gameState, c.name) * 0.15 + c.strength + Math.random() * 4 }))
    .sort((a, b) => b.wert - a.wert).map(c => c.name);
  const felder = {};
  UEFA_COMP_ORDER.forEach(k => {
    const fest = [...new Set(q[k])].slice(0, UEFA_FIELD_SIZE);
    while(fest.length < UEFA_FIELD_SIZE && andere.length) fest.push(andere.shift());
    felder[k] = fest;
  });
  return felder;
}

// ---------- Auslosung der Ligaphase ----------

// Gegner-Paarungen: CL/EL mit 4 Toepfen a 9 (je 2 Gegner pro Topf, einer
// daheim, einer auswaerts), Conference League mit 6 Toepfen a 6 (je 1).
function buildLeaguePhasePairs(pots){
  const paare = [];
  const n = pots[0].length;
  if(pots.length === 4){
    pots.forEach(A => { for(let k = 0; k < n; k++) paare.push([A[k], A[(k + 1) % n]]); });
    for(let i = 0; i < pots.length; i++) for(let j = i + 1; j < pots.length; j++){
      const A = pots[i], B = shuffleArray(pots[j]);
      for(let k = 0; k < n; k++){ paare.push([A[k], B[k]]); paare.push([B[(k + 1) % n], A[k]]); }
    }
  } else {
    pots.forEach(A => { for(let k = 0; k < n; k += 2) paare.push([A[k], A[k + 1]]); });
    for(let i = 0; i < pots.length; i++) for(let j = i + 1; j < pots.length; j++){
      const A = pots[i], B = shuffleArray(pots[j]);
      for(let k = 0; k < n; k++) paare.push((i + j + k) % 2 === 0 ? [A[k], B[k]] : [B[k], A[k]]);
    }
  }
  return paare;
}

// Heim und Auswaerts gleichmaessig verteilen: der Gegnergraph ist regulaer
// mit gerader Gradzahl, entlang eines Euler-Kreises orientiert hat jedes Team
// genau so viele Heim- wie Auswaertsspiele.
function orientBalanced(paare){
  const adj = new Map();
  paare.forEach(([a, b], i) => {
    if(!adj.has(a)) adj.set(a, []);
    if(!adj.has(b)) adj.set(b, []);
    adj.get(a).push(i); adj.get(b).push(i);
  });
  const benutzt = new Array(paare.length).fill(false);
  const ergebnis = [];
  adj.forEach((kanten, start) => {
    // Hierholzer: jeder offene Kreis wird in Laufrichtung orientiert.
    const stapel = [start];
    while(stapel.length){
      const v = stapel[stapel.length - 1];
      const liste = adj.get(v);
      while(liste.length && benutzt[liste[liste.length - 1]]) liste.pop();
      if(!liste.length){ stapel.pop(); continue; }
      const e = liste.pop();
      benutzt[e] = true;
      const w = paare[e][0] === v ? paare[e][1] : paare[e][0];
      ergebnis.push([v, w]);
      stapel.push(w);
    }
  });
  return ergebnis;
}

// Spieltage zuteilen, sodass jedes Team pro Runde genau einmal spielt
// (Kantenfaerbung mit Kempe-Ketten, bei Misserfolg neuer Versuch).
function assignLeaguePhaseRounds(paare, runden){
  for(let versuch = 0; versuch < 400; versuch++){
    const belegt = new Map();
    const slot = t => { if(!belegt.has(t)) belegt.set(t, new Array(runden).fill(-1)); return belegt.get(t); };
    const runde = new Array(paare.length).fill(-1);
    let ok = true;
    for(const i of shuffleArray(paare.map((p, idx) => idx))){
      const [a, b] = paare[i];
      const A = slot(a), B = slot(b);
      let c = -1;
      for(let k = 0; k < runden; k++) if(A[k] < 0 && B[k] < 0){ c = k; break; }
      if(c < 0){
        const al = A.indexOf(-1), be = B.indexOf(-1);
        if(al < 0 || be < 0){ ok = false; break; }
        // Kette ab b in den Farben al/be umfaerben, damit al bei b frei wird.
        const pfad = [];
        let v = b, farbe = al, schutz = 0;
        while(schutz++ < 200){
          const e = slot(v)[farbe];
          if(e < 0) break;
          pfad.push(e);
          v = paare[e][0] === v ? paare[e][1] : paare[e][0];
          farbe = farbe === al ? be : al;
        }
        pfad.forEach(e => { slot(paare[e][0])[runde[e]] = -1; slot(paare[e][1])[runde[e]] = -1; });
        pfad.forEach(e => { runde[e] = runde[e] === al ? be : al; });
        let konflikt = false;
        pfad.forEach(e => {
          const x = slot(paare[e][0]), y = slot(paare[e][1]);
          if(x[runde[e]] >= 0 || y[runde[e]] >= 0) konflikt = true;
          x[runde[e]] = e; y[runde[e]] = e;
        });
        if(konflikt || A[al] >= 0 || B[al] >= 0){ ok = false; break; }
        c = al;
      }
      runde[i] = c; A[c] = i; B[c] = i;
    }
    if(ok) return runde;
  }
  return null;
}

function drawLeaguePhase(gameState, teams, cfg){
  const proTopf = UEFA_FIELD_SIZE / cfg.pots;
  const sortiert = [...teams].sort((a, b) => a.pot - b.pot);
  let bestes = null, besteKonflikte = Infinity;
  for(let versuch = 0; versuch < 120 && besteKonflikte > 0; versuch++){
    const pots = [];
    for(let p = 0; p < cfg.pots; p++) pots.push(shuffleArray(sortiert.slice(p * proTopf, (p + 1) * proTopf).map(t => t.name)));
    const paare = orientBalanced(buildLeaguePhasePairs(pots));
    const land = new Map(teams.map(t => [t.name, t.country]));
    const konflikte = paare.filter(([a, b]) => land.get(a) === land.get(b)).length;
    if(konflikte >= besteKonflikte) continue;
    const runden = assignLeaguePhaseRounds(paare, cfg.rounds);
    if(!runden) continue;
    bestes = paare.map(([home, away], i) => ({ home, away, round: runden[i], played: false }));
    besteKonflikte = konflikte;
  }
  return bestes || [];
}

function createUefaComp(gameState, key, namen, holder){
  const cfg = UEFA_COMPS[key];
  const teams = namen.map(name => ({
    name, strength: uefaClubStrength(gameState, name), country: uefaCountryOf(gameState, name),
    coeff: getClubCoefficient(gameState, name),
    played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, points: 0
  }));
  // Lostoepfe nach Vereinskoeffizient, der Titelverteidiger in Topf 1.
  const proTopf = UEFA_FIELD_SIZE / cfg.pots;
  [...teams].sort((a, b) => (b.name === holder) - (a.name === holder) || b.coeff - a.coeff || b.strength - a.strength)
    .forEach((t, i) => { t.pot = Math.floor(i / proTopf) + 1; });
  return {
    key, teams, fixtures: drawLeaguePhase(gameState, teams, cfg),
    phase: "league", round: 0, koStage: -1, ties: [], koHistory: [],
    winner: null, ownOut: false, ownBest: -1, ownExit: null
  };
}

// Neue Europapokal-Saison mit allen drei Wettbewerben.
function createUefaSeason(gameState, quali){
  ensureCoefficients(gameState);
  const q = quali || gameState.uefaQualification || seedUefaQualification(gameState);
  const felder = fillUefaFields(gameState, q);
  const holders = q.holders || {};
  const uefa = { season: gameState.season, dateIdx: 0, comps: {}, own: null, goal: null, eps: q.eps || [] };
  UEFA_COMP_ORDER.forEach(k => {
    uefa.comps[k] = createUefaComp(gameState, k, felder[k], k === "cl" ? holders.cl : k === "el" ? holders.el : holders.ecl);
    uefa.comps[k].teams.forEach(t => addCoefficientPoints(gameState, t.name, UEFA_COMPS[k].coeffBonus));
    if(felder[k].includes(gameState.clubName)) uefa.own = k;
  });
  gameState.uefa = uefa;
  if(uefa.own) setupOwnUefaCampaign(gameState);
  return uefa;
}

// Vorstandsziel und Startpraemie fuer den eigenen Wettbewerb.
function setupOwnUefaCampaign(gameState){
  const uefa = gameState.uefa;
  const cfg = UEFA_COMPS[uefa.own];
  const comp = uefa.comps[uefa.own];
  const eigene = getOwnClubStrength(gameState);
  const rang = comp.teams.filter(t => t.name !== gameState.clubName && t.strength > eigene).length + 1;
  const stufe = rang <= 4 ? 2 : rang <= 10 ? 1 : rang <= 22 ? 0 : -1;
  uefa.goal = stufe >= 0 ? { stage: stufe, label: `${UEFA_KO_STAGES[stufe]} erreichen` } : null;
  gameState.budget = addToBudget(gameState.budget, cfg.prize.start);
  addLogEntry(gameState, `${cfg.icon} ${cfg.name}: Startprämie ${fmtMoney(cfg.prize.start)}${uefa.goal ? ` · Vorstandsziel: ${uefa.goal.label}` : ""}`, "win", true);
}

// ---------- Spiele ----------

function uefaSides(gameState, name){
  if(name === gameState.clubName){
    const ad = getTeamAttackDefence(gameState.squad, gameState.matchday + 1);
    return { attack: ad.attack, defence: ad.defence };
  }
  const s = uefaClubStrength(gameState, name);
  return { attack: s, defence: s };
}

function uefaLambdas(gameState, home, away, neutral){
  const h = uefaSides(gameState, home), a = uefaSides(gameState, away);
  const basis = getBaseLambdas(h, a, neutral);
  let lh = basis.home, la = basis.away;
  if(home === gameState.clubName){ const t = applyTactic(gameState, lh, la); lh = t.own; la = t.opp; }
  else if(away === gameState.clubName){ const t = applyTactic(gameState, la, lh); la = t.own; lh = t.opp; }
  const konter = getTacticMatchup(getTeamTactic(gameState, home, away, h.attack, a.attack),
    getTeamTactic(gameState, away, home, a.attack, h.attack));
  return { home: Math.max(0.25, lh + konter.own), away: Math.max(0.25, la + konter.opp) };
}

// Punkte fuer die Wertung und, beim eigenen Verein, Praemien.
function creditUefaResult(gameState, comp, home, away, hg, ag){
  const cfg = UEFA_COMPS[comp.key];
  [[home, hg, ag], [away, ag, hg]].forEach(([name, eigen, fremd]) => {
    addCoefficientPoints(gameState, name, eigen > fremd ? UEFA_COEFF_WIN : eigen === fremd ? UEFA_COEFF_DRAW : 0);
    if(name !== gameState.clubName) return;
    const praemie = eigen > fremd ? cfg.prize.win : eigen === fremd ? cfg.prize.draw : 0;
    if(praemie > 0) gameState.budget = addToBudget(gameState.budget, praemie);
  });
}

function getUefaLeagueTable(comp){
  return [...comp.teams].sort((a, b) => b.points - a.points
    || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf || b.coeff - a.coeff);
}

function playUefaLeagueRound(gameState, comp, r){
  const spiele = [];
  comp.fixtures.filter(f => f.round === r && !f.played).forEach(f => {
    const l = uefaLambdas(gameState, f.home, f.away, false);
    const e = rollScore(l.home, l.away);
    f.homeGoals = e.homeGoals; f.awayGoals = e.awayGoals; f.played = true;
    updateStandings(comp.teams, f.home, f.away, e.homeGoals, e.awayGoals);
    creditUefaResult(gameState, comp, f.home, f.away, e.homeGoals, e.awayGoals);
    spiele.push(f);
  });
  comp.round = r + 1;
  if(comp.round >= UEFA_COMPS[comp.key].rounds) finishUefaLeaguePhase(gameState, comp);
  return spiele;
}

function finishUefaLeaguePhase(gameState, comp){
  const tabelle = getUefaLeagueTable(comp);
  comp.finalTable = tabelle.map(t => t.name);
  comp.phase = "ko";
  tabelle.slice(0, UEFA_DIRECT_R16).forEach(t => addCoefficientPoints(gameState, t.name, 1));
  const platz = comp.finalTable.indexOf(gameState.clubName) + 1;
  if(platz > 0 && gameState.uefa.own === comp.key){
    const cfg = UEFA_COMPS[comp.key];
    if(platz > UEFA_PLAYOFF_UNTIL){
      comp.ownOut = true;
      comp.ownExit = `Ligaphase (Platz ${platz})`;
      addLogEntry(gameState, `${cfg.icon} ${cfg.name}: Aus in der Ligaphase als ${platz}.`, "loss", true);
      evaluateOwnUefaCampaign(gameState);
    } else {
      comp.ownBest = platz <= UEFA_DIRECT_R16 ? 1 : 0;
      const stufe = comp.ownBest;
      const praemie = cfg.prize.stages.slice(0, stufe + 1).reduce((s, x) => s + x, 0);
      gameState.budget = addToBudget(gameState.budget, praemie);
      addLogEntry(gameState, `${cfg.icon} ${cfg.name}: Ligaphase auf Platz ${platz} · ${platz <= UEFA_DIRECT_R16 ? "Achtelfinale" : "K.o.-Play-offs"} · Prämie ${fmtMoney(praemie)}`, "win", true);
    }
  }
  drawUefaKnockout(gameState, comp, 0);
}

// Paarungen ziehen; moeglichst keine zwei Vereine aus demselben Land.
function pairAvoidingCountry(gameState, gesetzt, ungesetzt, landSperre){
  let beste = null, besteKonflikte = Infinity;
  for(let v = 0; v < 60 && besteKonflikte > 0; v++){
    const u = shuffleArray(ungesetzt);
    const k = landSperre ? gesetzt.filter((g, i) => uefaCountryOf(gameState, g) === uefaCountryOf(gameState, u[i])).length : 0;
    if(k < besteKonflikte){ beste = u; besteKonflikte = k; }
  }
  return gesetzt.map((g, i) => ({ seeded: g, other: beste[i] }));
}

function drawUefaKnockout(gameState, comp, stufe){
  comp.koStage = stufe;
  let ties = [];
  if(stufe === 0){
    const gesetzt = comp.finalTable.slice(UEFA_DIRECT_R16, 16);
    const ungesetzt = comp.finalTable.slice(16, UEFA_PLAYOFF_UNTIL);
    ties = pairAvoidingCountry(gameState, gesetzt, ungesetzt, true).map(p => ({ a: p.other, b: p.seeded, legs: [] }));
  } else if(stufe === 1){
    const gesetzt = comp.finalTable.slice(0, UEFA_DIRECT_R16);
    const sieger = comp.koHistory[0].ties.map(t => t.winner);
    ties = pairAvoidingCountry(gameState, gesetzt, sieger, true).map(p => ({ a: p.other, b: p.seeded, legs: [] }));
  } else {
    const sieger = shuffleArray(comp.koHistory[stufe - 1].ties.map(t => t.winner));
    for(let i = 0; i < sieger.length; i += 2) ties.push({ a: sieger[i], b: sieger[i + 1], legs: [], final: stufe === 4 });
  }
  comp.ties = ties;
  const eigene = ties.find(t => t.a === gameState.clubName || t.b === gameState.clubName);
  if(eigene && gameState.uefa.own === comp.key && !comp.ownOut){
    const gegner = eigene.a === gameState.clubName ? eigene.b : eigene.a;
    const cfg = UEFA_COMPS[comp.key];
    const text = stufe === 4 ? `Finale gegen ${gegner}` : `${UEFA_KO_STAGES[stufe]}: ${gegner} (${eigene.a === gameState.clubName ? "Hinspiel daheim" : "Hinspiel auswärts"})`;
    addLogEntry(gameState, `🎲 ${cfg.name} — Auslosung: ${text}.`, null, true);
    if(typeof queueUefaDrawModal === "function") queueUefaDrawModal(gameState, comp.key, stufe);
  }
}

// Ein Termin einer K.o.-Runde: Hinspiel (leg 0), Rueckspiel (leg 1) oder Finale.
function playUefaKnockoutLeg(gameState, comp, leg){
  const spiele = [];
  comp.ties.forEach(t => {
    if(t.final){
      const l = uefaLambdas(gameState, t.a, t.b, true);
      const e = rollScore(l.home, l.away);
      const spiel = { home: t.a, away: t.b, homeGoals: e.homeGoals, awayGoals: e.awayGoals, neutral: true };
      if(e.homeGoals === e.awayGoals){
        const ko = resolveKnockoutDraw(l.home, l.away, uefaClubStrength(gameState, t.a), uefaClubStrength(gameState, t.b));
        Object.assign(spiel, { extraTime: true, etHome: ko.etHome, etAway: ko.etAway, pens: ko.pens });
        spiel.homeGoals += ko.etHome; spiel.awayGoals += ko.etAway;
        t.winner = ko.homeWins ? t.a : t.b;
      } else t.winner = e.homeGoals > e.awayGoals ? t.a : t.b;
      creditUefaResult(gameState, comp, t.a, t.b, e.homeGoals, e.awayGoals);
      t.legs.push(spiel);
      spiele.push(Object.assign({ tie: t }, spiel));
      return;
    }
    const home = leg === 0 ? t.a : t.b, away = leg === 0 ? t.b : t.a;
    const l = uefaLambdas(gameState, home, away, false);
    const e = rollScore(l.home, l.away);
    const spiel = { home, away, homeGoals: e.homeGoals, awayGoals: e.awayGoals };
    creditUefaResult(gameState, comp, home, away, e.homeGoals, e.awayGoals);
    if(leg === 1){
      const hin = t.legs[0];
      const toreA = hin.homeGoals + spiel.awayGoals, toreB = hin.awayGoals + spiel.homeGoals;
      if(toreA === toreB){
        // Gleichstand nach Hin- und Rueckspiel: Verlaengerung, dann Elfmeter.
        const ko = resolveKnockoutDraw(l.home, l.away, uefaClubStrength(gameState, home), uefaClubStrength(gameState, away));
        Object.assign(spiel, { extraTime: true, etHome: ko.etHome, etAway: ko.etAway, pens: ko.pens });
        spiel.homeGoals += ko.etHome; spiel.awayGoals += ko.etAway;
        t.winner = ko.homeWins ? home : away;
      } else t.winner = toreA > toreB ? t.a : t.b;
      t.aggA = hin.homeGoals + spiel.awayGoals;
      t.aggB = hin.awayGoals + spiel.homeGoals;
    }
    t.legs.push(spiel);
    spiele.push(Object.assign({ tie: t }, spiel));
  });
  if(leg === 1 || comp.ties.some(t => t.final)) resolveUefaStage(gameState, comp);
  return spiele;
}

function resolveUefaStage(gameState, comp){
  const stufe = comp.koStage;
  const cfg = UEFA_COMPS[comp.key];
  comp.koHistory.push({ stage: stufe, ties: comp.ties });
  // Jede erreichte Runde ab dem Achtelfinale gibt einen Wertungspunkt.
  comp.ties.forEach(t => addCoefficientPoints(gameState, t.winner, 1));

  const eigene = comp.ties.find(t => t.a === gameState.clubName || t.b === gameState.clubName);
  if(eigene && gameState.uefa.own === comp.key && !comp.ownOut){
    if(eigene.winner === gameState.clubName){
      if(stufe === 4){
        comp.ownBest = 5;
        gameState.budget = addToBudget(gameState.budget, cfg.prize.champion);
        addLogEntry(gameState, `${cfg.icon}👑 ${cfg.name} gewonnen · Prämie ${fmtMoney(cfg.prize.champion)}`, "win", true);
        changeReputation(gameState, cfg.reputation.title);
        if(typeof unlockAchievement === "function") unlockAchievement("europeChampion");
        if(typeof showToast === "function") showToast(`${cfg.icon}👑 ${cfg.name} gewonnen`, "success");
        evaluateOwnUefaCampaign(gameState);
      } else {
        comp.ownBest = Math.max(comp.ownBest, stufe + 1);
        const praemie = cfg.prize.stages[stufe + 1] || 0;
        gameState.budget = addToBudget(gameState.budget, praemie);
        addLogEntry(gameState, `${cfg.icon} ${cfg.name}: ${UEFA_KO_STAGES[stufe + 1]} erreicht · Prämie ${fmtMoney(praemie)}`, "win", true);
        changeReputation(gameState, cfg.reputation.stage);
        addBoardCredit(gameState, BOARD_EUROPE_ROUND_CREDIT);
      }
    } else {
      comp.ownOut = true;
      comp.ownExit = stufe === 4 ? "Finale" : UEFA_KO_STAGES[stufe];
      addLogEntry(gameState, `${cfg.icon} ${cfg.name}: Aus im ${comp.ownExit} gegen ${eigene.winner}.`, "loss", true);
      evaluateOwnUefaCampaign(gameState);
    }
  }

  if(stufe === 4){
    comp.winner = comp.ties[0].winner;
    comp.phase = "done";
    addHonour(gameState, comp.key, cfg.name, comp.winner);
    if(typeof addNews === "function") addNews(gameState, `${comp.winner} gewinnt die ${cfg.name}.`, cfg.icon);
  } else {
    drawUefaKnockout(gameState, comp, stufe + 1);
  }
}

// Vorstand und Ruf am Ende des eigenen Laufs.
function evaluateOwnUefaCampaign(gameState){
  const uefa = gameState.uefa;
  if(!uefa || !uefa.own || uefa.goalEvaluated) return;
  const comp = uefa.comps[uefa.own];
  uefa.goalEvaluated = true;
  const ziel = uefa.goal;
  if(!ziel || !gameState.board) return;
  const erreicht = comp.ownBest;
  if(erreicht >= ziel.stage){
    gameState.board.patience = Math.min(100, gameState.board.patience + BOARD_EUROPE_GOAL_BONUS);
    addLogEntry(gameState, `👔 Europapokal-Ziel erfüllt: ${ziel.label}`, "win");
  } else if(erreicht <= ziel.stage - 2 || erreicht < 0){
    gameState.board.patience = Math.max(0, gameState.board.patience - BOARD_EUROPE_GOAL_MISS);
    addLogEntry(gameState, `👔 Europapokal-Ziel verfehlt: ${ziel.label}`, "loss");
  }
}

// ---------- Termine ----------

function getUefaDates(gameState){
  const tage = UEFA_DATES.map(m => scaleMatchday(m, gameState));
  for(let i = 1; i < tage.length; i++) if(tage[i] <= tage[i - 1]) tage[i] = tage[i - 1] + 1;
  return tage;
}

// Was an Termin d in einem Wettbewerb ansteht.
function getUefaDateStage(comp, d){
  const cfg = UEFA_COMPS[comp.key];
  if(d < UEFA_LEAGUE_DATES){
    return comp.phase === "league" && d < cfg.rounds ? { type: "league", round: d } : null;
  }
  const stufe = Math.min(4, Math.floor((d - UEFA_LEAGUE_DATES) / 2));
  const leg = stufe === 4 ? 0 : (d - UEFA_LEAGUE_DATES) % 2;
  return comp.phase === "ko" && comp.koStage === stufe ? { type: "ko", stage: stufe, leg } : null;
}

function getUefaDateLabel(comp, d){
  const st = getUefaDateStage(comp, d);
  if(!st) return "";
  if(st.type === "league") return `Ligaphase ${st.round + 1}/${UEFA_COMPS[comp.key].rounds}`;
  if(st.stage === 4) return "Finale";
  return `${UEFA_KO_STAGES[st.stage]} · ${st.leg === 0 ? "Hinspiel" : "Rückspiel"}`;
}

function isOwnUefaActive(gameState){
  const uefa = gameState.uefa;
  if(!uefa || !uefa.own) return false;
  const comp = uefa.comps[uefa.own];
  return !!comp && !comp.ownOut && !comp.winner;
}

function uefaOwnMatchOnDate(gameState, d){
  if(!isOwnUefaActive(gameState)) return false;
  const comp = gameState.uefa.comps[gameState.uefa.own];
  const st = getUefaDateStage(comp, d);
  if(!st) return false;
  const me = gameState.clubName;
  if(st.type === "league") return comp.fixtures.some(f => f.round === st.round && (f.home === me || f.away === me));
  return comp.ties.some(t => t.a === me || t.b === me);
}

// Naechster eigener Europapokal-Termin vor dem kommenden Spieltag.
function getUefaEvent(gameState){
  const uefa = gameState.uefa;
  if(!uefa) return null;
  const tage = getUefaDates(gameState);
  const d = uefa.dateIdx;
  if(d >= tage.length || tage[d] > gameState.matchday + 1) return null;
  if(!uefaOwnMatchOnDate(gameState, d)) return null;
  const comp = uefa.comps[uefa.own];
  return { stage: d, label: `${UEFA_COMPS[uefa.own].short} · ${getUefaDateLabel(comp, d)}`, comp: uefa.own };
}

// Einen Termin in allen drei Wettbewerben spielen. Liefert das eigene Spiel.
function playUefaDate(gameState){
  const uefa = gameState.uefa;
  if(!uefa) return null;
  const d = uefa.dateIdx;
  let eigenes = null;
  UEFA_COMP_ORDER.forEach(k => {
    const comp = uefa.comps[k];
    if(!comp) return;
    const st = getUefaDateStage(comp, d);
    if(!st) return;
    const label = getUefaDateLabel(comp, d);
    const spiele = st.type === "league" ? playUefaLeagueRound(gameState, comp, st.round) : playUefaKnockoutLeg(gameState, comp, st.leg);
    if(k !== uefa.own) return;
    const mein = spiele.find(s => s.home === gameState.clubName || s.away === gameState.clubName);
    if(!mein) return;
    eigenes = { comp: k, label, match: mein, stage: st,
      others: spiele.filter(s => s !== mein).map(s => ({ home: s.home, away: s.away, homeGoals: s.homeGoals, awayGoals: s.awayGoals })) };
    if(st.type === "league"){
      const tab = getUefaLeagueTable(comp);
      eigenes.tablePosition = tab.findIndex(t => t.name === gameState.clubName) + 1;
    }
  });
  uefa.dateIdx = d + 1;
  return eigenes;
}

// Termine ohne eigenes Spiel laufen im Hintergrund bis zum naechsten Spieltag.
function advanceUefaBackground(gameState){
  const uefa = gameState.uefa;
  if(!uefa) return 0;
  const tage = getUefaDates(gameState);
  let n = 0;
  while(uefa.dateIdx < tage.length && tage[uefa.dateIdx] <= gameState.matchday + 1
        && !uefaOwnMatchOnDate(gameState, uefa.dateIdx)){
    playUefaDate(gameState);
    n++;
  }
  return n;
}

// Saisonende: alles Ausstehende spielen (auch eigene Spiele, falls noetig).
function finishUefaSeason(gameState){
  const uefa = gameState.uefa;
  if(!uefa) return;
  let schutz = 0;
  while(uefa.dateIdx < UEFA_DATES.length && schutz++ < 40) playUefaDate(gameState);
  closeCoefficientSeason(gameState);
}

function getUefaHolders(gameState){
  const uefa = gameState.uefa;
  if(!uefa) return null;
  return { cl: uefa.comps.cl && uefa.comps.cl.winner, el: uefa.comps.el && uefa.comps.el.winner, ecl: uefa.comps.ecl && uefa.comps.ecl.winner };
}

// Kurzbeschreibung des eigenen Abschneidens fuer den Saisonverlauf.
function describeOwnUefaResult(gameState){
  const uefa = gameState.uefa;
  if(!uefa || !uefa.own) return null;
  const comp = uefa.comps[uefa.own];
  const cfg = UEFA_COMPS[uefa.own];
  if(comp.winner === gameState.clubName) return `${cfg.short}: Sieger`;
  if(comp.ownExit) return `${cfg.short}: ${comp.ownExit}`;
  return `${cfg.short}: läuft`;
}

// ---------- Supercups ----------

// Zum Saisonstart: Meister gegen Pokalsieger in jedem Land, dazu CL- gegen
// EL-Sieger. Ist der Meister auch Pokalsieger, spielt der Vizemeister.
function createSupercups(gameState){
  const tabellen = gameState.lastTopTables || {};
  const pokale = gameState.lastCupWinners || {};
  const liste = [];
  Object.keys(SUPERCUP_NAMES).forEach(land => {
    const tab = tabellen[land] || [];
    const meister = tab[0];
    let pokal = pokale[land];
    if(!meister) return;
    if(!pokal || pokal === meister) pokal = tab[1];
    if(!pokal) return;
    liste.push({ key: land, name: SUPERCUP_NAMES[land], a: meister, b: pokal, played: false });
  });
  const h = gameState.lastUefaHolders;
  if(h && h.cl && h.el && h.cl !== h.el){
    liste.push({ key: "uefa", name: "UEFA Super Cup", a: h.cl, b: h.el, played: false });
  }
  gameState.supercups = { season: gameState.season, list: liste };
  return gameState.supercups;
}

function getPendingOwnSupercup(gameState){
  const sc = gameState.supercups;
  if(!sc || gameState.matchday > 0) return null;
  return sc.list.find(s => !s.played && (s.a === gameState.clubName || s.b === gameState.clubName)) || null;
}

function playSupercup(gameState, sc){
  const l = uefaLambdas(gameState, sc.a, sc.b, true);
  const e = rollScore(l.home, l.away);
  sc.homeGoals = e.homeGoals; sc.awayGoals = e.awayGoals;
  if(e.homeGoals === e.awayGoals){
    // Supercups gehen ohne Verlaengerung direkt ins Elfmeterschiessen.
    sc.pens = penaltyShootout(uefaClubStrength(gameState, sc.a), uefaClubStrength(gameState, sc.b));
    sc.winner = sc.pens.home > sc.pens.away ? sc.a : sc.b;
  } else sc.winner = e.homeGoals > e.awayGoals ? sc.a : sc.b;
  sc.played = true;
  addHonour(gameState, "super-" + sc.key, sc.name, sc.winner);
  if(sc.a === gameState.clubName || sc.b === gameState.clubName){
    const sieg = sc.winner === gameState.clubName;
    if(sieg){
      const praemie = sc.key === "uefa" ? UEFA_SUPERCUP_PRIZE : SUPERCUP_PRIZE;
      gameState.budget = addToBudget(gameState.budget, praemie);
      changeReputation(gameState, sc.key === "uefa" ? 2 : 1);
    }
    addLogEntry(gameState, `🏆 ${sc.name}: ${sc.a} ${sc.homeGoals}:${sc.awayGoals} ${sc.b}${sc.pens ? ` (i.E. ${sc.pens.home}:${sc.pens.away})` : ""} · ${sieg ? "Titel" : "verloren"}`, sieg ? "win" : "loss", true);
  } else if(typeof addNews === "function"){
    addNews(gameState, `${sc.winner} gewinnt den ${sc.name}.`, "🏆");
  }
  return sc;
}

// Alle Supercups ohne eigene Beteiligung spielen (zum ersten Spieltag).
function playBackgroundSupercups(gameState){
  const sc = gameState.supercups;
  if(!sc) return;
  sc.list.filter(s => !s.played && s.a !== gameState.clubName && s.b !== gameState.clubName)
    .forEach(s => playSupercup(gameState, s));
}

// ---------- Ehrentafel ----------

function addHonour(gameState, key, label, winner){
  gameState.honours = gameState.honours || [];
  const vorhanden = gameState.honours.find(h => h.season === gameState.season && h.key === key);
  const mine = winner === gameState.clubName;
  if(vorhanden){ vorhanden.winner = winner; vorhanden.mine = mine; return; }
  gameState.honours.push({ season: gameState.season, key, label, winner, mine });
}

// Titel eines Vereins, gruppiert nach Wettbewerb.
function getClubTitles(gameState, name){
  const zaehler = {};
  (gameState.honours || []).filter(h => h.winner === name).forEach(h => {
    zaehler[h.label] = (zaehler[h.label] || 0) + 1;
  });
  return Object.keys(zaehler).map(label => ({ label, count: zaehler[label] }))
    .sort((a, b) => b.count - a.count);
}

// ---------- Aeltere Spielstaende ----------

// Spielstaende mit dem alten Europapokal bekommen die neuen Wettbewerbe;
// bereits vergangene Termine werden still nachgespielt.
function ensureUefaState(gameState){
  ensureCoefficients(gameState);
  gameState.honours = gameState.honours || [];
  if(gameState.uefa && gameState.uefa.comps) return false;
  createUefaSeason(gameState, gameState.uefaQualification || null);
  if(!gameState.supercups) gameState.supercups = { season: gameState.season, list: [] };
  const tage = getUefaDates(gameState);
  while(gameState.uefa.dateIdx < tage.length && tage[gameState.uefa.dateIdx] < gameState.matchday + 1) playUefaDate(gameState);
  advanceUefaBackground(gameState);
  delete gameState.europe;
  delete gameState.europeQualifiers;
  return true;
}
