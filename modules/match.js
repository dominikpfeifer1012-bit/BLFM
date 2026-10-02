// ============================================
// MATCH.JS - Spielsimulation, Tabelle, Spielplan, Verletzungen, Karten, Entwicklung
// ============================================

function generateFixtures(clubNames){
  const names = [...clubNames];
  const firstLeg = [];
  const n = names.length;
  // Rundenverfahren mit festem Drehpunkt: ohne Korrektur wandert jedes Team
  // in einem Block durch die Heimpositionen und bekommt dadurch Serien von
  // bis zu 17 gleichen Platzwahlen. Das Heimrecht wechselt deshalb mit dem
  // Paarungsindex, die feste Paarung mit dem Drehpunkt zusaetzlich pro Runde.
  for(let round = 0; round < n - 1; round++){
    for(let i = 0; i < n / 2; i++){
      const a = names[i];
      const b = names[n - 1 - i];
      if(a === b) continue;

      let swap = i % 2 === 1;
      if(i === 0 && round % 2 === 1) swap = !swap;

      firstLeg.push(swap
        ? { home: b, away: a, played: false }
        : { home: a, away: b, played: false });
    }
    names.splice(1, 0, names.pop());
  }
  const secondLeg = firstLeg.map(f => ({ home: f.away, away: f.home, played: false }));
  return firstLeg.concat(secondLeg);
}

function poisson(lambda){
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do{
    k++;
    p *= Math.random();
  } while(p > L);
  return k - 1;
}

// Torerwartung zweier Mannschaften aus Angriff und Abwehr. neutral: kein
// Heimvorteil (z.B. Endspiel).
function getBaseLambdas(h, a, neutral){
  const hv = neutral ? 0 : MATCH_ENGINE.homeAdvantage;
  const e = MATCH_ENGINE;
  return {
    home: Math.max(e.minLambda, e.baseGoals * Math.exp((h.attack + hv - a.defence) / e.scale)),
    away: Math.max(e.minLambda, e.baseGoals * Math.exp((a.attack - h.defence - hv) / e.scale))
  };
}

// Ergebnis wuerfeln. Ein kleiner gemeinsamer Anteil (bivariater Poisson)
// koppelt die Tore beider Teams: realistischer Remis-Anteil, gleicher Schnitt.
// anteil: Spielzeitanteil, z.B. eine Halbzeit.
function rollScore(lambdaHome, lambdaAway, anteil){
  const f = anteil != null ? anteil : 1;
  const lh = lambdaHome * f, la = lambdaAway * f;
  const c = Math.min(MATCH_ENGINE.sharedGoals * f, lh * 0.4, la * 0.4);
  const z = poisson(c);
  return { homeGoals: poisson(lh - c) + z, awayGoals: poisson(la - c) + z };
}

function getTeamStrength(gameState, teamName){
  if(teamName === gameState.clubName){
    return teamRating(gameState.squad, gameState.matchday + 1);
  }
  const team = gameState.teams.find(t => t.name === teamName);
  if(team) return team.strength;

  // Im Pokal treten Vereine aus allen Ligen an. Ohne diesen Rueckgriff
  // bekaeme jeder Unterklassige pauschal den Standardwert.
  const club = typeof findClubEverywhere === "function"
    ? findClubEverywhere(gameState, teamName) : null;
  return club ? club.strength : 50;
}

function getActiveTactic(gameState){
  const key = gameState && gameState.tactic;
  return TACTICS[key] || TACTICS[DEFAULT_TACTIC];
}

// Die Grundausrichtung verschiebt beide Torerwartungen: offensiv erhoeht
// eigene UND gegnerische, defensiv senkt beide.
function applyTactic(gameState, lambdaOwn, lambdaOpp){
  const t = getActiveTactic(gameState);
  return {
    own: Math.max(0.25, lambdaOwn + t.own),
    opp: Math.max(0.25, lambdaOpp + t.opp)
  };
}

// Angriff und Abwehr getrennt. Fuer KI-Verene sind beide Werte gleich der
// Vereinsstaerke — dadurch rechnet die Formel fuer KI-Duelle exakt wie vorher,
// und nur die eigenen Spiele bekommen durch die Attribute Struktur.
// Form gilt nur in der Liga (Tabellenzeile mit den letzten Ergebnissen).
function getTeamFormBonus(gameState, teamName){
  const row = gameState.teams ? gameState.teams.find(t => t.name === teamName) : null;
  return typeof getFormBonus === "function" ? getFormBonus(row) : 0;
}

function getTeamSides(gameState, teamName){
  if(teamName === gameState.clubName){
    const ad = getTeamAttackDefence(gameState.squad, gameState.matchday + 1);
    // Der Trainingsschwerpunkt wirkt sofort auf die Spielweise, nicht nur
    // ueber die langsame Entwicklung der Attribute.
    const training = typeof getActiveTraining === "function" ? getActiveTraining() : null;
    const effekt = (training && training.match) || { att: 0, def: 0 };
    const lager = typeof getCampBoost === "function" ? getCampBoost(gameState) : 0;
    const form = getTeamFormBonus(gameState, teamName);
    return { attack: ad.attack + effekt.att + lager + form, defence: ad.defence + effekt.def + lager + form };
  }
  const strength = getTeamStrength(gameState, teamName) + getTeamFormBonus(gameState, teamName);
  return { attack: strength, defence: strength };
}

// Torerwartung beider Teams. Getrennt vom Wuerfeln, damit sich ein Spiel
// auch halbzeitweise berechnen laesst (Taktikwechsel zur Pause).
function getMatchLambdas(gameState, home, away){
  const h = getTeamSides(gameState, home);
  const a = getTeamSides(gameState, away);
  const basis = getBaseLambdas(h, a);
  let lambdaHome = basis.home;
  let lambdaAway = basis.away;

  // Grundausrichtung der eigenen Mannschaft
  if(home === gameState.clubName){
    const t = applyTactic(gameState, lambdaHome, lambdaAway);
    lambdaHome = t.own; lambdaAway = t.opp;
  } else if(away === gameState.clubName){
    const t = applyTactic(gameState, lambdaAway, lambdaHome);
    lambdaAway = t.own; lambdaHome = t.opp;
  }

  // Taktische Konter: wie die beiden Ausrichtungen aufeinander wirken.
  const heimTaktik = getTeamTactic(gameState, home, away, h.attack, a.attack);
  const gastTaktik = getTeamTactic(gameState, away, home, a.attack, h.attack);
  const konter = getTacticMatchup(heimTaktik, gastTaktik);
  lambdaHome = Math.max(0.25, lambdaHome + konter.own);
  lambdaAway = Math.max(0.25, lambdaAway + konter.opp);

  return { home: lambdaHome, away: lambdaAway };
}

function simulateMatch(gameState, home, away){
  const l = getMatchLambdas(gameState, home, away);
  return rollScore(l.home, l.away);
}

function updateStandings(teams, home, away, homeGoals, awayGoals){
  const h = teams.find(t => t.name === home);
  const a = teams.find(t => t.name === away);

  h.played++; a.played++;
  h.gf += homeGoals; h.ga += awayGoals;
  a.gf += awayGoals; a.ga += homeGoals;

  if(homeGoals > awayGoals){
    h.won++; h.points += 3; a.lost++;
  } else if(homeGoals < awayGoals){
    a.won++; a.points += 3; h.lost++;
  } else {
    h.drawn++; a.drawn++; h.points++; a.points++;
  }
  if(typeof pushForm === "function"){
    pushForm(h, homeGoals > awayGoals ? 3 : homeGoals === awayGoals ? 1 : 0);
    pushForm(a, awayGoals > homeGoals ? 3 : homeGoals === awayGoals ? 1 : 0);
  }
}

function getResultForClub(clubName, home, away, homeGoals, awayGoals){
  const isHome = home === clubName;
  const ownGoals = isHome ? homeGoals : awayGoals;
  const oppGoals = isHome ? awayGoals : homeGoals;

  if(ownGoals > oppGoals) return "win";
  if(ownGoals < oppGoals) return "loss";
  return "draw";
}

// incidents: im Spiel geplante Verletzungen der Startelf (mit Minute). Dann
// wuerfelt hier nur noch die Bank (Training).
function processInjuries(gameState, matchdayJustPlayed, chanceFactor, incidents){
  const startingIds = getStartingXIIds(gameState.squad, matchdayJustPlayed);
  const newlyInjured = [];
  const factor = chanceFactor != null ? chanceFactor : 1;

  if(incidents){
    incidents.filter(i => i.type === "injury" && i.side === "own").forEach(i => {
      const player = gameState.squad.find(p => p.id === i.playerId);
      if(!player) return;
      player.injuredUntilMatchday = matchdayJustPlayed + i.duration;
      newlyInjured.push({ player, duration: i.duration, wasStarter: true, minute: i.minute });
    });
  }

  gameState.squad.forEach(player => {
    if(isInjured(player, matchdayJustPlayed)) return;

    const isStarter = startingIds.has(player.id);
    if(incidents && isStarter) return;
    const training = typeof getActiveTraining === "function" ? getActiveTraining().injury : 1;
    const medizin = typeof getMedicalInjuryFactor === "function" ? getMedicalInjuryFactor(gameState) : 1;
    const chance = (isStarter ? INJURY_CHANCE_STARTER : INJURY_CHANCE_BENCH) * factor * training * medizin;

    if(Math.random() < chance){
      const duration = randInt(INJURY_MIN_DURATION, INJURY_MAX_DURATION);
      player.injuredUntilMatchday = matchdayJustPlayed + duration;
      newlyInjured.push({ player, duration, wasStarter: isStarter });
    }
  });

  return newlyInjured;
}

// incidents: Platzverweise stehen dann schon fest (mit Minute).
function processCards(startingXI, matchdayJustPlayed, incidents){
  const cardEvents = [];
  const rote = new Set();
  if(incidents){
    incidents.filter(i => i.type === "red" && i.side === "own").forEach(i => {
      const player = startingXI.find(p => p.id === i.playerId);
      if(!player) return;
      player.suspendedUntilMatchday = matchdayJustPlayed + RED_CARD_BAN_MATCHES;
      cardEvents.push({ player, type: "red", minute: i.minute });
      rote.add(player.id);
    });
  }

  startingXI.forEach(player => {
    if(rote.has(player.id)) return;
    if(!incidents && Math.random() < RED_CARD_CHANCE){
      player.suspendedUntilMatchday = matchdayJustPlayed + RED_CARD_BAN_MATCHES;
      cardEvents.push({ player, type: "red" });
      return;
    }

    if(Math.random() < YELLOW_CARD_CHANCE_STARTER){
      player.yellowCards = (player.yellowCards || 0) + 1;
      if(player.yellowCards >= YELLOW_CARDS_FOR_BAN){
        player.yellowCards = 0;
        player.suspendedUntilMatchday = matchdayJustPlayed + YELLOW_ACCUMULATION_BAN_MATCHES;
        cardEvents.push({ player, type: "banAccumulated" });
      } else {
        cardEvents.push({ player, type: "yellow" });
      }
    }
  });

  return cardEvents;
}

function assignScorers(startingXI, goalCount){
  if(goalCount <= 0) return [];

  const weighted = [];
  startingXI.forEach(p => {
    const weight = SCORER_WEIGHTS[p.pos] != null ? SCORER_WEIGHTS[p.pos] : 1;
    for(let i = 0; i < weight; i++) weighted.push(p);
  });
  if(weighted.length === 0) return [];

  const scorers = [];
  for(let i = 0; i < goalCount; i++){
    const scorer = weighted[randInt(0, weighted.length - 1)];
    scorer.goalsSeason = (scorer.goalsSeason || 0) + 1;
    scorers.push(scorer.name);
  }
  return scorers;
}

// override: vorab ausgespieltes eigenes Spiel (Halbzeit-Eingriff im Live-
// Modus) mit Toren und den Spieler-IDs der Torschuetzen.
// Vorab bestimmte Torschuetzen gutschreiben (Halbzeit-Eingriff).
function creditScorersById(spieler, ids){
  return ids.map(id => {
    const p = spieler.find(x => x.id === id);
    if(!p) return null;
    p.goalsSeason = (p.goalsSeason || 0) + 1;
    return p.name;
  }).filter(Boolean);
}

// Gewichteter Torschuetze aus einer Spielerliste (ohne Zaehlung).
function pickScorer(spieler){
  const gewichtet = [];
  (spieler || []).forEach(p => { for(let i = 0; i < (SCORER_WEIGHTS[p.pos] != null ? SCORER_WEIGHTS[p.pos] : 1); i++) gewichtet.push(p); });
  return gewichtet.length ? randChoice(gewichtet) : null;
}

function simulateMatchday(gameState, override){
  const day = gameState.matchday;
  const roundFixtures = getRoundFixtures(gameState.fixtures, gameState.teams.length, day)
    .filter(f => !f.played);

  if(roundFixtures.length === 0){
    return { finished: true, events: [], injuries: [], cards: [] };
  }

  const events = [];
  let injuries = [];
  let cards = [];

  roundFixtures.forEach(f => {
    const eigenes = f.home === gameState.clubName || f.away === gameState.clubName;
    // Das eigene Spiel laeuft immer mit Ereignissen (Rote Karte, Verletzung
    // ab ihrer Minute). Im Live-Modus kommt es fertig aus der Halbzeit.
    if(eigenes && !(override && override.home === f.home && override.away === f.away)){
      override = playOwnLeagueMatch(gameState, f.home, f.away);
    }
    const vorgegeben = override && override.home === f.home && override.away === f.away;
    const { homeGoals, awayGoals } = vorgegeben ? override : simulateMatch(gameState, f.home, f.away);
    updateStandings(gameState.teams, f.home, f.away, homeGoals, awayGoals);
    f.played = true;
    // Ergebnis am Spiel festhalten: Grundlage fuer Formkurve und Spielplanansicht.
    f.homeGoals = homeGoals;
    f.awayGoals = awayGoals;

    // Tore der KI-Vereine ihren Spielern zuordnen — Grundlage fuer die
    // ligaweite Torschuetzenliste.
    let gegnerTorschuetzen = [];
    if(vorgegeben){
      gegnerTorschuetzen = creditScorersById(gameState.pool ? gameState.pool.players : [], override.oppScorerIds || []);
    } else if(typeof assignPoolScorers === "function"){
      if(f.home !== gameState.clubName){
        const namen = assignPoolScorers(gameState, f.home, homeGoals);
        if(f.away === gameState.clubName) gegnerTorschuetzen = namen;
      }
      if(f.away !== gameState.clubName){
        const namen = assignPoolScorers(gameState, f.away, awayGoals);
        if(f.home === gameState.clubName) gegnerTorschuetzen = namen;
      }
    }

    if(f.home === gameState.clubName || f.away === gameState.clubName){
      const isHome = f.home === gameState.clubName;
      const ownGoals = isHome ? homeGoals : awayGoals;
      const result = getResultForClub(gameState.clubName, f.home, f.away, homeGoals, awayGoals);
      const opponentName = isHome ? f.away : f.home;
      const startingInfo = getStartingXIInfo(gameState.squad, day + 1);
      const ownStrength = teamRating(gameState.squad, day + 1);
      const opponentStrength = getTeamStrength(gameState, opponentName);
      const scorers = vorgegeben
        ? creditScorersById(gameState.squad, override.ownScorerIds || [])
        : assignScorers(startingInfo.xi, ownGoals);

      const ownIncidents = vorgegeben ? (override.incidents || null) : null;
      injuries = processInjuries(gameState, day + 1, null, ownIncidents);
      cards = processCards(startingInfo.xi, day + 1, ownIncidents);
      const goals = vorgegeben ? (override.goals || []) : [];
      const bewertung = typeof rateOwnPlayers === "function" ? rateOwnPlayers(startingInfo.xi, {
        ownGoals, oppGoals: isHome ? awayGoals : homeGoals, goals,
        incidents: ownIncidents, teamRatingValue: ownStrength }) : null;
      if(typeof recordGrades === "function") recordGrades(gameState.squad, bewertung);

      events.push({
        goals, incidents: ownIncidents, grades: bewertung,
        matchday: day + 1,
        home: f.home,
        away: f.away,
        homeGoals,
        awayGoals,
        result,
        ownStrength,
        opponentStrength,
        scorers,
        opponentScorers: gegnerTorschuetzen
      });


      const startingIds = new Set(startingInfo.xi.map(p => p.id));
      updateFatigue(gameState.squad, startingIds);
      developSquad(gameState.squad, day + 1, gameState.pendingYouthAppearances);
    }
  });

  gameState.matchday++;
  const seasonFinished = gameState.matchday >= getSeasonMatchdays(gameState);

  return { finished: seasonFinished, events, injuries, cards };
}

function getSortedStandings(teams){
  return [...teams].sort((a, b) =>
    b.points - a.points || (b.gf - b.ga) - (a.gf - a.ga)
  );
}

function getNextOpponentInfo(gameState){
  const day = gameState.matchday;
  const roundFixtures = getRoundFixtures(gameState.fixtures, gameState.teams.length, day)
    .filter(f => !f.played);
  const ownFixture = roundFixtures.find(f => f.home === gameState.clubName || f.away === gameState.clubName);
  if(!ownFixture) return null;

  const isHome = ownFixture.home === gameState.clubName;
  const opponentName = isHome ? ownFixture.away : ownFixture.home;

  const ownStrength = teamRating(gameState.squad, day + 1);
  const opponentStrength = getTeamStrength(gameState, opponentName);

  return {
    opponentName,
    isHome,
    ownStrength,
    opponentStrength,
    // Deterministisch, deshalb stimmt die Vorschau mit dem Spiel ueberein.
    opponentTactic: getAiTactic(opponentStrength, ownStrength, day, opponentName, gameState.clubName),
    ownForm: getFormLabel(gameState.teams.find(t => t.name === gameState.clubName)),
    opponentForm: getFormLabel(gameState.teams.find(t => t.name === opponentName)),
    ownTactic: gameState.tactic || DEFAULT_TACTIC
  };
}

// ============================================
// Spielbericht mit Zeitachse
// ============================================

// Verteilt Ereignisse ueber die Spielzeit. Die leichte Gewichtung zur zweiten
// Halbzeit bildet ab, dass in echten Spielen spaeter mehr passiert.
function drawMinute(bias){
  const r = Math.random();
  const secondHalf = Math.random() < (bias != null ? bias : 0.5);
  const base = secondHalf ? 46 : 1;
  const span = secondHalf ? MATCH_MINUTES - 45 : 45;
  return Math.max(1, Math.min(MATCH_MINUTES, base + Math.floor(r * span)));
}

function drawDistinctMinutes(count, bias, used){
  const taken = used || new Set();
  const result = [];
  for(let i = 0; i < count; i++){
    let minute = drawMinute(bias), guard = 0;
    while(taken.has(minute) && guard++ < 60) minute = drawMinute(bias);
    taken.add(minute);
    result.push(minute);
  }
  return result.sort((a, b) => a - b);
}

// Baut die vollstaendige Zeitachse eines Spiels: Tore mit Torschuetzen,
// Karten und Verletzungen, chronologisch sortiert.
// Torchancen, Paraden und Aluminium: damit ein 0:0 im Ticker nicht leer
// bleibt. Die Zahl richtet sich nach den Toren — wer trifft, hatte meist
// auch sonst mehr vom Spiel. Namen kommen aus der eigenen Startelf bzw.
// dem Kader des Gegners im Weltbestand.
function addChanceEvents(input, ownIsHome, ownGoals, oppGoals, used, events){
  const gs = typeof gameState !== "undefined" ? gameState : null;
  const eigene = gs && gs.squad ? getStartingXI(gs.squad, gs.matchday) : [];
  const gegnerName = ownIsHome ? input.away : input.home;
  const gegner = gs && gs.pool ? getClubRoster(gs.pool, gegnerName) : [];

  const schuetze = kader => {
    const feld = kader.filter(p => p.pos !== "TW");
    if(feld.length === 0) return null;
    const gewichtet = [];
    feld.forEach(p => { for(let i = 0; i < (SCORER_WEIGHTS[p.pos] || 1); i++) gewichtet.push(p); });
    return randChoice(gewichtet).name;
  };
  const torwart = kader => { const tw = kader.find(p => p.pos === "TW"); return tw ? tw.name : null; };

  const anzahl = tore => Math.min(5, randInt(1, 3) + Math.round(tore * 0.6));
  [["own", anzahl(ownGoals), eigene, gegner], ["opp", anzahl(oppGoals), gegner, eigene]].forEach(([seite, n, angreifer, verteidiger]) => {
    drawDistinctMinutes(n, 0.5, used).forEach(minute => {
      const r = Math.random();
      const type = r < 0.45 ? "chance" : r < 0.85 ? "save" : "post";
      events.push({ minute, type, side: seite, player: schuetze(angreifer), keeper: torwart(verteidiger) });
    });
  });
}

function buildMatchTimeline(input){
  const used = new Set();
  const events = [];

  const ownIsHome = input.home === input.clubName;
  const ko = input.knockout || null;
  const etOwn = ko ? (ownIsHome ? ko.etHome : ko.etAway) || 0 : 0;
  const etOpp = ko ? (ownIsHome ? ko.etAway : ko.etHome) || 0 : 0;
  const ownGoals = (ownIsHome ? input.homeGoals : input.awayGoals) - etOwn;
  const oppGoals = (ownIsHome ? input.awayGoals : input.homeGoals) - etOpp;

  if(input.goals && input.goals.length === ownGoals + oppGoals){
    // Tore mit echter Minute aus dem Spielverlauf.
    input.goals.forEach(g => { used.add(g.minute); events.push({ minute: g.minute, type: "goal", side: g.side, scorer: g.scorer || null }); });
  } else {
    const scorers = (input.scorers || []).slice();
    drawDistinctMinutes(ownGoals, GOAL_MINUTE_SECOND_HALF_BIAS, used).forEach((minute, i) => {
      events.push({ minute, type: "goal", side: "own", scorer: scorers[i] || null });
    });
    const oppScorers = (input.opponentScorers || []).slice();
    drawDistinctMinutes(oppGoals, GOAL_MINUTE_SECOND_HALF_BIAS, used).forEach((minute, i) => {
      events.push({ minute, type: "goal", side: "opp", scorer: oppScorers[i] || null });
    });
  }

  addChanceEvents(input, ownIsHome, ownGoals, oppGoals, used, events);

  (input.cards || []).forEach(c => {
    const minute = c.minute || drawDistinctMinutes(1, 0.55, used)[0];
    events.push({ minute, type: c.type === "red" ? "red" : c.type === "banAccumulated" ? "yellowRed" : "yellow",
      side: "own", player: c.player.name, count: c.player.yellowCards });
  });
  (input.incidents || []).filter(i => i.type === "red" && i.side === "opp").forEach(i => {
    events.push({ minute: i.minute, type: "red", side: "opp", player: i.player, opponent: true });
  });

  (input.injuries || []).forEach(inj => {
    // Verletzungen ohne Minute stammen aus dem Training, nicht aus dem Spiel.
    if(input.goals && !inj.minute) return;
    const minute = inj.minute || drawDistinctMinutes(1, 0.5, used)[0];
    events.push({ minute, type: "injury", player: inj.player.name, duration: inj.duration });
  });

  events.push({ minute: 45, type: "half", order: 1 });
  let schluss = MATCH_MINUTES;
  if(ko && ko.extraTime){
    events.push({ minute: 90, type: "extraTime", order: 1 });
    const belegt = new Set();
    for(let i = 0; i < etOwn; i++) events.push({ minute: drawMinutesInRange(1, 91, 120, belegt)[0], type: "goal", side: "own", scorer: null });
    for(let i = 0; i < etOpp; i++) events.push({ minute: drawMinutesInRange(1, 91, 120, belegt)[0], type: "goal", side: "opp", scorer: null });
    schluss = 120;
  }
  if(ko && ko.pens){
    events.push({ minute: schluss, type: "pens", order: 2,
      ownPens: ownIsHome ? ko.pens.home : ko.pens.away, oppPens: ownIsHome ? ko.pens.away : ko.pens.home,
      ownSeq: ownIsHome ? ko.pens.seqHome : ko.pens.seqAway, oppSeq: ownIsHome ? ko.pens.seqAway : ko.pens.seqHome });
  }
  events.push({ minute: schluss, type: "end", order: 3 });
  events.sort((a, b) => a.minute - b.minute || (a.order || 0) - (b.order || 0));

  // Zwischenstand nach jedem Ereignis mitfuehren, damit die Anzeige beim
  // Abspielen nicht nachrechnen muss.
  let h = 0, a = 0;
  events.forEach(e => {
    if(e.type === "goal"){
      if((e.side === "own") === ownIsHome) h++; else a++;
    }
    e.homeScore = h;
    e.awayScore = a;
  });

  return events;
}

// ============================================
// Ausrichtung der KI-Vereine und taktische Konter
// ============================================

// Deterministisch aus der Paarung abgeleitet, damit die Vorschau nicht luegt:
// was angekuendigt wird, wird auch gespielt.
function fixtureSeed(home, away, matchday){
  const text = home + "|" + away + "|" + matchday;
  let h = 0;
  for(let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 100000;
  return h;
}

function getAiTactic(ownStrength, opponentStrength, matchday, ownName, opponentName){
  const diff = ownStrength - opponentStrength;
  if(diff <= -AI_TACTIC_UNDERDOG_GAP) return "defensive";
  if(diff >= AI_TACTIC_FAVOURITE_GAP) return "offensive";

  // Ausgeglichene Paarungen: der Spielplan entscheidet, aber reproduzierbar.
  const seed = fixtureSeed(ownName, opponentName || "", matchday) % 10;
  if(seed < 3) return "defensive";
  if(seed < 6) return "offensive";
  return "balanced";
}

function getTacticMatchup(eigene, gegnerische){
  const zeile = TACTIC_COUNTER[eigene] || TACTIC_COUNTER.balanced;
  return zeile[gegnerische] || { own: 0, opp: 0 };
}

// Ausrichtung einer Mannschaft in einem konkreten Spiel.
function getTeamTactic(gameState, teamName, gegnerName, ownStrength, oppStrength){
  if(teamName === gameState.clubName) return gameState.tactic || DEFAULT_TACTIC;
  return getAiTactic(ownStrength, oppStrength, gameState.matchday, teamName, gegnerName);
}
